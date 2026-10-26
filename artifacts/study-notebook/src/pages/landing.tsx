import { Link } from 'wouter';
import { ArrowRight, BookOpen, FileText, LockKeyhole, MessageSquareText, PenLine } from 'lucide-react';

const notes = [
  { icon: FileText, title: 'Your material, as uploaded', body: 'Bring lecture notes or readings as PDF or text. Every answer points back to the page it came from.' },
  { icon: MessageSquareText, title: 'A tutor that cites', body: 'Ask, explain things back, and keep only the takeaways you approve. Nothing is filed without you.' },
  { icon: PenLine, title: 'Practice from the sources', body: 'Generated problems and closed-book exams drawn from whichever sources you pick.' },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="font-reading text-2xl font-semibold tracking-tight text-primary" data-testid="text-brand">Margin</span>
        <Link href="/sign-in" className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-secondary" data-testid="link-sign-in-header">Sign in</Link>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:pt-16">
        <section className="rise">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-foreground">A private study notebook</p>
          <h1 className="mt-4 font-reading text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
            Study in the <em className="font-normal italic text-primary">margins</em> of your own notes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            One notebook, one owner, any class. Upload the material, talk it through with a tutor that cites its pages, then test yourself on it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-in" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.97]" data-testid="link-sign-in">
              Open my notebook <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/sign-up" className="rounded-full border px-5 py-3 text-sm font-medium text-foreground hover:bg-secondary" data-testid="link-sign-up">First time? Create the owner account</Link>
          </div>
          <div className="mt-8 flex max-w-xl gap-3 rounded-xl border border-primary/15 bg-secondary/50 p-4 text-sm leading-relaxed">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p><strong className="font-medium">Owner-only.</strong> Nothing in the notebook is shown on this page. If you used Margin before sign-in, sign in for the first time from that same browser and your earlier notebook comes with you.</p>
          </div>
        </section>
        <aside aria-label="What Margin does" className="relative">
          <div className="absolute -left-3 top-0 bottom-0 w-px bg-accent-foreground/30" aria-hidden />
          <ol className="space-y-7 pl-6">
            {notes.map((n, i) => (
              <li key={n.title} className="rise" style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
                <p className="flex items-center gap-2 font-mono text-[11px] text-accent-foreground"><n.icon className="size-3.5" aria-hidden /> 0{i + 1}</p>
                <h2 className="mt-1 font-reading text-2xl font-semibold">{n.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ol>
        </aside>
      </main>
      <footer className="border-t bg-muted/50">
        <p className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4 text-xs text-muted-foreground sm:px-8"><BookOpen className="size-3.5" aria-hidden /> Margin keeps one person’s notes. It is not a shared class space.</p>
      </footer>
    </div>
  );
}
