import { useEffect, useState } from "react";
import { useForm, FormProvider, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStepper, steps } from "./stepper";
import { EnrollmentFormSchema, type EnrollmentFormData } from "./types";

import Step1Personal from "./components/Step1Personal";
import Step2Family from "./components/Step2Family";
import Step3Background from "./components/Step3Background";
import Step4PreviousSchool from "./components/Step4PreviousSchool";
import Step5Enrollment from "./components/Step5Preferences";
import Step6Review from "./components/Step6Review";
import StepProgressBar from "./components/StepProgressBar";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toUpperCaseRecursive } from "@/shared/lib/utils";
import { sileo } from "sileo";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";

const DRAFT_KEY = "enrollpro_enrollment_draft";
const STEP_KEY = "enrollpro_enrollment_step";
const MAX_STEP_KEY = "enrollpro_enrollment_max_step";
const EDITING_KEY = "enrollpro_enrollment_editing";

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
  isContactInfoConfirmed: false,
  isCertifiedTrue: false,
} as const;

type StepId = (typeof steps)[number]["id"];

type ValidationIssue = {
  fieldPath: string;
  fieldLabel: string;
  message: string;
  stepId: StepId;
  stepTitle: string;
  stepNumber: number;
};

const PREVIOUS_SCHOOL_FIELDS = new Set([
  "lastSchoolName",
  "lastSchoolId",
  "lastGradeCompleted",
  "schoolYearLastAttended",
  "lastSchoolAddress",
  "lastSchoolType",
  "generalAverage",
]);

const PREFERENCES_FIELDS = new Set([
  "gradeLevel",
  "isScpApplication",
  "scpType",
  "artField",
  "sportsList",
  "foreignLanguage",
  "learnerType",
  "learningModalities",
]);

const BACKGROUND_FIELDS = new Set([
  "isIpCommunity",
  "ipGroupName",
  "is4PsBeneficiary",
  "householdId4Ps",
  "isBalikAral",
  "lastYearEnrolled",
  "lastGradeLevel",
  "isLearnerWithDisability",
  "specialNeedsCategory",
  "disabilityTypes",
  "hasPwdId",
  "snedPlacement",
]);

const REVIEW_FIELDS = new Set([
  "isCertifiedTrue",
  "parentGuardianSignature",
  "dateAccomplished",
  "isPrivacyConsentGiven",
]);

const FAMILY_SCALAR_FIELDS = new Set([
  "isPermanentSameAsCurrent",
  "hasNoMother",
  "hasNoFather",
  "primaryContact",
  "contactNumber",
  "isContactInfoConfirmed",
  "guardianRelationship",
  "email",
]);

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  lrn: "Learner Reference Number (LRN)",
  hasNoLrn: "No LRN Declaration",
  psaBirthCertNumber: "PSA Birth Certificate Number",
  ipGroupName: "IP Group Name",
  householdId4Ps: "4Ps Household ID",
  primaryContact: "Primary Contact",
  contactNumber: "Contact Number",
  isContactInfoConfirmed: "Contact Details Confirmation",
  email: "Email Address",
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
  parentGuardianSignature: "Parent/Guardian Signature",
};

function getStepIdForField(fieldPath: string): StepId {
  const root = fieldPath.split(".")[0] ?? "";

  if (
    root === "currentAddress" ||
    root === "permanentAddress" ||
    root === "mother" ||
    root === "father" ||
    root === "guardian" ||
    FAMILY_SCALAR_FIELDS.has(root)
  ) {
    return "family";
  }

  if (PREVIOUS_SCHOOL_FIELDS.has(root)) {
    return "previousSchool";
  }

  if (PREFERENCES_FIELDS.has(root)) {
    return "preferences";
  }

  if (BACKGROUND_FIELDS.has(root)) {
    return "background";
  }

  if (REVIEW_FIELDS.has(root)) {
    return "review";
  }

  return "personal";
}

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
>;

