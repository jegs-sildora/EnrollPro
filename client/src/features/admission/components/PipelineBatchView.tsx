import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Search,
  Loader2,
  CheckSquare,
  Square,
  Save,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import {
  SCPAssessmentBlock,
  type SCPAssessmentApplicant,
} from "@/features/enrollment/components/SCPAssessmentBlock";
import type { AssessmentStep } from "@/features/enrollment/hooks/useApplicationDetail";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { format } from "date-fns";
import BatchResultsModal from "./BatchResultsModal";
import type { BatchResults } from "./BatchResultsModal";
import {
  ACTIVE_REGISTRATION_EXCLUDED_STATUSES,
  REGISTRATION_STAGE_QUICK_FILTERS,
  getRegistrationBatchActionByStatus,
  REGISTRATION_VALID_TRANSITIONS,
} from "@/features/admission/constants/registrationWorkflow";
import PipelineBatchScheduleForm from "./pipeline-batch/PipelineBatchScheduleForm";
import PipelineBatchVerifyGrid from "@/features/admission/components/pipeline-batch/PipelineBatchVerifyGrid";
import PipelineBatchAssessmentGrid from "./pipeline-batch/PipelineBatchAssessmentGrid";
import PipelineBatchFinalizeInterviewGrid from "./pipeline-batch/PipelineBatchFinalizeInterviewGrid";
import {
  DEFAULT_FINALIZE_INTERVIEW_ROW,
  type Application,
  type ChecklistFieldKey,
  type EarlyRegistrationAssessment,
  type EarlyRegistrationApiRow,
  type FinalizeInterviewRowState,
  type PipelineBatchViewProps,
  type RankingFormulaComponent,
  type ScheduleFormState,
  type ScoreRowState,
  type ScpProgramStepTemplate,
  type VerifyGridApplicant,
  type VerifyGridColumn,
} from "./pipeline-batch/types";

