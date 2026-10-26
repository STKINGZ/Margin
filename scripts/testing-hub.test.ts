import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPracticeQuestions, createExam, createRevision, scoreExam } from '../artifacts/study-notebook/src/lib/testing';
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

// Revision focuses on misses (including blanks), not all selected lecture topics.
const lecture2 = sources.find(s => s.id === 2)!;
const lecture5 = sources.find(s => s.id === 5)!;
const boolean = buildPracticeQuestions(lecture2).find(q => q.category === 'Boolean expressions')!;
const truth = buildPracticeQuestions(lecture2).find(q => q.category === 'Truth tables')!;
const binary = buildPracticeQuestions(lecture5).find(q => q.category === 'Binary integers')!;
const correct = buildPracticeQuestions(lecture5).find(q => q.category === 'Two’s complement')!;
const revisionExam = [boolean, truth, binary, correct];
const revisionAnswers = {
  [boolean.id]: (boolean.correctIndex + 1) % boolean.choices.length,
  [binary.id]: (binary.correctIndex + 1) % binary.choices.length,
  [correct.id]: correct.correctIndex,
};
const before = JSON.stringify({ revisionExam, revisionAnswers, sources });
for (let iteration = 0; iteration < 30; iteration++) {
  const groups = createRevision(revisionExam, revisionAnswers, sources);
  assert.deepEqual(groups.map(g => [g.sourceId, g.category, g.incorrect, g.blank]), [
    [2, 'Boolean expressions', 1, 0], [2, 'Truth tables', 0, 1], [5, 'Binary integers', 1, 0],
  ]);
  for (const group of groups) {
    assert.ok(group.questions.length > 0);
    assert.equal(group.repeated, 0);
    assert.equal(new Set(group.questions.map(q => q.id)).size, group.questions.length);
    for (const q of group.questions) {
      assert.equal(q.sourceId, group.sourceId);
      assert.equal(q.category, group.category);
      assert.ok(!revisionExam.some(original => original.id === q.id), 'Prefer unused questions');
      const original = buildPracticeQuestions(sources.find(s => s.id === q.sourceId)!).find(item => item.id === q.id)!;
      assert.equal(q.choices[q.correctIndex], original.choices[original.correctIndex], 'Reshuffling preserves the computed answer');
      assert.deepEqual(q.citations, original.citations);
    }
  }
}
assert.equal(JSON.stringify({ revisionExam, revisionAnswers, sources }), before, 'Revision does not mutate exam or sources');
assert.deepEqual(createRevision(revisionExam, Object.fromEntries(revisionExam.map(q => [q.id, q.correctIndex])), sources), []);
assert.deepEqual(createRevision([], {}, sources), []);

// An exhausted category repeats only missed questions, never previously correct ones.
const exhausted = buildPracticeQuestions(lecture2).filter(q => q.category === 'Boolean expressions');
const exhaustedAnswers = Object.fromEntries(exhausted.slice(1).map(q => [q.id, q.correctIndex]));
const repeated = createRevision(exhausted, exhaustedAnswers, sources);
assert.equal(repeated.length, 1);
assert.equal(repeated[0]!.blank, 1);
assert.equal(repeated[0]!.repeated, 1);
assert.equal(repeated[0]!.questions[0]!.id, exhausted[0]!.id);

// Approved terminology has no generated category equivalent: retry its exact grounded topic.
const approvedQuestion = { ...truth, id: 'approved:123', category: 'Approved terminology' };
const approvedBefore = JSON.stringify(approvedQuestion);
const approvedRevision = createRevision([approvedQuestion], {}, sources);
assert.equal(approvedRevision[0]!.questions[0]!.id, approvedQuestion.id);
assert.deepEqual(approvedRevision[0]!.questions[0]!.citations, approvedQuestion.citations);
assert.equal(JSON.stringify(approvedQuestion), approvedBefore);
assert.equal(createRevision([{ ...approvedQuestion, citations: [] }], {}, [])[0]!.questions.length, 0, 'No unsupported fallback question');
console.log('Targeted revision grouping, fresh selection, blanks, perfect score, repetition, citations, and isolation passed.');
