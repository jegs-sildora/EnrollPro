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
import { Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import api from '@/api/axiosInstance';



export default function AdmissionForm() {
  const stepper = useStepper();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isEditing, setIsEditing] = useState(false);

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
      isCertifiedTrue: true,
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
      sessionStorage.setItem('hnhs_apply_max_step', currentIndex.toString());
    }
  }, [currentIndex, maxStepReached, stepper.state]);

  // Clear editing mode when reaching review step
  useEffect(() => {
    if (stepper.state.current.data.id === 'review') {
      setIsEditing(false);
      sessionStorage.removeItem('hnhs_apply_editing');
    }
  }, [stepper.state.current.data.id, stepper.state]);

  // Initial load of draft, step, and max step
  useEffect(() => {
    const draft = sessionStorage.getItem('hnhs_apply_draft');
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

    const savedMax = sessionStorage.getItem('hnhs_apply_max_step');
    if (savedMax) {
      setMaxStepReached(parseInt(savedMax, 10));
    }

    const savedEditing = sessionStorage.getItem('hnhs_apply_editing');
    if (savedEditing === 'true') {
      setIsEditing(true);
    }

    const savedStep = sessionStorage.getItem('hnhs_apply_step');
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
        sessionStorage.setItem('hnhs_apply_draft', JSON.stringify(allValues));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [allValues]);

  // Save current step whenever it changes
  useEffect(() => {
    if (stepper.state.current.data.id) {
      sessionStorage.setItem('hnhs_apply_step', stepper.state.current.data.id);
    }
  }, [stepper.state.current.data.id, stepper.state]);

  const nextStep = async () => {
    let fieldsToValidate: FieldPath<AdmissionFormData>[] = [];

    if (stepper.state.current.data.id === 'personal') {
      fieldsToValidate = ['lastName', 'firstName', 'birthdate', 'sex', 'placeOfBirth', 'motherTongue'];
    } else if (stepper.state.current.data.id === 'family') {
      fieldsToValidate = [
        'currentAddress.barangay', 'currentAddress.cityMunicipality', 'currentAddress.province',
        'mother.lastName', 'mother.firstName', 'father.lastName', 'father.firstName', 'email',
      ] as FieldPath<AdmissionFormData>[];
    } else if (stepper.state.current.data.id === 'previousSchool') {
      fieldsToValidate = ['lastSchoolName', 'lastGradeCompleted', 'syLastAttended', 'lastSchoolType'];
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
    sessionStorage.setItem('hnhs_apply_editing', 'true');
    stepper.navigation.goTo(steps[stepId - 1].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: AdmissionFormData) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        ...data,
        birthdate: data.birthdate instanceof Date ? data.birthdate.toISOString() : data.birthdate,
        permanentAddress: data.isPermanentSameAsCurrent ? data.currentAddress : data.permanentAddress,
      };

      const response = await api.post('/applications', payload);
      setTrackingNumber(response.data.trackingNumber);
      setIsSubmitted(true);
      sessionStorage.removeItem('hnhs_apply_draft');
      sessionStorage.removeItem('hnhs_apply_consent');
      sessionStorage.removeItem('hnhs_apply_step');
      sessionStorage.removeItem('hnhs_apply_max_step');
      sessionStorage.removeItem('hnhs_apply_editing');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit application. Please try again.';
      setSubmitError(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <AdmissionSuccess trackingNumber={trackingNumber} />;
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
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: 'hsl(var(--accent))',
                  color: 'hsl(var(--accent-foreground))',
                }}
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
                    review:         () => <Step6Review onEdit={goToStep} />,
                  })}
                </motion.div>
              </AnimatePresence>

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

                {!isLastStep ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={nextStep}
                    className="h-12 px-8 font-semibold sm:w-auto w-full"
                  >
                    {isEditing ? 'Update & Review' : 'Next Step'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="h-12 px-10 font-bold bg-primary hover:bg-primary/90 sm:w-auto w-full"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-5 w-5 stroke-3" />
                    )}
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
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
