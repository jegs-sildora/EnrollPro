import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { sileo } from "sileo";
import {
  Plus,
  Trash2,
  Grid3X3,
  X,
  Check,
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
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { InsertLateEnrolleeModal } from "../components/InsertLateEnrolleeModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
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
import { differenceInYears, format } from "date-fns";
import { Badge } from "@/shared/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/shared/lib/utils";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface SectionItem {
  id: number;
  name: string;
  displayName: string | null;
  sortOrder: number;
  programType: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
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
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-orange-400";
  if (pct >= 50) return "bg-yellow-400";
  return "bg-green-500";
}

function fillEmoji(pct: number): string {
  if (pct >= 90) return "🔴";
  if (pct >= 75) return "🟠";
  if (pct >= 50) return "🟡";
  return "🟢";
}

const isPilotSection = (name: string): boolean => {
  const n = name.toUpperCase();
  return n.startsWith("PILOT") || /^SECTION\s*[1-5](\s|$)/.test(n);
};

const isSpecialSection = (name: string): boolean => {
  const n = name.toUpperCase();
  return (
    n.startsWith("STE") ||
    n.startsWith("SPA") ||
    n.startsWith("SPS") ||
    n.startsWith("SPJ") ||
    n.startsWith("SPFL") ||
    n.startsWith("SPTVE")
  );
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

export default function Sections() {
  const { activeSchoolYearId, viewingSchoolYearId, activeSchoolYearLabel } =
    useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");
  const [activeGradeId, setActiveGradeId] = useState<string>("");

  const [groups, setGroups] = useState<GradeLevelGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  // Inline add section state
  const [addGlId, setAddGlId] = useState<number | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [sectionDisplayName, setSectionDisplayName] = useState("");
  const [sectionSortOrder, setSectionSortOrder] = useState("");
  const [sectionCap, setSectionCap] = useState("40");
  const [sectionProgramType, setSectionProgramType] =
    useState<string>("REGULAR");
  const [advisingTeacherId, setAdvisingTeacherId] = useState<string>("none");
  const [adding, setAdding] = useState(false);

  // Edit section state
  const [editSection, setEditSection] = useState<SectionItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");
  const [editCap, setEditCap] = useState("40");
  const [editProgramType, setEditProgramType] = useState<string>("REGULAR");
  const [editAdvisingTeacherId, setEditAdvisingTeacherId] =
    useState<string>("none");
  const [editing, setEditing] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Late Enrollee Modal State
  const [showLateEnrolleeModal, setShowLateEnrolleeModal] = useState(false);

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
  const [roster, setRoster] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [classOpeningDate, setClassOpeningDate] = useState<string | null>(null);

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return "-";
    const bday = new Date(birthdate);
    // DepEd Rule: Age as of August 31st of the current school year
    const referenceDate = new Date(new Date().getFullYear(), 7, 31); // August 31
    return differenceInYears(referenceDate, bday);
  };

  const renderRemarks = (learner: any) => {
    const remarks = [];

    if (learner.status === "TEMPORARILY_ENROLLED") {
      remarks.push(
        <Badge
          key="temp"
          variant="outline"
          className="text-[9px] font-black uppercase border-amber-300 bg-amber-50 text-amber-700 shadow-none px-2 py-0.5">
          ⚠️ Temporary
        </Badge>
      );
    }

    // Phase 5: Late Enrollee Logic
    if (learner.sectioningMethod === "INLINE_SLOTTING" && learner.dateSectioned) {
      const isLate = !classOpeningDate || new Date(learner.dateSectioned) > new Date(classOpeningDate);
      if (isLate) {
        remarks.push(
          <span key="late" className="text-[10px] font-black text-emerald-600 uppercase tracking-tight bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 ml-1">
            Late Enrollee ({format(new Date(learner.dateSectioned), "MMM d")})
          </span>
        );
      }
    }

    if (learner.learnerType === "TRANSFEREE") {
      remarks.push(
        <span key="transferee" className="text-[10px] font-bold text-foreground uppercase tracking-tight ml-1">
          [ Transferee ]
        </span>
      );
    }
    
    if (learner.learnerType === "RETURNING") {
      remarks.push(
        <span key="returning" className="text-[10px] font-bold text-foreground uppercase tracking-tight ml-1">
          [ Balik-Aral ]
        </span>
      );
    }

    return remarks.length > 0 ? <div className="flex flex-wrap items-center justify-center gap-1">{remarks}</div> : <span className="text-foreground">-</span>;
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
        api.get("/sections/teachers"),
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

  const toggleAddMode = (glId: number) => {
    if (addGlId === glId) {
      setAddGlId(null);
    } else {
      setAddGlId(glId);
      setSectionName("");
      setSectionDisplayName("");
      setSectionSortOrder("");
      setSectionCap("40");
      setSectionProgramType("REGULAR");
      setAdvisingTeacherId("none");
    }
  };

  const handleAdd = async () => {
    if (!addGlId || !sectionName.trim()) return;
    setAdding(true);
    try {
      await api.post("/sections", {
        name: sectionName.trim(),
        displayName: sectionDisplayName.trim() || null,
        sortOrder: sectionSortOrder.trim()
          ? parseInt(sectionSortOrder, 10)
          : undefined,
        maxCapacity: parseInt(sectionCap) || 40,
        gradeLevelId: addGlId,
        programType: sectionProgramType,
        advisingTeacherId:
          advisingTeacherId === "none" ? null : parseInt(advisingTeacherId),
      });
      sileo.success({
        title: "Section created",
        description: `${sectionName.trim()} is now available in this grade level.`,
      });
      setAddGlId(null);
      fetchData();
    } catch (err) {
      showSectionsErrorToast("create", err);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (section: SectionItem) => {
    setEditSection(section);
    setEditName(formatSectionLabel(section.name));
    setEditDisplayName(section.displayName ?? "");
    setEditSortOrder(String(section.sortOrder ?? ""));
    setEditCap(section.maxCapacity.toString());
    setEditProgramType(section.programType ?? "REGULAR");
    setEditAdvisingTeacherId(
      section.advisingTeacher ? section.advisingTeacher.id.toString() : "none",
    );
  };

  const handleEdit = async () => {
    if (!editSection || !editName.trim()) return;
    setEditing(true);
    try {
      await api.put(`/sections/${editSection.id}`, {
        name: editName.trim(),
        displayName: editDisplayName.trim() || null,
        sortOrder: editSortOrder.trim()
          ? parseInt(editSortOrder, 10)
          : undefined,
        maxCapacity: parseInt(editCap) || 40,
        programType: editProgramType,
        advisingTeacherId:
          editAdvisingTeacherId === "none"
            ? null
            : parseInt(editAdvisingTeacherId),
      });
      sileo.success({
        title: "Section details updated",
        description: `Saved changes for ${editName.trim()}.`,
      });
      setEditSection(null);
      fetchData();
    } catch (err) {
      showSectionsErrorToast("update", err);
    } finally {
      setEditing(false);
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
  ) => {
    if (sectionsToRender.length === 0) return null;

    return (
      <div className="space-y-3 mt-6 first:mt-0">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground border-b border-border/50 pb-2 text-center">
          {title}
        </h3>
        <div className="space-y-3">
          {sectionsToRender.map((s) => {
            const displaySectionName = formatSectionLabel(
              s.displayName ?? s.name,
            );
            const isDeleteDisabled = s.enrolledCount > 0;

            return (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary/20 transition-all gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="text-2xl leading-none mt-0.5 sm:mt-0">
                    {fillEmoji(s.fillPercent)}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base uppercase tracking-tight">
                        {displaySectionName}
                      </h4>
                      <Badge
                        variant="secondary"
                        className="text-[9px] uppercase tracking-wider font-bold">
                        {formatProgramType(s.programType)}
                      </Badge>
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
                            <AlertTriangle className="h-3 w-3" /> Unassigned
                          </span>
                        )}
                      </div>
                      <span className="hidden sm:inline text-border">|</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground font-semibold">
                          Capacity:
                        </span>
                        <span className="font-bold">
                          {s.enrolledCount}/{s.maxCapacity}{" "}
                          <span className="text-foreground">
                            ({Math.round(s.fillPercent)}%)
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
                        gradeLevelId: glId
                      })
                    }>
                    <Users className="h-3.5 w-3.5 mr-2" /> View Roster
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 font-bold"
                    onClick={() => openEdit(s)}>
                    <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                  </Button>
                  {isDeleteDisabled ? (
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
                  )}
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
          <h1 className="text-3xl font-bold tracking-tight">Sections</h1>
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
              viewMode === "heatmap" ? "text-primary-foreground hover:text-primary-foreground" : "text-foreground hover:bg-transparent"
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
              viewMode === "list" ? "text-primary-foreground hover:text-primary-foreground" : "text-foreground hover:bg-transparent"
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
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span className={cn(
                      "relative z-20",
                      heatmapGradeFilter === "all" ? "text-primary-foreground" : "text-foreground"
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
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <span className={cn(
                        "relative z-20",
                        heatmapGradeFilter === option.value ? "text-primary-foreground" : "text-foreground"
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
                {heatmapItems.map(({ group, section }) => (
                  <div
                    key={section.id}
                    onClick={() =>
                      setViewRosterSection({
                        id: section.id,
                        name: formatSectionLabel(section.displayName ?? section.name),
                        gradeLevelName: group.gradeLevelName,
                        adviserName: section.advisingTeacher?.name ?? null,
                        maxCapacity: section.maxCapacity,
                        enrolledCount: section.enrolledCount,
                        programType: section.programType,
                        gradeLevelId: group.gradeLevelId
                      })
                    }
                    className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group">
                    <span className="text-lg group-hover:scale-110 transition-transform">
                      {fillEmoji(section.fillPercent)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                        {formatHeatmapLabel(
                          group.gradeLevelName,
                          section.displayName ?? section.name,
                        )}
                      </p>
                      <div className="mt-1 h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full transition-all ${fillColor(section.fillPercent)}`}
                          style={{
                            width: `${Math.min(section.fillPercent, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-foreground whitespace-nowrap">
                      {section.enrolledCount}/{section.maxCapacity}
                    </span>
                  </div>
                ))}
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
                    "relative z-20 uppercase tracking-widest text-xs",
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
                          variant={
                            addGlId === g.gradeLevelId ? "outline" : "default"
                          }
                          onClick={() => toggleAddMode(g.gradeLevelId)}>
                          {addGlId === g.gradeLevelId ? (
                            <>
                              <X className="mr-2 h-4 w-4" /> Cancel Entry
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" /> Add{" "}
                              {g.gradeLevelName} Section
                            </>
                          )}
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {addGlId === g.gradeLevelId && (
                          <div className="space-y-4 bg-muted/20 p-6 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">
                                  Section Name
                                </Label>
                                <Input
                                  placeholder="e.g. Section A"
                                  value={sectionName}
                                  onChange={(e) =>
                                    setSectionName(e.target.value)
                                  }
                                  className="h-10 font-bold"
                                  autoFocus
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">
                                  Display Name
                                </Label>
                                <Input
                                  placeholder="e.g. STAR SECTION"
                                  value={sectionDisplayName}
                                  onChange={(e) =>
                                    setSectionDisplayName(e.target.value)
                                  }
                                  className="h-10 font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">
                                  Sort Order
                                </Label>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Auto"
                                  value={sectionSortOrder}
                                  onChange={(e) =>
                                    setSectionSortOrder(e.target.value)
                                  }
                                  className="h-10 font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">
                                  Max Capacity
                                </Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={sectionCap}
                                  onChange={(e) =>
                                    setSectionCap(e.target.value)
                                  }
                                  className="h-10 font-bold"
                                />
                              </div>
                              <div className="space-y-2 lg:col-span-2">
                                <Label className="text-xs font-bold uppercase">
                                  Program Type
                                </Label>
                                <Select
                                  value={sectionProgramType}
                                  onValueChange={setSectionProgramType}>
                                  <SelectTrigger className="h-10 font-bold">
                                    <SelectValue placeholder="Select program" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PROGRAM_TYPE_OPTIONS.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2 lg:col-span-2">
                                <Label className="text-xs font-bold uppercase">
                                  Advising Teacher (Optional)
                                </Label>
                                <Select
                                  value={advisingTeacherId}
                                  onValueChange={setAdvisingTeacherId}>
                                  <SelectTrigger className="h-10 font-bold">
                                    <SelectValue placeholder="Select teacher" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">
                                      No Advising Teacher
                                    </SelectItem>
                                    {teachers.map((t) => (
                                      <SelectItem
                                        key={t.id}
                                        value={t.id.toString()}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex justify-end pt-2">
                              <Button
                                className="h-10 px-8 font-bold"
                                onClick={handleAdd}
                                disabled={adding || !sectionName.trim()}>
                                {adding ? (
                                  "Adding..."
                                ) : (
                                  <>
                                    <Check className="mr-2 h-4 w-4" /> Save
                                    Section
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {g.sections.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center text-foreground bg-muted/10 rounded-xl border border-dashed">
                            <Grid3X3 className="h-10 w-10 mb-3 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-wider">
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
                              g.sections.filter((s) =>
                                isSpecialSection(s.name),
                              ),
                              g.gradeLevelName,
                              g.gradeLevelId
                            )}

                            {renderSectionGroup(
                              "Pilot Sections",
                              g.sections.filter((s) => isPilotSection(s.name)),
                              g.gradeLevelName,
                              g.gradeLevelId
                            )}

                            {renderSectionGroup(
                              "Regular & Heterogeneous (BEC)",
                              g.sections.filter(
                                (s) =>
                                  !isSpecialSection(s.name) &&
                                  !isPilotSection(s.name),
                              ),
                              g.gradeLevelName,
                              g.gradeLevelId
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

      {/* Edit Section Dialog */}
      <Dialog
        open={!!editSection}
        onOpenChange={(open) => !open && setEditSection(null)}>
        <DialogContent className="max-w-md border-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              Edit Section
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase">
                  Section Name
                </Label>
                <Input
                  placeholder="e.g. Section A"
                  value={editName}
                  className="font-bold"
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase">
                  Display Name
                </Label>
                <Input
                  placeholder="Shown in batch sectioning and lists"
                  value={editDisplayName}
                  className="font-bold"
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Sort Order
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={editSortOrder}
                  className="font-bold"
                  onChange={(e) => setEditSortOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Max Capacity
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={editCap}
                  className="font-bold"
                  onChange={(e) => setEditCap(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase">
                  Program Type
                </Label>
                <Select
                  value={editProgramType}
                  onValueChange={setEditProgramType}>
                  <SelectTrigger className="font-bold">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAM_TYPE_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="font-bold uppercase text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase">
                  Advising Teacher
                </Label>
                <Select
                  value={editAdvisingTeacherId}
                  onValueChange={setEditAdvisingTeacherId}>
                  <SelectTrigger className="font-bold">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="none"
                      className="font-bold uppercase text-xs text-foreground">
                      No Advising Teacher
                    </SelectItem>
                    {teachers.map((t) => (
                      <SelectItem
                        key={t.id}
                        value={t.id.toString()}
                        className="font-bold text-sm">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSection(null)}
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editing || !editName.trim()}
              className="font-bold">
              {editing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground leading-none">
                    School Form 1 (SF1)
                  </DialogTitle>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wider text-muted-foreground">
                      <span>
                        {viewRosterSection?.gradeLevelName} -{" "}
                        {viewRosterSection?.name}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                      <span className="text-muted-foreground">
                        S.Y. {activeSchoolYearLabel || "2026-2027"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      <span>Class Adviser:</span>
                      {viewRosterSection?.adviserName ? (
                        <span className="text-foreground">
                          {viewRosterSection.adviserName}
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 font-black uppercase border-amber-200 bg-amber-50 text-amber-600 shadow-none px-1.5">
                          ⚠️ Unassigned
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
                          className="h-10 font-black uppercase text-[11px] tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md group">
                          <UserPlus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                          Insert Late Enrollee
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {(viewRosterSection?.enrolledCount ?? 0) >=
                      (viewRosterSection?.maxCapacity ?? 0) && (
                      <TooltipContent className="bg-slate-900 text-white border-none text-[10px] font-bold uppercase tracking-widest p-3 shadow-xl">
                         <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            Maximum capacity reached. Override requires Principal's PIN.
                         </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 font-bold uppercase text-[11px] tracking-wider border-border text-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm">
                  <FileDown className="h-4 w-4 mr-2" />
                  Download SF1 (Excel)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="h-10 font-bold uppercase text-[11px] tracking-wider border-border text-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm">
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Aggregate Stats Full-Width Bar */}
          {!loadingRoster && roster.length > 0 && (
            <div className="bg-muted/10 border-b border-border/60 px-8 py-2.5 flex items-center justify-center gap-12 select-none">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Total Learners
                </p>
                <p className="text-base font-black text-foreground">
                  {roster.length}
                </p>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <Mars className="h-4 w-4" /> Male
                </p>
                <p className="text-base font-black text-blue-700">
                  {maleLearners.length}
                </p>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-pink-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
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
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground animate-pulse">
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
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-[10px] font-black uppercase h-11 px-5 text-muted-foreground tracking-wider w-[50px] border-b border-border">
                          #
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-[10px] font-black uppercase h-11 px-5 text-muted-foreground tracking-wider w-[140px] border-b border-border">
                          LRN
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-[10px] font-black uppercase h-11 px-5 text-muted-foreground tracking-wider border-b border-border">
                          Learner Name (Last, First)
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-[10px] font-black uppercase h-11 px-5 text-center text-muted-foreground tracking-wider w-[70px] border-b border-border">
                          Age
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm text-[10px] font-black uppercase h-11 px-5 text-center text-muted-foreground tracking-wider w-[160px] border-b border-border">
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
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
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
                              <TableCell className="text-[11px] font-black text-muted-foreground text-center px-5">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] font-bold  text-muted-foreground group-hover:text-foreground transition-colors px-5">
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
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
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
                              <TableCell className="text-[11px] font-black text-muted-foreground text-center px-5">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] font-bold  text-muted-foreground group-hover:text-foreground transition-colors px-5">
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
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                DepEd Order No. 017, s. 2025 Compliant
              </p>
            </div>
            <Button
              onClick={() => setViewRosterSection(null)}
              variant="outline"
              className="font-bold uppercase text-xs tracking-widest h-10 px-8 bg-background border-border text-foreground hover:bg-muted hover:text-foreground">
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
    </div>
  );
}
