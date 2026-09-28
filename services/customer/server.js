import {
  Runtime,
  id,
  ok,
  created,
  fail,
  requireValue,
  owner,
} from "../platform/runtime.js";
const app = new Runtime("customer", 4001);
let customers, users, vets, discounts;
const balance = (c) =>
  c.accountEntries.reduce(
    (sum, e) => sum + e.amountOwed - e.amountCredited - e.amountDiscounted,
    0,
  );
const view = (c) => ({ ...c, outstandingBalance: balance(c) });
const customer = (user, customerId) => owner(user, customers.get(customerId));
const validateVet = (v) => {
  if (!vets.some((x) => x.id === v)) fail(400, "validation_error");
};
const validatePet = (p) => {
  if (
    !p.name.trim() ||
    !p.type.trim() ||
    !p.breed.trim() ||
    p.estimatedBirthDate > app.date()
  )
    fail(400, "validation_error");
};
function newProfile(body, pets = []) {
  validateVet(body.preferredVeterinarianId);
  const c = {
    ...body,
    id: id(),
    pets: [],
    insurance: body.insurance ?? [],
    accountEntries: [],
    outstandingBalance: 0,
  };
  c.pets = pets.map((p) => ({ ...p, ownerId: c.id }));
  return c;
}
app.route("POST", "/auth/login", ({ body }) => {
  const u = users.find(
    (x) => x.username === body.username && x.password === body.password,
  );
  if (!u) fail(401, "unauthenticated");
  const { password: _password, ...publicUser } = u;
  return ok({ token: app.token(u), user: publicUser });
});
app.route(
  "POST",
  "/auth/register",
  ({ body }) => {
    if (users.some((u) => u.username === body.username))
      fail(400, "validation_error");
    const petIds = new Set(body.pets.map((p) => p.id));
    if (
      petIds.size !== body.pets.length ||
      [...customers.values()].some((c) => c.pets.some((p) => petIds.has(p.id)))
    )
      fail(400, "validation_error");
    body.pets.forEach(validatePet);
    if (
      body.profile.insurance.some((p) =>
        p.coveredPetIds.some((pet) => !petIds.has(pet)),
      )
    )
      fail(400, "validation_error");
    const c = newProfile(body.profile, body.pets);
    users.push({
      id: id(),
      username: body.username,
      password: body.password,
      role: "customer",
      customerId: c.id,
      displayName: `${c.firstName} ${c.lastName}`,
    });
    customers.set(c.id, c);
    app.attrs({ "customer.id": c.id });
    app.outcome("registered");
    return created(view(c));
  },
  "register",
);
app.route("POST", "/customers", ({ body }) => {
  const c = newProfile(body);
  customers.set(c.id, c);
  return created(view(c));
});
app.route("GET", "/customers", () => ok([...customers.values()].map(view)));
app.route("GET", "/customers/{customerId}", ({ user, params }) =>
  ok(view(customer(user, params.customerId))),
);
app.route("PATCH", "/customers/{customerId}", ({ user, params, body }) => {
  const c = customer(user, params.customerId);
  if (body.preferredVeterinarianId) validateVet(body.preferredVeterinarianId);
  if (
    body.insurance?.some((p) =>
      p.coveredPetIds.some((pid) => !c.pets.some((pet) => pet.id === pid)),
    )
  )
    fail(400, "validation_error");
  Object.assign(c, body);
  return ok(view(c));
});
app.route("POST", "/customers/{customerId}/pets", ({ user, params, body }) => {
  const c = customer(user, params.customerId);
  validatePet(body);
  const p = { ...body, id: id(), ownerId: c.id };
  c.pets.push(p);
  return created(p);
});
app.route("GET", "/customers/{customerId}/pets", ({ user, params }) =>
  ok(customer(user, params.customerId).pets),
);
app.route("GET", "/pets/{petId}", ({ user, params }) => {
  const c = requireValue(
    [...customers.values()].find((c) =>
      c.pets.some((p) => p.id === params.petId),
    ),
  );
  owner(user, c);
  return ok(c.pets.find((p) => p.id === params.petId));
});
app.route(
  "GET",
  "/customers/{customerId}/eligibility",
  ({ user, params }) => {
    app.attrs({ "customer.id": params.customerId });
    const c = customer(user, params.customerId),
      amount = balance(c);
    app.outcome(amount ? "ineligible" : "eligible");
    return ok({
      customerId: c.id,
      eligible: amount === 0,
      outstandingBalance: amount,
    });
  },
  "check_eligibility",
);
app.route("GET", "/customers/{customerId}/account", ({ user, params }) => {
  const c = customer(user, params.customerId);
  return ok({
    customerId: c.id,
    outstandingBalance: balance(c),
    entries: c.accountEntries,
  });
});
app.route(
  "GET",
  "/internal/customers/{customerId}/pets/{petId}/ownership",
  ({ user, params }) => {
    const c = customer(user, params.customerId);
    return ok({
      customerId: c.id,
      petId: params.petId,
      owned: c.pets.some((p) => p.id === params.petId),
    });
  },
);
app.route(
  "POST",
  "/internal/customers/{customerId}/account-changes",
  ({ user, params, body }) => {
    app.attrs({
      "customer.id": params.customerId,
      "visit.id": body.visitId,
      "account.change_type": body.type,
    });
    const c = customer(user, params.customerId);
    let e = c.accountEntries.find((e) => e.visitId === body.visitId);
    if (body.type === "charge") {
      if (e) fail(409, "already_applied");
      e = {
        id: id(),
        customerId: c.id,
        visitId: body.visitId,
        amountOwed: body.amount,
        amountCredited: 0,
        amountDiscounted: 0,
        currency: "USD",
        paymentIds: [],
      };
      c.accountEntries.push(e);
    } else {
      requireValue(e);
      if (
        (body.type === "credit" && e.paymentIds.includes(body.paymentId)) ||
        (body.type === "discount" && discounts.has(e.id))
      )
        fail(409, "already_applied");
      if (body.amount > e.amountOwed - e.amountCredited - e.amountDiscounted)
        fail(422, "invalid_amount");
      if (body.type === "credit") {
        e.amountCredited += body.amount;
        e.paymentIds.push(body.paymentId);
      } else {
        e.amountDiscounted += body.amount;
        discounts.add(e.id);
      }
    }
    app.outcome("applied");
    return ok(e);
  },
  "apply_account_change",
);
await app.serve(() => {
  vets = app.seed("veterinarians");
  users = app.seed("users");
  discounts = new Set();
  customers = new Map(
    app.seed("customers").map((c) => [
      c.id,
      {
        ...c,
        pets: c.pets.map((p) => ({ ...p, ownerId: c.id })),
        accountEntries: [],
        outstandingBalance: 0,
      },
    ]),
  );
});
