import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useGetNotebook } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Library from '@/pages/library';
import Sources from '@/pages/sources';
import Courses from '@/pages/courses';
import Landing from '@/pages/landing';
import { Forbidden } from '@/components/forbidden';
import { Shell } from '@/components/shell';
import { CourseSwitchProvider, useCourseSwitch } from '@/lib/course-switch';
import { clearTutorSession } from '@/lib/tutor-session';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

// REQUIRED — copy verbatim.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(190 48% 27%)',
    colorForeground: 'hsl(205 35% 16%)',
    colorMutedForeground: 'hsl(205 14% 38%)',
    colorDanger: 'hsl(8 65% 40%)',
    colorBackground: 'hsl(44 48% 98%)',
    colorInput: 'hsl(44 48% 98%)',
    colorInputForeground: 'hsl(205 35% 16%)',
    colorNeutral: 'hsl(205 25% 30%)',
    fontFamily: 'Figtree, ui-sans-serif, system-ui, sans-serif',
    borderRadius: '0.6rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-[0_18px_50px_-24px_hsl(190_48%_20%/0.35)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-reading text-2xl font-semibold text-foreground',
    headerSubtitle: 'text-sm text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground font-medium',
    formFieldLabel: 'text-foreground font-medium',
    footerActionLink: 'text-primary font-medium underline-offset-2 hover:underline',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-primary',
    alertText: 'text-foreground',
    logoBox: 'justify-center',
    logoImage: 'h-11 w-11',
    socialButtonsBlockButton: 'border border-border bg-background hover:bg-secondary',
    formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-none',
    formFieldInput: 'bg-card border border-input text-foreground',
    footerAction: 'justify-center',
    dividerLine: 'bg-border',
    alert: 'border border-destructive/30 bg-destructive/5',
    otpCodeFieldInput: 'border border-input text-foreground',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 15_000, retry: (n, e) => n < 1 && !isAuthError(e) } },
});

function isAuthError(e: unknown) {
  const s = (e as { status?: number } | null)?.status;
  return s === 401 || s === 403;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background px-4 py-10">
      {children}
      <p className="max-w-[440px] text-center text-xs leading-relaxed text-muted-foreground" data-testid="text-retain-notebook">
        Margin admits a single owner account. If you studied here before sign-in existed, sign in from that same browser the
        first time: your earlier notebook is carried into your account automatically, and the old browser copy is left untouched.
      </p>
    </div>
  );
}

function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}

function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}

/** Clears every private cache whenever the signed-in user changes or signs out. */
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.cancelQueries();
        qc.clear();
        clearTutorSession();
      }
      if (!userId) clearTutorSession();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/tutor" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function Protected() {
  return (
    <>
      <Show when="signed-in"><CourseSwitchProvider><NotebookGate /></CourseSwitchProvider></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function Opening({ label }: { label: string }) {
  return (
    <div className="min-h-[100dvh] grid place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-primary">
        <span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="dot size-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.18}s` }} />)}</span>
        <p className="font-reading text-lg">{label}</p>
      </div>
    </div>
  );
}

function NotebookGate() {
  const { switching } = useCourseSwitch();
  const notebook = useGetNotebook({ query: { enabled: !switching } });
  if (switching) return <Opening label="Updating your courses…" />;
  if (notebook.isPending) return <Opening label="Opening your notebook…" />;
  if (notebook.isError) {
    const status = (notebook.error as { status?: number } | null)?.status;
    if (status === 403) return <Forbidden />;
    if (status === 401) return <Forbidden signedOutish />;
    return <div className="min-h-[100dvh] grid place-items-center"><div role="alert" className="text-center"><p>We couldn’t open your notebook.</p><button className="mt-4 underline" onClick={() => notebook.refetch()} data-testid="button-retry-notebook">Try again</button></div></div>;
  }
  return <PrivateRouter courseKey={notebook.data.activeCourseId ?? 0} />;
}

function PrivateRouter({ courseKey }: { courseKey: number }) {
  return (
    <Shell>
      <RoutedErrorBoundary>
        {/* Keyed by course: every hidden exam, practice, and tutor state resets on switch. */}
        <Switch key={courseKey}>
          <Route path="/tutor" component={Home} />
          <Route path="/library" component={Library} />
          <Route path="/sources" component={Sources} />
          <Route path="/courses" component={Courses} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Open your notebook', subtitle: 'Owner sign-in for this private Margin notebook' } },
        signUp: { start: { title: 'Claim this notebook', subtitle: 'Only the verified owner email is admitted' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={Protected} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
