import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  ROOT_CONTEXT,
  trace,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";

export const id = randomUUID;
export const copy = (value) => structuredClone(value);
export class Problem extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const fail = (status, code, extra) => {
  throw new Problem(status, code, extra);
};
export const requireValue = (value, status = 404, code = "not_found") =>
  value || fail(status, code);
export function owner(user, value) {
  requireValue(value);
  // Customer profiles own themselves; other resources have an explicit customerId.
  // Never let a resource's own ID bypass that explicit owner.
  if (
    user.role === "customer" &&
    user.customerId !== (value.customerId ?? value.id)
  )
    fail(404, "not_found");
  return value;
}
export function assigned(user, veterinarianId) {
  if (user.veterinarianId !== veterinarianId)
    fail(403, "not_assigned_veterinarian");
}
// Serial queues cover a domain critical section, including asynchronous downstream work.
export class Locks {
  queues = new Map();
  async run(key, action) {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this.queues.set(key, current);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.queues.get(key) === current) this.queues.delete(key);
    }
  }
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export class Runtime {
  context = new AsyncLocalStorage();
  routes = [];
  constructor(name, port, dependencies = []) {
    this.name = name;
    this.port = Number(process.env.PORT ?? port);
    for (const variable of [
      "AUTH_TOKEN_SECRET",
      "SEED_DATA_DIR",
      ...dependencies,
    ])
      if (!process.env[variable])
        throw new Error(`Missing required environment variable: ${variable}`);
    this.secret = process.env.AUTH_TOKEN_SECRET;
    this.initialNow = process.env.CLINIC_NOW;
    this.clock = this.initialNow;
    this.provider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        "service.name": process.env.OTEL_SERVICE_NAME ?? `petclinic-${name}`,
        "service.version": "1.0.0",
        "telemetry.sdk.language": "nodejs",
      }),
      spanProcessors: [
        new BatchSpanProcessor(new OTLPTraceExporter({ timeoutMillis: 1000 }), {
          exportTimeoutMillis: 1000,
          scheduledDelayMillis: Number(
            process.env.OTEL_BSP_SCHEDULE_DELAY ?? 100,
          ),
        }),
      ],
    });
    this.tracer = this.provider.getTracer("petclinic-runtime");
    const dir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../spec/contracts",
    );
    this.ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(this.ajv);
    for (const file of fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".openapi.json"))) {
      const doc = JSON.parse(fs.readFileSync(path.join(dir, file)));
      doc.$id = file;
      this.ajv.addSchema(doc, file);
      if (file === `${name}.openapi.json`) this.contract = doc;
    }
    this.validateIdempotencyKey = this.ajv.compile({
      $ref: "common.openapi.json#/components/parameters/IdempotencyKey/schema",
    });
  }
  now() {
    return this.clock ?? new Date().toISOString();
  }
  date() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(this.now()));
  }
  seed(file) {
    return JSON.parse(
      fs.readFileSync(path.join(process.env.SEED_DATA_DIR, `${file}.json`)),
    );
  }
  sign(claims) {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const data = `${header}.${payload}`;
    return `${data}.${createHmac("sha256", this.secret).update(data).digest("base64url")}`;
  }
  token(user) {
    const iat = Math.floor(Date.parse(this.now()) / 1000);
    return this.sign({
      sub: user.id,
      role: user.role,
      iat,
      exp: iat + 28800,
      ...(user.customerId
        ? { customerId: user.customerId }
        : { veterinarianId: user.veterinarianId }),
    });
  }
  serviceToken() {
    const iat = Math.floor(Date.parse(this.now()) / 1000);
    return this.sign({ sub: this.name, role: "service", iat, exp: iat + 300 });
  }
  authenticate(header) {
    try {
      if (!header?.startsWith("Bearer ")) throw new Error();
      const parts = header.slice(7).split(".");
      if (parts.length !== 3) throw new Error();
      const [h, p, s] = parts,
        head = JSON.parse(Buffer.from(h, "base64url")),
        claims = JSON.parse(Buffer.from(p, "base64url"));
      const expected = createHmac("sha256", this.secret)
        .update(`${h}.${p}`)
        .digest("base64url");
      if (
        head.alg !== "HS256" ||
        s.length !== expected.length ||
        !timingSafeEqual(Buffer.from(s), Buffer.from(expected))
      )
        throw new Error();
      const now = Date.parse(this.now()) / 1000;
      if (
        !Number.isFinite(claims.exp) ||
        claims.exp <= now ||
        !claims.sub ||
        !["customer", "veterinarian", "service"].includes(claims.role)
      )
        throw new Error();
      if (
        (claims.role === "customer" && !claims.customerId) ||
        (claims.role === "veterinarian" && !claims.veterinarianId)
      )
        throw new Error();
      return claims;
    } catch {
      fail(401, "unauthenticated");
    }
  }
  route(method, route, action, operation) {
    const op = this.contract.paths[route]?.[method.toLowerCase()];
    if (!op) throw new Error(`Undeclared route ${method} ${route}`);
    const keys = [...route.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    const pattern = new RegExp(`^${route.replace(/\{[^}]+\}/g, "([^/]+)")}$`);
    const schema = op.requestBody?.content?.["application/json"]?.schema;
    const validate = schema
      ? this.ajv.compile({
          $ref: `${this.name}.openapi.json#/paths/${route.replaceAll("~", "~0").replaceAll("/", "~1")}/${method.toLowerCase()}/requestBody/content/application~1json/schema`,
        })
      : null;
    this.routes.push({
      method,
      route,
      action,
      operation,
      op,
      keys,
      pattern,
      validate,
    });
  }
  attrs(values) {
    const span = this.context.getStore()?.business;
    if (span)
      for (const [k, v] of Object.entries(values))
        if (v !== undefined && v !== null)
          span.setAttribute(`petclinic.${k}`, v);
  }
  outcome(value) {
    const ctx = this.context.getStore();
    if (ctx) ctx.outcome = value;
  }
  async client(
    url,
    { method = "GET", body, payment = false, headers = {} } = {},
  ) {
    const ctx = this.context.getStore();
    const u = new URL(url);
    const span = this.tracer.startSpan(
      payment ? "petclinic.payment.authorize" : `${method} ${u.pathname}`,
      { kind: SpanKind.CLIENT },
      ctx?.active ?? ROOT_CONTEXT,
    );
    span.setAttributes({
      "http.request.method": method,
      "server.address": u.hostname,
      "server.port": Number(u.port || 80),
      "url.full": `${u.origin}${u.pathname}`,
    });
    if (payment)
      span.setAttributes({
        "petclinic.payment.attempt.id": body.attemptId,
        "petclinic.payment.purpose": body.purpose,
        "petclinic.payment.provider": "fake",
        "petclinic.payment.amount_cents": body.amount,
      });
    const sc = span.spanContext();
    try {
      const r = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          ...(!payment
            ? { authorization: `Bearer ${this.serviceToken()}` }
            : {}),
          ...headers,
          traceparent: `00-${sc.traceId}-${sc.spanId}-01`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      span.setAttribute("http.response.status_code", r.status);
      const data = await r.json();
      if (r.status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute("error.type", String(r.status));
      }
      if (payment) {
        span.setAttribute(
          "petclinic.operation.outcome",
          r.ok ? data.outcome : "failed",
        );
        span.setStatus({
          code: !r.ok
            ? SpanStatusCode.ERROR
            : data.outcome === "authorized"
              ? SpanStatusCode.OK
              : SpanStatusCode.UNSET,
        });
      }
      return { status: r.status, body: data };
    } catch {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute("error.type", "dependency_failure");
      if (payment) span.setAttribute("petclinic.operation.outcome", "failed");
      fail(502, "dependency_failed");
    } finally {
      span.end();
    }
  }
  async dependency(url, options) {
    const r = await this.client(url, options);
    if (r.status >= 400)
      fail(
        r.status >= 500 ? 502 : r.status,
        r.body.code ?? "dependency_failed",
        r.body.unknownServiceIds
          ? { unknownServiceIds: r.body.unknownServiceIds }
          : {},
      );
    return r.body;
  }
  async serve(reset) {
    this.reset = reset;
    await reset();
    const success = new Set([
      "eligible",
      "registered",
      "corrected",
      "updated",
      "requested",
      "accepted",
      "canceled",
      "recorded",
      "found",
      "finalized",
      "applied",
      "settled",
      "partially_paid",
      "completed_settled",
      "completed_outstanding",
    ]);
    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost");
      const route = this.routes.find(
        (r) => r.method === req.method && r.pattern.test(url.pathname),
      );
      const routeName =
        route?.route ?? (url.pathname === "/health" ? "/health" : "/unknown");
      let parent = ROOT_CONTEXT;
      const incoming = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(
        req.headers.traceparent ?? "",
      );
      if (incoming)
        parent = trace.setSpanContext(parent, {
          traceId: incoming[1],
          spanId: incoming[2],
          traceFlags: parseInt(incoming[3], 16),
          isRemote: true,
        });
      const server = this.tracer.startSpan(
        `${req.method} ${routeName}`,
        { kind: SpanKind.SERVER },
        parent,
      );
      server.setAttributes({
        "http.request.method": req.method,
        "http.route": routeName,
        "url.path": url.pathname,
        "url.scheme": "http",
      });
      const ctx = { server, active: trace.setSpan(ROOT_CONTEXT, server) };
      await this.context.run(ctx, async () => {
        let status = 200,
          result;
        try {
          if (
            req.headers.origin ===
            (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
          ) {
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
            res.setHeader(
              "Access-Control-Allow-Methods",
              "GET, POST, PUT, PATCH, DELETE",
            );
            res.setHeader(
              "Access-Control-Allow-Headers",
              "Authorization, Content-Type, Idempotency-Key",
            );
          }
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 1048576) fail(400, "validation_error");
          }
          let body;
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            fail(400, "validation_error");
          }
          if (req.method === "OPTIONS") status = 204;
          else if (url.pathname === "/health") result = { status: "ok" };
          else if (url.pathname.startsWith("/test/")) {
            if (process.env.PETCLINIC_TEST_ENDPOINTS !== "enabled")
              fail(404, "not_found");
            if (req.method === "POST" && url.pathname === "/test/reset") {
              this.clock = this.initialNow;
              await reset();
              status = 204;
            } else if (
              req.method === "POST" &&
              url.pathname === "/test/clock"
            ) {
              if (
                !body?.now ||
                !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(body.now) ||
                !Number.isFinite(Date.parse(body.now))
              )
                fail(400, "validation_error");
              this.clock = body.now;
              status = 204;
            } else fail(404, "not_found");
          } else {
            if (!route)
              fail(
                this.routes.some((r) => r.pattern.test(url.pathname))
                  ? 405
                  : 404,
                "not_found",
              );
            const user = route.op["x-roles"].includes("anonymous")
              ? null
              : this.authenticate(req.headers.authorization);
            if (user && !route.op["x-roles"].includes(user.role))
              fail(403, "forbidden");
            if (route.validate && !route.validate(body))
              fail(400, "validation_error");
            const keyRequired = route.op.parameters?.some((p) =>
              p.$ref?.endsWith("/IdempotencyKey"),
            );
            if (
              keyRequired &&
              !this.validateIdempotencyKey(req.headers["idempotency-key"])
            )
              fail(400, "validation_error");
            const operation =
              typeof route.operation === "function"
                ? route.operation(body)
                : route.operation;
            if (operation) {
              ctx.business = this.tracer.startSpan(
                `petclinic.${this.name.replaceAll("-", "_")}.${operation}`,
                {},
                ctx.active,
              );
              ctx.active = trace.setSpan(ROOT_CONTEXT, ctx.business);
            }
            const match = route.pattern.exec(url.pathname),
              params = Object.fromEntries(
                route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]),
              );
            const response = await route.action({
              body,
              user,
              params,
              query: url.searchParams,
              key: req.headers["idempotency-key"],
            });
            status = response?.status ?? 200;
            result = response?.body;
          }
        } catch (e) {
          status = e instanceof Problem ? e.status : 500;
          const code = e instanceof Problem ? e.code : "internal_error";
          result = {
            type: "about:blank",
            title: code,
            status,
            code,
            ...(e.extra ?? {}),
          };
          ctx.outcome ??=
            status >= 500
              ? code === "authorized_completion_failed"
                ? code
                : "failed"
              : code;
        } finally {
          if (ctx.business) {
            const outcome = ctx.outcome ?? "failed";
            ctx.business.setAttribute("petclinic.operation.outcome", outcome);
            ctx.business.setStatus({
              code: ["failed", "authorized_completion_failed"].includes(outcome)
                ? SpanStatusCode.ERROR
                : success.has(outcome)
                  ? SpanStatusCode.OK
                  : SpanStatusCode.UNSET,
            });
            if (["failed", "authorized_completion_failed"].includes(outcome))
              ctx.business.setAttribute(
                "error.type",
                outcome === "failed" ? "dependency_failure" : outcome,
              );
            ctx.business.end();
          }
          server.setAttribute("http.response.status_code", status);
          if (status >= 500) {
            server.setStatus({ code: SpanStatusCode.ERROR });
            server.setAttribute("error.type", String(status));
          }
          server.end();
          res.statusCode = status;
          if (status === 204) res.end();
          else {
            res.setHeader(
              "content-type",
              status >= 400 ? "application/problem+json" : "application/json",
            );
            res.end(JSON.stringify(result));
          }
        }
      });
    });
    this.server.listen(this.port, "0.0.0.0");
    const stop = async () => {
      this.server.close();
      this.server.closeIdleConnections();
      await this.provider.shutdown();
      process.exit(0);
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  }
}
export const ok = (body) => ({ body });
export const created = (body) => ({ status: 201, body });