export default function EnrollmentForm({
  onSuccess,
  onBack,
}: {
  onSuccess?: (data: EnrollmentSubmitSuccessPayload) => void;
  onBack?: () => void;
}) {
  const [initialDraft] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.birthdate) parsed.birthdate = new Date(parsed.birthdate);
        if (parsed.dateAccomplished)
          parsed.dateAccomplished = new Date(parsed.dateAccomplished);
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const stepper = useStepper({
    initialStep: (sessionStorage.getItem(STEP_KEY) ?? "personal") as
      | "personal"
      | "family"
      | "background"
      | "previousSchool"
      | "preferences"
      | "review",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isEditing, setIsEditing] = useState(false);

  const methods = useForm<EnrollmentFormData, unknown, EnrollmentFormData>({
    resolver: zodResolver(
      EnrollmentFormSchema,
    ) as import("react-hook-form").Resolver<EnrollmentFormData>,
    defaultValues: initialDraft || {
      ...DEFAULT_VALUES,
      dateAccomplished: new Date(),
    },
    mode: "onBlur",
  });

  const { handleSubmit, trigger, reset, watch } = methods;
  const currentStepId = stepper.state.current.data.id;

  const currentIndex = steps.findIndex((s) => s.id === currentStepId) + 1;

  const validationIssues: ValidationIssue[] = Array.from(
    new Map(
      Object.entries(methods.formState.errors)
        .flatMap(([fieldPath, errorValue]) =>
          extractErrorMessages(errorValue, fieldPath),
        )
        .map((issue) => [`${issue.fieldPath}|${issue.message}`, issue]),
    ).values(),
  ).map((issue) => {
    const stepId = getStepIdForField(issue.fieldPath);
    const stepIndex = steps.findIndex((step) => step.id === stepId);

    return {
      fieldPath: issue.fieldPath,
      fieldLabel: getFieldLabel(issue.fieldPath),
      message: issue.message,
      stepId,
      stepTitle: stepIndex >= 0 ? steps[stepIndex].title : "Review & Submit",
      stepNumber: stepIndex >= 0 ? stepIndex + 1 : steps.length,
    };
  });

  const scrollToTopInstant = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  // Track furthest step
  useEffect(() => {
    if (currentIndex > maxStepReached) {
      setMaxStepReached(currentIndex);
      sessionStorage.setItem(MAX_STEP_KEY, currentIndex.toString());
    }
  }, [currentIndex, maxStepReached]);

  // Clear editing mode when reaching review step
  useEffect(() => {
    if (currentStepId === "review") {
      setIsEditing(false);
      sessionStorage.removeItem(EDITING_KEY);
    }
  }, [currentStepId]);

  // Initial load of step meta
  useEffect(() => {
    const savedMax = sessionStorage.getItem(MAX_STEP_KEY);
    if (savedMax) {
      setMaxStepReached(parseInt(savedMax, 10));
    }

    const savedEditing = sessionStorage.getItem(EDITING_KEY);
    if (savedEditing === "true") {
      setIsEditing(true);
    }
  }, []);

  // Auto-save draft on every change (debounced)
  const allValues = watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (allValues.lastName || allValues.firstName || allValues.lrn) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(allValues));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [allValues]);

  // Save current step whenever it changes
  useEffect(() => {
    if (currentStepId) {
      sessionStorage.setItem(STEP_KEY, currentStepId);
    }
  }, [currentStepId]);

  // Keep each step mounted at the top
  useEffect(() => {
    scrollToTopInstant();
  }, [currentStepId]);

  const nextStep = async () => {
    let fieldsToValidate: FieldPath<EnrollmentFormData>[] = [];

    if (stepper.state.current.data.id === "personal") {
      fieldsToValidate = [
        "lastName",
        "firstName",
        "birthdate",
        "sex",
        "placeOfBirth",
        "lrn",
      ];
    } else if (stepper.state.current.data.id === "family") {
      fieldsToValidate = [
        "currentAddress.barangay",
        "currentAddress.cityMunicipality",
        "currentAddress.province",
        "mother.lastName",
        "mother.firstName",
        "father.lastName",
        "father.firstName",
        "primaryContact",
        "contactNumber",
        "email",
      ] as FieldPath<EnrollmentFormData>[];
    } else if (stepper.state.current.data.id === "previousSchool") {
      fieldsToValidate = [
        "lastSchoolName",
        "lastGradeCompleted",
        "schoolYearLastAttended",
        "lastSchoolType",
        "generalAverage",
      ];
    } else if (stepper.state.current.data.id === "preferences") {
      fieldsToValidate = ["gradeLevel", "learnerType"];
      if (watch("isScpApplication")) fieldsToValidate.push("scpType");
    }

    const isValid =
      fieldsToValidate.length > 0 ? await trigger(fieldsToValidate) : true;
    if (isValid) {
      if (isEditing) {
        stepper.navigation.goTo("review");
      } else {
        stepper.navigation.next();
      }
      scrollToTopInstant();
    }
  };

  const prevStep = () => {
    stepper.navigation.prev();
    scrollToTopInstant();
  };

  const goToStep = (stepId: number) => {
    setIsEditing(true);
    sessionStorage.setItem(EDITING_KEY, "true");
    stepper.navigation.goTo(steps[stepId - 1].id);
    scrollToTopInstant();
  };

  const goToValidationIssue = (issue: ValidationIssue) => {
    const isStepChanging = currentStepId !== issue.stepId;

    if (isStepChanging) {
      stepper.navigation.goTo(issue.stepId);
    }

    if (!issue.fieldPath) {
      scrollToTopInstant();
      return;
    }

    window.setTimeout(
      () => {
        const target = document.getElementsByName(issue.fieldPath).item(0);

        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.focus({ preventScroll: true });
        } else {
          scrollToTopInstant();
        }
      },
      isStepChanging ? 260 : 0,
    );
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
        isContactInfoConfirmed: _isContactInfoConfirmed,
        earlyRegistrationId,
        ...payloadBase
      } = uppercaseData as EnrollmentFormData & {
        contactNumber: string;
        primaryContact: "MOTHER" | "FATHER" | "GUARDIAN";
        isContactInfoConfirmed?: boolean;
        earlyRegistrationId?: number | null;
        guardianRelationship?: string;
      };

      void _isContactInfoConfirmed;

      const mother = { ...payloadBase.mother };
      const father = { ...payloadBase.father };
      const guardian = payloadBase.guardian
        ? { ...payloadBase.guardian }
        : null;

      if (primaryContact === "MOTHER") {
        mother.contactNumber = contactNumber;
        mother.email = payloadBase.email;
      }

      if (primaryContact === "FATHER") {
        father.contactNumber = contactNumber;
        father.email = payloadBase.email;
      }

      if (primaryContact === "GUARDIAN" && guardian) {
        guardian.contactNumber = contactNumber;
        guardian.email = payloadBase.email;
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
          guardian.email,
          guardian.relationship,
        ].some((value) => String(value ?? "").trim().length > 0);

      const normalizedLrn = data.hasNoLrn
        ? null
        : String(data.lrn ?? "").trim() || null;
      const normalizedEarlyRegistrationId =
        typeof earlyRegistrationId === "number" &&
        Number.isFinite(earlyRegistrationId)
          ? earlyRegistrationId
          : null;

      const payload = {
        ...payloadBase,
        lrn: normalizedLrn,
        ...(normalizedEarlyRegistrationId !== null
          ? { earlyRegistrationId: normalizedEarlyRegistrationId }
          : {}),
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
        });
      }

      // Reset form and stepper state
      reset({
        ...DEFAULT_VALUES,
        dateAccomplished: new Date(),
      });
      setMaxStepReached(1);
      setIsEditing(false);
      stepper.navigation.goTo("personal");

      // Clear all session storage
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem("enrollpro_apply_consent");
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(MAX_STEP_KEY);
      sessionStorage.removeItem(EDITING_KEY);
    } catch (error: unknown) {
      const responseData = (
        error as {
          response?: {
            data?: {
              message?: string;
              errors?: Record<string, string[]>;
            };
          };
        }
      )?.response?.data;

      let message =
        responseData?.message ||
        "Failed to submit application. Please try again.";

      if (
        responseData?.message === "Validation failed" &&
        responseData.errors
      ) {
        const firstErrorEntry = Object.entries(responseData.errors).find(
          ([, messages]) => Array.isArray(messages) && messages.length > 0,
        );

        if (firstErrorEntry) {
          const [fieldPath, messages] = firstErrorEntry;
          const readableField =
            fieldPath === "_root" ? "Request" : getFieldLabel(fieldPath);
          message = `${readableField}: ${messages[0]}`;
        }
      }

      setSubmitError(message);
      scrollToTopInstant();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = stepper.state.isLast;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-0">
      {onBack && (
        <Button 
          onClick={onBack} 
          className="mb-6 group font-black uppercase bg-primary text-white hover:bg-primary/90 shadow-md transition-all px-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
          Back to Selection
        </Button>
      )}
      <StepProgressBar
        currentStep={currentIndex}
        totalSteps={steps.length}
        steps={steps.map((s, i) => ({ id: i + 1, title: s.title }))}
        description={stepper.state.current.data.description}
        completedUpTo={maxStepReached}
      />

      <Card className="shadow-sm border-border rounded-2xl overflow-hidden mb-12">
        <CardContent className="p-6 md:p-10">
          <div className="mb-8 pb-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 bg-primary text-primary-foreground">
                {currentIndex}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                  {stepper.state.current.data.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stepper.state.current.data.description}
                </p>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm font-medium">
              {submitError}
            </div>
          )}

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepper.state.current.data.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}>
                  {stepper.flow.switch({
                    personal: () => <Step1Personal />,
                    family: () => <Step2Family />,
                    background: () => <Step3Background />,
                    previousSchool: () => <Step4PreviousSchool />,
                    preferences: () => <Step5Enrollment />,
                    review: () => (
                      <Step6Review
                        onEdit={goToStep}
                        isSubmitting={isSubmitting}
                        onSubmitClick={handleAttemptSubmit}
                      />
                    ),
                  })}
                </motion.div>
              </AnimatePresence>

              {validationIssues.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 mt-8">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Please provide the following required information to
                    proceed:
                  </div>
                  <ul className="list-disc pl-6 text-xs font-bold text-destructive/80 space-y-1">
                    {validationIssues.map((issue, index) => (
                      <li key={`${issue.fieldPath}-${index}`}>
                        <a
                          href={`#${issue.fieldPath || issue.stepId}`}
                          onClick={(event) => {
                            event.preventDefault();
                            goToValidationIssue(issue);
                          }}
                          className="underline underline-offset-2 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40 rounded-sm"
                          aria-label={`Go to Step ${issue.stepNumber}: ${issue.stepTitle}, field ${issue.fieldLabel}`}>
                          Step {issue.stepNumber}: {issue.stepTitle} -{" "}
                          {issue.fieldLabel}: {issue.message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-10 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={prevStep}
                  disabled={stepper.state.isFirst || isSubmitting}
                  className="h-12 px-8 font-semibold sm:w-auto w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {!isLastStep && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={nextStep}
                    className="h-12 px-8 font-semibold sm:w-auto w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {isEditing ? "Update & Review" : "Next Step"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
