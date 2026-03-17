import { useEffect, useState } from 'react';
import { useForm, FormProvider, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useStepper, steps } from './stepper';
import { admissionSchema, type AdmissionFormData } from './types';

import Step1Personal from './components/Step1Personal';
import Step2Family from './components/Step2Family';
import Step3Background from './components/Step3Background';
import Step4PreviousSchool from './components/Step4PreviousSchool';
import Step5Enrollment from './components/Step5Enrollment';
import Step6Review from './components/Step6Review';
import AdmissionSuccess from './components/AdmissionSuccess';
import StepProgressBar from './components/StepProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import api from '@/api/axiosInstance';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { toUpperCaseRecursive } from '@/lib/utils';
import { sileo } from 'sileo';



export default function AdmissionForm({ onReset }: { onReset: () => void }) {
  const stepper = useStepper();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const handleFullReset = () => {
    // 1. Reset React Hook Form to initial defaults
    reset({
      schoolYear: '2026-2027',
      privacyConsentGiven: true,
      gradeLevel: '7',
      isIpCommunity: false,
      is4PsBeneficiary: false,
      isBalikAral: false,
      isLearnerWithDisability: false,
      isPermanentSameAsCurrent: true,
      scpApplication: false,
      learnerType: 'Regular',
      isCertifiedTrue: false,
      dateAccomplished: new Date(),
    });

    // 2. Reset local component states
    setIsSubmitted(false);
    setTrackingNumber('');
    setMaxStepReached(1);
    setIsEditing(false);
    setShowSubmitConfirm(false);
    setSubmitError('');

    // 3. Reset stepper to first step
    stepper.navigation.goTo('personal');

    // 4. Clear all session storage related to the application
    sessionStorage.removeItem('enrollpro_apply_draft');
    sessionStorage.removeItem('enrollpro_apply_step');
    sessionStorage.removeItem('enrollpro_apply_max_step');
    sessionStorage.removeItem('enrollpro_apply_editing');

    // 5. Notify parent (Index.tsx) to reset consent state
    onReset();
  };

  const methods = useForm<AdmissionFormData, unknown, AdmissionFormData>({
    resolver: zodResolver(admissionSchema) as import('react-hook-form').Resolver<AdmissionFormData>,
    defaultValues: {
      schoolYear: '2026-2027',
      privacyConsentGiven: true,
      gradeLevel: '7',
      isIpCommunity: false,
      is4PsBeneficiary: false,
      isBalikAral: false,
      isLearnerWithDisability: false,
      isPermanentSameAsCurrent: true,
      scpApplication: false,
      learnerType: 'Regular',
      isCertifiedTrue: false,
      dateAccomplished: new Date(),
    },
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, reset, watch } = methods;

  const currentIndex = steps.findIndex(s => s.id === stepper.state.current.data.id) + 1;

  // Track furthest step
  useEffect(() => {
    if (currentIndex > maxStepReached) {
      setMaxStepReached(currentIndex);
      sessionStorage.setItem('enrollpro_apply_max_step', currentIndex.toString());
    }
  }, [currentIndex, maxStepReached, stepper.state]);

  // Clear editing mode when reaching review step
  useEffect(() => {
    if (stepper.state.current.data.id === 'review') {
      setIsEditing(false);
      sessionStorage.removeItem('enrollpro_apply_editing');
    }
  }, [stepper.state.current.data.id, stepper.state]);

  // Initial load of draft, step, and max step
  useEffect(() => {
    const draft = sessionStorage.getItem('enrollpro_apply_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.birthdate) parsed.birthdate = new Date(parsed.birthdate);
        if (parsed.dateAccomplished) parsed.dateAccomplished = new Date(parsed.dateAccomplished);
        reset(parsed);
      } catch (e) {
        console.error('Failed to parse admission draft:', e);
      }
    }

    const savedMax = sessionStorage.getItem('enrollpro_apply_max_step');
    if (savedMax) {
      setMaxStepReached(parseInt(savedMax, 10));
    }

    const savedEditing = sessionStorage.getItem('enrollpro_apply_editing');
    if (savedEditing === 'true') {
      setIsEditing(true);
    }

    const savedStep = sessionStorage.getItem('enrollpro_apply_step');
    if (savedStep && steps.some(s => s.id === savedStep)) {
      // Use a slightly longer timeout or requestAnimationFrame to ensure components are ready
      setTimeout(() => {
        stepper.navigation.goTo(savedStep as never);
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Auto-save draft on every change (debounced)
  const allValues = watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      // Don't save if form is empty/uninitialized
      if (allValues.lastName || allValues.firstName || allValues.lrn) {
        sessionStorage.setItem('enrollpro_apply_draft', JSON.stringify(allValues));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [allValues]);

  // Save current step whenever it changes
  useEffect(() => {
    if (stepper.state.current.data.id) {
      sessionStorage.setItem('enrollpro_apply_step', stepper.state.current.data.id);
    }
  }, [stepper.state.current.data.id, stepper.state]);

  const nextStep = async () => {
    let fieldsToValidate: FieldPath<AdmissionFormData>[] = [];

    if (stepper.state.current.data.id === 'personal') {
      fieldsToValidate = ['lastName', 'firstName', 'birthdate', 'sex', 'placeOfBirth', 'lrn'];
    } else if (stepper.state.current.data.id === 'family') {
      fieldsToValidate = [
        'currentAddress.barangay', 'currentAddress.cityMunicipality', 'currentAddress.province',
        'mother.lastName', 'mother.firstName', 'father.lastName', 'father.firstName', 'email',
      ] as FieldPath<AdmissionFormData>[];
    } else if (stepper.state.current.data.id === 'previousSchool') {
      fieldsToValidate = ['lastSchoolName', 'lastGradeCompleted', 'syLastAttended', 'lastSchoolType'];
    } else if (stepper.state.current.data.id === 'preferences') {
      fieldsToValidate = ['gradeLevel', 'learnerType'];
      if (watch('scpApplication')) fieldsToValidate.push('scpType');
      if (watch('gradeLevel') === '11') fieldsToValidate.push('shsTrack', 'electiveCluster');
    }

    const isValid = fieldsToValidate.length > 0 ? await trigger(fieldsToValidate) : true;
    if (isValid) {
      if (isEditing) {
        stepper.navigation.goTo('review');
      } else {
        stepper.navigation.next();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    stepper.navigation.prev();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (stepId: number) => {
    setIsEditing(true);
    sessionStorage.setItem('enrollpro_apply_editing', 'true');
    stepper.navigation.goTo(steps[stepId - 1].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAttemptSubmit = async () => {
    const isValid = await trigger();
    if (isValid) {
      setShowSubmitConfirm(true);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data: AdmissionFormData) => {
    setShowSubmitConfirm(false);
    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Convert all strings to uppercase for database uniformity
      const uppercaseData = toUpperCaseRecursive(data);

      const payload = {
        ...uppercaseData,
        birthdate: data.birthdate instanceof Date ? data.birthdate.toISOString() : data.birthdate,
        // Ensure permanent address is handled correctly if same as current
        permanentAddress: uppercaseData.isPermanentSameAsCurrent 
          ? uppercaseData.currentAddress 
          : uppercaseData.permanentAddress,
      };

      const response = await api.post('/applications', payload);
      setTrackingNumber(response.data.trackingNumber);
      
      sileo.success({
        title: 'Application Submitted!',
        description: `Your tracking number is ${response.data.trackingNumber}. Keep it safe!`,
      });

      setIsSubmitted(true);
      reset(); // Reset form values
      sessionStorage.removeItem('enrollpro_apply_draft');
      sessionStorage.removeItem('enrollpro_apply_consent');
      sessionStorage.removeItem('enrollpro_apply_step');
      sessionStorage.removeItem('enrollpro_apply_max_step');
      sessionStorage.removeItem('enrollpro_apply_editing');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit application. Please try again.';
      setSubmitError(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <AdmissionSuccess trackingNumber={trackingNumber} onBackHome={handleFullReset} />;
  }

  const isLastStep = stepper.state.isLast;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-0">
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
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 bg-[#061E29] text-white"
              >
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
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {stepper.flow.switch({
                    personal:       () => <Step1Personal />,
                    family:         () => <Step2Family />,
                    background:     () => <Step3Background />,
                    previousSchool: () => <Step4PreviousSchool />,
                    preferences:    () => <Step5Enrollment />,
                    review:         () => <Step6Review onEdit={goToStep} isSubmitting={isSubmitting} onSubmitClick={handleAttemptSubmit} />,
                  })}
                </motion.div>
              </AnimatePresence>

              {Object.keys(methods.formState.errors).length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 mt-8">
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Please provide the following required information to proceed:
                  </div>
                  <ul className="list-disc pl-6 text-xs font-medium text-destructive/80 space-y-1">
                    {Array.from(new Set(
                      Object.values(methods.formState.errors).flatMap((err: Record<string, { message?: string }> | { message?: string }) => 
                        (err as { message?: string })?.message
                          ? [(err as { message?: string }).message!]
                          : Object.values(err as Record<string, { message?: string }> || {}).map((e) => e?.message).filter(Boolean)
                      )
                    )).map((msg, i) => (
                      <li key={i}>{msg as string}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-between gap-4 pt-10 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={prevStep}
                  disabled={stepper.state.isFirst || isSubmitting}
                  className="h-12 px-8 font-semibold sm:w-auto w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {!isLastStep && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={nextStep}
                    className="h-12 px-8 font-semibold sm:w-auto w-full bg-[#061E29] text-white hover:bg-[#061E29]/90"
                  >
                    {isEditing ? 'Update & Review' : 'Next Step'}
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
        title="Finalize Application"
        description="Please confirm that all information provided is accurate and complete. Once submitted, you will no longer be able to modify your application during the initial review phase."
        confirmText="Confirm Submission"
        onConfirm={() => handleSubmit(onSubmit)()}
        loading={isSubmitting}
        confirmClassName="bg-[#061E29] text-white hover:bg-[#061E29]/90"
      />
    </div>
  );
}
