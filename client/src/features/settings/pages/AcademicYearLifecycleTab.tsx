import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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
  AlertTriangle,
  CheckCircle2,
  History,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";

interface PreLockStats {
  pendingCount: number;
  unsectionedCount: number;
  sectionedCount: number;
}

const UNLOCK_CATEGORIES = [
  "Division Office Mandate / Extension",
  "Critical Data Correction",
  "System Rollback / Recovery",
  "Other (Please Specify)",
];

export default function AcademicYearLifecycleTab() {
  const { activeSchoolYearLabel, systemStatus, bosyLockedAt, setSettings } =
    useSettingsStore();

  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

  // --- Lock State ---
  const [lockConfirmLabel, setLockConfirmLabel] = useState("");
  const [lockConfirmTouched, setLockConfirmTouched] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(Array(6).fill(""));
  const [pinTouched, setPinTouched] = useState(false);
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);
  const lockPin = pinDigits.join("");
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isLockConfirmValid = lockConfirmLabel === activeSchoolYearLabel;
  const isPinValid = lockPin.length === 6;

  const [isLocking, setIsLocking] = useState(false);

  // --- Unlock State ---
  const [unlockCategory, setUnlockCategory] = useState("");
  const [unlockJustification, setUnlockJustification] = useState("");
  const [unlockPinDigits, setUnlockPinDigits] = useState<string[]>(
    Array(6).fill(""),
  );
  const [unlockPinTouched, setUnlockPinTouched] = useState(false);
  const [unlockVisibleIndices, setUnlockVisibleIndices] = useState<number[]>(
    [],
  );
  const unlockPin = unlockPinDigits.join("");
  const unlockPinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isUnlockPinValid = unlockPin.length === 6;
  const isUnlockFormValid =
    unlockCategory !== "" &&
    unlockJustification.length >= 10 &&
    isUnlockPinValid;

  const [isUnlocking, setIsUnlocking] = useState(false);

  const [preLockStats, setPreLockStats] = useState<PreLockStats | null>(null);

  const isLocked = systemStatus === "BOSY_LOCKED";
  const totalIncomplete =
    (preLockStats?.pendingCount ?? 0) + (preLockStats?.unsectionedCount ?? 0);
  const isLockBlocked = !isLocked && totalIncomplete > 0;

  const fetchStatus = async () => {
    try {
      const res = await api.get("/admin/system/status");
      if (res.data.preLockStats) {
        setPreLockStats(res.data.preLockStats);
      }
    } catch (err) {
      console.error("Failed to fetch pre-lock stats", err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [systemStatus]);

  const handleLockBosy = async () => {
    if (lockConfirmLabel !== activeSchoolYearLabel) {
      setLockConfirmTouched(true);
      sileo.error({
        title: "Validation Failed",
        description: "School year label does not match.",
      });
      return;
    }

    if (!/^\d{6}$/.test(lockPin)) {
      setPinTouched(true);
      sileo.error({
        title: "Invalid PIN",
        description: "Please enter a valid 6-digit Admin PIN.",
      });
      return;
    }

    setIsLocking(true);
    try {
      const res = await api.post("/admin/system/lock-bosy", {
        pin: lockPin,
        yearLabel: lockConfirmLabel,
      });

      sileo.success({
        title: "BOSY Locked",
        description: res.data.message,
      });

      // Refresh global settings
      const pubRes = await api.get("/settings/public");
      setSettings(pubRes.data);

      setIsLockModalOpen(false);
      setLockConfirmLabel("");
      setLockConfirmTouched(false);
      setPinDigits(Array(6).fill(""));
      setPinTouched(false);
      setVisibleIndices([]);
      fetchStatus();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data
              ?.message
          : err instanceof Error
            ? err.message
            : "Failed to lock BOSY.";
      sileo.error({
        title: "Lock Failed",
        description: message || "An unexpected error occurred.",
      });
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockBosy = async () => {
    if (unlockCategory === "") {
      sileo.error({
        title: "Category Required",
        description: "Please select an authorization category.",
      });
      return;
    }

    if (unlockJustification.length < 10) {
      sileo.error({
        title: "Justification Required",
        description:
          "Please provide a detailed justification for this emergency action.",
      });
      return;
    }

    if (!isUnlockPinValid) {
      setUnlockPinTouched(true);
      sileo.error({
        title: "PIN Required",
        description: "Please enter your 6-digit Admin PIN to authorize.",
      });
      return;
    }

    setIsUnlocking(true);
    try {
      const res = await api.post("/admin/system/unlock-bosy", {
        justification: `[${unlockCategory}] ${unlockJustification}`,
        pin: unlockPin,
      });

      sileo.success({
        title: "BOSY Unlocked",
        description: res.data.message,
      });

      // Refresh global settings
      const pubRes = await api.get("/settings/public");
      setSettings(pubRes.data);

      setIsUnlockModalOpen(false);
      setUnlockCategory("");
      setUnlockJustification("");
      setUnlockPinDigits(Array(6).fill(""));
      setUnlockPinTouched(false);
      setUnlockVisibleIndices([]);
      fetchStatus();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data
              ?.message
          : err instanceof Error
            ? err.message
            : "Failed to unlock BOSY.";
      sileo.error({
        title: "Unlock Failed",
        description: message || "An unexpected error occurred.",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlockPinChange = (index: number, value: string) => {
    const newDigits = [...unlockPinDigits];
    const cleanValue = value.replace(/\D/g, "").slice(-1);

    if (cleanValue) {
      newDigits[index] = cleanValue;
      setUnlockPinDigits(newDigits);

      setUnlockVisibleIndices((prev) => [...prev, index]);
      setTimeout(() => {
        setUnlockVisibleIndices((prev) => prev.filter((i) => i !== index));
      }, 1000);

      if (index < 5) {
        unlockPinInputRefs.current[index + 1]?.focus();
      }
    } else if (value === "") {
      newDigits[index] = "";
      setUnlockPinDigits(newDigits);
    }
  };

  const handleUnlockPinKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !unlockPinDigits[index] && index > 0) {
      unlockPinInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePinChange = (index: number, value: string) => {
    const newDigits = [...pinDigits];
    // Only allow numbers
    const cleanValue = value.replace(/\D/g, "").slice(-1);

    if (cleanValue) {
      newDigits[index] = cleanValue;
      setPinDigits(newDigits);

      // Show digit for 1 second
      setVisibleIndices((prev) => [...prev, index]);
      setTimeout(() => {
        setVisibleIndices((prev) => prev.filter((i) => i !== index));
      }, 1000);

      // Auto-advance
      if (index < 5) {
        pinInputRefs.current[index + 1]?.focus();
      }
    } else if (value === "") {
      // Allow deletion
      newDigits[index] = "";
      setPinDigits(newDigits);
    }
  };

  const handlePinKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <Card className={cn("bg-white shadow-sm")}>
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
              className={`px-4 py-1.5 rounded-full text-xs font-black uppercase  border ${
                isLocked
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-amber-100 text-primary border-amber-200"
              }`}>
              {systemStatus?.replace("_", " ")}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked ? (
            <Alert className="bg-emerald-100/50 border-emerald-200 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-bold">
                Academic Phase Active
              </AlertTitle>
              <AlertDescription className="text-sm font-medium">
                Official enrollment has ended. SF1 rosters are finalized and
                synchronized with A.T.L.A.S. and S.M.A.R.T. New registrations
                are now classified as "Late Enrollees".
                {bosyLockedAt && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs uppercase font-black opacity-70">
                    <History className="h-3 w-3" />
                    Locked on {format(new Date(bosyLockedAt), "PPP p")}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-100/50 border-amber-200 text-primary">
              <AlertTitle className="font-bold">
                Enrollment Phase Active
              </AlertTitle>
              <AlertDescription className="text-sm font-medium">
                The system is currently in the Enrollment Phase. Registrars can
                perform batch sectioning and mass verifications. Locking BOSY
                will finalize the official learner rosters (SF1).
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl border bg-white space-y-3">
              <h4 className="text-sm font-black uppercase  flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                PRE-LOCK READINESS
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-50 pb-1">
                  <span className="text-sm font-bold text-slate-600">
                    Learners Sectioned:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">
                      {preLockStats?.sectionedCount?.toLocaleString() ?? "..."}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-50 pb-1">
                  <span className="text-sm font-bold text-slate-600">
                    Unsectioned (Ready):
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-black ${preLockStats && preLockStats.unsectionedCount > 0 ? "text-primary" : "text-slate-900"}`}>
                      {preLockStats?.unsectionedCount?.toLocaleString() ??
                        "..."}
                    </span>
                    {preLockStats && preLockStats.unsectionedCount === 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600">
                    Pending Verification:
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-black ${preLockStats && preLockStats.pendingCount > 0 ? "text-primary" : "text-slate-900"}`}>
                      {preLockStats?.pendingCount?.toLocaleString() ?? "..."}
                    </span>
                    {preLockStats && preLockStats.pendingCount === 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-white space-y-3">
              <h4 className="text-sm font-black uppercase  flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                System Restrictions
              </h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${isLocked ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                  Batch Operations: {isLocked ? "Disabled" : "Enabled"}
                </li>
                <li className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${isLocked ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                  Late Enrollment Flow: {isLocked ? "Active" : "Inactive"}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-white border-t p-6 flex flex-col items-start gap-4">
          {!isLocked ? (
            <>
              <Dialog
                open={isLockModalOpen}
                onOpenChange={(open) => {
                  setIsLockModalOpen(open);
                  if (!open) {
                    setLockConfirmLabel("");
                    setLockConfirmTouched(false);
                    setPinDigits(Array(6).fill(""));
                    setPinTouched(false);
                    setVisibleIndices([]);
                  }
                }}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-b-4 border-primary/20 active:border-b-0 active:translate-y-1 font-black uppercase  transition-all px-8 h-12">
                    <Lock className="mr-2 h-5 w-5" />
                    Initiate BOSY Lockdown
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase text-primary flex items-center gap-2">
                      <ShieldAlert className="h-6 w-6" />
                      <Lock className="h-6 w-6" />
                      Authorize BOSY Lockdown
                    </DialogTitle>
                    <DialogDescription className="font-bold text-foreground pt-2">
                      You are about to end the official enrollment period for
                      S.Y. {activeSchoolYearLabel}.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                      <p className="text-sm font-bold text-primary underline uppercase ">
                        Critical Impacts:
                      </p>
                      <ul className="text-xs font-medium space-y-1 list-disc pl-4 text-primary/80">
                        <li>
                          Mass batch sectioning will be disabled immediately.
                        </li>
                        <li>
                          SF1 learner rosters will be finalized and sent to
                          A.T.L.A.S. and S.M.A.R.T.
                        </li>
                        <li>
                          Registrars will transition to Late Enrollment
                          workflow.
                        </li>
                        <li>
                          This action is recorded in the permanent System Audit
                          Log.
                        </li>
                      </ul>
                    </div>

                    {isLockBlocked ? (
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-black text-primary uppercase">
                            Lockdown Blocked
                          </p>
                          <p className="text-xs font-bold text-primary mt-1 leading-relaxed">
                            You have {totalIncomplete} Unsectioned or Pending
                            Learners. All active learners must be assigned to a
                            section before SF1 generation can begin.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <p className="text-xs font-bold text-emerald-800 uppercase">
                            PRE-FLIGHT CHECK PASSED: 0 Pending Learners, 0
                            Unsectioned.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="confirm-sy"
                              className="text-xs font-black uppercase">
                              Type "{activeSchoolYearLabel}" below to confirm:
                            </Label>
                            <div className="relative">
                              <Input
                                id="confirm-sy"
                                placeholder=""
                                value={lockConfirmLabel}
                                onChange={(e) =>
                                  setLockConfirmLabel(e.target.value)
                                }
                                onBlur={() => setLockConfirmTouched(true)}
                                className={cn(
                                  "font-bold uppercase pr-10",
                                  lockConfirmTouched &&
                                    !isLockConfirmValid &&
                                    "border-primary focus-visible:ring-primary",
                                )}
                              />
                              {lockConfirmLabel === activeSchoolYearLabel &&
                                lockConfirmLabel !== "" && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                                    <CheckCircle2 className="h-5 w-5" />
                                  </div>
                                )}
                            </div>
                            {lockConfirmTouched && !isLockConfirmValid && (
                              <p className="text-xs text-primary font-bold uppercase animate-in fade-in slide-in-from-top-1 duration-200">
                                School Year label does not match
                              </p>
                            )}
                          </div>

                          <div className="space-y-3">
                            <Label className="text-xs font-black uppercase">
                              Enter 6-Digit Admin PIN:
                            </Label>
                            <div className="flex justify-between gap-2">
                              {pinDigits.map((digit, idx) => (
                                <Input
                                  key={idx}
                                  ref={(el) => {
                                    pinInputRefs.current[idx] = el;
                                  }}
                                  type={
                                    visibleIndices.includes(idx)
                                      ? "text"
                                      : "password"
                                  }
                                  inputMode="numeric"
                                  maxLength={1}
                                  value={digit}
                                  onChange={(e) =>
                                    handlePinChange(idx, e.target.value)
                                  }
                                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                                  onBlur={() => setPinTouched(true)}
                                  className={cn(
                                    "w-12 h-14 text-center text-xl font-black focus-visible:ring-primary",
                                    pinTouched &&
                                      !isPinValid &&
                                      "border-primary focus-visible:ring-primary",
                                  )}
                                />
                              ))}
                            </div>
                            {pinTouched && !isPinValid && (
                              <p className="text-xs text-primary font-bold uppercase animate-in fade-in slide-in-from-top-1 duration-200">
                                Valid 6-digit administrative PIN required
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setIsLockModalOpen(false)}
                      disabled={isLocking}>
                      Cancel
                    </Button>
                    {!isLockBlocked && (
                      <Button
                        className={cn(
                          "font-black uppercase  transition-all px-6",
                          isLocking ||
                            lockConfirmLabel !== activeSchoolYearLabel ||
                            lockPin.length !== 6
                            ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-b-4 border-primary/20 active:border-b-0 active:translate-y-1",
                        )}
                        onClick={handleLockBosy}
                        disabled={
                          isLocking ||
                          lockConfirmLabel !== activeSchoolYearLabel ||
                          lockPin.length !== 6
                        }>
                        {isLocking
                          ? "Locking System..."
                          : "Confirm & Execute Lockdown"}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Dialog
              open={isUnlockModalOpen}
              onOpenChange={(open) => {
                setIsUnlockModalOpen(open);
                if (!open) {
                  setUnlockCategory("");
                  setUnlockJustification("");
                  setUnlockPinDigits(Array(6).fill(""));
                  setUnlockPinTouched(false);
                  setUnlockVisibleIndices([]);
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
                      current SF1 rosters and pause synchronization with the
                      Grading and Scheduling engines until the system is locked
                      again.
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
                      <div className="flex justify-between gap-2">
                        {unlockPinDigits.map((digit, idx) => (
                          <Input
                            key={idx}
                            ref={(el) => {
                              unlockPinInputRefs.current[idx] = el;
                            }}
                            type={
                              unlockVisibleIndices.includes(idx)
                                ? "text"
                                : "password"
                            }
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) =>
                              handleUnlockPinChange(idx, e.target.value)
                            }
                            onKeyDown={(e) => handleUnlockPinKeyDown(idx, e)}
                            onBlur={() => setUnlockPinTouched(true)}
                            className={cn(
                              "w-12 h-14 text-center text-xl font-black focus-visible:ring-primary border-primary/20",
                              unlockPinTouched &&
                                !isUnlockPinValid &&
                                "border-primary bg-primary/5",
                            )}
                          />
                        ))}
                      </div>
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
    </div>
  );
}
