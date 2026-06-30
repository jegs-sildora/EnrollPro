import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PhaseBanner } from "@/shared/components/PhaseBanner";
import { PreFlightBlockerModal } from "@/features/enrollment/components/PreFlightBlockerModal";
import { EosyOverrideModal } from "@/features/enrollment/components/EosyOverrideModal";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { getBOSYReadiness } from "@/features/bosy/api/bosy.api";
import { Card } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  CheckCircle2,
  Lock,
  Unlock,
  Loader2,
  AlertTriangle,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Search,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { cn } from "@/shared/lib/utils";
import type { EosyStatus } from "@enrollpro/shared";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/shared/ui/tooltip";
import { sileo } from "sileo";
import { useEosyStream, type EosyEventPayload } from "@/features/enrollment/hooks/useEosyStream";

export interface EnrollmentRecord {
  id: number;
  eosyStatus: EosyStatus | null;
  dropOutReason: string | null;
  finalAverage: number | null;
  nextYearCurriculum: string | null;
  transferOutDate: string | null;
  isScpDemoted?: boolean;
  scpViolation?: {
    subject: string;
    term: string;
    actualGrade: number;
    requiredGrade: number;
    violationType: string;
  } | null;
  section: {
    id: number;
    name: string;
    isEosyFinalized: boolean;
    programType?: string;
    isHomogeneous?: boolean;
  };
  enrollmentApplication: {
    id: number;
    trackingNumber: string;
    applicantType: string;
    learner: {
      id: number;
      lrn: string | null;
      firstName: string;
      lastName: string;
      sex?: "MALE" | "FEMALE" | null;
    };
  };
}

interface GradeLevel {
  id: number;
  name: string;
  displayOrder: number | null;
}

interface Section {
  id: number;
  name: string;
  isEosyFinalized: boolean;
  programType: string;
  isHomogeneous: boolean;
  gradeLevelId: number;
  gradeLevel: GradeLevel;
  _count: { enrollmentRecords: number };
}

interface EosyExportLockState {
  schoolYearId: number;
  schoolYearLabel: string;
  schoolYearFinalized: boolean;
  totalSections: number;
  finalizedSections: number;
  canFinalizeSchoolYear: boolean;
  lockReason: string | null;
}

const formatStatusLabel = (status: EosyStatus | null) => {
  const normalized = status ?? "PROMOTED";

  switch (normalized) {
    case "PROMOTED":
      return "PROMOTED";
    case "RETAINED":
      return "RETAINED";
    case "CONDITIONALLY_PROMOTED":
      return "PROMOTED (TO BEC)";
    case "TRANSFERRED_OUT":
      return "TRANSFERRED OUT";
    case "DROPPED_OUT":
      return "DROPPED OUT";
    default:
      return "PROMOTED";
  }
};

const getNextGradeName = (currentName: string) => {
  const match = currentName.match(/\d+/);
  if (match) {
    const nextGrade = parseInt(match[0], 10) + 1;
    return `Grade ${nextGrade}`;
  }
  return "the next grade level";
};

