import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardList,
  Users,
  CheckCircle,
  AlertTriangle,
  UserCog,
  Activity,
  FileText,
  FileCheck,
  TrendingUp,
  TrendingDown,
  Lock,
  Archive,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { cn } from "@/shared/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

interface Stats {
  totalPending: number;
  totalEnrolled: number;
  totalPreRegistered: number;
  sectionsAtCapacity: number;
  previousYearTotal?: number;
  unsectionedCount?: number;
  actions?: {
    pendingReview: number;
    sectionsAtCapacity: number;
  };
  enrollmentTarget?: {
    current: number;
    target: number;
    seatsRemaining: number;
    progressPercent: number;
  };
  earlyRegistration?: {
    submitted: number;
    verified: number;
    pendingDocuments?: number;
    examScheduled?: number;
    readyForEnrollment?: number;
    enrolled?: number;
    inPipeline?: number;
    total: number;
  };
  gradeLevelBreakdown?: Array<{
    id: number;
    name: string;
    current: number;
    target: number;
    forecastedTarget?: number;
    progressPercent: number;
  }>;
  capacityAlerts?: Array<{
    message: string;
    severity: "WARNING" | "CRITICAL";
    currentEnrolled?: number;
    maxCapacity?: number;
    sectionName?: string;
    gradeLevel?: string;
  }>;
}

interface AdminStats {
  activeUsers: number;
  usersByRole: Record<string, number>;
  emailDeliveryRate: string;
  systemStatus: string;
}

type FocusOverride = "AUTO" | "EARLY" | "ENROLLMENT";
type FocusMode = "EARLY" | "ENROLLMENT" | "BALANCED";

const ACTION_THRESHOLDS = {
  pendingReview: 15,
  sectionsAtCapacity: 2,
};

