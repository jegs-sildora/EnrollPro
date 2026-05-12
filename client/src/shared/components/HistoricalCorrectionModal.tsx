import { useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

interface HistoricalCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoricalCorrectionModal({
  open,
  onOpenChange,
}: HistoricalCorrectionModalProps) {
  const { viewingSchoolYearId, setHistoricalCorrectionToken } =
    useSettingsStore();

  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 20;
  const canSubmit =
    password.trim().length > 0 &&
    reason.trim().length >= 20 &&
    !!viewingSchoolYearId &&
    !loading;

  const handleClose = () => {
    if (loading) return;
    setPassword("");
    setReason("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { data } = await api.post<{ overrideToken: string }>(
        "/admin/historical-correction/authorize",
        {
          password,
          schoolYearId: viewingSchoolYearId,
          reason: reason.trim(),
        },
      );
      setHistoricalCorrectionToken(data.overrideToken);
      sileo.success({
        title: "Override Authorized",
        description:
          "Historical correction mode is active for 10 minutes. All changes will be permanently logged.",
      });
      handleClose();
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })
        ?.response?.data?.code;
      if (code === "INVALID_PASSWORD") {
        sileo.error({
          title: "Incorrect Password",
          description: "The password you entered is incorrect.",
        });
      } else {
        sileo.error({
          title: "Authorization Failed",
          description:
            "Could not authorize historical correction. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Authorize Historical Correction
          </DialogTitle>
          <DialogDescription className="text-xs">
            This grants a 10-minute window to modify a historical school year.
            All actions will be permanently recorded in the audit log. Use only
            when corrections are absolutely necessary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="hc-password"
              className="text-xs font-bold">
              Confirm Your Password
            </Label>
            <Input
              id="hc-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="hc-reason"
              className="text-xs font-bold">
              Reason for Correction{" "}
              <span className="font-normal text-muted-foreground">
                (min. 20 characters)
              </span>
            </Label>
            <Textarea
              id="hc-reason"
              placeholder="Describe what needs to be corrected and why..."
              className="resize-none h-24 text-xs"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
            {reasonTooShort && (
              <p className="text-[0.7rem] text-destructive font-semibold">
                Reason must be at least 20 characters ({reason.trim().length}
                /20)
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-bold"
            onClick={handleClose}
            disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="font-bold"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Authorizing...
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Authorize Override
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
