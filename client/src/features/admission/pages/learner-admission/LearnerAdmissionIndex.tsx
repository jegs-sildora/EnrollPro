import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ClipboardCheck, Loader2, Search, SlidersHorizontal } from "lucide-react"
import { motion } from "motion/react"
import { sileo } from "sileo"

import api from "@/shared/api/axiosInstance"
import { PaginationBar } from "@/shared/components/PaginationBar"
import { UserPhoto } from "@/shared/components/UserPhoto"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"
import { Checkbox } from "@/shared/ui/checkbox"
import { DataTable } from "@/shared/ui/data-table"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { useHeaderStore } from "@/store/header.slice"
import { useSettingsStore } from "@/store/settings.slice"

type ScpProgram = "SCIENCE_TECHNOLOGY_AND_ENGINEERING" | "SPECIAL_PROGRAM_IN_THE_ARTS" | "SPECIAL_PROGRAM_IN_SPORTS"
type AssessmentResult = "PENDING" | "QUALIFIED" | "DISQUALIFIED"

interface ProgramTab { id: ScpProgram; label: string }
interface Learner {
  id: number
  lrn: string | null
  firstName: string
  lastName: string
  middleName: string | null
  studentPhoto: string | null
}
interface ScpProfile {
  id: number
  hasPassedRequirements: boolean
  hasWrittenExam: boolean
  writtenExamScore: number | null
  hasInterview: boolean
  assessmentResult: AssessmentResult
}
interface Application {
  id: number
  learnerId: number
  schoolYearId: number
  applicantType: ScpProgram
  status: string
  learner: Learner
  scpProfile: ScpProfile | null
}
interface EditState {
  hasPassedRequirements: boolean
  hasWrittenExam: boolean
  writtenExamScore: string
  hasInterview: boolean
}
interface AssessmentUpdate {
  applicationId: number
  hasPassedRequirements: boolean
  hasWrittenExam: boolean
  writtenExamScore: number | null
  hasInterview: boolean
  assessmentResult: AssessmentResult
}
interface BulkAssessmentPayload { updates: AssessmentUpdate[] }

function getInitialEdit(application: Application): EditState {
  return {
    hasPassedRequirements: application.scpProfile?.hasPassedRequirements ?? false,
    hasWrittenExam: application.scpProfile?.hasWrittenExam ?? false,
    writtenExamScore: application.scpProfile?.writtenExamScore?.toString() ?? "",
    hasInterview: application.scpProfile?.hasInterview ?? false,
  }
}

function getComputedResult(hasPassedRequirements: boolean, hasWrittenExam: boolean, hasInterview: boolean): AssessmentResult {
  if (!hasPassedRequirements) return "DISQUALIFIED"
  if (!hasWrittenExam) return "PENDING"
  return hasInterview ? "QUALIFIED" : "DISQUALIFIED"
}

function ResultBadge({ result }: { result: AssessmentResult }) {
  if (result === "QUALIFIED") {
    return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Qualified</Badge>
  }
  if (result === "DISQUALIFIED") return <Badge variant="destructive">Disqualified</Badge>
  return <Badge variant="secondary" className="bg-muted text-muted-foreground">Pending</Badge>
}

