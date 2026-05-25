import { useState, useEffect, useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import { sileo } from "sileo"
import { ArrowRightLeft, Plus, Users } from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { queryKeys } from "@/shared/lib/queryKeys"
import { useSettingsStore } from "@/store/settings.slice"
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly"
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Skeleton } from "@/shared/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs"
import { ConfirmationModal } from "@/shared/ui/confirmation-modal"
import { SectionFormSheet } from "../components/SectionFormSheet"
import SectionRosterModal from "../components/SectionRosterModal"
import { AssignAdviserModal } from "../components/AssignAdviserModal"
import type {
  AdviserCandidate,
  SectionFormState,
  SectionItem,
  TeacherOption,
} from "../types"
import {
  DEFAULT_MAX_CAPACITY_REGULAR,
  DEFAULT_MAX_CAPACITY_SCP,
} from "@enrollpro/shared/constants"

interface GradeLevelGroup {
  gradeLevelId: number
  gradeLevelName: string
  displayOrder: number
  sections: SectionItem[]
}

const SCP_SHORT_LABELS: Record<string, string> = {
  REGULAR: "Regular (BEC)",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
}

function SectionCard({
  section,
  onEdit,
  onDelete,
  onViewRoster,
  onOpenAssignAdviser,
  canMutate,
}: {
  section: SectionItem
  onEdit: () => void
  onDelete: () => void
  onViewRoster: () => void
  onOpenAssignAdviser: () => void
  canMutate: boolean
}) {
  const pct = section.fillPercent ?? Math.round((section.enrolledCount / section.maxCapacity) * 100)

  return (
    <div
      className="rounded-lg border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onViewRoster}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onViewRoster() }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black uppercase text-sm text-foreground truncate">{section.name}</p>
          {section.programType !== "REGULAR" && (
            <Badge variant="outline" className="mt-1 text-[10px] font-bold uppercase">
              {SCP_SHORT_LABELS[section.programType] ?? section.programType}
            </Badge>
          )}
        </div>
        {canMutate && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-bold" onClick={(e) => { e.stopPropagation(); onEdit() }}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-bold text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete() }}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground font-bold space-y-1">
        {canMutate ? (
          section.advisingTeacher ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenAssignAdviser()
              }}
              className="w-full rounded-md border border-primary/20 bg-primary/5 px-2 py-2 text-left hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-black text-foreground">
                  Adviser: {section.advisingTeacher.name}
                </p>
                <ArrowRightLeft className="h-3.5 w-3.5 text-primary shrink-0" />
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenAssignAdviser()
              }}
              className="w-full rounded-md border-2 border-dashed border-amber-300 bg-amber-50/60 px-2 py-2 text-left text-amber-800 hover:border-primary/50 hover:bg-amber-50 transition-colors"
            >
              + Assign Class Adviser
            </button>
          )
        ) : (
          <p>
            <span className="text-foreground/70">Adviser:</span>{" "}
            {section.advisingTeacher?.name ?? (
              <span className="italic opacity-60">Unassigned</span>
            )}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Users className="size-3 shrink-0" />
          <span>
            {section.enrolledCount} / {section.maxCapacity}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct > 100
                  ? "bg-red-500"
                  : pct >= 90
                    ? "bg-orange-400"
                    : pct >= 75
                      ? "bg-yellow-400"
                      : "bg-green-500"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Homerooms() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore()
  const ayId = viewingSchoolYearId ?? activeSchoolYearId
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly()
  const canMutate = !isHistoricalReadOnly || hasOverride
  const queryClient = useQueryClient()

  const [activeGradeId, setActiveGradeId] = useState("")

  // Form sheet state
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false)
  const [formSheetMode, setFormSheetMode] = useState<"create" | "edit">("create")
  const [sectionFormData, setSectionFormData] = useState<SectionFormState>({
    name: "",
    programType: "REGULAR",
    sectionType: "HOME_ROOM",
    adviserId: "none",
    maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
    tleProgramId: null,
  })
  const [pendingIsHomogeneous, setPendingIsHomogeneous] = useState(false)
  const [createGlId, setCreateGlId] = useState<number | null>(null)
  const [createGlName, setCreateGlName] = useState("")
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [assignTarget, setAssignTarget] = useState<{
    id: number
    name: string
    gradeLevelName: string
    programType: string
    currentAdviser: { id: number; name: string } | null
  } | null>(null)

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteName, setDeleteName] = useState("")

  // Roster modal state
  const [rosterSectionId, setRosterSectionId] = useState<number | null>(null)

  const sectionsQuery = useQuery({
    queryKey: ayId ? queryKeys.homeroomSections(ayId) : (["homerooms", "sections", null] as const),
    queryFn: async () => {
      const res = await api.get(`/sections/${ayId}`)
      return res.data.gradeLevels as GradeLevelGroup[]
    },
    enabled: Boolean(ayId),
  })

  const programOptionsQuery = useQuery({
    queryKey: ayId ? queryKeys.homeroomPrograms(ayId) : (["homerooms", "programs", null] as const),
    queryFn: async () => {
      const res = await api.get(`/curriculum/${ayId}/scp-config`)
      const configs: { isOffered: boolean; scpType: string }[] = res.data.scpProgramConfigs || []
      const offered = configs
        .filter((config) => config.isOffered)
        .map((config) => ({
          value: config.scpType,
          label: SCP_SHORT_LABELS[config.scpType] ?? config.scpType,
        }))
      return [{ value: "REGULAR", label: "Regular (BEC)" }, ...offered]
    },
    enabled: Boolean(ayId),
  })

  const excludeSectionId = isFormSheetOpen && formSheetMode === "edit" ? editingSectionId : null

  const availableTeachersQuery = useQuery({
    queryKey:
      ayId && isFormSheetOpen
        ? queryKeys.homeroomTeachers(ayId, excludeSectionId)
        : (["homerooms", "teachers", null, null] as const),
    queryFn: async () => {
      const params = new URLSearchParams({
        schoolYearId: String(ayId),
        sectionType: "HOME_ROOM",
      })
      if (excludeSectionId) {
        params.set("excludeSectionId", String(excludeSectionId))
      }
      const res = await api.get(`/sections/teachers?${params.toString()}`)
      return res.data.teachers as TeacherOption[]
    },
    enabled: Boolean(ayId && isFormSheetOpen),
  })

  const adviserCandidatesQuery = useQuery({
    queryKey:
      ayId ? queryKeys.homeroomAdviserCandidates(ayId) : (["homerooms", "adviser-candidates", null] as const),
    queryFn: async () => {
      const res = await api.get("/teachers", {
        params: { schoolYearId: ayId },
      })

      return (res.data.teachers || [])
        .filter(
          (teacher: { isActive?: boolean; designationTitle?: string | null }) =>
            teacher.isActive &&
            String(teacher.designationTitle ?? "").toUpperCase() === "CLASS ADVISER",
        )
        .map(
          (teacher: {
            id: number
            firstName: string
            lastName: string
            middleName: string | null
            employeeId: string | null
            department: string | null
            specialization: string | null
            isActive: boolean
            designationTitle: string | null
            designation?: {
              isClassAdviser?: boolean
              advisorySection?: {
                id: number
                name: string
                gradeLevelName: string
              } | null
            } | null
          }) => ({
            id: teacher.id,
            name: `${teacher.lastName}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`,
            employeeId: teacher.employeeId,
            department: teacher.department,
            specialization: teacher.specialization,
            isActive: teacher.isActive,
            designationTitle: teacher.designationTitle,
            assignedSection:
              teacher.designation?.isClassAdviser && teacher.designation?.advisorySection
                ? {
                    id: teacher.designation.advisorySection.id,
                    name: teacher.designation.advisorySection.name,
                    gradeLevelName: teacher.designation.advisorySection.gradeLevelName,
                  }
                : null,
          }),
        ) as AdviserCandidate[]
    },
    enabled: Boolean(ayId),
  })

  const groups = sectionsQuery.data ?? []
  const loading = sectionsQuery.isPending || sectionsQuery.isFetching
  const showSkeleton = useDelayedLoading(loading)
  const programOptions = programOptionsQuery.data ?? [{ value: "REGULAR", label: "Regular (BEC)" }]
  const availableTeachers = availableTeachersQuery.data ?? []
  const loadingTeachers = availableTeachersQuery.isPending || availableTeachersQuery.isFetching
  const adviserCandidates = adviserCandidatesQuery.data ?? []
  const loadingAdviserCandidates =
    adviserCandidatesQuery.isPending || adviserCandidatesQuery.isFetching

  useEffect(() => {
    if (groups.length > 0) {
      setActiveGradeId((prev) => prev || String(groups[0].gradeLevelId))
    }
  }, [groups])

  const invalidateHomeroomQueries = useCallback(async () => {
    if (!ayId) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.homeroomSections(ayId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.homeroomPrograms(ayId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.homeroomAdviserCandidates(ayId) }),
    ])
  }, [ayId, queryClient])

  const saveSectionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: sectionFormData.name.trim(),
        programType: sectionFormData.programType,
        advisingTeacherId:
          sectionFormData.adviserId === "none" ? null : parseInt(sectionFormData.adviserId),
        maxCapacity: sectionFormData.maxCapacity,
        isHomogeneous: pendingIsHomogeneous,
        tleProgramId: null,
      }

      if (formSheetMode === "create") {
        return api.post("/sections", { ...payload, gradeLevelId: createGlId, schoolYearId: ayId })
      }

      return api.put(`/sections/${editingSectionId}`, payload)
    },
    onSuccess: async () => {
      sileo.success({
        title: formSheetMode === "create" ? "Section created" : "Section updated",
        description:
          formSheetMode === "create"
            ? `${sectionFormData.name.trim()} added successfully.`
            : `Changes to ${sectionFormData.name.trim()} saved.`,
      })
      setIsFormSheetOpen(false)
      await invalidateHomeroomQueries()
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { message?: string } } }
      sileo.error({
        title: formSheetMode === "create" ? "Section creation failed" : "Section update failed",
        description: apiErr.response?.data?.message ?? "Please try again.",
      })
    },
  })

  const deleteSectionMutation = useMutation({
    mutationFn: async () => api.delete(`/sections/${deleteId}`),
    onSuccess: async () => {
      sileo.success({ title: "Section removed", description: `${deleteName} was removed.` })
      setDeleteId(null)
      await invalidateHomeroomQueries()
    },
    onError: () => {
      sileo.error({
        title: "Section deletion failed",
        description: "The section was not removed. Please try again.",
      })
    },
  })

  const handleOpenAssignAdviser = useCallback(
    (section: SectionItem, gradeLevelName: string) => {
      if (!canMutate) return
      setAssignTarget({
        id: section.id,
        name: section.name,
        gradeLevelName,
        programType: section.programType,
        currentAdviser: section.advisingTeacher,
      })
    },
    [canMutate],
  )

  const handleOpenCreate = useCallback((glId: number, glName: string, programType = "REGULAR", isHomogeneous = false) => {
    setFormSheetMode("create")
    setEditingSectionId(null)
    setCreateGlId(glId)
    setCreateGlName(glName)
    setPendingIsHomogeneous(isHomogeneous)
    setSectionFormData({
      name: "",
      programType,
      sectionType: "HOME_ROOM",
      adviserId: "none",
      maxCapacity: programType === "REGULAR" ? DEFAULT_MAX_CAPACITY_REGULAR : DEFAULT_MAX_CAPACITY_SCP,
      tleProgramId: null,
    })
    setIsFormSheetOpen(true)
  }, [])

  const handleOpenEdit = useCallback((section: SectionItem, glName: string) => {
    setFormSheetMode("edit")
    setEditingSectionId(section.id)
    setCreateGlName(glName)
    setPendingIsHomogeneous(section.isHomogeneous)
    setSectionFormData({
      name: section.name,
      programType: section.programType,
      sectionType: "HOME_ROOM",
      adviserId: section.advisingTeacher ? String(section.advisingTeacher.id) : "none",
      maxCapacity: section.maxCapacity,
      tleProgramId: null,
    })
    setIsFormSheetOpen(true)
  }, [])

  const handleFieldChange = useCallback(
    (field: keyof SectionFormState, value: string | number | null) => {
      setSectionFormData((prev) => {
        const next = { ...prev, [field]: value }
        if (field === "programType") {
          next.maxCapacity =
            value === "REGULAR" ? DEFAULT_MAX_CAPACITY_REGULAR : DEFAULT_MAX_CAPACITY_SCP
        }
        return next
      })
    },
    [],
  )

  const handleFormSubmit = async () => {
    if (!sectionFormData.name.trim()) return
    await saveSectionMutation.mutateAsync()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteSectionMutation.mutateAsync()
  }

  // All sections are homeroom sections (TLE labs no longer exist)
  const homeroomGroups = groups

  if (showSkeleton) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-black uppercase text-foreground">Homeroom Sections</h1>
        <p className="text-sm text-foreground font-bold">Manage grade level sections and advising teachers</p>
      </div>

      <Tabs value={activeGradeId} onValueChange={setActiveGradeId}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative">
          {homeroomGroups.map((g) => (
            <TabsTrigger
              key={g.gradeLevelId}
              value={String(g.gradeLevelId)}
              className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              {activeGradeId === String(g.gradeLevelId) && (
                <motion.div
                  layoutId="homerooms-grade-pill"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-20">{g.gradeLevelName.replace(/grade\s*/i, "Grade ")}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeGradeId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full">
            {homeroomGroups.map((g) => {
              const homoBecSections = g.sections.filter((s) => s.programType === "REGULAR" && s.isHomogeneous)
              const heteroBecSections = g.sections.filter((s) => s.programType === "REGULAR" && !s.isHomogeneous)

              return (
                <TabsContent
                  key={g.gradeLevelId}
                  value={String(g.gradeLevelId)}
                  className="mt-0 focus-visible:outline-none ring-0 space-y-8">

                  {/* SCP Section — derived from actual section data, not config */}
                  {(() => {
                    const SCP_TYPES = [
                      "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
                      "SPECIAL_PROGRAM_IN_THE_ARTS",
                      "SPECIAL_PROGRAM_IN_SPORTS",
                      "SPECIAL_PROGRAM_IN_JOURNALISM",
                      "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
                      "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
                    ] as const
                    const presentScpTypes = SCP_TYPES.filter(
                      (pt) => g.sections.some((s) => s.programType === pt)
                    )
                    if (presentScpTypes.length === 0) return null
                    return (
                      <section className="space-y-4">
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-foreground bg-muted px-2 py-0.5 rounded">Special Curricular Programs (SCP)</span>
                        </div>
                        <div className="space-y-6 pl-4 border-l-2 border-muted">
                          {presentScpTypes.map((programType) => {
                            const label = SCP_SHORT_LABELS[programType] ?? programType
                            const sections = g.sections.filter((s) => s.programType === programType)
                            return (
                              <div key={programType} className="space-y-3">
                                <h3 className="text-sm font-black uppercase text-foreground tracking-wide">{label}</h3>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {sections.map((s) => (
                                    <SectionCard
                                      key={s.id}
                                      section={s}
                                      onEdit={() => handleOpenEdit(s, g.gradeLevelName)}
                                      onDelete={() => { setDeleteId(s.id); setDeleteName(s.name) }}
                                      onViewRoster={() => setRosterSectionId(s.id)}
                                      onOpenAssignAdviser={() => handleOpenAssignAdviser(s, g.gradeLevelName)}
                                      canMutate={canMutate}
                                    />
                                  ))}
                                  {canMutate && (
                                    <button
                                      onClick={() => handleOpenCreate(g.gradeLevelId, g.gradeLevelName, programType, true)}
                                      className="flex min-h-[100px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                                      <Plus className="size-4" />
                                      Add {label} Section
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })()}

                  {/* BEC Section */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xs font-black uppercase tracking-widest text-foreground bg-muted px-2 py-0.5 rounded">Basic Education Curriculum (BEC)</span>
                    </div>
                    <div className="space-y-6 pl-4 border-l-2 border-muted">
                      {/* Homogeneous / Pilot */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black uppercase text-foreground tracking-wide">
                          BEC <span className="font-medium normal-case text-foreground/60">(Homogeneous / Pilot Section)</span>
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {homoBecSections.map((s) => (
                            <SectionCard
                              key={s.id}
                              section={s}
                              onEdit={() => handleOpenEdit(s, g.gradeLevelName)}
                              onDelete={() => { setDeleteId(s.id); setDeleteName(s.name) }}
                              onViewRoster={() => setRosterSectionId(s.id)}
                              onOpenAssignAdviser={() => handleOpenAssignAdviser(s, g.gradeLevelName)}
                              canMutate={canMutate}
                            />
                          ))}
                          {canMutate && (
                            <button
                              onClick={() => handleOpenCreate(g.gradeLevelId, g.gradeLevelName, "REGULAR", true)}
                              className="flex min-h-[100px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                              <Plus className="size-4" />
                              Add Homogeneous Section
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Heterogeneous */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black uppercase text-foreground tracking-wide">
                          BEC <span className="font-medium normal-case text-foreground/60">(Heterogeneous Section)</span>
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {heteroBecSections.map((s) => (
                            <SectionCard
                              key={s.id}
                              section={s}
                              onEdit={() => handleOpenEdit(s, g.gradeLevelName)}
                              onDelete={() => { setDeleteId(s.id); setDeleteName(s.name) }}
                              onViewRoster={() => setRosterSectionId(s.id)}
                              onOpenAssignAdviser={() => handleOpenAssignAdviser(s, g.gradeLevelName)}
                              canMutate={canMutate}
                            />
                          ))}
                          {canMutate && (
                            <button
                              onClick={() => handleOpenCreate(g.gradeLevelId, g.gradeLevelName, "REGULAR", false)}
                              className="flex min-h-[100px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                              <Plus className="size-4" />
                              Add Heterogeneous Section
                            </button>
                          )}
                        </div>
                      </div>

                      {homoBecSections.length === 0 && heteroBecSections.length === 0 && !canMutate && (
                        <p className="py-8 text-center text-sm font-bold text-muted-foreground">
                          No homeroom sections for this grade level.
                        </p>
                      )}
                    </div>
                  </section>
                </TabsContent>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </Tabs>

      <SectionFormSheet
        mode={formSheetMode}
        open={isFormSheetOpen}
        title={formSheetMode === "create" ? `Add Homeroom — ${createGlName}` : "Edit Homeroom Section"}
        description={
          formSheetMode === "create"
            ? "Create a new homeroom section for this grade level."
            : "Update the homeroom section details."
        }
        formData={sectionFormData}
        submitting={saveSectionMutation.isPending}
        canSubmit={!!sectionFormData.name.trim()}
        onOpenChange={setIsFormSheetOpen}
        onFieldChange={handleFieldChange}
        onCancel={() => setIsFormSheetOpen(false)}
        onSubmit={handleFormSubmit}
        programOptions={programOptions}
        teachers={availableTeachers}
        loadingTeachers={loadingTeachers}
        gradeLevelName={createGlName}
        gradeLevelDisplayOrder={0}
        tlePrograms={[]}
        defaultMode="HOMEROOM"
      />

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Remove Section"
        description={`Are you sure you want to remove "${deleteName}"? This cannot be undone.`}
        confirmText={deleteSectionMutation.isPending ? "Removing..." : "Remove Section"}
        onConfirm={handleDelete}
        variant="danger"
      />

      <SectionRosterModal
        sectionId={rosterSectionId}
        open={rosterSectionId !== null}
        onOpenChange={(open) => { if (!open) setRosterSectionId(null) }}
      />

      <AssignAdviserModal
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null)
        }}
        section={assignTarget}
        teachers={adviserCandidates}
        loadingTeachers={loadingAdviserCandidates}
        onSuccess={() => {
          void invalidateHomeroomQueries()
        }}
      />
    </div>
  )
}
