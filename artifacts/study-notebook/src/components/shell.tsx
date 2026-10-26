import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { BookMarked, BookOpen, LibraryBig, LogOut, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useGetNotebook } from '@workspace/api-client-react';
import { CourseSwitcher } from '@/components/course-switcher';
import { BackupButton } from '@/components/backup-button';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const nav = [
  { href: '/tutor', label: 'Tutor', icon: MessageSquareText },
  { href: '/library', label: 'Testing Hub', icon: BookMarked },
  { href: '/sources', label: 'Sources', icon: BookOpen },
  { href: '/courses', label: 'Courses', icon: LibraryBig },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const reader = loc.startsWith('/sources');
  const { data: nb } = useGetNotebook();
  const { signOut } = useClerk();
  const { user } = useUser();
  return (
    <div className={reader ? 'h-screen h-[100dvh] overflow-hidden flex flex-col' : 'min-h-[100dvh] flex flex-col'}>
      <header className="sticky top-0 z-30 shrink-0 bg-background/90 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 min-h-14 sm:h-14 py-2 sm:py-0 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-6">
          <Link href="/tutor" className="flex items-baseline gap-2 shrink-0" data-testid="link-home">
            <span className="font-reading text-2xl font-semibold tracking-tight text-primary">Margin</span>
          </Link>
          <nav className="order-last sm:order-none w-full sm:w-auto grid grid-cols-4 sm:flex items-center gap-1" aria-label="Primary">
            {nav.map((n) => {
              const active = loc.startsWith(n.href);
              const count = n.href === '/library' ? nb?.approvedCount : undefined;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`link-nav-${n.label.toLowerCase().replace(' ', '-')}`}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-w-0 justify-center sm:justify-start items-center gap-1.5 px-1 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors ${
                    active ? 'text-primary font-medium bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <n.icon className="hidden sm:block size-4" aria-hidden />
                  <span>{n.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="hidden sm:inline text-[11px] tabular-nums text-muted-foreground">{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto hidden lg:block min-w-0">
            <CourseSwitcher activeId={nb?.activeCourseId} title={nb?.course ?? 'Course'} />
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: basePath || '/' })}
            className="ml-auto lg:ml-0 inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="button-sign-out"
            aria-label="Sign out"
            title={user?.primaryEmailAddress?.emailAddress ? `Signed in as ${user.primaryEmailAddress.emailAddress}` : 'Sign out'}
          >
            <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        <div className="lg:hidden border-t px-4 py-1.5"><CourseSwitcher activeId={nb?.activeCourseId} title={nb?.course ?? 'Course'} /></div>
      </header>
      <main className={`flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 ${reader ? 'min-h-0 overflow-hidden' : ''}`}>{children}</main>
      <footer className={`border-t bg-muted/50 ${reader ? 'hidden' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-start gap-3 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck className="size-4 shrink-0 mt-0.5 text-accent-foreground" aria-hidden />
          <p data-testid="text-privacy" className="flex-1 min-w-60">
            <strong className="text-foreground font-medium">Private to the owner account.</strong> Only the verified owner email can open this
            notebook. Download a backup now and then to keep your own copy.
            {nb?.privacyNotice ? <span className="block mt-1">{nb.privacyNotice}</span> : null}
          </p>
          <BackupButton compact />
        </div>
      </footer>
    </div>
  );
}
