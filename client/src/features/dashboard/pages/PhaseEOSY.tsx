import { useNavigate } from "react-router";
import { ArrowRight, Check, Award, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/shared/ui/alert";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
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
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold bg-muted text-foreground">
                Advisers Must Submit EOSY Grades
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              {eosyPendingSections > 0 ? (
                <Button variant="outline" onClick={() => navigate("/eosy?status=pending")} className="">
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
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold bg-muted text-foreground">
                JHS Completers & Promoted
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              <div className="inline-flex items-center justify-center rounded-md text-sm  h-9 px-4 py-2 text-foreground bg-muted font-bold">
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
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold bg-muted text-foreground">
                Conditional Promoted | Retained
              </span>
            </div>
            <div className="mt-4 flex justify-end mt-auto pt-4">
              <div className="inline-flex items-center justify-center rounded-md text-sm  h-9 px-4 py-2 text-foreground bg-muted font-bold">
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
              <p className="text-sm font-bold text-foreground">{eosyFinalizedSections} of {totalSections} Sections Officially Closed</p>
            </div>

            <div className="w-full max-w-md mx-auto mt-6 bg-neutral-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-1000"
                style={{ width: `${finalizationPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-col w-full overflow-hidden">
        <h3 className="text-base sm:text-lg font-extrabold text-foreground mb-4 pl-1">
          Grade Level Finalization Status
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {((stats?.eosyStats?.gradeLevelFinalization ?? []) as Array<{ id: number; name: string; total: number; finalized: number; percent: number }>).map((g) => {
            const gradeNumStr = g.name.replace(/Grade\s+/i, "").trim();
            return (
              <div
                key={g.id}
                onClick={() => navigate(`/eosy?gradeLevelId=${g.id}&status=pending`)}
                className={cn(
                  "text-center p-5 rounded-md border shadow-sm flex flex-col justify-center transition-all cursor-pointer hover:opacity-80 active:scale-[0.98]",
                  getGradeLevelBadgeStyles(gradeNumStr)
                )}
              >
                <p className="font-extrabold mb-1 uppercase tracking-wider opacity-90">{g.name}</p>
                <p className="text-4xl sm:text-5xl font-black drop-shadow-sm mb-1">
                  <AnimatedNumber value={g.percent} />%
                </p>
                <div className="flex flex-col items-center mt-4 pt-4 border-t border-current/20 w-full">
                  <span className="text-sm font-extrabold uppercase tracking-wider mb-2">
                    {g.finalized} / {g.total} Sections
                  </span>
                  <div className="w-full bg-current/20 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-current h-full transition-all duration-500 opacity-90"
                      style={{ width: `${g.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

