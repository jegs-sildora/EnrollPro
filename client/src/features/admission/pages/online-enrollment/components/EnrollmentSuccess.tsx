import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import {
  CheckCircle2,
  Home,
  Info,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

type EnrollmentSuccessProps = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
> & {
  learnerName?: string;
  onBackHome?: () => void;
};

export default function EnrollmentSuccess({
  trackingNumber,
  learnerName,
  onBackHome,
}: EnrollmentSuccessProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
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

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Card className="shadow-lg border-2 border-primary/10">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-extrabold text-primary">
            Application Submitted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="text-center text-lg text-foreground font-semibold mb-6">
            Your record is now <span className="font-extrabold text-primary">Pending Verification</span>.
            <br /><br />
            Please proceed to the Hinigaran National High School Registrar&apos;s Office between <strong>June 1 and June 5, 2026</strong>, and bring your physical SF9 (Report Card) along with your PSA Birth Certificate.
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-inner print:hidden mb-4">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-base font-semibold leading-relaxed text-left">
              Important tip: Please take a screenshot of this page or write down your tracking number before closing this window. You will need to show this to the guard and registrar.
            </p>
          </div>

          <div
            onClick={handleCopy}
            className={cn(
              "bg-muted p-8 rounded-2xl text-center space-y-3 border-2 border-dashed cursor-pointer transition-all duration-200 group relative overflow-hidden",
              copied
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/2",
            )}>
            <p className="text-base text-foreground uppercase font-extrabold">
              Application Tracking Number
            </p>
            <div className="flex items-center justify-center gap-4">
              <p className="text-xl sm:text-4xl font-extrabold text-primary">
                {trackingNumber}
              </p>
            </div>
            {learnerName && (
              <p className="text-base leading-tight font-extrabold text-foreground mt-2 uppercase">
                Learner: {learnerName}
              </p>
            )}
            <p
              className={cn(
                "text-base font-extrabold transition-all duration-200 mt-2 print:hidden",
                copied ? "text-primary scale-110" : "text-foreground",
              )}>
              {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY"}
            </p>
          </div>

          <div className="pt-10 border-t border-border/60 flex justify-center print:hidden">
            <Button
              type="button"
              className="w-full sm:w-full h-12 px-12 font-extrabold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              onClick={() => setShowConfirmModal(true)}>
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        title="Confirm Navigation"
        description="Are you sure you want to go back to home? Please ensure you have taken a screenshot or copied your tracking number before leaving this page."
        confirmText="Yes, I have saved it"
        onConfirm={() => {
          if (onBackHome) onBackHome();
        }}
        variant="warning"
      />
    </div>
  );
}
