// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import { useNavigate } from "react-router";
import {
  Plus,
  CalendarDays,
  UserCheck,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { Button } from "@/shared/ui/button";
import { SectionFormSheet } from "../components/SectionFormSheet";
import type { SectionFormState, SectionItem, TeacherOption } from "../types";
import { SectionHandoverModal } from "../components/SectionHandoverModal";
import {
  DEFAULT_MAX_CAPACITY_REGULAR,
} from "@enrollpro/shared/constants";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

import { Badge } from "@/shared/ui/badge";
import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface TLEProgram {
  id: number;
  name: string;
  programCode: string;
  category: string;
  isActive: boolean;
}

interface GradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: SectionItem[];
}

type SectionCategory =
  | "SCP"
  | "BEC_TOP_5"
  | "BEC_HETEROGENEOUS";

interface SectionCategoryConfig {
  title: string;
  curriculumProgram: "REGULAR_HOMO" | "REGULAR_HETERO" | null;
  isHomogeneous: boolean;
  addDescription: string;
}

const SECTION_CATEGORY_CONFIG: Record<
  SectionCategory,
  SectionCategoryConfig
> = {
  SCP: {
    title: "Special Curricular Programs (SCP)",
    curriculumProgram: null,
    isHomogeneous: false,
    addDescription: "Add a section under an enabled special program.",
  },
  BEC_TOP_5: {
    title: "Basic Education Curriculum (BEC) — Top 5",
    curriculumProgram: "REGULAR_HOMO",
    isHomogeneous: true,
    addDescription: "Add a ranked Top 5 BEC section.",
  },
  BEC_HETEROGENEOUS: {
    title: "Basic Education Curriculum (BEC) — Heterogeneous",
    curriculumProgram: "REGULAR_HETERO",
    isHomogeneous: false,
    addDescription: "Add a mixed-ability BEC section.",
  },
};

const SECTION_ACRONYMS = new Set(["STE", "SPA", "SPS", "SPJ", "SPFL", "SPTVE"]);
const TLE_SECTION_DISPLAY_ORDERS = [9, 10];

function isScpProgram(programType: string): boolean {
  return ![
    "REGULAR",
    "REGULAR_HOMO",
    "REGULAR_HETERO",
  ].includes(programType);
}

function formatSectionLabel(rawSection: string | null | undefined): string {
  if (!rawSection) return "-";

  let sectionName = rawSection.trim();
  if (!sectionName) return "-";

  if (sectionName.includes("--")) {
    const segments = sectionName.split("--").filter(Boolean);
    sectionName = segments[segments.length - 1] || sectionName;
  }

  sectionName = sectionName
    .replace(/^G(?:RADE)?\s*\d+\s*[-_ ]*/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sectionName) return rawSection;

  return sectionName
    .split(/(\s|-)/)
    .map((part) => {
      if (part === " " || part === "-") return part;

      const upperPart = part.toUpperCase();
      if (SECTION_ACRONYMS.has(upperPart) || /^\d+[A-Z]*$/.test(upperPart)) {
        return upperPart;
      }

      if (upperPart.length <= 1) return upperPart;
      return `${upperPart.charAt(0)}${upperPart.slice(1).toLowerCase()}`;
    })
    .join("");
}

function buildSectionDisplayName(
  sectionName: string,
  programType: string,
  scpTypeLabels: Record<string, string>,
): string {
  const baseLabel = formatSectionLabel(sectionName);
  const scpLabel = scpTypeLabels[programType];
  if (!scpLabel) return baseLabel;

  const normalizedBase = baseLabel.trim().toUpperCase();
  const normalizedScp = scpLabel.trim().toUpperCase();

  if (
    normalizedBase === normalizedScp ||
    normalizedBase.startsWith(`${normalizedScp} `) ||
    normalizedBase.startsWith(`${normalizedScp}-`)
  ) {
    return baseLabel;
  }

  return `${scpLabel} ${baseLabel}`;
}

