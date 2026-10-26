import { useEffect, useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { FileText } from 'lucide-react';
import { getGetSourceQueryKey, useGetNotebook, useGetSource } from '@workspace/api-client-react';
import { Empty, ErrorNote, SkeletonLines } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';

export default function Sources() {
  const search = useSearch();
  const [, setLoc] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const nb = useGetNotebook();
  const sourceId = Number(params.get('source')) || nb.data?.sources[0]?.id || 0;
  const page = Number(params.get('page')) || 0;
  const src = useGetSource(sourceId, { query: { enabled: !!sourceId, queryKey: getGetSourceQueryKey(sourceId) } });

  useEffect(() => {
    if (!src.data || !page) return;
    const el = document.getElementById(`page-${page}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [src.data, page]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,0.32fr)_minmax(0,1fr)] gap-4 md:gap-6 md:grid-rows-1 md:grid-cols-[18rem_minmax(0,1fr)]">
      <nav aria-label="Sources" className="min-h-0 overflow-y-auto overscroll-contain pr-2">
        <h1 className="font-reading text-3xl font-semibold mb-1">Sources</h1>
        <p className="text-sm text-muted-foreground mb-4">The original course material, as uploaded or imported.</p>
        {nb.isLoading && <SkeletonLines n={3} />}
        {nb.isError && <ErrorNote message={errorText(nb.error, 'Could not load sources.')} onRetry={() => nb.refetch()} />}
        <ul className="flex flex-col gap-1.5 pb-1">
          {nb.data?.sources.map((s) => {
            const active = s.id === sourceId;
            return (
              <li key={s.id} className="shrink-0 md:shrink">
                <button
                  onClick={() => setLoc(`/sources?source=${s.id}`)}
                  aria-current={active ? 'true' : undefined}
                  data-testid={`button-source-${s.id}`}
                  className={`w-full min-w-48 text-left rounded-lg border px-3 py-2 transition-colors ${active ? 'border-primary/40 bg-secondary' : 'bg-card hover:border-primary/30'}`}
                >
                  <span className="block font-mono text-[11px] text-accent-foreground">{s.lecture}</span>
                  <span className="block text-sm font-medium leading-snug">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.pageCount} pages</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <article aria-label="Source content" className="min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-2xl border bg-card px-5 py-6 sm:px-10 sm:py-9 shadow-sm">
        {src.isLoading && <SkeletonLines n={4} />}
        {src.isError && <ErrorNote message={errorText(src.error, 'Could not load this source.')} onRetry={() => src.refetch()} />}
        {!sourceId && !nb.isLoading && <Empty title="No sources in this course" icon={<FileText className="size-5" />}>Upload a PDF or text file to read it here.<Link href="/courses" className="mt-3 block font-medium text-primary underline underline-offset-2" data-testid="link-sources-upload">Go to Courses</Link></Empty>}
        {src.data && (
          <>
            <header className="mb-6 border-b pb-4">
              <p className="font-mono text-xs text-accent-foreground">{src.data.lecture}</p>
              <h2 className="font-reading text-3xl font-semibold leading-tight">{src.data.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{src.data.description}</p>
              {src.data.pages.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1" aria-label="Jump to page">
                  {src.data.pages.map((p) => (
                    <button
                      key={p.page}
                      onClick={() => document.getElementById(`page-${p.page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="rounded border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
                      data-testid={`button-jump-${p.page}`}
                    >
                      {p.page}
                    </button>
                  ))}
                </div>
              )}
            </header>
            <div className="space-y-8">
              {src.data.pages.map((p) => (
                <section key={p.page} id={`page-${p.page}`} className={`scroll-mt-20 rounded-lg ${p.page === page ? 'bg-accent/50 -mx-3 px-3 py-2 ring-1 ring-accent-foreground/20' : ''}`}>
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Page {p.page}</p>
                  <p className="font-reading text-[1.12rem] leading-[1.8] whitespace-pre-wrap max-w-[68ch]">{p.text}</p>
                </section>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
