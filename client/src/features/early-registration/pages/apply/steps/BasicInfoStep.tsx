import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { AlertCircle, BookOpen, Info, School } from "lucide-react";
import { cn, SCP_LABELS } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";

const LEARNER_TYPES = [
  { value: "NEW_ENROLLEE", label: "NEW ENROLLEE" },
  { value: "RETURNING", label: "RETURNING (BALIK-ARAL)" },
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
    description: "Written entrance exam and interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_THE_ARTS",
    description: "Written exam, audition, and interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_SPORTS",
    description: "Sports tryout and screening.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_JOURNALISM",
    description: "Journalism screening exam and interview.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    description: "Language aptitude and screening.",
  },
  {
    id: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    description: "Technical-vocational aptitude assessment.",
  },
];

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
  const isScpApplication = watch("isScpApplication");
  const scpType = watch("scpType");
  const isScpEligible = learnerType === "NEW_ENROLLEE" && gradeLevel === "7";

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

  // 3. LRN existence check (Debounced)
  useEffect(() => {
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
  }, [lrn, setError, clearErrors, errors.lrn?.type]);

  const lrnRequired = gradeLevel && parseInt(gradeLevel, 10) >= 8;

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
    if (!isScpEligible) return;
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
                placeholder="Enter 12-digit LRN"
                maxLength={12}
                inputMode="numeric"
                className={cn(
                  "h-12 font-bold tracking-widest uppercase bg-white pl-4",
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
              {lrnRequired
                ? "LRN is required for your grade level."
                : "Found on the upper left of the SF9 (Report Card)."}
            </p>
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
          <div className="grid grid-cols-2 gap-3">
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
                    ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                    : "border-border bg-white hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
                )}>
                <span className="text-sm font-bold leading-tight text-primary">
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
                Application Track <span className="text-destructive">*</span>
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
                    "text-[0.6875rem] pl-8",
                    !isScpApplication
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}>
                  Standard admission track without SCP specialization.
                </p>
              </button>

              {isScpEligible && (
                <button
                  type="button"
                  className={cn(
                    "flex flex-col p-4 rounded-xl border-2 transition-all text-left",
                    isScpApplication
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-white hover:bg-primary/5",
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
                      "text-[0.6875rem] pl-8",
                      isScpApplication
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}>
                    Select this if applying for an SCP track.
                  </p>
                </button>
              )}
            </div>

            {!isScpEligible && (
              <p className="font-bold text-xs italic flex items-center gap-1 mt-2 text-muted-foreground">
                <Info className="w-4 h-4" />
                SCP option is available only for NEW ENROLLEE in GRADE 7.
              </p>
            )}

            {isScpEligible && isScpApplication && (
              <div className="space-y-3 pt-2">
                <Label className="text-sm font-bold uppercase tracking-widest text-primary">
                  Select SCP Program <span className="text-destructive">*</span>
                </Label>

                <div className="grid grid-cols-1 gap-3">
                  {SCP_PROGRAMS.map((program) => (
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
                          "text-[0.6875rem] pl-8 italic",
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
