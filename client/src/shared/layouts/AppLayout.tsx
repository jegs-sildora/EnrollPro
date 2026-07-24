import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, memo, useCallback, type ReactNode } from "react";
import type React from "react";
import { useNavigate, useLocation, Link, useOutlet } from "react-router";
import { Toaster, sileo } from "sileo";
import {
  LayoutDashboard,
  Users,
  Settings,
  History,
  LogOut,
  ChevronsUpDown,
  Calendar,
  Presentation,
  ArrowUpRightSquare,
  List,
  UserPlus,
  School,
  Check,
  BookOpen,
  Database,
  CheckCircle2,
  CalendarClock,
  Wrench,
  CircleHelp,
  KeyRound,
  UserRound,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Separator } from "@/shared/ui/separator";
import { cn, formatUserRole } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import { useHeaderStore } from "@/store/header.slice";
import { resolvePageTitle } from "@/shared/hooks/usePageTitle";
import api from "@/shared/api/axiosInstance";
import { PageTransition } from "@/shared/components/PageTransition";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

const useWindowSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
};

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { AccessibilityMenu } from "@/shared/components/AccessibilityMenu";
import { useAccessibility } from "@/shared/hooks/useAccessibility";
import { NoSchoolYearState } from "@/shared/components/NoSchoolYearState";
import { HistoricalBanner } from "../components/HistoricalBanner";
import { useHistoricalReadOnly } from "../hooks/useHistoricalReadOnly";
import { HistoricalCorrectionModal } from "../components/HistoricalCorrectionModal";
import { SchoolYearTransitionLoader } from "@/shared/components/SchoolYearTransitionLoader";
import { PhaseBanner } from "@/shared/components/PhaseBanner";
import { useRealtimeInvalidations } from "@/shared/hooks/useRealtimeInvalidations";
import { useUnsavedChangesPrompt } from "@/shared/hooks/useUnsavedChanges";

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
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const canOpenPersonnelProfile =
    user?.roles?.includes("SYSTEM_ADMIN") ||
    user?.roles?.includes("HEAD_REGISTRAR");

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network/logout failures and clear local session regardless.
    }
    clearAuth();
    navigate("/staff/login");
  };

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "U";
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Signed-in User";
  const roleLabel = formatUserRole(user?.roles?.[0]);
  const employeeLabel = user?.employeeId
    ? `ID ${user.employeeId}`
    : "Employee ID not set";

  const navigateWithGuard = (destination: string) => {
    confirmOrRun(() => navigate(destination));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            tooltip="Account menu"
            className="h-14 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
              {initials}
            </div>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-black uppercase">{displayName}</span>
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {roleLabel}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-72 rounded-lg"
          side="right"
          align="end"
          sideOffset={8}
          forceMount>
          <DropdownMenuLabel className="px-3 py-3 font-normal">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
                {initials}
              </div>
              <div className="grid min-w-0 flex-1 gap-1 text-left">
                <p className="truncate text-sm font-black uppercase leading-none">
                  {displayName}
                </p>
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {roleLabel}
                </p>
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {employeeLabel}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canOpenPersonnelProfile && user?.employeeId ? (
            <DropdownMenuItem
              className="cursor-pointer py-2 font-bold"
              onSelect={() =>
                navigateWithGuard(
                  `/teachers?employeeId=${encodeURIComponent(user.employeeId ?? "")}`,
                )
              }>
              <UserRound className="mr-2 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="cursor-pointer py-2 font-bold"
            onSelect={() => navigateWithGuard("/my-activity")}>
            <History className="mr-2 h-4 w-4" />
            My Activity Log
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer py-2 font-bold"
            onSelect={() => navigateWithGuard("/help")}>
            <CircleHelp className="mr-2 h-4 w-4" />
            Help & Documentation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer py-2 font-bold"
            onSelect={() => navigateWithGuard("/change-password")}>
            <KeyRound className="mr-2 h-4 w-4" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer py-2 font-bold text-destructive focus:bg-destructive focus:text-destructive-foreground"
            onSelect={() => setShowLogoutConfirm(true)}>
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
  const {
    activeSchoolYearId,
    activeSchoolYearLabel,
    viewingSchoolYearId,
    triggerSchoolYearSwitch,
  } = useSettingsStore();
  const { hasOverride } = useHistoricalReadOnly();
  const [years, setYears] = useState<SchoolYearItem[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchYears = useCallback(async () => {
    setIsLoading(true);
    try {
      const r = await api.get("/school-years");
      setYears(r.data.years);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchYears();
  }, [activeSchoolYearId, fetchYears]);

  // Also fetch when opened to ensure fresh data (e.g. after rollover in another tab)
  useEffect(() => {
    if (open) {
      void fetchYears();
    }
  }, [open, fetchYears]);

  const currentId = viewingSchoolYearId ?? activeSchoolYearId;
  const currentYear = years.find((y) => y.id === currentId);
  const currentLabel = currentYear?.yearLabel ?? "No School Year Set";
  const currentAcademicYear = years.find((y) => y.id === activeSchoolYearId) ?? null;
  const archivedYears = years.filter((y) => y.status === "ARCHIVED");

  const getStatusBadgeMeta = (status?: string | null) => {
    if (status === "ARCHIVED") {
      return {
        label: "ARCHIVED",
        className: "bg-slate-100 text-slate-600",
      };
    }

    return {
      label: "ACTIVE",
      className: "bg-green-100 text-green-800",
    };
  };

  const renderStatusBadge = (status?: string | null) => {
    const badge = getStatusBadgeMeta(status);
    return (
      <span
        className={cn(
          "inline-flex px-2 py-0.5 text-xs font-black uppercase tracking-wider whitespace-nowrap rounded-md",
          badge.className,
        )}>
        {badge.label}
      </span>
    );
  };

  const handleSelectYear = (y: SchoolYearItem) => {
    if (hasOverride) {
      useSettingsStore.getState().setHistoricalCorrectionToken(null);
    }
    setOpen(false);
    const targetId = y.id === activeSchoolYearId ? null : y.id;
    const targetStatus = y.id === activeSchoolYearId ? null : y.status;
    const targetLabel = y.id === activeSchoolYearId ? activeSchoolYearLabel : y.yearLabel;
    triggerSchoolYearSwitch(targetId, targetStatus, targetLabel);
  };

  // Don't return null if initialized but empty, show the "No School Year Set" button
  // unless there are absolutely no years in the database and we are not in an active year.
  if (years.length === 0 && !isLoading && !activeSchoolYearId) return null;

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 bg-muted border border-gray-300 shadow-sm rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setOpen(!open)}>
              <Calendar className="text-foreground w-4 h-4" />
              <span className="text-sm sm:text-sm text-foreground whitespace-nowrap font-extrabold">
                {currentLabel}
              </span>
              <div className="hidden md:block">
                {renderStatusBadge(currentYear?.status)}
              </div>
              <ChevronsUpDown className="text-foreground w-4.5 h-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 text-base text-primary-foreground">
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
            className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover font-bold shadow-lg overflow-hidden">
            <div className="py-2">
              <div className="text-sm font-bold text-foreground mb-2 px-2 uppercase tracking-wide">
                Current School Year
              </div>
              {currentAcademicYear ? (
                <button
                  key={currentAcademicYear.id}
                  onClick={() => {
                    if (currentAcademicYear.id !== currentId) {
                      handleSelectYear(currentAcademicYear);
                    }
                  }}
                  disabled={currentAcademicYear.id === currentId}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 transition-colors",
                    currentAcademicYear.id === currentId
                      ? "bg-slate-100 font-bold text-slate-900 cursor-default"
                      : "hover:bg-slate-50 text-slate-700",
                  )}>
                  <span className="w-4 text-slate-600">
                    {currentAcademicYear.id === currentId ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                  </span>
                  <span className="flex-1 text-left">{currentAcademicYear.yearLabel}</span>
                  {renderStatusBadge(currentAcademicYear.status)}
                </button>
              ) : (
                <div className="px-3 py-2 text-sm text-slate-500">No active academic year found.</div>
              )}

              <div className="border-b border-slate-100 my-2" />

              <div className="text-sm font-bold text-foreground mb-2 px-2 uppercase tracking-wide">
                Archived School Years
              </div>
              {archivedYears.length > 0 ? (
                archivedYears.map((y) => (
                  <button
                    key={y.id}
                    onClick={() => {
                      if (y.id !== currentId) {
                        handleSelectYear(y);
                      }
                    }}
                    disabled={y.id === currentId}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 transition-colors",
                      y.id === currentId
                        ? "bg-slate-50 font-bold text-foreground cursor-default"
                        : "hover:bg-slate-50",
                    )}>
                    <span className="w-4 text-slate-600">
                      {y.id === currentId ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="flex-1 text-left">{y.yearLabel}</span>
                    {renderStatusBadge(y.status)}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-foreground">No archived school years available.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NavDivider = memo(function NavDivider({ label, badge }: { label: string; badge?: React.ReactNode }) {
  return (
    <div className="px-3 py-2 mt-2 transition-[margin,opacity,height] duration-300 ease-in-out group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold uppercase text-foreground whitespace-nowrap">
          {label}
        </span>
        {badge}
      </div>
    </div>
  );
});

const NavItem = memo(function NavItem({
  to,
  icon: Icon,
  label,
  subtext,
  pathname,
}: {
  to: string;
  icon: React.ElementType;
  label: ReactNode;
  subtext?: string;
  pathname: string;
}) {
  const { selectedAccentHsl } = useSettingsStore();
  const navigate = useNavigate();
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const accentHsl = selectedAccentHsl;

  const handleNavigationClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      confirmOrRun(() => navigate(to));
    },
    [confirmOrRun, navigate, to],
  );

  let isActive = pathname === to;

  if (!isActive && to !== "/") {
    if (to === "/sections" && pathname.startsWith("/sections")) {
      isActive = false;
    } else if (pathname.startsWith(to + "/")) {
      isActive = true;
    }
  }

  if (
    to === "/sections" &&
    pathname.startsWith("/sections/view-masterlist")
  ) {
    isActive = true;
  }

  // Surgical exclusion for EOSY updating overlapping with Sectioning & Masterlists
  if (
    to === "/monitoring/enrollment" &&
    pathname.startsWith("/eosy")
  ) {
    isActive = false;
  }

  return (
    <SidebarMenuItem className="relative">
      {isActive && (
        <span
          className="absolute left-1 top-2 bottom-2 w-[3px] rounded-full z-20"
          style={{ backgroundColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))" }}
        />
      )}
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={typeof label === "string" ? label : undefined}>
        <Link to={to} onClick={handleNavigationClick}>
          <Icon className="size-4 shrink-0" />
          <div className="flex flex-col items-start justify-center overflow-hidden w-full">
            <span className={cn("truncate w-full text-left leading-tight", isActive && "font-bold")}>{label}</span>
            {subtext && <span className="text-sm font-normal truncate w-full text-left leading-tight">{subtext}</span>}
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

function AppSidebar() {
  const location = useLocation();
  const { schoolName, logoUrl, systemStatus, systemPhase } = useSettingsStore();
  const isEosyArchivedState = systemStatus === "ARCHIVED";
  const isAdmin = useAuthStore((s) => s.user?.roles?.includes("SYSTEM_ADMIN"));
  const isHeadRegistrar = useAuthStore(
    (s) => s.user?.roles?.includes("HEAD_REGISTRAR"),
  );
  const isRegistrar = isHeadRegistrar;
  const isTeacher = useAuthStore(
    (s) => s.user?.roles?.includes("TEACHER") || s.user?.roles?.includes("MRF"),
  );
  const pathname = location.pathname;

  return (
    <Sidebar collapsible="icon">
        {/* ΓöÇΓöÇ Header: School Identity ΓöÇΓöÇ */}
        <SidebarHeader className="h-20 justify-center transition-all duration-300 ease-in-out group-data-[state=expanded]:px-4 group-data-[state=collapsed]:px-1.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center transition-all duration-300 ease-in-out group-data-[state=expanded]:gap-3 group-data-[state=collapsed]:gap-0 group-data-[state=collapsed]:justify-center">
                {logoUrl ? (
                  <div className="flex aspect-square size-9 items-center justify-center rounded-lg overflow-hidden shrink-0 border bg-muted p-1">
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
                <div className="grid flex-1 text-left leading-tight overflow-hidden transition-all duration-100 ease-in-out group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:m-0">
                  {schoolName ? (
                    <span className="font-black leading-[1.1] uppercase text-primary block text-wrap">
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

        {/* ΓöÇΓöÇ Navigation ΓöÇΓöÇ */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Items 1ΓÇô7: shared between registrar role and SYSTEM_ADMIN */}
                {(isRegistrar || isAdmin) && (
                  <>
                    <NavDivider
                      label={
                        systemPhase === "CLASSES_ONGOING"
                          ? "ACTIVE SCHOOL OPERATIONS"
                          : systemPhase === "EOSY_CLOSING"
                            ? "END OF SCHOOL YEAR PROCESSING"
                            : "ENROLLMENT AND SECTIONING"
                      }
                    />
                    <NavItem
                      to="/dashboard"
                      icon={LayoutDashboard}
                      label="Master Dashboard"
                      pathname={pathname}
                    />

                    {(systemPhase === "OFFICIAL_ENROLLMENT" || systemPhase === "CLASSES_ONGOING" || !systemPhase) && (
                      <>
                        <NavItem
                          to="/continuing-learners"
                          icon={UserPlus}
                          label="Learner Enrollment"
                          pathname={pathname}
                        />
                        <NavItem
                          to="/monitoring/enrollment"
                          icon={Calendar}
                          label="Class Sectioning and SF1"
                          pathname={pathname}
                        />
                      </>
                    )}

                    {systemPhase === "EOSY_CLOSING" && (
                      <>

                        <NavItem
                          to="/eosy"
                          icon={ArrowUpRightSquare}
                          label={
                            <div className="flex items-center justify-between w-full">
                              <span>EOSY Updating</span>
                            </div>
                          }
                          pathname={pathname}
                        />
                      </>
                    )}

                    <NavDivider label="School Records" />
                    <NavItem
                      to="/students"
                      icon={Users}
                      label="Learner Registry"
                      pathname={pathname}
                    />
                    {isAdmin && (
                      <NavItem
                        to="/teachers"
                        icon={Presentation}
                        label="Personnel Directory"
                        pathname={pathname}
                      />
                    )}
                    <NavItem
                      to="/sections"
                      icon={List}
                      label="Class Sections (SF1)"
                      pathname={pathname}
                    />
                  </>
                )}

                {isAdmin && (
                  <>
                    <NavDivider label="Integrated Systems" />
                    <NavItem
                      to="/admin/integration?tab=aims"
                      icon={Database}
                      label="AIMS"
                      subtext="Academic Info"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/admin/integration?tab=smart"
                      icon={CheckCircle2}
                      label="SMART"
                      subtext="Simplified Master Records and Tracking"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/admin/integration?tab=atlas"
                      icon={CalendarClock}
                      label="ATLAS"
                      subtext="Automated Teaching and Learning Assessment System"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/admin/integration?tab=mrf"
                      icon={Wrench}
                      label="MRF"
                      subtext="Maintenance Requests"
                      pathname={pathname}
                    />

                    <NavDivider label="System Administration" />
                    <NavItem
                      to="/audit-logs"
                      icon={History}
                      label="Activity Logs"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/settings"
                      icon={Settings}
                      label="System Configuration"
                      pathname={pathname}
                    />
                  </>
                )}

                {isTeacher && (
                  <>
                    <NavDivider label="Operations" />
                    <NavItem
                      to="/dashboard"
                      icon={LayoutDashboard}
                      label="Dashboard"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/teacher/eosy"
                      icon={ArrowUpRightSquare}
                      label="EOSY Updating"
                      pathname={pathname}
                    />

                    <NavDivider label="Management" />
                    <NavItem
                      to="/teacher/advisory"
                      icon={Users}
                      label="My Advisory Class"
                      pathname={pathname}
                    />
                    <NavItem
                      to="/students"
                      icon={BookOpen}
                      label="Learner Directory"
                      pathname={pathname}
                    />
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserNav />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
  );
}

const ROUTE_PHASES: Record<string, {
  allowedPhases: string[];
  moduleName: string;
  redirectTo: string;
  redirectLabel: string;
}> = {
  "/continuing-learners": {
    allowedPhases: ["OFFICIAL_ENROLLMENT", "CLASSES_ONGOING"],
    moduleName: "Learner Enrollment",
    redirectTo: "/monitoring/enrollment",
    redirectLabel: "Take me to Class Sectioning"
  },
  "/monitoring/enrollment": {
    allowedPhases: ["OFFICIAL_ENROLLMENT", "CLASSES_ONGOING"],
    moduleName: "Class Sectioning and SF1",
    redirectTo: "/sections",
    redirectLabel: "Take me to Class Sections"
  },
  "/monitoring/enrollment/walk-in": {
    allowedPhases: ["OFFICIAL_ENROLLMENT", "CLASSES_ONGOING"],
    moduleName: "Learner Enrollment",
    redirectTo: "/continuing-learners",
    redirectLabel: "Take me to Learner Enrollment"
  },
  "/eosy": {
    allowedPhases: ["EOSY_CLOSING"],
    moduleName: "EOSY Updating",
    redirectTo: "/dashboard",
    redirectLabel: "Take me to Dashboard"
  }
};

export default function AppLayout({ children }: { children?: ReactNode }) {
  useRealtimeInvalidations();

  const storeTitle = useHeaderStore((s) => s.title);
  const outlet = useOutlet();
  const {
    selectedAccentHsl,
    accentForeground,
    activeSchoolYearId,
    viewingSchoolYearId,
    systemPhase,
    isSwitchingSchoolYear,
    switchingToSchoolYearLabel,
  } = useSettingsStore();
  const { width } = useWindowSize();
  const accentHsl = selectedAccentHsl;
  const location = useLocation();
  const routeTransitionKey = `${location.pathname}${location.search}${location.hash}:${location.key}`;
  const defaultTitle = resolvePageTitle(location.pathname, location.search);
  const title = storeTitle || defaultTitle;
  const navigate = useNavigate();

  useEffect(() => {
    const handleRolloverComplete = () => {
      sileo.success({
        title: "New School Year Ready",
        description: "The new school year is active. The dashboard has been refreshed.",
      });
      navigate("/dashboard");
    };

    window.addEventListener("ROLLOVER_COMPLETE", handleRolloverComplete);
    return () => {
      window.removeEventListener("ROLLOVER_COMPLETE", handleRolloverComplete);
    };
  }, [navigate]);

  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  useEffect(() => {
    const currentPhase = systemPhase || "OFFICIAL_ENROLLMENT";
    const rule = ROUTE_PHASES[location.pathname];
    if (rule && !rule.allowedPhases.includes(currentPhase)) {
      navigate(rule.redirectTo, { replace: true });
    }
  }, [location.pathname, navigate, systemPhase]);

  const selectedSchoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const isSchoolYearBypassRoute =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/admin/system") ||
    location.pathname.startsWith("/settings") ||
    // BOSY rollover always targets the active year ΓÇö intentional bypass
    location.pathname === "/continuing-learners" ||
    // Walk-in encoder is a direct mutation flow ΓÇö intentional bypass
    location.pathname === "/monitoring/enrollment/walk-in";
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
        <header
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4 sticky top-0 z-40 backdrop-blur-md bg-background/80",
            isHistoricalReadOnly ? "bg-muted/80" : "",
          )}>
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 h-4!"
          />
          {title && (
            <h1 className="text-sm sm:text-base md:text-xl font-black text-foreground tracking-tight leading-none truncate max-w-[120px] sm:max-w-[240px] md:max-w-none mr-2 sm:mr-4 uppercase">
              {title}
            </h1>
          )}
          <div className="flex items-center gap-2">
            {isHistoricalReadOnly ? (
              <Badge
                variant="outline"
                className="uppercase text-foreground border-border">
                Historical View
              </Badge>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <SYSwitcher />

            <div className="hidden lg:flex items-center gap-1 border-x px-1.5 sm:px-3 h-8">
              <AccessibilityMenu />
            </div>

          </div>
        </header>

        <HistoricalBanner
          onOpenCorrectionModal={() => setShowCorrectionModal(true)}
        />
        <HistoricalCorrectionModal
          open={showCorrectionModal}
          onOpenChange={setShowCorrectionModal}
        />

        <PhaseBanner />

        {/* Page content */}
        <AnimatePresence mode="wait">
          <PageTransition
            key={routeTransitionKey}
            className="flex-1 flex flex-col min-w-0 py-3 px-4 sm:px-6">
            {shouldShowNoSchoolYearState ? (
              <NoSchoolYearState />
            ) : (
              children || outlet
            )}
          </PageTransition>
        </AnimatePresence>
      </SidebarInset>

      <AnimatePresence>
        {isSwitchingSchoolYear && (
          <SchoolYearTransitionLoader targetLabel={switchingToSchoolYearLabel} />
        )}
      </AnimatePresence>
    </SidebarProvider>
  );
}
