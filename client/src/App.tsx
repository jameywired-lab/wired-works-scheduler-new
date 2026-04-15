import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

function AppRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
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
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
