import { useState } from "react";
import GuestLayout from "@/shared/layouts/GuestLayout";
import AdmissionHeader from "../../components/AdmissionHeader";
import PrivacyNotice from "./PrivacyNotice";
import EarlyRegistrationForm from "./EarlyRegistrationForm";
import EnrollmentSuccess from "./components/EnrollmentSuccess";
import { IntakeChoice } from "./components/IntakeChoice";
import { ReturningLearnerFlow } from "./components/ReturningLearnerFlow";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";

const CONSENT_KEY = "enrollpro_apply_consent";
const INTAKE_KEY = "enrollpro_intake_choice";
const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

type EnrollmentSubmitSuccessPayload = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
  | "assessmentData"
>;

export default function Apply() {
  const [hasConsented, setHasConsented] = useState(() => {
    return sessionStorage.getItem(CONSENT_KEY) === "true";
  });
  const [intakeChoice, setIntakeChoice] = useState<"NEW" | "RETURNING" | null>(
    () => {
      return sessionStorage.getItem(INTAKE_KEY) as "NEW" | "RETURNING" | null;
    },
  );
  const [submittedSuccessData, setSubmittedSuccessData] =
    useState<EnrollmentSubmitSuccessPayload | null>(null);

  const { schoolName, logoUrl, enrollmentPhase, activeSchoolYearLabel } =
    useSettingsStore();
  const isClosed = enrollmentPhase === "CLOSED";

  const handleAccept = () => {
    sessionStorage.setItem(CONSENT_KEY, "true");
    setHasConsented(true);
  };

  const handleIntakeChoice = (choice: "NEW" | "RETURNING") => {
    sessionStorage.setItem(INTAKE_KEY, choice);
    setIntakeChoice(choice);
  };

  const handleReset = () => {
    sessionStorage.removeItem(CONSENT_KEY);
    sessionStorage.removeItem(INTAKE_KEY);
    setHasConsented(false);
    setIntakeChoice(null);
    setSubmittedSuccessData(null);
  };

  const handleBackHome = () => {
    setSubmittedSuccessData(null);
    handleReset();
  };

  return (
    <GuestLayout>
      <div
        className={cn(
          "relative min-h-screen flex flex-col",
          isClosed && "h-screen overflow-hidden",
        )}>
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

        <AdmissionHeader
          isClosed={isClosed}
          logoUrl={logoUrl}
          schoolName={schoolName}
          title={`S.Y. ${activeSchoolYearLabel} ADMISSIONS`}
        />

        <main
          className={cn(
            "px-4 sm:px-6 lg:px-8 flex flex-col flex-1",
            isClosed ? "justify-center items-center" : "py-8",
          )}>
          <div
            className={cn(
              "w-full mx-auto flex flex-col",
              isClosed ? "max-w-3xl" : "max-w-6xl flex-1",
            )}>
            {isClosed ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-8 py-16 px-6 sm:px-16 bg-white/60 backdrop-blur-md rounded-lg border border-white/20 shadow-2xl relative overflow-hidden w-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
                <div className="space-y-6 relative z-10">
                  {logoUrl ? (
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      className="h-32 w-32 mx-auto object-contain drop-shadow-md"
                      alt={schoolName}
                    />
                  ) : (
                    <div className="h-24 w-24 mx-auto rounded-lg bg-primary/10 flex items-center justify-center text-4xl font-black text-primary">
                      {schoolName?.charAt(0)}
                    </div>
                  )}
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase  text-black">
                      {schoolName}
                    </h2>
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold tracking-widest uppercase border border-destructive/20">
                      Registration Inactive
                    </div>
                  </div>
                  <div className="space-y-4 max-w-lg mx-auto">
                    <h3 className="text-xl sm:text-2xl font-bold text-black">
                      {activeSchoolYearLabel || "Admissions"} Portal is
                      Currently Closed
                    </h3>
                    <p className="text-sm sm:text-base text-black leading-relaxed">
                      The online portal for{" "}
                      {activeSchoolYearLabel || "Admissions"} is not currently
                      accepting applications. Registration periods are scheduled
                      according to the DepEd school calendar.
                    </p>
                    <p className="text-sm text-black font-medium pt-4 border-t border-border/50">
                      Please stay tuned to our official school social media
                      pages or visit the school campus for announcements
                      regarding the next registration schedule.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col h-auto">
                <AnimatePresence mode="wait">
                  {submittedSuccessData ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4 }}>
                      <EnrollmentSuccess
                        trackingNumber={submittedSuccessData.trackingNumber}
                        applicantType={submittedSuccessData.applicantType}
                        programType={submittedSuccessData.programType}
                        status={submittedSuccessData.status}
                        currentStep={submittedSuccessData.currentStep}
                        assessmentData={submittedSuccessData.assessmentData}
                        onBackHome={handleBackHome}
                      />
                    </motion.div>
                  ) : !hasConsented ? (
                    <motion.div
                      key="privacy"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.3 }}>
                      <PrivacyNotice onAccept={handleAccept} />
                    </motion.div>
                  ) : !intakeChoice ? (
                    <motion.div
                      key="choice"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.3 }}>
                      <IntakeChoice onChoice={handleIntakeChoice} />
                    </motion.div>
                  ) : intakeChoice === "RETURNING" ? (
                    <motion.div
                      key="returning"
                      initial={{ opacity: 0, scale: 1.02, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.02 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}>
                      <ReturningLearnerFlow
                        onBack={() => setIntakeChoice(null)}
                        onSuccess={(data) => setSubmittedSuccessData(data)}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, scale: 1.02, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.02 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}>
                      <EarlyRegistrationForm
                        onBack={() => setIntakeChoice(null)}
                        onSuccess={(data) => setSubmittedSuccessData(data)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>
      </div>
    </GuestLayout>
  );
}
