import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { SCP_TYPES } from "../constants";
import type {
  ScpConfig,
  ScpGradeRequirementRule,
  ScpStepConfig,
  RubricCategory,
} from "../types";
import {
  getDefaultProgramSteps,
  getSteProgramSteps,
  mergeSteProgramSteps,
} from "../utils/scpSteps";

const DEFAULT_CUTOFF_SCORE = 50;
const DEFAULT_MAX_SLOTS = 70;
const DEFAULT_NOTES = "...";

function getVenueByScpType(scpType: string): string {
  switch (scpType) {
    case "SCIENCE_TECHNOLOGY_AND_ENGINEERING":
      return "Science Laboratory";
    case "SPECIAL_PROGRAM_IN_THE_ARTS":
      return "Arts Laboratory";
    case "SPECIAL_PROGRAM_IN_SPORTS":
      return "Sports Complex";
    case "SPECIAL_PROGRAM_IN_JOURNALISM":
      return "Journalism Laboratory";
    case "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE":
      return "Language Laboratory";
    case "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION":
      return "Technical-Vocational Laboratory";
    default:
      return "SCP Laboratory";
  }
}

function getTodayMachineDateIso(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0)).toISOString();
}

function getDefaultInterviewRubric(): RubricCategory[] {
  const steInterviewStep = getSteProgramSteps(false).find(
    (step) => step.kind === "INTERVIEW",
  );

  return cloneUnknown(steInterviewStep?.rubric ?? []) as RubricCategory[];
}

function applyScpSampleDefaults(base: ScpConfig): ScpConfig {
  const venue = getVenueByScpType(base.scpType);
  const todayIso = getTodayMachineDateIso();
  const interviewRubric = getDefaultInterviewRubric();
  const steps = base.steps.length
    ? base.steps
    : getDefaultProgramSteps(base.scpType, base.isTwoPhase ?? false);

  const normalizedSteps = withDefaultStepTimesStandalone(steps).map((step) => {
    const isExam =
      step.kind === "QUALIFYING_EXAMINATION" ||
      step.kind === "PRELIMINARY_EXAMINATION" ||
      step.kind === "FINAL_EXAMINATION";
    const isInterview = step.kind === "INTERVIEW";

    return {
      ...step,
      cutoffScore:
        isExam && step.cutoffScore == null
          ? DEFAULT_CUTOFF_SCORE
          : step.cutoffScore ?? null,
      venue: step.venue?.trim() ? step.venue : venue,
      notes: step.notes?.trim() ? step.notes : DEFAULT_NOTES,
      scheduledDate:
        (step.kind === "QUALIFYING_EXAMINATION" || isInterview) &&
        !step.scheduledDate
          ? todayIso
          : step.scheduledDate,
      rubric: isInterview
        ? Array.isArray(step.rubric) && step.rubric.length > 0
          ? cloneUnknown(step.rubric)
          : cloneUnknown(interviewRubric)
        : step.rubric ?? null,
    };
  });

  return {
    ...base,
    isOffered: base.isOffered ?? true,
    maxSlots: base.maxSlots ?? DEFAULT_MAX_SLOTS,
    cutoffScore: base.cutoffScore ?? DEFAULT_CUTOFF_SCORE,
    notes: base.notes?.trim() ? base.notes : DEFAULT_NOTES,
    artFields:
      base.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS"
        ? base.artFields.length > 0
          ? base.artFields
          : ["Visual Arts", "Music", "Theater Arts"]
        : base.artFields,
    languages:
      base.scpType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
        ? base.languages.length > 0
          ? base.languages
          : ["Spanish", "Japanese", "French"]
        : base.languages,
    sportsList:
      base.scpType === "SPECIAL_PROGRAM_IN_SPORTS"
        ? base.sportsList.length > 0
          ? base.sportsList
          : ["Basketball", "Volleyball", "Athletics"]
        : base.sportsList,
    steps: normalizedSteps,
  };
}

function withDefaultStepTimesStandalone(
  steps: ScpStepConfig[] | null | undefined,
): ScpStepConfig[] {
  return (steps ?? []).map((step) => ({
    ...step,
    scheduledTime: step.scheduledTime?.trim() || "08:00 AM",
  }));
}

