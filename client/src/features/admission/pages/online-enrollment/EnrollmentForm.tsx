import { useCallback, useEffect, useState } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EnrollmentFormSchema, type EnrollmentFormData } from "./types";

import Step1Personal from "./components/Step1Personal";
import Step2Family from "./components/Step2Family";
import Step3Background from "./components/Step3Background";
import Step4PreviousSchool from "./components/Step4PreviousSchool";
import Step5Enrollment from "./components/Step5Preferences";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { ArrowLeft, AlertCircle, ShieldCheck, Info } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toUpperCaseRecursive } from "@/shared/lib/utils";
import { sileo } from "sileo";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";
import {
  useUnsavedChanges,
  useUnsavedChangesPrompt,
} from "@/shared/hooks/useUnsavedChanges";

const DRAFT_KEY = "enrollpro_enrollment_draft";

const DEFAULT_VALUES = {
  schoolYear: "2026-2027",
  isPrivacyConsentGiven: true,
  studentPhoto: undefined,
  gradeLevel: "7",
  hasNoLrn: false,
  isIpCommunity: false,
  is4PsBeneficiary: false,
  isBalikAral: false,
  isLearnerWithDisability: false,
  isPermanentSameAsCurrent: true,
  isScpApplication: false,
  learnerType: "NEW_ENROLLEE",
  hasNoMother: false,
  hasNoFather: false,
  isCertifiedTrue: false,
  hasScpFallbackConsent: false,
  hasSf9Deficiency: false,
} as const;

type ValidationIssue = {
  fieldPath: string;
  fieldLabel: string;
  message: string;
};

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  lrn: "Learner Reference Number (LRN)",
  hasNoLrn: "No LRN Declaration",
  psaBirthCertNumber: "PSA Birth Certificate Number",
  ipGroupName: "IP Group Name",
  householdId4Ps: "4Ps Household ID",
  primaryContact: "Primary Contact",
  contactNumber: "Contact Number",
  guardianRelationship: "Guardian Relationship",
  lastSchoolName: "Name of Last School Attended",
  lastSchoolId: "DepEd School ID",
  lastGradeCompleted: "Last Grade Level Completed",
  schoolYearLastAttended: "School Year Last Attended",
  lastSchoolType: "Type of Last School",
  lastSchoolAddress: "School Address / Division",
  generalAverage: "Final General Average (SF9)",
  scpType: "SCP Track",
  sportsList: "Preferred Sports",
  artField: "Art Field",
  isCertifiedTrue: "Certification",
  intakeHeightCm: "Height (in cm)",
  intakeWeightKg: "Weight (in kg)",
};

function getFieldLabel(fieldPath: string): string {
  const override = FIELD_LABEL_OVERRIDES[fieldPath];
  if (override) {
    return override;
  }

  return fieldPath
    .split(".")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(" - ");
}

function extractErrorMessages(
  errorValue: unknown,
  currentPath = "",
): Array<{ fieldPath: string; message: string }> {
  if (!errorValue || typeof errorValue !== "object") {
    return [];
  }

  const errorObject = errorValue as Record<string, unknown>;
  const maybeMessage = errorObject.message;
  const messages: Array<{ fieldPath: string; message: string }> = [];

  if (typeof maybeMessage === "string" && maybeMessage.trim()) {
    messages.push({
      fieldPath: currentPath,
      message: maybeMessage.trim(),
    });
  }

  for (const [key, value] of Object.entries(errorObject)) {
    if (
      key === "message" ||
      key === "type" ||
      key === "ref" ||
      key === "types"
    ) {
      continue;
    }

    const nestedPath = currentPath ? `${currentPath}.${key}` : key;
    messages.push(...extractErrorMessages(value, nestedPath));
  }

  return messages;
}

type EnrollmentSubmitSuccessPayload = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
  | "assessmentData"
> & { learnerName?: string };

