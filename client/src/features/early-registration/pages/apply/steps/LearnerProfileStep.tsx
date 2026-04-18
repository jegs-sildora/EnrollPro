import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import type { EarlyRegFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Checkbox } from "@/shared/ui/checkbox";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import {
  AlertCircle,
  Lock,
  Mars,
  Venus,
  Camera,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  differenceInYears,
  isValid,
  parse,
  format,
  isAfter,
  isBefore,
} from "date-fns";
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
] as const;

type DisabilityValue = (typeof DISABILITY_TYPES)[number]["value"];

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
  const studentPhoto = watch("studentPhoto");
  const isIp = watch("isIpCommunity");
  const isPwd = watch("isLearnerWithDisability");
  const selectedDisabilities =
    (watch("disabilityTypes") as DisabilityValue[] | null) || [];
  const disabilityErrorMessage =
    typeof errors.disabilityTypes?.message === "string"
      ? errors.disabilityTypes.message
      : undefined;

  const [dateInput, setDateInput] = React.useState(() => {
    if (birthdate) {
      const d = new Date(birthdate);
      return isValid(d) ? format(d, "MM/dd/yyyy") : "";
    }
    return "";
  });

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => {
    if (birthdate) {
      const d = new Date(birthdate);
      if (isValid(d)) return d;
    }
    return new Date();
  });

  const age = React.useMemo(() => {
    if (!birthdate) return null;
    const d = new Date(birthdate);
    if (!isValid(d)) return null;
    const calculated = differenceInYears(new Date(), d);
    return calculated >= 0 ? calculated : null;
  }, [birthdate]);

  // Handle manual typing with MM/DD/YYYY mask
  const handleDateTyping = (value: string, onChange: (val: string) => void) => {
    const isDeleting = value.length < dateInput.length;
    const cleaned = value.replace(/\D/g, "").slice(0, 8);

    let masked = "";
    if (cleaned.length > 0) {
      masked = cleaned.slice(0, 2);
      if (cleaned.length > 2 || (cleaned.length === 2 && !isDeleting)) {
        masked += "/";
      }
      if (cleaned.length > 2) {
        masked += cleaned.slice(2, 4);
        if (cleaned.length > 4 || (cleaned.length === 4 && !isDeleting)) {
          masked += "/";
        }
      }
      if (cleaned.length > 4) {
        masked += cleaned.slice(4, 8);
      }
    }

    setDateInput(masked);

    // If valid date, update form state
    if (masked.length === 10) {
      const parsedDate = parse(masked, "MM/dd/yyyy", new Date());
      if (
        isValid(parsedDate) &&
        !isAfter(parsedDate, new Date()) &&
        !isBefore(parsedDate, new Date(1900, 0, 1))
      ) {
        onChange(parsedDate.toISOString());
        setCalendarMonth(parsedDate);
      } else {
        onChange("");
      }
    } else {
      onChange("");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      alert("Only JPG and PNG files are accepted");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setValue("studentPhoto", reader.result as string, {
        shouldDirty: true,
        shouldValidate: true,
      });
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setValue("studentPhoto", undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <div className="md:col-span-1 flex flex-col items-center justify-center space-y-3">
          <Label className="text-sm font-semibold self-start md:self-center">
            Student Photo
          </Label>
          <div className="relative group">
            <div
              className={cn(
                "w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-200",
                studentPhoto
                  ? "border-primary/50 bg-background"
                  : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80",
              )}>
              {studentPhoto ? (
                <div className="relative w-full h-full">
                  <img
                    src={studentPhoto}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={clearPhoto}
                    type="button"
                    className="absolute top-1 right-1 p-1 bg-primary text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-muted-foreground group-hover:text-primary transition-colors">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-[0.625rem] uppercase font-bold tracking-tight">
                    Upload 2x2
                  </span>
                </div>
              )}
            </div>
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handlePhotoChange}
              title="Upload student photo"
            />
          </div>
        </div>

        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
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
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
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
              placeholder="Type N/A if none"
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
      </div>

      {/* Birthdate + Age + Sex + Place of Birth */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="birthdate"
            render={({ field }) => (
              <div className="relative">
                <Input
                  placeholder="MM/DD/YYYY"
                  maxLength={10}
                  inputMode="numeric"
                  value={dateInput}
                  onChange={(e) =>
                    handleDateTyping(e.target.value, field.onChange)
                  }
                  className={cn(
                    "h-11 font-bold pr-12",
                    errors.birthdate &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                <Popover
                  open={isCalendarOpen}
                  onOpenChange={(open) => {
                    if (open && field.value) {
                      const d = new Date(field.value);
                      if (isValid(d)) setCalendarMonth(d);
                    }
                    setIsCalendarOpen(open);
                  }}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 hover:bg-transparent">
                      <CalendarIcon
                        className={cn(
                          "w-5 h-5 transition-colors",
                          isCalendarOpen
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={field.value ? new Date(field.value) : undefined}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      onSelect={(date) => {
                        if (date) {
                          field.onChange(date.toISOString());
                          setDateInput(format(date, "MM/dd/yyyy"));
                          setCalendarMonth(date);
                          setIsCalendarOpen(false);
                        }
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date(1950, 0, 1)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          />
          {errors.birthdate && (
            <p className="text-xs text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.birthdate.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Age</Label>
          <div className="h-11 flex items-center px-3 rounded-md border bg-muted text-sm font-bold">
            {age !== null ? `${age}` : "—"}
          </div>
          <p className="text-[0.625rem] text-muted-foreground italic">
            Auto-calculated from Date of Birth.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">
            Sex at Birth <span className="text-destructive">*</span>
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
                  setValue("sex", s.value, {
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
            <p className="text-xs text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.sex.message}
            </p>
          )}
        </div>
        
        <div className="md:col-span-3 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="space-y-1.5">
            <Label htmlFor="placeOfBirth" className="text-sm font-semibold">
              Place of Birth <span className="text-destructive">*</span>
            </Label>
            <Input
              id="placeOfBirth"
              {...register("placeOfBirth")}
              placeholder="e.g. QUEZON CITY"
              autoComplete="off"
              className={cn(
                "h-11 font-bold uppercase",
                errors.placeOfBirth &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
              }}
            />
            {errors.placeOfBirth && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.placeOfBirth.message}
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
              Kept strictly confidential for enrollment processing.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {/* IP Community Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold flex items-center gap-2">
                Indigenous Peoples (IP) Affiliation?
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
                Learner belongs to an IP community.
              </Label>
            </div>
            {isIp && (
              <div className="space-y-2 pt-1 max-w-screen">
                <Label
                  htmlFor="ipGroupName"
                  className="text-xs font-bold uppercase text-muted-foreground">
                  IP Group / Ethnicity{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ipGroupName"
                  {...register("ipGroupName")}
                  placeholder="e.g. MANGYAN, T'BOLI"
                  className={cn(
                    "h-11 font-bold uppercase",
                    errors.ipGroupName &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.toUpperCase();
                  }}
                />
                {errors.ipGroupName && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
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
                Learner is a person with disability.
              </Label>
            </div>
            {isPwd && (
              <div className="space-y-3 pt-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Select Disability Type(s){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DISABILITY_TYPES.map((dt) => {
                    const isSelected = selectedDisabilities.includes(dt.value);
                    return (
                      <Label
                        key={dt.value}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors text-sm",
                          isSelected
                            ? "border-primary bg-primary/5 font-bold"
                            : errors.disabilityTypes
                              ? "border-destructive hover:bg-destructive/10"
                              : "border-border hover:bg-muted/50",
                        )}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const current = [...selectedDisabilities];
                            if (!checked) {
                              setValue(
                                "disabilityTypes",
                                current.filter((d) => d !== dt.value),
                                { shouldValidate: true },
                              );
                            } else {
                              setValue(
                                "disabilityTypes",
                                [...current, dt.value],
                                { shouldValidate: true },
                              );
                            }
                          }}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        {dt.label}
                      </Label>
                    );
                  })}
                </div>
                {disabilityErrorMessage && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {disabilityErrorMessage}
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
