import type { ReactNode } from "react"
import { useNavigate, Link } from "react-router"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckSquare,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  HelpCircle,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { cn, getGradeLevelBadgeStyles, formatGradeLevel } from "@/shared/lib/utils"
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
    label: "Total Enrollees",
    helper: "Officially enrolled learners assigned to a valid class section",
    icon: GraduationCap,
    route: "/learners",
  },
  {
    key: "activeFaculty" as const,
    label: "Active Personnel",
    helper: "Personnel currently in active service",
    icon: Presentation,
    route: "/personnel",
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
    label: "Records for Review",
    helper: "Learners counted once even with several concerns",
    icon: ShieldCheck,
    route: "/learner-enrollment",
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
        const _Icon = item.icon
        return (
          <Card
            key={item.key}
            className="group border-white/10 bg-white/10 shadow-sm cursor-pointer hover:bg-white/20 transition-colors backdrop-blur-sm"
            onClick={() => navigate(item.route)}
          >
            <CardContent className="flex min-h-24 items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-wider leading-tight text-primary-foreground mb-2">
                    {item.label}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="mt-0.5 text-primary-foreground/70 hover:text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100">
                        <HelpCircle className="size-4" />
                        <span className="sr-only">Help</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs text-primary bg-card">
                        {item.helper}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="mt-1 text-3xl font-black leading-none text-primary-foreground">
                  <AnimatedNumber value={summary[item.key]} />
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
  const roles = useAuthStore((state) => state.user?.roles) ?? [];
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
      className="group flex flex-col gap-2 rounded-md border border-slate-200 bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex-1 min-w-0 lg:pr-2">
        <div className="flex items-center gap-2">
          <p className="text-xl font-extrabold">
            Quick Actions
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center">
                <HelpCircle className="size-4" />
                <span className="sr-only">Help</span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                {isEosy
                  ? "End of School Year processing is active. Please ensure all final grades and promotion outcomes are synced before initiating the database rollover."
                  : "Open common school year tasks for this school year."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 flex w-full shrink-0 gap-2 lg:mt-0 lg:w-auto flex-col sm:flex-row flex-wrap justify-end",
        )}
      >
        {!isEosy && (
          <Button
            variant="outline"
            disabled={intakeLocked || !canManageEnrollment}
            onClick={() =>
              navigate("/learner-admission?action=walk-in-scp")
            }
            className="w-full sm:w-auto justify-center hover:bg-primary hover:text-primary-foreground"
          >
            <UserPlus className="mr-2 size-4" />
            Walk-In SCP Admission
          </Button>
        )}

        {!isEosy && (
          <Button
            variant="outline"
            disabled={intakeLocked || !canManageEnrollment}
            onClick={() =>
              navigate("/learner-enrollment?tab=incoming&action=walk-in")
            }
            className="w-full sm:w-auto justify-center hover:bg-primary hover:text-primary-foreground"
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
            onClick={() => navigate("/section-assignment")}
            className="w-full sm:w-auto justify-center hover:bg-primary hover:text-primary-foreground"
          >
            <Users className="mr-2 size-4" />
            Auto Assign Sections
          </Button>
        )}

        {isEosy && (
          <Button
            variant="outline"
            onClick={() => navigate("/eosy")}
            className="w-full sm:w-auto justify-center hover:bg-primary hover:text-primary-foreground"
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
        "group flex h-full flex-col border-slate-200 bg-card shadow-sm",
        warning && !isClear && "border-amber-300",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-extrabold">{title}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100">
                <HelpCircle className="size-4" />
                <span className="sr-only">Help</span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                {detail}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
  const navigate = useNavigate()

  const ALL_PROGRAMS = [
    { programType: "REGULAR", acronym: "BEC", label: "Basic Education Curriculum", isSpecialProgram: false },
    ...(steEnabled ? [{ programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", acronym: "STE", label: "Science, Technology, and Engineering", isSpecialProgram: true }] : []),
    ...(spaEnabled ? [{ programType: "SPECIAL_PROGRAM_IN_THE_ARTS", acronym: "SPA", label: "Special Program in the Arts", isSpecialProgram: true }] : []),
    ...(spsEnabled ? [{ programType: "SPECIAL_PROGRAM_IN_SPORTS", acronym: "SPS", label: "Special Program in Sports", isSpecialProgram: true }] : []),
  ]
  const visibleItems = [
    ...ALL_PROGRAMS.map(prog => {
      const found = items.find(i => i.programType === prog.programType)
      return found ? { ...prog, count: found.count } : { ...prog, count: 0 }
    }),
    ...items
      .filter(i => !ALL_PROGRAMS.some(prog => prog.programType === i.programType))
      .map(i => ({ ...i, acronym: i.programType }))
  ]

  // User requested to always use the full card UI (with View Roster button)
  // and make it horizontally scrollable if there are more than 2 items.

  return (
    <Card className="group flex h-full flex-col border-slate-200 bg-card shadow-sm p-2">
      <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
        <CardTitle className="text-xl font-extrabold">
          Learners by Curricular Program
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center transition-opacity duration-200">
              <HelpCircle className="size-4" />
              <span className="sr-only">Help</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              Enrolled learners grouped by their current Curricular Program.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      
      <CardContent className="flex flex-1 flex-col justify-center pt-2">
        <div className={cn("gap-4", visibleItems.length > 2 ? "flex overflow-x-auto pb-4 snap-x hide-scrollbar" : "grid grid-cols-1 md:grid-cols-2")}>
          {visibleItems.map((item) => {
            return (
              <Card 
                key={item.programType} 
                className={cn(
                  "flex h-full flex-col transition-colors group/card rounded-lg border bg-card p-5 space-y-4 shadow-sm hover:border-primary/40 cursor-default",
                  visibleItems.length > 2 ? "min-w-[280px] shrink-0 snap-start" : ""
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="min-w-0">
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger className="font-extrabold text-foreground uppercase cursor-help text-2xl border-none bg-transparent p-0 m-0 leading-none">
                          {item.acronym}
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-primary text-primary-foreground">
                          <p className="font-bold text-sm">{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="mt-auto space-y-4">
                  <div className="flex items-center border-t border-border/50 pt-4">
                    <div className="flex flex-col gap-2 w-full">
                      <span className="font-bold uppercase text-foreground mb-0.5 text-center">TOTAL ENROLLEES</span>
                      <span className="text-4xl font-black text-primary tabular-nums text-center">{item.count}</span>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      variant="default" 
                      className="w-full font-bold group-hover/card:bg-primary group-hover/card:text-primary-foreground transition-colors"
                      onClick={() => navigate(`/dashboard/program-roster/${item.programType.toLowerCase()}`)}
                    >
                      View Roster →
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
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
    <Card className="group flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
        <CardTitle className="text-xl font-extrabold">
          Enrollment Records by Grade Level
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100">
              <HelpCircle className="size-4" />
              <span className="sr-only">Help</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              Continuing or promoted learners, new entrants, and transferees for each grade level.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center p-6 pt-0 overflow-hidden">
        <div className="w-full h-full flex">
          <table className="w-full min-w-0 h-full">
            <thead>
              <tr className="border-b border-slate-200 text-center uppercase text-foreground">
                <th className="py-2 px-1 font-bold sticky left-0 bg-card z-20 whitespace-nowrap border-r border-slate-200">Grade</th>
                <th className="px-1 py-2 text-center font-bold leading-tight">Continuing</th>
                <th className="px-1 py-2 text-center font-bold leading-tight">New</th>
                <th className="px-1 py-2 text-center font-bold leading-tight">Transferee</th>
                <th className="px-1 py-2 text-center font-bold leading-tight">Balik-Aral</th>
                <th className="px-1 py-2 text-center font-bold bg-slate-50 border-l border-slate-200 rounded-tr-md">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const total = row.continuingLearners + row.newEntrants + row.transferee + row.returningLearners;
                return (
                  <tr key={row.gradeLevelId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 px-1 font-bold sticky left-0 bg-card z-20 whitespace-nowrap border-r border-slate-200 text-center">
                      <span className={cn("inline-block whitespace-nowrap rounded-md border px-2 py-1", getGradeLevelBadgeStyles(row.gradeLevelName))}>
                        {formatGradeLevel(row.gradeLevelName)}
                      </span>
                    </td>
                    <td className={cn("px-1 py-3 text-center ", row.continuingLearners > 0 ? "font-black text-foreground" : "text-muted-foreground")}>
                      {row.continuingLearners}
                    </td>
                    <td className={cn("px-1 py-3 text-center", row.newEntrants > 0 ? "font-black text-foreground" : "text-muted-foreground")}>
                      {row.newEntrants}
                    </td>
                    <td className={cn("px-1 py-3 text-center", row.transferee > 0 ? "font-black text-foreground" : "text-muted-foreground")}>
                      {row.transferee}
                    </td>
                    <td className={cn("px-1 py-3 text-center", row.returningLearners > 0 ? "font-black text-foreground" : "text-muted-foreground")}>
                      {row.returningLearners}
                    </td>
                    <td className={cn("px-1 py-3 text-center font-black bg-slate-50 border-l border-slate-200", total > 0 ? "text-primary" : "text-muted-foreground")}>
                      {total}
                    </td>
                  </tr>
                );
              })}
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
    <Card className="group flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-extrabold">
            Class Section Capacity
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100">
                <HelpCircle className="size-4" />
                <span className="sr-only">Help</span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                Highest seat occupancy per grade level
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
                  className={cn(
                    "rounded-md border p-3 hover:opacity-80 hover:cursor-pointer transition-opacity",
                    getGradeLevelBadgeStyles(section.gradeLevelName)
                  )}
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
                              className={cn(
                                "text-sm font-bold uppercase",
                                getGradeLevelBadgeStyles(section.gradeLevelName)
                              )}
                            >
                              {SCP_SHORT_LABELS[section.programType] ?? section.programType}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className=" text-sm">
                              {PROGRAM_FULL_LABELS[section.programType] ?? section.programType}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-base font-bold">
                        {section.enrolled} of {section.capacity} learners
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-base font-bold",
                        section.isOverCapacity && "text-red-700",
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
    <Card className="group flex h-full flex-col border-slate-200 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-extrabold">
            SF1 Learner Information Check
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100">
                <HelpCircle className="size-4" />
                <span className="sr-only">Help</span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                Learner information required for School Form 1.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-base font-bold",
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
          {items.map(([label, value]) => {
            const hasLearners = value.count > 0;
            const itemInner = (
              <>
                <span className="font-bold text-foreground">{label}</span>
                <span
                  className={cn(
                    "font-black text-2xl",
                    hasLearners ? "text-destructive" : "text-primary",
                  )}
                >
                  {value.count}
                </span>
              </>
            );

            if (!hasLearners) {
              return (
                <div key={label}>
                  <div className="flex h-[76px] items-center justify-between gap-4 rounded-md border border-slate-100 px-3 py-2.5 text-base">
                    {itemInner}
                  </div>
                </div>
              );
            }

            return (
              <Popover key={label}>
                <PopoverTrigger className="flex h-[76px] w-full items-center justify-between gap-4 rounded-md border border-slate-100 px-3 py-2.5 text-base cursor-pointer hover:bg-slate-50 transition-colors">
                  {itemInner}
                </PopoverTrigger>
                <PopoverContent className="w-80 max-h-[300px] overflow-y-auto p-4" align="start">
                  <h4 className="font-bold mb-3">{label}</h4>
                  <ul className="space-y-2">
                    {value.learners.map((learner, idx) => (
                      <li key={idx} className="flex flex-col text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <span className="font-bold text-foreground">{learner.name}</span>
                        <span className="text-muted-foreground font-medium text-xs">LRN: {learner.lrn}</span>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            );
          })}
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
    ["Verified Enrollees", tally.verifiedBosyBaseline, "+"],
    ["Late Enrollees Added", tally.lateAdmissions, "+"],
    ["Officially Dropped Learners", tally.officiallyDropped, "-"],
  ] as const

  return (
    <Card className="group border-slate-200 bg-card shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
        <CardTitle className="text-xl font-extrabold">
          Current Enrollment Count
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100">
              <HelpCircle className="size-4" />
              <span className="sr-only">Help</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              BOSY enrollment plus late enrollees, minus officially dropped learners.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {formula.map(([label, value, operator], index) => (
            <div key={label} className="relative rounded-md border border-slate-200 p-4">
              {index > 0 && (
                <span className="absolute -left-4 top-1/2 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-base font-bold sm:flex">
                  {operator}
                </span>
              )}
              <p className="text-base font-bold text-foreground">{label}</p>
              <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md bg-primary px-5 py-4 text-primary-foreground">
          <span className="font-bold">Current Active Learner Tally</span>
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
