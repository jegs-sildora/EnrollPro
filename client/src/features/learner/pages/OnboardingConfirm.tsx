import { useState, useEffect, useCallback } from "react";
import { ConfirmationWall } from "../components/ConfirmationWall";
import { Loader2 } from "lucide-react";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useLearnerStore } from "@/store/learner.slice";
import { useNavigate } from "react-router";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";

export default function OnboardingConfirm() {
  const { token, user, clearAuth } = useLearnerAuthStore();
  const { learner, setLearner, logout: clearLearnerData } = useLearnerStore();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!token || user?.role !== "LEARNER") return;
    setLoading(true);
    try {
      const profileRes = await api.get("/learner/profile");
      setLearner(profileRes.data.learner);
    } catch (error) {
      console.error("OnboardingConfirm: Failed to fetch profile", error);
    } finally {
      setLoading(false);
    }
  }, [token, user?.role, setLearner]);

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

  if (loading || !learner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
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
