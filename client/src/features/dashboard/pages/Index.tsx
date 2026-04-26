import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ClipboardList,
  Users,
  CheckCircle,
  AlertTriangle,
  UserCog,
  Activity,
  ShieldCheck,
  FileText,
  FileCheck,
  GitPullRequest,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
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
    examScheduled?: number;
    readyForEnrollment?: number;
    enrolled?: number;
    inPipeline?: number;
    total: number;
  };
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

function formatFocusMode(mode: FocusMode): string {
  if (mode === "EARLY") return "Early Registration";
  if (mode === "ENROLLMENT") return "Enrollment Progress";
  return "Balanced";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { enrollmentPhase } = useSettingsStore();
  const isAdmin = user?.role === "SYSTEM_ADMIN";

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
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

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
  const sectionsAtCapacityCount =
    stats?.actions?.sectionsAtCapacity ?? stats?.sectionsAtCapacity ?? 0;
  const pendingReviewAlert =
    pendingReviewCount >= ACTION_THRESHOLDS.pendingReview;
  const sectionsCapacityAlert =
    sectionsAtCapacityCount >= ACTION_THRESHOLDS.sectionsAtCapacity;

  const enrollmentCurrent =
    stats?.enrollmentTarget?.current ?? stats?.totalEnrolled ?? 0;
  const enrollmentTarget = stats?.enrollmentTarget?.target ?? 0;
  const enrollmentProgress =
    stats?.enrollmentTarget?.progressPercent ??
    (enrollmentTarget > 0
      ? Number(((enrollmentCurrent / enrollmentTarget) * 100).toFixed(1))
      : 0);
  const enrollmentProgressClamped = clampProgress(enrollmentProgress);
  const seatsRemaining =
    stats?.enrollmentTarget?.seatsRemaining ??
    Math.max(enrollmentTarget - enrollmentCurrent, 0);

  const focusStateLabel =
    focusOverride === "AUTO"
      ? `Auto | ${formatFocusMode(autoFocus)}`
      : `Manual | ${formatFocusMode(focusOverride)}`;

  const earlyRegCards = [
    {
      title: "Submitted",
      value: stats?.earlyRegistration?.submitted ?? 0,
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Exam Scheduled",
      value: stats?.earlyRegistration?.examScheduled ?? 0,
      icon: GitPullRequest,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Ready for Enrollment",
      value: stats?.earlyRegistration?.readyForEnrollment ?? 0,
      icon: CheckCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Verified",
      value: stats?.earlyRegistration?.verified ?? 0,
      icon: FileCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      title: "Enrolled",
      value: stats?.earlyRegistration?.enrolled ?? stats?.totalEnrolled ?? 0,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  const adminCards = [
    {
      title: "Active Users",
      value: adminStats?.activeUsers ?? 0,
      description: `${adminStats?.usersByRole["REGISTRAR"] || 0} Registrars | ${adminStats?.usersByRole["TEACHER"] || 0} Teachers`,
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="font-semibold text-primary">
              {user?.firstName} {user?.lastName}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <Badge
            variant="outline"
            className="h-6 gap-1 border-primary border-opacity-20 bg-sidebar-accent text-primary">
            <ShieldCheck className="h-3 w-3" />
            {user?.role} Access
          </Badge>

          <div className="flex flex-col items-start gap-1 md:items-end">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Seasonal Focus
            </p>
            <div
              className="inline-flex rounded-lg border bg-card p-1"
              role="group"
              aria-label="Command center seasonal focus">
              {(["AUTO", "EARLY", "ENROLLMENT"] as const).map((mode) => {
                const selected = focusOverride === mode;

                return (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "ghost"}
                    onClick={() => setFocusOverride(mode)}
                    className="h-7 px-2 text-[11px] font-bold uppercase tracking-wide">
                    {mode}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <section
          className="space-y-3"
          aria-label="System oversight">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-purple-600 opacity-80">
              System Oversight
            </h2>
            <div className="h-px flex-1 bg-purple-100"></div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {adminCards.map((stat) => (
              <Card
                key={stat.title}
                className="border-purple-100 bg-white shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`${stat.bg} rounded-full p-2.5`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>

                <CardContent className="pb-4 pt-1">
                  {showSkeleton ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-black ">{stat.value}</div>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {stat.description}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section
        className="space-y-4"
        aria-label="Enrollment progress">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-600 opacity-80">
            Enrollment Progress
          </h2>
          <div className="h-px flex-1 bg-emerald-100"></div>
        </div>

        {isEnrollmentExpanded ? (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-xl font-black ">
                      Total Enrolled
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                      Primary Target
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    Active school-year enrollment against total section
                    capacity.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {showSkeleton ? (
                    <>
                      <Skeleton className="h-10 w-44" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-4 w-64" />
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-5xl font-black leading-none text-emerald-700">
                            {formatMetric(enrollmentCurrent)}
                          </p>
                          <p className="mt-3 text-sm font-bold text-emerald-900/60">
                            {formatMetric(enrollmentCurrent)} /{" "}
                            {formatMetric(enrollmentTarget)} seats filled
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-black text-emerald-600">
                            {enrollmentProgress.toFixed(1)}%
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-900/40">
                            Completion
                          </span>
                        </div>
                      </div>

                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(enrollmentProgressClamped)}
                        aria-label="Enrollment progress toward section capacity"
                        className="h-3 w-full rounded-full bg-emerald-100 overflow-hidden shadow-inner">
                        <div
                          className="h-3 rounded-full bg-emerald-600 transition-all duration-1000 ease-out"
                          style={{ width: `${enrollmentProgressClamped}%` }}
                        />
                      </div>

                      <div className="rounded-lg bg-white/50 p-3 border border-emerald-100/50">
                        <p className="text-xs font-medium text-emerald-900/70 leading-relaxed">
                          {enrollmentTarget === 0
                            ? "Section capacity target is unavailable until sections are configured."
                            : seatsRemaining > 0
                              ? `Strategically, ${formatMetric(seatsRemaining)} seats remain available across all departments before reaching current target capacity.`
                              : "Capacity target reached. Monitor waitlists or consider opening additional sections if intake continues."}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-black ">
                    Focus Mode
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current administrative viewport.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  {showSkeleton ? (
                    <>
                      <Skeleton className="h-7 w-28" />
                      <Skeleton className="h-4 w-48" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-bold border-primary/20 text-primary bg-primary/5 px-2 py-1">
                          {focusStateLabel}
                        </Badge>
                      </div>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                          Phase: {enrollmentPhase.replaceAll("_", " ")}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground italic">
                          "System adapts dashboards based on the academic
                          calendar to surface relevant bottlenecks."
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card
                className={`shadow-sm transition-all hover:shadow-md ${pendingReviewAlert ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pending Review
                    </CardTitle>
                    <div
                      className={`rounded-full p-2.5 ${pendingReviewAlert ? "bg-amber-100" : "bg-slate-100"}`}>
                      <ClipboardList
                        className={`h-4 w-4 ${pendingReviewAlert ? "text-amber-700" : "text-slate-600"}`}
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
                      <div className="text-4xl font-black">
                        {formatMetric(pendingReviewCount)}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground min-h-[2rem]">
                        {pendingReviewAlert
                          ? "Review queue has reached critical volume. Registrar intervention required."
                          : "Process is stable. Review queue is performing within established parameters."}
                      </p>
                    </>
                  )}

                  <Button
                    type="button"
                    className="w-full font-bold"
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

              <Card
                className={`shadow-sm transition-all hover:shadow-md ${sectionsCapacityAlert ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Capacity Saturation
                    </CardTitle>
                    <div
                      className={`rounded-full p-2.5 ${sectionsCapacityAlert ? "bg-red-100" : "bg-slate-100"}`}>
                      <AlertTriangle
                        className={`h-4 w-4 ${sectionsCapacityAlert ? "text-red-700" : "text-slate-600"}`}
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
                      <div className="text-4xl font-black">
                        {formatMetric(sectionsAtCapacityCount)}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground min-h-[2rem]">
                        {sectionsCapacityAlert
                          ? "Section saturation detected. Allocation limits nearing maximum thresholds."
                          : "Section distribution is currently balanced across all grade levels."}
                      </p>
                    </>
                  )}

                  <Button
                    type="button"
                    className="w-full font-bold"
                    variant={sectionsCapacityAlert ? "destructive" : "outline"}
                    onClick={() => navigate("/sections")}>
                    {sectionsAtCapacityCount > 0
                      ? "Balance Sections"
                      : "Open Section Workspace"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black ">
                Enrollment Summary
              </CardTitle>
              <CardDescription>
                Collapsed while Early Registration focus is active.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {showSkeleton ? (
                <Skeleton className="h-8 w-44" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="font-bold px-3">
                    Enrolled: {formatMetric(enrollmentCurrent)}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="font-bold px-3">
                    Pending: {formatMetric(pendingReviewCount)}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="font-bold px-3">
                    Saturation Alerts: {formatMetric(sectionsAtCapacityCount)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section
        className="space-y-4"
        aria-label="Early registration">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 opacity-80">
            Early Registration
          </h2>
          <div className="h-px flex-1 bg-amber-100"></div>
        </div>

        {isEarlyRegistrationExpanded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {earlyRegCards.map((stat) => (
              <Card
                key={stat.title}
                className="border-amber-100 bg-white shadow-sm transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`${stat.bg} rounded-full p-2`}>
                    <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  </div>
                </CardHeader>

                <CardContent>
                  {showSkeleton ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-black ">
                      {formatMetric(stat.value)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-amber-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black ">
                Early Registration Summary
              </CardTitle>
              <CardDescription>
                Condensed while Enrollment Progress focus is active.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {showSkeleton ? (
                <Skeleton className="h-8 w-52" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="font-bold px-3 border-amber-200">
                    Submitted:{" "}
                    {formatMetric(stats?.earlyRegistration?.submitted ?? 0)}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="font-bold px-3 border-amber-200">
                    Exams:{" "}
                    {formatMetric(stats?.earlyRegistration?.examScheduled ?? 0)}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="font-bold px-3 border-amber-200">
                    Ready:{" "}
                    {formatMetric(
                      stats?.earlyRegistration?.readyForEnrollment ?? 0,
                    )}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-opacity-50 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold">Quick Overview</CardTitle>
            <CardDescription className="text-xs">
              Trend charts and distribution widgets.
            </CardDescription>
          </CardHeader>

          <CardContent className="py-10">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full bg-slate-100 p-4 ring-8 ring-slate-50">
                <Activity className="h-8 w-8 text-slate-300" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-400">
                  Visualization Engine
                </h3>
                <p className="max-w-64 text-xs text-muted-foreground/60 leading-relaxed">
                  Real-time enrollment trends and forecast models are currently
                  aggregating data for this period.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-opacity-50 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold">System Logs</CardTitle>
            <CardDescription className="text-xs">
              Latest administrative actions.
            </CardDescription>
          </CardHeader>

          <CardContent className="py-10">
            <div className="flex flex-col items-center justify-center space-y-4 text-center text-slate-400">
              <ShieldCheck className="h-10 w-10 opacity-20" />
              <p className="text-xs font-medium tracking-wide">
                NO RECENT AUDIT ACTIVITY
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
