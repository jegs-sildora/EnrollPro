import type { ReactNode } from "react"
import { useNavigate } from "react-router"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckSquare,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Presentation,
  RefreshCw,
  School,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"
import { AnimatedNumber } from "@/shared/components/AnimatedNumber"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { Progress } from "@/shared/ui/progress"
import { Badge } from "@/shared/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip"
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils"
import { useAuthStore } from "@/store/auth.slice"
import { useSettingsStore } from "@/store/settings.slice"
import type { DashboardStats } from "../types"

type DashboardPhase =
  | "ENROLLMENT_OPERATIONS"
  | "CLASSES_ONGOING"
  | "EOSY_CLOSING"

interface DashboardSummaryRibbonProps {
  summary: DashboardStats["summaryRibbon"]
}

const SUMMARY_ITEMS = [
  {
    key: "totalEnrollment" as const,
    label: "Total Enrolled Learners",
    helper: "Officially enrolled learners assigned to a valid class section",
    icon: GraduationCap,
    route: "/students",
  },
  {
    key: "activeFaculty" as const,
    label: "Active Faculty and Staff",
    helper: "Personnel currently in active service",
    icon: Presentation,
    route: "/teachers",
  },
  {
    key: "enrolledSections" as const,
    label: "Sections with Learners",
    helper: "Sections with active learners",
    icon: School,
    route: "/sections",
  },
  {
    key: "pendingSystemValidations" as const,
    label: "Learner Records for Review",
    helper: "Learners counted once even with several concerns",
    icon: ShieldCheck,
    route: "/continuing-learners",
  },
]

export function DashboardSummaryRibbon({
  summary,
}: DashboardSummaryRibbonProps) {
  const navigate = useNavigate()

  return (
    <section
      aria-label="School operations summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {SUMMARY_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <Card 
            key={item.key} 
            className="border-slate-200 bg-card shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => navigate(item.route)}
          >
            <CardContent className="flex min-h-32 items-center gap-4 p-5">
              <div className="min-w-0">
                <p className="text-base font-extrabold leading-tight text-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-3xl font-black leading-none text-primary">
                  <AnimatedNumber value={summary[item.key]} />
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {item.helper}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

interface DashboardActionToolbarProps {
  phase: DashboardPhase
  isArchived: boolean
}

export function DashboardActionToolbar({
  phase,
  isArchived,
}: DashboardActionToolbarProps) {
  const navigate = useNavigate()
  const roles = useAuthStore((state) => state.user?.roles ?? [])
  const canManageEnrollment = roles.some((role) =>
    ["HEAD_REGISTRAR", "SYSTEM_ADMIN"].includes(role),
  )
  const canManageSectioning = roles.some((role) =>
    ["HEAD_REGISTRAR", "SYSTEM_ADMIN"].includes(role),
  )
  const isEosy = phase === "EOSY_CLOSING"
  const intakeLocked = isArchived || isEosy

  if (isArchived) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-card px-4 py-3 text-base font-bold text-foreground shadow-sm">
        <ShieldCheck className="size-4 text-primary" />
        Historical school year records are read-only.
      </div>
    )
  }

  return (
    <section
      aria-label="Dashboard quick actions"
      className="flex flex-col gap-2 rounded-md border border-slate-200 bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex-1 min-w-0 lg:pr-2">
        <p className="text-base font-extrabold text-foreground">
          Quick Actions
        </p>
        <p className="text-base font-semibold text-foreground">
          {isEosy
            ? "End of School Year processing is active. Please ensure all final grades and promotion outcomes are synced before initiating the database rollover."
            : "Open common school year \ tasks for this school year."}
        </p>
      </div>

      <div
        className={cn(
          "mt-4 grid w-full shrink-0 gap-2 lg:mt-0",
          isEosy ? "grid-cols-1 lg:w-auto" : "grid-cols-2 lg:w-[450px]"
        )}
      >
        {!isEosy && (
          <Button
            variant="outline"
            disabled={intakeLocked || !canManageEnrollment}
            onClick={() =>
              navigate("/continuing-learners?tab=incoming&action=walk-in")
            }
            className="w-full justify-center hover:bg-primary hover:text-primary-foreground"
          >
            <UserPlus className="mr-2 size-4" />
            {phase === "CLASSES_ONGOING"
              ? "Encode Late Walk-In"
              : "Walk-In Enrollment"}
          </Button>
        )}

        {!isEosy && (
          <Button
            variant="outline"
            disabled={intakeLocked || !canManageSectioning}
            onClick={() => navigate("/monitoring/enrollment")}
            className="w-full justify-center hover:bg-primary hover:text-primary-foreground"
          >
            <Users className="mr-2 size-4" />
            Auto Assign Sections
          </Button>
        )}

        {isEosy && (
          <Button
            onClick={() => navigate("/eosy")}
            className="w-full justify-center hover:bg-primary/90"
          >
            <ClipboardCheck className="mr-2 size-4" />
            Monitor Final Grades
          </Button>
        )}
      </div>
    </section>
  )
}

