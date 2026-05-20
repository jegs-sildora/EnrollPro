import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { LearnerPixelGridBackground } from "@/features/learner/components/LearnerPixelGridBackground";

type OnboardingStep = "CONFIRMATION" | "TLE_SELECTION" | "COMPLETE";

export default function OnboardingGuard() {
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isHydrated } = useLearnerAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!isHydrated) return;
    if (!user || user.role !== "LEARNER") {
      setLoading(false);
      return;
    }

    let isMounted = true;
    
    const checkStatus = async () => {
      try {
        const res = await api.get<{ nextStep: OnboardingStep }>(
          "/learner/onboarding-status",
          { timeout: 10000 },
        );
        if (isMounted) {
          setStep(res.data.nextStep);
        }
      } catch (error) {
        console.error("Failed to check onboarding status", error);
        if (isMounted) {
          setStep("COMPLETE");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkStatus();

    return () => { isMounted = false; };
  }, [user, isHydrated, location.pathname]); // Re-check on path changes within learner portal

  if (!isHydrated) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50/50">
        <LearnerPixelGridBackground />
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!user || user.role !== "LEARNER") {
    return <Navigate to="/learner/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50/50">
        <LearnerPixelGridBackground />
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  // Define paths
  const confirmPath = "/learner/onboarding/confirm";
  const tlePath = "/learner/onboarding/tle-setup";
  const dashboardPath = "/learner";

  // Prevent infinite loops and enforce the tunnel
  if (step === "CONFIRMATION" && location.pathname !== confirmPath) {
    return <Navigate to={confirmPath} replace />;
  }

  if (step === "TLE_SELECTION" && location.pathname !== tlePath) {
    return <Navigate to={tlePath} replace />;
  }

  if (step === "COMPLETE" && (location.pathname === confirmPath || location.pathname === tlePath)) {
    return <Navigate to={dashboardPath} replace />;
  }

  return <Outlet />;
}
