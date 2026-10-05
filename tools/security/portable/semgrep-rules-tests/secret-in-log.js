// Semgrep rule tests for ../semgrep-rules/secret-in-log.yml.
// Never imported or executed.

export class Runtime {
  authenticate(header) {
    try {
      return JSON.parse(header);
    } catch {
      // The exact CAL-13 shape: the raw Authorization header under a neutral name.
      // ruleid: secret-logged-js
      console.error(`[${this.name}] rejected credentials:`, header);
      // ok: secret-logged-js
      console.error(`[${this.name}] rejected credentials: unauthenticated`);
    }
  }
}

export function handler(req, signingSecret, err, url) {
  // ruleid: secret-logged-js
  console.log("debug", signingSecret);
  // ruleid: secret-logged-js, request-credentials-logged-js
  console.warn(req.headers.authorization);
  // ok: secret-logged-js
  console.error(`client() failed calling ${url}:`, err);

  const raw = req.headers.authorization;
  const shown = raw.slice(0, 20);
  // ruleid: request-credentials-logged-js
  console.info("auth", shown);

  const all = req.headers;
  // ruleid: request-credentials-logged-js
  console.debug(all);

  // ok: request-credentials-logged-js
  console.info("request from", url);
}
