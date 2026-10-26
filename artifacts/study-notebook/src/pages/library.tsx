import { useState } from 'react';
import { useGetNotebook, useListItems } from '@workspace/api-client-react';
import { QuickRecall } from '@/components/testing/quick-recall';
import { AppliedPractice } from '@/components/testing/applied-practice';
import { ExamSimulator } from '@/components/testing/exam-simulator';

const tabs = [
  { id: 'recall', label: 'Quick Recall' },
  { id: 'applied', label: 'Applied Practice' },
  { id: 'exam', label: 'Exam Simulator' },
] as const;

export default function Library() {
  const nb = useGetNotebook();
  const q = useListItems({ status: 'approved' });
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('recall');
  const [examLive, setExamLive] = useState(false);
  const sources = nb.data?.sources ?? [];
  const go = (id: typeof tab) => {
    if (id !== tab && tab === 'exam' && examLive) {
      // exam state stays mounted; make that explicit rather than silent
      if (!window.confirm('Your exam is still in progress. It will wait here while you switch. Continue?')) return;
    }
    setTab(id);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-reading text-3xl font-semibold">Testing Hub</h1>
      <nav className="mb-5 mt-3 flex gap-1 border-b" aria-label="Testing modes">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined} data-testid={`tab-${t.id}`} className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${tab === t.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div hidden={tab !== 'recall'}><QuickRecall sources={sources} items={q.data} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} /></div>
      <div hidden={tab !== 'applied'}><AppliedPractice sources={sources} /></div>
      <div hidden={tab !== 'exam'}><ExamSimulator sources={sources} approved={q.data ?? []} onActive={setExamLive} /></div>
    </div>
  );
}
