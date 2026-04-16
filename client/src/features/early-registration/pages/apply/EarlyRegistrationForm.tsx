import { useEffect, useState } from "react";
import { useForm, FormProvider, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStepper, steps } from "./stepper";
import {
  EarlyRegFormSchema,
  type EarlyRegFormData,
  DEFAULT_VALUES,
} from "./types";

import BasicInfoStep from "./steps/BasicInfoStep";
import LearnerProfileStep from "./steps/LearnerProfileStep";
import AddressGuardianStep from "./steps/AddressGuardianStep";
import LegalConsentStep from "./steps/LegalConsentStep";

import StepProgressBar from "@/features/admission/pages/apply/components/StepProgressBar";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toUpperCaseRecursive } from "@/shared/lib/utils";
import { sileo } from "sileo";

interface EarlyRegFormProps {
  onSuccess?: (data: {
    id: number;
    trackingNumber: string;
    learnerName: string;
    applicantType: string;
  }) => void;
  submitEndpoint?: string;
  storageKeyPrefix?: string;
  consentStorageKey?: string | null;
}

const collectErrorMessages = (errorValue: unknown): string[] => {
  if (!errorValue || typeof errorValue !== "object") return [];

  const maybeMessage = (errorValue as { message?: unknown }).message;
  if (typeof maybeMessage === "string") {
    return [maybeMessage];
  }

  return Object.values(errorValue).flatMap(collectErrorMessages);
};

