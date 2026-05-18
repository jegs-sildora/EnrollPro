import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { sileo } from "sileo"
import { Plus, Users } from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { useSettingsStore } from "@/store/settings.slice"
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly"
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs"
import { ConfirmationModal } from "@/shared/ui/confirmation-modal"
import { SectionFormSheet } from "../components/SectionFormSheet"
import type { SectionFormState, SectionItem, TeacherOption } from "../types"
import { DEFAULT_MAX_CAPACITY_REGULAR } from "@enrollpro/shared/constants"

// ── Types ────────────────────────────────────────────────────────────────────

interface GradeLevelGroup {
  gradeLevelId: number
  gradeLevelName: string
  displayOrder: number
  sections: SectionItem[]
}

interface TLEProgram {
  id: number
  name: string
  category: TLECategory
  isActive: boolean
}

type TLECategory = "ICT" | "HOME_ECONOMICS" | "INDUSTRIAL_ARTS" | "AGRI_FISHERY_ARTS"

// ── Constants ────────────────────────────────────────────────────────────────

const TLE_CATEGORY_LABELS: Record<TLECategory, string> = {
  ICT: "INFORMATION & COMMUNICATIONS TECHNOLOGY (ICT)",
  HOME_ECONOMICS: "HOME ECONOMICS (HE)",
  INDUSTRIAL_ARTS: "INDUSTRIAL ARTS (IA)",
  AGRI_FISHERY_ARTS: "AGRICULTURE & FISHERY ARTS (AFA)",
}

const TLE_CATEGORY_BADGE: Record<TLECategory, string> = {
  ICT: "ICT",
  HOME_ECONOMICS: "HE",
  INDUSTRIAL_ARTS: "IA",
  AGRI_FISHERY_ARTS: "AFA",
}

const TLE_GRADE_DISPLAY_ORDERS = [9, 10]

// ── Sub-components ───────────────────────────────────────────────────────────

