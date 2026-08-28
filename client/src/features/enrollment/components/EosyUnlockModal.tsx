import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Unlock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  targetName: string;
}

export function EosyUnlockModal({ open, onOpenChange, onConfirm, loading, targetName }: Props) {
  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title={`UNLOCK ${targetName.toUpperCase()} RECORDS`}
      variant="danger"
      icon={Unlock}
      description={
        <span>
          You are about to unlock the finalized End of School Year records for <span className="font-bold">{targetName}</span>.
          This action allows class advisers to modify grades and regenerate School Form 5.
        </span>
      }
      confirmText="Unlock Records"
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}
