import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Layers,
  ShieldCheck,
  Calendar,
  Clock,
  Info,
  CheckCircle2,
  Circle,
  CalendarDays,
} from "lucide-react";
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
  CardFooter,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { DatePicker } from "@/shared/ui/date-picker";
import { TimePicker } from "@/shared/ui/time-picker";
import { ACADEMIC_CLUSTERS, TECHPRO_CLUSTERS } from "@/features/admission/pages/apply/types";

import { Skeleton } from "@/shared/ui/skeleton";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

interface GradeLevel {
  id: number;
  name: string;
  displayOrder: number;
  sections: { id: number; _count: { enrollments: number } }[];
  _count?: { applicants: number };
}

interface Strand {
  id: number;
  name: string;
  applicableGradeLevelIds: number[];
  curriculumType: "OLD_STRAND" | "ELECTIVE_CLUSTER";
  track: "ACADEMIC" | "TECHPRO" | null;
}

interface ScpConfig {
  id?: number;
  scpType: string;
  isOffered: boolean;
  cutoffScore: number | null;
  examDate: string | null;
  examTime: string | null;
  artFields: string[];
  languages: string[];
  sportsList: string[];
  notes: string | null;
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
  { value: "STEM_GRADE_11", label: "Grade 11 STEM (Placement Exam)" },
];

