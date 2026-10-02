import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  CheckCircle2,
  Info,
  AlertCircle
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";


type EarlyRegistrationSuccessProps = {
  learnerName?: string;
  onBackHome?: () => void;
};

export default function EarlyRegistrationSuccess({
  learnerName,
  onBackHome,
}: EarlyRegistrationSuccessProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);


  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r") || (e.metaKey && e.key === "r")) {
        e.preventDefault();
        setShowConfirmModal(true);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!showConfirmModal) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [showConfirmModal]);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Card className="shadow-lg border-2 border-primary/10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">
            Application Submitted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          <div className="bg-primary/5 p-8 rounded-2xl text-center space-y-3 border-2 border-primary/20">
            <p className="text-xl sm:text-2xl font-extrabold text-primary uppercase leading-tight">
              Learner Successfully Registered:
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground uppercase">
              {learnerName || "LEARNER NAME NOT PROVIDED"}
            </p>
          </div>

          <Alert className="bg-primary/5 border-primary/50 text-foreground">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertTitle className="text-lg font-bold text-primary uppercase">Mandatory Next Steps</AlertTitle>
            <AlertDescription className="text-base mt-3 space-y-4 text-foreground/90">
              <p>
                To complete official enrollment, you must either fill out the <strong>Online Enrollment Form</strong> (once the enrollment portal officially opens) OR proceed to the school for <strong>Walk-in Enrollment</strong>.
              </p>
              <p>
                Regardless of the method chosen, submission of the physical <strong>SF9 (Report Card)</strong> and <strong>PSA Birth Certificate</strong> is strictly required to finalize the enrollment status.
              </p>
            </AlertDescription>
          </Alert>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-inner print:hidden mb-4">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-base leading-relaxed text-left">
              Important tip: Please take a screenshot or print this page to serve as proof of your early registration when you visit the school.
            </p>
          </div>

          <div className="pt-10 border-t border-border/60 flex flex-col gap-4 justify-center print:hidden items-center">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-1/2 h-12 px-12 font-bold gap-2 border-primary text-primary hover:bg-primary/10 hover:text-primary shadow-md uppercase"
              onClick={() => setShowConfirmModal(true)}>
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        title="Confirm Navigation"
        description="Are you sure you want to go back to home? Please ensure you have taken a screenshot or printed this page before leaving."
        confirmText="Yes, I have saved it"
        onConfirm={() => {
          if (onBackHome) onBackHome();
        }}
        variant="warning"
      />
    </div>
  );
}
