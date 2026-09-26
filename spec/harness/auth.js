// Demo authentication helpers for tests (AUTH-01). HS256 JWT with node:crypto; no
// dependencies. Protected scaffolding.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DEMO_AUTH_TOKEN_SECRET, DEFAULT_CLINIC_NOW, SEED_DATA_DIR, projectUrl } from "./config.js";

export const USER_TOKEN_SECONDS = 28800;
export const SERVICE_TOKEN_SECONDS = 300;

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const fromB64url = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
const hmac = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("base64url");

export const clinicSeconds = (clinicNow = DEFAULT_CLINIC_NOW) => Math.floor(Date.parse(clinicNow) / 1000);

/** Signs a JWT. header can be overridden to build deliberately invalid tokens. */
export function signJwt(claims, { secret = DEMO_AUTH_TOKEN_SECRET, header = { alg: "HS256", typ: "JWT" } } = {}) {
  const head = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  return `${head}.${header.alg === "none" ? "" : hmac(head, secret)}`;
}

/** Decodes a JWT and reports whether its HS256 signature matches the secret. */
export function decodeJwt(token, { secret = DEMO_AUTH_TOKEN_SECRET } = {}) {
  const [h, c, s] = token.split(".");
  const header = fromB64url(h);
  const claims = fromB64url(c);
  const expected = hmac(`${h}.${c}`, secret);
  const signatureValid = header.alg === "HS256" && typeof s === "string"
    && s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
  return { header, claims, signatureValid };
}

/** A token a service would sign for a service-to-service call. */
export function serviceToken(serviceName, { clinicNow = DEFAULT_CLINIC_NOW, ...overrides } = {}) {
  const iat = clinicSeconds(clinicNow);
  return signJwt({ sub: serviceName, role: "service", iat, exp: iat + SERVICE_TOKEN_SECONDS, ...overrides });
}

export function seedUsers() {
  return JSON.parse(fs.readFileSync(path.join(SEED_DATA_DIR, "users.json"), "utf8"));
}

/** Logs in through the Customer service; returns { status, body }. */
export async function login(username, password) {
  const res = await fetch(`${projectUrl("customer")}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export const bearer = (token) => ({ authorization: `Bearer ${token}` });
