import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPracticeQuestions, createExam, scoreExam } from '../artifacts/study-notebook/src/lib/testing';
import type { SourceDetail, StudyItem } from '@workspace/api-client-react';

const sources: SourceDetail[] = JSON.parse(readFileSync(new URL('../artifacts/api-server/src/data/lectures.json', import.meta.url), 'utf8'));
for (const source of sources) {
  const bank = buildPracticeQuestions(source);
  const applied = bank.filter(q => q.kind === 'applied');
  const terms = bank.filter(q => q.kind === 'terminology');
  assert.ok(applied.length >= 6, `Lecture ${source.id} needs applied exercises`);
  assert.ok(terms.length >= 2, `Lecture ${source.id} needs terminology`);
  assert.equal(new Set(bank.map(q => q.id)).size, bank.length);
  for (const q of bank) {
    assert.equal(q.sourceId, source.id);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.choices.length);
    assert.equal(new Set(q.choices).size, q.choices.length, 'No duplicated choices');
    for (const c of q.citations) {
      const page = source.pages.find(p => p.page === c.page);
      assert.ok(page?.text.replace(/\s+/g, ' ').includes(c.excerpt), `Exact evidence for ${q.id}`);
    }
  }
  console.log(`Lecture ${source.id}: ${terms.length} terms, ${applied.length} applied exercises`);
}
for (let iteration = 0; iteration < 100; iteration++) {
  const selected = iteration % 2 ? sources : sources.filter(s => [2, 9, 10].includes(s.id));
  const exam = createExam(selected, [], 10);
  assert.equal(exam.length, 10);
  assert.equal(new Set(exam.map(q => q.id)).size, exam.length);
  assert.ok(exam.some(q => q.kind === 'terminology'));
  assert.ok(exam.some(q => q.kind === 'applied'));
  for (const s of selected) assert.ok(exam.some(q => q.sourceId === s.id), 'Every selected lecture represented');
  const answers = Object.fromEntries(exam.map(q => [q.id, q.correctIndex]));
  assert.deepEqual(scoreExam(exam, answers), { correct: 10, total: 10, unanswered: 0, percent: 100 });
  assert.deepEqual(scoreExam(exam, {}), { correct: 0, total: 10, unanswered: 10, percent: 0 });
  delete answers[exam[0]!.id];
  assert.equal(scoreExam(exam, answers).percent, 90);
}
const example = sources[0]!;
const pending: StudyItem = {
  id: 999, kind: 'terminology', title: 'Do not include', question: 'Pending question',
  answer: 'Pending answer', status: 'pending',
  citations: [{ sourceId: example.id, sourceTitle: example.title, page: 1, excerpt: 'Test fixture' }],
  createdAt: new Date().toISOString(),
};
assert.ok(!createExam([example], [pending], 1000).some(q => q.id === 'approved:999'));
// Independent examples of the computed answer rules.
const find = (id: number, text: string) => {
  const q = buildPracticeQuestions(sources.find(s => s.id === id)!).find(q => q.prompt.includes(text));
  assert.ok(q, text);
  return q.choices[q.correctIndex];
};
assert.equal(find(2, 'A = 1, B = 0.'), '1');
assert.equal(find(2, 'truth table for A AND B.'), '0, 0, 0, 1');
assert.equal(find(5, '1101 as a 4-bit two’s complement'), '-3');
assert.equal(find(6, '1010 0101'), '0xA5');
assert.equal(find(8, '17 separately'), '5');
assert.equal(find(9, '1, 1, 0, 1 from'), 'S1');
assert.equal(find(10, 'Starting in state 5,'), 'State 2: N/S yellow, E/W red');
console.log('Randomization, lecture coverage, evidence, scoring, approval isolation, and computed answers passed.');
