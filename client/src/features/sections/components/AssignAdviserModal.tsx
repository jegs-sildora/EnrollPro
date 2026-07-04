import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ChevronLeft, Loader2, Lock, Search, SearchX } from "lucide-react"
import { sileo } from "sileo"
import api from "@/shared/api/axiosInstance"
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch"
import { cn } from "@/shared/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Input } from "@/shared/ui/input"
import type { AdviserCandidate } from "../types"

const HANDOVER_REASON_CATEGORIES = [
  "Administrative Reassignment",
  "Maternity/Medical Leave",
  "Resignation/Retirement",
  "Promoted/Transferred",
] as const

interface AssignAdviserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: {
    id: number
    name: string
    gradeLevelName: string
    programType: string
    currentAdviser: { id: number; name: string } | null
  } | null
  teachers: AdviserCandidate[]
  loadingTeachers: boolean
  onSuccess: () => void
}

const PROGRAM_MATCH_KEYWORDS: Record<string, string[]> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: ["SCI", "SCIENCE", "MATH", "STEM", "STE"],
  SPECIAL_PROGRAM_IN_THE_ARTS: ["ART", "MUSIC", "DANCE", "THEATER", "MAPEH"],
  SPECIAL_PROGRAM_IN_SPORTS: ["SPORT", "COACH", "PE", "PHYSICAL", "MAPEH"],
  SPECIAL_PROGRAM_IN_JOURNALISM: ["JOURNAL", "ENGLISH", "LANGUAGE", "WRITING"],
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: ["FOREIGN", "LANGUAGE", "ENGLISH", "FILIPINO"],
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: ["TLE", "TVE", "TECH", "VOC", "INDUSTRIAL"],
  REGULAR: [],
}

function teacherFitScore(programType: string, teacher: AdviserCandidate): number {
  const keywords = PROGRAM_MATCH_KEYWORDS[programType] ?? []
  if (!keywords.length) return 0
  const haystack = `${teacher.department ?? ""} ${teacher.specialization ?? ""}`.toUpperCase()
  return keywords.reduce((score, keyword) => (haystack.includes(keyword) ? score + 1 : score), 0)
}

// Custom radio indicator SVG
function RadioIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-150",
        checked
          ? "border-red-700 bg-red-700"
          : "border-slate-300 bg-white group-hover:border-red-400",
      )}
    >
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
    </span>
  )
}

