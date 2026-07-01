import { useState } from "react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

interface HistoricalCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoricalCorrectionModal({
  open,
  onOpenChange,
}: HistoricalCorrectionModalProps) {
  const { viewingSchoolYearId, setHistoricalCorrectionToken } = useSettingsStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post<{ overrideToken: string; expiresAt: number }>(
        "/admin/historical-correction/authorize",
        {
          schoolYearId: viewingSchoolYearId,
        },
      );
      setHistoricalCorrectionToken(data.overrideToken, data.expiresAt);
      sileo.success({
        title: "Override Authorized",
        description:
          "Historical correction mode is active for 10 minutes. All changes will be permanently logged.",
      });
      onOpenChange(false);
    } catch (err: unknown) {
      sileo.error({
        title: "Authorization Failed",
        description: "Could not authorize historical correction. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title="Authorize Historical Correction"
      description="You are about to unlock an archived school year. This grants temporary access to modify historical data. Ensure all corrections align with official Form 137 / SF10 records."
      onConfirm={handleSubmit}
      confirmText="Unlock Historical Records"
      cancelText="Cancel"
      loading={loading}
      variant="warning"
    />
  );
}

