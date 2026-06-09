import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";

type EnrollmentSuccessProps = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
> & {
  onBackHome?: () => void;
};

export default function EnrollmentSuccess({
  trackingNumber,
  onBackHome,
}: EnrollmentSuccessProps) {
  const [copied, setCopied] = useState(false);

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
            Registration Submitted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="text-center text-lg text-foreground font-medium mb-6">
            Your record is now <span className="font-bold text-primary">Pending Verification</span>. 
            <br/><br/>
            Please proceed to the Hinigaran National High School Registrar&apos;s Office during the official enrollment week. 
            Bring your physical SF9 (Report Card) and PSA Birth Certificate.
          </div>

          <div className="text-center mb-4">
            <p className="text-destructive font-black text-sm uppercase">
              IMPORTANT: Please take a screenshot of this page or write down your tracking number before leaving.
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
            <p className="text-[0.625rem] text-foreground uppercase font-black">
              Your Application Tracking Number
            </p>
            <div className="flex items-center justify-center gap-4">
              <p className="text-xl sm:text-4xl font-black text-primary">
                {trackingNumber}
              </p>
            </div>
            <p
              className={cn(
                "text-xs font-black transition-all duration-200",
                copied ? "text-primary scale-110" : "text-foreground",
              )}>
              {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY"}
            </p>
          </div>

          <div className="pt-10 border-t border-border/60">
            <Button
              className="w-full h-12 font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onBackHome}>
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
