import { AlertTriangle, Award, Check, ClipboardCheck, FileCheck2, GraduationCap } from "lucide-react"
import { useNavigate, Link } from "react-router"
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
  const readiness = stats.eosyReadiness
  const academicReview = readiness.conditionallyPromoted + readiness.retained

  return (
    <div className="space-y-4">
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
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="text-base font-extrabold">
            Rollover Readiness Checklist
          </CardTitle>
          <p className="font-semibold text-foreground">
            All requirements must be satisfied before transitioning to the next school year
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/eosy?status=pending" className="flex items-start gap-4 rounded-lg p-3 -m-3 transition-colors hover:bg-slate-50 cursor-pointer">
              <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${readiness.pendingSections === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {readiness.pendingSections === 0 ? <Check className="size-4" strokeWidth={3} /> : <AlertTriangle className="size-4" strokeWidth={3} />}
              </div>
              <div>
                <p className="font-bold text-foreground">Section Finalization</p>
                <p className="font-semibold text-foreground">All class advisers must submit and finalize their EOSY records</p>
              </div>
            </Link>

            <Link to="/eosy" className="flex items-start gap-4 rounded-lg p-3 -m-3 transition-colors hover:bg-slate-50 cursor-pointer">
              <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${readiness.incompleteLearnerOutcomes === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {readiness.incompleteLearnerOutcomes === 0 ? <Check className="size-4" strokeWidth={3} /> : <AlertTriangle className="size-4" strokeWidth={3} />}
              </div>
              <div>
                <p className="font-bold text-foreground">SMART Grade Synchronization</p>
                <p className="font-semibold text-foreground">All learner outcomes must be resolved and synced</p>
              </div>
            </Link>

            <Link to="/eosy" className="flex items-start gap-4 rounded-lg p-3 -m-3 transition-colors hover:bg-slate-50 cursor-pointer">
              <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${readiness.sf5Ready && readiness.sf6Ready ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {readiness.sf5Ready && readiness.sf6Ready ? <Check className="size-4" strokeWidth={3} /> : <AlertTriangle className="size-4" strokeWidth={3} />}
              </div>
              <div>
                <p className="font-bold text-foreground">School Form Generation</p>
                <p className="font-semibold text-foreground">School Forms 5 and 6 must be ready for review</p>
              </div>
            </Link>

            <Link to="/settings" className="flex items-start gap-4 rounded-lg p-3 -m-3 transition-colors hover:bg-slate-50 cursor-pointer">
              <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${readiness.calendarPolicyApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {readiness.calendarPolicyApproved ? <Check className="size-4" strokeWidth={3} /> : <AlertTriangle className="size-4" strokeWidth={3} />}
              </div>
              <div>
                <p className="font-bold text-foreground">Calendar Policy Approval</p>
                <p className="font-semibold text-foreground">School year calendar policies must be approved</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.eosyStats.gradeLevelFinalization.map((grade) => (
          <Card 
            key={grade.id} 
            className="border-slate-200 bg-card shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => navigate(`/eosy?gradeLevelId=${grade.id}&status=pending`)}
          >
            <CardContent className="flex min-h-32 flex-col justify-center gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-extrabold leading-tight text-foreground">{grade.name}</p>
                <span className="text-lg font-black leading-none text-primary">{grade.percent}%</span>
              </div>
              <Progress value={grade.percent} className="h-2" />
              <p className="mt-2 text-base font-semibold text-foreground">
                {grade.finalized} of {grade.total} sections finalized
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

    </div>
  )
}
