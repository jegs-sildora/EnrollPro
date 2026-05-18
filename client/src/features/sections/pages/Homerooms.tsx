import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { sileo } from "sileo"
import { Plus, Users } from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { useSettingsStore } from "@/store/settings.slice"
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly"
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Skeleton } from "@/shared/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs"
import { ConfirmationModal } from "@/shared/ui/confirmation-modal"
import { SectionFormSheet } from "../components/SectionFormSheet"
import type { SectionFormState, SectionItem, TeacherOption } from "../types"
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
  canMutate,
}: {
  section: SectionItem
  onEdit: () => void
  onDelete: () => void
  canMutate: boolean
}) {
  const pct = section.fillPercent ?? Math.round((section.enrolledCount / section.maxCapacity) * 100)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
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
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-bold" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-bold text-destructive hover:text-destructive" onClick={onDelete}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground font-bold space-y-1">
        <p>
          <span className="text-foreground/70">Adviser:</span>{" "}
          {section.advisingTeacher?.name ?? (
            <span className="italic opacity-60">Unassigned</span>
          )}
        </p>
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

  const [groups, setGroups] = useState<GradeLevelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useDelayedLoading(loading)
  const [activeGradeId, setActiveGradeId] = useState("")
  const [programOptions, setProgramOptions] = useState<{ value: string; label: string }[]>([
    { value: "REGULAR", label: "Regular (BEC)" },
  ])

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
  const [submittingForm, setSubmittingForm] = useState(false)
  const [createGlId, setCreateGlId] = useState<number | null>(null)
  const [createGlName, setCreateGlName] = useState("")
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [availableTeachers, setAvailableTeachers] = useState<TeacherOption[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteName, setDeleteName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/sections/${ayId}`)
      setGroups(res.data.gradeLevels)
      if (res.data.gradeLevels.length > 0) {
        setActiveGradeId((prev) => prev || String(res.data.gradeLevels[0].gradeLevelId))
      }
    } catch {
      sileo.error({ title: "Unable to load sections", description: "Refresh the page and try again." })
    } finally {
      setLoading(false)
    }
  }, [ayId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!ayId) return
    api
      .get(`/curriculum/${ayId}/scp-config`)
      .then((res) => {
        const configs: { isOffered: boolean; scpType: string }[] =
          res.data.scpProgramConfigs || []
        const offered = configs
          .filter((c) => c.isOffered)
          .map((c) => ({ value: c.scpType, label: SCP_SHORT_LABELS[c.scpType] ?? c.scpType }))
        setProgramOptions([{ value: "REGULAR", label: "Regular (BEC)" }, ...offered])
      })
      .catch(() => {})
  }, [ayId])

  const fetchTeachers = useCallback(
    async (excludeSectionId?: number | null) => {
      if (!ayId) return
      setLoadingTeachers(true)
      try {
        const params = new URLSearchParams({
          schoolYearId: String(ayId),
          sectionType: "HOME_ROOM",
        })
        if (excludeSectionId) params.set("excludeSectionId", String(excludeSectionId))
        const res = await api.get(`/sections/teachers?${params.toString()}`)
        setAvailableTeachers(res.data.teachers)
      } catch {
        setAvailableTeachers([])
      } finally {
        setLoadingTeachers(false)
      }
    },
    [ayId],
  )

  useEffect(() => {
    if (isFormSheetOpen) {
      void fetchTeachers(formSheetMode === "edit" ? editingSectionId : null)
    }
  }, [isFormSheetOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenCreate = useCallback((glId: number, glName: string) => {
    setFormSheetMode("create")
    setEditingSectionId(null)
    setCreateGlId(glId)
    setCreateGlName(glName)
    setSectionFormData({
      name: "",
      programType: "REGULAR",
      sectionType: "HOME_ROOM",
      adviserId: "none",
      maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
      tleProgramId: null,
    })
    setIsFormSheetOpen(true)
  }, [])

  const handleOpenEdit = useCallback((section: SectionItem, glName: string) => {
    setFormSheetMode("edit")
    setEditingSectionId(section.id)
    setCreateGlName(glName)
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
    setSubmittingForm(true)
    try {
      const payload = {
        name: sectionFormData.name.trim(),
        programType: sectionFormData.programType,
        advisingTeacherId:
          sectionFormData.adviserId === "none" ? null : parseInt(sectionFormData.adviserId),
        maxCapacity: sectionFormData.maxCapacity,
        tleProgramId: null,
      }
      if (formSheetMode === "create") {
        await api.post("/sections", { ...payload, gradeLevelId: createGlId, schoolYearId: ayId })
        sileo.success({ title: "Section created", description: `${payload.name} added successfully.` })
      } else {
        await api.put(`/sections/${editingSectionId}`, payload)
        sileo.success({ title: "Section updated", description: `Changes to ${payload.name} saved.` })
      }
      setIsFormSheetOpen(false)
      void fetchData()
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } }
      sileo.error({
        title: formSheetMode === "create" ? "Section creation failed" : "Section update failed",
        description: apiErr.response?.data?.message ?? "Please try again.",
      })
    } finally {
      setSubmittingForm(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/sections/${deleteId}`)
      sileo.success({ title: "Section removed", description: `${deleteName} was removed.` })
      setDeleteId(null)
      void fetchData()
    } catch {
      sileo.error({
        title: "Section deletion failed",
        description: "The section was not removed. Please try again.",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Keep only homeroom sections (excludes TLE labs)
  const homeroomGroups = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        sections: g.sections.filter((s) => s.tleProgramId == null),
      })),
    [groups],
  )

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
        <h1 className="text-2xl font-black uppercase text-foreground">Homeroom Sections</h1>
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
          const scpSections = g.sections.filter((s) => s.programType !== "REGULAR")
          const becSections = g.sections.filter((s) => s.programType === "REGULAR")

          return (
            <TabsContent key={g.gradeLevelId} value={String(g.gradeLevelId)} className="mt-0 focus-visible:outline-none ring-0 space-y-6">
              {/* SCP Group */}
              {scpSections.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-black uppercase tracking-widest text-foreground text-center">
                    Special Curricular Programs (SCP)
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {scpSections.map((s) => (
                      <SectionCard
                        key={s.id}
                        section={s}
                        onEdit={() => handleOpenEdit(s, g.gradeLevelName)}
                        onDelete={() => {
                          setDeleteId(s.id)
                          setDeleteName(s.name)
                        }}
                        canMutate={canMutate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* BEC Group */}
              <div className="space-y-3">
                {scpSections.length > 0 && (
                  <h2 className="font-black uppercase tracking-widest text-foreground text-center">
                    Basic Education Curriculum (BEC)
                  </h2>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {becSections.map((s) => (
                    <SectionCard
                      key={s.id}
                      section={s}
                      onEdit={() => handleOpenEdit(s, g.gradeLevelName)}
                      onDelete={() => {
                        setDeleteId(s.id)
                        setDeleteName(s.name)
                      }}
                      canMutate={canMutate}
                    />
                  ))}
                  {canMutate && (
                    <button
                      onClick={() => handleOpenCreate(g.gradeLevelId, g.gradeLevelName)}
                      className="flex min-h-[100px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                      <Plus className="size-4" />
                      Add Homeroom
                    </button>
                  )}
                </div>
                {becSections.length === 0 && scpSections.length === 0 && !canMutate && (
                  <p className="py-12 text-center text-sm font-bold text-muted-foreground">
                    No homeroom sections for this grade level.
                  </p>
                )}
              </div>
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
        submitting={submittingForm}
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
        confirmText={deleting ? "Removing..." : "Remove Section"}
        onConfirm={handleDelete}
        variant="danger"
      />
    </div>
  )
}