interface OperationalQueueCardProps {
  title: string
  value: number
  detail: string
  zeroLabel: string
  actionLabel: string
  onAction: () => void
  icon?: ReactNode
  warning?: boolean
}

export function OperationalQueueCard({
  title,
  value,
  detail,
  zeroLabel,
  actionLabel,
  onAction,
  icon,
  warning = false,
}: OperationalQueueCardProps) {
  const isClear = value === 0
  return (
    <Card
      className={cn(
        "flex h-full flex-col border-slate-200 bg-card shadow-sm",
        warning && !isClear && "border-amber-300",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-base font-extrabold">{title}</CardTitle>
          <p className="mt-1 text-base font-semibold text-foreground">
            {detail}
          </p>
        </div>
        {icon}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-1">
        <p
          className={cn(
            "text-4xl font-black",
            isClear ? "text-foreground" : warning ? "text-destructive" : "text-primary",
          )}
        >
          <AnimatedNumber value={value} />
        </p>
        <div className="mt-5 flex flex-1 flex-col justify-end gap-3 border-t border-slate-100 pt-4">
          <p
            className={cn(
              "flex min-h-5 items-center gap-2 text-base font-bold",
              isClear ? "text-emerald-700" : "text-foreground",
            )}
          >
            {isClear && <Check className="size-4" />}
            {isClear ? zeroLabel : `${value} record${value === 1 ? "" : "s"} require action`}
          </p>
          <Button variant="outline" onClick={onAction} className="w-full justify-between hover:bg-primary hover:text-primary-foreground">
            {actionLabel}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function CurriculumDistributionPanel({
  items,
  total,
}: {
  items: DashboardStats["curriculumDistribution"]
  total: number
}) {
  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore()

  const ALL_PROGRAMS = [
    { programType: "REGULAR", acronym: "BEC", label: "Basic Education Curriculum", isSpecialProgram: false },
    ...(steEnabled ? [{ programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", acronym: "STE", label: "Science Technology and Engineering", isSpecialProgram: true }] : []),
    ...(spaEnabled ? [{ programType: "SPECIAL_PROGRAM_IN_THE_ARTS", acronym: "SPA", label: "Special Program in the Arts", isSpecialProgram: true }] : []),
    ...(spsEnabled ? [{ programType: "SPECIAL_PROGRAM_IN_SPORTS", acronym: "SPS", label: "Special Program in Sports", isSpecialProgram: true }] : []),
  ]
  const visibleItems = [
    ...ALL_PROGRAMS.map(prog => {
      const found = items.find(i => i.programType === prog.programType)
      return found || { ...prog, count: 0 }
    }),
    ...items.filter(i => !ALL_PROGRAMS.some(prog => prog.programType === i.programType))
  ]

  return (
    <Card className="flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-extrabold">
          Learners by Curriculum Program
        </CardTitle>
        <p className="text-base font-semibold text-foreground">
          Enrolled learners grouped by their current curriculum program.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center space-y-6">
        {visibleItems.map((item) => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0
          return (
            <div key={item.programType} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-base">
                <span className="min-w-0 truncate font-bold">
                  {/* @ts-expect-error - Expected acronym might not be present */}
                  {item.acronym && <span className="font-extrabold">{item.acronym}</span>}
                  {/* @ts-expect-error - Expected acronym might not be present */}
                  {item.acronym && <span className="mx-1">|</span>}
                  {item.label}
                </span>
                <span className="shrink-0">
                  <span className="font-extrabold text-primary">{item.count} Learners</span>
                  {item.count > 0 && <span className="text-foreground ml-1">({percentage}%)</span>}
                </span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function IntakePipelinePanel({
  rows,
}: {
  rows: DashboardStats["intakePipeline"]
}) {
  return (
    <Card className="flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-extrabold">
          Enrollment Records by Grade
        </CardTitle>
        <p className="text-base font-semibold text-foreground">
          Continuing or promoted learners, new entrants, and transferees for each grade level.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center p-6 pt-0 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-0 text-base">
            <thead>
              <tr className="border-b border-slate-200 text-left text-base uppercase text-foreground">
                <th className="py-2 px-1 font-extrabold sticky left-0 bg-card z-20 whitespace-nowrap border-r border-slate-200 text-center">Grade</th>
                <th className="px-1 py-2 text-center font-extrabold leading-tight">Continuing or Promoted</th>
                <th className="px-1 py-2 text-center font-extrabold leading-tight">New Entrants</th>
                <th className="px-1 py-2 text-center font-extrabold">Transferees</th>
                <th className="px-1 py-2 text-center font-extrabold whitespace-normal leading-tight w-24">Returning / ALS / OSCYA</th>
                <th className="pl-1 py-2 text-center font-extrabold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.gradeLevelId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="py-3 px-1 font-extrabold sticky left-0 bg-card z-20 whitespace-nowrap border-r border-slate-200">
                    <span className={cn("inline-block whitespace-nowrap rounded-md border px-2 py-1 text-sm", getGradeLevelBadgeStyles(row.gradeLevelName))}>
                      {row.gradeLevelName}
                    </span>
                  </td>
                  <td className="px-1 py-3 text-center font-bold">{row.continuingLearners}</td>
                  <td className="px-1 py-3 text-center font-bold">{row.newEntrants}</td>
                  <td className="px-1 py-3 text-center font-bold">{row.transferee}</td>
                  <td className="px-1 py-3 text-center font-bold">{row.returningLearners}</td>
                  <td className="pl-1 py-3 text-center font-black text-primary">
                    {row.continuingLearners + row.newEntrants + row.transferee + row.returningLearners}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function SectionSaturationPanel({
  sections,
  onReview,
}: {
  sections: DashboardStats["sectionSaturation"]
  onReview: () => void
}) {
  const navigate = useNavigate()

  const SCP_SHORT_LABELS: Record<string, string> = {
    REGULAR: "BEC",
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
    SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
    SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  }

  const PROGRAM_FULL_LABELS: Record<string, string> = {
    REGULAR: "Basic Education Curriculum",
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology, and Engineering",
    SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
    SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  }

  const visibleSections = [...sections]
    .sort((a, b) => b.enrolled - a.enrolled)
    .filter(
      (section, index, self) =>
        self.findIndex((s) => s.gradeLevelName === section.gradeLevelName) === index,
    )
    .sort((a, b) => {
      const getGradeNum = (name: string) => parseInt(name.replace(/\D/g, ""), 10) || 0
      return getGradeNum(a.gradeLevelName) - getGradeNum(b.gradeLevelName)
    })
    .slice(0, 4)

  return (
    <Card className="flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base font-extrabold">
            Class Section Capacity
          </CardTitle>
          <p className="mt-1 text-base font-semibold text-foreground">
            Highest seat occupancy per grade level
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center space-y-3">
          {visibleSections.length === 0 ? (
            <div className="flex flex-1 min-h-[250px] flex-col items-center justify-center rounded-md border border-dashed border-slate-200 p-5 text-center text-base font-bold text-foreground">
              No class sections are configured for this school year.
            </div>
          ) : (
            <TooltipProvider>
              {visibleSections.map((section) => (
                <div
                  key={section.id}
                  onClick={() => navigate(`/sections/view-masterlist/${section.id}`)}
                  className="rounded-md border border-slate-200 p-3 hover:bg-slate-50 hover:cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-extrabold">
                          {section.gradeLevelName} - {section.name}
                        </p>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant="outline"
                              className="text-sm font-extrabold uppercase bg-background text-primary border-primary/30"
                            >
                              {SCP_SHORT_LABELS[section.programType] ?? section.programType}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold text-sm">
                              {PROGRAM_FULL_LABELS[section.programType] ?? section.programType}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-base font-semibold text-foreground">
                        {section.enrolled} of {section.capacity} learners
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-base font-black",
                        section.isOverCapacity ? "text-red-700" : "text-foreground",
                      )}
                    >
                      {section.utilizationPercent}%
                    </span>
                  </div>
                  <Progress
                    value={section.utilizationPercent}
                    className={cn(
                      "mt-2 h-2",
                      section.isOverCapacity && "bg-red-200 [&>div]:bg-red-700",
                    )}
                  />
                </div>
              ))}
            </TooltipProvider>
          )}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground" onClick={onReview}>
            Review Class Sections
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function Sf1CompliancePanel({
  compliance,
  onReview,
}: {
  compliance: DashboardStats["sf1Compliance"]
  onReview: () => void
}) {
  const items = [
    ["Invalid or missing LRN", compliance.invalidLrn],
    ["Missing birthdate", compliance.missingBirthdate],
    ["Missing mother tongue", compliance.missingMotherTongue],
    ["Missing current address", compliance.missingCurrentAddress],
    ["Missing parent or guardian contact", compliance.missingGuardianContact],
  ] as const
  const isComplete = compliance.affectedLearners === 0

  return (
    <Card className="flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base font-extrabold">
            SF1 Learner Information Check
          </CardTitle>
          <p className="mt-1 text-base font-semibold text-foreground">
            Learner information required for School Form 1.
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-base font-extrabold",
            isComplete
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800",
          )}
        >
          {isComplete ? "Records Complete" : `${compliance.affectedLearners} Learners`}
        </span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-col space-y-2">
          {items.map(([label, value]) => (
            <div
              key={label}
              className="flex h-[76px] items-center justify-between gap-4 rounded-md border border-slate-100 px-3 py-2.5 text-base"
            >
              <span className="font-bold text-foreground">{label}</span>
              <span
                className={cn(
                  "font-black text-2xl",
                  value > 0 ? "text-destructive" : "text-primary",
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <Button variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground" onClick={onReview}>
            Review Learner Directory
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ActiveTallyPanel({
  tally,
}: {
  tally: DashboardStats["activeTally"]
}) {
  const formula = [
    ["Verified BOSY Enrollment", tally.verifiedBosyBaseline, "+"],
    ["Late Enrollees Added to SF1", tally.lateAdmissions, "+"],
    ["Officially Dropped Learners", tally.officiallyDropped, "-"],
  ] as const

  return (
    <Card className="border-slate-200 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-extrabold">
          Current Enrollment Count
        </CardTitle>
        <p className="text-base font-semibold text-foreground">
          BOSY enrollment plus late enrollees, minus officially dropped learners.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {formula.map(([label, value, operator], index) => (
            <div key={label} className="relative rounded-md border border-slate-200 p-4">
              {index > 0 && (
                <span className="absolute -left-3 top-1/2 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-base font-black sm:flex">
                  {operator}
                </span>
              )}
              <p className="text-base font-bold text-foreground">{label}</p>
              <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md bg-primary px-5 py-4 text-primary-foreground">
          <span className="font-extrabold">Current Active Learner Tally</span>
          <span className="text-3xl font-black">{tally.activeTotal}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function ComplianceWarningIcon({ active }: { active: boolean }) {
  return active
    ? <AlertTriangle className="size-5 text-destructive" />
    : <Check className="size-5 text-emerald-700" />
}
