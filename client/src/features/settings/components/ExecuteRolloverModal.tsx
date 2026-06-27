import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { DatePicker } from "@/shared/ui/date-picker";
import { Checkbox } from "@/shared/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { CheckCircle2, Rocket } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { AdminPinInput } from "@/shared/components/AdminPinInput";
import api from "@/shared/api/axiosInstance";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  getReducedMotionProps,
  listVariants,
  panelTransition,
  sectionVariants,
  staggerTransition,
} from "@/shared/lib/motion";
import { sileo } from "sileo";
import {
  LoaderCore,
  type LoadingState as MultiStepLoadingState,
} from "@/components/ui/multi-step-loader";

const ROLLOVER_LOADING_STATES: MultiStepLoadingState[] = [
  { text: "Validating EOSY completion and rollover authorization." },
  { text: "Archiving the active school year and locking audit history." },
  {
    text: "Creating the next academic cycle and applying lifecycle updates.",
  },
  { text: "Applying structure and learner carryover updates." },
  { text: "Refreshing active school-year context across modules." },
];

const ROLLOVER_STEP_DELAY_MS = 520;
const ROLLOVER_CLOSE_COUNTDOWN_SECONDS = 5;

interface ExecuteRolloverModalProps {
  open: boolean;
  activeSchoolYearLabel: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}

function deriveNextLabel(date: Date | undefined): string {
  if (!date) return "";
  const year = date.getFullYear();
  return `S.Y. ${year}-${year + 1}`;
}

