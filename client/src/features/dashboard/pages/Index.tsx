import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ClipboardList,
  Users,
  CheckCircle,
  AlertTriangle,
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
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";

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
  kpiHeader?: {
    pendingTotal: number;
    pendingIncomingG7: number;
    pendingTransferees: number;
    enrolledTotal: number;
    enrolledNew: number;
    enrolledContinuing: number;
    unassignedTotal: number;
    unassignedCriticalG7: number;
  };
}

interface AdminStats {
  activeUsers: number;
  usersByRole: Record<string, number>;
  emailDeliveryRate: string;
  systemStatus: string;
}

interface EosyLockState {
  schoolYearId: number;
  schoolYearLabel: string;
  schoolYearFinalized: boolean;
  totalSections: number;
  finalizedSections: number;
  canFinalizeSchoolYear: boolean;
  lockReason: string | null;
}



function formatMetric(value: number): string {
  return Number(value || 0).toLocaleString("en-PH");
}



export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    systemStatus,
    activeSchoolYearId,
    viewingSchoolYearId,
  } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { ayLabel, isViewingOverride, viewingStatus } = useSchoolYearContext();
  const isAdmin = user?.roles?.includes("SYSTEM_ADMIN");
  const isBosyLocked = systemStatus === "BOSY_LOCKED";

  const [stats, setStats] = useState<Stats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [eosyLockState, setEosyLockState] = useState<EosyLockState | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const schoolYearParam = ayId ? `?schoolYearId=${ayId}` : "";
        const [statsRes, adminRes, eosyRes] = await Promise.all([
          api.get(`/dashboard/stats${schoolYearParam}`),
          isAdmin
            ? api.get("/admin/dashboard/stats")
            : Promise.resolve({ data: null }),
          isBosyLocked && ayId
            ? api.get(`/eosy/school-year/${ayId}/export-lock`).catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
        ]);

        setStats(statsRes.data.stats);
        if (adminRes.data) setAdminStats(adminRes.data);
        if (eosyRes.data) setEosyLockState(eosyRes.data as EosyLockState);
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
  }, [isAdmin, ayId, isBosyLocked]);

  const pendingReviewCount =
    stats?.actions?.pendingReview ?? stats?.totalPending ?? 0;
  const enrollmentCurrent = stats?.totalEnrolled ?? 0;

  // System Analytics — admin footer row
  const registrarCount =
    (adminStats?.usersByRole?.["HEAD_REGISTRAR"] ?? 0) +
    (adminStats?.usersByRole?.["REGISTRAR"] ?? 0);
  const teacherCount = adminStats?.usersByRole?.["TEACHER"] ?? 0;
  const totalPersonnel = registrarCount + teacherCount;

  // Schoolwide average fill rate across all grade levels
  const glBreakdown = stats?.gradeLevelBreakdown ?? [];

  const eosyProgress =
    eosyLockState && eosyLockState.totalSections > 0
      ? Math.round(
          (eosyLockState.finalizedSections / eosyLockState.totalSections) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {isBosyLocked && viewingStatus !== 'ARCHIVED' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg border-2 border-emerald-400/30">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-black uppercase  leading-none">
                BOSY Locked ({ayLabel})
              </p>
              <p className="text-base font-bold text-emerald-100 mt-1">
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
          className="bg-white border-2 border-slate-300 text-foreground px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-foreground" />
            <p className="text-base leading-tight font-black uppercase">
              Viewing Historical Data &middot; S.Y. {ayLabel}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-slate-400 text-foreground font-black uppercase">
            {viewingStatus ?? "ARCHIVED"}
          </Badge>
        </motion.div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">School Operations Dashboard</h1>
          <p className="text-base leading-tight text-foreground font-bold">
            Welcome back,{" "}
            <span className="font-bold text-primary">
              {user?.firstName} {user?.lastName}
            </span>. Here is your academic system overview.
          </p>
        </div>

      </div>

      {/* ── Row 1: Pending Administrative Tasks ── */}
      <section className="space-y-4" aria-label="Pending administrative tasks">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black uppercase text-foreground">
            PENDING ADMINISTRATIVE TASKS
          </h2>
          <div className="h-px flex-1 bg-slate-200"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: PENDING ENROLLMENT APPROVALS */}
          <Card
            className="bg-background border border-border shadow-sm rounded-lg flex flex-col"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black uppercase text-foreground">
                  Pending Enrollment Approvals
                </CardTitle>
                <div className="rounded-lg p-2 bg-white">
                  <ClipboardList className="h-4 w-4 text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              {showSkeleton ? (
                <div className="flex-1"><Skeleton className="h-10 w-32" /></div>
              ) : (
                <div className="flex-1 space-y-4">
                  <AnimatedNumber
                    value={pendingReviewCount}
                    className="text-5xl font-black tabular-nums"
                  />
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-100">
                    <Badge className="bg-orange-100 text-orange-900 border border-orange-300 text-[10px] uppercase font-bold hover:bg-orange-200">
                      {stats?.kpiHeader?.pendingIncomingG7 ?? 0} Incoming G7
                    </Badge>
                    <Badge className="bg-orange-100 text-orange-900 border border-orange-300 text-[10px] uppercase font-bold hover:bg-orange-200">
                      {stats?.kpiHeader?.pendingTransferees ?? 0} Transferees
                    </Badge>
                  </div>
                </div>
              )}
              <Button
                type="button"
                className="w-full font-black uppercase text-base h-10 mt-auto"
                variant="outline"
                onClick={() => navigate("/monitoring/enrollment?workflow=PENDING_VERIFICATION")}
              >
                {pendingReviewCount > 0
                  ? `Review ${formatMetric(pendingReviewCount)} Applications`
                  : "REVIEW PENDING ENROLLEES"}
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: LEARNERS AWAITING SECTIONING */}
          <Card
            className="bg-background border border-border shadow-sm rounded-lg flex flex-col"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black uppercase text-foreground">
                  Learners Awaiting Sectioning
                </CardTitle>
                <div className="bg-white rounded-lg p-2">
                  <Users className="h-4 w-4 text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              {showSkeleton ? (
                <div className="flex-1"><Skeleton className="h-10 w-32" /></div>
              ) : (
                <div className="flex-1 space-y-4">
                  <AnimatedNumber
                    value={stats?.kpiHeader?.unassignedTotal ?? 0}
                    className="text-5xl font-black text-blue-700 tabular-nums"
                  />
                  <div className="flex items-center gap-2 pt-1 border-t border-blue-100">
                    <Badge variant="outline" className="bg-blue-100 text-blue-900 border-blue-300 text-[10px] uppercase font-bold">
                      {stats?.kpiHeader?.unassignedCriticalG7 ?? 0} Critical (Grade 7)
                    </Badge>
                  </div>
                </div>
              )}
              <Button
                type="button"
                className="w-full font-black uppercase text-base h-10 mt-auto"
                variant="outline"
                onClick={() => navigate("/sections/homerooms")}
              >
                ASSIGN LEARNERS TO SECTIONS
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: OVERCROWDED SECTIONS */}
          {(() => {
            const sectionsAtMax = stats?.sectionsAtCapacity ?? 0;
            const warningCount = stats?.capacityAlerts?.filter((a) => a.severity === "WARNING").length ?? 0;
            const hasCapacityPressure = sectionsAtMax > 0;

            return (
              <Card
                className="bg-background border border-border shadow-sm rounded-lg flex flex-col"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-black uppercase text-foreground">
                      Overcrowded Sections
                    </CardTitle>
                    <div className="rounded-lg p-2 bg-white">
                      <AlertTriangle className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  {showSkeleton ? (
                    <div className="flex-1"><Skeleton className="h-10 w-32" /></div>
                  ) : (
                    <div className="flex-1 space-y-4">
                      <AnimatedNumber
                        value={sectionsAtMax}
                        className={cn("text-5xl font-black tabular-nums", hasCapacityPressure ? "text-amber-600" : "text-foreground")}
                      />
                      <p className="text-base font-bold min-h-[2rem] leading-relaxed">
                        {hasCapacityPressure ? (
                          <span className="text-amber-700">
                            {sectionsAtMax} section{sectionsAtMax !== 1 ? "s" : ""} at maximum capacity.
                            {warningCount > 0 ? ` ${warningCount} approaching limit.` : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                            All sections have available seats.
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  <Button
                    type="button"
                    className="w-full font-black uppercase text-base h-10 mt-auto"
                    variant="outline"
                    onClick={() => navigate("/sections/homerooms")}
                  >
                    MONITOR SECTION CAPACITIES
                  </Button>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </section>

      {/* ── EOSY Progress (when BOSY locked) ── */}
      {isBosyLocked && viewingStatus !== 'ARCHIVED' && (
        <section className="space-y-4" aria-label="EOSY progress">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black uppercase text-slate-600">
              End of School Year Progress · {ayLabel}
            </h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Classes Finalized */}
            <Card className="border border-slate-200/50 shadow-sm card-hover hover:shadow-md bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-black uppercase text-foreground">
                    Classes Finalized
                  </CardTitle>
                  <div className="bg-slate-100 rounded-lg p-2">
                    <CheckCircle className="h-4 w-4 text-slate-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showSkeleton ? (
                  <>
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <AnimatedNumber
                        value={eosyLockState?.finalizedSections ?? 0}
                        className="text-5xl font-black tabular-nums"
                      />
                      <span className="text-xl font-black text-foreground/40">
                        /{" "}
                        <AnimatedNumber
                          value={eosyLockState?.totalSections ?? 0}
                        />
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${eosyProgress}%` }}
                        transition={{
                          duration: 1,
                          ease: "easeOut",
                          delay: 0.2,
                        }}
                        className="h-full rounded-full bg-slate-700"
                      />
                    </div>
                    <p className="text-base font-bold text-foreground uppercase">
                      <AnimatedNumber value={eosyProgress} suffix="%" />{" "}
                      of classes have submitted EOSY reports
                    </p>
                  </>
                )}
                <Button
                  type="button"
                  className="w-full font-black uppercase text-base h-10"
                  variant="outline"
                  onClick={() => navigate("/eosy")}>
                  Open EOSY Tracker
                </Button>
              </CardContent>
            </Card>

            {/* Final Enrollment Count */}
            <Card className="border-2 border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/20 shadow-md card-hover hover:shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-black uppercase text-emerald-900/40">
                    Final Enrollment
                  </CardTitle>
                  {eosyLockState?.schoolYearFinalized && (
                    <Badge className="bg-slate-800 text-white font-black uppercase text-base h-5">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showSkeleton ? (
                  <Skeleton className="h-10 w-32" />
                ) : (
                  <>
                    <AnimatedNumber
                      value={enrollmentCurrent}
                      className="text-5xl font-black text-emerald-700 tabular-nums"
                    />
                    <p className="text-base font-bold text-emerald-900/50 uppercase">
                      Total Enrolled · SY {ayLabel}
                    </p>
                    {stats?.previousYearTotal && stats.previousYearTotal > 0 && (() => {
                      const delta = enrollmentCurrent - stats.previousYearTotal;
                      const positive = delta >= 0;
                      return (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-black text-base leading-tight",
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
                            {delta.toLocaleString("en-PH")} vs prior SY
                          </span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Grade Level Summary */}
            <Card className="border border-slate-200/50 shadow-sm card-hover hover:shadow-md bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-black uppercase text-foreground">
                  Grade Level Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showSkeleton ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {glBreakdown.slice(0, 5).map((gl) => (
                      <div
                        key={gl.id}
                        className="flex items-center justify-between gap-3">
                        <span className="text-base font-bold uppercase text-foreground truncate">
                          {gl.name}
                        </span>
                        <span className="text-base font-black tabular-nums text-emerald-600 shrink-0">
                          <AnimatedNumber value={gl.current} />
                        </span>
                      </div>
                    ))}
                    {glBreakdown.length === 0 && (
                      <p className="text-base font-bold text-foreground uppercase">
                        No data available
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ── Row 2: Official Enrollment Tally ── */}
      <section
        className="space-y-4"
        aria-label="Official enrollment tally">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black uppercase  text-emerald-600">
            Official Enrollment Tally (S.Y. {ayLabel})
          </h2>
          <div className="h-px flex-1 bg-emerald-100/50"></div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-4 border-2 border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/20 shadow-md card-hover hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-black uppercase text-emerald-900/40">
                      Total Enrolled
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 h-5 px-1.5 text-base font-black uppercase">
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
                          <AnimatedNumber
                            value={enrollmentCurrent}
                            className="text-5xl font-black text-emerald-700 tabular-nums"
                          />
                        </div>
                        <p className="text-base font-bold text-emerald-900/50 uppercase">
                          Total Enrolled · SY {ayLabel}
                        </p>
                      </div>

                      {/* Growth vs prior SY */}
                      {(() => {
                        const prev = stats?.previousYearTotal ?? null;
                        if (!prev || prev === 0) {
                          return (
                            <p className="text-base font-bold text-foreground uppercase">
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
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-black text-base leading-tight",
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
                              <AnimatedNumber value={Number(pct)} decimals={1} suffix="%" /> vs prior SY (<AnimatedNumber value={prev} />)
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-8 border border-slate-200/50 bg-white shadow-sm flex flex-col card-hover hover:shadow-md">
                <CardHeader className="pb-3 border-b border-slate-50">
                  <CardTitle className="text-base font-black uppercase text-foreground">
                    Enrollment per Grade Level
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
                        return (
                        <div
                          key={gl.id}
                          className="space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-base font-black uppercase text-foreground">
                              {gl.name}
                            </span>
                            <span className="text-base font-black text-emerald-700 tabular-nums">
                              <AnimatedNumber value={gl.current} /> Enrolled
                            </span>
                          </div>
                        </div>
                        );
                      })}
                      {(!stats?.gradeLevelBreakdown ||
                        stats.gradeLevelBreakdown.length === 0) && (
                        <div className="col-span-full py-8 text-center">
                          <p className="text-base font-bold text-foreground uppercase ">
                            No Grade Level Data Available
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
        </div>
      </section>




      {/* ── Row 3: School Demographics & Staff ── */}
      {isAdmin && (
        <section
          className="space-y-4 pt-8"
          aria-label="School demographics and staff">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black uppercase text-foreground">
              SCHOOL DEMOGRAPHICS & STAFF
            </h2>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {/* ── Card: Active Personnel ── */}
            <Card className="bg-white border border-slate-200/50 shadow-sm card-hover hover:shadow-md flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-black uppercase text-foreground">
                  TEACHING & NON-TEACHING STAFF
                </CardTitle>
                <Users className="h-3.5 w-3.5 text-foreground" />
              </CardHeader>
              <CardContent className="space-y-2 flex-1">
                {showSkeleton ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <AnimatedNumber
                        value={totalPersonnel}
                        className="text-2xl font-black"
                      />
                      <span className="text-base font-bold text-foreground uppercase">
                        Total Registered Personnel
                      </span>
                    </div>
                    <p className="text-base font-bold text-foreground uppercase mt-2">
                      <AnimatedNumber value={registrarCount} /> Registrar{registrarCount !== 1 ? "s" : ""}
                      &nbsp;&middot;&nbsp;
                      <AnimatedNumber value={teacherCount} /> Teachers
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Card: Latest Activities ── */}
            <Card className="bg-white border border-slate-200/50 shadow-sm card-hover hover:shadow-md flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-black uppercase text-foreground">
                  GENERATE OFFICIAL REPORTS (QUICK LINKS)
                </CardTitle>
                <ClipboardList className="h-3.5 w-3.5 text-foreground" />
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <div className="flex flex-col gap-2 pt-2">
                  <button className="w-full text-left px-4 py-3 bg-muted/20 hover:bg-muted text-base leading-tight font-semibold text-foreground rounded-md flex items-center gap-3 transition-colors">
                    <Archive className="h-4 w-4 text-primary" /> Download School Form 1 (SF1) - School Register
                  </button>
                  <button className="w-full text-left px-4 py-3 bg-muted/20 hover:bg-muted text-base leading-tight font-semibold text-foreground rounded-md flex items-center gap-3 transition-colors">
                    <Archive className="h-4 w-4 text-primary" /> Download School Form 5 (SF5) - Report on Promotion
                  </button>
                  <button className="w-full text-left px-4 py-3 bg-muted/20 hover:bg-muted text-base leading-tight font-semibold text-foreground rounded-md flex items-center gap-3 transition-colors">
                    <Archive className="h-4 w-4 text-primary" /> Download School Form 6 (SF6) - Summarized Report
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ── Visual Overlap / Analytics Placeholder (Cleaned up) ── */}
      {!isAdmin && (
        <div className="pt-8 border-t border-slate-50">
          <p className="text-center text-base font-black text-foreground uppercase ">
            EnrollPro Operational Command Center • {new Date().getFullYear()}
          </p>
        </div>
      )}
    </div>
  );
}
