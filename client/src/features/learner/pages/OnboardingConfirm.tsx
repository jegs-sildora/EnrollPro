import { useState, useEffect, useCallback } from "react";
import { ConfirmationWall } from "../components/ConfirmationWall";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useLearnerStore } from "@/store/learner.slice";
import { Navigate, useNavigate } from "react-router";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { LearnerPixelGridBackground } from "@/features/learner/components/LearnerPixelGridBackground";

export default function OnboardingConfirm() {
  const { user, clearAuth, isHydrated } = useLearnerAuthStore();
  const { learner, setLearner, logout: clearLearnerData } = useLearnerStore();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!isHydrated) return;
    if (user?.role !== "LEARNER") {
      setLoadFailed(true);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    try {
      const profileRes = await api.get("/learner/profile", { timeout: 10000 });
      const fetchedLearner = profileRes.data?.learner;
      if (!fetchedLearner) {
        setLoadFailed(true);
        return;
      }
      setLearner(fetchedLearner);
    } catch (error) {
      console.error("OnboardingConfirm: Failed to fetch profile", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user?.role, isHydrated, setLearner]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout-learner");
    } catch {
      // Ignore
    }
    clearLearnerData();
    clearAuth();
    navigate("/learner/login", { replace: true });
    sileo.success({
      title: "Signed Out",
      description: "You have successfully exited the Learner Portal.",
    });
  };

  const handleSuccess = (nextStep: "COMPLETE" | "TLE_SELECTION") => {
    if (nextStep === "TLE_SELECTION") {
      navigate("/learner/onboarding/tle-setup", { replace: true });
      return;
    }

    navigate("/learner", { replace: true });
  };

  const handleRedirectDashboard = () => {
    navigate("/learner", { replace: true });
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50/50">
        <LearnerPixelGridBackground />
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (user?.role !== "LEARNER") {
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

  if (!learner) {
    if (!loadFailed) {
      return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50/50">
          <LearnerPixelGridBackground />
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        </div>
      );
    }

    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50/50 px-4">
        <LearnerPixelGridBackground />
        <div className="w-full max-w-md rounded-xl border bg-white p-6 text-center space-y-4 shadow-sm">
          <p className="text-sm font-bold text-foreground">
            Unable to load your confirmation details right now.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => void fetchData()}>
              Retry
            </Button>
            <Button onClick={() => navigate("/learner", { replace: true })}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConfirmationWall 
      learner={learner} 
      onSuccess={handleSuccess}
      onLogout={handleLogout}
      onRedirectDashboard={handleRedirectDashboard}
    />
  );
}
