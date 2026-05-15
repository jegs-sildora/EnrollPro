import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";

type OnboardingStep = "CONFIRMATION" | "TLE_SELECTION" | "COMPLETE";

export default function OnboardingGuard() {
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useLearnerAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    
    const checkStatus = async () => {
      try {
        const res = await api.get<{ nextStep: OnboardingStep }>("/learner/onboarding-status");
        if (isMounted) {
          setStep(res.data.nextStep);
        }
      } catch (error) {
        console.error("Failed to check onboarding status", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkStatus();

    return () => { isMounted = false; };
  }, [token, location.pathname]); // Re-check on path changes within learner portal

  if (!token) {
    return <Navigate to="/learner/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
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