export default function CurriculumTab() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [strands, setStrands] = useState<Strand[]>([]);
  const [scpConfigs, setScpConfigs] = useState<ScpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  const [curriculumDirty, setCurriculumDirty] = useState(false);
  const [savingCurriculum, setSavingCurriculum] = useState(false);
  const [savingScp, setSavingScp] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [glRes, stRes, scpRes] = await Promise.all([
        api.get(`/curriculum/${ayId}/grade-levels`),
        api.get(`/curriculum/${ayId}/strands`),
        api.get(`/curriculum/${ayId}/scp-config`),
      ]);
      setGradeLevels(glRes.data.gradeLevels);
      setStrands(stRes.data.strands);
      setCurriculumDirty(false);

      // Merge official SCP types with fetched configs
      const fetched = scpRes.data.scpConfigs as ScpConfig[];
      const merged = SCP_TYPES.map((type) => {
        const found = fetched.find((f) => f.scpType === type.value);
        return (
          found || {
            scpType: type.value,
            isOffered: false,
            cutoffScore: null,
            examDate: null,
            examTime: null,
            artFields: [],
            languages: [],
            sportsList: [],
            notes: null,
          }
        );
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

  // ——— Strand Actions —————————————————————————————————————————————————————

  const toggleStrandPresence = (
    name: string,
    curriculumType: "OLD_STRAND" | "ELECTIVE_CLUSTER",
    track: "ACADEMIC" | "TECHPRO" | null,
  ) => {
    setStrands((prev) => {
      const exists = prev.some(
        (s) => s.name === name && s.curriculumType === curriculumType,
      );
      if (exists) {
        return prev.filter(
          (s) => !(s.name === name && s.curriculumType === curriculumType),
        );
      } else {
        return [
          ...prev,
          {
            id: Math.random(),
            name,
            curriculumType,
            track,
            applicableGradeLevelIds: [],
          } as Strand,
        ];
      }
    });
    setCurriculumDirty(true);
  };

  const handleSaveCurriculum = async () => {
    if (!ayId) return;
    setSavingCurriculum(true);
    try {
      const payload = strands.map((s) => ({
        name: s.name,
        curriculumType: s.curriculumType,
        track: s.track,
      }));
      await api.put(`/curriculum/${ayId}/strands/sync`, { strands: payload });
      sileo.success({
        title: "Curriculum Saved",
        description: "Available clusters and strands updated.",
      });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingCurriculum(false);
    }
  };

  // ——— SCP Actions ————————————————————————————————————————————————————————

  const handleUpdateScpField = (
    index: number,
    field: keyof ScpConfig,
    value: string | boolean | number | string[] | null,
  ) => {
    const next = [...scpConfigs];
    next[index] = { ...next[index], [field]: value };
    setScpConfigs(next);
  };

  const handleSaveScp = async () => {
    if (!ayId) return;
    setSavingScp(true);
    try {
      await api.put(`/curriculum/${ayId}/scp-config`, { scpConfigs });
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
              <p className="font-bold text-foreground">No School Year Selected</p>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                Please set an active year or choose one from the header switcher to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <Skeleton className='h-8 w-48 mb-2' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
              <div className='space-y-3'>
                <Skeleton className='h-4 w-32' />
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className='h-12 w-full rounded-lg' />
                ))}
              </div>
              <div className='space-y-3'>
                <Skeleton className='h-4 w-32' />
                {[1, 2].map((i) => (
                  <Skeleton key={i} className='h-12 w-full rounded-lg' />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className='h-8 w-64' />
          </CardHeader>
          <CardContent className='space-y-4'>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className='h-16 w-full rounded-xl' />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Grade Levels */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <div>
            <CardTitle className='flex items-center gap-2 text-xl'>
              <BookOpen className='h-5 w-5' />
              Grade Levels
            </CardTitle>
            <CardDescription>
              View grade levels offered by the school
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
            <div className='space-y-3'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1'>
                Junior High School
              </p>
              {[...gradeLevels]
                .filter((gl) => gl.displayOrder >= 7 && gl.displayOrder <= 10)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((gl) => (
                  <div
                    key={gl.id}
                    className='rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors'>
                    <div className='flex flex-col'>
                      <span className='text-sm font-medium'>{gl.name}</span>
                      <span className='text-[10px] text-muted-foreground'>
                        {gl.sections.length} sections
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            <div className='space-y-3'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1'>
                Senior High School
              </p>
              {[...gradeLevels]
                .filter((gl) => gl.displayOrder >= 11)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((gl) => (
                  <div
                    key={gl.id}
                    className='rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors'>
                    <div className='flex flex-col'>
                      <span className='text-sm font-medium'>{gl.name}</span>
                      <span className='text-[10px] text-muted-foreground'>
                        {gl.sections.length} sections
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCP Configuration */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <div>
            <CardTitle className='flex items-center gap-2 text-xl'>
              <ShieldCheck className='h-5 w-5' />
              Special Curricular Programs (SCP)
            </CardTitle>
            <CardDescription>
              Configure Early Registration criteria for STE, SPA, SPS, etc.
            </CardDescription>
          </div>
          <Button size='sm' onClick={handleSaveScp} disabled={savingScp}>
            {savingScp ? "Saving..." : "Save Configuration"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className='space-y-6'>
            {scpConfigs.map((scp, idx) => (
              <div
                key={scp.scpType}
                className='rounded-xl border border-border overflow-hidden bg-card'>
                <div className='flex items-center justify-between px-4 py-3 bg-muted border-b'>
                  <div className='flex items-center gap-3'>
                    <Switch
                      checked={scp.isOffered}
                      onCheckedChange={(checked) =>
                        handleUpdateScpField(idx, "isOffered", checked)
                      }
                    />
                    <span className='text-sm font-bold'>
                      {SCP_TYPES.find((t) => t.value === scp.scpType)?.label ||
                        scp.scpType}
                    </span>
                  </div>
                  {scp.isOffered && (
                    <Badge
                      variant='outline'
                      className='bg-primary/10 text-primary border-primary/20'>
                      ACTIVE
                    </Badge>
                  )}
                </div>

                {scp.isOffered && (
                  <div className='p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-4'>
                      <div className='flex flex-col gap-1 lg:col-span-4'>
                        <Label className='text-xs flex items-center gap-1'>
                          <Calendar className='h-3 w-3' /> Exam Date
                        </Label>
                        <DatePicker
                          date={
                            scp.examDate ? new Date(scp.examDate) : undefined
                          }
                          setDate={(d) =>
                            handleUpdateScpField(
                              idx,
                              "examDate",
                              d ? d.toISOString() : null,
                            )
                          }
                          className='h-8 text-xs'
                        />
                      </div>
                      <div className='flex flex-col gap-1 lg:col-span-4'>
                        <Label className='text-xs flex items-center gap-1'>
                          <Clock className='h-3 w-3' /> Exam Time
                        </Label>
                        <TimePicker
                          value={scp.examTime}
                          onChange={(v) =>
                            handleUpdateScpField(idx, "examTime", v)
                          }
                        />
                      </div>
                      <div className='flex flex-col gap-1 lg:col-span-2'>
                        <Label className='text-xs flex items-center gap-1'>
                          <Info className='h-3 w-3' /> Cut-off
                        </Label>
                        <Input
                          type='number'
                          placeholder='Min score'
                          className='h-8 text-xs'
                          value={scp.cutoffScore ?? ""}
                          onChange={(e) =>
                            handleUpdateScpField(
                              idx,
                              "cutoffScore",
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                        />
                      </div>
                      <div className='flex flex-col gap-1 lg:col-span-10'>
                        <Label className='text-xs'>Program Notes</Label>
                        <Input
                          placeholder='Additional requirements or details...'
                          className='h-8 text-xs'
                          value={scp.notes || ""}
                          onChange={(e) =>
                            handleUpdateScpField(idx, "notes", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    {["SPECIAL_PROGRAM_IN_THE_ARTS"].includes(scp.scpType) && (
                      <div className='space-y-2'>
                        <Label className='text-xs'>
                          Art Fields (Comma separated)
                        </Label>
                        <Input
                          placeholder='Visual Arts, Music, Theatre...'
                          className='h-8 text-xs'
                          value={scp.artFields.join(", ")}
                          onChange={(e) =>
                            handleUpdateScpField(
                              idx,
                              "artFields",
                              e.target.value.split(",").map((s) => s.trim()),
                            )
                          }
                        />
                      </div>
                    )}
                    {["SPECIAL_PROGRAM_IN_SPORTS"].includes(scp.scpType) && (
                      <div className='space-y-2'>
                        <Label className='text-xs'>
                          Sports List (Comma separated)
                        </Label>
                        <Input
                          placeholder='Basketball, Volleyball, Archery...'
                          className='h-8 text-xs'
                          value={scp.sportsList.join(", ")}
                          onChange={(e) =>
                            handleUpdateScpField(
                              idx,
                              "sportsList",
                              e.target.value.split(",").map((s) => s.trim()),
                            )
                          }
                        />
                      </div>
                    )}
                    {["SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"].includes(
                      scp.scpType,
                    ) && (
                      <div className='space-y-2'>
                        <Label className='text-xs'>
                          Languages Offered (Comma separated)
                        </Label>
                        <Input
                          placeholder='Spanish, Japanese, French...'
                          className='h-8 text-xs'
                          value={scp.languages.join(", ")}
                          onChange={(e) =>
                            handleUpdateScpField(
                              idx,
                              "languages",
                              e.target.value.split(",").map((s) => s.trim()),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strands / Clusters / Tracks */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2 text-xl'>
                <Layers className='h-5 w-5' />
                SHS Curriculum & Tracks
              </CardTitle>
              <CardDescription>
                Select which elective clusters (G11) this school offers
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='outline' className=' text-[10px]'>
                <span className='hidden sm:inline'>DEPED</span> DM 012, S. 2026
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-8'>
          {/* DM 012 Curriculum (Grade 11) */}
          <div className='space-y-6'>
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>
                Grade 11: Elective Clusters
              </h3>
              <Badge className='bg-primary/10 text-primary hover:bg-primary/10 border-primary/20'>
                Track-Based
              </Badge>
            </div>

            <div className='space-y-6'>
              {/* Academic Track */}
              <div className='space-y-3'>
                <p className='text-xs font-semibold text-muted-foreground flex items-center gap-2'>
                  <span className='h-1 w-1 rounded-full bg-primary' /> ACADEMIC
                  TRACK
                </p>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                  {ACADEMIC_CLUSTERS.map((cluster) => {
                    const isOffered = strands.some(
                      (s) =>
                        s.name === cluster.label &&
                        s.curriculumType === "ELECTIVE_CLUSTER",
                    );
                    return (
                      <button
                        key={cluster.value}
                        onClick={() =>
                          toggleStrandPresence(
                            cluster.label,
                            "ELECTIVE_CLUSTER",
                            "ACADEMIC",
                          )
                        }
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left h-full w-full ${
                          isOffered
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                        }`}>
                        {isOffered ? (
                          <CheckCircle2 className='h-5 w-5 text-primary-foreground shrink-0' />
                        ) : (
                          <Circle className='h-5 w-5 text-muted-foreground shrink-0' />
                        )}
                        <span
                          className={`text-sm font-medium ${isOffered ? "text-primary-foreground" : "text-foreground"}`}>
                          {cluster.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TechPro Track */}
              <div className='space-y-3'>
                <p className='text-xs font-semibold text-muted-foreground flex items-center gap-2'>
                  <span className='h-1 w-1 rounded-full bg-primary' />{" "}
                  TECHNICAL-PROFESSIONAL (TECHPRO) TRACK
                </p>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                  {TECHPRO_CLUSTERS.map((cluster) => {
                    const isOffered = strands.some(
                      (s) =>
                        s.name === cluster.label &&
                        s.curriculumType === "ELECTIVE_CLUSTER",
                    );
                    return (
                      <button
                        key={cluster.value}
                        onClick={() =>
                          toggleStrandPresence(
                            cluster.label,
                            "ELECTIVE_CLUSTER",
                            "TECHPRO",
                          )
                        }
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left h-full w-full ${
                          isOffered
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card border-border hover:border-primary/50 hover:bg-muted"
                        }`}>
                        {isOffered ? (
                          <CheckCircle2 className='h-5 w-5 text-primary-foreground shrink-0' />
                        ) : (
                          <Circle className='h-5 w-5 text-muted-foreground shrink-0' />
                        )}
                        <span
                          className={`text-sm font-medium ${isOffered ? "text-primary-foreground" : "text-foreground"}`}>
                          {cluster.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        {curriculumDirty && (
          <CardFooter className='flex justify-end pt-0 pb-6 pr-6'>
            <Button
              size='sm'
              onClick={handleSaveCurriculum}
              disabled={savingCurriculum}>
              {savingCurriculum ? "Saving..." : "Save Configuration"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
