import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Bell,
  Calendar,
  CalendarDays,
  FolderOpen,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  PanelLeft,
  Phone,
  Settings,
  Shield,
  Sun,
  Truck,
  Upload,
  Users,
  Users2,
  Zap,
  Mail,
  TrendingUp,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { useTheme } from "../contexts/ThemeContext";
import { trpc } from "../lib/trpc";
import { ScrollArea } from "./ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

// Nav shown to admin/user roles
const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: FolderOpen, label: "Projects", path: "/projects" },
  { icon: Bell, label: "Follow-Ups", path: "/follow-ups" },
  { icon: TrendingUp, label: "Sales Pipeline", path: "/sales-pipeline" },
  { icon: Truck, label: "Van Inventory", path: "/van-inventory" },
  { icon: Phone, label: "Communications", path: "/communications" },
  { icon: History, label: "Activity Log", path: "/activity-log" },
];

// Nav shown exclusively to crew role
const crewNavItems = [
  { icon: CalendarDays, label: "My Schedule", path: "/crew-home" },
  { icon: Calendar, label: "Calendar", path: "/crew-calendar" },
  { icon: FolderOpen, label: "Projects", path: "/crew-projects" },
  { icon: Users, label: "Clients", path: "/crew-clients" },
  { icon: Truck, label: "Van Inventory", path: "/van-inventory" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const adminBottomNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: FolderOpen, label: "Projects", path: "/projects" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const crewBottomNavItems = [
  { icon: CalendarDays, label: "Schedule", path: "/crew-home" },
  { icon: Calendar, label: "Calendar", path: "/crew-calendar" },
  { icon: FolderOpen, label: "Projects", path: "/crew-projects" },
  { icon: Users, label: "Clients", path: "/crew-clients" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // No login wall — app is accessible without authentication.
  // Show skeleton only during the brief auth check, then render regardless.
  if (loading) return <DashboardLayoutSkeleton />;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isCrew = user?.role === "crew";
  const isAdmin = user?.role === "admin" || user?.role === "user";
  const visibleNav = isCrew ? crewNavItems : adminNavItems;
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();
  const { data: notifData } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: notifications = [] } = trpc.notifications.list.useQuery(undefined, { refetchInterval: 30_000 });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.unreadCount.invalidate() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => { utils.notifications.unreadCount.invalidate(); utils.notifications.list.invalidate(); } });
  const unreadCount = notifData?.count ?? 0;
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const allNavItems = [
    ...adminNavItems, ...crewNavItems,
    { label: "Settings", path: "/settings" },
    { label: "Users", path: "/users" },
    { label: "Import", path: "/import" },
  ];
  const activeLabel = allNavItems.find((i) => i.path === location)?.label ?? "Wired Works";

  return (
    <>
      {/* ── Sidebar (desktop) ── */}
      {!isMobile && (
        <div className="relative" ref={sidebarRef}>
          <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" disableTransition={isResizing}>
            <SidebarHeader className="h-28 justify-center border-b border-sidebar-border">
              <div className="flex items-center gap-3 px-2">
                <button
                  onClick={toggleSidebar}
                  className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4 text-white/70" />
                </button>
                {!isCollapsed && (
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663534371359/gYJ9uUE9i5ygur2GefRATd/wired-works-logo_d2ca4ec2.png"
                      alt="Wired Works"
                      className="w-auto object-contain"
                      style={{ filter: "brightness(0) invert(1)", height: "96px" }}
                    />
                  </div>
                )}
              </div>
            </SidebarHeader>

            <SidebarContent className="gap-0 py-3">
              <SidebarMenu className="px-2 gap-0.5">
                {visibleNav.map((item) => {
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-10 transition-all font-normal rounded-lg"
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-white/60"}`} />
                        <span className={isActive ? "text-white font-semibold" : "text-white/75"}>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>

              {/* Admin section */}
              {!isCrew && !isCollapsed && (
                <div className="px-4 pt-4 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Admin</p>
                </div>
              )}
              {!isCrew && (
                <SidebarMenu className="px-2 gap-0.5">
                  {[
                    { icon: Users2, label: "Users", path: "/users" },
                    { icon: Upload, label: "Import", path: "/import" },
                    { icon: TrendingUp, label: "Commission", path: "/commission" },
                    { icon: Settings, label: "Settings", path: "/settings" },
                  ].map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-10 transition-all font-normal rounded-lg"
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-white/60"}`} />
                          <span className={isActive ? "text-white font-semibold" : "text-white/75"}>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarContent>

            <SidebarFooter className="p-3 border-t border-sidebar-border">
              {/* Notification Bell — desktop */}
              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="relative flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors w-full text-left focus:outline-none mb-1">
                    <div className="relative h-8 w-8 flex items-center justify-center shrink-0">
                      <Bell className="h-5 w-5 text-white/80" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <span className="text-sm text-white/75">Notifications</span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-80 p-0" sideOffset={8}>
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={() => markAllRead.mutate()} className="text-xs text-muted-foreground hover:text-foreground">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <ScrollArea className="max-h-80">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className={`w-full text-left px-3 py-2.5 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.isRead ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                          onClick={() => { if (!n.isRead) markRead.mutate({ id: n.id }); }}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                            {n.isRead && <span className="mt-1.5 w-2 h-2 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{n.title}</p>
                              {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                              <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-8 w-8 border border-border shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-white/20 text-white">{initials}</AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-none text-white">{user?.name || "User"}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge className="text-[10px] px-1.5 py-0 h-4 capitalize bg-white/15 text-white/80 border-0 hover:bg-white/15">
                            {user?.role === "admin" ? <><Shield className="w-2.5 h-2.5 mr-0.5" />Admin</> : user?.role}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={toggleTheme}>
                    {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user ? (
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => window.location.href = "/login"}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </Sidebar>

          {/* Resize handle */}
          {!isCollapsed && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors"
              style={{ zIndex: 50 }}
              onMouseDown={() => setIsResizing(true)}
            />
          )}
        </div>
      )}

      <SidebarInset className={isMobile ? "pb-16" : ""}>
        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex h-14 items-center justify-between px-4 sticky top-0 z-40" style={{ background: "var(--sidebar)" }}>
            <div className="flex items-center gap-2">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663534371359/gYJ9uUE9i5ygur2GefRATd/wired-works-logo_d2ca4ec2.png"
                alt="Wired Works"
                className="h-8 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/80">{activeLabel}</span>
              {/* Notification Bell */}
              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="relative focus:outline-none p-1">
                    <Bell className="h-5 w-5 text-white/80" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={() => markAllRead.mutate()} className="text-xs text-muted-foreground hover:text-foreground">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <ScrollArea className="max-h-80">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className={`w-full text-left px-3 py-2.5 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.isRead ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                          onClick={() => { if (!n.isRead) markRead.mutate({ id: n.id }); }}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                            {n.isRead && <span className="mt-1.5 w-2 h-2 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{n.title}</p>
                              {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                              <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none">
                    <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarFallback className="text-xs font-semibold bg-white/20 text-white">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setLocation("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user ? (
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => window.location.href = "/login"}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">{children}</main>

        {/* Mobile bottom nav */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border" style={{ background: "var(--sidebar)" }}>
            <div className="flex items-center justify-around h-16 px-2">
              {(isCrew ? crewBottomNavItems : adminBottomNavItems).map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                      isActive ? "text-white" : "text-white/50"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "text-yellow-300" : ""}`} />
                    <span className={`text-[10px] font-medium ${isActive ? "text-yellow-300" : ""}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </SidebarInset>
    </>
  );
}
