import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetNotebook } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Library from '@/pages/library';
import Sources from '@/pages/sources';
import { Shell } from '@/components/shell';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 15_000, retry: 1 } },
});

function NotebookGate() {
  // Establish the HttpOnly notebook cookie before any parallel child requests.
  const notebook = useGetNotebook();
  if (notebook.isPending) return <div className="min-h-screen grid place-items-center text-primary" role="status">Opening your notebook…</div>;
  if (notebook.isError) return <div className="min-h-screen grid place-items-center"><div role="alert"><p>We couldn’t open your notebook.</p><button className="mt-4 underline" onClick={() => notebook.refetch()}>Try again</button></div></div>;
  return <Router />;
}

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/library" component={Library} />
          <Route path="/sources" component={Sources} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <NotebookGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
