import assert from 'node:assert/strict';

// Run against the managed development workflows through the shared proxy.
const base = 'http://localhost:80/api';
if ((await fetch(`${base}/notebook`)).status === 401) {
  await import('./private-access.test.mjs');
  console.log('Skipped legacy cookie-only exam fixtures: authenticated save/resume and owner isolation are verified with the Clerk browser test, not an authentication bypass.');
  process.exit(0);
}
async function notebook() {
  const initial = await fetch(`${base}/notebook`);
  assert.equal(initial.status, 200);
  const cookie = initial.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'Notebook establishes a browser identity');
  return async (path, method = 'GET', data) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { cookie, 'Content-Type': 'application/json' },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
}

const a = await notebook();
const b = await notebook();
assert.deepEqual((await a('/exams')).data, []);
const input = { sourceIds: [2, 5], requestedCount: 6 };
const created = await a('/exams', 'POST', input);
assert.equal(created.status, 201);
const first = created.data;
assert.equal(first.questions.length, 6);
assert.equal(first.status, 'in_progress');
assert.equal(first.score, null);
assert.ok(first.questions.every(q => !q.id.startsWith('approved:')), 'Pending examples never enter the exam');
const path = `/exams/${first.id}`;
assert.equal((await b(path)).status, 404);
assert.equal((await b(path, 'PATCH', { version: 0, answers: {}, currentIndex: 0, action: 'submit' })).status, 404);
assert.equal((await b('/exams', 'POST', { ...input, retryOf: first.id })).status, 404);
assert.equal((await a('/exams', 'POST', input)).status, 409);
const answers = { [first.questions[0].id]: first.questions[0].correctIndex };
const progress = { version: 0, answers, currentIndex: 2, action: 'save' };
const saved = await a(path, 'PATCH', progress);
assert.equal(saved.status, 200);
assert.equal(saved.data.version, 1);
const reloaded = (await a(path)).data;
assert.deepEqual(reloaded.questions, first.questions, 'Questions, answer order, evidence, and explanations remain frozen');
assert.deepEqual(reloaded.answers, answers);
assert.equal(reloaded.currentIndex, 2);
assert.equal((await a(path, 'PATCH', progress)).status, 409, 'A stale tab cannot overwrite progress');
for (const invalid of [
  { ...progress, version: 1, currentIndex: 99 },
  { ...progress, version: 1, answers: { unknown: 0 } },
  { ...progress, version: 1, answers: { [first.questions[0].id]: -1 } },
  { ...progress, version: 1, answers: { [first.questions[0].id]: 100 } },
]) assert.equal((await a(path, 'PATCH', invalid)).status, 400);
const submitted = await a(path, 'PATCH', { ...progress, version: 1, action: 'submit' });
assert.equal(submitted.status, 200);
assert.equal(submitted.data.status, 'completed');
assert.deepEqual(submitted.data.score, { correct: 1, total: 6, unanswered: 5, percent: 16.7 });
assert.ok(submitted.data.completedAt);
assert.deepEqual((await a(path)).data, submitted.data, 'Final results persist on reload');
assert.equal((await a(path, 'PATCH', { ...progress, version: 2 })).status, 409, 'Completed results cannot be overwritten');
const retry = await a('/exams', 'POST', { ...input, retryOf: first.id });
assert.equal(retry.status, 201);
assert.notEqual(retry.data.id, first.id);
assert.deepEqual(retry.data.questions, first.questions, 'Retry preserves exact question and choice ordering');
assert.deepEqual(retry.data.answers, {});
assert.equal(retry.data.score, null);
assert.deepEqual((await a(path)).data, submitted.data, 'Retry does not erase the previous score');
const end = await a(`/exams/${retry.data.id}`, 'PATCH', { version: 0, answers: {}, currentIndex: 0, action: 'abandon' });
assert.equal(end.status, 200);
assert.equal(end.data.status, 'abandoned');
assert.equal(end.data.score, null);
const racing = await Promise.all([a('/exams', 'POST', input), a('/exams', 'POST', input)]);
assert.deepEqual(racing.map(r => r.status).sort(), [201, 409], 'Concurrent tabs can create only one unfinished attempt');
const active = racing.find(r => r.status === 201).data;
const history = (await a('/exams')).data;
assert.equal(history.length, 3);
assert.equal(history.filter(e => e.status === 'in_progress').length, 1);
assert.deepEqual(history.find(e => e.id === first.id).score, submitted.data.score);
assert.deepEqual((await b('/exams')).data, [], 'History remains notebook-scoped');
await a(`/exams/${active.id}`, 'PATCH', { version: 0, answers: {}, currentIndex: 0, action: 'abandon' });
console.log('Exam persistence, frozen retries, scoring, validation, concurrency, and notebook isolation passed.');