export default function ExecuteRolloverModal({
  open,
  activeSchoolYearLabel,
  onOpenChange,
  onSuccess,
}: ExecuteRolloverModalProps) {
  const [bosyDate, setBosyDate] = useState<Date | undefined>(undefined);
  const [eosyDate, setEosyDate] = useState<Date | undefined>(undefined);
  const [isDepdCompliant, setIsDepdCompliant] = useState(false);
  const [pin, setPin] = useState("");
  const [pinTouched, setPinTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRolloverLoaderOpen, setIsRolloverLoaderOpen] = useState(false);
  const [rolloverLoaderStep, setRolloverLoaderStep] = useState(0);
  const [isRolloverFinishing, setIsRolloverFinishing] = useState(false);

  const isPinValid = /^\d{6}$/.test(pin);
  const nextYearLabel = useMemo(() => deriveNextLabel(bosyDate), [bosyDate]);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const motionState = getReducedMotionProps(shouldReduceMotion);

  const canSubmit =
    bosyDate !== undefined &&
    eosyDate !== undefined &&
    isDepdCompliant &&
    isPinValid;

  const waitForStepProgression = () =>
    new Promise((resolve) =>
      setTimeout(resolve, shouldReduceMotion ? 120 : ROLLOVER_STEP_DELAY_MS + 120),
    );

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    onOpenChange(next);
    if (!next) {
      setBosyDate(undefined);
      setEosyDate(undefined);
      setIsDepdCompliant(false);
      setPin("");
      setPinTouched(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setRolloverLoaderStep(0);
    setIsRolloverFinishing(false);
    setIsRolloverLoaderOpen(true);
    sileo.info({
      title: "Executing Academic Rollover",
      description: "Creating the next academic cycle and applying lifecycle updates.",
    });
    setIsSubmitting(true);
    try {
      await waitForStepProgression();
      setRolloverLoaderStep(1);
      await waitForStepProgression();

      setRolloverLoaderStep(2);
      await waitForStepProgression();
      await api.post("/school-years/rollover", {
        classOpeningDate: bosyDate!.toLocaleDateString("sv-SE"),
        classEndDate: eosyDate!.toLocaleDateString("sv-SE"),
        pin,
      });

      setRolloverLoaderStep(3);
      await waitForStepProgression();
      await onSuccess();
      setRolloverLoaderStep(4);
      await waitForStepProgression();

      setIsRolloverFinishing(true);
      await new Promise((resolve) =>
        setTimeout(resolve, ROLLOVER_CLOSE_COUNTDOWN_SECONDS * 1000),
      );

      sileo.success({
        title: "Academic Rollover Completed",
        description: `${nextYearLabel} has been created and activated successfully.`,
      });
      handleClose(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (
            err as { response: { data?: { message?: string } } }
          ).response.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to initiate school year rollover.";
      sileo.error({
        title: "Academic Rollover Failed",
        description: message || "An unexpected error occurred.",
      });
    } finally {
      setIsRolloverLoaderOpen(false);
      setIsRolloverFinishing(false);
      setRolloverLoaderStep(0);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isRolloverLoaderOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: "easeInOut" }}
            className="fixed inset-0 z-[300] flex min-h-dvh w-screen items-center justify-center overflow-hidden bg-white/75 backdrop-blur-2xl"
            role="status"
            aria-live="polite"
            aria-label="Running school year rollover"
          >
            <div className="absolute inset-0 pointer-events-none">
              <svg
                aria-hidden="true"
                className="h-full w-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <pattern
                    id="execute-rollover-pixel-grid"
                    x="0"
                    y="0"
                    width="80"
                    height="80"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.12)"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="42"
                      y="2"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.1)"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="2"
                      y="42"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.09)"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="42"
                      y="42"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.11)"
                      strokeWidth="1.1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#execute-rollover-pixel-grid)" />
              </svg>
            </div>

            <div className="relative z-10 w-full max-w-3xl px-6">
              <div className="text-center mb-5">
                <h3 className="text-md font-extrabold text-foreground uppercase">
                  Processing School Year Rollover
                </h3>
                <p className="text-md font-extrabold text-foreground">
                  Please keep this window open while records are being updated.
                </p>
              </div>
              <LoaderCore
                loadingStates={ROLLOVER_LOADING_STATES}
                value={rolloverLoaderStep}
                stepDelay={ROLLOVER_STEP_DELAY_MS}
                showCompletionMessage={isRolloverFinishing}
                completionCountdownSeconds={ROLLOVER_CLOSE_COUNTDOWN_SECONDS}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <motion.div
            variants={listVariants}
            transition={staggerTransition}
            {...motionState}>
            <motion.div variants={sectionVariants} transition={panelTransition}>
              <DialogHeader className="pb-2">
                <DialogTitle className="text-2xl font-extrabold uppercase text-primary">
                  Execute Academic Rollover
                </DialogTitle>
                <DialogDescription className="font-extrabold text-foreground pt-1">
                  Create and activate the{" "}
                  <span className="font-extrabold text-primary">
                    {nextYearLabel || "next"}
                  </span>{" "}
                  academic cycle from{" "}
                  <span className="font-extrabold">S.Y. {activeSchoolYearLabel ?? "—"}</span>.
                </DialogDescription>
              </DialogHeader>
            </motion.div>

            <motion.div
              className="py-4 pb-2"
              variants={sectionVariants}
              transition={panelTransition}>
              <div className="space-y-6">
                {/* TASK 1: 2-col DatePicker grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold uppercase text-primary">
                      Beginning of School Year (BOSY)
                    </Label>
                    <div className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
                      <DatePicker
                        date={bosyDate}
                        setDate={setBosyDate}
                        placeholder="Select opening date"
                        className="w-full font-extrabold"
                        timeZone="Asia/Manila"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold uppercase text-primary">
                      End of School Year (EOSY)
                    </Label>
                    <div className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
                      <DatePicker
                        date={eosyDate}
                        setDate={setEosyDate}
                        placeholder="Select end date"
                        className="w-full font-extrabold"
                        timeZone="Asia/Manila"
                        minDate={bosyDate}
                      />
                    </div>
                  </div>
                </div>

                {/* TASK 2: Softened payload card with generous spacing */}
                <div className="rounded-lg bg-slate-50 p-6 space-y-1">
                  <p className="text-base font-extrabold uppercase tracking-normal text-foreground mb-3">
                    Rollover Payload from {activeSchoolYearLabel ?? "—"}
                  </p>
                  <ul className="space-y-4 font-extrabold text-foreground">
                    {[
                      `Archive ${activeSchoolYearLabel ?? "current S.Y."} and lock all historical SF1/SF5 records.`,
                      "Clone Grade Levels, Sections, and SCP architecture (Class Sections (SF1) will be wiped clean).",
                      "Promote and carry over eligible learners to their next grade level holding pool.",
                    ].map((action) => (
                      <li key={action} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-base leading-tight text-slate-600">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* TASK 3: Red box — warning + DepEd compliance ONLY */}
                <div className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-4">
                  <Alert className="bg-transparent border-0 p-0 shadow-none">
                    <AlertTitle className="font-extrabold text-red-800 uppercase">
                      Irreversible System Activation
                    </AlertTitle>
                    <AlertDescription className="text-base leading-tight font-extrabold text-red-700">
                      Once executed, this action cannot be undone. The current school year will be permanently archived.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="depd-compliance"
                      checked={isDepdCompliant}
                      onCheckedChange={(checked) =>
                        setIsDepdCompliant(checked === true)
                      }
                      disabled={isSubmitting}
                      className="mt-0.5 border-red-400 data-[state=checked]:bg-red-700 data-[state=checked]:border-red-700"
                    />
                    <Label
                      htmlFor="depd-compliance"
                      className="text-base font-extrabold text-red-800 leading-snug cursor-pointer">
                      I confirm that the selected BOSY and EOSY dates align with the
                      official DepEd School Calendar Memorandum, and I authorize
                      system activation.
                    </Label>
                  </div>
                </div>
              </div>

              {/* TASK 4: PIN section — outside the space-y group, mt-8 for clear visual break */}
              <div className="flex flex-col items-center gap-3 mt-8 pb-4">
                <Label className="text-base font-extrabold uppercase text-primary tracking-widest text-center">
                  Enter 6-Digit Admin PIN to Execute:
                </Label>
                <AdminPinInput
                  value={pin}
                  onChange={setPin}
                  invalid={pinTouched && !isPinValid}
                  onBlur={() => setPinTouched(true)}
                  autoFocus={false}
                  disabled={isSubmitting}
                  ariaLabel="Rollover execution admin PIN"
                />
                {pinTouched && !isPinValid && (
                  <p className="text-base text-primary font-extrabold uppercase animate-in fade-in slide-in-from-top-1 duration-200">
                    Valid 6-digit administrative PIN required
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div variants={sectionVariants} transition={panelTransition}>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  disabled={isSubmitting}
                  className="font-extrabold">
                  Cancel
                </Button>
                <Button
                  className={cn(
                    "font-extrabold uppercase transition-all px-6 shrink-0",
                    !canSubmit || isSubmitting
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed opacity-50"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-b-4 border-primary/20 active:border-b-0 active:translate-y-1",
                  )}
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? (
                    "Processing..."
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" /> Execute School Year
                      Rollover
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
