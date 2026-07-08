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
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  MoveRight,
  ArrowRightLeft,
} from "lucide-react";
import { motion } from "motion/react";
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
import { cn } from "@/shared/lib/utils";
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
import { useSectioningStore } from "@/store/sectioning.slice";
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

interface SectionSummary {
  id: number;
  name: string;
  gradeLevel: string;
  gradeLevelOrder: number;
  gradeLevelId: number;
  sortOrder: number;
  tleProgram: string | null;
  tleProgramId: number | null;
  maxCapacity: number;
  currentCount: number;
  boys: number;
  girls: number;
  adviser: string;
  programType: ApplicantType;
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
  learnerType: LearnerType;
  isBalikAral: boolean;
  applicantType: ApplicantType;
  assignedProgram: ApplicantType | null;
  programType: ApplicantType;
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

const interleaveBySex = (learners: PoolLearner[]) => {
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

const createDraftPlacement = (
  gradeLevelId: number,
  learners: PoolLearner[],
  sections: SectionSummary[],
): DraftPlacement => {
  const rostersBySectionId = new Map<number, DraftLearnerPlacement[]>(
    sections.map((section) => [section.id, []]),
  );
  const unplacedLearners: PoolLearner[] = [];
  const programTypes = Array.from(
    new Set(learners.map((learner) => getAutoDraftProgramType(learner))),
  );

  for (const programType of programTypes) {
    const programLearners = interleaveBySex(
      learners.filter(
        (learner) => getAutoDraftProgramType(learner) === programType,
      ),
    );
    const programSections = sections.filter(
      (section) => section.programType === programType,
    );
    const slots = buildDraftSlots(programSections);

    for (const [index, learner] of programLearners.entries()) {
      const sectionId = slots[index];
      if (sectionId === undefined) {
        unplacedLearners.push(learner);
        continue;
      }

      const rosterLearners = rostersBySectionId.get(sectionId);
      if (!rosterLearners) {
        unplacedLearners.push(learner);
        continue;
      }

      rosterLearners.push({
        ...learner,
        sectionId,
        isOverridden: false,
      });
    }
  }

  return {
    gradeLevelId,
    generatedAt: new Date().toISOString(),
    rosters: sections.map((section) =>
      buildRoster(section, rostersBySectionId.get(section.id) ?? []),
    ),
    unplacedLearners,
  };
};
export function SectioningWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();

  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [pool, setPool] = useState<PoolLearner[]>([]);
  const [processing, setProcessing] = useState(false);
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(
    null,
  );
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<number>>(
    new Set(),
  );
  const [draftMoveAction, setDraftMoveAction] =
    useState<DraftMoveAction | null>(null);
  const [moveDestinationSectionId, setMoveDestinationSectionId] = useState("");
  const [swapApplicationId, setSwapApplicationId] = useState("");
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [allowCapacityOverride, setAllowCapacityOverride] = useState(false);
  const [commitProcessing, setCommitProcessing] = useState(false);
  const [masterlistModalSectionId, setMasterlistModalSectionId] = useState<
    number | null
  >(null);

  const queryClient = useQueryClient();

  const activeGradeLevelId = useSettingsStore((s) => s.uiPreferences.sectioningGradeId);
  const setActiveGradeLevelId = (id: string) => useSettingsStore.getState().updateUiPreference("sectioningGradeId", id);

  const { data: sectionsData, isLoading: sectionsInitialLoading } = useQuery({
    queryKey: queryKeys.sectioningSections(),
    queryFn: () =>
      api
        .get<SectionSummary[]>("/sectioning/sections-summary")
        .then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const { data: poolData, isLoading: poolInitialLoading } = useQuery({
    queryKey: queryKeys.sectioningPool(),
    queryFn: () =>
      api.get<PoolLearner[]>("/sectioning/pool").then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 5_000,
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
  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
  } = useDebouncedSearch();
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  const gradeLevels = useMemo(() => {
    const raw = gradeLevelsResponse?.gradeLevels ?? [];
    const jhs = raw.filter((gradeLevel) =>
      ["Grade 7", "Grade 8", "Grade 9", "Grade 10"].includes(gradeLevel.name),
    );
    return jhs.sort((a, b) => {
      const orderA = a.displayOrder ?? parseInt(a.name.replace(/\D/g, "")) ?? 0;
      const orderB = b.displayOrder ?? parseInt(b.name.replace(/\D/g, "")) ?? 0;
      return orderA - orderB;
    });
  }, [gradeLevelsResponse]);

  useEffect(() => {
    if (gradeLevels.length > 0) {
      const isValid = gradeLevels.some(g => String(g.id) === activeGradeLevelId);
      if (!isValid) {
        setActiveGradeLevelId(String(gradeLevels[0].id));
      }
    }
  }, [gradeLevels, activeGradeLevelId, setActiveGradeLevelId]);

  const isDraftActive = draftPlacement !== null;
  const isLockedIn = selectedAppIds.length > 0 || isDraftActive;

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

    setProcessing(true);
    try {
      await api.post("/sectioning/assign-bulk", {
        sectionId: targetSectionId,
        applicationIds: selectedAppIds,
      });

      const sectionName = currentGradeSections.find(
        (s) => s.id === targetSectionId,
      )?.name;
      sileo.success({
        title: "Assignment Successful",
        description: `Moved ${selectedAppIds.length} learners to ${sectionName}.`,
      });
      setSelectedAppIds([]);
      setTargetSectionId(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningSections(),
      });
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
    );
    const allSectionIds = draft.rosters.map((roster) => roster.section.id);

    setDraftPlacement(draft);
    setExpandedSectionIds(new Set(allSectionIds));
    setSelectedAppIds([]);
    setTargetSectionId(null);
    setAllowCapacityOverride(false);

    sileo.success({
      title: "Draft Placement Generated",
      description: `${draft.rosters.reduce((total, roster) => total + roster.learners.length, 0)} learner(s) are ready for review.`,
    });
  };

  const discardDraft = () => {
    setDraftPlacement(null);
    setExpandedSectionIds(new Set());
    setDraftMoveAction(null);
    setMoveDestinationSectionId("");
    setSwapApplicationId("");
    setAllowCapacityOverride(false);
    if (sectionsData) setSections(sectionsData);
    if (poolData) setPool(poolData);
  };

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

    setDraftMoveAction(null);
    setMoveDestinationSectionId("");
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningSections(),
      });
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
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-base leading-tight font-extrabold text-slate-500 uppercase animate-pulse">
            Loading Workspace...
          </p>
        </div>
      </div>
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
    <div className="flex flex-1 h-full w-full min-h-0 flex-col">
      <Tabs
        value={activeGradeLevelId}
        onValueChange={(val) => {
          if (!isLockedIn) setActiveGradeLevelId(val);
        }}
        className="flex-shrink-0 mb-6">
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
          {gradeLevels.map((g) => (
            <TabsTrigger
              key={g.id}
              value={String(g.id)}
              disabled={isLockedIn && activeGradeLevelId !== String(g.id)}
              className={cn(
                "flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg",
                isLockedIn &&
                  activeGradeLevelId !== String(g.id) &&
                  "opacity-40 cursor-not-allowed bg-muted/20",
              )}>
              {activeGradeLevelId === String(g.id) && (
                <motion.div
                  layoutId="enrollment-grade-pill"
                  className="absolute inset-0 bg-primary shadow-sm rounded-lg"
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

      {draftPlacement && (
        <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-extrabold uppercase">
                TEMPORARY SECTIONS PENDING REVIEW
              </p>
              <p className="text-sm font-bold">
                {draftLearnerCount} learner(s) are currently assigned across{" "}
                {
                  draftPlacement.rosters.filter(
                    (roster) => roster.learners.length > 0,
                  ).length
                }{" "}
                section(s) pending final approval
              </p>
            </div>
            <Badge className="w-fit bg-amber-600 text-white hover:bg-amber-600">
              Reviewing Temporary List
            </Badge>
          </div>
        </div>
      )}

      {/* ── Workspace ── */}
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
        <Card className="flex flex-1 min-h-0 h-full shadow-sm border-none bg-card overflow-hidden">
          {/* LEFT PANE: UNSECTIONED POOL */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r border-border bg-card text-card-foreground">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-extrabold uppercase tracking-wide flex items-center gap-2 text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    LEARNERS WAITING FOR SECTIONING
                  </CardTitle>
                  <CardDescription className="text-sm font-extrabold text-foreground">
                    Enrolled learners awaiting sections
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="font-extrabold bg-background border-border">
                  {selectedAppIds.length} Selected
                </Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                  <Input
                    placeholder="Search LRN or Name..."
                    className="pl-9 h-10 border-border focus:ring-primary/20 bg-background font-extrabold"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select
                  value={filterProgram}
                  onValueChange={setFilterProgram}>
                  <SelectTrigger className="w-full sm:w-48 h-10 border-border bg-background leading-tight font-extrabold transition-colors">
                    <SelectValue placeholder="All Programs">
                      {filterProgram === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE"
                        : filterProgram === "SPECIAL_PROGRAM_IN_THE_ARTS" ? "SPA"
                          : filterProgram === "SPECIAL_PROGRAM_IN_SPORTS" ? "SPS"
                            : filterProgram === "REGULAR" ? "BEC"
                              : "All Programs"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="leading-tight font-extrabold">All Programs</SelectItem>
                    <SelectItem value="REGULAR" className="leading-tight font-extrabold">BEC</SelectItem>
                    <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING" className="leading-tight font-extrabold">Science Technology and Engineering</SelectItem>
                    <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS" className="leading-tight font-extrabold">Special Program in the Arts</SelectItem>
                    <SelectItem value="SPECIAL_PROGRAM_IN_SPORTS" className="leading-tight font-extrabold">Special Program in Sports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <div className="p-0 relative flex-1 overflow-auto">
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
                        disabled={isDraftActive}
                        onCheckedChange={(checked) => {
                          if (isDraftActive) return;
                          if (checked)
                            setSelectedAppIds(
                              filteredPool.map((l) => l.applicationId),
                            );
                          else setSelectedAppIds([]);
                        }}
                      />
                    </th>
                    <th className="p-4 font-extrabold">Learner Detail</th>
                    <th
                      className="p-4 cursor-pointer  select-none font-extrabold"
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
                      <td
                        colSpan={3}
                        className="p-12 text-center text-foreground font-extrabold">
                        No learners match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedPool.map((l) => {
                      const isSelected = selectedAppIds.includes(
                        l.applicationId,
                      );
                      return (
                        <tr
                          key={l.applicationId}
                          onClick={() => {
                            if (isDraftActive) return;
                            setSelectedAppIds((prev) =>
                              prev.includes(l.applicationId)
                                ? prev.filter((id) => id !== l.applicationId)
                                : [...prev, l.applicationId],
                            );
                          }}
                          className={cn(
                            "group cursor-pointer transition-colors",
                            isSelected && "bg-primary/5 hover:bg-primary/10",
                          )}>
                          <td
                            className="p-4"
                            onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              disabled={isDraftActive}
                              onCheckedChange={(checked) => {
                                if (isDraftActive) return;
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
                            <div className="flex flex-col">
                              <span className="font-extrabold text-foreground uppercase flex items-center gap-2">
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
                                <span className="text-sm font-extrabold uppercase text-foreground">
                                  {l.lrn || "NO LRN"}
                                </span>
                                <Badge
                                  className={cn(
                                    "text-sm uppercase font-extrabold",
                                    l.sex === "MALE" ? "bg-blue-600/10 text-blue-600 border-blue-600 border-2" : "bg-pink-600/10 text-pink-600 border-pink-600 border-2"
                                  )}>
                                  {l.sex}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-sm uppercase font-extrabold">
                                  {SCP_SHORT_LABELS[l.programType] ??
                                    l.programType}
                                </Badge>
                              </div>
                              {draftPlacement &&
                                draftSectionByApplicationId.has(
                                  l.applicationId,
                                ) && (
                                  <span className="text-sm mt-2 font-extrabold uppercase text-primary text-left">
                                    Section:{" "}
                                    {draftSectionByApplicationId.get(
                                      l.applicationId,
                                    )}{" "}
                                    (Draft)
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="p-4 font-extrabold text-foreground">
                            {l.genAve ? (
                              l.genAve.toFixed(2)
                            ) : (
                              <span className="text-foreground">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT PANE: AVAILABLE SECTIONS */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card text-card-foreground">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-extrabold uppercase tracking-wide flex items-center gap-2 text-foreground">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    {draftPlacement
                      ? "TEMPORARY CLASS LISTS"
                      : "Available Sections"}
                  </CardTitle>
                  <CardDescription className="text-foreground text-sm font-extrabold">
                    {draftPlacement
                      ? "Please review the temporary assignments before creating the official lists"
                      : `Select destination to move ${selectedAppIds.length || "0"} learners.`}
                  </CardDescription>
                </div>
              </div>

              <Button
                size="sm"
                variant="default"
                disabled={
                  currentGradePool.length === 0 ||
                  processing ||
                  isDraftActive ||
                  isHistoricalReadOnly
                }
                onClick={generateDraftPlacement}
                className="font-extrabold text-base uppercase tracking-normal gap-1 rounded-lg">
                AUTO ASSIGN SECTIONS
              </Button>
            </CardHeader>
            <div className="p-4 space-y-3 relative flex-1 overflow-auto">
              {displayedRosters.length === 0 ? (
                <div className="h-full flex items-center justify-center flex-col gap-3 text-foreground">
                  <Info className="h-8 w-8" />
                  <span className="font-extrabold text-base leading-tight">
                    No sections defined for this grade.
                  </span>
                </div>
              ) : (
                displayedRosters.map((roster) => {
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
                        if (s.currentCount > 0) {
                          setMasterlistModalSectionId(s.id);
                        } else if (isProgramCompatible) {
                          setTargetSectionId(s.id);
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
                              "font-extrabold text-lg uppercase transition-colors flex items-center gap-2",
                              isSelected ? "text-primary" : "text-foreground",
                            )}>
                            {s.name}
                          </h4>
                          <span className="text-sm font-extrabold uppercase text-foreground">
                            {s.adviser || "No Adviser Assigned"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {draftPlacement && roster.isOverCapacity && (
                            <Badge
                              variant="destructive"
                              className="text-sm font-extrabold uppercase">
                              Over Capacity
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-sm font-extrabold uppercase bg-background",
                              s.programType === "REGULAR"
                                ? "text-foreground border-border"
                                : "text-primary border-primary/30",
                            )}>
                            {SCP_SHORT_LABELS[s.programType] ?? s.programType}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-base font-extrabold">
                          <span className="text-foreground uppercase text-sm">
                            Capacity Fill
                          </span>
                          <span
                            className={cn(
                              isOverCapacity
                                ? "text-destructive font-extrabold"
                                : "text-foreground",
                            )}>
                            {roster.totalCount} / {s.maxCapacity}{" "}
                            {isOverCapacity && (
                              <AlertTriangle className="inline h-3 w-3 ml-1" />
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-extrabold uppercase text-foreground">
                          <Badge className="bg-blue-600/10 text-blue-600 border-blue-600 border-2">
                            Male: {roster.genderCounts.boys}
                          </Badge>
                          <Badge className="bg-pink-600/10 text-pink-600 border-pink-600 border-2">
                            Female: {roster.genderCounts.girls}
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
                          className="mt-4 overflow-hidden rounded-lg border bg-card"
                          onClick={(event) => event.stopPropagation()}>
                          <table className="w-full text-left text-sm">
                            <thead className="bg-muted text-foreground">
                              <tr className="font-extrabold uppercase">
                                <th className="p-3">Learner</th>
                                <th className="p-3 text-center">Sex</th>
                                <th className="p-3 text-center">Gen Ave</th>
                                <th className="p-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {roster.learners.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="p-4 text-center font-extrabold text-foreground">
                                    No drafted learners in this section.
                                  </td>
                                </tr>
                              ) : (
                                roster.learners.map((learner) => (
                                  <tr key={learner.applicationId}>
                                    <td className="p-3">
                                      <div className="flex flex-col">
                                        <span className="font-extrabold uppercase text-foreground">
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
                                    <td className="p-3 font-extrabold text-center">
                                      <Badge
                                        className={cn(
                                          "uppercase",
                                          learner.sex === "MALE"
                                            ? "bg-blue-600/10 text-blue-600 border-blue-600 border-2"
                                            : "bg-pink-600/10 text-pink-600 border-pink-600 border-2"
                                        )}>
                                        {learner.sex}
                                      </Badge>
                                    </td>
                                    <td className="p-3 font-extrabold text-center">
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
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t border-border bg-muted/20">
              {draftPlacement ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={discardDraft}
                    disabled={commitProcessing}
                    className="h-12 text-base font-extrabold uppercase">
                    CANCEL TEMPORARY SECTIONS
                  </Button>
                  <Button
                    onClick={() => setCommitDialogOpen(true)}
                    disabled={
                      commitProcessing ||
                      draftLearnerCount === 0 ||
                      isHistoricalReadOnly
                    }
                    className="h-12 text-base font-extrabold uppercase">
                    FINALIZE OFFICIAL SECTIONS
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
                    "w-full h-12 text-base leading-tight font-extrabold uppercase transition-all shadow-none",
                    selectedAppIds.length > 0 && targetSectionId
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted",
                  )}>
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    `Assign to Section (${selectedAppIds.length})`
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

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
            <SelectTrigger className="h-11 font-extrabold">
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
            <SelectTrigger className="h-11 font-extrabold">
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
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        title="FINALIZE OFFICIAL SECTIONS"
        description={
          <div className="space-y-4">
            <p className="font-extrabold">
              This action will lock the assignments and update the official school records
            </p>
            <div className="space-y-3 rounded-lg border bg-muted p-4 text-left">
              <p className="text-base font-extrabold text-foreground">
                {draftLearnerCount} learner(s) will be officially placed in their respective classes
              </p>
              {hasDraftOverflow && (
                <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 cursor-pointer">
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
