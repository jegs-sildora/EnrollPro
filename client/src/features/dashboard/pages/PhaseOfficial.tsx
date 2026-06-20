import { useNavigate } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { Progress } from "@/shared/ui/progress";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";

export function PhaseOfficial({ stats }: { stats: any }) {
  const { ayLabel } = useSchoolYearContext();
  const navigate = useNavigate();

  const pendingTotal = stats?.kpiHeader?.pendingTotal ?? 0;
  const unassignedTotal = stats?.kpiHeader?.unassignedTotal ?? 0;
  const deficientTotal = stats?.kpiHeader?.deficientTotal ?? 0;

  return (
    <div className="space-y-6 pb-6" style={{ "--element-track": "210 40% 96%" } as React.CSSProperties}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Master Enrollment Dashboard</h1>
        <p className="text-base leading-tight font-bold text-foreground">
          Beginning of School Year (BOSY) • {ayLabel}
        </p>
      </div>

      <Alert style={{ backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }}>
        <AlertTitle className="font-bold" style={{ color: "#1E3A8A" }}>Academic Phase: Official BOSY Enrollment</AlertTitle>
        <AlertDescription className="font-medium" style={{ color: "#1E3A8A" }}>
          Online registration is live. Approving a new applicant automatically updates your official school master tally below.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">New Enrollees to Check</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-black text-primary">
              <AnimatedNumber value={pendingTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                Incoming Grade 7 | Transferees
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {pendingTotal > 0 ? (
                <Button variant="outline" onClick={() => navigate("/admission/queue")} className="font-medium">
                  Review Applications <ArrowRight className="ml-2 w-4 h-4" />
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
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Needs Class Section</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-black text-primary">
              <AnimatedNumber value={unassignedTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                Unassigned JHS Learners
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {unassignedTotal > 0 ? (
                <Button variant="outline" onClick={() => navigate("/enrollment/sectioning")} className="font-medium">
                  Assign Sections <ArrowRight className="ml-2 w-4 h-4" />
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
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Incomplete Documents</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-black text-primary">
              <AnimatedNumber value={deficientTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                Missing PSA | Missing SF9
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {deficientTotal > 0 ? (
                <Button variant="outline" onClick={() => navigate("/admission/queue")} className="font-medium">
                  Review Uploaded Documents <ArrowRight className="ml-2 w-4 h-4" />
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
              <h3 className="text-base sm:text-lg font-bold text-foreground">Total Official Enrollment</h3>
              <div className="text-5xl sm:text-6xl font-black" style={{ color: "hsl(var(--primary))" }}>
                <AnimatedNumber value={stats?.kpiHeader?.enrolledTotal ?? 0} />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Officially Enrolled JHS Learners</p>
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
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{b?.male ?? 0} M | {b?.female ?? 0} F</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] lg:col-span-2 flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">Critical Sections (Nearing Cap)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex-1 flex flex-col justify-center">
            <div className="w-full space-y-5">
              {stats?.criticalSections?.map((section: any, index: number) => {
                const hardcodedCapacity = 45; // Strict DepEd ceiling
                const percent = Math.round((section.enrolled / hardcodedCapacity) * 100) || 0;
                
                let fillHsl: string | undefined = "215 16% 47%"; // Slate
                if (percent >= 86 && percent <= 99) fillHsl = "38 92% 50%"; // Amber
                else if (percent >= 100) fillHsl = "0 84% 60%"; // Destructive Red
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-foreground">{section.name}</span>
                      <span className="font-bold text-muted-foreground">{section.enrolled} / {hardcodedCapacity}</span>
                    </div>
                    <Progress value={percent} style={{ "--progress-fill": fillHsl } as React.CSSProperties} />
                  </div>
                )
              })}
              {(!stats?.criticalSections || stats.criticalSections.length === 0) && (
                <div className="text-center text-muted-foreground font-medium py-4">No sections available yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
