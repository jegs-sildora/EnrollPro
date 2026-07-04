import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import { sileo } from "sileo";
import { isAxiosError } from "axios";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

import { Loader2, Plus, Search, User, FileText, Phone, CheckCircle2, AlertCircle, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [noLrn, setNoLrn] = useState(false);
  const queryClient = useQueryClient();

  const { data: activeSchoolYear } = useQuery({
    queryKey: ["schoolYear", "grade-levels"],
    queryFn: async () => {
      const res = await api.get<ActiveSchoolYearGradeLevelsResponse>("/school-year/grade-levels");
      return res.data;
    },
  });

  const form = useForm<DirectEncodeWalkInPayload>({
    resolver: zodResolver(directEncodeWalkInSchema) as Resolver<DirectEncodeWalkInPayload>,
    defaultValues: {
      lrn: "",
      firstName: "",
      lastName: "",
      middleName: "",
      birthdate: "",
      sex: "MALE",
      gradeLevelId: 0,
      assignedProgram: "REGULAR",
      previousSchoolName: "",
      previousGenAve: undefined,
      guardianName: "",
      guardianContact: "",
      hasSf9: false,
      hasPsa: false,
    },
  });
  const { isDirty, isSubmitting } = form.formState;

  const handleLrnLookup = async (lrn: string) => {
    if (lrn.length !== 12) return;

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
        form.setValue("previousSchoolName", data.previousSchool.schoolName);
        if (data.previousSchool.generalAverage) {
          form.setValue("previousGenAve", data.previousSchool.generalAverage);
        }
      }
      if (data.familyMembers && data.familyMembers.length > 0) {
        const primary = data.familyMembers[0];
        form.setValue("guardianName", `${primary.firstName} ${primary.lastName}`.trim());
        if (primary.contactNumber) {
          form.setValue("guardianContact", primary.contactNumber);
        }
      }

      sileo.success({ title: "Learner Found", description: "Profile auto-populated." });
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        // Just silent for 404, it's a new learner. Or maybe a tiny toast.
        // sileo.info("New Learner", "No existing record found.");
      } else {
        sileo.error({ title: "Lookup Failed", description: "Could not fetch learner data." });
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const resetPanelState = () => {
    form.reset();
    setNoLrn(false);
  };

  const closePanel = () => {
    resetPanelState();
    setOpen(false);
  };

  const requestClosePanel = () => {
    if (isDirty) {
      setShowDiscardModal(true);
      return;
    }
    closePanel();
  };

  const onSubmit = async (values: DirectEncodeWalkInPayload) => {
    const payload = {
      ...values,
      firstName: values.firstName?.toUpperCase(),
      lastName: values.lastName?.toUpperCase(),
      middleName: values.middleName?.toUpperCase(),
      previousSchoolName: values.previousSchoolName?.toUpperCase(),
      guardianName: values.guardianName?.toUpperCase(),
    };
    try {
      await api.post("/enrollment/walk-in", payload);
      sileo.success({
        title: "Successfully Encoded",
        description: "Learner routed directly to unassigned sectioning pool.",
      });
      closePanel();
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
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
    }
  };

  const hasSf9 = form.watch("hasSf9");
  const hasPsa = form.watch("hasPsa");
  const isCompleteDocs = hasSf9 && hasPsa;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="h-11 px-6 text-base font-extrabold gap-2">
          <Plus className="w-5 h-5" />
          Encode Walk-In
        </Button>
      </SheetTrigger>
      <SheetContent
        showClose={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="p-0 flex flex-col h-full overflow-hidden"
      >
        <div className="bg-primary px-6 py-5 relative shrink-0 border-b border-border shadow-sm flex items-center justify-between">
          <div className="flex items-center min-h-14">
            <div className="space-y-0.5">
              <SheetTitle className="text-base font-extrabold text-primary-foreground uppercase leading-none">
                Walk-In Direct Encode
              </SheetTitle>
              <SheetDescription className="text-base font-extrabold text-primary-foreground/80 uppercase tracking-wide flex items-center gap-1.5 mt-1.5">
                Bypass verification and enter Unassigned Pool
              </SheetDescription>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={requestClosePanel}
            className="size-10 shrink-0 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            aria-label="Close late enrollee panel"
          >
            <X className="size-5" />
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0" autoComplete="off">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">

              <div className="space-y-4">
                {/* LEARNER PROFILE BLOCK */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      1. Learner Profile
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <div className="space-y-4">

                      <FormField
                        control={form.control}
                        name="lrn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex justify-between">
                              <span>Learner Reference Number (LRN)</span>
                              {isLookingUp && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="12-digit LRN"
                                  disabled={noLrn}
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
                                    if (value.length === 12) {
                                      handleLrnLookup(value);
                                    }
                                  }}
                                />
                                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                        <label htmlFor="noLrn" className="text-base  leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600">
                          Learner has no LRN yet
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-4 font-extrabold">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl><Input placeholder="e.g. JUAN" className="uppercase" {...field} value={field.value || ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl><Input placeholder="e.g. DELA CRUZ" className="uppercase" {...field} value={field.value || ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="middleName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Middle Name</FormLabel>
                              <FormControl><Input placeholder="e.g. PEREZ" className="uppercase" {...field} value={field.value || ""} /></FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="birthdate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Birthdate</FormLabel>
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
                              <FormLabel>Sex</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="MALE">Male</SelectItem>
                                  <SelectItem value="FEMALE">Female</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="gradeLevelId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Incoming Grade Level</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(Number(value))}
                                value={field.value > 0 ? field.value.toString() : undefined}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Grade" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {activeSchoolYear?.gradeLevels?.map((gl) => (
                                    <SelectItem key={gl.id} value={gl.id.toString()}>{gl.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="assignedProgram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Assigned Program</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Program" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="REGULAR">Regular</SelectItem>
                                  <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING">STE</SelectItem>
                                  <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS">SPA</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PREVIOUS SCHOOL BLOCK */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      2. Previous School Data
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="previousSchoolName"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>School Name</FormLabel>
                            <FormControl><Input placeholder="e.g. RIZAL ELEM. SCHOOL" className="uppercase" {...field} value={field.value || ""} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="previousGenAve"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Final General Average</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 85.50"
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                  );
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
                  </div>
                </div>

                {/* EMERGENCY CONTACT BLOCK */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      3. Emergency Contact
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="guardianName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parent/Guardian Name</FormLabel>
                            <FormControl><Input placeholder="e.g. MARIA DELA CRUZ" className="uppercase" {...field} value={field.value || ""} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="guardianContact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input
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
                    </div>
                  </div>
                </div>

                {/* CHECKLIST */}
                <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-amber-900 bg-amber-100/50 border-b border-amber-200/50">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      4. Document Checklist
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <p className="text-base text-amber-700 mb-4 mt-2">Leave unchecked if missing. Learner will be temporarily enrolled.</p>
                    <div className="space-y-2">

                      <FormField
                        control={form.control}
                        name="hasSf9"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-amber-100 rounded-lg transition-colors">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <Label className="font-semibold cursor-pointer">SF9 (Report Card) Submitted</Label>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hasPsa"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-amber-100 rounded-lg transition-colors">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <Label className="font-semibold cursor-pointer">PSA Birth Certificate Submitted</Label>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/10 border-t border-border flex gap-3 shrink-0 justify-end sm:flex-row">
              <Button
                variant="outline"
                type="button"
                onClick={requestClosePanel}
                disabled={isSubmitting}
                className="font-extrabold uppercase text-base border-border px-6 cursor-pointer bg-background text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`font-extrabold uppercase text-base px-6 cursor-pointer ${isCompleteDocs ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  isCompleteDocs ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />
                )}
                {isCompleteDocs ? "Save & Officially Enroll" : "Save as Temporary"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>

      <ConfirmationModal
        open={showDiscardModal}
        onOpenChange={setShowDiscardModal}
        title="Discard Unsaved Changes?"
        description="Are you sure you want to discard this encoding session? Unsaved data will be lost."
        confirmText="Discard Changes"
        variant="danger"
        onConfirm={() => {
          setShowDiscardModal(false);
          form.reset();
          setNoLrn(false);
          setOpen(false);
        }}
      />
    </Sheet>
  );
}
