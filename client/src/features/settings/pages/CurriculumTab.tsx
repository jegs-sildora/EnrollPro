import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, CalendarDays, Lock } from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { DatePicker } from "@/shared/ui/date-picker";
import { TimePicker } from "@/shared/ui/time-picker";
import {
  SCP_DEFAULT_PIPELINES,
  getSteSteps,
  type ScpType,
} from "@enrollpro/shared";

interface ScpStepConfig {
  id?: number;
  stepOrder: number;
  kind: string;
  label: string;
  description: string | null;
  isRequired: boolean;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  notes: string | null;
  cutoffScore: number | null;
}

interface ScpConfig {
  id?: number;
  scpType: string;
  isOffered: boolean;
  isTwoPhase: boolean;
  cutoffScore: number | null;
  artFields: string[];
  languages: string[];
  sportsList: string[];
  steps: ScpStepConfig[];
}

const SCP_TYPES = [
  {
    value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    label: "Science, Technology, and Engineering (STE)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_THE_ARTS",
    label: "Special Program in the Arts (SPA)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_SPORTS",
    label: "Special Program in Sports (SPS)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_JOURNALISM",
    label: "Special Program in Journalism (SPJ)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    label: "Special Program in Foreign Language (SPFL)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "Special Program in Tech-Voc Education (SPTVE)",
  },
];

