import { useState } from "react";
import api from "@/shared/api/axiosInstance";
import { isAxiosError } from "axios";
import type { LearnerProfile } from "@/features/learner/types";
import { LookupForm } from "@/features/learner/components/LookupForm";
import { PersonalInfoSection } from "@/features/learner/components/PersonalInfoSection";
import { EnrollmentSection } from "@/features/learner/components/EnrollmentSection";
import { HealthSection } from "@/features/learner/components/HealthSection";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Printer, LogOut } from "lucide-react";
import depedLogo from "@/assets/DepEd-logo.png";

export default function LearnerPortal() {
  const [learner, setLearner] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (lrn: string, birthDate: string, pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/learner/lookup", { lrn, birthDate, pin });
      setLearner(res.data.learner);
    } catch (err: unknown) {
      setError(
        isAxiosError(err)
          ? err.response?.data?.message ||
              "An error occurred. Please try again."
          : "An error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    setLearner(null);
  };

  if (!learner) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <LookupForm
          onLookup={handleLookup}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-0 print:border-b-2 print:border-slate-800 print:rounded-none">
          <div className="flex items-center gap-4">
            <img
              src={depedLogo}
              alt="DepEd Logo"
              className="h-16 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold ">MY SCHOOL RECORDS</h1>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                {learner.schoolYear?.yearLabel || "SY 2026-2027"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2">
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              Exit Portal
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Card className="shadow-sm border-slate-200 overflow-hidden print:border-0 print:shadow-none">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 print:divide-slate-200">
              <div className="p-6 md:p-8 print:py-4">
                <PersonalInfoSection learner={learner} />
              </div>
              <div className="p-6 md:p-8 print:py-4">
                <EnrollmentSection learner={learner} />
              </div>
              <div className="p-6 md:p-8 print:py-4">
                <HealthSection learner={learner} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pb-8 print:hidden">
          <p className="text-xs text-muted-foreground">
            For staff access, use the Staff Login link in the footer.
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { margin: 1cm; }
          body { background-color: white !important; }
          .print\\:hidden { display: none !important; }
          .shadow-sm { box-shadow: none !important; }
          .border-slate-200 { border: none !important; }
          .divide-y > * { page-break-inside: avoid; }
        }
      `,
        }}
      />
    </div>
  );
}
