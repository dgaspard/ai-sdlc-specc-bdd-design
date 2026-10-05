import { test, expect } from '@playwright/test';
import { ServiceFixture, jordan, milo, avery, wellness } from '../support/service-fixture.js';
import { ensureRunning, stopAll } from '../../harness/processes.js';
import { vet as vetSeed } from '../../harness/seed.js';

let api;
test.beforeEach(async () => {
  api = new ServiceFixture('checkout', { real: true });
  await api.start();
  await api.clock('2026-10-12T08:00:00-05:00');
  await ensureRunning('frontend');
});
test.afterAll(async () => { await stopAll(); });

async function login(page, username = 'jordan.rivera') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('petclinic-demo');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/appointments$/);
}
async function logout(page) {
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, { animations: 'disabled', caret: 'hide' });
}
async function bill(page) {
  await api.finalized();
  await login(page);
  await page.goto(`/bills/${api.checkout.id}`);
  await expect(page.getByLabel('Payment amount', { exact: true })).toHaveValue('50.00');
  await unpaidSummary(page);
}
async function unpaidSummary(page) {
  const summary = page.getByRole('region', { name: 'Bill summary', exact: true });
  for (const row of [/Services\s*\$50\.00/, /Booking fee\s*\$20\.00/, /Total\s*\$70\.00/,
    /Payments received\s*\$20\.00/, /Promotion\s*\$0\.00/, /Balance due\s*\$50\.00/]) {
    await expect(summary).toContainText(row);
  }
}
async function settled() {
  const checkout = await api.call('GET', `/checkouts/${api.checkout.id}`, { actor: 'jordan.rivera', expected: 200 });
  expect(checkout.body.remainingBalance).toBe(0);
  const account = await api.call('GET', `/customers/${jordan}/account`, { service: 'customer', actor: 'jordan.rivera', expected: 200 });
  expect(account.body.outstandingBalance).toBe(0);
  const entries = account.body.entries.filter(entry => entry.visitId === checkout.body.visitId);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ amountOwed: 7000, amountCredited: 7000, amountDiscounted: 0 });
  expect(entries[0].paymentIds).toHaveLength(2);
  const reservation = await api.call('GET', `/reservations/${api.reservation.id}`, { service: 'reservation', expected: 200 });
  expect(reservation.body.reservationState).toBe('CompletedSettled');
}

test('[FE-001] login, reload, and sign out preserve access boundaries', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await capture(page, 'login.png');
  await page.getByLabel('Username', { exact: true }).fill('jordan.rivera');
  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Username or password is incorrect.');
  await login(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible();
  await logout(page);
  await page.goto('/appointments');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});

test('[FE-002] customer and assigned veterinarian complete the real browser journey', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Request appointment', exact: true }).click();
  await page.getByLabel('Pet', { exact: true }).selectOption(milo);
  await page.getByLabel('Veterinarian', { exact: true }).selectOption(avery);
  await page.getByLabel('Appointment date', { exact: true }).fill('2026-10-12');
  await page.getByLabel('Available time', { exact: true }).selectOption({ label: '9:00 AM – 10:00 AM' });
  await page.getByRole('group', { name: 'Requested services', exact: true }).getByLabel('Wellness', { exact: true }).check();
  const requested = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/reservations');
  await page.getByRole('button', { name: 'Request appointment', exact: true }).click();
  api.reservation = await (await requested).json();
  expect(api.reservation).toMatchObject({ customerId: jordan, petId: milo, veterinarianId: avery, reservationState: 'Requested', requestedServices: [wellness] });
  await expect(page.getByRole('status')).toContainText('Appointment requested.');
  await page.goto('/appointments');
  await expect(page.getByRole('cell', { name: 'Requested', exact: true })).toBeVisible();
  await capture(page, 'appointments-requested.png');
  await logout(page);
  await login(page, 'avery.taylor');
  await page.goto(`/appointments/${api.reservation.id}`);
  await page.getByLabel('Booking payment method', { exact: true }).selectOption('fake-card-approve');
  await page.getByRole('button', { name: 'Accept appointment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Appointment accepted. Booking fee paid.');
  await api.clock('2026-10-12T09:05:00-05:00');
  await page.getByRole('link', { name: 'Record visit', exact: true }).click();
  await page.getByRole('group', { name: 'Performed services', exact: true }).getByLabel('Wellness', { exact: true }).check();
  await page.getByLabel('Clinical notes', { exact: true }).fill('Routine examination');
  const recorded = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/visit'));
  await page.getByRole('button', { name: 'Save visit', exact: true }).click();
  const visit = await (await recorded).json();
  expect(visit).toMatchObject({ reservationId: api.reservation.id, customerId: jordan, petId: milo, veterinarianId: avery, clinicalNotes: 'Routine examination' });
  const finalized = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/checkout'));
  await page.getByRole('button', { name: 'Finalize bill', exact: true }).click();
  api.checkout = await (await finalized).json();
  await expect(page.getByRole('status')).toContainText('Bill finalized.');
  await logout(page);
  await login(page);
  await page.goto(`/bills/${api.checkout.id}`);
  await expect(page.getByLabel('Payment amount', { exact: true })).toHaveValue('50.00');
  await unpaidSummary(page);
  await capture(page, 'bill-unpaid.png');
  await page.getByRole('button', { name: 'Pay now', exact: true }).click();
  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible();
  await settled();
  expect(await api.providerCalls()).toHaveLength(2);
});

