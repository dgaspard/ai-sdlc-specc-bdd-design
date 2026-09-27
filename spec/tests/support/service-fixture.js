// Black-box fixture for assertion suites. State is created through published APIs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PROJECTS, DEFAULT_CLINIC_NOW, projectUrl } from "../../harness/config.js";
import { assertImplemented, ensureRunning, resetProject, setClinicClock, stopAll } from "../../harness/processes.js";
import { StubServer } from "../../harness/stub-server.js";
import { validateRequest, validateResponse } from "../../harness/schema.js";
import { signJwt, serviceToken, clinicSeconds, USER_TOKEN_SECONDS } from "../../harness/auth.js";
import * as seed from "../../harness/seed.js";

export const unknownId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
export const jordan = seed.customer("Jordan").id;
export const milo = seed.pet("Milo").id;
export const avery = seed.vet("Avery Taylor").id;
export const wellness = seed.service("Wellness").id;
export const problem = (status, code) => ({ type: "about:blank", title: code, status, code });
export function tokenFor(username = "avery.taylor", now = DEFAULT_CLINIC_NOW) {
  if (username === "service") return serviceToken("checkout", { clinicNow: now });
  const u = seed.user(username), iat = clinicSeconds(now);
  return signJwt({ sub: u.id, role: u.role, iat, exp: iat + USER_TOKEN_SECONDS,
    ...(u.role === "customer" ? { customerId: u.customerId } : { veterinarianId: u.veterinarianId }) });
}
export const reservationBody = () => ({ customerId: jordan, petId: milo, veterinarianId: avery,
  scheduledStart: "2026-10-12T09:00:00-05:00", scheduledEnd: "2026-10-12T10:00:00-05:00", requestedServices: [wellness] });
export const visitBody = () => ({ performedServices: [wellness], clinicalNotes: "Routine examination", diagnoses: [], medications: [] });

