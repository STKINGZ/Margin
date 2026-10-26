import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { getGetSourceQueryKey, useGetSource, type Citation } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Btn, ErrorNote } from '@/components/ui-bits';
import { errorText } from '@/lib/notebook';

export function CitationChips({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState<Citation | null>(null);
  if (!citations?.length) return null;
  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Citations">
        {citations.map((c, i) => (
          <li key={i}>
            <button
              onClick={() => setOpen(c)}
              data-testid={`button-citation-${c.sourceId}-${c.page}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-accent-foreground/20 bg-accent px-2.5 py-0.5 text-xs text-accent-foreground transition-colors hover:border-accent-foreground/50"
            >
              <Quote className="size-3" aria-hidden />
              <span className="max-w-[16rem] truncate">{c.sourceTitle}</span>
              <span className="font-mono">p.{c.page}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <CitationDialog citation={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function CitationDialog({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  const [, setLoc] = useLocation();
  const [page, setPage] = useState(citation.page);
  const q = useGetSource(citation.sourceId, {
    query: { enabled: !!citation.sourceId, queryKey: getGetSourceQueryKey(citation.sourceId) },
  });
  const pages = q.data?.pages ?? [];
  const current = pages.find((p) => p.page === page);
  const idx = pages.findIndex((p) => p.page === page);
  const showExcerpt = page === citation.page;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto bg-card">
        <DialogTitle className="font-reading text-xl pr-6">{citation.sourceTitle}</DialogTitle>
        <DialogDescription className="font-mono text-xs">Page {page}</DialogDescription>
        {showExcerpt && (
          <blockquote className="border-l-4 border-accent-foreground/40 bg-accent/60 rounded-r-md px-4 py-3 font-reading text-[1.05rem] leading-relaxed" data-testid="text-citation-excerpt">
            {citation.excerpt}
          </blockquote>
        )}
        {q.isLoading && <div className="h-40 rounded-md bg-muted animate-pulse" aria-busy="true" />}
        {q.isError && <ErrorNote message={errorText(q.error, 'Could not load this page.')} onRetry={() => q.refetch()} />}
        {current && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Full page text</p>
            <p className="font-reading text-[1.05rem] leading-[1.75] whitespace-pre-wrap">{current.text}</p>
          </div>
        )}
        {q.data && !current && <p className="text-sm text-muted-foreground">This page is not in the source text.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-1">
            <Btn tone="soft" disabled={idx <= 0} onClick={() => setPage(pages[idx - 1].page)} aria-label="Previous page" data-testid="button-citation-prev">
              <ChevronLeft className="size-4" />
            </Btn>
            <Btn tone="soft" disabled={idx < 0 || idx >= pages.length - 1} onClick={() => setPage(pages[idx + 1].page)} aria-label="Next page" data-testid="button-citation-next">
              <ChevronRight className="size-4" />
            </Btn>
          </div>
          <Btn
            tone="primary"
            data-testid="button-open-source"
            onClick={() => {
              setLoc(`/sources?source=${citation.sourceId}&page=${page}`);
              onClose();
            }}
          >
            Read in Sources <ArrowRight className="size-4" />
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
