import { useMemo, useState } from "react";
import { PersonalInfoSection } from "@/features/learner/components/PersonalInfoSection";
import { EnrollmentSection } from "@/features/learner/components/EnrollmentSection";
import { HealthSection } from "@/features/learner/components/HealthSection";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Printer, LogOut } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { useLearnerStore } from "@/store/learner.slice";
import { motion, AnimatePresence } from "motion/react";
import { Navigate } from "react-router";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { sileo } from "sileo";
import depedLogo from "@/assets/DepEd-logo.png";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export default function LearnerPortal() {
  const { logoUrl, schoolName } = useSettingsStore();
  const { learner, logout } = useLearnerStore();
  const [showExitModal, setShowExitModal] = useState(false);

  const fullLogoUrl = useMemo(() => {
    if (!logoUrl) return depedLogo;
    if (logoUrl.startsWith("http")) return logoUrl;
    return `${API_BASE}${logoUrl}`;
  }, [logoUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleExit = () => {
    logout();
    sileo.success({
      title: "Signed Out",
      description: "You have successfully exited the Learner Portal.",
    });
  };

  // If no learner session, REDIRECT to login
  if (!learner) {
    return (
      <Navigate
        to="/learner/login"
        replace
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-slate-50/50">
      <ConfirmationModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        title="Exit Learner Portal?"
        description="You will be signed out of your session. Ensure you have saved or printed any records you need before leaving."
        confirmText="Exit Portal"
        variant="danger"
        onConfirm={handleExit}
      />
      {/* Global Background implementation */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: "hsl(var(--sidebar-background)/0.5)",
        }}>
        {/* Pixel grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.08]"
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="pixel-grid"
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse">
              <rect
                x="2"
                y="2"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <rect
                x="42"
                y="2"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <rect
                x="2"
                y="42"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
              <rect
                x="42"
                y="42"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#pixel-grid)"
          />
        </svg>
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="portal"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="p-4 md:p-8 print:bg-white print:p-0">
          <div className="max-w-5xl mx-auto space-y-8 print:max-w-none print:space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-lg shadow-sm border border-border print:shadow-none print:border-0 print:border-b-2 print:border-slate-800 print:rounded-none">
              <div className="flex items-center gap-4">
                <img
                  src={fullLogoUrl}
                  alt={`${schoolName || "School"} Logo`}
                  className="h-16 w-auto object-contain"
                />
                <div>
                  <h1 className="text-xl font-black uppercase  text-foreground">
                    {schoolName || "MY SCHOOL RECORDS"}
                  </h1>
                  <p className="text-xs text-primary font-black uppercase ">
                    School Year {learner.schoolYear?.yearLabel || "2026-2027"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2 font-bold shadow-sm border-border bg-white hover:bg-slate-50 transition-all">
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExitModal(true)}
                  className="gap-2 font-bold text-foreground hover:text-destructive hover:bg-destructive/5 transition-all">
                  <LogOut className="h-4 w-4" />
                  Exit Portal
                </Button>
              </div>
            </div>

            {/* Layout Grid: 3 Main Cards */}
            <div className="grid grid-cols-1 gap-8">
              {/* Card 1: Identity & Demographics */}
              <Card className="shadow-xl border-primary/5 bg-white/90 backdrop-blur-xl rounded-lg overflow-hidden print:border-0 print:shadow-none">
                <CardContent className="p-8 md:p-10">
                  <PersonalInfoSection learner={learner} />
                </CardContent>
              </Card>

              {/* Card 2: Academic Status & History */}
              <Card className="shadow-xl border-primary/5 bg-white/90 backdrop-blur-xl rounded-lg overflow-hidden print:border-0 print:shadow-none">
                <CardContent className="p-8 md:p-10">
                  <EnrollmentSection learner={learner} />
                </CardContent>
              </Card>

              {/* Card 3: Health Records (SF8) */}
              <Card className="shadow-xl border-primary/5 bg-white/90 backdrop-blur-xl rounded-lg overflow-hidden print:border-0 print:shadow-none">
                <CardContent className="p-8 md:p-10">
                  <HealthSection learner={learner} />
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="text-center pb-12 print:hidden">
              <p className="text-xs text-foreground font-black uppercase  opacity-50">
                EnrollPro Learner Portal • Official School Record Access
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { margin: 1.5cm; }
          body { background-color: white !important; }
          .print\\:hidden { display: none !important; }
          .shadow-xl, .shadow-sm { box-shadow: none !important; }
          .border-primary\\/5 { border: none !important; }
          .bg-white\\/90 { background-color: white !important; }
          .backdrop-blur-xl { backdrop-filter: none !important; }
          .rounded-lg { border-radius: 0 !important; }
          .divide-y > * { page-break-inside: avoid; }
        }
      `,
        }}
      />
    </div>
  );
}
