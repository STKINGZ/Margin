import { useMemo, useState } from 'react';
import { ArrowRight, PenLine, Sparkles } from 'lucide-react';
import { useGeneratePractice, type Source } from '@workspace/api-client-react';
import { Btn, Empty, ErrorNote, SkeletonLines, fieldCls } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';
import { shuffle, type PracticeQuestion } from '@/lib/testing';
import { Explanation, QuestionCard } from './question-card';

export function PracticeSession({ questions, finite = false, doneTitle = 'Revision complete', doneNote = 'Your original exam result is unchanged.' }: {
  questions: PracticeQuestion[]; finite?: boolean; doneTitle?: string; doneNote?: string;
}) {
  // Freeze the session across background refetches.
  const [qs] = useState(questions);
  const [n, setN] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [pad, setPad] = useState('');
  const [score, setScore] = useState({ right: 0, done: 0 });
  const [round, setRound] = useState(0);
  const list = useMemo(() => finite ? qs : shuffle(qs), [qs, round, finite]);
  if (list.length === 0) return <Empty title="No problems generated" icon={<PenLine className="size-5" />}>The sources did not yield usable questions. Try different sources.</Empty>;
  if (finite && n >= list.length) return (
    <div role="status" className="rounded-xl border bg-card p-5" data-testid="revision-complete">
      <h3 className="font-reading text-xl">{doneTitle}</h3>
      <p className="mt-2 text-sm">You answered {score.right} of {score.done} correctly in this {doneTitle === 'Revision complete' ? 'revision ' : ''}session.</p>
      <p className="mt-1 text-xs text-muted-foreground">{doneNote}</p>
    </div>
  );
  const q = list[n % list.length];
  const next = () => { setN((v) => v + 1); setSel(null); setChecked(false); setPad(''); };
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground" data-testid="text-practice-score">Session: {score.right} of {score.done} correct · bank of {list.length}</p>
      {finite && <p className="text-sm font-medium">Question {n + 1} of {list.length} · {q.citations[0]?.sourceTitle} · {q.category}</p>}
      <div className="rounded-xl border bg-card p-4 shadow-sm" key={`${n}-${round}`}>
        <QuestionCard q={q} selected={sel} onSelect={checked ? undefined : setSel} reveal={checked} />
        {checked && <Explanation q={q} selected={sel} />}
        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          {!checked ? (
            <Btn tone="primary" disabled={sel === null} data-testid="button-check" onClick={() => { setChecked(true); setScore((s) => ({ right: s.right + (sel === q.correctIndex ? 1 : 0), done: s.done + 1 })); }}>Check answer</Btn>
          ) : (
            <Btn tone="primary" data-testid="button-next" onClick={next}>{finite && n === list.length - 1 ? (doneTitle === 'Revision complete' ? 'Finish revision' : 'Finish set') : 'Next problem'} <ArrowRight className="size-4" /></Btn>
          )}
          {!finite && n >= list.length - 1 && <Btn data-testid="button-restart-practice" onClick={() => { setRound((r) => r + 1); setN(0); setSel(null); setChecked(false); setPad(''); setScore({ right: 0, done: 0 }); }}>Restart</Btn>}
        </div>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        Scratchpad (cleared on the next question)
        <textarea value={pad} onChange={(e) => setPad(e.target.value)} placeholder="Working, outlines, rough calculations" className={`${fieldCls} mt-1 min-h-32 font-mono text-sm`} data-testid="input-scratchpad" />
      </label>
    </div>
  );
}

const counts = [4, 6, 8, 12] as const;

export function AppliedPractice({ sources }: { sources: Source[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [count, setCount] = useState<number>(6);
  const [set, setSet] = useState<{ run: number; questions: PracticeQuestion[] } | null>(null);
  const gen = useGeneratePractice();
  const generate = () => gen.mutate({ data: { sourceIds: picked.slice(0, 20), count } }, {
    onSuccess: (qs) => setSet((prev) => ({ run: (prev?.run ?? 0) + 1, questions: qs })),
  });
  if (!sources.length) return (
    <section aria-label="Applied Practice"><Empty title="No sources in this course" icon={<PenLine className="size-5" />}>Upload material on the Courses page, then come back to generate problems from it.</Empty></section>
  );
  return (
    <section aria-label="Applied Practice" className="space-y-4">
      <p className="text-sm text-muted-foreground">Pick sources, then generate a fresh set of problems from them. Work each one before choosing; the explanation and citation appear after you check.</p>
      <fieldset disabled={gen.isPending}>
        <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">Sources
          <span className="flex gap-1">
            <Btn onClick={() => setPicked(sources.slice(0, 20).map((s) => s.id))} data-testid="button-practice-select-all">Select all</Btn>
            <Btn onClick={() => setPicked([])}>Clear</Btn>
          </span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {sources.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${picked.includes(s.id) ? 'border-primary bg-secondary' : 'bg-card'}`}>
              <input type="checkbox" checked={picked.includes(s.id)} data-testid={`check-practice-source-${s.id}`} onChange={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))} />
              <span><span className="font-mono text-xs text-muted-foreground">{s.lecture}</span> {s.title}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground">Problems
          <select value={count} disabled={gen.isPending} onChange={(e) => setCount(Number(e.target.value))} className={`${fieldCls} mt-1 w-24`} data-testid="select-practice-count">
            {counts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Btn tone="primary" disabled={!picked.length || gen.isPending} onClick={generate} data-testid="button-generate-practice">
          <Sparkles className="size-4" aria-hidden /> {gen.isPending ? 'Generating…' : set ? 'Generate a new set' : picked.length ? 'Generate problems' : 'Select a source'}
        </Btn>
      </div>
      {gen.isPending && <div role="status" aria-label="Generating practice"><SkeletonLines n={2} /></div>}
      {gen.isError && <ErrorNote message={errorText(gen.error, 'Could not generate practice.')} onRetry={generate} />}
      {!set && !gen.isPending && !gen.isError && <Empty title="Nothing generated yet" icon={<PenLine className="size-5" />}>Problems are written from the pages of the sources you choose, each with a citation back to the page.</Empty>}
      {set && !gen.isPending && <PracticeSession key={set.run} questions={set.questions} finite doneTitle="Set complete" doneNote="Generate a new set for more practice. Nothing here is added to Quick Recall." />}
    </section>
  );
}
