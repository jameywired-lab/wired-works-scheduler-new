import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import JobDetailPage from "./pages/JobDetailPage";
import CrewPage from "./pages/CrewPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import ImportPage from "./pages/ImportPage";
import ProjectsPage from "./pages/ProjectsPage";
import CrewJobsPage from "./pages/CrewJobsPage";
import CrewClientsPage from "./pages/CrewClientsPage";
import CrewProjectsPage from "./pages/CrewProjectsPage";
import FollowUpPage from "./pages/FollowUpPage";
import VanInventoryPage from "./pages/VanInventoryPage";
import MarketingPage from "./pages/MarketingPage";
import RevenueReportPage from "./pages/RevenueReportPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import CommunicationsPage from "./pages/CommunicationsPage";
import CrewHomePage from "./pages/CrewHomePage";
import CrewSchedulePage from "./pages/CrewSchedulePage";
import CrewJobDetailPage from "./pages/CrewJobDetailPage";
import CrewCalendarPage from "./pages/CrewCalendarPage";
import Login from "./pages/Login";
import { trpc } from "./lib/trpc";

function ProtectedRoutes() {
  const [, navigate] = useLocation();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/jobs/:id" component={JobDetailPage} />
        <Route path="/crew" component={CrewPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/crew-jobs" component={CrewJobsPage} />
        <Route path="/crew-clients" component={CrewClientsPage} />
        <Route path="/crew-projects" component={CrewProjectsPage} />
        <Route path="/follow-ups" component={FollowUpPage} />
        <Route path="/van-inventory" component={VanInventoryPage} />
        <Route path="/marketing" component={MarketingPage} />
        <Route path="/revenue-report" component={RevenueReportPage} />
        <Route path="/activity-log" component={ActivityLogPage} />
        <Route path="/communications" component={CommunicationsPage} />
        <Route path="/crew-home" component={CrewSchedulePage} />
        <Route path="/crew-job/:id" component={CrewJobDetailPage} />
        <Route path="/crew-calendar" component={CrewCalendarPage} />
        <Route path="/crew-home-legacy" component={CrewHomePage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Switch>
            <Route path="/login" component={Login} />
            <Route component={ProtectedRoutes} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