export default function PipelineBatchView({
  applicantType,
  cutoffScore,
  hasAssessment = false,
}: PipelineBatchViewProps) {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 50;

  const showAssessment = hasAssessment && status === "ASSESSMENT_SCHEDULED";

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Batch processing
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResults | null>(null);
  const [actionFormError, setActionFormError] = useState<string | null>(null);

  const [verifyGridLoading, setVerifyGridLoading] = useState(false);
  const [verifyGridColumns, setVerifyGridColumns] = useState<
    VerifyGridColumn[]
  >([]);
  const [verifyGridApplicants, setVerifyGridApplicants] = useState<
    VerifyGridApplicant[]
  >([]);
  const [verifyGridValues, setVerifyGridValues] = useState<
    Record<number, Record<ChecklistFieldKey, boolean>>
  >({});
  const [verifyRowsMarked, setVerifyRowsMarked] = useState<
    Record<number, boolean>
  >({});

  const [examScheduleForm, setExamScheduleForm] = useState<ScheduleFormState>({
    scheduledDate: "",
    scheduledTime: "",
    venue: "",
    notes: "",
  });
  const [interviewScheduleForm, setInterviewScheduleForm] =
    useState<ScheduleFormState>({
      scheduledDate: "",
      scheduledTime: "",
      venue: "",
      notes: "",
    });

  const [scoreComponents, setScoreComponents] = useState<
    RankingFormulaComponent[]
  >([]);
  const [scoreGridLoading, setScoreGridLoading] = useState(false);
  const [scoreGridRows, setScoreGridRows] = useState<
    Record<number, ScoreRowState>
  >({});

  const [finalizeInterviewRows, setFinalizeInterviewRows] = useState<
    Record<number, FinalizeInterviewRowState>
  >({});

  const [examScheduleDefaultsLoading, setExamScheduleDefaultsLoading] =
    useState(false);
  const [examScheduleStepTemplate, setExamScheduleStepTemplate] =
    useState<ScpProgramStepTemplate | null>(null);

  const [leftPaneWidthPercent, setLeftPaneWidthPercent] = useState(40);
  const [isResizingSplitPanes, setIsResizingSplitPanes] = useState(false);
  const splitPanesRef = useRef<HTMLDivElement | null>(null);

  // Assessment scores
  const [scores, setScores] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (status !== "ALL") params.append("status", status);
      params.append("schoolYearId", String(ayId));

      if (applicantType !== "ALL")
        params.append("applicantType", applicantType);
      params.append("page", String(page));
      params.append("limit", String(limit));

      const allStatusPromise = api.get(
        `/early-registrations?${params.toString()}`,
      );

      const excludedCountPromises =
        status === "ALL"
          ? ACTIVE_REGISTRATION_EXCLUDED_STATUSES.map((excludedStatus) => {
              const excludedParams = new URLSearchParams();
              if (search) excludedParams.append("search", search);
              excludedParams.append("schoolYearId", String(ayId));
              if (applicantType !== "ALL") {
                excludedParams.append("applicantType", applicantType);
              }
              excludedParams.append("status", excludedStatus);
              excludedParams.append("page", "1");
              excludedParams.append("limit", "1");

              return api.get(
                `/early-registrations?${excludedParams.toString()}`,
              );
            })
          : [];

      const [res, ...excludedResponses] = await Promise.all([
        allStatusPromise,
        ...excludedCountPromises,
      ]);

      let filteredApps = (res.data.data as EarlyRegistrationApiRow[]).map(
        (app) => ({
          ...app,
          firstName: app.learner?.firstName || app.firstName,
          lastName: app.learner?.lastName || app.lastName,
          middleName: app.learner?.middleName || app.middleName,
          suffix: app.learner?.extensionName || app.suffix,
          lrn: app.learner?.lrn || app.lrn,
        }),
      );
      if (status === "ALL") {
        filteredApps = filteredApps.filter(
          (app: Application) =>
            !ACTIVE_REGISTRATION_EXCLUDED_STATUSES.includes(
              app.status as (typeof ACTIVE_REGISTRATION_EXCLUDED_STATUSES)[number],
            ),
        );
      }

      const excludedTotals =
        status === "ALL"
          ? excludedResponses.reduce(
              (sum, response) =>
                sum + Number(response?.data?.pagination?.total ?? 0),
              0,
            )
          : 0;

      setApplications(filteredApps);
      setTotal(
        status === "ALL"
          ? Math.max(
              0,
              Number(res.data?.pagination?.total ?? 0) - excludedTotals,
            )
          : Number(res.data?.pagination?.total ?? 0),
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, applicantType, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, search, applicantType, page]);

  const selectedApplications = useMemo(
    () => applications.filter((app) => selectedIds.has(app.id)),
    [applications, selectedIds],
  );

  const selectedApplicationsById = useMemo(
    () =>
      selectedApplications.reduce<Record<number, Application>>((acc, app) => {
        acc[app.id] = app;
        return acc;
      }, {}),
    [selectedApplications],
  );

  const selectedStatuses = useMemo(
    () => Array.from(new Set(selectedApplications.map((app) => app.status))),
    [selectedApplications],
  );

  const selectedPrograms = useMemo(
    () =>
      Array.from(new Set(selectedApplications.map((app) => app.applicantType))),
    [selectedApplications],
  );

  const hasMixedSelectedStatuses = selectedStatuses.length > 1;
  const hasMixedSelectedPrograms = selectedPrograms.length > 1;
  const hasSelectionConflict =
    hasMixedSelectedStatuses || hasMixedSelectedPrograms;

  const selectionConflictMessage = useMemo(() => {
    if (hasMixedSelectedStatuses && hasMixedSelectedPrograms) {
      return "Batch actions require applicants to share both the same current status and the same program.";
    }

    if (hasMixedSelectedStatuses) {
      return "Batch actions require applicants to have the same current status.";
    }

    if (hasMixedSelectedPrograms) {
      return "Batch actions require applicants to have the same program.";
    }

    return null;
  }, [hasMixedSelectedPrograms, hasMixedSelectedStatuses]);

  const singleSelectedStatus =
    selectedStatuses.length === 1 ? selectedStatuses[0] : null;

  const normalizedSingleSelectedStatus =
    singleSelectedStatus === "EXAM_SCHEDULED"
      ? "ASSESSMENT_SCHEDULED"
      : singleSelectedStatus;

  const activeBatchAction = useMemo(
    () =>
      normalizedSingleSelectedStatus
        ? getRegistrationBatchActionByStatus(normalizedSingleSelectedStatus)
        : null,
    [normalizedSingleSelectedStatus],
  );

  const derivedTargetStatus = activeBatchAction?.targetStatus ?? "";

  const preflightSummary = useMemo(() => {
    if (!derivedTargetStatus || selectedApplications.length === 0) {
      return null;
    }

    const eligible: Application[] = [];
    const ineligible: Array<{ app: Application; reason: string }> = [];

    for (const app of selectedApplications) {
      const allowedTargets = REGISTRATION_VALID_TRANSITIONS[app.status] ?? [];
      if (!allowedTargets.includes(derivedTargetStatus)) {
        ineligible.push({
          app,
          reason: `${app.status.replaceAll("_", " ")} cannot move to ${derivedTargetStatus.replaceAll("_", " ")}.`,
        });
        continue;
      }

      eligible.push(app);
    }

    const reasonGroups = ineligible.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.reason] = (acc[item.reason] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      eligible,
      ineligible,
      reasonGroups,
    };
  }, [selectedApplications, derivedTargetStatus]);

  const scopedEligibleIds = useMemo(
    () => preflightSummary?.eligible.map((app) => app.id) ?? [],
    [preflightSummary],
  );

  const scopedEligibleIdSet = useMemo(
    () => new Set(scopedEligibleIds),
    [scopedEligibleIds],
  );

  const normalizeScoreToTwoDecimals = useCallback((value: number) => {
    return Number(value.toFixed(2));
  }, []);

  const parseRankingFormulaComponents = useCallback(
    (value: unknown): RankingFormulaComponent[] => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return [];
      }

      const maybeComponents = (
        value as { components?: Array<Record<string, unknown>> }
      ).components;
      if (!Array.isArray(maybeComponents)) return [];

      return maybeComponents
        .map((component) => {
          const key = String(component.key ?? "")
            .trim()
            .toUpperCase();
          const label = String(component.label ?? key).trim() || key;
          const weight = Number(component.weight ?? NaN);

          if (!key || !Number.isFinite(weight) || weight <= 0) return null;
          return { key, label, weight };
        })
        .filter((component): component is RankingFormulaComponent =>
          Boolean(component),
        );
    },
    [],
  );

  const computeWeightedTotal = useCallback(
    (row: ScoreRowState | undefined): number | null => {
      if (!row) return null;
      if (row.absentNoShow) return 0;

      if (scoreComponents.length === 0) return null;
      const totalWeight = scoreComponents.reduce(
        (sum, component) => sum + component.weight,
        0,
      );
      const useFractionalWeights = totalWeight <= 1.0001;

      let total = 0;
      let hasScore = false;

      for (const component of scoreComponents) {
        const rawScore = row.componentScores[component.key];
        const score = Number(rawScore);
        if (!Number.isFinite(score)) continue;

        hasScore = true;
        const weight = useFractionalWeights
          ? component.weight
          : component.weight / 100;
        total += score * weight;
      }

      if (!hasScore) return null;
      return normalizeScoreToTwoDecimals(total);
    },
    [normalizeScoreToTwoDecimals, scoreComponents],
  );

  const getVerifyRequiredCompletion = useCallback(
    (applicantId: number) => {
      const applicant = verifyGridApplicants.find(
        (item) => item.id === applicantId,
      );
      if (!applicant) return { done: 0, total: 0 };

      const total = applicant.requiredChecklistKeys.length;
      if (total === 0) return { done: 0, total: 0 };

      const values = verifyGridValues[applicantId] ?? applicant.checklist;
      const done = applicant.requiredChecklistKeys.reduce((count, key) => {
        return count + (values[key] ? 1 : 0);
      }, 0);

      return { done, total };
    },
    [verifyGridApplicants, verifyGridValues],
  );

  const isVerifyRowReady = useCallback(
    (applicantId: number) => {
      const { done, total } = getVerifyRequiredCompletion(applicantId);
      return total > 0 ? done === total : true;
    },
    [getVerifyRequiredCompletion],
  );

  const setVerifyRowMarked = useCallback(
    (applicantId: number, checked: boolean) => {
      setVerifyRowsMarked((prev) => ({
        ...prev,
        [applicantId]: checked,
      }));
    },
    [],
  );

  const isScoreValueInvalid = useCallback(
    (applicantId: number, key: string, value: string) => {
      const row = scoreGridRows[applicantId];
      if (row?.absentNoShow) return false;

      const normalized = value.trim();
      if (!normalized) return true;

      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) return true;
      if (parsed < 0 || parsed > 100) return true;

      const rounded = normalizeScoreToTwoDecimals(parsed);
      if (!Number.isFinite(rounded)) return true;

      return !scoreComponents.some((component) => component.key === key);
    },
    [normalizeScoreToTwoDecimals, scoreComponents, scoreGridRows],
  );

  const loadVerifyGridPreview = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setVerifyGridLoading(true);
    setActionFormError(null);

    try {
      const res = await api.post(
        "/early-registrations/batch/verify-documents/preview",
        {
          ids: Array.from(selectedIds),
        },
      );

      const columns = (res.data?.columns ?? []) as VerifyGridColumn[];
      const applicants = (res.data?.applicants ?? []) as VerifyGridApplicant[];

      setVerifyGridColumns(columns);
      setVerifyGridApplicants(applicants);
      setVerifyGridValues(
        applicants.reduce<Record<number, Record<ChecklistFieldKey, boolean>>>(
          (acc, applicant) => {
            acc[applicant.id] = applicant.checklist;
            return acc;
          },
          {},
        ),
      );
      setVerifyRowsMarked(
        applicants.reduce<Record<number, boolean>>((acc, applicant) => {
          acc[applicant.id] = false;
          return acc;
        }, {}),
      );

      const missingIds = (res.data?.missingIds ?? []) as number[];
      if (missingIds.length > 0) {
        setActionFormError(
          `${missingIds.length} selected applicant(s) were not found and will be skipped.`,
        );
      }
    } catch (err) {
      toastApiError(err as never);
      setVerifyGridColumns([]);
      setVerifyGridApplicants([]);
      setVerifyGridValues({});
      setVerifyRowsMarked({});
    } finally {
      setVerifyGridLoading(false);
    }
  }, [selectedIds]);

  const initializeScoreGrid = useCallback(async () => {
    const defaultComponents: RankingFormulaComponent[] = [
      { key: "EXAM", label: "Exam Score", weight: 100 },
    ];

    setScoreGridLoading(true);
    setActionFormError(null);

    try {
      let resolvedComponents = defaultComponents;

      if (ayId && applicantType !== "REGULAR") {
        const res = await api.get(`/curriculum/${ayId}/scp-config`);
        const configs = (res.data?.scpProgramConfigs ?? []) as Array<{
          scpType: string;
          rankingFormula?: unknown;
        }>;

        const config = configs.find((entry) => entry.scpType === applicantType);
        const parsed = parseRankingFormulaComponents(config?.rankingFormula);
        if (parsed.length > 0) {
          resolvedComponents = parsed;
        }
      }

      setScoreComponents(resolvedComponents);
      setScoreGridRows(
        selectedApplications.reduce<Record<number, ScoreRowState>>(
          (acc, applicant) => {
            acc[applicant.id] = {
              componentScores: resolvedComponents.reduce<
                Record<string, string>
              >((scoresAcc, component) => {
                scoresAcc[component.key] = "";
                return scoresAcc;
              }, {}),
              remarks: "",
              absentNoShow: false,
            };
            return acc;
          },
          {},
        ),
      );
    } catch (err) {
      toastApiError(err as never);
      setScoreComponents(defaultComponents);
      setScoreGridRows({});
    } finally {
      setScoreGridLoading(false);
    }
  }, [
    ayId,
    applicantType,
    parseRankingFormulaComponents,
    selectedApplications,
  ]);

  const loadExamScheduleDefaults = useCallback(async () => {
    if (!ayId || applicantType === "REGULAR") {
      setExamScheduleStepTemplate(null);
      return;
    }

    setExamScheduleDefaultsLoading(true);
    try {
      const res = await api.get(`/curriculum/${ayId}/scp-config`);
      const configs = (res.data?.scpProgramConfigs ?? []) as Array<{
        scpType: string;
        steps?: ScpProgramStepTemplate[];
      }>;

      const matchingConfig = configs.find(
        (entry) => entry.scpType === applicantType,
      );

      const examCandidates = [...(matchingConfig?.steps ?? [])]
        .filter((step) => String(step.kind).toUpperCase() !== "INTERVIEW")
        .sort((a, b) => Number(a.stepOrder) - Number(b.stepOrder));

      const examStep =
        examCandidates.find((step) => step.isRequired) ??
        examCandidates[0] ??
        null;

      if (!examStep) {
        setExamScheduleStepTemplate(null);
        return;
      }

      setExamScheduleStepTemplate(examStep);

      const normalizedDate = examStep.scheduledDate
        ? format(new Date(examStep.scheduledDate), "yyyy-MM-dd")
        : "";

      setExamScheduleForm((prev) => ({
        scheduledDate: prev.scheduledDate || normalizedDate,
        scheduledTime: prev.scheduledTime || examStep.scheduledTime || "",
        venue: prev.venue || examStep.venue || "",
        notes: prev.notes || examStep.notes || "",
      }));
    } catch (err) {
      toastApiError(err as never);
      setExamScheduleStepTemplate(null);
    } finally {
      setExamScheduleDefaultsLoading(false);
    }
  }, [ayId, applicantType]);

  const initializeFinalizeRows = useCallback(() => {
    setFinalizeInterviewRows(
      selectedApplications.reduce<Record<number, FinalizeInterviewRowState>>(
        (acc, applicant) => {
          acc[applicant.id] = { ...DEFAULT_FINALIZE_INTERVIEW_ROW };
          return acc;
        },
        {},
      ),
    );
  }, [selectedApplications]);

  useEffect(() => {
    if (!isActionModalOpen || !activeBatchAction) return;

    if (activeBatchAction.id === "VERIFY_DOCUMENTS") {
      void loadVerifyGridPreview();
      return;
    }

    if (activeBatchAction.id === "SCHEDULE_EXAM") {
      void loadExamScheduleDefaults();
      return;
    }

    if (activeBatchAction.id === "RECORD_ASSESSMENT") {
      void initializeScoreGrid();
      return;
    }

    if (activeBatchAction.id === "FINALIZE_PHASE_ONE") {
      initializeFinalizeRows();
      return;
    }

    setActionFormError(null);
  }, [
    isActionModalOpen,
    activeBatchAction,
    loadVerifyGridPreview,
    loadExamScheduleDefaults,
    initializeScoreGrid,
    initializeFinalizeRows,
  ]);

  const clampSplitPaneWidth = useCallback(
    (value: number) => Math.min(75, Math.max(25, value)),
    [],
  );

  const magnetizeSplitPaneWidth = useCallback((value: number) => {
    const snapPoints = [40, 50, 60];
    const threshold = 1.8;
    for (const snapPoint of snapPoints) {
      if (Math.abs(value - snapPoint) <= threshold) {
        return snapPoint;
      }
    }
    return value;
  }, []);

  const handleSplitPaneResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsResizingSplitPanes(true);
    },
    [],
  );

  useEffect(() => {
    if (!isResizingSplitPanes) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = splitPanesRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const rawWidthPercent = ((event.clientX - rect.left) / rect.width) * 100;
      const nextWidthPercent = magnetizeSplitPaneWidth(
        clampSplitPaneWidth(rawWidthPercent),
      );

      setLeftPaneWidthPercent(nextWidthPercent);
    };

    const handleMouseUp = () => {
      setIsResizingSplitPanes(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSplitPanes, clampSplitPaneWidth, magnetizeSplitPaneWidth]);

  const setVerifyCell = (
    applicantId: number,
    key: ChecklistFieldKey,
    value: boolean,
  ) => {
    setVerifyGridValues((prev) => {
      const next = {
        ...prev,
        [applicantId]: {
          ...(prev[applicantId] ?? {}),
          [key]: value,
        },
      };

      setVerifyRowsMarked((prevMarked) => {
        const applicant = verifyGridApplicants.find(
          (entry) => entry.id === applicantId,
        );
        if (!applicant) return prevMarked;

        const isReady = applicant.requiredChecklistKeys.every((requiredKey) =>
          Boolean(next[applicantId]?.[requiredKey]),
        );

        if (isReady || !prevMarked[applicantId]) {
          return prevMarked;
        }

        return {
          ...prevMarked,
          [applicantId]: false,
        };
      });

      return next;
    });
  };

  const setVerifyColumnForAll = (key: ChecklistFieldKey, value: boolean) => {
    setVerifyGridValues((prev) => {
      const next = { ...prev };
      for (const applicant of verifyGridApplicants) {
        next[applicant.id] = {
          ...(next[applicant.id] ?? {}),
          [key]: value,
        };
      }

      setVerifyRowsMarked((prevMarked) => {
        let changed = false;
        const nextMarked = { ...prevMarked };

        for (const applicant of verifyGridApplicants) {
          const isReady = applicant.requiredChecklistKeys.every((requiredKey) =>
            Boolean(next[applicant.id]?.[requiredKey]),
          );

          if (!isReady && nextMarked[applicant.id]) {
            nextMarked[applicant.id] = false;
            changed = true;
          }
        }

        return changed ? nextMarked : prevMarked;
      });

      return next;
    });
  };

  const setVerifyAll = (value: boolean) => {
    setVerifyGridValues((prev) => {
      const next = { ...prev };
      for (const applicant of verifyGridApplicants) {
        next[applicant.id] = verifyGridColumns.reduce<
          Record<ChecklistFieldKey, boolean>
        >(
          (acc, column) => {
            acc[column.key] = value;
            return acc;
          },
          { ...(next[applicant.id] ?? applicant.checklist) },
        );
      }

      setVerifyRowsMarked((prevMarked) => {
        let changed = false;
        const nextMarked = { ...prevMarked };

        for (const applicant of verifyGridApplicants) {
          const isReady = applicant.requiredChecklistKeys.every((requiredKey) =>
            Boolean(next[applicant.id]?.[requiredKey]),
          );

          if (!isReady && nextMarked[applicant.id]) {
            nextMarked[applicant.id] = false;
            changed = true;
          }
        }

        return changed ? nextMarked : prevMarked;
      });

      return next;
    });
  };

  const verifyAllChecked = useMemo(() => {
    if (verifyGridApplicants.length === 0 || verifyGridColumns.length === 0) {
      return false;
    }

    return verifyGridApplicants.every((applicant) =>
      verifyGridColumns.every((column) =>
        Boolean(verifyGridValues[applicant.id]?.[column.key]),
      ),
    );
  }, [verifyGridApplicants, verifyGridColumns, verifyGridValues]);

  const isVerifyColumnFullyChecked = (key: ChecklistFieldKey) =>
    verifyGridApplicants.length > 0 &&
    verifyGridApplicants.every((applicant) =>
      Boolean(verifyGridValues[applicant.id]?.[key]),
    );

  const updateScoreCell = (applicantId: number, key: string, value: string) => {
    setScoreGridRows((prev) => ({
      ...prev,
      [applicantId]: {
        ...(prev[applicantId] ?? {
          componentScores: {},
          remarks: "",
          absentNoShow: false,
        }),
        componentScores: {
          ...(prev[applicantId]?.componentScores ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const updateScoreRemarks = (applicantId: number, value: string) => {
    setScoreGridRows((prev) => ({
      ...prev,
      [applicantId]: {
        ...(prev[applicantId] ?? {
          componentScores: {},
          remarks: "",
          absentNoShow: false,
        }),
        remarks: value,
      },
    }));
  };

  const setAbsentNoShow = (applicantId: number, value: boolean) => {
    setScoreGridRows((prev) => {
      const existing =
        prev[applicantId] ??
        ({
          componentScores: {},
          remarks: "",
          absentNoShow: false,
        } as ScoreRowState);

      if (value) {
        const zeroedScores = scoreComponents.reduce<Record<string, string>>(
          (acc, component) => {
            acc[component.key] = "0.00";
            return acc;
          },
          { ...existing.componentScores },
        );

        return {
          ...prev,
          [applicantId]: {
            ...existing,
            absentNoShow: true,
            componentScores: zeroedScores,
            remarks: existing.remarks || "Marked absent / no-show.",
          },
        };
      }

      return {
        ...prev,
        [applicantId]: {
          ...existing,
          absentNoShow: false,
        },
      };
    });
  };

  const updateFinalizeRow = (
    applicantId: number,
    patch: Partial<FinalizeInterviewRowState>,
  ) => {
    setFinalizeInterviewRows((prev) => ({
      ...prev,
      [applicantId]: {
        ...(prev[applicantId] ?? { ...DEFAULT_FINALIZE_INTERVIEW_ROW }),
        ...patch,
      },
    }));
  };

  const resolveScoreComponentKeyForStep = useCallback(
    (kind: string): string | null => {
      if (!kind.trim() || scoreComponents.length === 0) return null;

      const normalizedKind = kind.trim().toUpperCase();
      const directMatch = scoreComponents.find(
        (component) => component.key === normalizedKind,
      );
      if (directMatch) return directMatch.key;

      if (scoreComponents.length === 1) {
        return scoreComponents[0].key;
      }

      const examCandidates = scoreComponents.filter((component) =>
        component.key.includes("EXAM"),
      );
      if (normalizedKind.includes("EXAM") && examCandidates.length === 1) {
        return examCandidates[0].key;
      }

      if (normalizedKind === "INTERVIEW") {
        const interviewMatch = scoreComponents.find(
          (component) => component.key === "INTERVIEW",
        );
        if (interviewMatch) return interviewMatch.key;
      }

      return null;
    },
    [scoreComponents],
  );

  const stageAssessmentFromScpBlock = useCallback(
    async (
      applicantId: number,
      _stepOrder: number,
      kind: string,
      score: number,
      stepCutoffScore: number | null,
    ) => {
      const componentKey = resolveScoreComponentKeyForStep(kind);
      if (!componentKey) {
        setActionFormError(
          `Unable to map ${kind.replaceAll("_", " ")} to a score component. Please encode this applicant in the score grid on the right.`,
        );
        return;
      }

      setActionFormError(null);
      setScoreGridRows((prev) => {
        const fallbackComponentScores = scoreComponents.reduce<
          Record<string, string>
        >((acc, component) => {
          acc[component.key] = "";
          return acc;
        }, {});

        const existing = prev[applicantId] ?? {
          componentScores: fallbackComponentScores,
          remarks: "",
          absentNoShow: false,
        };

        const passFailLabel =
          stepCutoffScore == null
            ? ""
            : score >= stepCutoffScore
              ? "PASSED"
              : "FAILED";

        return {
          ...prev,
          [applicantId]: {
            ...existing,
            absentNoShow: false,
            componentScores: {
              ...existing.componentScores,
              [componentKey]: normalizeScoreToTwoDecimals(score).toFixed(2),
            },
            remarks:
              existing.remarks ||
              `Staged from SCP block (${kind.replaceAll("_", " ")}${
                passFailLabel ? `: ${passFailLabel}` : ""
              }).`,
          },
        };
      });
    },
    [
      normalizeScoreToTwoDecimals,
      resolveScoreComponentKeyForStep,
      scoreComponents,
    ],
  );

  const stageInterviewDecisionFromScpBlock = useCallback(
    async (applicantId: number, passed: boolean) => {
      setActionFormError(null);
      setFinalizeInterviewRows((prev) => {
        const existing = prev[applicantId] ?? {
          ...DEFAULT_FINALIZE_INTERVIEW_ROW,
        };

        return {
          ...prev,
          [applicantId]: {
            ...existing,
            decision: passed ? "PASS" : "REJECT",
            rejectOutcome: passed
              ? "NOT_QUALIFIED"
              : existing.rejectOutcome || "NOT_QUALIFIED",
          },
        };
      });
    },
    [],
  );

  const isAssessmentRowPrepared = useCallback(
    (applicantId: number) => {
      if (scoreComponents.length === 0) return false;

      const row = scoreGridRows[applicantId];
      if (!row) return false;

      if (row.absentNoShow) return true;

      const hasAllComponentScores = scoreComponents.every((component) => {
        const rawValue = row.componentScores[component.key] ?? "";
        if (isScoreValueInvalid(applicantId, component.key, rawValue)) {
          return false;
        }

        const parsed = Number(rawValue);
        return parsed >= 0 && parsed <= 100;
      });
      if (!hasAllComponentScores) return false;

      return Number.isFinite(computeWeightedTotal(row) ?? NaN);
    },
    [computeWeightedTotal, isScoreValueInvalid, scoreComponents, scoreGridRows],
  );

  const isFinalizeRowPrepared = useCallback(
    (applicantId: number) => {
      const row = finalizeInterviewRows[applicantId];
      if (!row) return false;

      if (row.decision === "REJECT" && !row.rejectOutcome) return false;

      if (row.interviewScore.trim()) {
        return Number.isFinite(Number(row.interviewScore));
      }

      return true;
    },
    [finalizeInterviewRows],
  );

  const getScpPreviewStagedState = useCallback(
    (applicantId: number) => {
      if (activeBatchAction?.id === "RECORD_ASSESSMENT") {
        return isAssessmentRowPrepared(applicantId);
      }

      if (activeBatchAction?.id === "FINALIZE_PHASE_ONE") {
        return isFinalizeRowPrepared(applicantId);
      }

      return false;
    },
    [activeBatchAction?.id, isAssessmentRowPrepared, isFinalizeRowPrepared],
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map((a) => a.id)));
    }
  };

  const selectCurrentPage = () => {
    setSelectedIds(new Set(applications.map((app) => app.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const invertCurrentPageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const app of applications) {
        if (next.has(app.id)) {
          next.delete(app.id);
        } else {
          next.add(app.id);
        }
      }
      return next;
    });
  };

  const handleBatchProcess = () => {
    if (
      selectedIds.size === 0 ||
      !derivedTargetStatus ||
      hasSelectionConflict ||
      !activeBatchAction
    )
      return;
    setActionFormError(null);
    setIsActionModalOpen(true);
  };

  const handleConfirmBatchProcess = async () => {
    if (!activeBatchAction) return;

    const eligibleIds = scopedEligibleIds;
    const skippedAsFailed = (preflightSummary?.ineligible ?? []).map(
      (item) => ({
        id: item.app.id,
        name: `${item.app.lastName}, ${item.app.firstName}`,
        trackingNumber: item.app.trackingNumber,
        reason: item.reason,
      }),
    );

    if (eligibleIds.length === 0) {
      setBatchResults({
        processed: selectedIds.size,
        succeeded: [],
        failed: skippedAsFailed,
      });
      setIsActionModalOpen(false);
      return;
    }

    if (!isActionFormReady) {
      setActionFormError(
        actionReadinessHint ??
          "Complete all required fields before running this batch action.",
      );
      return;
    }

    setActionFormError(null);
    setIsBatchProcessing(true);

    try {
      let responseData: {
        succeeded?: BatchResults["succeeded"];
        failed?: BatchResults["failed"];
      } | null = null;
      let skippedClientSide: BatchResults["failed"] = [];

      const expectedStatuses = buildExpectedStatuses(eligibleIds);

      if (activeBatchAction.id === "VERIFY_DOCUMENTS") {
        const eligibleVerifyApplicants = verifyGridApplicants.filter(
          (applicant) => eligibleIds.includes(applicant.id),
        );

        const markedReadyApplicants = eligibleVerifyApplicants.filter(
          (applicant) =>
            Boolean(verifyRowsMarked[applicant.id]) &&
            isVerifyRowReady(applicant.id),
        );

        skippedClientSide = eligibleVerifyApplicants
          .filter((applicant) => !Boolean(verifyRowsMarked[applicant.id]))
          .map((applicant) => ({
            id: applicant.id,
            name: applicant.name,
            trackingNumber: applicant.trackingNumber,
            reason:
              "Not marked as verified in the checklist table. Skipped by batch submit.",
          }));

        skippedClientSide = [
          ...skippedClientSide,
          ...eligibleVerifyApplicants
            .filter(
              (applicant) =>
                Boolean(verifyRowsMarked[applicant.id]) &&
                !isVerifyRowReady(applicant.id),
            )
            .map((applicant) => ({
              id: applicant.id,
              name: applicant.name,
              trackingNumber: applicant.trackingNumber,
              reason:
                "Required checklist items are incomplete. Skipped by batch submit.",
            })),
        ];

        const applicantsPayload = markedReadyApplicants.map((applicant) => ({
          id: applicant.id,
          checklist: verifyGridValues[applicant.id] ?? applicant.checklist,
        }));

        if (applicantsPayload.length === 0) {
          setActionFormError(
            "Mark at least one fully-complete row as verified before submitting.",
          );
          return;
        }

        const verifyExpectedStatuses = buildExpectedStatuses(
          applicantsPayload.map((item) => item.id),
        );

        const res = await api.patch(
          "/early-registrations/batch/verify-documents",
          {
            applicants: applicantsPayload,
            expectedStatuses: verifyExpectedStatuses,
          },
        );
        responseData = res.data;
      } else if (activeBatchAction.id === "SCHEDULE_EXAM") {
        if (
          !examScheduleForm.scheduledDate ||
          !examScheduleForm.scheduledTime ||
          !examScheduleForm.venue.trim()
        ) {
          setActionFormError(
            "Scheduled date, scheduled time, and venue are required for exam scheduling.",
          );
          return;
        }

        const res = await api.patch(
          "/early-registrations/batch/schedule-step",
          {
            ids: eligibleIds,
            expectedStatuses,
            mode: "EXAM",
            scheduledDate: examScheduleForm.scheduledDate,
            scheduledTime: examScheduleForm.scheduledTime,
            venue: examScheduleForm.venue,
            notes: examScheduleForm.notes || null,
            sendEmail: true,
          },
        );
        responseData = res.data;
      } else if (activeBatchAction.id === "RECORD_ASSESSMENT") {
        const rowsPayload = eligibleIds.map((id) => {
          const rowState = scoreGridRows[id];
          const app = selectedApplicationsById[id];
          if (!rowState) {
            throw new Error(`Missing score row for applicant #${id}.`);
          }

          if (rowState.absentNoShow) {
            const absentComponentScores = scoreComponents.reduce<
              Record<string, number>
            >((acc, component) => {
              acc[component.key] = 0;
              return acc;
            }, {});

            const absentRemarks = [
              rowState.remarks?.trim(),
              "Marked absent / no-show.",
            ]
              .filter(Boolean)
              .join(" ");

            return {
              id,
              componentScores: absentComponentScores,
              totalScore: 0,
              absentNoShow: true,
              remarks: absentRemarks || null,
            };
          }

          const normalizedScores = scoreComponents.reduce<
            Record<string, number>
          >((acc, component) => {
            const value = rowState.componentScores[component.key];
            const numericScore = Number(value);
            if (!Number.isFinite(numericScore)) {
              throw new Error(
                `Enter a valid ${component.label} score for ${app?.lastName ?? "the selected applicant"}.`,
              );
            }

            if (numericScore < 0 || numericScore > 100) {
              throw new Error(
                `${component.label} must be between 0 and 100 for ${app?.lastName ?? "the selected applicant"}.`,
              );
            }

            acc[component.key] = normalizeScoreToTwoDecimals(numericScore);
            return acc;
          }, {});

          const totalScore = computeWeightedTotal(rowState);
          if (!Number.isFinite(totalScore ?? NaN)) {
            throw new Error(
              `Unable to compute weighted total for ${app?.lastName ?? "the selected applicant"}.`,
            );
          }

          return {
            id,
            componentScores: normalizedScores,
            totalScore: normalizeScoreToTwoDecimals(totalScore as number),
            absentNoShow: false,
            remarks: rowState.remarks || null,
          };
        });

        const res = await api.patch("/early-registrations/batch/save-scores", {
          rows: rowsPayload,
          expectedStatuses,
        });
        responseData = res.data;
      } else if (activeBatchAction.id === "SCHEDULE_INTERVIEW") {
        if (
          !interviewScheduleForm.scheduledDate ||
          !interviewScheduleForm.scheduledTime ||
          !interviewScheduleForm.venue.trim()
        ) {
          setActionFormError(
            "Scheduled date, scheduled time, and venue are required for interview scheduling.",
          );
          return;
        }

        const res = await api.patch(
          "/early-registrations/batch/schedule-step",
          {
            ids: eligibleIds,
            expectedStatuses,
            mode: "INTERVIEW",
            scheduledDate: interviewScheduleForm.scheduledDate,
            scheduledTime: interviewScheduleForm.scheduledTime,
            venue: interviewScheduleForm.venue,
            notes: interviewScheduleForm.notes || null,
            sendEmail: true,
          },
        );
        responseData = res.data;
      } else if (activeBatchAction.id === "FINALIZE_PHASE_ONE") {
        const rowsPayload = eligibleIds.map((id) => {
          const row = finalizeInterviewRows[id];
          if (!row) {
            throw new Error(
              `Missing interview decision row for applicant #${id}.`,
            );
          }

          const interviewScore = row.interviewScore.trim()
            ? Number(row.interviewScore)
            : null;

          if (interviewScore != null && !Number.isFinite(interviewScore)) {
            throw new Error("Interview score must be numeric when provided.");
          }

          if (row.decision === "REJECT" && !row.rejectOutcome) {
            throw new Error("Select a reject outcome for rejected applicants.");
          }

          return {
            id,
            decision: row.decision,
            rejectOutcome:
              row.decision === "REJECT" ? row.rejectOutcome : undefined,
            interviewScore,
            remarks: row.remarks || null,
          };
        });

        const res = await api.patch(
          "/early-registrations/batch/finalize-interview",
          {
            rows: rowsPayload,
            expectedStatuses,
          },
        );
        responseData = res.data;
      }

      if (!responseData) return;

      const failed = [
        ...skippedAsFailed,
        ...skippedClientSide,
        ...(responseData.failed ?? []),
      ];
      setBatchResults({
        processed: selectedIds.size,
        succeeded: responseData.succeeded ?? [],
        failed,
      });

      setSelectedIds(new Set(failed.map((item) => item.id)));
      setIsActionModalOpen(false);
    } catch (err) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (
          err as {
            response?: {
              status?: number;
              data?: {
                message?: string;
              };
            };
          }
        ).response;

        if (response?.status === 409) {
          setActionFormError(
            response.data?.message ??
              "Some selected applicants changed state while this dialog was open. Reload data and retry.",
          );
          return;
        }

        toastApiError(err as never);
        return;
      }

      if (err instanceof Error) {
        setActionFormError(err.message);
      } else {
        toastApiError(err as never);
      }
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleResultsClose = () => {
    setBatchResults(null);
    fetchData();
  };

  const handleSaveResult = async (appId: number) => {
    const raw = scores[appId];
    if (!raw || isNaN(Number(raw))) return;

    const score = Number(raw);
    setSavingId(appId);
    try {
      await api.patch(`/early-registrations/${appId}/record-step-result`, {
        stepOrder: 1,
        score,
        notes: "Recorded from Registration Pipelines",
      });

      sileo.success({
        title: "Result Recorded",
        description: "Assessment result saved.",
      });
      setScores((prev) => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingId(null);
    }
  };

  const getRemarkByScore = (appId: number): string => {
    const raw = scores[appId];
    if (
      raw == null ||
      raw.trim() === "" ||
      isNaN(Number(raw)) ||
      cutoffScore == null
    ) {
      return "---";
    }

    return Number(raw) >= cutoffScore ? "PASSED" : "FAILED";
  };

  const allSelected =
    applications.length > 0 && selectedIds.size === applications.length;

  const stageCounts = REGISTRATION_STAGE_QUICK_FILTERS.reduce<
    Record<string, number>
  >((acc, stage) => {
    acc[stage.value] =
      stage.value === "ALL"
        ? applications.length
        : applications.filter((app) => app.status === stage.value).length;
    return acc;
  }, {});

  const contextualActionLabel = useMemo(() => {
    if (selectedIds.size === 0) return "Select Applicants";
    if (hasSelectionConflict) return "Batch Action Unavailable";
    if (!activeBatchAction && singleSelectedStatus) {
      return `No Batch Action for ${singleSelectedStatus.replaceAll("_", " ")}`;
    }
    if (!activeBatchAction) return "No Batch Action";
    return `${activeBatchAction.buttonLabel} (${selectedIds.size})`;
  }, [
    selectedIds.size,
    hasSelectionConflict,
    activeBatchAction,
    singleSelectedStatus,
  ]);

  const getContextualActionIcon = () => {
    if (!activeBatchAction) {
      return <AlertTriangle className="size-4 mr-1.5" />;
    }

    switch (activeBatchAction.id) {
      case "VERIFY_DOCUMENTS":
        return <CheckSquare className="size-4 mr-1.5" />;
      case "SCHEDULE_EXAM":
        return <RefreshCw className="size-4 mr-1.5" />;
      case "RECORD_ASSESSMENT":
        return <Save className="size-4 mr-1.5" />;
      case "SCHEDULE_INTERVIEW":
        return <RefreshCw className="size-4 mr-1.5" />;
      case "FINALIZE_PHASE_ONE":
        return <CheckSquare className="size-4 mr-1.5" />;
      default:
        return <AlertTriangle className="size-4 mr-1.5" />;
    }
  };

  const isContextualActionDisabled =
    selectedIds.size === 0 ||
    hasSelectionConflict ||
    !activeBatchAction ||
    isBatchProcessing ||
    (preflightSummary?.eligible.length ?? 0) === 0;

  const verifyEligibleApplicants = useMemo(
    () => verifyGridApplicants.filter((app) => scopedEligibleIdSet.has(app.id)),
    [scopedEligibleIdSet, verifyGridApplicants],
  );

  const verifyMarkedReadyApplicantIds = useMemo(
    () =>
      verifyEligibleApplicants
        .filter(
          (applicant) =>
            Boolean(verifyRowsMarked[applicant.id]) &&
            isVerifyRowReady(applicant.id),
        )
        .map((applicant) => applicant.id),
    [isVerifyRowReady, verifyEligibleApplicants, verifyRowsMarked],
  );

  const buildExpectedStatuses = useCallback(
    (ids: number[]) =>
      ids.reduce<Record<string, string>>((acc, id) => {
        const app = selectedApplicationsById[id];
        if (app) {
          acc[String(id)] =
            app.status === "EXAM_SCHEDULED"
              ? "ASSESSMENT_SCHEDULED"
              : app.status;
        }
        return acc;
      }, {}),
    [selectedApplicationsById],
  );

  const isActionFormReady = useMemo(() => {
    if (!activeBatchAction) return false;

    switch (activeBatchAction.id) {
      case "VERIFY_DOCUMENTS":
        return verifyMarkedReadyApplicantIds.length > 0;
      case "SCHEDULE_EXAM":
        return Boolean(
          examScheduleForm.scheduledDate &&
          examScheduleForm.scheduledTime &&
          examScheduleForm.venue.trim(),
        );
      case "RECORD_ASSESSMENT":
        return (
          scopedEligibleIds.length > 0 &&
          scopedEligibleIds.every((id) => isAssessmentRowPrepared(id))
        );
      case "SCHEDULE_INTERVIEW":
        return Boolean(
          interviewScheduleForm.scheduledDate &&
          interviewScheduleForm.scheduledTime &&
          interviewScheduleForm.venue.trim(),
        );
      case "FINALIZE_PHASE_ONE":
        return (
          scopedEligibleIds.length > 0 &&
          scopedEligibleIds.every((id) => isFinalizeRowPrepared(id))
        );
      default:
        return true;
    }
  }, [
    activeBatchAction,
    examScheduleForm.scheduledDate,
    examScheduleForm.scheduledTime,
    examScheduleForm.venue,
    interviewScheduleForm.scheduledDate,
    interviewScheduleForm.scheduledTime,
    interviewScheduleForm.venue,
    isAssessmentRowPrepared,
    isFinalizeRowPrepared,
    scopedEligibleIds,
    verifyMarkedReadyApplicantIds,
  ]);

  const actionSubmitCount = useMemo(() => {
    if (!activeBatchAction) return 0;

    if (activeBatchAction.id === "VERIFY_DOCUMENTS") {
      return verifyMarkedReadyApplicantIds.length;
    }

    return scopedEligibleIds.length;
  }, [activeBatchAction, scopedEligibleIds, verifyMarkedReadyApplicantIds]);

  const actionReadinessHint = useMemo(() => {
    if (!activeBatchAction || isActionFormReady) return null;

    switch (activeBatchAction.id) {
      case "VERIFY_DOCUMENTS":
        return "Mark at least one row as verified after completing required checklist items.";
      case "SCHEDULE_EXAM":
        return "Scheduled date, time, and venue are required.";
      case "RECORD_ASSESSMENT":
        return "Each eligible row must either be marked absent/no-show or contain valid scores (0-100).";
      case "SCHEDULE_INTERVIEW":
        return "Scheduled date, time, and venue are required.";
      case "FINALIZE_PHASE_ONE":
        return "Complete interview decision requirements for all eligible rows.";
      default:
        return "Review all required fields before submitting.";
    }
  }, [activeBatchAction, isActionFormReady]);

  const shouldShowScpAssessmentPreview =
    applicantType !== "REGULAR" &&
    Boolean(
      activeBatchAction &&
      (activeBatchAction.id === "RECORD_ASSESSMENT" ||
        activeBatchAction.id === "SCHEDULE_INTERVIEW" ||
        activeBatchAction.id === "FINALIZE_PHASE_ONE"),
    );

  const mapAssessmentsToSteps = useCallback(
    (assessments: EarlyRegistrationAssessment[]): AssessmentStep[] => {
      if (!Array.isArray(assessments) || assessments.length === 0) return [];

      const toSortableValue = (value: string | null | undefined) => {
        if (!value) return Number.POSITIVE_INFINITY;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
      };

      const sortedAssessments = [...assessments].sort((a, b) => {
        const scheduledDiff =
          toSortableValue(a.scheduledDate ?? a.createdAt) -
          toSortableValue(b.scheduledDate ?? b.createdAt);
        if (scheduledDiff !== 0) return scheduledDiff;
        return a.id - b.id;
      });

      return sortedAssessments.map((assessment, index) => {
        const hasRecordedResult =
          assessment.result != null ||
          assessment.score != null ||
          assessment.conductedAt != null;
        const hasSchedule =
          assessment.scheduledDate != null ||
          assessment.scheduledTime != null ||
          assessment.venue != null;

        const statusValue: AssessmentStep["status"] = hasRecordedResult
          ? "COMPLETED"
          : hasSchedule
            ? "SCHEDULED"
            : "PENDING";

        return {
          stepOrder: index + 1,
          kind: assessment.type,
          label: "",
          description: null,
          isRequired: true,
          configDate: null,
          configTime: null,
          configVenue: null,
          configNotes: null,
          cutoffScore: cutoffScore ?? null,
          assessmentId: assessment.id,
          scheduledDate: assessment.scheduledDate,
          scheduledTime: assessment.scheduledTime,
          venue: assessment.venue,
          score: assessment.score,
          result: assessment.result,
          notes: assessment.notes,
          conductedAt: assessment.conductedAt,
          status: statusValue,
        };
      });
    },
    [cutoffScore],
  );

  const buildScpApplicant = useCallback(
    (app: Application): SCPAssessmentApplicant => ({
      applicantType: app.applicantType,
      status: app.status,
      assessmentType: app.assessmentType,
      examDate: app.examDate,
      examVenue: app.examVenue,
      examScore: app.examScore,
      examResult: app.examResult,
      examNotes: app.examNotes,
      assessmentSteps: mapAssessmentsToSteps(app.assessments ?? []),
    }),
    [mapAssessmentsToSteps],
  );

  const scpBatchPreviewRows = useMemo(() => {
    if (!shouldShowScpAssessmentPreview) return [];

    return selectedApplications.slice(0, 8).map((app) => {
      const previewApplicant = buildScpApplicant(app);

      return {
        id: app.id,
        name: `${app.lastName}, ${app.firstName}`,
        trackingNumber: app.trackingNumber,
        status: app.status,
        applicant: previewApplicant,
      };
    });
  }, [buildScpApplicant, selectedApplications, shouldShowScpAssessmentPreview]);

  const scpPreviewOverflowCount =
    shouldShowScpAssessmentPreview &&
    selectedApplications.length > scpBatchPreviewRows.length
      ? selectedApplications.length - scpBatchPreviewRows.length
      : 0;

  const renderScpActionBlocksForm = () => {
    const isScoreAction = activeBatchAction?.id === "RECORD_ASSESSMENT";
    const isInterviewAction = activeBatchAction?.id === "FINALIZE_PHASE_ONE";

    const stagedCount = selectedApplications.filter((app) =>
      isScoreAction
        ? isAssessmentRowPrepared(app.id)
        : isInterviewAction
          ? isFinalizeRowPrepared(app.id)
          : false,
    ).length;

    return (
      <div className="space-y-3 min-h-0 flex flex-col">
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-xs font-bold text-foreground">
            Use SCP assessment cards to stage values before final submit.
          </p>
          <p className="text-xs font-bold mt-1">
            Staged rows: {stagedCount}/{selectedApplications.length}
          </p>
        </div>

        <div className="min-h-0 overflow-y-auto space-y-3 pr-1">
          {selectedApplications.map((app) => {
            const staged = isScoreAction
              ? isAssessmentRowPrepared(app.id)
              : isInterviewAction
                ? isFinalizeRowPrepared(app.id)
                : false;

            return (
              <div key={app.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase truncate">
                      {app.lastName}, {app.firstName}
                    </p>
                    <p className="text-[11px] font-bold text-foreground truncate">
                      #{app.trackingNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {staged && (
                      <Badge
                        variant="secondary"
                        className="h-5 px-2 text-[10px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-700">
                        Staged
                      </Badge>
                    )}
                    <StatusBadge status={app.status} className="text-[10px]" />
                  </div>
                </div>

                <SCPAssessmentBlock
                  applicant={buildScpApplicant(app)}
                  onSaveStepResult={
                    isScoreAction
                      ? async (stepOrder, kind, score, stepCutoffScore) => {
                          await stageAssessmentFromScpBlock(
                            app.id,
                            stepOrder,
                            kind,
                            score,
                            stepCutoffScore,
                          );
                        }
                      : undefined
                  }
                  interviewPassChecked={
                    (
                      finalizeInterviewRows[app.id] ?? {
                        ...DEFAULT_FINALIZE_INTERVIEW_ROW,
                      }
                    ).decision === "PASS"
                  }
                  onInterviewPassChange={
                    isInterviewAction
                      ? (checked) => {
                          updateFinalizeRow(app.id, {
                            decision: checked ? "PASS" : "REJECT",
                            rejectOutcome: checked
                              ? "NOT_QUALIFIED"
                              : (finalizeInterviewRows[app.id]?.rejectOutcome ??
                                "NOT_QUALIFIED"),
                          });
                          setActionFormError(null);
                        }
                      : undefined
                  }
                  onSubmitInterviewResult={
                    isInterviewAction
                      ? async (passed) => {
                          await stageInterviewDecisionFromScpBlock(
                            app.id,
                            passed,
                          );
                        }
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActionForm = () => {
    if (!activeBatchAction) {
      return (
        <div className="rounded-lg border p-4 text-sm font-bold text-foreground">
          No contextual batch action is available for the current selection.
        </div>
      );
    }

    switch (activeBatchAction.id) {
      case "VERIFY_DOCUMENTS":
        return (
          <PipelineBatchVerifyGrid
            verifyGridLoading={verifyGridLoading}
            verifyGridColumns={verifyGridColumns}
            verifyGridApplicants={verifyGridApplicants}
            verifyGridValues={verifyGridValues}
            verifyAllChecked={verifyAllChecked}
            isBatchProcessing={isBatchProcessing}
            onReload={() => {
              void loadVerifyGridPreview();
            }}
            isVerifyColumnFullyChecked={isVerifyColumnFullyChecked}
            setVerifyColumnForAll={setVerifyColumnForAll}
            setVerifyAll={setVerifyAll}
            setVerifyCell={setVerifyCell}
            verifyRowsMarked={verifyRowsMarked}
            isVerifyRowReady={isVerifyRowReady}
            setVerifyRowMarked={setVerifyRowMarked}
          />
        );
      case "SCHEDULE_EXAM":
        return (
          <PipelineBatchScheduleForm
            form={examScheduleForm}
            onChange={(patch) =>
              setExamScheduleForm((prev) => ({ ...prev, ...patch }))
            }
            modeLabel="Exam"
            isBatchProcessing={isBatchProcessing}
            options={{
              stepTemplate: examScheduleStepTemplate,
              defaultsLoading: examScheduleDefaultsLoading,
              onReloadDefaults: () => {
                void loadExamScheduleDefaults();
              },
              selectedCount: selectedApplications.length,
            }}
          />
        );
      case "RECORD_ASSESSMENT":
        if (applicantType !== "REGULAR") {
          return renderScpActionBlocksForm();
        }
        return (
          <PipelineBatchAssessmentGrid
            scoreGridLoading={scoreGridLoading}
            selectedApplications={selectedApplications}
            scoreComponents={scoreComponents}
            scoreGridRows={scoreGridRows}
            isBatchProcessing={isBatchProcessing}
            computeWeightedTotal={computeWeightedTotal}
            updateScoreCell={updateScoreCell}
            updateScoreRemarks={updateScoreRemarks}
            setAbsentNoShow={setAbsentNoShow}
            isScoreValueInvalid={isScoreValueInvalid}
          />
        );
      case "SCHEDULE_INTERVIEW":
        return (
          <PipelineBatchScheduleForm
            form={interviewScheduleForm}
            onChange={(patch) =>
              setInterviewScheduleForm((prev) => ({ ...prev, ...patch }))
            }
            modeLabel="Interview"
            isBatchProcessing={isBatchProcessing}
          />
        );
      case "FINALIZE_PHASE_ONE":
        if (applicantType !== "REGULAR") {
          return renderScpActionBlocksForm();
        }
        return (
          <PipelineBatchFinalizeInterviewGrid
            selectedApplications={selectedApplications}
            finalizeInterviewRows={finalizeInterviewRows}
            isBatchProcessing={isBatchProcessing}
            updateFinalizeRow={updateFinalizeRow}
          />
        );
      default:
        return (
          <div className="rounded-lg border p-4 text-sm font-bold text-foreground">
            This batch action is not configured.
          </div>
        );
    }
  };

  return (
    <>
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="space-y-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              {REGISTRATION_STAGE_QUICK_FILTERS.map((stage) => (
                <Button
                  key={stage.value}
                  type="button"
                  size="sm"
                  variant={status === stage.value ? "default" : "outline"}
                  className="h-8 text-xs font-bold"
                  onClick={() => {
                    setStatus(stage.value);
                    setPage(1);
                  }}>
                  {stage.label}
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 text-[10px]">
                    {stageCounts[stage.value] ?? 0}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-sm uppercase tracking-wider font-bold">
                Search Applicant
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  placeholder="LRN, First Name, Last Name..."
                  className="pl-9 h-10 text-sm font-bold"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <Button
                variant="outline"
                className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
                onClick={() => {
                  void fetchData();
                }}
                disabled={loading || isBatchProcessing}>
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                variant="outline"
                className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setPage(1);
                }}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {/* Batch Action Toolbar */}
          <div className="sticky top-0 z-20 rounded-xl border border-primary/20 bg-background/95 backdrop-blur px-3 py-3 mb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="h-8 px-3 text-xs font-bold">
                  {selectedIds.size} selected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  onClick={selectCurrentPage}
                  disabled={applications.length === 0 || isBatchProcessing}>
                  Select Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  onClick={invertCurrentPageSelection}
                  disabled={applications.length === 0 || isBatchProcessing}>
                  Invert Page
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-bold text-foreground"
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0 || isBatchProcessing}>
                  Clear
                </Button>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                {hasSelectionConflict ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex w-full sm:w-auto">
                          <Button
                            size="sm"
                            disabled
                            className="font-bold w-full sm:w-auto">
                            <AlertTriangle className="size-4 mr-1.5" />
                            {contextualActionLabel}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {selectionConflictMessage}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    size="sm"
                    disabled={isContextualActionDisabled}
                    onClick={handleBatchProcess}
                    className="font-bold w-full sm:w-auto">
                    {isBatchProcessing ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-1.5" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {getContextualActionIcon()}
                        {contextualActionLabel}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {selectedIds.size > 0 && hasSelectionConflict && (
              <p className="mt-2 text-xs font-bold text-destructive">
                {selectionConflictMessage}
              </p>
            )}
            {selectedIds.size > 0 &&
              !hasSelectionConflict &&
              activeBatchAction && (
                <p className="mt-2 text-xs font-bold text-foreground">
                  Detected status: {singleSelectedStatus?.replaceAll("_", " ")}.
                  Available batch task: {activeBatchAction.buttonLabel}.
                </p>
              )}
            {selectedIds.size > 0 &&
              !hasSelectionConflict &&
              !activeBatchAction && (
                <p className="mt-2 text-xs font-bold text-foreground">
                  No state-aware batch action is available for this status yet.
                </p>
              )}
            {selectedIds.size > 0 &&
              derivedTargetStatus &&
              preflightSummary && (
                <p className="mt-2 text-xs font-bold text-foreground">
                  {preflightSummary.eligible.length} ready to process,{" "}
                  {preflightSummary.ineligible.length} blocked by transition
                  rules.
                </p>
              )}
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden">
            <Table className="border-collapse">
              <TableHeader className="bg-[hsl(var(--primary))]">
                <TableRow>
                  <TableHead className="w-12 text-center text-primary-foreground">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center"
                      disabled={isBatchProcessing}>
                      {allSelected ? (
                        <CheckSquare className="size-4 text-primary-foreground" />
                      ) : (
                        <Square className="size-4 text-primary-foreground/60" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    APPLICANT
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground hidden md:table-cell text-sm">
                    LRN
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    GRADE LEVEL
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    STATUS
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground hidden xl:table-cell text-sm">
                    DATE
                  </TableHead>
                  {showAssessment && (
                    <>
                      <TableHead className="text-center font-bold text-primary-foreground text-sm">
                        ASSESSMENT SCORE
                      </TableHead>
                      <TableHead className="text-center font-bold text-primary-foreground text-sm">
                        REMARKS
                      </TableHead>
                      <TableHead className="text-center font-bold text-primary-foreground text-sm">
                        ACTIONS
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex justify-center">
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex justify-center">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">
                        <div className="flex justify-center">
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </TableCell>
                      {showAssessment && (
                        <>
                          <TableCell className="text-sm">
                            <div className="flex justify-center">
                              <Skeleton className="h-8 w-28" />
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex justify-center">
                              <Skeleton className="h-4 w-16" />
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex justify-center">
                              <Skeleton className="h-8 w-16" />
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showAssessment ? 9 : 6}
                      className="h-24 text-center text-sm font-bold">
                      No applicants found.
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow
                      key={app.id}
                      className={`hover:bg-[hsl(var(--muted))] transition-colors text-center text-sm ${
                        selectedIds.has(app.id)
                          ? "bg-[hsl(var(--muted))] shadow-inner"
                          : ""
                      }`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(app.id)}
                          onCheckedChange={() => toggleSelect(app.id)}
                          disabled={isBatchProcessing}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm uppercase">
                            {app.lastName}, {app.firstName}{" "}
                            {app.middleName
                              ? `${app.middleName.charAt(0)}.`
                              : ""}
                            {app.suffix ? ` ${app.suffix}` : ""}
                          </span>
                          <span className="text-sm font-bold">
                            {app.trackingNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-bold">
                        {app.lrn || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-sm">
                          {app.gradeLevel?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={app.status}
                          className="text-sm font-bold"
                        />
                      </TableCell>
                      <TableCell className="text-sm hidden xl:table-cell font-bold">
                        {format(new Date(app.createdAt), "MMMM dd, yyyy")}
                      </TableCell>
                      {showAssessment && (
                        <>
                          <TableCell>
                            <div className="flex flex-col items-center justify-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                className="h-8 w-20 text-center text-sm font-bold"
                                value={scores[app.id] ?? ""}
                                onChange={(e) =>
                                  setScores((prev) => ({
                                    ...prev,
                                    [app.id]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs font-bold mt-1">
                                Cut-off score: {cutoffScore ?? "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`text-xs font-bold ${
                                getRemarkByScore(app.id) === "PASSED"
                                  ? "text-emerald-700"
                                  : getRemarkByScore(app.id) === "FAILED"
                                    ? "text-destructive"
                                    : "text-foreground"
                              }`}>
                              {getRemarkByScore(app.id)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                              disabled={
                                savingId === app.id ||
                                !scores[app.id] ||
                                isNaN(Number(scores[app.id]))
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveResult(app.id);
                              }}>
                              {savingId === app.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Save className="h-3 w-3 mr-1" />
                              )}
                              Save Result
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
            <span className="text-xs">
              Showing {applications.length} applicants
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-8 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}>
                Previous
              </Button>
              <Badge variant="secondary" className="px-3 h-8 text-xs">
                Page {page}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-8 text-xs"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= total}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isActionModalOpen}
        onOpenChange={(open) => {
          if (!isBatchProcessing) {
            setIsActionModalOpen(open);
            if (!open) {
              setActionFormError(null);
            }
          }
        }}>
        <DialogContent className="w-[90vw] max-w-[90vw] h-[88vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {activeBatchAction?.modalTitle ?? "Batch Action"}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              {activeBatchAction?.modalDescription ??
                "Review selected applicants before batch processing."}
            </DialogDescription>
          </DialogHeader>

          <div
            ref={splitPanesRef}
            className={`grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,var(--left-pane-width))_12px_minmax(0,var(--right-pane-width))] ${
              isResizingSplitPanes ? "cursor-col-resize select-none" : ""
            }`}
            style={
              {
                "--left-pane-width": `${leftPaneWidthPercent}%`,
                "--right-pane-width": `${100 - leftPaneWidthPercent}%`,
              } as CSSProperties
            }>
            <div className="rounded-lg border overflow-hidden flex flex-col min-h-0 lg:min-w-0">
              <div className="px-3 py-2 border-b bg-muted/30">
                <p className="text-sm font-bold">Selected Applicants</p>
                <p className="text-xs text-foreground font-bold">
                  {selectedApplications.length} in batch scope
                </p>
                {shouldShowScpAssessmentPreview && (
                  <p className="text-[11px] text-foreground font-bold mt-1">
                    SCP assessment timeline preview
                  </p>
                )}
              </div>
              <div
                className={`flex-1 overflow-y-auto ${
                  shouldShowScpAssessmentPreview
                    ? "p-3 space-y-3"
                    : "p-2 space-y-2"
                }`}>
                {selectedApplications.length === 0 ? (
                  <p className="text-xs font-bold text-foreground px-2 py-3">
                    No applicants selected.
                  </p>
                ) : shouldShowScpAssessmentPreview ? (
                  <>
                    {scpBatchPreviewRows.map((row) => {
                      const rowIsStaged = getScpPreviewStagedState(row.id);

                      return (
                        <div key={row.id} className="rounded-md border p-2">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase truncate">
                                {row.name}
                              </p>
                              <p className="text-[11px] font-bold text-foreground truncate">
                                #{row.trackingNumber}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {rowIsStaged && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 px-2 text-[10px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-700">
                                  Staged
                                </Badge>
                              )}
                              <StatusBadge
                                status={row.status}
                                className="text-[10px]"
                              />
                            </div>
                          </div>

                          <SCPAssessmentBlock applicant={row.applicant} />
                        </div>
                      );
                    })}

                    {scpPreviewOverflowCount > 0 && (
                      <p className="text-[11px] font-bold text-foreground px-1">
                        Showing first {scpBatchPreviewRows.length} previews.{" "}
                        {scpPreviewOverflowCount} more selected applicant(s) are
                        hidden.
                      </p>
                    )}
                  </>
                ) : (
                  selectedApplications.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-md border p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase truncate">
                          {app.lastName}, {app.firstName}
                        </p>
                        <p className="text-[11px] font-bold text-foreground truncate">
                          #{app.trackingNumber}
                        </p>
                      </div>
                      <StatusBadge
                        status={app.status}
                        className="text-[10px]"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className="hidden lg:flex items-center justify-center cursor-col-resize"
              role="separator"
              aria-label="Resize panes"
              aria-orientation="vertical"
              aria-valuemin={25}
              aria-valuemax={75}
              aria-valuenow={Math.round(leftPaneWidthPercent)}
              onMouseDown={handleSplitPaneResizeStart}>
              <div
                className={`h-full w-[2px] rounded-full transition-colors ${
                  isResizingSplitPanes
                    ? "bg-primary/60"
                    : "bg-border hover:bg-primary/40"
                }`}
              />
            </div>

            <div className="rounded-lg border p-4 space-y-4 overflow-y-auto min-h-0 lg:min-w-0">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-xs text-foreground font-bold">Selected</p>
                  <p className="text-lg font-bold">{selectedIds.size}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700 font-bold">Eligible</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {preflightSummary?.eligible.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs text-red-700 font-bold">Blocked</p>
                  <p className="text-lg font-bold text-red-700">
                    {preflightSummary?.ineligible.length ?? 0}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                <p className="text-xs text-foreground font-bold">
                  Current Batch Action
                </p>
                <p className="text-sm font-bold">
                  {activeBatchAction?.buttonLabel ?? "No action available"}
                </p>
                <p className="text-xs font-bold text-foreground">
                  Target status:{" "}
                  {derivedTargetStatus.replaceAll("_", " ") || "N/A"}
                </p>
              </div>

              {actionFormError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <p className="text-xs font-bold text-destructive">
                    {actionFormError}
                  </p>
                </div>
              )}

              {!actionFormError && actionReadinessHint && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-bold text-amber-800">
                    {actionReadinessHint}
                  </p>
                </div>
              )}

              {renderActionForm()}

              {preflightSummary && preflightSummary.ineligible.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 space-y-2">
                  <p className="text-sm font-bold text-red-700">
                    Blocked groups
                  </p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {Object.entries(preflightSummary.reasonGroups).map(
                      ([reason, count]) => (
                        <p
                          key={reason}
                          className="text-xs font-bold text-red-700">
                          {count}x {reason}
                        </p>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsActionModalOpen(false)}
              disabled={isBatchProcessing}
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBatchProcess}
              disabled={
                isBatchProcessing ||
                !activeBatchAction ||
                !isActionFormReady ||
                actionSubmitCount === 0
              }
              className="font-bold">
              {isBatchProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  {activeBatchAction?.submitLabel ?? "Processing"}...
                </>
              ) : (
                `${activeBatchAction?.submitLabel ?? "Process"} (${actionSubmitCount})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Results Modal */}
      <BatchResultsModal
        results={batchResults}
        onReselectFailed={(ids) => setSelectedIds(new Set(ids))}
        onClose={handleResultsClose}
      />
    </>
  );
}
