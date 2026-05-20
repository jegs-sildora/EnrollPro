import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import {
  ShieldAlert,
  FileText,
  UserCheck,
  ArrowRight,
  Loader2,
  LogOut,
  Info,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import type { AxiosError } from "axios";
import { cn } from "@/shared/lib/utils";
import { LearnerPixelGridBackground } from "@/features/learner/components/LearnerPixelGridBackground";

interface Props {
  learner: {
    schoolYear?: { yearLabel?: string } | null;
    pendingConfirmation?: {
      applicationId?: number;
      guardianName?: string | null;
      gradeLevelName?: string | null;
      gradeLevelDisplayOrder?: number | null;
      previousEosyStatus?: string | null;
      tleProgramId?: number | null;
    } | null;
  };
  onSuccess: (nextStep: "COMPLETE" | "TLE_SELECTION") => void;
  onLogout: () => void;
  onRedirectDashboard: () => void;
}

export function ConfirmationWall({
  learner,
  onSuccess,
  onLogout,
  onRedirectDashboard,
}: Props) {
  const {
    schoolName,
    isBosyEnrollmentOpen,
    setSettings,
  } = useSettingsStore();
  const [step, setStep] = useState<"ack" | "success">("ack");
  const [acknowledged, setAcknowledged] = useState(false);
  const [gateLoading, setGateLoading] = useState(true);
  const [guardianName, setGuardianName] = useState(
    learner.pendingConfirmation?.guardianName || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const syncBosyGate = async () => {
      try {
        const res = await api.get("/settings/public", { timeout: 10000 });
        if (!isMounted) {
          return;
        }

        setSettings({
          isBosyEnrollmentOpen: Boolean(res.data.isBosyEnrollmentOpen),
          isTleSelectionOpen: Boolean(res.data.isTleSelectionOpen),
        });
      } catch {
        // Keep persisted value when refresh fails.
      } finally {
        if (isMounted) {
          setGateLoading(false);
        }
      }
    };

    void syncBosyGate();

    return () => {
      isMounted = false;
    };
  }, [setSettings]);

  useEffect(() => {
    if (gateLoading || isBosyEnrollmentOpen || hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    onRedirectDashboard();
  }, [gateLoading, isBosyEnrollmentOpen, onRedirectDashboard]);

  const incomingGrade =
    learner.pendingConfirmation?.gradeLevelName || "Next Grade";
  const targetGradeOrder =
    learner.pendingConfirmation?.gradeLevelDisplayOrder ?? null;
  const isPromotedPrerequisiteMet =
    learner.pendingConfirmation?.previousEosyStatus === "PROMOTED";
  const isGateLocked = !isPromotedPrerequisiteMet;

  const handleConfirmReturn = async () => {
    if (!acknowledged || !guardianName) {
      sileo.error({
        title: "Validation Error",
        description: "Please acknowledge and provide guardian name.",
      });
      return;
    }

    const applicationId = learner.pendingConfirmation?.applicationId;
    if (!applicationId || applicationId <= 0) {
      sileo.error({
        title: "Validation Error",
        description: "Invalid application ID.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/learner/confirm-return", {
        applicationId,
        guardianName,
        confirmAction: "CONFIRM_RETURN",
      });

      if (targetGradeOrder === 9) {
        onSuccess("TLE_SELECTION");
        return;
      }

      setStep("success");
      sileo.success({
        title: "Intent Recorded",
        description: "Your return is confirmed. Please wait for official sectioning.",
      });
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferRequest = async () => {
    if (
      confirm(
        "Are you sure you want to request a transfer out? This will clear your slot for the upcoming year.",
      )
    ) {
      try {
        await api.post("/learner/request-transfer", {
          applicationId: learner.pendingConfirmation?.applicationId,
          reason: "Requested via Digital Confirmation Wall",
        });
        sileo.info({
          title: "Transfer Requested",
          description: "The Registrar has been notified.",
        });
        onLogout();
      } catch (e) {
        toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
      }
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      {gateLoading ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-white/70">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      <LearnerPixelGridBackground />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl space-y-4">
        {!gateLoading && isGateLocked ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card className="shadow-2xl border-none overflow-hidden bg-white">
            <CardHeader className="bg-white text-foreground p-6 sm:p-8">
              <CardTitle className="text-2xl font-black uppercase tracking-tight">
                Confirmation Locked
              </CardTitle>
              <CardDescription className="text-foreground font-bold uppercase text-xs tracking-widest">
                Academic Year {learner.schoolYear?.yearLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-10 space-y-4">
              {!isPromotedPrerequisiteMet ? (
                <p className="text-sm font-bold text-foreground">
                  Confirmation requires previous EOSY status marked as PROMOTED.
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 sm:p-8 flex justify-end">
              <Button
                variant="ghost"
                onClick={onLogout}
                className="font-black uppercase text-xs tracking-widest h-12 px-6 rounded-xl hover:bg-slate-200">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </CardFooter>
            </Card>
          </motion.div>
        ) : (
        <AnimatePresence mode="wait">
          {step === "ack" && (
            <motion.div
              key="ack"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5 sm:space-y-6">
              <div className="rounded-2xl border border-primary/20 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                  Step 1 of 2
                </p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Confirmation of Return
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Official BOSY intent declaration for {schoolName}.
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Card className="shadow-xl border border-slate-200 overflow-hidden bg-white">
                <CardHeader className="bg-white text-foreground p-6 sm:p-8 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black uppercase tracking-tight">
                        Confirm Your Return
                      </CardTitle>
                      <CardDescription className="text-foreground font-bold uppercase text-xs tracking-widest">
                        Academic Year {learner.schoolYear?.yearLabel}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="secondary"
                      className="w-fit bg-primary text-primary-foreground font-black px-4 py-1.5 uppercase text-xs tracking-widest">
                      {incomingGrade}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 sm:p-10 space-y-6">
                  {/* Warning Box */}
                  <div className="flex gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 items-start">
                    <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">
                        Action Required
                      </p>
                      <p className="text-xs font-bold text-foreground leading-relaxed">
                        To secure your slot for the upcoming school year, a
                        parent or legal guardian must acknowledge this digital
                        confirmation. Unconfirmed slots may be released to
                        waitlisted applicants after the enrollment deadline.
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center border border-slate-200">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-sm font-black text-foreground uppercase">
                          Enrollment Intent
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-relaxed">
                        By confirming, you signal your intent to continue your studies at {schoolName} for the {learner.schoolYear?.yearLabel} school year.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center border border-slate-200">
                          <UserCheck className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-sm font-black text-foreground uppercase">
                          Verification Status
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-relaxed">
                        Your records have been automatically validated. No physical documents are required at this stage.
                      </p>
                    </div>
                  </div>

                  {/* Declaration Section */}
                  <div className="pt-6 border-t border-slate-100 space-y-6 rounded-2xl bg-slate-50/70 p-4 sm:p-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-foreground tracking-widest ml-1">
                        Legal Acknowledgment
                      </Label>
                      <div
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          acknowledged
                            ? "bg-primary/[0.05] border-primary"
                            : "bg-white border-slate-200 hover:border-primary/40",
                        )}
                        onClick={() => setAcknowledged(!acknowledged)}>
                        <Checkbox
                          id="ack"
                          checked={acknowledged}
                          onCheckedChange={(val) =>
                            setAcknowledged(val === true)
                          }
                          className="h-5 w-5 border-2 rounded-md"
                        />
                        <label
                          htmlFor="ack"
                          className="text-xs font-bold text-foreground leading-tight cursor-pointer select-none">
                          I hereby confirm that the information provided is
                          correct and I intend to enroll for the upcoming
                          school year.
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label
                        htmlFor="guardian"
                        className="text-[10px] font-black uppercase text-foreground tracking-widest ml-1">
                        Digital Signature (Parent/Guardian Full Name)
                      </Label>
                      <div className="relative">
                        <Input
                          id="guardian"
                          placeholder="ENTER FULL NAME"
                          value={guardianName}
                          onChange={(e) =>
                            setGuardianName(e.target.value.toUpperCase())
                          }
                          className="h-12 px-5 rounded-xl border-2 border-slate-200 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0 font-black uppercase text-sm tracking-widest placeholder:text-slate-300 transition-all bg-white"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none opacity-40">
                          <UserCheck className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-foreground italic ml-1 leading-relaxed">
                        Entering your full name serves as your legally binding
                        electronic signature for this confirmation.
                      </p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 sm:p-8 flex flex-col gap-3">
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      onClick={handleTransferRequest}
                      className="h-11 rounded-xl font-bold text-xs uppercase tracking-wide border-slate-300 text-slate-700 hover:bg-slate-100">
                      I am not returning (Request Transfer)
                    </Button>

                    <Button
                      size="lg"
                      disabled={!acknowledged || !guardianName || isSubmitting}
                      onClick={handleConfirmReturn}
                      className="h-12 w-full rounded-xl font-black uppercase tracking-wide text-sm shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Confirm Return
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex w-full justify-end">
                    <Button
                      variant="ghost"
                      onClick={onLogout}
                      className="h-10 rounded-xl font-semibold text-xs uppercase tracking-wide text-slate-600 hover:bg-slate-200">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </CardFooter>
                </Card>
              </motion.div>

              {/* DPA Footer */}
              <div className="text-center text-slate-500 flex items-center justify-center gap-2 px-6">
                <Info className="h-4 w-4 shrink-0" />
                <p className="text-xs font-medium leading-relaxed max-w-lg">
                  Strictly compliant with R.A. 10173 (Data Privacy Act of 2012).
                  Your digital signature is recorded for audit purposes.
                </p>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl mx-auto py-12">
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Card className="shadow-2xl border-none text-center p-12 space-y-8 bg-white/95 backdrop-blur-md">
                <div className="mx-auto w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner ring-8 ring-emerald-50">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">
                    Confirmation Saved!
                  </h2>
                  <p className="text-slate-500 font-bold text-lg">
                    Your return is confirmed. Please wait for official sectioning.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 max-w-sm mx-auto">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Current Status</span>
                    <span className="text-emerald-600 font-black">
                      VERIFIED ✓
                    </span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Digital Signature
                    </span>
                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      {guardianName}
                    </span>
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => onSuccess("COMPLETE")}
                    className="h-16 px-16 rounded-xl font-black uppercase text-base shadow-xl shadow-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98]">
                    Continue to Dashboard{" "}
                    <ArrowRight className="ml-4 h-6 w-6" />
                  </Button>
                </div>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}

function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default"
          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80"
          : "text-foreground",
        className,
      )}>
      {children}
    </span>
  );
}
