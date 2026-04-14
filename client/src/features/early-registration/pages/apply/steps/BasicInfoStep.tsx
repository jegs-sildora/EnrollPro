import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { AlertCircle, Info, School } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

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

export default function BasicInfoStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EarlyRegFormData>();

  const { activeSchoolYearLabel } = useSettingsStore();
  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");

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

  const lrnRequired = gradeLevel && parseInt(gradeLevel, 10) >= 8;

  // Filter grade options based on learner type
  const visibleGradeOptions = GRADE_OPTIONS.filter((opt) =>
    learnerType === "NEW_ENROLLEE" ? opt.value === "7" : true,
  );

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
                Grade Level to Enroll{" "}
              <span className="text-destructive">*</span>
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
      </div>
    </div>
  );
}
