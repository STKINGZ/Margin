import assert from 'node:assert/strict';
import { sources, verifiedCitation } from '../artifacts/api-server/src/lib/course';
import { buildTutorEvidence, resolveTutorEvidence, isConfused, socraticViolation } from '../artifacts/api-server/src/lib/tutor-evidence';

const all = buildTutorEvidence('Boolean traffic light memory XOR state');
assert.ok(all.length > 10);
assert.equal(new Set(all.map(e => e.id)).size, all.length);
for (const source of sources) {
  const evidence = buildTutorEvidence('Teach me', source.id);
  assert.ok(evidence.length);
  for (const chunk of evidence) {
    assert.ok(chunk.id.startsWith(`L${source.id}-P${chunk.citation.page}-C`));
    assert.equal(chunk.citation.sourceId, source.id);
    assert.equal(chunk.citation.sourceTitle, `${source.lecture}: ${source.title}`);
    assert.deepEqual(resolveTutorEvidence([chunk.id], evidence, source.id), [chunk.citation]);
    // A wrong source or page may not borrow another lecture's excerpt.
    for (const other of sources.filter(s => s.id !== source.id)) {
      const wrong = {...chunk.citation, sourceId: other.id};
      const result = verifiedCitation(wrong);
      if (result) assert.ok(other.pages.find(p => p.page === wrong.page)?.text.replace(/\s+/g, ' ').includes(wrong.excerpt));
    }
  }
}
const lecture2 = buildTutorEvidence('Boolean', 2);
const lecture10 = buildTutorEvidence('traffic', 10);
assert.throws(() => resolveTutorEvidence([lecture2[0]!.id], lecture10, 10));
assert.throws(() => resolveTutorEvidence([lecture2[0]!.id], lecture2, 10));
assert.throws(() => resolveTutorEvidence(['E1'], lecture10, 10));
const corrupted = [{...lecture2[0]!, citation: {...lecture2[0]!.citation, sourceTitle: 'Lecture 10: Wrong'}}];
assert.equal(resolveTutorEvidence([corrupted[0]!.id], corrupted, 2)[0]!.sourceTitle, 'Lecture 02: Boolean logic and transistors');
assert.deepEqual(resolveTutorEvidence([lecture2[0]!.id], lecture2, 2),
  resolveTutorEvidence([lecture2[0]!.id], lecture2, 2), 'Cards and replies share exactly the same metadata resolver');
for (const text of ["I'm confused", "I don't understand", "I don’t understand", 'I do not understand', "I'm lost", 'I am not following', 'This makes no sense']) assert.ok(isConfused(text), text);
assert.equal(isConfused('Evaluate my reasoning: AND needs both inputs.'), false);
assert.equal(socraticViolation('Start with one input: NOT flips its value. If the input is 0, what is the output?', true), null);
assert.ok(socraticViolation(`${'word '.repeat(61)}Ready?`, true));
assert.ok(socraticViolation('What is 0? What is 1?', true));
assert.ok(socraticViolation('Here is a full explanation with no check.', true));
assert.ok(socraticViolation('1. First do this.\n2. Then do that.\nWhat happens?', true));
console.log('Tutor evidence identity, exact metadata, foreign-source rejection, and strict Socratic guards passed.');
