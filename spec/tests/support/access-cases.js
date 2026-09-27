// Operations/roles come from OpenAPI; explicit valid inputs keep schema errors from
// masquerading as authorization failures. New operations must be classified here.
import { PROJECTS } from "../../harness/config.js";
import { loadContract } from "../../harness/schema.js";
import { jordan, milo, avery, wellness, reservationBody, visitBody } from "./service-fixture.js";

export const operations = Object.entries(PROJECTS).filter(([, p]) => p.kind === "service").flatMap(([service, p]) =>
  Object.entries(loadContract(p.contract).doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).filter(([, op]) => op.operationId && !op["x-roles"].includes("anonymous"))
      .map(([method, op]) => ({ service, contract: p.contract, path, method: method.toUpperCase(), ...op }))));

export const ownership = new Set(["getCustomer", "updateCustomer", "addPet", "listPets", "getPet", "getEligibility", "getAccount",
  "requestReservation", "getReservation", "cancelReservation", "getVisit", "getCheckoutForVisit", "getCheckout", "payVisitBalance"]);
export const collections = new Set(["listReservations", "listVisits", "listCheckouts"]);
export const publicCatalog = new Set(["listVeterinarians", "getAvailability", "listServices", "getService", "lookupFees"]);

export function inputFor(op, f) {
  const ids = { customerId: jordan, petId: milo, veterinarianId: avery, serviceId: wellness,
    reservationId: f.reservation.id, visitId: f.visit.id, checkoutId: f.checkout?.id ?? f.reservation.id };
  const bodies = {
    correctVisit: { clinicalNotes: "Corrected clinical note" },
    updateService: { name: "Annual wellness", feeAmount: 6500 },
    createCustomer: { firstName: "Casey", lastName: "Park", phoneNumber: "312-555-0199",
      address: { street: "5 Elm St", city: "Chicago", state: "IL", postalCode: "60602" },
      emergencyContact: { name: "Robin Park", phone: "312-555-0198", relationship: "sibling" }, preferredVeterinarianId: avery },
    updateCustomer: { firstName: "Jordan" },
    addPet: { name: "Pepper", type: "cat", breed: "Unknown", estimatedBirthDate: "2023-01-01" },
    applyAccountChange: { visitId: f.visit.id, type: "charge", amount: 7000, currency: "USD" },
    requestReservation: reservationBody(), acceptReservation: { bookingFee: { method: "card", mockMethodReference: "fake-card-approve" } },
    recordVisit: visitBody(), completeReservation: { financialOutcome: "settled" },
    collectBookingFee: { reservationId: f.reservation.id, customerId: jordan, amount: 2000, currency: "USD", method: "card", mockMethodReference: "fake-card-approve" },
    applyPromotion: { amount: 500 }, payVisitBalance: { amount: 5000, mockMethodReference: "fake-card-approve" }, recordCashPayment: { amount: 5000 },
  };
  let path = op.path.replace(/\{([^}]+)\}/g, (_, key) => {
    if (!ids[key]) throw new Error(`No fixture for path parameter ${key}`);
    return ids[key];
  });
  if (op.operationId === "getAvailability") path += "?date=2026-10-12";
  if (op.operationId === "lookupFees") path += `?serviceIds=${wellness}`;
  if (op.requestBody && !bodies[op.operationId]) throw new Error(`No request fixture for ${op.operationId}`);
  return { path, body: bodies[op.operationId] };
}
