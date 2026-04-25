import { Controller, useFormContext } from "react-hook-form";
import { isAxiosError } from "axios";
import type { EnrollmentFormData } from "../../online-enrollment/types";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import {
  AlertCircle,
  Camera,
  X,
  Loader2,
  CheckCircle2,
  Search,
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
import { useState, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { sileo } from "sileo";

export default function Step1Personal() {
  const {
    register,
    watch,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();
  const birthdate = watch("birthdate");
  const studentPhoto = watch("studentPhoto");
  const lrn = watch("lrn");
  const learnerType = watch("learnerType");
  const gradeLevel = watch("gradeLevel");
  const hasNoLrn = watch("hasNoLrn");
  const canDeclareNoLrn =
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && gradeLevel === "7");

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [lastLookedUpLrn, setLastLookedUpLrn] = useState<string | null>(null);
  const [hasFilledEarlyRegistrationForm, setHasFilledEarlyRegistrationForm] =
    useState(false);
  const [dateInput, setDateInput] = useState(() => {
    if (!birthdate) return "";
    const parsedBirthdate =
      birthdate instanceof Date ? birthdate : new Date(birthdate);
    return isValid(parsedBirthdate)
      ? format(parsedBirthdate, "MM/dd/yyyy")
      : "";
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (!birthdate) return new Date();
    const parsedBirthdate =
      birthdate instanceof Date ? birthdate : new Date(birthdate);
    return isValid(parsedBirthdate) ? parsedBirthdate : new Date();
  });

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
    clearErrors("lrn");
    setLookupSuccess(false);
    setLastLookedUpLrn(null);
  }, [hasNoLrn, lrn, setValue, clearErrors]);

  useEffect(() => {
    if (!birthdate) {
      setDateInput("");
      return;
    }
    const parsedBirthdate =
      birthdate instanceof Date ? birthdate : new Date(birthdate);
    if (!isValid(parsedBirthdate)) {
      setDateInput("");
      return;
    }

    setDateInput(format(parsedBirthdate, "MM/dd/yyyy"));
    setCalendarMonth(parsedBirthdate);
    const age = differenceInYears(new Date(), parsedBirthdate);
    setValue("age", age >= 0 ? age : 0);
  }, [birthdate, setValue]);

  // Auto-lookup only when LRN is exactly 12 digits (debounced by 1 second).
  useEffect(() => {
    if (!hasFilledEarlyRegistrationForm) {
      setIsLookingUp(false);
      setLookupSuccess(false);
      setLastLookedUpLrn(null);
      return;
    }

    const normalizedLrn = String(lrn ?? "").trim();

    if (hasNoLrn) {
      setLookupSuccess(false);
      setLastLookedUpLrn(null);
      setIsLookingUp(false);
      clearErrors("lrn");
      return;
    }

    if (!normalizedLrn) {
      setLookupSuccess(false);
      setLastLookedUpLrn(null);
      clearErrors("lrn");
      return;
    }

    if (normalizedLrn.length !== 12) {
      setLookupSuccess(false);
      setLastLookedUpLrn(null);
      setIsLookingUp(false);
      setError("lrn", {
        type: "manual",
        message: "Please enter a 12-digit LRN.",
      });
      return;
    }

    clearErrors("lrn");

    if (normalizedLrn === lastLookedUpLrn || isLookingUp) {
      return;
    }

    setLookupSuccess(false);

    const timer = window.setTimeout(async () => {
      setLastLookedUpLrn(normalizedLrn);
      setIsLookingUp(true);
      try {
        const response = await api.get(
          `/applications/lookup-lrn/${normalizedLrn}`,
        );
        const data = response.data;

        // Avoid applying stale response when user has already changed the input.
        if (String(watch("lrn") ?? "").trim() !== normalizedLrn) {
          return;
        }

        if (data) {
          sileo.info({
            title: "Early Registration Found",
            description: `Fetched data for ${data.firstName} ${data.lastName}.`,
          });

          setValue("earlyRegistrationId", data.earlyRegistrationId);
          setValue("firstName", data.firstName);
          setValue("lastName", data.lastName);
          setValue("middleName", data.middleName || "");
          setValue("extensionName", data.extensionName || "N/A");
          if (data.birthdate) {
            const bday = new Date(data.birthdate);
            setValue("birthdate", bday);
            setValue("age", differenceInYears(new Date(), bday));
          }
          setValue("sex", data.sex === "MALE" ? "Male" : "Female");
          setValue("placeOfBirth", data.placeOfBirth || "");
          setValue("religion", data.religion || "");
          setValue("motherTongue", data.motherTongue || "");
          setValue("isIpCommunity", data.isIpCommunity);
          setValue("ipGroupName", data.ipGroupName || "");
          setValue("isLearnerWithDisability", data.isLearnerWithDisability);
          setValue("disabilityTypes", data.disabilityTypes || []);
          setValue("psaBirthCertNumber", data.psaBirthCertNumber || "");
          setValue("hasPwdId", data.hasPwdId ?? false);
          setValue("is4PsBeneficiary", data.is4PsBeneficiary ?? false);
          setValue("householdId4Ps", data.householdId4Ps || "");
          setValue("isBalikAral", data.isBalikAral ?? false);
          setValue("lastYearEnrolled", data.lastYearEnrolled || "");
          setValue("lastGradeLevel", data.lastGradeLevel || "");
          if (data.studentPhoto) {
            setValue("studentPhoto", data.studentPhoto);
          }

          if (data.currentAddress) {
            setValue(
              "currentAddress.houseNo",
              data.currentAddress.houseNo || "",
            );
            setValue(
              "currentAddress.barangay",
              data.currentAddress.barangay || "",
            );
            setValue(
              "currentAddress.cityMunicipality",
              data.currentAddress.cityMunicipality || "",
            );
            setValue(
              "currentAddress.province",
              data.currentAddress.province || "",
            );
          }

          if (data.father) {
            setValue("father.firstName", data.father.firstName);
            setValue("father.lastName", data.father.lastName);
            setValue("father.middleName", data.father.middleName || "");
            setValue("father.contactNumber", data.father.contactNumber || "");
          }

          if (data.mother) {
            setValue("mother.firstName", data.mother.firstName);
            setValue("mother.lastName", data.mother.lastName);
            setValue("mother.middleName", data.mother.middleName || "");
            setValue("mother.contactNumber", data.mother.contactNumber || "");
          }

          if (data.guardian) {
            setValue("guardian.firstName", data.guardian.firstName);
            setValue("guardian.lastName", data.guardian.lastName);
            setValue("guardian.middleName", data.guardian.middleName || "");
            setValue(
              "guardian.contactNumber",
              data.guardian.contactNumber || "",
            );
          }

          setValue("email", data.email || "");
          setValue("learnerType", data.learnerType);

          if (data.applicantType && data.applicantType !== "REGULAR") {
            setValue("isScpApplication", true);
            setValue("scpType", data.applicantType);
          } else {
            setValue("isScpApplication", false);
          }

          setLookupSuccess(true);
        }
      } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.status === 404) {
          sileo.error({
            title: "Early Registration Not Found",
            description:
              "No eligible early registration found for this LRN in the current School Year.",
          });
        } else {
          sileo.error({
            title: "Lookup Failed",
            description: "Could not fetch early registration data.",
          });
        }
      } finally {
        setIsLookingUp(false);
      }
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    hasNoLrn,
    lrn,
    hasFilledEarlyRegistrationForm,
    lastLookedUpLrn,
    isLookingUp,
    setValue,
    setError,
    clearErrors,
    watch,
  ]);

  const handleDateTyping = (
    value: string,
    onChange: (value: Date | undefined) => void,
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
      {/* ─── Early Registration Dynamic Toggle ─── */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-white p-4">
        <Checkbox
          id="hasFilledEarlyRegistrationForm"
          checked={hasFilledEarlyRegistrationForm}
          onCheckedChange={(checked) => {
            const nextChecked = checked === true;
            setHasFilledEarlyRegistrationForm(nextChecked);

            if (!nextChecked) {
              setLookupSuccess(false);
              setIsLookingUp(false);
              setLastLookedUpLrn(null);
              setValue("earlyRegistrationId", null, {
                shouldDirty: true,
                shouldValidate: false,
              });
              clearErrors("lrn");
            }
          }}
        />
        <Label
          htmlFor="hasFilledEarlyRegistrationForm"
          className="text-xs font-semibold leading-relaxed cursor-pointer">
          I already filled out the Basic Education Early Registration Form.
        </Label>
      </div>

      {/* ─── LRN Section (Dynamic) ─── */}
      <div
        className={cn(
          "p-6 border rounded-2xl space-y-4",
          hasFilledEarlyRegistrationForm
            ? "bg-primary/5 border-primary/20"
            : "bg-muted/20 border-border",
        )}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              hasFilledEarlyRegistrationForm
                ? "bg-primary/10 text-primary"
                : "bg-muted text-foreground",
            )}>
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3
              className={cn(
                "text-sm font-bold uppercase tracking-wider",
                hasFilledEarlyRegistrationForm
                  ? "text-primary"
                  : "text-foreground",
              )}>
              {hasFilledEarlyRegistrationForm
                ? "Quick Fill via LRN"
                : "Learner Reference Number (LRN)"}
            </h3>
            <p className="text-xs text-muted-foreground font-bold">
              {hasFilledEarlyRegistrationForm
                ? "Type your 12-digit LRN to automatically fetch your Early Registration information."
                : "Enter your 12-digit LRN to continue enrollment."}
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
              "h-14 text-lg tracking-[0.25em] font-black text-center border-2",
              hasNoLrn && "bg-muted cursor-not-allowed tracking-normal text-sm",
              errors.lrn
                ? "border-destructive"
                : "border-primary/30 focus:border-primary",
              hasFilledEarlyRegistrationForm &&
                lookupSuccess &&
                "border-green-500 bg-green-50/30",
            )}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(
                /[^0-9]/g,
                "",
              );
            }}
          />
          {hasFilledEarlyRegistrationForm && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {isLookingUp && (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              )}
              {lookupSuccess && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
          )}
        </div>

        <p className="text-xs font-semibold text-muted-foreground">
          {hasNoLrn
            ? "No LRN declared. Registrar will process this learner under pending LRN creation."
            : canDeclareNoLrn
              ? "Provide LRN, or declare no LRN below if the learner is incoming Grade 7 or transferee."
              : "LRN is required for this learner category."}
        </p>

        {canDeclareNoLrn && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-white p-3">
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
                  setLookupSuccess(false);
                }
              }}
            />
            <Label
              htmlFor="hasNoLrn"
              className="text-xs font-semibold leading-relaxed cursor-pointer">
              I confirm the learner currently has no LRN.
            </Label>
          </div>
        )}

        {errors.lrn && (
          <p className="text-xs text-destructive font-bold flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.lrn.message}
          </p>
        )}
      </div>

      {/* ─── Name & Photo Section ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* PHOTO UPLOADER COLUMN */}
        <div className="md:col-span-1 flex flex-col items-center justify-center space-y-3">
          <Label className="text-sm font-semibold self-start md:self-center">
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
                <div className="flex flex-col items-center text-muted-foreground group-hover:text-primary transition-colors">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-[0.625rem] uppercase font-bold tracking-tight">
                    Upload 2x2
                  </span>
                </div>
              }
            >
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
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-sm font-semibold">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              {...register("lastName")}
              autoComplete="off"
              placeholder="e.g. DELA CRUZ"
              className={cn(
                "h-11 uppercase font-bold",
                errors.lastName &&
                  "border-destructive focus-visible:ring-destructive",
              )}
            />
            {errors.lastName && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.lastName.message}
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
              autoComplete="off"
              placeholder="e.g. JUAN"
              className={cn(
                "h-11 uppercase font-bold",
                errors.firstName &&
                  "border-destructive focus-visible:ring-destructive",
              )}
            />
            {errors.firstName && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.firstName.message}
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
              autoComplete="off"
              placeholder="Write N/A if none"
              className="h-11 uppercase font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="extensionName" className="text-sm font-semibold">
              Suffix (Extension)
            </Label>
            <Select
              onValueChange={(val) => setValue("extensionName", val)}
              value={watch("extensionName") || "N/A"}>
              <SelectTrigger className="h-11 font-bold">
                <SelectValue placeholder="Select Suffix" />
              </SelectTrigger>
              <SelectContent>
                {["N/A", "Jr.", "Sr.", "II", "III", "IV", "V"].map((opt) => (
                  <SelectItem key={opt} value={opt}>
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
                          field.onChange(date);
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
          <Label htmlFor="age" className="text-sm font-semibold">
            Age
          </Label>
          <Input
            id="age"
            {...register("age", { valueAsNumber: true })}
            autoComplete="off"
            readOnly
            className="h-11 font-bold cursor-not-allowed "
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">
            Sex <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={watch("sex")}
            onValueChange={(val) => setValue("sex", val as "Male" | "Female")}
            className="flex gap-6 pt-1">
            <div className="flex items-center space-x-2.5">
              <RadioGroupItem
                value="Male"
                id="sex-male"
                className="w-5 h-5 border-[#061E29] text-[#061E29]"
              />
              <Label
                htmlFor="sex-male"
                className="font-medium cursor-pointer text-sm">
                Male
              </Label>
            </div>
            <div className="flex items-center space-x-2.5">
              <RadioGroupItem
                value="Female"
                id="sex-female"
                className="w-5 h-5 border-[#061E29] text-[#061E29]"
              />
              <Label
                htmlFor="sex-female"
                className="font-medium cursor-pointer text-sm">
                Female
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="placeOfBirth" className="text-sm font-semibold">
            Place of Birth <span className="text-destructive">*</span>
          </Label>
          <Input
            id="placeOfBirth"
            {...register("placeOfBirth")}
            autoComplete="off"
            placeholder="City/Municipality, Province"
            className={cn(
              "h-11 font-bold uppercase",
              errors.placeOfBirth && "border-destructive",
            )}
          />
          {errors.placeOfBirth && (
            <p className="text-xs text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.placeOfBirth.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="motherTongue" className="text-sm font-semibold">
            Mother Tongue
          </Label>
          <Input
            id="motherTongue"
            {...register("motherTongue")}
            autoComplete="off"
            placeholder="e.g. Tagalog, Bisaya, Ilocano"
            className="h-11 font-bold uppercase"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-border/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="religion" className="text-sm font-semibold">
              Religion
            </Label>
            <Input
              id="religion"
              {...register("religion")}
              autoComplete="off"
              placeholder="e.g. Roman Catholic"
              className="h-11 font-bold uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="psaBirthCertNumber"
              className="text-sm font-semibold">
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
              className="h-11 font-bold uppercase"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
