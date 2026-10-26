import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { BookMarked, Search } from 'lucide-react';
import { useListItems } from '@workspace/api-client-react';
import { ItemCard } from '@/components/item-card';
import { Empty, ErrorNote, SkeletonLines, fieldCls } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';

export default function Library() {
  const q = useListItems({ status: 'approved' });
  const [term, setTerm] = useState('');
  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!q.data) return [];
    return t ? q.data.filter((i) => `${i.title} ${i.question} ${i.answer}`.toLowerCase().includes(t)) : q.data;
  }, [q.data, term]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-reading text-3xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">What you decided was worth remembering. Try recalling before you reveal.</p>
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search library</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search cards" className={`${fieldCls} pl-9`} data-testid="input-search" />
        </label>
      </div>
      {q.isLoading && <SkeletonLines n={3} />}
      {q.isError && <ErrorNote message={errorText(q.error, 'Could not load your library.')} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && (
        <Empty title="No approved cards yet" icon={<BookMarked className="size-5" />}>
          Approve items from the review queue and they will appear here.
          <Link href="/" className="mt-3 block font-medium text-primary underline underline-offset-2" data-testid="link-to-queue">
            Go to the review queue
          </Link>
        </Empty>
      )}
      {q.data && q.data.length > 0 && shown.length === 0 && (
        <Empty title="No matches" icon={<Search className="size-5" />}>
          Nothing in your library mentions "{term}".
        </Empty>
      )}
      <div className="space-y-3">
        {shown.map((i) => (
          <ItemCard key={i.id} item={i} mode="approved" />
        ))}
      </div>
    </div>
  );
}
