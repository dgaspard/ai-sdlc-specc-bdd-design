// Validates data against schemas in spec/contracts (OpenAPI 3.1 / JSON Schema 2020-12).
// Protected scaffolding used by stubs, contract tests, and step definitions.
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { CONTRACTS_DIR } from "./config.js";

export class ContractMissingError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ajv = new Ajv2020({ strict: false, allErrors: true, validateSchema: false });
ajv.addFormat("uuid", UUID);
ajv.addFormat("date-time", (s) => DATE_TIME.test(s) && !Number.isNaN(Date.parse(s)));
ajv.addFormat("date", (s) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)));

const loaded = new Map(); // file -> { id, doc }

export function contractPath(file) {
  return path.join(CONTRACTS_DIR, file);
}

export function loadContract(file) {
  if (loaded.has(file)) return loaded.get(file);
  const p = contractPath(file);
  if (!fs.existsSync(p)) {
    throw new ContractMissingError(`Contract spec/contracts/${file} does not exist yet (SPEC-04)`);
  }
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  const id = `https://petclinic.local/contracts/${file}`;
  ajv.addSchema({ ...doc, $id: id });
  const entry = { id, doc };
  loaded.set(file, entry);
  return entry;
}

const pointer = (...parts) => parts.map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");

function check(validate, data) {
  const valid = validate(data);
  return {
    valid,
    errors: valid ? [] : validate.errors.map((e) => `${e.instancePath || "(root)"} ${e.message}`),
  };
}

/** Validates data against components.schemas[name]. */
export function validateSchema(file, name, data) {
  const { id, doc } = loadContract(file);
  if (!doc.components?.schemas?.[name]) throw new Error(`${file} has no schema named ${name}`);
  return check(ajv.getSchema(`${id}#/${pointer("components", "schemas", name)}`), data);
}

/** Finds the OpenAPI path template matching a concrete path, e.g. /customers/{id}. */
export function matchPath(doc, actualPath) {
  const actual = actualPath.split("?")[0].split("/");
  const templates = Object.keys(doc.paths ?? {});
  // Prefer literal matches (e.g. /visits/history) over parameter matches (/visits/{id}).
  const score = (t) => t.split("/").filter((s) => s.startsWith("{")).length;
  for (const template of templates.sort((a, b) => score(a) - score(b))) {
    const parts = template.split("/");
    if (parts.length !== actual.length) continue;
    if (parts.every((seg, i) => (seg.startsWith("{") && seg.endsWith("}") ? actual[i] !== "" : seg === actual[i]))) {
      return template;
    }
  }
  return null;
}

/** Returns the JSON response schema pointer for an operation, or throws if undocumented. */
export function responseTarget(file, method, actualPath, status) {
  const { id, doc } = loadContract(file);
  const template = matchPath(doc, actualPath);
  if (!template) throw new Error(`${file}: no path matches ${actualPath}`);
  const op = doc.paths[template][method.toLowerCase()];
  if (!op) throw new Error(`${file}: ${method.toUpperCase()} ${template} is not defined`);
  const code = String(status);
  const resp = op.responses?.[code] ?? op.responses?.default;
  if (!resp) throw new Error(`${file}: ${method.toUpperCase()} ${template} does not define status ${code}`);
  const key = op.responses?.[code] ? code : "default";
  const hasJson = !!resp.content?.["application/json"]?.schema;
  return {
    template,
    hasJson,
    ref: hasJson ? `${id}#/${pointer("paths", template, method.toLowerCase(), "responses", key, "content", "application/json", "schema")}` : null,
  };
}

/** Validates a response body against the operation's documented schema for that status. */
export function validateResponse(file, method, actualPath, status, body) {
  const t = responseTarget(file, method, actualPath, status);
  if (!t.hasJson) {
    const empty = body === undefined || body === null || body === "";
    return { valid: empty, errors: empty ? [] : ["response body present but none documented"] };
  }
  return check(ajv.getSchema(t.ref), body);
}
