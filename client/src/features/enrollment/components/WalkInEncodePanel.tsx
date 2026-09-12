import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@/shared/lib/zodResolver";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import { sileo } from "sileo";
import { isAxiosError } from "axios";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
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

import { Loader2, Plus, Search, User, FileText, Phone, FileCheck, Mars, Venus, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import api from "@/shared/api/axiosInstance";
import { directEncodeWalkInSchema, type DirectEncodeWalkInPayload } from "@enrollpro/shared";

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
  const queryClient = useQueryClient();
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore();
  const { panelPercentage, isDesktopViewport, startResizing } = useResizablePanel();

  const programOptions = [
    { val: "REGULAR", label: "BEC" },
    ...(steEnabled ? [{ val: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" }] : []),
    ...(spaEnabled ? [{ val: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" }] : []),
    ...(spsEnabled ? [{ val: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" }] : []),
  ];

  const { data: activeSchoolYear } = useQuery({
    queryKey: ["schoolYear", "grade-levels"],
    queryFn: async () => {
      const res = await api.get<ActiveSchoolYearGradeLevelsResponse>("/school-years/grade-levels");
      return res.data;
    },
  });

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
      conditionalSubjects: [{ subjectCode: "", grade: "" as unknown as number }],
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
    if (searchParams.get("action") === "walk-in") {
      setOpen(true);
    }
  }, [searchParams]);

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
          conditionalSubjects: [{ subjectCode: "", grade: "" as unknown as number }],
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="h-11 px-6 text-base font-bold gap-2">
          <Plus className="w-5 h-5" />
          Encode Walk-In
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="p-0 flex flex-col h-full border-l overflow-visible w-full sm:w-auto sm:max-w-none"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
        }
      >
        {/* Resize Handle — hidden on mobile */}
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          {/* ─── Header ─── */}
          <SheetHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-bold text-left space-y-0 mt-0">
            <div>
              <SheetTitle className="text-base sm:text-lg text-primary-foreground font-bold uppercase flex items-center gap-2">
                Walk-In Learner Enrollment
              </SheetTitle>
            </div>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0" autoComplete="off">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">

                <div className="space-y-4">
                  {/* LEARNER PROFILE BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-bold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
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

                        <div className="grid grid-cols-3 gap-4 font-bold">
                          <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold">First Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. JUAN" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="middleName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold">Middle Name</FormLabel>
                                <FormControl><Input placeholder="e.g. PEREZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold">Last Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. DELA CRUZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="birthdate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold">Birthdate <span className="text-destructive">*</span></FormLabel>
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
                                <FormLabel className="font-bold">Sex <span className="text-destructive">*</span></FormLabel>
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

                        <FormField
                          control={form.control}
                          name="gradeLevelId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold">Incoming Grade Level <span className="text-destructive">*</span></FormLabel>
                              <div className="grid grid-cols-4 gap-4">
                                {activeSchoolYear?.gradeLevels?.map((gl) => (
                                  <button
                                    key={gl.id}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(gl.id);
                                      replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                    }}
                                    className={cn(
                                      "flex items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === gl.id
                                        ? getGradeLevelBadgeStyles(gl.name) + " border-current"
                                        : "border-border hover:bg-muted/50 text-foreground"
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
                              <FormLabel className="font-bold">Curriculum Type <span className="text-destructive">*</span></FormLabel>
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

                  {/* PREVIOUS SCHOOL BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-bold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
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
                              <FormLabel className="font-bold">
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
                                <FormLabel className="font-bold">Originating School ID <span className="text-destructive">*</span></FormLabel>
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
                                  <FormLabel className="font-bold">Transfer Certificate No.</FormLabel>
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
                                <FormLabel className="font-bold">Final Gen Ave</FormLabel>
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
                              <FormLabel className="font-bold">SF9 Eligibility Status <span className="text-destructive">*</span></FormLabel>
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
                    <div className="px-5 py-4 font-bold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
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
                                <FormLabel className="font-bold">First Name <span className="text-destructive">*</span></FormLabel>
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
                                <FormLabel className="font-bold">Middle Name</FormLabel>
                                <FormControl><Input placeholder="e.g. SANTOS" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianLastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold">Last Name <span className="text-destructive">*</span></FormLabel>
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
                                <FormLabel className="font-bold">Contact Number <span className="text-destructive">*</span></FormLabel>
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
                                <FormLabel className="font-bold">Relationship to Learner <span className="text-destructive">*</span></FormLabel>
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
      </SheetContent>
    </Sheet>
  );
}
