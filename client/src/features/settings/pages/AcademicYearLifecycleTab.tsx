import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  Lock,
  Unlock,
  CheckCircle2,
  History,
  ShieldAlert,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { motion, useReducedMotion } from "motion/react";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";
import { AdminPinInput } from "@/shared/components/AdminPinInput";
import EmergencyEosyUnlockModal from "../components/EmergencyEosyUnlockModal";
import ExecuteRolloverModal from "../components/ExecuteRolloverModal";
import {
  getReducedMotionProps,
  listVariants,
  panelTransition,
  sectionVariants,
  staggerTransition,
} from "@/shared/lib/motion";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";

const UNLOCK_CATEGORIES = [
  "Division Office Mandate / Extension",
  "Critical Data Correction",
  "System Rollback / Recovery",
  "Other (Please Specify)",
];

export default function AcademicYearLifecycleTab() {
  const { activeSchoolYearLabel, activeSchoolYearStatus, systemStatus, bosyLockedAt, activeSchoolYearId, setSettings, setViewingSY } =
    useSettingsStore();

  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isEosyUnlockModalOpen, setIsEosyUnlockModalOpen] = useState(false);

  // --- Unlock State ---
  const [unlockCategory, setUnlockCategory] = useState("");
  const [unlockJustification, setUnlockJustification] = useState("");
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockPinTouched, setUnlockPinTouched] = useState(false);

  const isUnlockPinValid = /^\d{6}$/.test(unlockPin);
  const isUnlockFormValid =
    unlockCategory !== "" &&
    unlockJustification.length >= 10 &&
    isUnlockPinValid;

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isEosyFinalized, setIsEosyFinalized] = useState(false);

  type LifecyclePhase = "ENROLLMENT" | "ACADEMIC" | "ROLLOVER_READY";
  const resolvedLifecycleStatus = activeSchoolYearStatus ?? systemStatus;
  const currentPhase: LifecyclePhase =
    isEosyFinalized
      ? "ROLLOVER_READY"
      : resolvedLifecycleStatus === "BOSY_LOCKED" || resolvedLifecycleStatus === "ARCHIVED"
      ? "ACADEMIC"
      : "ENROLLMENT";
  const isLocked = currentPhase !== "ENROLLMENT";
  const shouldReduceMotion = useReducedMotion() ?? false;
  const motionState = getReducedMotionProps(shouldReduceMotion);

  useEffect(() => {
    let cancelled = false;

    const refreshSettings = async () => {
      try {
        const pubRes = await api.get("/settings/public");
        if (!cancelled) {
          setSettings(pubRes.data);
        }
      } catch {
        // Keep the current store values if the refresh fails.
      }
    };

    void refreshSettings();

    return () => {
      cancelled = true;
    };
  }, [activeSchoolYearId, setSettings]);

  useEffect(() => {
    if (!activeSchoolYearId) {
      setIsEosyFinalized(false);
      return;
    }

    let cancelled = false;

    const refreshExportLock = async () => {
      try {
        const res = await api.get(`/eosy/school-year/${activeSchoolYearId}/export-lock`);
        if (!cancelled) {
          setIsEosyFinalized(Boolean(res.data?.schoolYearFinalized));
        }
      } catch {
        if (!cancelled) {
          setIsEosyFinalized(false);
        }
      }
    };

    void refreshExportLock();

    return () => {
      cancelled = true;
    };
  }, [activeSchoolYearId]);

  // --- Rollover State ---
  const [isExecuteRolloverOpen, setIsExecuteRolloverOpen] = useState(false);

  const handleUnlockBosy = async () => {
    if (unlockCategory === "") {
      lifecycleFeedback.warning(
        "Category Required",
        "Please select an authorization category.",
      );
      return;
    }

    if (unlockJustification.length < 10) {
      lifecycleFeedback.warning(
        "Justification Required",
        "Please provide a detailed justification for this emergency action.",
      );
      return;
    }

    if (!isUnlockPinValid) {
      setUnlockPinTouched(true);
      lifecycleFeedback.warning(
        "PIN Required",
        "Please enter your 6-digit Admin PIN to authorize.",
      );
      return;
    }

    lifecycleFeedback.progress(
      "Processing BOSY Unlock",
      "Reopening the enrollment phase for controlled operational recovery.",
    );
    setIsUnlocking(true);
    try {
      const res = await api.post("/admin/system/unlock-bosy", {
        justification: `[${unlockCategory}] ${unlockJustification}`,
        pin: unlockPin,
      });

      lifecycleFeedback.success("BOSY Unlock Completed", res.data.message);

      // Refresh global settings
      const pubRes = await api.get("/settings/public");
      setSettings(pubRes.data);

      setIsUnlockModalOpen(false);
      setUnlockCategory("");
      setUnlockJustification("");
      setUnlockPin("");
      setUnlockPinTouched(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data
              ?.message
          : err instanceof Error
            ? err.message
            : "Failed to unlock BOSY.";
      lifecycleFeedback.error(
        "BOSY Unlock Failed",
        message || "An unexpected error occurred.",
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <motion.div
      className="space-y-6 max-w-7xl"
      variants={listVariants}
      transition={staggerTransition}
      {...motionState}>
      <motion.div variants={sectionVariants} transition={panelTransition}>
      <Card className={cn("shadow-sm", isLocked ? "bg-slate-50" : "bg-white")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {isLocked ? (
                  <>
                    <Lock className="h-5 w-5 text-primary" />
                    Beginning of School Year Status: Locked
                  </>
                ) : (
                  <>
                    <Unlock className="h-5 w-5 text-primary" />
                    Beginning of School Year Status: Open
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Active School Year:{" "}
                <span className="font-bold text-foreground">
                  {activeSchoolYearLabel}
                </span>
              </CardDescription>
            </div>
            <div
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black uppercase border",
                currentPhase === "ROLLOVER_READY"
                  ? "bg-slate-100 text-slate-600 border-slate-200"
                  : currentPhase === "ACADEMIC"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-100 text-primary border-amber-200",
              )}>
              {currentPhase === "ROLLOVER_READY"
                ? "EOSY FINALIZED"
                : currentPhase === "ACADEMIC"
                  ? "BOSY LOCKED"
                  : "ENROLLMENT OPEN"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentPhase === "ENROLLMENT" ? (
            <Alert className="bg-amber-100/50 border-amber-200 text-primary">
              <AlertTitle className="font-bold">Enrollment Phase Active</AlertTitle>
              <AlertDescription className="text-sm font-bold">
                The system is currently in the Enrollment Phase. Registrars can
                perform batch sectioning and mass verifications. Locking BOSY
                will finalize the official learner rosters (SF1).
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-slate-50 border-slate-200 text-slate-700">
              <Lock className="h-4 w-4 text-slate-400" />
              <AlertTitle className="font-bold text-slate-600">
                BOSY was finalized. Intake is closed.
              </AlertTitle>
              <AlertDescription className="text-sm font-bold text-slate-500">
                Official learner rosters (SF1) have been generated. New
                registrations are now closed for this academic year.
                {bosyLockedAt && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs uppercase font-black opacity-70">
                    <History className="h-3 w-3" />
                    Locked on {format(new Date(bosyLockedAt), "PPP p")}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}


        </CardContent>
        <CardFooter className="bg-white border-t p-6 flex flex-col items-start gap-4">
          {isLocked && (
            <Dialog
              open={isUnlockModalOpen}
              onOpenChange={(open) => {
                setIsUnlockModalOpen(open);
                if (!open) {
                  setUnlockCategory("");
                  setUnlockJustification("");
                  setUnlockPin("");
                  setUnlockPinTouched(false);
                }
              }}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="font-black uppercase  border-primary/20 text-primary hover:bg-primary/5">
                  <Unlock className="mr-2 h-4 w-4" />
                  Emergency BOSY Unlock
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase text-primary flex items-center gap-2">
                    Emergency Unlock Protocol
                  </DialogTitle>
                  <DialogDescription className="font-bold text-foreground pt-2">
                    Reopening BOSY is a heavily restricted action.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  <div className="bg-primary text-primary-foreground p-4 rounded-lg space-y-2 shadow-inner">
                    <p className="text-sm font-black uppercase flex items-center gap-2">
                      System Disruption Warning:
                    </p>
                    <p className="text-[11px] font-bold leading-relaxed opacity-90">
                      Unlocking the system will immediately invalidate the
                      current SF1 rosters. Batch operations will be re-enabled
                      until the system is locked again.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-primary">
                        Authorization Category (Required)
                      </Label>
                      <Select
                        value={unlockCategory}
                        onValueChange={setUnlockCategory}>
                        <SelectTrigger className="font-bold border-primary/20 focus:ring-primary">
                          <SelectValue placeholder="Select a reason category" />
                        </SelectTrigger>
                        <SelectContent>
                          {UNLOCK_CATEGORIES.map((cat) => (
                            <SelectItem
                              key={cat}
                              value={cat}
                              className="font-bold">
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="unlock-reason"
                        className="text-xs font-black uppercase text-primary">
                        Specific Justification (Required for Audit)
                      </Label>
                      <Textarea
                        id="unlock-reason"
                        placeholder="Provide the specific mandate or administrative reason..."
                        value={unlockJustification}
                        onChange={(e) => setUnlockJustification(e.target.value)}
                        className="min-h-[80px] font-bold border-primary/20 focus-visible:ring-primary"
                      />
                    </div>

                    <div className="space-y-3 pt-2 border-t border-primary/10">
                      <Label className="text-xs font-black uppercase text-primary">
                        Enter 6-Digit Admin PIN to Override:
                      </Label>
                      <AdminPinInput
                        value={unlockPin}
                        onChange={setUnlockPin}
                        invalid={unlockPinTouched && !isUnlockPinValid}
                        onBlur={() => setUnlockPinTouched(true)}
                        autoFocus={isUnlockModalOpen}
                        disabled={isUnlocking}
                        ariaLabel="BOSY unlock admin PIN"
                      />
                      {unlockPinTouched && !isUnlockPinValid && (
                        <p className="text-xs text-primary font-bold uppercase animate-in fade-in slide-in-from-top-1 duration-200">
                          Valid 6-digit administrative PIN required
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="ghost"
                    onClick={() => setIsUnlockModalOpen(false)}
                    disabled={isUnlocking}
                    className="font-bold">
                    Cancel
                  </Button>
                  <Button
                    className={cn(
                      "font-black uppercase  transition-all px-6 shrink-0",
                      !isUnlockFormValid || isUnlocking
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-b-4 border-primary/20 active:border-b-0 active:translate-y-1",
                    )}
                    onClick={handleUnlockBosy}
                    disabled={!isUnlockFormValid || isUnlocking}>
                    {isUnlocking ? (
                      "Processing..."
                    ) : (
                      <>
                        <ShieldAlert className="mr-2 h-4 w-4" /> Force System
                        Unlock
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      </Card>
      </motion.div>

      <Card
        className={cn(
          "shadow-sm",
          currentPhase === "ROLLOVER_READY"
            ? "bg-white border-emerald-200"
            : "bg-slate-50/50 border-slate-200",
        )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle
                className={cn(
                  "text-xl flex items-center gap-2",
                  currentPhase !== "ROLLOVER_READY" && "text-slate-500",
                )}>
                <RotateCcw
                  className={cn(
                    "h-5 w-5",
                    currentPhase === "ROLLOVER_READY"
                      ? "text-emerald-600"
                      : "text-slate-400",
                  )}
                />
                School Year Rollover
              </CardTitle>
              <CardDescription>
                Active School Year:{" "}
                <span className="font-bold text-foreground">
                  {activeSchoolYearLabel}
                </span>
              </CardDescription>
            </div>
            <div
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black uppercase border",
                currentPhase === "ROLLOVER_READY"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200",
              )}>
              {currentPhase === "ROLLOVER_READY" ? "READY" : "LOCKED"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentPhase === "ROLLOVER_READY" ? (
            <Alert className="bg-emerald-100/50 border-emerald-200 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-bold">EOSY Finalized — Ready for Rollover</AlertTitle>
              <AlertDescription className="text-sm font-bold">
                All sections have been finalized and EOSY is complete. Initiating rollover will archive
                the current school year and create the next one with the carried-over learner population.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-50 border-amber-200 text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-bold">Rollover Locked</AlertTitle>
              <AlertDescription className="text-sm font-bold">
                All class sections must complete End of School Year (EOSY) finalization before
                rollover can be initiated.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
          <CardFooter className={cn("border-t p-6", currentPhase === "ROLLOVER_READY" ? "bg-white" : "bg-slate-50/50")}>
            {currentPhase !== "ROLLOVER_READY" ? null : (
            <div className="flex flex-wrap items-center gap-3">
            <Button
              className="font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 shadow-lg"
              onClick={() => setIsExecuteRolloverOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Initiate School Year Rollover
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEosyUnlockModalOpen(true)}
              className="font-black uppercase border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700">
              <ShieldAlert className="mr-2 h-4 w-4" />
              Emergency EOSY Unlock
            </Button>
            </div>
            )}
          </CardFooter>
        </Card>

      <EmergencyEosyUnlockModal
        open={isEosyUnlockModalOpen}
        schoolYearId={activeSchoolYearId}
        schoolYearLabel={activeSchoolYearLabel}
        onOpenChange={setIsEosyUnlockModalOpen}
        onSuccess={async () => {
          const pubRes = await api.get("/settings/public");
          setSettings(pubRes.data);
        }}
      />
      <ExecuteRolloverModal
        open={isExecuteRolloverOpen}
        activeSchoolYearLabel={activeSchoolYearLabel}
        onOpenChange={setIsExecuteRolloverOpen}
        onSuccess={async () => {
          const pubRes = await api.get("/settings/public");
          setSettings(pubRes.data);
          // Clear any viewing override so the SY switcher reflects the new active year.
          setViewingSY(null, null, null);
        }}
      />
    </motion.div>
  );
}
