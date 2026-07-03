import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import {
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Info,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import api from "@/shared/api/axiosInstance";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { cn } from "@/shared/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { SectionMasterlistModal } from "./SectionMasterlistModal";
import { isAxiosError } from "axios";

interface SectionSummary {
  id: number;
  name: string;
  gradeLevel: string;
  gradeLevelOrder: number;
  gradeLevelId: number;
  tleProgram: string | null;
  tleProgramId: number | null;
  maxCapacity: number;
  currentCount: number;
  boys: number;
  girls: number;
  adviser: string;
  programType: string;
}

interface PoolLearner {
  applicationId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: "MALE" | "FEMALE";
  genAve: number | null;
  gradeLevel: string;
  gradeLevelId: number;
  tleProgram: string | null;
  tleProgramId: number | null;
  duplicateFlag?: boolean;
  programType: string;
}

interface GradeLevelOption {
  id: number;
  name: string;
  displayOrder: number;
}

interface GradeLevelsResponse {
  gradeLevels: GradeLevelOption[];
}

interface ApiMessageResponse {
  message?: string;
}

const SCP_SHORT_LABELS: Record<string, string> = {
  REGULAR: "Regular / Basic Education",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};

export function SectioningWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();

  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [pool, setPool] = useState<PoolLearner[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isAutoDistributeModalOpen, setIsAutoDistributeModalOpen] = useState(false);
  const [masterlistModalSectionId, setMasterlistModalSectionId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const [activeGradeLevelId, setActiveGradeLevelId] = useState<string>("");

  const {
    data: sectionsData,
    isLoading: sectionsInitialLoading,
  } = useQuery({
    queryKey: queryKeys.sectioningSections(),
    queryFn: () =>
      api.get<SectionSummary[]>("/sectioning/sections-summary").then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const {
    data: poolData,
    isLoading: poolInitialLoading,
  } = useQuery({
    queryKey: queryKeys.sectioningPool(),
    queryFn: () =>
      api.get<PoolLearner[]>("/sectioning/pool").then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const {
    data: gradeLevelsResponse,
    isLoading: gradeLevelsLoading,
  } = useQuery({
    queryKey: ["settings", "grade-levels"],
    queryFn: () =>
      api
        .get<GradeLevelsResponse>("/school-years/grade-levels")
        .then((response) => response.data),
    staleTime: 60_000,
  });

  useEffect(() => { if (sectionsData) setSections(sectionsData); }, [sectionsData]);
  useEffect(() => { if (poolData) setPool(poolData); }, [poolData]);

  const loading = (sectionsInitialLoading || poolInitialLoading || gradeLevelsLoading) && !isHistoricalReadOnly;

  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);

  type SortConfig = { key: "genAve"; direction: "asc" | "desc" } | null;
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const handleSort = (key: "genAve") => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const [filterSex, setFilterSex] = useState<string>("all");
  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
  } = useDebouncedSearch();
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  const gradeLevels = useMemo(() => {
    const raw = gradeLevelsResponse?.gradeLevels ?? [];
    const jhs = raw.filter((gradeLevel) =>
      ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(
        gradeLevel.name,
      ),
    );
    return jhs.sort((a, b) => {
      const orderA = a.displayOrder ?? parseInt(a.name.replace(/\D/g, "")) ?? 0;
      const orderB = b.displayOrder ?? parseInt(b.name.replace(/\D/g, "")) ?? 0;
      return orderA - orderB;
    });
  }, [gradeLevelsResponse]);

  useEffect(() => {
    if (gradeLevels.length > 0 && !activeGradeLevelId) {
      setActiveGradeLevelId(String(gradeLevels[0].id));
    }
  }, [gradeLevels, activeGradeLevelId]);

  const isLockedIn = selectedAppIds.length > 0;

  const currentGradeSections = useMemo(() => {
    if (!activeGradeLevelId) return [];
    return sections.filter((s) => String(s.gradeLevelId) === activeGradeLevelId);
  }, [sections, activeGradeLevelId]);

  const currentGradePool = useMemo(() => {
    if (!activeGradeLevelId) return [];
    return pool.filter((p) => String(p.gradeLevelId) === activeGradeLevelId);
  }, [pool, activeGradeLevelId]);
  const selectedProgramTypes = useMemo(
    () =>
      new Set(
        currentGradePool
          .filter((learner) =>
            selectedAppIds.includes(learner.applicationId),
          )
          .map((learner) => learner.programType),
      ),
    [currentGradePool, selectedAppIds],
  );

  const filteredPool = useMemo(() => {
    return currentGradePool.filter((l) => {
      if (filterSex !== "all" && l.sex !== filterSex) return false;
      if (activeSearchQuery) {
        const q = activeSearchQuery.toLowerCase();
        const fullName = `${l.lastName} ${l.firstName}`.toLowerCase();
        if (!fullName.includes(q) && !l.lrn?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [currentGradePool, activeSearchQuery, filterSex]);

  const filteredAndSortedPool = useMemo(() => {
    const result = [...filteredPool];
    if (sortConfig !== null) {
      result.sort((a, b) => {
        if (sortConfig.key === "genAve") {
          const aVal = a.genAve ?? -1;
          const bVal = b.genAve ?? -1;
          if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }
    return result;
  }, [filteredPool, sortConfig]);

  const assignLearners = async () => {
    if (!targetSectionId || selectedAppIds.length === 0) return;

    setProcessing(true);
    try {
      await api.post("/sectioning/assign-bulk", {
        sectionId: targetSectionId,
        applicationIds: selectedAppIds,
      });

      const sectionName = currentGradeSections.find((s) => s.id === targetSectionId)?.name;
      sileo.success({
        title: "Assignment Successful",
        description: `Moved ${selectedAppIds.length} learners to ${sectionName}.`,
      });
      setSelectedAppIds([]);
      setTargetSectionId(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningSections() });
    } catch (error: unknown) {
      sileo.error({
        title: "Assignment Failed",
        description:
          (isAxiosError<ApiMessageResponse>(error)
            ? error.response?.data.message
            : undefined)
          ?? "An error occurred while moving learners. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!activeGradeLevelId) return;
    setProcessing(true);
    try {
      const res = await api.post<ApiMessageResponse>("/sections/auto-distribute", {
        gradeLevelId: activeGradeLevelId,
      });
      sileo.success({
        title: "Auto-Distribute Successful",
        description: res.data.message || `Successfully distributed learners.`,
      });
      setIsAutoDistributeModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningSections() });
    } catch (error: unknown) {
      sileo.error({
        title: "Auto-Distribute Failed",
        description:
          (isAxiosError<ApiMessageResponse>(error)
            ? error.response?.data.message
            : undefined)
          ?? "An error occurred during auto-distribution.",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-base leading-tight font-extrabold text-slate-500 uppercase tracking-widest animate-pulse">
            Loading Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <Tabs value={activeGradeLevelId} onValueChange={(val) => {
        if (!isLockedIn) setActiveGradeLevelId(val);
      }} className="flex-shrink-0 mb-6">
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-4 p-1 bg-white border border-border rounded-xl relative shadow-sm">
          {gradeLevels.map((g) => (
            <TabsTrigger
              key={g.id}
              value={String(g.id)}
              disabled={isLockedIn && activeGradeLevelId !== String(g.id)}
              className={cn(
                "flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg",
                isLockedIn && activeGradeLevelId !== String(g.id) && "opacity-40 cursor-not-allowed bg-muted/20"
              )}
            >
              {activeGradeLevelId === String(g.id) && (
                <motion.div
                  layoutId="enrollment-grade-pill"
                  className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className={cn("relative z-20 text-base uppercase", activeGradeLevelId === String(g.id) ? "text-primary-foreground" : "text-foreground")}>{g.name.replace(/grade\s*/i, "Grade ")}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── Workspace ── */}
      <div className="flex-1 min-h-0">
        <div className="h-full flex gap-6 min-h-0">
          {/* LEFT PANE: UNSECTIONED POOL */}
          <Card className="flex-[1.2] flex flex-col shadow-sm border border-border overflow-hidden bg-card">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-extrabold uppercase tracking-wide flex items-center gap-2 text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    Unassigned Learners
                  </CardTitle>
                  <CardDescription className="text-sm font-extrabold text-foreground">Unassigned learners awaiting placement.</CardDescription>
                </div>
                <Badge variant="outline" className="font-extrabold bg-background border-border">{selectedAppIds.length} Selected</Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                  <Input
                    placeholder="Search LRN or Name..."
                    className="pl-9 h-10 border-border focus:ring-primary/20 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterSex} onValueChange={setFilterSex}>
                  <SelectTrigger className="w-32 h-10 border-border bg-background">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="MALE">Boys</SelectItem>
                    <SelectItem value="FEMALE">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-auto p-0 relative">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-primary z-10 border-b border-border">
                  <tr className="text-[10px] font-extrabold uppercase text-primary-foreground tracking-widest">
                    <th className="p-4 w-10">
                      <Checkbox
                        className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                        checked={selectedAppIds.length === filteredPool.length && filteredPool.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedAppIds(filteredPool.map((l) => l.applicationId));
                          else setSelectedAppIds([]);
                        }}
                      />
                    </th>
                    <th className="p-4">Learner Detail</th>
                    <th className="p-4 cursor-pointer hover:bg-primary/90 transition-colors select-none" onClick={() => handleSort("genAve")}>
                      <div className="flex items-center gap-1">
                        Gen Ave
                        {sortConfig?.key === "genAve" && (
                          sortConfig.direction === "asc" ? <ChevronUp className="h-3 w-3 text-primary-foreground" /> : <ChevronDown className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-base leading-tight bg-card">
                  {filteredAndSortedPool.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-12 text-center text-foreground font-extrabold">
                        No learners match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedPool.map((l) => {
                      const isSelected = selectedAppIds.includes(l.applicationId);
                      return (
                        <tr
                          key={l.applicationId}
                          onClick={() => {
                            setSelectedAppIds((prev) =>
                              prev.includes(l.applicationId)
                                ? prev.filter((id) => id !== l.applicationId)
                                : [...prev, l.applicationId]
                            );
                          }}
                          className={cn(
                            "group cursor-pointer transition-colors hover:bg-muted/50",
                            isSelected && "bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedAppIds((prev) =>
                                  checked
                                    ? [...prev, l.applicationId]
                                    : prev.filter((id) => id !== l.applicationId)
                                );
                              }}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-foreground uppercase flex items-center gap-2">
                                {l.lastName}, {l.firstName} {l.middleName?.charAt(0) ? `${l.middleName.charAt(0)}.` : ""}
                                {l.duplicateFlag && (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">DUPLICATE DETECTED - RESOLVE OVER COUNTER</Badge>
                                )}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-extrabold uppercase text-foreground tracking-widest">{l.lrn || "NO LRN"}</span>
                                <Badge variant="outline" className="text-[9px] uppercase font-extrabold border-border text-foreground">{l.sex}</Badge>
                                <Badge variant="outline" className="text-[9px] uppercase font-extrabold">
                                  {SCP_SHORT_LABELS[l.programType] ?? l.programType}
                                </Badge>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-extrabold text-foreground/80">
                            {l.genAve ? l.genAve.toFixed(2) : <span className="text-foreground/50">--</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* RIGHT PANE: AVAILABLE SECTIONS */}
          <Card className="flex-1 flex flex-col shadow-sm border border-border overflow-hidden bg-card text-card-foreground">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-extrabold uppercase tracking-wide flex items-center gap-2 text-foreground">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    Available Sections
                  </CardTitle>
                  <CardDescription className="text-foreground text-sm font-extrabold">Select destination to move {selectedAppIds.length || '0'} learners.</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  disabled={currentGradePool.length === 0 || processing}
                  onClick={() => setIsAutoDistributeModalOpen(true)}
                  className="font-extrabold text-base uppercase tracking-normal gap-1"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Auto-Distribute
                </Button>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-auto p-4 space-y-3 relative">
              {currentGradeSections.length === 0 ? (
                <div className="h-full flex items-center justify-center flex-col gap-3 text-foreground">
                  <Info className="h-8 w-8" />
                  <span className="font-extrabold text-base leading-tight">No sections defined for this grade.</span>
                </div>
              ) : (
                currentGradeSections.map((s) => {
                  const isOverCapacity = s.currentCount >= s.maxCapacity;
                  const isSelected = targetSectionId === s.id;
                  const isProgramCompatible =
                    selectedProgramTypes.size === 0
                    || (
                      selectedProgramTypes.size === 1
                      && selectedProgramTypes.has(s.programType)
                    );

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (isProgramCompatible) setTargetSectionId(s.id);
                      }}
                      className={cn(
                        "group cursor-pointer rounded-xl border p-4 transition-all relative overflow-hidden",
                        !isProgramCompatible
                          && "cursor-not-allowed opacity-45",
                        isSelected
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "bg-background hover:bg-muted/50 border-border"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-0 right-0 p-2">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className={cn("font-extrabold text-lg uppercase transition-colors flex items-center gap-2", isSelected ? "text-primary" : "text-foreground")}>
                            {s.name}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-foreground hover:text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMasterlistModalSectionId(s.id);
                              }}
                              title="View Section Masterlist"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                          </h4>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                            {s.adviser || "No Adviser Assigned"}
                          </span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-extrabold uppercase bg-background",
                          s.programType === "REGULAR" ? "text-foreground border-border" : "text-primary border-primary/30"
                        )}>
                          {SCP_SHORT_LABELS[s.programType] ?? s.programType}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-base font-extrabold">
                          <span className="text-foreground uppercase tracking-widest text-[10px]">Capacity Fill</span>
                          <span className={cn(isOverCapacity ? "text-destructive font-extrabold" : "text-foreground/70")}>
                            {s.currentCount} / {s.maxCapacity} {isOverCapacity && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              isOverCapacity ? "bg-destructive" : isSelected ? "bg-primary" : "bg-primary/40"
                            )}
                            style={{ width: `${Math.min((s.currentCount / s.maxCapacity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t border-border bg-muted/20">
              <Button
                onClick={assignLearners}
                disabled={selectedAppIds.length === 0 || !targetSectionId || processing || isHistoricalReadOnly}
                className={cn(
                  "w-full h-12 text-base leading-tight font-extrabold uppercase tracking-widest transition-all shadow-none",
                  selectedAppIds.length > 0 && targetSectionId
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted"
                )}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign to Section (${selectedAppIds.length})`
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmationModal
        open={isAutoDistributeModalOpen}
        onOpenChange={setIsAutoDistributeModalOpen}
        title="Confirm Auto-Distribute"
        description="WARNING: This will automatically distribute all currently unassigned learners into available sections. The algorithm will strictly balance Male/Female ratios and evenly distribute Final General Averages across all regular sections using a Serpentine distribution model. Are you sure you want to proceed?"
        confirmText={processing ? "Distributing..." : "Execute Auto-Distribute"}
        onConfirm={handleAutoDistribute}
        variant="danger"
      />

      {masterlistModalSectionId !== null && (
        <SectionMasterlistModal
          sectionId={masterlistModalSectionId}
          onClose={() => setMasterlistModalSectionId(null)}
        />
      )}
    </div>
  );
}

