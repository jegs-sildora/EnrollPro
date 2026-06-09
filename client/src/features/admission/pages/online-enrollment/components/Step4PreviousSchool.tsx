import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { EnrollmentFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn, getManilaNow } from "@/shared/lib/utils";

export default function Step4PreviousSchool() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  // Generate last 10 school years, excluding the current/upcoming one
  const currentYear = getManilaNow().getFullYear();
  const schoolYears = Array.from({ length: 10 }, (_, i) => {
    const start = currentYear - 1 - i;
    return `${start}-${start + 1}`;
  });
  const lastSchoolType = watch("lastSchoolType");
  const selectedLastSchoolType = lastSchoolType ?? "Public";
  const schoolTypeOptions = [
    { value: "Public", label: "Public" },
    { value: "Private", label: "Private" },
    { value: "International", label: "International" },
    { value: "ALS", label: "ALS" },
  ] as const;


  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");

  // Grade progression map: target grade → expected previous grade completed
  const GRADE_PROGRESSION: Record<string, string> = {
    "7": "Grade 6",
    "8": "Grade 7",
    "9": "Grade 8",
    "10": "Grade 9",
  };

  const isAls = selectedLastSchoolType === "ALS";
  const isReturning = learnerType === "RETURNING";
  const derivedGrade = GRADE_PROGRESSION[gradeLevel] ?? "";

  // Auto-fill lastGradeCompleted based on context
  useEffect(() => {
    if (isAls) {
      setValue("lastGradeCompleted", "A&E Test Passer", {
        shouldValidate: false,
        shouldDirty: false,
      });
    } else if (!isReturning && derivedGrade) {
      setValue("lastGradeCompleted", derivedGrade, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [isAls, isReturning, derivedGrade, setValue]);

  useEffect(() => {
    if (!lastSchoolType) {
      setValue("lastSchoolType", "Public", {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [lastSchoolType, setValue]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="prev-school"
              className="text-sm font-bold text-foreground">
              Last School Name <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="prev-school"
              {...register("lastSchoolName")}
              placeholder="e.g. Apolinario Mabini Elementary School"
              className={cn(
                "h-11 font-bold uppercase",
                errors.lastSchoolName &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              onInput={(e) => {
                (e.target as HTMLInputElement).value = (
                  e.target as HTMLInputElement
                ).value.toUpperCase();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="prev-school-id"
              className="text-sm font-bold text-foreground">
              School ID (Optional)
            </Label>
            <Input
              autoComplete="off"
              id="prev-school-id"
              {...register("lastSchoolId")}
              placeholder="6-digit DepEd ID"
              className="h-11 font-bold uppercase"
              maxLength={6}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="prev-grade"
              className="text-sm font-bold text-foreground">
              {isAls ? "ALS Qualification" : "Last Grade Completed"}{" "}
              <span className="text-destructive">*</span>
            </Label>

            {/* ALS: read-only badge */}
            {isAls && (
              <Input
                id="prev-grade"
                readOnly
                value="A&E Test Passer"
                className="h-11 font-bold bg-muted text-foreground cursor-not-allowed"
              />
            )}

            {/* New Enrollee / Transferee: auto-filled, read-only */}
            {!isAls && !isReturning && (
              <Select value={derivedGrade}>
                <SelectTrigger
                  id="prev-grade"
                  className={cn(
                    "h-11 font-bold text-foreground pointer-events-none uppercase",
                    errors.lastGradeCompleted &&
                      "border-destructive focus-visible:ring-destructive",
                  )}>
                  <SelectValue placeholder="Auto-filled from Grade Level" />
                </SelectTrigger>
                <SelectContent>
                  {["Grade 6", "Grade 7", "Grade 8", "Grade 9"].map((g) => (
                    <SelectItem
                      key={g}
                      value={g}
                      className="font-bold">
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Returning learner: editable dropdown */}
            {!isAls && isReturning && (
              <Select
                value={watch("lastGradeCompleted") ?? ""}
                onValueChange={(val) =>
                  setValue("lastGradeCompleted", val, {
                    shouldValidate: true,
                  })
                }>
                <SelectTrigger
                  id="prev-grade"
                  className={cn(
                    "h-11 font-bold",
                    errors.lastGradeCompleted &&
                      "border-destructive focus-visible:ring-destructive",
                  )}>
                  <SelectValue placeholder="Select last grade completed" />
                </SelectTrigger>
                <SelectContent>
                  {["Grade 6", "Grade 7", "Grade 8", "Grade 9"].map((g) => (
                    <SelectItem
                      key={g}
                      value={g}
                      className="font-bold">
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {errors.lastGradeCompleted && (
              <p className="text-xs font-bold text-destructive">
                {errors.lastGradeCompleted.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="prev-sy"
              className="text-sm font-bold text-foreground">
              School Year Last Attended{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(val) => setValue("schoolYearLastAttended", val)}
              defaultValue={watch("schoolYearLastAttended")}>
              <SelectTrigger
                id="prev-sy"
                className={cn(
                  "h-11 font-bold",
                  errors.schoolYearLastAttended &&
                    "border-destructive focus-visible:ring-destructive",
                )}>
                <SelectValue placeholder="Select School Year" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((sy) => (
                  <SelectItem
                    key={sy}
                    value={sy}
                    className="font-bold">
                    {sy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-bold text-foreground">
            School Type <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {schoolTypeOptions.map((lt) => (
              <button
                key={lt.value}
                type="button"
                onClick={() => setValue("lastSchoolType", lt.value)}
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-11",
                  selectedLastSchoolType === lt.value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-white hover:bg-primary/5 text-foreground hover:text-foreground",
                )}>
                <span className="font-bold text-sm leading-tight ">
                  {lt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Label
            htmlFor="prev-addr"
            className="text-sm font-bold text-foreground">
            School Address / Division (Optional)
          </Label>
          <Input
            autoComplete="off"
            id="prev-addr"
            {...register("lastSchoolAddress")}
            placeholder="City/Municipality, Province"
            className="h-11 font-bold uppercase"
          />
        </div>
      </div>


    </div>
  );
}
