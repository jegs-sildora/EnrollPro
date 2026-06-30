import { useNavigate } from "react-router";
import { ArrowRight, Check, Award, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import type { DashboardStats } from "../types";

export function PhaseEOSY({ stats }: { stats: DashboardStats }) {
  const { ayLabel } = useSchoolYearContext();
  const navigate = useNavigate();

  const eosyFinalizedSections = stats?.eosyStats?.eosyFinalizedSections ?? 0;
  const eosyPendingSections = stats?.eosyStats?.eosyPendingSections ?? 0;
  const promotedTotal = stats?.eosyStats?.promotedTotal ?? 0;
  const retainedTotal = stats?.eosyStats?.retainedTotal ?? 0;
  const irregularTotal = stats?.eosyStats?.irregularTotal ?? 0;

  const totalSections = eosyFinalizedSections + eosyPendingSections;
  const finalizationPercent = totalSections === 0 ? 0 : Math.round((eosyFinalizedSections / totalSections) * 100);

  return (
    <div className="space-y-6 pb-6" style={{ "--element-track": "340 40% 96%" } as React.CSSProperties}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Master Enrollment Dashboard</h1>
        <p className="text-base leading-tight font-extrabold text-foreground">
          End of School Year (EOSY) Closing • {ayLabel}
        </p>
      </div>

      <Alert style={{ backgroundColor: "#FDF2F8", borderColor: "#FBCFE8" }}>
        <AlertTitle className="font-extrabold" style={{ color: "#831843" }}>Academic Phase: EOSY Closing</AlertTitle>
        <AlertDescription className="font-extrabold" style={{ color: "#831843" }}>
          The school year is closing. Please ensure all class advisers encode final grades and finalize their sections for the official LIS export.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">Sections Pending Finalization</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: "hsl(340, 60%, 50%)" }}>
              <AnimatedNumber value={eosyPendingSections} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                Advisers Must Submit EOSY Grades
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {eosyPendingSections > 0 ? (
                <Button variant="outline" onClick={() => navigate("/academic-year/sections")} className="">
                  Monitor Sections <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <div className="inline-flex items-center justify-center rounded-md text-sm  h-9 px-4 py-2 text-foreground bg-muted">
                  <Check className="w-4 h-4 mr-2" /> All Finalized
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">Successfully Promoted</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-green-600">
              <AnimatedNumber value={promotedTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                JHS Completers & Promoted
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              <div className="inline-flex items-center justify-center rounded-md text-sm  h-9 px-4 py-2 text-foreground bg-muted">
                <Award className="w-4 h-4 mr-2" /> Ready for Next Year
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col">
          <CardHeader className="px-3 sm:px-6 pb-2">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">Needs Academic Review</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 flex flex-col flex-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-600">
              <AnimatedNumber value={irregularTotal + retainedTotal} />
            </div>
            <div className="mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                Conditional Promoted | Retained
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              <div className="inline-flex items-center justify-center rounded-md text-sm  h-9 px-4 py-2 text-foreground bg-muted">
                <AlertTriangle className="w-4 h-4 mr-2" /> Requires Guidance
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] lg:col-span-5 flex flex-col">
          <CardContent className="px-3 sm:px-6 py-8 flex-1 flex flex-col justify-center">
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-base sm:text-lg font-extrabold text-foreground">EOSY Finalization Progress</h3>
              <div className="text-5xl sm:text-6xl font-extrabold" style={{ color: "hsl(var(--primary))" }}>
                {finalizationPercent}%
              </div>
              <p className="text-sm font-semibold text-foreground">{eosyFinalizedSections} of {totalSections} Sections Officially Closed</p>
            </div>

            <div className="w-full max-w-md mx-auto mt-6 bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-1000"
                style={{ width: `${finalizationPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        {/* Grade Level Masterlist Finalization progress bars */}
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="px-3 sm:px-6 pb-2 text-left">
            <CardTitle className="text-base sm:text-lg font-extrabold text-foreground">
              Grade Level Finalization Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-6 space-y-6 flex flex-col justify-center">
            {((stats?.eosyStats?.gradeLevelFinalization ?? new Array()) as Array<{ id: number; name: string; total: number; finalized: number; percent: number }>).map((g) => (
              <div key={g.id} className="space-y-2 text-left">
                <div className="flex justify-between text-sm font-extrabold text-foreground">
                  <span>{g.name}</span>
                  <span>
                    {g.finalized} / {g.total} Sections ({g.percent}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-500"
                    style={{ width: `${g.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

