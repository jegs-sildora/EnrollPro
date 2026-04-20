import { useEffect, useState, type ReactNode } from "react";
import type React from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { Toaster } from "sileo";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle,
  Users,
  School,
  Settings,
  ScrollText,
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  Calendar,
  GraduationCap,
  Shield,
  Activity,
  Mail,
  AlertTriangle,
  CloudUpload,
  TrendingUp,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { motion, AnimatePresence } from "motion/react";

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
  const currentLabel =
    years.find((y) => y.id === currentId)?.yearLabel ?? "No School Year Set";
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
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => setOpen(!open)}>
              <Calendar className="size-3.5" />
              <span className={isOverride ? "text-destructive" : ""}>
                {currentLabel}
              </span>
              <ChevronsUpDown className="size-3 opacity-50" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Switch School Year</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-45 rounded-md border border-border bg-popover">
          {years.map((y) => (
            <button
              key={y.id}
              onClick={() => {
                setViewingSY(y.id === activeSchoolYearId ? null : y.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${
                y.id === currentId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-sidebar-accent hover:text-accent-foreground"
              }`}>
              <span className="flex-1 text-left">{y.yearLabel}</span>
              <span
                className={`rounded px-1 py-0.5 text-[0.625rem] font-medium ${
                  y.status === "ACTIVE"
                    ? "bg-green-100 text-green-700"
                    : y.status === "UPCOMING"
                      ? "bg-blue-100 text-blue-700"
                      : y.status === "DRAFT"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-500"
                }`}>
                {y.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavDivider({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 mt-2 transition-[margin,opacity,height] duration-200 ease-linear group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden">
      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground opacity-60 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

function NavItem({
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
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link to={to}>
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavItemParent({
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
}

function NavItemChild({
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
}

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { schoolName, logoUrl, activeSchoolYearId } = useSettingsStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeYearLabel, setActiveYearLabel] = useState<string | null>(null);

  const isAdmin = user?.role === "SYSTEM_ADMIN";
  const isRegistrar = user?.role === "REGISTRAR";
  const pathname = location.pathname;

  useEffect(() => {
    api
      .get("/school-years")
      .then((r) => {
        const found = r.data.years?.find(
          (y: SchoolYearItem) => y.id === activeSchoolYearId,
        );
        setActiveYearLabel(found?.yearLabel ?? null);
      })
      .catch(() => {});
  }, [activeSchoolYearId]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        {/* ── Header: School Identity ── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent cursor-default"
                tooltip={schoolName}>
                {logoUrl ? (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0">
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      alt="Logo"
                      className="size-8 object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted shrink-0">
                    <School className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
                  {schoolName ? (
                    <span className="truncate font-semibold">{schoolName}</span>
                  ) : (
                    <Skeleton className="h-3.5 w-28 my-0.5" />
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    {activeYearLabel ? (
                      <>
                        <span className="truncate text-[0.6875rem] text-foreground">
                          S.Y. {activeYearLabel}
                        </span>
                        <span className="shrink-0 text-[0.625rem] font-semibold text-green-600">
                          ● ACTIVE
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                        <span className="text-[0.6875rem] text-muted-foreground">
                          No Active Year
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* ── Navigation ── */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Items 1–7: shared between REGISTRAR and SYSTEM_ADMIN */}
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
                      icon={ClipboardList}
                      label="Early Registration"
                      pathname={pathname}
                    />

                    <NavItemParent
                      icon={CheckCircle}
                      label="Enrollment Operations"
                      isActive={false}>
                      <NavItemChild
                        to="/monitoring/enrollment"
                        icon={ClipboardList}
                        label="BOSY Registration"
                        pathname={pathname}
                      />
                      <NavItemChild
                        to="/monitoring/enrollment/eosy"
                        icon={TrendingUp}
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
                        icon={GraduationCap}
                        label="Teachers"
                        pathname={pathname}
                      />
                    )}
                    <NavItem
                      to="/sections"
                      icon={School}
                      label="Sections"
                      pathname={pathname}
                    />
                  </>
                )}

                {(isRegistrar || isAdmin) && (
                  <>
                    <NavDivider label="System" />
                    {isAdmin && (
                      <NavItem
                        to="/admin/users"
                        icon={Shield}
                        label="User Management"
                        pathname={pathname}
                      />
                    )}
                    {isAdmin && (
                      <NavItem
                        to="/admin/email-logs"
                        icon={Mail}
                        label="Email Logs"
                        pathname={pathname}
                      />
                    )}
                    <NavItem
                      to="/audit-logs"
                      icon={ScrollText}
                      label="Audit Logs"
                      pathname={pathname}
                    />
                    {isAdmin && (
                      <NavItem
                        to="/admin/atlas"
                        icon={CloudUpload}
                        label="ATLAS Sync"
                        pathname={pathname}
                      />
                    )}
                    {isAdmin && (
                      <NavItem
                        to="/admin/system"
                        icon={Activity}
                        label="System Health"
                        pathname={pathname}
                      />
                    )}
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

        {/* ── Footer: User ── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={
                  user?.firstName
                    ? `${user.firstName} ${user.lastName}`
                    : "User"
                }
                onClick={() => setShowLogoutConfirm(true)}
                className="relative">
                {/* Collapsed State: LogOut Icon only */}
                <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 opacity-0 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:scale-100 scale-75">
                  <LogOut className="size-4 text-muted-foreground" />
                </div>

                {/* Expanded State: Full Profile */}
                <div className="flex w-full items-center gap-2 transition-all duration-200 opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:pointer-events-none">
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground overflow-hidden">
                    <span className="text-xs font-semibold">
                      {user?.firstName?.charAt(0).toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
                    <span className="truncate font-semibold">
                      {user?.firstName} {user?.lastName}
                    </span>
                    {user?.role === "SYSTEM_ADMIN" && (
                      <Badge
                        variant="outline"
                        className="mt-0.5 w-fit h-4 px-1 text-[0.5625rem] font-bold border-purple-200 bg-purple-50 text-purple-700">
                        System Admin
                      </Badge>
                    )}
                    {user?.role === "REGISTRAR" && (
                      <Badge
                        variant="outline"
                        className="mt-0.5 w-fit h-4 px-1 text-[0.5625rem] font-bold border-accent bg-[hsl(var(--accent-muted))] text-accent">
                        Registrar
                      </Badge>
                    )}
                  </div>
                  <LogOut className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
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

export default function AppLayout({ children }: { children: ReactNode }) {
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
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
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
          <rect width="100%" height="100%" fill="url(#pixel-grid-app-layout)" />
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
          <Separator orientation="vertical" className="mr-2 h-4!" />
          <span className="text-sm font-medium text-muted-foreground"></span>
          {isHistoricalReadOnly ? (
            <Badge variant="danger" className="uppercase tracking-wide">
              Historical View: Read Only
            </Badge>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <AccessibilityMenu />
            <SYSwitcher />
          </div>
        </header>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-auto py-3 px-6 scrollbar-thin">
            {shouldShowNoSchoolYearState ? <NoSchoolYearState /> : children}
          </motion.main>
        </AnimatePresence>
      </SidebarInset>
    </SidebarProvider>
  );
}
