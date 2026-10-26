import { useState } from 'react';
import type { Source } from '@workspace/api-client-react';
import { Btn } from '@/components/ui-bits';
import type { PracticeQuestion, RevisionGroup } from '@/lib/testing';
import { PracticeSession } from './applied-practice';

const topicKey = (group: RevisionGroup) => JSON.stringify([group.sourceId, group.category]);

export function RevisionPractice({ groups, sources, onBack, onExit }: {
  groups: RevisionGroup[];
  sources: Source[];
  onBack: () => void;
  onExit: () => void;
}) {
  const [selected, setSelected] = useState(() => groups.filter(g => g.questions.length > 0).map(topicKey));
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const available = groups.filter(g => g.questions.length > 0);
  const picked = groups.filter(g => selected.includes(topicKey(g)) && g.questions.length > 0);
  const count = picked.reduce((total, g) => total + g.questions.length, 0);
  return (
    <section aria-label="Targeted revision" className="space-y-4">
      <h2 className="font-reading text-2xl">Revise missed topics</h2>
      <p className="text-sm text-muted-foreground">Choose which missed lecture and category topics to revise first. Choose an answer, then check it to see the solution and exact supporting citation.</p>
      {!questions && <div className="flex flex-wrap gap-2">
        <Btn disabled={!available.length} onClick={() => setSelected(available.map(topicKey))}>Select all topics</Btn>
        <Btn disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</Btn>
      </div>}
      <ul className="space-y-2 rounded-xl border bg-card p-4" aria-label="Revision topics">
        {(questions ? picked : groups).map(g => {
          const source = sources.find(s => s.id === g.sourceId);
          const key = topicKey(g);
          const title = `${source ? `${source.lecture}: ${source.title}` : `Lecture ${g.sourceId}`} · ${g.category}`;
          return (
            <li key={key} className="text-sm">
              <label className="flex items-start gap-2 font-medium">
                {!questions && <input type="checkbox" className="mt-1" checked={selected.includes(key)} disabled={!g.questions.length}
                  onChange={() => setSelected(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key])} />}
                <span>{title}</span>
              </label>
              <p className="text-xs text-muted-foreground">{g.incorrect} incorrect · {g.blank} blank · {g.questions.length} practice questions</p>
              {g.repeated > 0 && <p className="text-xs text-muted-foreground">No unused variations for this topic; retrying {g.repeated} missed question{g.repeated === 1 ? '' : 's'} with reshuffled choices.</p>}
              {!g.questions.length && <p className="text-xs text-muted-foreground">No source-supported practice available for this topic.</p>}
            </li>
          );
        })}
      </ul>
      {!questions && <>
        <p role="status" className="text-sm">{picked.length} of {available.length} available topics selected · {count} practice questions</p>
        {!count && <p className="text-sm text-muted-foreground">{available.length ? 'Select at least one topic to start revision.' : 'No source-supported practice available for these missed topics.'}</p>}
        <Btn tone="primary" disabled={!count} data-testid="button-start-revision" onClick={() => setQuestions(picked.flatMap(g => g.questions))}>Start targeted revision ({count} questions)</Btn>
      </>}
      <p className="text-xs text-muted-foreground">Temporary session, not saved on reload. No questions are added to Quick Recall. Permanent cards must go through Review Queue approval.</p>
      <div className="flex flex-wrap gap-2">
        {questions && <Btn onClick={() => setQuestions(null)}>Choose different topics (resets practice)</Btn>}
        <Btn onClick={onBack} data-testid="button-back-results">Back to exam results</Btn>
        <Btn onClick={onExit}>Exit targeted revision</Btn>
      </div>
      {questions && <PracticeSession questions={questions} finite />}
    </section>
  );
}
