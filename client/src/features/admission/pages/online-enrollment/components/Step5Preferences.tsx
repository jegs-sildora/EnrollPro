import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, BookOpen, Info } from "lucide-react";

import type { EnrollmentFormData } from "../types";
import {
  SPA_ART_FIELDS,
  SPS_SPORTS,
  SPFL_LANGUAGES,
  LEARNING_MODALITIES,
} from "../types";
import { cn, SCP_LABELS } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import api from "@/shared/api/axiosInstance";

const LEARNER_TYPES = [
  { value: "NEW_ENROLLEE", label: "NEW ENROLLEE" },
  { value: "TRANSFEREE", label: "TRANSFEREE" },
  { value: "RETURNING", label: "RETURNING" },
] as const;

const GRADE_OPTIONS = [
  { value: "7", label: "GRADE 7" },
  { value: "8", label: "GRADE 8" },
  { value: "9", label: "GRADE 9" },
  { value: "10", label: "GRADE 10" },
] as const;

type ScpTypeValue = NonNullable<EnrollmentFormData["scpType"]>;

const SCP_GRADE_RULE_TYPES = [
  "GENERAL_AVERAGE_MIN",
  "SUBJECT_AVERAGE_MIN",
  "SUBJECT_MINIMUMS",
] as const;

type ScpGradeRuleType = (typeof SCP_GRADE_RULE_TYPES)[number];

interface ParsedScpSubjectThreshold {
  subject: string;
  min: number;
}

