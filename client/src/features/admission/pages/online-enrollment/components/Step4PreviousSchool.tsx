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
import { Info, HelpCircle, ShieldAlert } from "lucide-react";
import { cn, getManilaNow } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";

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

  const isMissingSf9 = watch("isMissingSf9");
  const hasUnsettledPrivateAccount = watch("hasUnsettledPrivateAccount");

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
                    setValue("generalAverage", val as unknown as number, {
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

      <div className="pt-6 border-t space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-black uppercase tracking-tight text-amber-700">
            DepEd Order 017, s. 2025: Compliance & Deficiencies
          </h3>
        </div>

        <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-6 space-y-6">
          <p className="text-xs font-bold text-amber-900/70 leading-relaxed">
            If the learner is unable to provide standard transfer credentials or has financial issues with a private school, please flag it here. 
            <span className="block mt-1 opacity-80 italic">Learner will be admitted as "Temporarily Enrolled" until resolved.</span>
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-white rounded-xl border border-amber-200/60 shadow-sm">
              <Checkbox
                id="missing-sf9"
                checked={isMissingSf9}
                onCheckedChange={(checked) => setValue("isMissingSf9", checked === true)}
                className="mt-1 border-amber-400 data-[state=checked]:bg-amber-600"
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="missing-sf9" className="text-sm font-bold text-amber-950 cursor-pointer select-none">
                  Missing SF9 (Report Card)
                </Label>
                <p className="text-[10px] font-medium text-amber-700/70">
                  Learner failed to submit SF9 from the originating school.
                </p>
              </div>
            </div>

            <div className="flex flex-col space-y-4 p-4 bg-white rounded-xl border border-amber-200/60 shadow-sm">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="private-debt"
                  checked={hasUnsettledPrivateAccount}
                  onCheckedChange={(checked) => setValue("hasUnsettledPrivateAccount", checked === true)}
                  className="mt-1 border-amber-400 data-[state=checked]:bg-amber-600"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="private-debt" className="text-sm font-bold text-amber-950 cursor-pointer select-none">
                    Unsettled Private School Account
                  </Label>
                  <p className="text-[10px] font-medium text-amber-700/70">
                    Learner has existing financial obligations at a private institution.
                  </p>
                </div>
              </div>

              {hasUnsettledPrivateAccount && (
                <div className="pl-7 space-y-2 animate-in slide-in-from-top-2 duration-200">
                   <Label htmlFor="origin-school" className="text-[10px] font-black uppercase text-amber-900/50 tracking-widest">
                    Originating School Name
                   </Label>
                   <Input 
                    id="origin-school"
                    {...register("originatingSchoolName")}
                    placeholder="e.g. St. Scholastica's Academy"
                    className="h-10 bg-amber-50/30 border-amber-200 font-bold uppercase placeholder:text-amber-300"
                   />
                </div>
              )}
            </div>
          </div>
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
