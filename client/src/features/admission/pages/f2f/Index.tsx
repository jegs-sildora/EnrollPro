import { useState } from "react";
import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAuthStore } from "@/store/auth.slice";
import EarlyRegistrationForm from "@/features/early-registration/pages/apply/EarlyRegistrationForm";
import F2FEarlyRegistrationSuccess from "./F2FEarlyRegistrationSuccess";

interface F2FSubmissionResult {
  trackingNumber: string;
  applicantType: string;
}

export default function F2FEarlyRegistration() {
  const { user } = useAuthStore();
  const [submission, setSubmission] = useState<F2FSubmissionResult | null>(
    null,
  );

  if (submission) {
    return (
      <F2FEarlyRegistrationSuccess
        trackingNumber={submission.trackingNumber}
        applicantType={submission.applicantType}
        encodedBy={
          user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "Registrar"
            : "Registrar"
        }
        onNewApplication={() => setSubmission(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Walk-in Basic Education Early Registration Form
          </h1>
          <p className="text-sm text-foreground font-bold">
            Use the same public early registration flow for face-to-face
            encoding.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2 font-semibold">
          <Link
            to="/settings?tab=requirements"
            target="_blank"
            rel="noopener noreferrer">
            <BookOpen className="w-4 h-4" />
            View Requirements
          </Link>
        </Button>
      </div>

      <EarlyRegistrationForm
        submitEndpoint="/early-registrations/f2f"
        storageKeyPrefix="enrollpro_f2f_earlyreg"
        consentStorageKey={null}
        onSuccess={(result) => {
          setSubmission({
            trackingNumber: result.trackingNumber,
            applicantType: result.applicantType,
          });
        }}
      />
    </div>
  );
}
