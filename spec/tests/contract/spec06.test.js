import { it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema, validateRequest, validateResponse, loadContract } from '../../harness/schema.js';

it('[SPEC-06 GAP-10] unexpected failures have a declared generic 500 problem', () => {
  const safe = { type: 'about:blank', title: 'internal_error', status: 500, code: 'internal_error' };
  for (const service of ['checkout', 'customer', 'reservation', 'veterinarian-services']) {
    const file = `${service}.openapi.json`;
    for (const [path, methods] of Object.entries(loadContract(file).doc.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (!op.responses) continue;
        assert.equal(validateResponse(file, method, path, 500, safe).valid, true);
        for (const unsafe of [{ ...safe, stack: 'secret stack' }, { ...safe, detail: 'private exception' },
          { ...safe, title: 'secret exception' }, { ...safe, code: 'dependency_failed' }]) {
          assert.equal(validateResponse(file, method, path, 500, unsafe).valid, false);
        }
      }
    }
  }
  assert.equal(validateSchema('common.openapi.json', 'Problem', safe).valid, true);
});
it('[SPEC-06 GAP-09] promotion and cash declare failed-completion responses', () => {
  for (const [route, code] of [['promotion', 'dependency_failed'], ['cash-payments', 'authorized_completion_failed']]) {
    assert.equal(validateResponse('checkout.openapi.json', 'POST', `/checkouts/00000000-0000-4000-8000-000000000001/${route}`, 502,
      { type: 'about:blank', title: code, status: 502, code, ...(route === 'cash-payments' ? { paymentAttemptId: '00000000-0000-4000-8000-000000000002' } : {}) }).valid, true);
  }
});
it('[SPEC-06 GAP-15] promotion request and domain creation require positive cents', () => {
  for (const amount of [undefined, 0, -1, 0.5, 1, 1500]) {
    const body = amount === undefined ? {} : { amount };
    const expected = Number.isInteger(amount) && amount >= 1;
    assert.equal(validateRequest('checkout.openapi.json', 'POST', '/checkouts/example/promotion', body).valid, expected);
    assert.equal(validateSchema('domain.openapi.json', 'PromotionCreate', {
      ...body, appliedByVeterinarianId: '00000000-0000-4000-8000-000000000001' }).valid, expected);
  }
});

it('[SPEC-06 GAP-09] accepted-money failure identifies the attempt for manual recovery', () => {
  const body = { type: 'about:blank', title: 'authorized_completion_failed', status: 502,
    code: 'authorized_completion_failed', paymentAttemptId: '00000000-0000-4000-8000-000000000001' };
  assert.equal(validateSchema('common.openapi.json', 'Problem', body).valid, true);
  const missing = { ...body }; delete missing.paymentAttemptId;
  assert.equal(validateSchema('common.openapi.json', 'Problem', missing).valid, false);
  assert.equal(validateSchema('common.openapi.json', 'Problem', { ...body, status: 500 }).valid, false);
});
