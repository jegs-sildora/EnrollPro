import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@/shared/lib/zodResolver";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import { sileo } from "sileo";
import { isAxiosError } from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import {
  useUnsavedChanges,
  useUnsavedChangesPrompt,
} from "@/shared/hooks/useUnsavedChanges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

import { SearchableCombobox } from "@/shared/ui/searchable-combobox";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";
import { AnimatedError } from "@/shared/components/AnimatedError";
import { Loader2, Plus, Search, User, FileText, Phone, FileCheck, Mars, Venus, AlertCircle, CheckCircle2, Camera, X } from "lucide-react";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import api from "@/shared/api/axiosInstance";
import { directEncodeWalkInSchema, type DirectEncodeWalkInPayload } from "@enrollpro/shared";
import { useAuthStore } from "@/store/auth.slice";

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

interface SchoolYearGradeLevel {
  id: number;
  name: string;
}

interface ActiveSchoolYearGradeLevelsResponse {
  gradeLevels?: SchoolYearGradeLevel[];
}

interface LearnerLookupResponse {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  birthdate?: string | null;
  sex?: "MALE" | "FEMALE";
  previousSchool?: {
    schoolName?: string | null;
    generalAverage?: number | null;
  } | null;
  familyMembers?: Array<{
    firstName: string;
    lastName: string;
    contactNumber?: string | null;
  }>;
}

interface ApiErrorResponse {
  message?: string;
}

interface AtlasSubjectOption {
  code: string;
  displayCode: string;
  name: string;
}

interface AtlasSubjectCatalogResponse {
  data: AtlasSubjectOption[];
  meta: {
    source: "ATLAS";
    gradeLevelId: number;
    incomingGradeLevel: number;
    subjectGradeLevelId: number;
    subjectGradeLevel: number;
    fetchedAt: string;
  };
}

function getWalkInErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function WalkInEncodePanel() {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [noLrn, setNoLrn] = useState(false);
  const lastLookedUpLrn = useRef<string>("");
  const [isOtherMotherTongue, setIsOtherMotherTongue] = useState(false);
  const queryClient = useQueryClient();
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore();
  const { panelPercentage, isDesktopViewport, startResizingRight } = useResizablePanel(80, { centered: true });

  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const isAdmin = userRoles.includes("SYSTEM_ADMIN");
  const isHeadRegistrar = userRoles.includes("HEAD_REGISTRAR");
  const isStrictClassAdviser = userRoles.includes("CLASS_ADVISER") && !isAdmin && !isHeadRegistrar;

  const { data: activeSchoolYear } = useQuery({
    queryKey: ["schoolYear", "grade-levels"],
    queryFn: async () => {
      const res = await api.get<ActiveSchoolYearGradeLevelsResponse>("/school-years/grade-levels");
      return res.data;
    },
  });

  const activeSyId = useSettingsStore((s) => s.activeSchoolYearId);
  const { data: advisoryData } = useQuery({
    queryKey: ["teacher", "advisory", activeSyId],
    queryFn: () => api.get("/teacher-advisory").then(res => res.data),
    enabled: isStrictClassAdviser && !!activeSyId,
  });

  const assignedGradeLevelId = isStrictClassAdviser && advisoryData?.section?.gradeLevelId
    ? advisoryData.section.gradeLevelId
    : null;

  const programOptions = [
    { val: "REGULAR", label: "BEC" },
    ...(steEnabled ? [{ val: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" }] : []),
    ...(spaEnabled ? [{ val: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" }] : []),
    ...(spsEnabled ? [{ val: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" }] : []),
  ];

  const form = useForm<DirectEncodeWalkInPayload>({
    resolver: zodResolver(directEncodeWalkInSchema) as Resolver<DirectEncodeWalkInPayload>,
    mode: "onChange",
    defaultValues: {
      learnerType: "NEW_ENROLLEE",
      lrn: "",
      firstName: "",
      lastName: "",
      middleName: "",
      birthdate: "",
      sex: "" as unknown as DirectEncodeWalkInPayload["sex"],
      motherTongue: "",
      studentPhoto: "",
      extensionName: "",
      addressStreet: "",
      addressSitio: "",
      addressRegion: "",
      addressProvince: "",
      addressCity: "",
      addressBarangay: "",
      permanentAddressSameAsCurrent: true,
      gradeLevelId: 0,
      assignedProgram: "" as unknown as DirectEncodeWalkInPayload["assignedProgram"],
      previousSchoolName: "",
      previousGenAve: undefined,
      guardianFirstName: "",
      guardianMiddleName: "",
      guardianLastName: "",
      guardianRelationship: "" as unknown as DirectEncodeWalkInPayload["guardianRelationship"],
      guardianContact: "",
      hasSf9: false,
      hasPsa: false,
      originatingSchoolId: "",
      sf9EligibilityStatus: "" as unknown as DirectEncodeWalkInPayload["sf9EligibilityStatus"],
      conditionalSubjects: [],
      sectionId: undefined,
    },
  });
  const { isDirty, isSubmitting, isValid } = form.formState;

  const { fields: conditionalSubjectFields, append: appendConditionalSubject, remove: removeConditionalSubject, replace: replaceConditionalSubjects } = useFieldArray({
    control: form.control,
    name: "conditionalSubjects",
  });
  const learnerType = form.watch("learnerType");
  const gradeLevelId = form.watch("gradeLevelId");
  const assignedProgram = form.watch("assignedProgram");
  const sf9EligibilityStatus = form.watch("sf9EligibilityStatus");
  const requiresBackSubjects =
    learnerType === "TRANSFEREE" &&
    sf9EligibilityStatus === "CONDITIONALLY_PROMOTED";

  
  const sectionsQuery = useQuery({
    queryKey: ["sections", "filtered", activeSyId, gradeLevelId, assignedProgram],
    queryFn: async () => {
      const response = await api.get(`/sections/${activeSyId}`, {
        params: { gradeLevelId, programType: assignedProgram },
      });
      return response.data.sections as Array<{ id: number; name: string; maxCapacity: number; enrolledCount: number; isHomogeneous: boolean; programType: string; }>;
    },
    enabled: !!activeSyId && gradeLevelId > 0 && !!assignedProgram,
    staleTime: 5 * 60 * 1000,
  });

  const atlasSubjectsQuery = useQuery({
    queryKey: ["enrollment", "walk-in", "atlas-subjects", gradeLevelId, assignedProgram],
    queryFn: async () => {
      const response = await api.get<AtlasSubjectCatalogResponse>(
        "/enrollment/walk-in/atlas-subjects",
        { params: { gradeLevelId, programType: assignedProgram } },
      );
      return response.data;
    },
    enabled: requiresBackSubjects && gradeLevelId > 0 && Boolean(assignedProgram),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  
  useEffect(() => {
    form.setValue("sectionId", undefined, { shouldDirty: true, shouldValidate: true });
  }, [gradeLevelId, assignedProgram, form]);

  useEffect(() => {
    if (!requiresBackSubjects) {
      if (conditionalSubjectFields.length > 0) {
        replaceConditionalSubjects([]);
      }
    } else {
      if (conditionalSubjectFields.length === 0) {
        replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
      }
    }
  }, [requiresBackSubjects, conditionalSubjectFields.length, replaceConditionalSubjects]);

  useEffect(() => {
    if (searchParams.get("action") === "walk-in") {
      setOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (assignedGradeLevelId && gradeLevelId !== assignedGradeLevelId) {
      form.setValue("gradeLevelId", assignedGradeLevelId, { shouldDirty: true, shouldValidate: true });
    }
  }, [assignedGradeLevelId, gradeLevelId, form]);

  const handleLrnLookup = async (lrn: string) => {
    if (lrn.length !== 12) return;
    if (lrn === lastLookedUpLrn.current) return; // skip if same LRN already looked up
    lastLookedUpLrn.current = lrn;

    setIsLookingUp(true);
    try {
      const res = await api.get<LearnerLookupResponse>(`/learner/lookup?lrn=${lrn}`);
      const data = res.data;

      form.setValue("firstName", data.firstName);
      form.setValue("lastName", data.lastName);
      if (data.middleName) form.setValue("middleName", data.middleName);
      if (data.birthdate) {
        // Handle format YYYY-MM-DD
        const d = new Date(data.birthdate);
        form.setValue("birthdate", d.toISOString().split('T')[0]);
      }
      if (data.sex) form.setValue("sex", data.sex);
      if (data.previousSchool) {
        form.setValue("previousSchoolName", data.previousSchool.schoolName || "");
        if (data.previousSchool.generalAverage) {
          form.setValue("previousGenAve", data.previousSchool.generalAverage);
        }
      }
      if (data.familyMembers && data.familyMembers.length > 0) {
        const primary = data.familyMembers[0];
        form.setValue("guardianFirstName", primary.firstName.trim());
        form.setValue("guardianLastName", primary.lastName.trim());
        form.setValue("guardianMiddleName", "");
        if (primary.contactNumber) {
          form.setValue("guardianContact", primary.contactNumber);
        }
      }

      sileo.success({ title: "Learner Found", description: "Profile auto-populated." });
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        const currentLearnerType = form.getValues("learnerType");
        form.reset({
          learnerType: currentLearnerType,
          lrn: lrn,
          firstName: "",
          lastName: "",
          middleName: "",
          birthdate: "",
          sex: "" as unknown as DirectEncodeWalkInPayload["sex"],
          motherTongue: "",
          studentPhoto: "",
          extensionName: "",
          addressStreet: "",
          addressSitio: "",
          addressRegion: "",
          addressProvince: "",
          addressCity: "",
          addressBarangay: "",
          permanentAddressSameAsCurrent: true,
          gradeLevelId: 0,
          assignedProgram: "" as unknown as DirectEncodeWalkInPayload["assignedProgram"],
          previousSchoolName: "",
          previousGenAve: undefined,
          guardianFirstName: "",
          guardianMiddleName: "",
          guardianLastName: "",
          guardianRelationship: "" as unknown as DirectEncodeWalkInPayload["guardianRelationship"],
          guardianContact: "",
          hasSf9: false,
          hasPsa: false,
          originatingSchoolId: "",
          sf9EligibilityStatus: "" as unknown as DirectEncodeWalkInPayload["sf9EligibilityStatus"],
          conditionalSubjects: [],
          sectionId: undefined,
        });
      } else {
        sileo.error({ title: "Lookup Failed", description: "Could not fetch learner data." });
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const resetPanelState = useCallback(() => {
    form.reset();
    setNoLrn(false);
    lastLookedUpLrn.current = "";
  }, [form]);

  const closePanel = useCallback(() => {
    resetPanelState();
    setOpen(false);
  }, [resetPanelState]);

  const requestClosePanel = useCallback(() => {
    confirmOrRun(closePanel);
  }, [closePanel, confirmOrRun]);

  useUnsavedChanges({
    id: "walk-in-encode-panel",
    label: "Walk-in learner form",
    isDirty: open && isDirty,
    isSubmitting,
    onDiscard: resetPanelState,
  });

  const onSubmit = async (values: DirectEncodeWalkInPayload) => {
    const payload = {
      ...values,
      firstName: values.firstName?.toUpperCase(),
      lastName: values.lastName?.toUpperCase(),
      middleName: values.middleName?.toUpperCase(),
      previousSchoolName: values.previousSchoolName?.toUpperCase(),
      guardianFirstName: values.guardianFirstName?.toUpperCase(),
      guardianMiddleName: values.guardianMiddleName?.toUpperCase(),
      guardianLastName: values.guardianLastName?.toUpperCase(),
    };
    try {
      await api.post("/enrollment/walk-in", payload);
      sileo.success({
        title: "Successfully Encoded",
        description: "Learner routed directly to unassigned sectioning pool.",
      });
      closePanel();
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
    } catch (err: unknown) {
      sileo.error({
        title: "Encoding Failed",
        description: getWalkInErrorMessage(err, "The learner was not encoded. Please review the form and try again."),
      });
    }
  };

  // The encoder is intentionally non-dismissible through outside clicks or Escape.
  // Closing is handled only through explicit Cancel, close, discard, or successful save.
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setOpen(true);
      return;
    }
    requestClosePanel();
  };

  const hasSf9 = form.watch("hasSf9");
  const hasPsa = form.watch("hasPsa");
  const isCompleteDocs = hasSf9 && hasPsa;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-11 px-6 text-base font-bold gap-2">
          <Plus className="w-5 h-5" />
          Encode Walk-In
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="p-0 flex flex-col h-[90vh] overflow-visible w-[95vw] sm:w-full max-w-none transition-[width] duration-75 ease-linear"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw`, maxWidth: '90vw', minWidth: '40vw' } : undefined
        }
      >
        <div
          onMouseDown={startResizingRight}
          className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group"
        >
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
            <Plus className="w-6 h-6 text-primary" />
            Walk-In Learner Enrollment
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0" autoComplete="off">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">

                <div className="space-y-4">
                  {/* LEARNER PROFILE BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Learner Profile
                      </span>
                    </div>
                    <div className="px-5 pt-5 pb-1">
                      <div className="grid grid-cols-3 gap-4 font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            form.setValue("learnerType", "NEW_ENROLLEE", { shouldDirty: true, shouldValidate: true });
                            replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                          }}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                            form.watch('learnerType') === "NEW_ENROLLEE"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground"
                          )}
                        >
                          New Entrant
                        </button>
                        <button
                          type="button"
                          onClick={() => form.setValue("learnerType", "TRANSFEREE", { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                            form.watch('learnerType') === "TRANSFEREE"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground"
                          )}
                        >
                          Transferee
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            form.setValue("learnerType", "RETURNING", { shouldDirty: true, shouldValidate: true });
                            replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                          }}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                            form.watch('learnerType') === "RETURNING"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground"
                          )}
                        >
                          Returnee
                        </button>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <div className="space-y-4">

                        {form.watch('learnerType') === "TRANSFEREE" ? (
                          <FormField
                            control={form.control}
                            name="lrn"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex justify-between font-bold">
                                  <span>Learner Reference Number (LRN) <span className="text-destructive">*</span></span>
                                  {isLookingUp && <Loader2 className="w-4 h-4  text-primary" />}
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      placeholder="12-digit Learner Reference Number (LRN)"
                                      disabled={false}
                                      className="uppercase font-bold"
                                      value={field.value ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                        field.onChange(val);
                                        if (val.length === 12) {
                                          handleLrnLookup(val);
                                        }
                                      }}
                                      onBlur={() => {
                                        field.onBlur();
                                        const value = field.value ?? "";
                                        if (value.length === 12 && value !== lastLookedUpLrn.current) {
                                          handleLrnLookup(value);
                                        }
                                      }}
                                    />
                                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <>
                            <FormField
                              control={form.control}
                              name="lrn"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex justify-between font-bold">
                                    <span>Learner Reference Number (LRN)</span>
                                    {isLookingUp && <Loader2 className="w-4 h-4  text-primary" />}
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        placeholder="12-digit Learner Reference Number (LRN)"
                                        disabled={noLrn}
                                        className="uppercase font-bold"
                                        value={field.value ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                          field.onChange(val);
                                          if (val.length === 12) {
                                            handleLrnLookup(val);
                                          }
                                        }}
                                        onBlur={() => {
                                          field.onBlur();
                                          const value = field.value ?? "";
                                          if (value.length === 12 && value !== lastLookedUpLrn.current) {
                                            handleLrnLookup(value);
                                          }
                                        }}
                                      />
                                      <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex items-center space-x-2 -mt-2">
                              <Checkbox
                                id="noLrn"
                                checked={noLrn}
                                onCheckedChange={(checked) => {
                                  const isChecked = checked === true;
                                  setNoLrn(isChecked);
                                  if (isChecked) {
                                    form.setValue("lrn", "");
                                    form.clearErrors("lrn");
                                  }
                                }}
                              />
                              <label htmlFor="noLrn" className="text-base  leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground font-bold">
                                Learner has no LRN yet
                              </label>
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-[120px_1fr] gap-6">
                          {/* LEFT COLUMN: Photo */}
                          <div className="flex flex-col space-y-2 items-center">
                            <FormLabel className="font-bold capitalize whitespace-nowrap">Learner's Photo <span className="text-destructive">*</span></FormLabel>
                            <div className="relative group w-[120px]">
                              <UserPhoto
                                photo={form.watch("studentPhoto")}
                                containerClassName={cn(
                                  "w-[120px] h-[120px] rounded-lg border-2 border-dashed transition-all duration-200",
                                  form.watch("studentPhoto")
                                    ? "border-primary/50 bg-background"
                                    : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80",
                                )}
                                fallbackIcon={
                                  <div className="flex flex-col items-center justify-center text-foreground group-hover:text-primary transition-colors h-full w-full">
                                    <Camera className="w-8 h-8 mb-1" />
                                    <span className="text-[0.625rem] uppercase font-bold text-center leading-tight">Upload<br/>Photo</span>
                                  </div>
                                }>
                                {form.watch("studentPhoto") && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); form.setValue("studentPhoto", "", { shouldDirty: true }); }}
                                    type="button"
                                    className="absolute top-1 right-1 p-1 bg-primary text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20">
                                    <X strokeWidth={3} className="w-3 h-3" />
                                  </button>
                                )}
                              </UserPhoto>
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10 w-full h-full"
                                accept="image/jpeg,image/png,image/jpg"
                                title="Upload learner's photo"
                                onChange={(e) => {
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
                                    form.setValue("studentPhoto", reader.result as string, { shouldDirty: true });
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </div>
                            <AnimatedError error={form.formState.errors.studentPhoto?.message as string} />
                          </div>

                          {/* RIGHT COLUMN: Dense Data Grid */}
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 font-bold">
                              <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">Last Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl><Input placeholder="e.g. DELA CRUZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">First Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl><Input placeholder="e.g. JUAN" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4 font-bold">
                              <FormField
                                control={form.control}
                                name="middleName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">Middle Name</FormLabel>
                                    <FormControl><Input placeholder="e.g. PEREZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="extensionName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">Suffix (Extension)</FormLabel>
                                    <Select
                                      onValueChange={(val) => field.onChange(val === "NONE" ? "" : val)}
                                      value={field.value || "NONE"}>
                                      <SelectTrigger className="font-bold">
                                        <SelectValue placeholder="Select Suffix" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NONE">None</SelectItem>
                                        {["Jr.", "Sr.", "II", "III", "IV", "V"].map((opt) => (
                                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="birthdate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Birthdate <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <HybridDatePicker value={field.value} onChange={field.onChange} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="sex"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Sex <span className="text-destructive">*</span></FormLabel>
                                <div className="flex gap-4">
                                  {(
                                    [
                                      { val: "MALE", icon: Mars, label: "Male" },
                                      { val: "FEMALE", icon: Venus, label: "Female" },
                                    ] as const
                                  ).map((s) => (
                                    <button
                                      key={s.val}
                                      type="button"
                                      onClick={() => field.onChange(s.val)}
                                      className={cn(
                                        "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                        field.value === s.val
                                          ? "border-primary bg-primary/5 text-primary"
                                          : "border-border hover:bg-muted/50 text-foreground"
                                      )}>
                                      <s.icon
                                        className={cn(
                                          "w-4 h-4",
                                          field.value === s.val ? "text-primary" : "text-foreground"
                                        )}
                                      />
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 font-bold">
                          <FormField
                            control={form.control}
                            name="motherTongue"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Mother Tongue <span className="text-destructive">*</span></FormLabel>
                                <div className={cn("grid gap-2", isOtherMotherTongue ? "grid-cols-2" : "grid-cols-1")}>
                                  <FormControl>
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
                                      className="uppercase font-bold"
                                    />
                                  </FormControl>
                                  {isOtherMotherTongue && (
                                    <FormControl>
                                      <Input
                                        placeholder="Please specify mother tongue"
                                        className="font-bold uppercase"
                                        {...field}
                                        value={field.value || ""}
                                        autoFocus
                                      />
                                    </FormControl>
                                  )}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="gradeLevelId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">Incoming Grade Level <span className="text-destructive">*</span></FormLabel>
                              <div className="grid grid-cols-4 gap-4">
                                {activeSchoolYear?.gradeLevels?.map((gl) => (
                                  <button
                                    key={gl.id}
                                    type="button"
                                    onClick={() => {
                                      if (isStrictClassAdviser) return;
                                      field.onChange(gl.id);
                                      replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                    }}
                                    className={cn(
                                      "flex items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === gl.id
                                        ? getGradeLevelBadgeStyles(gl.name) + " border-current"
                                        : "border-border hover:bg-muted/50 text-foreground",
                                      isStrictClassAdviser && field.value !== gl.id && "opacity-50 cursor-not-allowed"
                                    )}>
                                    {gl.name}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="assignedProgram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">Curriculum Type <span className="text-destructive">*</span></FormLabel>
                              <div className="flex gap-4">
                                {programOptions.map((prog) => (
                                  <button
                                    key={prog.val}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(prog.val);
                                      replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                    }}
                                    className={cn(
                                      "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === prog.val
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}>
                                    {prog.label}
                                  </button>
                                ))}
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* CURRENT HOME ADDRESS BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        CURRENT HOME ADDRESS
                      </span>
                    </div>
                    <div className="px-5 pt-4 pb-5 space-y-4">
                      
                      <PhilippineAddressSelector
                        value={{
                          region: form.watch("addressRegion") || "",
                          province: form.watch("addressProvince") || "",
                          cityMunicipality: form.watch("addressCity") || "",
                          barangay: form.watch("addressBarangay") || "",
                        }}
                        onChange={(updates) => {
                          if (updates.region !== undefined) form.setValue("addressRegion", updates.region, { shouldValidate: updates.region !== "", shouldDirty: true });
                          if (updates.province !== undefined) form.setValue("addressProvince", updates.province, { shouldValidate: updates.province !== "", shouldDirty: true });
                          if (updates.cityMunicipality !== undefined) form.setValue("addressCity", updates.cityMunicipality, { shouldValidate: updates.cityMunicipality !== "", shouldDirty: true });
                          if (updates.barangay !== undefined) form.setValue("addressBarangay", updates.barangay, { shouldValidate: updates.barangay !== "", shouldDirty: true });
                        }}
                        errors={{
                          region: form.formState.errors.addressRegion?.message as string,
                          province: form.formState.errors.addressProvince?.message as string,
                          cityMunicipality: form.formState.errors.addressCity?.message as string,
                          barangay: form.formState.errors.addressBarangay?.message as string,
                        }}
                        required={true}
                      />

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name="addressSitio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">Sitio / Purok</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Sitio Calambuga" className="uppercase font-bold" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="addressStreet"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">House No. / Street</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. 123 or Rizal Street" className="uppercase font-bold" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                    </div>
                  </div>

                  {/* PREVIOUS SCHOOL BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Previous School Data
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4 space-y-4">
                      <div>
                        <FormField
                          control={form.control}
                          name="previousSchoolName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">
                                {form.watch('learnerType') === "TRANSFEREE" ? "Transferred From (Previous School)" : "School Name"}
                                <span className="text-destructive"> *</span>
                              </FormLabel>
                              <FormControl><Input placeholder="e.g. RIZAL ELEMENTARY SCHOOL" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className={form.watch('learnerType') === "TRANSFEREE" ? "grid grid-cols-3 gap-4" : "flex gap-4"}>
                        <div className={form.watch('learnerType') === "TRANSFEREE" ? "" : "flex-1"}>
                          <FormField
                            control={form.control}
                            name="originatingSchoolId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Originating School ID <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g. 123456"
                                    className="font-bold"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                      field.onChange(val);
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        {form.watch('learnerType') === "TRANSFEREE" && (
                          <div>
                            <FormField
                              control={form.control}
                              name="transferCertificateNo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-bold capitalize">Transfer Certificate No.</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g. 98765"
                                      className="font-bold uppercase"
                                      {...field}
                                      value={field.value ?? ""}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        <div className={form.watch('learnerType') === "TRANSFEREE" ? "" : "flex-1"}>
                          <FormField
                            control={form.control}
                            name="previousGenAve"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Final Gen Ave</FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-bold"
                                    type="number"
                                    step="0.01"
                                    min={75}
                                    max={99.99}
                                    placeholder="e.g. 85.50"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      if (e.target.value === "") {
                                        field.onChange(undefined);
                                        return;
                                      }
                                      const num = Number(e.target.value);
                                      field.onChange(Math.min(num, 99.99));
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <div>
                        <FormField
                          control={form.control}
                          name="sf9EligibilityStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">SF9 Eligibility Status <span className="text-destructive">*</span></FormLabel>
                              <div className="flex gap-4">
                                {[
                                  { val: "PROMOTED", label: "Promoted" },
                                  { val: "CONDITIONALLY_PROMOTED", label: "Conditionally Promoted" },
                                  { val: "RETAINED", label: "Retained" },
                                ].map((s) => (
                                  <button
                                    key={s.val}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(s.val);
                                      if (s.val !== "CONDITIONALLY_PROMOTED") {
                                        replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                      }
                                    }}
                                    className={cn(
                                      "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === s.val
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {requiresBackSubjects && (
                          <div className="mt-4 rounded-lg border border-border bg-muted/10 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                              <FormLabel className="font-bold">
                                {atlasSubjectsQuery.data
                                  ? `Grade ${atlasSubjectsQuery.data.meta.subjectGradeLevel} Back Subjects`
                                  : "Previous Grade Back Subjects"}{" "}
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <span className="text-sm text-muted-foreground">
                                (Maximum of 2 subjects)
                              </span>
                            </div>

                            <div className="space-y-4">
                              {conditionalSubjectFields.map((fieldItem, index) => {
                                const selectedSubjectCodes = form.watch("conditionalSubjects").map(s => s.subjectCode);
                                
                                return (
                                  <div key={fieldItem.id} className="grid grid-cols-12 gap-4 items-start relative">
                                    <div className="col-span-8 relative">
                                      <FormField
                                        control={form.control}
                                        name={`conditionalSubjects.${index}.subjectCode`}
                                        render={({ field, fieldState }) => {
                                          // Exclude subjects that are selected in OTHER rows
                                          const availableSubjects = (atlasSubjectsQuery.data?.data ?? []).filter(
                                            subject => !selectedSubjectCodes.includes(subject.code) || subject.code === field.value
                                          );
                                          
                                          return (
                                            <FormItem className="relative">
                                              <FormControl>
                                                <div className={cn("relative flex items-center w-full", fieldState.error && "border-destructive")}>
                                                  <Select onValueChange={field.onChange} value={field.value || ""}>
                                                    <SelectTrigger 
                                                      className={cn("w-full font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")}
                                                      disabled={atlasSubjectsQuery.isLoading || atlasSubjectsQuery.isError || (atlasSubjectsQuery.data?.data.length ?? 0) === 0}
                                                    >
                                                      <SelectValue placeholder="Search subject..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {availableSubjects.map((subject) => (
                                                        <SelectItem key={subject.code} value={subject.code} className="font-bold">
                                                          {subject.name}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </FormControl>
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    </div>
                                    <div className="col-span-4 relative flex items-start gap-2">
                                      <FormField
                                        control={form.control}
                                        name={`conditionalSubjects.${index}.grade`}
                                        render={({ field, fieldState }) => (
                                          <FormItem className="flex-1 relative">
                                            <FormControl>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <div className="relative">
                                                      <Input
                                                        {...field}
                                                        type="number"
                                                        min={60}
                                                        max={75}
                                                        maxLength={2}
                                                        placeholder="Rating"
                                                        className={cn(
                                                          "font-bold pr-8",
                                                          fieldState.error && "border-destructive focus-visible:ring-destructive"
                                                        )}
                                                        value={field.value || ""}
                                                      />
                                                      {fieldState.error && (
                                                        <AlertCircle className="w-4 h-4 text-destructive absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                      )}
                                                    </div>
                                                  </TooltipTrigger>
                                                  {fieldState.error && (
                                                    <TooltipContent side="top" className="bg-destructive text-destructive-foreground font-bold text-xs">
                                                      Grade must be between 60-75
                                                    </TooltipContent>
                                                  )}
                                                </Tooltip>
                                              </TooltipProvider>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                      {index > 0 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                                          onClick={() => removeConditionalSubject(index)}
                                        >
                                          <span className="text-xl leading-none">&times;</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {conditionalSubjectFields.length < 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground font-bold hover:text-foreground mt-2"
                                onClick={() => appendConditionalSubject({ subjectCode: "", grade: "" as unknown as number })}
                              >
                                <Plus className="w-4 h-4 mr-2" /> Add Second Subject
                              </Button>
                            )}

                            {gradeLevelId <= 0 || !assignedProgram ? (
                              <p className="text-sm text-foreground mt-4">
                                Select the learner&apos;s incoming grade level and curriculum first.
                              </p>
                            ) : atlasSubjectsQuery.isLoading ? (
                              <div className="flex items-center gap-2 text-sm text-foreground mt-4">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                Loading Grade {gradeLevelId - 1} subjects from ATLAS...
                              </div>
                            ) : atlasSubjectsQuery.isError ? (
                              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 mt-4">
                                <p className="text-sm font-bold text-destructive">
                                  {getWalkInErrorMessage(atlasSubjectsQuery.error, "ATLAS subjects could not be loaded.")}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void atlasSubjectsQuery.refetch()}
                                >
                                  Retry
                                </Button>
                              </div>
                            ) : (atlasSubjectsQuery.data?.data.length ?? 0) === 0 ? (
                              <p className="text-sm text-amber-800 mt-4">
                                ATLAS returned no Grade {gradeLevelId - 1} subjects for the selected curriculum.
                              </p>
                            ) : null}
                            <p className="text-sm">
                              ATLAS subjects are filtered for the grade immediately before the learner&apos;s incoming grade and the selected curriculum.
                            </p>
                            
                            {/* Display array-level errors directly from formState */}
                            {form.formState.errors.conditionalSubjects?.root?.message && (
                              <p className="text-[0.8rem] font-medium text-destructive">
                                {form.formState.errors.conditionalSubjects.root.message}
                              </p>
                            )}
                            {form.formState.errors.conditionalSubjects?.message && typeof form.formState.errors.conditionalSubjects.message === 'string' && (
                              <p className="text-[0.8rem] font-medium text-destructive">
                                {form.formState.errors.conditionalSubjects.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* EMERGENCY CONTACT BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        Emergency Contact
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 font-bold">
                          <FormField
                            control={form.control}
                            name="guardianFirstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">First Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. MARIA" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianMiddleName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Middle Name</FormLabel>
                                <FormControl><Input placeholder="e.g. SANTOS" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianLastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Last Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. DELA CRUZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="guardianContact"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Contact Number <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-bold"
                                    placeholder="e.g. 09123456789"
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                      field.onChange(val);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianRelationship"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Relationship to Learner <span className="text-destructive">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                  <FormControl>
                                    <SelectTrigger className="font-bold uppercase">
                                      <SelectValue placeholder="SELECT RELATIONSHIP" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="MOTHER" className="font-bold uppercase">Mother</SelectItem>
                                    <SelectItem value="FATHER" className="font-bold uppercase">Father</SelectItem>
                                    <SelectItem value="GUARDIAN" className="font-bold uppercase">Guardian</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CHECKLIST */}
                  <div className="w-full p-4 sm:p-5 border border-border rounded-xl flex flex-col gap-5 bg-card shadow-sm">
                    <h4 className="flex items-center gap-2 text-base font-bold  uppercase tracking-wide">
                      <FileCheck className="w-4 h-4 text-primary" />
                      Required Documents
                    </h4>

                    <FormField
                      control={form.control}
                      name="hasSf9"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              id="sf9-checkbox"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1 h-5 w-5 rounded-sm border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor="sf9-checkbox" className="text-base font-bold text-foreground cursor-pointer select-none">
                              Physical SF9 Verified
                            </label>
                            <span className="text-sm text-foreground leading-snug">
                              Original report card signed by previous school principal.
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hasPsa"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              id="psa-checkbox"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1 h-5 w-5 rounded-sm border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor="psa-checkbox" className="text-base font-bold text-foreground cursor-pointer select-none">
                              PSA Birth Certificate Verified
                            </label>
                            <span className="text-sm text-foreground leading-snug">
                              Clear copy of Philippine Statistics Authority issued certificate.
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* SECTION ASSIGNMENT BLOCK */}
                  <div className="w-full p-4 sm:p-5 border border-border rounded-xl flex flex-col gap-5 bg-card shadow-sm">
                    <h4 className="flex items-center gap-2 text-base font-bold uppercase tracking-wide">
                      <FileCheck className="w-4 h-4 text-primary" />
                      Section Assignment
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="sectionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold capitalize">Section (Optional)</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "UNASSIGNED" ? undefined : Number(val))}
                            value={field.value ? String(field.value) : "UNASSIGNED"}
                            disabled={!gradeLevelId || !assignedProgram || sectionsQuery.isLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="font-bold uppercase">
                                <SelectValue placeholder={!gradeLevelId || !assignedProgram ? "SELECT GRADE LEVEL FIRST" : sectionsQuery.isLoading ? "LOADING SECTIONS..." : "AUTO-ASSIGN SECTION (UNSECTIONED POOL)"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="UNASSIGNED">AUTO-ASSIGN SECTION (UNSECTIONED POOL)</SelectItem>
                              {sectionsQuery.data?.map((sec) => (
                                <SelectItem key={sec.id} value={String(sec.id)} disabled={sec.enrolledCount >= sec.maxCapacity} className="font-bold uppercase">
                                  {sec.name} {sec.enrolledCount >= sec.maxCapacity ? "(FULL)" : `(${sec.enrolledCount}/${sec.maxCapacity})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-foreground leading-snug">
                            Selecting a section will immediately enroll this learner in that section.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-border grid grid-cols-2 gap-3 shrink-0">
                <Button
                  variant="outline"
                  type="button"
                  onClick={requestClosePanel}
                  disabled={isSubmitting}
                  className="w-full font-bold uppercase text-base border-border px-6 cursor-pointer bg-background text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={`w-full font-bold uppercase text-base px-6 ${(!isValid || isSubmitting)
                    ? 'bg-muted text-foreground cursor-not-allowed'
                    : isCompleteDocs
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                      : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                    }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4  mr-2" />
                  ) : (
                    isCompleteDocs ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />
                  )}
                  {isCompleteDocs ? "Save & Officially Enroll" : "Save as Temporary"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
