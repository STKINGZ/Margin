import { useMemo, useState } from 'react';
import { ArrowRight, PenLine } from 'lucide-react';
import { getGetSourceQueryKey, useGetSource, type Source, type SourceDetail } from '@workspace/api-client-react';
import { Btn, Empty, ErrorNote, SkeletonLines, fieldCls } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';
import { buildPracticeQuestions, shuffle } from '@/lib/testing';
import { Explanation, QuestionCard } from './question-card';

function Session({ source }: { source: SourceDetail }) {
  // Freeze the session across background source refetches.
  const [qs] = useState(() => buildPracticeQuestions(source).filter((q) => q.kind === 'applied'));
  const [n, setN] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [pad, setPad] = useState('');
  const [score, setScore] = useState({ right: 0, done: 0 });
  const [round, setRound] = useState(0);
  const list = useMemo(() => shuffle(qs), [qs, round]);
  if (list.length === 0) return <Empty title="No applied problems here" icon={<PenLine className="size-5" />}>This lecture has no computable circuit problems. Try another.</Empty>;
  const q = list[n % list.length];
  const next = () => { setN((v) => v + 1); setSel(null); setChecked(false); setPad(''); };
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground" data-testid="text-practice-score">Session: {score.right} of {score.done} correct · bank of {list.length}</p>
      <div className="rounded-xl border bg-card p-4 shadow-sm" key={`${n}-${round}`}>
        <QuestionCard q={q} selected={sel} onSelect={checked ? undefined : setSel} reveal={checked} />
        {checked && <Explanation q={q} selected={sel} />}
        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          {!checked ? (
            <Btn tone="primary" disabled={sel === null} data-testid="button-check" onClick={() => { setChecked(true); setScore((s) => ({ right: s.right + (sel === q.correctIndex ? 1 : 0), done: s.done + 1 })); }}>Check answer</Btn>
          ) : (
            <Btn tone="primary" data-testid="button-next" onClick={next}>Next problem <ArrowRight className="size-4" /></Btn>
          )}
          {n >= list.length - 1 && <Btn data-testid="button-restart-practice" onClick={() => { setRound((r) => r + 1); setN(0); setSel(null); setChecked(false); setPad(''); setScore({ right: 0, done: 0 }); }}>Restart</Btn>}
        </div>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        Scratchpad (cleared on the next question)
        <textarea value={pad} onChange={(e) => setPad(e.target.value)} placeholder="Boolean working, truth rows, FSM traces" className={`${fieldCls} mt-1 min-h-32 font-mono text-sm`} data-testid="input-scratchpad" />
      </label>
    </div>
  );
}

export function AppliedPractice({ sources }: { sources: Source[] }) {
  const [id, setId] = useState(0);
  const q = useGetSource(id, { query: { queryKey: getGetSourceQueryKey(id), enabled: !!id } });
  return (
    <section aria-label="Applied Practice" className="space-y-4">
      <p className="text-sm text-muted-foreground">Work a problem on paper first, then choose. Answers are computed, not looked up.</p>
      <select value={id} onChange={(e) => setId(Number(e.target.value))} className={fieldCls} data-testid="select-applied-lecture" aria-label="Lecture">
        <option value={0}>Choose a lecture</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.lecture}: {s.title}</option>)}
      </select>
      {!id && <Empty title="Pick a lecture" icon={<PenLine className="size-5" />}>Problems are built from the pages of the lecture you choose.</Empty>}
      {!!id && q.isLoading && <SkeletonLines n={2} />}
      {!!id && q.isError && <ErrorNote message={errorText(q.error, 'Could not load this lecture.')} onRetry={() => q.refetch()} />}
      {q.data && !!id && <Session key={id} source={q.data} />}
    </section>
  );
}
