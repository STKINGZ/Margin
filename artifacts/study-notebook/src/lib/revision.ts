import type { PracticeQuestion, RevisionGroup } from './testing';

/** Groups missed exam questions by source and category. Practice is generated later on request. */
export function groupMissed(exam: PracticeQuestion[], answers: Record<string, number>): RevisionGroup[] {
  const groups = new Map<string, RevisionGroup>();
  for (const q of exam) {
    if (answers[q.id] === q.correctIndex) continue;
    const key = JSON.stringify([q.sourceId, q.category]);
    const g = groups.get(key) ?? { sourceId: q.sourceId, category: q.category, incorrect: 0, blank: 0, repeated: 0, questions: [] };
    g.questions.push(q);
    if (answers[q.id] === undefined) g.blank++; else g.incorrect++;
    groups.set(key, g);
  }
  return [...groups.values()];
}
