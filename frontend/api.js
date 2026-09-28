let session;
try {
  session = JSON.parse(sessionStorage.getItem("clinic-session"));
} catch {
  session = null;
}
const config = await fetch("/config.json").then((response) => {
  if (!response.ok) throw new Error("Unable to load service configuration.");
  return response.json();
});
export function current() {
  return session;
}
export function saveSession(value) {
  session = value;
  sessionStorage.setItem("clinic-session", JSON.stringify(value));
}
export function signOut() {
  session = null;
  for (const key of Object.keys(sessionStorage)) {
    if (key === "clinic-session" || key.startsWith("clinic-payment:"))
      sessionStorage.removeItem(key);
  }
}
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.code ?? "request_failed");
    this.status = status;
    this.body = body;
  }
}
export async function request(
  service,
  path,
  { method = "GET", body, key } = {},
) {
  const response = await fetch(`${config[service]}${path}`, {
    method,
    headers: {
      ...(session ? { authorization: `Bearer ${session.token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
export function pendingKey(checkoutId) {
  return `clinic-payment:${current().user.id}:${checkoutId}`;
}
export function pendingPayment(checkoutId) {
  const data = sessionStorage.getItem(pendingKey(checkoutId));
  return data ? JSON.parse(data) : null;
}
export function rememberPayment(checkoutId, value) {
  sessionStorage.setItem(pendingKey(checkoutId), JSON.stringify(value));
}
export function forgetPayment(checkoutId) {
  sessionStorage.removeItem(pendingKey(checkoutId));
}
