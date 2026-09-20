import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ClipboardCheck, Loader2, Search, SlidersHorizontal, Info, Lock } from "lucide-react"
import { motion } from "motion/react"
import { sileo } from "sileo"

import api from "@/shared/api/axiosInstance"
import { PaginationBar } from "@/shared/components/PaginationBar"
import { UserPhoto } from "@/shared/components/UserPhoto"
import { cn } from "@/shared/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import { Badge } from "@/shared/ui/badge"
import { ConfirmationModal } from "@/shared/ui/confirmation-modal"
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
type AssessmentResult = "PENDING" | "QUALIFIED" | "WAITLISTED" | "DISQUALIFIED"

interface ProgramTab { id: ScpProgram; label: string }
interface Learner {
  id: number
  lrn: string | null
  firstName: string
  lastName: string
  middleName: string | null
  studentPhoto: string | null
}
type ScpAssessmentState = "PENDING" | "PASSED" | "FAILED"

interface ScpProfile {
  id: number
  requirementsStatus: ScpAssessmentState
  writtenExamStatus: ScpAssessmentState
  writtenExamScore: number | null
  interviewStatus: ScpAssessmentState
  assessmentResult: AssessmentResult
  grade5GeneralAverage: number
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
  requirementsStatus: ScpAssessmentState
  writtenExamStatus: ScpAssessmentState
  writtenExamScore: string
  interviewStatus: ScpAssessmentState
}
interface AssessmentUpdate {
  applicationId: number
  requirementsStatus: ScpAssessmentState
  writtenExamStatus: ScpAssessmentState
  writtenExamScore: number | null
  interviewStatus: ScpAssessmentState
  assessmentResult: AssessmentResult
}
interface BulkAssessmentPayload {
  program: ScpProgram
  updates: AssessmentUpdate[]
}

function getInitialEdit(application: Application): EditState {
  return {
    requirementsStatus: application.scpProfile?.requirementsStatus ?? "PENDING",
    writtenExamStatus: application.scpProfile?.writtenExamStatus ?? "PENDING",
    writtenExamScore: application.scpProfile?.writtenExamScore?.toString() ?? "",
    interviewStatus: application.scpProfile?.interviewStatus ?? "PENDING",
  }
}

function getComputedResult(
  requirementsStatus: ScpAssessmentState,
  writtenExamStatus: ScpAssessmentState,
  interviewStatus: ScpAssessmentState
): AssessmentResult {
  if (requirementsStatus === "FAILED" || writtenExamStatus === "FAILED" || interviewStatus === "FAILED") return "DISQUALIFIED"
  if (requirementsStatus === "PENDING" || writtenExamStatus === "PENDING" || interviewStatus === "PENDING") return "PENDING"
  return "QUALIFIED"
}

function ResultBadge({ result }: { result: AssessmentResult }) {
  if (result === "QUALIFIED") {
    return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Qualified</Badge>
  }
  if (result === "WAITLISTED") {
    return <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Waitlisted</Badge>
  }
  if (result === "DISQUALIFIED") return <Badge variant="destructive">Disqualified</Badge>
  return <Badge variant="secondary" className="bg text-foreground">Pending</Badge>
}

