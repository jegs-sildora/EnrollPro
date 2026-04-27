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
import { Info, ShieldAlert } from "lucide-react";
import { cn, getManilaNow } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

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
  const hasSf9CertificationLetter = watch("hasSf9CertificationLetter");
  const hasUnsettledPrivateAccount = watch("hasUnsettledPrivateAccount");
  const hasExecutedAffidavit = watch("hasExecutedAffidavit");

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
              placeholder="e.g. HNHS Elementary School"
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
              Last Grade Completed <span className="text-destructive">*</span>
            </Label>
            <Input
              autoComplete="off"
              id="prev-grade"
              {...register("lastGradeCompleted")}
              placeholder="e.g. GRADE 6"
              className={cn(
                "h-11 font-bold uppercase",
                errors.lastGradeCompleted &&
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
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-black uppercase text-primary">
            DepEd Order 017, s. 2025: Compliance & Deficiencies
          </h3>
        </div>

        <div className="rounded-2xl border-2 border-primary/10 bg-primary/5 p-6 space-y-6 shadow-sm">
          <p className="text-xs font-bold text-foreground/70 leading-relaxed">
            If the learner is unable to provide standard transfer credentials or
            has financial issues with a private school, please flag it here.
            <span className="block mt-1 opacity-80 italic">
              The learner will be admitted as "Temporarily Enrolled" until
              credentials are provided or legal requirements met.
            </span>
          </p>

          <div className="space-y-4">
            <div className="flex flex-col space-y-4 p-4 bg-white rounded-xl border border-primary/10 shadow-sm transition-all duration-200">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="missing-sf9"
                  checked={isMissingSf9}
                  onCheckedChange={(checked) => {
                    setValue("isMissingSf9", checked === true);
                    if (!checked) setValue("hasSf9CertificationLetter", false);
                  }}
                  className="mt-1 border-primary data-[state=checked]:bg-primary"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="missing-sf9"
                    className="text-sm font-bold text-foreground cursor-pointer select-none">
                    Missing SF9 (Report Card)
                  </Label>
                  <p className="text-xs font-bold text-foreground uppercase">
                    Learner is currently unable to provide the SF9 from the
                    originating school.
                  </p>
                </div>
              </div>

              {isMissingSf9 && (
                <div className="pl-7 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <Label className="text-xs font-black uppercase text-primary/50 tracking-widest block mb-2">
                      ↳ Select Alternative Status:
                    </Label>
                    <RadioGroup
                      onValueChange={(val) =>
                        setValue("hasSf9CertificationLetter", val === "true")
                      }
                      value={hasSf9CertificationLetter ? "true" : "false"}
                      className="flex flex-col gap-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="false"
                          id="sf9-none"
                          className="border-primary text-primary"
                        />
                        <div className="grid gap-0.5 leading-none">
                          <Label
                            htmlFor="sf9-none"
                            className="text-xs font-bold text-foreground cursor-pointer">
                            No substitute document provided
                          </Label>
                          <p className="text-xs text-foreground italic font-bold">
                            Flags learner as "Temporarily Enrolled"
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="true"
                          id="sf9-cert"
                          className="border-primary text-primary"
                        />
                        <div className="grid gap-0.5 leading-none">
                          <Label
                            htmlFor="sf9-cert"
                            className="text-xs font-bold text-foreground cursor-pointer">
                            Provided Certification Letter from previous School
                            Registrar
                          </Label>
                          <p className="text-xs font-bold uppercase">
                            Satisfies transfer requirement. Learner will be
                            Officially Enrolled.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-4 p-4 bg-white rounded-xl border border-primary/10 shadow-sm transition-all duration-200">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="private-debt"
                  checked={hasUnsettledPrivateAccount}
                  onCheckedChange={(checked) =>
                    setValue("hasUnsettledPrivateAccount", checked === true)
                  }
                  className="mt-1 border-primary data-[state=checked]:bg-primary"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="private-debt"
                    className="text-sm font-bold text-foreground cursor-pointer select-none">
                    Unsettled Private School Account
                  </Label>
                  <p className="text-xs font-bold text-foreground uppercase ">
                    Learner has existing financial obligations at a private
                    institution.
                  </p>
                </div>
              </div>

              {hasUnsettledPrivateAccount && (
                <div className="pl-7 space-y-5 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label
                      htmlFor="origin-school"
                      className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                      Originating School Name
                    </Label>
                    <Input
                      id="origin-school"
                      {...register("originatingSchoolName")}
                      placeholder="e.g. St. Scholastica's Academy"
                      className="h-10 bg-muted/30 border-border font-bold uppercase placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div
                    className={cn(
                      "rounded-xl border p-4 space-y-4 transition-colors",
                      errors.hasExecutedAffidavit
                        ? "border-destructive bg-destructive/5"
                        : "bg-primary/5 border-primary/10",
                    )}>
                    <div className="flex items-center gap-2">
                      <Info
                        className={cn(
                          "h-4 w-4",
                          errors.hasExecutedAffidavit
                            ? "text-destructive"
                            : "text-primary",
                        )}
                      />
                      <p
                        className={cn(
                          "text-xs font-black uppercase tracking-tight",
                          errors.hasExecutedAffidavit
                            ? "text-destructive"
                            : "text-primary",
                        )}>
                        DepEd Mandate: Affidavit of Undertaking
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-xs font-bold leading-relaxed",
                        errors.hasExecutedAffidavit
                          ? "text-destructive/80"
                          : "text-foreground/80",
                      )}>
                      Per DO 017, s. 2025, the parent/guardian must execute an
                      affidavit acknowledging the debt to proceed.
                    </p>

                    <div className="space-y-3 pt-1">
                      <Label
                        className={cn(
                          "text-xs font-black uppercase tracking-widest block",
                          errors.hasExecutedAffidavit
                            ? "text-destructive"
                            : "text-primary/50",
                        )}>
                        Required Action:
                      </Label>
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id="affidavit-confirm"
                          checked={!!hasExecutedAffidavit}
                          className={cn(
                            errors.hasExecutedAffidavit &&
                              "border-destructive data-[state=unchecked]:border-destructive",
                          )}
                          onCheckedChange={(checked) => {
                            setValue("hasExecutedAffidavit", checked === true, {
                              shouldValidate: true,
                            });
                          }}
                        />
                        <div className="grid gap-1">
                          <Label
                            htmlFor="affidavit-confirm"
                            className={cn(
                              "text-xs font-bold leading-snug cursor-pointer select-none",
                              errors.hasExecutedAffidavit
                                ? "text-destructive"
                                : "text-foreground",
                            )}>
                            I confirm that the Affidavit of Undertaking has been
                            physically executed by the parent/guardian and filed
                            in the school's physical records.
                          </Label>
                          <p
                            className={cn(
                              "text-xs italic font-medium",
                              errors.hasExecutedAffidavit
                                ? "text-destructive/60"
                                : "text-muted-foreground",
                            )}>
                            (Learner will be flagged as "Temporarily Enrolled"
                            in LIS)
                          </p>
                        </div>
                      </div>
                      {errors.hasExecutedAffidavit && (
                        <p className="text-xs text-destructive font-black uppercase flex items-center gap-1 mt-2">
                          <ShieldAlert className="h-3 w-3" />
                          {errors.hasExecutedAffidavit.message}
                        </p>
                      )}
                    </div>
                  </div>{" "}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
