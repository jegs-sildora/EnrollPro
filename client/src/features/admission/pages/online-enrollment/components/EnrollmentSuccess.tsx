import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import {
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { useSettingsStore } from "@/store/settings.slice";
import { format } from "date-fns";

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
  presentation?: "PUBLIC" | "STAFF_WALK_IN";
};

export default function EnrollmentSuccess({
  trackingNumber,
  learnerName,
  onBackHome,
  presentation = "PUBLIC",
}: EnrollmentSuccessProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { enrollOpenDate, enrollCloseDate } = useSettingsStore();
  const navigate = useNavigate();
  const isStaffWalkIn = presentation === "STAFF_WALK_IN";

  const formattedDates = enrollOpenDate && enrollCloseDate
    ? `${format(new Date(enrollOpenDate), "MMMM d")} and ${format(new Date(enrollCloseDate), "MMMM d, yyyy")}`
    : "June 1 and June 5, 2026";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    if (isStaffWalkIn) return;

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
  }, [isStaffWalkIn, showConfirmModal]);

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
          <CardTitle className="text-2xl font-bold text-primary">
            {isStaffWalkIn ? "Walk-in Application Encoded" : "Application Submitted"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isStaffWalkIn ? (
            <div className="mb-6 text-center text-lg text-foreground">
              The learner&apos;s SCP application was successfully recorded and is ready for screening.
            </div>
          ) : (
            <div className="text-center text-lg text-foreground mb-6">
              Your record is now <span className="font-bold text-primary">Pending Verification</span>.
              <br /><br />
              Please proceed to the Hinigaran National High School Registrar&apos;s Office between <span className="text-primary font-bold">{formattedDates}</span>, and bring your <span className="font-bold text-primary">physical SF9 (Report Card)</span> along with your <span className="font-bold text-primary">PSA Birth Certificate</span>.
            </div>
          )}

          <div
            onClick={handleCopy}
            className={cn(
              "bg-muted p-8 rounded-2xl text-center space-y-3 border-2 border-dashed cursor-pointer transition-all duration-200 group relative overflow-hidden",
              copied
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/2",
            )}>
            <p className="text-base text-foreground uppercase font-bold">
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
                "text-sm transition-all duration-200 mt-2 print:hidden font-bold",
                copied ? "text-primary scale-105" : "text-foreground",
              )}>
              {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY"}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-inner print:hidden mb-4">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-base leading-relaxed text-left">
              {isStaffWalkIn
                ? "Write this tracking number on a piece of paper and give it to the learner. The learner can use it to track the application status."
                : "Important tip: Please take a screenshot of this page or write down your tracking number before closing this window. You will need to show this to the guard and registrar."}
            </p>
          </div>

          {!isStaffWalkIn && (
          <div className="pt-10 border-t border-border/60 flex flex-col sm:flex-row gap-4 justify-center print:hidden">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-1/2 h-12 px-12 font-bold gap-2 border-primary text-primary hover:bg-primary/10 hover:text-primary shadow-md uppercase"
              onClick={() => setShowConfirmModal(true)}>
              Back to Home
            </Button>
            <Button
              type="button"
              variant="default"
              className="w-full sm:w-1/2 h-12 px-12 font-bold gap-2 shadow-md uppercase"
              onClick={() => {
                navigate(`/track-application?trackingNumber=${trackingNumber}`);
              }}>
              Track Application
            </Button>
          </div>
          )}
        </CardContent>
      </Card>

      {!isStaffWalkIn && <ConfirmationModal
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        title="Confirm Navigation"
        description="Are you sure you want to go back to home? Please ensure you have taken a screenshot or copied your tracking number before leaving this page."
        confirmText="Yes, I have saved it"
        onConfirm={() => {
          if (onBackHome) onBackHome();
        }}
        variant="warning"
      />}
    </div>
  );
}
