import type { Citation, SourceDetail, StudyItem } from '@workspace/api-client-react';
import { buildApplied } from './testing-applied';
import { buildTerminology } from './testing-terms';

export type PracticeQuestion = {
  id: string;
  kind: 'terminology' | 'applied';
  category: string;
  sourceId: number;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  citations: Citation[];
};

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Keep source excerpts exact; exercises are labelled variations, not PDF quotations. */
export function evidence(source: SourceDetail, pattern: RegExp): Citation[] {
  for (const page of source.pages) {
    const text = page.text.replace(/\s+/g, ' ').trim();
    const found = text.match(pattern);
    if (found?.index !== undefined) {
      const start = Math.max(0, found.index - 100);
      return [{ sourceId: source.id, sourceTitle: source.title, page: page.page, excerpt: text.slice(start, found.index + 1100) }];
    }
  }
  // No matching evidence means no exercise, not an unrelated fallback citation.
  return [];
}

export function question(
  source: SourceDetail, category: string, prompt: string, correct: string,
  distractors: string[], explanation: string, pattern: RegExp,
  kind: PracticeQuestion['kind'] = 'applied',
): PracticeQuestion | null {
  const citations = evidence(source, pattern);
  if (!citations.length) return null;
  const choices = shuffle([...new Set([correct, ...distractors])]);
  if (choices.length < 2) return null;
  return {
    id: `${source.id}:${kind}:${prompt}`, kind, category, sourceId: source.id, prompt,
    choices, correctIndex: choices.indexOf(correct), explanation, citations,
  };
}

export function buildPracticeQuestions(source: SourceDetail): PracticeQuestion[] {
  return [...buildTerminology(source), ...buildApplied(source)];
}

export function createExam(sources: SourceDetail[], approved: StudyItem[], count: number): PracticeQuestion[] {
  const sourceIds = new Set(sources.map(s => s.id));
  const bank = sources.flatMap(buildPracticeQuestions);
  // Only approved terms join the exam. Pending / discarded cards never enter it.
  const terms = approved.filter(item => item.status === 'approved' && item.kind === 'terminology'
    && item.citations.some(c => sourceIds.has(c.sourceId)));
  for (const item of terms) {
    const distractors = shuffle(terms.filter(other => other.answer !== item.answer).map(other => other.answer)).slice(0, 3);
    if (!distractors.length) continue;
    const choices = shuffle([item.answer, ...new Set(distractors)]);
    const citations = item.citations.filter(c => sourceIds.has(c.sourceId));
    bank.push({
      id: `approved:${item.id}`, kind: 'terminology', category: 'Approved terminology',
      sourceId: citations[0]!.sourceId, prompt: item.question,
      choices, correctIndex: choices.indexOf(item.answer), explanation: item.answer, citations,
    });
  }
  const target = Math.min(Math.max(Math.floor(count), sources.length), bank.length);
  const selected: PracticeQuestion[] = [];
  const take = (candidates: PracticeQuestion[]) => {
    const next = shuffle(candidates.filter(q => !selected.some(s => s.id === q.id)))[0];
    if (next && selected.length < target) selected.push(next);
  };
  // Cover every selected lecture, then guarantee a mixture of terminology and applied logic.
  for (const source of shuffle(sources)) take(bank.filter(q => q.sourceId === source.id));
  for (const kind of ['terminology', 'applied'] as const) {
    if (!selected.some(q => q.kind === kind)) {
      if (selected.length === target && selected.length > 1) {
        const replacement = shuffle(bank.filter(q => q.kind === kind && q.sourceId === selected[0]!.sourceId))[0];
        if (replacement) selected[0] = replacement;
      } else take(bank.filter(q => q.kind === kind));
    }
  }
  for (const q of shuffle(bank)) {
    if (selected.length >= target) break;
    if (!selected.some(s => s.id === q.id)) selected.push(q);
  }
  return shuffle(selected);
}

export function scoreExam(questions: PracticeQuestion[], answers: Record<string, number>) {
  const correct = questions.filter(q => answers[q.id] === q.correctIndex).length;
  const answered = questions.filter(q => answers[q.id] !== undefined).length;
  return { correct, total: questions.length, unanswered: questions.length - answered,
    percent: questions.length ? Math.round(correct / questions.length * 100) : 0 };
}