interface ParsedScpGradeRequirement {
  ruleType: ScpGradeRuleType;
  minAverage: number | null;
  subjects: string[];
  subjectThresholds: ParsedScpSubjectThreshold[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePercent = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Number(value.toFixed(2));
  return rounded >= 0 && rounded <= 100 ? rounded : null;
};

const parseGradeRequirements = (
  value: unknown,
): ParsedScpGradeRequirement[] => {
  if (!Array.isArray(value)) {
    if (isRecord(value)) {
      const minGA = value.minimumGeneralAverage;
      if (typeof minGA === "number") {
        return [
          {
            ruleType: "GENERAL_AVERAGE_MIN",
            minAverage: minGA,
            subjects: [],
            subjectThresholds: [],
          },
        ];
      }
    }
    return [];
  }

  const parsed: ParsedScpGradeRequirement[] = [];

  for (const rule of value) {
    if (!isRecord(rule) || typeof rule.ruleType !== "string") {
      continue;
    }

    const normalizedRuleType = rule.ruleType.toUpperCase();
    if (
      !SCP_GRADE_RULE_TYPES.includes(normalizedRuleType as ScpGradeRuleType)
    ) {
      continue;
    }

    const subjects = Array.isArray(rule.subjects)
      ? rule.subjects
          .filter((subject): subject is string => typeof subject === "string")
          .map((subject) => subject.trim().toUpperCase())
          .filter(Boolean)
      : [];

    const subjectThresholds = Array.isArray(rule.subjectThresholds)
      ? rule.subjectThresholds.reduce<ParsedScpSubjectThreshold[]>(
          (acc, threshold) => {
            if (!isRecord(threshold) || typeof threshold.subject !== "string") {
              return acc;
            }

            const min = normalizePercent(threshold.min);
            if (min === null) {
              return acc;
            }

            acc.push({
              subject: threshold.subject.trim().toUpperCase(),
              min,
            });

            return acc;
          },
          [],
        )
      : [];

    parsed.push({
      ruleType: normalizedRuleType as ScpGradeRuleType,
      minAverage: normalizePercent(rule.minAverage),
      subjects,
      subjectThresholds,
    });
  }

  return parsed;
};

interface OfferedScpProgramConfig {
  scpType: ScpTypeValue;
  gradeRequirements: unknown;
}

const SCP_PROGRAMS: Array<{ id: ScpTypeValue; label: string; desc: string }> = [
  {
    id: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    label: SCP_LABELS.SCIENCE_TECHNOLOGY_AND_ENGINEERING,
    desc: "Written entrance exam + interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_THE_ARTS",
    label: SCP_LABELS.SPECIAL_PROGRAM_IN_THE_ARTS,
    desc: "Written exam + audition + interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_SPORTS",
    label: SCP_LABELS.SPECIAL_PROGRAM_IN_SPORTS,
    desc: "Physical tryout and sports screening.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_JOURNALISM",
    label: SCP_LABELS.SPECIAL_PROGRAM_IN_JOURNALISM,
    desc: "Written exam + interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    label: SCP_LABELS.SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE,
    desc: "Language aptitude screening.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: SCP_LABELS.SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION,
    desc: "Technical-vocational aptitude assessment.",
  },
] as const;

export default function Step5Enrollment() {
  const {
    watch,
    setValue,
    register,
    clearErrors,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");
  const isScpApplication = watch("isScpApplication");
  const scpType = watch("scpType");
  const quickLrnLookupId = watch("earlyRegistrationId");
  const hasNoLrn = watch("hasNoLrn");
  const artField = watch("artField");
  const sportsList = watch("sportsList");
  const foreignLanguage = watch("foreignLanguage");
  const learningModalities = watch("learningModalities");
  const reportedGa = watch("generalAverage");

  const [isLoadingScpConfig, setIsLoadingScpConfig] = useState(true);
  const [scpConfigError, setScpConfigError] = useState<string | null>(null);
  const [offeredScpConfigs, setOfferedScpConfigs] = useState<
    OfferedScpProgramConfig[]
  >([]);
  const [inputGaValue, setInputGaValue] = useState<string>("");

  useEffect(() => {
    if (reportedGa !== undefined && reportedGa !== null) {
      setInputGaValue(reportedGa.toString());
    }
  }, [reportedGa]);

  const selectedSportsList = sportsList ?? [];
  const selectedSportsCount = sportsList?.length ?? 0;
  const selectedLearningModalities = learningModalities ?? [];

  const isScpEligible = learnerType === "NEW_ENROLLEE" && gradeLevel === "7";
  const hasQuickLrnLookupSuccess =
    typeof quickLrnLookupId === "number" && Number.isFinite(quickLrnLookupId);
  const isProgramSelectionLocked = hasQuickLrnLookupSuccess;
  const shouldShowScpCard = isScpEligible && hasQuickLrnLookupSuccess;

  const availableScpPrograms = useMemo(
    () =>
      SCP_PROGRAMS.filter((program) =>
        offeredScpConfigs.some((config) => config.scpType === program.id),
      ),
    [offeredScpConfigs],
  );

  const hasOfferedScpPrograms = availableScpPrograms.length > 0;

  // Derive the effective GA threshold from offered configs (fallback: 85)
  const effectiveScpGaThreshold = useMemo(() => {
    let min = 85;
    for (const config of offeredScpConfigs) {
      const rules = parseGradeRequirements(config.gradeRequirements);
      const gaRule = rules.find((r) => r.ruleType === "GENERAL_AVERAGE_MIN");
      if (gaRule?.minAverage != null && Number.isFinite(gaRule.minAverage)) {
        min = Math.min(min, gaRule.minAverage);
      }
    }
    return min;
  }, [offeredScpConfigs]);

  const gaValue =
    typeof reportedGa === "number" && Number.isFinite(reportedGa)
      ? reportedGa
      : null;
  const gaEnteredAndBelowThreshold =
    isScpEligible && gaValue !== null && gaValue < effectiveScpGaThreshold;

  const canSelectScpTrack =
    shouldShowScpCard &&
    !isLoadingScpConfig &&
    hasOfferedScpPrograms &&
    !gaEnteredAndBelowThreshold;

  const canDeclareNoLrn =
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && gradeLevel === "7");
  const visibleGradeOptions =
    learnerType === "NEW_ENROLLEE"
      ? GRADE_OPTIONS.filter((option) => option.value === "7")
      : GRADE_OPTIONS;

  useEffect(() => {
    let isMounted = true;

    const loadScpConfig = async () => {
      setIsLoadingScpConfig(true);
      setScpConfigError(null);

      try {
        const response = await api.get<PublicScpConfigResponse>(
          "/settings/scp-config",
        );

        const offered = (response.data.scpProgramConfigs ?? []).reduce<
          OfferedScpProgramConfig[]
        >((acc, config) => {
          if (config.isOffered !== false && isScpTypeValue(config.scpType)) {
            acc.push({
              scpType: config.scpType,
              gradeRequirements: config.gradeRequirements,
            });
          }
          return acc;
        }, []);

        if (!isMounted) return;
        const deduped = Array.from(
          new Map(offered.map((config) => [config.scpType, config])).values(),
        );
        setOfferedScpConfigs(deduped);
      } catch (error) {
        console.error("Failed to load SCP configuration:", error);
        if (!isMounted) return;
        setOfferedScpConfigs([]);
        setScpConfigError(
          "We could not load available SCP tracks right now. Please try again in a few minutes.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingScpConfig(false);
        }
      }
    };

    void loadScpConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (learnerType === "NEW_ENROLLEE" && gradeLevel !== "7") {
      setValue("gradeLevel", "7", { shouldValidate: true });
    }
  }, [learnerType, gradeLevel, setValue]);

  useEffect(() => {
    if (!shouldShowScpCard && (isScpApplication || scpType)) {
      setValue("isScpApplication", false, { shouldValidate: true });
      setValue("scpType", undefined, { shouldValidate: true });
      clearErrors("scpType");
    }
  }, [shouldShowScpCard, isScpApplication, scpType, setValue, clearErrors]);

  useEffect(() => {
    if (isLoadingScpConfig || !isScpApplication || hasOfferedScpPrograms) {
      return;
    }

    setValue("isScpApplication", false, { shouldValidate: true });
    setValue("scpType", undefined, { shouldValidate: true });
    clearErrors("scpType");
  }, [
    isLoadingScpConfig,
    isScpApplication,
    hasOfferedScpPrograms,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (isLoadingScpConfig || !scpType) return;

    const isStillAvailable = availableScpPrograms.some(
      (program) => program.id === scpType,
    );

    if (!isStillAvailable) {
      setValue("isScpApplication", false, { shouldValidate: true });
      setValue("scpType", undefined, { shouldValidate: true });
      clearErrors("scpType");
    }
  }, [
    isLoadingScpConfig,
    scpType,
    availableScpPrograms,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (
      !isScpApplication &&
      (scpType || artField || selectedSportsCount > 0 || foreignLanguage)
    ) {
      setValue("scpType", undefined, { shouldValidate: true });
      setValue("artField", undefined, { shouldValidate: true });
      setValue("sportsList", [], { shouldValidate: true });
      setValue("foreignLanguage", undefined, { shouldValidate: true });
      clearErrors(["scpType", "artField", "sportsList", "foreignLanguage"]);
    }
  }, [
    isScpApplication,
    scpType,
    artField,
    selectedSportsCount,
    foreignLanguage,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (scpType !== "SPECIAL_PROGRAM_IN_THE_ARTS" && artField) {
      setValue("artField", undefined, { shouldValidate: true });
      clearErrors("artField");
    }

    if (scpType !== "SPECIAL_PROGRAM_IN_SPORTS" && selectedSportsCount > 0) {
      setValue("sportsList", [], { shouldValidate: true });
      clearErrors("sportsList");
    }

    if (scpType !== "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE" && foreignLanguage) {
      setValue("foreignLanguage", undefined, { shouldValidate: true });
      clearErrors("foreignLanguage");
    }
  }, [
    scpType,
    artField,
    selectedSportsCount,
    foreignLanguage,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (!canDeclareNoLrn && hasNoLrn) {
      setValue("hasNoLrn", false, { shouldValidate: true, shouldDirty: true });
      clearErrors("hasNoLrn");
    }
  }, [canDeclareNoLrn, hasNoLrn, setValue, clearErrors]);

  const selectRegularTrack = () => {
    if (isProgramSelectionLocked) return;
    setValue("isScpApplication", false, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("scpType", undefined, { shouldValidate: true, shouldDirty: true });
    clearErrors("scpType");
  };

  const selectScpTrack = () => {
    if (!canSelectScpTrack || isProgramSelectionLocked) return;
    setValue("isScpApplication", true, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Label className="text-sm font-bold uppercase tracking-widest text-primary">
          Learner Category <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LEARNER_TYPES.map((typeOption) => (
            <button
              key={typeOption.value}
              type="button"
              onClick={() =>
                setValue("learnerType", typeOption.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                learnerType === typeOption.value
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-white hover:bg-primary/5 text-muted-foreground hover:text-foreground",
              )}>
              <span className="font-bold text-sm leading-tight tracking-wide">
                {typeOption.label}
              </span>
            </button>
          ))}
        </div>
        {errors.learnerType?.message && (
          <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" /> {errors.learnerType.message}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Label className="text-sm font-bold uppercase tracking-widest text-primary">
          Grade Level to Apply for <span className="text-destructive">*</span>
        </Label>
        <div
          className={cn(
            "grid gap-3",
            learnerType === "NEW_ENROLLEE"
              ? "grid-cols-1"
              : "grid-cols-2 sm:grid-cols-4",
          )}>
          {visibleGradeOptions.map((gradeOption) => (
            <button
              key={gradeOption.value}
              type="button"
              onClick={() =>
                setValue("gradeLevel", gradeOption.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              className={cn(
                "relative flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all h-14 uppercase",
                gradeLevel === gradeOption.value
                  ? "border-primary bg-primary text-white shadow-sm ring-1 ring-primary"
                  : "border-border bg-white hover:border-primary/50 hover:bg-primary/5",
              )}>
              <span className="text-sm font-bold leading-tight">
                {gradeOption.label}
              </span>
            </button>
          ))}
        </div>
        {errors.gradeLevel?.message && (
          <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" /> {errors.gradeLevel.message}
          </p>
        )}
      </div>

      <div className="space-y-3 p-5 bg-muted/30 rounded-2xl border border-border/50">
        <Label
          htmlFor="generalAverage"
          className="text-sm font-bold uppercase tracking-widest text-primary">
          General Average <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <Input
              id="generalAverage"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 88.50"
              className={cn(
                "h-12 font-bold text-lg bg-white border-2",
                gaEnteredAndBelowThreshold &&
                  "border-amber-400 focus-visible:ring-amber-400",
                errors.generalAverage && "border-destructive",
              )}
              value={inputGaValue}
              onChange={(e) => {
                const val = e.target.value;
                // Allow only digits and at most one decimal point with 2 places
                if (val === "" || /^(\d+)?(\.\d{0,2})?$/.test(val)) {
                  const parsed = val === "" ? null : parseFloat(val);

                  if (parsed === null || (!isNaN(parsed) && parsed <= 100)) {
                    setValue(
                      "generalAverage",
                      parsed === null ? null : Number(parsed.toFixed(2)),
                      { shouldValidate: true, shouldDirty: true },
                    );
                    setInputGaValue(val);
                  }
                }
              }}
            />
            <p className="font-bold text-xs italic flex items-center gap-1 text-muted-foreground">
              <Info className="w-4 h-4" />
              Final general average from the last completed grade level.
            </p>
          </div>

          {gaEnteredAndBelowThreshold && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                Your general average ({gaValue}%) is below the minimum{" "}
                <strong>{effectiveScpGaThreshold}%</strong> required to apply
                for any Special Curricular Program. You may still proceed with a
                Regular Section.
              </p>
            </div>
          )}
        </div>
        {errors.generalAverage?.message && (
          <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.generalAverage.message}
          </p>
        )}
      </div>

      <div className="space-y-8 pb-8">
        <div className="p-6 border bg-primary/5 border-primary/20 rounded-2xl space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <Label className="text-base font-bold text-primary">
              Learning Program <span className="text-destructive">*</span>
            </Label>
          </div>

          <div
            className={cn(
              "grid gap-4",
              shouldShowScpCard ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
            )}>
            <button
              type="button"
              disabled={isProgramSelectionLocked}
              className={cn(
                "flex flex-col p-4 rounded-xl border-2 transition-all text-left",
                !isScpApplication
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white hover:bg-primary/5",
              )}
              onClick={selectRegularTrack}>
              <div className="flex items-center gap-3 mb-1">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    !isScpApplication
                      ? "border-white"
                      : "border-muted-foreground",
                  )}>
                  {!isScpApplication && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="font-bold">Regular Section</span>
              </div>
              <p
                className={cn(
                  "text-xs pl-8",
                  !isScpApplication
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}>
                Standard Junior High curriculum.
              </p>
            </button>

            {shouldShowScpCard && (
              <button
                type="button"
                disabled={!canSelectScpTrack || isProgramSelectionLocked}
                className={cn(
                  "flex flex-col p-4 rounded-xl border-2 transition-all text-left",
                  isScpApplication
                    ? "border-primary bg-primary text-primary-foreground"
                    : canSelectScpTrack
                      ? "border-border bg-white hover:bg-primary/5"
                      : "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-70",
                )}
                onClick={selectScpTrack}>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      isScpApplication
                        ? "border-white"
                        : "border-muted-foreground",
                    )}>
                    {isScpApplication && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="font-bold">
                    Special Curricular Program (SCP)
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs pl-8",
                    isScpApplication
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}>
                  {isLoadingScpConfig
                    ? "Loading available SCP tracks..."
                    : hasOfferedScpPrograms
                      ? "Select this if the learner will apply for an SCP track."
                      : "No SCP tracks are open for this School Year."}
                </p>
              </button>
            )}
          </div>

          {isProgramSelectionLocked && (
            <p className="font-bold text-xs italic flex items-center gap-1 text-muted-foreground">
              <Info className="w-4 h-4" />
              Learning Program and SCP selection are locked because this form is linked to an existing Early Registration.
            </p>
          )}

          {!isScpEligible && (
            <p className="font-bold text-xs italic flex items-center gap-1 text-muted-foreground">
              <Info className="w-4 h-4" />
              SCP is available only for New Enrollees applying for Grade 7.
            </p>
          )}

          {shouldShowScpCard && isLoadingScpConfig && (
            <p className="font-bold text-xs italic flex items-center gap-1 text-muted-foreground">
              <Info className="w-4 h-4" />
              Loading available SCP programs...
            </p>
          )}

          {shouldShowScpCard && !isLoadingScpConfig && scpConfigError && (
            <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" />
              {scpConfigError}
            </p>
          )}

          {shouldShowScpCard &&
            !isLoadingScpConfig &&
            !scpConfigError &&
            !hasOfferedScpPrograms && (
              <p className="font-bold text-xs italic flex items-center gap-1 text-muted-foreground">
                <Info className="w-4 h-4" />
                No SCP programs are currently offered for this School Year.
              </p>
            )}

          <AnimatePresence>
            {isScpApplication && shouldShowScpCard && hasOfferedScpPrograms && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="pt-6 space-y-6">
                  <Label className="text-sm font-bold uppercase tracking-widest text-primary">
                    Select SCP Program{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-1 gap-3">
                    {availableScpPrograms.map((program) => (
                      <div key={program.id} className="space-y-0">
                        <button
                          type="button"
                          disabled={isProgramSelectionLocked}
                          className={cn(
                            "w-full flex flex-col p-4 rounded-xl border-2 transition-all text-left",
                            scpType === program.id
                              ? "border-primary bg-primary text-primary-foreground shadow-md"
                              : "border-border bg-white text-foreground hover:bg-primary/5",
                          )}
                          onClick={() =>
                            setValue("scpType", program.id, {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }>
                          <div className="flex items-center gap-3 mb-1">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                scpType === program.id
                                  ? "border-white"
                                  : "border-muted-foreground",
                              )}>
                              {scpType === program.id && (
                                <div className="w-2.5 h-2.5 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="font-bold">{program.label}</span>
                          </div>
                          <p
                            className={cn(
                              "text-[0.6875rem] pl-8 italic",
                              scpType === program.id
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground",
                            )}>
                            {program.desc}
                          </p>
                        </button>

                        <AnimatePresence>
                          {scpType === program.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="pl-8 pt-4">
                                {program.id ===
                                  "SPECIAL_PROGRAM_IN_THE_ARTS" && (
                                  <div className="space-y-2">
                                    <Label className="text-[0.625rem] font-bold uppercase text-primary">
                                      Preferred Art Field *
                                    </Label>
                                    <Select
                                      disabled={isProgramSelectionLocked}
                                      onValueChange={(value) =>
                                        setValue("artField", value, {
                                          shouldValidate: true,
                                          shouldDirty: true,
                                        })
                                      }
                                      value={artField}>
                                      <SelectTrigger className="h-10 bg-white border-2 font-bold">
                                        <SelectValue placeholder="Select Art Field" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SPA_ART_FIELDS.map((field) => (
                                          <SelectItem key={field} value={field}>
                                            {field}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {program.id === "SPECIAL_PROGRAM_IN_SPORTS" && (
                                  <div className="space-y-2">
                                    <Label className="text-[0.625rem] font-bold uppercase text-primary">
                                      Primary Sport *
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {SPS_SPORTS.map((sport) => (
                                        <div
                                          key={sport}
                                          className="flex items-center space-x-2">
                                          <Checkbox
                                            id={`sport-${sport}`}
                                            disabled={isProgramSelectionLocked}
                                            checked={selectedSportsList.includes(
                                              sport,
                                            )}
                                            onCheckedChange={(checked) => {
                                              const nextSports = checked
                                                ? [...selectedSportsList, sport]
                                                : selectedSportsList.filter(
                                                    (item) => item !== sport,
                                                  );
                                              setValue(
                                                "sportsList",
                                                nextSports,
                                                {
                                                  shouldValidate: true,
                                                  shouldDirty: true,
                                                },
                                              );
                                            }}
                                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                          />
                                          <Label
                                            htmlFor={`sport-${sport}`}
                                            className="text-xs font-medium cursor-pointer">
                                            {sport}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {program.id ===
                                  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE" && (
                                  <div className="space-y-2">
                                    <Label className="text-[0.625rem] font-bold uppercase text-primary">
                                      Preferred Language *
                                    </Label>
                                    <Select
                                      disabled={isProgramSelectionLocked}
                                      onValueChange={(value) =>
                                        setValue("foreignLanguage", value, {
                                          shouldValidate: true,
                                          shouldDirty: true,
                                        })
                                      }
                                      value={foreignLanguage}>
                                      <SelectTrigger className="h-10 bg-white border-2 font-bold">
                                        <SelectValue placeholder="Select Language" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SPFL_LANGUAGES.map((language) => (
                                          <SelectItem
                                            key={language}
                                            value={language}>
                                            {language}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                  {errors.scpType?.message && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3" />{" "}
                      {errors.scpType.message}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-10 pt-6 border-t border-border/40">
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            If the school implements other distance learning modalities aside
            from face-to-face instruction, which would the learner prefer? Check
            all that applies:
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {LEARNING_MODALITIES.map((modality) => (
              <div key={modality} className="flex items-center space-x-3">
                <Checkbox
                  id={`modality-${modality}`}
                  checked={selectedLearningModalities.includes(modality)}
                  onCheckedChange={(checked) => {
                    const nextModalities = checked
                      ? [...selectedLearningModalities, modality]
                      : selectedLearningModalities.filter(
                          (item) => item !== modality,
                        );

                    setValue("learningModalities", nextModalities, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                />
                <Label
                  htmlFor={`modality-${modality}`}
                  className="text-sm font-medium cursor-pointer">
                  {modality}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
