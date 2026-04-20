import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { SCP_TYPES } from "../constants";
import type { ScpConfig, ScpStepConfig } from "../types";
import { getDefaultProgramSteps, getSteProgramSteps } from "../utils/scpSteps";

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
    steps: scp.steps.map((step) => ({ ...step })),
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

  const components = (rankingFormula as Record<string, unknown>).components;
  if (!Array.isArray(components) || components.length === 0) {
    return null;
  }

  return {
    components: components.map((component) => ({
      ...(component as Record<string, unknown>),
    })),
  };
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
      (steps ?? []).map((step) => ({
        ...step,
        scheduledTime: step.scheduledTime?.trim() || "08:00 AM",
      })),
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
          return {
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
          };
        }

        return {
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
        };
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
          next[index] = {
            ...next[index],
            steps: getSteProgramSteps(value as boolean),
          };
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
      value: string | boolean | number | null,
    ) => {
      setScpConfigs((current) => {
        const next = [...current];
        const steps = [...next[scpIndex].steps];
        const normalizedValue =
          field === "scheduledTime" &&
          (value == null || String(value).trim() === "")
            ? "08:00 AM"
            : value;
        steps[stepIndex] = {
          ...steps[stepIndex],
          [field]: normalizedValue,
        };
        next[scpIndex] = { ...next[scpIndex], steps };
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
        steps: scp.steps.map((step) => ({
          ...step,
          venue: step.venue?.trim().toUpperCase() || null,
          cutoffScore: step.cutoffScore ?? null,
        })),
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
    handleDiscardScpChanges,
    handleSaveScp,
  };
}
