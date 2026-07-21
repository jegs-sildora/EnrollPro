import { useState, useEffect, memo, useCallback } from "react";
import { Archive, History, ShieldAlert, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useSettingsStore } from "@/store/settings.slice";
import { useAuthStore } from "@/store/auth.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";

interface HistoricalBannerProps {
  onOpenCorrectionModal?: () => void;
}

export const HistoricalBanner = memo(function HistoricalBanner({
  onOpenCorrectionModal,
}: HistoricalBannerProps) {
  const {
    isHistoricalReadOnly,
    isArchivedYear,
    viewingSchoolYearStatus,
    hasOverride,
    isSystemAdmin,
  } = useHistoricalReadOnly();

  const {
    viewingSchoolYearLabel,
    viewingSchoolYearId,
    activeSchoolYearLabel,
    triggerSchoolYearSwitch,
    setViewingSY,
    setHistoricalCorrectionToken,
    historicalCorrectionExpiresAt,
    activeCorrection,
  } = useSettingsStore();

  const { user } = useAuthStore();
  const [timeLeft, setTimeLeft] = useState<string>("");

  const isLockedByOther =
    activeCorrection &&
    activeCorrection.expiresAt > Date.now() &&
    activeCorrection.userId !== user?.id;

  // Countdown timer effect
  useEffect(() => {
    if (!hasOverride || !historicalCorrectionExpiresAt) return;

    const updateTimer = () => {
      const remaining = historicalCorrectionExpiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft("00:00");
        // Dispatch auto-commit event
        window.dispatchEvent(new CustomEvent("historical-correction:trigger-commit"));
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hasOverride, historicalCorrectionExpiresAt]);

  if (!isHistoricalReadOnly) return null;

  const handleSwitchToActive = () => {
    triggerSchoolYearSwitch(null, null, activeSchoolYearLabel);
  };

  const handleRelock = () => {
    // Fire the commit event which also performs manual relock save/relock flow
    window.dispatchEvent(new CustomEvent("historical-correction:trigger-commit"));
  };

  const icon = isArchivedYear ? (
    <Archive className="h-3.5 w-3.5 shrink-0" />
  ) : (
    <History className="h-3.5 w-3.5 shrink-0" />
  );

  const syLabel = viewingSchoolYearLabel ? `S.Y. ${viewingSchoolYearLabel}` : null;

  // Render concurrency lock warning banner
  if (isLockedByOther) {
    return (
      <div className="flex items-center gap-3 border-b px-4 py-2 text-sm font-extrabold bg-rose-50 border-rose-200 text-rose-950">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-600" />
        <span className="flex-1 min-w-0 truncate">
          S.Y. {viewingSchoolYearLabel || "2026-2027"} is currently undergoing active correction by {activeCorrection.userName}. Records are temporarily locked.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-sm font-extrabold hover:bg-background text-rose-900"
          onClick={handleSwitchToActive}
        >
          Switch to Active Year
        </Button>
      </div>
    );
  }

  const message = hasOverride
    ? `Historical Correction Mode Active: S.Y. ${viewingSchoolYearLabel || "2026-2027"}. Records will automatically lock in ${timeLeft || "10:00"}.`
    : isArchivedYear
      ? `You are browsing archived school year${syLabel ? ` ${syLabel}` : ""}. All records are read-only.`
      : `You are viewing ${syLabel ?? "a historical school year"} (${viewingSchoolYearStatus ?? "past"}). Mutations are restricted.`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2 text-sm font-extrabold transition-colors duration-200",
        hasOverride
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-muted border-border text-foreground",
      )}
    >
      {icon}

      <span className="flex-1 min-w-0 truncate">{message}</span>

      {hasOverride && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-400 bg-amber-100 text-amber-800 text-sm font-extrabold uppercase"
        >
          <ShieldAlert className="h-3 w-3 mr-1 animate-pulse" />
          Correction Override Active
        </Badge>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {isSystemAdmin && !hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-sm font-extrabold hover:bg-background"
            onClick={onOpenCorrectionModal}
          >
            <ShieldAlert className="h-3 w-3 mr-1" />
            Authorize Correction
          </Button>
        )}

        {hasOverride && (
          <Button
            variant="default"
            size="sm"
            className="h-7 px-3 text-sm font-extrabold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            onClick={handleRelock}
          >
            <X className="h-3 w-3 mr-1" />
            Relock Historical Records
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-sm font-extrabold hover:bg-background"
          onClick={handleSwitchToActive}
        >
          Switch to Active Year
        </Button>
      </div>
    </div>
  );
});
