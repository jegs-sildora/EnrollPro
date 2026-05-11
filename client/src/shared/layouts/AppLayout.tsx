import { useEffect, useState, memo, type ReactNode } from "react";
import type React from "react";
import { useNavigate, useLocation, Link, Outlet } from "react-router";
import { Toaster } from "sileo";
import {
  LayoutDashboard,
  FileSignature,
  ClipboardCheck,
  Users,
  Layers,
  Settings,
  History,
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  Calendar,
  Presentation,
  UserCog,
  Activity,
  ArrowUpRightSquare,
  UserPlus,
  School,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
import { cn, formatUserRole, getRoleColorClasses } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { PageTransition } from "@/shared/components/PageTransition";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

import { useWindowSize } from "react-use";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { AccessibilityMenu } from "@/shared/components/AccessibilityMenu";
import { useAccessibility } from "@/shared/hooks/useAccessibility";
import { NoSchoolYearState } from "@/features/settings/pages/curriculum/components/NoSchoolYearState";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

interface SchoolYearItem {
  id: number;
  yearLabel: string;
  status: string;
  isActive: boolean;
}

function UserNav() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-fit gap-2 px-2 rounded-lg border border-transparent transition-all">
            <Avatar className="h-7 w-7 border shadow-sm">
              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-col items-start text-left leading-tight hidden lg:flex">
              <span className="text-[11px] font-bold truncate max-w-[120px]">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="flex justify-start">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[8px] font-black uppercase px-1 h-3.5 border-none",
                    getRoleColorClasses(user?.role),
                  )}>
                  {formatUserRole(user?.role)}
                </Badge>
              </div>
            </div>
            <ChevronDown className="size-3 opacity-50 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56"
          align="end"
          forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-bold leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs leading-none text-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-bold text-xs"
            asChild>
            <Link to="/admin/users">
              <Settings className="mr-2 h-4 w-4" />
              Account Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-bold text-xs text-destructive focus:text-destructive"
            onClick={() => setShowLogoutConfirm(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        onConfirm={handleLogout}
        variant="primary"
      />
    </>
  );
}

