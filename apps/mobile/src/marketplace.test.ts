import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, DAY, isActive, post, seed } from './marketplace.ts';
test('listing closes exactly 24 hours after creation', () => {
  const state = seed(100000000); const job = state.jobs[0];
  assert.equal(isActive(job, job.createdAt + DAY - 1), true);
  assert.equal(isActive(job, job.createdAt + DAY), false);
  assert.throws(() => apply(state, job.id, job.createdAt + DAY));
});
test('duplicate and own-job applications are rejected; withdrawal permits reapplying', () => {
  const state = seed(); const next = apply(state, state.jobs[0].id);
  assert.throws(() => apply(next, state.jobs[0].id));
  const withdrawn = { ...next, applications: next.applications.map(a => ({ ...a, status: 'Withdrawn' as const })) };
  assert.equal(apply(withdrawn, state.jobs[0].id).applications.length, 1);
  const own = post(state, state.jobs[0]);
  assert.throws(() => apply(own, own.jobs[0].id));
});
test('five-post limit and input validation are enforced without mutating state', () => {
  const original = seed(); let current = original;
  assert.throws(() => post(current, { ...current.jobs[0], pay: NaN }));
  assert.throws(() => post(current, { ...current.jobs[0], title: '  ' }));
  for (let i = 0; i < 5; i++) current = post(current, original.jobs[0]);
  assert.equal(current.postsUsed, 5);
  assert.equal(original.postsUsed, 0);
  assert.throws(() => post(current, original.jobs[0]));
  assert.equal(new Set(current.jobs.map(j => j.id)).size, current.jobs.length);
});
