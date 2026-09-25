import { useCallback, useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import {
  Users,
  Search,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Info,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  MoveRight,
  ArrowRightLeft,
  Trash2,
  Mars,
  Venus,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Label } from "@/shared/ui/label";
import { motion, AnimatePresence } from "motion/react";
import api from "@/shared/api/axiosInstance";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { cn, SCP_LABELS, getGradeLevelBadgeStyles, formatGradeLevel } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { isAxiosError } from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useSettingsStore } from "@/store/settings.slice";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  getAllowedSectionProgramsForPlacement,
  getAutoDraftProgramType,
  type ApplicantType,
  type LearnerType,
} from "@enrollpro/shared";

import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import ViewMasterlist from "@/features/sections/pages/ViewMasterlist";
import {
  useGuardedTabChange,
  useUnsavedChanges,
} from "@/shared/hooks/useUnsavedChanges";
import { TwoPanelSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { PageTransition } from "@/shared/components/PageTransition";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { useAuthStore } from "@/store/auth.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";

interface SectionSummary {
  id: number;
  name: string;
  gradeLevel: string;
  gradeLevelOrder: number;
  gradeLevelId: number;
  sortOrder: number;
  maxCapacity: number;
  currentCount: number;
  boys: number;
  girls: number;
  adviser: string;
  programType: ApplicantType;
  isHomogeneous?: boolean;
  sectionRank?: number | null;
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
  duplicateFlag?: boolean;
  learnerType: LearnerType;
  isBalikAral: boolean;
  applicantType: ApplicantType;
  assignedProgram: ApplicantType | null;
  programType: ApplicantType;
  academicStatus: string;
  studentPhoto?: string | null;
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

function getApiMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiMessageResponse>(error)) {
    return error.response?.data.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

interface DraftGenderCounts {
  boys: number;
  girls: number;
}

interface DraftLearnerPlacement extends PoolLearner {
  sectionId: number;
  isOverridden: boolean;
}

interface DraftSectionRoster {
  section: SectionSummary;
  learners: DraftLearnerPlacement[];
  genderCounts: DraftGenderCounts;
  totalCount: number;
  isOverCapacity: boolean;
}

interface DraftPlacement {
  gradeLevelId: number;
  generatedAt: string;
  rosters: DraftSectionRoster[];
  unplacedLearners: PoolLearner[];
}

interface InlineMasterlistLearner {
  id: number;
  enrollmentApplicationId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  genAve: number | null;
}

interface InlineMasterlistResponse {
  learners: InlineMasterlistLearner[];
}

function InlineSectionTable({ sectionId, onMoveLearner, onRemoveLearner }: { sectionId: number, onMoveLearner?: (learnerId: number, currentSectionId: number) => void, onRemoveLearner?: (learnerId: number, currentSectionId: number) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["section-masterlist", sectionId],
    queryFn: () => api.get<InlineMasterlistResponse>(`/sections/${sectionId}/masterlist`).then(r => r.data),
  });

  if (isLoading) return <div className="p-4 text-center text-sm font-bold text-muted-foreground animate-pulse mt-4 border rounded-md">Loading learners...</div>;
  if (error || !data) return <div className="p-4 text-center text-sm font-bold text-destructive mt-4 border rounded-md">Failed to load learners</div>;
  if (data.learners.length === 0) return <div className="p-4 text-center text-sm font-bold text-foreground mt-4 border rounded-md">No learners assigned yet.</div>;

  return (
    <div className="mt-4 overflow-hidden rounded-md border bg-card cursor-default" onClick={(e) => e.stopPropagation()}>
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-foreground">
          <tr className="font-bold uppercase">
            <th className="p-3 font-bold">Learner</th>
            <th className="p-3 text-center font-bold">Sex</th>
            <th className="p-3 text-center font-bold">Gen Ave</th>
            <th className="p-3 text-right font-bold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.learners.map((l, index) => (
            <tr key={l.id} className={cn("hover:bg-muted/60 transition-colors", index % 2 === 0 ? "bg-background" : "bg-muted/50")}>
              <td className="p-3">
                <div className="flex flex-col">
                  <span className="font-extrabold text-foreground uppercase">
                    {l.lastName}, {l.firstName} {l.middleName?.charAt(0) ? `${l.middleName.charAt(0)}.` : ""}
                  </span>
                  <span className="text-sm mt-0.5">
                    LRN:{l.lrn || "NO LRN"}
                  </span>
                </div>
              </td>
              <td className="p-1 text-center">
                <Badge className={cn(
                  "px-2",
                  l.sex === "MALE" ? "px-1 bg-blue-600/10 text-blue-600 border-blue-600 border-2" : "px-1 bg-pink-600/10 text-pink-600 border-pink-600 border-2"
                )}>
                  {l.sex === "MALE" ? <Mars className="h-4 w-4" /> : <Venus className="h-4 w-4" />}
                </Badge>
              </td>
              <td className="p-3 text-center font-bold text-foreground">
                {l.genAve?.toFixed(2) ?? "--"}
              </td>
              <td className="p-3 text-right">
                {(onMoveLearner || onRemoveLearner) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onMoveLearner && (
                        <DropdownMenuItem onClick={() => onMoveLearner(l.enrollmentApplicationId, sectionId)}>
                          <MoveRight className="mr-2 h-4 w-4" />
                          Move to Section
                        </DropdownMenuItem>
                      )}
                      {onRemoveLearner && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => onRemoveLearner(l.enrollmentApplicationId, sectionId)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Learner
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


interface DraftMoveAction {
  type: "MOVE" | "SWAP";
  learnerApplicationId: number;
  fromSectionId: number;
}

interface CommitDraftAssignment {
  sectionId: number;
  applicationIds: number[];
}

interface SkippedApplication {
  applicationId: number;
  reason: string;
}

interface CommitDraftResponse {
  committedCount: number;
  committedApplications: Array<{
    applicationId: number;
    enrollmentRecordId: number;
    sectionId: number;
    sectioningMethod: string;
  }>;
  skippedApplications: SkippedApplication[];
}

const SCP_SHORT_LABELS: Partial<Record<ApplicantType, string>> = {
  REGULAR: "BEC",
  LATE_ENROLLEE: "Late",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};

const formatLearnerName = (
  learner: Pick<PoolLearner, "lastName" | "firstName" | "middleName">,
) => {
  const middleInitial = learner.middleName?.charAt(0)
    ? ` ${learner.middleName.charAt(0)}.`
    : "";
  return `${learner.lastName}, ${learner.firstName}${middleInitial}`;
};

const sortLearnersByAverage = (first: PoolLearner, second: PoolLearner) => {
  const firstAverage = first.genAve ?? -1;
  const secondAverage = second.genAve ?? -1;
  return (
    secondAverage - firstAverage || first.applicationId - second.applicationId
  );
};

const _interleaveBySex = (learners: PoolLearner[]) => {
  const males = learners
    .filter((learner) => learner.sex === "MALE")
    .sort(sortLearnersByAverage);
  const females = learners
    .filter((learner) => learner.sex === "FEMALE")
    .sort(sortLearnersByAverage);
  const ordered: PoolLearner[] = [];
  let maleIndex = 0;
  let femaleIndex = 0;
  let preferMale = males.length >= females.length;

  while (maleIndex < males.length || femaleIndex < females.length) {
    const preferred = preferMale ? males[maleIndex] : females[femaleIndex];
    const fallback = preferMale ? females[femaleIndex] : males[maleIndex];
    const selected = preferred ?? fallback;
    if (!selected) break;

    ordered.push(selected);
    if (selected.sex === "MALE") maleIndex += 1;
    else femaleIndex += 1;
    preferMale = !preferMale;
  }

  return ordered;
};

const buildDraftSlots = (sections: SectionSummary[]) => {
  const ordered = [...sections].sort(
    (first, second) =>
      first.sortOrder - second.sortOrder ||
      first.name.localeCompare(second.name) ||
      first.id - second.id,
  );
  const remainingBySection = new Map(
    ordered.map((section) => [
      section.id,
      Math.max(0, section.maxCapacity - section.currentCount),
    ]),
  );
  const slots: number[] = [];
  let forward = true;

  while (
    ordered.some((section) => (remainingBySection.get(section.id) ?? 0) > 0)
  ) {
    const pass = forward ? ordered : [...ordered].reverse();
    for (const section of pass) {
      const remaining = remainingBySection.get(section.id) ?? 0;
      if (remaining <= 0) continue;
      slots.push(section.id);
      remainingBySection.set(section.id, remaining - 1);
    }
    forward = !forward;
  }

  return slots;
};

const calculateGenderCounts = (
  section: SectionSummary,
  learners: DraftLearnerPlacement[],
): DraftGenderCounts => ({
  boys:
    section.boys + learners.filter((learner) => learner.sex === "MALE").length,
  girls:
    section.girls +
    learners.filter((learner) => learner.sex === "FEMALE").length,
});

const buildRoster = (
  section: SectionSummary,
  learners: DraftLearnerPlacement[],
): DraftSectionRoster => {
  const sortedLearners = [...learners].sort(sortLearnersByAverage);
  const totalCount = section.currentCount + sortedLearners.length;
  return {
    section,
    learners: sortedLearners,
    genderCounts: calculateGenderCounts(section, sortedLearners),
    totalCount,
    isOverCapacity: totalCount > section.maxCapacity,
  };
};

const rebuildDraftPlacement = (draft: DraftPlacement): DraftPlacement => ({
  ...draft,
  rosters: draft.rosters.map((roster) =>
    buildRoster(roster.section, roster.learners),
  ),
});

const snakeDraftLearners = (
  sections: SectionSummary[],
  males: PoolLearner[],
  females: PoolLearner[],
  rostersBySectionId: Map<number, DraftLearnerPlacement[]>,
  remainingCapacity: Map<number, number>
): PoolLearner[] => {
  const unplaced: PoolLearner[] = [];
  let sectionIndex = 0;
  let forward = true;

  const getNextValidSection = () => {
    const totalRemaining = Array.from(remainingCapacity.values()).reduce((sum, c) => sum + c, 0);
    if (totalRemaining <= 0) return null;
    
    const startState = { idx: sectionIndex, fwd: forward };
    let looped = false;
    
    while (true) {
      const current = sectionIndex;
      const section = sections[current];
      
      if (forward) {
        if (sectionIndex >= sections.length - 1) forward = false;
        else sectionIndex++;
      } else {
        if (sectionIndex <= 0) forward = true;
        else sectionIndex--;
      }

      if (remainingCapacity.get(section.id)! > 0) return section;
      
      if (sectionIndex === startState.idx && forward === startState.fwd) {
        if (looped) return null;
        looped = true;
      }
    }
  };

  for (const learner of males) {
    const targetSection = getNextValidSection();
    if (targetSection) {
      rostersBySectionId.get(targetSection.id)!.push({ ...learner, sectionId: targetSection.id, isOverridden: false });
      remainingCapacity.set(targetSection.id, remainingCapacity.get(targetSection.id)! - 1);
    } else {
      unplaced.push(learner);
    }
  }

  // Reset pointer for females to ensure perfectly symmetric academic parity
  sectionIndex = 0;
  forward = true;

  for (const learner of females) {
    const targetSection = getNextValidSection();
    if (targetSection) {
      rostersBySectionId.get(targetSection.id)!.push({ ...learner, sectionId: targetSection.id, isOverridden: false });
      remainingCapacity.set(targetSection.id, remainingCapacity.get(targetSection.id)! - 1);
    } else {
      unplaced.push(learner);
    }
  }

  return unplaced;
};

const createDraftPlacement = (
  gradeLevelId: number,
  learners: PoolLearner[],
  sections: SectionSummary[],
  enableHomogeneousSections: boolean,
  homogeneousSectionCount: number,
): DraftPlacement => {
  const rostersBySectionId = new Map<number, DraftLearnerPlacement[]>(
    sections.map((section) => [section.id, []])
  );
  const unplacedLearners: PoolLearner[] = [];

  const programTypes = Array.from(
    new Set(learners.map((learner) => getAutoDraftProgramType(learner)))
  );

  for (const programType of programTypes) {
    const rawProgramLearners = learners.filter(
      (learner) => getAutoDraftProgramType(learner) === programType
    );
    const programSections = sections.filter(
      (section) => section.programType === programType
    );

    // Phase 1: Global Sorting & Preparation
    // Strict Descending Sort: Highest Gen Ave first. Tie-breaker: Last Name, First Name.
    const sortedLearners = [...rawProgramLearners].sort((a, b) => {
      const aAve = a.genAve ?? -1;
      const bAve = b.genAve ?? -1;
      if (aAve !== bAve) return bAve - aAve;
      
      const nameA = `${a.lastName}, ${a.firstName}`;
      const nameB = `${b.lastName}, ${b.firstName}`;
      return nameA.localeCompare(nameB);
    });

    const orderedSections = [...programSections].sort(
      (first, second) =>
        first.sortOrder - second.sortOrder ||
        first.name.localeCompare(second.name) ||
        first.id - second.id
    );

    if (sortedLearners.length === 0 || orderedSections.length === 0) {
      unplacedLearners.push(...sortedLearners);
      continue;
    }

    let remainingLearners = [...sortedLearners];

    // Phase 2: Homogeneous Allocation (Pilot/Top Sections)
    let topSections: SectionSummary[] = [];
    let regularSections: SectionSummary[] = orderedSections;

    if (programType === "REGULAR" && enableHomogeneousSections) {
      topSections = orderedSections.filter(s => s.isHomogeneous).slice(0, homogeneousSectionCount);
      const topSectionIds = new Set(topSections.map(s => s.id));
      regularSections = orderedSections.filter(s => !topSectionIds.has(s.id));
    }

    if (topSections.length > 0) {
      // Calculate Balanced Total Top Capacity
      const totalSections = topSections.length + regularSections.length;
      const targetPerSection = Math.ceil(remainingLearners.length / totalSections);
      const maxAvailableTopCapacity = topSections.reduce((acc, sec) => acc + Math.max(0, sec.maxCapacity - sec.currentCount), 0);
      const balancedTopCapacity = targetPerSection * topSections.length;
      const totalTopCapacity = Math.min(balancedTopCapacity, maxAvailableTopCapacity);

      // Filter out conditionally promoted learners
      const eligibleForTop = remainingLearners.filter(
        (l) => l.academicStatus !== "CONDITIONALLY_PROMOTED"
      );

      // The Slice: Extract top N learners
      const topLearners = eligibleForTop.slice(0, totalTopCapacity);

      // Apply snake draft balancing to Top Sections as well
      const topRemainingCapacity = new Map(
        topSections.map(s => [s.id, Math.max(0, s.maxCapacity - s.currentCount)])
      );
      
      const topMales = topLearners.filter(l => l.sex === "MALE");
      const topFemales = topLearners.filter(l => l.sex === "FEMALE");
      
      snakeDraftLearners(topSections, topMales, topFemales, rostersBySectionId, topRemainingCapacity);

      // Remove assigned top learners from the master pool
      const assignedIds = new Set(topLearners.map((l) => l.applicationId));
      remainingLearners = remainingLearners.filter((l) => !assignedIds.has(l.applicationId));
    }

    // Phase 3: Heterogeneous Allocation (Regular Sections - Snake Draft)
    if (remainingLearners.length > 0 && regularSections.length > 0) {
      const remainingCapacity = new Map(
        regularSections.map(s => [s.id, Math.max(0, s.maxCapacity - s.currentCount)])
      );

      const males = remainingLearners.filter(l => l.sex === "MALE");
      const females = remainingLearners.filter(l => l.sex === "FEMALE");
      
      const unplaced = snakeDraftLearners(regularSections, males, females, rostersBySectionId, remainingCapacity);
      remainingLearners = unplaced;
    }

    // Any leftovers become unplaced
    if (remainingLearners.length > 0) {
      unplacedLearners.push(...remainingLearners);
    }
  }

  return {
    gradeLevelId,
    generatedAt: new Date().toISOString(),
    rosters: sections.map((section) =>
      buildRoster(section, rostersBySectionId.get(section.id) ?? [])
    ),
    unplacedLearners,
  };
};
export function SectioningWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const { panelPercentage, isDesktopViewport, startResizingRight } = useResizablePanel(45, {
    storageKey: "sectioning-workspace-pane",
  });

  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [pool, setPool] = useState<PoolLearner[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isRightPaneFullscreen, setIsRightPaneFullscreen] = useState(false);
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(
    null,
  );
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<number>>(
    new Set(),
  );
  const [draftMoveAction, setDraftMoveAction] =
    useState<DraftMoveAction | null>(null);
  const [normalMoveAction, setNormalMoveAction] = useState<{
    learnerApplicationId: number;
    fromSectionId: number;
  } | null>(null);
  const [normalRemoveAction, setNormalRemoveAction] = useState<{
    learnerApplicationId: number;
    fromSectionId: number;
  } | null>(null);
  const [moveDestinationSectionId, setMoveDestinationSectionId] = useState("");
  const [swapApplicationId, setSwapApplicationId] = useState("");
  const [autoAssignConfirmOpen, setAutoAssignConfirmOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [allowCapacityOverride, setAllowCapacityOverride] = useState(false);
  const [commitProcessing, setCommitProcessing] = useState(false);
  const [masterlistModalSectionId, setMasterlistModalSectionId] = useState<
    number | null
  >(null);

  const queryClient = useQueryClient();

  const activeGradeLevelId = useSettingsStore((s) => s.uiPreferences.sectioningGradeId);
  const setActiveGradeLevelId = (id: string) => useSettingsStore.getState().updateUiPreference("sectioningGradeId", id);
  const homogeneousSectionCount = useSettingsStore((s) => s.homogeneousSectionCount);
  const enableHomogeneousSections = useSettingsStore((s) => s.enableHomogeneousSections);
  const ancillaryRoles = useAuthStore((s) => s.user?.ancillaryRoles ?? []);
  
  const { data: activeSchoolYear } = useQuery({
    queryKey: ["school-years", "active", "grade-levels"],
    queryFn: async () => {
      const res = await api.get<GradeLevelsResponse>("/school-years/grade-levels");
      return res.data;
    },
    staleTime: 60_000,
  });

  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const isAdminOrRegistrar = userRoles.includes("SYSTEM_ADMIN") || userRoles.includes("HEAD_REGISTRAR") || userRoles.includes("SCHOOL_REGISTRAR");

  const assignedGradeLevelId = useMemo(() => {
    if (!activeSchoolYear?.gradeLevels) return null;
    if (isAdminOrRegistrar) return null;
    if (ancillaryRoles.includes("GRADE 7 COORDINATOR")) return activeSchoolYear.gradeLevels.find((gradeLevel) => gradeLevel.name === "Grade 7")?.id ?? null;
    if (ancillaryRoles.includes("GRADE 8 COORDINATOR")) return activeSchoolYear.gradeLevels.find((gradeLevel) => gradeLevel.name === "Grade 8")?.id ?? null;
    if (ancillaryRoles.includes("GRADE 9 COORDINATOR")) return activeSchoolYear.gradeLevels.find((gradeLevel) => gradeLevel.name === "Grade 9")?.id ?? null;
    if (ancillaryRoles.includes("GRADE 10 COORDINATOR")) return activeSchoolYear.gradeLevels.find((gradeLevel) => gradeLevel.name === "Grade 10")?.id ?? null;
    return null;
  }, [isAdminOrRegistrar, ancillaryRoles, activeSchoolYear?.gradeLevels]);

  const {
    data: sectionsData,
    isLoading: sectionsInitialLoading,
    error: sectionsError,
    refetch: refetchSections,
  } = useQuery({
    queryKey: ["sectioning", "sections-summary", assignedGradeLevelId],
    queryFn: () =>
      api
        .get<SectionSummary[]>("/sectioning/sections-summary", {
          params: assignedGradeLevelId ? { gradeLevelId: assignedGradeLevelId } : {}
        })
        .then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const {
    data: poolData,
    isLoading: poolInitialLoading,
    error: poolError,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ["sectioning", "pool", assignedGradeLevelId],
    queryFn: () =>
      api.get<PoolLearner[]>("/sectioning/pool", {
        params: assignedGradeLevelId ? { gradeLevelId: assignedGradeLevelId } : {}
      }).then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const { data: gradeLevelsResponse, isLoading: gradeLevelsLoading } = useQuery(
    {
      queryKey: ["settings", "grade-levels"],
      queryFn: () =>
        api
          .get<GradeLevelsResponse>("/school-years/grade-levels")
          .then((response) => response.data),
      staleTime: 60_000,
    },
  );

  useEffect(() => {
    if (sectionsData && !draftPlacement) setSections(sectionsData);
  }, [sectionsData, draftPlacement]);
  useEffect(() => {
    if (poolData && !draftPlacement) setPool(poolData);
  }, [poolData, draftPlacement]);

  const loading =
    (sectionsInitialLoading || poolInitialLoading || gradeLevelsLoading) &&
    !isHistoricalReadOnly;

  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);
  const guardedSetActiveGradeLevelId = useGuardedTabChange(
    setActiveGradeLevelId,
  );

  type SortConfig = { key: "genAve"; direction: "asc" | "desc" } | null;
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const handleSort = (key: "genAve") => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [localFilterProgram, setLocalFilterProgram] = useState<string>("all");
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  useEffect(() => {
    if (isFilterPopoverOpen) {
      setLocalFilterProgram(filterProgram);
    }
  }, [isFilterPopoverOpen, filterProgram]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterProgram !== "all") count++;
    return count;
  }, [filterProgram]);

  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
  } = useDebouncedSearch();
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  const gradeLevels = useMemo(() => {
    const raw = gradeLevelsResponse?.gradeLevels ?? [];
    let jhs = raw.filter((gradeLevel) =>
      ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(gradeLevel.name),
    );
    
    if (!isAdminOrRegistrar) {
      const allowedNames: string[] = [];
      if (ancillaryRoles.includes("GRADE 7 COORDINATOR")) allowedNames.push("Grade 7");
      if (ancillaryRoles.includes("GRADE 8 COORDINATOR")) allowedNames.push("Grade 8");
      if (ancillaryRoles.includes("GRADE 9 COORDINATOR")) allowedNames.push("Grade 9");
      if (ancillaryRoles.includes("GRADE 10 COORDINATOR")) allowedNames.push("Grade 10");
      
      if (allowedNames.length > 0) {
        jhs = jhs.filter((g) => allowedNames.includes(g.name));
      }
    }

    return jhs.sort((a, b) => {
      const orderA = a.displayOrder ?? parseInt(a.name.replace(/\D/g, "")) ?? 0;
      const orderB = b.displayOrder ?? parseInt(b.name.replace(/\D/g, "")) ?? 0;
      return orderA - orderB;
    });
  }, [gradeLevelsResponse, isAdminOrRegistrar, ancillaryRoles]);

  useEffect(() => {
    if (gradeLevels.length > 0) {
      const isValid = gradeLevels.some(g => String(g.id) === activeGradeLevelId);
      if (!isValid) {
        setActiveGradeLevelId(String(gradeLevels[0].id));
      }
    }
  }, [gradeLevels, activeGradeLevelId, setActiveGradeLevelId]);

  const isDraftActive = draftPlacement !== null;
  const _isLockedIn = selectedAppIds.length > 0 || isDraftActive;

  const currentGradeSections = useMemo(() => {
    if (!activeGradeLevelId) return [];
    return sections.filter(
      (s) => String(s.gradeLevelId) === activeGradeLevelId,
    );
  }, [sections, activeGradeLevelId]);

  const currentGradePool = useMemo(() => {
    if (!activeGradeLevelId) return [];
    return pool.filter((p) => String(p.gradeLevelId) === activeGradeLevelId);
  }, [pool, activeGradeLevelId]);
  const draftLearnerCount = useMemo(
    () =>
      draftPlacement?.rosters.reduce(
        (total, roster) => total + roster.learners.length,
        0,
      ) ?? 0,
    [draftPlacement],
  );
  const hasDraftOverflow = useMemo(
    () =>
      draftPlacement?.rosters.some((roster) => roster.isOverCapacity) ?? false,
    [draftPlacement],
  );
  const selectedProgramTypes = useMemo(
    () =>
      new Set(
        currentGradePool
          .filter((learner) => selectedAppIds.includes(learner.applicationId))
          .map((learner) => learner.programType),
      ),
    [currentGradePool, selectedAppIds],
  );

  const filteredPool = useMemo(() => {
    return currentGradePool.filter((l) => {
      if (filterProgram !== "all" && l.programType !== filterProgram) return false;
      if (activeSearchQuery) {
        const q = activeSearchQuery.toLowerCase();
        const fullName = `${l.lastName} ${l.firstName}`.toLowerCase();
        if (!fullName.includes(q) && !l.lrn?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [currentGradePool, activeSearchQuery, filterProgram]);

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

    const assignedSectionId = targetSectionId;
    setProcessing(true);
    try {
      await api.post("/sectioning/assign-bulk", {
        sectionId: assignedSectionId,
        applicationIds: selectedAppIds,
      });

      const sectionName = currentGradeSections.find(
        (s) => s.id === targetSectionId,
      )?.name;
      sileo.success({
        title: "Assignment Successful",
        description: `Assigned ${selectedAppIds.length} learners to ${sectionName}.`,
      });
      setSelectedAppIds([]);
      setTargetSectionId(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sectioningPool(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sectioningSections(),
        }),
        queryClient.invalidateQueries({
          queryKey: ["section-masterlist", assignedSectionId],
        }),
      ]);
    } catch (error: unknown) {
      sileo.error({
        title: "Assignment Failed",
        description:
          (isAxiosError<ApiMessageResponse>(error)
            ? error.response?.data.message
            : undefined) ??
          "An error occurred while moving learners. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const generateDraftPlacement = () => {
    if (!activeGradeLevelId) return;

    const parsedGradeLevelId = Number(activeGradeLevelId);
    const draft = createDraftPlacement(
      parsedGradeLevelId,
      currentGradePool,
      currentGradeSections,
      enableHomogeneousSections,
      homogeneousSectionCount,
    );
    const populatedSectionIds = draft.rosters
      .filter((roster) => roster.learners.length > 0)
      .map((roster) => roster.section.id);

    setDraftPlacement(draft);
    setExpandedSectionIds(new Set(populatedSectionIds));
    setSelectedAppIds([]);
    setTargetSectionId(null);
    setAllowCapacityOverride(false);

    sileo.success({
      title: "Draft Placement Generated",
      description: `${draft.rosters.reduce((total, roster) => total + roster.learners.length, 0)} learner(s) are ready for review.`,
    });
  };

  const discardDraft = useCallback(() => {
    setDraftPlacement(null);
    setExpandedSectionIds(new Set());
    setDraftMoveAction(null);
    setMoveDestinationSectionId("");
    setSwapApplicationId("");
    setAllowCapacityOverride(false);
    if (sectionsData) setSections(sectionsData);
    if (poolData) setPool(poolData);
  }, [poolData, sectionsData]);

  useUnsavedChanges({
    id: "sectioning-draft-placement",
    label: "Draft section placement",
    isDirty: isDraftActive,
    isSubmitting: commitProcessing,
    onDiscard: discardDraft,
  });

  const toggleExpandedSection = (sectionId: number) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const findDraftLearner = (applicationId: number) => {
    if (!draftPlacement) return null;
    for (const roster of draftPlacement.rosters) {
      const learner = roster.learners.find(
        (item) => item.applicationId === applicationId,
      );
      if (learner) return learner;
    }
    return null;
  };

  const openMoveDialog = (
    learnerApplicationId: number,
    fromSectionId: number,
  ) => {
    setDraftMoveAction({ type: "MOVE", learnerApplicationId, fromSectionId });
    setMoveDestinationSectionId("");
  };

  const openNormalMoveDialog = (
    learnerApplicationId: number,
    fromSectionId: number,
  ) => {
    setNormalMoveAction({ learnerApplicationId, fromSectionId });
    setMoveDestinationSectionId("");
  };

  const openSwapDialog = (
    learnerApplicationId: number,
    fromSectionId: number,
  ) => {
    setDraftMoveAction({ type: "SWAP", learnerApplicationId, fromSectionId });
    setSwapApplicationId("");
  };

  const executeMove = () => {
    if (!draftPlacement || !draftMoveAction || draftMoveAction.type !== "MOVE")
      return;
    const destinationSectionId = Number(moveDestinationSectionId);
    if (!Number.isInteger(destinationSectionId) || destinationSectionId <= 0)
      return;

    setDraftPlacement((current) => {
      if (!current) return current;

      let movingLearner: DraftLearnerPlacement | null = null;
      const rosters = current.rosters.map((roster) => {
        if (roster.section.id !== draftMoveAction.fromSectionId) return roster;
        const remainingLearners = roster.learners.filter((learner) => {
          if (learner.applicationId !== draftMoveAction.learnerApplicationId)
            return true;
          movingLearner = learner;
          return false;
        });
        return buildRoster(roster.section, remainingLearners);
      });

      if (!movingLearner) return current;

      const updatedRosters = rosters.map((roster) => {
        if (roster.section.id !== destinationSectionId || !movingLearner)
          return roster;
        return buildRoster(roster.section, [
          ...roster.learners,
          {
            ...movingLearner,
            sectionId: destinationSectionId,
            isOverridden: true,
          },
        ]);
      });

      return rebuildDraftPlacement({ ...current, rosters: updatedRosters });
    });

    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      next.add(destinationSectionId);
      return next;
    });

    setDraftMoveAction(null);
    setMoveDestinationSectionId("");
  };

  const executeNormalMove = async () => {
    if (!normalMoveAction) return;
    const destinationSectionId = Number(moveDestinationSectionId);
    if (!Number.isInteger(destinationSectionId) || destinationSectionId <= 0)
      return;

    setProcessing(true);
    try {
      await api.post("/sections/transfer-learner", {
        targetSectionId: destinationSectionId,
        enrollmentApplicationId: normalMoveAction.learnerApplicationId,
      });
      sileo.success({
        title: "Assignment Successful",
        description: "Learner successfully moved to the new section.",
      });
      const oldSectionId = normalMoveAction.fromSectionId;
      setNormalMoveAction(null);
      setMoveDestinationSectionId("");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningSections(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["section-masterlist", oldSectionId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["section-masterlist", destinationSectionId],
      });
    } catch (_error: unknown) {
      sileo.error({
        title: "Move Failed",
        description: "An error occurred while moving the learner. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openRemoveDialog = (
    learnerApplicationId: number,
    fromSectionId: number,
  ) => {
    setNormalRemoveAction({ learnerApplicationId, fromSectionId });
  };

  const executeNormalRemove = async () => {
    if (!normalRemoveAction) return;

    setProcessing(true);
    try {
      await api.post("/sections/transfer-learner", {
        targetSectionId: null,
        enrollmentApplicationId: normalRemoveAction.learnerApplicationId,
      });
      sileo.success({
        title: "Learner Removed",
        description: "Learner was successfully unassigned and returned to the pool.",
      });
      const oldSectionId = normalRemoveAction.fromSectionId;
      setNormalRemoveAction(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningSections(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["section-masterlist", oldSectionId],
      });
    } catch (error: unknown) {
      sileo.error({
        title: "Removal Failed",
        description:
          (isAxiosError<ApiMessageResponse>(error)
            ? error.response?.data.message
            : undefined) ??
          "An error occurred while removing the learner. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const executeSwap = () => {
    if (!draftPlacement || !draftMoveAction || draftMoveAction.type !== "SWAP")
      return;
    const otherApplicationId = Number(swapApplicationId);
    if (!Number.isInteger(otherApplicationId) || otherApplicationId <= 0)
      return;

    setDraftPlacement((current) => {
      if (!current) return current;

      const sourceLearner = findDraftLearner(
        draftMoveAction.learnerApplicationId,
      );
      const otherLearner = findDraftLearner(otherApplicationId);
      if (!sourceLearner || !otherLearner) return current;

      const sourceSectionId = sourceLearner.sectionId;
      const otherSectionId = otherLearner.sectionId;
      const rosters = current.rosters.map((roster) => {
        const swappedLearners = roster.learners.map((learner) => {
          if (learner.applicationId === sourceLearner.applicationId) {
            return {
              ...otherLearner,
              sectionId: sourceSectionId,
              isOverridden: true,
            };
          }
          if (learner.applicationId === otherLearner.applicationId) {
            return {
              ...sourceLearner,
              sectionId: otherSectionId,
              isOverridden: true,
            };
          }
          return learner;
        });
        return buildRoster(roster.section, swappedLearners);
      });

      return rebuildDraftPlacement({ ...current, rosters });
    });

    setDraftMoveAction(null);
    setSwapApplicationId("");
  };

  const commitDraftPlacement = async () => {
    if (!draftPlacement) return;

    const assignments: CommitDraftAssignment[] = draftPlacement.rosters
      .filter((roster) => roster.learners.length > 0)
      .map((roster) => ({
        sectionId: roster.section.id,
        applicationIds: roster.learners.map((learner) => learner.applicationId),
      }));
    const overrides = draftPlacement.rosters.reduce<Record<number, boolean>>(
      (accumulator, roster) => {
        for (const learner of roster.learners) {
          accumulator[learner.applicationId] = learner.isOverridden;
        }
        return accumulator;
      },
      {},
    );

    setCommitProcessing(true);
    try {
      const response = await api.post<CommitDraftResponse>(
        "/sectioning/commit-draft",
        {
          assignments,
          overrides,
          allowCapacityOverride,
        },
      );
      const skippedCount = response.data.skippedApplications.length;

      sileo.success({
        title: "Final Sectioning Committed",
        description:
          skippedCount > 0
            ? `${response.data.committedCount} learner(s) committed. ${skippedCount} learner(s) need review.`
            : `${response.data.committedCount} learner(s) committed to official class sections.`,
      });

      setCommitDialogOpen(false);
      discardDraft();
      const affectedSectionIds = Array.from(
        new Set(
          response.data.committedApplications.map(
            (application) => application.sectionId,
          ),
        ),
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sectioningPool(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sectioningSections(),
        }),
        ...affectedSectionIds.map((sectionId) =>
          queryClient.invalidateQueries({
            queryKey: ["section-masterlist", sectionId],
          }),
        ),
      ]);
    } catch (error: unknown) {
      sileo.error({
        title: "Draft Commit Failed",
        description:
          (isAxiosError<ApiMessageResponse>(error)
            ? error.response?.data.message
            : undefined) ?? "Could not commit the draft sectioning placements.",
      });
    } finally {
      setCommitProcessing(false);
    }
  };

  if (masterlistModalSectionId !== null) {
    return (
      <ViewMasterlist
        sectionId={masterlistModalSectionId}
        onBack={() => setMasterlistModalSectionId(null)}
        mode="sectioning"
      />
    );
  }

  if (loading) {
    return <TwoPanelSkeleton />;
  }

  const sectioningLoadError = sectionsError ?? poolError;
  if (sectioningLoadError) {
    return (
      <Card className="flex min-h-[420px] flex-col items-center justify-center gap-4 border-border p-8 text-center shadow-sm">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <CardTitle className="text-xl">Unable to load Section Assignment</CardTitle>
          <CardDescription className="text-base text-foreground">
            {getApiMessage(sectioningLoadError, "Could not load learners and sections.")}
          </CardDescription>
        </div>
        <Button
          type="button"
          onClick={() => {
            void Promise.all([refetchSections(), refetchPool()]);
          }}
        >
          Try Again
        </Button>
      </Card>
    );
  }

  const displayedRosters =
    draftPlacement?.rosters ??
    currentGradeSections.map((section) => buildRoster(section, []));
  const selectedDraftLearner = draftMoveAction
    ? findDraftLearner(draftMoveAction.learnerApplicationId)
    : null;
  const compatibleMoveSections = selectedDraftLearner
    ? (draftPlacement?.rosters.filter(
      (roster) =>
        roster.section.id !== selectedDraftLearner.sectionId &&
        getAllowedSectionProgramsForPlacement(selectedDraftLearner).includes(
          roster.section.programType,
        ),
    ) ?? [])
    : [];
  const normalMoveSourceSection = normalMoveAction
    ? currentGradeSections.find(s => s.id === normalMoveAction.fromSectionId)
    : null;

  const normalMoveDestinationSections = normalMoveAction && normalMoveSourceSection
    ? currentGradeSections.filter((s) => s.id !== normalMoveAction.fromSectionId && s.programType === normalMoveSourceSection.programType)
    : [];
  const compatibleSwapLearners = selectedDraftLearner
    ? (draftPlacement?.rosters.flatMap((roster) =>
      roster.learners.filter(
        (learner) =>
          learner.applicationId !== selectedDraftLearner.applicationId &&
          getAllowedSectionProgramsForPlacement(selectedDraftLearner).includes(
            roster.section.programType,
          ),
      ),
    ) ?? [])
    : [];
  const draftSectionByApplicationId = new Map<number, string>(
    draftPlacement?.rosters.flatMap((roster) =>
      roster.learners.map(
        (learner) => [learner.applicationId, roster.section.name] as const,
      ),
    ) ?? [],
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden">
      <Tabs
        value={activeGradeLevelId}
        onValueChange={(val) => {
          if (isDraftActive) {
            guardedSetActiveGradeLevelId(val);
            return;
          }

          if (selectedAppIds.length === 0) {
            setActiveGradeLevelId(val);
          }
        }}
      >
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
          {gradeLevels.map((g) => (
            <TabsTrigger
              key={g.id}
              value={String(g.id)}
              disabled={
                selectedAppIds.length > 0 &&
                !isDraftActive &&
                activeGradeLevelId !== String(g.id)
              }
              className={cn(
                "flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md",
                selectedAppIds.length > 0 &&
                !isDraftActive &&
                activeGradeLevelId !== String(g.id) &&
                "opacity-40 cursor-not-allowed bg-muted/20",
              )}>
              {activeGradeLevelId === String(g.id) && (
                <motion.div
                  layoutId="enrollment-grade-pill"
                  className="absolute inset-0 bg-primary shadow-sm rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span
                className={cn(
                  "relative z-20 text-base uppercase",
                  activeGradeLevelId === String(g.id)
                    ? "text-primary-foreground"
                    : "text-foreground",
                )}>
                {g.name.replace(/grade\s*/i, "Grade ")}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <AnimatePresence>
        {draftPlacement && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto", marginBottom: "1rem" }}
            exit={{ opacity: 0, y: -20, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white rounded-md shadow-sm"
          >
            <div className="overflow-hidden rounded-md border-2 border-primary bg-primary/5 px-4 py-3 text-primary">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-bold uppercase">
                    TEMPORARY SECTIONS PENDING REVIEW
                  </p>
                  <p className="text-sm text-primary">
                    {draftLearnerCount} learner(s) are currently assigned across{" "}
                    {
                      draftPlacement.rosters.filter(
                        (roster) => roster.learners.length > 0,
                      ).length
                    }{" "}
                    section(s) pending final approval
                  </p>
                </div>
                <Badge className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
                  Reviewing Temporary List
                </Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Workspace ── */}
      <PageTransition key={activeGradeLevelId} className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
        <Card className="flex flex-col flex-1 min-h-0 h-full shadow-sm border-none bg-card overflow-hidden">
          <div className="relative flex flex-1 min-h-0 w-full overflow-hidden">
            {/* LEFT PANE: UNSECTIONED POOL */}
            <div
              className="flex-1 flex flex-col h-full overflow-y-auto border-r border-border bg-card text-card-foreground sm:flex-none transition-[width] duration-75 ease-linear"
              style={
                isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
              }
            >
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-extrabold uppercase flex items-center gap-2 text-foreground">
                      <Users className="h-5 w-5 text-primary" />
                      LEARNERS READY FOR SECTIONING
                    </CardTitle>
                    <CardDescription className="text-sm text-foreground">
                      Enrolled learners ready to be sectioned
                    </CardDescription>
                  </div>
                  {selectedAppIds.length > 0 && (
                    <Badge
                      variant="outline"
                      className="font-bold bg-background border-border">
                      {selectedAppIds.length} Selected
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search LRN, first name, last name..."
                      className="w-full h-12 pl-10 pr-12 bg-white border-gray-300 shadow-sm transition-shadow focus-visible:ring-primary uppercase font-bold"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors">
                          <SlidersHorizontal className="h-5 w-5" />
                          {activeFilterCount > 0 && (
                            <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm">
                              {activeFilterCount}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[320px] p-0 shadow-xl border-border bg-card">
                        <div className="p-4 border-b">
                          <h4 className="text-lg font-bold">Filter Learners</h4>
                        </div>
                        <div className="p-4 space-y-4 flex flex-col">
                          <div className="space-y-1.5">
                            <Label className="text-sm text-muted-foreground uppercase">Program Type</Label>
                            <Select
                              isFilter
                              value={localFilterProgram}
                              onValueChange={setLocalFilterProgram}
                            >
                              <SelectTrigger className="h-10 w-full leading-tight font-bold transition-colors">
                                <SelectValue placeholder="All Programs" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all" className="leading-tight font-bold">All Programs</SelectItem>
                                <SelectItem value="REGULAR" className="leading-tight font-bold">Basic Education Curriculum</SelectItem>
                                <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING" className="leading-tight font-bold">SCIENCE, TECHNOLOGY, AND ENGINEERING</SelectItem>
                                <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS" className="leading-tight font-bold">Special Program in the Arts</SelectItem>
                                <SelectItem value="SPECIAL_PROGRAM_IN_SPORTS" className="leading-tight font-bold">Special Program in Sports</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="p-3 border-t bg-gray-50 flex items-center justify-end gap-2 rounded-b-md">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setLocalFilterProgram("all");
                              setFilterProgram("all");
                              setIsFilterPopoverOpen(false);
                            }}
                            className="font-bold text-gray-600 hover:text-gray-900"
                          >
                            Clear All
                          </Button>
                          <Button
                            onClick={() => {
                              setFilterProgram(localFilterProgram);
                              setIsFilterPopoverOpen(false);
                            }}
                            className="font-bold bg-primary hover:bg-primary/90 text-white"
                          >
                            Apply Filters
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardHeader>
              <div className="p-0 relative flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-muted z-10 border-b border-border">
                    <tr className="uppercase">
                      <th className="p-4 w-10">
                        <Checkbox
                          className="border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          checked={
                            selectedAppIds.length === filteredPool.length &&
                            filteredPool.length > 0
                          }
                          disabled={
                            isDraftActive ||
                            (selectedProgramTypes.size === 0 &&
                              new Set(filteredPool.map((l) => l.programType)).size > 1)
                          }
                          onCheckedChange={(checked) => {
                            if (isDraftActive) return;
                            if (checked) {
                              const targetProgram =
                                selectedProgramTypes.size > 0
                                  ? Array.from(selectedProgramTypes)[0]
                                  : null;
                              setSelectedAppIds(
                                filteredPool
                                  .filter(
                                    (l) =>
                                      !targetProgram ||
                                      l.programType === targetProgram
                                  )
                                  .map((l) => l.applicationId)
                              );
                            } else setSelectedAppIds([]);
                          }}
                        />
                      </th>
                      <th className="p-4 font-bold">Learner Detail</th>
                      <th
                        className="p-4 cursor-pointer  select-none font-bold"
                        onClick={() => handleSort("genAve")}>
                        <div className="flex items-center gap-1 justify-center">
                          Final Gen Ave
                          {sortConfig?.key === "genAve" &&
                            (sortConfig.direction === "asc" ? (
                              <ChevronUp className="h-3 w-3 text-primary" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-primary" />
                            ))}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-base leading-tight bg-card text-center">
                    {filteredAndSortedPool.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="h-[400px] text-center text-muted-foreground ">
                          <div className="flex flex-col items-center justify-center h-full space-y-3">
                            {activeSearchQuery || filterProgram !== "all" ? (
                              <>
                                <Search className="h-8 w-8" />
                                <p className="text-foreground font-bold">No unsectioned learners match this search</p>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-8 w-8 text-primary" />
                                <p className="text-foreground font-bold">All enrolled learners are sectioned</p>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const becLearners = filteredAndSortedPool.filter(l => l.programType === "REGULAR");

                        const scpGroupsMap = new Map<string, typeof filteredAndSortedPool>();
                        filteredAndSortedPool.forEach(l => {
                          if (l.programType !== "REGULAR") {
                            if (!scpGroupsMap.has(l.programType)) scpGroupsMap.set(l.programType, []);
                            scpGroupsMap.get(l.programType)!.push(l);
                          }
                        });

                        const getProgramTitle = (pt: string) => {
                          const label = SCP_LABELS[pt];
                          const acronym = SCP_SHORT_LABELS[pt as keyof typeof SCP_SHORT_LABELS];
                          if (label && acronym) return `${label} (${acronym})`;
                          return label || pt;
                        };

                        const scpGroups = Array.from(scpGroupsMap.entries())
                          .sort(([a], [b]) => {
                            const order = { SCIENCE_TECHNOLOGY_AND_ENGINEERING: 1, SPECIAL_PROGRAM_IN_THE_ARTS: 2, SPECIAL_PROGRAM_IN_SPORTS: 3 } as Record<string, number>;
                            return (order[a] || 4) - (order[b] || 4);
                          })
                          .map(([programType, learners]) => ({
                            title: getProgramTitle(programType),
                            learners
                          }));

                        const groups = [
                          ...scpGroups,
                          { title: "Basic Education Curriculum (BEC)", learners: becLearners }
                        ].filter(g => g.learners.length > 0);

                        return groups.flatMap((group) => {
                          const headerRow = (
                            <tr key={`header-${group.title}`} className="bg-muted/50 border-y border-border">
                              <td colSpan={3} className="py-2.5 px-4 text-center font-bold text-foreground uppercase tracking-wider">
                                {group.title}
                              </td>
                            </tr>
                          );

                          const learnerRows = group.learners.map((l) => {
                            const isSelected = selectedAppIds.includes(
                              l.applicationId,
                            );
                            const isDisabled =
                              isDraftActive ||
                              (selectedProgramTypes.size > 0 &&
                                !selectedProgramTypes.has(l.programType));

                            return (
                              <tr
                                key={l.applicationId}
                                onClick={() => {
                                  if (isDisabled) return;
                                  setSelectedAppIds((prev) =>
                                    prev.includes(l.applicationId)
                                      ? prev.filter((id) => id !== l.applicationId)
                                      : [...prev, l.applicationId],
                                  );
                                }}
                                className={cn(
                                  "group transition-colors",
                                  isDisabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer",
                                  isSelected && "bg-primary/5 hover:bg-primary/10",
                                )}>
                                <td
                                  className="p-4"
                                  onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onCheckedChange={(checked) => {
                                      if (isDisabled) return;
                                      setSelectedAppIds((prev) =>
                                        checked
                                          ? [...prev, l.applicationId]
                                          : prev.filter(
                                            (id) => id !== l.applicationId,
                                          ),
                                      );
                                    }}
                                  />
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-4">
                                    <UserPhoto
                                      photo={l.studentPhoto}
                                      containerClassName="w-12 h-12 rounded-full shadow-sm border shrink-0 border-2 border-primary"
                                      className="w-full h-full object-cover"
                                      alt={`${l.firstName} ${l.lastName}`}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-bold text-foreground uppercase flex items-center gap-2">
                                        {l.lastName}, {l.firstName}{" "}
                                        {l.middleName?.charAt(0)
                                          ? `${l.middleName.charAt(0)}.`
                                          : ""}
                                        {l.duplicateFlag && (
                                          <Badge
                                            variant="destructive"
                                            className="text-sm px-1 py-0 h-4">
                                            DUPLICATE DETECTED - RESOLVE OVER COUNTER
                                          </Badge>
                                        )}
                                      </span>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm font-bold uppercase text-foreground">
                                          {l.lrn || "NO LRN"}
                                        </span>
                                        <Badge
                                          className={cn(
                                            "p-1",
                                            l.sex === "MALE" ? "bg-blue-600/10 text-blue-600 border-blue-600 border-2" : "bg-pink-600/10 text-pink-600 border-pink-600 border-2"
                                          )}>
                                          {l.sex === "MALE" ? <Mars className="h-4 w-4" /> : <Venus className="h-4 w-4" />}
                                        </Badge>
                                        {l.programType === "LATE_ENROLLEE" && (
                                          <Badge
                                            variant="outline"
                                            className="text-sm uppercase font-bold bg-amber-100 text-amber-700 border-amber-500 border-2">
                                            {SCP_SHORT_LABELS[l.programType] ?? l.programType}
                                          </Badge>
                                        )}
                                      </div>
                                      {draftPlacement &&
                                        draftSectionByApplicationId.has(
                                          l.applicationId,
                                        ) && (
                                          <span className="text-sm mt-2 font-bold uppercase text-primary text-left">
                                            Section:{" "}
                                            {draftSectionByApplicationId.get(
                                              l.applicationId,
                                            )}{" "}
                                            (Draft)
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 font-bold text-foreground">
                                  {l.genAve ? (
                                    l.genAve.toFixed(2)
                                  ) : (
                                    <span className="text-foreground">--</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });

                          return [headerRow, ...learnerRows];
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DRAG HANDLE */}
            <div
              onMouseDown={startResizingRight}
              className={cn(
                "relative w-[1px] cursor-col-resize z-50 hover:bg-primary/50 transition-opacity hidden sm:flex flex-col justify-center group shrink-0 bg-border",
                isRightPaneFullscreen && "pointer-events-none opacity-0",
              )}
            >
              <div className="absolute left-[-3px] right-[-3px] top-0 bottom-0 z-10" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-primary/70 shadow-sm z-20" />
            </div>

            {/* RIGHT PANE: AVAILABLE SECTIONS */}
            <div
              className={cn(
                "@container/section-pane flex-1 flex flex-col h-full overflow-hidden bg-card text-card-foreground min-w-0",
                "transition-[left,box-shadow] duration-300 ease-in-out",
                isDesktopViewport && "absolute inset-y-0 right-0",
                isRightPaneFullscreen && "z-[60] shadow-2xl",
              )}
              style={
                isDesktopViewport
                  ? {
                      left: isRightPaneFullscreen
                        ? "0"
                        : `calc(${panelPercentage}vw + 1px)`,
                    }
                  : undefined
              }>
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-extrabold uppercase flex items-center gap-2 text-foreground">
                      <LayoutGrid className="h-5 w-5 text-primary" />
                      {draftPlacement
                        ? "TEMPORARY CLASS LISTS"
                        : "Available Sections"}
                    </CardTitle>
                    <CardDescription className="text-foreground text-sm">
                      {draftPlacement
                        ? "Please review the temporary assignments before creating the official lists"
                        : `Select section to assign ${selectedAppIds.length || "0"} ${selectedAppIds.length <= 1 ? "learner" : "learners"}.`}
                    </CardDescription>
                  </div>
                  {isDesktopViewport && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={
                              isRightPaneFullscreen
                                ? "Restore split pane"
                                : "Expand section list"
                            }
                            aria-pressed={isRightPaneFullscreen}
                            onClick={() =>
                              setIsRightPaneFullscreen((current) => !current)
                            }
                            className="shrink-0">
                            {isRightPaneFullscreen ? (
                              <Minimize2 className="h-5 w-5" />
                            ) : (
                              <Maximize2 className="h-5 w-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {isRightPaneFullscreen
                            ? "Restore split pane"
                            : "Expand section list"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {!draftPlacement && (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={
                      currentGradePool.length === 0 ||
                      processing ||
                      isDraftActive ||
                      isHistoricalReadOnly
                    }
                    onClick={() => setAutoAssignConfirmOpen(true)}
                    className="font-bold text-base uppercase tracking-normal gap-1 rounded-md">
                    AUTO ASSIGN SECTIONS
                  </Button>
                )}
              </CardHeader>
              <div className="p-4 space-y-3 relative flex-1 overflow-y-auto">
                {displayedRosters.length === 0 ? (
                  <div className="h-full flex items-center justify-center flex-col gap-3 text-foreground">
                    <Info className="h-8 w-8" />
                    <span className="font-bold text-base leading-tight">
                      No sections defined for this grade.
                    </span>
                  </div>
                ) : (
                  (() => {
                    const scpRosters = displayedRosters
                      .filter((r) => r.section.programType !== "REGULAR")
                      .filter(
                        (r) =>
                          draftPlacement ||
                          selectedProgramTypes.size === 0 ||
                          selectedProgramTypes.has(r.section.programType)
                      );
                      
                    const scpRostersByProgram = new Map<string, typeof scpRosters>();
                    scpRosters.forEach(r => {
                      if (!scpRostersByProgram.has(r.section.programType)) scpRostersByProgram.set(r.section.programType, []);
                      scpRostersByProgram.get(r.section.programType)!.push(r);
                    });

                    const getProgramTitle = (pt: string) => {
                      const label = SCP_LABELS[pt];
                      const acronym = SCP_SHORT_LABELS[pt as keyof typeof SCP_SHORT_LABELS];
                      if (label && acronym) return `${label} (${acronym})`;
                      return label || pt;
                    };

                    const scpGroups = Array.from(scpRostersByProgram.entries())
                      .sort(([a], [b]) => {
                        const order = { SCIENCE_TECHNOLOGY_AND_ENGINEERING: 1, SPECIAL_PROGRAM_IN_THE_ARTS: 2, SPECIAL_PROGRAM_IN_SPORTS: 3 } as Record<string, number>;
                        return (order[a] || 4) - (order[b] || 4);
                      })
                      .map(([programType, rosters]) => ({
                        title: getProgramTitle(programType),
                        rosters: rosters.sort((a, b) => a.section.name.localeCompare(b.section.name))
                      }));

                    return [
                      ...scpGroups,
                      {
                        title: "Basic Education Curriculum (BEC)",
                        rosters: displayedRosters
                          .filter((r) => r.section.programType === "REGULAR")
                          .filter(
                            (r) =>
                            draftPlacement ||
                            selectedProgramTypes.size === 0 ||
                            selectedProgramTypes.has(r.section.programType)
                        )
                        .sort((a, b) => {
                          if (selectedProgramTypes.has("REGULAR") || selectedProgramTypes.size === 0) {
                            if (a.section.isHomogeneous && !b.section.isHomogeneous) return -1;
                            if (!a.section.isHomogeneous && b.section.isHomogeneous) return 1;
                          }
                          return a.section.name.localeCompare(b.section.name);
                        }),
                    },
                  ]
                    .filter((group) => group.rosters.length > 0)
                    .map((group, groupIdx) => (
                      <div
                        key={group.title}
                        className={cn("space-y-3", groupIdx > 0 && "mt-6")}>
                        <h3 className="text-center font-extrabold text-foreground uppercase">
                          {group.title}
                        </h3>
                        {group.rosters.map((roster) => {
                          const s = roster.section;
                          const isOverCapacity =
                            roster.isOverCapacity || roster.totalCount >= s.maxCapacity;
                          const isSelected =
                            !draftPlacement && targetSectionId === s.id;
                          const isExpanded = expandedSectionIds.has(s.id);
                          const isProgramCompatible =
                            draftPlacement ||
                            selectedProgramTypes.size === 0 ||
                            (selectedProgramTypes.size === 1 &&
                              selectedProgramTypes.has(s.programType));

                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                if (draftPlacement) {
                                  toggleExpandedSection(s.id);
                                  return;
                                }

                                if (selectedAppIds.length > 0) {
                                  if (isProgramCompatible) {
                                    setTargetSectionId(s.id);
                                  }
                                } else {
                                  if (s.currentCount > 0) {
                                    setMasterlistModalSectionId(s.id);
                                  } else if (isProgramCompatible) {
                                    setTargetSectionId(s.id);
                                  }
                                }
                              }}
                              className={cn(
                                "group cursor-pointer rounded-xl border p-4 transition-all relative overflow-hidden",
                                !isProgramCompatible && "cursor-not-allowed opacity-45",
                                isSelected
                                  ? "bg-primary/5 border-primary shadow-sm"
                                  : "bg-background hover:bg-muted/50 border-border",
                                draftPlacement &&
                                isExpanded &&
                                "border-primary/50 bg-primary/5",
                              )}>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <h4
                                      className={cn(
                                        "font-extrabold text-xl uppercase transition-colors flex items-center gap-2 flex-wrap",
                                        isSelected ? "text-primary" : "text-foreground",
                                      )}>
                                      {s.name}
                                      {s.isHomogeneous && s.programType === "REGULAR" && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-bold uppercase bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                                          Top BEC
                                        </Badge>
                                      )}
                                    </h4>
                                    <span className="text-sm uppercase text-foreground font-bold">
                                    Adviser: {s.adviser || "No Adviser Assigned"}
                                  </span>
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                  {draftPlacement && roster.isOverCapacity && (
                                    <Badge
                                      variant="destructive"
                                      className="text-sm font-bold uppercase">
                                      Over Capacity
                                    </Badge>
                                  )}

                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm font-bold">
                                  <span className="text-foreground uppercase">
                                    Capacity Fill
                                  </span>
                                  <span
                                    className={cn(
                                      isOverCapacity
                                        ? "text-destructive font-bold"
                                        : "text-foreground",
                                    )}>
                                    {roster.totalCount} / {s.maxCapacity}{" "}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-bold uppercase text-foreground">
                                  <Badge className="bg-blue-600/10 text-blue-600 border-blue-600 border-2 px-2 gap-1 flex items-center">
                                    <Mars className="h-4 w-4" />: {roster.genderCounts.boys}
                                  </Badge>
                                  <Badge className="bg-pink-600/10 text-pink-600 border-pink-600 border-2 px-2 gap-1 flex items-center">
                                    <Venus className="h-4 w-4" />: {roster.genderCounts.girls}
                                  </Badge>
                                  {draftPlacement && (
                                    <Badge variant="secondary">
                                      Draft: {roster.learners.length}
                                    </Badge>
                                  )}
                                </div>
                                <div className="h-2 rounded-full bg-card overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      roster.isOverCapacity
                                        ? "bg-destructive"
                                        : isSelected
                                          ? "bg-primary"
                                          : "bg-primary",
                                    )}
                                    style={{
                                      width: `${Math.min((roster.totalCount / s.maxCapacity) * 100, 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {draftPlacement && isExpanded && (
                                <div
                                  className="mt-4 overflow-hidden rounded-md border bg-card"
                                  onClick={(event) => event.stopPropagation()}>
                                  <table className="w-full text-left text-sm">
                                    <thead className="bg-muted text-foreground">
                                      <tr className="uppercase">
                                        <th className="p-3 font-bold">Learner</th>
                                        <th className="p-3 text-center font-bold">Sex</th>
                                        <th className="p-3 text-center font-bold">Gen Ave</th>
                                        <th className="p-3 text-right font-bold">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {roster.learners.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={4}
                                            className="p-4 text-center font-bold text-foreground">
                                            No drafted learners in this section.
                                          </td>
                                        </tr>
                                      ) : (
                                        roster.learners.map((learner, index) => (
                                          <tr key={learner.applicationId} className={cn("hover:bg-muted/60 transition-colors", index % 2 === 0 ? "bg-background" : "bg-muted/50")}>
                                            <td className="p-3">
                                              <div className="flex flex-col">
                                                <span className="font-bold uppercase text-foreground">
                                                  {formatLearnerName(learner)}
                                                </span>
                                                <span className="font-bold uppercase text-foreground">
                                                  {learner.lrn ?? "NO LRN"}
                                                  {learner.isOverridden && (
                                                    <Badge className="ml-2 bg-amber-600 text-white hover:bg-amber-600">
                                                      Manual Override
                                                    </Badge>
                                                  )}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="p-3 font-bold text-center">
                                              <Badge
                                                className={cn(
                                                  "px-2",
                                                  learner.sex === "MALE"
                                                    ? "bg-blue-600/10 text-blue-600 border-blue-600 border-2"
                                                    : "bg-pink-600/10 text-pink-600 border-pink-600 border-2"
                                                )}>
                                                {learner.sex === "MALE" ? <Mars className="h-4 w-4" /> : <Venus className="h-4 w-4" />}
                                              </Badge>
                                            </td>
                                            <td className="p-3 font-bold text-center">
                                              {learner.genAve?.toFixed(2) ?? "--"}
                                            </td>
                                            <td className="p-3 text-center">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      openMoveDialog(
                                                        learner.applicationId,
                                                        s.id,
                                                      )
                                                    }>
                                                    <MoveRight className="mr-2 h-4 w-4" />
                                                    Move to Section
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      openSwapDialog(
                                                        learner.applicationId,
                                                        s.id,
                                                      )
                                                    }>
                                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                                    Swap Placement
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {!draftPlacement && s.currentCount > 0 && (
                                <InlineSectionTable
                                  sectionId={s.id}
                                  onMoveLearner={!isHistoricalReadOnly ? openNormalMoveDialog : undefined}
                                  onRemoveLearner={!isHistoricalReadOnly ? openRemoveDialog : undefined}
                                />
                              )}
                            </div>
                          );
                        })
                        }
                      </div>
                    ));
                  })()
                )}
              </div>
              <AnimatePresence>
                {(draftPlacement || selectedAppIds.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="p-4 border-t border-border bg-muted/20 w-full shrink-0">
                    {draftPlacement ? (
                      <div className="grid grid-cols-1 gap-3 @xl/section-pane:grid-cols-2">
                        <Button
                          onClick={() => setCommitDialogOpen(true)}
                          disabled={
                            commitProcessing ||
                            draftLearnerCount === 0 ||
                            isHistoricalReadOnly
                          }
                          className="h-12 text-base font-bold uppercase">
                          FINALIZE OFFICIAL SECTIONS
                        </Button>
                        <Button
                          variant="outline"
                          onClick={discardDraft}
                          disabled={commitProcessing}
                          className="h-12 text-base font-bold uppercase">
                          CANCEL TEMPORARY SECTIONS
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={assignLearners}
                        disabled={
                          selectedAppIds.length === 0 ||
                          !targetSectionId ||
                          processing ||
                          isHistoricalReadOnly
                        }
                        className={cn(
                          "w-full h-12 text-base leading-tight font-bold uppercase transition-all shadow-none",
                          selectedAppIds.length > 0 && targetSectionId
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : "bg-muted text-foreground hover:bg-muted",
                        )}>
                        {processing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 " />
                            Assigning...
                          </>
                        ) : (
                          `Assign to Section ${targetSectionId ? (sections.find(s => s.id === targetSectionId)?.name ?? '') : ''} (${selectedAppIds.length})`
                        )}
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>
      </PageTransition>

      <Dialog
        open={draftMoveAction?.type === "MOVE"}
        onOpenChange={(open) => !open && setDraftMoveAction(null)}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>Move to Section</DialogTitle>
            <DialogDescription>
              Move the learner to another compatible section in this draft.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={moveDestinationSectionId}
            onValueChange={setMoveDestinationSectionId}>
            <SelectTrigger className="h-11 font-bold">
              <SelectValue placeholder="Select destination section" />
            </SelectTrigger>
            <SelectContent>
              {compatibleMoveSections.map((roster) => (
                <SelectItem
                  key={roster.section.id}
                  value={String(roster.section.id)}>
                  {roster.section.name} ({roster.totalCount}/
                  {roster.section.maxCapacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDraftMoveAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={executeMove}
              disabled={!moveDestinationSectionId}>
              Move to Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!normalMoveAction}
        onOpenChange={(open) => !open && setNormalMoveAction(null)}
        title="Move Assigned Learner"
        description={
          <div className="space-y-4 text-left w-full mt-4">
            <p className="text-foreground text-center">
              Move the learner to another section in the current grade level.
            </p>
            <Select
              value={moveDestinationSectionId}
              onValueChange={setMoveDestinationSectionId}>
              <SelectTrigger className="h-11 font-bold w-full">
                <SelectValue placeholder="Select destination section" />
              </SelectTrigger>
              <SelectContent>
                {normalMoveDestinationSections.map((section) => (
                  <SelectItem
                    key={section.id}
                    value={String(section.id)}>
                    {section.name} ({section.currentCount}/
                    {section.maxCapacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        confirmText="Move to Section"
        onConfirm={executeNormalMove}
        loading={processing}
        confirmDisabled={!moveDestinationSectionId}
        variant="primary"
      />

      <ConfirmationModal
        open={!!normalRemoveAction}
        onOpenChange={(open) => !open && setNormalRemoveAction(null)}
        title="Remove Assigned Learner"
        description="Are you sure you want to remove this learner from the section? The learner will be returned to the pool of unsectioned learners."
        confirmText="Remove Learner"
        cancelText="Cancel"
        onConfirm={executeNormalRemove}
        loading={processing}
        variant="danger"
      />

      <Dialog
        open={draftMoveAction?.type === "SWAP"}
        onOpenChange={(open) => !open && setDraftMoveAction(null)}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>Swap Placement</DialogTitle>
            <DialogDescription>
              Exchange this learner with another compatible learner in the
              draft.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={swapApplicationId}
            onValueChange={setSwapApplicationId}>
            <SelectTrigger className="h-11 font-bold">
              <SelectValue placeholder="Select learner to swap" />
            </SelectTrigger>
            <SelectContent>
              {compatibleSwapLearners.map((learner) => (
                <SelectItem
                  key={learner.applicationId}
                  value={String(learner.applicationId)}>
                  {formatLearnerName(learner)} -{" "}
                  {learner.genAve?.toFixed(2) ?? "No Gen Ave"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDraftMoveAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={executeSwap}
              disabled={!swapApplicationId}>
              Swap Placement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={autoAssignConfirmOpen}
        onOpenChange={setAutoAssignConfirmOpen}
        title="AUTO ASSIGN TEMPORARY SECTIONS"
        description={
          <div className="space-y-4 text-left">
            <p className="text-center">
              This will create temporary class lists for the selected grade
              level.
            </p>
            <div className="space-y-3 rounded-md border bg-muted p-4">
              <p className="font-bold text-foreground text-sm">
                How the system will place learners:
              </p>
              <ul className="list-disc space-y-2 pl-5 leading-relaxed text-foreground text-sm">
                {(() => {
                  const availableScp = Array.from(
                    new Set(currentGradeSections.filter((s) => s.programType !== "REGULAR").map((s) => s.programType))
                  );

                  return (
                    <>
                      {availableScp.length > 0 ? (
                        <li>
                          Special Curricular Program learners go first to matching SCP
                          sections such as {availableScp.map((p) => SCP_SHORT_LABELS[p] || p).join(", ")}.
                        </li>
                      ) : (
                        <li>
                          Special Curricular Program learners go first to matching SCP
                          sections (none currently available).
                        </li>
                      )}
                      <li>
                        BEC Top learners are placed in BEC Top {homogeneousSectionCount} sections when
                        those sections are available.
                      </li>
                    </>
                  );
                })()}
                <li>
                  Regular BEC learners are placed in regular Basic Education
                  Curriculum sections.
                </li>
                <li>
                  The system balances male and female, uses the learner&apos;s
                  final general average, and checks available section capacity.
                </li>
                <li>
                  After this, you can still review, move, or swap learners
                  before clicking Finalize Official Sections.
                </li>
              </ul>
            </div>
            <p className="rounded-md border-2 border-primary bg-primary/5 p-3 font-bold text-primary">
              Please review the temporary class lists carefully before
              finalizing because finalization creates the official section
              records.
            </p>
          </div>
        }
        onConfirm={() => {
          setAutoAssignConfirmOpen(false);
          generateDraftPlacement();
        }}
        confirmText="Generate Temporary Sections"
        cancelText="Cancel"
        variant="primary"
      />

      <ConfirmationModal
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        title="FINALIZE OFFICIAL SECTIONS"
        description={
          <div className="space-y-4">
            <p className="text-foreground text-sm">
              This action will lock the assignments and update the official school records.
            </p>
            {draftLearnerCount === 1 ? (
              <div className="rounded-md border bg-muted/40 px-4 py-3 text-left">
                {(() => {
                  const learner = draftPlacement?.rosters[0]?.learners[0];
                  const section = draftPlacement?.rosters[0]?.section;
                  if (!learner || !section) return null;
                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-base leading-tight font-medium text-foreground uppercase">
                          {learner.lastName}, {learner.firstName}
                          {learner.middleName ? ` ${learner.middleName.charAt(0)}.` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          LRN: {learner.lrn || "No LRN"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="font-bold uppercase">
                          {SCP_SHORT_LABELS[learner.programType] ?? learner.programType}
                        </Badge>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge
                            variant="outline"
                            className={cn("font-bold uppercase", getGradeLevelBadgeStyles(section.gradeLevel))}
                          >
                            {formatGradeLevel(section.gradeLevel)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="font-bold uppercase bg-background text-primary border-primary/30"
                          >
                            {section.name}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : draftLearnerCount > 1 ? (
              <div className="rounded-md border bg-white overflow-hidden flex flex-col text-left">
                <div className="px-4 py-3 border-b bg-gray-50 flex justify-center items-center">
                  <p className="text-base leading-tight font-bold text-foreground">
                    {draftLearnerCount} Learner(s) Selected
                  </p>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 backdrop-blur-sm z-10 border-b shadow-sm">
                      <tr>
                        <th className="h-10 px-4 text-left font-bold text-foreground">Learner Name & LRN</th>
                        <th className="h-10 px-4 text-center font-bold text-foreground">Curricular Program</th>
                        <th className="h-10 px-4 text-center font-bold text-foreground">Grade Level & Proposed Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftPlacement?.rosters.flatMap((roster) =>
                        roster.learners.map((learner, index) => (
                          <tr key={learner.applicationId} className={cn("border-b last:border-0 hover:bg-muted/60 transition-colors", index % 2 === 0 ? "bg-background" : "bg-muted/50")}>
                            <td className="p-3 px-4">
                              <p className="font-extrabold uppercase text-foreground">
                                {learner.lastName}, {learner.firstName}
                                {learner.middleName ? ` ${learner.middleName.charAt(0)}.` : ""}
                              </p>
                              <p className="text-sm text-foreground">
                                LRN: {learner.lrn || "No LRN"}
                              </p>
                            </td>
                            <td className="p-3 px-4 text-center">
                              <Badge variant="secondary" className="font-bold uppercase">
                                {SCP_SHORT_LABELS[learner.programType] ?? learner.programType}
                              </Badge>
                            </td>
                            <td className="p-3 px-4 text-center">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={cn("font-bold uppercase", getGradeLevelBadgeStyles(roster.section.gradeLevel))}
                                >
                                  {formatGradeLevel(roster.section.gradeLevel)}
                                </Badge>
                                <div className="font-bold uppercase">
                                  {roster.section.name}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {hasDraftOverflow && (
              <label className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 cursor-pointer">
                <Checkbox
                  checked={allowCapacityOverride}
                  onCheckedChange={(checked) =>
                    setAllowCapacityOverride(checked === true)
                  }
                  className="mt-1 bg-white"
                />
                <span className="text-sm font-bold">
                  Allow capacity override for sections marked over capacity.
                </span>
              </label>
            )}
          </div>
        }
        onConfirm={commitDraftPlacement}
        confirmText="Commit Final Sectioning"
        loading={commitProcessing}
        confirmDisabled={hasDraftOverflow && !allowCapacityOverride}
        variant="primary"
      />
    </div>
  );
}