export default function EosyUpdating() {
  const {
    activeSchoolYearId,
    viewingSchoolYearId,
    systemStatus,
    systemPhase,
  } = useSettingsStore();
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const isEosyPhase = systemPhase === "EOSY_CLOSING";
  const isEosyArchivedState = systemStatus === "ARCHIVED";
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);
  const [exportLock, setExportLock] = useState<EosyExportLockState | null>(null);

  const [overrideRecord, setOverrideRecord] = useState<EnrollmentRecord | null>(null);

  const [loadingRecords, setLoadingRecords] = useState(false);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [batchActionStatus, setBatchActionStatus] = useState<EosyStatus | "">("");
  const [batchUpdateLoading, setBatchUpdateLoading] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [preFlightModalOpen, setPreFlightModalOpen] = useState(false);
  const [sf5WatermarkOpen, setSf5WatermarkOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  useEffect(() => {
    if (!ayId) return;
    getBOSYReadiness(ayId).catch(() => { });
  }, [ayId]);

  const fetchSectionsAndGrades = useCallback(async () => {
    if (!ayId) return;
    try {
      const res = await api.get(`/eosy/sections?schoolYearId=${ayId}&_t=${Date.now()}`);
      const rawSections: Section[] = res.data.sections || [];

      const glMap = new Map<number, GradeLevel>();
      rawSections.forEach(s => {
        if (!glMap.has(s.gradeLevelId)) {
          glMap.set(s.gradeLevelId, s.gradeLevel);
        }
      });

      const grades = Array.from(glMap.values()).sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
      setGradeLevels(grades);

      if (grades.length > 0 && !activeTab) {
        setActiveTab(String(grades[0].id));
      }
    } catch (err) {
      toastApiError(err as never);
    }
  }, [ayId, activeTab]);

  const fetchExportLockState = useCallback(async () => {
    if (!ayId) {
      setExportLock(null);
      return;
    }

    try {
      const res = await api.get(`/eosy/school-year/${ayId}/export-lock`);
      setExportLock(res.data);
    } catch (err) {
      console.error("Failed to fetch export lock state", err);
      setExportLock(null);
    }
  }, [ayId]);

  const fetchGradeRecords = useCallback(async (gradeLevelId: string, silent = false) => {
    if (!gradeLevelId || !ayId) return;
    if (!silent) {
      setLoadingRecords(true);
      setRowSelection({});
      setSectionFilter("ALL");
    }
    try {
      const res = await api.get(`/eosy/grade/${gradeLevelId}/records?schoolYearId=${ayId}&_t=${Date.now()}`);
      setRecords(res.data.records || []);
    } catch (err) {
      if (!silent) toastApiError(err as never);
    } finally {
      if (!silent) setLoadingRecords(false);
    }
  }, [ayId]);

  useEffect(() => {
    void fetchSectionsAndGrades();
    void fetchExportLockState();
  }, [fetchSectionsAndGrades, fetchExportLockState]);

  useEffect(() => {
    if (activeTab) {
      void fetchGradeRecords(activeTab);
    }
  }, [activeTab, fetchGradeRecords]);

  // Auto-refresh when teacher submits/locks their section using Server-Sent Events
  useEosyStream(
    useCallback((payload: EosyEventPayload) => {
      if (!activeTab || isHistoricalReadOnly) return;
      const relevantEvents = ["TEACHER_EOSY_SUBMITTED", "SECTION_UNLOCKED", "SECTION_FINALIZED", "GRADE_LEVEL_FINALIZED"];
      if (relevantEvents.includes(payload.type)) {
        void fetchSectionsAndGrades();
        void fetchGradeRecords(activeTab, true);
        void fetchExportLockState();
      }
    }, [activeTab, isHistoricalReadOnly, fetchSectionsAndGrades, fetchGradeRecords, fetchExportLockState])
  );


  const handleStatusChange = useCallback(
    async (recordId: number, status: string, finalAverage?: number | null) => {
      if (isHistoricalReadOnly && !hasOverride) {
        sileo.error({ title: "Read-Only", description: "This school year is archived. All records are read-only." });
        return;
      }
      if (exportLock?.schoolYearFinalized) {
        sileo.error({ title: "School Year Locked", description: "School year EOSY is finalized. Updates are no longer allowed." });
        return;
      }

      const record = records.find((r) => r.id === recordId);
      const effectiveAve = finalAverage !== undefined ? finalAverage : record?.finalAverage;

      if (status === "PROMOTED" && effectiveAve !== null && effectiveAve !== undefined && effectiveAve < 75) {
        sileo.error({ title: "Academic Policy Violation", description: "Learner with General Average below 75.00 cannot be marked as PROMOTED." });
        return;
      }

      if (record?.section.isEosyFinalized) {
        sileo.error({ title: "Section Locked", description: "This section is already finalized." });
        return;
      }

      try {
        const payload: Record<string, unknown> = { eosyStatus: status };
        if (finalAverage !== undefined) payload.finalAverage = finalAverage;

        await api.patch(`/eosy/records/${recordId}`, payload);

        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? {
                ...r,
                eosyStatus: status as EosyStatus,
                finalAverage: finalAverage !== undefined ? finalAverage : r.finalAverage,
              }
              : r,
          ),
        );

        if (finalAverage === undefined) {
          sileo.success({ title: "Status Updated", description: "Learner status saved successfully." });
        }
      } catch (err) {
        toastApiError(err as never);
      }
    },
    [exportLock?.schoolYearFinalized, records, isHistoricalReadOnly, hasOverride],
  );

  const handleBatchUpdate = async () => {
    if (!batchActionStatus) return;

    const selectedIndexes = Object.keys(rowSelection).map(Number);
    const selectedRecords = selectedIndexes.map((idx) => filteredRecords[idx]);

    if (selectedRecords.length === 0) {
      sileo.error({ title: "No Selection", description: "Please select at least one learner." });
      return;
    }

    // Filter out records from finalized sections
    const editableRecords = selectedRecords.filter(r => !r.section.isEosyFinalized);
    if (editableRecords.length === 0) {
      sileo.error({ title: "Action Aborted", description: "All selected learners belong to finalized sections." });
      return;
    }

    let targetRecords = editableRecords;
    let skippedCount = selectedRecords.length - editableRecords.length;

    if (batchActionStatus === "PROMOTED") {
      targetRecords = editableRecords.filter((r) => r.finalAverage && r.finalAverage >= 75);
      skippedCount += editableRecords.length - targetRecords.length;
    }

    if (targetRecords.length === 0) {
      sileo.error({ title: "Action Aborted", description: "None of the selected learners meet the criteria for this status (e.g. >= 75 for Promoted)." });
      return;
    }

    setBatchUpdateLoading(true);
    try {
      const payload = {
        schoolYearId: ayId,
        updates: targetRecords.map(r => ({ recordId: r.id, status: batchActionStatus }))
      };

      await api.put(`/eosy/grade/${activeTab}/batch-status`, payload);

      setRecords((prev) =>
        prev.map((r) => {
          const match = targetRecords.find((tr) => tr.id === r.id);
          return match ? { ...r, eosyStatus: batchActionStatus as EosyStatus } : r;
        }),
      );

      sileo.success({
        title: "Batch Updated",
        description: `${targetRecords.length} learners updated.${skippedCount > 0 ? ` ${skippedCount} skipped due to policy or locked section.` : ""}`,
      });
      setRowSelection({});
      setBatchActionStatus("");
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setBatchUpdateLoading(false);
    }
  };

  const handleFinalizeGrade = async () => {
    setFinalizeLoading(true);
    try {
      const sectionIdPayload = sectionFilter === "ALL"
        ? "all"
        : records.find(r => r.section.name === sectionFilter)?.section?.id ?? "all";

      await api.post(`/eosy/grade/${activeTab}/finalize`, {
        schoolYearId: ayId,
        section_id: sectionIdPayload
      });

      sileo.success({
        title: sectionFilter === "ALL" ? "Grade Level Finalized" : "Section Finalized",
        description: "Grade progression executed successfully and section(s) are now locked.",
      });

      setFinalizeModalOpen(false);
      void fetchExportLockState();
      void fetchSectionsAndGrades();
      void fetchGradeRecords(activeTab);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setFinalizeLoading(false);
    }
  };

  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const handleUnlockSection = async () => {
    if (sectionFilter === "ALL") return;
    
    const sectionIdPayload = records.find(r => r.section.name === sectionFilter)?.section?.id;
    if (!sectionIdPayload) return;

    setUnlockLoading(true);
    try {
      await api.post(`/eosy/sections/${sectionIdPayload}/unlock`);
      sileo.success({
        title: "Section Unlocked",
        description: `Section ${sectionFilter} has been successfully unlocked.`,
      });
      void fetchExportLockState();
      void fetchSectionsAndGrades();
      void fetchGradeRecords(activeTab);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setUnlockLoading(false);
      setUnlockModalOpen(false);
    }
  };
  const isSchoolYearFinalized = exportLock?.schoolYearFinalized ?? false;
  const shouldShowFinalizedView = isEosyArchivedState || isSchoolYearFinalized;

  const isAllFinalized = exportLock?.canFinalizeSchoolYear === true;

  const activeGradeName = gradeLevels.find(g => String(g.id) === activeTab)?.name || "Grade Level";

  const sectionOptions = useMemo(() => {
    const sectionsSet = new Set<string>();
    records.forEach(r => {
      const name = r.section?.name?.trim();
      if (name) {
        sectionsSet.add(name);
      }
    });
    return Array.from(sectionsSet).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (sectionFilter !== "ALL") {
      list = list.filter(r => r.section.name === sectionFilter);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        const { firstName, lastName, lrn } = r.enrollmentApplication.learner;
        return (
          firstName.toLowerCase().includes(q) ||
          lastName.toLowerCase().includes(q) ||
          (lrn && lrn.toLowerCase().includes(q))
        );
      });
    }

    return [...list].sort((a, b) => {
      // 1. STE
      // 2. SPA
      // 3. SPS
      // 4. PILOT/HOMOGENEOUS
      // 5. HETEROGENEOUS
      const getRank = (r: EnrollmentRecord) => {
        if (r.section.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") return 1;
        if (r.section.programType === "SPECIAL_PROGRAM_IN_THE_ARTS") return 2;
        if (r.section.programType === "SPECIAL_PROGRAM_IN_SPORTS") return 3;
        if (r.section.isHomogeneous) return 4;
        return 5;
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;

      // Keep section alphabetical order as secondary sort
      const sectionCompare = a.section.name.localeCompare(b.section.name);
      if (sectionCompare !== 0) return sectionCompare;

      // Finally, student last name
      return a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName);
    });
  }, [records, sectionFilter, searchQuery]);

  const pendingCount = filteredRecords.filter(r =>
    (r.finalAverage === null || r.finalAverage === undefined) &&
    r.eosyStatus !== "TRANSFERRED_OUT" &&
    r.eosyStatus !== "DROPPED_OUT"
  ).length;

  const isScopeFinalized = filteredRecords.length > 0 && filteredRecords.every(r => r.section.isEosyFinalized);

  const pendingClassesList = useMemo(() => {
    const sets = new Set<string>();
    filteredRecords.forEach((r) => {
      if (
        (r.finalAverage === null || r.finalAverage === undefined) &&
        r.eosyStatus !== "TRANSFERRED_OUT" &&
        r.eosyStatus !== "DROPPED_OUT"
      ) {
        sets.add(r.section.name);
      }
    });
    return Array.from(sets);
  }, [filteredRecords]);

  const pendingIrregularCount = useMemo(() => {
    return filteredRecords.filter((r) => !r.eosyStatus).length;
  }, [filteredRecords]);

  const scopedUnlockedClassesCount = pendingClassesList.length;
  const hasUnlockedClasses = scopedUnlockedClassesCount > 0;
  const scopedIrregularBlockerCount = pendingIrregularCount;
  const hasIrregularBlockers = scopedIrregularBlockerCount > 0;
  const blockersCount = (hasUnlockedClasses ? 1 : 0) + (hasIrregularBlockers ? 1 : 0);

  const targetScopeName = sectionFilter === "ALL" ? `All ${activeGradeName}` : `Section: ${sectionFilter}`;
  const descriptionTarget = sectionFilter === "ALL"
    ? `all ${activeGradeName} learners`
    : `the ${activeGradeName} - ${sectionFilter} section`;

  const baseColumns = useMemo<ColumnDef<EnrollmentRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            disabled={isScopeFinalized}
            className="translate-y-[2px] w-5 h-5 border-2 border-primary/70 bg-perimary !rounded-sm data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            disabled={row.original.section.isEosyFinalized}
            className="translate-y-[2px] w-5 h-5 border-2 !rounded-sm disabled:cursor-not-allowed disabled:opacity-50"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
        meta: { className: "w-12 text-center" }
      },
      {
        id: "student",
        accessorKey: "enrollmentApplication.learner.lastName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="LEARNER" className="justify-center" />,
        cell: ({ row }) => {
          const sex = row.original.enrollmentApplication.learner.sex;
          const genderLabel = sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : null;

          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-base">
              <span className="font-extrabold uppercase truncate">
                {row.original.enrollmentApplication.learner.lastName}, {row.original.enrollmentApplication.learner.firstName}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base text-foreground font-extrabold uppercase">
                  LRN: {row.original.enrollmentApplication.learner.lrn || "NO LRN"}
                </span>
                {row.original.nextYearCurriculum === "REGULAR" &&
                  row.original.enrollmentApplication.applicantType !== "REGULAR" &&
                  row.original.enrollmentApplication.applicantType !== "LATE_ENROLLEE"}
              </div>
            </div>
          );
        },
        meta: { className: "min-w-[250px] text-left w-full" }
      },
      {
        id: "section",
        accessorKey: "section.name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="SECTION" className="justify-center" />,
        cell: ({ row }) => (
          <span className="text-base font-extrabold">{row.original.section.name}</span>
        ),
        meta: { className: "min-w-[150px] text-left" }
      },
      {
        id: "finalAve",
        accessorKey: "finalAverage",
        header: ({ column }) => <DataTableColumnHeader column={column} title="FINAL GEN AVE" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const ave = r.finalAverage;
          if (ave === null || ave === undefined) {
            return (
              <span className="font-extrabold text-base sm:text-base leading-tight block text-center text-muted-foreground opacity-60">
                --
              </span>
            );
          }
          const isFailing = ave < 75;

          return (
            <div className="flex justify-center items-center gap-1">
              <span className={cn("text-base sm:text-base leading-tight tabular-nums block text-center",
                isFailing ? "text-red-600 font-extrabold" : "text-gray-900 font-extrabold"
              )}>
                {ave.toFixed(2)}
              </span>
            </div>
          );
        },
        size: 100,
        meta: { className: "w-[100px] text-center" }
      },
      {
        id: "status",
        accessorKey: "eosyStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="EOSY STATUS" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const isScpDemoted = r.isScpDemoted || !!r.scpViolation;
          const scpViolation = r.scpViolation;

          const resolvedStatus = r.eosyStatus ?? "PROMOTED";
          const statusLabel = formatStatusLabel(r.eosyStatus);
          const isSectionFinalized = r.section.isEosyFinalized;

          const renderStatusContent = () => (
            <div
              className={cn(
                "inline-flex items-center justify-between w-max min-w-[140px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border transition-colors",
                isScpDemoted && resolvedStatus === "PROMOTED"
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : !r.eosyStatus || r.eosyStatus === "PROMOTED"
                    ? "text-green-700 bg-green-50 border-green-200"
                    : "text-amber-700 bg-amber-50 border-amber-200"
              )}>
              <span>{isScpDemoted && resolvedStatus === "PROMOTED" ? "PROMOTED (TO BEC)" : statusLabel}</span>
              {isScpDemoted && resolvedStatus === "PROMOTED" && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 ml-2 cursor-help" />
              )}
            </div>
          );

          const renderTooltip = (trigger: React.ReactNode) => (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {trigger}
                </TooltipTrigger>
                <TooltipContent className="bg-amber-50 border border-amber-300 text-amber-900 shadow-lg rounded-md p-4 w-80 text-left">
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-amber-800 border-b border-amber-200 pb-2 mb-2">
                    Special Program Retention Alert
                  </h4>
                  <p className="text-base  leading-snug">
                    Learner will be laterally transferred to the Basic Education Curriculum (BEC) next school year due to the following grade deficiency:
                  </p>
                  {scpViolation && (
                    <div className="mt-3 bg-amber-100/50 rounded p-2 text-base leading-tight border border-amber-200/50">
                      <p><span className="font-semibold text-amber-900">Subject:</span> {scpViolation.subject}</p>
                      <p><span className="font-semibold text-amber-900">Term:</span> {scpViolation.term}</p>
                      <p className="mt-1 text-red-700 font-extrabold">
                        Grade: {scpViolation.actualGrade} <span className="text-amber-700  text-base">(Required: {scpViolation.requiredGrade})</span>
                      </p>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );

          if (isSectionFinalized || isScopeFinalized) {
            return (
              <div className="flex justify-center">
                {isScpDemoted && resolvedStatus === "PROMOTED" ? renderTooltip(renderStatusContent()) : renderStatusContent()}
              </div>
            );
          }

          return (
            <div className="flex justify-center">
              <Select
                value={isScpDemoted && resolvedStatus === "PROMOTED" ? "PROMOTED_TO_BEC" : resolvedStatus}
                onValueChange={(val) => handleStatusChange(r.id, val)}
                disabled={isSectionFinalized}>
                {isScpDemoted && resolvedStatus === "PROMOTED" ? (
                  renderTooltip(
                    <SelectTrigger
                      className={cn(
                        "inline-flex items-center justify-between w-max min-w-[140px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border",
                        "text-amber-700 bg-amber-50 border-amber-200 cursor-help"
                      )}>
                      <span className="flex-1 text-left">PROMOTED (TO BEC)</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 ml-1" />
                    </SelectTrigger>
                  )
                ) : (
                  <SelectTrigger
                    className={cn(
                      "inline-flex items-center justify-between w-max min-w-[140px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border",
                      !r.eosyStatus || r.eosyStatus === "PROMOTED"
                        ? "text-green-700 bg-green-50 border-green-200"
                        : "text-amber-700 bg-amber-50 border-amber-200",
                    )}>
                    <SelectValue />
                  </SelectTrigger>
                )}
                <SelectContent>
                  {isScpDemoted ? (
                    <SelectItem value="PROMOTED_TO_BEC">PROMOTED (TO BEC)</SelectItem>
                  ) : (
                    <SelectItem value="PROMOTED">PROMOTED</SelectItem>
                  )}
                  <SelectItem value="RETAINED">RETAINED</SelectItem>
                  <SelectItem value="CONDITIONALLY_PROMOTED">PROMOTED (TO BEC)</SelectItem>
                  <SelectItem value="TRANSFERRED_OUT">TRANSFERRED OUT</SelectItem>
                  <SelectItem value="DROPPED_OUT">DROPPED OUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
        meta: { className: "w-[150px] text-center" }
      },
    ],
    [isScopeFinalized, handleStatusChange],
  );

  const columns = useMemo(() => {
    let cols = isScopeFinalized ? baseColumns.filter(c => c.id !== "select") : baseColumns;
    return cols;
  }, [baseColumns, isScopeFinalized]);

  if (shouldShowFinalizedView) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div className="text-center space-y-3 max-w-lg">
          <h2 className="text-xl font-extrabold uppercase text-emerald-700">EOSY Successfully Finalized</h2>
          <p className="text-base font-extrabold text-foreground leading-relaxed">
            All academic records for this school year are sealed and locked.
          </p>
        </div>
      </div>
    );
  }

  if (!isEosyPhase && !isHistoricalReadOnly) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-extrabold uppercase">EOSY Phase Not Active</h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            EOSY status updates are only available during the End of School Year phase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col pb-8">
        <PhaseBanner />


        {/* ── Top Header ── */}
        <div className="flex items-center justify-between pb-6 flex-shrink-0">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              End of School Year (EOSY) Promotion Update
            </h1>
            <p className="text-base leading-tight font-extrabold text-foreground">
              Review submitted General Averages, verify promotion status, and lock section rosters for the End of School Year.
            </p>
          </div>
        </div>

        {isAllFinalized && !shouldShowFinalizedView && (
          <div className="mt-6 mb-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 text-emerald-800">
              <h3 className="font-extrabold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                School Year Finalization Complete
              </h3>
              <p className="text-base leading-tight">All grade levels are officially locked. You may now advance the system to the next School Year.</p>
            </div>
            <Button asChild className="bg-green-700 hover:bg-green-800 text-white font-extrabold shadow-sm">
              <a href="/settings">Proceed to School Year Setup &rarr;</a>
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative flex-shrink-0">
            {gradeLevels.map((gl) => (
              <TabsTrigger
                key={gl.id}
                value={String(gl.id)}
                className={cn(
                  "flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                )}
              >
                {activeTab === String(gl.id) && (
                  <motion.div
                    layoutId="enrollment-eosy-grade-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className={cn("relative z-20 text-base font-extrabold uppercase", activeTab === String(gl.id) ? "text-primary-foreground" : "text-foreground")}>
                  {gl.name.replace(/grade\s*/i, "Grade ")}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full flex flex-col space-y-4"
            >
                  {isScopeFinalized && (
                    <div className="flex items-center justify-center w-full bg-amber-50 border border-amber-200 rounded-sm py-3 shrink-0">
                      <Lock className="text-amber-700 w-5 h-5 mr-2" />
                      <span className="text-base leading-tight font-extrabold text-amber-900 uppercase tracking-widest">
                        EOSY FINALIZED: OFFICIAL RECORDS LOCKED. NO FURTHER EDITS ALLOWED.
                      </span>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-none shadow-sm flex flex-col overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
                      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">
                    {/* Left Side Actions */}
                    <div className="flex-1 w-full min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search learner name or LRN..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-4 bg-white/50 focus:bg-white transition-colors h-10 w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <Select
                        value={sectionFilter}
                        onValueChange={setSectionFilter}
                      >
                        <SelectTrigger className="w-56 bg-background border-border font-extrabold">
                          <SelectValue placeholder="Filter by Section / Adviser" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL" className="font-extrabold">All Sections</SelectItem>
                          {sectionOptions.map(sec => (
                            <SelectItem key={sec} value={sec} className="font-extrabold">{sec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {isScopeFinalized ? (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="font-extrabold border-border hover:bg-primary hover:text-primary-foreground" onClick={() => {
                            if (pendingCount > 0) {
                              setSf5WatermarkOpen(true);
                            } else {
                              sileo.success({ title: "Download", description: "Downloading Clean SF5 (Section)..." });
                            }
                          }}>
                            Export SF5
                          </Button>
                          <Button variant="outline" className="font-extrabold border-border hover:bg-primary hover:text-primary-foreground" onClick={() => sileo.success({ title: "Download", description: "Downloading SF6 (Grade Level Summary)..." })}>
                            Export SF6
                          </Button>
                        </div>
                      ) : Object.keys(rowSelection).length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={batchActionStatus}
                            onValueChange={(val) => setBatchActionStatus(val as EosyStatus)}
                            disabled={Object.keys(rowSelection).length === 0}
                          >
                            <SelectTrigger className="w-48 bg-background border-border font-extrabold">
                              <SelectValue placeholder="Select New Status..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PROMOTED">PROMOTED</SelectItem>
                              <SelectItem value="RETAINED">RETAINED</SelectItem>
                              <SelectItem value="CONDITIONALLY_PROMOTED">PROMOTED (TO BEC)</SelectItem>
                              <SelectItem value="TRANSFERRED_OUT">TRANSFERRED OUT</SelectItem>
                              <SelectItem value="DROPPED_OUT">DROPPED OUT</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleBatchUpdate}
                            disabled={!batchActionStatus || Object.keys(rowSelection).length === 0 || batchUpdateLoading}
                            variant={batchActionStatus ? "default" : "outline"}
                            className={cn(
                              "transition-all font-extrabold px-6",
                              batchActionStatus && Object.keys(rowSelection).length > 0
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                                : "text-muted-foreground border-border bg-muted/30 cursor-not-allowed"
                            )}
                          >
                            {batchUpdateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Apply to Selected
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {/* Right Side Status & Finalize */}
                    <div className="flex flex-wrap items-center gap-4 xl:justify-end">
                      {/* Status Indicators */}
                      <div className="flex items-center gap-3">
                        {pendingCount > 0 && !isScopeFinalized && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-base font-extrabold shadow-sm border border-border">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            {pendingCount} Pending Submissions
                          </div>
                        )}

                        {!isScopeFinalized && blockersCount > 0 && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-base font-extrabold cursor-help transition-colors hover:bg-destructive/20">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {blockersCount} {blockersCount === 1 ? "Blocker" : "Blockers"} Detected
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="end" className="bg-destructive text-destructive-foreground border-none p-4 shadow-xl rounded-lg text-base leading-tight max-w-xs">
                                <p className="font-extrabold mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  Pending Requirements
                                </p>
                                <div className="space-y-1.5 text-destructive-foreground/90">
                                  {hasUnlockedClasses && <p>• {scopedUnlockedClassesCount} sections missing School Form 5 (SF5).</p>}
                                  {hasIrregularBlockers && <p>• {scopedIrregularBlockerCount ?? 0} learners require encoded EOSY (Summer) classes.</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      {/* Finalize Button */}
                      {!isScopeFinalized && blockersCount === 0 && (
                        <Button
                          onClick={() => setFinalizeModalOpen(true)}
                          disabled={records.length === 0}
                          size="lg"
                          className="font-extrabold shadow-md transition-all bg-primary text-primary-foreground uppercase"
                        >
                          Finalize & Lock {targetScopeName}
                        </Button>
                      )}
                      
                      {isScopeFinalized && sectionFilter !== "ALL" && !isSchoolYearFinalized && (
                        <Button
                          onClick={() => setUnlockModalOpen(true)}
                          disabled={unlockLoading}
                          size="lg"
                          variant="outline"
                          className="font-extrabold shadow-md transition-all uppercase border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        >
                          {unlockLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                          Unlock Section Roster
                        </Button>
                      )}
                    </div>
                      </div>
                    </div>

                  <div className="flex flex-col bg-card">
                    {loadingRecords ? (
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 py-10">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-base leading-tight ">Loading {activeGradeName} records...</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <DataTable
                          columns={columns}
                          data={filteredRecords}
                          containerHeight="100%"
                          rowSelection={rowSelection}
                          onRowSelectionChange={setRowSelection}
                          getRowClassName={(row) => isScopeFinalized || row.section.isEosyFinalized ? "opacity-50 pointer-events-none hover:bg-transparent" : ""}
                        />
                      </div>
                    )}
                  </div>
                </div>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>

      <Dialog open={finalizeModalOpen} onOpenChange={setFinalizeModalOpen}>
        <DialogContent className={cn("w-[calc(100%-2rem)] sm:max-w-xl rounded-lg p-8 overflow-hidden", "bg-sidebar shadow-2xl")}>
          <DialogHeader className="space-y-2 text-center items-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(var(--primary))] ring-[6px] ring-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-5 text-[hsl(var(--primary-foreground))]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-center text-xl font-extrabold">Lock {targetScopeName} End of School Year (EOSY)?</DialogTitle>
            <DialogDescription className="text-center pt-2 font-semibold text-md">
              {activeGradeName.includes("10") ? (
                `Are you sure you want to finalize ${descriptionTarget}? This will officially close the school year and generate their Junior High School completion records.`
              ) : (
                <>
                  Are you sure you want to finalize {descriptionTarget}? This will officially close the school year and determine their promotion to{' '}
                  <span className="font-extrabold">{getNextGradeName(activeGradeName)}</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[hsl(var(--primary)/0.05)] p-4 rounded-md text-md text-foreground space-y-2 my-2 border border-[hsl(var(--primary)/0.2)]">
            <p>• Final grades and EOSY statuses (Promoted, Retained, Irregular) will be permanently saved.</p>
            <p>• The School Form 5 (SF5) for {descriptionTarget} will be locked. Class advisers can no longer change the grades.</p>
            <p>• This data will be permanently written to the learners' Permanent Academic Record (SF10 / Form 137).</p>
            <p className="font-extrabold text-[hsl(var(--primary))] underline mt-3">This action is final and cannot be undone.</p>
          </div>
          <DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setFinalizeModalOpen(false)}
              disabled={finalizeLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
                "border border-gray-200 bg-white text-foreground",
                "hover:bg-gray-50 active:bg-gray-100",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleFinalizeGrade}
              disabled={finalizeLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                "hover:bg-[hsl(var(--primary)/0.9)]",
                "shadow-md",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              {finalizeLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                `Finalize & Lock ${targetScopeName}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PreFlightBlockerModal
        open={preFlightModalOpen}
        onOpenChange={setPreFlightModalOpen}
        unlockedClassesCount={scopedUnlockedClassesCount}
        irregularBlockerCount={scopedIrregularBlockerCount ?? 0}
        targetScopeName={targetScopeName}
      />

      <Dialog open={sf5WatermarkOpen} onOpenChange={setSf5WatermarkOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border border-gray-300 shadow-2xl">
          <DialogHeader className="p-4 border-b bg-gray-50 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-extrabold">School Form 5 (SF5) Preview</DialogTitle>
              <DialogDescription>Document generated with unsubmitted grades</DialogDescription>
            </div>
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-extrabold border border-red-200">
              UNFINALIZED
            </div>
          </DialogHeader>
          <div className="relative h-[600px] w-full bg-gray-100 p-8 flex items-center justify-center overflow-hidden">
            {/* The Document Paper */}
            <div className="relative bg-white w-full h-full shadow-lg border border-gray-200 p-8 flex flex-col justify-between">

              {/* WATERMARK OVERLAY */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                <div className="transform -rotate-45 text-[6rem] font-extrabold text-red-600/10 whitespace-nowrap select-none">
                  DRAFT COPY
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mt-48 overflow-hidden">
                <div className="transform -rotate-45 text-[2rem] font-extrabold text-red-600/10 whitespace-nowrap select-none">
                  PENDING ACADEMIC CLEARANCE
                </div>
              </div>

              {/* Fake Document Content */}
              <div>
                <h2 className="text-2xl font-serif text-center font-extrabold mb-8">School Form 5 (SF5)</h2>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between mt-16 pt-8 border-t border-gray-300">
                <div className="text-center w-1/3">
                  <div className="border-b border-black mb-2 h-8"></div>
                  <p className="text-xs font-extrabold">Class Adviser</p>
                </div>
                <div className="text-center w-1/3 relative">
                  {/* Blocked Signature Field */}
                  <div className="absolute inset-0 bg-red-100/80 backdrop-blur-sm flex items-center justify-center border-2 border-red-500 border-dashed z-40">
                    <span className="text-red-700 font-extrabold text-xs uppercase text-center leading-tight">Signature Blocked<br />(Pending Finalization)</span>
                  </div>
                  <div className="border-b border-black mb-2 h-8"></div>
                  <p className="text-xs font-extrabold">Official Registrar Signature</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-sm text-gray-500 italic">This copy cannot be officially distributed.</span>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setSf5WatermarkOpen(false)}>Close Preview</Button>
              <Button onClick={() => setSf5WatermarkOpen(false)} className="bg-primary hover:bg-primary/90 text-white font-extrabold">
                Download Draft PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EosyOverrideModal
        record={overrideRecord}
        onClose={() => setOverrideRecord(null)}
        onSuccess={() => {
          void fetchGradeRecords(activeTab);
          void fetchExportLockState();
        }}
      />

      <ConfirmationModal
        open={unlockModalOpen}
        onOpenChange={setUnlockModalOpen}
        title="Unlock Section Roster?"
        description={`Are you sure you want to unlock the section roster for ${sectionFilter}? This will revert control back to the Class Adviser.`}
        onConfirm={handleUnlockSection}
        confirmText="Unlock Section Roster"
        cancelText="Cancel"
        loading={unlockLoading}
        variant="warning"
        icon={Unlock}
      />
    </>
  );
}
