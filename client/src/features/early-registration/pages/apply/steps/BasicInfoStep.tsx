import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { AlertCircle, BookOpen, Info, School } from "lucide-react";
import { cn, SCP_LABELS } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
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

type ScpTypeValue = NonNullable<EarlyRegFormData["scpType"]>;

const SCP_PROGRAMS: Array<{ id: ScpTypeValue; description: string }> = [
  {
    id: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    description: "Take a written entrance exam and interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_THE_ARTS",
    description: "Take a written exam, audition, and interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_SPORTS",
    description: "Join a sports tryout and screening.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_JOURNALISM",
    description: "Take a journalism screening exam and interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    description: "Take a language aptitude screening.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    description: "Take a technical-vocational aptitude assessment.",
  },
];

const SCP_GRADE_RULE_TYPES = [
  "GENERAL_AVERAGE_MIN",
  "SUBJECT_AVERAGE_MIN",
  "SUBJECT_MINIMUMS",
] as const;

type ScpGradeRuleType = (typeof SCP_GRADE_RULE_TYPES)[number];
type RequirementStatus = "REQUIRED" | "RECOMMENDED";

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

interface ScpDocumentRequirementItem {
  label: string;
  status: RequirementStatus;
  note?: string;
}

interface ScpRequirementCardData {
  prerequisiteLines: string[];
  documentaryRequirements: ScpDocumentRequirementItem[];
  note: string | null;
  usingConfiguredPrerequisites: boolean;
}

const SUBJECT_LABELS: Record<string, string> = {
  ENGLISH: "English",
  SCIENCE: "Science",
  MATHEMATICS: "Mathematics",
  FILIPINO: "Filipino",
  GENERAL_AVERAGE: "General Average",
};

const SCP_FALLBACK_PREREQUISITES: Record<ScpTypeValue, string[]> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: [
    "Average in English, Science, and Mathematics (Grade 6, Quarters 1-3) must be at least 85%.",
  ],
  SPECIAL_PROGRAM_IN_THE_ARTS: [
    "General Average in the latest report card must be at least 85%.",
  ],
  SPECIAL_PROGRAM_IN_SPORTS: [
    "General Average in the latest SF9 / Report Card must be at least 85%.",
  ],
  SPECIAL_PROGRAM_IN_JOURNALISM: [
    "English and Filipino grades should each be at least 85%.",
  ],
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [
    "English grade should be at least 85%.",
  ],
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: [
    "General Average should meet the school's baseline passing requirement.",
    "Learners must demonstrate practical aptitude for technical-vocational training.",
  ],
};

const SCP_FALLBACK_DOCUMENTS: Record<
  ScpTypeValue,
  ScpDocumentRequirementItem[]
> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: [
    { label: "SF9 / Report Card", status: "REQUIRED" },
    { label: "PSA Birth Certificate", status: "REQUIRED" },
    {
      label: "Certificate of Good Moral Character",
      status: "REQUIRED",
    },
    { label: "Medical Certificate", status: "REQUIRED" },
    {
      label: "1x1 or 2x2 ID Picture (2 pieces)",
      status: "REQUIRED",
    },
    { label: "Long Plastic Envelope (1 piece)", status: "REQUIRED" },
  ],
  SPECIAL_PROGRAM_IN_THE_ARTS: [
    { label: "Accomplished Application Form", status: "REQUIRED" },
    { label: "SF9 / Report Card", status: "REQUIRED" },
    { label: "PSA Birth Certificate", status: "REQUIRED" },
  ],
  SPECIAL_PROGRAM_IN_SPORTS: [
    { label: "Accomplished Application Form", status: "REQUIRED" },
    { label: "SF9 / Report Card", status: "REQUIRED" },
    { label: "PSA Birth Certificate", status: "REQUIRED" },
    {
      label: "Awards / Certificates of Recognition in chosen sport",
      status: "REQUIRED",
    },
  ],
  SPECIAL_PROGRAM_IN_JOURNALISM: [
    { label: "Accomplished Application Form", status: "REQUIRED" },
    { label: "SF9 / Report Card", status: "REQUIRED" },
    { label: "PSA Birth Certificate", status: "REQUIRED" },
    {
      label: "Portfolio of published works",
      status: "RECOMMENDED",
      note: "Highly recommended if available.",
    },
  ],
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [
    { label: "Accomplished Application Form", status: "REQUIRED" },
    { label: "SF9 / Report Card", status: "REQUIRED" },
    { label: "PSA Birth Certificate", status: "REQUIRED" },
  ],
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: [
    { label: "Accomplished Application Form", status: "REQUIRED" },
    { label: "SF9 / Report Card", status: "REQUIRED" },
    { label: "PSA Birth Certificate", status: "REQUIRED" },
    {
      label: "Certificate of Good Moral Character",
      status: "REQUIRED",
    },
  ],
};