export default function EarlyRegistrationForm({
  onSuccess,
  submitEndpoint = "/early-registrations",
  storageKeyPrefix = "enrollpro_earlyreg",
  consentStorageKey = "enrollpro_earlyreg_consent",
}: EarlyRegFormProps) {
  const DRAFT_KEY = `${storageKeyPrefix}_draft`;
  const STEP_KEY = `${storageKeyPrefix}_step`;
  const MAX_STEP_KEY = `${storageKeyPrefix}_max_step`;
  const EDITING_KEY = `${storageKeyPrefix}_editing`;

  // Draft recovery
  const [initialDraft] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch {
        return null;
      }
    }
    return null;
  });

  const stepper = useStepper({
    initialStep: (sessionStorage.getItem(STEP_KEY) ?? "basic-info") as
      | "basic-info"
      | "learner-profile"
      | "address-guardian"
      | "legal-consent",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLrn, setIsCheckingLrn] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isEditing, setIsEditing] = useState(false);

  const methods = useForm<EarlyRegFormData, unknown, EarlyRegFormData>({
    resolver: zodResolver(
      EarlyRegFormSchema,
    ) as import("react-hook-form").Resolver<EarlyRegFormData>,
    defaultValues: initialDraft ?? {
      ...DEFAULT_VALUES,
      isPrivacyConsentGiven: true,
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    trigger,
    reset,
    watch,
    getFieldState,
    getValues,
    setError,
    clearErrors,
  } = methods;

  const currentIndex =
    steps.findIndex((s) => s.id === stepper.state.current.data.id) + 1;

  const scrollToTop = () => {
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
    if (stepper.state.current.data.id === "legal-consent") {
      setIsEditing(false);
      sessionStorage.removeItem(EDITING_KEY);
    }
  }, [stepper.state.current.data.id]);

  // Initial load of max step
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

  // Auto-save draft every 1s
  const allValues = watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (allValues.lastName || allValues.firstName || allValues.lrn) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(allValues));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [allValues]);

  // Save current step
  useEffect(() => {
    if (stepper.state.current.data.id) {
      sessionStorage.setItem(STEP_KEY, stepper.state.current.data.id);
    }
  }, [stepper.state.current.data.id]);

  // Scroll to top on step change
  useEffect(() => {
    scrollToTop();
  }, [stepper.state.current.data.id]);

  // Field groups per step for partial validation
  const STEP_FIELDS: Record<string, FieldPath<EarlyRegFormData>[]> = {
    "basic-info": [
      "gradeLevel",
      "learnerType",
      "lrn",
      "hasNoLrn",
      "isScpApplication",
      "scpType",
    ],
    "learner-profile": [
      "lastName",
      "firstName",
      "birthdate",
      "sex",
      "placeOfBirth",
    ],
    "address-guardian": [
      "barangay",
      "cityMunicipality",
      "province",
      "contactNumber",
      "mother.maidenName",
      "mother.firstName",
      "father.lastName",
      "father.firstName",
      "guardian.lastName",
      "guardian.firstName",
      "guardianRelationship",
      "email",
    ],
    "legal-consent": ["isPrivacyConsentGiven"],
  };

  const hasBlockingErrors = Object.keys(methods.formState.errors).length > 0;

  const checkLrnAvailability = async (): Promise<boolean> => {
    if (getValues("hasNoLrn") === true) {
      clearErrors("lrn");
      return true;
    }

    const rawLrn = String(getValues("lrn") ?? "").trim();
    if (!rawLrn || rawLrn.length !== 12) {
      const lrnState = getFieldState("lrn", methods.formState);
      if (lrnState.error?.type === "manual") {
        clearErrors("lrn");
      }
      return true;
    }

    setIsCheckingLrn(true);
    try {
      const response = await api.get(
        `/early-registrations/check-lrn/${rawLrn}`,
      );
      if (response.data?.exists) {
        setError("lrn", {
          type: "manual",
          message:
            response.data?.message || "A learner with this LRN already exists.",
        });
        return false;
      }

      const lrnState = getFieldState("lrn", methods.formState);
      if (lrnState.error?.type === "manual") {
        clearErrors("lrn");
      }
      return true;
    } catch {
      setError("lrn", {
        type: "manual",
        message: "Unable to verify the LRN right now. Please try again.",
      });
      return false;
    } finally {
      setIsCheckingLrn(false);
    }
  };

  const nextStep = async () => {
    const stepId = stepper.state.current.data.id;
    const fields = STEP_FIELDS[stepId] ?? [];
    const isValid = fields.length > 0 ? await trigger(fields) : true;

    if (!isValid) {
      return;
    }

    if (stepId === "basic-info") {
      const isLrnAvailable = await checkLrnAvailability();
      if (!isLrnAvailable) {
        return;
      }
    }

    if (isEditing) {
      stepper.navigation.goTo("legal-consent");
    } else {
      stepper.navigation.next();
    }
    scrollToTop();
  };

  const prevStep = () => {
    stepper.navigation.prev();
    scrollToTop();
  };

  const goToStep = (stepId: number) => {
    setIsEditing(true);
    sessionStorage.setItem(EDITING_KEY, "true");
    stepper.navigation.goTo(steps[stepId - 1].id);
    scrollToTop();
  };

  const onSubmit = async (data: EarlyRegFormData) => {
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
      };

      const response = await api.post(submitEndpoint, payload);

      sileo.success({
        title: "Success!",
        description: response.data.message,
      });

      onSuccess?.({
        id: response.data.id,
        trackingNumber: response.data.trackingNumber,
        learnerName: response.data.learnerName,
        applicantType: response.data.applicantType ?? "REGULAR",
      });

      // Clear draft & reset
      reset({ ...DEFAULT_VALUES });
      setMaxStepReached(1);
      setIsEditing(false);
      stepper.navigation.goTo("basic-info");
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(MAX_STEP_KEY);
      sessionStorage.removeItem(EDITING_KEY);
      if (consentStorageKey) {
        sessionStorage.removeItem(consentStorageKey);
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to submit registration. Please try again.";
      setSubmitError(message);
      scrollToTop();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = stepper.state.isLast;

  const submitFromReview = () => {
    void handleSubmit(onSubmit)();
  };

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
          {/* Step heading */}
          <div className="mb-8 pb-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 bg-primary text-primary-foreground">
                {currentIndex}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                  {stepper.state.current.data.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5 font-bold">
                  {stepper.state.current.data.description}
                </p>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-4 mb-6 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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
                    "basic-info": () => <BasicInfoStep />,
                    "learner-profile": () => <LearnerProfileStep />,
                    "address-guardian": () => <AddressGuardianStep />,
                    "legal-consent": () => (
                      <LegalConsentStep
                        isSubmitting={isSubmitting}
                        onEdit={goToStep}
                        onConfirmSubmit={submitFromReview}
                      />
                    ),
                  })}
                </motion.div>
              </AnimatePresence>

              {/* Global error summary */}
              {Object.keys(methods.formState.errors).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 mt-6">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Please complete the required fields below.
                  </div>
                  <ul className="list-disc pl-6 text-xs font-bold text-destructive/80 space-y-1">
                    {Array.from(
                      new Set(
                        Object.values(methods.formState.errors).flatMap(
                          (errorValue) => collectErrorMessages(errorValue),
                        ),
                      ),
                    ).map((msg, i) => (
                      <li key={i}>{msg as string}</li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Navigation */}
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
                    disabled={
                      isSubmitting || hasBlockingErrors || isCheckingLrn
                    }
                    className="h-12 px-8 font-semibold sm:w-auto w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {isEditing ? "Update and Review" : "Next Step"}
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
