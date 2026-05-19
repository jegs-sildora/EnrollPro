import { memo } from "react";
import { Archive, History, ShieldAlert, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useSettingsStore } from "@/store/settings.slice";
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

  const { viewingSchoolYearLabel, setViewingSY, setHistoricalCorrectionToken } = useSettingsStore();

  if (!isHistoricalReadOnly) return null;

  const handleSwitchToActive = () => {
    setViewingSY(null, null);
    setTimeout(() => window.location.reload(), 50);
  };

  const handleClearOverride = () => {
    setHistoricalCorrectionToken(null);
  };

  const icon = isArchivedYear ? (
    <Archive className="h-3.5 w-3.5 shrink-0" />
  ) : (
    <History className="h-3.5 w-3.5 shrink-0" />
  );

  const syLabel = viewingSchoolYearLabel ? `S.Y. ${viewingSchoolYearLabel}` : null;
  const message = isArchivedYear
    ? `You are browsing archived school year${syLabel ? ` ${syLabel}` : ""}. All records are read-only.`
    : `You are viewing ${syLabel ?? "a historical school year"} (${viewingSchoolYearStatus ?? "past"}). Mutations are restricted.`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2 text-xs font-semibold",
        hasOverride
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-muted border-border text-muted-foreground",
      )}>
      {icon}

      <span className="flex-1 min-w-0 truncate">{message}</span>

      {hasOverride && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-400 bg-amber-100 text-amber-800 text-[0.625rem] font-black uppercase">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Correction Override Active
        </Badge>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {isSystemAdmin && !hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[0.7rem] font-bold hover:bg-background"
            onClick={onOpenCorrectionModal}>
            <ShieldAlert className="h-3 w-3 mr-1" />
            Authorize Correction
          </Button>
        )}

        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[0.7rem] font-bold text-amber-700 hover:bg-amber-100"
            onClick={handleClearOverride}>
            <X className="h-3 w-3 mr-1" />
            Clear Override
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[0.7rem] font-bold hover:bg-background"
          onClick={handleSwitchToActive}>
          Switch to Active Year
        </Button>
      </div>
    </div>
  );
});
