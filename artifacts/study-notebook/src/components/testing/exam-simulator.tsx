import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react';
import { getGetSourceQueryOptions, type Source, type SourceDetail } from '@workspace/api-client-react';
import { Btn, ErrorNote } from '@/components/ui-bits';
import { createRevision, type RevisionGroup } from '@/lib/testing';
import { Explanation, QuestionCard } from './question-card';
import { useSavedExam } from './use-saved-exam';

const counts = [6, 10, 15, 20] as const;

export function ExamSimulator({ sources, onActive, onRevise }: { sources: Source[]; onActive: (a: boolean) => void; onRevise: (groups: RevisionGroup[]) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [count, setCount] = useState<(typeof counts)[number]>(10);
  const saved = useSavedExam(sources.length > 0);
  const { attempt, busy } = saved;
  const phase = !attempt ? 'setup' : attempt.status === 'in_progress' ? 'taking' : 'done';
  const exam = attempt?.questions ?? [];
  const ans = attempt?.answers ?? {};
  const i = attempt?.currentIndex ?? 0;
  const frozen = { ids: attempt?.sourceIds ?? [], count: attempt?.requestedCount ?? 0 };
  const [confirm, setConfirm] = useState<null | 'submit' | 'end'>(null);
  useEffect(() => { onActive(phase === 'taking'); }, [phase, onActive]);
  useEffect(() => { setConfirm(null); }, [attempt?.id]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const qs = useQueries({ queries: (attempt?.sourceIds ?? picked).map((id) => getGetSourceQueryOptions(id)) });
  const loading = qs.some((q) => q.isLoading);
  const failed = qs.find((q) => q.isError);
  const ready = picked.length > 0 && qs.every((q) => q.data) && !busy && !saved.history.isLoading && !saved.history.isError;
  const examSources = qs.flatMap(q => q.data ? [q.data as SourceDetail] : []);
  const generate = () => saved.start({ sourceIds: picked, requestedCount: count });
  const reset = () => { setConfirm(null); saved.close(); };
  const notice = saved.error && <ErrorNote message={saved.error} />;
  if (saved.history.isLoading || (saved.opening && !attempt)) return <p role="status" className="text-sm text-muted-foreground">Loading saved exam…</p>;

  if (phase === 'setup') {
    return (
      <section aria-label="Exam Simulator" className="space-y-5">
        <p className="text-sm text-muted-foreground">A closed-book run with no solutions until you submit. Progress and scores are saved to this browser’s notebook. Clearing cookies loses access.</p>
        {saved.history.isError && <ErrorNote message="Could not load exam history." onRetry={() => saved.history.refetch()} />}
        {notice}
        {!!saved.history.data?.length && (
          <div className="space-y-2 rounded-xl border bg-card p-4" aria-label="Exam history">
            <h2 className="text-sm font-medium">Exam history</h2>
            {saved.history.data.map(e => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm">
                <div>
                  <p>{new Date(e.createdAt).toLocaleString()} · {e.total} questions · {e.sourceIds.length} lectures</p>
                  <p className="text-xs text-muted-foreground">{e.status === 'completed' && e.score ? `${e.score.correct} / ${e.score.total} · ${e.score.percent.toFixed(1)}%` : e.status === 'in_progress' ? `Unfinished · ${e.answered} answered · question ${e.currentIndex + 1}` : 'Ended without submission'}</p>
                </div>
                {e.status !== 'abandoned' && <Btn disabled={busy} onClick={() => saved.open(e.id)} data-testid={`button-open-exam-${e.id}`}>{e.status === 'in_progress' ? 'Resume exam' : 'View results'}</Btn>}
              </div>
            ))}
          </div>
        )}
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
        <Btn tone="primary" disabled={!ready} onClick={generate} data-testid="button-generate">
          <ClipboardCheck className="size-4" /> {loading ? 'Loading lectures' : picked.length ? 'Generate exam' : 'Select a lecture'}
        </Btn>
      </section>
    );
  }

  const answered = Object.keys(ans).length;

  if (phase === 'done') {
    const right = attempt!.score!.correct;
    const pct = attempt!.score!.percent;
    return (
      <section aria-label="Exam results" className="space-y-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Saved result · {new Date(attempt!.completedAt!).toLocaleString()}</p>
          <p className="font-reading text-4xl font-semibold" data-testid="text-score">{right} / {exam.length} <span className="text-xl text-muted-foreground">{pct.toFixed(1)}%</span></p>
          <p className="text-sm text-muted-foreground">{exam.length - answered} left blank, counted wrong. {frozen.count > exam.length && `Requested ${frozen.count}; the question bank only had ${exam.length}.`}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn tone="primary" disabled={right === exam.length || loading || !!failed || examSources.length !== frozen.ids.length || busy} data-testid="button-revise-missed" onClick={() => onRevise(createRevision(exam, ans, examSources))}>Revise missed topics ({exam.length - right})</Btn>
            <Btn tone="primary" disabled={busy} data-testid="button-retry-exam" onClick={() => saved.start({ sourceIds: frozen.ids, requestedCount: frozen.count as (typeof counts)[number], retryOf: attempt!.id })}>Retry same exam</Btn>
            <Btn disabled={busy} onClick={reset} data-testid="button-new-exam">New exam / history</Btn>
          </div>
          {notice}
          {failed && <ErrorNote message="Could not load lectures for revision." onRetry={() => qs.forEach(q => q.isError && q.refetch())} />}
          {right === exam.length && <p className="mt-2 text-sm text-muted-foreground">All correct — no missed topics to revise.</p>}
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
        <span role="status" className="text-xs text-muted-foreground">{busy ? 'Saving…' : 'Saved to this notebook'}</span>
      </div>
      {notice}
      {saved.error && <Btn disabled={busy} onClick={() => saved.open(attempt!.id)}>Reload saved progress</Btn>}
      <p className="text-xs text-muted-foreground">Covering {frozen.ids.length} lecture{frozen.ids.length === 1 ? '' : 's'} · terminology and applied practice · solutions appear after submission.</p>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <QuestionCard q={q} selected={ans[q.id] ?? null} onSelect={busy ? undefined : (c) => { void saved.save('save', { ...ans, [q.id]: c }); }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn disabled={busy || i === 0} onClick={() => saved.save('save', ans, i - 1)} data-testid="button-prev"><ArrowLeft className="size-4" /> Back</Btn>
        <Btn disabled={busy || i >= exam.length - 1} onClick={() => saved.save('save', ans, i + 1)} data-testid="button-next-q">Next <ArrowRight className="size-4" /></Btn>
        <span className="ml-auto flex gap-2">
          <Btn disabled={busy} tone="danger" onClick={() => setConfirm('end')} data-testid="button-end-exam">End exam</Btn>
          <Btn disabled={busy} tone="primary" onClick={() => (answered < exam.length ? setConfirm('submit') : saved.save('submit'))} data-testid="button-submit-exam">Submit</Btn>
        </span>
      </div>
      {confirm && (
        <div role="alertdialog" className="rise flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
          <p className="flex-1">{confirm === 'submit' ? `${exam.length - answered} unanswered will count as wrong. Submit anyway?` : 'End this exam without a score? It will remain in history, but cannot be resumed.'}</p>
          <Btn disabled={busy} onClick={() => setConfirm(null)}>Keep going</Btn>
          <Btn disabled={busy} tone="primary" data-testid="button-confirm" onClick={() => saved.save(confirm === 'submit' ? 'submit' : 'abandon')}>{confirm === 'submit' ? 'Submit' : 'End exam'}</Btn>
        </div>
      )}
    </section>
  );
}
