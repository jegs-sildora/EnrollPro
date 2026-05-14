import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { sileo } from "sileo";
import {
  Plus,
  Trash2,
  Grid3X3,
  Edit2,
  CalendarDays,
  ListFilter,
  AlertTriangle,
  Users,
  Loader2,
  FileDown,
  Printer,
  Mars,
  Venus,
  UserPlus,
  RefreshCcw,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { Button } from "@/shared/ui/button";
import { SectionFormSheet } from "../components/SectionFormSheet";
import type { SectionFormState, SectionItem, TeacherOption } from "../types";
import { InsertLateEnrolleeModal } from "../components/InsertLateEnrolleeModal";
import { SectionHandoverModal } from "../components/SectionHandoverModal";
import {
  DEFAULT_MAX_CAPACITY_REGULAR,
  DEFAULT_MAX_CAPACITY_SCP,
} from "@enrollpro/shared/constants";

import {
  Card,
  CardContent,
  CardDescription,
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
import { differenceInYears } from "date-fns";
import { Badge } from "@/shared/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/shared/lib/utils";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface TLEProgram {
  id: number;
  name: string;
  category: string;
  isActive: boolean;
  displayOrder: number;
}

interface SectionItem {
  id: number;
  name: string;
  sortOrder: number;
  programType: string;
  isHomogeneous: boolean;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  tleProgramId?: number | null;
  advisingTeacher: { id: number; name: string } | null;
}

interface GradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: SectionItem[];
}

const PROGRAM_TYPE_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" },
  { value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" },
  { value: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" },
  { value: "SPECIAL_PROGRAM_IN_JOURNALISM", label: "SPJ" },
  { value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE", label: "SPFL" },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "SPTVE",
  },
];

const SECTION_ACRONYMS = new Set(["STE", "SPA", "SPS", "SPJ", "SPFL", "SPTVE"]);

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

function extractGradeLevelNumber(rawGradeLevel: string): string {
  const matchedNumber = rawGradeLevel.match(/\d+/)?.[0];
  if (matchedNumber) return matchedNumber;

  const normalized = rawGradeLevel.replace(/^grade\s+/i, "").trim();
  return normalized || rawGradeLevel;
}

function formatHeatmapLabel(
  gradeLevelName: string,
  sectionName: string,
): string {
  return `${extractGradeLevelNumber(gradeLevelName)} - ${formatSectionLabel(sectionName)}`;
}

function formatProgramType(programType: string): string {
  return (
    PROGRAM_TYPE_OPTIONS.find((option) => option.value === programType)
      ?.label ?? programType
  );
}

function fillColor(pct: number): string {
  if (pct > 100) return "bg-red-600";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-orange-400";
  if (pct >= 50) return "bg-yellow-400";
  return "bg-green-500";
}

function fillEmoji(pct: number): string {
  if (pct > 100) return "🔴";
  if (pct >= 90) return "🔴";
  if (pct >= 75) return "🟠";
  if (pct >= 50) return "🟡";
  return "🟢";
}

const isPilotSection = (s: SectionItem): boolean => {
  if (s.programType !== "REGULAR") return false;
  if (s.isHomogeneous) return true;
  const n = s.name.toUpperCase();
  return n.startsWith("PILOT") || /^SECTION\s*[1-5](\s|$)/.test(n);
};

const isSpecialSection = (s: SectionItem): boolean => {
  return s.programType !== "REGULAR";
};

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

export default function Sections() {
  const { activeSchoolYearId, viewingSchoolYearId, activeSchoolYearLabel } =
    useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canMutate = !isHistoricalReadOnly || hasOverride;

  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");
  const [activeGradeId, setActiveGradeId] = useState<string>("");

  const [groups, setGroups] = useState<GradeLevelGroup[]>([]);
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
    adviserId: "none",
    maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
    tleProgramId: null,
    sectionRank: null,
  });
  const [submittingForm, setSubmittingForm] = useState(false);
  const [programOptions, setProgramOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "REGULAR", label: "Regular (BEC)" }]);
  const [createGlId, setCreateGlId] = useState<number | null>(null);
  const [createGlName, setCreateGlName] = useState("");
  const [createGlDisplayOrder, setCreateGlDisplayOrder] = useState<number>(0);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<TeacherOption[]>(
    [],
  );
  const [tlePrograms, setTlePrograms] = useState<TLEProgram[]>([]);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Late Enrollee Modal State
  const [showLateEnrolleeModal, setShowLateEnrolleeModal] = useState(false);

  // Handover Modal State
  const [handoverSection, setHandoverSection] = useState<{
    id: number;
    name: string;
    gradeLevelName: string;
    advisingTeacher: { id: number; name: string } | null;
  } | null>(null);

  // Heatmap grade filter
  const [heatmapGradeFilter, setHeatmapGradeFilter] = useState<string>("all");

  // Roster view state
  const [viewRosterSection, setViewRosterSection] = useState<{
    id: number;
    name: string;
    gradeLevelName: string;
    adviserName: string | null;
    maxCapacity: number;
    enrolledCount: number;
    programType: string;
    gradeLevelId: number;
  } | null>(null);
  const [roster, setRoster] = useState<RosterLearner[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [classOpeningDate, setClassOpeningDate] = useState<string | null>(null);
  const [exportingSf1, setExportingSf1] = useState(false);

  const handleDownloadSf1 = async () => {
    if (!viewRosterSection) return;
    setExportingSf1(true);
    try {
      const response = await api.get(`/export/sf1/${viewRosterSection.id}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `SF1_${viewRosterSection.name.replace(/\s+/g, "_")}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      sileo.success({
        title: "Export Complete",
        description: `SF1 for ${viewRosterSection.name} downloaded successfully.`,
      });
    } catch (err) {
      console.error(err);
      sileo.error({
        title: "Export Failed",
        description: "Failed to generate SF1 Excel file.",
      });
    } finally {
      setExportingSf1(false);
    }
  };

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return "-";
    const bday = new Date(birthdate);
    // DepEd Rule: Age as of August 31st of the current school year
    const referenceDate = new Date(new Date().getFullYear(), 7, 31); // August 31
    return differenceInYears(referenceDate, bday);
  };

  const renderRemarks = (learner: RosterLearner) => {
    const remarks = [];

    if (learner.status === "TEMPORARILY_ENROLLED") {
      remarks.push(
        <Badge
          key="temp"
          variant="outline"
          className="text-[9px] font-black uppercase border-amber-300 bg-amber-50 text-amber-700 shadow-none px-2 py-0.5">
          Temporary
        </Badge>,
      );
    }

    // Phase 5: Late Enrollee Logic
    const isLate =
      learner.applicantType === "LATE_ENROLLEE" ||
      (learner.sectioningMethod === "INLINE_SLOTTING" &&
        learner.dateSectioned &&
        (!classOpeningDate ||
          new Date(learner.dateSectioned) > new Date(classOpeningDate)));

    if (isLate) {
      remarks.push(
        <Badge
          key="late"
          variant="warning"
          className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 border-amber-200 shadow-none px-2 py-0.5 whitespace-nowrap inline-flex items-center gap-1">
          🕒 Late Enrollee
        </Badge>,
      );

      if (learner.sf1Remarks) {
        remarks.push(
          <p
            key="sf1-remark"
            className="text-[9px] font-bold text-foreground mt-0.5 italic leading-tight">
            {learner.sf1Remarks}
          </p>,
        );
      }
    }

    if (learner.learnerType === "TRANSFEREE") {
      remarks.push(
        <span
          key="transferee"
          className="text-xs font-bold text-foreground uppercase  ml-1">
          [ Transferee ]
        </span>,
      );
    }

    if (learner.learnerType === "RETURNING") {
      remarks.push(
        <span
          key="returning"
          className="text-xs font-bold text-foreground uppercase  ml-1">
          [ Balik-Aral ]
        </span>,
      );
    }

    return remarks.length > 0 ? (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {remarks}
      </div>
    ) : (
      <span className="text-foreground">-</span>
    );
  };

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

  const fetchRoster = async (sectionId: number) => {
    setLoadingRoster(true);
    try {
      const res = await api.get(`/sections/${sectionId}/roster`);
      setRoster(res.data.learners);
      setClassOpeningDate(res.data.classOpeningDate);
    } catch (err) {
      showSectionsErrorToast("load", err);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    if (viewRosterSection) {
      void fetchRoster(viewRosterSection.id);
    } else {
      setRoster([]);
    }
  }, [viewRosterSection]);

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

  useEffect(() => {
    if (heatmapGradeFilter === "all") return;

    const selectedGradeExists = groups.some(
      (group) => group.gradeLevelId.toString() === heatmapGradeFilter,
    );

    if (!selectedGradeExists) {
      setHeatmapGradeFilter("all");
    }
  }, [groups, heatmapGradeFilter]);

  const heatmapGradeOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: group.gradeLevelId.toString(),
        label: group.gradeLevelName,
      })),
    [groups],
  );

  const filteredHeatmapGroups = useMemo(
    () =>
      heatmapGradeFilter === "all"
        ? groups
        : groups.filter(
            (group) => group.gradeLevelId.toString() === heatmapGradeFilter,
          ),
    [groups, heatmapGradeFilter],
  );

  const heatmapItems = useMemo(
    () =>
      filteredHeatmapGroups.flatMap((group) =>
        group.sections.map((section) => ({ group, section })),
      ),
    [filteredHeatmapGroups],
  );

  const selectedHeatmapGradeLabel = useMemo(() => {
    if (heatmapGradeFilter === "all") return "All Grades";

    return (
      heatmapGradeOptions.find((option) => option.value === heatmapGradeFilter)
        ?.label ?? "Selected Grade"
    );
  }, [heatmapGradeFilter, heatmapGradeOptions]);

  const SCP_LABELS: Record<string, string> = {
    REGULAR: "Regular (BEC)",
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
    SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
    SPECIAL_PROGRAM_IN_SPORTS: "SPS",
    SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
    SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
    SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
  };

  useEffect(() => {
    const fetchProgramOptions = async () => {
      if (!ayId) return;
      try {
        const res = await api.get(`/curriculum/${ayId}/scp-config`);
        const configs = res.data.scpProgramConfigs || [];
        const offeredScps = configs
          .filter((cfg: any) => cfg.isOffered)
          .map((cfg: any) => ({
            value: cfg.scpType,
            label: SCP_LABELS[cfg.scpType] || cfg.scpType,
          }));

        setProgramOptions([
          { value: "REGULAR", label: "Regular (BEC)" },
          ...offeredScps,
        ]);
      } catch (err) {
        console.error("Failed to fetch SCP configs", err);
      }
    };

    if (ayId) {
      fetchProgramOptions();
    }
  }, [ayId]);

  useEffect(() => {
    api
      .get("/bosy/tle-programs")
      .then((res) => setTlePrograms(res.data.programs ?? res.data))
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const handleOpenCreate = useCallback(
    (glId: number, glName: string, glDisplayOrder: number) => {
      setFormSheetMode("create");
      setCreateGlId(glId);
      setCreateGlName(glName);
      setCreateGlDisplayOrder(glDisplayOrder);
      setSectionFormData({
        name: "",
        programType: "REGULAR",
        adviserId: "none",
        maxCapacity: DEFAULT_MAX_CAPACITY_REGULAR,
        tleProgramId: null,
        sectionRank: null,
      });
      setAvailableTeachers(
        teachers.map((t) => ({
          id: t.id,
          name: t.name,
          employeeId: t.employeeId,
        })),
      );
      setIsFormSheetOpen(true);
    },
    [teachers],
  );

  const handleOpenEdit = useCallback(
    async (section: SectionItem, glName: string, glDisplayOrder: number) => {
      setFormSheetMode("edit");
      setEditingSectionId(section.id);
      setCreateGlName(glName);
      setCreateGlDisplayOrder(glDisplayOrder);
      setSectionFormData({
        name: section.name,
        programType: section.programType,
        adviserId: section.advisingTeacher
          ? section.advisingTeacher.id.toString()
          : "none",
        maxCapacity: section.maxCapacity,
        tleProgramId: section.tleProgramId ?? null,
        sectionRank: section.sectionRank ?? null,
      });

      // Fetch filtered teachers for editing
      setLoadingTeachers(true);
      try {
        const res = await api.get(
          `/sections/teachers?schoolYearId=${ayId}&excludeSectionId=${section.id}`,
        );
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

      setIsFormSheetOpen(true);
    },
    [ayId, teachers],
  );

  const handleFieldChange = useCallback(
    (field: keyof SectionFormState, value: any) => {
      setSectionFormData((prev) => {
        const next = { ...prev, [field]: value };

        // Auto-update capacity when program type changes
        if (field === "programType") {
          next.maxCapacity =
            value === "REGULAR"
              ? DEFAULT_MAX_CAPACITY_REGULAR
              : DEFAULT_MAX_CAPACITY_SCP;
        }

        return next;
      });
    },
    [],
  );

  const handleFormSubmit = async () => {
    if (!sectionFormData.name.trim()) return;
    setSubmittingForm(true);
    try {
      const payload = {
        name: sectionFormData.name.trim(),
        programType: sectionFormData.programType,
        advisingTeacherId:
          sectionFormData.adviserId === "none"
            ? null
            : parseInt(sectionFormData.adviserId),
        maxCapacity: sectionFormData.maxCapacity,
        tleProgramId: sectionFormData.tleProgramId ?? null,
        sectionRank: sectionFormData.sectionRank ?? null,
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
      fetchData();
    } catch (err) {
      showSectionsErrorToast(formSheetMode, err);
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

  const renderSectionGroup = (
    title: string,
    sectionsToRender: SectionItem[],
    gradeLevelName: string,
    glId: number,
    glDisplayOrder: number = 0,
  ) => {
    if (sectionsToRender.length === 0) return null;

    return (
      <div className="space-y-3 mt-6 first:mt-0">
        <h3 className="text-sm font-black uppercase  text-foreground border-b border-border/50 pb-2 text-center">
          {title}
        </h3>
        <div className="space-y-3">
          {sectionsToRender.map((s) => {
            const displaySectionName = formatSectionLabel(s.name);
            const isDeleteDisabled = s.enrolledCount > 0;
            const fillPercent =
              s.maxCapacity > 0 ? (s.enrolledCount / s.maxCapacity) * 100 : 0;
            const isOverCapacity = s.enrolledCount > s.maxCapacity;

            return (
              <div
                key={s.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-all gap-4",
                  isOverCapacity
                    ? "border-red-300 bg-red-50/30 hover:border-red-400"
                    : "border-border hover:border-primary/20",
                )}>
                <div className="flex items-start sm:items-center gap-4">
                  <div className="text-2xl leading-none mt-0.5 sm:mt-0">
                    {fillEmoji(fillPercent)}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base uppercase ">
                        {displaySectionName}
                      </h4>
                      <Badge
                        variant="secondary"
                        className="text-[9px] uppercase  font-bold">
                        {formatProgramType(s.programType)}
                      </Badge>
                      {s.isHomogeneous && s.programType === "REGULAR" && (
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase  font-black border-primary/20 text-primary">
                          Pilot
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground font-semibold">
                          Adviser:
                        </span>
                        {s.advisingTeacher ? (
                          <span className="font-bold text-foreground">
                            {s.advisingTeacher.name}
                          </span>
                        ) : (
                          <span className="font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md">
                            Unassigned
                          </span>
                        )}
                      </div>
                      <span className="hidden sm:inline text-border">|</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground font-semibold">
                          Capacity:
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            isOverCapacity ? "text-red-700" : "text-foreground",
                          )}>
                          {s.enrolledCount}/{s.maxCapacity}{" "}
                          <span
                            className={cn(
                              isOverCapacity ? "font-black" : "text-foreground",
                            )}>
                            ({Math.round(fillPercent)}%)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 font-bold text-primary border-primary/20 hover:bg-primary/5"
                    onClick={() =>
                      setViewRosterSection({
                        id: s.id,
                        name: displaySectionName,
                        gradeLevelName: gradeLevelName,
                        adviserName: s.advisingTeacher?.name ?? null,
                        maxCapacity: s.maxCapacity,
                        enrolledCount: s.enrolledCount,
                        programType: s.programType,
                        gradeLevelId: glId,
                      })
                    }>
                    <Users className="h-3.5 w-3.5 mr-2" /> View Roster
                  </Button>
                  {canMutate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 font-bold"
                      onClick={() =>
                        handleOpenEdit(s, gradeLevelName, glDisplayOrder)
                      }>
                      <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                    </Button>
                  )}
                  {canMutate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 font-bold text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() =>
                        setHandoverSection({
                          id: s.id,
                          name: displaySectionName,
                          gradeLevelName: gradeLevelName,
                          advisingTeacher: s.advisingTeacher,
                        })
                      }>
                      <RefreshCcw className="h-3.5 w-3.5 mr-2" /> Handover
                    </Button>
                  )}
                  {canMutate &&
                    (isDeleteDisabled ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-foreground/30 cursor-not-allowed"
                        disabled
                        title="Cannot delete populated section">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        onClick={() => {
                          setDeleteId(s.id);
                          setDeleteName(displaySectionName);
                        }}
                        title="Delete section">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">
                No School Year Selected
              </p>
              <p className="text-sm text-foreground leading-relaxed px-4">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold ">Sections</h1>
          <p className="text-sm text-foreground font-bold">
            Manage grade level sections and advising teachers
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("heatmap")}
            className={cn(
              "h-8 px-4 font-bold text-xs relative z-10 transition-colors",
              viewMode === "heatmap"
                ? "text-primary-foreground hover:text-primary-foreground"
                : "text-foreground hover:bg-transparent",
            )}>
            {viewMode === "heatmap" && (
              <motion.div
                layoutId="view-toggle-pill"
                className="absolute inset-0 bg-primary rounded-md shadow-sm"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20 flex items-center">
              <Grid3X3 className="w-4 h-4 mr-2" /> Heatmap View
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(
              "h-8 px-4 font-bold text-xs relative z-10 transition-colors",
              viewMode === "list"
                ? "text-primary-foreground hover:text-primary-foreground"
                : "text-foreground hover:bg-transparent",
            )}>
            {viewMode === "list" && (
              <motion.div
                layoutId="view-toggle-pill"
                className="absolute inset-0 bg-primary rounded-md shadow-sm"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20 flex items-center">
              <ListFilter className="w-4 h-4 mr-2" /> List View
            </span>
          </Button>
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
      ) : viewMode === "heatmap" ? (
        /* Capacity Heatmap overview */
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Grid3X3 className="h-5 w-5" />
                Capacity Heatmap
              </CardTitle>
              <Tabs
                value={heatmapGradeFilter}
                onValueChange={setHeatmapGradeFilter}
                className="w-full lg:w-auto">
                <TabsList className="h-auto w-full flex-wrap justify-start bg-muted/40 lg:w-auto lg:justify-end gap-1 p-1 relative border border-border/50">
                  <TabsTrigger
                    value="all"
                    className="py-1.5 px-4 text-xs font-bold relative z-10 transition-all data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    {heatmapGradeFilter === "all" && (
                      <motion.div
                        layoutId="heatmap-grade-pill"
                        className="absolute inset-0 bg-primary rounded-md"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.5,
                        }}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-20",
                        heatmapGradeFilter === "all"
                          ? "text-primary-foreground"
                          : "text-foreground",
                      )}>
                      All Grades
                    </span>
                  </TabsTrigger>
                  {heatmapGradeOptions.map((option) => (
                    <TabsTrigger
                      key={option.value}
                      value={option.value}
                      className="py-1.5 px-4 text-xs font-bold relative z-10 transition-all data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      {heatmapGradeFilter === option.value && (
                        <motion.div
                          layoutId="heatmap-grade-pill"
                          className="absolute inset-0 bg-primary rounded-md"
                          transition={{
                            type: "spring",
                            bounce: 0.15,
                            duration: 0.5,
                          }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-20",
                          heatmapGradeFilter === option.value
                            ? "text-primary-foreground"
                            : "text-foreground",
                        )}>
                        {option.label}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <CardDescription>
              Visual overview of section fill rates. 🟢 &lt;50% · 🟡 50-74% · 🟠
              75-89% · 🔴 90%+
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                No grade levels found for this School Year.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {heatmapItems.map(({ group, section }) => {
                  const fillPercent =
                    section.maxCapacity > 0
                      ? (section.enrolledCount / section.maxCapacity) * 100
                      : 0;
                  const isOverCapacity =
                    section.enrolledCount > section.maxCapacity;

                  return (
                    <div
                      key={section.id}
                      onClick={() =>
                        setViewRosterSection({
                          id: section.id,
                          name: formatSectionLabel(section.name),
                          gradeLevelName: group.gradeLevelName,
                          adviserName: section.advisingTeacher?.name ?? null,
                          maxCapacity: section.maxCapacity,
                          enrolledCount: section.enrolledCount,
                          programType: section.programType,
                          gradeLevelId: group.gradeLevelId,
                        })
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-all group",
                        isOverCapacity
                          ? "border-red-300 bg-red-50/40 hover:border-red-400"
                          : "border-border hover:border-primary/50",
                      )}>
                      <span className="text-lg group-hover:scale-110 transition-transform">
                        {fillEmoji(fillPercent)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                          {formatHeatmapLabel(
                            group.gradeLevelName,
                            section.name,
                          )}
                        </p>
                        <div className="mt-1 h-2 w-full rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all",
                              fillColor(fillPercent),
                            )}
                            style={{
                              width: `${Math.min(fillPercent, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-bold whitespace-nowrap",
                          isOverCapacity
                            ? "text-red-700 font-black"
                            : "text-foreground",
                        )}>
                        {section.enrolledCount}/{section.maxCapacity}
                      </span>
                    </div>
                  );
                })}
                {heatmapItems.length === 0 &&
                  (groups.every((group) => group.sections.length === 0) ? (
                    <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No sections created yet. Add sections to grade levels
                      below.
                    </p>
                  ) : (
                    <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No sections found for {selectedHeatmapGradeLabel}.
                    </p>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Active List View - Tabbed by Grade */
        <Tabs
          value={activeGradeId}
          onValueChange={setActiveGradeId}
          className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border border-border rounded-lg relative">
            {groups.map((g) => (
              <TabsTrigger
                key={g.gradeLevelId}
                value={String(g.gradeLevelId)}
                className="flex-1 min-w-32 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {activeGradeId === String(g.gradeLevelId) && (
                  <motion.div
                    layoutId="grade-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-20 uppercase  text-xs",
                    activeGradeId === String(g.gradeLevelId)
                      ? "text-primary-foreground"
                      : "text-foreground",
                  )}>
                  {g.gradeLevelName}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            {groups
              .filter((g) => String(g.gradeLevelId) === activeGradeId)
              .map((g) => (
                <motion.div
                  key={g.gradeLevelId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full">
                  <TabsContent
                    value={String(g.gradeLevelId)}
                    forceMount
                    className="mt-0 focus-visible:outline-none ring-0">
                    <Card className="border-border shadow-sm">
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
                        <div>
                          <CardTitle className="text-xl font-black uppercase">
                            {g.gradeLevelName}
                          </CardTitle>
                          <CardDescription className="font-semibold text-xs mt-1">
                            {g.sections.length} total sections configured for
                            this level.
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          className="font-bold h-10 px-4"
                          variant="default"
                          onClick={() =>
                            handleOpenCreate(g.gradeLevelId, g.gradeLevelName)
                          }
                          disabled={!canMutate}>
                          <Plus className="mr-2 h-4 w-4" /> Add{" "}
                          {g.gradeLevelName} Section
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {g.sections.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center text-foreground bg-muted/10 rounded-xl border border-dashed">
                            <Grid3X3 className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm font-bold uppercase ">
                              No Sections Configured
                            </p>
                            <p className="text-xs mt-1 font-semibold">
                              Click the "Add Section" button to begin
                              structuring this grade level.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-8 pb-4">
                            {renderSectionGroup(
                              "Special Curricular Programs (SCP)",
                              g.sections.filter((s) => isSpecialSection(s)),
                              g.gradeLevelName,
                              g.gradeLevelId,
                            )}

                            {renderSectionGroup(
                              "Basic Education Curriculum (BEC)",
                              g.sections.filter((s) => isPilotSection(s)),
                              g.gradeLevelName,
                              g.gradeLevelId,
                            )}

                            {renderSectionGroup(
                              "Basic Education Curriculum (BEC)",
                              g.sections.filter(
                                (s) =>
                                  !isSpecialSection(s) && !isPilotSection(s),
                              ),
                              g.gradeLevelName,
                              g.gradeLevelId,
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </motion.div>
              ))}
          </AnimatePresence>
        </Tabs>
      )}

      <SectionFormSheet
        mode={formSheetMode}
        open={isFormSheetOpen}
        onOpenChange={setIsFormSheetOpen}
        title={formSheetMode === "create" ? "Add New Section" : "Edit Section"}
        description={
          formSheetMode === "create"
            ? `Configure a new section roster for ${createGlName}.`
            : `Update configuration for section ${sectionFormData.name}.`
        }
        formData={sectionFormData}
        onFieldChange={handleFieldChange}
        onSubmit={handleFormSubmit}
        onCancel={() => setIsFormSheetOpen(false)}
        submitting={submittingForm}
        canSubmit={!!sectionFormData.name.trim()}
        programOptions={programOptions}
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

      {/* View Roster Dialog */}
      <Dialog
        open={!!viewRosterSection}
        onOpenChange={(open) => !open && setViewRosterSection(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden shadow-2xl rounded-2xl bg-background">
          <DialogHeader className="px-8 pt-8 pb-6 bg-muted/30 border-b border-border font-sans">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-card rounded-xl text-foreground shadow-sm border border-border">
                  <Users className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <DialogTitle className="text-2xl font-black uppercase  text-foreground leading-none">
                    School Form 1 (SF1)
                  </DialogTitle>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[13px] font-black uppercase  text-foreground">
                      <span>
                        {viewRosterSection?.gradeLevelName} -{" "}
                        {viewRosterSection?.name}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                      <span className="text-foreground">
                        S.Y. {activeSchoolYearLabel || "2026-2027"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase ">
                      <span>Class Adviser:</span>
                      {viewRosterSection?.adviserName ? (
                        <span className="text-foreground">
                          {viewRosterSection.adviserName}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 font-black uppercase border-amber-200 bg-amber-50 text-amber-600 shadow-none px-1.5">
                          Unassigned
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={
                            (viewRosterSection?.enrolledCount ?? 0) >=
                            (viewRosterSection?.maxCapacity ?? 0)
                          }
                          onClick={() => setShowLateEnrolleeModal(true)}
                          className="h-10 font-black uppercase text-[11px]  bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md group">
                          <UserPlus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                          Insert Late Enrollee
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {(viewRosterSection?.enrolledCount ?? 0) >=
                      (viewRosterSection?.maxCapacity ?? 0) && (
                      <TooltipContent className="bg-slate-900 text-white border-none text-xs font-bold uppercase  p-3 shadow-xl">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          Maximum capacity reached. Override requires
                          Principal's PIN.
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSf1}
                  disabled={exportingSf1 || loadingRoster}
                  className="h-10 font-bold uppercase text-[11px]  border-border text-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm">
                  {exportingSf1 ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Download SF1 (Excel)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="h-10 font-bold uppercase text-[11px]  border-border text-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm">
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Aggregate Stats Full-Width Bar */}
          {!loadingRoster && roster.length > 0 && (
            <div className="bg-muted/10 border-b border-border/60 px-8 py-2.5 flex items-center justify-center gap-12 select-none">
              <div className="flex items-center gap-3">
                <p className="text-xs font-black text-foreground uppercase ">
                  Total Learners
                </p>
                <p className="text-base font-black text-foreground">
                  {roster.length}
                </p>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-3">
                <p className="text-xs font-black text-blue-400 uppercase  flex items-center gap-1.5">
                  <Mars className="h-4 w-4" /> Male
                </p>
                <p className="text-base font-black text-blue-700">
                  {maleLearners.length}
                </p>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-3">
                <p className="text-xs font-black text-pink-400 uppercase  flex items-center gap-1.5">
                  <Venus className="h-4 w-4" /> Female
                </p>
                <p className="text-base font-black text-pink-700">
                  {femaleLearners.length}
                </p>
              </div>
            </div>
          )}

          <div className="py-0 max-h-[65vh] overflow-auto bg-muted/5 font-sans">
            {loadingRoster ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-foreground" />
                <p className="text-xs font-bold uppercase  text-foreground animate-pulse">
                  Aggregating LIS Data...
                </p>
              </div>
            ) : roster.length === 0 ? (
              <div className="mx-8 my-12 py-16 bg-background rounded-2xl border-2 border-dashed border-border flex flex-col items-center text-center space-y-3">
                <Users className="h-12 w-12 text-foreground mb-2" />
                <p className="text-base font-bold text-foreground">
                  No Official Enrollees Yet
                </p>
                <p className="text-xs font-medium text-foreground max-w-sm leading-relaxed">
                  Learners routed to this section will automatically populate
                  this School Form 1 register once the batch is finalized.
                </p>
              </div>
            ) : (
              <div className="px-8 py-6">
                <div className="border border-border rounded-xl shadow-sm bg-card [&_div]:overflow-visible">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-xs font-black uppercase h-11 px-5 text-foreground  w-[50px] border-b border-border">
                          #
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-xs font-black uppercase h-11 px-5 text-foreground  w-[140px] border-b border-border">
                          LRN
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-xs font-black uppercase h-11 px-5 text-foreground  border-b border-border">
                          Learner Name (Last, First)
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-xs font-black uppercase h-11 px-5 text-center text-foreground  w-[70px] border-b border-border">
                          Age
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-xs font-black uppercase h-11 px-5 text-center text-foreground  w-[160px] border-b border-border">
                          Remarks
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="print:text-black">
                      {/* MALE GROUP */}
                      {maleLearners.length > 0 && (
                        <>
                          <TableRow className="sticky top-[44px] z-20 bg-muted/95 backdrop-blur-sm border-y border-border/50 select-none shadow-sm">
                            <TableCell
                              colSpan={5}
                              className="py-2.5 px-5 text-left">
                              <span className="text-[11px] font-black uppercase  text-foreground flex items-center gap-3">
                                <Mars className="h-3.5 w-3.5 text-blue-500 stroke-[3]" />
                                MALE ({maleLearners.length})
                                <div className="h-[1px] flex-1 bg-border/40" />
                              </span>
                            </TableCell>
                          </TableRow>
                          {maleLearners.map((learner, index) => (
                            <TableRow
                              key={learner.id}
                              className="hover:bg-muted/50 border-b border-border/50 last:border-0 transition-colors group">
                              <TableCell className="text-[11px] font-black text-foreground text-center px-5">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] font-bold  text-foreground group-hover:text-foreground transition-colors px-5">
                                {learner.lrn || "NO LRN"}
                              </TableCell>
                              <TableCell className="text-sm font-black uppercase py-4 px-5 text-left">
                                <Link
                                  to={`/students/${learner.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-foreground hover:text-primary transition-colors decoration-primary/30 underline-offset-4 hover:underline">
                                  {learner.lastName}, {learner.firstName}
                                </Link>
                              </TableCell>
                              <TableCell className="text-center px-5">
                                <span className="text-sm font-bold text-foreground">
                                  {calculateAge(learner.birthdate)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center px-5">
                                {renderRemarks(learner)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}

                      {/* FEMALE GROUP */}
                      {femaleLearners.length > 0 && (
                        <>
                          <TableRow className="sticky top-[44px] z-20 bg-muted/95 backdrop-blur-sm border-y border-border/50 select-none shadow-sm">
                            <TableCell
                              colSpan={5}
                              className="py-2.5 px-5 text-left">
                              <span className="text-[11px] font-black uppercase  text-foreground flex items-center gap-3">
                                <Venus className="h-3.5 w-3.5 text-pink-500 stroke-[3]" />
                                FEMALE ({femaleLearners.length})
                                <div className="h-[1px] flex-1 bg-border/40" />
                              </span>
                            </TableCell>
                          </TableRow>
                          {femaleLearners.map((learner, index) => (
                            <TableRow
                              key={learner.id}
                              className="hover:bg-muted/50 border-b border-border/50 last:border-0 transition-colors group">
                              <TableCell className="text-[11px] font-black text-foreground text-center px-5">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] font-bold  text-foreground group-hover:text-foreground transition-colors px-5">
                                {learner.lrn || "NO LRN"}
                              </TableCell>
                              <TableCell className="text-sm font-black uppercase py-4 px-5 text-left">
                                <Link
                                  to={`/students/${learner.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-foreground hover:text-primary transition-colors decoration-primary/30 underline-offset-4 hover:underline">
                                  {learner.lastName}, {learner.firstName}
                                </Link>
                              </TableCell>
                              <TableCell className="text-center px-5">
                                <span className="text-sm font-bold text-foreground">
                                  {calculateAge(learner.birthdate)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center px-5">
                                {renderRemarks(learner)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-muted/20 border-t border-border px-8 py-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-xs font-black text-foreground uppercase ">
                DepEd Order No. 017, s. 2025 Compliant
              </p>
            </div>
            <Button
              onClick={() => setViewRosterSection(null)}
              variant="outline"
              className="font-bold uppercase text-xs  h-10 px-8 bg-background border-border text-foreground hover:bg-muted hover:text-foreground">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewRosterSection && (
        <InsertLateEnrolleeModal
          open={showLateEnrolleeModal}
          onOpenChange={setShowLateEnrolleeModal}
          sectionId={viewRosterSection.id}
          sectionName={viewRosterSection.name}
          gradeLevelId={viewRosterSection.gradeLevelId}
          gradeLevelName={viewRosterSection.gradeLevelName}
          maxCapacity={viewRosterSection.maxCapacity}
          enrolledCount={viewRosterSection.enrolledCount}
          programType={viewRosterSection.programType}
          schoolYearId={ayId!}
          onSuccess={() => {
            void fetchRoster(viewRosterSection.id);
            void fetchData();
          }}
        />
      )}

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
