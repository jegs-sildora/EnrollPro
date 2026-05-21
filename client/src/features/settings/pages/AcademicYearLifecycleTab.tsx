import { useState } from "react";
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
  CheckCircle2,
  History,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";
import { AdminPinInput } from "@/shared/components/AdminPinInput";

const UNLOCK_CATEGORIES = [
  "Division Office Mandate / Extension",
  "Critical Data Correction",
  "System Rollback / Recovery",
  "Other (Please Specify)",
];

export default function AcademicYearLifecycleTab() {
  const { activeSchoolYearLabel, systemStatus, bosyLockedAt, setSettings } =
    useSettingsStore();

  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

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

  const isLocked = systemStatus === "BOSY_LOCKED";
  const isEosyFinalized = systemStatus === "ARCHIVED";

  // --- Rollover State ---
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [rolloverOpeningDate, setRolloverOpeningDate] = useState("");
  const [isRollingOver, setIsRollingOver] = useState(false);

  const handleRollover = async () => {
    if (!rolloverOpeningDate) {
      sileo.error({
        title: "Date Required",
        description: "Please enter the class opening date for the new school year.",
      });
      return;
    }
    setIsRollingOver(true);
    try {
      await api.post("/school-years/rollover", {
        classOpeningDate: rolloverOpeningDate,
      });
      sileo.success({
        title: "School Year Rolled Over",
        description: "The new school year has been created successfully.",
      });
      const pubRes = await api.get("/settings/public");
      setSettings(pubRes.data);
      setIsRolloverModalOpen(false);
      setRolloverOpeningDate("");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data
              ?.message
          : err instanceof Error
            ? err.message
            : "Failed to initiate school year rollover.";
      sileo.error({
        title: "Rollover Failed",
        description: message || "An unexpected error occurred.",
      });
    } finally {
      setIsRollingOver(false);
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
      sileo.error({
        title: "Unlock Failed",
        description: message || "An unexpected error occurred.",
      });
    } finally {
      setIsUnlocking(false);
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
                Official enrollment has ended. SF1 rosters are finalized. New
                registrations are now classified as "Late Enrollees".
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

      {isEosyFinalized && (
        <Card className="bg-white shadow-sm border-emerald-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-emerald-600" />
                  School Year Rollover
                </CardTitle>
                <CardDescription>
                  Active School Year:{" "}
                  <span className="font-bold text-foreground">
                    {activeSchoolYearLabel}
                  </span>
                </CardDescription>
              </div>
              <div className="px-4 py-1.5 rounded-full text-xs font-black uppercase border bg-emerald-100 text-emerald-700 border-emerald-200">
                READY
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-emerald-100/50 border-emerald-200 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-bold">EOSY Finalized — Ready for Rollover</AlertTitle>
              <AlertDescription className="text-sm font-medium">
                All sections have been finalized and EOSY is complete. Initiating rollover will archive
                the current school year and create the next one with the carried-over learner population.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="bg-white border-t p-6">
            <Dialog
              open={isRolloverModalOpen}
              onOpenChange={(open) => {
                setIsRolloverModalOpen(open);
                if (!open) setRolloverOpeningDate("");
              }}>
              <DialogTrigger asChild>
                <Button className="font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 shadow-lg">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Initiate School Year Rollover
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase text-primary flex items-center gap-2">
                    Confirm School Year Rollover
                  </DialogTitle>
                  <DialogDescription className="font-bold text-foreground pt-2">
                    This action will archive the current school year and prepare the next one.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-black uppercase">Rollover will:</p>
                    <ul className="text-[11px] font-bold leading-relaxed opacity-90 space-y-1 list-disc pl-4">
                      <li>Archive the current school year ({activeSchoolYearLabel})</li>
                      <li>Create a new Active school year with the specified opening date</li>
                      <li>Carry over eligible learners and section structure</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="rollover-date"
                      className="text-xs font-black uppercase text-primary">
                      New School Year Class Opening Date (Required)
                    </Label>
                    <Input
                      id="rollover-date"
                      type="date"
                      value={rolloverOpeningDate}
                      onChange={(e) => setRolloverOpeningDate(e.target.value)}
                      className="font-bold border-primary/20 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="ghost"
                    onClick={() => setIsRolloverModalOpen(false)}
                    disabled={isRollingOver}
                    className="font-bold">
                    Cancel
                  </Button>
                  <Button
                    className={cn(
                      "font-black uppercase transition-all px-6 shrink-0",
                      !rolloverOpeningDate || isRollingOver
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1",
                    )}
                    onClick={handleRollover}
                    disabled={!rolloverOpeningDate || isRollingOver}>
                    {isRollingOver ? (
                      "Processing..."
                    ) : (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4" /> Confirm Rollover
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
