import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { BarChart3, Bell, Bot, Boxes, Building2, ChevronLeft, CircleUserRound, ClipboardList, FileChartColumn, HandCoins, LayoutDashboard, LogOut, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const navigation = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/", module: "dashboard" },
  { icon: UsersRound, label: "الموارد البشرية", path: "/hr", module: "hr" },
  { icon: HandCoins, label: "المالية والمحاسبة", path: "/finance", module: "finance" },
  { icon: Boxes, label: "المخزون والمستودعات", path: "/inventory", module: "inventory" },
  { icon: CircleUserRound, label: "علاقات العملاء", path: "/crm", module: "crm" },
  { icon: FileChartColumn, label: "التقارير", path: "/reports", module: "reports" },
  { icon: Bot, label: "مساعد HERP", path: "/assistant", module: "dashboard" },
  { icon: Settings, label: "الإدارة والصلاحيات", path: "/settings", module: "settings" },
] as const;

const roleLabels = { general_manager: "المدير العام", unit_manager: "مدير وحدة", employee: "موظف" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="herp-login min-h-screen px-6" dir="rtl">
        <div className="herp-login-card max-w-md text-center">
          <div className="mx-auto mb-7 flex size-16 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300"><Building2 className="size-8" /></div>
          <p className="mb-2 text-sm font-medium text-cyan-300">HERP · Enterprise Resource Planning</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">إدارة مؤسستك من مكان واحد</h1>
          <p className="mt-4 leading-7 text-slate-400">سجّل الدخول للوصول إلى مساحة عمل HERP الآمنة ومتابعة مؤشرات العمل والوحدات التشغيلية.</p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">تسجيل الدخول إلى HERP</Button>
        </div>
      </div>
    );
  }
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const context = trpc.herp.context.useQuery(undefined, { retry: false });
  const access = context.data?.workspace?.allowedModules ?? ["dashboard"];
  const role = context.data?.workspace?.memberRole;
  const visibleNavigation = navigation.filter((item) => item.module === "dashboard" || access.includes(item.module));
  const activeItem = visibleNavigation.find((item) => item.path === location);

  return (
    <SidebarProvider dir="rtl" className="min-h-screen bg-[#09111f] text-slate-100">
      <Sidebar side="right" collapsible="icon" className="border-l border-white/[0.06] bg-[#0d1728]">
        <SidebarHeader className="h-[84px] px-4 pt-5">
          <button onClick={() => setLocation("/")} className="flex w-full items-center gap-3 text-right transition-opacity hover:opacity-80">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.2)]"><Building2 className="size-5" /></div>
            <span className="group-data-[collapsible=icon]:hidden"><span className="block text-lg font-bold tracking-tight text-white">HERP</span><span className="block text-[10px] font-semibold tracking-[0.18em] text-cyan-300">OPERATING SYSTEM</span></span>
          </button>
        </SidebarHeader>
        <SidebarContent className="px-3 py-3">
          <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 group-data-[collapsible=icon]:hidden">وحدات المؤسسة</p>
          <SidebarMenu className="gap-1">
            {visibleNavigation.map((item) => {
              const isActive = location === item.path;
              return <SidebarMenuItem key={item.path}>
                <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className={`h-11 rounded-xl px-3 text-slate-400 transition-all hover:bg-white/[0.055] hover:text-slate-100 data-[active=true]:bg-cyan-400/[0.12] data-[active=true]:text-cyan-300 ${isActive ? "font-semibold" : ""}`}>
                  <item.icon className="size-[18px]" />
                  <span>{item.label}</span>
                  {isActive && <ChevronLeft className="mr-auto size-4 opacity-70 group-data-[collapsible=icon]:hidden" />}
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
          <div className="mx-2 mt-8 rounded-2xl border border-cyan-300/[0.1] bg-gradient-to-br from-cyan-400/[0.09] to-transparent p-3 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2 text-cyan-300"><Bot className="size-4" /><span className="text-xs font-semibold">مساعد HERP جاهز</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-400">اطلب تحليل مؤشراتك التشغيلية بلغة طبيعية.</p>
            <button onClick={() => setLocation("/assistant")} className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200">بدء محادثة ←</button>
          </div>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-white/[0.055] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                <Avatar className="size-9 border border-white/10"><AvatarFallback className="bg-slate-800 text-xs font-bold text-cyan-200">{user?.name?.slice(0, 1).toUpperCase() || "م"}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold text-slate-200">{user?.name || "مستخدم HERP"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{role ? roleLabels[role] : "جارٍ التحميل"}</p></div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56 border-white/10 bg-[#142033] text-slate-100">
              <DropdownMenuLabel className="text-right text-slate-400">حساب المستخدم</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer justify-start gap-2 text-right focus:bg-white/10 focus:text-white"><ShieldCheck className="size-4" />الإدارة والصلاحيات</DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer justify-start gap-2 text-right text-rose-300 focus:bg-rose-400/10 focus:text-rose-200"><LogOut className="size-4" />تسجيل الخروج</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#09111f]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-white/[0.06] bg-[#09111f]/85 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3"><SidebarTrigger className="rounded-xl text-slate-400 hover:bg-white/[0.06] hover:text-white" /><div><p className="text-xs font-medium text-slate-500">{context.data?.workspace?.organizationName || "مساحة عمل HERP"}</p><h2 className="text-sm font-semibold text-slate-100">{activeItem?.label || "HERP"}</h2></div></div>
          <div className="flex items-center gap-2"><button onClick={() => setLocation("/notifications")} className="relative flex size-10 items-center justify-center rounded-xl border border-white/[0.07] text-slate-400 transition-colors hover:border-cyan-300/20 hover:bg-white/[0.04] hover:text-cyan-200"><Bell className="size-[18px]" /><span className="absolute left-2 top-2 size-1.5 rounded-full bg-cyan-300" /></button><button onClick={() => setLocation("/tasks")} className="hidden items-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.04] sm:flex"><ClipboardList className="size-4 text-cyan-300" />المهام</button></div>
        </header>
        <main className="min-h-[calc(100vh-72px)] p-5 sm:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
