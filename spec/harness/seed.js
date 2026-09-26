// Seed data lookups shared by steps (fixed IDs from spec/seed-data).
import fs from "node:fs";
import path from "node:path";
import { SEED_DATA_DIR } from "./config.js";

const load = (f) => JSON.parse(fs.readFileSync(path.join(SEED_DATA_DIR, f), "utf8"));
export const veterinarians = load("veterinarians.json");
export const services = load("services.json");
export const customers = load("customers.json");
export const users = load("users.json");
export const pets = customers.flatMap((c) => c.pets.map((p) => ({ ...p, ownerId: c.id })));

const norm = (s) => s.replace(/^Dr\.?\s+/i, "").trim().toLowerCase();
const fullName = (x) => `${x.firstName} ${x.lastName}`.toLowerCase();

export function vet(name) {
  const v = veterinarians.find((x) => fullName(x) === norm(name) || x.lastName.toLowerCase() === norm(name));
  if (!v) throw new Error(`No seeded veterinarian named ${name}`);
  return v;
}
export function service(name) {
  const s = services.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!s) throw new Error(`No catalog service named ${name}`);
  return s;
}
export function customer(name) {
  const c = customers.find((x) => fullName(x) === name.toLowerCase() || x.firstName.toLowerCase() === name.toLowerCase());
  if (!c) throw new Error(`No seeded customer named ${name}`);
  return c;
}
export function pet(name) {
  const p = pets.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!p) throw new Error(`No seeded pet named ${name}`);
  return p;
}
export function user(username) {
  const u = users.find((x) => x.username === username);
  if (!u) throw new Error(`No seeded user ${username}`);
  return u;
}
/** Seeded user for a person's display name, e.g. "Jordan" or "Dr Avery Taylor". */
export function userFor(name) {
  const n = norm(name);
  const u = users.find((x) => norm(x.displayName) === n || norm(x.displayName).split(" ")[0] === n
    || norm(x.displayName).split(" ").at(-1) === n);
  if (!u) throw new Error(`No seeded user for ${name}`);
  return u;
}
