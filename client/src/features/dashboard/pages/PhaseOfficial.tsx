import { AlertTriangle, ClipboardCheck, School, UserCheck } from "lucide-react"
import { useNavigate } from "react-router"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext"
import {
  ComplianceWarningIcon,
  CurriculumDistributionPanel,
  IntakePipelinePanel,
  OperationalQueueCard,
  SectionSaturationPanel,
  Sf1CompliancePanel,
} from "../components/DashboardCommandCenter"
import type { DashboardStats } from "../types"

function HistoricalSummary({ stats }: { stats: DashboardStats }) {
  const items = [
    {
      title: "Promoted Learners",
      value: stats.historicalSummary.promotedTotal,
      detail: `${stats.historicalSummary.conditionallyPromotedTotal} conditionally promoted and ${stats.historicalSummary.retainedTotal} retained`,
    },
    {
      title: "Official JHS Completers",
      value: stats.historicalSummary.jhsCompletersTotal,
      detail: `${stats.historicalSummary.jhsCompletersMale} male and ${stats.historicalSummary.jhsCompletersFemale} female`,
    },
    {
      title: "Transferred or Dropped",
      value:
        stats.historicalSummary.transferredOutTotal
        + stats.historicalSummary.droppedOutTotal,
      detail: `${stats.historicalSummary.transferredOutTotal} transferred out and ${stats.historicalSummary.droppedOutTotal} dropped`,
    },
  ]

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title} className="border-slate-200 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">{item.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{item.value}</p>
            <p className="mt-3 text-base font-bold text-foreground">
              {item.detail}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

export function PhaseOfficial({ stats }: { stats: DashboardStats }) {
  const navigate = useNavigate()
  const { ayLabel, viewingStatus } = useSchoolYearContext()
  const isArchived = stats.isArchived || viewingStatus === "ARCHIVED"
  const pendingTotal = stats.kpiHeader.pendingTotal
  const unassignedTotal = stats.kpiHeader.unassignedTotal
  const deficientTotal = stats.kpiHeader.deficientTotal

  if (isArchived) {
    return (
      <div className="space-y-4">
        <HistoricalSummary stats={stats} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CurriculumDistributionPanel
            items={stats.curriculumDistribution}
            total={stats.summaryRibbon.totalEnrollment}
          />
          <SectionSaturationPanel
            sections={stats.sectionSaturation}
            onReview={() => navigate("/sections")}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stats.classroomDeficitDetected && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTriangle className="size-5 text-red-700" />
          <AlertTitle className="font-bold">
            Not Enough Section Capacity
          </AlertTitle>
          <AlertDescription className="font-bold">
            Current enrollment is higher than the combined configured section capacity. Review class sections before assigning more learners.
          </AlertDescription>
        </Alert>
      )}

      {(pendingTotal > 0 || unassignedTotal > 0 || deficientTotal > 0) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <OperationalQueueCard
            title="Pending Enrollment"
            value={pendingTotal}
            detail="Learner applications waiting for school verification"
            zeroLabel="No Pending Enrollment Records"
            actionLabel="Process Enrollment Records"
            onAction={() => navigate("/learner-enrollment?tab=incoming")}
          />
          <OperationalQueueCard
            title="Unsectioned Learners"
            value={unassignedTotal}
            detail="Enrolled learners waiting for an SF1 class section"
            zeroLabel="All Enrolled Learners Have Sections"
            actionLabel="Assign Class Sections"
            onAction={() => navigate("/section-assignment")}
          />
          <OperationalQueueCard
            title="Missing School Requirements"
            value={deficientTotal}
            detail="Learners requiring SF9 or PSA document follow-up"
            zeroLabel="All Required Documents Recorded"
            actionLabel="Review Missing Requirements"
            onAction={() => navigate("/learner-enrollment?tab=incoming")}
            warning
          />
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CurriculumDistributionPanel
          items={stats.curriculumDistribution}
          total={stats.summaryRibbon.totalEnrollment}
        />
        <IntakePipelinePanel rows={stats.intakePipeline} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionSaturationPanel
          sections={stats.sectionSaturation}
          onReview={() => navigate("/sections")}
        />
        <Sf1CompliancePanel
          compliance={stats.sf1Compliance}
          onReview={() => navigate("/learners")}
        />
      </section>

    </div>
  )
}
