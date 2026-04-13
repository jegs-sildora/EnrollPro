import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { AlertCircle, Info, School } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

const GRADE_OPTIONS = [
  { value: "7", label: "GRADE 7" },
  { value: "8", label: "GRADE 8" },
  { value: "9", label: "GRADE 9" },
  { value: "10", label: "GRADE 10" },
];

const LEARNER_TYPES = [
  { value: "NEW_ENROLLEE", label: "NEW ENROLLEE" },
  { value: "TRANSFEREE", label: "TRANSFEREE" },
  { value: "RETURNING", label: "RETURNING (BALIK-ARAL)" },
  { value: "CONTINUING", label: "CONTINUING" },
];

export default function BasicInfoStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EarlyRegFormData>();

  const { activeSchoolYearLabel } = useSettingsStore();

  useEffect(() => {
    if (activeSchoolYearLabel) {
      setValue("schoolYear", activeSchoolYearLabel);
    }
  }, [activeSchoolYearLabel, setValue]);

  const gradeLevel = watch("gradeLevel");
  const lrnRequired = parseInt(gradeLevel, 10) >= 8;

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        {/* Row 1: School Year & LRN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* School Year — Read-only from active SY */}
          <div className="space-y-2">
            <Label
              htmlFor="schoolYear"
              className="text-sm font-bold uppercase tracking-widest text-primary">
              School Year <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="schoolYear"
                {...register("schoolYear")}
                readOnly
                className="h-11 bg-muted cursor-not-allowed font-bold pl-10 uppercase"
              />
              <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* LRN */}
          <div className="space-y-2">
            <Label
              htmlFor="lrn"
              className="text-sm font-bold uppercase tracking-widest text-primary">
              Learner Reference Number (LRN)
              {lrnRequired && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="lrn"
              {...register("lrn")}
              placeholder="12-DIGIT LRN"
              maxLength={12}
              inputMode="numeric"
              className={cn(
                "h-11 font-bold tracking-widest uppercase",
                errors.lrn && "border-destructive",
              )}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(
                  /[^0-9]/g,
                  "",
                );
              }}
            />
            <p className="font-bold text-xs text-muted-foreground italic flex items-center gap-1">
              <Info className="w-3 h-3" />
              {lrnRequired
                ? "LRN IS REQUIRED FOR GRADE 8-10 LEARNERS"
                : "12 DIGITS • FOUND ON THE REPORT CARD (SF9)"}
            </p>
            {errors.lrn && (
              <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.lrn.message}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Grade Level */}
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            Grade Level to Enroll <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GRADE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setValue("gradeLevel", opt.value as any, {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all h-11 uppercase",
                  watch("gradeLevel") === opt.value
                    ? "border-primary bg-primary/5 shadow-md font-bold"
                    : "border-border bg-white hover:bg-primary/5",
                )}>
                <span className="text-sm font-bold leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
          {errors.gradeLevel && (
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.gradeLevel.message}
            </p>
          )}
        </div>

        {/* Row 3: Learner Type */}
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-widest text-primary">
            Learner Type <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {LEARNER_TYPES.map((lt) => (
              <button
                key={lt.value}
                type="button"
                onClick={() =>
                  setValue("learnerType", lt.value as any, {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all text-center h-full uppercase",
                  watch("learnerType") === lt.value
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-white hover:bg-primary/5",
                )}>
                <span className="font-bold text-sm leading-tight">
                  {lt.label}
                </span>
              </button>
            ))}
          </div>
          {errors.learnerType && (
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.learnerType.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
