import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGeneratePractice, type Source } from '@workspace/api-client-react';
import { Btn, ErrorNote, SkeletonLines } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';
import type { PracticeQuestion, RevisionGroup } from '@/lib/testing';
import { PracticeSession } from './applied-practice';

const topicKey = (group: RevisionGroup) => JSON.stringify([group.sourceId, group.category]);

export function RevisionPractice({ groups, sources, onBack, onExit }: {
  groups: RevisionGroup[];
  sources: Source[];
  onBack: () => void;
  onExit: () => void;
}) {
  const available = groups.filter(g => g.questions.length > 0);
  const [selected, setSelected] = useState(() => available.map(topicKey));
  const [session, setSession] = useState<{ run: number; questions: PracticeQuestion[]; matched: boolean } | null>(null);
  const gen = useGeneratePractice();
  const picked = groups.filter(g => selected.includes(topicKey(g)) && g.questions.length > 0);
  const missed = picked.reduce((total, g) => total + g.questions.length, 0);
  const count = Math.min(12, Math.max(3, missed * 2));
  const sourceIds = [...new Set(picked.map(g => g.sourceId))].slice(0, 20);
  const start = () => {
    const wanted = new Set(picked.map(topicKey));
    gen.mutate({ data: { sourceIds, count } }, {
      onSuccess: (qs) => {
        const match = qs.filter(q => wanted.has(JSON.stringify([q.sourceId, q.category])));
        setSession(prev => ({ run: (prev?.run ?? 0) + 1, questions: match.length ? match : qs, matched: match.length > 0 }));
      },
    });
  };
  const label = (g: RevisionGroup) => {
    const source = sources.find(s => s.id === g.sourceId);
    return `${source ? `${source.lecture}: ${source.title}` : `Source ${g.sourceId}`} · ${g.category}`;
  };
  return (
    <section aria-label="Targeted revision" className="space-y-4">
      <h2 className="font-reading text-2xl">Revise missed topics</h2>
      <p className="text-sm text-muted-foreground">Choose which missed topics to revise. A fresh set of problems is generated from the sources behind them. Check each answer to see the solution and its supporting citation.</p>
      {!session && <div className="flex flex-wrap gap-2">
        <Btn disabled={!available.length || gen.isPending} onClick={() => setSelected(available.map(topicKey))}>Select all topics</Btn>
        <Btn disabled={!selected.length || gen.isPending} onClick={() => setSelected([])}>Clear selection</Btn>
      </div>}
      <ul className="space-y-2 rounded-xl border bg-card p-4" aria-label="Revision topics">
        {(session ? picked : groups).map(g => {
          const key = topicKey(g);
          return (
            <li key={key} className="text-sm">
              <label className="flex items-start gap-2 font-medium">
                {!session && <input type="checkbox" className="mt-1" checked={selected.includes(key)} disabled={!g.questions.length || gen.isPending}
                  onChange={() => setSelected(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key])} />}
                <span>{label(g)}</span>
              </label>
              <p className="text-xs text-muted-foreground">{g.incorrect} incorrect · {g.blank} blank</p>
            </li>
          );
        })}
      </ul>
      {!session && <>
        <p role="status" className="text-sm">{picked.length} of {available.length} available topics selected · {count && picked.length ? `about ${count} new problems from ${sourceIds.length} source${sourceIds.length === 1 ? '' : 's'}` : 'nothing to generate'}</p>
        {!picked.length && <p className="text-sm text-muted-foreground">{available.length ? 'Select at least one topic to start revision.' : 'No missed topics to revise.'}</p>}
        <Btn tone="primary" disabled={!picked.length || gen.isPending} data-testid="button-start-revision" onClick={start}>
          <Sparkles className="size-4" aria-hidden /> {gen.isPending ? 'Generating revision…' : 'Generate targeted revision'}
        </Btn>
      </>}
      {gen.isPending && <div role="status" aria-label="Generating revision"><SkeletonLines n={2} /></div>}
      {gen.isError && <ErrorNote message={errorText(gen.error, 'Could not generate revision practice.')} onRetry={start} />}
      {session && !session.matched && <p className="text-xs text-muted-foreground" data-testid="text-revision-unmatched">No generated problem matched the exact missed categories, so every problem generated from those sources is shown.</p>}
      <p className="text-xs text-muted-foreground">Temporary session, not saved on reload. No questions are added to Quick Recall. Permanent cards must go through Review Queue approval.</p>
      <div className="flex flex-wrap gap-2">
        {session && <Btn disabled={gen.isPending} onClick={start} data-testid="button-regenerate-revision">Regenerate problems</Btn>}
        {session && <Btn disabled={gen.isPending} onClick={() => { setSession(null); gen.reset(); }}>Choose different topics (resets practice)</Btn>}
        <Btn onClick={onBack} data-testid="button-back-results">Back to exam results</Btn>
        <Btn onClick={onExit}>Exit targeted revision</Btn>
      </div>
      {session && !gen.isPending && <PracticeSession key={session.run} questions={session.questions} finite />}
    </section>
  );
}