test('[FE-003] decline followed by a deliberate payment does not double collect', async ({ page }) => {
  await bill(page);
  const keys = [];
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/payments')) keys.push(r.headers()['idempotency-key']); });
  await page.getByLabel('Payment method', { exact: true }).selectOption('fake-card-decline');
  await page.getByRole('button', { name: 'Pay now', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Payment was declined. Your balance has not changed.');
  expect((await api.call('GET', `/checkouts/${api.checkout.id}`, { expected: 200 })).body.remainingBalance).toBe(5000);
  await page.getByLabel('Payment method', { exact: true }).selectOption('fake-card-approve');
  // Two immediate activation events exercise the pending-submit guard without a timing sleep.
  await page.getByRole('button', { name: 'Pay now', exact: true }).evaluate(button => { button.click(); button.click(); });
  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
  await settled();
  expect(await api.providerCalls()).toHaveLength(3);
});

test('[FE-004] direct routes do not grant customer or veterinarian privileges', async ({ page }) => {
  await api.finalized();
  await login(page, 'sam.lee');
  await page.goto(`/bills/${api.checkout.id}`);
  await expect(page.getByRole('alert')).toContainText('This record is unavailable.');
  await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toHaveCount(0);
  await logout(page);
  expect(await api.providerCalls()).toHaveLength(1);
  await api.start();
  await api.clock('2026-10-12T08:00:00-05:00');
  await api.request({ scheduledStart: '2026-10-13T09:00:00-05:00', scheduledEnd: '2026-10-13T10:00:00-05:00' });
  await login(page, 'morgan.reed');
  await page.goto(`/appointments/${api.reservation.id}`);
  await expect(page.getByText('Milo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept appointment', exact: true })).toHaveCount(0);
  await page.goto(`/appointments/${api.reservation.id}/visit`);
  await expect(page.getByRole('alert')).toContainText("You don't have permission to do that.");
  await expect(page.getByRole('button', { name: 'Save visit', exact: true })).toHaveCount(0);
  const reservation = await api.call('GET', `/reservations/${api.reservation.id}`, { service: 'reservation', expected: 200 });
  expect(reservation.body.visitId).toBeNull();
  expect(await api.providerCalls()).toHaveLength(0);
});

test('[FE-005] response loss and reload retain the exact payment intent', async ({ page }) => {
  await bill(page);
  const attempts = [];
  await page.route('**/checkouts/*/payments', async route => {
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    const response = await route.fetch();
    if (attempts.length === 1) await route.abort('connectionreset');
    else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Pay now', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Payment outcome needs attention.');
  await expect(page.getByText('Paid in full', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry same payment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry same payment', exact: true }).click();
  await expect(page.getByText('Paid in full', { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(attempts[1]).toEqual(attempts[0]);
  await settled();
  expect(await api.providerCalls()).toHaveLength(2);
});

// MVP-02A (D-53, D-54, D-55, D-56): administrator role, roster management,
// the visits-missing-notes report, admin-bypass actions, and reassignment.

test('[FE-006] administrator manages the veterinarian roster', async ({ page }) => {
  await login(page, 'riley.chen');
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Veterinarians', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Veterinarians', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add veterinarian', exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByLabel('First name', { exact: true }) });
  await form.getByLabel('First name', { exact: true }).fill('Casey');
  await form.getByLabel('Last name', { exact: true }).fill('Nguyen');
  await form.getByLabel('Office', { exact: true }).fill('office-3');
  await form.getByRole('button', { name: 'Add veterinarian', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Veterinarian added.');
  await expect(page.getByRole('row', { name: /Casey Nguyen/ })).toContainText('Active');
  const morganRow = page.getByRole('row', { name: /Morgan Reed/ });
  await morganRow.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Veterinarian deactivated.');
  await expect(morganRow).toContainText('Inactive');
  await morganRow.getByRole('button', { name: 'Reactivate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Veterinarian reactivated.');
  await expect(morganRow).toContainText('Active');
  await logout(page);
  await login(page, 'jordan.rivera');
  await expect(page.getByRole('link', { name: 'Veterinarians', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);
});

test('[FE-007] administrator reads the visits-missing-notes report', async ({ page }) => {
  await api.request();
  await api.accept();
  await api.clock('2026-10-12T09:05:00-05:00');
  await api.call('POST', `/reservations/${api.reservation.id}/visit`, { service: 'reservation',
    body: { performedServices: [wellness], diagnoses: [], medications: [] }, expected: 201 });
  await login(page, 'riley.chen');
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visits missing notes', exact: true })).toBeVisible();
  const row = page.getByRole('row', { name: /Milo/ });
  await expect(row).toContainText('Jordan Rivera');
  await expect(row).toContainText('Dr Avery Taylor');
  await logout(page);
  await login(page, 'jordan.rivera');
  await page.goto('/reports/visits-missing-notes');
  await expect(page.getByRole('alert')).toContainText("You don't have permission to do that.");
});

test('[FE-008] administrator bypass actions require no separate login', async ({ page }) => {
  const morgan = vetSeed('Morgan Reed');
  await api.request({ veterinarianId: morgan.id, scheduledStart: '2026-10-13T09:00:00-05:00', scheduledEnd: '2026-10-13T10:00:00-05:00' });
  await login(page, 'avery.taylor');
  await page.goto(`/appointments/${api.reservation.id}`);
  await page.getByLabel('Booking payment method', { exact: true }).selectOption('fake-card-approve');
  await page.getByRole('button', { name: 'Accept on behalf of Dr Morgan Reed', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Appointment accepted. Booking fee paid.');
  await api.clock('2026-10-13T09:05:00-05:00');
  await page.getByRole('link', { name: 'Record visit', exact: true }).click();
  await expect(page.getByLabel('Clinical notes', { exact: true })).toHaveCount(0);
  await page.getByRole('group', { name: 'Performed services', exact: true }).getByLabel('Wellness', { exact: true }).check();
  await page.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Visit recorded.');
  await expect(page.getByText('Missing clinical notes', { exact: true })).toBeVisible();
  // Same signed-in session, her own assigned appointment still records normally (no toggle needed, D-53).
  await api.request({ scheduledStart: '2026-10-13T10:00:00-05:00', scheduledEnd: '2026-10-13T11:00:00-05:00' });
  await api.accept();
  await api.clock('2026-10-13T10:05:00-05:00');
  await page.goto(`/appointments/${api.reservation.id}/visit`);
  await expect(page.getByLabel('Clinical notes', { exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Performed services', exact: true }).getByLabel('Wellness', { exact: true }).check();
  await page.getByLabel('Clinical notes', { exact: true }).fill('Routine examination');
  await page.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Visit recorded.');
});

test("[FE-009] reassigning an appointment's veterinarian", async ({ page }) => {
  const morgan = vetSeed('Morgan Reed');
  await api.request({ veterinarianId: morgan.id, scheduledStart: '2026-10-14T09:00:00-05:00', scheduledEnd: '2026-10-14T10:00:00-05:00' });
  await api.call('POST', `/reservations/${api.reservation.id}/accept`, { service: 'reservation', actor: 'morgan.reed',
    body: { bookingFee: { method: 'card', mockMethodReference: 'fake-card-approve' } }, expected: 200 });
  await login(page, 'morgan.reed');
  await page.goto(`/appointments/${api.reservation.id}`);
  await expect(page.getByRole('button', { name: 'Reassign to me', exact: true })).toHaveCount(0);
  await logout(page);
  // Administrator-only: no veterinarian identity to self-claim with, so no control at all.
  await login(page, 'riley.chen');
  await page.goto(`/appointments/${api.reservation.id}`);
  await expect(page.getByRole('button', { name: /^Reassign/ })).toHaveCount(0);
  await logout(page);
  await login(page, 'avery.taylor');
  await page.goto(`/appointments/${api.reservation.id}`);
  await page.getByRole('button', { name: 'Reassign to me', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Appointment reassigned to you.');
  await expect(page.getByText('Dr Avery Taylor', { exact: true })).toBeVisible();
  await api.clock('2026-10-14T09:05:00-05:00');
  await page.getByRole('link', { name: 'Record visit', exact: true }).click();
  await page.getByRole('group', { name: 'Performed services', exact: true }).getByLabel('Wellness', { exact: true }).check();
  await page.getByLabel('Clinical notes', { exact: true }).fill('Routine examination');
  await page.getByRole('button', { name: 'Save visit', exact: true }).click();
  await page.goto(`/appointments/${api.reservation.id}`);
  await expect(page.getByRole('button', { name: /^Reassign/ })).toHaveCount(0);
});
