import { Award, ClipboardCheck, FileCheck2, GraduationCap } from "lucide-react"
import { useNavigate } from "react-router"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Progress } from "@/shared/ui/progress"
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext"
import {
  ComplianceWarningIcon,
  OperationalQueueCard,
} from "../components/DashboardCommandCenter"
import type { DashboardStats } from "../types"

export function PhaseEOSY({ stats }: { stats: DashboardStats }) {
  const navigate = useNavigate()
  const { ayLabel } = useSchoolYearContext()
  const readiness = stats.eosyReadiness
  const academicReview = readiness.conditionallyPromoted + readiness.retained

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-3">
        <p className="text-sm font-extrabold text-slate-900">
          EOSY Closing for S.Y. {ayLabel}
        </p>
        <p className="text-sm font-semibold text-slate-700">
          Enrollment is locked while final grades, promotion outcomes, and official school forms are completed.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OperationalQueueCard
          title="Sections Awaiting Final Review"
          value={readiness.pendingSections}
          detail="Class advisers still completing EOSY records"
          zeroLabel="All Class Sections Finalized"
          actionLabel="Review Class Sections"
          onAction={() => navigate("/eosy?status=pending")}
          icon={<ClipboardCheck className="size-5 text-primary" />}
        />
        <OperationalQueueCard
          title="Incomplete Learner Results"
          value={readiness.incompleteLearnerOutcomes}
          detail="Learners without a final EOSY result"
          zeroLabel="All Learner Outcomes Recorded"
          actionLabel="Review Final Grade Records"
          onAction={() => navigate("/eosy")}
          icon={<ComplianceWarningIcon active={readiness.incompleteLearnerOutcomes > 0} />}
          warning
        />
        <OperationalQueueCard
          title="Learners Needing Academic Review"
          value={academicReview}
          detail="Conditionally promoted and retained learners"
          zeroLabel="No Academic Deficiency Cases"
          actionLabel="Review Academic Outcomes"
          onAction={() => navigate("/eosy")}
          icon={<Award className="size-5 text-primary" />}
          warning
        />
      </section>

      <Card className="border-slate-200 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold">
            EOSY Completion Progress
          </CardTitle>
          <p className="text-sm font-semibold text-muted-foreground">
            Learners with recorded final EOSY outcomes across all grade levels.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-black text-primary">
                {readiness.promotionCompletionPercent}%
              </p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {stats.eosyStats.promotedTotal} promoted, {readiness.conditionallyPromoted} conditionally promoted, and {readiness.retained} retained
              </p>
            </div>
            <GraduationCap className="size-8 text-primary/60" />
          </div>
          <Progress value={readiness.promotionCompletionPercent} className="mt-5 h-3" />
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.eosyStats.gradeLevelFinalization.map((grade) => (
          <button
            type="button"
            key={grade.id}
            onClick={() => navigate(`/eosy?gradeLevelId=${grade.id}&status=pending`)}
            className="rounded-md border border-slate-200 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-extrabold text-foreground">{grade.name}</p>
              <span className="text-lg font-black text-primary">{grade.percent}%</span>
            </div>
            <Progress value={grade.percent} className="my-3 h-2" />
            <p className="text-sm font-bold text-muted-foreground">
              {grade.finalized} of {grade.total} sections finalized
            </p>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-slate-200 bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-extrabold">School Form 5 Readiness</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {readiness.sf5Ready
                  ? "All section and learner outcomes are complete."
                  : "Complete pending sections and learner outcomes first."}
              </p>
            </div>
            <FileCheck2 className={readiness.sf5Ready ? "size-7 text-emerald-700" : "size-7 text-amber-700"} />
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-extrabold">School Form 6 Readiness</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {readiness.sf6Ready
                  ? "School-level promotion totals are ready for review."
                  : "School-level totals remain pending EOSY completion."}
              </p>
            </div>
            <FileCheck2 className={readiness.sf6Ready ? "size-7 text-emerald-700" : "size-7 text-amber-700"} />
          </CardContent>
        </Card>
      </section>

      <div className="flex justify-end">
        <Button className="hover:bg-primary hover:text-primary-foreground" onClick={() => navigate("/eosy")}>Open EOSY Updating</Button>
      </div>
    </div>
  )
}