export default function EnrollmentForm({
  onSuccess,
  onBack,
}: {
  onSuccess?: (data: EnrollmentSubmitSuccessPayload) => void;
  onBack?: () => void;
}) {
  const [initialDraft] = useState(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.birthdate) parsed.birthdate = new Date(parsed.birthdate);
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [hasActiveDraft, setHasActiveDraft] = useState(Boolean(initialDraft));
  const { confirmOrRun } = useUnsavedChangesPrompt();

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<"new" | "update" | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState("");

  const methods = useForm<EnrollmentFormData, unknown, EnrollmentFormData>({
    resolver: zodResolver(
      EnrollmentFormSchema,
    ) as import("react-hook-form").Resolver<EnrollmentFormData>,
    defaultValues: initialDraft || {
      ...DEFAULT_VALUES,
    },
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const { handleSubmit, trigger, reset, watch, control, formState: { errors, isDirty } } = methods;

  const validationIssues: ValidationIssue[] = Array.from(
    new Map(
      Object.entries(errors)
        .flatMap(([fieldPath, errorValue]) =>
          extractErrorMessages(errorValue, fieldPath),
        )
        .map((issue) => [`${issue.fieldPath}|${issue.message}`, issue]),
    ).values(),
  ).map((issue) => {
    return {
      fieldPath: issue.fieldPath,
      fieldLabel: getFieldLabel(issue.fieldPath),
      message: issue.message,
    };
  });

  const scrollToTopInstant = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  // Auto-save draft on every change
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      // Only save if a specific field was changed by the user
      if (name) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
        setHasActiveDraft(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const discardEnrollmentDraft = useCallback(() => {
    reset({
      ...DEFAULT_VALUES,
    });
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem("enrollpro_apply_consent");
    setHasActiveDraft(false);
    setSubmitError("");
  }, [reset]);

  useUnsavedChanges({
    id: "public-online-enrollment",
    label: "Online enrollment form",
    isDirty: hasActiveDraft || isDirty,
    isSubmitting,
    onDiscard: discardEnrollmentDraft,
  });

  const goToValidationIssue = (issue: ValidationIssue) => {
    if (!issue.fieldPath) {
      scrollToTopInstant();
      return;
    }

    const target = document.getElementsByName(issue.fieldPath).item(0);

    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    } else {
      scrollToTopInstant();
    }
  };

  const handleAttemptSubmit = async () => {
    const isValid = await trigger();
    if (isValid) {
      void handleSubmit(onSubmit)();
    } else {
      scrollToTopInstant();
    }
  };

  const onSubmit = async (data: EnrollmentFormData) => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const uppercaseData = toUpperCaseRecursive(data);

      const {
        contactNumber,
        primaryContact,
        guardianRelationship,
        hasExecutedAffidavit: _hasExecutedAffidavit,
        ...payloadBase
      } = uppercaseData as EnrollmentFormData & {
        contactNumber: string;
        primaryContact: "MOTHER" | "FATHER" | "GUARDIAN";
        hasExecutedAffidavit?: boolean;
        guardianRelationship?: string;
      };

      void _hasExecutedAffidavit;

      const mother = { ...payloadBase.mother };
      const father = { ...payloadBase.father };
      const guardian = payloadBase.guardian
        ? { ...payloadBase.guardian }
        : null;

      if (primaryContact === "MOTHER") {
        mother.contactNumber = contactNumber;
      }

      if (primaryContact === "FATHER") {
        father.contactNumber = contactNumber;
      }

      if (primaryContact === "GUARDIAN" && guardian) {
        guardian.contactNumber = contactNumber;
      }

      if (guardian && guardianRelationship?.trim()) {
        guardian.relationship = guardianRelationship;
      }

      const hasGuardianData =
        guardian !== null &&
        [
          guardian.firstName,
          guardian.lastName,
          guardian.middleName,
          guardian.contactNumber,
          guardian.relationship,
        ].some((value) => String(value ?? "").trim().length > 0);

      const normalizedLrn = data.hasNoLrn
        ? null
        : String(data.lrn ?? "").trim() || null;


      const payload = {
        ...payloadBase,
        lrn: normalizedLrn,

        mother,
        father,
        guardian: hasGuardianData ? guardian : null,
        birthdate:
          data.birthdate instanceof Date
            ? data.birthdate.toISOString()
            : data.birthdate,
        permanentAddress: uppercaseData.isPermanentSameAsCurrent
          ? uppercaseData.currentAddress
          : uppercaseData.permanentAddress,
      };

      const response = await api.post<ApplicationSubmitResponse>(
        "/applications",
        payload,
      );

      sileo.success({
        title: "Enrollment Form Submitted!",
        description: `Your tracking number is ${response.data.trackingNumber}.`,
      });

      if (onSuccess) {
        const responseData = response.data;

        onSuccess({
          trackingNumber: responseData.trackingNumber,
          applicantType: responseData.applicantType,
          programType: responseData.programType,
          status: responseData.status,
          currentStep: responseData.currentStep,
          assessmentData: responseData.assessmentData,
          learnerName: `${data.firstName} ${data.lastName}`,
        });
      }

      // Reset form
      reset({
        ...DEFAULT_VALUES,
      });

      // Clear session storage
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem("enrollpro_apply_consent");
      setHasActiveDraft(false);
    } catch (error: unknown) {
      const responseData = (
        error as {
          response?: {
            data?: {
              message?: string;
              errors?: Record<string, string[]>;
              duplicate_detected?: boolean;
            };
          };
        }
      )?.response?.data;

      const responseStatus = (error as any)?.response?.status;

      let message =
        responseData?.message ||
        "Failed to submit application. Please try again.";

      if (responseStatus === 409 && responseData?.duplicate_detected) {
        setDuplicateModalOpen(true);
        setIsSubmitting(false);
        setIsConfirmDialogOpen(false);
        return;
      }

      if (
        responseData?.message === "Validation failed" &&
        responseData.errors
      ) {
        // Zod format: { _errors: [], field: { _errors: ["msg"] } }
        const extractFirstError = (errorsObj: any): { path: string, msg: string } | null => {
          if (!errorsObj || typeof errorsObj !== 'object') return null;
          if (Array.isArray(errorsObj._errors) && errorsObj._errors.length > 0) {
            return { path: "_root", msg: errorsObj._errors[0] };
          }
          for (const [key, value] of Object.entries(errorsObj)) {
            if (key === "_errors") continue;
            if (value && typeof value === 'object') {
              if (Array.isArray((value as any)._errors) && (value as any)._errors.length > 0) {
                return { path: key, msg: (value as any)._errors[0] };
              }
              const nested = extractFirstError(value);
              if (nested) return { path: `${key}.${nested.path}`, msg: nested.msg };
            }
          }
          return null;
        };

        const firstError = extractFirstError(responseData.errors);
        if (firstError) {
          const readableField =
            firstError.path === "_root" || firstError.path.endsWith("._root") ? "Request" : getFieldLabel(firstError.path.split('.')[0]);
          message = `${readableField}: ${firstError.msg}`;
        }
      }

      setSubmitError(message);
      scrollToTopInstant();
    } finally {
      setIsSubmitting(false);
      setIsConfirmDialogOpen(false);
    }
  };

  return (
<div className="max-w-6xl mx-auto p-4 md:p-0">
      {onBack && (
        <Button
          onClick={() => confirmOrRun(onBack)}
          className="mb-6 group font-extrabold uppercase bg-primary text-white hover:bg-primary/90 shadow-md transition-all px-6">
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Selection
        </Button>
      )}

      {/* Duplicate Modal */}
      <Dialog open={duplicateModalOpen} onOpenChange={(open) => {
        if (!open) {
          setDuplicateModalOpen(false);
          setDuplicateAction(null);
          setTrackingNumberInput("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Existing Application Found</DialogTitle>
            <DialogDescription>
              We found an existing pending application for this Learner. Would you like to update the existing record or submit a new one?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {!duplicateAction ? (
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setDuplicateAction("update")}
                  className="w-full justify-start"
                  variant="outline"
                >
                  Update Existing Application
                </Button>
                <Button
                  onClick={() => {
                    setDuplicateAction("new");
                    setDuplicateModalOpen(false);
                    const data = methods.getValues();
                    void onSubmit({ ...data, bypassDuplicate: true } as any);
                  }}
                  className="w-full justify-start"
                  variant="default"
                >
                  Submit as New Application
                </Button>
              </div>
            ) : duplicateAction === "update" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Original Tracking Number</Label>
                  <Input
                    value={trackingNumberInput}
                    onChange={(e) => setTrackingNumberInput(e.target.value)}
                    placeholder="Enter Tracking Number (e.g., EN-26-XXXXXX)"
                  />
                  <p className="text-base text-muted-foreground">You can find this in the email sent or success screen from your original application.</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDuplicateAction(null)}>Back</Button>
                  <Button onClick={async () => {
                    if (!trackingNumberInput.trim()) {
                      sileo.error({ title: "Error", description: "Tracking number is required." });
                      return;
                    }
                    setDuplicateModalOpen(false);
                    setIsSubmitting(true);
                    setSubmitError("");
                    try {
                      const data = methods.getValues();
                      const uppercaseData = toUpperCaseRecursive(data);

                      const mother = { ...uppercaseData.mother };
                      const father = { ...uppercaseData.father };
                      const guardian = uppercaseData.guardian ? { ...uppercaseData.guardian } : null;

                      if (uppercaseData.primaryContact === "MOTHER") mother.contactNumber = uppercaseData.contactNumber;
                      if (uppercaseData.primaryContact === "FATHER") father.contactNumber = uppercaseData.contactNumber;
                      if (uppercaseData.primaryContact === "GUARDIAN" && guardian) guardian.contactNumber = uppercaseData.contactNumber;
                      if (guardian && uppercaseData.guardianRelationship?.trim()) guardian.relationship = uppercaseData.guardianRelationship;

                      const hasGuardianData = guardian !== null && [guardian.firstName, guardian.lastName, guardian.middleName, guardian.contactNumber, guardian.relationship].some((value) => String(value ?? "").trim().length > 0);

                      const payload = {
                        ...uppercaseData,
                        lrn: data.hasNoLrn ? null : String(data.lrn ?? "").trim() || null,
                        mother,
                        father,
                        guardian: hasGuardianData ? guardian : null,
                        birthdate: data.birthdate instanceof Date ? data.birthdate.toISOString() : data.birthdate,
                        permanentAddress: uppercaseData.isPermanentSameAsCurrent ? uppercaseData.currentAddress : uppercaseData.permanentAddress,
                        originalTrackingNumber: trackingNumberInput,
                      };

                      const response = await api.post<ApplicationSubmitResponse>("/applications/update-existing", payload);
                      sileo.success({
                        title: "Application Updated!",
                        description: `Your tracking number remains ${response.data.trackingNumber}.`,
                      });
                      if (onSuccess) {
                        onSuccess({
                          trackingNumber: response.data.trackingNumber,
                          applicantType: response.data.applicantType,
                          programType: response.data.programType,
                          status: response.data.status,
                          currentStep: response.data.currentStep,
                          assessmentData: response.data.assessmentData,
                          learnerName: `${data.firstName} ${data.lastName}`,
                        });
                      }
                      reset({ ...DEFAULT_VALUES });
                      localStorage.removeItem(DRAFT_KEY);
                      setHasActiveDraft(false);
                    } catch (error: any) {
                      setSubmitError(error.response?.data?.message || "Failed to update application.");
                      scrollToTopInstant();
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}>Confirm Update</Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm border-border rounded-2xl overflow-hidden mb-12">
        <CardContent className="p-6 md:p-10">
          <div className="mb-8 pb-6 border-b border-border/50">
            <div>
              <h2 className="text-xl font-extrabold  text-foreground leading-tight">
                Learner Enrollment Form
              </h2>
              <p className="text-base leading-tight text-foreground mt-0.5 font-bold">
                Please complete all required fields below.
              </p>
            </div>
          </div>

          {submitError && (
            <div className="mb-8 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-base leading-tight font-extrabold">
              {submitError}
            </div>
          )}

          <FormProvider {...methods}>
            <form onSubmit={(e) => { e.preventDefault(); setIsConfirmDialogOpen(true); }} className="space-y-16">

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-extrabold uppercase text-primary">I. Personal Information</h3>
                </div>
                <Step1Personal />
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-extrabold uppercase text-primary">II. Family Information</h3>
                </div>
                <Step2Family />
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-extrabold uppercase text-primary">III. Background & Special Categories</h3>
                </div>
                <Step3Background />
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-extrabold uppercase text-primary">IV. Enrollment Preferences</h3>
                </div>
                <Step5Enrollment />
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-extrabold uppercase text-primary">V. Previous School</h3>
                </div>
                <Step4PreviousSchool />
              </div>

              {validationIssues.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 mt-8">
                  <div className="flex items-center gap-2 text-destructive font-extrabold text-base leading-tight">
                    <AlertCircle className="w-4 h-4" />
                    Please review and complete the following fields to proceed:
                  </div>
                  <ul className="list-disc pl-6 text-base font-extrabold text-destructive space-y-1">
                    {validationIssues.map((issue, index) => (
                      <li key={`${issue.fieldPath}-${index}`}>
                        <a
                          href={`#${issue.fieldPath}`}
                          data-unsaved-guard-ignore="true"
                          onClick={(event) => {
                            event.preventDefault();
                            goToValidationIssue(issue);
                          }}
                          className="underline underline-offset-2 text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40 rounded-sm"
                          aria-label={`Fix field ${issue.fieldLabel}`}>
                          {issue.fieldLabel}: {issue.message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-8 border-t border-border/60 space-y-6">
                <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <h3 className="text-base leading-tight font-extrabold uppercase  text-primary">
                      Accuracy Certification
                    </h3>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Controller
                      control={control}
                      name="isCertifiedTrue"
                      render={({ field }) => (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="certify-check"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1"
                            />
                            <Label
                              htmlFor="certify-check"
                              className="text-base font-extrabold leading-relaxed cursor-pointer select-none space-y-3 block">
                              <p>
                                I certify that all information in this enrollment form
                                is true, correct, and complete to the best of my
                                knowledge. I understand that false information may
                                affect the learner&apos;s enrollment processing.
                              </p>
                            </Label>
                          </div>
                          {errors.isCertifiedTrue?.message && (
                            <p className="text-sm text-destructive font-extrabold pl-14">
                              {errors.isCertifiedTrue.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <Button
                    type="button"
                    className="w-full h-14 text-lg font-extrabold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                    disabled={isSubmitting}
                    onClick={async () => {
                      const isValid = await trigger();
                      if (isValid) {
                        setIsConfirmDialogOpen(true);
                      } else {
                        scrollToTopInstant();
                      }
                    }}>
                    Submit Registration
                  </Button>
                  <p className="text-base text-foreground flex items-center gap-1.5 font-extrabold italic">
                    <Info className="w-3.5 h-3.5" />
                    Privacy consent was recorded before this submission.
                  </p>
                </div>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setIsConfirmDialogOpen(open);
          }
        }}
        title="Confirm Enrollment Submission"
        description="You are about to submit this online enrollment form. Please confirm all details are complete and accurate."
        onConfirm={handleAttemptSubmit}
        confirmText="Yes, Submit Application"
        loading={isSubmitting}
        variant="primary"
      />
    </div>
  );
}
