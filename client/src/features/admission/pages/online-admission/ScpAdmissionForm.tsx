import { useEffect, useState, useCallback, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@/shared/lib/zodResolver";
import { scpAdmissionSubmitSchema } from "@enrollpro/shared/schemas";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { AlertCircle, ArrowLeft, Calendar as CalendarIcon, Camera, CheckCircle, Info, Loader2, Mars, Search, Venus, X } from "lucide-react";
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { AnimatedError } from "@/shared/components/AnimatedError";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { SearchableCombobox } from "@/shared/ui/searchable-combobox";
import api from "@/shared/api/axiosInstance";
import { cn } from "@/shared/lib/utils";
import type { z } from "zod";
import { useUnsavedChanges, useUnsavedChangesPrompt } from "@/shared/hooks/useUnsavedChanges";
import { differenceInYears, format, isAfter, isBefore, isValid as isValidDate, parse } from "date-fns";

type ScpFormData = z.infer<typeof scpAdmissionSubmitSchema>;

const MOTHER_TONGUE_OPTIONS = [
  "Tagalog", "Cebuano", "Hiligaynon (Ilonggo)", "Ilocano (Iloko)",
  "Bicolano (Central Bikol)", "Kapampangan", "Pangasinan (Pangasinense)",
  "Waray", "Tausug", "Maguindanaoan", "Maranao", "Chavacano (Chabacano)",
  "Ybanag (Ibanag)", "Ivatan", "Sambal", "Aklanon", "Kinaray-a", "Yakan",
  "Surigaonon", "Others",
].map((value) => ({ value, label: value }));

type ValidationIssue = {
  fieldPath: string;
  fieldLabel: string;
  message: string;
};

const FIELD_LABELS: Record<string, string> = {
  scpType: "SCP Track",
  lrn: "Learner Reference Number (LRN)",
  lastName: "Last Name",
  firstName: "First Name",
  birthdate: "Date of Birth",
  sex: "Sex",
  placeOfBirth: "Place of Birth",
  motherTongue: "Mother Tongue",
  currentAddress: "Complete Home/Permanent Address",
  lastSchoolName: "Name of Last School Attended",
  lastSchoolId: "DepEd School ID",
  lastSchoolType: "Type of Last School",
  grade5GeneralAverage: "Grade 5 Final General Average",
  artsSpecialization: "Arts Specialization",
  chosenSport: "Chosen Sport",
  isPrivacyConsentGiven: "Certification",
};

function getFieldLabel(fieldPath: string) {
  return FIELD_LABELS[fieldPath] ?? fieldPath
    .split(".")
    .map((segment) => segment.replace(/([A-Z])/g, " $1").trim())
    .join(" - ");
}

function extractErrorMessages(
  errorValue: unknown,
  currentPath = "",
): Array<{ fieldPath: string; message: string }> {
  if (!errorValue || typeof errorValue !== "object") return [];

  const errorObject = errorValue as Record<string, unknown>;
  const messages: Array<{ fieldPath: string; message: string }> = [];
  if (typeof errorObject.message === "string" && errorObject.message.trim()) {
    messages.push({ fieldPath: currentPath, message: errorObject.message.trim() });
  }

  for (const [key, value] of Object.entries(errorObject)) {
    if (["message", "type", "ref", "types"].includes(key)) continue;
    messages.push(...extractErrorMessages(value, currentPath ? `${currentPath}.${key}` : key));
  }
  return messages;
}

interface Props {
  intakeChoice: "NEW" | "RETURNING";
  onSuccess: (data: ApplicationSubmitResponse) => void;
  onCancel: () => void;
}

const getEmptyValues = (intakeChoice: "NEW" | "RETURNING"): Partial<ScpFormData> => ({
  isScpApplication: true,
  scpType: undefined,
  isPrivacyConsentGiven: false,
  learnerType: intakeChoice === "RETURNING" ? "RETURNING" : "NEW_ENROLLEE",
  gradeLevel: "7",
  studentPhoto: "",
  hasNoLrn: false,
  lrn: "",
  lastName: "",
  firstName: "",
  middleName: "",
  extensionName: "",
  birthdate: "",
  sex: undefined as unknown as "MALE",
  placeOfBirth: "",
  religion: "",
  motherTongue: "",
  isIpCommunity: false,
  ipGroupName: "",
  is4PsBeneficiary: false,
  householdId4Ps: "",
  isLearnerWithDisability: false,
  specialNeedsCategory: undefined,
  hasPwdId: false,
  disabilityTypes: [],
  currentAddress: { houseNoStreet: "", sitio: "", barangay: "", cityMunicipality: "", province: "", region: "" },
  permanentAddress: { houseNoStreet: "", sitio: "", barangay: "", cityMunicipality: "", province: "", region: "" },
  mother: { lastName: "", firstName: "", middleName: "", contactNumber: "", email: "", occupation: "" },
  father: { lastName: "", firstName: "", middleName: "", contactNumber: "", email: "", occupation: "" },
  lastSchoolName: "",
  lastSchoolId: "",
  lastGradeCompleted: "6",
  schoolYearLastAttended: "2025-2026",
  lastSchoolAddress: "",
  transferCertificateNo: "",
  lastSchoolType: "PUBLIC",
  grade5GeneralAverage: undefined,
  underSpecialScienceCurriculum: null,
  artsSpecialization: null,
  chosenSport: "",
});

export const SCP_FORM_STATE_KEY = "scp_admission_form_state";

export default function ScpAdmissionForm({ intakeChoice, onSuccess, onCancel }: Props) {
  const savedState = sessionStorage.getItem(SCP_FORM_STATE_KEY);
  let parsedSavedState = null;
  try {
    if (savedState) {
      parsedSavedState = JSON.parse(savedState);
    }
  } catch (e) { console.error('Failed to parse saved state', e); }

  const form = useForm<ScpFormData>({
    resolver: zodResolver(scpAdmissionSubmitSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: parsedSavedState || getEmptyValues(intakeChoice),
  });


  const hasSubmittedRef = useRef(false);

  // Watch form values and save to sessionStorage
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Only save if a specific field was changed by the user
      if (name && !hasSubmittedRef.current) {
        // Exclude studentPhoto from persistence since File objects can't be serialized cleanly
        const { studentPhoto, ...rest } = value;
        sessionStorage.setItem(SCP_FORM_STATE_KEY, JSON.stringify(rest));
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  const { control, handleSubmit, setValue, clearErrors, trigger } = form;
  const selectedScp = useWatch({ control, name: "scpType" });
  const birthdateStr = useWatch({ control, name: "birthdate" });
  const studentPhoto = useWatch({ control, name: "studentPhoto" });
  const hasNoLrn = useWatch({ control, name: "hasNoLrn" });
  const lrn = useWatch({ control, name: "lrn" });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [isValidatingLrn, setIsValidatingLrn] = useState(false);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [hasNoMiddleName, setHasNoMiddleName] = useState(false);
  const [isOtherMotherTongue, setIsOtherMotherTongue] = useState(false);

  const { confirmOrRun } = useUnsavedChangesPrompt();
  
  const discardScpDraft = useCallback(() => {
    form.reset(getEmptyValues(intakeChoice) as ScpFormData);
    sessionStorage.removeItem(SCP_FORM_STATE_KEY);
    setValue("studentPhoto", "");
  }, [form, intakeChoice, setValue]);

  useUnsavedChanges({
    id: "scp-admission-form",
    label: "SCP Admission Form",
    isDirty: isDirty || parsedSavedState !== null,
    isSubmitting,
    onDiscard: discardScpDraft,
  });

  const validationIssues: ValidationIssue[] = Array.from(
    new Map(
      Object.entries(errors)
        .flatMap(([fieldPath, errorValue]) => extractErrorMessages(errorValue, fieldPath))
        .map((issue) => [`${issue.fieldPath}|${issue.message}`, issue]),
    ).values(),
  ).map((issue) => ({ ...issue, fieldLabel: getFieldLabel(issue.fieldPath) }));

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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

  const handleDateTyping = (
    value: string,
    onChange: (date: Date | undefined) => void,
  ) => {
    const isDeleting = value.length < dateInput.length;
    const cleaned = value.replace(/\D/g, "").slice(0, 8);
    let masked = cleaned.slice(0, 2);

    if (cleaned.length > 2 || (cleaned.length === 2 && !isDeleting)) masked += "/";
    if (cleaned.length > 2) {
      masked += cleaned.slice(2, 4);
      if (cleaned.length > 4 || (cleaned.length === 4 && !isDeleting)) masked += "/";
    }
    if (cleaned.length > 4) masked += cleaned.slice(4, 8);
    setDateInput(masked);

    if (masked.length !== 10) {
      onChange(undefined);
      return;
    }

    const parsedDate = parse(masked, "MM/dd/yyyy", new Date());
    if (
      isValidDate(parsedDate)
      && !isAfter(parsedDate, new Date())
      && !isBefore(parsedDate, new Date(1900, 0, 1))
    ) {
      onChange(parsedDate);
      setCalendarMonth(parsedDate);
    } else {
      onChange(undefined);
    }
  };

  useEffect(() => {
    let active = true;

    if (!lrn || lrn.length !== 12 || hasNoLrn) {
      // Keep the duplicate-check indicators synchronized with the LRN field.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsValidatingLrn(false);
      setDuplicateDetected(false);
      return;
    }

    setIsValidatingLrn(true);
    setDuplicateDetected(false);
    api.get(`/applications/validate-lrn/${lrn}`)
      .then((response) => {
        if (active) setDuplicateDetected(response.data.isDuplicate);
      })
      .catch((error) => console.error("LRN validation error:", error))
      .finally(() => {
        if (active) setIsValidatingLrn(false);
      });

    return () => {
      active = false;
    };
  }, [lrn, hasNoLrn]);

  useEffect(() => {
    let active = true;

    if (intakeChoice !== "RETURNING" || !lrn || lrn.length !== 12 || hasNoLrn || duplicateDetected) {
      return;
    }

    api.get(`/applications/learner-profile/${lrn}`)
      .then((res) => {
        if (!active) return;
        const profile = res.data;

        if (profile.studentPhoto) setValue("studentPhoto", profile.studentPhoto, { shouldValidate: true, shouldDirty: true });
        if (profile.firstName) setValue("firstName", profile.firstName, { shouldValidate: true, shouldDirty: true });
        if (profile.lastName) setValue("lastName", profile.lastName, { shouldValidate: true, shouldDirty: true });
        if (profile.middleName) setValue("middleName", profile.middleName, { shouldValidate: true, shouldDirty: true });
        if (profile.extensionName) setValue("extensionName", profile.extensionName, { shouldValidate: true, shouldDirty: true });
        
        if (profile.birthdate) {
          const d = new Date(profile.birthdate);
          if (!isNaN(d.getTime())) {
            setValue("birthdate", d as any, { shouldValidate: true, shouldDirty: true });
            setDateInput(format(d, "MM/dd/yyyy"));
            setCalendarMonth(d);
          }
        }
        
        if (profile.sex) {
          setValue("sex", profile.sex, { shouldValidate: true, shouldDirty: true });
        }

        if (profile.placeOfBirth) setValue("placeOfBirth", profile.placeOfBirth, { shouldValidate: true, shouldDirty: true });
        if (profile.religion) setValue("religion", profile.religion, { shouldValidate: true, shouldDirty: true });
        if (profile.motherTongue) setValue("motherTongue", profile.motherTongue, { shouldValidate: true, shouldDirty: true });
        
        if (profile.isIpCommunity !== undefined) setValue("isIpCommunity", profile.isIpCommunity, { shouldValidate: true, shouldDirty: true });
        if (profile.ipGroupName) setValue("ipGroupName", profile.ipGroupName, { shouldValidate: true, shouldDirty: true });
        if (profile.is4PsBeneficiary !== undefined) setValue("is4PsBeneficiary", profile.is4PsBeneficiary, { shouldValidate: true, shouldDirty: true });
        if (profile.householdId4Ps) setValue("householdId4Ps", profile.householdId4Ps, { shouldValidate: true, shouldDirty: true });
        if (profile.isLearnerWithDisability !== undefined) setValue("isLearnerWithDisability", profile.isLearnerWithDisability, { shouldValidate: true, shouldDirty: true });
        if (profile.hasPwdId !== undefined) setValue("hasPwdId", profile.hasPwdId, { shouldValidate: true, shouldDirty: true });
        if (profile.specialNeedsCategory) setValue("specialNeedsCategory", profile.specialNeedsCategory, { shouldValidate: true, shouldDirty: true });
        if (profile.disabilityTypes && Array.isArray(profile.disabilityTypes)) {
          setValue("disabilityTypes", profile.disabilityTypes, { shouldValidate: true, shouldDirty: true });
        }

        if (profile.addresses && Array.isArray(profile.addresses)) {
          const current = profile.addresses.find((a: any) => a.addressType === "CURRENT");
          if (current) {
            setValue("currentAddress", {
              houseNoStreet: current.houseNoStreet || "",
              sitio: current.sitio || "",
              barangay: current.barangay || "",
              cityMunicipality: current.cityMunicipality || "",
              province: current.province || "",
              region: current.region || "",
            }, { shouldValidate: true, shouldDirty: true });
          }
        }

        if (profile.previousSchool) {
          setValue("lastSchoolName", profile.previousSchool.schoolName || "", { shouldValidate: true, shouldDirty: true });
          if (profile.previousSchool.schoolId) setValue("lastSchoolId", profile.previousSchool.schoolId, { shouldValidate: true, shouldDirty: true });
          if (profile.previousSchool.schoolAddress) setValue("lastSchoolAddress", profile.previousSchool.schoolAddress, { shouldValidate: true, shouldDirty: true });
          if (profile.previousSchool.schoolType) setValue("lastSchoolType", profile.previousSchool.schoolType, { shouldValidate: true, shouldDirty: true });
        }
      })
      .catch((error) => console.error("Error fetching learner profile:", error));

    return () => {
      active = false;
    };
  }, [lrn, hasNoLrn, intakeChoice, duplicateDetected, setValue]);

  useEffect(() => {
    if (!hasNoLrn) return;
    if (lrn) {
      setValue("lrn", "", { shouldValidate: true, shouldDirty: true });
    }
    clearErrors("lrn");
  }, [clearErrors, hasNoLrn, lrn, setValue]);

  useEffect(() => {
    if (selectedScp !== "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
      setValue("underSpecialScienceCurriculum", null, { shouldValidate: true });
    }
    if (selectedScp !== "SPECIAL_PROGRAM_IN_THE_ARTS") {
      setValue("artsSpecialization", null, { shouldValidate: true });
    }
    if (selectedScp !== "SPECIAL_PROGRAM_IN_SPORTS") {
      setValue("chosenSport", "", { shouldValidate: true });
    }
  }, [selectedScp, setValue]);

  const onSubmit = async (data: ScpFormData) => {
    try {
      const response = await api.post("/applications", data);
      
      hasSubmittedRef.current = true;
      sessionStorage.removeItem(SCP_FORM_STATE_KEY);
      
      onSuccess(response.data);
    } catch (error) {
      console.error(error);
      alert("Submission failed. Please check the fields and try again.");
    }
  };

  const scrollToFirstError = () => {
    setTimeout(() => {
      const errorElement = document.querySelector(
        '[aria-invalid="true"], .border-destructive, .animated-error'
      ) as HTMLElement;

      if (errorElement) {
        if (
          errorElement.tagName === "INPUT" ||
          errorElement.tagName === "SELECT" ||
          errorElement.tagName === "TEXTAREA" ||
          errorElement.tagName === "BUTTON"
        ) {
          errorElement.focus({ preventScroll: true });
        }
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }, 100);
  };

  const handleAttemptSubmit = () => {
    handleSubmit(
      () => {
        setIsConfirmDialogOpen(true);
      },
      () => {
        scrollToFirstError();
      }
    )();
  };

  const confirmSubmit = () => {
    void handleSubmit(onSubmit)();
  };

  const goToValidationIssue = (issue: ValidationIssue) => {
    const rootField = issue.fieldPath.split(".")[0];
    const target = document.getElementsByName(issue.fieldPath).item(0)
      || document.getElementsByName(rootField).item(0)
      || document.getElementById(issue.fieldPath)
      || document.getElementById(rootField);

    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-0">
      <Button
        type="button"
        onClick={() => {
          confirmOrRun(() => {
            discardScpDraft();
            onCancel();
          });
        }}
        className="mb-6 group font-bold uppercase bg-primary text-white hover:bg-primary/90 shadow-md transition-all px-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Privacy Notice
      </Button>

      <Card className="shadow-sm border-border rounded-2xl overflow-hidden mb-12">
        <CardContent className="p-6 md:p-10">
          <div className="mb-8 pb-6 border-b border-border/50">
            <h2 className="text-xl font-bold text-foreground leading-tight">
              Learner Admission Form
            </h2>
            <p className="text-base leading-tight text-foreground mt-0.5">
              Please complete all required fields below.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={(event) => { event.preventDefault(); void handleAttemptSubmit(); }} className="space-y-16">
              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    I. Special Curricular Program
                  </h3>
                </div>
                <div className="space-y-4 rounded-2xl border border-border p-6">
                  <FormField
                    control={control}
                    name="scpType"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Select Special Curricular Program <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className={cn("h-11 font-bold uppercase", fieldState.error && "border-destructive focus:ring-destructive")}>
                              <SelectValue placeholder="SELECT SPECIAL CURRICULAR PROGRAM" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING">Science, Technology, and Engineering (STE)</SelectItem>
                            <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS">Special Program in the Arts (SPA)</SelectItem>
                            <SelectItem value="SPECIAL_PROGRAM_IN_SPORTS">Special Program in Sports (SPS)</SelectItem>
                          </SelectContent>
                        </Select>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )}
                  />

                  {selectedScp && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="font-bold">
                        {selectedScp === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" &&
                          "Eligibility: No grades lower than 85% in Math and Science, and 80% in other subjects. Must pass the written exam and interview."}
                        {selectedScp === "SPECIAL_PROGRAM_IN_THE_ARTS" &&
                          "Eligibility: Must undergo screening, audition, and interview for the chosen arts discipline."}
                        {selectedScp === "SPECIAL_PROGRAM_IN_SPORTS" &&
                          "Eligibility: General Average of 80 and above with NO failing grades per subject. Must pass physical fitness and skills tests."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    II. Personal Information
                  </h3>
                </div>
                <div className="space-y-8">
                  <div className="p-6 border rounded-2xl space-y-4 bg-muted/20 border-border">
                    <div>
                      <h4 className="text-base leading-tight font-bold uppercase text-foreground">
                        Learner Reference Number (LRN)
                      </h4>
                      <p className="text-base text-foreground">
                        Enter learner's 12-digit LRN to continue admission.
                      </p>
                    </div>
                    <FormField control={control} name="lrn" render={({ field, fieldState }) => (
                      <FormItem>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
                            {isValidatingLrn ? (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : lrn?.length === 12 && !hasNoLrn ? (
                              duplicateDetected ? (
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              ) : (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              )
                            ) : (
                              <Search className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              disabled={hasNoLrn}
                              autoComplete="off"
                              inputMode="numeric"
                              maxLength={12}
                              placeholder="ENTER 12-DIGIT LRN"
                              className={cn(
                                "h-14 border-2 pl-12 text-center text-lg font-bold tracking-widest",
                                hasNoLrn && "bg-muted cursor-not-allowed text-base leading-tight",
                                fieldState.error || duplicateDetected
                                  ? "border-destructive focus-visible:ring-destructive"
                                  : "border-primary/30 focus:border-primary",
                              )}
                              onInput={(event) => {
                                event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
                              }}
                            />
                          </FormControl>
                        </div>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                    {duplicateDetected && (
                      <div className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-lg flex items-center gap-2 justify-center">
                        This LRN already exists in our database. Admission application is a duplicate.
                      </div>
                    )}
                    <p className="text-base text-foreground">
                      {hasNoLrn
                        ? "No LRN declared. Registrar will process this learner under pending LRN creation."
                        : "Provide LRN, or declare no LRN below if the learner is incoming Grade 7."}
                    </p>
                    <FormField control={control} name="hasNoLrn" render={({ field, fieldState }) => (
                      <FormItem className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              id="admission-has-no-lrn"
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                const nextChecked = checked === true;
                                field.onChange(nextChecked);
                                setValue("hasNoLrn", nextChecked, { shouldValidate: true, shouldDirty: true });
                                if (nextChecked) {
                                  setValue("lrn", "", { shouldValidate: true, shouldDirty: true });
                                  clearErrors("lrn");
                                }
                              }}
                            />
                          </FormControl>
                          <Label htmlFor="admission-has-no-lrn" className="cursor-pointer text-base font-bold">
                            Learner has no LRN yet.
                          </Label>
                        </div>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
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
                              <span className="text-[0.625rem] uppercase font-bold">
                                Upload Photo
                              </span>
                            </div>
                          }
                        >
                          {studentPhoto && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setValue("studentPhoto", "", { shouldValidate: true, shouldDirty: true });
                              }}
                              className="absolute top-1 right-1 p-1 bg-primary text-primary-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                              aria-label="Remove learner photo"
                            >
                              <X strokeWidth={3} className="w-3 h-3" />
                            </button>
                          )}
                        </UserPhoto>
                        <input
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handlePhotoChange}
                          title="Upload learner's photo"
                        />
                      </div>
                      <AnimatedError error={errors.studentPhoto?.message as string} />
                    </div>

                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={control} name="lastName" render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel className="text-base leading-tight font-bold text-foreground">Last Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input {...field} autoComplete="off" placeholder="e.g. DELA CRUZ" className={cn("h-11 uppercase font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                      <FormField control={control} name="firstName" render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel className="text-base leading-tight font-bold text-foreground">First Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input {...field} autoComplete="off" placeholder="e.g. JUAN" className={cn("h-11 uppercase font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                      <FormField control={control} name="middleName" render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel className="text-base leading-tight font-bold text-foreground">Middle Name</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} autoComplete="off" disabled={hasNoMiddleName} placeholder="e.g. BAUTISTA" className={cn("h-11 uppercase font-bold", hasNoMiddleName && "bg-muted cursor-not-allowed opacity-50")} /></FormControl>
                          <div className="flex items-center gap-2 mt-1">
                            <Checkbox
                              id="admission-no-middle-name"
                              checked={hasNoMiddleName}
                              onCheckedChange={(checked) => {
                                const nextChecked = checked === true;
                                setHasNoMiddleName(nextChecked);
                                if (nextChecked) setValue("middleName", "", { shouldValidate: true, shouldDirty: true });
                              }}
                            />
                            <Label htmlFor="admission-no-middle-name" className="text-base cursor-pointer font-bold">
                              No Middle Name.
                            </Label>
                          </div>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                      <FormField control={control} name="extensionName" render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel className="text-base leading-tight font-bold">Suffix (Extension)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "NONE" ? "" : value)} value={field.value || "NONE"}>
                            <FormControl><SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select Suffix" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="NONE">None</SelectItem>
                              {["Jr.", "Sr.", "II", "III", "IV", "V"].map((suffix) => <SelectItem key={suffix} value={suffix}>{suffix}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                    <FormField control={control} name="birthdate" render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Date of Birth <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              id="birthdate"
                              name={field.name}
                              autoComplete="off"
                              placeholder="MM/DD/YYYY"
                              maxLength={10}
                              inputMode="numeric"
                              value={dateInput}
                              onBlur={field.onBlur}
                              onChange={(event) => handleDateTyping(event.target.value, field.onChange)}
                              className={cn("h-11 font-bold pr-12", fieldState.error && "border-destructive focus-visible:ring-destructive")}
                            />
                            <Popover
                              open={isCalendarOpen}
                              onOpenChange={(open) => {
                                if (open && field.value) {
                                  const date = new Date(field.value);
                                  if (isValidDate(date)) setCalendarMonth(date);
                                }
                                setIsCalendarOpen(open);
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 hover:bg-transparent">
                                  <CalendarIcon className={cn("w-5 h-5 transition-colors", isCalendarOpen ? "text-primary" : "text-foreground")} />
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
                                    if (!date) return;
                                    field.onChange(date);
                                    setDateInput(format(date, "MM/dd/yyyy"));
                                    setCalendarMonth(date);
                                    setIsCalendarOpen(false);
                                  }}
                                  disabled={(date) => date > new Date() || date < new Date(1950, 0, 1)}
                                  startMonth={new Date(1900, 0, 1)}
                                  endMonth={new Date(2100, 11, 31)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                    <FormItem>
                      <FormLabel className="text-base leading-tight font-bold">Age</FormLabel>
                      <FormControl>
                        <Input readOnly disabled placeholder="Auto-calculated" className="h-11 font-bold cursor-not-allowed disabled:opacity-100 disabled:bg-muted" value={birthdateStr ? differenceInYears(new Date(), new Date(birthdateStr)) : ""} />
                      </FormControl>
                    </FormItem>
                    <FormField control={control} name="sex" render={({ field, fieldState }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Sex <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="flex gap-4 pt-1">
                            {[
                              { value: "MALE" as const, label: "MALE", icon: Mars },
                              { value: "FEMALE" as const, label: "FEMALE", icon: Venus },
                            ].map((option) => (
                              <button key={option.value} type="button" onClick={() => field.onChange(option.value)} className={cn("flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base uppercase", field.value === option.value ? "border-primary bg-primary/5 text-primary" : fieldState.error ? "border-destructive hover:bg-destructive/10 text-foreground" : "border-border hover:bg-muted/50 text-foreground")}>
                                <option.icon className="w-4 h-4" />
                                <span className="font-bold">{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="placeOfBirth" render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Place of Birth <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} autoComplete="off" placeholder="CITY/MUNICIPALITY, PROVINCE" className={cn("h-11 uppercase font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                    <FormField control={control} name="motherTongue" render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Mother Tongue <span className="text-destructive">*</span></FormLabel>
                        <div className={cn("grid gap-2", isOtherMotherTongue ? "grid-cols-2" : "grid-cols-1")}>
                          <FormControl>
                            <SearchableCombobox
                              items={MOTHER_TONGUE_OPTIONS}
                              value={isOtherMotherTongue ? "Others" : field.value || ""}
                              onChange={(value) => {
                                if (value === "Others") {
                                  setIsOtherMotherTongue(true);
                                  field.onChange("");
                                } else {
                                  setIsOtherMotherTongue(false);
                                  field.onChange(value);
                                }
                              }}
                              placeholder="Select Mother Tongue"
                              className={cn("uppercase h-11", fieldState.error && "border-destructive focus-visible:ring-destructive")}
                            />
                          </FormControl>
                          {isOtherMotherTongue && (
                            <Input
                              name={field.name}
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              autoComplete="off"
                              placeholder="Please specify mother tongue"
                              className={cn("h-11 font-bold uppercase", fieldState.error && "border-destructive focus-visible:ring-destructive")}
                              autoFocus
                            />
                          )}
                        </div>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-4 pt-6 border-t">
                    <h4 className="text-base leading-tight font-bold uppercase text-foreground">Complete Home/Permanent Address</h4>
                    <FormField control={control} name="currentAddress" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-4">
                            <PhilippineAddressSelector
                              required
                              value={{
                                barangay: field.value?.barangay,
                                cityMunicipality: field.value?.cityMunicipality,
                                province: field.value?.province,
                                region: field.value?.region,
                              }}
                              onChange={(updates) => {
                                field.onChange({
                                  ...field.value,
                                  ...updates,
                                });
                              }}
                              errors={{
                                region: errors.currentAddress?.region?.message,
                                province: errors.currentAddress?.province?.message,
                                cityMunicipality: errors.currentAddress?.cityMunicipality?.message,
                                barangay: errors.currentAddress?.barangay?.message,
                              }}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="currentAddress.sitio"
                                  className="text-base font-bold uppercase">
                                  Sitio / Purok
                                </Label>
                                <Input
                                  autoComplete="off"
                                  id="currentAddress.sitio"
                                  value={field.value?.sitio || ""}
                                  onChange={(e) => field.onChange({ ...field.value, sitio: e.target.value.toUpperCase() })}
                                  className="h-11 font-bold uppercase"
                                  placeholder="e.g. SITIO CALAMBUGA"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="currentAddress.houseNoStreet"
                                  className="text-base font-bold uppercase">
                                  House No. / Street
                                </Label>
                                <Input
                                  autoComplete="off"
                                  id="currentAddress.houseNoStreet"
                                  value={field.value?.houseNoStreet || ""}
                                  onChange={(e) => field.onChange({ ...field.value, houseNoStreet: e.target.value.toUpperCase() })}
                                  className="h-11 font-bold uppercase"
                                  placeholder="e.g. 123 OR RIZAL STREET"
                                />
                              </div>
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    III. Previous School Information
                  </h3>
                </div>
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="lastSchoolName" render={({ field, fieldState }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Last School Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} autoComplete="off" placeholder="e.g. APOLINARIO MABINI ELEMENTARY SCHOOL" className={cn("h-11 uppercase font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                    <FormField control={control} name="lastSchoolId" render={({ field, fieldState }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-base leading-tight font-bold text-foreground">School ID (Optional)</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} autoComplete="off" placeholder="6-DIGIT DEPED ID" maxLength={6} inputMode="numeric" className={cn("h-11 uppercase font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} /></FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                    <FormField control={control} name="lastSchoolAddress" render={({ field, fieldState }) => (
                      <FormItem className="md:col-span-2 space-y-2">
                        <FormLabel className="text-base leading-tight font-bold text-foreground">School Address / Division (Optional)</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} autoComplete="off" placeholder="CITY/MUNICIPALITY, PROVINCE" className="h-11 uppercase font-bold" /></FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                    <FormField control={control} name="lastSchoolType" render={({ field, fieldState }) => (
                      <FormItem className="md:col-span-2 space-y-3">
                        <FormLabel className="text-base leading-tight font-bold text-foreground">School Type <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { value: "PUBLIC" as const, label: "Public" },
                              { value: "PRIVATE" as const, label: "Private" },
                              { value: "INTERNATIONAL" as const, label: "International" },
                              { value: "ALS" as const, label: "ALS" },
                            ].map((option) => (
                              <button key={option.value} type="button" onClick={() => field.onChange(option.value)} className={cn("flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-11 uppercase", field.value === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : fieldState.error ? "border-destructive bg-muted hover:bg-destructive/10 text-foreground" : "border-border bg-muted hover:bg-primary/5 text-foreground")}>
                                <span className="font-bold text-base leading-tight">{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    IV. Academic Profile &amp; Qualifications
                  </h3>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="grade5GeneralAverage" render={({ field, fieldState }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-base leading-tight font-bold text-foreground">Grade 5 Final General Average <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="e.g. 90.00" className={cn("h-11 font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} value={field.value ?? ""} onChange={(e) => {
                          let val = e.target.value;
                          if (val.includes(".")) {
                            const [whole, decimal] = val.split(".");
                            if (decimal && decimal.length > 2) {
                              val = `${whole}.${decimal.slice(0, 2)}`;
                              e.target.value = val;
                            }
                          }
                          field.onChange(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber);
                        }} /></FormControl>
                        <AnimatedError error={fieldState.error?.message} />
                      </FormItem>
                    )} />

                    {selectedScp === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && (
                      <FormField control={control} name="underSpecialScienceCurriculum" render={({ field, fieldState }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-base leading-tight font-bold">Under Special Science Curriculum in Elementary?</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 gap-3">
                              {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map((option) => (
                                <button key={String(option.value)} type="button" onClick={() => field.onChange(option.value)} className={cn("flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-11 uppercase", field.value === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-muted hover:bg-primary/5 text-foreground")}>
                                  <span className="font-bold text-base leading-tight">{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                    )}

                    {selectedScp === "SPECIAL_PROGRAM_IN_THE_ARTS" && (
                      <FormField control={control} name="artsSpecialization" render={({ field, fieldState }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-base leading-tight font-bold text-foreground">Arts Specialization <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl><SelectTrigger className={cn("h-11 font-bold uppercase", fieldState.error && "border-destructive focus:ring-destructive")}><SelectValue placeholder="SELECT ARTS SPECIALIZATION" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="CREATIVE_WRITING">Creative Writing</SelectItem>
                              <SelectItem value="MEDIA_AND_VISUAL_ARTS">Media &amp; Visual Arts</SelectItem>
                              <SelectItem value="MUSIC">Music</SelectItem>
                              <SelectItem value="DANCE">Dance</SelectItem>
                            </SelectContent>
                          </Select>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                    )}

                    {selectedScp === "SPECIAL_PROGRAM_IN_SPORTS" && (
                      <FormField control={control} name="chosenSport" render={({ field, fieldState }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-base leading-tight font-bold text-foreground">Chosen Sport <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. VOLLEYBALL" className={cn("h-11 uppercase font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                          <AnimatedError error={fieldState.error?.message} />
                        </FormItem>
                      )} />
                    )}
                  </div>
                </div>
              </div>

              {validationIssues.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 mt-8">
                  <div className="flex items-center gap-2 text-destructive font-bold text-base leading-tight">
                    <AlertCircle className="w-4 h-4" />
                    Please review and complete the following fields to proceed:
                  </div>
                  <ul className="list-disc pl-6 text-base font-bold text-destructive space-y-1">
                    {validationIssues.map((issue, index) => (
                      <li key={`${issue.fieldPath}-${index}`}>
                        <a
                          href={`#${issue.fieldPath}`}
                          onClick={(event) => {
                            event.preventDefault();
                            goToValidationIssue(issue);
                          }}
                          className="underline underline-offset-2 text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40 rounded-sm"
                        >
                          {issue.fieldPath === "studentPhoto" ? issue.message : `${issue.fieldLabel}: ${issue.message}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-8 border-t border-border/60 space-y-6">
                <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg leading-tight font-extrabold uppercase text-primary">
                      Accuracy Certification
                    </h3>
                  </div>
                  <FormField
                    control={control}
                    name="isPrivacyConsentGiven"
                    render={({ field, fieldState }) => (
                      <FormItem className="flex flex-col gap-2 w-full space-y-0">
                        <div className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              id="admission-certify-check"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1"
                            />
                          </FormControl>
                          <Label htmlFor="admission-certify-check" className="text-base font-semibold leading-relaxed cursor-pointer select-none block">
                            I certify that all information in this admission form is true, correct, and complete to the best of my knowledge. I understand that false information may affect the learner&apos;s admission processing.
                          </Label>
                        </div>
                        <AnimatedError error={fieldState.error?.message} className="pl-14" />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="flex flex-col items-center gap-4">
                  <Button type="button" disabled={isSubmitting} onClick={handleAttemptSubmit} className="w-full h-14 text-lg font-bold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
                    Submit Registration
                  </Button>
                  <p className="text-base text-foreground flex items-center gap-1.5 italic">
                    <Info className="w-3.5 h-3.5" />
                    Privacy consent was recorded before this submission.
                  </p>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <ConfirmationModal
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setIsConfirmDialogOpen(open);
        }}
        title="Confirm Admission Submission"
        description="You are about to submit this online admission form. Please confirm all details are complete and accurate."
        onConfirm={confirmSubmit}
        confirmText="Yes, Submit Application"
        loading={isSubmitting}
        variant="primary"
      />
    </div>
  );
}
