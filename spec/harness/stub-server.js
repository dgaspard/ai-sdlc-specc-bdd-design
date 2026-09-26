// Programmable stub that impersonates a dependency service on its real port, so a
// service under test can be verified alone (D-28). Every programmed response is
// validated against the impersonated service's contract before it is served, so a
// stub cannot drift from the real service. Protected scaffolding.
import http from "node:http";
import { PROJECTS } from "./config.js";
import { freePort } from "./processes.js";
import { loadContract, matchPath, validateResponse } from "./schema.js";

export class StubContractError extends Error {}

export class StubServer {
  /**
   * @param {string} name project name from config.js (e.g. "customer")
   * @param {{ validate?: boolean }} options validate defaults to true
   */
  constructor(name, { validate = true } = {}) {
    const p = PROJECTS[name];
    if (!p) throw new Error(`Unknown project ${name}`);
    this.name = name;
    this.title = p.title;
    this.port = p.port;
    this.contract = p.contract;
    this.validate = validate;
    this.routes = [];
    this.requests = [];
    this.server = null;
  }

  /**
   * Programs a response. pathTemplate uses the contract's form, e.g. "/customers/{customerId}".
   * body may be a value or a function (request) => value.
   */
  respond(method, pathTemplate, status, body, { headers = {} } = {}) {
    if (this.validate) {
      const { doc } = loadContract(this.contract); // throws ContractMissingError until SPEC-04
      if (!doc.paths?.[pathTemplate]?.[method.toLowerCase()]) {
        throw new StubContractError(`${this.title} contract has no ${method.toUpperCase()} ${pathTemplate}`);
      }
      if (typeof body !== "function") this.#check(method, pathTemplate, status, body);
    }
    this.routes.unshift({ method: method.toUpperCase(), pathTemplate, status, body, headers });
    return this;
  }

  #check(method, actualPath, status, body) {
    const r = validateResponse(this.contract, method, actualPath, status, body);
    if (!r.valid) {
      throw new StubContractError(
        `${this.title} stub response for ${method.toUpperCase()} ${actualPath} ${status} violates its contract: ${r.errors.join("; ")}`);
    }
  }

  /** Requests received, optionally filtered by method and contract path template. */
  received(method, pathTemplate) {
    return this.requests.filter((r) => (!method || r.method === method.toUpperCase())
      && (!pathTemplate || r.pathTemplate === pathTemplate));
  }

  reset() {
    this.routes = [];
    this.requests = [];
  }

  async start() {
    if (this.server) return;
    freePort(this.port);
    this.server = http.createServer((req, res) => this.#handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, resolve);
    });
  }

  async stop() {
    if (!this.server) return;
    const s = this.server;
    this.server = null;
    s.closeAllConnections?.();
    await new Promise((r) => s.close(r));
  }

  async #handle(req, res) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = raw;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { /* keep raw text */ }
    const path = req.url.split("?")[0];
    let pathTemplate = null;
    if (this.validate) {
      try { pathTemplate = matchPath(loadContract(this.contract).doc, path); } catch { /* no contract */ }
    }
    const entry = { method: req.method, path, url: req.url, pathTemplate, headers: req.headers, body };
    this.requests.push(entry);

    if (path === "/health") return send(res, 200, { status: "ok" });
    const route = this.routes.find((r) => r.method === req.method
      && (r.pathTemplate === pathTemplate || r.pathTemplate === path));
    if (!route) {
      return send(res, 501, { error: `${this.title} stub has no response programmed for ${req.method} ${path}` });
    }
    let out = route.body;
    if (typeof out === "function") {
      out = await out(entry);
      if (this.validate) {
        try { this.#check(req.method, path, route.status, out); } catch (e) {
          return send(res, 500, { error: e.message });
        }
      }
    }
    return send(res, route.status, out, route.headers);
  }
}

function send(res, status, body, headers = {}) {
  if (body === undefined || body === null || status === 204) {
    res.writeHead(status, headers);
    return res.end();
  }
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}
