import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  CheckSquare,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
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
import PipelineBatchScpAssessmentInterviewGrid from "./pipeline-batch/PipelineBatchScpAssessmentInterviewGrid";
import PipelineBatchRegularSectionAssignment from "./pipeline-batch/PipelineBatchRegularSectionAssignment";
import PipelineBatchApplicantsTable from "./pipeline-batch/PipelineBatchApplicantsTable";
import PipelineBatchActionDialog from "./pipeline-batch/PipelineBatchActionDialog";
import {
  type AcademicStatusValue,
  DEFAULT_FINALIZE_INTERVIEW_ROW,
  type Application,
  type ChecklistFieldKey,
  type EarlyRegistrationApiRow,
  type FinalizeInterviewRowState,
  type PipelineBatchViewProps,
  type RankingFormulaComponent,
  type ScheduleFormState,
  type ScoreRowState,
  type ScpProgramStepTemplate,
  type VerifyGridApplicant,
  type VerifyGridColumn,
  type RegularSectionOption,
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

  const showAssessment = hasAssessment && status === "EXAM_SCHEDULED";
  const DEFAULT_SCHEDULE_TIME = "08:00 AM";
  const ENROLLMENT_BRIDGE_STATUS = "READY_FOR_ENROLLMENT";

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
  const [verifyGridAcademicStatuses, setVerifyGridAcademicStatuses] = useState<
    Record<number, AcademicStatusValue>
  >({});
  const [verifyGridLrnDrafts, setVerifyGridLrnDrafts] = useState<
    Record<number, string>
  >({});
  const [verifyLrnEditingId, setVerifyLrnEditingId] = useState<number | null>(
    null,
  );
  const [verifyLrnSavingId, setVerifyLrnSavingId] = useState<number | null>(
    null,
  );
  const [verifyRowsMarked, setVerifyRowsMarked] = useState<
    Record<number, boolean>
  >({});

  const [regularSectionsLoading, setRegularSectionsLoading] = useState(false);
  const [regularSections, setRegularSections] = useState<
    RegularSectionOption[]
  >([]);
  const [selectedRegularSectionId, setSelectedRegularSectionId] =
    useState<string>("");

  const [examScheduleForm, setExamScheduleForm] = useState<ScheduleFormState>({
    scheduledDate: "",
    scheduledTime: DEFAULT_SCHEDULE_TIME,
    venue: "",
    notes: "",
  });
  const [interviewScheduleForm, setInterviewScheduleForm] =
    useState<ScheduleFormState>({
      scheduledDate: "",
      scheduledTime: DEFAULT_SCHEDULE_TIME,
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
  const [scpAssessmentCutoffScore, setScpAssessmentCutoffScore] = useState<
    number | null
  >(cutoffScore ?? null);

  const [finalizeInterviewRows, setFinalizeInterviewRows] = useState<
    Record<number, FinalizeInterviewRowState>
  >({});

  const [examScheduleStepTemplate, setExamScheduleStepTemplate] =
    useState<ScpProgramStepTemplate | null>(null);
  const [interviewScheduleStepTemplate, setInterviewScheduleStepTemplate] =
    useState<ScpProgramStepTemplate | null>(null);

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

  const selectedGradeLevelIds = useMemo(
    () =>
      Array.from(
        new Set(selectedApplications.map((app) => Number(app.gradeLevelId))),
      ).filter((id) => Number.isFinite(id) && id > 0),
    [selectedApplications],
  );

  const hasMixedSelectedGradeLevels = selectedGradeLevelIds.length > 1;

  const selectedGradeLevelId =
    selectedGradeLevelIds.length === 1 ? selectedGradeLevelIds[0] : null;

  const selectedGradeLevelName =
    selectedGradeLevelId == null
      ? null
      : (selectedApplications.find(
          (app) => Number(app.gradeLevelId) === selectedGradeLevelId,
        )?.gradeLevel?.name ?? null);

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
      ? "EXAM_SCHEDULED"
      : singleSelectedStatus;

  const activeBatchAction = useMemo(
    () =>
      normalizedSingleSelectedStatus
        ? getRegistrationBatchActionByStatus(
            normalizedSingleSelectedStatus,
            applicantType,
          )
        : null,
    [normalizedSingleSelectedStatus, applicantType],
  );

  const hasRegularSectionGradeConflict =
    activeBatchAction?.id === "ASSIGN_REGULAR_SECTION" &&
    hasMixedSelectedGradeLevels;

  const hasActionScopeConflict =
    hasSelectionConflict || hasRegularSectionGradeConflict;

  const actionScopeConflictMessage =
    selectionConflictMessage ??
    (hasRegularSectionGradeConflict
      ? "Batch section assignment requires applicants from one grade level."
      : null);

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

  const availableRegularSections = useMemo(() => {
    const filteredByProgram = regularSections.filter(
      (section) => section.programType === "REGULAR",
    );

    if (selectedGradeLevelId == null) {
      return filteredByProgram;
    }

    return filteredByProgram.filter(
      (section) => section.gradeLevelId === selectedGradeLevelId,
    );
  }, [regularSections, selectedGradeLevelId]);

  const selectedRegularSection = useMemo(
    () =>
      availableRegularSections.find(
        (section) => String(section.id) === selectedRegularSectionId,
      ) ?? null,
    [availableRegularSections, selectedRegularSectionId],
  );

  const selectedRegularSectionAvailableSlots = selectedRegularSection
    ? Math.max(
        0,
        selectedRegularSection.maxCapacity -
          selectedRegularSection.enrolledCount,
      )
    : 0;

  const isRegularSectionOverCapacity = Boolean(
    selectedRegularSection &&
    scopedEligibleIds.length > selectedRegularSectionAvailableSlots,
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

      const academicStatus =
        verifyGridAcademicStatuses[applicantId] ?? applicant.academicStatus;
      if (academicStatus === "RETAINED") {
        return {
          done: applicant.requiredChecklistKeys.length,
          total: applicant.requiredChecklistKeys.length,
        };
      }

      const total = applicant.requiredChecklistKeys.length;
      if (total === 0) return { done: 0, total: 0 };

      const values = verifyGridValues[applicantId] ?? applicant.checklist;
      const done = applicant.requiredChecklistKeys.reduce((count, key) => {
        return count + (values[key] ? 1 : 0);
      }, 0);

      return { done, total };
    },
    [verifyGridAcademicStatuses, verifyGridApplicants, verifyGridValues],
  );

  const isVerifyRowReady = useCallback(
    (applicantId: number) => {
      const academicStatus = verifyGridAcademicStatuses[applicantId];
      if (academicStatus === "RETAINED") return true;

      const { done, total } = getVerifyRequiredCompletion(applicantId);
      return total > 0 ? done === total : true;
    },
    [getVerifyRequiredCompletion, verifyGridAcademicStatuses],
  );

  const orderedVerifyGridColumns = useMemo(() => {
    const requiredColumnPriority: ChecklistFieldKey[] = [
      "isSf9Submitted",
      "isPsaBirthCertPresented",
      "isGoodMoralPresented",
      "isMedicalEvalSubmitted",
    ];

    const priorityRank = new Map<ChecklistFieldKey, number>(
      requiredColumnPriority.map((key, index) => [key, index]),
    );

    return [...verifyGridColumns].sort((left, right) => {
      if (left.isMandatory !== right.isMandatory) {
        return left.isMandatory ? -1 : 1;
      }

      if (left.isMandatory && right.isMandatory) {
        const leftRank = priorityRank.get(left.key);
        const rightRank = priorityRank.get(right.key);
        const leftPrioritized = leftRank != null;
        const rightPrioritized = rightRank != null;

        if (leftPrioritized && rightPrioritized && leftRank !== rightRank) {
          return Number(leftRank) - Number(rightRank);
        }

        if (leftPrioritized !== rightPrioritized) {
          return leftPrioritized ? -1 : 1;
        }
      }

      return left.label.localeCompare(right.label);
    });
  }, [verifyGridColumns]);

  const setVerifyRowMarked = useCallback(
    (applicantId: number, checked: boolean) => {
      setVerifyRowsMarked((prev) => ({
        ...prev,
        [applicantId]: checked,
      }));
    },
    [],
  );

  const setVerifyAcademicStatus = useCallback(
    (applicantId: number, statusValue: AcademicStatusValue) => {
      setVerifyGridAcademicStatuses((prev) => ({
        ...prev,
        [applicantId]: statusValue,
      }));

      if (statusValue === "PROMOTED") {
        const applicant = verifyGridApplicants.find(
          (entry) => entry.id === applicantId,
        );
        if (!applicant) {
          setVerifyRowsMarked((prev) => ({
            ...prev,
            [applicantId]: false,
          }));
          return;
        }

        const values = verifyGridValues[applicantId] ?? applicant.checklist;
        const rowReady = applicant.requiredChecklistKeys.every((requiredKey) =>
          Boolean(values[requiredKey]),
        );

        setVerifyRowsMarked((prev) => ({
          ...prev,
          [applicantId]: rowReady,
        }));
        return;
      }

      setVerifyRowsMarked((prev) => {
        if (!prev[applicantId]) return prev;
        return {
          ...prev,
          [applicantId]: false,
        };
      });
    },
    [verifyGridApplicants, verifyGridValues],
  );

  const setVerifyLrnDraft = useCallback(
    (applicantId: number, value: string) => {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 12);
      setVerifyGridLrnDrafts((prev) => ({
        ...prev,
        [applicantId]: digitsOnly,
      }));
    },
    [],
  );

  const startVerifyLrnEdit = useCallback(
    (applicantId: number) => {
      const applicant = verifyGridApplicants.find(
        (entry) => entry.id === applicantId,
      );

      setVerifyGridLrnDrafts((prev) => ({
        ...prev,
        [applicantId]: applicant?.lrn ?? prev[applicantId] ?? "",
      }));

      setVerifyLrnEditingId(applicantId);
      setActionFormError(null);
    },
    [verifyGridApplicants],
  );

  const cancelVerifyLrnEdit = useCallback(
    (applicantId: number) => {
      const applicant = verifyGridApplicants.find(
        (entry) => entry.id === applicantId,
      );

      setVerifyGridLrnDrafts((prev) => ({
        ...prev,
        [applicantId]: applicant?.lrn ?? "",
      }));

      setVerifyLrnEditingId((current) =>
        current === applicantId ? null : current,
      );
    },
    [verifyGridApplicants],
  );

  const saveVerifyRowLrn = useCallback(
    async (applicantId: number) => {
      const lrn = (verifyGridLrnDrafts[applicantId] ?? "").trim();
      if (!/^\d{12}$/.test(lrn)) {
        setActionFormError("LRN must be exactly 12 digits before saving.");
        return;
      }

      setVerifyLrnSavingId(applicantId);

      try {
        await api.patch(`/early-registrations/${applicantId}/assign-lrn`, {
          lrn,
        });

        setVerifyGridApplicants((prev) =>
          prev.map((applicant) =>
            applicant.id === applicantId
              ? {
                  ...applicant,
                  lrn,
                  isPendingLrnCreation: false,
                }
              : applicant,
          ),
        );

        setVerifyGridLrnDrafts((prev) => ({
          ...prev,
          [applicantId]: lrn,
        }));
        setVerifyLrnEditingId((current) =>
          current === applicantId ? null : current,
        );

        setActionFormError(null);
        sileo.success({
          title: "LRN Updated",
          description: "Learner record updated with the new LRN.",
        });
      } catch (err) {
        toastApiError(err as never);
      } finally {
        setVerifyLrnSavingId(null);
      }
    },
    [verifyGridLrnDrafts],
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
      setVerifyGridAcademicStatuses(
        applicants.reduce<Record<number, AcademicStatusValue>>(
          (acc, applicant) => {
            acc[applicant.id] = applicant.academicStatus ?? "PROMOTED";
            return acc;
          },
          {},
        ),
      );
      setVerifyGridLrnDrafts(
        applicants.reduce<Record<number, string>>((acc, applicant) => {
          acc[applicant.id] = applicant.lrn ?? "";
          return acc;
        }, {}),
      );
      setVerifyLrnEditingId(null);
      setVerifyRowsMarked(
        applicants.reduce<Record<number, boolean>>((acc, applicant) => {
          const rowReady = applicant.requiredChecklistKeys.every(
            (requiredKey) => Boolean(applicant.checklist[requiredKey]),
          );

          acc[applicant.id] =
            applicant.academicStatus !== "RETAINED" && rowReady;
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
      setVerifyGridAcademicStatuses({});
      setVerifyGridLrnDrafts({});
      setVerifyLrnEditingId(null);
      setVerifyRowsMarked({});
    } finally {
      setVerifyGridLoading(false);
    }
  }, [selectedIds]);

  const loadRegularSections = useCallback(async () => {
    if (!ayId) {
      setRegularSections([]);
      setSelectedRegularSectionId("");
      return;
    }

    setRegularSectionsLoading(true);

    try {
      const res = await api.get(`/sections/${ayId}`);

      const gradeLevels = Array.isArray(res.data?.gradeLevels)
        ? (res.data.gradeLevels as Array<{
            gradeLevelId: number;
            gradeLevelName: string;
            sections?: Array<{
              id: number;
              name: string;
              maxCapacity?: number;
              enrolledCount?: number;
              fillPercent?: number;
              programType?: string;
            }>;
          }>)
        : [];

      const flattenedSections = gradeLevels
        .flatMap((gradeLevel) =>
          (gradeLevel.sections ?? []).map((section) => ({
            id: section.id,
            name: section.name,
            gradeLevelId: Number(gradeLevel.gradeLevelId),
            gradeLevelName: gradeLevel.gradeLevelName,
            programType: String(section.programType ?? "REGULAR"),
            maxCapacity: Number(section.maxCapacity ?? 0),
            enrolledCount: Number(section.enrolledCount ?? 0),
            fillPercent: Number(section.fillPercent ?? 0),
          })),
        )
        .filter((section) => section.programType === "REGULAR");

      setRegularSections(flattenedSections);

      setSelectedRegularSectionId((prev) => {
        if (
          prev &&
          flattenedSections.some((section) => String(section.id) === prev)
        ) {
          return prev;
        }

        if (selectedGradeLevelId != null) {
          const sameGradeSection = flattenedSections.find(
            (section) => section.gradeLevelId === selectedGradeLevelId,
          );
          if (sameGradeSection) {
            return String(sameGradeSection.id);
          }
        }

        return flattenedSections[0] ? String(flattenedSections[0].id) : "";
      });
    } catch (err) {
      toastApiError(err as never);
      setRegularSections([]);
      setSelectedRegularSectionId("");
    } finally {
      setRegularSectionsLoading(false);
    }
  }, [ayId, selectedGradeLevelId]);

  const initializeScoreGrid = useCallback(async () => {
    const defaultComponents: RankingFormulaComponent[] = [
      { key: "EXAM", label: "Exam Score", weight: 100 },
    ];

    setScoreGridLoading(true);
    setActionFormError(null);

    try {
      let resolvedComponents = defaultComponents;
      let resolvedCutoffScore = cutoffScore ?? null;

      if (ayId && applicantType !== "REGULAR") {
        const res = await api.get(`/curriculum/${ayId}/scp-config`);
        const configs = (res.data?.scpProgramConfigs ?? []) as Array<{
          scpType: string;
          rankingFormula?: unknown;
          steps?: ScpProgramStepTemplate[];
        }>;

        const config = configs.find((entry) => entry.scpType === applicantType);
        const parsed = parseRankingFormulaComponents(config?.rankingFormula);
        if (parsed.length > 0) {
          resolvedComponents = parsed;
        }

        const orderedSteps = [...(config?.steps ?? [])].sort(
          (a, b) => Number(a.stepOrder) - Number(b.stepOrder),
        );
        const examCandidates = orderedSteps.filter(
          (step) => String(step.kind).toUpperCase() !== "INTERVIEW",
        );
        const selectedAssessmentStep =
          examCandidates.find((step) => step.isRequired) ??
          examCandidates[0] ??
          null;

        const rawCutoff = selectedAssessmentStep?.cutoffScore;
        if (rawCutoff != null && Number.isFinite(Number(rawCutoff))) {
          resolvedCutoffScore = Number(rawCutoff);
        } else {
          resolvedCutoffScore = null;
        }
      }

      setScoreComponents(resolvedComponents);
      setScpAssessmentCutoffScore(resolvedCutoffScore);
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
      setScpAssessmentCutoffScore(cutoffScore ?? null);
      setScoreGridRows({});
    } finally {
      setScoreGridLoading(false);
    }
  }, [
    ayId,
    applicantType,
    cutoffScore,
    parseRankingFormulaComponents,
    selectedApplications,
  ]);

  const loadScheduleDefaults = useCallback(
    async (mode: "EXAM" | "INTERVIEW") => {
      const setModeTemplate = (template: ScpProgramStepTemplate | null) => {
        if (mode === "EXAM") {
          setExamScheduleStepTemplate(template);
          return;
        }
        setInterviewScheduleStepTemplate(template);
      };

      const setModeForm = (template: ScpProgramStepTemplate | null) => {
        const normalizedDate = template?.scheduledDate
          ? format(new Date(template.scheduledDate), "yyyy-MM-dd")
          : "";
        const normalizedTime =
          template?.scheduledTime?.trim() || DEFAULT_SCHEDULE_TIME;
        const normalizedVenue = template?.venue?.trim() || "";
        const normalizedNotes = template?.notes?.trim() || "";

        if (mode === "EXAM") {
          setExamScheduleForm({
            scheduledDate: normalizedDate,
            scheduledTime: normalizedTime,
            venue: normalizedVenue,
            notes: normalizedNotes,
          });
          return;
        }

        setInterviewScheduleForm({
          scheduledDate: normalizedDate,
          scheduledTime: normalizedTime,
          venue: normalizedVenue,
          notes: normalizedNotes,
        });
      };

      if (!ayId || applicantType === "REGULAR") {
        setModeTemplate(null);
        if (mode === "EXAM") {
          setExamScheduleForm((prev) => ({
            ...prev,
            scheduledTime: prev.scheduledTime || DEFAULT_SCHEDULE_TIME,
          }));
        } else {
          setInterviewScheduleForm((prev) => ({
            ...prev,
            scheduledTime: prev.scheduledTime || DEFAULT_SCHEDULE_TIME,
          }));
        }
        return;
      }

      try {
        const res = await api.get(`/curriculum/${ayId}/scp-config`);
        const configs = (res.data?.scpProgramConfigs ?? []) as Array<{
          scpType: string;
          steps?: ScpProgramStepTemplate[];
        }>;

        const matchingConfig = configs.find(
          (entry) => entry.scpType === applicantType,
        );

        const orderedSteps = [...(matchingConfig?.steps ?? [])].sort(
          (a, b) => Number(a.stepOrder) - Number(b.stepOrder),
        );

        const selectedTemplate =
          mode === "INTERVIEW"
            ? (orderedSteps.find(
                (step) => String(step.kind).toUpperCase() === "INTERVIEW",
              ) ?? null)
            : (() => {
                const examCandidates = orderedSteps.filter(
                  (step) => String(step.kind).toUpperCase() !== "INTERVIEW",
                );
                return (
                  examCandidates.find((step) => step.isRequired) ??
                  examCandidates[0] ??
                  null
                );
              })();

        setModeTemplate(selectedTemplate);
        setModeForm(selectedTemplate);
      } catch (err) {
        toastApiError(err as never);
        setModeTemplate(null);
      }
    },
    [ayId, applicantType, DEFAULT_SCHEDULE_TIME],
  );

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

    if (activeBatchAction.id === "ASSIGN_REGULAR_SECTION") {
      void loadRegularSections();
      return;
    }

    if (activeBatchAction.id === "SCHEDULE_EXAM") {
      void loadScheduleDefaults("EXAM");
      return;
    }

    if (activeBatchAction.id === "SCHEDULE_INTERVIEW") {
      void loadScheduleDefaults("INTERVIEW");
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
    loadRegularSections,
    loadScheduleDefaults,
    initializeScoreGrid,
    initializeFinalizeRows,
  ]);

  const setVerifyCell = (
    applicantId: number,
    key: ChecklistFieldKey,
    value: boolean,
  ) => {
    const applicant = verifyGridApplicants.find(
      (entry) => entry.id === applicantId,
    );
    const academicStatus =
      verifyGridAcademicStatuses[applicantId] ?? applicant?.academicStatus;
    if (academicStatus === "RETAINED") {
      return;
    }

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

        if (isReady && !prevMarked[applicantId]) {
          return {
            ...prevMarked,
            [applicantId]: true,
          };
        }

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
        const academicStatus =
          verifyGridAcademicStatuses[applicant.id] ?? applicant.academicStatus;
        if (academicStatus === "RETAINED") {
          continue;
        }

        next[applicant.id] = {
          ...(next[applicant.id] ?? {}),
          [key]: value,
        };
      }

      setVerifyRowsMarked((prevMarked) => {
        let changed = false;
        const nextMarked = { ...prevMarked };

        for (const applicant of verifyGridApplicants) {
          const academicStatus =
            verifyGridAcademicStatuses[applicant.id] ??
            applicant.academicStatus;
          const isReady =
            academicStatus === "RETAINED" ||
            applicant.requiredChecklistKeys.every((requiredKey) =>
              Boolean(next[applicant.id]?.[requiredKey]),
            );

          if (
            academicStatus !== "RETAINED" &&
            isReady &&
            !nextMarked[applicant.id]
          ) {
            nextMarked[applicant.id] = true;
            changed = true;
            continue;
          }

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
        const academicStatus =
          verifyGridAcademicStatuses[applicant.id] ?? applicant.academicStatus;
        if (academicStatus === "RETAINED") {
          continue;
        }

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
          const academicStatus =
            verifyGridAcademicStatuses[applicant.id] ??
            applicant.academicStatus;
          const isReady =
            academicStatus === "RETAINED" ||
            applicant.requiredChecklistKeys.every((requiredKey) =>
              Boolean(next[applicant.id]?.[requiredKey]),
            );

          if (
            academicStatus !== "RETAINED" &&
            isReady &&
            !nextMarked[applicant.id]
          ) {
            nextMarked[applicant.id] = true;
            changed = true;
            continue;
          }

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

    const promotableApplicants = verifyGridApplicants.filter((applicant) => {
      const academicStatus =
        verifyGridAcademicStatuses[applicant.id] ?? applicant.academicStatus;
      return academicStatus !== "RETAINED";
    });

    if (promotableApplicants.length === 0) {
      return false;
    }

    return promotableApplicants.every((applicant) =>
      verifyGridColumns.every((column) =>
        Boolean(verifyGridValues[applicant.id]?.[column.key]),
      ),
    );
  }, [
    verifyGridAcademicStatuses,
    verifyGridApplicants,
    verifyGridColumns,
    verifyGridValues,
  ]);

  const isVerifyColumnFullyChecked = (key: ChecklistFieldKey) =>
    verifyGridApplicants.some((applicant) => {
      const academicStatus =
        verifyGridAcademicStatuses[applicant.id] ?? applicant.academicStatus;
      return academicStatus !== "RETAINED";
    }) &&
    verifyGridApplicants
      .filter((applicant) => {
        const academicStatus =
          verifyGridAcademicStatuses[applicant.id] ?? applicant.academicStatus;
        return academicStatus !== "RETAINED";
      })
      .every((applicant) => Boolean(verifyGridValues[applicant.id]?.[key]));

  const setVerifyRequiredDocsForRow = useCallback(
    (applicantId: number, value: boolean) => {
      const applicant = verifyGridApplicants.find(
        (entry) => entry.id === applicantId,
      );
      if (!applicant) return;

      const academicStatus =
        verifyGridAcademicStatuses[applicantId] ?? applicant.academicStatus;
      if (academicStatus === "RETAINED") return;

      setVerifyGridValues((prev) => {
        const currentRow = prev[applicantId] ?? applicant.checklist;
        const nextRow = { ...currentRow };

        for (const requiredKey of applicant.requiredChecklistKeys) {
          nextRow[requiredKey] = value;
        }

        const next = {
          ...prev,
          [applicantId]: nextRow,
        };

        setVerifyRowsMarked((prevMarked) => {
          const isReady = applicant.requiredChecklistKeys.every((requiredKey) =>
            Boolean(nextRow[requiredKey]),
          );

          if (isReady && !prevMarked[applicantId]) {
            return {
              ...prevMarked,
              [applicantId]: true,
            };
          }

          if (!isReady && prevMarked[applicantId]) {
            return {
              ...prevMarked,
              [applicantId]: false,
            };
          }

          return prevMarked;
        });

        return next;
      });
    },
    [verifyGridAcademicStatuses, verifyGridApplicants],
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

  const getScpPrimaryScoreValue = useCallback(
    (applicantId: number) => {
      const primaryComponent = scoreComponents[0];
      if (!primaryComponent) return "";

      return (
        scoreGridRows[applicantId]?.componentScores?.[primaryComponent.key] ??
        ""
      );
    },
    [scoreComponents, scoreGridRows],
  );

  const updateScpPrimaryScoreValue = useCallback(
    (applicantId: number, value: string) => {
      setActionFormError(null);

      setScoreGridRows((prev) => {
        const existing =
          prev[applicantId] ??
          ({
            componentScores: {},
            remarks: "",
            absentNoShow: false,
          } as ScoreRowState);

        const nextComponentScores = scoreComponents.reduce<
          Record<string, string>
        >(
          (acc, component) => {
            acc[component.key] = value;
            return acc;
          },
          { ...existing.componentScores },
        );

        return {
          ...prev,
          [applicantId]: {
            ...existing,
            absentNoShow: false,
            componentScores: nextComponentScores,
          },
        };
      });
    },
    [scoreComponents],
  );

  const isScpScoreValueInvalid = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized) return true;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return true;

    return parsed < 0 || parsed > 100;
  }, []);

  const getLatestNonInterviewAssessmentScore = useCallback(
    (applicant: Application): number | null => {
      const nonInterviewAssessments = (applicant.assessments ?? []).filter(
        (assessment) =>
          assessment.type !== "INTERVIEW" &&
          assessment.score != null &&
          Number.isFinite(Number(assessment.score)),
      );

      if (nonInterviewAssessments.length === 0) return null;

      const toSortableValue = (value: string | null | undefined) => {
        if (!value) return Number.NEGATIVE_INFINITY;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
      };

      const latestAssessment = [...nonInterviewAssessments].sort((a, b) => {
        const left = toSortableValue(a.conductedAt ?? a.createdAt);
        const right = toSortableValue(b.conductedAt ?? b.createdAt);
        if (left !== right) return right - left;
        return b.id - a.id;
      })[0];

      if (latestAssessment?.score == null) return null;
      return Number(latestAssessment.score);
    },
    [],
  );

  const getScpScoreValueForRow = useCallback(
    (applicantId: number, applicant: Application) => {
      if (activeBatchAction?.id === "RECORD_ASSESSMENT") {
        return getScpPrimaryScoreValue(applicantId);
      }

      const stagedTotal = computeWeightedTotal(scoreGridRows[applicantId]);
      if (Number.isFinite(stagedTotal ?? NaN)) {
        return Number(stagedTotal).toFixed(2);
      }

      const latestScore = getLatestNonInterviewAssessmentScore(applicant);
      if (latestScore != null) {
        return Number(latestScore).toFixed(2);
      }

      if (
        applicant.examScore != null &&
        Number.isFinite(Number(applicant.examScore))
      ) {
        return Number(applicant.examScore).toFixed(2);
      }

      return "";
    },
    [
      activeBatchAction?.id,
      computeWeightedTotal,
      getLatestNonInterviewAssessmentScore,
      getScpPrimaryScoreValue,
      scoreGridRows,
    ],
  );

  const getScpInterviewDecision = useCallback(
    (applicantId: number): "PASS" | "REJECT" | null => {
      return finalizeInterviewRows[applicantId]?.decision ?? null;
    },
    [finalizeInterviewRows],
  );

  const getScpAbsentNoShow = useCallback(
    (applicantId: number) => Boolean(scoreGridRows[applicantId]?.absentNoShow),
    [scoreGridRows],
  );

  const setScpAbsentNoShow = (applicantId: number, value: boolean) => {
    setActionFormError(null);
    setAbsentNoShow(applicantId, value);
  };

  const setScpInterviewDecision = useCallback(
    (applicantId: number, decision: "PASS" | "REJECT") => {
      setActionFormError(null);
      setFinalizeInterviewRows((prev) => ({
        ...prev,
        [applicantId]: {
          ...(prev[applicantId] ?? { ...DEFAULT_FINALIZE_INTERVIEW_ROW }),
          decision,
          rejectOutcome:
            decision === "PASS"
              ? "SUBMITTED"
              : (prev[applicantId]?.rejectOutcome ?? "SUBMITTED"),
        },
      }));
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

  const selectableApplicationIds = useMemo(
    () =>
      applications
        .filter(
          (application) => application.status !== ENROLLMENT_BRIDGE_STATUS,
        )
        .map((application) => application.id),
    [applications],
  );

  const selectableApplicationIdSet = useMemo(
    () => new Set(selectableApplicationIds),
    [selectableApplicationIds],
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<number>();

      prev.forEach((id) => {
        if (selectableApplicationIdSet.has(id)) {
          next.add(id);
          return;
        }

        changed = true;
      });

      return changed ? next : prev;
    });
  }, [selectableApplicationIdSet]);

  const toggleSelect = (id: number) => {
    if (!selectableApplicationIdSet.has(id)) {
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const hasSelectableRows = selectableApplicationIds.length > 0;
      if (!hasSelectableRows) {
        return prev;
      }

      const currentlyAllSelectableSelected = selectableApplicationIds.every(
        (id) => next.has(id),
      );

      if (currentlyAllSelectableSelected) {
        selectableApplicationIds.forEach((id) => {
          next.delete(id);
        });
      } else {
        selectableApplicationIds.forEach((id) => {
          next.add(id);
        });
      }

      return next;
    });
  };

  const selectCurrentPage = () => {
    setSelectedIds(new Set(selectableApplicationIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const invertCurrentPageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of selectableApplicationIds) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleBatchProcess = () => {
    if (
      selectedIds.size === 0 ||
      !derivedTargetStatus ||
      hasActionScopeConflict ||
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
      void fetchData();
      return;
    }

    if (!isActionFormReady) {
      setActionFormError(
        actionReadinessHint ??
          "Complete all required fields before running this batch action.",
      );
      void fetchData();
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
            verifyRowsMarked[applicant.id] && isVerifyRowReady(applicant.id),
        );

        skippedClientSide = eligibleVerifyApplicants
          .filter((applicant) => !verifyRowsMarked[applicant.id])
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
                verifyRowsMarked[applicant.id] &&
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
          academicStatus:
            verifyGridAcademicStatuses[applicant.id] ??
            applicant.academicStatus,
        }));

        if (applicantsPayload.length === 0) {
          setActionFormError(
            "Mark at least one row for clearance before submitting.",
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
      } else if (activeBatchAction.id === "ASSIGN_REGULAR_SECTION") {
        if (hasMixedSelectedGradeLevels) {
          setActionFormError(
            "Batch section assignment requires applicants from one grade level.",
          );
          return;
        }

        if (!selectedRegularSectionId) {
          setActionFormError("Select one regular section before submitting.");
          return;
        }

        if (isRegularSectionOverCapacity) {
          setActionFormError(
            "Selected section does not have enough available slots for this batch.",
          );
          return;
        }

        const res = await api.patch(
          "/early-registrations/batch/assign-regular-section",
          {
            ids: eligibleIds,
            sectionId: Number(selectedRegularSectionId),
            expectedStatuses,
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
      } else if (activeBatchAction.id === "ENDORSE_REGULAR_TRACK") {
        const res = await api.patch("/early-registrations/batch-process", {
          ids: eligibleIds,
          targetStatus: activeBatchAction.targetStatus,
        });

        responseData = {
          succeeded: res.data?.succeeded ?? [],
          failed: res.data?.failed ?? [],
        };
      }

      if (!responseData) return;

      const toReadableStatusLabel = (statusValue: string) => {
        const normalized = statusValue.trim().toUpperCase();
        const fromCatalog = REGISTRATION_STAGE_QUICK_FILTERS.find(
          (stage) => stage.value === normalized,
        )?.label;

        if (fromCatalog) return fromCatalog;

        return normalized
          .split("_")
          .filter(Boolean)
          .map((token) => `${token.charAt(0)}${token.slice(1).toLowerCase()}`)
          .join(" ");
      };

      const formatOutcomeScore = (value: number) => {
        if (!Number.isFinite(value)) return "0";
        if (Number.isInteger(value)) return String(value);
        return String(Number(value.toFixed(2)));
      };

      const resolveSucceededOutcomeSummary = (
        item: BatchResults["succeeded"][number],
      ): string => {
        if (activeBatchAction.id === "RECORD_ASSESSMENT") {
          const rowState = scoreGridRows[item.id];
          if (rowState?.absentNoShow) {
            return "Score: 0 (No-Show)";
          }

          const selectedApplication = selectedApplicationsById[item.id];
          const weightedTotal = computeWeightedTotal(rowState);
          const fallbackScore = selectedApplication
            ? Number(getScpScoreValueForRow(item.id, selectedApplication))
            : Number.NaN;

          const resolvedScore = Number.isFinite(weightedTotal ?? NaN)
            ? Number(weightedTotal)
            : Number.isFinite(fallbackScore)
              ? fallbackScore
              : null;

          if (resolvedScore == null) {
            return "Score saved";
          }

          const effectiveCutoff = scpAssessmentCutoffScore ?? cutoffScore ?? 75;
          return `Score: ${formatOutcomeScore(resolvedScore)} (${resolvedScore >= effectiveCutoff ? "Passed" : "Failed"})`;
        }

        let nextStatus: string | null = null;

        if (typeof item.status === "string" && item.status.trim()) {
          nextStatus = item.status;
        } else if (activeBatchAction.id === "VERIFY_DOCUMENTS") {
          const applicantAcademicStatus =
            verifyGridAcademicStatuses[item.id] ??
            verifyGridApplicants.find((entry) => entry.id === item.id)
              ?.academicStatus;

          nextStatus =
            applicantAcademicStatus === "RETAINED"
              ? "REJECTED"
              : activeBatchAction.targetStatus;
        } else if (activeBatchAction.id === "FINALIZE_PHASE_ONE") {
          const interviewRow = finalizeInterviewRows[item.id];
          nextStatus =
            interviewRow?.decision === "REJECT"
              ? (interviewRow.rejectOutcome ?? "SUBMITTED")
              : "READY_FOR_ENROLLMENT";
        } else if (activeBatchAction.targetStatus) {
          nextStatus = activeBatchAction.targetStatus;
        }

        if (nextStatus) {
          return `Moved to: ${toReadableStatusLabel(nextStatus)}`;
        }

        return "Processed successfully";
      };

      const failed = [
        ...skippedAsFailed,
        ...skippedClientSide,
        ...(responseData.failed ?? []),
      ];

      const succeeded = (responseData.succeeded ?? []).map((item) => {
        const normalizedSucceededItem: BatchResults["succeeded"][number] = {
          ...item,
          previousStatus:
            item.previousStatus ??
            selectedApplicationsById[item.id]?.status ??
            "UPDATED",
          status:
            typeof item.status === "string" && item.status.trim()
              ? item.status
              : undefined,
        };

        return {
          ...normalizedSucceededItem,
          outcomeSummary: resolveSucceededOutcomeSummary(
            normalizedSucceededItem,
          ),
        };
      });

      setBatchResults({
        processed: selectedIds.size,
        succeeded,
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

        if (response?.status === 409 || response?.status === 309) {
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
      void fetchData();
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

  const handleScoreChange = useCallback((appId: number, value: string) => {
    setScores((prev) => ({
      ...prev,
      [appId]: value,
    }));
  }, []);

  const handleActionModalOpenChange = useCallback(
    (open: boolean) => {
      if (isBatchProcessing) {
        return;
      }

      setIsActionModalOpen(open);
      if (!open) {
        setActionFormError(null);
        void fetchData();
      }
    },
    [isBatchProcessing, fetchData],
  );

  const handleActionModalCancel = useCallback(() => {
    setIsActionModalOpen(false);
    setActionFormError(null);
    void fetchData();
  }, [fetchData]);

  const getNotQualifiedReason = useCallback((app: Application) => {
    if (app.status !== "FAILED_ASSESSMENT") return null;

    const assessments = app.assessments ?? [];

    const hasFailedExam = assessments.some(
      (assessment) =>
        assessment.type !== "INTERVIEW" &&
        String(assessment.result ?? "").toUpperCase() === "FAILED",
    );

    const hasFailedInterview = assessments.some(
      (assessment) =>
        assessment.type === "INTERVIEW" &&
        String(assessment.result ?? "").toUpperCase() === "FAILED",
    );

    if (hasFailedExam && hasFailedInterview) {
      return "Reason: Did not pass qualifying exam and interview.";
    }

    if (hasFailedExam) {
      return "Reason: Did not pass qualifying exam.";
    }

    if (hasFailedInterview) {
      return "Reason: Did not pass interview.";
    }

    const latestFailedAssessmentWithNotes = assessments.find(
      (assessment) =>
        String(assessment.result ?? "").toUpperCase() === "FAILED" &&
        Boolean(assessment.notes?.trim()),
    );

    if (latestFailedAssessmentWithNotes?.notes?.trim()) {
      return `Reason: ${latestFailedAssessmentWithNotes.notes.trim()}`;
    }

    return "Reason: Did not meet SCP assessment requirements.";
  }, []);

  const allSelected =
    selectableApplicationIds.length > 0 &&
    selectableApplicationIds.every((id) => selectedIds.has(id));

  const stageCounts = REGISTRATION_STAGE_QUICK_FILTERS.reduce<
    Record<string, number>
  >((acc, stage) => {
    acc[stage.value] =
      stage.value === "ALL"
        ? applications.length
        : applications.filter((app) => app.status === stage.value).length;
    return acc;
  }, {});

  const visibleStageFilters = useMemo(
    () =>
      REGISTRATION_STAGE_QUICK_FILTERS.filter(
        (stage) =>
          stage.value === "ALL" || (stageCounts[stage.value] ?? 0) >= 1,
      ),
    [stageCounts],
  );

  const contextualActionLabel = useMemo(() => {
    if (selectedIds.size === 0) return "Select Applicants to Batch";
    if (hasActionScopeConflict) return "Batch Action Unavailable";
    if (!activeBatchAction && singleSelectedStatus) {
      return `No Batch Action for ${singleSelectedStatus.replaceAll("_", " ")}`;
    }
    if (!activeBatchAction) return "No Batch Action";
    return `${activeBatchAction.buttonLabel} (${selectedIds.size})`;
  }, [
    selectedIds.size,
    hasActionScopeConflict,
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
      case "ASSIGN_REGULAR_SECTION":
        return <CheckSquare className="size-4 mr-1.5" />;
      case "SCHEDULE_EXAM":
        return <RefreshCw className="size-4 mr-1.5" />;
      case "RECORD_ASSESSMENT":
        return <Save className="size-4 mr-1.5" />;
      case "SCHEDULE_INTERVIEW":
        return <RefreshCw className="size-4 mr-1.5" />;
      case "FINALIZE_PHASE_ONE":
        return <CheckSquare className="size-4 mr-1.5" />;
      case "ENDORSE_REGULAR_TRACK":
        return <RefreshCw className="size-4 mr-1.5" />;
      default:
        return <AlertTriangle className="size-4 mr-1.5" />;
    }
  };

  const isContextualActionDisabled =
    selectedIds.size === 0 ||
    hasActionScopeConflict ||
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
            app.status === "EXAM_SCHEDULED" ? "EXAM_SCHEDULED" : app.status;
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
      case "ASSIGN_REGULAR_SECTION":
        return (
          scopedEligibleIds.length > 0 &&
          !hasMixedSelectedGradeLevels &&
          Boolean(selectedRegularSectionId) &&
          !isRegularSectionOverCapacity
        );
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
      case "ENDORSE_REGULAR_TRACK":
        return scopedEligibleIds.length > 0;
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
    isRegularSectionOverCapacity,
    hasMixedSelectedGradeLevels,
    scopedEligibleIds,
    selectedRegularSectionId,
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
        return "Mark at least one row for clearance after completing required checklist items (or set retained rows as Mark Retained).";
      case "ASSIGN_REGULAR_SECTION":
        if (hasMixedSelectedGradeLevels) {
          return "Selected applicants must belong to one grade level for section assignment.";
        }
        if (!selectedRegularSectionId) {
          return "Select a regular section before submitting this batch action.";
        }
        if (isRegularSectionOverCapacity) {
          return "Selected section is over capacity for this batch. Choose another section.";
        }
        return "Review section capacity and assignment scope before submitting.";
      case "SCHEDULE_EXAM":
        return null;
      case "RECORD_ASSESSMENT":
        return "Each eligible row must either be marked absent/no-show or contain valid scores (0-100).";
      case "SCHEDULE_INTERVIEW":
        return null;
      case "FINALIZE_PHASE_ONE":
        return "Complete interview decision requirements for all eligible rows.";
      case "ENDORSE_REGULAR_TRACK":
        return "This action moves FAILED_ASSESSMENT applicants to UNDER_REVIEW as regular-track learners.";
      default:
        return "Review all required fields before submitting.";
    }
  }, [
    activeBatchAction,
    hasMixedSelectedGradeLevels,
    isActionFormReady,
    isRegularSectionOverCapacity,
    selectedRegularSectionId,
  ]);

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
            verifyGridColumns={orderedVerifyGridColumns}
            verifyGridApplicants={verifyGridApplicants}
            verifyGridValues={verifyGridValues}
            verifyAcademicStatuses={verifyGridAcademicStatuses}
            verifyLrnDrafts={verifyGridLrnDrafts}
            lrnEditingId={verifyLrnEditingId}
            savingLrnId={verifyLrnSavingId}
            verifyAllChecked={verifyAllChecked}
            isBatchProcessing={isBatchProcessing}
            onReload={() => {
              void loadVerifyGridPreview();
            }}
            isVerifyColumnFullyChecked={isVerifyColumnFullyChecked}
            setVerifyColumnForAll={setVerifyColumnForAll}
            setVerifyAll={setVerifyAll}
            setVerifyCell={setVerifyCell}
            setVerifyRequiredDocsForRow={setVerifyRequiredDocsForRow}
            setVerifyAcademicStatus={setVerifyAcademicStatus}
            setVerifyLrnDraft={setVerifyLrnDraft}
            onStartLrnEdit={startVerifyLrnEdit}
            onCancelLrnEdit={cancelVerifyLrnEdit}
            onSaveLrn={(applicantId) => {
              void saveVerifyRowLrn(applicantId);
            }}
            verifyRowsMarked={verifyRowsMarked}
            isVerifyRowReady={isVerifyRowReady}
            setVerifyRowMarked={setVerifyRowMarked}
          />
        );
      case "ASSIGN_REGULAR_SECTION":
        return (
          <PipelineBatchRegularSectionAssignment
            loading={regularSectionsLoading}
            isBatchProcessing={isBatchProcessing}
            sections={availableRegularSections}
            selectedSectionId={selectedRegularSectionId}
            selectedGradeLevelLabel={selectedGradeLevelName}
            hasMixedGradeLevels={hasMixedSelectedGradeLevels}
            requiredSlots={scopedEligibleIds.length}
            onSelectSection={setSelectedRegularSectionId}
            onReload={() => {
              void loadRegularSections();
            }}
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
            isReadOnly
            options={{
              stepTemplate: examScheduleStepTemplate,
              selectedCount: selectedApplications.length,
            }}
          />
        );
      case "RECORD_ASSESSMENT":
        if (applicantType !== "REGULAR") {
          return (
            <PipelineBatchScpAssessmentInterviewGrid
              selectedApplications={selectedApplications}
              isBatchProcessing={isBatchProcessing}
              mode="RECORD_ASSESSMENT"
              assessmentCutoffScore={scpAssessmentCutoffScore}
              getScoreValue={getScpScoreValueForRow}
              getAbsentNoShow={getScpAbsentNoShow}
              onScoreChange={updateScpPrimaryScoreValue}
              onAbsentNoShowChange={setScpAbsentNoShow}
              isScoreInvalid={isScpScoreValueInvalid}
              getInterviewDecision={getScpInterviewDecision}
              onInterviewDecisionChange={setScpInterviewDecision}
            />
          );
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
            isReadOnly
            options={{
              stepTemplate: interviewScheduleStepTemplate,
              selectedCount: selectedApplications.length,
            }}
          />
        );
      case "FINALIZE_PHASE_ONE":
        if (applicantType !== "REGULAR") {
          return (
            <PipelineBatchScpAssessmentInterviewGrid
              selectedApplications={selectedApplications}
              isBatchProcessing={isBatchProcessing}
              mode="FINALIZE_PHASE_ONE"
              assessmentCutoffScore={scpAssessmentCutoffScore}
              getScoreValue={getScpScoreValueForRow}
              getAbsentNoShow={getScpAbsentNoShow}
              onScoreChange={updateScpPrimaryScoreValue}
              onAbsentNoShowChange={setScpAbsentNoShow}
              isScoreInvalid={isScpScoreValueInvalid}
              getInterviewDecision={getScpInterviewDecision}
              onInterviewDecisionChange={setScpInterviewDecision}
            />
          );
        }
        return (
          <PipelineBatchFinalizeInterviewGrid
            selectedApplications={selectedApplications}
            finalizeInterviewRows={finalizeInterviewRows}
            isBatchProcessing={isBatchProcessing}
            updateFinalizeRow={updateFinalizeRow}
          />
        );
      case "ENDORSE_REGULAR_TRACK":
        return (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
            <p className="text-sm font-bold text-foreground">
              Selected FAILED_ASSESSMENT applicants will be moved to
              UNDER_REVIEW.
            </p>
            <p className="text-xs font-bold text-foreground">
              Learners who did not pass SCP assessments are processed as regular
              track after this transition.
            </p>
          </div>
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
            <div className="relative">
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 pr-8">
                {visibleStageFilters.map((stage) => (
                  <Button
                    key={stage.value}
                    type="button"
                    size="sm"
                    variant={status === stage.value ? "default" : "outline"}
                    className="h-8 text-xs font-bold shrink-0"
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
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[hsl(var(--card))] to-transparent" />
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
                  disabled={
                    selectableApplicationIds.length === 0 || isBatchProcessing
                  }>
                  Select Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  onClick={invertCurrentPageSelection}
                  disabled={
                    selectableApplicationIds.length === 0 || isBatchProcessing
                  }>
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
                {hasActionScopeConflict ? (
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
                        {actionScopeConflictMessage}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    size="sm"
                    variant={selectedIds.size === 0 ? "outline" : "default"}
                    disabled={isContextualActionDisabled}
                    onClick={handleBatchProcess}
                    className={`font-bold w-full sm:w-auto ${
                      selectedIds.size === 0
                        ? "bg-muted text-muted-foreground border-border hover:bg-muted"
                        : ""
                    }`}>
                    {isBatchProcessing ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-1.5" />
                        Processing...
                      </>
                    ) : selectedIds.size === 0 ? (
                      <>{contextualActionLabel}</>
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

            {selectedIds.size > 0 && hasActionScopeConflict && (
              <p className="mt-2 text-xs font-bold text-destructive">
                {actionScopeConflictMessage}
              </p>
            )}
            {selectedIds.size > 0 &&
              !hasActionScopeConflict &&
              activeBatchAction && (
                <p className="mt-2 text-xs font-bold text-foreground">
                  Detected status: {singleSelectedStatus?.replaceAll("_", " ")}.
                  Available batch task: {activeBatchAction.buttonLabel}.
                </p>
              )}
            {selectedIds.size > 0 &&
              !hasActionScopeConflict &&
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

          <PipelineBatchApplicantsTable
            applications={applications}
            showSkeleton={showSkeleton}
            showAssessment={showAssessment}
            selectedIds={selectedIds}
            isBatchProcessing={isBatchProcessing}
            allSelected={allSelected}
            scores={scores}
            cutoffScore={cutoffScore}
            savingId={savingId}
            page={page}
            limit={limit}
            total={total}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onScoreChange={handleScoreChange}
            onSaveResult={handleSaveResult}
            onPageChange={setPage}
            getRemarkByScore={getRemarkByScore}
            getNotQualifiedReason={getNotQualifiedReason}
          />
        </CardContent>
      </Card>

      <PipelineBatchActionDialog
        open={isActionModalOpen}
        isBatchProcessing={isBatchProcessing}
        activeBatchAction={activeBatchAction}
        selectedIdsSize={selectedIds.size}
        selectedApplications={selectedApplications}
        preflightSummary={preflightSummary}
        actionFormError={actionFormError}
        actionReadinessHint={actionReadinessHint}
        derivedTargetStatus={derivedTargetStatus}
        isActionFormReady={isActionFormReady}
        actionSubmitCount={actionSubmitCount}
        renderActionForm={renderActionForm}
        onOpenChange={handleActionModalOpenChange}
        onCancel={handleActionModalCancel}
        onConfirm={handleConfirmBatchProcess}
      />

      {/* Batch Results Modal */}
      <BatchResultsModal
        results={batchResults}
        onReselectFailed={(ids) => setSelectedIds(new Set(ids))}
        onClose={handleResultsClose}
      />
    </>
  );
}
