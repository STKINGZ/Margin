import { Check, X } from 'lucide-react';
import { CitationChips } from '@/components/citations';
import type { PracticeQuestion } from '@/lib/testing';

export function QuestionCard({ q, selected, onSelect, reveal }: { q: PracticeQuestion; selected: number | null; onSelect?: (i: number) => void; reveal?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{q.kind === 'applied' ? 'Applied' : 'Term'} · {q.category}</p>
      <p className="font-reading text-xl leading-snug whitespace-pre-wrap" data-testid="text-question">{q.prompt}</p>
      <ul className="mt-4 space-y-2">
        {q.choices.map((c, i) => {
          const isSel = selected === i;
          const right = reveal && i === q.correctIndex;
          const wrong = reveal && isSel && i !== q.correctIndex;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!onSelect}
                aria-pressed={isSel}
                onClick={() => onSelect?.(i)}
                data-testid={`button-choice-${i}`}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                  right ? 'border-primary bg-primary/10' : wrong ? 'border-destructive bg-destructive/5' : isSel ? 'border-primary bg-secondary' : 'bg-card hover:bg-secondary/50'
                }`}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs">{right ? <Check className="size-3.5" /> : wrong ? <X className="size-3.5" /> : String.fromCharCode(65 + i)}</span>
                <span className="font-reading text-base whitespace-pre-wrap">{c}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Explanation({ q, selected }: { q: PracticeQuestion; selected: number | null }) {
  return (
    <div className="rise mt-3 border-l-2 border-accent-foreground/40 pl-3" data-testid="text-explanation">
      <p className="text-sm font-medium">
        {selected === null ? 'Not answered' : selected === q.correctIndex ? 'Correct' : 'Incorrect'}
        {selected !== q.correctIndex && <span className="font-normal text-muted-foreground"> · Answer: {String.fromCharCode(65 + q.correctIndex)}. {q.choices[q.correctIndex]}</span>}
      </p>
      <p className="mt-1 font-reading text-base leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
      <CitationChips citations={q.citations} />
    </div>
  );
}
