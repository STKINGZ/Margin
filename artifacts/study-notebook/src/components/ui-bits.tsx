import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export function Btn({
  tone = 'plain',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'plain' | 'danger' | 'soft' }) {
  const tones = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    soft: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
    plain: 'text-muted-foreground hover:text-foreground hover:bg-muted',
    danger: 'text-destructive hover:bg-destructive/10',
  };
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${tones[tone]} ${className}`}
    />
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 font-medium underline underline-offset-2" data-testid="button-retry">
          <RotateCw className="size-3.5" aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rise rounded-xl border border-dashed border-primary/25 bg-secondary/40 px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-card text-primary">{icon}</div>}
      <h3 className="font-reading text-xl text-foreground">{title}</h3>
      {children && <div className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">{children}</div>}
    </div>
  );
}

export function SkeletonLines({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
          <div className="h-4 w-2/5 rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export const fieldCls =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring';