export function AssignAdviserModal({
  open,
  onOpenChange,
  section,
  teachers,
  loadingTeachers,
  onSuccess,
}: AssignAdviserModalProps) {
  // ── Wizard step ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAssigned, setShowAssigned] = useState(false)
  // Step 2 audit form state
  const [reasonCategory, setReasonCategory] = useState("")
  const [justification, setJustification] = useState("")

  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    activeFilter: activeSearch,
    isSearching,
    clearSearch,
  } = useDebouncedSearch()

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setSelectedTeacherId(null)
      setShowAssigned(false)
      setReasonCategory("")
      setJustification("")
      clearSearch()
    }
  }, [clearSearch, open])

  const normalizedSearch = activeSearch.toLowerCase().trim()

  // Resolve the current adviser's full AdviserCandidate record for rich display
  const currentAdviserFull = useMemo(() => {
    if (!section?.currentAdviser) return null
    return teachers.find((t) => t.id === section.currentAdviser!.id) ?? null
  }, [section, teachers])

  // Candidate pool — excludes the current adviser, applies search + locked filter
  const sortedTeachers = useMemo(() => {
    if (!section) return []

    const filtered = teachers.filter((teacher) => {
      // Current adviser is shown in their own static card, not in the selectable list
      if (section.currentAdviser && teacher.id === section.currentAdviser.id) return false

      const isLocked =
        !!teacher.assignedSection && teacher.assignedSection.id !== section.id
      if (isLocked && !showAssigned) return false

      if (!normalizedSearch) return true
      const searchable =
        `${teacher.name} ${teacher.employeeId ?? ""} ${teacher.department ?? ""} ${teacher.specialization ?? ""}`.toLowerCase()
      return searchable.includes(normalizedSearch)
    })

    return filtered.sort((a, b) => {
      const aIsLocked = !!a.assignedSection && a.assignedSection.id !== section.id
      const bIsLocked = !!b.assignedSection && b.assignedSection.id !== section.id

      // Priority 1: Available before Locked
      if (aIsLocked !== bIsLocked) return aIsLocked ? 1 : -1

      // Priority 2: Program Match score desc (among available only)
      if (!aIsLocked && !bIsLocked) {
        const fitDelta =
          teacherFitScore(section.programType, b) - teacherFitScore(section.programType, a)
        if (fitDelta !== 0) return fitDelta
      }

      // Priority 3: Alphabetical A-Z
      return a.name.localeCompare(b.name)
    })
  }, [normalizedSearch, section, showAssigned, teachers])

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) ?? null,
    [selectedTeacherId, teachers],
  )

  // Count locked teachers (excluding current adviser)
  const lockedCount = useMemo(
    () =>
      teachers.filter(
        (t) =>
          !!t.assignedSection &&
          !!section &&
          t.assignedSection.id !== section.id &&
          t.id !== section.currentAdviser?.id,
      ).length,
    [section, teachers],
  )

  // ── API actions ──────────────────────────────────────────────────────────
  const assignDirectly = async () => {
    if (!section || !selectedTeacherId) return
    setSubmitting(true)
    try {
      await api.put(`/sections/${section.id}`, { advisingTeacherId: selectedTeacherId })
      sileo.success({
        title: "Class adviser assigned",
        description: `Updated advisory assignment for ${section.name}.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      sileo.error({
        title: "Assignment failed",
        description: message ?? "Unable to assign adviser right now.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const executeHandover = async () => {
    if (!section || !selectedTeacherId) return
    setSubmitting(true)
    try {
      await api.post(`/sections/${section.id}/handover-adviser`, {
        substituteTeacherId: selectedTeacherId,
        handoverReason: `[${reasonCategory}] ${justification.trim()}`,
      })
      sileo.success({
        title: "Adviser handover completed",
        description: `Adviser transfer for ${section.name} has been logged.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      sileo.error({
        title: "Handover failed",
        description: message ?? "Unable to complete adviser handover.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Wizard navigation ────────────────────────────────────────────────────
  const handleStep1Action = () => {
    if (!section || !selectedTeacher) return
    if (!section.currentAdviser) {
      void assignDirectly()
      return
    }
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
    setReasonCategory("")
    setJustification("")
  }

  const step1Disabled = !selectedTeacherId || submitting
  const step2Disabled = !reasonCategory || !justification.trim() || submitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl p-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/20">
          <DialogTitle className="text-lg font-extrabold uppercase">
            {step === 2 ? "Handover Audit — Confirm Transfer" : "Assign Class Adviser"}
          </DialogTitle>
          <DialogDescription className="text-base font-extrabold text-foreground">
            {section ? `Target: ${section.gradeLevelName} — ${section.name}` : "Select a section"}
          </DialogDescription>
        </DialogHeader>

        {/* ══════════════════════════════════════════════
            STEP 1 — Selection
        ══════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">
            {/* Current Adviser — static locked card (TASK 1) */}
            {section?.currentAdviser && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                      Current Adviser
                    </p>
                    <p className="text-base font-extrabold uppercase leading-tight truncate text-slate-800">
                      {currentAdviserFull?.name ?? section.currentAdviser.name}
                    </p>
                    <p className="text-base font-extrabold text-slate-500">
                      Employee ID: {currentAdviserFull?.employeeId ?? "N/A"}
                    </p>
                    {currentAdviserFull?.specialization && (
                      <p className="text-base font-extrabold text-slate-400 truncate">
                        {currentAdviserFull.specialization}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-extrabold border-red-200 text-red-700 bg-red-50"
                    >
                      Active
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Section label (TASK 2) */}
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-foreground">
              Available Replacements
            </p>

            {/* Search + Show Assigned toggle */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search teacher name, ID, department, specialization..."
                  className="pl-9 h-11 font-extrabold"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none group">
                <div
                  className={cn(
                    "relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer",
                    showAssigned ? "bg-slate-500" : "bg-slate-200",
                  )}
                  onClick={() => setShowAssigned((prev) => !prev)}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                      showAssigned ? "translate-x-4" : "translate-x-0",
                    )}
                  />
                </div>
                <span className="text-[11px] font-extrabold text-foreground whitespace-nowrap group-hover:text-foreground transition-colors">
                  Show assigned
                  {lockedCount > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">({lockedCount})</span>
                  )}
                </span>
              </label>
            </div>

            {/* Candidate list */}
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-64 overflow-y-auto divide-y bg-card">
                {loadingTeachers ? (
                  <div className="h-44 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                  </div>
                ) : isSearching ? (
                  <div className="h-44 flex flex-col items-center justify-center gap-3 text-center">
                    <Search className="h-10 w-10 animate-pulse text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-lg font-extrabold text-slate-500">Searching...</p>
                      <p className="text-base leading-tight font-extrabold text-slate-400">
                        Scanning adviser directory...
                      </p>
                    </div>
                  </div>
                ) : sortedTeachers.length === 0 ? (
                  /* TASK 3 — Empty state */
                  <div className="h-36 flex flex-col items-center justify-center gap-2 text-center px-4">
                    <SearchX className="h-8 w-8 text-slate-300" />
                    <p className="text-base leading-tight font-extrabold text-foreground">
                      No available personnel match this search criteria.
                    </p>
                    {!showAssigned && lockedCount > 0 && !normalizedSearch && (
                      <p className="text-base font-extrabold text-slate-400">
                        Toggle &quot;Show assigned&quot; to view locked personnel.
                      </p>
                    )}
                  </div>
                ) : (
                  sortedTeachers.map((teacher) => {
                    const isLocked =
                      !!teacher.assignedSection &&
                      !!section &&
                      teacher.assignedSection.id !== section.id
                    const isSelected = selectedTeacherId === teacher.id
                    const fitScore = teacherFitScore(
                      section?.programType ?? "REGULAR",
                      teacher,
                    )

                    // Locked row — non-interactive
                    if (isLocked) {
                      return (
                        <div
                          key={teacher.id}
                          aria-disabled="true"
                          className="w-full px-4 py-3 opacity-40 bg-slate-50 cursor-not-allowed"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-full border-2 border-slate-300 bg-slate-100" />
                            <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
                              <div className="space-y-0.5 min-w-0">
                                <p className="text-base font-extrabold uppercase leading-none truncate">
                                  {teacher.name}
                                </p>
                                <p className="text-base font-extrabold text-foreground">
                                  Employee ID: {teacher.employeeId || "N/A"}
                                </p>
                                <p className="text-base font-extrabold text-foreground/80 truncate">
                                  {(teacher.department || "NO DEPT").toUpperCase()} —{" "}
                                  {teacher.specialization || "No specialization"}
                                </p>
                                {teacher.assignedSection && (
                                  <p className="text-[11px] font-extrabold text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Lock className="h-2.5 w-2.5" />
                                    {teacher.assignedSection.gradeLevelName
                                      ? `${teacher.assignedSection.gradeLevelName} — `
                                      : ""}
                                    {teacher.assignedSection.name}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-extrabold border-slate-400 text-slate-600 bg-slate-100 shrink-0"
                              >
                                LOCKED
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // Available row — radio button + red selection highlight
                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => setSelectedTeacherId(teacher.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 transition-all duration-100 group",
                          isSelected
                            ? "bg-red-50 border-l-2 border-l-red-600"
                            : "hover:bg-muted/40 border-l-2 border-l-transparent",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <RadioIndicator checked={isSelected} />
                          </div>
                          <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
                            <div className="space-y-0.5 min-w-0">
                              <p
                                className={cn(
                                  "text-base font-extrabold uppercase leading-none truncate",
                                  isSelected ? "text-red-800" : "text-foreground",
                                )}
                              >
                                {teacher.name}
                              </p>
                              <p className="text-base font-extrabold text-foreground">
                                Employee ID: {teacher.employeeId || "N/A"}
                              </p>
                              <p className="text-base font-extrabold text-foreground/80 truncate">
                                {(teacher.department || "NO DEPT").toUpperCase()} —{" "}
                                {teacher.specialization || "No specialization"}
                              </p>
                            </div>
                            {fitScore > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[9px] font-extrabold border-blue-300 text-blue-700 bg-blue-50 shrink-0"
                              >
                                Program Match
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 2 — Audit Form
        ══════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-5">
            {/* Back navigation */}
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-base font-extrabold text-foreground hover:text-foreground transition-colors group"
            >
              <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to Selection
            </button>

            {/* Transfer comparison block */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4">
              {/* From */}
              <div className="flex-1 space-y-1 min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Transferring From
                </p>
                <p className="text-base leading-tight font-extrabold uppercase truncate text-red-700 line-through decoration-red-400">
                  {section?.currentAdviser?.name ?? "Unknown"}
                </p>
                {currentAdviserFull?.employeeId && (
                  <p className="text-base font-extrabold text-slate-400">
                    ID: {currentAdviserFull.employeeId}
                  </p>
                )}
              </div>

              {/* Center arrow */}
              <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />

              {/* To */}
              <div className="flex-1 space-y-1 min-w-0 text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Transferring To
                </p>
                <p className="text-base leading-tight font-extrabold uppercase truncate text-emerald-700">
                  {selectedTeacher?.name ?? "—"}
                </p>
                {selectedTeacher?.employeeId && (
                  <p className="text-base font-extrabold text-slate-400">
                    ID: {selectedTeacher.employeeId}
                  </p>
                )}
              </div>
            </div>

            {/* Audit form fields */}
            <div className="space-y-4">
              {/* Reason Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                  Reason Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-base leading-tight font-extrabold",
                    "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    !reasonCategory && "text-foreground",
                  )}
                >
                  <option value="" disabled>
                    Select a reason category...
                  </option>
                  {HANDOVER_REASON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specific Justification */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                  Specific Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Provide a detailed justification for this adviser transfer for audit and record purposes..."
                  rows={4}
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-base leading-tight font-extrabold resize-none",
                    "placeholder:text-foreground placeholder:font-normal ring-offset-background",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                />
                <p className="text-[10px] font-extrabold text-foreground text-right">
                  {justification.trim().length} characters
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row items-center justify-between">
          <Button
            variant="ghost"
            className="font-extrabold uppercase text-base"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          {/* TASK 3: Step 1 footer */}
          {step === 1 && (
            <Button
              onClick={handleStep1Action}
              disabled={step1Disabled}
              className={cn(
                "font-extrabold uppercase text-base min-w-48 transition-all duration-150",
                step1Disabled
                  ? "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-100 cursor-not-allowed"
                  : section?.currentAdviser
                    ? "bg-red-700 hover:bg-red-800 text-white border-transparent"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : section?.currentAdviser ? (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Continue Handover
                </>
              ) : (
                "Assign Adviser"
              )}
            </Button>
          )}

          {/* TASK 3: Step 2 footer */}
          {step === 2 && (
            <Button
              onClick={() => void executeHandover()}
              disabled={step2Disabled}
              className={cn(
                "font-extrabold uppercase text-base min-w-56 transition-all duration-150",
                step2Disabled
                  ? "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-100 cursor-not-allowed"
                  : "bg-red-700 hover:bg-red-800 text-white border-transparent",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Confirm &amp; Transfer Adviser
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
