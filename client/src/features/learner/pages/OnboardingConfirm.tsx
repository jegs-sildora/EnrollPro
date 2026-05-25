import { useState, useEffect } from "react";
import { ConfirmationWall } from "../components/ConfirmationWall";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import { Navigate, useNavigate } from "react-router";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { LearnerPixelGridBackground } from "@/features/learner/components/LearnerPixelGridBackground";

export default function OnboardingConfirm() {
  const { user, clearAuth, isHydrated } = useLearnerAuthStore();
  const queryClient = useQueryClient();
  const [loadFailed, setLoadFailed] = useState(false);
  const navigate = useNavigate();

  const learnerQuery = useQuery({
    queryKey: queryKeys.learnerProfile,
    queryFn: async () => {
      const profileRes = await api.get("/learner/profile", { timeout: 10000 });
      return profileRes.data?.learner ?? null;
    },
    enabled: isHydrated && user?.role === "LEARNER",
  });

  const learner = learnerQuery.data;

  useEffect(() => {
    if (!isHydrated) return;
    if (user?.role !== "LEARNER") {
      setLoadFailed(true);
      return;
    }
    if (learnerQuery.isError) {
      console.error("OnboardingConfirm: Failed to fetch profile", learnerQuery.error);
      setLoadFailed(true);
      return;
    }
    if (learner) {
      setLoadFailed(false);
    }
  }, [isHydrated, user?.role, learnerQuery.isError, learnerQuery.error, learner]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout-learner");
    } catch {
      // Ignore
    }
    queryClient.removeQueries({ queryKey: queryKeys.learnerProfile });
    clearAuth();
    navigate("/learner/login", { replace: true });
    sileo.success({
      title: "Signed Out",
      description: "You have successfully exited the Learner Portal.",
    });
  };

  const handleSuccess = (_nextStep: "COMPLETE") => {
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
            <Button variant="outline" onClick={() => void learnerQuery.refetch()}>
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
