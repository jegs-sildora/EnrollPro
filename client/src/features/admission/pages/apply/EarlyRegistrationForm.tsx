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
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { toUpperCaseRecursive } from "@/shared/lib/utils";
import { sileo } from "sileo";

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
  isCertifiedTrue: false,
} as const;

export default function EnrollmentForm({
  onSuccess,
}: {
  onSuccess?: (trackingNumber: string, applicantType?: string) => void;
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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

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

  const currentIndex =
    steps.findIndex((s) => s.id === stepper.state.current.data.id) + 1;

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
    if (stepper.state.current.data.id === "review") {
      setIsEditing(false);
      sessionStorage.removeItem(EDITING_KEY);
    }
  }, [stepper.state.current.data.id]);

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
  }, [stepper.state.current.data.id]);

  // Keep each step mounted at the top
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

      const response = await api.post("/applications", payload);

      sileo.success({
        title: "Enrollment Form Submitted!",
        description: `Your tracking number is ${response.data.trackingNumber}.`,
      });

      if (onSuccess) {
        onSuccess(
          response.data.trackingNumber,
          data.isScpApplication ? data.scpType : undefined,
        );
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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to submit application. Please try again.";
      setSubmitError(message);
      scrollToTopInstant();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = stepper.state.isLast;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-0">
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

              {Object.keys(methods.formState.errors).length > 0 && (
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
                    {Array.from(
                      new Set(
                        Object.values(methods.formState.errors).flatMap(
                          (err: any) =>
                            err?.message
                              ? [err.message]
                              : Object.values(err || {})
                                  .map((e: any) => e?.message)
                                  .filter(Boolean),
                        ),
                      ),
                    ).map((msg, i) => (
                      <li key={i}>{msg as string}</li>
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

      <ConfirmationModal
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        title="Finalize Enrollment Application"
        description="Please confirm that all information provided is accurate and complete. Once submitted, you will no longer be able to modify your application during the initial review phase."
        confirmText="Confirm Submission"
        onConfirm={() => handleSubmit(onSubmit)()}
        loading={isSubmitting}
        confirmClassName="bg-primary text-primary-foreground hover:bg-primary/90"
        variant="success"
      />
    </div>
  );
}
