import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Live managed-AI regression: creates an isolated notebook and makes three model calls.
const sources = JSON.parse(readFileSync(new URL('../artifacts/api-server/src/data/lectures.json', import.meta.url), 'utf8'));
const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/api` : 'http://localhost:80/api';
const initial = await fetch(`${base}/notebook`);
assert.equal(initial.status, 200);
const cookie = initial.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
assert.ok(cookie);
let lastPost = 0;
const request = async (path, body) => {
  if (body) {
    // Respect the real tutor endpoint's three-second per-notebook cooldown.
    const delay = Math.max(0, lastPost + 3100 - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastPost = Date.now();
  }
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET', headers: {cookie, 'Content-Type': 'application/json'},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(190000),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
};
function verify(citations, sourceId) {
  assert.ok(citations.length);
  for (const citation of citations) {
    if (sourceId != null) assert.equal(citation.sourceId, sourceId);
    const source = sources.find(s => s.id === citation.sourceId);
    const page = source?.pages.find(p => p.page === citation.page);
    assert.equal(citation.sourceTitle, `${source.lecture}: ${source.title}`);
    assert.ok(page?.text.replace(/\s+/g, ' ').includes(citation.excerpt.replace(/\s+/g, ' ').trim()));
  }
}
const contextId = randomUUID();
const before = await request('/items?status=pending');
const first = await request('/messages', {
  contextId, sourceId: 2, level: 'beginner',
  content: 'Teach me the very first idea about Boolean conjunction and give me a checking question.',
});
verify(first.message.citations, 2);
const afterFirst = await request('/items?status=pending');
const firstItems = afterFirst.filter(i => !before.some(b => b.id === i.id));
assert.ok(firstItems.length, 'The live tutor generated source-grounded review cards');
firstItems.forEach(item => verify(item.citations, 2));
// Deliberately reuse a context ID with a different source. The server must still
// exclude the other source's history, not just trust the normal UI reset.
const second = await request('/messages', {
  contextId, sourceId: 10, level: 'beginner',
  content: "I'm confused. I don't understand this lecture. Start with only the very first step.",
});
verify(second.message.citations, 10);
assert.ok(second.message.content.trim().split(/\s+/).length <= 60);
assert.equal((second.message.content.match(/\?/g) ?? []).length, 1);
assert.ok(second.message.content.trim().endsWith('?'));
assert.ok(!/\b(Boolean|conjunction|XOR)\b/i.test(second.message.content), 'Previous Boolean context must not bleed into traffic lights');
const freshContext = randomUUID();
const third = await request('/messages', {
  contextId: freshContext, sourceId: 10, level: 'beginner',
  content: "What was my previous question? I don't understand what we were doing.",
});
verify(third.message.citations, 10);
assert.ok(third.message.content.trim().split(/\s+/).length <= 60);
assert.ok(!/\b(Boolean|conjunction|XOR)\b/i.test(third.message.content));
const finalItems = await request('/items?status=pending');
for (const item of finalItems) {
  verify(item.citations);
  const original = firstItems.find(i => i.id === item.id);
  if (original) assert.deepEqual(item.citations, original.citations, 'Source switch must not relabel earlier cards');
  if (!afterFirst.some(i => i.id === item.id)) verify(item.citations, 10);
}
const messages = await request('/messages');
assert.ok(messages.some(m => m.sourceId === 2 && m.contextId === contextId));
assert.ok(messages.some(m => m.sourceId === 10 && m.contextId === contextId));
assert.ok(messages.some(m => m.sourceId === 10 && m.contextId === freshContext));
console.log(JSON.stringify({
  passed: true, source2NewCards: firstItems.length,
  confusionWordCounts: [second, third].map(r => r.message.content.trim().split(/\s+/).length),
  sourceSwitchReply: second.message.content,
  freshContextReply: third.message.content,
  citations: 'All reply and review-card excerpts matched their original lecture/title/page',
}, null, 2));
