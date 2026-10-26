import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { BookMarked, BookOpen, MessageSquareText, ShieldAlert } from 'lucide-react';
import { useGetNotebook } from '@workspace/api-client-react';

const nav = [
  { href: '/', label: 'Tutor', icon: MessageSquareText },
  { href: '/library', label: 'Library', icon: BookMarked },
  { href: '/sources', label: 'Sources', icon: BookOpen },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { data: nb } = useGetNotebook();
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-4 sm:gap-8">
          <Link href="/" className="flex items-baseline gap-2 shrink-0" data-testid="link-home">
            <span className="font-reading text-2xl font-semibold tracking-tight text-primary">Margin</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">CS 202</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {nav.map((n) => {
              const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
              const count = n.href === '/library' ? nb?.approvedCount : undefined;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`link-nav-${n.label.toLowerCase()}`}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active ? 'text-primary font-medium bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <n.icon className="size-4" aria-hidden />
                  <span>{n.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <p className="ml-auto hidden md:block text-xs text-muted-foreground truncate">
            {nb?.course ?? 'CS 202: Digital Logic & Computer Systems'}
          </p>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">{children}</main>
      <footer className="border-t bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex gap-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldAlert className="size-4 shrink-0 mt-0.5 text-accent-foreground" aria-hidden />
          <p data-testid="text-privacy">
            <strong className="text-foreground font-medium">Tied to this browser.</strong> There is no login. Your
            notebook is reachable only from this browser; clearing cookies or site data means losing access to it. It is
            not authenticated private hosting.
            {nb?.privacyNotice ? <span className="block mt-1">{nb.privacyNotice}</span> : null}
          </p>
        </div>
      </footer>
    </div>
  );
}