function cloneUnknown<T>(value: T): T {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneScpConfigs(configs: ScpConfig[]): ScpConfig[] {
  return configs.map((scp) => ({
    ...scp,
    artFields: [...scp.artFields],
    languages: [...scp.languages],
    sportsList: [...scp.sportsList],
    gradeRequirements: cloneUnknown(scp.gradeRequirements),
    rankingFormula: cloneUnknown(scp.rankingFormula),
    steps: scp.steps.map((step) => ({ 
      ...step,
      rubric: step.rubric ? cloneUnknown(step.rubric) : null
    })),
  }));
}

function extractMaxSlotsFromRankingFormula(
  rankingFormula: unknown,
): number | null {
  if (
    !rankingFormula ||
    typeof rankingFormula !== "object" ||
    Array.isArray(rankingFormula)
  ) {
    return null;
  }

  const maxSlots = (rankingFormula as Record<string, unknown>).maxSlots;
  if (typeof maxSlots !== "number" || !Number.isFinite(maxSlots)) {
    return null;
  }

  const normalizedMaxSlots = Math.trunc(maxSlots);
  return normalizedMaxSlots > 0 ? normalizedMaxSlots : null;
}

function normalizeRankingFormulaForPayload(
  rankingFormula: unknown,
): unknown | null {
  if (
    !rankingFormula ||
    typeof rankingFormula !== "object" ||
    Array.isArray(rankingFormula)
  ) {
    return null;
  }

  const clonedRankingFormula = cloneUnknown(
    rankingFormula as Record<string, unknown>,
  );

  const components = (clonedRankingFormula as Record<string, unknown>)
    .components;
  if (!Array.isArray(components) || components.length === 0) {
    return null;
  }

  return clonedRankingFormula;
}

export function useCurriculumScpConfigs() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [scpConfigs, setScpConfigs] = useState<ScpConfig[]>([]);
  const [initialScpConfigs, setInitialScpConfigs] = useState<ScpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingScp, setSavingScp] = useState(false);

  const withDefaultStepTimes = useCallback(
    (steps: ScpStepConfig[] | null | undefined): ScpStepConfig[] =>
      withDefaultStepTimesStandalone(steps),
    [],
  );

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setScpConfigs([]);
      setInitialScpConfigs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const scpRes = await api.get(`/curriculum/${ayId}/scp-config`);
      const fetched = scpRes.data.scpProgramConfigs as ScpConfig[];

      const merged = SCP_TYPES.map((type) => {
        const found = fetched.find((config) => config.scpType === type.value);

        if (found) {
          return applyScpSampleDefaults({
            ...found,
            isOffered: found.isOffered ?? false,
            isTwoPhase: found.isTwoPhase ?? false,
            maxSlots: extractMaxSlotsFromRankingFormula(found.rankingFormula),
            notes: found.notes ?? null,
            gradeRequirements: found.gradeRequirements ?? null,
            rankingFormula: normalizeRankingFormulaForPayload(
              found.rankingFormula,
            ),
            steps: withDefaultStepTimes(found.steps),
          });
        }

        return applyScpSampleDefaults({
          scpType: type.value,
          isOffered: false,
          isTwoPhase: false,
          maxSlots: null,
          cutoffScore: null,
          notes: null,
          gradeRequirements: null,
          rankingFormula: null,
          artFields: [],
          languages: [],
          sportsList: [],
          steps: [],
        });
      });

      const cloned = cloneScpConfigs(merged);
      setScpConfigs(cloned);
      setInitialScpConfigs(cloneScpConfigs(cloned));
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, withDefaultStepTimes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateScpField = useCallback(
    (
      index: number,
      field: keyof ScpConfig,
      value: string | boolean | number | string[] | null,
    ) => {
      setScpConfigs((current) => {
        const next = [...current];
        next[index] = { ...next[index], [field]: value };

        if (field === "isOffered" && value === true) {
          const scpType = next[index].scpType;

          if (next[index].steps.length === 0) {
            next[index] = {
              ...next[index],
              steps: getDefaultProgramSteps(scpType, next[index].isTwoPhase),
            };
          }
        }

        if (field === "isTwoPhase") {
          if (current[index].isTwoPhase !== value) {
            next[index] = {
              ...next[index],
              steps: mergeSteProgramSteps(
                current[index].steps,
                value as boolean,
              ),
            };
          }
        }

        return next;
      });
    },
    [],
  );

  const handleUpdateStep = useCallback(
    (
      scpIndex: number,
      stepIndex: number,
      field: keyof ScpStepConfig,
      value: unknown,
    ) => {
      setScpConfigs((current) => {
        const next = cloneScpConfigs(current);
        const steps = next[scpIndex].steps;
        const normalizedValue =
          field === "scheduledTime" &&
          (value == null || String(value).trim() === "")
            ? "08:00 AM"
            : value;
        
        steps[stepIndex] = {
          ...steps[stepIndex],
          [field]: normalizedValue,
        };
        
        return next;
      });
    },
    [],
  );

  const handleUpdateGradeRequirements = useCallback(
    (index: number, rules: ScpGradeRequirementRule[]) => {
      setScpConfigs((current) => {
        const next = [...current];
        next[index] = { ...next[index], gradeRequirements: rules };
        return next;
      });
    },
    [],
  );

  const handleSaveScp = useCallback(async () => {
    if (!ayId) {
      return;
    }

    setSavingScp(true);

    try {
      const uppercasedConfigs = scpConfigs.map((scp) => ({
        ...scp,
        isTwoPhase: scp.isTwoPhase ?? false,
        maxSlots:
          typeof scp.maxSlots === "number" && scp.maxSlots > 0
            ? Math.trunc(scp.maxSlots)
            : null,
        artFields: scp.artFields.map((field) => field.trim().toUpperCase()),
        languages: scp.languages.map((language) =>
          language.trim().toUpperCase(),
        ),
        sportsList: scp.sportsList.map((sport) => sport.trim().toUpperCase()),
        notes: scp.notes ?? null,
        gradeRequirements: scp.gradeRequirements ?? null,
        rankingFormula: normalizeRankingFormulaForPayload(scp.rankingFormula),
        steps: scp.steps.map((step) => {
           // EXPLICIT HIGH-FIDELITY SERIALIZATION
           let cleanRubric: Record<string, unknown>[] | null = null;
           
           if (Array.isArray(step.rubric)) {
              cleanRubric = (step.rubric as RubricCategory[]).map((cat) => ({
                id: String(cat.id),
                name: String(cat.name || ""),
                criteria: cat.criteria.map((crit) => ({
                  id: String(crit.id),
                  name: String(crit.name || ""),
                  description: crit.description ? String(crit.description) : null,
                  maxPts: Number(crit.maxPts) || 0,
                })),
              }));
           }

           return {
            id: step.id,
            stepOrder: step.stepOrder,
            kind: step.kind,
            label: step.label,
            description: step.description,
            isRequired: step.isRequired,
            scheduledDate: step.scheduledDate,
            scheduledTime: step.scheduledTime,
            venue: step.venue?.trim().toUpperCase() || null,
            notes: step.notes ?? null,
            cutoffScore: step.cutoffScore ?? null,
            rubric: cleanRubric,
           };
        }),
      }));

      await api.put(`/curriculum/${ayId}/scp-config`, {
        scpProgramConfigs: uppercasedConfigs,
      });

      sileo.success({
        title: "SCP Configuration Saved",
        description: "Special programs updated for this year.",
      });

      fetchData();
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setSavingScp(false);
    }
  }, [ayId, fetchData, scpConfigs]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(scpConfigs) !== JSON.stringify(initialScpConfigs);
  }, [initialScpConfigs, scpConfigs]);

  const handleDiscardScpChanges = useCallback(() => {
    setScpConfigs(cloneScpConfigs(initialScpConfigs));
    sileo.info({
      title: "Changes discarded",
      description: "Curriculum configurations were restored.",
    });
  }, [initialScpConfigs]);

  return {
    ayId,
    scpConfigs,
    hasUnsavedChanges,
    loading,
    savingScp,
    handleUpdateScpField,
    handleUpdateStep,
    handleUpdateGradeRequirements,
    handleDiscardScpChanges,
    handleSaveScp,
  };
}
