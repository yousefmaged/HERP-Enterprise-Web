import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import Assistant from "@/pages/Assistant";
import CRM from "@/pages/CRM";
import Dashboard from "@/pages/Dashboard";
import Finance from "@/pages/Finance";
import HumanResources from "@/pages/HumanResources";
import Inventory from "@/pages/Inventory";
import Notifications from "@/pages/Notifications";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import SetupOrganization from "@/pages/SetupOrganization";
import Tasks from "@/pages/Tasks";
import { Route, Switch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Building2, LoaderCircle } from "lucide-react";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";

function WorkspaceRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const context = trpc.herp.context.useQuery(undefined, { enabled: !loading && isAuthenticated, retry: false });
  if (loading) return <div className="herp-login min-h-screen px-6" dir="rtl"><div className="w-full max-w-sm text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300 shadow-[0_0_32px_rgba(34,211,238,.12)]"><Building2 className="size-8" /></div><p className="mt-5 text-xl font-bold tracking-tight text-white">HERP</p><div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin text-cyan-300" />جارٍ التحقق من مساحة العمل…</div></div></div>;
  if (!isAuthenticated) return <DashboardLayout><div /></DashboardLayout>;
  if (context.isLoading) return <DashboardLayout><div className="herp-loading min-h-[65vh]">جارٍ تجهيز مساحة العمل…</div></DashboardLayout>;
  if (!context.data?.initialized) return <SetupOrganization />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return <Switch>
    <Route path="/">{() => <WorkspaceRoute><Dashboard /></WorkspaceRoute>}</Route>
    <Route path="/hr">{() => <WorkspaceRoute><HumanResources /></WorkspaceRoute>}</Route>
    <Route path="/finance">{() => <WorkspaceRoute><Finance /></WorkspaceRoute>}</Route>
    <Route path="/inventory">{() => <WorkspaceRoute><Inventory /></WorkspaceRoute>}</Route>
    <Route path="/crm">{() => <WorkspaceRoute><CRM /></WorkspaceRoute>}</Route>
    <Route path="/reports">{() => <WorkspaceRoute><Reports /></WorkspaceRoute>}</Route>
    <Route path="/assistant">{() => <WorkspaceRoute><Assistant /></WorkspaceRoute>}</Route>
    <Route path="/notifications">{() => <WorkspaceRoute><Notifications /></WorkspaceRoute>}</Route>
    <Route path="/tasks">{() => <WorkspaceRoute><Tasks /></WorkspaceRoute>}</Route>
    <Route path="/settings">{() => <WorkspaceRoute><Settings /></WorkspaceRoute>}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-center" dir="rtl" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
