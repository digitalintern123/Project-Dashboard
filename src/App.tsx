import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import ProjectDetail from '@/pages/project-detail';
import { AppShell } from '@/components/app-shell';
import Login from '@/pages/login';
import { AppStateProvider, useAppState } from '@/state/app-state';
import Workspace from '@/pages/workspace';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  const { role } = useAppState();
  if (!role) return <Login />;

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <AppShell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/projects">{() => <Workspace view="projects" />}</Route>
          <Route path="/my-projects">{() => <Workspace view="my-projects" />}</Route>
          <Route path="/timeline">{() => <Workspace view="timeline" />}</Route>
          <Route path="/milestones">{() => <Workspace view="milestones" />}</Route>
          <Route path="/issues">{() => <Workspace view="issues" />}</Route>
          <Route path="/commercial">{() => <Workspace view="commercial" />}</Route>
          <Route path="/updates">{() => <Workspace view="updates" />}</Route>
          <Route path="/reports">{() => <Workspace view="reports" />}</Route>
          <Route path="/new-project">{() => <Workspace view="new-project" />}</Route>
          <Route path="/project/:projectId" component={ProjectDetail} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <AppStateProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppStateProvider>
  );
}

export default App;