export default function CurriculumTab() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  // Use Manila timezone for current year restriction
  const currentYearInManila = parseInt(
    new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }),
  );
  const scpYearStart = new Date(currentYearInManila, 0, 1);
  const scpYearEnd = new Date(currentYearInManila, 11, 31);

  const [scpConfigs, setScpConfigs] = useState<ScpConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingScp, setSavingScp] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [scpRes] = await Promise.all([
        api.get(`/curriculum/${ayId}/scp-config`),
      ]);

      // Merge official SCP types with fetched configs
      const fetched = scpRes.data.scpProgramConfigs as ScpConfig[];
      const merged = SCP_TYPES.map((type) => {
        const found = fetched.find((f) => f.scpType === type.value);
        if (found) {
          return {
            ...found,
            isOffered: found.isOffered ?? false,
            isTwoPhase: found.isTwoPhase ?? false,
            steps: found.steps ?? [],
          };
        }
        // Default configuration for new programs
        return {
          scpType: type.value,
          isOffered: false,
          isTwoPhase: false,
          cutoffScore: null,
          artFields: [],
          languages: [],
          sportsList: [],
          steps: [],
        };
      });
      setScpConfigs(merged);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ——— SCP Actions ————————————————————————————————————————————————————————

  const handleUpdateScpField = (
    index: number,
    field: keyof ScpConfig,
    value: string | boolean | number | string[] | null,
  ) => {
    const next = [...scpConfigs];
    next[index] = { ...next[index], [field]: value };

    // Auto-populate DepEd pipeline steps when toggling isOffered on
    if (field === "isOffered" && value === true) {
      const scpType = next[index].scpType as ScpType;
      const isSte = scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
      const pipeline = isSte
        ? getSteSteps(next[index].isTwoPhase)
        : SCP_DEFAULT_PIPELINES[scpType];
      if (pipeline && next[index].steps.length === 0) {
        next[index] = {
          ...next[index],
          steps: pipeline.map((s) => ({
            stepOrder: s.stepOrder,
            kind: s.kind,
            label: s.label,
            description: s.description,
            isRequired: s.isRequired,
            scheduledDate: null,
            scheduledTime: null,
            venue: null,
            notes: null,
            cutoffScore: null,
          })),
        };
      }
    }

    // STE: switch pipeline steps when toggling examination phase
    if (field === "isTwoPhase") {
      const pipeline = getSteSteps(value as boolean);
      next[index] = {
        ...next[index],
        steps: pipeline.map((s) => ({
          stepOrder: s.stepOrder,
          kind: s.kind,
          label: s.label,
          description: s.description,
          isRequired: s.isRequired,
          scheduledDate: null,
          scheduledTime: null,
          venue: null,
          notes: null,
          cutoffScore: null,
        })),
      };
    }

    setScpConfigs(next);
  };

  const handleUpdateStep = (
    scpIndex: number,
    stepIndex: number,
    field: keyof ScpStepConfig,
    value: string | boolean | number | null,
  ) => {
    const next = [...scpConfigs];
    const steps = [...next[scpIndex].steps];
    steps[stepIndex] = { ...steps[stepIndex], [field]: value };
    next[scpIndex] = { ...next[scpIndex], steps };
    setScpConfigs(next);
  };

  const handleSaveScp = async () => {
    if (!ayId) return;
    setSavingScp(true);
    try {
      // Normalize text fields to uppercase for database consistency
      const uppercasedConfigs = scpConfigs.map((scp) => ({
        ...scp,
        isTwoPhase: scp.isTwoPhase ?? false,
        artFields: scp.artFields.map((f) => f.trim().toUpperCase()),
        languages: scp.languages.map((l) => l.trim().toUpperCase()),
        sportsList: scp.sportsList.map((s) => s.trim().toUpperCase()),
        steps: scp.steps.map((step) => ({
          stepOrder: step.stepOrder,
          scheduledDate: step.scheduledDate,
          scheduledTime: step.scheduledTime,
          venue: step.venue?.trim().toUpperCase() || null,
          notes: step.notes,
          cutoffScore: step.cutoffScore ?? null,
        })),
      }));

      await api.put(`/curriculum/${ayId}/scp-config`, {
        scpProgramConfigs: uppercasedConfigs,
      });
      sileo.success({
        title: "SCP Configuration Saved",
        description: "Special programs updated for this year.",
      });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingScp(false);
    }
  };

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-20rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">
                No School Year Selected
              </p>
              <p className="text-sm leading-relaxed px-4">
                Please set an active year or choose one from the header switcher
                to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!loading && (
        <>
          {/* SCP Configuration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5" />
                  Special Curricular Programs (SCP)
                </CardTitle>
                <CardDescription className="font-bold">
                  Configure Early Registration criteria for STE, SPA, SPS, etc.
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleSaveScp} disabled={savingScp}>
                {savingScp ? "Saving..." : "Save Configuration"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {scpConfigs.map((scp, idx) => (
                  <div
                    key={scp.scpType}
                    className="rounded-xl border border-border overflow-hidden bg-card">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted border-b">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={scp.isOffered ?? false}
                          onCheckedChange={(checked) =>
                            handleUpdateScpField(idx, "isOffered", checked)
                          }
                        />
                        <span className="text-sm font-bold">
                          {SCP_TYPES.find((t) => t.value === scp.scpType)
                            ?.label || scp.scpType}
                        </span>
                      </div>
                      {scp.isOffered && (
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/20">
                          ACTIVE
                        </Badge>
                      )}
                    </div>

                    {scp.isOffered && (
                      <div className="p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        {" "}
                        {/* STE: Examination Phase Toggle */}
                        {scp.scpType ===
                          "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && (
                          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                            <Label className="text-sm font-bold">
                              Examination Phase
                            </Label>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  !scp.isTwoPhase
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }`}>
                                1 Phase
                              </span>
                              <Switch
                                checked={scp.isTwoPhase}
                                onCheckedChange={(checked) =>
                                  handleUpdateScpField(
                                    idx,
                                    "isTwoPhase",
                                    checked,
                                  )
                                }
                              />
                              <span
                                className={`text-xs font-bold ${
                                  scp.isTwoPhase
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }`}>
                                2 Phase
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {scp.isTwoPhase
                                ? "Preliminary Exam → Final Exam → Interview"
                                : "Qualifying Exam → Interview"}
                            </span>
                          </div>
                        )}
                        {/* Assessment Pipeline — DepEd-mandated, read-only structure */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold uppercase tracking-wide">
                              Admission Steps
                            </Label>
                          </div>

                          {scp.steps.length === 0 && (
                            <p className="text-sm  italic py-2">
                              No assessment pipeline defined for this program
                              type.
                            </p>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {scp.steps.map((step, stepIdx) => (
                              <div
                                key={stepIdx}
                                className="rounded-lg border border-border overflow-hidden bg-muted/20">
                                {/* Step header — read-only */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
                                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                                    {step.stepOrder}
                                  </span>
                                  <span className="text-sm font-bold text-foreground">
                                    {step.label}
                                  </span>
                                  {step.isRequired ? (
                                    <Badge
                                      variant="outline"
                                      className="ml-auto text-sm px-1.5 py-0 h-4">
                                      Required
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="ml-auto text-sm px-1.5 py-0 h-4 text-muted-foreground">
                                      Optional
                                    </Badge>
                                  )}
                                </div>

                                {/* Editable schedule fields */}
                                <div className="px-3 py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <DatePicker
                                    date={
                                      step.scheduledDate
                                        ? new Date(step.scheduledDate)
                                        : undefined
                                    }
                                    setDate={(date) =>
                                      handleUpdateStep(
                                        idx,
                                        stepIdx,
                                        "scheduledDate",
                                        date ? date.toISOString() : null,
                                      )
                                    }
                                    minDate={scpYearStart}
                                    maxDate={scpYearEnd}
                                    showYearSelect={false}
                                    className="h-8 text-sm font-bold uppercase"
                                  />
                                  <TimePicker
                                    value={step.scheduledTime}
                                    onChange={(time) =>
                                      handleUpdateStep(
                                        idx,
                                        stepIdx,
                                        "scheduledTime",
                                        time,
                                      )
                                    }
                                    className="h-8"
                                  />
                                </div>

                                {/* Exam-specific: Cut-off Score with auto-pass/fail */}
                                {[
                                  "QUALIFYING_EXAMINATION",
                                  "PRELIMINARY_EXAMINATION",
                                  "FINAL_EXAMINATION",
                                ].includes(step.kind) && (
                                  <div className="px-3 pt-2 border-t border-border/50">
                                    <div className="max-w-[200px] space-y-1">
                                      <Label className="text-sm font-bold uppercase">
                                        Cut-off Score
                                      </Label>
                                      <Input
                                        type="number"
                                        placeholder="Min Score"
                                        className="h-8 text-sm font-bold"
                                        value={step.cutoffScore ?? ""}
                                        onChange={(e) =>
                                          handleUpdateStep(
                                            idx,
                                            stepIdx,
                                            "cutoffScore",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : null,
                                          )
                                        }
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Auto-determines pass / fail
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Gating hint for steps that depend on a prior step passing */}
                                {stepIdx > 0 &&
                                  scp.steps
                                    .slice(0, stepIdx)
                                    .some((prev) => prev.isRequired) && (
                                    <p className="px-3 pb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                      <Lock className="h-3 w-3" />
                                      Gated — requires passing{" "}
                                      {scp.steps
                                        .filter(
                                          (prev) =>
                                            prev.stepOrder < step.stepOrder &&
                                            prev.isRequired,
                                        )
                                        .map((prev) => prev.label)
                                        .join(", ")}
                                    </p>
                                  )}

                                {/* Venue & Notes — available for all step types */}
                                <div className="px-3 pb-3 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-sm font-bold uppercase">
                                      Venue
                                    </Label>
                                    <Input
                                      placeholder="Venue (optional)"
                                      className="h-8 text-sm font-bold uppercase"
                                      value={step.venue || ""}
                                      onChange={(e) =>
                                        handleUpdateStep(
                                          idx,
                                          stepIdx,
                                          "venue",
                                          e.target.value || null,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-sm font-bold uppercase">
                                      Notes
                                    </Label>
                                    <Input
                                      placeholder="Additional requirements..."
                                      className="h-8 text-sm font-bold uppercase"
                                      value={step.notes || ""}
                                      onChange={(e) =>
                                        handleUpdateStep(
                                          idx,
                                          stepIdx,
                                          "notes",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Conditional program-specific fields */}
                        {scp.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS" && (
                          <div className="space-y-1.5">
                            <Label className="text-sm font-bold">
                              Art Fields
                            </Label>
                            <Input
                              placeholder="Visual Arts, Music, Theatre Arts, Creative Writing..."
                              className="h-9 text-sm"
                              value={scp.artFields.join(", ")}
                              onChange={(e) =>
                                handleUpdateScpField(
                                  idx,
                                  "artFields",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim()),
                                )
                              }
                            />
                            <p className="text-sm /60">
                              Separate multiple fields with commas
                            </p>
                          </div>
                        )}
                        {scp.scpType === "SPECIAL_PROGRAM_IN_SPORTS" && (
                          <div className="space-y-1.5">
                            <Label className="text-sm font-bold ">
                              Sports Offered
                            </Label>
                            <Input
                              placeholder="Basketball, Volleyball, Archery, Swimming..."
                              className="h-9 text-sm"
                              value={scp.sportsList.join(", ")}
                              onChange={(e) =>
                                handleUpdateScpField(
                                  idx,
                                  "sportsList",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim()),
                                )
                              }
                            />
                            <p className="text-sm /60">
                              Separate multiple sports with commas
                            </p>
                          </div>
                        )}
                        {scp.scpType ===
                          "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE" && (
                          <div className="space-y-1.5">
                            <Label className="text-sm font-bold ">
                              Languages Offered
                            </Label>
                            <Input
                              placeholder="Spanish, Japanese, French, Mandarin..."
                              className="h-9 text-sm"
                              value={scp.languages.join(", ")}
                              onChange={(e) =>
                                handleUpdateScpField(
                                  idx,
                                  "languages",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim()),
                                )
                              }
                            />
                            <p className="text-sm /60">
                              Separate multiple languages with commas
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
