import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { AlertCircle, BookOpen, Info } from "lucide-react";

import type { EnrollmentFormData } from "../types";
import {
  SPA_ART_FIELDS,
  SPS_SPORTS,
} from "../types";
import { cn, SCP_LABELS, SCP_ACRONYMS } from "@/shared/lib/utils";
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
import { useSettingsStore } from "@/store/settings.slice";

const LEARNER_TYPES = [
  { value: "NEW_ENROLLEE", label: "Incoming Grade 7" },
  { value: "TRANSFEREE", label: "TRANSFEREE" },
  { value: "RETURNING", label: "Returning (Balik-Aral)" },
] as const;

const GRADE_OPTIONS = [
  { value: "7", label: "GRADE 7" },
  { value: "8", label: "GRADE 8" },
  { value: "9", label: "GRADE 9" },
  { value: "10", label: "GRADE 10" },
] as const;

type ScpTypeValue = NonNullable<EnrollmentFormData["scpType"]>;

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
    clearErrors,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore();

  const isBalikAral = watch("isBalikAral");
  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");
  const isScpApplication = watch("isScpApplication");
  const scpType = watch("scpType");

  const hasNoLrn = watch("hasNoLrn");
  const artField = watch("artField");
  const sportsList = watch("sportsList");
  const foreignLanguage = watch("foreignLanguage");
  const reportedGa = watch("generalAverage");

  const [inputGaValue, setInputGaValue] = useState<string>("");

  useEffect(() => {
    if (reportedGa !== undefined && reportedGa !== null) {
      setInputGaValue(reportedGa.toString());
    } else {
      setInputGaValue("");
    }
  }, [reportedGa]);

  const selectedSportsCount = sportsList?.length ?? 0;

  const isScpEligible = learnerType === "NEW_ENROLLEE" && gradeLevel === "7";


  const availableScpPrograms = useMemo(() => {
    return SCP_PROGRAMS.filter((program) => {
      if (program.id === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && steEnabled) return true;
      if (program.id === "SPECIAL_PROGRAM_IN_THE_ARTS" && spaEnabled) return true;
      if (program.id === "SPECIAL_PROGRAM_IN_SPORTS" && spsEnabled) return true;
      return false;
    });
  }, [steEnabled, spaEnabled, spsEnabled]);

  const hasOfferedScpPrograms = availableScpPrograms.length > 0;

  const shouldShowScpCard =
    isScpEligible && hasOfferedScpPrograms;

  const canDeclareNoLrn =
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && gradeLevel === "7");
  const visibleGradeOptions =
    learnerType === "NEW_ENROLLEE"
      ? GRADE_OPTIONS.filter((option) => option.value === "7")
      : GRADE_OPTIONS;

  useEffect(() => {
    if (learnerType === "NEW_ENROLLEE" && gradeLevel !== "7") {
      setValue("gradeLevel", "7", { shouldValidate: true });
    }
  }, [learnerType, gradeLevel, setValue]);

  useEffect(() => {
    if (!shouldShowScpCard && (isScpApplication || scpType)) {
      setValue("isScpApplication", false, { shouldValidate: true });
      setValue("scpType", undefined, { shouldValidate: true });
      setValue("hasScpFallbackConsent", false, { shouldValidate: true });
      clearErrors(["scpType", "hasScpFallbackConsent"]);
    }
  }, [shouldShowScpCard, isScpApplication, scpType, setValue, clearErrors]);

  useEffect(() => {
    if (!isScpApplication || hasOfferedScpPrograms) {
      return;
    }

    setValue("isScpApplication", false, { shouldValidate: true });
    setValue("scpType", undefined, { shouldValidate: true });
    clearErrors("scpType");
  }, [
    isScpApplication,
    hasOfferedScpPrograms,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (!scpType) return;

    const isStillAvailable = availableScpPrograms.some(
      (program) => program.id === scpType,
    );

    if (!isStillAvailable) {
      setValue("isScpApplication", false, { shouldValidate: true });
      setValue("scpType", undefined, { shouldValidate: true });
      setValue("hasScpFallbackConsent", false, { shouldValidate: true });
      clearErrors(["scpType", "hasScpFallbackConsent"]);
    }
  }, [
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

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Label className="text-base leading-tight font-extrabold uppercase  text-primary">
          Learner Category <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {LEARNER_TYPES.map((typeOption) => (
            <button
              key={typeOption.value}
              type="button"
              onClick={() => {
                setValue("learnerType", typeOption.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                // Sync back to isBalikAral in Step 3
                if (typeOption.value === "RETURNING") {
                  setValue("isBalikAral", true, { shouldValidate: true });
                } else {
                  setValue("isBalikAral", false, { shouldValidate: true });
                }
              }}
              className={cn(
                "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                learnerType === typeOption.value
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
              )}>
              <span className="font-extrabold text-base leading-tight ">
                {typeOption.label}
              </span>
            </button>
          ))}
        </div>
        {errors.learnerType?.message && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" /> {errors.learnerType.message}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Label className="text-base leading-tight font-extrabold uppercase  text-primary">
          Grade Level to Apply for <span className="text-destructive">*</span>
        </Label>
        <div
          className={cn(
            "grid gap-3",
            learnerType === "NEW_ENROLLEE"
              ? "grid-cols-1"
              : "grid-cols-2 md:grid-cols-4",
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
                  : "border-border bg-muted hover:border-primary/50 hover:bg-primary/5",
              )}>
              <span className="text-base font-extrabold leading-tight">
                {gradeOption.label}
              </span>
            </button>
          ))}
        </div>
        {errors.gradeLevel?.message && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" /> {errors.gradeLevel.message}
          </p>
        )}
      </div>

      <div className="space-y-3 p-5 bg-muted/30 rounded-2xl border border-border/50">
        <Label
          htmlFor="generalAverage"
          className="text-base leading-tight font-extrabold uppercase  text-primary">
          Final General Average {!watch("hasSf9Deficiency") && <span className="text-destructive">*</span>}
        </Label>

        <div className="flex items-start space-x-2 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
          <Checkbox
            id="sf9-deficiency"
            checked={watch("hasSf9Deficiency")}
            onCheckedChange={(checked) => {
              setValue("hasSf9Deficiency", checked === true, { shouldValidate: true, shouldDirty: true });
              if (checked === true) {
                setValue("generalAverage", undefined, { shouldValidate: true, shouldDirty: true });
                setInputGaValue("");
              }
            }}
          />
          <Label htmlFor="sf9-deficiency" className="text-base font-extrabold leading-tight cursor-pointer text-blue-900">
            I do not have my SF9 / Report Card yet. I am applying for Temporary Enrollment per DepEd Order 017.
          </Label>
        </div>

        <div className="grid grid-cols-1 gap-4 items-start pt-2">
          <div className="space-y-2">
            <Input
              id="generalAverage"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 88.50"
              disabled={watch("hasSf9Deficiency")}
              className={cn(
                "h-12 font-extrabold text-lg bg-muted border-2 disabled:opacity-50",
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
                      parsed === null ? undefined : Number(parsed.toFixed(2)),
                      { shouldValidate: true, shouldDirty: true },
                    );
                    setInputGaValue(val);
                  }
                }
              }}
            />
            <p className="font-extrabold text-base italic flex items-center gap-1 text-foreground">
              <Info className="w-4 h-4" />
              {watch("learnerType") === "NEW_ENROLLEE"
                ? "Final general average from Grade 6."
                : watch("learnerType") === "TRANSFEREE"
                  ? "Final general average from the last completed grade level."
                  : "Final general average from your last attended school year."}
            </p>
          </div>
        </div>
        {errors.generalAverage?.message && (
          <p className="text-base text-destructive font-extrabold flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.generalAverage.message}
          </p>
        )}
      </div>

      <div className="space-y-8 pb-8">
        <div className="p-6 border bg-primary/5 border-primary/20 rounded-2xl space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <Label className="text-base font-extrabold text-primary">
              Preferred Curriculum Program <span className="text-destructive">*</span>
            </Label>
          </div>

          <Select
            disabled={!isScpEligible}
            value={!isScpApplication ? "REGULAR" : scpType || "REGULAR"}
            onValueChange={(val) => {
              if (val === "REGULAR") {
                setValue("isScpApplication", false, { shouldValidate: true, shouldDirty: true });
                setValue("scpType", undefined, { shouldValidate: true, shouldDirty: true });
                setValue("hasScpFallbackConsent", false, { shouldValidate: true, shouldDirty: true });
              } else {
                setValue("isScpApplication", true, { shouldValidate: true, shouldDirty: true });
                setValue("scpType", val as any, { shouldValidate: true, shouldDirty: true });
              }
            }}
          >
            <SelectTrigger className="w-full bg-muted font-extrabold h-12">
              <SelectValue placeholder="Select Preferred Curriculum Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGULAR">Regular Basic Education</SelectItem>
              {availableScpPrograms.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {SCP_ACRONYMS[program.id]} ({program.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isScpEligible && (
            <p className="font-extrabold text-base italic flex items-center gap-1 text-foreground">
              <Info className="w-4 h-4" />
              SCP is available only for New Enrollees applying for Grade 7.
            </p>
          )}

          <AnimatePresence>
            {isScpApplication && scpType && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-6 pt-2"
              >
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-900 space-y-4">
                  <p className="text-base leading-tight font-extrabold flex items-start gap-2">
                    <Info className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
                    Note: Enrollment in Special Curricular Programs is strictly for learners who have passed the pre-enrollment screening. The Registrar's Office will manually cross-reference this submission with the official master list of passers.
                  </p>
                  <div className="flex items-start space-x-3 pt-3 border-t border-yellow-200/50">
                    <Checkbox
                      id="scp-consent"
                      checked={watch("hasScpFallbackConsent")}
                      onCheckedChange={(checked) =>
                        setValue("hasScpFallbackConsent", checked === true, { shouldValidate: true, shouldDirty: true })
                      }
                      className="mt-0.5 border-yellow-500 data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
                    />
                    <Label htmlFor="scp-consent" className="text-base font-extrabold leading-tight cursor-pointer">
                      I confirm that the learner is on the official published list of passers for this program. I understand that submitting a false claim will result in enrollment delays and automatic placement in the Regular curriculum. <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  {errors.hasScpFallbackConsent?.message && (
                    <p className="text-base text-destructive font-extrabold flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3" />{" "}
                      {errors.hasScpFallbackConsent.message}
                    </p>
                  )}
                </div>

                {scpType === "SPECIAL_PROGRAM_IN_THE_ARTS" && (
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold uppercase text-primary">
                      Preferred Art Field <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        setValue("artField", value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      value={watch("artField")}>
                      <SelectTrigger className="h-10 bg-muted border-2 font-extrabold">
                        <SelectValue placeholder="Select Art Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPA_ART_FIELDS.map((field) => (
                          <SelectItem
                            key={field}
                            value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scpType === "SPECIAL_PROGRAM_IN_SPORTS" && (
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold uppercase text-primary">
                      Primary Sport <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {SPS_SPORTS.map((sport) => (
                        <div
                          key={sport}
                          className="flex items-center space-x-2">
                          <Checkbox
                            id={`sport-${sport}`}
                            checked={watch("sportsList")?.includes(sport)}
                            onCheckedChange={(checked) => {
                              const list = watch("sportsList") || [];
                              const nextSports = checked
                                ? [...list, sport]
                                : list.filter((item) => item !== sport);
                              setValue("sportsList", nextSports, {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                            }}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                          />
                          <Label
                            htmlFor={`sport-${sport}`}
                            className="text-base font-extrabold cursor-pointer">
                            {sport}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
