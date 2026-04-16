import { useEffect, useState } from "react";
import { useForm, FormProvider, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStepper, steps } from "../apply/stepper";
import { EnrollmentFormSchema, type EnrollmentFormData } from "../apply/types";

import Step1Personal from "../apply/components/Step1Personal";
import Step2Family from "../apply/components/Step2Family";
import Step3Background from "../apply/components/Step3Background";
import Step4PreviousSchool from "../apply/components/Step4PreviousSchool";
import Step5Enrollment from "../apply/components/Step5Preferences";
import Step6Review from "../apply/components/Step6Review";
import F2FEarlyRegistrationSuccess from "./F2FEarlyRegistrationSuccess";
import F2FStepProgressBar from "./F2FStepProgressBar";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  UserPlus,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { Link } from "react-router";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { toUpperCaseRecursive } from "@/shared/lib/utils";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";

const DRAFT_KEY = "enrollpro_f2f_draft";
const STEP_KEY = "enrollpro_f2f_step";
const MAX_STEP_KEY = "enrollpro_f2f_max_step";
const EDITING_KEY = "enrollpro_f2f_editing";

export default function F2FEarlyRegistration() {
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

  const { user } = useAuthStore();
  const { colorScheme, selectedAccentHsl } = useSettingsStore();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submittedApplicantType, setSubmittedApplicantType] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const accentHsl = selectedAccentHsl ?? colorScheme?.accent_hsl;
  const currentHex = colorScheme?.palette?.find(
    (p) => p.hsl === accentHsl,
  )?.hex;
  const isFefe01 = currentHex?.toLowerCase() === "#fefe01";

  const accentForeground =
    colorScheme?.palette?.find((p) => p.hsl === accentHsl)?.foreground ??
    colorScheme?.accent_foreground;
  const isLightColor = accentForeground === "0 0% 0%";

  const applyOverride = isFefe01 || isLightColor;

  const methods = useForm<EnrollmentFormData, unknown, EnrollmentFormData>({
    resolver: zodResolver(
      EnrollmentFormSchema,
    ) as import("react-hook-form").Resolver<EnrollmentFormData>,
    defaultValues: initialDraft || {
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
      isCertifiedTrue: false,
      dateAccomplished: new Date(),
    },
    mode: "onBlur",
  });

  const { handleSubmit, trigger, reset, watch } = methods;

  const currentIndex =
    steps.findIndex((s) => s.id === stepper.state.current.data.id) + 1;

  const scrollToTopInstant = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handleFullReset = () => {
    setShowResetConfirm(false);

    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(STEP_KEY);
    sessionStorage.removeItem(MAX_STEP_KEY);
    sessionStorage.removeItem(EDITING_KEY);

    reset({
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
      isCertifiedTrue: false,
      dateAccomplished: new Date(),
    });

    setIsSubmitted(false);
    setTrackingNumber("");
    setMaxStepReached(1);
    setIsEditing(false);
    setShowSubmitConfirm(false);
    setSubmitError("");

    stepper.navigation.goTo("personal");
  };

  // Track furthest step
  useEffect(() => {
    if (currentIndex > maxStepReached) {
      setMaxStepReached(currentIndex);
      sessionStorage.setItem(MAX_STEP_KEY, currentIndex.toString());
    }
  }, [currentIndex, maxStepReached, stepper.state]);

  // Clear editing mode when reaching review step
  useEffect(() => {
    if (stepper.state.current.data.id === "review") {
      setIsEditing(false);
      sessionStorage.removeItem(EDITING_KEY);
    }
  }, [stepper.state.current.data.id, stepper.state]);

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
    if (stepper.state.current.data.id) {
      sessionStorage.setItem(STEP_KEY, stepper.state.current.data.id);
    }
  }, [stepper.state.current.data.id, stepper.state]);

  // Keep each step mounted at the top without smooth scrolling animation.
  useEffect(() => {
    scrollToTopInstant();
  }, [stepper.state.current.data.id]);

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
        "email",
      ] as FieldPath<EnrollmentFormData>[];
    } else if (stepper.state.current.data.id === "previousSchool") {
      fieldsToValidate = [
        "lastSchoolName",
        "lastGradeCompleted",
        "schoolYearLastAttended",
        "lastSchoolType",
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

  const handleAttemptSubmit = async () => {
    const isValid = await trigger();
    if (isValid) {
      setShowSubmitConfirm(true);
    } else {
      scrollToTopInstant();
    }
  };

  const onSubmit = async (data: EnrollmentFormData) => {
    setShowSubmitConfirm(false);
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const uppercaseData = toUpperCaseRecursive(data);

      const payload = {
        ...uppercaseData,
        birthdate:
          data.birthdate instanceof Date
            ? data.birthdate.toISOString()
            : data.birthdate,
        permanentAddress: uppercaseData.isPermanentSameAsCurrent
          ? uppercaseData.currentAddress
          : uppercaseData.permanentAddress,
      };

      const response = await api.post("/applications/f2f", payload);
      setTrackingNumber(response.data.trackingNumber);
      setSubmittedApplicantType(
        data.isScpApplication ? data.scpType || null : null,
      );

      sileo.success({
        title: "F2F Application Submitted!",
        description: `Tracking number: ${response.data.trackingNumber}`,
      });

      setIsSubmitted(true);
      reset();
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(MAX_STEP_KEY);
      sessionStorage.removeItem(EDITING_KEY);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "Failed to submit F2F application. Please try again.";
      setSubmitError(message);
      sileo.error({
        title: "Submission Failed",
        description: message,
      });
      scrollToTopInstant();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <F2FEarlyRegistrationSuccess
        trackingNumber={trackingNumber}
        applicantType={submittedApplicantType}
        encodedBy={user ? `${user.firstName} ${user.lastName}` : "Staff"}
        onNewApplication={handleFullReset}
      />
    );
  }

  const isLastStep = stepper.state.isLast;

  return (
    <div
      className="max-w-6xl mx-auto"
      style={
        applyOverride
          ? ({
              "--primary": "200 68% 9%",
              "--primary-foreground": "0 0% 100%",
            } as React.CSSProperties)
          : {}
      }>
      {/* Header */}
      <Card className="mb-6 border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary text-primary-foreground">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  WALK-IN BASIC EDUCATION EARLY REGISTRATION FORM
                </CardTitle>
                <CardDescription className="text-sm">
                  Encode face-to-face BASIC EDUCATION EARLY REGISTRATION FORM
                  application
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2 hidden md:flex">
                <Link to="/enrollment/requirements" target="_blank">
                  <BookOpen className="w-4 h-4" />
                  Requirements Guide
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset Form
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Step Progress */}
      <F2FStepProgressBar
        currentStep={currentIndex}
        totalSteps={steps.length}
        steps={steps.map((s, i) => ({ id: i + 1, title: s.title }))}
        description={stepper.state.current.data.description}
        completedUpTo={maxStepReached}
      />

      {/* Form Card */}
      <Card className="shadow-sm border-border rounded-2xl overflow-hidden mb-6">
        <CardContent className="p-6 md:p-10">
          {/* Step Header */}
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

          {/* Error Display */}
          {submitError && (
            <div className="p-4 mb-6 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {submitError}
            </div>
          )}

          {/* Form */}
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

              {/* Validation Errors Summary */}
              {Object.keys(methods.formState.errors).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 mt-8">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Please provide the following required information to
                    proceed:
                  </div>
                  <ul className="list-disc pl-6 text-xs font-bold text-destructive/80 space-y-1">
                    {Array.from(
                      new Set(
                        Object.values(methods.formState.errors).flatMap(
                          (
                            err:
                              | Record<string, { message?: string }>
                              | { message?: string },
                          ) =>
                            (err as { message?: string })?.message
                              ? [(err as { message?: string }).message!]
                              : Object.values(
                                  (err as Record<
                                    string,
                                    { message?: string }
                                  >) || {},
                                )
                                  .map((e) => e?.message)
                                  .filter(Boolean),
                        ),
                      ),
                    ).map((msg, i) => (
                      <li key={i}>{msg as string}</li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Navigation Buttons */}
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
                    className="h-12 px-8 font-semibold sm:w-auto w-full bg-primary text-primary-foreground hover:opacity-90">
                    {isEditing ? "Update & Review" : "Next Step"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>

      {/* Submit Confirmation Modal */}
      <ConfirmationModal
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        title="Confirm F2F Submission"
        description="This will record the walk-in application with your staff credentials. The applicant will receive a tracking number for monitoring their application status."
        confirmText="Submit Application"
        onConfirm={() => handleSubmit(onSubmit)()}
        loading={isSubmitting}
        confirmClassName="bg-primary text-primary-foreground hover:opacity-90"
        variant="success"
      />

      {/* Reset Confirmation Modal */}
      <ConfirmationModal
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset Form"
        description="Are you sure you want to reset the form? All entered data will be cleared and you will start from the beginning."
        confirmText="Reset"
        onConfirm={handleFullReset}
        confirmClassName="bg-primary text-primary-foreground hover:opacity-90"
        variant="warning"
      />
    </div>
  );
}
