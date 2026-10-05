// Semgrep rule tests for ../semgrep-rules/timing-safe-compare.yml.
// Run: semgrep --test --config tools/security/portable/semgrep-rules tools/security/portable/semgrep-rules-tests
// Never imported or executed; each annotated line is a positive or negative case.
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export function calibrationCal04(h, p, s, secret) {
  // The exact CAL-04 shape: neutral names, HMAC digest, !==.
  const expected = createHmac("sha256", secret)
    .update(`${h}.${p}`)
    .digest("base64url");
  // ruleid: timing-unsafe-digest-compare-js
  if (s !== expected) throw new Error();
  // ok: timing-unsafe-digest-compare-js
  if (s.length !== expected.length) throw new Error();
  // ok: timing-unsafe-digest-compare-js
  return timingSafeEqual(Buffer.from(s), Buffer.from(expected));
}

export function inlineDigest(body, mac, key) {
  // ruleid: timing-unsafe-digest-compare-js, timing-unsafe-secret-compare-js
  return mac === createHmac("sha256", key).update(body).digest("hex");
}

export function hashCompare(input, stored) {
  let computed;
  computed = createHash("sha256").update(input).digest("hex");
  // ruleid: timing-unsafe-digest-compare-js
  return computed == stored;
}

export function names(user, body, signature, expectedSig, apiKey, token, x) {
  // ruleid: timing-unsafe-secret-compare-js
  if (user.password === body.password) return 1;
  // ruleid: timing-unsafe-secret-compare-js
  if (expectedSig !== signature) return 2;
  // ruleid: timing-unsafe-secret-compare-js
  if (x != apiKey) return 3;
  // ok: timing-unsafe-secret-compare-js
  if (token === undefined) return 4;
  // ok: timing-unsafe-secret-compare-js
  if (token === null) return 5;
  // ok: timing-unsafe-secret-compare-js
  if (typeof token !== "string") return 6;
  // ok: timing-unsafe-secret-compare-js
  if (signature.length !== expectedSig.length) return 7;
  // ok: timing-unsafe-secret-compare-js
  if (body.tokenType === "Bearer") return 8;
  return 0;
}
