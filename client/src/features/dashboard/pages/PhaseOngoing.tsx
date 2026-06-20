import { useNavigate } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";

export function PhaseOngoing({ stats }: { stats: any }) {
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
        <AlertTitle className="font-bold" style={{ color: "#1E3A8A" }}>Academic Phase: Classes Ongoing</AlertTitle>
        <AlertDescription className="font-medium" style={{ color: "#1E3A8A" }}>
          Regular BOSY enrollment is closed. All incoming applications are now automatically tagged and itemized as Late Enrollees.
        </AlertDescription>
      </Alert>
      
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
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                Appends to SF1 Bottom
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {pendingTotal > 0 ? (
                <Button variant="outline" onClick={() => navigate("/admission/queue")} className="font-medium">
                  Process Late Admissions <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 text-muted-foreground bg-muted">
                  <Check className="w-4 h-4 mr-2" /> Queue Cleared
                </div>
              )}
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
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                Awaiting SF10 (In) | Requested (Out)
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {unassignedTotal > 0 ? (
                <Button variant="outline" onClick={() => navigate("/enrollment/sectioning")} className="font-medium">
                  Manage Transfer Records <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 text-muted-foreground bg-muted">
                  <Check className="w-4 h-4 mr-2" /> Queue Cleared
                </div>
              )}
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
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                Unresolved August Deficiencies
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {deficientTotal > 0 ? (
                <Button variant="outline" onClick={() => navigate("/admission/queue")} className="font-medium">
                  Follow-up Missing Hardcopies <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <div className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 text-muted-foreground bg-muted">
                  <Check className="w-4 h-4 mr-2" /> Queue Cleared
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] lg:col-span-3 flex flex-col">
          <CardContent className="px-3 sm:px-6 py-8 flex-1 flex flex-col justify-center">
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-base sm:text-lg font-bold text-foreground">Active School Tally</h3>
              <div className="text-5xl sm:text-6xl font-black" style={{ color: "hsl(var(--primary))" }}>
                <AnimatedNumber value={(stats?.v85Stats?.activeSchoolTallyBOSY ?? 0) + (stats?.v85Stats?.activeSchoolTallyLate ?? 0)} />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{stats?.v85Stats?.activeSchoolTallyBOSY ?? 0} Official BOSY Baseline • +{stats?.v85Stats?.activeSchoolTallyLate ?? 0} Appended Late Enrollees</p>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4 border-t pt-4">
              {[7, 8, 9, 10].map((grade, idx) => {
                const b = stats?.gradeLevelBreakdown?.[idx];
                return (
                  <div key={grade} className="text-center">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Grade {grade}</p>
                    <p className="text-2xl font-bold text-foreground">
                      <AnimatedNumber value={b?.current ?? 0} />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">(+{b?.late ?? 0} Late | -{b?.dropped ?? 0} Dropped)</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] lg:col-span-2 flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Monthly Student Movement (SF4)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex-1 flex flex-col justify-center">
            <div className="w-full space-y-6">
              
              <div className="flex flex-row justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Transferred In (Move In)</span>
                <span className="text-xl font-bold text-green-600">
                  +{stats?.v85Stats?.sf4Vitals?.transferredIn ?? 0}
                </span>
              </div>
              
              <div className="flex flex-row justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Transferred Out (Move Out)</span>
                <span className="text-xl font-bold text-slate-500">
                  -{stats?.v85Stats?.sf4Vitals?.transferredOut ?? 0}
                </span>
              </div>
              
              <div className="flex flex-row justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Dropped Out (Left School)</span>
                <span className="text-xl font-bold text-gray-400">
                  {stats?.v85Stats?.sf4Vitals?.droppedOut ?? 0}
                </span>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
