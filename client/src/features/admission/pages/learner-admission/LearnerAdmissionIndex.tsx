import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/shared/lib/queryKeys"
import type { ColumnDef } from "@tanstack/react-table"
import { ClipboardCheck, Loader2, Search, SlidersHorizontal, Info, Lock, MoreHorizontal, Plus, X } from "lucide-react"
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
import { DataTable } from "@/shared/ui/data-table"
import { TableRow, TableCell } from "@/shared/ui/table"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import ScpAdmissionForm, { type ScpProgram } from "@/features/admission/pages/scp-admission/ScpAdmissionForm"
import EnrollmentSuccess from "@/features/admission/pages/online-enrollment/components/EnrollmentSuccess"
import type { ApplicationSubmitResponse } from "@enrollpro/shared"
import { useHeaderStore } from "@/store/header.slice"
import { useSettingsStore } from "@/store/settings.slice"
import { useAuthStore } from "@/store/auth.slice"
type AssessmentResult = "PENDING" | "QUALIFIED" | "WAITLISTED" | "DISQUALIFIED" | "FORFEITED"

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

interface RankedApplication extends Application {
  baseResult: AssessmentResult
  finalResult: AssessmentResult
  calculatedRowNumber?: number
}

interface CustomHeaderRow {
  id: number
  isCustomHeaderRow: true
  headerType: "QUALIFYING" | "UNQUALIFIED"
}

type ApplicationTableRow = RankedApplication | CustomHeaderRow

interface AssessmentTableMeta {
  edits: Record<number, EditState>
  updateEdit: (application: Application, patch: Partial<EditState>) => void
  isRosterLocked: boolean
}

function isCustomHeaderRow(row: ApplicationTableRow): row is CustomHeaderRow {
  return "isCustomHeaderRow" in row && row.isCustomHeaderRow
}

