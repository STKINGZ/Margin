import type { ExamAttempt, SourceDetail } from '@workspace/api-client-react';
import { buildPracticeQuestions } from '@/lib/testing';
import lectures from '../../api-server/src/data/lectures.json';

// Real lecture evidence and question rules; no mock of createRevision or UI hooks.
export const source: SourceDetail = lectures.find(s => s.id === 2)!;
export const bank = buildPracticeQuestions(source);
export const incorrect = bank.find(q => q.category === 'Boolean expressions')!;
export const blank = bank.find(q => q.category === 'Truth tables')!;
export const correct = bank.find(q => ![incorrect.category, blank.category].includes(q.category))!;

export function completedExam(perfect = false): ExamAttempt {
  const questions = [incorrect, blank, correct];
  const answers = perfect
    ? Object.fromEntries(questions.map(q => [q.id, q.correctIndex]))
    : { [incorrect.id]: (incorrect.correctIndex + 1) % incorrect.choices.length, [correct.id]: correct.correctIndex };
  return {
    id: 41, status: 'completed', sourceIds: [source.id], requestedCount: 6,
    total: 3, answered: Object.keys(answers).length, currentIndex: 2, version: 4,
    createdAt: '2026-10-26T10:00:00Z', updatedAt: '2026-10-26T10:03:00Z',
    completedAt: '2026-10-26T10:03:00Z',
    score: { correct: perfect ? 3 : 1, total: 3, unanswered: perfect ? 0 : 1, percent: perfect ? 100 : 33.3 },
    questions, answers,
  };
}
