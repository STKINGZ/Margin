import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListExams, useCreateExamAttempt, useUpdateExamAttempt, getExamAttempt,
  getListExamsQueryKey, type ExamAttempt, type ExamInput, type ExamProgress,
} from '@workspace/api-client-react';

export function useSavedExam(enabled: boolean) {
  const client = useQueryClient();
  const history = useListExams({ query: { enabled, refetchOnMount: 'always' } });
  const create = useCreateExamAttempt();
  const update = useUpdateExamAttempt();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const lock = useRef(false);
  const refresh = () => client.invalidateQueries({ queryKey: getListExamsQueryKey() });
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setOpening(true);
    setError('');
    try { await operation(); }
    catch (e) {
      const err = e as { status?: number; data?: { error?: string } };
      setError(err.data?.error ?? 'Could not save or load this exam. Your last saved progress is safe. Please try again.');
      if (err.status === 409) void refresh();
    } finally { lock.current = false; setOpening(false); }
  };
  const open = (id: number) => run(async () => { setAttempt(await getExamAttempt(id)); });
  useEffect(() => {
    if (!history.data || initialized.current) return;
    initialized.current = true;
    const active = history.data.find(e => e.status === 'in_progress');
    if (active) void open(active.id);
  }, [history.data]);
  const start = (data: ExamInput) => run(async () => {
    setAttempt(await create.mutateAsync({ data }));
    void refresh();
  });
  // Pessimistic saves: the UI advances only after the server confirms durability.
  const save = (action: ExamProgress['action'], answers = attempt?.answers, currentIndex = attempt?.currentIndex) => run(async () => {
    if (!attempt || answers === undefined || currentIndex === undefined) return;
    const saved = await update.mutateAsync({ id: attempt.id, data: { action, answers, currentIndex, version: attempt.version } });
    setAttempt(action === 'abandon' ? null : saved);
    void refresh();
  });
  return {
    attempt, history, error, opening, busy: opening || create.isPending || update.isPending,
    open, start, save, close: () => { setAttempt(null); setError(''); },
  };
}