function TleSectionCard({
  section,
  category,
  onEdit,
  onDelete,
  canMutate,
}: {
  section: SectionItem
  category: TLECategory | null
  onEdit: () => void
  onDelete: () => void
  canMutate: boolean
}) {
  const pct = section.fillPercent ?? Math.round((section.enrolledCount / section.maxCapacity) * 100)
  const badgeLabel = category ? TLE_CATEGORY_BADGE[category] : null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-black uppercase text-sm text-foreground truncate">{section.name}</p>
          {badgeLabel && (
            <Badge variant="outline" className="text-[10px] font-bold uppercase">
              {badgeLabel}
            </Badge>
          )}
        </div>
        {canMutate && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-bold" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-bold text-destructive hover:text-destructive"
              onClick={onDelete}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground font-bold space-y-1">
        <p>
          <span className="text-foreground/70">TLE Instructor:</span>{" "}
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function TleLaboratories() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore()
  const ayId = viewingSchoolYearId ?? activeSchoolYearId
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly()
  const canMutate = !isHistoricalReadOnly || hasOverride

  const [groups, setGroups] = useState<GradeLevelGroup[]>([])
  const [tlePrograms, setTlePrograms] = useState<TLEProgram[]>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useDelayedLoading(loading)
  const [activeGradeId, setActiveGradeId] = useState("")

  // Form sheet state
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false)
  const [formSheetMode, setFormSheetMode] = useState<"create" | "edit">("create")
  const [sectionFormData, setSectionFormData] = useState<SectionFormState>({
    name: "",
    programType: "REGULAR",
    sectionType: "TLE_LABORATORY",
    adviserId: "none",
    maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
    tleProgramId: null,
  })
  const [submittingForm, setSubmittingForm] = useState(false)
  const [createGlId, setCreateGlId] = useState<number | null>(null)
  const [createGlName, setCreateGlName] = useState("")
  const [createGlDisplayOrder, setCreateGlDisplayOrder] = useState(9)
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [availableTeachers, setAvailableTeachers] = useState<TeacherOption[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteName, setDeleteName] = useState("")
  const [deleting, setDeleting] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [sectionsRes, tleProgramsRes] = await Promise.all([
        api.get(`/sections/${ayId}`),
        api.get("/bosy/tle-programs", { params: { schoolYearId: ayId } }),
      ])
      setGroups(sectionsRes.data.gradeLevels)
      setTlePrograms(tleProgramsRes.data.programs ?? tleProgramsRes.data)
      if (sectionsRes.data.gradeLevels.length > 0) {
        const g9or10 = sectionsRes.data.gradeLevels.find(
          (g: GradeLevelGroup) => TLE_GRADE_DISPLAY_ORDERS.includes(g.displayOrder),
        )
        setActiveGradeId((prev) => prev || String((g9or10 ?? sectionsRes.data.gradeLevels[0]).gradeLevelId))
      }
    } catch {
      sileo.error({ title: "Unable to load TLE sections", description: "Refresh the page and try again." })
    } finally {
      setLoading(false)
    }
  }, [ayId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const fetchTeachers = useCallback(
    async (tleProgramId: number | null, excludeSectionId?: number | null) => {
      if (!ayId) return
      setLoadingTeachers(true)
      try {
        const params = new URLSearchParams({
          schoolYearId: String(ayId),
          sectionType: "TLE_LABORATORY",
        })
        if (tleProgramId != null) params.set("tleProgramId", String(tleProgramId))
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

  // Re-fetch teachers when TLE program selection changes inside the open form
  useEffect(() => {
    if (!isFormSheetOpen) return
    void fetchTeachers(
      sectionFormData.tleProgramId,
      formSheetMode === "edit" ? editingSectionId : null,
    )
  }, [isFormSheetOpen, sectionFormData.tleProgramId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const resolveTleProgram = useCallback(
    (tleProgramId: number | null | undefined): TLEProgram | undefined =>
      tleProgramId != null ? tlePrograms.find((p) => p.id === tleProgramId) : undefined,
    [tlePrograms],
  )

  const resolveTleProgramName = useCallback(
    (tleProgramId: number | null | undefined): string =>
      resolveTleProgram(tleProgramId)?.name ?? "",
    [resolveTleProgram],
  )

  function extractSuffix(sectionName: string, programName: string): string {
    if (!sectionName || !programName) return sectionName
    const prefix = `${programName} - `
    if (sectionName.toLowerCase().startsWith(prefix.toLowerCase())) {
      return sectionName.slice(prefix.length).trim()
    }
    const idx = sectionName.lastIndexOf(" - ")
    return idx >= 0 ? sectionName.slice(idx + 3).trim() : sectionName
  }

  function buildTleName(programName: string, suffix: string): string {
    if (!programName) return suffix
    if (!suffix) return programName
    return `${programName} - ${suffix}`
  }

  // ── Grade tabs: G9/G10 only ───────────────────────────────────────────────

  const tleGradeGroups = useMemo(
    () => groups.filter((g) => TLE_GRADE_DISPLAY_ORDERS.includes(g.displayOrder)),
    [groups],
  )

  // ── Event handlers ───────────────────────────────────────────────────────────

  const handleOpenCreate = useCallback(
    (glId: number, glName: string, glDisplayOrder: number) => {
      setFormSheetMode("create")
      setEditingSectionId(null)
      setCreateGlId(glId)
      setCreateGlName(glName)
      setCreateGlDisplayOrder(glDisplayOrder)
      setSectionFormData({
        name: "",
        programType: "REGULAR",
        sectionType: "TLE_LABORATORY",
        adviserId: "none",
        maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
        tleProgramId: null,
      })
      setIsFormSheetOpen(true)
    },
    [],
  )

  const handleOpenEdit = useCallback(
    (section: SectionItem, glName: string, glDisplayOrder: number) => {
      setFormSheetMode("edit")
      setEditingSectionId(section.id)
      setCreateGlName(glName)
      setCreateGlDisplayOrder(glDisplayOrder)
      setSectionFormData({
        name: section.name,
        programType: "REGULAR",
        sectionType: "TLE_LABORATORY",
        adviserId: section.advisingTeacher ? String(section.advisingTeacher.id) : "none",
        maxCapacity: section.maxCapacity,
        tleProgramId: section.tleProgramId ?? null,
      })
      setIsFormSheetOpen(true)
    },
    [],
  )

  const handleFieldChange = useCallback(
    (field: keyof SectionFormState, value: string | number | null) => {
      setSectionFormData((prev) => {
        const next = { ...prev, [field]: value }
        if (field === "tleProgramId") {
          const nextProgramName = resolveTleProgramName(Number(value))
          const currentProgramName = resolveTleProgramName(prev.tleProgramId)
          const currentSuffix = extractSuffix(prev.name, currentProgramName)
          const suffix = currentSuffix.trim() || "A"
          next.name = buildTleName(nextProgramName, suffix)
        }
        return next
      })
    },
    [resolveTleProgramName],
  )

  const handleFormSubmit = async () => {
    if (!sectionFormData.tleProgramId) {
      sileo.error({
        title: "TLE Specialization Required",
        description: "Please select a TLE specialization before saving.",
      })
      return
    }

    const tleProgramName = resolveTleProgramName(sectionFormData.tleProgramId)
    const suffix = extractSuffix(sectionFormData.name, tleProgramName)
    if (!suffix.trim()) {
      sileo.error({
        title: "Section Name Suffix Required",
        description: `Add a suffix after the specialization name (e.g., ${tleProgramName} - A).`,
      })
      return
    }

    if (!sectionFormData.name.trim()) return
    setSubmittingForm(true)
    try {
      const payload = {
        name: sectionFormData.name.trim(),
        programType: "REGULAR",
        advisingTeacherId:
          sectionFormData.adviserId === "none" ? null : parseInt(sectionFormData.adviserId),
        maxCapacity: sectionFormData.maxCapacity,
        tleProgramId: sectionFormData.tleProgramId,
      }
      if (formSheetMode === "create") {
        await api.post("/sections", {
          ...payload,
          gradeLevelId: createGlId,
          schoolYearId: ayId,
        })
        sileo.success({ title: "TLE section created", description: `${payload.name} added successfully.` })
      } else {
        await api.put(`/sections/${editingSectionId}`, payload)
        sileo.success({ title: "TLE section updated", description: `Changes to ${payload.name} saved.` })
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

  // ── Render ───────────────────────────────────────────────────────────────────

  if (showSkeleton) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-10 w-36" />
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
        <h1 className="text-2xl font-black uppercase text-foreground">TLE Laboratories</h1>
        <p className="text-sm text-foreground font-bold">Manage TLE laboratory sections and advising teachers</p>
      </div>

      {tleGradeGroups.length === 0 ? (
        <p className="py-16 text-center text-sm font-bold text-muted-foreground">
          No Grade 9 or Grade 10 data available for this school year.
        </p>
      ) : (
        <Tabs value={activeGradeId} onValueChange={setActiveGradeId}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative">
            {tleGradeGroups.map((g) => (
              <TabsTrigger
                key={g.gradeLevelId}
                value={String(g.gradeLevelId)}
                className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {activeGradeId === String(g.gradeLevelId) && (
                  <motion.div
                    layoutId="tle-grade-pill"
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
          {tleGradeGroups.map((g) => {
            // Only TLE sections (tleProgramId present)
            const tleSections = g.sections.filter((s) => s.tleProgramId != null)

            // Group by category
            const byCategory = new Map<TLECategory, SectionItem[]>()
            for (const s of tleSections) {
              const prog = resolveTleProgram(s.tleProgramId)
              if (!prog) continue
              const cat = prog.category as TLECategory
              if (!byCategory.has(cat)) byCategory.set(cat, [])
              byCategory.get(cat)!.push(s)
            }

            const categoryOrder: TLECategory[] = [
              "ICT",
              "HOME_ECONOMICS",
              "INDUSTRIAL_ARTS",
              "AGRI_FISHERY_ARTS",
            ]

            return (
              <TabsContent
                key={g.gradeLevelId}
                value={String(g.gradeLevelId)}
                className="mt-0 focus-visible:outline-none ring-0 space-y-6">
                {categoryOrder
                  .filter((cat) => byCategory.has(cat))
                  .map((cat) => (
                    <div key={cat} className="space-y-3">
                      <h2 className="text-[11px] font-black uppercase tracking-widest text-foreground">
                        {TLE_CATEGORY_LABELS[cat]}
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {byCategory.get(cat)!.map((s) => (
                          <TleSectionCard
                            key={s.id}
                            section={s}
                            category={cat}
                            onEdit={() => handleOpenEdit(s, g.gradeLevelName, g.displayOrder)}
                            onDelete={() => {
                              setDeleteId(s.id)
                              setDeleteName(s.name)
                            }}
                            canMutate={canMutate}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                {canMutate && (
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenCreate(g.gradeLevelId, g.gradeLevelName, g.displayOrder)}
                      className="flex min-h-[80px] w-full max-w-xs items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-5 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                      <Plus className="size-4" />
                      Add TLE Section
                    </button>
                  </div>
                )}

                {tleSections.length === 0 && !canMutate && (
                  <p className="py-12 text-center text-sm font-bold text-muted-foreground">
                    No TLE laboratory sections for this grade level.
                  </p>
                )}
              </TabsContent>
            )
          })}
            </motion.div>
          </AnimatePresence>
        </Tabs>
      )}

      <SectionFormSheet
        mode={formSheetMode}
        open={isFormSheetOpen}
        title={
          formSheetMode === "create"
            ? `Add TLE Section — ${createGlName}`
            : "Edit TLE Laboratory Section"
        }
        description={
          formSheetMode === "create"
            ? "Create a new TLE laboratory section."
            : "Update the TLE laboratory section details."
        }
        formData={sectionFormData}
        submitting={submittingForm}
        canSubmit={!!sectionFormData.name.trim() && !!sectionFormData.tleProgramId}
        onOpenChange={setIsFormSheetOpen}
        onFieldChange={handleFieldChange}
        onCancel={() => setIsFormSheetOpen(false)}
        onSubmit={handleFormSubmit}
        programOptions={[]}
        teachers={availableTeachers}
        loadingTeachers={loadingTeachers}
        gradeLevelName={createGlName}
        gradeLevelDisplayOrder={createGlDisplayOrder}
        tlePrograms={tlePrograms.map((p) => ({ id: p.id, name: p.name, category: p.category }))}
        defaultMode="TLE_LAB"
      />

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Remove TLE Section"
        description={`Are you sure you want to remove "${deleteName}"? This cannot be undone.`}
        confirmText={deleting ? "Removing..." : "Remove Section"}
        onConfirm={handleDelete}
        variant="danger"
      />
    </div>
  )
}
