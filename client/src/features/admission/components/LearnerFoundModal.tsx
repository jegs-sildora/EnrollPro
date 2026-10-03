import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { useRef } from "react";

interface LearnerFoundModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  learnerName: string;
  lrn: string;
  onProceed: () => void;
  onCancel: () => void;
}

export function LearnerFoundModal({
  isOpen,
  onOpenChange,
  learnerName,
  lrn,
  onProceed,
  onCancel,
}: LearnerFoundModalProps) {
  const isProceedingRef = useRef(false);

  // Reset the ref when modal opens
  if (isOpen && isProceedingRef.current) {
    isProceedingRef.current = false;
  }

  return (
    <ConfirmationModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isProceedingRef.current) {
          onCancel();
        }
        onOpenChange(open);
      }}
      variant="success"
      preventOutsideClick
      title="Learner Record Found"
      description={
        <div className="flex flex-col items-center justify-center space-y-6">
          <p className="text-center text-base text-foreground pt-2">
            An existing school record was found for <span className="font-extrabold">LRN {lrn}</span>. To save you time and ensure data accuracy, the system will now automatically fill in the learner's personal information.
          </p>
          <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <p className="font-bold">Learner Profile</p>
            <p className="text-2xl font-extrabold text-primary uppercase">{learnerName}</p>
          </div>
        </div>
      }
      confirmText="Got it, Proceed"
      cancelText="Wrong LRN? Cancel and retry"
      onConfirm={() => {
        isProceedingRef.current = true;
        onProceed();
      }}
      onCancel={() => {
        if (!isProceedingRef.current) {
          onCancel();
        }
      }}
    />
  );
}
