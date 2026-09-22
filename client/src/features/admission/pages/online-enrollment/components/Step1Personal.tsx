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
  AlertTriangle,
  Loader2,
  CheckCircle,
  Camera,
  X,
  Search,
  Mars,
  Venus,
  Calendar as CalendarIcon,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
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
import { SearchableCombobox } from "@/shared/ui/searchable-combobox";

const MOTHER_TONGUE_OPTIONS = [
  { value: "Tagalog", label: "Tagalog" },
  { value: "Cebuano", label: "Cebuano" },
  { value: "Hiligaynon (Ilonggo)", label: "Hiligaynon (Ilonggo)" },
  { value: "Ilocano (Iloko)", label: "Ilocano (Iloko)" },
  { value: "Bicolano (Central Bikol)", label: "Bicolano (Central Bikol)" },
  { value: "Kapampangan", label: "Kapampangan" },
  { value: "Pangasinan (Pangasinense)", label: "Pangasinan (Pangasinense)" },
  { value: "Waray", label: "Waray" },
  { value: "Tausug", label: "Tausug" },
  { value: "Maguindanaoan", label: "Maguindanaoan" },
  { value: "Maranao", label: "Maranao" },
  { value: "Chavacano (Chabacano)", label: "Chavacano (Chabacano)" },
  { value: "Ybanag (Ibanag)", label: "Ybanag (Ibanag)" },
  { value: "Ivatan", label: "Ivatan" },
  { value: "Sambal", label: "Sambal" },
  { value: "Aklanon", label: "Aklanon" },
  { value: "Kinaray-a", label: "Kinaray-a" },
  { value: "Yakan", label: "Yakan" },
  { value: "Surigaonon", label: "Surigaonon" },
  { value: "Others", label: "Others" },
];

