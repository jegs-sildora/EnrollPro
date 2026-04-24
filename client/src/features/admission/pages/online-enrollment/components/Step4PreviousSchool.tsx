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
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Info, HelpCircle } from "lucide-react";
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

  useEffect(() => {
    if (!lastSchoolType) {
      setValue("lastSchoolType", "Public", {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [lastSchoolType, setValue]);

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="prev-school" className="text-sm font-bold">
            Name of Last School Attended *
          </Label>
          <Input
            autoComplete="off"
            id="prev-school"
            {...register("lastSchoolName")}
            placeholder="e.g. Negros Occidental High School"
            className={cn(
              "h-11 font-bold uppercase",
              errors.lastSchoolName && "border-destructive",
            )}
          />
          {errors.lastSchoolName && (
            <p className="text-[0.6875rem] text-destructive font-medium">
              {errors.lastSchoolName.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="prev-school-id" className="text-sm font-bold">
                DepEd School ID
              </Label>
              <HelpCircle className="w-3.5 h-3.5 text-foreground cursor-help" />
            </div>
            <Input
              autoComplete="off"
              id="prev-school-id"
              {...register("lastSchoolId")}
              placeholder="6-digit ID (if known)"
              className="h-11 font-bold "
              maxLength={6}
              inputMode="numeric"
              onKeyDown={(e) => {
                if (
                  !/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab/.test(e.key)
                )
                  e.preventDefault();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prev-sy" className="text-sm font-bold">
              School Year Last Attended *
            </Label>
            <Select
              onValueChange={(val) => setValue("schoolYearLastAttended", val)}
              defaultValue={watch("schoolYearLastAttended")}>
              <SelectTrigger
                className={cn(
                  "h-11 font-bold",
                  errors.schoolYearLastAttended && "border-destructive",
                )}>
                <SelectValue placeholder="Select School Year" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((sy) => (
                  <SelectItem key={sy} value={sy}>
                    {sy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="final-general-average"
              className="text-sm font-bold">
              Final General Average (SF9)
            </Label>
            <Input
              autoComplete="off"
              id="final-general-average"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 89.75"
              className={cn(
                "h-11 font-bold",
                errors.generalAverage && "border-destructive",
              )}
              value={watch("generalAverage") ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                // Allow only digits and at most one decimal point with 2 places
                if (val === "" || /^(\d+)?(\.\d{0,2})?$/.test(val)) {
                  const num = val === "" ? null : parseFloat(val);
                  if (num === null || (!isNaN(num) && num <= 100)) {
                    setValue("generalAverage", val as any, {
                      shouldValidate: true,
                    });
                  }
                }
              }}
            />
            {errors.generalAverage && (
              <p className="text-[0.6875rem] text-destructive font-medium">
                {errors.generalAverage.message}
              </p>
            )}
            <p className="text-[0.6875rem] text-muted-foreground font-medium">
              Optional. Enter a value from 0 to 100 with up to 2 decimal places.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-bold">
            Last Grade Level Completed *
          </Label>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all h-14 uppercase w-full",
              "border-primary bg-primary text-white shadow-sm ring-1 ring-primary",
            )}>
            <span className="text-sm font-bold leading-tight">Grade 6</span>
          </button>
          <input
            type="hidden"
            {...register("lastGradeCompleted")}
            value="Grade 6"
          />
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-bold">Type of Last School *</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {schoolTypeOptions.map((lt) => (
              <button
                key={lt.value}
                type="button"
                onClick={() =>
                  setValue("lastSchoolType", lt.value, { shouldValidate: true })
                }
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase focus:outline-none focus:ring-2 focus:ring-primary/50",
                  selectedLastSchoolType === lt.value
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-white hover:bg-primary/5 text-foreground hover:text-foreground",
                )}>
                <span className="font-bold text-sm leading-tight tracking-wide">
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

      <Alert className="bg-primary/5 border-primary/20 mt-12">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm font-bold text-primary leading-relaxed">
          If the learner does not have a Report Card (SF9), they may still
          enroll. The school will accept a certification letter from the
          previous school principal as an alternative.
        </AlertDescription>
      </Alert>
    </div>
  );
}