function getApplicationRow(row: ApplicationTableRow): RankedApplication | null {
  return isCustomHeaderRow(row) ? null : row
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
    return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-base">Qualified</Badge>
  }
  if (result === "WAITLISTED") {
    return <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 text-base">Waitlisted</Badge>
  }
  if (result === "DISQUALIFIED") return <Badge variant="destructive" className="text-base">Disqualified</Badge>
  if (result === "FORFEITED") return <Badge variant="outline" className="border-gray-500 text-gray-700 bg-gray-50 text-base">Forfeited</Badge>
  return <Badge variant="secondary" className="bg text-foreground text-base">Pending</Badge>
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
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [isForfeitModalOpen, setIsForfeitModalOpen] = useState(false)
  const [forfeitTarget, setForfeitTarget] = useState<{ id: number; name: string } | null>(null)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<{ id: number; name: string } | null>(null)
  const [isWalkInOpen, setIsWalkInOpen] = useState(false)
  const [walkInSuccess, setWalkInSuccess] = useState<ApplicationSubmitResponse | null>(null)
  const user = useAuthStore((state) => state.user)
  const roles = useMemo(() => user?.roles ?? [], [user?.roles])
  const ancillaryRoles = useMemo(() => user?.ancillaryRoles ?? [], [user?.ancillaryRoles])
  const isGlobalAdmin = roles.some((r) =>
    ["SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "HEAD_REGISTRAR"].includes(r)
  )

  const activePrograms = useMemo<ProgramTab[]>(() => {
    const programs: ProgramTab[] = []
    if (steEnabled && (isGlobalAdmin || roles.includes("STE_COORDINATOR") || ancillaryRoles.includes("STE HEAD TEACHER"))) {
      programs.push({ id: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE Applicants" })
    }
    if (spaEnabled && (isGlobalAdmin || roles.includes("SPA_COORDINATOR") || ancillaryRoles.includes("SPA HEAD TEACHER"))) {
      programs.push({ id: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA Applicants" })
    }
    if (spsEnabled && (isGlobalAdmin || roles.includes("SPS_COORDINATOR") || ancillaryRoles.includes("SPS HEAD TEACHER"))) {
      programs.push({ id: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS Applicants" })
    }
    return programs
  }, [spaEnabled, spsEnabled, steEnabled, isGlobalAdmin, roles, ancillaryRoles])

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicSettings })
      await queryClient.invalidateQueries({ queryKey: ["scp-applicants"] })
      sileo.success({ title: "Roster Locked", description: "The roster has been finalized and locked." })
      setIsLockModalOpen(false)
    },
    onError: () => {
      sileo.error({ title: "Locking Failed", description: "Could not finalize the roster." })
    }
  })

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/enrollment/scp-applicants/unlock-roster", { program: activeTab })
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicSettings })
      await queryClient.invalidateQueries({ queryKey: ["scp-applicants"] })
      sileo.success({ title: "Roster Unlocked", description: "The roster has been unlocked." })
      setIsUnlockModalOpen(false)
    },
    onError: () => {
      sileo.error({ title: "Unlocking Failed", description: "Could not unlock the roster." })
    }
  })

  const forfeitMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const { data } = await api.post(`/enrollment/scp-applicants/${applicationId}/forfeit`, { program: activeTab })
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["scp-applicants"] })
      sileo.success({ title: "Slot Forfeited", description: "The applicant has been forfeited and the highest ranking waitlisted applicant has been promoted." })
      setIsForfeitModalOpen(false)
      setForfeitTarget(null)
    },
    onError: () => {
      sileo.error({ title: "Forfeiture Failed", description: "Could not forfeit the slot." })
    }
  })

  const restoreMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const { data } = await api.post(`/enrollment/scp-applicants/${applicationId}/restore`, { program: activeTab })
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicSettings })
      await queryClient.invalidateQueries({ queryKey: ["scp-applicants"] })
      sileo.success({
        title: "Application Restored",
        description: `Application restored. The learner is now ${data.status === 'QUALIFIED' ? 'Qualified' : 'Waitlisted'}.`
      })
      setIsRestoreModalOpen(false)
      setRestoreTarget(null)
    },
    onError: () => {
      sileo.error({ title: "Restore Failed", description: "Could not restore the application." })
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

  const rankedApplicants = useMemo<RankedApplication[]>(() => {
    const withBaseResult = applicants.map((app) => {
      const edit = edits[app.id]
      const baseResult = edit
        ? getComputedResult(edit.requirementsStatus, edit.writtenExamStatus, edit.interviewStatus)
        : app.scpProfile?.assessmentResult ?? "PENDING"
      return { ...app, baseResult }
    })

    const statusOrder: Record<AssessmentResult, number> = { QUALIFIED: 1, WAITLISTED: 2, PENDING: 3, DISQUALIFIED: 4, FORFEITED: 5 }
    const sorted = withBaseResult.sort((a, b) => {
      if (statusOrder[a.baseResult] !== statusOrder[b.baseResult]) {
        return statusOrder[a.baseResult] - statusOrder[b.baseResult]
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

    let qualifiedCount = 0;
    return sorted.map((app) => {
      let finalResult = app.baseResult;
      if (finalResult === "QUALIFIED") {
        qualifiedCount++;
        if (maxSlots !== null && maxSlots !== undefined && qualifiedCount > maxSlots) {
          finalResult = "WAITLISTED";
        }
      }
      return { ...app, finalResult }
    })
  }, [applicants, edits, maxSlots])

  const filteredApplicants = useMemo<ApplicationTableRow[]>(() => {
    const search = searchTerm.trim().toLocaleLowerCase()
    const result = rankedApplicants.filter((application) => {
      const fullName = [application.learner.firstName, application.learner.middleName, application.learner.lastName]
        .filter(Boolean).join(" ").toLocaleLowerCase()
      const matchesSearch = !search || fullName.includes(search) || application.learner.lrn?.includes(search) === true
      const res = application.finalResult
      return matchesSearch && (assessmentFilter === "all" || res === assessmentFilter)
    })

    const firstDisqualifiedIndex = result.findIndex((app) => {
      return app.finalResult === "DISQUALIFIED"
    })

    const resultWithHeaders: ApplicationTableRow[] = [...result]

    if (firstDisqualifiedIndex !== -1) {
      resultWithHeaders.splice(firstDisqualifiedIndex, 0, {
        isCustomHeaderRow: true,
        headerType: "UNQUALIFIED",
        id: -2,
      })
    }

    const hasQualifying = result.some((app) => {
      return app.finalResult !== "DISQUALIFIED"
    })

    if (hasQualifying) {
      resultWithHeaders.unshift({
        isCustomHeaderRow: true,
        headerType: "QUALIFYING",
        id: -1,
      })
    }

    let currentGroupNumber = 0;
    return resultWithHeaders.map((app): ApplicationTableRow => {
      if (isCustomHeaderRow(app)) {
        currentGroupNumber = 0;
        return app;
      }
      currentGroupNumber++;
      return { ...app, calculatedRowNumber: currentGroupNumber };
    });
  }, [assessmentFilter, rankedApplicants, searchTerm])

  const paginatedApplicants = useMemo(() => {
    const start = (page - 1) * limit
    return filteredApplicants.slice(start, start + limit)
  }, [filteredApplicants, limit, page])

  const hasChanges = useMemo(() => {
    const hasEdits = Object.keys(edits).some((id) => {
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

    if (hasEdits) return true;

    return rankedApplicants.some(app => (app.scpProfile?.assessmentResult ?? "PENDING") !== app.finalResult)
  }, [edits, applicants, rankedApplicants])

  const canLockRoster = useMemo(() => {
    if (applicants.length === 0) return false
    return applicants.every((app) => {
      const result = app.scpProfile?.assessmentResult
      return result === "QUALIFIED" || result === "DISQUALIFIED" || result === "WAITLISTED" || result === "FORFEITED"
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

  const columns: ColumnDef<ApplicationTableRow>[] = useMemo(() => [
    {
      id: "rowNumber",
      size: 70,
      minSize: 70,
      maxSize: 70,
      meta: { className: "text-center", headerClassName: "text-center", pin: "left" },
      header: "#",
      cell: ({ row }) => {
        const application = getApplicationRow(row.original)
        return application?.calculatedRowNumber ?? ((page - 1) * limit + row.index + 1)
      },
    },
    {
      id: "applicant",
      size: 380,
      minSize: 300,
      meta: { pin: "left" },
      header: "APPLICANT NAME & LRN",
      cell: ({ row }) => {
        const application = getApplicationRow(row.original)
        if (!application) return null
        const learner = application.learner
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
        const application = getApplicationRow(row.original)
        if (!application) return null
        const { edits, updateEdit, isRosterLocked } = table.options.meta as AssessmentTableMeta
        const currentState = edits[application.id] ?? getInitialEdit(application)
        if (isRosterLocked) return <div className="text-center font-bold py-2 uppercase">{currentState.requirementsStatus === "PASSED" ? "Passed" : currentState.requirementsStatus === "FAILED" ? "Failed" : "Pending"}</div>
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
        const application = getApplicationRow(row.original)
        if (!application) return null
        const { edits, updateEdit, isRosterLocked } = table.options.meta as AssessmentTableMeta
        const currentState = edits[application.id] ?? getInitialEdit(application)
        if (isRosterLocked) {
          if (currentState.requirementsStatus !== "PASSED") {
            return (
              <div className="flex flex-col items-center justify-center py-2 font-bold uppercase leading-tight">
                <span className="text-foreground">---</span>
              </div>
            )
          }
          return (
            <div className="flex flex-col items-center justify-center py-2 font-bold uppercase leading-tight">
              <span>{currentState.writtenExamStatus}</span>
              {currentState.writtenExamStatus === "PASSED" && currentState.writtenExamScore !== null && currentState.writtenExamScore !== "" && (
                <span className="text-foreground text-sm mt-0.5">SCORE: {currentState.writtenExamScore}</span>
              )}
            </div>
          )
        }
        return (
          <div className="flex items-center justify-center gap-2 py-2">
            <Select
              value={currentState.writtenExamStatus}
              disabled={application.scpProfile?.requirementsStatus !== "PASSED"}
              onValueChange={(val: ScpAssessmentState) => updateEdit(application, { writtenExamStatus: val })}
            >
              <SelectTrigger className="w-36 font-bold uppercase">
                {application.scpProfile?.requirementsStatus !== "PASSED" ? (
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
            {application.scpProfile?.requirementsStatus === "PASSED" && currentState.writtenExamStatus !== "PENDING" && (
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
        const application = getApplicationRow(row.original)
        if (!application) return null
        const { edits, updateEdit, isRosterLocked } = table.options.meta as AssessmentTableMeta
        const currentState = edits[application.id] ?? getInitialEdit(application)
        if (isRosterLocked) {
          if (currentState.requirementsStatus !== "PASSED" || currentState.writtenExamStatus !== "PASSED") {
            return <div className="text-center font-bold py-2 uppercase"><span className="text-foreground">---</span></div>
          }
          return <div className="text-center font-bold py-2 uppercase">{currentState.interviewStatus === "PASSED" ? "Passed" : currentState.interviewStatus === "FAILED" ? "Failed" : "Pending"}</div>
        }
        return (
          <div className="flex justify-center py-2">
            <Select
              value={currentState.interviewStatus}
              disabled={application.scpProfile?.requirementsStatus !== "PASSED" || application.scpProfile?.writtenExamStatus !== "PASSED" || currentState.writtenExamStatus !== "PASSED"}
              onValueChange={(val: ScpAssessmentState) => updateEdit(application, { interviewStatus: val })}
            >
              <SelectTrigger className="w-36 font-bold uppercase">
                {application.scpProfile?.requirementsStatus !== "PASSED" || application.scpProfile?.writtenExamStatus !== "PASSED" || currentState.writtenExamStatus !== "PASSED" ? (
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
      cell: ({ row }) => {
        const application = getApplicationRow(row.original)
        if (!application) return null
        const result = application.finalResult

        return (
          <div className="flex items-center justify-center gap-2 uppercase relative">
            <ResultBadge result={result} />
            {result === "QUALIFIED" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-primary font-bold cursor-pointer"
                    onClick={() => {
                      setForfeitTarget({ id: application.id, name: `${application.learner.lastName}, ${application.learner.firstName}` })
                      setIsForfeitModalOpen(true)
                    }}
                  >
                    FORFEIT SLOT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {result === "FORFEITED" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-primary font-bold cursor-pointer"
                    onClick={() => {
                      setRestoreTarget({ id: application.id, name: `${application.learner.lastName}, ${application.learner.firstName}` })
                      setIsRestoreModalOpen(true)
                    }}
                  >
                    Restore Application
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      },
    },
  ], [page, limit, setForfeitTarget, setIsForfeitModalOpen, setRestoreTarget, setIsRestoreModalOpen])

  const handleSaveBulk = () => {
    const updatesMap = new Map<number, AssessmentUpdate>();

    Object.entries(edits).forEach(([idStr, edit]) => {
      const applicationId = Number(idStr)
      const rankedApp = rankedApplicants.find(a => a.id === applicationId)
      updatesMap.set(applicationId, {
        applicationId,
        requirementsStatus: edit.requirementsStatus,
        writtenExamStatus: edit.writtenExamStatus,
        writtenExamScore: edit.writtenExamScore === "" ? null : Number(edit.writtenExamScore),
        interviewStatus: edit.interviewStatus,
        assessmentResult: rankedApp?.finalResult ?? "PENDING",
      } satisfies AssessmentUpdate)
    })

    rankedApplicants.forEach(app => {
      if (app.scpProfile?.assessmentResult !== app.finalResult && !updatesMap.has(app.id)) {
        updatesMap.set(app.id, {
          applicationId: app.id,
          requirementsStatus: app.scpProfile?.requirementsStatus ?? "PENDING",
          writtenExamStatus: app.scpProfile?.writtenExamStatus ?? "PENDING",
          writtenExamScore: app.scpProfile?.writtenExamScore ?? null,
          interviewStatus: app.scpProfile?.interviewStatus ?? "PENDING",
          assessmentResult: app.finalResult,
        })
      }
    })

    const updates = Array.from(updatesMap.values())

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
    const hasEnabledPrograms = steEnabled || spaEnabled || spsEnabled
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          {hasEnabledPrograms ? (
            <>
              <Lock className="mx-auto mb-4 h-12 w-12 text-foreground" />
              <h2 className="text-xl font-bold text-foreground">Restricted Access</h2>
              <p className="mt-2 text-foreground">You do not have the required role to view or manage Special Curricular Programs.</p>
            </>
          ) : (
            <>
              <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-foreground" />
              <h2 className="text-xl font-bold text-foreground">No active Special Curricular Program</h2>
              <p className="mt-2 text-foreground">Enable STE, SPA, or SPS in School Settings to manage applicants.</p>
            </>
          )}
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
            <AlertTitle>Official List of Qualified Applicants</AlertTitle>
            <AlertDescription className="text-sm">
              All {maxSlots || "N/A"} slots are filled and the list is now final. If a student backs out, use the row menu to forfeit their slot and automatically promote a waitlisted applicant.
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
                <Button className="h-12 whitespace-nowrap font-bold bg-primary text-primary-foreground" onClick={() => setIsUnlockModalOpen(true)}>
                  Unlock Roster
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                {applicants.length > 0 && !canLockRoster && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      setWalkInSuccess(null)
                      setIsWalkInOpen(true)
                    }}
                    className="h-12 whitespace-nowrap font-bold bg-primary text-primary-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Encode Walk-in
                  </Button>
                )}
                {hasChanges ? (
                  <Button onClick={handleSaveBulk} disabled={updateMutation.isPending} className="h-12 whitespace-nowrap font-bold shrink-0">
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Results
                  </Button>
                ) : canLockRoster ? (
                  <Button
                    onClick={() => setIsLockModalOpen(true)}
                    className="h-12 whitespace-nowrap font-bold shrink-0 bg-primary text-primary-foreground"
                  >
                    Finalize & Lock Roster
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="min-h-0 flex-1 overflow-auto bg/5">
              {!isFetching && applicants.length === 0 ? (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ClipboardCheck className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground">No Applicants Found</h2>
                  <p className="mt-2 max-w-lg text-base text-muted-foreground">
                    There are no applicants currently registered for this program. Wait for online submissions or manually encode a walk-in.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    disabled={isRosterLocked}
                    title={isRosterLocked ? "Cannot encode walk-ins while the roster is finalized." : undefined}
                    onClick={() => {
                      setWalkInSuccess(null)
                      setIsWalkInOpen(true)
                    }}
                    className="mt-6 min-w-72 text-base font-bold"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Encode Walk-in Applicant
                  </Button>
                </div>
              ) : (
                <DataTable<ApplicationTableRow, unknown>
                  key={activeTab}
                  columns={columns}
                  data={paginatedApplicants}
                  getRowId={(row) => row.id.toString()}
                  isHeaderRow={isCustomHeaderRow}
                  renderHeaderRow={(row, columnsCount) => {
                    if (!isCustomHeaderRow(row)) return null
                    const headerType = row.headerType;
                    const programLabel = activePrograms.find(p => p.id === activeTab)?.label?.toUpperCase() || "";

                    if (headerType === "QUALIFYING") {
                      const headerText = isRosterLocked
                        ? `TOP ${maxSlots || ""} QUALIFIED ${programLabel}`
                        : `${programLabel} UNDER SCREENING`;

                      return (
                        <TableRow className="bg-emerald-50 hover:bg-emerald-50" key={`qualifying-header-${row.id}`}>
                          <TableCell colSpan={columnsCount} className="py-2 text-center font-bold text-emerald-800 uppercase border-y border-emerald-200">
                            {headerText}
                          </TableCell>
                        </TableRow>
                      )
                    }

                    return (
                      <TableRow className="bg-red-50 hover:bg-red-50" key={`unqualified-header-${row.id}`}>
                        <TableCell colSpan={columnsCount} className="py-2 text-center font-bold text-red-800 uppercase border-y border-red-200">
                          UNQUALIFIED {programLabel}
                        </TableCell>
                      </TableRow>
                    )
                  }}
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
              )}
            </div>
            <PaginationBar total={filteredApplicants.length} page={page} limit={limit} onPageChange={setPage} onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1) }} itemName="Applicants" />
          </CardContent>
        </Card>
      </Tabs>
      <Dialog
        open={isWalkInOpen}
        onOpenChange={(open) => {
          if (open) setIsWalkInOpen(true)
        }}
      >
        <DialogContent
          showClose={false}
          aria-describedby={undefined}
          className="flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 border-b bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
                <Plus className="h-6 w-6 text-primary" />
                Walk-in SCP Admission
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close walk-in admission"
                onClick={() => {
                  setWalkInSuccess(null)
                  setIsWalkInOpen(false)
                }}
              >
                <X className="h-5 w-5 rounded-full" />
              </Button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            <div className="relative min-h-full px-6 py-6">
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <svg
                  className="absolute inset-0 h-full w-full opacity-[0.04]"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <pattern
                      id="pixel-grid-walk-in-admission"
                      x="0"
                      y="0"
                      width="80"
                      height="80"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                      <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                      <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                      <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#pixel-grid-walk-in-admission)" />
                </svg>
                <div
                  className="absolute inset-0"
                  style={{
                    background: "radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)",
                  }}
                />
              </div>
              <div className="relative z-10">
            {walkInSuccess ? (
              <EnrollmentSuccess
                trackingNumber={walkInSuccess.trackingNumber}
                applicantType={walkInSuccess.applicantType}
                programType={walkInSuccess.programType}
                status={walkInSuccess.status}
                currentStep={walkInSuccess.currentStep}
                presentation="STAFF_WALK_IN"
              />
            ) : activeTab ? (
              <ScpAdmissionForm
                key={activeTab}
                intakeChoice="NEW"
                mode="STAFF_WALK_IN"
                initialProgram={activeTab}
                onCancel={() => setIsWalkInOpen(false)}
                onSuccess={(payload) => {
                  setWalkInSuccess(payload)
                  void queryClient.invalidateQueries({ queryKey: ["scp-applicants", activeTab] })
                }}
              />
            ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        open={isLockModalOpen}
        onOpenChange={setIsLockModalOpen}
        title="Finalize & Lock Roster"
        description={`Are you sure you want to finalize the ${activePrograms.find(p => p.id === activeTab)?.label} roster? This will lock the current list and prevent further modifications until unlocked.`}
        confirmText="Finalize & Lock"
        variant="danger"
        onConfirm={() => lockMutation.mutate()}
        loading={lockMutation.isPending}
      />

      <ConfirmationModal
        open={isUnlockModalOpen}
        onOpenChange={setIsUnlockModalOpen}
        title="Unlock Roster"
        description={`Are you sure you want to unlock the ${activePrograms.find(p => p.id === activeTab)?.label} roster? This will allow modifications to be made again.`}
        confirmText="Unlock Roster"
        variant="primary"
        onConfirm={() => unlockMutation.mutate()}
        loading={unlockMutation.isPending}
      />

      <ConfirmationModal
        open={isForfeitModalOpen}
        onOpenChange={setIsForfeitModalOpen}
        title="Forfeit Applicant Slot?"
        description={`Are you sure you want to forfeit ${forfeitTarget?.name}'s slot in this program? This action is irreversible. The system will automatically promote the highest-ranking waitlisted applicant to fill this empty slot.`}
        confirmText="Confirm Forfeiture"
        variant="danger"
        onConfirm={() => forfeitTarget && forfeitMutation.mutate(forfeitTarget.id)}
        loading={forfeitMutation.isPending}
      />

      <ConfirmationModal
        open={isRestoreModalOpen}
        onOpenChange={setIsRestoreModalOpen}
        title="Restore Application?"
        description="You are restoring this applicant to the active roster. Depending on current program capacity, they will be placed as either QUALIFIED (if slots are open) or WAITLISTED (if the quota is currently full)."
        confirmText="Confirm Restore"
        variant="primary"
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        loading={restoreMutation.isPending}
      />
    </div>
  )
}
