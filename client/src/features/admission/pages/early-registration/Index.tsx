import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import GuestLayout from "@/shared/layouts/GuestLayout";
import AdmissionHeader from "../../components/AdmissionHeader";
import PrivacyNotice from "@/shared/components/PrivacyNotice";
import EarlyRegistrationForm from "./EarlyRegistrationForm";
import EnrollmentSuccess from "../online-enrollment/components/EnrollmentSuccess";

import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";

const CONSENT_KEY = "enrollpro_early_reg_consent";

type EnrollmentSubmitSuccessPayload = Pick<
  ApplicationSubmitResponse,
  | "trackingNumber"
  | "applicantType"
  | "programType"
  | "status"
  | "currentStep"
> & {
  learnerName?: string;
};

export default function EarlyRegistrationIndex() {
  const navigate = useNavigate();
  const [hasConsented, setHasConsented] = useState(() => {
    return sessionStorage.getItem(CONSENT_KEY) === "true";
  });
  
  const [submittedSuccessData, setSubmittedSuccessData] =
    useState<EnrollmentSubmitSuccessPayload | null>(null);

  const {
    schoolName,
    logoUrl,
  } = useSettingsStore();

  const handleAccept = () => {
    sessionStorage.setItem(CONSENT_KEY, "true");
    setHasConsented(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleReset = () => {
    sessionStorage.removeItem(CONSENT_KEY);
    setHasConsented(false);
    setSubmittedSuccessData(null);
    window.scrollTo({ top: 0, behavior: "instant" });
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
          isClosed={false}
          logoUrl={logoUrl}
          schoolName={schoolName}
          title="BASIC EDUCATION EARLY REGISTRATION FORM"
        />

        <main
          className={cn(
            "px-4 sm:px-6 lg:px-8 flex flex-col flex-1",
            "py-8",
          )}>
          <div
            className={cn(
              "w-full mx-auto flex flex-col",
              "max-w-6xl flex-1",
            )}>
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
                      learnerName={submittedSuccessData.learnerName}
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
                    <PrivacyNotice onAccept={handleAccept} formType="early-registration" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, scale: 1.02, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}>
                    <EarlyRegistrationForm
                      onBack={() => {
                        setHasConsented(false);
                        window.scrollTo({ top: 0, behavior: "instant" });
                      }}
                      onSuccess={(data) => {
                        setSubmittedSuccessData(data);
                        window.scrollTo({ top: 0, behavior: "instant" });
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </GuestLayout>
  );
}
