import { useState } from "react";
import { Link } from "react-router";
import GuestLayout from "@/shared/layouts/GuestLayout";
import AdmissionHeader from "@/features/admission/components/AdmissionHeader";
import PrivacyNotice from "@/features/admission/pages/online-enrollment/PrivacyNotice";
import EarlyRegistrationForm from "./EarlyRegistrationForm";
import EarlyRegSuccessView from "./components/EarlyRegSuccessView";
import { motion, AnimatePresence } from "motion/react";
import { cn, getManilaNow } from "@/shared/lib/utils";
import { formatManilaDate } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import educationSvg from "@/assets/Department_of_Education.svg";
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

  const {
    schoolName,
    logoUrl,
    enrollmentPhase,
    activeSchoolYearLabel,
    earlyRegOpenDate,
    earlyRegCloseDate,
    facebookPageUrl,
  } = useSettingsStore();

  const now = getManilaNow();
  // Ensure we compare dates without time if needed, but new Date(ISO) usually works.
  // DepEd dates are usually set to 00:00:00 of the day.
  const isWithinEarlyRegDates =
    earlyRegOpenDate &&
    earlyRegCloseDate &&
    now >= new Date(earlyRegOpenDate) &&
    now <= new Date(earlyRegCloseDate);

  const isRegularEnrollment = enrollmentPhase === "REGULAR_ENROLLMENT";
  const isClosed =
    enrollmentPhase !== "EARLY_REGISTRATION" &&
    enrollmentPhase !== "OVERRIDE" &&
    !isWithinEarlyRegDates;
  const targetYear = activeSchoolYearLabel
    ? activeSchoolYearLabel.split("-")[0]
    : new Date().getFullYear();

  const formattedSchedule =
    earlyRegOpenDate && earlyRegCloseDate
      ? `${formatManilaDate(earlyRegOpenDate)} to ${formatManilaDate(earlyRegCloseDate)}`
      : `Late January to February ${targetYear}`;

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
                  <div className="flex items-center justify-center gap-6">
                    <img
                      src={educationSvg}
                      className="h-24 w-24 sm:h-32 sm:w-32 object-contain drop-shadow-md"
                      alt="Department of Education"
                    />
                    {logoUrl ? (
                      <img
                        src={`${API_BASE}${logoUrl}`}
                        className="h-24 w-24 sm:h-32 sm:w-32 object-contain drop-shadow-md"
                        alt={schoolName}
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-lg bg-primary/10 flex items-center justify-center text-4xl font-black text-primary">
                        {schoolName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase text-black">
                      {schoolName}
                    </h2>
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black tracking-[0.2em] uppercase border border-slate-200">
                      {isRegularEnrollment
                        ? "REDIRECTING..."
                        : "PHASE CLOSED"}
                    </div>
                  </div>
                  {isRegularEnrollment ? (
                    <div className="space-y-6 max-w-lg mx-auto">
                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-2xl font-black text-black">
                          Early Registration has concluded.
                        </h3>
                        <p className="text-sm sm:text-base text-black/70 font-medium leading-relaxed">
                          The system is now in the Official Enrollment Phase.
                        </p>
                      </div>

                      <div className="p-6 rounded-xl bg-blue-50/50 border border-blue-100 text-left space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-2 text-blue-900/80 text-xs leading-relaxed">
                            <span className="text-lg leading-none">ℹ️</span>
                            <p className="font-medium">
                              If you previously completed Early Registration,
                              your data is saved! You only need to submit your
                              physical requirements to the Registrar.
                            </p>
                          </div>
                          <div className="flex items-start gap-2 text-blue-900/80 text-xs leading-relaxed border-t border-blue-100 pt-3">
                            <span className="text-lg leading-none">📝</span>
                            <p className="font-medium">
                              If you are a New Learner/Transferee who missed
                              Early Registration, you may now fill out the
                              Official Basic Education Enrollment Form (BEEF).
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Link
                          to="/enrollment"
                          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 mx-auto">
                          Proceed to Official Enrollment Portal ➔
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-lg mx-auto">
                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-2xl font-black text-black">
                          Early Registration for S.Y. {activeSchoolYearLabel} is
                          not yet active.
                        </h3>
                        <p className="text-sm sm:text-base text-black/70 font-medium leading-relaxed">
                          Please return during the official DepEd Early
                          Registration period. The system portal will
                          automatically open based on the administration's
                          schedule.
                        </p>
                      </div>

                      <div className="p-6 rounded-xl bg-blue-50/50 border border-blue-100 text-left space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                            <span className="text-lg">📅</span> Target Schedule:
                            {formattedSchedule}
                          </div>
                          <div className="flex items-start gap-2 text-blue-900/80 text-xs leading-relaxed">
                            <span className="text-lg leading-none">📌</span>
                            <p className="font-medium">
                              <span className="font-black uppercase text-[10px] tracking-tight mr-1">
                                Note:
                              </span>
                              Early Registration is{" "}
                              <span className="font-bold underline">ONLY</span>{" "}
                              required for incoming Grade 7 learners, Transferees,
                              and Balik-Aral. Continuing learners (Grades 8-10)
                              will be processed during the regular BOSY
                              enrollment.
                            </p>
                          </div>
                        </div>
                      </div>

                      {facebookPageUrl && (
                        <div className="pt-6 border-t border-slate-200 space-y-4">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide text-center">
                            For real-time updates and official memorandums, please
                            follow our page:
                          </p>
                          <a
                            href={facebookPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 h-12 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-[#1877F2]/20 hover:-translate-y-0.5 active:translate-y-0 mx-auto">
                            <svg
                              className="w-5 h-5 fill-current"
                              viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Visit Official HNHS Facebook Page ➔
                          </a>
                        </div>
                      )}
                    </div>
                  )}
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