function formatMetric(value: number): string {
  return Number(value || 0).toLocaleString("en-PH");
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    enrollmentPhase,
    systemStatus,
    activeSchoolYearId,
    viewingSchoolYearId,
  } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { ayLabel, isViewingOverride, viewingStatus } = useSchoolYearContext();
  const isAdmin = user?.role === "SYSTEM_ADMIN";
  const isBosyLocked = systemStatus === "BOSY_LOCKED";

  const [stats, setStats] = useState<Stats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusOverride, setFocusOverride] = useState<FocusOverride>("AUTO");

  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, adminRes] = await Promise.all([
          api.get("/dashboard/stats"),
          isAdmin
            ? api.get("/admin/dashboard/stats")
            : Promise.resolve({ data: null }),
        ]);

        setStats(statsRes.data.stats);
        if (adminRes.data) setAdminStats(adminRes.data);
      } catch {
        setStats({
          totalPending: 0,
          totalEnrolled: 0,
          totalPreRegistered: 0,
          sectionsAtCapacity: 0,
          actions: {
            pendingReview: 0,
            sectionsAtCapacity: 0,
          },
          enrollmentTarget: {
            current: 0,
            target: 0,
            seatsRemaining: 0,
            progressPercent: 0,
          },
          earlyRegistration: {
            submitted: 0,
            verified: 0,
            examScheduled: 0,
            readyForEnrollment: 0,
            enrolled: 0,
            inPipeline: 0,
            total: 0,
          },
          gradeLevelBreakdown: [],
          capacityAlerts: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin, ayId]);

  const autoFocus = useMemo<FocusMode>(() => {
    if (enrollmentPhase === "EARLY_REGISTRATION") {
      return "EARLY";
    }

    if (
      enrollmentPhase === "REGULAR_ENROLLMENT" ||
      enrollmentPhase === "OVERRIDE"
    ) {
      return "ENROLLMENT";
    }

    return "BALANCED";
  }, [enrollmentPhase]);

  const effectiveFocus: FocusMode =
    focusOverride === "AUTO" ? autoFocus : focusOverride;
  const isEnrollmentExpanded = effectiveFocus !== "EARLY";
  const isEarlyRegistrationExpanded = effectiveFocus !== "ENROLLMENT";

  const pendingReviewCount =
    stats?.actions?.pendingReview ?? stats?.totalPending ?? 0;
  const pendingReviewAlert =
    pendingReviewCount >= ACTION_THRESHOLDS.pendingReview;

  const enrollmentCurrent =
    stats?.enrollmentTarget?.current ?? stats?.totalEnrolled ?? 0;
  const enrollmentTarget = stats?.enrollmentTarget?.target ?? 0;
  const enrollmentProgress =
    stats?.enrollmentTarget?.progressPercent ??
    (enrollmentTarget > 0
      ? Number(((enrollmentCurrent / enrollmentTarget) * 100).toFixed(1))
      : 0);

  const leslPipeline = [
    {
      title: "Encoded (BEEF)",
      value: stats?.earlyRegistration?.submitted ?? 0,
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50",
      tooltip: "Forms entered into the system",
    },
    {
      title: "Pending Documents",
      value:
        stats?.earlyRegistration?.pendingDocuments ??
        stats?.earlyRegistration?.inPipeline ??
        0,
      icon: ClipboardList,
      color: "text-orange-600",
      bg: "bg-orange-50",
      tooltip: "Awaiting PSA Birth Certificate or SF9",
    },
    {
      title: "Verified",
      value: stats?.earlyRegistration?.verified ?? 0,
      icon: FileCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
      tooltip: "Documents cleared",
    },
    {
      title: "Ready for Sectioning",
      value: stats?.earlyRegistration?.readyForEnrollment ?? 0,
      icon: CheckCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
      tooltip: "Confirmed for BOSY — awaiting homeroom assignment",
    },
  ];

  const adminCards = [
    {
      title: "Active Users",
      value: adminStats?.activeUsers ?? 0,
      description: `${(adminStats?.usersByRole["HEAD_REGISTRAR"] ?? 0) + (adminStats?.usersByRole["REGISTRAR"] ?? 0)} Registrars | ${adminStats?.usersByRole["TEACHER"] || 0} Teachers`,
      icon: UserCog,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "System Status",
      value: adminStats?.systemStatus === "OK" ? "Healthy" : "Error",
      description: "Database & Core Services",
      icon: Activity,
      color:
        adminStats?.systemStatus === "OK" ? "text-green-600" : "text-red-600",
      bg: adminStats?.systemStatus === "OK" ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      {isBosyLocked && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg border-2 border-emerald-400/30">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase  leading-none">
                BOSY Locked ({ayLabel})
              </p>
              <p className="text-xs font-bold text-emerald-100 mt-1">
                System is currently processing Late Enrollees only via Inline
                Slotting.
              </p>
            </div>
          </div>
          <Badge className="bg-white text-emerald-700 font-black hover:bg-white uppercase ">
            Academic Phase
          </Badge>
        </motion.div>
      )}

      {isViewingOverride && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-100 border-2 border-slate-300 text-slate-700 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-slate-500" />
            <p className="text-sm font-black uppercase">
              Viewing Historical Data &middot; S.Y. {ayLabel}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-slate-400 text-slate-600 font-black uppercase">
            {viewingStatus ?? "ARCHIVED"}
          </Badge>
        </motion.div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-foreground font-bold">
            Welcome back,{" "}
            <span className="font-bold text-primary">
              {user?.firstName} {user?.lastName}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex flex-col items-start gap-1 md:items-end">
            <p className="text-xs font-bold uppercase  text-foreground">
              Seasonal Focus
            </p>
            <div
              className="inline-flex rounded-lg border bg-card p-1 shadow-sm relative"
              role="group"
              aria-label="Command center seasonal focus">
              {(["AUTO", "EARLY", "ENROLLMENT"] as const).map((mode) => {
                const selected = focusOverride === mode;

                return (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFocusOverride(mode)}
                    className={cn(
                      "relative h-7 px-3 text-xs font-black uppercase transition-all z-10",
                      selected
                        ? "text-primary-foreground hover:text-primary-foreground hover:bg-transparent"
                        : "text-foreground hover:text-foreground",
                    )}>
                    {selected && (
                      <motion.div
                        layoutId="dashboard-seasonal-focus-pill"
                        className="absolute inset-0 bg-primary rounded-md"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.5,
                        }}
                      />
                    )}
                    <span className="relative z-20">{mode}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Enrollment Progress (Top Priority) ── */}
      <section
        className="space-y-4"
        aria-label="Enrollment progress">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-black uppercase  text-emerald-600">
            Enrollment Progress ({ayLabel})
          </h2>
          <div className="h-px flex-1 bg-emerald-100/50"></div>
        </div>

        <AnimatePresence mode="wait">
          {isEnrollmentExpanded ? (
            <motion.div
              key="enrollment-expanded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-4 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm border-2">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-xs font-black uppercase text-emerald-900/40">
                      Growth Indicator
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 h-5 px-1.5 text-xs font-black uppercase er">
                      School-Wide
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {showSkeleton ? (
                    <>
                      <Skeleton className="h-10 w-44" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-64" />
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-black text-emerald-700 tabular-nums">
                            {formatMetric(enrollmentCurrent)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-emerald-900/50 uppercase">
                          Total Enrolled · SY {ayLabel}
                        </p>
                      </div>

                      {/* Growth vs prior SY */}
                      {(() => {
                        const prev = stats?.previousYearTotal ?? null;
                        if (!prev || prev === 0) {
                          return (
                            <p className="text-xs font-bold text-slate-400 uppercase">
                              No prior SY data
                            </p>
                          );
                        }
                        const delta = enrollmentCurrent - prev;
                        const pct = ((delta / prev) * 100).toFixed(1);
                        const positive = delta >= 0;
                        return (
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-black text-sm",
                              positive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700",
                            )}>
                            {positive ? (
                              <TrendingUp className="h-4 w-4 shrink-0" />
                            ) : (
                              <TrendingDown className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              {positive ? "+" : ""}
                              {pct}% vs prior SY ({formatMetric(prev)})
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-8 border-slate-200 bg-white shadow-sm flex flex-col">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-xs font-black uppercase text-foreground">
                    Forecast vs. Actual Enrollment
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6 flex-1">
                  {showSkeleton ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="space-y-3">
                          <div className="flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                          <Skeleton className="h-2 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                      {stats?.gradeLevelBreakdown?.map((gl) => {
                        const forecast = gl.forecastedTarget ?? gl.target;
                        const fillPct = forecast > 0
                          ? clampProgress((gl.current / forecast) * 100)
                          : 0;
                        return (
                        <div
                          key={gl.id}
                          className="space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-black uppercase text-slate-700">
                              {gl.name}
                            </span>
                            <span className="text-xs font-black text-emerald-700 tabular-nums">
                              {formatMetric(gl.current)} / {formatMetric(forecast)} Forecasted
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner border border-slate-200/50">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${fillPct}%` }}
                              transition={{
                                duration: 1,
                                ease: "easeOut",
                                delay: 0.2,
                              }}
                              className="h-full rounded-full bg-emerald-500"
                            />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">
                            Forecast Fill Rate — {fillPct.toFixed(0)}%
                          </p>
                        </div>
                        );
                      })}
                      {(!stats?.gradeLevelBreakdown ||
                        stats.gradeLevelBreakdown.length === 0) && (
                        <div className="col-span-full py-8 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase ">
                            No Grade Level Data Available
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="enrollment-collapsed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}>
              <Card className="border-slate-200 bg-white shadow-sm border-l-4 border-l-emerald-500">
                <CardHeader className="py-3 px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black ">
                        Enrollment Summary
                      </CardTitle>
                      <CardDescription className="text-xs font-bold er">
                        Collapsed for Early Registration Focus
                      </CardDescription>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">
                          Enrolled
                        </p>
                        <p className="text-lg font-black text-emerald-600">
                          {formatMetric(enrollmentCurrent)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">
                          Utilization
                        </p>
                        <p className="text-lg font-black text-emerald-600">
                          {enrollmentProgress.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Action Queues ── */}
      <section
        className="space-y-4"
        aria-label="Action queues">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-black uppercase text-slate-500/80">
            Action Queues
          </h2>
          <div className="h-px flex-1 bg-slate-100"></div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Card 1 — Pending Verifications (always visible) */}
          <Card
            className={cn(
              "shadow-sm transition-all hover:shadow-md border-2",
              pendingReviewAlert
                ? "border-amber-400 bg-amber-50/30"
                : "border-slate-200 bg-white",
            )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black text-foreground">
                  {effectiveFocus === "ENROLLMENT"
                    ? "Pending BOSY Verifications"
                    : "Pending Verifications"}
                </CardTitle>
                <div
                  className={cn(
                    "rounded-lg p-2",
                    pendingReviewAlert ? "bg-amber-100" : "bg-slate-100",
                  )}>
                  <ClipboardList
                    className={cn(
                      "h-4 w-4",
                      pendingReviewAlert ? "text-amber-700" : "text-slate-600",
                    )}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {showSkeleton ? (
                <>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-44" />
                </>
              ) : (
                <>
                  <div className="text-5xl font-black tabular-nums">
                    {formatMetric(pendingReviewCount)}
                  </div>
                  <p className="text-xs font-bold text-foreground min-h-[2rem] leading-relaxed">
                    {effectiveFocus === "ENROLLMENT"
                      ? "Basic Education Enrollment Forms (BEEF) requiring SF9 and physical PSA validation."
                      : pendingReviewAlert
                        ? "Review queue has reached critical volume. Registrar intervention required."
                        : "Process is stable. Review queue is performing within established parameters."}
                  </p>
                </>
              )}

              <Button
                type="button"
                className="w-full font-black uppercase text-xs h-10"
                variant={pendingReviewAlert ? "default" : "outline"}
                onClick={() =>
                  navigate(
                    "/monitoring/enrollment?workflow=PENDING_VERIFICATION",
                  )
                }>
                {pendingReviewCount > 0
                  ? `Review ${formatMetric(pendingReviewCount)} Applications`
                  : "Open Verification Queue"}
              </Button>
            </CardContent>
          </Card>

          {/* Cards 2 & 3 — hidden in EARLY mode (sectioning hasn't started) */}
          {effectiveFocus !== "EARLY" && (
            <>
              {/* Card 2 — Overcrowded Sections */}
              {(() => {
                // A section is overcrowded only when it STRICTLY exceeds its
                // maximum capacity (currentEnrolled > maxCapacity).
                // Sections sitting exactly at capacity (e.g. 35/35) are NOT overcrowded.
                const overcrowded =
                  stats?.capacityAlerts?.filter((a) =>
                    a.currentEnrolled !== undefined && a.maxCapacity !== undefined
                      ? a.currentEnrolled > a.maxCapacity
                      : a.severity === "CRITICAL",
                  ) ?? [];
                const hasOvercrowded = overcrowded.length > 0;

                const overcrowdedMessage = (alert: NonNullable<Stats["capacityAlerts"]>[number]) => {
                  if (
                    alert.currentEnrolled !== undefined &&
                    alert.maxCapacity !== undefined
                  ) {
                    const label =
                      alert.gradeLevel && alert.sectionName
                        ? `${alert.gradeLevel} '${alert.sectionName}'`
                        : alert.sectionName ?? "Section";
                    return `${label} is OVERCROWDED (${alert.currentEnrolled}/${alert.maxCapacity})`;
                  }
                  return alert.message;
                };

                return (
                  <Card
                    className={cn(
                      "shadow-sm transition-all hover:shadow-md border-2",
                      hasOvercrowded
                        ? "border-destructive bg-destructive/5"
                        : "border-slate-200 bg-white",
                    )}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-black text-foreground">
                          Overcrowded Sections
                        </CardTitle>
                        <div
                          className={cn(
                            "rounded-lg p-2",
                            hasOvercrowded ? "bg-red-100" : "bg-slate-100",
                          )}>
                          <AlertTriangle
                            className={cn(
                              "h-4 w-4",
                              hasOvercrowded
                                ? "text-destructive"
                                : "text-slate-600",
                            )}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {showSkeleton ? (
                        <>
                          <Skeleton className="h-8 w-24" />
                          <Skeleton className="h-4 w-44" />
                        </>
                      ) : (
                        <>
                          {/* Big number = count of sections strictly over capacity */}
                          <div
                            className={cn(
                              "text-5xl font-black tabular-nums",
                              hasOvercrowded && "text-destructive",
                            )}>
                            {overcrowded.length}
                          </div>
                          <div className="text-xs font-bold min-h-[2rem] space-y-1.5">
                            {hasOvercrowded ? (
                              overcrowded.slice(0, 3).map((alert, i) => (
                                <p
                                  key={i}
                                  className="flex items-start gap-2 leading-snug text-destructive font-black">
                                  <span className="h-1.5 w-1.5 rounded-full mt-1 shrink-0 bg-destructive animate-pulse" />
                                  {overcrowdedMessage(alert)}
                                </p>
                              ))
                            ) : (
                              <p className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                All sections within physical capacity.
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {hasOvercrowded && (
                        <Button
                          type="button"
                          className="w-full font-black uppercase text-xs h-10"
                          variant="destructive"
                          onClick={() => navigate("/sections")}>
                          Resolve Overcrowding
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Card 3 — Unsectioned Learners */}
              {(() => {
                const unsectioned = stats?.unsectionedCount ?? 0;
                const hasUnsectioned = unsectioned > 0;
                return (
                  <Card
                    className={cn(
                      "shadow-sm transition-all hover:shadow-md border-2",
                      hasUnsectioned
                        ? "border-amber-400 bg-amber-50/30"
                        : "border-slate-200 bg-white",
                    )}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-black text-foreground">
                          Unsectioned Learners
                        </CardTitle>
                        <div
                          className={cn(
                            "rounded-lg p-2",
                            hasUnsectioned ? "bg-amber-100" : "bg-slate-100",
                          )}>
                          <Users
                            className={cn(
                              "h-4 w-4",
                              hasUnsectioned
                                ? "text-amber-700"
                                : "text-slate-600",
                            )}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {showSkeleton ? (
                        <>
                          <Skeleton className="h-8 w-24" />
                          <Skeleton className="h-4 w-44" />
                        </>
                      ) : (
                        <>
                          <div className="text-5xl font-black tabular-nums">
                            {formatMetric(unsectioned)}
                          </div>
                          <p className="text-xs font-bold min-h-[2rem] leading-relaxed">
                            {hasUnsectioned ? (
                              <span className="text-amber-700">
                                Verified learners with no homeroom assignment.
                                Assign before BOSY closes.
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                All verified learners are sectioned.
                              </span>
                            )}
                          </p>
                        </>
                      )}

                      <Button
                        type="button"
                        className="w-full font-black uppercase text-xs h-10"
                        variant={hasUnsectioned ? "default" : "outline"}
                        onClick={() => navigate("/sections/homerooms")}>
                        {hasUnsectioned
                          ? `Assign Homerooms (${formatMetric(unsectioned)})`
                          : "Homerooms Up To Date"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </div>
      </section>

      {/* ── Early Registration Section ── */}
      <section
        className="space-y-4"
        aria-label="Early registration">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-black uppercase  text-amber-600/80">
            Early Registration Pipeline
          </h2>
          <div className="h-px flex-1 bg-amber-100/50"></div>
        </div>

        <AnimatePresence mode="wait">
          {isEarlyRegistrationExpanded ? (
            <motion.div
              key="early-reg-expanded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {leslPipeline.map((stat) => (
                <Card
                  key={stat.title}
                  className="border-amber-100 bg-white shadow-sm transition-all hover:shadow-md border-b-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase  text-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`${stat.bg} rounded-lg p-2`}>
                      <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                    </div>
                  </CardHeader>

                  <CardContent>
                    {showSkeleton ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <div className="text-3xl font-black tabular-nums">
                        {formatMetric(stat.value)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="early-reg-collapsed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}>
              <Card className="border-amber-100 bg-white shadow-sm border-l-4 border-l-amber-500">
                <CardHeader className="py-3 px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black ">
                        Phase 1: Early Registration Summary
                      </CardTitle>
                      <CardDescription className="text-xs font-bold er">
                        Minimized: Dashboard is currently adapting to the Phase
                        2 (BOSY) operational window.
                      </CardDescription>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">
                          Verified
                        </p>
                        <p className="text-lg font-black text-amber-600">
                          {formatMetric(
                            stats?.earlyRegistration?.verified ?? 0,
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">
                          Ready for Sectioning
                        </p>
                        <p className="text-lg font-black text-blue-600">
                          {formatMetric(
                            stats?.earlyRegistration?.readyForEnrollment ?? 0,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── System Oversight (Bottom Priority for Admin) ── */}
      {isAdmin && (
        <section
          className="space-y-4 pt-8"
          aria-label="System oversight">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black uppercase  text-slate-400">
              System Oversight
            </h2>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {adminCards.map((card) => (
              <Card
                key={card.title}
                className="bg-slate-50/50 border-slate-200 shadow-none hover:bg-white transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-xs font-black  text-slate-500">
                    {card.title}
                  </CardTitle>
                  <card.icon className={cn("h-3.5 w-3.5", card.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-black tabular-nums">
                    {card.value}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase er">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            ))}

            <Card className="md:col-span-2 bg-slate-50/50 border-slate-200 shadow-none border-dashed">
              <CardContent className="h-full flex items-center justify-center py-4">
                <div className="flex items-center gap-3 text-slate-400">
                  <Activity className="h-4 w-4 opacity-50" />
                  <span className="text-xs font-black ">
                    Administrator Telemetry Active
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ── Visual Overlap / Analytics Placeholder (Cleaned up) ── */}
      {!isAdmin && (
        <div className="pt-8 border-t border-slate-50">
          <p className="text-center text-xs font-black text-slate-300 uppercase ">
            EnrollPro Operational Command Center • {new Date().getFullYear()}
          </p>
        </div>
      )}
    </div>
  );
}
