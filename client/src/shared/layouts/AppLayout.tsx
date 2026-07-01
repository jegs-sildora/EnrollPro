import { useEffect, useState, memo, useCallback, type ReactNode } from "react";
import type React from "react";
import { useNavigate, useLocation, Link, Outlet } from "react-router";
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
  UserCog,
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
import { Separator } from "@/shared/ui/separator";
import { cn, formatUserRole } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";

import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { PageTransition } from "@/shared/components/PageTransition";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-200 text-gray-700 font-bold text-sm">
              {initials}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-black text-gray-900">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="inline-flex mt-0.5 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap bg-gray-800 rounded-md">
                {formatUserRole(user?.roles?.[0])}
              </span>
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56"
          align="end"
          forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="font-bold leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm leading-none text-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-bold text-sm"
            asChild>
            <Link to="/change-password">
              <Settings className="mr-2 h-4 w-4" />
              Change Password
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-bold text-sm text-destructive focus:text-primary-foreground"
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
    if (status === "ENROLLMENT_OPEN") {
      return {
        label: "ENROLLMENT",
        className: "bg-blue-100 text-blue-700",
      };
    }

    if (status === "BOSY_LOCKED" || status === "ACTIVE") {
      return {
        label: "ACTIVE",
        className: "bg-green-100 text-green-800",
      };
    }

    if (status === "EOSY_PROCESSING") {
      return {
        label: "EOSY CLOSING",
        className: "bg-amber-100 text-amber-700",
      };
    }

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
          "inline-flex px-2 py-0.5 text-[11px] font-black uppercase tracking-wider whitespace-nowrap rounded-full",
          badge.className,
        )}>
        {badge.label}
      </span>
    );
  };

  const handleSelectYear = (y: SchoolYearItem) => {
    if (hasOverride) {
      sileo.error({
        title: "Historical Correction Active",
        description: "Please lock the historical session before switching school years.",
      });
      return;
    }
    setViewingSY(
      y.id === activeSchoolYearId ? null : y.id,
      y.id === activeSchoolYearId ? null : y.status,
      y.id === activeSchoolYearId ? null : y.yearLabel,
    );
    setOpen(false);
    // Trigger a full reload to ensure all components re-fetch data
    // using the new school year context header.
    setTimeout(() => window.location.reload(), 50);
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
              className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-300 shadow-sm rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setOpen(!open)}>
              <Calendar className="text-foreground w-4 h-4" />
              <span className="text-sm text-foreground whitespace-nowrap font-extrabold">
                {currentLabel}
              </span>
              {renderStatusBadge(currentYear?.status)}
              <ChevronsUpDown className="text-foreground w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 text-base "text-foreground>
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
                  onClick={() => handleSelectYear(currentAcademicYear)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 transition-colors",
                    currentAcademicYear.id === currentId
                      ? "bg-slate-100 font-bold text-slate-900"
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
                Archived Records
              </div>
              {archivedYears.length > 0 ? (
                archivedYears.map((y) => (
                  <button
                    key={y.id}
                    onClick={() => handleSelectYear(y)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                      y.id === currentId
                        ? "bg-slate-50 font-bold text-slate-900"
                        : "hover:bg-slate-50 text-slate-700",
                    )}>
                    <span className="w-4 text-slate-600">
                      {y.id === currentId ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="flex-1 text-left">{y.yearLabel}</span>
                    {renderStatusBadge(y.status)}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-foreground">No archived records available.</div>
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
        <span className="text-[0.625rem] font-bold uppercase  text-foreground opacity-60 whitespace-nowrap">
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
  const { selectedAccentHsl, colorScheme } = useSettingsStore();
  const accentHsl =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;

  let isActive = pathname === to;

  if (!isActive && to !== "/") {
    if (to === "/sections" && pathname.startsWith("/sections")) {
      isActive = false;
    } else if (to === "/monitoring/enrollment" && pathname.startsWith("/monitoring/enrollment/walk-in")) {
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
        <Link to={to}>
          <Icon className="size-4 shrink-0" />
          <div className="flex flex-col items-start justify-center overflow-hidden w-full">
            <span className={cn("truncate w-full text-left leading-tight", isActive && "font-bold")}>{label}</span>
            {subtext && <span className="text-[9px] font-normal opacity-70 truncate w-full text-left leading-tight">{subtext}</span>}
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();
  const { schoolName, logoUrl, systemStatus, systemPhase } = useSettingsStore();
  const isEosyArchivedState = systemStatus === "ARCHIVED";
  const activeBadge = <span className="text-[0.5rem] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-white uppercase tracking-wide whitespace-nowrap shrink-0">ACTIVE</span>;
  let officialEnrollmentBadge;
  if (systemPhase === "OFFICIAL_ENROLLMENT") {
    officialEnrollmentBadge = <span className="text-[0.5rem] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-white uppercase tracking-wide whitespace-nowrap shrink-0">BOSY Enrollment</span>;
  } else if (systemPhase === "CLASSES_ONGOING") {
    officialEnrollmentBadge = <span className="text-[0.5rem] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wide whitespace-nowrap shrink-0">REGULAR OPERATIONS</span>;
  }

  let closingOperationsBadge;
  if (systemPhase === "EOSY_CLOSING") {
    closingOperationsBadge = <span className="text-[0.5rem] font-black px-1.5 py-0.5 rounded bg-slate-600 text-white uppercase tracking-wide whitespace-nowrap shrink-0">EOSY ARCHIVING</span>;
  }
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isAdmin = useAuthStore((s) => s.user?.roles?.includes("SYSTEM_ADMIN"));
  const isHeadRegistrar = useAuthStore(
    (s) => s.user?.roles?.includes("HEAD_REGISTRAR"),
  );
  const isRegistrar =
    useAuthStore((s) => s.user?.roles?.includes("REGISTRAR")) || isHeadRegistrar;
  const isTeacher = useAuthStore(
    (s) => s.user?.roles?.includes("TEACHER") || s.user?.roles?.includes("MRF"),
  );
  const pathname = location.pathname;

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network/logout failures and clear local session regardless.
    }
    clearAuth();
    navigate("/staff/login");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        {/* ΓöÇΓöÇ Header: School Identity ΓöÇΓöÇ */}
        <SidebarHeader className="h-20 justify-center transition-all duration-300 ease-in-out group-data-[state=expanded]:px-4 group-data-[state=collapsed]:px-1.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center transition-all duration-300 ease-in-out group-data-[state=expanded]:gap-3 group-data-[state=collapsed]:gap-0 group-data-[state=collapsed]:justify-center">
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
                      label="ENROLLMENT & SECTIONING"
                      badge={
                        !isEosyArchivedState
                          ? (systemPhase === "EOSY_CLOSING" ? closingOperationsBadge : officialEnrollmentBadge)
                          : undefined
                      }
                    />
                    <NavItem
                      to="/dashboard"
                      icon={LayoutDashboard}
                      label="Master Dashboard"
                      pathname={pathname}
                    />

                    {(systemPhase === "PRE_REGISTRATION" || systemPhase === "OFFICIAL_ENROLLMENT" || systemPhase === "BOSY_ENROLLMENT" || !systemPhase) && (
                      <>
                        <NavItem
                          to="/continuing-learners"
                          icon={UserPlus}
                          label="Continuing Learners"
                          pathname={pathname}
                        />
                        <NavItem
                          to="/monitoring/enrollment"
                          icon={Calendar}
                          label="Sectioning & SF1 Prep"
                          pathname={pathname}
                        />
                      </>
                    )}

                    {systemPhase === "CLASSES_ONGOING" && (
                      <>
                        <NavItem
                          to="/monitoring/enrollment/walk-in"
                          icon={UserPlus}
                          label="Late Enrollee Form"
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
                              <span>EOSY Promotion Update</span>
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
                        label="Faculty & Staff"
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

                    <NavDivider label="System Administration" badge={isEosyArchivedState ? activeBadge : undefined} />
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

const ROUTE_PHASES: Record<string, {
  allowedPhases: string[];
  moduleName: string;
  redirectTo: string;
  redirectLabel: string;
}> = {
  "/continuing-learners": {
    allowedPhases: ["PRE_REGISTRATION", "BOSY_ENROLLMENT", "OFFICIAL_ENROLLMENT"],
    moduleName: "Continuing Learners",
    redirectTo: "/monitoring/enrollment/walk-in",
    redirectLabel: "Take me to Late Admissions"
  },
  "/monitoring/enrollment": {
    allowedPhases: ["PRE_REGISTRATION", "BOSY_ENROLLMENT", "OFFICIAL_ENROLLMENT"],
    moduleName: "Sectioning & SF1 Prep",
    redirectTo: "/sections",
    redirectLabel: "Take me to Class Sections"
  },
  "/monitoring/enrollment/walk-in": {
    allowedPhases: ["PRE_REGISTRATION", "BOSY_ENROLLMENT", "OFFICIAL_ENROLLMENT", "CLASSES_ONGOING"],
    moduleName: "Late Enrollee Intake",
    redirectTo: "/dashboard",
    redirectLabel: "Take me to Dashboard"
  },
  "/eosy": {
    allowedPhases: ["EOSY_CLOSING"],
    moduleName: "EOSY Promotion Update",
    redirectTo: "/dashboard",
    redirectLabel: "Take me to Dashboard"
  }
};

function formatPhaseName(phase: string | null): string {
  if (!phase) return "Unknown Phase";
  const map: Record<string, string> = {
    PRE_REGISTRATION: "Pre-Registration",
    OFFICIAL_ENROLLMENT: "BOSY Enrollment Active",
    BOSY_ENROLLMENT: "BOSY Enrollment Active",
    CLASSES_ONGOING: "Classes Ongoing",
    EOSY_CLOSING: "EOSY Closing"
  };
  return map[phase] ?? phase;
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const {
    selectedAccentHsl,
    colorScheme,
    accentForeground,
    activeSchoolYearId,
    viewingSchoolYearId,
    systemPhase,
  } = useSettingsStore();
  const { width } = useWindowSize();
  const accentHsl =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;
  const location = useLocation();
  const navigate = useNavigate();

  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const [lastSafePath, setLastSafePath] = useState("/dashboard");
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<{
    moduleName: string;
    activePhase: string;
    redirectTo: string;
    redirectLabel: string;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  useEffect(() => {
    const currentPhase = systemPhase || "OFFICIAL_ENROLLMENT";
    const rule = ROUTE_PHASES[location.pathname];
    if (rule && !rule.allowedPhases.includes(currentPhase)) {
      setBlockedInfo({
        moduleName: rule.moduleName,
        activePhase: currentPhase,
        redirectTo: rule.redirectTo,
        redirectLabel: rule.redirectLabel
      });
      setShowBlockedModal(true);
      // Immediately stop from loading: push back to last safe route
      navigate(lastSafePath, { replace: true });
    } else {
      setLastSafePath(location.pathname);
    }
  }, [location.pathname, systemPhase, navigate, lastSafePath]);

  useEffect(() => {
    if (!showBlockedModal) return;
    setRedirectCountdown(3);

    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowBlockedModal(false);
          navigate(blockedInfo?.redirectTo || "/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showBlockedModal, blockedInfo, navigate]);

  const handleConfirmRedirect = () => {
    setShowBlockedModal(false);
    navigate(blockedInfo?.redirectTo || "/dashboard");
  };

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
          <div className="flex items-center gap-2">
            {isHistoricalReadOnly ? (
              <Badge
                variant="outline"
                className="uppercase text-foreground border-border">
                Historical View
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

        <HistoricalBanner
          onOpenCorrectionModal={() => setShowCorrectionModal(true)}
        />
        <HistoricalCorrectionModal
          open={showCorrectionModal}
          onOpenChange={setShowCorrectionModal}
        />

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

      <Dialog open={showBlockedModal} onOpenChange={(open) => { if (!open) handleConfirmRedirect(); }}>
        <DialogContent className="sm:max-w-[420px] text-center p-6 bg-white rounded-xl shadow-lg border border-border">
          <DialogHeader className="flex flex-col items-center">
            <DialogTitle className="text-xl font-black text-rose-600 tracking-wide uppercase flex items-center gap-1.5">
              [Module Out of Season]
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="font-bold text-slate-800 leading-tight">
              The {blockedInfo?.moduleName} module is closed.
            </p>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              The active school phase is currently set to <span className="font-bold text-slate-700">{formatPhaseName(blockedInfo?.activePhase ?? null)}</span>.
            </p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-rose-500 transition-all duration-1000"
                style={{ width: `${(redirectCountdown / 3) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Auto-redirecting in {redirectCountdown}s...
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={handleConfirmRedirect}
              className="w-full h-10 font-bold uppercase tracking-wide bg-rose-600 hover:bg-rose-700 text-white border-none shadow-none">
              {blockedInfo?.redirectLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
