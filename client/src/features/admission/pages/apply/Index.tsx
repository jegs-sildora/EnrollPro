import { useState } from "react";
import depedLogo from "@/assets/DepEd-logo.png";
import GuestLayout from "@/shared/layouts/GuestLayout";
import PrivacyNotice from "./PrivacyNotice";
import EarlyRegistrationForm from "./EarlyRegistrationForm";
import EarlyRegistrationSuccess from "./components/EarlyRegistrationSuccess";
import TrackApplication from "./Track";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

const CONSENT_KEY = "enrollpro_apply_consent";
const TAB_KEY = "enrollpro_apply_active_tab";
const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export default function Apply() {
  const [hasConsented, setHasConsented] = useState(() => {
    return sessionStorage.getItem(CONSENT_KEY) === "true";
  });
  const [activeTab, setActiveTab] = useState<"form" | "monitor">(() => {
    return (sessionStorage.getItem(TAB_KEY) as "form" | "monitor") || "form";
  });
  const [monitorHasResults, setMonitorHasResults] = useState(false);
  const [submittedTrackingNumber, setSubmittedTrackingNumber] = useState<
    string | null
  >(null);

  const { schoolName, logoUrl, enrollmentPhase } = useSettingsStore();
  const isClosed = enrollmentPhase === "CLOSED";

  const handleAccept = () => {
    sessionStorage.setItem(CONSENT_KEY, "true");
    setHasConsented(true);
  };

  const handleReset = () => {
    sessionStorage.removeItem(CONSENT_KEY);
    setHasConsented(false);
    setSubmittedTrackingNumber(null);
  };

  const handleTabChange = (tab: "form" | "monitor") => {
    sessionStorage.setItem(TAB_KEY, tab);
    setActiveTab(tab);
    setSubmittedTrackingNumber(null);
  };

  const handleBackHome = () => {
    setSubmittedTrackingNumber(null);
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
            <rect width="100%" height="100%" fill="url(#pixel-grid)" />
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

        {!isClosed && (
          <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-auto py-4 sm:h-25 grid grid-cols-1 sm:grid-cols-3 items-center gap-3 sm:gap-6">
              {/* 1. School Logo & Name Container for mobile/desktop */}
              <div className="flex items-center gap-3 sm:justify-end sm:col-start-1">
                <div className="flex shrink-0">
                  {logoUrl ? (
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      alt={`${schoolName} logo`}
                      className="h-12 w-12 sm:h-18 sm:w-30 shrink-0 object-contain"
                    />
                  ) : (
                    <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full bg-[hsl(var(--primary))/0.1] flex items-center justify-center">
                      <span className="text-lg sm:text-xl font-bold text-foreground">
                        {schoolName?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile school name (only visible on sm) */}
                <div className="flex flex-col leading-tight sm:hidden min-w-0">
                  <span className="text-sm font-black tracking-tight text-foreground leading-none uppercase">
                    {schoolName}
                  </span>
                  <span className="text-[0.5rem] font-black tracking-widest uppercase text-muted-foreground mt-0.5">
                    Early Registration Portal
                  </span>
                </div>
              </div>

              {/* 2. School Name & Title (hidden on mobile, centered on desktop) */}
              <div className="hidden sm:flex flex-col leading-tight text-center justify-center min-w-0 sm:col-start-2">
                <span className="text-base sm:text-lg md:text-xl font-black tracking-tight text-foreground leading-none uppercase wrap-break-word">
                  {schoolName}
                </span>
                <span className="text-[0.5625rem] sm:text-[0.625rem] md:text-xs font-black tracking-widest sm:tracking-[0.15em] uppercase text-muted-foreground mt-1 wrap-break-word">
                  Early Registration Portal
                </span>
              </div>

              {/* 3. DepEd Logo - Hidden on mobile */}
              <div className="hidden sm:flex justify-start overflow-hidden sm:col-start-3">
                <img
                  src={depedLogo}
                  alt="DepEd logo"
                  className="h-14 w-14 sm:h-50 sm:w-50 shrink-0 object-contain"
                />
              </div>
            </div>
          </header>
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
                className="text-center space-y-8 py-16 px-6 sm:px-16 bg-white/60 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden w-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
                <div className="space-y-6 relative z-10">
                  {logoUrl ? (
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      className="h-32 w-32 mx-auto object-contain drop-shadow-md"
                      alt={schoolName}
                    />
                  ) : (
                    <div className="h-24 w-24 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center text-4xl font-black text-primary">
                      {schoolName?.charAt(0)}
                    </div>
                  )}
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
                      {schoolName}
                    </h2>
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold tracking-widest uppercase border border-destructive/20">
                      Registration Inactive
                    </div>
                  </div>
                  <div className="space-y-4 max-w-lg mx-auto">
                    <h3 className="text-xl sm:text-2xl font-bold text-black">
                      Early Registration is Currently Closed
                    </h3>
                    <p className="text-sm sm:text-base text-black leading-relaxed">
                      The online portal for Early Registration is not currently
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
              <>
                <div className="flex justify-center">
                  <div className="flex bg-white/80 p-1.5 rounded-2xl border-3 border-primary/80 w-full sm:w-auto shadow-inner">
                    <button
                      onClick={() => handleTabChange("form")}
                      className={cn(
                        "flex-1 sm:flex-none px-8 py-3 text-[0.625rem] sm:text-xs font-black uppercase tracking-[0.15em] rounded-xl transition-all duration-200",
                        activeTab === "form"
                          ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                      )}>
                      Application Form
                    </button>
                    <button
                      onClick={() => handleTabChange("monitor")}
                      className={cn(
                        "flex-1 sm:flex-none px-8 py-3 text-[0.625rem] sm:text-xs font-black uppercase tracking-[0.15em] rounded-xl transition-all duration-200",
                        activeTab === "monitor"
                          ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                      )}>
                      Monitor Portal
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex flex-col",
                    activeTab === "monitor" && !monitorHasResults
                      ? "flex-1 justify-center"
                      : "h-auto",
                  )}>
                  <AnimatePresence mode="wait">
                    {activeTab === "monitor" ? (
                      <motion.div
                        key="monitor"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.3 }}>
                        <TrackApplication
                          onResultsFetched={setMonitorHasResults}
                        />
                      </motion.div>
                    ) : submittedTrackingNumber ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}>
                        <EarlyRegistrationSuccess
                          trackingNumber={submittedTrackingNumber}
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
                    ) : (
                      <motion.div
                        key="form"
                        initial={{ opacity: 0, scale: 1.02, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}>
                        <EarlyRegistrationForm
                          onSuccess={setSubmittedTrackingNumber}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </GuestLayout>
  );
}