function extractTleSectionSuffix(
  sectionName: string,
  tleProgramName: string,
): string {
  const normalizedSectionName = sectionName.trim();
  const normalizedProgramName = tleProgramName.trim();

  if (!normalizedSectionName) return "";
  if (!normalizedProgramName) return normalizedSectionName;

  const prefix = `${normalizedProgramName} - `;
  if (normalizedSectionName.toLowerCase().startsWith(prefix.toLowerCase())) {
    return normalizedSectionName.slice(prefix.length).trim();
  }

  if (
    normalizedSectionName.toLowerCase() === normalizedProgramName.toLowerCase()
  ) {
    return "";
  }

  const markerIndex = normalizedSectionName.lastIndexOf(" - ");
  if (markerIndex >= 0) {
    return normalizedSectionName.slice(markerIndex + 3).trim();
  }

  return normalizedSectionName;
}

function buildTleSectionName(tleProgramName: string, suffix: string): string {
  const normalizedProgramName = tleProgramName.trim();
  const normalizedSuffix = suffix.trim();

  if (!normalizedProgramName) return normalizedSuffix;
  if (!normalizedSuffix) return normalizedProgramName;
  return `${normalizedProgramName} - ${normalizedSuffix}`;
}

;

;

;

function resolveApiErrorMessage(error: unknown): string | null {
  const apiError = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };
  };

  const data = apiError.response?.data;
  if (data?.errors) {
    const firstValidationMessage = Object.values(data.errors).flat()[0];
    if (firstValidationMessage) {
      return firstValidationMessage;
    }
  }

  return data?.message ?? null;
}

function showSectionsErrorToast(
  action: "load" | "create" | "update" | "delete",
  error: unknown,
) {
  const messageFromApi = resolveApiErrorMessage(error);

  const titleByAction = {
    load: "Unable to load sections",
    create: "Section creation failed",
    update: "Section update failed",
    delete: "Section deletion failed",
  } as const;

  const fallbackDescriptionByAction = {
    load: "Refresh the page and try again.",
    create: "Review the section details and try again.",
    update: "Your changes were not saved. Please try again.",
    delete: "The section was not removed. Please try again.",
  } as const;

  sileo.error({
    title: titleByAction[action],
    description: messageFromApi ?? fallbackDescriptionByAction[action],
  });
}

interface RosterLearner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string;
  birthdate: string;
  status: string;
  readingProfileLevel: string | null;
  isPendingLrnCreation: boolean;
  applicantType: string;
  enrolledAt: string;
  sectioningMethod?: string | null;
  dateSectioned?: string | null;
  learnerType?: string | null;
  sex?: string | null;
  sf1Remarks?: string | null;
}