export default function LearnerAdmissionIndex() {
  const queryClient = useQueryClient()
  const setTitle = useHeaderStore((state) => state.setTitle)
  const { steEnabled, spaEnabled, spsEnabled, steCapacity, spaCapacity, spsCapacity, steRosterLocked, spaRosterLocked, spsRosterLocked } = useSettingsStore()
  const [selectedTab, setSelectedTab] = useState<ScpProgram | "">("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)
  const [edits, setEdits] = useState<Record<number, EditState>>({})
  const [assessmentFilter, setAssessmentFilter] = useState<AssessmentResult | "all">("all")
  const [localAssessmentFilter, setLocalAssessmentFilter] = useState<AssessmentResult | "all">("all")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isLockModalOpen, setIsLockModalOpen] = useState(false)

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

  const isRosterLocked = 
    (activeTab === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && steRosterLocked) ||
    (activeTab === "SPECIAL_PROGRAM_IN_THE_ARTS" && spaRosterLocked) ||
    (activeTab === "SPECIAL_PROGRAM_IN_SPORTS" && spsRosterLocked) || false

  const maxSlots = 
    activeTab === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? steCapacity :
    activeTab === "SPECIAL_PROGRAM_IN_THE_ARTS" ? spaCapacity :
    activeTab === "SPECIAL_PROGRAM_IN_SPORTS" ? spsCapacity : null

  useEffect(() => {
    setTitle("SCP Admission")
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

  const lockMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/enrollment/scp-applicants/lock-roster", { program: activeTab })
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings:public"] })
      await queryClient.invalidateQueries({ queryKey: ["scp-applicants"] })
      sileo.success({ title: "Roster Locked", description: "The roster has been finalized and locked." })
      setIsLockModalOpen(false)
    },
    onError: () => {
      sileo.error({ title: "Locking Failed", description: "Could not finalize the roster." })
    }
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
    const result = applicants.filter((application) => {
      const fullName = [application.learner.firstName, application.learner.middleName, application.learner.lastName]
        .filter(Boolean).join(" ").toLocaleLowerCase()
      const matchesSearch = !search || fullName.includes(search) || application.learner.lrn?.includes(search) === true
      const edit = edits[application.id]
      const res = edit
        ? getComputedResult(edit.requirementsStatus, edit.writtenExamStatus, edit.interviewStatus)
        : application.scpProfile?.assessmentResult ?? "PENDING"
      return matchesSearch && (assessmentFilter === "all" || res === assessmentFilter)
    })
    
    const statusOrder: Record<AssessmentResult, number> = { QUALIFIED: 1, WAITLISTED: 2, PENDING: 3, DISQUALIFIED: 4 }
    return result.sort((a, b) => {
      const statusA = (a.scpProfile?.assessmentResult as AssessmentResult) ?? "PENDING"
      const statusB = (b.scpProfile?.assessmentResult as AssessmentResult) ?? "PENDING"
      if (statusOrder[statusA] !== statusOrder[statusB]) {
        return statusOrder[statusA] - statusOrder[statusB]
      }
      const scoreA = a.scpProfile?.writtenExamScore ?? 0
      const scoreB = b.scpProfile?.writtenExamScore ?? 0
      if (scoreB !== scoreA) {
        return scoreB - scoreA
      }
      const gwaA = a.scpProfile?.grade5GeneralAverage ?? 0
      const gwaB = b.scpProfile?.grade5GeneralAverage ?? 0
      return gwaB - gwaA
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
        edit.requirementsStatus !== initial.requirementsStatus ||
        edit.writtenExamStatus !== initial.writtenExamStatus ||
        edit.writtenExamScore !== initial.writtenExamScore ||
        edit.interviewStatus !== initial.interviewStatus
      )
    })
  }, [edits, applicants])

  const canLockRoster = useMemo(() => {
    if (applicants.length === 0) return false
    return applicants.every((app) => {
      const result = app.scpProfile?.assessmentResult
      return result === "QUALIFIED" || result === "DISQUALIFIED"
    })
  }, [applicants])

  const updateEdit = (application: Application, patch: Partial<EditState>) => {
    setEdits((current) => {
      const nextEdit = { ...(current[application.id] ?? getInitialEdit(application)), ...patch }
      if (nextEdit.requirementsStatus !== "PASSED") {
        nextEdit.writtenExamStatus = "PENDING"
        nextEdit.writtenExamScore = ""
        nextEdit.interviewStatus = "PENDING"
      } else if (nextEdit.writtenExamStatus === "PENDING") {
        nextEdit.writtenExamScore = ""
        nextEdit.interviewStatus = "PENDING"
      }
      return { ...current, [application.id]: nextEdit }
    })
  }

  const columns: ColumnDef<Application>[] = useMemo(() => [
    {
      id: "rowNumber",
      size: 70,
      minSize: 70,
      maxSize: 70,
      meta: { className: "text-center", headerClassName: "text-center", pin: "left" },
      header: "#",
      cell: ({ row }) => (page - 1) * limit + row.index + 1,
    },
    {
      id: "applicant",
      size: 380,
      minSize: 300,
      meta: { pin: "left" },
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
              <p className="truncate font-extrabold uppercase text-foreground">
                {learner.lastName}, {learner.firstName}
                {learner.middleName ? ` ${learner.middleName.charAt(0)}.` : ""}
              </p>
              <p className="text-sm ">
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
      cell: ({ row, table }) => {
        const application = row.original
        const { edits, updateEdit, isRosterLocked } = table.options.meta as any
        const currentState = edits[application.id] ?? getInitialEdit(application)
        if (isRosterLocked) return <div className="text-center font-semibold py-2">{currentState.requirementsStatus === "PASSED" ? "Passed" : currentState.requirementsStatus === "FAILED" ? "Failed" : "Pending"}</div>
        return (
          <div className="flex justify-center py-2">
            <Select
              value={currentState.requirementsStatus}
              onValueChange={(val: ScpAssessmentState) => updateEdit(application, { requirementsStatus: val })}
            >
              <SelectTrigger className="w-36 font-bold uppercase">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PASSED">Passed</SelectItem>
                <SelectItem value="FAILED">Incomplete / Failed</SelectItem>
              </SelectContent>
            </Select>
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
      cell: ({ row, table }) => {
        const application = row.original
        const { edits, updateEdit, isRosterLocked } = table.options.meta as any
        const currentState = edits[application.id] ?? getInitialEdit(application)
        if (isRosterLocked) return (
          <div className="flex items-center justify-center gap-2 py-2 font-semibold">
            <span>{currentState.writtenExamStatus === "PASSED" ? "Passed" : currentState.writtenExamStatus === "FAILED" ? "Failed" : "Pending"}</span>
            {currentState.writtenExamStatus === "PASSED" && currentState.writtenExamScore !== null && <span className="text-foreground ml-2">Score: {currentState.writtenExamScore}</span>}
          </div>
        )
        return (
          <div className="flex items-center justify-center gap-2 py-2">
            <Select
              value={currentState.writtenExamStatus}
              disabled={currentState.requirementsStatus !== "PASSED"}
              onValueChange={(val: ScpAssessmentState) => updateEdit(application, { writtenExamStatus: val })}
            >
              <SelectTrigger className="w-36 font-bold uppercase">
                {currentState.requirementsStatus === "FAILED" ? (
                  <span className="text-foreground">---</span>
                ) : (
                  <SelectValue placeholder="Status" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PASSED">Passed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            {currentState.requirementsStatus === "PASSED" && currentState.writtenExamStatus !== "PENDING" && (
              <Input
                type="text"
                inputMode="numeric"
                maxLength={3}
                aria-label={`Written exam score for ${application.learner.firstName} ${application.learner.lastName}`}
                className="h-9 w-20 bg-background text-center font-bold shadow-none"
                placeholder="Score"
                value={currentState.writtenExamScore}
                onChange={(event) => {
                  const val = event.target.value.replace(/[^0-9]/g, "").slice(0, 3)
                  updateEdit(application, { writtenExamScore: val })
                }}
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
      cell: ({ row, table }) => {
        const application = row.original
        const { edits, updateEdit, isRosterLocked } = table.options.meta as any
        const currentState = edits[application.id] ?? getInitialEdit(application)
        if (isRosterLocked) return <div className="text-center font-semibold py-2">{currentState.interviewStatus === "PASSED" ? "Passed" : currentState.interviewStatus === "FAILED" ? "Failed" : "Pending"}</div>
        return (
          <div className="flex justify-center py-2">
            <Select
              value={currentState.interviewStatus}
              disabled={currentState.writtenExamStatus !== "PASSED"}
              onValueChange={(val: ScpAssessmentState) => updateEdit(application, { interviewStatus: val })}
            >
              <SelectTrigger className="w-36 font-bold uppercase">
                {currentState.requirementsStatus === "FAILED" || currentState.writtenExamStatus === "FAILED" ? (
                  <span className="text-foreground">---</span>
                ) : (
                  <SelectValue placeholder="Status" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PASSED">Passed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      },
    },
    {
      id: "result",
      size: 190,
      minSize: 170,
      meta: { className: "text-center", headerClassName: "text-center", pin: "right" },
      header: "FINAL RESULT",
      cell: ({ row, table }) => {
        const application = row.original
        const { edits } = table.options.meta as { edits: Record<number, EditState> }
        const edit = edits[application.id]
        const result = edit
          ? getComputedResult(edit.requirementsStatus, edit.writtenExamStatus, edit.interviewStatus)
          : application.scpProfile?.assessmentResult ?? "PENDING"
        return <div className="flex justify-center py-2 uppercase"><ResultBadge result={result} /></div>
      },
    },
  ], [page, limit])

  const handleSaveBulk = () => {
    const updates = Object.entries(edits).map(([applicationId, edit]) => ({
      applicationId: Number(applicationId),
      requirementsStatus: edit.requirementsStatus,
      writtenExamStatus: edit.writtenExamStatus,
      writtenExamScore: edit.writtenExamScore === "" ? null : Number(edit.writtenExamScore),
      interviewStatus: edit.interviewStatus,
      assessmentResult: getComputedResult(edit.requirementsStatus, edit.writtenExamStatus, edit.interviewStatus),
    } satisfies AssessmentUpdate))

    const hasInvalidScore = updates.some(({ writtenExamScore }) =>
      writtenExamScore !== null && (!Number.isFinite(writtenExamScore) || writtenExamScore < 0 || writtenExamScore > 100),
    )
    if (hasInvalidScore) {
      sileo.error({ title: "Check written exam scores", description: "Scores must be between 0 and 100." })
      return
    }
    if (updates.length > 0) updateMutation.mutate({ program: activeTab as ScpProgram, updates })
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
          <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-foreground" />
          <h2 className="text-xl font-bold text-foreground">No active Special Curricular Program</h2>
          <p className="mt-2 text-foreground">Enable STE, SPA, or SPS in School Settings to manage applicants.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full min-h-0 w-full flex-1 flex-col">
        <TabsList className="relative mb-4 flex h-auto w-full gap-1 rounded-xl border border-border bg p-1 shadow-sm">
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

        {isRosterLocked && (
        <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-800">
          <Info className="h-4 w-4 text-emerald-600" />
          <AlertTitle>Official Roster Finalized and Locked</AlertTitle>
          <AlertDescription>
            {applicants.filter(a => a.scpProfile?.assessmentResult === "QUALIFIED").length} out of {maxSlots || "N/A"} filled. This roster is sealed.
          </AlertDescription>
        </Alert>
      )}
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
                      <Label className="text-sm uppercase text-foreground">Final Result</Label>
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
                  <div className="flex items-center justify-between rounded-b-md border-t bg/30 p-4">
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
            
            {isRosterLocked ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" className="h-12 whitespace-nowrap font-bold" onClick={() => sileo.info({ title: "Export Qualified List", description: "This feature is not yet available in the demo." })}>
                  Export Qualified List
                </Button>
                <Button className="h-12 whitespace-nowrap font-bold" onClick={() => sileo.info({ title: "Push to Ready for Sectioning", description: "This feature is not yet available in the demo." })}>
                  Push to Ready for Sectioning
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                {hasChanges ? (
                  <Button onClick={handleSaveBulk} disabled={updateMutation.isPending} className="h-12 whitespace-nowrap font-bold shrink-0">
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Results
                  </Button>
                ) : canLockRoster && (
                  <Button onClick={() => setIsLockModalOpen(true)} className="h-12 whitespace-nowrap font-bold shrink-0 bg-red-600 hover:bg-red-700 text-white">
                    <Lock className="mr-2 h-4 w-4" />
                    Finalize & Lock Roster
                  </Button>
                )}
              </div>
            )}
          </div>

          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="min-h-0 flex-1 overflow-auto bg/5">
              <DataTable<Application, unknown>
                columns={columns}
                data={paginatedApplicants}
                getRowId={(row) => row.id.toString()}
                meta={{ edits, updateEdit, isRosterLocked }}
                loading={isFetching}
                loadingBehavior="delayed"
                virtualize={false}
                className="h-full rounded-md border-none"
                tableClassName="min-w-[1450px] table-fixed"
                containerHeight="100%"
                noResultsMessage="No applicants found for the selected filters."
                striped={false}
              />
            </div>
            <PaginationBar total={filteredApplicants.length} page={page} limit={limit} onPageChange={setPage} onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1) }} itemName="Applicants" />
          </CardContent>
        </Card>
      </Tabs>
      <ConfirmationModal
        open={isLockModalOpen}
        onOpenChange={setIsLockModalOpen}
        title="Finalize Official Roster?"
        description="You are about to lock the admission results for this program. This action will seal the assessment table and prevent further modifications."
        confirmText="Confirm & Lock"
        onConfirm={() => lockMutation.mutate()}
        variant="danger"
      />
    </div>
  )
}
