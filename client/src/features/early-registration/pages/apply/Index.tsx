import { useState } from "react";
import GuestLayout from "@/shared/layouts/GuestLayout";
import AdmissionHeader from "@/features/admission/components/AdmissionHeader";
import PrivacyNotice from "@/features/admission/pages/apply/PrivacyNotice";
import EarlyRegistrationForm from "./EarlyRegistrationForm";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/shared/ui/button";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

const CONSENT_KEY = "enrollpro_earlyreg_consent";
const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export default function EarlyRegistrationApply() {
  const [hasConsented, setHasConsented] = useState(
    () => sessionStorage.getItem(CONSENT_KEY) === "true",
  );
  const [successData, setSuccessData] = useState<{
    id: number;
    learnerName: string;
  } | null>(null);

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

        <AdmissionHeader
          isClosed={isClosed}
          logoUrl={logoUrl}
          schoolName={schoolName}
          title="Basic Education Early Registration Form (Grades 7–10 JHS)"
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
                className="text-center space-y-8 py-16 px-6 sm:px-16 bg-white/60 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden w-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-destructive/50 to-transparent" />
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
                      Early Registration Inactive
                    </div>
                  </div>
                  <div className="space-y-4 max-w-lg mx-auto">
                    <h3 className="text-xl sm:text-2xl font-bold text-black">
                      Early Registration is Currently Closed
                    </h3>
                    <p className="text-sm sm:text-base text-black leading-relaxed">
                      Hindi pa bukas ang early registration. Mangyaring bumalik kapag nagsimula na ang panahon ng early registration.
                    </p>
                    <p className="text-sm text-black font-medium pt-4 border-t border-border/50">
                      Please stay tuned to our official school social media pages or visit the school campus for announcements regarding the next registration schedule.
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
                    <Card className="text-center py-12 shadow-xl border-2 border-primary/10 rounded-3xl">
                      <CardContent className="space-y-4">
                        <div className="flex justify-center mb-4">
                          <CheckCircle2 className="w-16 h-16 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-primary">
                          Matagumpay ang Pag-register! / Registration Successful!
                        </h2>
                        <p className="text-muted-foreground text-lg max-w-md mx-auto">
                          Nai-submit na ang early registration ni{" "}
                          <span className="font-semibold text-foreground">
                            {successData.learnerName}
                          </span>
                          . Ang registration ID ay{" "}
                          <span className="font-mono font-bold text-foreground">
                            #{successData.id}
                          </span>
                          .
                        </p>
                        <div className="pt-6 border-t border-border/60">
                          <Button
                            onClick={handleReset}
                            variant="outline"
                            className="h-12 px-8 font-bold gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Register Another Learner
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
