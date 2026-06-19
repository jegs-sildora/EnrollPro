import { useState, useEffect, useCallback, Fragment, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import { sileo } from "sileo"
import { Plus } from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { queryKeys } from "@/shared/lib/queryKeys"
import { useSettingsStore } from "@/store/settings.slice"
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly"
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading"
import { Button } from "@/shared/ui/button"
import { Skeleton } from "@/shared/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs"

import { SectionFormSheet } from "../components/SectionFormSheet"
import SectionRosterModal from "../components/SectionRosterModal"
import { cn } from "@/shared/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table"
import type {

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



export default function Homerooms() {
  const { activeSchoolYearId, viewingSchoolYearId, enableHomogeneousSections } = useSettingsStore()
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
    curriculumProgram: "REGULAR",
    sectionType: "HOME_ROOM",
    adviserId: "none",
    maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
    tleProgramId: null,
  })
  const [createGlId, setCreateGlId] = useState<number | null>(null)
  const [createGlName, setCreateGlName] = useState("")
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)




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
      const opts = [
        { value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "Science, Technology, and Engineering (STE)" },
        { value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "Special Program in the Arts (SPA)" },
        { value: "SPECIAL_PROGRAM_IN_SPORTS", label: "Special Program in Sports (SPS)" },
      ]

      if (enableHomogeneousSections) {
        opts.unshift({ value: "REGULAR_HETERO", label: "Regular/BEC (Heterogeneous)" })
        opts.unshift({ value: "REGULAR_HOMO", label: "Regular/BEC (Homogeneous)" })
      } else {
        opts.unshift({ value: "REGULAR_HETERO", label: "Regular/BEC (Heterogeneous)" })
      }
      return opts
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


  const groups = sectionsQuery.data ?? []
  const loading = sectionsQuery.isPending || sectionsQuery.isFetching
  const showSkeleton = useDelayedLoading(loading)
  const programOptions = programOptionsQuery.data ?? [{ value: "REGULAR_HETERO", label: "Regular/BEC (Hetero)" }]

  const rawTeachers = availableTeachersQuery.data ?? []
  const currentAdviser = formSheetMode === "edit" && editingSectionId
    ? groups.flatMap(g => g.sections).find(s => s.id === editingSectionId)?.advisingTeacher
    : null;

  const availableTeachers = useMemo(() => {
    const list = [...rawTeachers];
    if (currentAdviser && !list.some(t => t.id === currentAdviser.id)) {
      list.push({ id: currentAdviser.id, name: currentAdviser.name, employeeId: "" });
    }
    return list;
  }, [rawTeachers, currentAdviser]);

  const loadingTeachers = availableTeachersQuery.isPending || availableTeachersQuery.isFetching

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
    ])
  }, [ayId, queryClient])

  const saveSectionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: sectionFormData.name.trim(),
        programType: (sectionFormData.curriculumProgram || "REGULAR").replace("_HOMO", "").replace("_HETERO", ""),
        isHomogeneous: sectionFormData.curriculumProgram === "REGULAR_HOMO",
        advisingTeacherId:
          sectionFormData.adviserId === "none" ? null : parseInt(sectionFormData.adviserId),
        maxCapacity: sectionFormData.maxCapacity,
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



  const handleOpenCreate = useCallback(() => {
    const currentGroup = groups.find((g) => String(g.gradeLevelId) === activeGradeId)
    if (!currentGroup) return

    setFormSheetMode("create")
    setEditingSectionId(null)
    setCreateGlId(currentGroup.gradeLevelId)
    setCreateGlName(currentGroup.gradeLevelName)
    setSectionFormData({
      name: "",
      curriculumProgram: enableHomogeneousSections ? "REGULAR_HOMO" : "REGULAR_HETERO",
      sectionType: "HOME_ROOM",
      adviserId: "none",
      maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
      tleProgramId: null,
    })
    setIsFormSheetOpen(true)
  }, [activeGradeId, groups])

  const handleOpenEdit = useCallback((section: SectionItem, glName: string) => {
    setFormSheetMode("edit")
    setEditingSectionId(section.id)
    setCreateGlName(glName)
    setSectionFormData({
      name: section.name,
      curriculumProgram: section.programType === "REGULAR"
        ? (section.isHomogeneous ? "REGULAR_HOMO" : "REGULAR_HETERO")
        : section.programType,
      sectionType: "HOME_ROOM",
      adviserId: section.advisingTeacher ? String(section.advisingTeacher.id) : "none",
      maxCapacity: section.maxCapacity,
      tleProgramId: null,
    })
    setIsFormSheetOpen(true)
  }, [])

  const handleFieldChange = useCallback(
    (field: keyof SectionFormState, value: string | number | null | boolean) => {
      setSectionFormData((prev) => {
        const next = { ...prev, [field]: value }
        if (field === "curriculumProgram") {
          next.maxCapacity =
            String(value).startsWith("REGULAR") ? DEFAULT_MAX_CAPACITY_REGULAR : DEFAULT_MAX_CAPACITY_SCP
        }
        return next as SectionFormState
      })
    },
    [],
  )

  const handleFormSubmit = async () => {
    if (!sectionFormData.name.trim()) return
    await saveSectionMutation.mutateAsync()
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Class Advisership & Section Management</h1>
          <p className="text-base leading-tight text-foreground font-bold">Define grade level capacities and assign official class advisers to homeroom sections.</p>
        </div>
        {canMutate && homeroomGroups.length > 0 && (
          <Button onClick={handleOpenCreate} className="font-bold uppercase tracking-wide">
            <Plus className="mr-2 h-4 w-4" />
            Create New Section
          </Button>
        )}
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
              <span className={cn("relative z-20 text-base uppercase", activeGradeId === String(g.gradeLevelId) ? "text-primary-foreground" : "text-foreground")}>
                {g.gradeLevelName}
              </span>
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
              const steSections = g.sections.filter((s) => s.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING")
              const spsSections = g.sections.filter((s) => s.programType === "SPECIAL_PROGRAM_IN_SPORTS")
              const spaSections = g.sections.filter((s) => s.programType === "SPECIAL_PROGRAM_IN_THE_ARTS")
              const otherScpSections = g.sections.filter((s) => s.programType !== "REGULAR" && !["SCIENCE_TECHNOLOGY_AND_ENGINEERING", "SPECIAL_PROGRAM_IN_SPORTS", "SPECIAL_PROGRAM_IN_THE_ARTS"].includes(s.programType))
              const pilotSections = g.sections.filter((s) => s.programType === "REGULAR" && s.isHomogeneous)
              const regularSections = g.sections.filter((s) => s.programType === "REGULAR" && !s.isHomogeneous)

              const hasSections = g.sections.length > 0

              const renderSectionGroup = (sections: typeof g.sections, title: string) => {
                if (sections.length === 0) return null;
                return (
                  <Fragment>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableCell colSpan={3} className="py-2 pl-6">
                        <span className="font-black uppercase tracking-widest text-foreground/50">{title}</span>
                      </TableCell>
                    </TableRow>
                    {sections.map((s) => {
                      const pct = s.fillPercent ?? Math.round((s.enrolledCount / s.maxCapacity) * 100)
                      return (
                        <TableRow key={s.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => handleOpenEdit(s, g.gradeLevelName)}>
                          <TableCell className="font-medium text-left pl-6">
                            <div className="flex items-center gap-2">
                              <span className="font-black uppercase text-base leading-tight text-foreground">{s.name}</span>

                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <span className={cn("text-base font-bold uppercase", !s.advisingTeacher ? "text-amber-500 italic" : "text-foreground")}>
                              {s.advisingTeacher ? s.advisingTeacher.name : "Unassigned"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center pr-6">
                            <div className="flex flex-col gap-1 max-w-[140px] mx-auto">
                              <div className="flex items-center justify-between text-base font-bold text-foreground">
                                <span>{s.enrolledCount} / {s.maxCapacity}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct > 100 ? "bg-red-500" : pct >= 90 ? "bg-orange-400" : pct >= 75 ? "bg-yellow-400" : "bg-green-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                )
              }

              return (
                <TabsContent
                  key={g.gradeLevelId}
                  value={String(g.gradeLevelId)}
                  className="mt-0 focus-visible:outline-none ring-0 space-y-8">

                  {!hasSections ? (
                    <div className="rounded-lg border border-dashed p-12 text-center text-base leading-tight font-bold text-foreground/50 uppercase italic bg-muted/10">
                      No sections in this group.
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-base uppercase text-left pl-6">Section Name</TableHead>
                            <TableHead className="text-base uppercase text-left w-[320px]">Class Adviser</TableHead>
                            <TableHead className="text-base uppercase text-center w-[200px] pr-6">Enrolled</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {renderSectionGroup(steSections, "STE")}
                          {renderSectionGroup(spsSections, "SPS")}
                          {renderSectionGroup(spaSections, "SPA")}
                          {renderSectionGroup(otherScpSections, "Other Special Curricular Programs")}
                          {renderSectionGroup(pilotSections, "BEC (Homogeneous - Top 5)")}
                          {renderSectionGroup(regularSections, "BEC (Heterogeneous)")}
                        </TableBody>
                      </Table>
                    </div>
                  )}
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



      <SectionRosterModal
        sectionId={rosterSectionId}
        open={rosterSectionId !== null}
        onOpenChange={(open) => { if (!open) setRosterSectionId(null) }}
      />
    </div>
  )
}
