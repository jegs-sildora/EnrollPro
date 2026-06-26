import { useNavigate } from "react-router";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import type { DashboardStats } from "../types";

export function PhaseOngoing({ stats }: { stats: DashboardStats }) {
  const { ayLabel } = useSchoolYearContext();
  const navigate = useNavigate();

  const pendingTotal = stats?.v85Stats?.lateIntakeCount ?? 0;
  const unassignedTotal = stats?.v85Stats?.pendingSF10Count ?? 0;
  const deficientTotal = stats?.v85Stats?.overdueDocumentsCount ?? 0;

  return (
    <div className="space-y-6 pb-6" style={{ "--element-track": "210 40% 96%" } as React.CSSProperties}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Master Enrollment Dashboard</h1>
        <p className="text-base leading-tight font-bold text-foreground">
          Classes Ongoing (Late Enrollment) • {ayLabel}
        </p>
      </div>

      <Alert style={{ backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }}>
        <AlertTitle className="font-black" style={{ color: "#1E3A8A" }}>Academic Phase: Classes Ongoing</AlertTitle>
        <AlertDescription className="font-bold" style={{ color: "#1E3A8A" }}>
          Regular BOSY enrollment is closed. All incoming applications are now automatically tagged and itemized as Late Enrollees.
        </AlertDescription>
      </Alert>

      {stats?.v85Stats?.hasSectionLoadDisparity && (
        <Alert style={{ backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }}>
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <AlertTitle className="font-black text-amber-900">
              Section Load Disparity Alert
            </AlertTitle>
            <AlertDescription className="text-amber-700 font-bold">
              There is an active student headcount disparity greater than 5 learners within a grade level. Perform a serpentine load rebalancing to optimize advisory workloads.{" "}
              <button
                onClick={() => navigate("/monitoring/enrollment?tab=sectioning")}
                className="underline font-black cursor-pointer hover:text-amber-800"
              >
                Go to Sectioning
              </button>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {stats?.v85Stats?.isTemporaryAdmissionExpired && stats?.v85Stats?.expiredTemporaryAdmissionsCount > 0 && (
        <Alert style={{ backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" }}>
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <AlertTitle className="font-black text-rose-955">
              Expired Temporary Admissions Detected
            </AlertTitle>
            <AlertDescription className="text-rose-700 font-bold">
              There are {stats?.v85Stats?.expiredTemporaryAdmissionsCount} learners currently enrolled temporarily whose doc submission deadline (October 31) has expired. Follow up or flag these accounts.{" "}
              <button
                onClick={() => navigate("/monitoring/enrollment?tab=verification")}
                className="underline font-black cursor-pointer hover:text-rose-800"
              >
                Go to Verification Workspace
              </button>
            </AlertDescription>
          </div>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Late Enrollees to Process</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-black text-primary">
              <AnimatedNumber value={pendingTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                Appends to SF1 Bottom
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
              <button
                onClick={() => navigate("/monitoring/enrollment?tab=verification")}
                className="text-sm font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                style={{ color: "hsl(var(--primary))" }}
              >
                Process Late Admissions &rarr;
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Pending Form 137 (SF10)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-black text-primary">
              <AnimatedNumber value={unassignedTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                Awaiting SF10 (In) | Requested (Out)
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
                Manage Transfer Records &rarr;
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Overdue Documents</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-black text-primary">
              <AnimatedNumber value={deficientTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                Unresolved August Deficiencies
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
                Follow-up Missing Hardcopies &rarr;
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col w-full">
        <CardContent className="px-3 sm:px-6 py-8 flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-base sm:text-lg font-bold text-foreground">Active School Tally</h3>
            <div className="text-5xl sm:text-6xl font-black" style={{ color: "hsl(var(--primary))" }}>
              <AnimatedNumber value={(stats?.v85Stats?.activeSchoolTallyBOSY ?? 0) + (stats?.v85Stats?.activeSchoolTallyLate ?? 0)} />
            </div>
            <p className="text-sm font-semibold text-foreground">{stats?.v85Stats?.activeSchoolTallyBOSY ?? 0} Official BOSY Baseline • +{stats?.v85Stats?.activeSchoolTallyLate ?? 0} Appended Late Enrollees</p>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-4 border-t pt-4">
            {Array.of(7, 8, 9, 10).map((grade, idx) => {
              const b = stats?.gradeLevelBreakdown?.at(idx);
              return (
                <div key={grade} className="text-center">
                  <p className="text-sm font-semibold text-foreground mb-1">Grade {grade}</p>
                  <p className="text-2xl font-bold text-foreground">
                    <AnimatedNumber value={b?.current ?? 0} />
                  </p>
                  <p className="text-xs text-foreground mt-1 font-medium">(+{b?.late ?? 0} Late | -{b?.dropped ?? 0} Dropped)</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>




    </div>
  );
}
