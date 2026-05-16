import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Check, CheckCircle2, ChevronDown, Loader2, Lock, Search } from "lucide-react";
import { sileo } from "sileo";
import type { AxiosError } from "axios";

import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useLearnerStore } from "@/store/learner.slice";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";
import { motion } from "motion/react";

type TLEProgram = {
  id: number;
  name: string;
  category: SectorKey | string;
  availableSlots: number | null;
};

type TLEOptionsResponse = {
  phase: "SPECIALIZATION" | string;
  options?: TLEProgram[];
};

type Step = "form" | "success";

type SectorKey = "ICT" | "HE" | "IA" | "AFA" | "GENERAL";

type RichTleOption = {
  value: string;
  id: number;
  programName: string;
  sector: SectorKey;
  categoryLabel: string;
  sectorIcon: string;
  searchText: string;
};

const sectorIcons: Record<SectorKey, string> = {
  ICT: "💻",
  HE: "🍳",
  IA: "🛠️",
  AFA: "🌾",
  GENERAL: "📘",
};

const sectorLabels: Record<SectorKey, string> = {
  ICT: "Information and Communications Technology",
  HE: "Home Economics",
  IA: "Industrial Arts",
  AFA: "Agri-Fishery Arts",
  GENERAL: "Other Specializations",
};

function inferSector(option: TLEProgram): SectorKey {
  const normalizedCategory = String(option.category ?? "").toUpperCase();

  if (normalizedCategory === "ICT") {
    return "ICT";
  }
  if (
    normalizedCategory === "HE" ||
    normalizedCategory === "HOME_ECONOMICS"
  ) {
    return "HE";
  }
  if (
    normalizedCategory === "IA" ||
    normalizedCategory === "INDUSTRIAL_ARTS"
  ) {
    return "IA";
  }
  if (
    normalizedCategory === "AFA" ||
    normalizedCategory === "AGRI_FISHERY_ARTS"
  ) {
    return "AFA";
  }

  return "GENERAL";
}

function RichChoiceSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (nextValue: string) => void;
  options: RichTleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value) ?? null;

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }

    return options.filter((option) => option.searchText.includes(normalized));
  }, [options, query]);

  const groupedOptions = useMemo(() => {
    const groups = new Map<SectorKey, RichTleOption[]>();

    for (const option of filteredOptions) {
      const existing = groups.get(option.sector) ?? [];
      existing.push(option);
      groups.set(option.sector, existing);
    }

    const order: SectorKey[] = ["HE", "IA", "ICT", "AFA", "GENERAL"];
    return order
      .map((sector) => ({
        sector,
        options: groups.get(sector) ?? [],
      }))
      .filter((group) => group.options.length > 0);
  }, [filteredOptions]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/80">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-14 w-full justify-between rounded-xl border-2 border-primary/20 bg-white/90 px-4 py-3 text-left hover:bg-white"
          >
            {selected ? (
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-xl leading-none">{selected.sectorIcon}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{selected.programName}</p>
                  <p className="truncate text-xs text-foreground/70">{selected.categoryLabel}</p>
                </div>
              </div>
            ) : (
              <span className="text-sm text-foreground/60">{placeholder}</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-foreground/60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] rounded-xl border-2 border-primary/20 bg-white p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search specialization..."
              className="h-10 rounded-lg border-primary/20 pl-9"
            />
          </div>
          <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-foreground/60">
                No matching specialization found.
              </p>
            ) : (
              groupedOptions.map((group) => (
                <div key={group.sector} className="space-y-1.5">
                  <p className="px-1 text-[11px] font-black uppercase tracking-[0.08em] text-foreground/60">
                    {sectorLabels[group.sector]}
                  </p>
                  {group.options.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          isSelected
                            ? "border-primary/40 bg-primary/10"
                            : "border-transparent hover:border-primary/20 hover:bg-primary/5",
                        )}
                      >
                        <span className="text-xl leading-none">{option.sectorIcon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground">{option.programName}</p>
                          <p className="truncate text-xs text-foreground/70">{option.categoryLabel}</p>
                        </div>
                        {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

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

  const specializationOptions = useMemo<RichTleOption[]>(() => {
    return options.map((option) => {
      const sector = inferSector(option);

      return {
        value: String(option.id),
        id: option.id,
        programName: option.name,
        sector,
        categoryLabel: sectorLabels[sector],
        sectorIcon: sectorIcons[sector],
        searchText: `${option.name} ${sector} ${sectorLabels[sector]}`.toLowerCase(),
      };
    });
  }, [options]);

  const selectedPrimary = useMemo(
    () => specializationOptions.find((option) => option.value === choice1) ?? null,
    [choice1, specializationOptions],
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
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-xl"
        >
          <Card className="w-full">
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
        </motion.div>
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
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
            <Card className="w-full text-center bg-white/95 backdrop-blur-md">
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
          </motion.div>
        </div>
      </div>
    );
  }

  if (isScpBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-2xl"
        >
          <Card className="w-full">
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
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10" style={{ background: "hsl(var(--accent))" }}>
        <svg className="absolute inset-0 h-full w-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
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
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-2xl"
        >
          <Card className="w-full border-2 border-white/60 bg-white/95 shadow-2xl backdrop-blur-md">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl font-black text-foreground sm:text-3xl">
              Choose Your Grade 9 TLE Specialization
            </CardTitle>
            <CardDescription className="text-sm font-medium text-foreground/75 sm:text-base">
              Select the laboratory track you will focus on for this entire academic year.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RichChoiceSelect
              label="Primary Choice"
              placeholder="Select your main specialization"
              value={choice1}
              onChange={setChoice1}
              options={specializationOptions}
            />

            {selectedPrimary ? (
              <p className="-mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                Nice! {selectedPrimary.programName} can be a strong pathway toward NC II certification.
              </p>
            ) : null}

            <RichChoiceSelect
              label="Fallback Choice"
              placeholder="Select your backup specialization"
              value={choice2}
              onChange={setChoice2}
              options={specializationOptions}
            />

            <div className="flex flex-col items-end gap-2 pt-2">
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting || !choice1 || !choice2}
                className="min-w-64 font-black uppercase tracking-[0.08em]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "[ Submit Specialization Choices ]"
                )}
              </Button>
              {(!choice1 || !choice2) ? (
                <p className="text-xs font-medium text-foreground/60">
                  Select both choices to enable submission.
                </p>
              ) : null}
            </div>
          </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