function SectionCard({
  section,
  onEdit,
  onDelete,
  onViewRoster,
  canMutate,
  scpTypeLabels,
  teachers,
  onAdviserChange,
}: {
  section: SectionItem;
  onEdit: () => void;
  onDelete: () => void;
  onViewRoster: () => void;
  canMutate: boolean;
  scpTypeLabels: Record<string, string>;
  teachers: Teacher[];
  onAdviserChange: (val: string) => void;
}) {
  const pct =
    section.fillPercent ??
    Math.round((section.enrolledCount / section.maxCapacity) * 100);

  const initialAdviser = section.advisingTeacher ? String(section.advisingTeacher.id) : "none";
  const [selectedAdviser, setSelectedAdviser] = useState(initialAdviser);

  useEffect(() => {
    setSelectedAdviser(section.advisingTeacher ? String(section.advisingTeacher.id) : "none");
  }, [section.advisingTeacher]);

  const hasPendingAdviserChange = selectedAdviser !== initialAdviser;

  const toTitleCase = (str: string) => str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
  return (
    <div
      className="rounded-lg border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors cursor-pointer group flex flex-col h-full"
      onClick={onViewRoster}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onViewRoster();
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-extrabold text-base text-foreground truncate uppercase">
            {toTitleCase(section.name)}
          </p>
          {section.programType !== "REGULAR" && (
            <Badge
              variant="outline"
              className="mt-1 text-sm font-extrabold uppercase">
              {scpTypeLabels[section.programType] ?? section.programType}
            </Badge>
          )}
          {section.isHomogeneous && section.programType === "REGULAR" && (
            <Badge
              variant="outline"
              className="mt-1 text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border-blue-200">
              Pilot
            </Badge>
          )}
        </div>
        {canMutate && (
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-sm font-extrabold"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-sm font-extrabold text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="mt-auto space-y-4">
        <div className="flex items-center justify-between border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 w-full">
            <div className="flex flex-col w-full min-w-0 pr-2">
              <span className="text-sm font-extrabold uppercase text-foreground mb-0.5">
                Adviser
              </span>
              {canMutate ? (
                <div onClick={(e) => e.stopPropagation()} className="w-full -ml-2">
                  <Select
                    value={selectedAdviser}
                    onValueChange={setSelectedAdviser}>
                    <SelectTrigger className={cn("h-7 px-2 py-0 border-primary hover:bg-muted bg-transparent shadow-none focus:ring-0 text-sm font-extrabold uppercase truncate", !section.advisingTeacher && "text-foreground")}>
                      <SelectValue placeholder="UNASSIGNED" />
                    </SelectTrigger>
                    <SelectContent className="font-extrabold uppercase max-h-[300px]">
                      <SelectItem value="none" className="text-xs text-foreground">UNASSIGNED</SelectItem>
                      {section.advisingTeacher && !teachers.some(t => t.id === section.advisingTeacher!.id) && (
                        <SelectItem value={String(section.advisingTeacher.id)} className="text-xs">
                          {section.advisingTeacher.name}
                        </SelectItem>
                      )}
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span
                  className={cn(
                    "text-sm font-extrabold uppercase truncate",
                    !section.advisingTeacher ? "text-primary italic" : "text-foreground",
                  )}>
                  {section.advisingTeacher
                    ? section.advisingTeacher.name
                    : "Unassigned"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-muted-foreground uppercase tracking-wider">
              Enrolled
            </span>
            <span className="text-foreground">
              {section.enrolledCount} / {section.maxCapacity} ({pct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pct >= 100
                  ? "bg-destructive"
                  : pct >= 90
                    ? "bg-orange-500"
                    : pct >= 75
                      ? "bg-amber-400"
                      : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          {hasPendingAdviserChange ? (
            <div className="flex items-center gap-2 mt-4 w-full">
              <Button
                className="flex-1 font-extrabold"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAdviser(initialAdviser);
                }}>
                Cancel
              </Button>
              <Button
                className="flex-1 font-extrabold"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdviserChange(selectedAdviser);
                }}>
                Update
              </Button>
            </div>
          ) : (
            <Button
              className="w-full mt-4 font-extrabold"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                onViewRoster();
              }}>
              Open SF1 Masterlist →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Homerooms() {
  const navigate = useNavigate();
  const renderSectionGroup = (
    category: SectionCategory,
    sections: SectionItem[],
    glName: string,
    glId: number,
    glDisplayOrder: number,
  ) => {
    const categoryConfig = SECTION_CATEGORY_CONFIG[category];
    const canAddCategory =
      canMutate &&
      (category !== "SCP" ||
        programOptions.some((option) => isScpProgram(option.value)));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-extrabold uppercase text-foreground/80 tracking-tight flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            {categoryConfig.title}
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 pb-4">
          {sections.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              teachers={teachers}
              onAdviserChange={(val) => handleInlineAdviserChange(s, val)}
              scpTypeLabels={offeredScpTypeLabels}
              onEdit={() => handleOpenEdit(s, glName, glDisplayOrder)}
              onDelete={() => {
                setDeleteId(s.id);
                setDeleteName(s.name);
              }}
              onViewRoster={() => navigate(`/sections/view-roster/${s.id}`)}
              canMutate={canMutate}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              handleOpenCreate(
                glId,
                glName,
                glDisplayOrder,
                category,
              )
            }
            disabled={!canAddCategory}
            className="group flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-transparent p-6 text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Plus className="h-5 w-5 group-hover:text-primary transition-colors" />
            </div>
            <span className="mt-2 text-sm font-extrabold uppercase">
              + Add Section
            </span>
            <span className="max-w-xs text-center text-xs font-semibold normal-case">
              {!canMutate
                ? "Section changes are unavailable during EOSY closing or in an archived school year."
                : canAddCategory
                  ? categoryConfig.addDescription
                  : "Enable an SCP in System Configuration first."}
            </span>
          </button>
        </div>
      </div>
    );
  };


  const { activeSchoolYearId, viewingSchoolYearId, systemPhase, enableHomogeneousSections, steEnabled, spaEnabled, spsEnabled } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canMutate =
    (!isHistoricalReadOnly || hasOverride) &&
    systemPhase !== "EOSY_CLOSING";

  const [activeGradeId, setActiveGradeId] = useState<string>("");

  const [groups, setGroups] = useState<GradeLevelGroup[]>([]);
  const handleInlineAdviserChange = async (section: SectionItem, newAdviserId: string) => {
    try {
      const payload = {
        name: section.name,
        programType: section.programType,
        isHomogeneous: section.isHomogeneous,
        maxCapacity: section.maxCapacity,
        tleProgramId: section.tleProgramId ?? null,
        advisingTeacherId: newAdviserId === "none" ? null : parseInt(newAdviserId),
      };
      await api.put(`/sections/${section.id}`, payload);
      fetchData();
      sileo.success({
        title: "Adviser updated",
        description: `Class adviser for ${section.name} has been updated.`,
      });
    } catch (err) {
      showSectionsErrorToast("update", err);
    }
  };

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  // Section Form Sheet State
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false);
  const [formSheetMode, setFormSheetMode] = useState<"create" | "edit">(
    "create",
  );
  const [sectionFormData, setSectionFormData] = useState<SectionFormState>({
    name: "",
    programType: "REGULAR",
    sectionType: "HOME_ROOM",
    adviserId: "none",
    maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
    tleProgramId: null,
  });
  const [submittingForm, setSubmittingForm] = useState(false);
  const [programOptions, setProgramOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "REGULAR", label: "Regular (BEC)" }]);
  const [createGlId, setCreateGlId] = useState<number | null>(null);
  const [createGlName, setCreateGlName] = useState("");
  const [createGlDisplayOrder, setCreateGlDisplayOrder] = useState<number>(0);
  const [createCategory, setCreateCategory] =
    useState<SectionCategory | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<TeacherOption[]>(
    [],
  );
  const [tlePrograms, setTlePrograms] = useState<TLEProgram[]>([]);
  const [offeredScpTypeLabels, setOfferedScpTypeLabels] = useState<Record<string, string>>({});

  const sectionFormProgramOptions = useMemo(() => {
    if (formSheetMode === "edit" || !createCategory) {
      return programOptions;
    }

    if (createCategory === "SCP") {
      return programOptions.filter((option) =>
        isScpProgram(option.value),
      );
    }

    const categoryProgram =
      SECTION_CATEGORY_CONFIG[createCategory].curriculumProgram;

    return categoryProgram
      ? [
        {
          value: categoryProgram,
          label: SECTION_CATEGORY_CONFIG[createCategory].title,
        },
      ]
      : [];
  }, [createCategory, formSheetMode, programOptions]);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Late Enrollee Modal State

  // Handover Modal State
  const [handoverSection, setHandoverSection] = useState<{
    id: number;
    name: string;
    gradeLevelName: string;
    advisingTeacher: { id: number; name: string } | null;
  } | null>(null);

  // Roster view state
  const [roster, setRoster] = useState<RosterLearner[]>([]);
  const [classOpeningDate, setClassOpeningDate] = useState<string | null>(null);

  const resolveTleProgramName = useCallback(
    (tleProgramId: number | null | undefined) => {
      if (tleProgramId == null) return "";
      return (
        tlePrograms.find((program) => program.id === tleProgramId)?.name ?? ""
      );
    },
    [tlePrograms],
  );



  const { maleLearners, femaleLearners } = useMemo(() => {
    const males = roster
      .filter((l) => l.sex === "MALE")
      .sort(
        (a, b) =>
          (a.lastName || "").localeCompare(b.lastName || "") ||
          (a.firstName || "").localeCompare(b.firstName || ""),
      );
    const females = roster
      .filter((l) => l.sex === "FEMALE")
      .sort(
        (a, b) =>
          (a.lastName || "").localeCompare(b.lastName || "") ||
          (a.firstName || "").localeCompare(b.firstName || ""),
      );
    return { maleLearners: males, femaleLearners: females };
  }, [roster]);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [res, teachersRes] = await Promise.all([
        api.get(`/sections/${ayId}`),
        api.get(`/sections/teachers?schoolYearId=${ayId}`),
      ]);
      setGroups(res.data.gradeLevels);
      setTeachers(teachersRes.data.teachers);

      // Auto-select first grade tab if none is active
      if (res.data.gradeLevels && res.data.gradeLevels.length > 0) {
        setActiveGradeId(
          (prev) => prev || String(res.data.gradeLevels[0].gradeLevelId),
        );
      }
    } catch (err) {
      showSectionsErrorToast("load", err);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const SCP_SHORT_LABELS: Record<string, string> = useMemo(
    () => ({
      REGULAR: "Regular (BEC)",
      SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
      SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
      SPECIAL_PROGRAM_IN_SPORTS: "SPS",
      SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
      SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
      SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
    }),
    [],
  );

  useEffect(() => {
    const fetchProgramOptions = () => {
      if (!ayId) return;

      const opts = [];

      if (enableHomogeneousSections) {
        opts.push({ value: "REGULAR_HOMO", label: "Basic Education Curriculum (BEC) — Top 5" });
        opts.push({ value: "REGULAR_HETERO", label: "Basic Education Curriculum (BEC) —  Heterogeneous" });
      } else {
        opts.push({ value: "REGULAR", label: "Basic Education Curriculum (BEC)" });
      }

      if (steEnabled) {
        opts.push({ value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "Science, Technology & Engineering (STE)" });
      }
      if (spaEnabled) {
        opts.push({ value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "Special Program in the Arts (SPA)" });
      }
      if (spsEnabled) {
        opts.push({ value: "SPECIAL_PROGRAM_IN_SPORTS", label: "Special Program in the Sports (SPS)" });
      }

      setProgramOptions(opts);
      setOfferedScpTypeLabels(SCP_SHORT_LABELS);
    };

    if (ayId) {
      fetchProgramOptions();
    }
  }, [ayId, enableHomogeneousSections, steEnabled, spaEnabled, spsEnabled, SCP_SHORT_LABELS]);




  useEffect(() => {
    if (!ayId) return;

    api
      .get("/bosy/tle-programs", { params: { schoolYearId: ayId } })
      .then((res) => setTlePrograms(res.data.programs ?? res.data))
      .catch(() => {
        /* non-critical */
      });
  }, [ayId]);

  const fetchEligibleTeachers = useCallback(
    async (
      sectionType: "HOME_ROOM" | "TLE_LABORATORY",
      tleProgramId: number | null,
      excludeSectionId?: number | null,
    ) => {
      if (!ayId) return;

      setLoadingTeachers(true);
      try {
        const params = new URLSearchParams({
          schoolYearId: String(ayId),
          sectionType,
        });

        if (excludeSectionId) {
          params.set("excludeSectionId", String(excludeSectionId));
        }

        if (sectionType === "TLE_LABORATORY" && tleProgramId != null) {
          params.set("tleProgramId", String(tleProgramId));
        }

        const res = await api.get(`/sections/teachers?${params.toString()}`);
        setAvailableTeachers(res.data.teachers);
      } catch (err) {
        console.error("Failed to fetch teachers", err);
        setAvailableTeachers(
          teachers.map((t) => ({
            id: t.id,
            name: t.name,
            employeeId: t.employeeId,
          })),
        );
      } finally {
        setLoadingTeachers(false);
      }
    },
    [ayId, teachers],
  );

  useEffect(() => {
    if (!isFormSheetOpen) return;

    const isTleSection =
      TLE_SECTION_DISPLAY_ORDERS.includes(createGlDisplayOrder) &&
      sectionFormData.sectionType === "TLE_LABORATORY";

    void fetchEligibleTeachers(
      isTleSection ? "TLE_LABORATORY" : "HOME_ROOM",
      isTleSection ? sectionFormData.tleProgramId : null,
      formSheetMode === "edit" ? editingSectionId : null,
    );
  }, [
    createGlDisplayOrder,
    editingSectionId,
    fetchEligibleTeachers,
    formSheetMode,
    isFormSheetOpen,
    sectionFormData.sectionType,
    sectionFormData.tleProgramId,
  ]);

  useEffect(() => {
    if (!isFormSheetOpen) return;
    if (sectionFormData.adviserId === "none") return;

    const hasSelectedTeacher = availableTeachers.some(
      (teacher) => String(teacher.id) === sectionFormData.adviserId,
    );

    if (!hasSelectedTeacher) {
      setSectionFormData((prev) => ({ ...prev, adviserId: "none" }));
    }
  }, [availableTeachers, isFormSheetOpen, sectionFormData.adviserId]);

  const handleOpenCreate = useCallback(
    (
      glId: number,
      glName: string,
      glDisplayOrder: number,
      category: SectionCategory,
    ) => {
      const categoryConfig = SECTION_CATEGORY_CONFIG[category];
      const selectedCurriculumProgram =
        category === "SCP"
          ? programOptions.find((option) => isScpProgram(option.value))?.value
          : categoryConfig.curriculumProgram;

      if (!selectedCurriculumProgram) {
        sileo.error({
          title: "No Active Special Program",
          description:
            "Enable at least one Special Curricular Program in System Configuration before adding an SCP section.",
        });
        return;
      }

      setFormSheetMode("create");
      setEditingSectionId(null);
      setCreateGlId(glId);
      setCreateGlName(glName);
      setCreateGlDisplayOrder(glDisplayOrder);
      setCreateCategory(category);
      setSectionFormData({
        name: "",
        curriculumProgram: selectedCurriculumProgram,
        programType:
          category === "SCP" ? selectedCurriculumProgram : "REGULAR",
        isHomogeneous: categoryConfig.isHomogeneous,
        sectionType: "HOME_ROOM",
        adviserId: "none",
        maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
        tleProgramId: null,
      });
      setIsFormSheetOpen(true);
    },
    [programOptions],
  );

  const handleOpenEdit = useCallback(
    async (section: SectionItem, glName: string, glDisplayOrder: number) => {
      setFormSheetMode("edit");
      setEditingSectionId(section.id);
      setCreateCategory(null);
      setCreateGlName(glName);
      setCreateGlDisplayOrder(glDisplayOrder);
      setSectionFormData({
        name: section.name,
        curriculumProgram: section.programType === "REGULAR" ? (section.isHomogeneous ? "REGULAR_HOMO" : "REGULAR_HETERO") : section.programType,
        programType: section.programType,
        isHomogeneous: section.isHomogeneous,
        sectionType:
          TLE_SECTION_DISPLAY_ORDERS.includes(glDisplayOrder) &&
            section.tleProgramId
            ? "TLE_LABORATORY"
            : "HOME_ROOM",
        adviserId: section.advisingTeacher
          ? section.advisingTeacher.id.toString()
          : "none",
        maxCapacity: section.maxCapacity,
        tleProgramId: section.tleProgramId ?? null,
      });

      setIsFormSheetOpen(true);
    },
    [],
  );

  const handleFieldChange = useCallback(
    (field: keyof SectionFormState, value: string | number | null) => {
      setSectionFormData((prev) => {
        const next: SectionFormState = { ...prev, [field]: value };

        const currentProgramName = resolveTleProgramName(prev.tleProgramId);

        if (field === "tleProgramId") {
          const nextProgramName = resolveTleProgramName(Number(value));
          const currentSuffix = extractTleSectionSuffix(
            prev.name,
            currentProgramName,
          );
          // Default to "A" when no suffix exists yet (fresh / first-time selection)
          const suffix = currentSuffix.trim() || "A";
          next.name = buildTleSectionName(nextProgramName, suffix);
        }

        // Auto-update capacity when program type changes
        if (field === "programType" && next.sectionType !== "TLE_LABORATORY") {
          next.maxCapacity = DEFAULT_MAX_CAPACITY_REGULAR;
        }

        if (field === "sectionType") {
          if (value === "HOME_ROOM") {
            next.tleProgramId = null;
          }

          if (value === "TLE_LABORATORY") {
            // TLE labs operate under REGULAR with specialization track-lock.
            next.programType = "REGULAR";
            const suffix = extractTleSectionSuffix(
              prev.name,
              currentProgramName,
            );
            next.name = buildTleSectionName(currentProgramName, suffix);
          }
        }

        return next;
      });
    },
    [resolveTleProgramName],
  );

  const handleFormSubmit = async () => {
    if (!sectionFormData.name.trim()) return;

    const allowTleLaboratory =
      TLE_SECTION_DISPLAY_ORDERS.includes(createGlDisplayOrder);
    const isTleLaboratory =
      allowTleLaboratory && sectionFormData.sectionType === "TLE_LABORATORY";

    if (isTleLaboratory && !sectionFormData.tleProgramId) {
      sileo.error({
        title: "TLE Specialization Required",
        description:
          "Please select a TLE specialization for TLE Laboratory sections.",
      });
      return;
    }

    if (isTleLaboratory) {
      const tleProgramName = resolveTleProgramName(
        sectionFormData.tleProgramId,
      );
      const suffix = extractTleSectionSuffix(
        sectionFormData.name,
        tleProgramName,
      );
      if (!suffix.trim()) {
        sileo.error({
          title: "Section Name Suffix Required",
          description:
            "Add a suffix (e.g., A, B, C, D, or N) for the selected TLE specialization.",
        });
        return;
      }
    }

    setSubmittingForm(true);
    try {
      const isHomo = sectionFormData.curriculumProgram === "REGULAR_HOMO";
      const resolvedProgramType = sectionFormData.curriculumProgram === "REGULAR_HOMO" || sectionFormData.curriculumProgram === "REGULAR_HETERO" ? "REGULAR" : (sectionFormData.curriculumProgram || "REGULAR");

      const payload = {
        name: sectionFormData.name.trim(),
        programType: isTleLaboratory ? "REGULAR" : resolvedProgramType,
        isHomogeneous: isTleLaboratory ? false : isHomo,
        advisingTeacherId:
          sectionFormData.adviserId === "none"
            ? null
            : parseInt(sectionFormData.adviserId),
        maxCapacity: sectionFormData.maxCapacity,
        // tleProgramId is the persistent lab marker for matrix scheduling.
        tleProgramId: isTleLaboratory ? sectionFormData.tleProgramId : null,
      };

      if (formSheetMode === "create") {
        await api.post("/sections", {
          ...payload,
          gradeLevelId: createGlId,
          schoolYearId: ayId,
        });
        sileo.success({
          title: "Section created",
          description: `${payload.name} has been added successfully.`,
        });
      } else {
        await api.put(`/sections/${editingSectionId}`, payload);
        sileo.success({
          title: "Section updated",
          description: `Changes to ${payload.name} have been saved.`,
        });
      }

      setIsFormSheetOpen(false);
      await fetchData();
    } catch (err) {
      showSectionsErrorToast(
        formSheetMode === "create" ? "create" : "update",
        err,
      );
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/sections/${deleteId}`);
      sileo.success({
        title: "Section removed",
        description: deleteName
          ? `${deleteName} was removed successfully.`
          : "The section was removed successfully.",
      });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      showSectionsErrorToast("delete", err);
    } finally {
      setDeleting(false);
    }
  };

  ;

  ;

  ;

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-extrabold text-foreground">
                No School Year Selected
              </p>
              <p className="text-base text-foreground leading-relaxed px-4">
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
    <div className="space-y-6 ">
      <div>
        <div>
          <h1 className="text-3xl font-extrabold ">Class Advisership & Section Management</h1>
          <p className="text-base leading-tight text-foreground font-extrabold">
            Manage grade level sections and advising teachers
          </p>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-16 w-full rounded-lg"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Grade-level section list */
        <Tabs
          value={activeGradeId}
          onValueChange={setActiveGradeId}
          className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border border-border rounded-lg relative">
            {groups.map((g) => (
              <TabsTrigger
                key={g.gradeLevelId}
                value={String(g.gradeLevelId)}
                className="flex-1 min-w-32 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {activeGradeId === String(g.gradeLevelId) && (
                  <motion.div
                    layoutId="grade-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-20 uppercase  text-base",
                    activeGradeId === String(g.gradeLevelId)
                      ? "text-primary-foreground"
                      : "text-foreground",
                  )}>
                  {g.gradeLevelName}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="w-full">
            {groups
              .filter((g) => String(g.gradeLevelId) === activeGradeId)
              .map((g) => (
                <div
                  key={g.gradeLevelId}
                  className="w-full">
                  <TabsContent
                    value={String(g.gradeLevelId)}
                    forceMount
                    className="mt-0 focus-visible:outline-none ring-0">
                    <Card className="border-border shadow-sm">
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
                        <div>
                          <CardTitle className="text-xl font-extrabold uppercase">
                            {g.gradeLevelName}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-8 pb-4">
                          {renderSectionGroup(
                            "SCP",
                            g.sections.filter((s) => s.programType !== "REGULAR"),
                            g.gradeLevelName,
                            g.gradeLevelId,
                            g.displayOrder,
                          )}

                          {renderSectionGroup(
                            "BEC_TOP_5",
                            g.sections.filter((s) => s.programType === "REGULAR" && s.isHomogeneous),
                            g.gradeLevelName,
                            g.gradeLevelId,
                            g.displayOrder,
                          )}

                          {renderSectionGroup(
                            "BEC_HETEROGENEOUS",
                            g.sections.filter((s) => s.programType === "REGULAR" && !s.isHomogeneous),
                            g.gradeLevelName,
                            g.gradeLevelId,
                            g.displayOrder,
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              ))}
          </div>
        </Tabs>
      )}

      <SectionFormSheet
        mode={formSheetMode}
        open={isFormSheetOpen}
        onOpenChange={setIsFormSheetOpen}
        title={formSheetMode === "create" ? "Add New Section" : "Edit Section"}
        description={
          formSheetMode === "create"
            ? `Add a ${
              createCategory
                ? SECTION_CATEGORY_CONFIG[createCategory].title
                : "section"
            } roster for ${createGlName}.`
            : `Update configuration for section ${sectionFormData.name}.`
        }
        formData={sectionFormData}
        onFieldChange={handleFieldChange}
        onSubmit={handleFormSubmit}
        onCancel={() => setIsFormSheetOpen(false)}
        submitting={submittingForm}
        canSubmit={
          !!sectionFormData.name.trim() &&
          (!TLE_SECTION_DISPLAY_ORDERS.includes(createGlDisplayOrder) ||
            sectionFormData.sectionType === "HOME_ROOM" ||
            !!sectionFormData.tleProgramId)
        }
        programOptions={sectionFormProgramOptions}
        teachers={availableTeachers}
        loadingTeachers={loadingTeachers}
        gradeLevelName={createGlName}
        gradeLevelDisplayOrder={createGlDisplayOrder}
        tlePrograms={tlePrograms}
      />

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Section"
        description={`Are you sure you want to delete the section "${deleteName}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        variant="danger"
      />

      {handoverSection && (
        <SectionHandoverModal
          open={!!handoverSection}
          onOpenChange={(open) => !open && setHandoverSection(null)}
          sectionId={handoverSection.id}
          sectionName={handoverSection.name}
          gradeLevelName={handoverSection.gradeLevelName}
          currentAdviser={handoverSection.advisingTeacher}
          teachers={teachers}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
