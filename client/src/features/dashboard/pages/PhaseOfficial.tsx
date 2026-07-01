import { useNavigate } from "react-router";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { useBOSYSentinel } from "@/shared/hooks/useBOSYSentinel";

import type { DashboardStats } from "../types";

export function PhaseOfficial({ stats }: { stats: DashboardStats }) {
  const { ayLabel } = useSchoolYearContext();
  const { isEnrollmentOpen } = useBOSYSentinel();
  const navigate = useNavigate();

  const pendingTotal = stats?.kpiHeader?.pendingTotal ?? 0;
  const unassignedTotal = stats?.kpiHeader?.unassignedTotal ?? 0;
  const deficientTotal = stats?.kpiHeader?.deficientTotal ?? 0;

  return (
    <div className="space-y-6 pb-6" style={{ "--element-track": "210 40% 96%" } as React.CSSProperties}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Master Enrollment Dashboard</h1>
        <p className="text-base leading-tight font-extrabold text-foreground">
          BOSY Enrollment Active • {ayLabel}
        </p>
      </div>

      <Alert
        style={{ backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }}
      >
        <AlertTitle
          className="font-extrabold text-blue-900"
        >
          BOSY Enrollment Active
        </AlertTitle>
        <AlertDescription
          className="font-extrabold text-blue-900"
        >
          Accepting regular enrollment for Grade 7, Transferees, and Balik-Aral for SY {ayLabel || "2026-2027"}.
        </AlertDescription>
      </Alert>

      {stats?.classroomDeficitDetected && (
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

      <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col w-full">
        <CardContent className="px-3 sm:px-6 py-8 flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-base sm:text-lg font-extrabold text-foreground">Total Official Enrollment</h3>
            <div className="text-5xl sm:text-6xl font-extrabold" style={{ color: "hsl(var(--primary))" }}>
              <AnimatedNumber value={stats?.kpiHeader?.enrolledTotal ?? 0} />
            </div>
            <p className="text-base font-extrabold text-foreground">Officially Enrolled JHS Learners</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 border-t pt-4">
            {Array.of(7, 8, 9, 10).map((grade, idx) => {
              const b = stats?.gradeLevelBreakdown?.at(idx);
              return (
                <div key={grade} className="text-center">
                  <p className="text-base font-extrabold text-foreground mb-1">Grade {grade}</p>
                  <p className="text-3xl font-extrabold text-foreground">
                    <AnimatedNumber value={b?.current ?? 0} />
                  </p>
                  <p className="text-base text-foreground mt-1 font-semibold flex justify-center gap-1.5">
                    <span className="text-blue-700 font-extrabold">{b?.male ?? 0} M</span>
                    <span className="font-extrabold">|</span>
                    <span className="text-pink-700 font-extrabold">{b?.female ?? 0} F</span>
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">New Enrollees to Check</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-primary">
              <AnimatedNumber value={pendingTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold bg-muted text-foreground">
                Incoming Grade 7 Learners
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between mt-auto pt-4">
              <div>
                {pendingTotal === 0 && (
                  <span className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-9 px-3 text-foreground bg-muted">
                    <Check className="w-4 h-4 mr-2 text-emerald-600" /> No Pending Records
                  </span>
                )}
              </div>
              {isEnrollmentOpen ? (
                <button
                  onClick={() => navigate("/monitoring/enrollment?tab=verification")}
                  className="text-sm font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  Review Enrollees &rarr;
                </button>
              ) : (
                <span
                  className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-not-allowed select-none"
                >
                  Intake Frozen
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">Needs Class Section</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-primary">
              <AnimatedNumber value={unassignedTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold bg-muted text-foreground">
                Unassigned JHS Learners
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between mt-auto pt-4">
              <div>
                {unassignedTotal === 0 && (
                  <span className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-9 px-3 text-foreground bg-muted">
                    <Check className="w-4 h-4 mr-2 text-emerald-600" /> No Pending Records
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/monitoring/enrollment?tab=sectioning")}
                className="text-sm font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                style={{ color: "hsl(var(--primary))" }}
              >
                Assign Homerooms &rarr;
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">Incomplete Documents</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-primary">
              <AnimatedNumber value={deficientTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold bg-muted text-foreground">
                Missing PSA | Missing SF9
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between mt-auto pt-4">
              <div>
                {deficientTotal === 0 && (
                  <span className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-9 px-3 text-foreground bg-muted">
                    <Check className="w-4 h-4 mr-2 text-emerald-600" /> No Pending Records
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/monitoring/enrollment?tab=verification")}
                className="text-sm font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                style={{ color: "hsl(var(--primary))" }}
              >
                Resolve Deficiencies &rarr;
              </button>
            </div>
          </CardContent>
        </Card>
      </div>


    </div>
  );
}