export default function Step1Personal() {
  const {
    register,
    watch,
    control,
    setValue,
    clearErrors,
    getValues,
    resetField,
    formState: { errors },
  } = useFormContext<EnrollmentFormData>();

  const handleClearLrn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Clear LRN and related states
    setValue("lrn", "", { shouldValidate: true, shouldDirty: true });
    setLearnerFound(false);
    setDuplicateDetected(false);

    // 2. Wipe demographics by resetting to defaults
    const fieldsToReset: (keyof EnrollmentFormData)[] = [
      "studentPhoto",
      "firstName",
      "lastName",
      "middleName",
      "extensionName",
      "birthdate",
      "sex",
      "placeOfBirth",
      "religion",
      "motherTongue",
      "isIpCommunity",
      "ipGroupName",
      "isLearnerWithDisability",
      "disabilityTypes",
      "is4PsBeneficiary",
      "householdId4Ps",
      "hasPwdId",
      "isBalikAral",
      "lastYearEnrolled",
      "psaBirthCertNumber",
      "specialNeedsCategory",
      "scpProgram",
      "scpAdmissionStatus",
      "currentAddress",
      "permanentAddress",
      "mother",
      "father",
      "guardian",
      "lastSchoolName",
      "lastSchoolId",
      "lastSchoolAddress",
      "lastSchoolType",
      "transferCertificateNo",
      "generalAverage",
    ];

    fieldsToReset.forEach((field) => {
      resetField(field);
    });
  };

  const [isOtherMotherTongue, setIsOtherMotherTongue] = useState(() => {
    const val = getValues("motherTongue");
    return !!val && !MOTHER_TONGUE_OPTIONS.some((o) => o.value === val && o.value !== "Others");
  });

  const [isValidatingLrn, setIsValidatingLrn] = useState(false);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [learnerFound, setLearnerFound] = useState(false);

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

  useEffect(() => {
    let active = true;

    if (!lrn || lrn.length !== 12 || hasNoLrn) {
      setIsValidatingLrn(false);
      setDuplicateDetected(false);
      setLearnerFound(false);
      return;
    }

    setIsValidatingLrn(true);
    setDuplicateDetected(false);
    setLearnerFound(false);

    api.get(`/applications/learner-profile/${lrn}`)
      .then((res) => {
        if (active) {
          const profile = res.data;
          setLearnerFound(true);

          // 1. Personal Info
          if (profile.studentPhoto) setValue("studentPhoto", profile.studentPhoto, { shouldValidate: true, shouldDirty: true });
          if (profile.firstName) setValue("firstName", profile.firstName, { shouldValidate: true, shouldDirty: true });
          if (profile.lastName) setValue("lastName", profile.lastName, { shouldValidate: true, shouldDirty: true });
          if (profile.middleName) setValue("middleName", profile.middleName, { shouldValidate: true, shouldDirty: true });
          if (profile.extensionName) setValue("extensionName", profile.extensionName, { shouldValidate: true, shouldDirty: true });
          
          if (profile.birthdate) {
            const d = new Date(profile.birthdate);
            if (!isNaN(d.getTime())) {
              setValue("birthdate", d, { shouldValidate: true, shouldDirty: true });
            }
          }
          
          if (profile.sex) {
            setValue("sex", profile.sex === "MALE" ? "Male" : "Female", { shouldValidate: true, shouldDirty: true });
          }

          if (profile.placeOfBirth) setValue("placeOfBirth", profile.placeOfBirth, { shouldValidate: true, shouldDirty: true });
          if (profile.religion) setValue("religion", profile.religion, { shouldValidate: true, shouldDirty: true });
          if (profile.motherTongue) setValue("motherTongue", profile.motherTongue, { shouldValidate: true, shouldDirty: true });
          if (profile.isIpCommunity !== undefined) setValue("isIpCommunity", profile.isIpCommunity, { shouldValidate: true, shouldDirty: true });
          if (profile.ipGroupName) setValue("ipGroupName", profile.ipGroupName, { shouldValidate: true, shouldDirty: true });
          if (profile.isLearnerWithDisability !== undefined) setValue("isLearnerWithDisability", profile.isLearnerWithDisability, { shouldValidate: true, shouldDirty: true });
          if (profile.disabilityTypes?.length) setValue("disabilityTypes", profile.disabilityTypes, { shouldValidate: true, shouldDirty: true });
          if (profile.is4PsBeneficiary !== undefined) setValue("is4PsBeneficiary", profile.is4PsBeneficiary, { shouldValidate: true, shouldDirty: true });
          if (profile.householdId4Ps) setValue("householdId4Ps", profile.householdId4Ps, { shouldValidate: true, shouldDirty: true });
          if (profile.hasPwdId !== undefined) setValue("hasPwdId", profile.hasPwdId, { shouldValidate: true, shouldDirty: true });
          if (profile.isBalikAral !== undefined) setValue("isBalikAral", profile.isBalikAral, { shouldValidate: true, shouldDirty: true });
          if (profile.lastYearEnrolled) setValue("lastYearEnrolled", profile.lastYearEnrolled, { shouldValidate: true, shouldDirty: true });
          if (profile.psaBirthCertNumber) setValue("psaBirthCertNumber", profile.psaBirthCertNumber, { shouldValidate: true, shouldDirty: true });
          if (profile.specialNeedsCategory) setValue("specialNeedsCategory", profile.specialNeedsCategory, { shouldValidate: true, shouldDirty: true });

          const mapAddress = (addr: any) => ({
            houseNo: addr.houseNoStreet || "",
            street: addr.street || "",
            region: addr.region || "",
            province: addr.province || "",
            cityMunicipality: addr.cityMunicipality || "",
            barangay: addr.barangay || "",
            country: addr.country || "Philippines",
            zipCode: addr.zipCode || "",
          });

          // 2. Addresses
          if (profile.addresses?.length > 0) {
            const current = profile.addresses.find((a: any) => a.addressType === "CURRENT");
            if (current) setValue("currentAddress", mapAddress(current), { shouldValidate: true, shouldDirty: true });
            
            const permanent = profile.addresses.find((a: any) => a.addressType === "PERMANENT");
            if (permanent) setValue("permanentAddress", mapAddress(permanent), { shouldValidate: true, shouldDirty: true });
          }

          const mapFamily = (f: any) => ({
            lastName: f.lastName || "",
            firstName: f.firstName || "",
            middleName: f.middleName || "",
            contactNumber: f.contactNumber || "",
            email: f.email || "",
            occupation: f.occupation || "",
          });

          // 3. Family Members
          if (profile.familyMembers?.length > 0) {
            const mother = profile.familyMembers.find((f: any) => f.relationship === "MOTHER");
            if (mother) setValue("mother", mapFamily(mother), { shouldValidate: true, shouldDirty: true });
            
            const father = profile.familyMembers.find((f: any) => f.relationship === "FATHER");
            if (father) setValue("father", mapFamily(father), { shouldValidate: true, shouldDirty: true });
            
            const guardian = profile.familyMembers.find((f: any) => f.relationship === "GUARDIAN");
            if (guardian) setValue("guardian", mapFamily(guardian), { shouldValidate: true, shouldDirty: true });
          }

          // 4. Previous School
          if (profile.previousSchool) {
            const mapSchoolType = (type: string | undefined | null) => {
              if (!type) return undefined;
              if (type === "PUBLIC") return "Public";
              if (type === "PRIVATE") return "Private";
              if (type === "INTERNATIONAL") return "International";
              if (type === "ALS") return "ALS";
              return type as any;
            };

            if (profile.previousSchool.schoolName) setValue("lastSchoolName", profile.previousSchool.schoolName, { shouldValidate: true, shouldDirty: true });
            if (profile.previousSchool.schoolId) setValue("lastSchoolId", profile.previousSchool.schoolId, { shouldValidate: true, shouldDirty: true });
            if (profile.previousSchool.schoolAddress) setValue("lastSchoolAddress", profile.previousSchool.schoolAddress, { shouldValidate: true, shouldDirty: true });
            if (profile.previousSchool.schoolType) setValue("lastSchoolType", mapSchoolType(profile.previousSchool.schoolType), { shouldValidate: true, shouldDirty: true });
            if (profile.previousSchool.transferCertificateNo) setValue("transferCertificateNo", profile.previousSchool.transferCertificateNo, { shouldValidate: true, shouldDirty: true });
            if (profile.previousSchool.generalAverage) setValue("generalAverage", profile.previousSchool.generalAverage, { shouldValidate: true, shouldDirty: true });
          }

          // 5. SCP Validation
          setValue("scpProgram", profile.scpProgram, { shouldValidate: true });
          setValue("scpAdmissionStatus", profile.scpAdmissionStatus, { shouldValidate: true });
        }
      })
      .catch((err) => {
        if (active && err.response?.status === 404) {
          // No record found, not an error
          setLearnerFound(false);
        } else {
          console.error("LRN validation error:", err);
        }
      })
      .finally(() => {
        if (active) setIsValidatingLrn(false);
      });

    return () => {
      active = false;
    };
  }, [lrn, hasNoLrn, setValue]);

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
  }, [hasNoLrn, lrn, setValue, clearErrors]);

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
      setValue("studentPhoto", reader.result as string, { shouldValidate: true, shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setValue("studentPhoto", "", { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div className="space-y-8">
      {/* ─── LRN Section ─── */}
      <div className="p-6 border rounded-2xl space-y-4 bg-muted/20 border-border">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base leading-tight font-bold uppercase text-foreground">
              Learner Reference Number (LRN)
            </h3>
            <p className="text-base text-foreground">
              Enter learner's 12-digit LRN to continue enrollment.
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            {isValidatingLrn ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : lrn?.length === 12 && !hasNoLrn ? (
              learnerFound ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : duplicateDetected ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )
            ) : (
              <Search className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <Input
            id="lrn"
            {...register("lrn")}
            autoComplete="off"
            placeholder="ENTER 12-DIGIT LRN"
            maxLength={12}
            disabled={hasNoLrn}
            className={cn(
              "h-14 text-lg pl-12 font-bold text-center border-2 tracking-widest",
              hasNoLrn && "bg-muted cursor-not-allowed text-base leading-tight",
              errors.lrn || duplicateDetected
                ? "border-destructive"
                : learnerFound 
                  ? "border-green-500 focus:border-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.1)] transition-all duration-300"
                  : "border-primary/30 focus:border-primary",
            )}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(
                /[^0-9]/g,
                "",
              );
            }}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {lrn && lrn.length > 0 && !hasNoLrn && (
              <button
                type="button"
                onClick={handleClearLrn}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Clear LRN"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {errors.lrn && (
          <p className="text-sm font-medium text-destructive">
            {errors.lrn.message}
          </p>
        )}
        {lrn?.length === 12 && duplicateDetected && !hasNoLrn && (
          <div className="flex items-center text-sm font-medium text-destructive">
            <AlertTriangle className="w-4 h-4 mr-1.5 flex-shrink-0" />
            This LRN already exists in our database. Enrollment application is a duplicate.
          </div>
        )}
        {lrn?.length === 12 && learnerFound && !hasNoLrn && (
          <div className="flex items-center text-sm font-bold text-green-600">
            <CheckCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
            Learner record found. Auto-filling form...
          </div>
        )}
        <p className="text-sm font-medium text-muted-foreground">
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
              className="text-base font-bold cursor-pointer">
              Learner has no LRN yet.
            </Label>
          </div>
        )}
      </div>

      {/* ─── Name & Photo Section ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* PHOTO UPLOADER COLUMN */}
        <div className="md:col-span-1 flex flex-col items-center justify-center space-y-3">
          <Label className="text-base leading-tight font-bold self-start md:self-center">
            Learner's Photo <span className="text-destructive">*</span>
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
                  <span className="text-[0.625rem] uppercase font-bold ">
                    Upload Photo
                  </span>
                </div>
              }>
              {studentPhoto && (
                <button
                  onClick={clearPhoto}
                  type="button"
                  className="absolute top-1 right-1 p-1 bg-primary text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20">
                  <X strokeWidth={3} className="w-3 h-3" />
                </button>
              )}
            </UserPhoto>
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handlePhotoChange}
              title="Upload learner's photo"
            />
          </div>
          <AnimatedError error={errors.studentPhoto?.message as string} />
        </div>

        {/* NAME FIELDS COLUMN */}
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="lastName"
              className="text-base leading-tight font-bold">
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
            <AnimatedError error={errors.lastName?.message as string || errors.lastName as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="firstName"
              className="text-base leading-tight font-bold">
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
            <AnimatedError error={errors.firstName?.message as string || errors.firstName as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="middleName"
              className="text-base leading-tight font-bold">
              Middle Name
            </Label>
            <Input
              id="middleName"
              {...register("middleName")}
              autoComplete="off"
              disabled={hasNoMiddleName}
              placeholder="e.g. BAUTISTA"
              className={cn("h-11 uppercase font-bold", hasNoMiddleName && "bg-muted cursor-not-allowed opacity-50")}
            />
            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                id="noMiddleName"
                checked={hasNoMiddleName}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  setHasNoMiddleName(isChecked);
                  if (isChecked) {
                    setValue("middleName", "", { shouldValidate: true, shouldDirty: true });
                  }
                }}
              />
              <Label htmlFor="noMiddleName" className="text-base cursor-pointer font-bold">
                No Middle Name.
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="extensionName"
              className="text-base leading-tight font-bold">
              Suffix (Extension)
            </Label>
            <Select
              onValueChange={(val) => setValue("extensionName", val === "NONE" ? "" : val, { shouldValidate: true, shouldDirty: true })}
              value={watch("extensionName") || "NONE"}>
              <SelectTrigger className="h-11 font-bold">
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
          <Label className="text-base leading-tight font-bold">
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="birthdate"
            render={({ field }) => (
              <div className="relative">
                <Input
                  id="birthdate"
                  autoComplete="off"
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
            className="text-base leading-tight font-bold">
            Age <span className="text-destructive">*</span>
          </Label>
          <Input
            id="age"
            {...register("age", { setValueAs: (v: string | number) => (v === "" || Number.isNaN(Number(v))) ? undefined : Number(v) })}
            autoComplete="off"
            disabled
            className="h-11 font-bold cursor-not-allowed disabled:opacity-100 disabled:bg-muted"
            placeholder="Auto-calculated"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-base leading-tight font-bold">
            Sex <span className="text-destructive">*</span>
          </Label>
          <div id="sex" className="flex gap-4 pt-1">
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
                    ? "border-primary bg-primary/5 font-bold"
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
                <span className={cn("font-bold",
                  watch("sex") === sexOption.value
                    ? "text-primary"
                    : "text-foreground",)}
                >{sexOption.label}</span>
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
            className="text-base leading-tight font-bold">
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
          <AnimatedError error={errors.placeOfBirth?.message as string || errors.placeOfBirth as unknown as string} />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="motherTongue"
            className="text-base leading-tight font-bold">
            Mother Tongue <span className="text-destructive">*</span>
          </Label>
          <div className={cn("grid gap-2", isOtherMotherTongue ? "grid-cols-2" : "grid-cols-1")}>
            <Controller
              control={control}
              name="motherTongue"
              render={({ field }) => (
                <SearchableCombobox
                  items={MOTHER_TONGUE_OPTIONS}
                  value={
                    isOtherMotherTongue
                      ? "Others"
                      : MOTHER_TONGUE_OPTIONS.some((o) => o.value === field.value)
                        ? (field.value ?? "")
                        : ""
                  }
                  onChange={(val) => {
                    if (val === "Others") {
                      setIsOtherMotherTongue(true);
                      field.onChange("");
                    } else {
                      setIsOtherMotherTongue(false);
                      field.onChange(val);
                    }
                  }}
                  placeholder="Select Mother Tongue"
                  className="uppercase h-11"
                />
              )}
            />
            {isOtherMotherTongue && (
              <Input
                id="motherTongue"
                {...register("motherTongue")}
                autoComplete="off"
                placeholder="Please specify mother tongue"
                className="h-11 font-bold uppercase"
                autoFocus
              />
            )}
          </div>
          <AnimatedError error={errors.motherTongue?.message as string} />
        </div>
      </div>

      <div className="pt-6 border-t border-border/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="religion"
              className="text-base leading-tight font-bold">
              Religion <span className="text-destructive">*</span>
            </Label>
            <Input
              id="religion"
              {...register("religion")}
              autoComplete="off"
              placeholder="e.g. Roman Catholic, Iglesia ni Cristo, Islam"
              className={cn(
                "h-11 font-bold uppercase",
                errors.religion && "border-destructive focus-visible:ring-destructive",
              )}
            />
            <AnimatedError error={errors.religion?.message as string || errors.religion as unknown as string} />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="psaBirthCertNumber"
              className="text-base leading-tight font-bold">
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

      {/* ─── Vital Statistics ─── */}
      <div className="pt-6 border-t border-border/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <div className="space-y-1.5">
            <Label
              htmlFor="intakeHeightCm"
              className="text-base leading-tight font-bold">
              Height (in cm) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="intakeHeightCm"
              type="text"
              inputMode="decimal"
              onInput={(e) => {
                let val = e.currentTarget.value.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                if (parts.length > 2) {
                  val = parts[0] + '.' + parts.slice(1).join('');
                }
                e.currentTarget.value = val;
              }}
              {...register("intakeHeightCm", { setValueAs: (v: string | number) => (v === "" || Number.isNaN(Number(v))) ? undefined : Number(v) })}
              autoComplete="off"
              placeholder="e.g. 150"
              className={cn(
                "h-11 font-bold",
                errors.intakeHeightCm && "border-destructive",
              )}
            />
            <AnimatedError error={errors.intakeHeightCm?.message as string || errors.intakeHeightCm as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="intakeWeightKg"
              className="text-base leading-tight font-bold">
              Weight (in kg) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="intakeWeightKg"
              type="text"
              inputMode="decimal"
              onInput={(e) => {
                let val = e.currentTarget.value.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                if (parts.length > 2) {
                  val = parts[0] + '.' + parts.slice(1).join('');
                }
                e.currentTarget.value = val;
              }}
              {...register("intakeWeightKg", { setValueAs: (v: string | number) => (v === "" || Number.isNaN(Number(v))) ? undefined : Number(v) })}
              autoComplete="off"
              placeholder="e.g. 45"
              className={cn(
                "h-11 font-bold",
                errors.intakeWeightKg && "border-destructive",
              )}
            />
            <AnimatedError error={errors.intakeWeightKg?.message as string || errors.intakeWeightKg as unknown as string} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-base leading-tight font-bold">
              Body Mass Index (BMI)
            </Label>
            <Input
              value={calculatedBmi}
              autoComplete="off"
              readOnly
              disabled
              placeholder="Auto-calculated"
              className="h-11 font-bold cursor-not-allowed disabled:opacity-100 disabled:bg-muted"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
