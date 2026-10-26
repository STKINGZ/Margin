import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react';
import { getGetSourceQueryOptions, type Source, type SourceDetail, type StudyItem } from '@workspace/api-client-react';
import { Btn, ErrorNote } from '@/components/ui-bits';
import { createExam, type PracticeQuestion } from '@/lib/testing';
import { Explanation, QuestionCard } from './question-card';

const counts = [6, 10, 15, 20];
type Phase = 'setup' | 'taking' | 'done';

export function ExamSimulator({ sources, approved, onActive }: { sources: Source[]; approved: StudyItem[]; onActive: (a: boolean) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState<Phase>('setup');
  const [exam, setExam] = useState<PracticeQuestion[]>([]);
  const [frozen, setFrozen] = useState<{ ids: number[]; count: number }>({ ids: [], count: 0 });
  const [ans, setAns] = useState<Record<string, number>>({});
  const [i, setI] = useState(0);
  const [confirm, setConfirm] = useState<null | 'submit' | 'end'>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (phase !== 'taking') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const qs = useQueries({ queries: picked.map((id) => getGetSourceQueryOptions(id)) });
  const loading = qs.some((q) => q.isLoading);
  const failed = qs.find((q) => q.isError);
  const ready = picked.length > 0 && qs.every((q) => q.data);

  const setPh = (p: Phase) => { setPhase(p); onActive(p === 'taking'); };
  const generate = () => {
    try {
      const data = qs.map((q) => q.data as SourceDetail);
      const e = createExam(data, approved, count);
      if (e.length === 0) { setErr('These lectures have no questions to draw from.'); return; }
      setErr(''); setFrozen({ ids: [...picked], count }); setExam(e); setAns({}); setI(0); setConfirm(null); setPh('taking');
    } catch { setErr('Could not build the exam.'); }
  };
  const reset = () => { setConfirm(null); setPh('setup'); };

  if (phase === 'setup') {
    return (
      <section aria-label="Exam Simulator" className="space-y-5">
        <p className="text-sm text-muted-foreground">A closed-book run with no solutions until you submit. Exams live in this tab only and are not saved if you reload.</p>
        <fieldset>
          <legend className="mb-2 flex items-center justify-between text-sm font-medium">Lectures
            <span className="flex gap-1">
              <Btn onClick={() => setPicked(sources.map((s) => s.id))} data-testid="button-select-all">Select all</Btn>
              <Btn onClick={() => setPicked([])}>Clear</Btn>
            </span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((s) => (
              <label key={s.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${picked.includes(s.id) ? 'border-primary bg-secondary' : 'bg-card'}`}>
                <input type="checkbox" checked={picked.includes(s.id)} data-testid={`check-lecture-${s.id}`} onChange={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))} />
                <span><span className="font-mono text-xs text-muted-foreground">{s.lecture}</span> {s.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="mb-2 text-sm font-medium">Questions</p>
          <div className="flex gap-2">
            {counts.map((c) => (
              <button key={c} type="button" aria-pressed={count === c} onClick={() => setCount(c)} data-testid={`button-count-${c}`} className={`rounded-md border px-4 py-1.5 text-sm tabular-nums ${count === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>{c}</button>
            ))}
          </div>
          {picked.length > count && <p className="mt-2 text-xs text-muted-foreground">The exam will include {picked.length} questions so every selected lecture is represented.</p>}
        </div>
        {failed && <ErrorNote message="Could not load a selected lecture." onRetry={() => qs.forEach((q) => q.isError && q.refetch())} />}
        {err && <ErrorNote message={err} />}
        <Btn tone="primary" disabled={!ready} onClick={generate} data-testid="button-generate">
          <ClipboardCheck className="size-4" /> {loading ? 'Loading lectures' : picked.length ? 'Generate exam' : 'Select a lecture'}
        </Btn>
      </section>
    );
  }

  const answered = Object.keys(ans).length;

  if (phase === 'done') {
    const right = exam.filter((q) => ans[q.id] === q.correctIndex).length;
    const pct = (right / exam.length) * 100;
    return (
      <section aria-label="Exam results" className="space-y-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Result · not saved</p>
          <p className="font-reading text-4xl font-semibold" data-testid="text-score">{right} / {exam.length} <span className="text-xl text-muted-foreground">{pct.toFixed(1)}%</span></p>
          <p className="text-sm text-muted-foreground">{exam.length - answered} left blank, counted wrong. {frozen.count > exam.length && `Requested ${frozen.count}; the question bank only had ${exam.length}.`}</p>
          <div className="mt-3 flex gap-2">
            <Btn tone="primary" data-testid="button-retry-exam" onClick={() => { setAns({}); setI(0); setPh('taking'); }}>Retry same exam</Btn>
            <Btn onClick={reset} data-testid="button-new-exam">New exam</Btn>
          </div>
        </div>
        {exam.map((q, n) => (
          <div key={q.id} className="rounded-xl border bg-card p-4" data-testid={`result-${n}`}>
            <QuestionCard q={q} selected={ans[q.id] ?? null} reveal />
            <Explanation q={q} selected={ans[q.id] ?? null} />
          </div>
        ))}
      </section>
    );
  }

  const q = exam[i];
  return (
    <section aria-label="Exam in progress" className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <p className="tabular-nums" data-testid="text-progress">Question {i + 1} of {exam.length} · {answered} answered</p>
        <span className="text-xs text-muted-foreground">Session only</span>
      </div>
      <p className="text-xs text-muted-foreground">Covering {frozen.ids.length} lecture{frozen.ids.length === 1 ? '' : 's'} · terminology and applied practice · solutions appear after submission.</p>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <QuestionCard q={q} selected={ans[q.id] ?? null} onSelect={(c) => setAns((a) => ({ ...a, [q.id]: c }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn disabled={i === 0} onClick={() => setI(i - 1)} data-testid="button-prev"><ArrowLeft className="size-4" /> Back</Btn>
        <Btn disabled={i >= exam.length - 1} onClick={() => setI(i + 1)} data-testid="button-next-q">Next <ArrowRight className="size-4" /></Btn>
        <span className="ml-auto flex gap-2">
          <Btn tone="danger" onClick={() => setConfirm('end')} data-testid="button-end-exam">End exam</Btn>
          <Btn tone="primary" onClick={() => (answered < exam.length ? setConfirm('submit') : setPh('done'))} data-testid="button-submit-exam">Submit</Btn>
        </span>
      </div>
      {confirm && (
        <div role="alertdialog" className="rise flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
          <p className="flex-1">{confirm === 'submit' ? `${exam.length - answered} unanswered will count as wrong. Submit anyway?` : 'End this exam and discard your answers?'}</p>
          <Btn onClick={() => setConfirm(null)}>Keep going</Btn>
          <Btn tone="primary" data-testid="button-confirm" onClick={() => (confirm === 'submit' ? (setConfirm(null), setPh('done')) : reset())}>{confirm === 'submit' ? 'Submit' : 'End exam'}</Btn>
        </div>
      )}
    </section>
  );
}
