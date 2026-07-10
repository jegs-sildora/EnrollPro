import { useNavigate } from "react-router";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { useBOSYSentinel } from "@/shared/hooks/useBOSYSentinel";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";

import type { DashboardStats } from "../types";

interface HistoricalSummaryCardProps {
  title: string
  value: number
  footer: string
}

function HistoricalSummaryCard({
  title,
  value,
  footer,
}: HistoricalSummaryCardProps) {
  return (
    <Card className="flex h-full min-h-[220px] flex-col border border-slate-200 bg-card shadow-sm">
      <CardHeader className="px-6 pb-2 pt-6">
        <CardTitle className="text-lg font-extrabold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-6 pb-0">
        <div className="flex flex-1 items-center justify-center py-6">
          <span className="text-5xl font-extrabold text-slate-700 sm:text-6xl dark:text-slate-200">
            {value}
          </span>
        </div>
        <div className="min-h-[64px] border-t border-border py-5 text-center text-sm font-bold text-slate-600 dark:text-slate-300">
          {footer}
        </div>
      </CardContent>
    </Card>
  )
}

export function PhaseOfficial({ stats }: { stats: DashboardStats }) {
  const { ayLabel, viewingStatus } = useSchoolYearContext();
  const { isEnrollmentOpen } = useBOSYSentinel();
  const navigate = useNavigate();
  const isArchived = stats.isArchived || viewingStatus === "ARCHIVED"

  const pendingTotal = stats?.kpiHeader?.pendingTotal ?? 0;
  const unassignedTotal = stats?.kpiHeader?.unassignedTotal ?? 0;
  const deficientTotal = stats?.kpiHeader?.deficientTotal ?? 0;

  const activeCardsCount = [pendingTotal, unassignedTotal, deficientTotal].filter(total => total > 0).length;
  const gridColsClass = activeCardsCount === 1 ? "md:grid-cols-1" : activeCardsCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <div className="flex flex-col flex-1 space-y-6 pb-6" style={{ "--element-track": "210 40% 96%" } as React.CSSProperties}>
      {!isArchived && (
        <Alert
          style={{ backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }}
        >
          <AlertTitle
            className="font-extrabold text-blue-900"
          >
            BOSY Enrollment Open
          </AlertTitle>
          <AlertDescription
            className="font-extrabold text-blue-900"
          >
            Accepting regular enrollment for Grade 7, Transferees, and Balik-Aral for SY {ayLabel || "2026-2027"}.
          </AlertDescription>
        </Alert>
      )}

      {!isArchived && stats?.classroomDeficitDetected && (
        <Alert style={{ backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" }}>
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <AlertTitle className="font-extrabold text-rose-955 flex items-center gap-2">
              Classroom Seating Deficit Warning
            </AlertTitle>
            <AlertDescription className="text-rose-700 font-extrabold">
              The total enrolled student headcount across all class homerooms exceeds the sum of all sections' capacities. Reallocate classrooms or provision new sections to prevent over-capacity compliance alerts.
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className={cn("flex flex-col w-full overflow-hidden", (activeCardsCount === 0 && !isArchived) ? "flex-1" : "")}>
        <div className="flex flex-col flex-1">
          {/* Top Hero Section */}
          <div className="relative flex-1 flex flex-col items-center justify-center p-10 sm:p-14 min-h-[250px]">
            <div className="absolute inset-0 bg-muted rounded-md pointer-events-none border shadow-sm" />
            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <h3 className="text-2xl font-extrabold text-foreground uppercase tracking-widest">Total Official Enrollment</h3>
              <div className="text-7xl sm:text-[100px] leading-none font-black tracking-tighter my-2 drop-shadow-sm" style={{ color: "hsl(var(--primary))" }}>
                <AnimatedNumber value={stats?.kpiHeader?.enrolledTotal ?? 0} />
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-foreground">Officially Enrolled JHS Learners</p>
            </div>
          </div>

          {/* Grade Breakdown Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 mt-auto">
            {Array.of(7, 8, 9, 10).map((grade, idx) => {
              const b = stats?.gradeLevelBreakdown?.at(idx);
              return (
                <div
                  key={grade}
                  className={cn(
                    "text-center p-5 rounded-md border shadow-sm flex flex-col justify-center transition-all",
                    getGradeLevelBadgeStyles(grade.toString())
                  )}
                >
                  <p className="font-extrabold mb-1 uppercase tracking-wider opacity-90">Grade {grade}</p>
                  <p className="text-4xl sm:text-5xl font-black drop-shadow-sm mb-1">
                    <AnimatedNumber value={b?.current ?? 0} />
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-current/20 w-full">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-extrabold uppercase tracking-wider mb-0.5">Male</span>
                      <span className="text-lg font-extrabold">{b?.male ?? 0}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-extrabold uppercase tracking-wider mb-0.5">Female</span>
                      <span className="text-lg font-extrabold">{b?.female ?? 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isArchived && (
        <section
          aria-label="Archived school year final outcomes"
          className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3"
        >
          <HistoricalSummaryCard
            title="EOSY Promotion Status"
            value={stats.historicalSummary.promotedTotal}
            footer={`${stats.historicalSummary.conditionallyPromotedTotal} Conditionally Promoted | ${stats.historicalSummary.retainedTotal} Retained`}
          />
          <HistoricalSummaryCard
            title="Official JHS Completers"
            value={stats.historicalSummary.jhsCompletersTotal}
            footer={`${stats.historicalSummary.jhsCompletersMale} Male | ${stats.historicalSummary.jhsCompletersFemale} Female`}
          />
          <HistoricalSummaryCard
            title="Transferred & Dropped"
            value={
              stats.historicalSummary.transferredOutTotal
              + stats.historicalSummary.droppedOutTotal
            }
            footer={`${stats.historicalSummary.transferredOutTotal} Transferred Out | ${stats.historicalSummary.droppedOutTotal} Dropped Out`}
          />
        </section>
      )}

      {!isArchived && activeCardsCount > 0 && (
        <div className={cn("grid grid-cols-1 gap-6", gridColsClass)}>
          {pendingTotal > 0 && (
            <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col overflow-hidden">
              <div className="px-4 sm:px-6 py-6 flex flex-col flex-1 relative min-h-[180px]">
                <h3 className="absolute top-5 left-4 sm:left-6 text-base sm:text-lg font-extrabold text-foreground text-left max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-3rem)] truncate">Pending Enrollment</h3>
                <div className="flex flex-col items-center justify-center flex-1 w-full h-full pt-10">
                  <div className={cn("text-5xl sm:text-6xl font-extrabold", pendingTotal > 0 ? "text-primary" : "")}>
                    <AnimatedNumber value={pendingTotal} />
                  </div>
                  <p className="mt-2 font-bold text-center w-full truncate">Incoming Grade 7 Learners</p>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-border/40 bg-muted/30 flex items-center min-h-[60px] w-full">
                {pendingTotal === 0 ? (
                  <div className="flex items-center justify-center w-full">
                    <span className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center whitespace-nowrap">
                      <Check className="w-4 h-4 mr-1.5 shrink-0" /> All records up to date
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end text-right w-full @container">
                    {isEnrollmentOpen ? (
                      <button
                        onClick={() => navigate("/continuing-learners?tab=incoming")}
                        className="font-bold flex items-center justify-end group hover:opacity-80 transition-opacity whitespace-nowrap text-[clamp(10px,9cqw,14px)] w-full"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        Process Early Registrants <span className="ml-1 transition-transform group-hover:translate-x-1 shrink-0">&rarr;</span>
                      </button>
                    ) : (
                      <span className="font-semibold  cursor-not-allowed select-none whitespace-nowrap text-[clamp(10px,9cqw,14px)] w-full text-right">
                        Enrollment Closed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {unassignedTotal > 0 && (
            <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col overflow-hidden">
              <div className="px-4 sm:px-6 py-6 flex flex-col flex-1 relative min-h-[180px]">
                <h3 className="absolute top-5 left-4 sm:left-6 text-base sm:text-lg font-extrabold text-foreground text-left max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-3rem)] truncate">Unsectioned Learners</h3>
                <div className="flex flex-col items-center justify-center flex-1 w-full h-full pt-10">
                  <div className={cn("text-5xl sm:text-6xl font-extrabold", unassignedTotal > 0 ? "text-primary" : "")}>
                    <AnimatedNumber value={unassignedTotal} />
                  </div>
                  <p className="mt-2 font-bold text-center w-full truncate">Pending SF1 Placement</p>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-border/40 bg-muted/30 flex items-center min-h-[60px] w-full">
                {unassignedTotal === 0 ? (
                  <div className="flex items-center justify-center w-full">
                    <span className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center whitespace-nowrap">
                      <Check className="w-4 h-4 mr-1.5 shrink-0" /> All records up to date
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end text-right w-full @container">
                    <button
                      onClick={() => navigate("/monitoring/enrollment")}
                      className="font-bold flex items-center justify-end group hover:opacity-80 transition-opacity whitespace-nowrap text-[clamp(10px,9cqw,14px)] w-full"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Assign Class Sections <span className="ml-1 transition-transform group-hover:translate-x-1 shrink-0">&rarr;</span>
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {deficientTotal > 0 && (
            <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col overflow-hidden">
              <div className="px-4 sm:px-6 py-6 flex flex-col flex-1 relative min-h-[180px]">
                <h3 className="absolute top-5 left-4 sm:left-6 text-base sm:text-lg font-extrabold text-foreground text-left max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-3rem)] truncate">Lacking Documentary Requirements</h3>
                <div className="flex flex-col items-center justify-center flex-1 w-full h-full pt-10">
                  <div className={cn("text-5xl sm:text-6xl font-extrabold", deficientTotal > 0 ? "text-primary" : "")}>
                    <AnimatedNumber value={deficientTotal} />
                  </div>
                  <p className="mt-2 font-bold text-center w-full truncate">Pending SF9 / PSA Birth Certificate</p>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-border/40 bg-muted/30 flex items-center min-h-[60px] w-full">
                {deficientTotal === 0 ? (
                  <div className="flex items-center justify-center w-full">
                    <span className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center whitespace-nowrap">
                      <Check className="w-4 h-4 mr-1.5 shrink-0" /> All records up to date
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end text-right w-full @container">
                    <button
                      onClick={() => navigate("/continuing-learners?tab=incoming")}
                      className="font-bold flex items-center justify-end group hover:opacity-80 transition-opacity whitespace-nowrap text-[clamp(10px,9cqw,14px)] w-full"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Update Learner Credentials <span className="ml-1 transition-transform group-hover:translate-x-1 shrink-0">&rarr;</span>
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}



    </div>
  );
}
