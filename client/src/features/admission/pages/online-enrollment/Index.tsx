import { useState } from "react";
import GuestLayout from "@/shared/layouts/GuestLayout";
import AdmissionHeader from "../../components/AdmissionHeader";
import PrivacyNotice from "@/shared/components/PrivacyNotice";
import EnrollmentForm from "./EnrollmentForm";
import EnrollmentSuccess from "./components/EnrollmentSuccess";
import { IntakeChoice } from "./components/IntakeChoice";

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
> & {
  learnerName?: string;
};

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

  const {
    schoolName,
    logoUrl,
    enrollmentPhase,
    enrollOpenDate,
    enrollCloseDate,
    activeSchoolYearLabel,
    systemStatus,
    systemPhase,
    facebookPageUrl,
  } = useSettingsStore();

  const toManilaDateToken = (value: Date): number => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(value);
    const year = Number(
      parts.find((part) => part.type === "year")?.value ?? "0",
    );
    const month = Number(
      parts.find((part) => part.type === "month")?.value ?? "0",
    );
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

    return year * 10000 + month * 100 + day;
  };

  const isWithinOfficialBosyEnrollmentWindow = (() => {
    if (systemPhase === "OFFICIAL_ENROLLMENT") return true;

    if (!enrollOpenDate || !enrollCloseDate) {
      return enrollmentPhase === "REGULAR_ENROLLMENT";
    }

    const open = new Date(enrollOpenDate);
    const close = new Date(enrollCloseDate);
    if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) {
      return enrollmentPhase === "REGULAR_ENROLLMENT";
    }

    const todayToken = toManilaDateToken(new Date());
    const openToken = toManilaDateToken(open);
    const closeToken = toManilaDateToken(close);
    return todayToken >= openToken && todayToken <= closeToken;
  })();

  const isEosyClosing = systemPhase === "EOSY_CLOSING";
  // The forms are closed if we are in EOSY phase or outside the enrollment window
  const isClosed = isEosyClosing || (!isWithinOfficialBosyEnrollmentWindow && systemPhase !== "CLASSES_ONGOING");

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
          title={`S.Y. ${activeSchoolYearLabel} ENROLLMENT FORM`}
        />

        {!isClosed && systemPhase === "CLASSES_ONGOING" && (
          <div className="bg-yellow-100 border-b border-yellow-200 text-yellow-800 text-base leading-tight font-extrabold text-center py-3 px-4 shadow-sm relative z-20">
            Classes have officially started. Submissions will be marked for late processing.
          </div>
        )}

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
                className="text-center space-y-6 py-8 px-6 sm:px-10 bg-muted/60 backdrop-blur-md rounded-lg border border-white/20 shadow-2xl relative overflow-hidden w-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
                <div className="space-y-6 relative z-10">
                  {logoUrl ? (
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      className="h-24 w-24 mx-auto object-contain drop-shadow-md"
                      alt={schoolName}
                    />
                  ) : (
                    <div className="h-24 w-24 mx-auto rounded-lg bg-primary/10 flex items-center justify-center text-4xl font-extrabold text-primary">
                      {schoolName?.charAt(0)}
                    </div>
                  )}
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-extrabold uppercase text-black">
                      {schoolName}
                    </h2>

                  </div>

                  {isEosyClosing ? (
                    <div className="space-y-4 max-w-lg mx-auto">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-extrabold text-gray-900 mt-6">
                          Online Enrollment for S.Y. {activeSchoolYearLabel} is Closed
                        </h3>
                        <p className="text-base text-gray-600 mt-3 leading-relaxed max-w-lg mx-auto text-center">
                          The online registration period has officially ended. Our teachers are now finalizing the student sections for the upcoming school year.
                        </p>
                      </div>

                      <div className="mt-6 p-5 text-left bg-blue-50 border border-blue-100 rounded-xl max-w-lg mx-auto shadow-sm">
                        <h3 className="text-sm font-extrabold text-blue-900 uppercase tracking-wider mb-2">Walk-In Enrollment Instructions</h3>
                        <p className="text-sm text-blue-800 leading-relaxed mb-4">
                          If you missed the online deadline, you can still enroll your child in person. Please visit the School Registrar's Office during office hours (8:00 AM - 5:00 PM, Monday to Friday).
                        </p>
                        <p className="text-sm font-semibold text-blue-900 mb-2">Please bring physical copies of the following:</p>
                        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1 ml-1">
                          <li>Original Report Card (DepEd Form 138 / SF9)</li>
                          <li>PSA Birth Certificate (Bring Original and 1 Photocopy)</li>
                          <li>Certificate of Good Moral Character</li>
                        </ul>
                      </div>

                      {facebookPageUrl && (
                        <div className="pt-6 border-t border-slate-200 space-y-4">
                          <p className="text-base font-extrabold text-slate-500 uppercase  text-center">
                            For real-time updates and official memorandums,
                            please follow our page:
                          </p>
                          <a
                            href={facebookPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 h-12 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-extrabold uppercase  text-base transition-all shadow-lg hover:shadow-[#1877F2]/20 hover:-translate-y-0.5 active:translate-y-0 mx-auto">
                            <svg
                              className="w-5 h-5 fill-current"
                              viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Visit Official Facebook Page
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-lg mx-auto">
                      <h3 className="text-xl sm:text-2xl font-extrabold text-black">
                        S.Y. {activeSchoolYearLabel || "Admissions"} Portal is
                        Currently Closed
                      </h3>
                      <p className="text-base sm:text-base text-black leading-relaxed">
                        The online portal for{" "}
                        {activeSchoolYearLabel || "Admissions"} is not currently
                        accepting applications. Registration periods are
                        scheduled according to the DepEd school calendar.
                      </p>
                      {facebookPageUrl ? (
                        <div className="pt-6 border-t border-border/50 space-y-4">
                          <p className="text-base font-extrabold text-slate-500 uppercase  text-center leading-relaxed">
                            Please stay tuned to our official school social
                            media pages for announcements regarding the next
                            registration schedule.
                          </p>
                          <a
                            href={facebookPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 h-12 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-extrabold uppercase  text-base transition-all shadow-lg hover:shadow-[#1877F2]/20 hover:-translate-y-0.5 active:translate-y-0 mx-auto">
                            <svg
                              className="w-5 h-5 fill-current"
                              viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Visit Official HNHS Facebook Page
                          </a>
                        </div>
                      ) : (
                        <p className="text-base leading-tight text-black font-extrabold pt-4 border-t border-border/50">
                          Please stay tuned to our official school social media
                          pages or visit the school campus for announcements
                          regarding the next registration schedule.
                        </p>
                      )}
                    </div>
                  )}
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
                      <PrivacyNotice
                        variant="BEEF"
                        onAccept={handleAccept}
                      />
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
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, scale: 1.02, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.02 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}>
                      <EnrollmentForm
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
