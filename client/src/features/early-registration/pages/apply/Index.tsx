import { useState } from "react";
import GuestLayout from "@/shared/layouts/GuestLayout";
import AdmissionHeader from "@/features/admission/components/AdmissionHeader";
import PrivacyNotice from "@/features/admission/pages/online-enrollment/PrivacyNotice";
import EarlyRegistrationForm from "./EarlyRegistrationForm";
import EarlyRegSuccessView from "./components/EarlyRegSuccessView";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";

const CONSENT_KEY = "enrollpro_earlyreg_consent";
const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

type EarlyRegSuccessData = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
  | "assessmentData"
> & {
  id: number;
  learnerName: string;
};

export default function EarlyRegistrationApply() {
  const [hasConsented, setHasConsented] = useState(
    () => sessionStorage.getItem(CONSENT_KEY) === "true",
  );
  const [successData, setSuccessData] = useState<EarlyRegSuccessData | null>(
    null,
  );

  const { schoolName, logoUrl, enrollmentPhase } = useSettingsStore();
  const isClosed =
    enrollmentPhase !== "EARLY_REGISTRATION" && enrollmentPhase !== "OVERRIDE";

  const handleAccept = () => {
    sessionStorage.setItem(CONSENT_KEY, "true");
    setHasConsented(true);
  };

  const handleReset = () => {
    sessionStorage.removeItem(CONSENT_KEY);
    setHasConsented(false);
    setSuccessData(null);
  };

  return (
    <GuestLayout>
      <div className="relative min-h-screen flex flex-col">
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
          title={<>Basic Education Early Registration Form</>}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-destructive/50 to-transparent" />
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
                      Early Registration Closed
                    </div>
                  </div>
                  <div className="space-y-4 max-w-lg mx-auto">
                    <h3 className="text-xl sm:text-2xl font-bold text-black">
                      Early Registration is currently closed.
                    </h3>
                    <p className="text-sm sm:text-base text-black leading-relaxed">
                      Early registration is not open yet. Please return during
                      the official early registration period.
                    </p>
                    <p className="text-sm text-black font-medium pt-4 border-t border-border/50">
                      Follow official school announcements on social media or
                      visit the campus for the next registration schedule.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {successData ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}>
                    <EarlyRegSuccessView
                      trackingNumber={successData.trackingNumber}
                      learnerName={successData.learnerName}
                      applicantType={successData.applicantType}
                      programType={successData.programType}
                      status={successData.status}
                      currentStep={successData.currentStep}
                      assessmentData={successData.assessmentData}
                      onRegisterAnother={handleReset}
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
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, scale: 1.02, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}>
                    <EarlyRegistrationForm
                      onSuccess={(data) => setSuccessData(data)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>
    </GuestLayout>
  );
}