export class ServiceFixture {
  constructor(service, { real = false } = {}) {
    this.service = service;
    this.real = real;
    this.stubs = {};
    this.now = DEFAULT_CLINIC_NOW;
    this.reservation = { ...reservationBody(), id: randomUUID(), requestedAt: DEFAULT_CLINIC_NOW,
      acceptedAt: DEFAULT_CLINIC_NOW, bookingFeeAmount: 2000, bookingFeePaid: true,
      bookingPaymentId: randomUUID(), reservationState: "Accepted", visitId: randomUUID(), denialReason: null };
    this.visit = { ...visitBody(), id: this.reservation.visitId, reservationId: this.reservation.id,
      customerId: jordan, petId: milo, veterinarianId: avery, startedAt: "2026-10-12T09:05:00-05:00" };
    this.checkout = null;
  }
  async start() {
    const names = this.real ? Object.keys(PROJECTS).filter((n) => PROJECTS[n].kind === "service") : [this.service];
    names.forEach(assertImplemented); // fail before opening any ports when implementation is absent
    await ensureRunning("collector");
    await resetProject("collector");
    if (this.real || PROJECTS[this.service].dependsOn.includes("payment")) {
      await ensureRunning("payment");
      await resetProject("payment");
    }
    if (!this.real) for (const dep of PROJECTS[this.service].dependsOn.filter((n) => n !== "payment")) {
      this.stubs[dep] = new StubServer(dep);
      await this.stubs[dep].start();
    }
    this.programStubs();
    for (const name of names) {
      await ensureRunning(name);
      await resetProject(name);
    }
  }
  async stop() {
    await stopAll();
    await Promise.all(Object.values(this.stubs).map((s) => s.stop()));
  }
  async clock(now) {
    this.now = now;
    for (const name of this.real ? ["customer", "reservation", "checkout", "veterinarian-services"] : [this.service]) {
      await setClinicClock(name, now);
    }
  }
  async call(method, path, { body, actor = "avery.taylor", token = tokenFor(actor, this.now),
    service = this.service, headers = {}, expected, validate = true } = {}) {
    if (body !== undefined) {
      const v = validateRequest(PROJECTS[service].contract, method, path, body);
      assert.deepEqual(v.errors, [], `invalid fixture request: ${method} ${path}`);
    }
    const res = await fetch(`${projectUrl(service)}${path}`, { method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}), "idempotency-key": randomUUID(), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (expected !== undefined) assert.equal(res.status, expected, `${method} ${path}: ${text}`);
    if (validate) assert.deepEqual(validateResponse(PROJECTS[service].contract, method, path, res.status, data).errors, []);
    return { status: res.status, body: data };
  }
  async request(overrides = {}) {
    const r = await this.call("POST", "/reservations", { service: "reservation", actor: "jordan.rivera",
      body: { ...reservationBody(), ...overrides }, expected: 201 });
    this.reservation = r.body;
    return r;
  }
  async accept() {
    return this.call("POST", `/reservations/${this.reservation.id}/accept`, { service: "reservation",
      body: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } }, expected: 200 });
  }
  async recordedVisit() {
    await this.request();
    await this.accept();
    await this.clock("2026-10-12T09:05:00-05:00");
    const r = await this.call("POST", `/reservations/${this.reservation.id}/visit`, { service: "reservation", body: visitBody(), expected: 201 });
    this.visit = r.body;
    return r;
  }
  async finalized() {
    if (this.real) await this.recordedVisit();
    const r = await this.call("POST", `/visits/${this.visit.id}/checkout`, { service: "checkout", expected: 201 });
    this.checkout = r.body;
    return r;
  }
  async providerCalls() {
    const r = await fetch(`${projectUrl("payment")}/test/calls`);
    assert.equal(r.status, 200);
    return (await r.json()).calls;
  }
  programStubs() {
    const c = this.stubs.customer;
    if (c) {
      c.respond("GET", "/customers/{customerId}/eligibility", 200, (r) => ({ customerId: r.path.split("/")[2], eligible: true, outstandingBalance: 0 }));
      c.respond("GET", "/internal/customers/{customerId}/pets/{petId}/ownership", 200, (r) => {
        const customerId = r.path.split("/")[3], petId = r.path.split("/")[5];
        return { customerId, petId, owned: seed.pets.some((p) => p.id === petId && p.ownerId === customerId) };
      });
      const ledger = new Map();
      c.respond("POST", "/internal/customers/{customerId}/account-changes", 200, (r) => {
        const b = r.body;
        const e = ledger.get(b.visitId) ?? { id: randomUUID(), customerId: jordan, visitId: b.visitId,
          amountOwed: 0, amountCredited: 0, amountDiscounted: 0, currency: "USD", paymentIds: [] };
        if (b.type === "charge") e.amountOwed = b.amount;
        if (b.type === "credit") { e.amountCredited += b.amount; e.paymentIds.push(b.paymentId); }
        if (b.type === "discount") e.amountDiscounted += b.amount;
        ledger.set(b.visitId, e);
        return structuredClone(e);
      });
    }
    const r = this.stubs.reservation;
    if (r) {
      r.respond("GET", "/visits/{visitId}", 200, () => this.visit);
      r.respond("GET", "/reservations/{reservationId}", 200, () => this.reservation);
      r.respond("POST", "/internal/reservations/{reservationId}/complete", 200, (req) => {
        this.reservation.reservationState = req.body.financialOutcome === "settled" ? "CompletedSettled" : "CompletedOutstanding";
        return { ...this.reservation };
      });
    }
    const v = this.stubs["veterinarian-services"];
    if (v) {
      v.respond("GET", "/fees", 200, (r) => ({ fees: new URL(r.url, "http://stub").searchParams.get("serviceIds").split(",")
        .map((id) => seed.services.find((s) => s.id === id)) }));
      v.respond("GET", "/services/{serviceId}", 200, (r) => seed.services.find((s) => s.id === r.path.split("/")[2]));
    }
    const checkout = this.stubs.checkout;
    if (checkout) checkout.respond("POST", "/internal/booking-fees", 200, (r) => {
      const attemptId = randomUUID(), b = r.body;
      const declined = b.mockMethodReference?.startsWith("fake-card-decline");
      return { reservationId: b.reservationId, paid: !declined, replayed: false, ...(!declined ? { paymentId: attemptId } : {}),
        attempt: { attemptId, customerId: b.customerId, reservationId: b.reservationId, purpose: "booking_fee",
          amount: 2000, currency: "USD", timestamp: this.now, outcome: declined ? "declined" : "authorized",
          mockMethodReference: b.mockMethodReference, ...(!declined ? { authorizationReference: "fake-authorization" } : {}) } };
    });
  }
}