const SCP_FALLBACK_NOTES: Partial<Record<ScpTypeValue, string>> = {
  SPECIAL_PROGRAM_IN_THE_ARTS:
    "SPA entrance exam / audition is administered during the enrollment phase.",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePercent = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Number(value.toFixed(2));
  return rounded >= 0 && rounded <= 100 ? rounded : null;
};

const formatSubjectToken = (token: string): string => {
  const normalized = token.trim().toUpperCase();
  if (SUBJECT_LABELS[normalized]) {
    return SUBJECT_LABELS[normalized];
  }

  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatSubjectList = (subjects: string[]): string => {
  const labels = subjects.map((subject) => formatSubjectToken(subject));

  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const parseGradeRequirements = (
  value: unknown,
): ParsedScpGradeRequirement[] => {
  if (!Array.isArray(value)) {
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

const buildPrerequisiteLines = (
  requirements: ParsedScpGradeRequirement[],
): string[] => {
  const lines: string[] = [];

  for (const requirement of requirements) {
    if (
      requirement.ruleType === "GENERAL_AVERAGE_MIN" &&
      requirement.minAverage !== null
    ) {
      lines.push(
        `General Average must be at least ${requirement.minAverage}%.`,
      );
      continue;
    }

    if (
      requirement.ruleType === "SUBJECT_AVERAGE_MIN" &&
      requirement.minAverage !== null &&
      requirement.subjects.length > 0
    ) {
      lines.push(
        `Average in ${formatSubjectList(requirement.subjects)} must be at least ${requirement.minAverage}%.`,
      );
      continue;
    }

    if (
      requirement.ruleType === "SUBJECT_MINIMUMS" &&
      requirement.subjectThresholds.length > 0
    ) {
      const formattedThresholds = requirement.subjectThresholds
        .map(
          (threshold) =>
            `${formatSubjectToken(threshold.subject)} >= ${threshold.min}%`,
        )
        .join(", ");

      lines.push(`Subject minimums: ${formattedThresholds}.`);
    }
  }

  return Array.from(new Set(lines));
};

interface PublicScpProgramConfig {
  scpType: unknown;
  isOffered?: boolean;
  gradeRequirements?: unknown;
  notes?: unknown;
}

interface OfferedScpProgramConfig {
  scpType: ScpTypeValue;
  gradeRequirements: unknown;
  notes: string | null;
}

interface PublicScpConfigResponse {
  scpProgramConfigs?: PublicScpProgramConfig[];
}

const isScpTypeValue = (value: unknown): value is ScpTypeValue =>
  typeof value === "string" &&
  SCP_PROGRAMS.some((program) => program.id === value);

export default function BasicInfoStep() {
  const {
    register,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext<EarlyRegFormData>();

  const { activeSchoolYearLabel } = useSettingsStore();
  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");
  const lrn = watch("lrn");
  const hasNoLrn = watch("hasNoLrn");
  const isScpApplication = watch("isScpApplication");
  const scpType = watch("scpType");
  const isScpEligible = learnerType === "NEW_ENROLLEE" && gradeLevel === "7";
  const canDeclareNoLrn =
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && gradeLevel === "7");
  const [isLoadingScpConfig, setIsLoadingScpConfig] = useState(true);
  const [scpConfigError, setScpConfigError] = useState<string | null>(null);
  const [offeredScpConfigs, setOfferedScpConfigs] = useState<
    OfferedScpProgramConfig[]
  >([]);

  const availableScpPrograms = useMemo(
    () =>
      SCP_PROGRAMS.filter((program) =>
        offeredScpConfigs.some((config) => config.scpType === program.id),
      ),
    [offeredScpConfigs],
  );
  const offeredScpConfigByType = useMemo(
    () => new Map(offeredScpConfigs.map((config) => [config.scpType, config])),
    [offeredScpConfigs],
  );
  const selectedScpRequirementCard =
    useMemo<ScpRequirementCardData | null>(() => {
      if (!scpType) {
        return null;
      }

      const selectedConfig = offeredScpConfigByType.get(scpType);
      const configuredPrerequisites = buildPrerequisiteLines(
        parseGradeRequirements(selectedConfig?.gradeRequirements),
      );

      return {
        prerequisiteLines:
          configuredPrerequisites.length > 0
            ? configuredPrerequisites
            : SCP_FALLBACK_PREREQUISITES[scpType],
        documentaryRequirements: SCP_FALLBACK_DOCUMENTS[scpType],
        note: selectedConfig?.notes ?? SCP_FALLBACK_NOTES[scpType] ?? null,
        usingConfiguredPrerequisites: configuredPrerequisites.length > 0,
      };
    }, [scpType, offeredScpConfigByType]);
  const hasOfferedScpPrograms = availableScpPrograms.length > 0;
  const canSelectScpTrack =
    isScpEligible && !isLoadingScpConfig && hasOfferedScpPrograms;

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
              gradeRequirements: config.gradeRequirements ?? null,
              notes:
                typeof config.notes === "string" && config.notes.trim()
                  ? config.notes.trim()
                  : null,
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

  // 1. Auto-set School Year
  useEffect(() => {
    if (activeSchoolYearLabel) {
      setValue("schoolYear", activeSchoolYearLabel);
    }
  }, [activeSchoolYearLabel, setValue]);

  // 2. The "Interchange" Logic (Adviser's Requirement)
  useEffect(() => {
    if (learnerType === "NEW_ENROLLEE") {
      // Force Grade 7 and clear any other selection
      setValue("gradeLevel", "7", { shouldValidate: true });
    }
  }, [learnerType, setValue]);

  useEffect(() => {
    if (!isScpEligible && (isScpApplication || scpType)) {
      setValue("isScpApplication", false, { shouldValidate: true });
      setValue("scpType", null, { shouldValidate: true });
      clearErrors("scpType");
    }
  }, [isScpEligible, isScpApplication, scpType, setValue, clearErrors]);

  useEffect(() => {
    if (isLoadingScpConfig || !isScpApplication || hasOfferedScpPrograms) {
      return;
    }

    setValue("isScpApplication", false, { shouldValidate: true });
    setValue("scpType", null, { shouldValidate: true });
    clearErrors("scpType");
  }, [
    isLoadingScpConfig,
    isScpApplication,
    hasOfferedScpPrograms,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (!canDeclareNoLrn && hasNoLrn) {
      setValue("hasNoLrn", false, { shouldValidate: true, shouldDirty: true });
    }
  }, [canDeclareNoLrn, hasNoLrn, setValue]);

  useEffect(() => {
    if (!hasNoLrn) return;
    if (lrn) {
      setValue("lrn", "", { shouldValidate: true, shouldDirty: true });
    }
    clearErrors("lrn");
  }, [hasNoLrn, lrn, setValue, clearErrors]);

  useEffect(() => {
    if (isLoadingScpConfig || !scpType) return;

    const isStillAvailable = availableScpPrograms.some(
      (program) => program.id === scpType,
    );

    if (!isStillAvailable) {
      setValue("isScpApplication", false, { shouldValidate: true });
      setValue("scpType", null, { shouldValidate: true });
      clearErrors("scpType");
    }
  }, [
    isLoadingScpConfig,
    scpType,
    availableScpPrograms,
    setValue,
    clearErrors,
  ]);

  // 3. LRN existence check (Debounced)
  useEffect(() => {
    if (hasNoLrn) {
      if (errors.lrn?.type === "manual") {
        clearErrors("lrn");
      }
      return;
    }

    if (!lrn || lrn.length !== 12) {
      // Clear manual duplicate error if LRN is not 12 digits
      if (errors.lrn?.type === "manual") {
        clearErrors("lrn");
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/early-registrations/check-lrn/${lrn}`);
        if (response.data.exists) {
          setError("lrn", {
            type: "manual",
            message: response.data.message,
          });
        } else {
          // If was manual error, clear it
          if (errors.lrn?.type === "manual") {
            clearErrors("lrn");
          }
        }
      } catch (error) {
        console.error("Failed to check LRN existence:", error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [hasNoLrn, lrn, setError, clearErrors, errors.lrn?.type]);

  const lrnRequired = !canDeclareNoLrn || !hasNoLrn;

  // Filter grade options based on learner type
  const visibleGradeOptions = GRADE_OPTIONS.filter((opt) =>
    learnerType === "NEW_ENROLLEE" ? opt.value === "7" : true,
  );

  const selectRegularTrack = () => {
    setValue("isScpApplication", false, { shouldValidate: true });
    setValue("scpType", null, { shouldValidate: true });
    clearErrors("scpType");
  };

  const selectScpTrack = () => {
    if (!canSelectScpTrack) return;
    setValue("isScpApplication", true, { shouldValidate: true });
  };

  return (
    <div className="space-y-10">
      <div className="space-y-8">
        {/* ROW 1: Learner Reference Number & School Year */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start p-5 bg-muted/30 rounded-2xl border border-border/50">
          {/* LRN Input */}
          <div className="space-y-2">
            <Label
              htmlFor="lrn"
              className="text-sm font-bold uppercase tracking-widest text-primary">
              Learner Reference Number (LRN)
              {lrnRequired && <span className="text-destructive"> *</span>}
            </Label>
            <div className="relative">
              <Input
                id="lrn"
                {...register("lrn")}
                placeholder="12-digit LRN (from SF9 Report Card)"
                maxLength={12}
                inputMode="numeric"
                disabled={hasNoLrn}
                className={cn(
                  "h-12 font-bold tracking-widest uppercase bg-white pl-4",
                  hasNoLrn && "bg-muted/50 cursor-not-allowed",
                  errors.lrn && "border-destructive",
                )}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(
                    /[^0-9]/g,
                    "",
                  );
                }}
              />
            </div>
            <p className="font-bold text-xs italic flex items-center gap-1 mt-2 text-muted-foreground">
              <Info className="w-4 h-4" />
              {hasNoLrn
                ? "No LRN declared. Registrar will process this learner under pending LRN creation."
                : canDeclareNoLrn
                  ? "Provide the learner LRN, or declare no LRN below if applicable."
                  : "LRN is required for this learner category."}
            </p>

            {canDeclareNoLrn && (
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 mt-2">
                <Checkbox
                  id="hasNoLrn"
                  checked={hasNoLrn}
                  onCheckedChange={(checked) => {
                    const nextChecked = checked === true;
                    setValue("hasNoLrn", nextChecked, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    if (nextChecked) {
                      setValue("lrn", "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      clearErrors("lrn");
                    }
                  }}
                />
                <Label
                  htmlFor="hasNoLrn"
                  className="text-xs leading-relaxed font-semibold cursor-pointer text-foreground">
                  I confirm the learner currently has no LRN. This is allowed
                  for incoming Grade 7 and transferees.
                </Label>
              </div>
            )}

            {errors.lrn && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {errors.lrn.message}
              </p>
            )}
          </div>

          {/* School Year (Read Only) */}
          <div className="space-y-2">
            <Label
              htmlFor="schoolYear"
              className="text-sm font-bold uppercase tracking-widest text-primary opacity-70">
              School Year
            </Label>
            <div className="relative">
              <Input
                id="schoolYear"
                {...register("schoolYear")}
                readOnly
                className="h-12 bg-muted/50 text-muted-foreground cursor-not-allowed font-bold pl-10 uppercase border-dashed"
              />
              <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            </div>
          </div>
        </div>

        {/* ROW 2: Learner Category */}
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            Learner Category <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {LEARNER_TYPES.map((lt) => (
              <button
                key={lt.value}
                type="button"
                onClick={() =>
                  setValue("learnerType", lt.value, { shouldValidate: true })
                }
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase focus:outline-none focus:ring-2 focus:ring-primary/50",
                  learnerType === lt.value
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-white hover:bg-primary/5 text-muted-foreground hover:text-foreground",
                )}>
                <span className="font-bold text-sm leading-tight tracking-wide">
                  {lt.label}
                </span>
              </button>
            ))}
          </div>
          {errors.learnerType && (
            <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" />
              {errors.learnerType.message}
            </p>
          )}
        </div>

        {/* ROW 3: Grade Level to Enroll */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <Label className="text-sm font-bold uppercase tracking-widest text-primary">
              Grade Level to Enroll <span className="text-destructive">*</span>
            </Label>
          </div>

          <div
            className={cn(
              "grid gap-3",
              learnerType === "NEW_ENROLLEE"
                ? "grid-cols-1"
                : "grid-cols-2 sm:grid-cols-4",
            )}>
            {visibleGradeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setValue("gradeLevel", opt.value, { shouldValidate: true })
                }
                className={cn(
                  "relative flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all h-14 uppercase",
                  gradeLevel === opt.value
                    ? "border-primary bg-primary text-white shadow-sm ring-1 ring-primary"
                    : "border-border bg-white hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
                )}>
                <span className="text-sm font-bold leading-tight">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
          {errors.gradeLevel && (
            <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" />
              {errors.gradeLevel.message}
            </p>
          )}
        </div>

        {/* ROW 4: Application Track */}
        <div className="space-y-4">
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
                "grid gap-3",
                isScpEligible ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
              )}>
              <button
                type="button"
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

              {isScpEligible && (
                <button
                  type="button"
                  disabled={!canSelectScpTrack}
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
                      Special Curricular Program
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
                        ? "Choose this if the learner will apply for an SCP track."
                        : "No SCP tracks are open for this School Year."}
                  </p>
                </button>
              )}
            </div>

            {isScpEligible && isLoadingScpConfig && (
              <p className="font-bold text-xs italic flex items-center gap-1 mt-2 text-muted-foreground">
                <Info className="w-4 h-4" />
                Loading available SCP programs...
              </p>
            )}

            {isScpEligible && !isLoadingScpConfig && scpConfigError && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3" />
                {scpConfigError}
              </p>
            )}

            {isScpEligible &&
              !isLoadingScpConfig &&
              !scpConfigError &&
              !hasOfferedScpPrograms && (
                <p className="font-bold text-xs italic flex items-center gap-1 mt-2 text-muted-foreground">
                  <Info className="w-4 h-4" />
                  No SCP programs are currently offered for this School Year.
                </p>
              )}

            {!isScpEligible && (
              <p className="font-bold text-xs italic flex items-center gap-1 mt-2 text-muted-foreground">
                <Info className="w-4 h-4" />
                SCP is available only for New Enrollees in Grade 7.
              </p>
            )}

            {isScpEligible && isScpApplication && hasOfferedScpPrograms && (
              <div className="space-y-3 pt-2">
                <Label className="text-sm font-bold uppercase tracking-widest text-primary">
                  Select SCP Track <span className="text-destructive">*</span>
                </Label>

                <div className="grid grid-cols-1 gap-3">
                  {availableScpPrograms.map((program) => (
                    <button
                      key={program.id}
                      type="button"
                      className={cn(
                        "w-full flex flex-col p-4 rounded-xl border-2 transition-all text-left",
                        scpType === program.id
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border bg-white text-foreground hover:bg-primary/5",
                      )}
                      onClick={() =>
                        setValue("scpType", program.id, {
                          shouldValidate: true,
                        })
                      }>
                      <div className="flex items-center gap-3 mb-1">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            scpType === program.id
                              ? "border-white"
                              : "border-muted-foreground",
                          )}>
                          {scpType === program.id && (
                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className="font-bold">
                          {SCP_LABELS[program.id]}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-xs pl-8 italic",
                          scpType === program.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}>
                        {program.description}
                      </p>
                    </button>
                  ))}
                </div>

                {errors.scpType?.message && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.scpType.message}
                  </p>
                )}

                {scpType && selectedScpRequirementCard && (
                  <div className="rounded-2xl border border-primary/20 bg-white p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[0.625rem] font-bold uppercase tracking-widest text-primary/70">
                          SCP Track Requirements
                        </p>
                        <p className="text-sm font-bold text-primary mt-1">
                          {SCP_LABELS[scpType]}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide",
                          selectedScpRequirementCard.usingConfiguredPrerequisites
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700",
                        )}>
                        {selectedScpRequirementCard.usingConfiguredPrerequisites
                          ? "Config-Based"
                          : "Policy Default"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-primary">
                          Prerequisites
                        </p>
                        <ul className="space-y-2">
                          {selectedScpRequirementCard.prerequisiteLines.map(
                            (line, index) => (
                              <li
                                key={`${scpType}-prerequisite-${index}`}
                                className="flex items-start gap-2 text-xs text-foreground">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span>{line}</span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-primary">
                          Documentary Requirements
                        </p>
                        <ul className="space-y-2">
                          {selectedScpRequirementCard.documentaryRequirements.map(
                            (requirement, index) => (
                              <li
                                key={`${scpType}-document-${requirement.label}-${index}`}
                                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium text-foreground">
                                    {requirement.label}
                                  </p>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide",
                                      requirement.status === "REQUIRED"
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : "border-blue-200 bg-blue-50 text-blue-700",
                                    )}>
                                    {requirement.status === "REQUIRED"
                                      ? "Required"
                                      : "Recommended"}
                                  </span>
                                </div>
                                {requirement.note && (
                                  <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                                    {requirement.note}
                                  </p>
                                )}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>

                    {selectedScpRequirementCard.note && (
                      <p className="font-bold text-xs italic flex items-start gap-1 text-muted-foreground">
                        <Info className="w-4 h-4 shrink-0 mt-[1px]" />
                        <span>{selectedScpRequirementCard.note}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
