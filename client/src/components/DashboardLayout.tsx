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
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Calendar,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Settings,
  Shield,
  Upload,
  Users,
  Users2,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: Users2, label: "Crew", path: "/crew", adminOnly: true },
  { icon: Upload, label: "Import", path: "/import", adminOnly: true },
];

const bottomNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: Users2, label: "Crew", path: "/crew" },
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

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight">Wired Works</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">Welcome back</h1>
            <p className="text-sm text-muted-foreground text-center">
              Sign in to manage your crew, clients, and schedule.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            Sign in to continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

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

  const isAdmin = user?.role === "admin";
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

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

  const activeLabel = [...navItems, { label: "Settings", path: "/settings" }, { label: "Users", path: "/users" }, { label: "Import", path: "/import" }]
    .find((i) => i.path === location)?.label ?? "Wired Works";

  return (
    <>
      {/* ── Sidebar (desktop) ── */}
      {!isMobile && (
        <div className="relative" ref={sidebarRef}>
          <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" disableTransition={isResizing}>
            <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
              <div className="flex items-center gap-3 px-2">
                <button
                  onClick={toggleSidebar}
                  className="h-9 w-9 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                {!isCollapsed && (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-bold tracking-tight text-sm truncate">Wired Works</span>
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
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={isActive ? "text-foreground font-medium" : "text-sidebar-foreground"}>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>

              {/* Admin section */}
              {isAdmin && !isCollapsed && (
                <div className="px-4 pt-4 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Admin</p>
                </div>
              )}
              {isAdmin && (
                <SidebarMenu className="px-2 gap-0.5">
                  {[
                    { icon: Users2, label: "Users", path: "/users" },
                    { icon: Upload, label: "Import", path: "/import" },
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
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={isActive ? "text-foreground font-medium" : "text-sidebar-foreground"}>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarContent>

            <SidebarFooter className="p-3 border-t border-sidebar-border">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-8 w-8 border border-border shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-none">{user?.name || "User"}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                            {user?.role === "admin" ? <><Shield className="w-2.5 h-2.5 mr-0.5" />Admin</> : user?.role}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setLocation("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
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
          <div className="flex border-b border-border h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-bold tracking-tight text-sm">{activeLabel}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">{children}</main>

        {/* Mobile bottom nav */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
            <div className="flex items-center justify-around h-16 px-2">
              {bottomNavItems.filter(i => !i.path.startsWith("/crew") || isAdmin || user?.role === "crew").map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                    <span className="text-[10px] font-medium">{item.label}</span>
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