function SYSwitcher() {
  const { activeSchoolYearId, viewingSchoolYearId, setViewingSY } =
    useSettingsStore();
  const [years, setYears] = useState<SchoolYearItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api
      .get("/school-years")
      .then((r) => setYears(r.data.years))
      .catch(() => {});
  }, []);

  const currentId = viewingSchoolYearId ?? activeSchoolYearId;
  const currentYear = years.find((y) => y.id === currentId);
  const currentLabel = currentYear?.yearLabel ?? "No School Year Set";
  const isOverride =
    viewingSchoolYearId && viewingSchoolYearId !== activeSchoolYearId;

  if (years.length === 0) return null;

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-bold transition-all duration-200 border-2",
                currentYear?.status === "ARCHIVED"
                  ? "border-slate-300 bg-slate-50"
                  : "border-border",
              )}
              onClick={() => setOpen(!open)}>
              <Calendar
                className={cn(
                  "size-3.5",
                  currentYear?.status === "ARCHIVED"
                    ? "text-slate-500"
                    : "text-primary",
                )}
              />
              <span
                className={cn(
                  isOverride ? "text-primary" : "",
                  currentYear?.status === "ARCHIVED" ? "text-slate-600" : "",
                )}>
                {currentLabel}
              </span>
              {currentYear?.status === "ARCHIVED" && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[8px] font-black uppercase bg-slate-200 text-slate-700 border-slate-300">
                  ARCHIVED
                </Badge>
              )}
              <ChevronsUpDown className="size-3 opacity-50" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
            Switch School Year
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-1 min-w-45 rounded-md border border-border bg-popover font-bold shadow-lg overflow-hidden">
            <div className="py-1">
              {years.map((y) => (
                <button
                  key={y.id}
                  onClick={() => {
                    setViewingSY(y.id === activeSchoolYearId ? null : y.id);
                    setOpen(false);
                    // Trigger a full reload to ensure all components re-fetch data
                    // using the new school year context header.
                    setTimeout(() => window.location.reload(), 50);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    y.id === currentId
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-sidebar-accent hover:text-accent-foreground"
                  }`}>
                  <span className="flex-1 text-left">{y.yearLabel}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.625rem] font-black uppercase",
                      y.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : y.status === "UPCOMING"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : y.status === "DRAFT"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : y.status === "ARCHIVED" ||
                                y.status === "BOSY_LOCKED"
                              ? "bg-slate-200 text-slate-800 border border-slate-300"
                              : "bg-gray-100 text-gray-800 border border-gray-200",
                    )}>
                    {y.status === "BOSY_LOCKED" ? "BOSY LOCKED" : y.status}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NavDivider = memo(function NavDivider({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 mt-2 transition-[margin,opacity,height] duration-200 ease-linear group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden">
      <span className="text-[0.625rem] font-bold uppercase  text-foreground opacity-60 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
});

const NavItem = memo(function NavItem({
  to,
  icon: Icon,
  label,
  pathname,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  pathname: string;
}) {
  const isActive =
    pathname === to || (to !== "/" && pathname.startsWith(to + "/"));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={label}>
        <Link to={to}>
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

const NavItemParent = memo(function NavItemParent({
  icon: Icon,
  label,
  children,
  defaultOpen = true,
  isActive = false,
}: {
  icon: React.ElementType;
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={label}
        onClick={() => setOpen((o) => !o)}
        isActive={isActive}>
        <Icon className="size-4" />
        <span>{label}</span>
        <ChevronDown
          className={`ml-auto size-3.5 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        />
      </SidebarMenuButton>
      {open && <ul className="mt-0.5 space-y-0.5">{children}</ul>}
    </SidebarMenuItem>
  );
});

const NavItemChild = memo(function NavItemChild({
  to,
  icon: Icon,
  label,
  pathname,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  pathname: string;
  badgeCount?: number;
}) {
  let isActive = pathname === to || pathname.startsWith(to + "/");

  // Monitoring (/monitoring/early-registration) should NOT highlight when Pipelines is active
  if (
    to === "/monitoring/early-registration" &&
    pathname.startsWith("/monitoring/early-registration/pipelines")
  ) {
    isActive = false;
  }

  // Basic Education Early Registration Form detail pages (/monitoring/early-registration/:id) should highlight Monitoring
  if (
    to === "/monitoring/early-registration" &&
    pathname.startsWith("/monitoring/early-registration/") &&
    !pathname.startsWith("/monitoring/early-registration/pipelines")
  ) {
    isActive = true;
  }

  // Enrollment BOSY (/monitoring/enrollment) should NOT highlight when EOSY is active
  if (
    to === "/monitoring/enrollment" &&
    pathname.startsWith("/monitoring/enrollment/eosy")
  ) {
    isActive = false;
  }

  // Enrollment detail routes (/monitoring/enrollment/* except EOSY) should highlight BOSY Registration
  if (
    to === "/monitoring/enrollment" &&
    pathname.startsWith("/monitoring/enrollment/") &&
    !pathname.startsWith("/monitoring/enrollment/eosy")
  ) {
    isActive = true;
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={label}
        className="pl-8 text-sm">
        <Link to={to}>
          <Icon className="size-3.5" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();
  const { schoolName, logoUrl } = useSettingsStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isAdmin = useAuthStore((s) => s.user?.role === "SYSTEM_ADMIN");
  const isHeadRegistrar = useAuthStore(
    (s) => s.user?.role === "HEAD_REGISTRAR",
  );
  const isRegistrar =
    useAuthStore((s) => s.user?.role === "REGISTRAR") || isHeadRegistrar;
  const pathname = location.pathname;

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        {/* ── Header: School Identity ── */}
        <SidebarHeader className="h-20 justify-center px-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="flex aspect-square size-9 items-center justify-center rounded-lg overflow-hidden shrink-0 border bg-white p-1">
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      alt="Logo"
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <School className="size-5 text-primary" />
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  {schoolName ? (
                    <span className="font-black leading-[1.1] uppercase  break-words text-primary">
                      {schoolName}
                    </span>
                  ) : (
                    <Skeleton className="h-4 w-28 my-0.5" />
                  )}
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* ── Navigation ── */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Items 1–7: shared between registrar role and SYSTEM_ADMIN */}
                {(isRegistrar || isAdmin) && (
                  <>
                    <NavDivider label="Operations" />
                    <NavItem
                      to="/dashboard"
                      icon={LayoutDashboard}
                      label="Dashboard"
                      pathname={pathname}
                    />

                    <NavItem
                      to="/monitoring/early-registration"
                      icon={FileSignature}
                      label="Early Registration"
                      pathname={pathname}
                    />

                    <NavItemParent
                      icon={ClipboardCheck}
                      label="Enrollment Operations"
                      isActive={
                        pathname.startsWith("/bosy") ||
                        pathname.startsWith("/monitoring/enrollment")
                      }>
                      <NavItemChild
                        to="/bosy"
                        icon={UserPlus}
                        label="BOSY Registration"
                        pathname={pathname}
                      />
                      <NavItemChild
                        to="/monitoring/enrollment"
                        icon={Calendar}
                        label="Enrollment"
                        pathname={pathname}
                      />
                      <NavItemChild
                        to="/monitoring/enrollment/eosy"
                        icon={ArrowUpRightSquare}
                        label="EOSY Updating"
                        pathname={pathname}
                      />
                    </NavItemParent>

                    <NavDivider label="Management" />
                    <NavItem
                      to="/students"
                      icon={Users}
                      label="Learner Directory"
                      pathname={pathname}
                    />
                    {isAdmin && (
                      <NavItem
                        to="/teachers"
                        icon={Presentation}
                        label="Teachers"
                        pathname={pathname}
                      />
                    )}
                    <NavItem
                      to="/sections"
                      icon={Layers}
                      label="Sections"
                      pathname={pathname}
                    />
                  </>
                )}

                {isAdmin && (
                  <>
                    <NavDivider label="System" />
                    <NavItem
                      to="/admin/users"
                      icon={UserCog}
                      label="User Management"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/audit-logs"
                      icon={History}
                      label="Audit Logs"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/admin/system"
                      icon={Activity}
                      label="System Health"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/settings"
                      icon={Settings}
                      label="Settings"
                      pathname={pathname}
                    />
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <ConfirmationModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        onConfirm={handleLogout}
        variant="primary"
      />
    </>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const {
    selectedAccentHsl,
    colorScheme,
    accentForeground,
    activeSchoolYearId,
    viewingSchoolYearId,
  } = useSettingsStore();
  const { width } = useWindowSize();
  const accentHsl =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;
  const location = useLocation();

  const isHistoricalReadOnly =
    viewingSchoolYearId !== null &&
    activeSchoolYearId !== null &&
    viewingSchoolYearId !== activeSchoolYearId;

  const selectedSchoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const isSchoolYearBypassRoute =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/admin/users") ||
    location.pathname.startsWith("/admin/system") ||
    location.pathname.startsWith("/settings");
  const shouldShowNoSchoolYearState =
    !isSchoolYearBypassRoute && !selectedSchoolYearId;

  const toastTheme = accentForeground === "0 0% 100%" ? "light" : "dark";
  const toastPosition = width < 768 ? "top-center" : "top-right";

  // Apply all accessibility settings to the DOM
  useAccessibility();

  return (
    <SidebarProvider className="relative">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="pixel-grid-app-layout"
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse">
              <rect
                x="2"
                y="2"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <rect
                x="42"
                y="2"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <rect
                x="2"
                y="42"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <rect
                x="42"
                y="42"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#pixel-grid-app-layout)"
          />
        </svg>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)",
          }}
        />
      </div>
      <AppSidebar />
      <SidebarInset style={{ backgroundColor: "transparent" }}>
        <Toaster
          position={toastPosition}
          theme={toastTheme}
          options={accentHsl ? { fill: `hsl(${accentHsl})` } : undefined}
        />

        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 h-4!"
          />
          <div className="flex items-center gap-2">
            {isHistoricalReadOnly ? (
              <Badge
                variant="danger"
                className="uppercase  animate-pulse">
                Historical View: Read Only
              </Badge>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <SYSwitcher />

            <div className="flex items-center gap-1 border-x px-3 h-8">
              <AccessibilityMenu />
            </div>

            <UserNav />
          </div>
        </header>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <PageTransition
            routeKey={location.pathname}
            className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden py-3 px-6 scrollbar-thin">
            {shouldShowNoSchoolYearState ? (
              <NoSchoolYearState />
            ) : (
              children || <Outlet />
            )}
          </PageTransition>
        </AnimatePresence>
      </SidebarInset>
    </SidebarProvider>
  );
}
