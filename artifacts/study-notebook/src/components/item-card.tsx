import { useState } from 'react';
import { Check, GitMerge, Pencil, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { useUpdateItem, type StudyItem } from '@workspace/api-client-react';
import { Btn, ErrorNote, fieldCls } from '@/components/ui-bits';
import { CitationChips } from '@/components/citations';
import { errorText, useInvalidateNotebook } from '@/lib/notebook';

type Kind = StudyItem['kind'];
const kindLabel: Record<Kind, string> = { concept: 'Concept', terminology: 'Term', flashcard: 'Flashcard' };
const kindTone: Record<Kind, string> = {
  concept: 'bg-secondary text-secondary-foreground',
  terminology: 'bg-accent text-accent-foreground',
  flashcard: 'bg-primary/10 text-primary',
};

export function ItemCard({
  item,
  mode,
  mergeTargets = [],
}: {
  item: StudyItem;
  mode: 'pending' | 'approved';
  mergeTargets?: StudyItem[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [merging, setMerging] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [target, setTarget] = useState<number | ''>('');
  const [title, setTitle] = useState(item.title);
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const [kind, setKind] = useState<Kind>(item.kind);
  const invalidate = useInvalidateNotebook();
  const m = useUpdateItem();

  const run = (data: Parameters<typeof m.mutate>[0]['data'], done?: () => void) =>
    m.mutate(
      { id: item.id, data },
      {
        onSuccess: () => {
          invalidate();
          done?.();
        },
      },
    );

  const valid = title.trim() && question.trim() && answer.trim();
  const id = item.id;

  if (editing) {
    return (
      <form
        className="rise rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3"
        data-testid={`form-edit-${id}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          run({ action: 'edit', title: title.trim(), question: question.trim(), answer: answer.trim(), kind }, () => setEditing(false));
        }}
      >
        <label className="block text-xs font-medium text-muted-foreground">
          Title
          <input className={`${fieldCls} mt-1`} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} data-testid={`input-title-${id}`} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Kind
          <select className={`${fieldCls} mt-1`} value={kind} onChange={(e) => setKind(e.target.value as Kind)} data-testid={`select-kind-${id}`}>
            <option value="concept">Concept</option>
            <option value="terminology">Terminology</option>
            <option value="flashcard">Flashcard</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Question
          <textarea className={`${fieldCls} mt-1 min-h-16`} value={question} maxLength={2000} onChange={(e) => setQuestion(e.target.value)} data-testid={`input-question-${id}`} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Answer
          <textarea className={`${fieldCls} mt-1 min-h-24 font-reading text-base`} value={answer} maxLength={6000} onChange={(e) => setAnswer(e.target.value)} data-testid={`input-answer-${id}`} />
        </label>
        {m.isError && <ErrorNote message={errorText(m.error, 'Could not save your edit.')} />}
        <div className="flex gap-2 justify-end">
          <Btn
            onClick={() => {
              setEditing(false);
              m.reset();
              setTitle(item.title);
              setQuestion(item.question);
              setAnswer(item.answer);
              setKind(item.kind);
            }}
          >
            Cancel
          </Btn>
          <button type="submit" disabled={!valid || m.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" data-testid={`button-save-${id}`}>
            {m.isPending ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="rise rounded-xl border bg-card p-4 shadow-sm" data-testid={`card-item-${id}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-reading text-lg font-semibold leading-snug">{item.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${kindTone[item.kind]}`}>{kindLabel[item.kind]}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-primary">{item.question}</p>
      {mode === 'approved' && !revealed ? (
        <button
          onClick={() => setRevealed(true)}
          data-testid={`button-reveal-${id}`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/35 bg-secondary/50 py-5 text-sm text-primary transition-colors hover:bg-secondary"
        >
          <Eye className="size-4" aria-hidden /> Reveal answer
        </button>
      ) : (
        <div className="rise mt-2 border-l-2 border-accent-foreground/40 pl-3">
          <p className="font-reading text-[1.05rem] leading-relaxed whitespace-pre-wrap" data-testid={`text-answer-${id}`}>
            {item.answer}
          </p>
          {mode === 'approved' && (
            <button onClick={() => setRevealed(false)} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid={`button-hide-${id}`}>
              <EyeOff className="size-3" aria-hidden /> Hide
            </button>
          )}
        </div>
      )}
      <CitationChips citations={item.citations} />

      {m.isError && (
        <div className="mt-3">
          <ErrorNote message={errorText(m.error)} />
        </div>
      )}

      {merging && (
        <div className="rise mt-3 rounded-lg bg-muted p-3 text-sm space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Merge this item into
            <select className={`${fieldCls} mt-1`} value={target} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : '')} data-testid={`select-merge-${id}`}>
              <option value="">Choose a pending item</option>
              {mergeTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">This card is folded into the chosen one; its citations are kept.</p>
          <div className="flex gap-2 justify-end">
            <Btn onClick={() => setMerging(false)}>Cancel</Btn>
            <Btn tone="primary" disabled={!target || m.isPending} data-testid={`button-confirm-merge-${id}`} onClick={() => target && run({ action: 'merge', mergeTargetId: Number(target) }, () => setMerging(false))}>
              {m.isPending ? 'Merging' : 'Merge'}
            </Btn>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-2">
        {mode === 'pending' && (
          <Btn tone="primary" disabled={m.isPending} onClick={() => run({ action: 'approve' })} data-testid={`button-approve-${id}`}>
            <Check className="size-4" /> Approve
          </Btn>
        )}
        <Btn disabled={m.isPending} onClick={() => setEditing(true)} data-testid={`button-edit-${id}`}>
          <Pencil className="size-3.5" /> Edit
        </Btn>
        {mode === 'pending' && (
          <Btn disabled={m.isPending || mergeTargets.length === 0} title={mergeTargets.length === 0 ? 'Needs another pending item' : undefined} onClick={() => setMerging((v) => !v)} data-testid={`button-merge-${id}`}>
            <GitMerge className="size-3.5" /> Merge
          </Btn>
        )}
        <span className="ml-auto flex items-center gap-1">
          {confirm ? (
            <>
              <span className="text-xs text-muted-foreground">Discard this item?</span>
              <Btn tone="danger" disabled={m.isPending} onClick={() => run({ action: 'discard' })} data-testid={`button-confirm-discard-${id}`}>
                Discard
              </Btn>
              <Btn onClick={() => setConfirm(false)} aria-label="Keep item">
                <X className="size-4" />
              </Btn>
            </>
          ) : (
            <Btn tone="danger" disabled={m.isPending} onClick={() => setConfirm(true)} data-testid={`button-discard-${id}`}>
              <Trash2 className="size-3.5" /> Discard
            </Btn>
          )}
        </span>
      </div>
    </article>
  );
}
