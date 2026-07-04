import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Printer,
  Timer,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

const FORCE_DELAY_MS = 3000;

interface OneTimePinSuccessDialogProps {
  learnerName: string;
  trackingNumber: string;
  sectionName: string;
  gradeLevelLabel: string;
  portalPin: string;
  onAcknowledge: () => void;
}

export function OneTimePinSuccessDialog({
  learnerName,
  trackingNumber,
  sectionName,
  gradeLevelLabel,
  portalPin,
  onAcknowledge,
}: OneTimePinSuccessDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.ceil(FORCE_DELAY_MS / 1000),
  );
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unlockAt = Date.now() + FORCE_DELAY_MS;

    const countdown = window.setInterval(() => {
      const remainingMs = unlockAt - Date.now();
      if (remainingMs <= 0) {
        setSecondsLeft(0);
        window.clearInterval(countdown);
        return;
      }

      setSecondsLeft(Math.ceil(remainingMs / 1000));
    }, 120);

    return () => {
      window.clearInterval(countdown);
    };
  }, []);

  const canContinue = secondsLeft === 0 && isAcknowledged;

  const handleCopyPin = async () => {
    try {
      await navigator.clipboard.writeText(portalPin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-3xl w-full p-0 overflow-hidden border-2 border-emerald-200 [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader className="space-y-2 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="space-y-1 text-left">
              <DialogTitle className="text-base leading-tight text-emerald-900 sm:text-lg font-extrabold uppercase ">
                Official Enrollment Confirmed
              </DialogTitle>
              <DialogDescription className="text-base text-emerald-800/90 sm:text-base leading-tight font-extrabold">
                One-time learner portal PIN captured for{" "}
                <span className="font-extrabold text-emerald-900">
                  {learnerName}
                </span>
                .
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:grid-cols-3">
            <div>
              <p className="text-[0.65rem] text-emerald-700/90 font-extrabold uppercase ">
                Tracking No.
              </p>
              <p className="text-base leading-tight font-extrabold text-emerald-950">
                {trackingNumber}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] text-emerald-700/90 font-extrabold uppercase ">
                Grade Level
              </p>
              <p className="text-base leading-tight font-extrabold text-emerald-950">
                {gradeLevelLabel}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] text-emerald-700/90 font-extrabold uppercase ">
                Section
              </p>
              <p className="text-base leading-tight font-extrabold text-emerald-950">
                {sectionName}
              </p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <p className="text-base text-amber-800 font-extrabold uppercase ">
                  Volatile Data Warning
                </p>
                <p className="text-base text-amber-900/90 font-extrabold leading-relaxed">
                  This PIN is shown only once. After this dialog closes, it
                  cannot be retrieved from this screen.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-4 text-center">
            <p className="text-[0.65rem] text-emerald-700/90 font-extrabold uppercase ">
              Learner Portal One-Time PIN
            </p>
            <p className=" text-4xl  text-emerald-900 sm:text-5xl font-extrabold">
              {portalPin}
            </p>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 border-emerald-300 px-3 text-base font-extrabold",
                copied && "bg-emerald-100 text-emerald-900",
              )}
              onClick={handleCopyPin}>
              <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
              {copied ? "PIN Copied" : "Copy PIN"}
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-base text-slate-700">
              <Timer className="h-3.5 w-3.5" />
              <span className="font-extrabold">
                Required review pause:{" "}
                {secondsLeft > 0 ? `${secondsLeft}s` : "Complete"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="one-time-pin-acknowledgement"
                checked={isAcknowledged}
                disabled={secondsLeft > 0}
                onCheckedChange={(checked) =>
                  setIsAcknowledged(checked === true)
                }
                className="mt-0.5"
              />
              <label
                htmlFor="one-time-pin-acknowledgement"
                className="cursor-pointer text-base text-slate-800 sm:text-base font-extrabold leading-relaxed">
                I confirm the PIN has been written on the enrollment slip and/or
                copied to the registrar secure handoff record.
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 px-6 pb-6 pt-0 sm:flex-row sm:justify-between sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="text-base font-extrabold"
            onClick={() => window.print()}>
            <Printer className="mr-2 h-3.5 w-3.5" />
            Print / Write on Slip First
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-base hover:bg-emerald-700 font-extrabold"
            disabled={!canContinue}
            onClick={onAcknowledge}>
            {secondsLeft > 0
              ? `Please wait ${secondsLeft}s`
              : isAcknowledged
                ? "Done - Return to Pending Verification"
                : "Acknowledge before continuing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
