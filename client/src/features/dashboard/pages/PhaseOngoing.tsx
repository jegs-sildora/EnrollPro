import { AlertTriangle, School, UserPlus } from "lucide-react"
import { useNavigate } from "react-router"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import {
  ActiveTallyPanel,
  ComplianceWarningIcon,
  OperationalQueueCard,
  SectionSaturationPanel,
  Sf1CompliancePanel,
} from "../components/DashboardCommandCenter"
import type { DashboardStats } from "../types"

export function PhaseOngoing({ stats }: { stats: DashboardStats }) {
  const navigate = useNavigate()
  const lateIntakeCount = stats.v85Stats.lateIntakeCount
  const unassignedTotal = stats.kpiHeader.unassignedTotal
  const overdueDocuments = stats.v85Stats.overdueDocumentsCount
  const overloadedSections = stats.sectionSaturation.filter(
    (section) => section.isOverCapacity,
  ).length

  return (
    <div className="space-y-4">
      {(stats.v85Stats.hasSectionLoadDisparity || overloadedSections > 0) && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTriangle className="size-5 text-amber-700" />
          <AlertTitle className="font-extrabold">
            Class Section Review Required
          </AlertTitle>
          <AlertDescription className="font-semibold">
            {overloadedSections > 0
              ? `${overloadedSections} class section${overloadedSections === 1 ? " exceeds" : "s exceed"} the configured seat limit.`
              : "Learner counts differ by more than five within at least one grade level."}
            {" "}Review section balance before placing additional late enrollees.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OperationalQueueCard
          title="Late Learners to Process"
          value={lateIntakeCount}
          detail="Campus walk-in records awaiting verification"
          zeroLabel="No Late Enrollment Records Pending"
          actionLabel="Process Late Walk-In Records"
          onAction={() => navigate("/continuing-learners?tab=incoming")}
          icon={<UserPlus className="size-5 text-primary" />}
        />
        <OperationalQueueCard
          title="Unsectioned Learners"
          value={unassignedTotal}
          detail="Verified learners not yet listed in an SF1 section"
          zeroLabel="All Enrolled Learners Have Sections"
          actionLabel="Review Class Placement"
          onAction={() => navigate("/monitoring/enrollment")}
          icon={<School className="size-5 text-primary" />}
        />
        <OperationalQueueCard
          title="Missing School Requirements"
          value={overdueDocuments}
          detail="Temporary enrollment requirements still unresolved"
          zeroLabel="All Required Documents Recorded"
          actionLabel="Review Missing Requirements"
          onAction={() => navigate("/continuing-learners?tab=incoming")}
          icon={<ComplianceWarningIcon active={overdueDocuments > 0} />}
          warning
        />
      </section>

      <ActiveTallyPanel tally={stats.activeTally} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionSaturationPanel
          sections={stats.sectionSaturation}
          onReview={() => navigate("/sections")}
        />
        <Sf1CompliancePanel
          compliance={stats.sf1Compliance}
          onReview={() => navigate("/students")}
        />
      </section>

    </div>
  )
}
