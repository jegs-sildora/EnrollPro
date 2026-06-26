import { useEffect, useState, memo, useCallback, type ReactNode } from "react";
import type React from "react";
import { useNavigate, useLocation, Link, Outlet } from "react-router";
import { Toaster } from "sileo";
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
  CheckCircle2,
  Menu,
} from "lucide-react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/shared/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";

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

interface NavBadge {
  label: string;
  className: string;
}

interface NavLinkItem {
  to: string;
  icon: React.ElementType;
  label: string;
  subtext?: string;
  badge?: NavBadge;
  urgent?: boolean;
}

interface NavGroup {
  label: string;
  badge?: NavBadge;
  items: NavLinkItem[];
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
              <p className="text-base font-bold leading-none">
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
            <Link to="/admin/users">
              <Settings className="mr-2 h-4 w-4" />
              Account Settings
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
              <Calendar className="text-gray-500 w-4 h-4" />
              <span className="text-sm font-bold text-gray-900">
                {currentLabel}
              </span>
              {renderStatusBadge(currentYear?.status)}
              <ChevronsUpDown className="text-gray-500 w-4 h-4" />
            </button>
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
            className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover font-bold shadow-lg overflow-hidden">
            <div className="py-2">
              <div className="text-sm font-bold text-slate-500 mb-2 px-2 uppercase tracking-wide">
                Current School Year
              </div>
              {currentAcademicYear ? (
                <button
                  key={currentAcademicYear.id}
                  onClick={() => handleSelectYear(currentAcademicYear)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
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

              <div className="text-sm font-bold text-slate-500 mb-2 px-2 uppercase tracking-wide">
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
                <div className="px-3 py-2 text-sm text-slate-500">No archived records available.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function renderNavBadge(badge: NavBadge | undefined) {
  if (!badge) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wide",
        badge.className,
      )}>
      {badge.label}
    </span>
  );
}

function isNavItemActive(to: string, pathname: string, search: string): boolean {
  const [targetPath, targetQuery] = to.split("?");

  if (targetQuery) {
    const targetParams = new URLSearchParams(targetQuery);
    const currentParams = new URLSearchParams(search);
    const targetTab = targetParams.get("tab");

    if (targetTab) {
      return pathname === targetPath && currentParams.get("tab") === targetTab;
    }

    return `${pathname}${search}` === to;
  }

  let isActive = pathname === targetPath;

  if (!isActive && targetPath !== "/") {
    if (targetPath === "/sections" && pathname.startsWith("/sections")) {
      isActive = false;
    } else if (
      targetPath === "/monitoring/enrollment" &&
      pathname.startsWith("/monitoring/enrollment/walk-in")
    ) {
      isActive = false;
    } else if (pathname.startsWith(`${targetPath}/`)) {
      isActive = true;
    }
  }

  if (targetPath === "/sections" && pathname.startsWith("/sections/view-roster")) {
    isActive = true;
  }

  if (targetPath === "/monitoring/enrollment" && pathname.startsWith("/eosy")) {
    isActive = false;
  }

  return isActive;
}

function getNavigationGroups({
  isAdmin,
  isRegistrar,
  isTeacher,
  systemPhase,
  isEosyArchivedState,
}: {
  isAdmin: boolean;
  isRegistrar: boolean;
  isTeacher: boolean;
  systemPhase: string | null | undefined;
  isEosyArchivedState: boolean;
}): NavGroup[] {
  const activeBadge: NavBadge = {
    label: "ACTIVE",
    className: "bg-emerald-500 text-white",
  };
  const classesOngoingBadge: NavBadge = {
    label: "CLASSES ONGOING",
    className: "bg-amber-500 text-white",
  };

  const officialEnrollmentBadge =
    systemPhase === "OFFICIAL_ENROLLMENT"
      ? activeBadge
      : systemPhase === "CLASSES_ONGOING"
        ? classesOngoingBadge
        : undefined;
  const closingOperationsBadge = systemPhase === "EOSY_CLOSING" ? activeBadge : undefined;
  const groups: NavGroup[] = [];

  if (isRegistrar || isAdmin) {
    const enrollmentItems: NavLinkItem[] = [
      {
        to: "/dashboard",
        icon: LayoutDashboard,
        label: "Master Dashboard",
      },
    ];

    if (
      systemPhase === "PRE_REGISTRATION" ||
      systemPhase === "OFFICIAL_ENROLLMENT" ||
      systemPhase === "BOSY_ENROLLMENT" ||
      !systemPhase
    ) {
      enrollmentItems.push(
        {
          to: "/continuing-learners",
          icon: UserPlus,
          label: "Continuing Learners",
        },
        {
          to: "/monitoring/enrollment",
          icon: Calendar,
          label: "Sectioning & SF1 Prep",
        },
      );
    }

    if (systemPhase === "CLASSES_ONGOING") {
      enrollmentItems.push(
        {
          to: "/monitoring/enrollment/walk-in",
          icon: UserPlus,
          label: "Late Enrollee Form",
        },
        {
          to: "/sections",
          icon: List,
          label: "Class Sections (SF1)",
        },
      );
    }

    if (systemPhase === "EOSY_CLOSING") {
      enrollmentItems.push(
        {
          to: "/sections",
          icon: List,
          label: "Class Sections (SF1)",
        },
        {
          to: "/eosy",
          icon: ArrowUpRightSquare,
          label: "EOSY Grade Finalization",
          urgent: true,
        },
      );
    }

    groups.push({
      label: "Enrollment & Sectioning",
      badge: !isEosyArchivedState
        ? systemPhase === "EOSY_CLOSING"
          ? closingOperationsBadge
          : officialEnrollmentBadge
        : undefined,
      items: enrollmentItems,
    });

    groups.push({
      label: "School Records",
      items: [
        {
          to: "/students",
          icon: Users,
          label: "Learner Registry",
        },
        ...(isAdmin
          ? [
            {
              to: "/teachers",
              icon: Presentation,
              label: "Faculty & Staff",
            },
          ]
          : []),
        {
          to: "/sections",
          icon: List,
          label: "Class Sections (SF1)",
        },
      ],
    });
  }

  if (isAdmin || isRegistrar || isTeacher) {
    groups.push({
      label: "Integrated Systems",
      items: [
        {
          to: "/smart",
          icon: CheckCircle2,
          label: "SMART",
          subtext: "Simplified Master Records and Tracking",
        },
      ],
    });
  }

  if (isAdmin) {
    groups.push({
      label: "System Administration",
      badge: isEosyArchivedState ? activeBadge : undefined,
      items: [
        {
          to: "/admin/users",
          icon: UserCog,
          label: "Account Access",
        },
        {
          to: "/audit-logs",
          icon: History,
          label: "Activity Logs",
        },
        {
          to: "/settings",
          icon: Settings,
          label: "System Configuration",
        },
      ],
    });
  }

  if (isTeacher) {
    groups.push({
      label: "Teacher Workspace",
      items: [
        {
          to: "/dashboard",
          icon: LayoutDashboard,
          label: "Dashboard",
        },
        {
          to: "/teacher/eosy",
          icon: ArrowUpRightSquare,
          label: "EOSY Updating",
        },
        {
          to: "/teacher/advisory",
          icon: Users,
          label: "My Advisory Class",
        },
        {
          to: "/students",
          icon: BookOpen,
          label: "Learner Directory",
        },
      ],
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

function NavBrand({
  schoolName,
  logoUrl,
  workspaceName,
}: {
  schoolName: string | null | undefined;
  logoUrl: string | null | undefined;
  workspaceName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        <div className="flex aspect-square size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
          <img
            src={`${API_BASE}${logoUrl}`}
            alt="School logo"
            className="size-full object-contain"
          />
        </div>
      ) : (
        <div className="flex aspect-square size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <School className="size-5 text-primary" />
        </div>
      )}
      <div className="grid min-w-0 text-left leading-tight">
        {schoolName ? (
          <span className="text-sm font-black uppercase leading-[1.1] text-primary sm:text-base md:text-lg tracking-tight">
            {schoolName}
          </span>
        ) : (
          <Skeleton className="my-0.5 h-4 w-36" />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">
          {workspaceName || "School Records Workspace"}
        </span>
      </div>
    </div>
  );
}

function NavLinkContent({
  item,
  isActive,
}: {
  item: NavLinkItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <>
      <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-slate-500")} />
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="truncate font-black leading-tight">{item.label}</span>
          {item.urgent ? <span className="size-2 shrink-0 rounded-full bg-rose-500" /> : null}
          {renderNavBadge(item.badge)}
        </span>
        {item.subtext ? (
          <span className="line-clamp-2 text-left text-[11px] font-semibold leading-tight text-foreground">
            {item.subtext}
          </span>
        ) : null}
      </span>
    </>
  );
}

const DesktopTopNavigation = memo(function DesktopTopNavigation({
  groups,
  pathname,
  search,
}: {
  groups: NavGroup[];
  pathname: string;
  search: string;
}) {
  const { selectedAccentHsl, colorScheme } = useSettingsStore();
  const accentHsl =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;

  return (
    <NavigationMenu
      viewport={false}
      className="hidden min-w-0 flex-1 justify-start xl:flex">
      <NavigationMenuList className="justify-start gap-1">
        {groups.map((group) => {
          const hasActiveItem = group.items.some((item) => isNavItemActive(item.to, pathname, search));

          return (
            <NavigationMenuItem key={group.label}>
              <NavigationMenuTrigger
                className={cn(
                  "gap-1.5 rounded-md px-3 text-sm font-black text-foreground",
                  hasActiveItem && "bg-primary/10 text-primary",
                )}
                style={
                  hasActiveItem && accentHsl
                    ? { color: `hsl(${accentHsl})` }
                    : undefined
                }>
                <span>{group.label}</span>
                {renderNavBadge(group.badge)}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="min-w-80 p-2">
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const isActive = isNavItemActive(item.to, pathname, search);

                    return (
                      <NavigationMenuLink
                        key={item.to}
                        asChild
                        active={isActive}
                        className={cn(
                          "min-h-11 rounded-md px-3 py-2",
                          isActive && "bg-primary/10 text-primary",
                        )}>
                        <Link to={item.to}>
                          <NavLinkContent
                            item={item}
                            isActive={isActive}
                          />
                        </Link>
                      </NavigationMenuLink>
                    );
                  })}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
});

function MobileNavLinks({
  groups,
  pathname,
  search,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  search: string;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section
          key={group.label}
          className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[11px] font-black uppercase tracking-wide text-foreground">
              {group.label}
            </h3>
            {renderNavBadge(group.badge)}
          </div>
          <div className="grid gap-1">
            {group.items.map((item) => {
              const isActive = isNavItemActive(item.to, pathname, search);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "text-slate-700 hover:border-slate-200 hover:bg-slate-50",
                  )}>
                  <NavLinkContent
                    item={item}
                    isActive={isActive}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MobileNavigationDrawer({
  groups,
  pathname,
  search,
  schoolName,
  logoUrl,
  workspaceName,
}: {
  groups: NavGroup[];
  pathname: string;
  search: string;
  schoolName: string | null | undefined;
  logoUrl: string | null | undefined;
  workspaceName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="xl:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open main navigation menu">
        <Menu className="size-5" />
      </Button>
      <SheetContent
        side="left"
        className="flex w-[86vw] max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle className="sr-only">Main Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Open school records, enrollment, and account areas.
          </SheetDescription>
          <NavBrand
            schoolName={schoolName}
            logoUrl={logoUrl}
            workspaceName={workspaceName}
          />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <MobileNavLinks
            groups={groups}
            pathname={pathname}
            search={search}
            onNavigate={() => setOpen(false)}
          />
        </div>
        <div className="space-y-4 border-t border-border p-4">
          <SYSwitcher />
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm font-bold text-slate-700">Accessibility</span>
            <AccessibilityMenu />
          </div>
          <UserNav />
        </div>
      </SheetContent>
    </Sheet>
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
    moduleName: "EOSY Grade Finalization",
    redirectTo: "/dashboard",
    redirectLabel: "Take me to Dashboard"
  }
};

function formatPhaseName(phase: string | null): string {
  if (!phase) return "Unknown Phase";
  const map: Record<string, string> = {
    PRE_REGISTRATION: "Pre-Registration",
    OFFICIAL_ENROLLMENT: "Official Enrollment",
    BOSY_ENROLLMENT: "BOSY Enrollment",
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
    systemStatus,
    schoolName,
    logoUrl,
  } = useSettingsStore();
  const { width } = useWindowSize();
  const accentHsl =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;
  const location = useLocation();
  const navigate = useNavigate();
  const userRoles = useAuthStore((s) => s.user?.roles);
  const isAdmin = userRoles?.includes("SYSTEM_ADMIN") ?? false;
  const isHeadRegistrar = userRoles?.includes("HEAD_REGISTRAR") ?? false;
  const isRegistrar = (userRoles?.includes("REGISTRAR") ?? false) || isHeadRegistrar;
  const isTeacher =
    (userRoles?.includes("TEACHER") ?? false) || (userRoles?.includes("MRF") ?? false);
  const isEosyArchivedState = systemStatus === "ARCHIVED";
  const navGroups = getNavigationGroups({
    isAdmin,
    isRegistrar,
    isTeacher,
    systemPhase,
    isEosyArchivedState,
  });

  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const activeGroup = navGroups.find(group =>
    group.items.some(item => isNavItemActive(item.to, location.pathname, location.search))
  );
  const activeWorkspaceName = activeGroup ? `${activeGroup.label} Workspace` : "School Records Workspace";

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
    location.pathname.startsWith("/admin/users") ||
    location.pathname.startsWith("/admin/system") ||
    location.pathname.startsWith("/settings") ||
    // BOSY rollover always targets the active year — intentional bypass
    location.pathname === "/continuing-learners" ||
    // Walk-in encoder is a direct mutation flow — intentional bypass
    location.pathname === "/monitoring/enrollment/walk-in";
  const shouldShowNoSchoolYearState =
    !isSchoolYearBypassRoute && !selectedSchoolYearId;

  const toastTheme = accentForeground === "0 0% 100%" ? "light" : "dark";
  const toastPosition = width < 768 ? "top-center" : "top-right";

  // Apply all accessibility settings to the DOM
  useAccessibility();

  return (
    <div className="relative flex h-svh w-full flex-col overflow-hidden bg-background">
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

      <Toaster
        position={toastPosition}
        theme={toastTheme}
        options={accentHsl ? { fill: `hsl(${accentHsl})` } : undefined}
      />

      <header
        className={cn(
          "sticky top-0 z-40 flex flex-col border-b border-border/60 bg-background/85 backdrop-blur-md",
          isHistoricalReadOnly ? "bg-muted/85" : "",
        )}>
        {/* Tier 1: Brand and Global Controls */}
        <div className="flex min-h-16 w-full items-center justify-between gap-4 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNavigationDrawer
              groups={navGroups}
              pathname={location.pathname}
              search={location.search}
              schoolName={schoolName}
              logoUrl={logoUrl}
              workspaceName={activeWorkspaceName}
            />
            <NavBrand
              schoolName={schoolName}
              logoUrl={logoUrl}
              workspaceName={activeWorkspaceName}
            />
          </div>

          {/* Right Side Actions - Desktop */}
          <div className="ml-auto hidden shrink-0 items-center gap-4 lg:flex">
            {isHistoricalReadOnly ? (
              <Badge
                variant="outline"
                className="uppercase text-foreground border-border">
                Historical View
              </Badge>
            ) : null}

            <SYSwitcher />

            <div className="flex h-8 items-center gap-1 border-x px-3">
              <AccessibilityMenu />
            </div>

            <UserNav />
          </div>

          {/* Right Side Actions - Mobile */}
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
            {isHistoricalReadOnly ? (
              <Badge
                variant="outline"
                className="uppercase text-foreground border-border">
                Historical View
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Tier 2: Desktop Navigation Bar */}
        <div className="hidden w-full items-center border-t border-border/45 bg-slate-50/40 dark:bg-slate-900/40 px-4 py-1.5 xl:flex">
          <DesktopTopNavigation
            groups={navGroups}
            pathname={location.pathname}
            search={location.search}
          />
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <HistoricalBanner
          onOpenCorrectionModal={() => setShowCorrectionModal(true)}
        />
        <HistoricalCorrectionModal
          open={showCorrectionModal}
          onOpenChange={setShowCorrectionModal}
        />

        <AnimatePresence mode="wait">
          <PageTransition
            routeKey={location.pathname}
            className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden py-3 px-4 scrollbar-thin">
            {shouldShowNoSchoolYearState ? (
              <NoSchoolYearState />
            ) : (
              children || <Outlet />
            )}
          </PageTransition>
        </AnimatePresence>
      </main>

      <Dialog open={showBlockedModal} onOpenChange={(open) => { if (!open) handleConfirmRedirect(); }}>
        <DialogContent className="sm:max-w-[420px] text-center p-6 bg-white rounded-xl shadow-lg border border-border">
          <DialogHeader className="flex flex-col items-center">
            <DialogTitle className="text-xl font-black text-rose-600 tracking-wide uppercase flex items-center gap-1.5">
              [Module Out of Season]
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-base font-bold text-slate-800 leading-tight">
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
    </div>
  );
}
