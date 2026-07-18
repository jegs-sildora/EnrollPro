import { AnimatedError } from "@/shared/components/AnimatedError";
import { Controller, useFormContext } from "react-hook-form";
import type { EnrollmentFormData } from "../types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import {
  AlertCircle,
  Camera,
  X,
  Search,
  Mars,
  Venus,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  differenceInYears,
  format,
  isAfter,
  isBefore,
  isValid,
  parse,
} from "date-fns";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useState, useEffect, useCallback } from "react";
import { UserPhoto } from "@/shared/components/UserPhoto";

export default function Step1Personal() {
  const {
    register,
    watch,
    control,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();
  const birthdate = watch("birthdate");
  const studentPhoto = watch("studentPhoto");
  const lrn = watch("lrn");
  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");
  const hasNoLrn = watch("hasNoLrn");
  const intakeHeightCm = watch("intakeHeightCm");
  const intakeWeightKg = watch("intakeWeightKg");

  let calculatedBmi = "";
  if (intakeHeightCm && intakeWeightKg) {
    const bmiValue = intakeWeightKg / Math.pow(intakeHeightCm / 100, 2);
    let category = "";
    if (bmiValue < 18.5) category = "Underweight";
    else if (bmiValue < 25) category = "Normal";
    else if (bmiValue < 30) category = "Overweight";
    else category = "Obese";

    calculatedBmi = `${bmiValue.toFixed(2)} (${category})`;
  }

  const canDeclareNoLrn =
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && gradeLevel === "7");
  const [dateInput, setDateInput] = useState(() => {
    if (!birthdate) return "";
    const d = new Date(birthdate);
    return isValid(d) ? format(d, "MM/dd/yyyy") : "";
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (birthdate) {
      const d = new Date(birthdate);
      if (isValid(d)) return d;
    }
    return new Date();
  });
  const [hasNoMiddleName, setHasNoMiddleName] = useState(false);

  const clearLinkedEarlyRegistration = useCallback(() => {
    setValue("earlyRegistrationId", undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [setValue]);

  useEffect(() => {
    if (!canDeclareNoLrn && hasNoLrn) {
      setValue("hasNoLrn", false, { shouldValidate: true, shouldDirty: true });
    }
  }, [canDeclareNoLrn, hasNoLrn, setValue]);

  useEffect(() => {
    if (!hasNoLrn) return;
    if (lrn) {
      setValue("lrn", "", { shouldValidate: true, shouldDirty: true });
    }
    clearLinkedEarlyRegistration();
    clearErrors("lrn");
  }, [hasNoLrn, lrn, setValue, clearErrors, clearLinkedEarlyRegistration]);

  useEffect(() => {
    if (!birthdate) {
      setDateInput("");
      return;
    }
    const d = new Date(birthdate);
    if (!isValid(d)) {
      setDateInput("");
      return;
    }

    setDateInput(format(d, "MM/dd/yyyy"));
    setCalendarMonth(d);
    const age = differenceInYears(new Date(), d);
    setValue("age", age >= 0 ? age : 0);
  }, [birthdate, setValue]);



  const handleDateTyping = (
    value: string,
    onChange: (val: Date | undefined) => void,
  ) => {
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

    if (masked.length === 10) {
      const parsedDate = parse(masked, "MM/dd/yyyy", new Date());
      if (
        isValid(parsedDate) &&
        !isAfter(parsedDate, new Date()) &&
        !isBefore(parsedDate, new Date(1900, 0, 1))
      ) {
        onChange(parsedDate);
        setCalendarMonth(parsedDate);
      } else {
        onChange(undefined);
      }
    } else {
      onChange(undefined);
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
      setValue("studentPhoto", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setValue("studentPhoto", undefined);
  };

  return (
    <div className="space-y-8">
      {/* ─── LRN Section ─── */}
      <div className="p-6 border rounded-2xl space-y-4 bg-muted/20 border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted text-foreground">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base leading-tight font-extrabold uppercase text-foreground">
              Learner Reference Number (LRN)
            </h3>
            <p className="text-base text-foreground font-extrabold">
              Enter your 12-digit LRN to continue enrollment.
            </p>
          </div>
        </div>

        <div className="relative">
          <Input
            id="lrn"
            {...register("lrn")}
            autoComplete="off"
            placeholder="ENTER 12-DIGIT LRN"
            maxLength={12}
            disabled={hasNoLrn}
            className={cn(
              "h-14 text-lg  font-extrabold text-center border-2",
              hasNoLrn && "bg-muted cursor-not-allowed  text-base leading-tight",
              errors.lrn
                ? "border-destructive"
                : "border-primary/30 focus:border-primary",
            )}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(
                /[^0-9]/g,
                "",
              );
            }}
          />
        </div>

        <p className="text-base font-extrabold text-foreground">
          {hasNoLrn
            ? "No LRN declared. Registrar will process this learner under pending LRN creation."
            : canDeclareNoLrn
              ? "Provide LRN, or declare no LRN below if the learner is incoming Grade 7 or transferee."
              : "LRN is required for this learner category."}
        </p>

        {canDeclareNoLrn && (
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id="hasNoLrn"
              checked={hasNoLrn}
              onCheckedChange={(checked) => {
                const nextChecked = checked === true;
                setValue("hasNoLrn", nextChecked, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                if (nextChecked) {
                  setValue("lrn", "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  clearErrors("lrn");
                }
              }}
            />
            <Label
              htmlFor="hasNoLrn"
              className="text-base font-extrabold cursor-pointer">
              Learner has no LRN yet.
            </Label>
          </div>
        )}

        <AnimatedError error={errors.lrn?.message as string || errors.lrn as unknown as string} />
      </div>

      {/* ─── Name & Photo Section ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* PHOTO UPLOADER COLUMN */}
        <div className="md:col-span-1 flex flex-col items-center justify-center space-y-3">
          <Label className="text-base leading-tight font-extrabold self-start md:self-center">
            Student Photo
          </Label>
          <div className="relative group">
            <UserPhoto
              photo={studentPhoto}
              containerClassName={cn(
                "w-32 h-32 rounded-lg border-2 border-dashed transition-all duration-200",
                studentPhoto
                  ? "border-primary/50 bg-background"
                  : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80",
              )}
              fallbackIcon={
                <div className="flex flex-col items-center text-foreground group-hover:text-primary transition-colors">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-[0.625rem] uppercase font-extrabold ">
                    Upload 2x2
                  </span>
                </div>
              }>
              {studentPhoto && (
                <button
                  onClick={clearPhoto}
                  type="button"
                  className="absolute top-1 right-1 p-1 bg-primary text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20">
                  <X className="w-3 h-3" />
                </button>
              )}
            </UserPhoto>
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handlePhotoChange}
              title="Upload student photo"
            />
          </div>
        </div>

        {/* NAME FIELDS COLUMN */}
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="lastName"
              className="text-base leading-tight font-extrabold">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              {...register("lastName")}
              autoComplete="off"
              placeholder="e.g. DELA CRUZ"
              className={cn(
                "h-11 uppercase font-extrabold",
                errors.lastName &&
                "border-destructive focus-visible:ring-destructive",
              )}
            />
            <AnimatedError error={errors.lastName?.message as string || errors.lastName as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="firstName"
              className="text-base leading-tight font-extrabold">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              {...register("firstName")}
              autoComplete="off"
              placeholder="e.g. JUAN"
              className={cn(
                "h-11 uppercase font-extrabold",
                errors.firstName &&
                "border-destructive focus-visible:ring-destructive",
              )}
            />
            <AnimatedError error={errors.firstName?.message as string || errors.firstName as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="middleName"
              className="text-base leading-tight font-extrabold">
              Middle Name
            </Label>
            <Input
              id="middleName"
              {...register("middleName")}
              autoComplete="off"
              disabled={hasNoMiddleName}
              placeholder="e.g. BAUTISTA"
              className={cn("h-11 uppercase font-extrabold", hasNoMiddleName && "bg-muted cursor-not-allowed opacity-50")}
            />
            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                id="noMiddleName"
                checked={hasNoMiddleName}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  setHasNoMiddleName(isChecked);
                  if (isChecked) {
                    setValue("middleName", "");
                  }
                }}
              />
              <Label htmlFor="noMiddleName" className="text-base cursor-pointer">
                No Middle Name.
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="extensionName"
              className="text-base leading-tight font-extrabold">
              Suffix (Extension)
            </Label>
            <Select
              onValueChange={(val) => setValue("extensionName", val === "NONE" ? "" : val)}
              value={watch("extensionName") || "NONE"}>
              <SelectTrigger className="h-11 font-extrabold">
                <SelectValue placeholder="Select Suffix" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None</SelectItem>
                {["Jr.", "Sr.", "II", "III", "IV", "V"].map((opt) => (
                  <SelectItem
                    key={opt}
                    value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─── DOB, Age, Sex Row ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        <div className="space-y-1.5">
          <Label className="text-base leading-tight font-extrabold">
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
                    "h-11 font-extrabold pr-12",
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
                          isCalendarOpen ? "text-primary" : "text-foreground",
                        )}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="end">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={field.value ? new Date(field.value) : undefined}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      onSelect={(date) => {
                        if (date) {
                          field.onChange(date);
                          setDateInput(format(date, "MM/dd/yyyy"));
                          setCalendarMonth(date);
                          setIsCalendarOpen(false);
                        }
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date(1950, 0, 1)
                      }
                      startMonth={new Date(1900, 0, 1)}
                      endMonth={new Date(2100, 11, 31)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          />
          <AnimatedError error={errors.birthdate?.message as string || errors.birthdate as unknown as string} />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="age"
            className="text-base leading-tight font-extrabold">
            Age
          </Label>
          <Input
            id="age"
            {...register("age", { valueAsNumber: true })}
            autoComplete="off"
            disabled
            className="h-11 font-extrabold cursor-not-allowed disabled:opacity-100 disabled:bg-muted"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-base leading-tight font-extrabold">
            Sex <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-4 pt-1">
            {(
              [
                { value: "Male", label: "MALE", icon: Mars },
                { value: "Female", label: "FEMALE", icon: Venus },
              ] as const
            ).map((sexOption) => (
              <button
                key={sexOption.value}
                type="button"
                onClick={() =>
                  setValue("sex", sexOption.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight uppercase",
                  watch("sex") === sexOption.value
                    ? "border-primary bg-primary/5 font-extrabold"
                    : errors.sex
                      ? "border-destructive hover:bg-destructive/10"
                      : "border-border hover:bg-muted/50",
                )}>
                <sexOption.icon
                  className={cn(
                    "w-4 h-4",
                    watch("sex") === sexOption.value
                      ? "text-primary"
                      : "text-foreground",
                  )}
                />
                <span className="font-extrabold">{sexOption.label}</span>
              </button>
            ))}
          </div>
          <AnimatedError error={errors.sex?.message as string || errors.sex as unknown as string} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1.5">
          <Label
            htmlFor="placeOfBirth"
            className="text-base leading-tight font-extrabold">
            Place of Birth <span className="text-destructive">*</span>
          </Label>
          <Input
            id="placeOfBirth"
            {...register("placeOfBirth")}
            autoComplete="off"
            placeholder="City/Municipality, Province"
            className={cn(
              "h-11 font-extrabold uppercase",
              errors.placeOfBirth && "border-destructive",
            )}
          />
          <AnimatedError error={errors.placeOfBirth?.message as string || errors.placeOfBirth as unknown as string} />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="motherTongue"
            className="text-base leading-tight font-extrabold">
            Mother Tongue
          </Label>
          <Input
            id="motherTongue"
            {...register("motherTongue")}
            autoComplete="off"
            placeholder="e.g. Hiligaynon, Cebuano, Tagalog"
            className="h-11 font-extrabold uppercase"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-border/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="religion"
              className="text-base leading-tight font-extrabold">
              Religion
            </Label>
            <Input
              id="religion"
              {...register("religion")}
              autoComplete="off"
              placeholder="e.g. Roman Catholic, Iglesia ni Cristo, Islam"
              className="h-11 font-extrabold uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="psaBirthCertNumber"
              className="text-base leading-tight font-extrabold">
              PSA Birth Certificate Number
            </Label>
            <Input
              id="psaBirthCertNumber"
              {...register("psaBirthCertNumber", {
                setValueAs: (value) =>
                  typeof value === "string"
                    ? value.trim().toUpperCase()
                    : value,
              })}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
              }}
              autoComplete="off"
              placeholder="PSA BC Number"
              className="h-11 font-extrabold uppercase"
            />
          </div>
        </div>
      </div>

      {/* ─── Vital Statistics ─── */}
      <div className="pt-6 border-t border-border/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="intakeHeightCm"
              className="text-base leading-tight font-extrabold">
              Height (in cm) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="intakeHeightCm"
              type="number"
              {...register("intakeHeightCm", { valueAsNumber: true })}
              autoComplete="off"
              placeholder="e.g. 150"
              className={cn(
                "h-11 font-extrabold",
                errors.intakeHeightCm && "border-destructive",
              )}
            />
            <AnimatedError error={errors.intakeHeightCm?.message as string || errors.intakeHeightCm as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="intakeWeightKg"
              className="text-base leading-tight font-extrabold">
              Weight (in kg) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="intakeWeightKg"
              type="number"
              {...register("intakeWeightKg", { valueAsNumber: true })}
              autoComplete="off"
              placeholder="e.g. 45"
              className={cn(
                "h-11 font-extrabold",
                errors.intakeWeightKg && "border-destructive",
              )}
            />
            <AnimatedError error={errors.intakeWeightKg?.message as string || errors.intakeWeightKg as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-base leading-tight font-extrabold">
              Body Mass Index (BMI)
            </Label>
            <Input
              value={calculatedBmi}
              readOnly
              disabled
              placeholder="Auto-calculated"
              className="h-11 font-extrabold cursor-not-allowed disabled:opacity-100 disabled:bg-muted"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
