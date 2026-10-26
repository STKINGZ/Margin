import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { BookMarked, Search } from 'lucide-react';
import { type Source, type StudyItem } from '@workspace/api-client-react';
import { ItemCard } from '@/components/item-card';
import { Empty, ErrorNote, SkeletonLines, fieldCls } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';

export function QuickRecall({ sources, items, loading, error, onRetry }: { sources: Source[]; items?: StudyItem[]; loading: boolean; error: unknown; onRetry: () => void }) {
  const [term, setTerm] = useState('');
  const [lecture, setLecture] = useState('');
  const [terms, setTerms] = useState(false);
  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      if (terms && i.kind !== 'terminology') return false;
      if (lecture && !i.citations.some((c) => c.sourceId === Number(lecture))) return false;
      return !t || `${i.title} ${i.question} ${i.answer}`.toLowerCase().includes(t);
    });
  }, [items, term, lecture, terms]);
  return (
    <section aria-label="Quick Recall">
      <p className="mb-4 text-sm text-muted-foreground">Try recalling before you reveal. These are the cards you approved.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search cards</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search cards" className={`${fieldCls} pl-9`} data-testid="input-search" />
        </label>
        <label className="w-full min-w-0 sm:w-auto sm:max-w-sm">
          <span className="sr-only">Source</span>
          <select value={lecture} onChange={(e) => setLecture(e.target.value)} className={fieldCls} data-testid="select-recall-lecture">
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.lecture}: {s.title}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} data-testid="check-terms-only" /> Terms only
        </label>
      </div>
      {loading && <SkeletonLines n={3} />}
      {!!error && <ErrorNote message={errorText(error, 'Could not load your cards.')} onRetry={onRetry} />}
      {items?.length === 0 && (
        <Empty title="No approved cards yet" icon={<BookMarked className="size-5" />}>
          Approve items from the review queue and they will appear here.
          <Link href="/tutor" className="mt-3 block font-medium text-primary underline underline-offset-2" data-testid="link-to-queue">Go to the review queue</Link>
        </Empty>
      )}
      {items && items.length > 0 && shown.length === 0 && (
        <Empty title="No matches" icon={<Search className="size-5" />}>No approved card fits these filters.</Empty>
      )}
      <div className="space-y-3">
        {shown.map((i) => (
          <ItemCard key={i.id} item={i} mode="approved" />
        ))}
      </div>
    </section>
  );
}