export default function LearnerAdmissionIndex() {
  const queryClient = useQueryClient()
  const setTitle = useHeaderStore((state) => state.setTitle)
  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore()
  const [selectedTab, setSelectedTab] = useState<ScpProgram | "">("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)
  const [edits, setEdits] = useState<Record<number, EditState>>({})
  const [assessmentFilter, setAssessmentFilter] = useState<AssessmentResult | "all">("all")
  const [localAssessmentFilter, setLocalAssessmentFilter] = useState<AssessmentResult | "all">("all")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const activePrograms = useMemo<ProgramTab[]>(() => {
    const programs: ProgramTab[] = []
    if (steEnabled) programs.push({ id: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE Applicants" })
    if (spaEnabled) programs.push({ id: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA Applicants" })
    if (spsEnabled) programs.push({ id: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS Applicants" })
    return programs
  }, [spaEnabled, spsEnabled, steEnabled])

  const activeTab = activePrograms.some((program) => program.id === selectedTab)
    ? selectedTab
    : activePrograms[0]?.id ?? ""

  useEffect(() => {
    setTitle("Learner Admission")
    return () => setTitle(null)
  }, [setTitle])

  const { data: applicants = [], isLoading: isFetching } = useQuery<Application[]>({
    queryKey: ["scp-applicants", activeTab],
    queryFn: async () => {
      const { data } = await api.get<Application[]>("/enrollment/scp-applicants", { params: { program: activeTab } })
      return data
    },
    enabled: activeTab !== "",
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: BulkAssessmentPayload) => {
      const { data } = await api.patch<{ message: string; updatedCount: number }>(
        "/enrollment/scp-applicants/bulk-assessment",
        payload,
      )
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["scp-applicants"] })
      setEdits({})
      sileo.success({ title: "Assessments saved", description: "The applicant assessment results are now up to date." })
    },
    onError: () => {
      sileo.error({ title: "Unable to save assessments", description: "Please review the entries and try again." })
    },
  })

  const filteredApplicants = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase()
    return applicants.filter((application) => {
      const fullName = [application.learner.firstName, application.learner.middleName, application.learner.lastName]
        .filter(Boolean).join(" ").toLocaleLowerCase()
      const matchesSearch = !search || fullName.includes(search) || application.learner.lrn?.includes(search) === true
      const edit = edits[application.id]
      const result = edit
        ? getComputedResult(edit.hasPassedRequirements, edit.hasWrittenExam, edit.hasInterview)
        : application.scpProfile?.assessmentResult ?? "PENDING"
      return matchesSearch && (assessmentFilter === "all" || result === assessmentFilter)
    })
  }, [applicants, assessmentFilter, edits, searchTerm])

  const paginatedApplicants = useMemo(() => {
    const start = (page - 1) * limit
    return filteredApplicants.slice(start, start + limit)
  }, [filteredApplicants, limit, page])

  const hasChanges = useMemo(() => {
    return Object.keys(edits).some((id) => {
      const edit = edits[Number(id)]
      const app = applicants.find((a) => a.id === Number(id))
      if (!app) return false
      const initial = getInitialEdit(app)
      return (
        edit.hasWrittenExam !== initial.hasWrittenExam ||
        edit.writtenExamScore !== initial.writtenExamScore ||
        edit.hasInterview !== initial.hasInterview
      )
    })
  }, [edits, applicants])

  const updateEdit = (application: Application, patch: Partial<EditState>) => {
    setEdits((current) => {
      const nextEdit = { ...(current[application.id] ?? getInitialEdit(application)), ...patch }
      if (!nextEdit.hasWrittenExam) {
        nextEdit.writtenExamScore = ""
        nextEdit.hasInterview = false
      }
      return { ...current, [application.id]: nextEdit }
    })
  }

  const columns: ColumnDef<Application>[] = [
    {
      id: "rowNumber",
      size: 70,
      minSize: 70,
      maxSize: 70,
      meta: { className: "text-center", headerClassName: "text-center" },
      header: "#",
      cell: ({ row }) => (page - 1) * limit + row.index + 1,
    },
    {
      id: "applicant",
      size: 380,
      minSize: 300,
      header: "APPLICANT NAME & LRN",
      cell: ({ row }) => {
        const learner = row.original.learner
        return (
          <div className="flex min-w-0 items-center gap-3 py-2 text-left">
            <UserPhoto
              photo={learner.studentPhoto}
              containerClassName="h-12 w-12 shrink-0 rounded-full border-2 border-primary shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate font-bold uppercase text-foreground">
                {learner.lastName}, {learner.firstName}
                {learner.middleName ? ` ${learner.middleName.charAt(0)}.` : ""}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                LRN: {learner.lrn ?? "NO LRN YET"}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      id: "passedRequirements",
      size: 250,
      minSize: 220,
      meta: { className: "text-center", headerClassName: "text-center" },
      header: "PASSED REQUIREMENTS",
      cell: ({ row }) => {
        const application = row.original
        const currentState = edits[application.id] ?? getInitialEdit(application)
        return (
          <div className="flex items-center justify-center gap-2 py-2">
            <Checkbox
              id={`reqs-${application.id}`}
              checked={currentState.hasPassedRequirements}
              onCheckedChange={(checked) => updateEdit(application, { hasPassedRequirements: checked === true })}
            />
            <Label htmlFor={`reqs-${application.id}`} className="cursor-pointer font-bold">Passed</Label>
          </div>
        )
      },
    },
    {
      id: "writtenExam",
      size: 300,
      minSize: 280,
      meta: { className: "text-center", headerClassName: "text-center" },
      header: "WRITTEN EXAM",
      cell: ({ row }) => {
        const application = row.original
        const currentState = edits[application.id] ?? getInitialEdit(application)
        return (
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`exam-${application.id}`}
                checked={currentState.hasWrittenExam}
                disabled={!currentState.hasPassedRequirements}
                onCheckedChange={(checked) => updateEdit(application, { hasWrittenExam: checked === true })}
              />
              <Label
                htmlFor={`exam-${application.id}`}
                className={cn("cursor-pointer font-bold", !currentState.hasPassedRequirements && "opacity-50")}
              >
                Taken
              </Label>
            </div>
            {currentState.hasPassedRequirements && currentState.hasWrittenExam && (
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                aria-label={`Written exam score for ${application.learner.firstName} ${application.learner.lastName}`}
                className="h-9 w-24 bg-background text-center font-bold"
                placeholder="Score"
                value={currentState.writtenExamScore}
                onChange={(event) => updateEdit(application, { writtenExamScore: event.target.value })}
              />
            )}
          </div>
        )
      },
    },
    {
      id: "interview",
      size: 220,
      minSize: 200,
      meta: { className: "text-center", headerClassName: "text-center" },
      header: "INTERVIEW",
      cell: ({ row }) => {
        const application = row.original
        const currentState = edits[application.id] ?? getInitialEdit(application)
        return (
          <div className="flex items-center justify-center gap-2 py-2">
            <Checkbox
              id={`interview-${application.id}`}
              checked={currentState.hasInterview}
              disabled={!currentState.hasPassedRequirements || !currentState.hasWrittenExam}
              onCheckedChange={(checked) => updateEdit(application, { hasInterview: checked === true })}
            />
            <Label
              htmlFor={`interview-${application.id}`}
              className={cn("cursor-pointer font-bold", (!currentState.hasPassedRequirements || !currentState.hasWrittenExam) && "opacity-50")}
            >
              Completed
            </Label>
          </div>
        )
      },
    },
    {
      id: "result",
      size: 190,
      minSize: 170,
      meta: { className: "text-center", headerClassName: "text-center" },
      header: "FINAL RESULT",
      cell: ({ row }) => {
        const application = row.original
        const edit = edits[application.id]
        const result = edit
          ? getComputedResult(edit.hasPassedRequirements, edit.hasWrittenExam, edit.hasInterview)
          : application.scpProfile?.assessmentResult ?? "PENDING"
        return <div className="flex justify-center py-2"><ResultBadge result={result} /></div>
      },
    },
  ]

  const handleSaveBulk = () => {
    const updates = Object.entries(edits).map(([applicationId, edit]) => ({
      applicationId: Number(applicationId),
      hasPassedRequirements: edit.hasPassedRequirements,
      hasWrittenExam: edit.hasWrittenExam,
      writtenExamScore: edit.writtenExamScore === "" ? null : Number(edit.writtenExamScore),
      hasInterview: edit.hasInterview,
      assessmentResult: getComputedResult(edit.hasPassedRequirements, edit.hasWrittenExam, edit.hasInterview),
    } satisfies AssessmentUpdate))

    const hasInvalidScore = updates.some(({ writtenExamScore }) =>
      writtenExamScore !== null && (!Number.isFinite(writtenExamScore) || writtenExamScore < 0 || writtenExamScore > 100),
    )
    if (hasInvalidScore) {
      sileo.error({ title: "Check written exam scores", description: "Scores must be between 0 and 100." })
      return
    }
    if (updates.length > 0) updateMutation.mutate({ updates })
  }

  const handleTabChange = (value: string) => {
    if (activePrograms.some((program) => program.id === value)) {
      setSelectedTab(value as ScpProgram)
      setPage(1)
    }
  }

  if (activePrograms.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">No active Special Curricular Program</h2>
          <p className="mt-2 text-muted-foreground">Enable STE, SPA, or SPS in School Settings to manage applicants.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full min-h-0 w-full flex-1 flex-col">
        <TabsList className="relative mb-4 flex h-auto w-full gap-1 rounded-xl border border-border bg-muted p-1 shadow-sm">
          {activePrograms.map((program) => {
            const isActive = program.id === activeTab
            return (
              <TabsTrigger key={program.id} value={program.id} className="relative z-10 flex-1 rounded-lg py-2 font-bold transition-all data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {isActive && (
                  <motion.div layoutId="learner-admission-active-program" className="absolute inset-0 rounded-lg bg-primary shadow-sm" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />
                )}
                <span className={cn("relative z-20 truncate text-base uppercase", isActive ? "text-primary-foreground" : "text-foreground")}>{program.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-none bg-card shadow-sm">
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 p-2 sm:p-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                aria-label="Search applicants"
                placeholder="Search applicant name or LRN..."
                className="h-12 w-full border-gray-300 bg-white pl-10 pr-12 font-bold uppercase shadow-sm transition-shadow focus-visible:ring-primary"
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }}
              />
              <Popover open={isFilterOpen} onOpenChange={(open) => {
                setIsFilterOpen(open)
                if (open) setLocalAssessmentFilter(assessmentFilter)
              }}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Filter applicants"
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                    {assessmentFilter !== "all" && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">1</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[320px] border-border bg-card p-0 shadow-xl">
                  <div className="border-b p-4">
                    <h4 className="text-lg font-bold">Filter Applicants</h4>
                  </div>
                  <div className="flex flex-col space-y-4 p-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm uppercase text-muted-foreground">Final Result</Label>
                      <Select isFilter value={localAssessmentFilter} onValueChange={(value) => setLocalAssessmentFilter(value as AssessmentResult | "all")}>
                        <SelectTrigger className="h-10 w-full font-bold leading-tight">
                          <SelectValue placeholder="All Results" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="font-bold">All Results</SelectItem>
                          <SelectItem value="PENDING" className="font-bold">Pending</SelectItem>
                          <SelectItem value="QUALIFIED" className="font-bold text-emerald-700">Qualified</SelectItem>
                          <SelectItem value="DISQUALIFIED" className="font-bold text-destructive">Disqualified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-b-md border-t bg-muted/30 p-4">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setLocalAssessmentFilter("all")
                      setAssessmentFilter("all")
                      setSearchTerm("")
                      setPage(1)
                    }}>Clear All</Button>
                    <Button size="sm" onClick={() => {
                      setAssessmentFilter(localAssessmentFilter)
                      setPage(1)
                      setIsFilterOpen(false)
                    }}>Apply Filters</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {hasChanges && (
              <Button onClick={handleSaveBulk} disabled={updateMutation.isPending} className="h-12 whitespace-nowrap font-bold shrink-0">
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Assessment Results
              </Button>
            )}
          </div>

          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="min-h-0 flex-1 overflow-auto bg-muted/5">
              <DataTable<Application, unknown>
                columns={columns}
                data={paginatedApplicants}
                loading={isFetching}
                loadingBehavior="delayed"
                virtualize={false}
                className="h-full rounded-md border-none"
                tableClassName="min-w-[1160px] table-fixed"
                containerHeight="100%"
                noResultsMessage="No applicants found for the selected filters."
                striped={false}
              />
            </div>
            <PaginationBar total={filteredApplicants.length} page={page} limit={limit} onPageChange={setPage} onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1) }} itemName="Applicants" />
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
