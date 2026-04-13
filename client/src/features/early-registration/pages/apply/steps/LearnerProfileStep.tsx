import { useFormContext, Controller } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { DatePicker } from "@/shared/ui/date-picker";
import { AlertCircle, Lock, Mars, Venus } from "lucide-react";
import { differenceInYears } from "date-fns";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";

const DISABILITY_TYPES = [
  { value: "VISUAL", label: "Visual Impairment" },
  { value: "HEARING", label: "Hearing Impairment" },
  { value: "INTELLECTUAL", label: "Intellectual Disability" },
  { value: "LEARNING", label: "Learning Disability" },
  { value: "PSYCHOSOCIAL", label: "Psychosocial Disability" },
  { value: "ORTHOPEDIC", label: "Orthopedic/Physical Disability" },
  { value: "SPEECH", label: "Speech/Language Disorder" },
  { value: "AUTISM", label: "Autism Spectrum Disorder" },
  { value: "CHRONIC_ILLNESS", label: "Chronic Illness" },
  { value: "MULTIPLE", label: "Multiple Disabilities" },
];

export default function LearnerProfileStep() {
  const {
    register,
    watch,
    setValue,
    control,
    clearErrors,
    formState: { errors },
  } = useFormContext<EarlyRegFormData>();

  const birthdate = watch("birthdate");
  const isIp = watch("isIpCommunity");
  const isPwd = watch("isLearnerWithDisability");
  const selectedDisabilities = watch("disabilityTypes") || [];

  const age = birthdate
    ? differenceInYears(new Date(), new Date(birthdate))
    : null;

  return (
    <div className="space-y-6">
      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-sm font-semibold">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            {...register("lastName")}
            placeholder="e.g. DELA CRUZ"
            autoComplete="off"
            className={cn(
              "h-11 uppercase font-bold",
              errors.lastName &&
                "border-destructive focus-visible:ring-destructive",
            )}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
          {errors.lastName && (
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.lastName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="text-sm font-semibold">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            {...register("firstName")}
            placeholder="e.g. JUAN"
            autoComplete="off"
            className={cn(
              "h-11 uppercase font-bold",
              errors.firstName &&
                "border-destructive focus-visible:ring-destructive",
            )}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
          {errors.firstName && (
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="middleName" className="text-sm font-semibold">
            Middle Name
          </Label>
          <Input
            id="middleName"
            {...register("middleName")}
            placeholder="Write N/A if none"
            autoComplete="off"
            className="h-11 uppercase font-bold"
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="extensionName" className="text-sm font-semibold">
            Suffix (Extension)
          </Label>
          <Input
            id="extensionName"
            {...register("extensionName")}
            placeholder="e.g. JR., III"
            autoComplete="off"
            className="h-11 uppercase font-bold"
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
        </div>
      </div>

      {/* Birthdate + Age + Sex */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="birthdate"
            render={({ field }) => (
              <DatePicker
                date={field.value ? new Date(field.value) : undefined}
                setDate={(date?: Date) => {
                  field.onChange(date ? date.toISOString() : "");
                }}
                placeholder="Select your Birthdate"
                minDate={new Date(2000, 0, 1)}
                maxDate={new Date()}
                className={cn(
                  "h-11 font-bold uppercase w-full",
                  errors.birthdate 
                    ? "border-destructive text-destructive focus:ring-destructive" 
                    : "border-input"
                )}
              />
            )}
          />
          {errors.birthdate && (
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.birthdate.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Age</Label>
          <div className="h-11 flex items-center px-3 rounded-md border bg-muted text-sm font-bold">
            {age !== null && age >= 0 ? `${age} YEARS OLD` : "—"}
          </div>
          <p className="text-[0.625rem] text-muted-foreground italic">
            Auto-calculated
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">
            Sex <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-4 pt-1">
            {(
              [
                { value: "MALE", label: "MALE", icon: Mars },
                { value: "FEMALE", label: "FEMALE", icon: Venus },
              ] as const
            ).map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() =>
                  setValue("sex", s.value as any, {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-4 py-2 cursor-pointer transition-colors text-sm uppercase",
                  watch("sex") === s.value
                    ? "border-primary bg-primary/5 font-bold"
                    : errors.sex
                      ? "border-destructive hover:bg-destructive/10"
                      : "border-border hover:bg-muted/50",
                )}>
                <s.icon
                  className={cn(
                    "w-4 h-4",
                    watch("sex") === s.value
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span className="font-bold">{s.label}</span>
              </button>
            ))}
          </div>
          {errors.sex && (
            <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.sex.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="religion" className="text-sm font-semibold">
            Religion
          </Label>
          <Input
            id="religion"
            {...register("religion")}
            placeholder="e.g. ROMAN CATHOLIC"
            autoComplete="off"
            className="h-11 font-bold uppercase"
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
        </div>
      </div>

      <div className="pt-6 border-t border-border/40">
        <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl mb-8">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-border">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">
              Sensitive Information
            </p>
            <p className="text-[0.6875rem] text-primary font-medium uppercase tracking-wider">
              All details are kept strictly confidential.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {/* IP Community Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold flex items-center gap-2">
                Indigenous Peoples (IP) Community?
              </Label>
              <Badge
                variant="outline"
                className="text-[0.625rem] uppercase border-primary/20 text-primary gap-1 font-bold">
                <Lock className="w-2.5 h-2.5" /> Confidential
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is-ip"
                checked={isIp}
                onCheckedChange={(v) => {
                  setValue("isIpCommunity", v);
                  if (!v) {
                    setValue("ipGroupName", "");
                    clearErrors("ipGroupName");
                  }
                }}
              />
              <Label
                htmlFor="is-ip"
                className="text-sm font-semibold cursor-pointer">
                Learner belongs to an IP community
              </Label>
            </div>
            {isIp && (
              <div className="space-y-2 pt-1 max-w-sm">
                <Label
                  htmlFor="ipGroupName"
                  className="text-xs font-bold uppercase text-muted-foreground">
                  Specify IP Group/Ethnicity{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ipGroupName"
                  {...register("ipGroupName")}
                  placeholder="e.g. MANGYAN, T'BOLI"
                  className={cn(
                    "h-11 font-bold uppercase",
                    errors.ipGroupName && "border-destructive focus-visible:ring-destructive"
                  )}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.toUpperCase();
                  }}
                />
                {errors.ipGroupName && (
                  <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.ipGroupName.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* PWD Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">
                Person with Disability (PWD)?
              </Label>
              <Badge
                variant="outline"
                className="text-[0.625rem] uppercase border-primary/20 text-primary gap-1 font-bold">
                <Lock className="w-2.5 h-2.5" /> Confidential
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is-pwd"
                checked={isPwd}
                onCheckedChange={(v) => {
                  setValue("isLearnerWithDisability", v);
                  if (!v) {
                    setValue("disabilityTypes", []);
                    clearErrors("disabilityTypes");
                  }
                }}
              />
              <Label
                htmlFor="is-pwd"
                className="text-sm font-semibold cursor-pointer">
                Learner is a person with disability
              </Label>
            </div>
            {isPwd && (
              <div className="space-y-3 pt-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Specify Disability Type(s){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DISABILITY_TYPES.map((dt) => {
                    const isSelected = selectedDisabilities.includes(
                      dt.value as any,
                    );
                    return (
                      <Label
                        key={dt.value}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                          isSelected
                            ? "border-primary bg-primary/5 font-bold"
                            : errors.disabilityTypes
                              ? "border-destructive hover:bg-destructive/10"
                              : "border-border hover:bg-muted/50",
                        )}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const current = [...(selectedDisabilities || [])];
                            if (isSelected) {
                              setValue(
                                "disabilityTypes",
                                current.filter((d) => d !== dt.value),
                                { shouldValidate: true }
                              );
                            } else {
                              setValue("disabilityTypes", [
                                ...current,
                                dt.value as any,
                              ], { shouldValidate: true });
                            }
                          }}
                          className="w-4 h-4 rounded border-primary"
                        />
                        {dt.label}
                      </Label>
                    );
                  })}
                </div>
                {errors.disabilityTypes && (
                  <p className="text-[0.6875rem] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {(errors.disabilityTypes as any)?.message}
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
