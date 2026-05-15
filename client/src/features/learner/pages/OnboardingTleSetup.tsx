import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { sileo } from "sileo";
import type { AxiosError } from "axios";

import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useLearnerStore } from "@/store/learner.slice";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

type TLEProgram = {
  id: number;
  name: string;
  category: string;
  availableSlots: number | null;
};

type TLEOptionsResponse = {
  phase: "SPECIALIZATION" | string;
  options?: TLEProgram[];
};

type Step = "form" | "success";

export default function OnboardingTleSetup() {
  const navigate = useNavigate();
  const { token, user } = useLearnerAuthStore();
  const { learner, setLearner } = useLearnerStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoFinalizing, setAutoFinalizing] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [options, setOptions] = useState<TLEProgram[]>([]);
  const [choice1, setChoice1] = useState("");
  const [choice2, setChoice2] = useState("");
  const [error, setError] = useState<string | null>(null);

  const appId = learner?.pendingConfirmation?.applicationId;
  const targetGradeOrder = learner?.pendingConfirmation?.gradeLevelDisplayOrder ?? null;
  const isGrade9 = targetGradeOrder === 9;
  const curriculumType = learner?.curriculum ?? null;
  const isRegularCurriculum = curriculumType === "REGULAR";
  const isScpBypass = isGrade9 && !isRegularCurriculum;

  const fetchContext = useCallback(async () => {
    if (!token || user?.role !== "LEARNER") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profileRes = await api.get("/learner/profile");
      const nextLearner = profileRes.data.learner;
      setLearner(nextLearner);

      const nextGradeOrder = nextLearner?.pendingConfirmation?.gradeLevelDisplayOrder ?? null;
      const nextAppId = nextLearner?.pendingConfirmation?.applicationId;
      const nextGradeLevelId = nextLearner?.pendingConfirmation?.gradeLevelId;
      const nextCurriculumType = nextLearner?.curriculum ?? null;

      if (!nextAppId || nextGradeOrder !== 9) {
        navigate("/learner", { replace: true });
        return;
      }

      if (nextCurriculumType !== "REGULAR") {
        return;
      }

      if (!nextGradeLevelId) {
        setError("Missing Grade 9 enrollment context.");
        return;
      }

      const tleRes = await api.get<TLEOptionsResponse>(`/learner/tle-options/${nextGradeLevelId}`);
      setOptions(tleRes.data.options ?? []);
    } catch (e) {
      setError("Unable to load TLE setup details.");
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
    } finally {
      setLoading(false);
    }
  }, [navigate, setLearner, token, user?.role]);

  useEffect(() => {
    void fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    if (!isScpBypass || !appId || loading || step === "success" || autoFinalizing) {
      return;
    }

    const runBypassFinalization = async () => {
      setAutoFinalizing(true);
      try {
        await api.post("/learner/confirm-return", {
          confirmAction: "SUBMIT_TLE_CHOICES",
          applicationId: appId,
        });

        setStep("success");
        sileo.success({
          title: "Confirmation Finalized",
          description: "You are under a Special Curricular Program. Your track is locked.",
        });
      } catch (e) {
        toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
      } finally {
        setAutoFinalizing(false);
      }
    };

    void runBypassFinalization();
  }, [appId, autoFinalizing, isScpBypass, loading, step]);

  const regularOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        isFull: option.availableSlots != null && option.availableSlots <= 0,
      })),
    [options],
  );

  const handleSubmit = async () => {
    if (!appId) {
      return;
    }

    if (!choice1 || !choice2) {
      sileo.warning({
        title: "Required Choices Missing",
        description: "Select both primary and fallback TLE choices.",
      });
      return;
    }

    if (choice1 === choice2) {
      sileo.warning({
        title: "Invalid Selection",
        description: "Primary and fallback choices must be different.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/learner/confirm-return", {
        confirmAction: "SUBMIT_TLE_CHOICES",
        applicationId: appId,
        tleProgramId: Number(choice1),
        tleProgramChoice2Id: Number(choice2),
      });

      setStep("success");
      sileo.success({
        title: "TLE Choices Saved",
        description: "Your return is confirmed. Please wait for official sectioning.",
      });
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>TLE Setup Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate("/learner", { replace: true })}>
              Back to Portal
            </Button>
            <Button onClick={() => void fetchContext()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="fixed inset-0 -z-10" style={{ background: "hsl(var(--accent))" }}>
          <svg className="absolute inset-0 w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pixel-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect x="2" y="2" width="36" height="36" rx="2" fill="none" className="stroke-white" strokeWidth="1.5" />
                <rect x="42" y="2" width="36" height="36" rx="2" fill="none" className="stroke-white" strokeWidth="1.5" />
                <rect x="2" y="42" width="36" height="36" rx="2" fill="none" className="stroke-white" strokeWidth="1.5" />
                <rect x="42" y="42" width="36" height="36" rx="2" fill="none" className="stroke-white" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pixel-grid)" />
          </svg>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)" }} />
        </div>

        <div className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-2xl text-center bg-white/95 backdrop-blur-md">
            <CardContent className="py-14 space-y-6">
              <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-black uppercase text-foreground">Confirmation Complete</h2>
              <p className="text-sm font-semibold text-foreground max-w-xl mx-auto">
                Your return is confirmed. Please wait for official sectioning.
              </p>
              <Button onClick={() => navigate("/learner", { replace: true })} className="font-black uppercase tracking-wider">
                Continue to Learner Portal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isScpBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              TLE Track Locked
            </CardTitle>
            <CardDescription>
              You are under a Special Curricular Program. Your track is locked.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm font-semibold text-foreground">
              {autoFinalizing
                ? "Finalizing your confirmation now..."
                : "Finalization in progress."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Grade 9 TLE Setup</CardTitle>
          <CardDescription>
            Select your primary and fallback specialization choices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Primary Choice</Label>
            <Select value={choice1} onValueChange={setChoice1}>
              <SelectTrigger>
                <SelectValue placeholder="Select primary choice" />
              </SelectTrigger>
              <SelectContent>
                {regularOptions.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={String(option.id)}
                    disabled={option.isFull}
                  >
                    {option.name}
                    {option.availableSlots != null
                      ? ` (${option.availableSlots} slot${option.availableSlots === 1 ? "" : "s"} left)`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fallback Choice</Label>
            <Select value={choice2} onValueChange={setChoice2}>
              <SelectTrigger>
                <SelectValue placeholder="Select fallback choice" />
              </SelectTrigger>
              <SelectContent>
                {regularOptions.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={String(option.id)}
                    disabled={option.isFull || choice1 === String(option.id)}
                  >
                    {option.name}
                    {option.availableSlots != null
                      ? ` (${option.availableSlots} slot${option.availableSlots === 1 ? "" : "s"} left)`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || !choice1 || !choice2}
              className="font-black uppercase tracking-wider"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit TLE Choices"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
