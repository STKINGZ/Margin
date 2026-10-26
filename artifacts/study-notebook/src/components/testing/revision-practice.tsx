import { useState } from 'react';
import type { Source } from '@workspace/api-client-react';
import { Btn } from '@/components/ui-bits';
import type { RevisionGroup } from '@/lib/testing';
import { PracticeSession } from './applied-practice';

export function RevisionPractice({ groups, sources, onBack, onExit }: {
  groups: RevisionGroup[];
  sources: Source[];
  onBack: () => void;
  onExit: () => void;
}) {
  const [questions] = useState(() => groups.flatMap(g => g.questions));
  return (
    <section aria-label="Targeted revision" className="space-y-4">
      <h2 className="font-reading text-2xl">Revise missed topics</h2>
      <p className="text-sm text-muted-foreground">Focused on incorrect and blank exam answers, grouped by lecture and category. Choose an answer, then check it to see the solution and exact supporting citation.</p>
      <ul className="space-y-2 rounded-xl border bg-card p-4" aria-label="Revision topics">
        {groups.map(g => {
          const source = sources.find(s => s.id === g.sourceId);
          return (
            <li key={`${g.sourceId}:${g.category}`} className="text-sm">
              <p className="font-medium">{source ? `${source.lecture}: ${source.title}` : `Lecture ${g.sourceId}`} · {g.category}</p>
              <p className="text-xs text-muted-foreground">{g.incorrect} incorrect · {g.blank} blank · {g.questions.length} practice questions</p>
              {g.repeated > 0 && <p className="text-xs text-muted-foreground">No unused variations for this topic; retrying {g.repeated} missed question{g.repeated === 1 ? '' : 's'} with reshuffled choices.</p>}
              {!g.questions.length && <p className="text-xs text-muted-foreground">No source-supported practice available for this topic.</p>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Temporary session, not saved on reload. No questions are added to Quick Recall. Permanent cards must go through Review Queue approval.</p>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={onBack} data-testid="button-back-results">Back to exam results</Btn>
        <Btn onClick={onExit}>Exit targeted revision</Btn>
      </div>
      {!!questions.length && <PracticeSession questions={questions} finite />}
    </section>
  );
}
