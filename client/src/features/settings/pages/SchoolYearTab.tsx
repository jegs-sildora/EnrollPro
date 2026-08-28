import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { cn } from "@/shared/lib/utils";
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  Lock,
  Plus,
  School,
  Workflow,
  Archive,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import {
  useSettingsStore,
  type SettingsState,
} from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";
import { DatePicker } from "@/shared/ui/date-picker";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import { DualPaneDateRangePicker } from "@/shared/components/DualPaneDateRangePicker";
import {
  UnsavedChangesBar,
  useUnsavedChanges,
  useUnsavedChangesPrompt,
} from "@/shared/hooks/useUnsavedChanges";
import { useActiveTerm } from "@/shared/hooks/useActiveTerm";

const MANILA_TIME_ZONE = "Asia/Manila";


type AcademicPhase = Exclude<SettingsState["systemPhase"], null>;

function isAcademicPhase(value: string): value is AcademicPhase {
  return [
    "OFFICIAL_ENROLLMENT",
    "CLASSES_ONGOING",
    "EOSY_CLOSING",
  ].includes(value);
}

function getDatePartsInTimeZone(date: Date, timeZone = MANILA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
}

function utcNoonDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
}

function normalizeDateToManila(date: Date) {
  const { year, month, day } = getDatePartsInTimeZone(date);
  return utcNoonDate(year, month - 1, day);
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function subUtcDays(date: Date, days: number) {
  return addUtcDays(date, -days);
}

function buildSchoolYearSchedule(
  classOpeningDate: Date,
  classEndTemplate?: Date,
) {
  const openingDate = normalizeDateToManila(classOpeningDate);
  const startYear = openingDate.getUTCFullYear();
  const endYear = startYear + 1;
  const endTemplate = classEndTemplate
    ? normalizeDateToManila(classEndTemplate)
    : utcNoonDate(endYear, 2, 31);

  return {
    yearLabel: `${startYear}-${endYear}`,
    classOpeningDate: openingDate,
    classEndDate: utcNoonDate(
      endYear,
      endTemplate.getUTCMonth(),
      endTemplate.getUTCDate(),
    ),
    enrollOpenDate: subUtcDays(openingDate, 7),
    enrollCloseDate: subUtcDays(openingDate, 1),
    term1Start: utcNoonDate(startYear, 5, 8).toISOString(),
    term1End: utcNoonDate(startYear, 8, 15).toISOString(),
    term2Start: utcNoonDate(startYear, 8, 16).toISOString(),
    term2End: utcNoonDate(startYear, 11, 18).toISOString(),
    term3Start: utcNoonDate(endYear, 0, 4).toISOString(),
    term3End: utcNoonDate(endYear, 3, 8).toISOString(),
  };
}

function sameUtcCalendarDate(left?: Date, right?: Date) {
  return (
    !!left &&
    !!right &&
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function formatManilaDate(value: string | Date | null | undefined) {
  if (!value) {
    return "TBD";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}


function toManilaDateToken(value: string | Date): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const { year, month, day } = getDatePartsInTimeZone(date);
  return year * 10000 + month * 100 + day;
}




function getEnrollmentWindowStatus(
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
  isOfficialPhase: boolean = false
) {
  if (!openDate || !closeDate) {
    return { label: " UNSCHEDULED", color: "bg-slate-100 text-slate-800" };
  }

  const todayToken = toManilaDateToken(new Date());
  const startToken = toManilaDateToken(openDate);
  const endToken = toManilaDateToken(closeDate);

  if (todayToken < startToken) {
    return {
      label: `SCHEDULED`,
      color: "bg-blue-100 text-blue-700",
    };
  }

  if (todayToken > endToken || !isOfficialPhase) {
    return { label: " ENROLLMENT CLOSED", color: "bg-slate-100 text-slate-800" };
  }

  return {
    label: "ENROLLMENT OPEN",
    color: "bg-green-100 text-green-800 border border-green-500",
  };
}

interface SYItem {
  id: number;
  yearLabel: string;
  status: string;
  isEosyFinalized: boolean;
  classOpeningDate: string | null;
  classEndDate: string | null;
  term1Start: string | null;
  term1End: string | null;
  term2Start: string | null;
  term2End: string | null;
  term3Start: string | null;
  term3End: string | null;
  term4Start: string | null;
  term4End: string | null;
  enrollOpenDate: string | null;
  enrollCloseDate: string | null;
  termFormat: "TRIMESTER" | "QUARTERS" | null;
  activeTerm: string | null;
  _count: {
    sections: number;
    gradeLevels: number;
    enrollmentApplications: number;
    enrollmentRecords: number;
  };
  sections?: { id: number }[];
}


interface Defaults {
  yearLabel: string;
  classOpeningDate: string;
  classEndDate: string;
  enrollOpenDate: string;
  enrollCloseDate: string;
}

interface RolloverDraftSnapshot {
  yearLabel: string;
  classOpeningDate: string;
  classEndDate: string;
}

function parseStartYearFromLabel(label: string): number | null {
  const parsed = Number.parseInt(label.split("-")[0] ?? "", 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function deriveNextSchoolYearLabel(activeYear: SYItem, fallbackLabel: string) {
  if (activeYear.classOpeningDate) {
    const startYear = normalizeDateToManila(
      new Date(activeYear.classOpeningDate),
    ).getUTCFullYear();
    const nextStartYear = startYear + 1;
    return `${nextStartYear}-${nextStartYear + 1}`;
  }

  const parsedStartYear = parseStartYearFromLabel(activeYear.yearLabel);
  if (parsedStartYear) {
    const nextStartYear = parsedStartYear + 1;
    return `${nextStartYear}-${nextStartYear + 1}`;
  }

  return fallbackLabel;
}

export default function SchoolYearTab() {
  const { activeTerm } = useActiveTerm();
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const {
    setSettings,
    activeSchoolYearId,
    systemPhase,
    enableHomogeneousSections,
    homogeneousSectionCount,
    heterogeneousRoundRobin,
    viewingSchoolYearStatus,
    systemStatus,
    viewingSchoolYearId,
  } = useSettingsStore();

  const isArchived = viewingSchoolYearStatus === "ARCHIVED" || systemStatus === "ARCHIVED";
  const [years, setYears] = useState<SYItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  // Create state
  const [creating, setCreating] = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [rolloverDraftBaseline, setRolloverDraftBaseline] =
    useState<RolloverDraftSnapshot | null>(null);

  // Phase Shift State
  const [selectedPhase, setSelectedPhase] =
    useState<SettingsState["systemPhase"]>(null);
  const [showPhaseModal, setShowPhaseModal] = useState(false);

  // Editable fields for setup
  const [editYearLabel, setYearLabel] = useState("");
  const [editClassOpening, setClassOpening] = useState<Date | undefined>();
  const [editClassEnd, setClassEnd] = useState<Date | undefined>();

  // Activation & Legal state

  const [, setIsUpdatingTimeline] = useState(false);

  const currentManilaYear = useMemo(
    () => getDatePartsInTimeZone(new Date()).year,
    [],
  );
  // Min = today in Manila time (no past dates within current year), Max = end of next year
  const openingMinDate = useMemo(() => normalizeDateToManila(new Date()), []);
  const openingMaxDate = useMemo(
    () => utcNoonDate(currentManilaYear + 1, 11, 31),
    [currentManilaYear],
  );

  const classEndYear = editClassOpening
    ? editClassOpening.getUTCFullYear() + 1
    : currentManilaYear + 1;
  const classEndMinDate = useMemo(
    () => utcNoonDate(classEndYear, 0, 1),
    [classEndYear],
  );
  const classEndMaxDate = useMemo(
    () => utcNoonDate(classEndYear, 11, 31),
    [classEndYear],
  );

  const fetchData = async () => {
    try {
      const [yearsRes, defaultsRes] = await Promise.all([
        api.get("/school-years"),
        api.get("/school-years/next-defaults"),
      ]);
      setYears(yearsRes.data.years);

      const defs = defaultsRes.data;
      setDefaults(defs);

      // Initialize editable fields from defaults
      setYearLabel(defs.yearLabel);
      setClassOpening(
        defs.classOpeningDate
          ? normalizeDateToManila(new Date(defs.classOpeningDate))
          : undefined,
      );
      setClassEnd(
        defs.classEndDate
          ? normalizeDateToManila(new Date(defs.classEndDate))
          : undefined,
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  useEffect(() => {
    if (!editClassOpening) {
      return;
    }

    const derivedSchedule = buildSchoolYearSchedule(
      editClassOpening,
      editClassEnd,
    );
    setYearLabel(derivedSchedule.yearLabel);

    if (!sameUtcCalendarDate(editClassEnd, derivedSchedule.classEndDate)) {
      setClassEnd(derivedSchedule.classEndDate);
    }
  }, [editClassEnd, editClassOpening]);

  const activeYear = useMemo(() => {
    const targetId = viewingSchoolYearId ?? activeSchoolYearId;
    if (targetId) {
      const match = years.find((y) => y.id === targetId);
      if (match) return match;
    }

    // Fallback 1: Explicit operational statuses
    const OPERATIONAL_STATUSES = ["ACTIVE"];
    const statusMatch = years.find((y) =>
      OPERATIONAL_STATUSES.includes(y.status),
    );
    if (statusMatch) return statusMatch;

    // Fallback 2: Any non-archived record
    return years.find((y) => y.status !== "ARCHIVED");
  }, [years, activeSchoolYearId, viewingSchoolYearId]);

  const draftYear = undefined;

  // Unified Calendar State
  const [localCalendarState, setLocalCalendarState] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeYear) {
      setLocalCalendarState({
        termFormat: activeYear.termFormat ?? "TRIMESTER",
        term1Start: activeYear.term1Start ? activeYear.term1Start.split('T')[0] : "",
        term1End: activeYear.term1End ? activeYear.term1End.split('T')[0] : "",
        term2Start: activeYear.term2Start ? activeYear.term2Start.split('T')[0] : "",
        term2End: activeYear.term2End ? activeYear.term2End.split('T')[0] : "",
        term3Start: activeYear.term3Start ? activeYear.term3Start.split('T')[0] : "",
        term3End: activeYear.term3End ? activeYear.term3End.split('T')[0] : "",
        term4Start: activeYear.term4Start ? activeYear.term4Start.split('T')[0] : "",
        term4End: activeYear.term4End ? activeYear.term4End.split('T')[0] : "",
        enrollOpenDate: activeYear.enrollOpenDate ? activeYear.enrollOpenDate.split('T')[0] : "",
        enrollCloseDate: activeYear.enrollCloseDate ? activeYear.enrollCloseDate.split('T')[0] : "",
        activeTerm: activeYear.activeTerm || activeTerm || "T1",
      });
    }
  }, [activeYear, activeTerm]);

  const isCalendarChanged = useMemo(() => {
    if (!activeYear) return false;
    const getVal = (value: string | null | undefined) =>
      value ? value.split("T")[0] : "";
    return (
      localCalendarState.termFormat !== (activeYear.termFormat ?? "TRIMESTER") ||
      localCalendarState.term1Start !== getVal(activeYear.term1Start) ||
      localCalendarState.term1End !== getVal(activeYear.term1End) ||
      localCalendarState.term2Start !== getVal(activeYear.term2Start) ||
      localCalendarState.term2End !== getVal(activeYear.term2End) ||
      localCalendarState.term3Start !== getVal(activeYear.term3Start) ||
      localCalendarState.term3End !== getVal(activeYear.term3End) ||
      localCalendarState.term4Start !== getVal(activeYear.term4Start) ||
      localCalendarState.term4End !== getVal(activeYear.term4End) ||
      localCalendarState.enrollOpenDate !== getVal(activeYear.enrollOpenDate) ||
      localCalendarState.enrollCloseDate !== getVal(activeYear.enrollCloseDate) ||
      (localCalendarState.activeTerm !== (activeYear.activeTerm || activeTerm || "T1"))
    );
  }, [localCalendarState, activeYear, activeTerm]);

  const [localAlgorithmState, setLocalAlgorithmState] = useState({
    enableHomogeneousSections: enableHomogeneousSections ?? false,
    homogeneousSectionCount: homogeneousSectionCount ?? 5,
    heterogeneousRoundRobin: heterogeneousRoundRobin ?? false,
  });

  useEffect(() => {
    setLocalAlgorithmState({
      enableHomogeneousSections: enableHomogeneousSections ?? false,
      homogeneousSectionCount: homogeneousSectionCount ?? 5,
      heterogeneousRoundRobin: heterogeneousRoundRobin ?? false,
    });
  }, [enableHomogeneousSections, homogeneousSectionCount, heterogeneousRoundRobin]);

  const isAlgorithmChanged = useMemo(() => {
    return (
      localAlgorithmState.enableHomogeneousSections !== (enableHomogeneousSections ?? false) ||
      localAlgorithmState.homogeneousSectionCount !== (homogeneousSectionCount ?? 5) ||
      localAlgorithmState.heterogeneousRoundRobin !== (heterogeneousRoundRobin ?? false)
    );
  }, [localAlgorithmState, enableHomogeneousSections, homogeneousSectionCount, heterogeneousRoundRobin]);

  useEffect(() => {
    setSelectedPhase(systemPhase);
  }, [systemPhase]);

  const isPhaseChanged = !!(selectedPhase && selectedPhase !== systemPhase);

  const isDirty = isCalendarChanged || isAlgorithmChanged || isPhaseChanged;

  const unsavedChangesList = useMemo(() => {
    const changes = [];
    if (isCalendarChanged) changes.push("School Calendar & Enrollment Windows");
    if (isAlgorithmChanged) changes.push("Automated Sectioning Configuration");
    if (isPhaseChanged) changes.push("System Academic Phase");
    return changes;
  }, [isCalendarChanged, isAlgorithmChanged, isPhaseChanged]);


  const handleDiscardChanges = useCallback(() => {
    if (activeYear) {
      setLocalCalendarState({
        termFormat: activeYear.termFormat ?? "TRIMESTER",
        term1Start: activeYear.term1Start ? activeYear.term1Start.split("T")[0] : "",
        term1End: activeYear.term1End ? activeYear.term1End.split("T")[0] : "",
        term2Start: activeYear.term2Start ? activeYear.term2Start.split("T")[0] : "",
        term2End: activeYear.term2End ? activeYear.term2End.split("T")[0] : "",
        term3Start: activeYear.term3Start ? activeYear.term3Start.split("T")[0] : "",
        term3End: activeYear.term3End ? activeYear.term3End.split("T")[0] : "",
        term4Start: activeYear.term4Start ? activeYear.term4Start.split("T")[0] : "",
        term4End: activeYear.term4End ? activeYear.term4End.split("T")[0] : "",
        enrollOpenDate: activeYear.enrollOpenDate ? activeYear.enrollOpenDate.split("T")[0] : "",
        enrollCloseDate: activeYear.enrollCloseDate ? activeYear.enrollCloseDate.split("T")[0] : "",
        activeTerm: activeYear.activeTerm || activeTerm || "T1",
      });
    }

    setLocalAlgorithmState({
      enableHomogeneousSections: enableHomogeneousSections ?? false,
      homogeneousSectionCount: homogeneousSectionCount ?? 5,
      heterogeneousRoundRobin: heterogeneousRoundRobin ?? false,
    });

    setSelectedPhase(systemPhase);
  }, [activeYear, activeTerm, enableHomogeneousSections, homogeneousSectionCount, heterogeneousRoundRobin, systemPhase]);

  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);

  const executeSaveConfiguration = async () => {
    if (!activeYear) return;
    setIsSubmittingConfig(true);
    
    try {
      // 1. Save Calendar Settings
      if (isCalendarChanged) {
        const payload: Record<string, string> = { ...localCalendarState };
        if (payload.term1Start) {
          payload.classOpeningDate = new Date(payload.term1Start).toISOString();
          payload.term1Start = new Date(payload.term1Start).toISOString();
        }
        if (payload.term1End) payload.term1End = new Date(payload.term1End).toISOString();
        if (payload.term2Start) payload.term2Start = new Date(payload.term2Start).toISOString();
        if (payload.term2End) payload.term2End = new Date(payload.term2End).toISOString();
        if (payload.term3Start) payload.term3Start = new Date(payload.term3Start).toISOString();
        if (payload.term3End) {
          payload.term3End = new Date(payload.term3End).toISOString();
          if (payload.termFormat === "TRIMESTER") {
            payload.classEndDate = payload.term3End;
          }
        }
        if (payload.term4Start) payload.term4Start = new Date(payload.term4Start).toISOString();
        if (payload.term4End) {
          payload.term4End = new Date(payload.term4End).toISOString();
          if (payload.termFormat === "QUARTERS") {
            payload.classEndDate = payload.term4End;
          }
        }
        if (payload.enrollOpenDate) payload.enrollOpenDate = new Date(payload.enrollOpenDate).toISOString();
        if (payload.enrollCloseDate) payload.enrollCloseDate = new Date(payload.enrollCloseDate).toISOString();

        await api.put(`/school-years/${activeYear.id}`, payload);
        window.dispatchEvent(new Event("refetch-active-term"));
      }

      // 2. Save Algorithm Settings
      if (isAlgorithmChanged) {
        await api.patch("/settings/algorithm", localAlgorithmState);
        setSettings(localAlgorithmState);
      }

      // 3. Save Phase Settings
      if (isPhaseChanged && selectedPhase) {
        await api.patch(`/settings/phase`, { phase: selectedPhase });
        setSettings({ systemPhase: selectedPhase });
      }

      sileo.success({
        title: "Configuration Saved",
        description: "Your school year settings have been successfully updated.",
      });

      await fetchData();
      const pubRes = await api.get("/settings/public");
      setSettings({ enrollmentPhase: pubRes.data.enrollmentPhase, systemPhase: pubRes.data.systemPhase });
      setShowPhaseModal(false);

    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsSubmittingConfig(false);
    }
  };

  const handleSaveConfigurationBtn = () => {
    if (isPhaseChanged) {
      setShowPhaseModal(true);
    } else {
      executeSaveConfiguration();
    }
  };

  const nextRolloverYearLabel = useMemo(() => {
    if (!activeYear) {
      return defaults?.yearLabel ?? editYearLabel;
    }

    return deriveNextSchoolYearLabel(
      activeYear,
      defaults?.yearLabel ?? editYearLabel,
    );
  }, [activeYear, defaults?.yearLabel, editYearLabel]);

  const archivedYears = useMemo(
    () => years.filter((year: SYItem) => year.status === "ARCHIVED"),
    [years],
  );

  const isZeroState = !activeYear && !draftYear && archivedYears.length === 0;

  const isLabelTaken = useMemo(() => {
    const label = editYearLabel.trim().toLowerCase();
    if (!label) return false;
    // Check if label already exists on a different year
    return years.some(
      (y) => y.yearLabel.toLowerCase() === label && y.id !== activeYear?.id,
    );
  }, [activeYear?.id, editYearLabel, years]);



  const enrollmentPhaseStatus = useMemo(
    () =>
      getEnrollmentWindowStatus(
        activeYear?.enrollOpenDate ?? null,
        activeYear?.enrollCloseDate ?? null,
        systemPhase === "OFFICIAL_ENROLLMENT"
      ),
    [activeYear?.enrollCloseDate, activeYear?.enrollOpenDate, systemPhase],
  );

  const currentRolloverDraft = useMemo<RolloverDraftSnapshot | null>(() => {
    if (!editClassOpening || !editClassEnd) {
      return null;
    }

    return {
      yearLabel: editYearLabel.trim(),
      classOpeningDate: editClassOpening.toISOString(),
      classEndDate: editClassEnd.toISOString(),
    };
  }, [editClassEnd, editClassOpening, editYearLabel]);

  const isRolloverDraftChanged = useMemo(() => {
    if (!rolloverDraftBaseline || !currentRolloverDraft) {
      // If we are creating from scratch, it's always "changed" from nothing
      return !!currentRolloverDraft;
    }

    return (
      currentRolloverDraft.yearLabel !== rolloverDraftBaseline.yearLabel ||
      currentRolloverDraft.classOpeningDate !==
      rolloverDraftBaseline.classOpeningDate ||
      currentRolloverDraft.classEndDate !== rolloverDraftBaseline.classEndDate
    );
  }, [currentRolloverDraft, rolloverDraftBaseline]);

  const discardRolloverDraftChanges = useCallback(() => {
    if (rolloverDraftBaseline) {
      setYearLabel(rolloverDraftBaseline.yearLabel);
      setClassOpening(normalizeDateToManila(new Date(rolloverDraftBaseline.classOpeningDate)));
      setClassEnd(normalizeDateToManila(new Date(rolloverDraftBaseline.classEndDate)));
    } else if (defaults) {
      setYearLabel(defaults.yearLabel);
      setClassOpening(
        defaults.classOpeningDate
          ? normalizeDateToManila(new Date(defaults.classOpeningDate))
          : undefined,
      );
      setClassEnd(
        defaults.classEndDate
          ? normalizeDateToManila(new Date(defaults.classEndDate))
          : undefined,
      );
    }

    setShowNextForm(false);
    setRolloverDraftBaseline(null);
  }, [defaults, rolloverDraftBaseline]);

  const requestCloseNextForm = useCallback(() => {
    confirmOrRun(discardRolloverDraftChanges);
  }, [confirmOrRun, discardRolloverDraftChanges]);

  useUnsavedChanges({
    id: "settings-school-year-calendar-setup",
    label: "School year setup form",
    isDirty:
      showNextForm &&
      isRolloverDraftChanged &&
      !creating,
    isSubmitting: creating,
    onDiscard: discardRolloverDraftChanges,
  });

  useUnsavedChanges({
    id: "settings-school-year-configuration",
    label: "School year configuration",
    isDirty: !isArchived && isDirty,
    onDiscard: handleDiscardChanges,
  });

  const handleClassOpeningChange = (date?: Date) => {
    setClassOpening(date ? normalizeDateToManila(date) : undefined);
  };

  const handleClassEndChange = (date?: Date) => {
    if (!date) {
      setClassEnd(undefined);
      return;
    }

    const normalizedDate = normalizeDateToManila(date);
    const endYearToUse = editClassOpening
      ? editClassOpening.getUTCFullYear() + 1
      : normalizedDate.getUTCFullYear();
    setClassEnd(
      utcNoonDate(
        endYearToUse,
        normalizedDate.getUTCMonth(),
        normalizedDate.getUTCDate(),
      ),
    );
  };


  const handleActivateNext = async () => {
    if (activeYear) {
      return;
    }

    if (!editClassOpening || !editClassEnd) {
      sileo.error({
        title: "Missing dates",
        description:
          "Select both Start of Classes (BOSY) and End of School Year (EOSY).",
      });
      return;
    }

    setCreating(true);
    try {
      const derivedSchedule = buildSchoolYearSchedule(
        editClassOpening,
        editClassEnd,
      );
      const resolvedYearLabel = editYearLabel.trim() || derivedSchedule.yearLabel;

      const activationPayload = {
        yearLabel: resolvedYearLabel,
        classOpeningDate: derivedSchedule.classOpeningDate.toISOString(),
        classEndDate: derivedSchedule.classEndDate.toISOString(),
        enrollOpenDate: derivedSchedule.enrollOpenDate.toISOString(),
        enrollCloseDate: derivedSchedule.enrollCloseDate.toISOString(),
      };

      const requestPayload = {
        ...activationPayload,
        cloneFromId: archivedYears.length > 0 ? archivedYears[0].id : null,
      };

      const res = await api.post("/school-years/activate", requestPayload);

      setSettings({
        activeSchoolYearId: res.data.year.id,
        activeSchoolYearLabel: res.data.year.yearLabel,
        viewingSchoolYearId: null,
      });

      sileo.success({
        title: "School Year Activated",
        description: `School Year ${res.data.year.yearLabel} is now active.`,
      });

      setShowNextForm(false);
      setRolloverDraftBaseline(null);

      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setCreating(false);
    }
  };

  const handlePrepareActivation = () => {
    if (activeYear) {
      return;
    }

    if (editClassOpening && editClassEnd) {
      // First time initialization
      setRolloverDraftBaseline({
        yearLabel: editYearLabel.trim(),
        classOpeningDate: editClassOpening.toISOString(),
        classEndDate: editClassEnd.toISOString(),
      });
    }

    setShowNextForm(true);
  };

  if (showSkeleton) {
    return (
      <div className="space-y-6 mx-auto">
        <Card className="shadow-sm">
          <CardHeader className="bg border-b border-border rounded-t-lg">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <fieldset disabled={isArchived} className="space-y-6 relative pb-6 group min-w-0">
      {!loading && isZeroState ? (
        <Card className="shadow-lg bg-muted">
          <CardContent className="pt-12 pb-14 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-200">
              <School className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-extrabold  mb-3 text-foreground uppercase">
              Active School Year Required
            </h3>
            <p className="text-foreground font-extrabold max-w-lg mb-8 leading-relaxed">
              Before the system can process official enrollment or generate
              School Form 1 masterlists, a primary school year must be
              established.
            </p>
            <Button
              size="lg"
              className="font-extrabold shadow-md bg-[#800000] hover:bg-[#600000] text-white border-none"
              onClick={handlePrepareActivation}>
              <Plus className="mr-2 h-5 w-5" /> Configure S.Y.{" "}
              {nextRolloverYearLabel}
            </Button>
          </CardContent>
        </Card>
      ) : !loading ? (
        <>
          <Card
            className={cn(
              "shadow-md",
              activeYear ? "border-green-500/20" : "border-amber-500/30",
            )}>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row w-full justify-between lg:items-start gap-4 mb-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle
                      className="flex items-center gap-2 text-xl font-extrabold text-foreground"
                    >
                      <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                      <div className="break-words min-w-0">
                        {activeYear ? (
                          <>Current School Year: {activeYear.yearLabel}</>
                        ) : (
                          <>No Active School Year</>
                        )}
                      </div>
                    </CardTitle>
                  </div>
                </div>

              </div>

              {activeYear ? (
                <div className="space-y-6">
                  {/* System Academic Phase */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-lg text-foreground uppercase tracking-wide break-words">
                            SCHOOL YEAR PHASE STATUS
                          </h4>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {[
                        { value: "OFFICIAL_ENROLLMENT", title: "OFFICIAL ENROLLMENT (BOSY)", desc: "Opens the system for regular learner intake and Beginning of School Year operations" },
                        { value: "CLASSES_ONGOING", title: "CLASSES ONGOING", desc: "Closes public enrollment but permits registrars to manually encode late enrollees" },
                        { value: "EOSY_CLOSING", title: "EOSY CLOSING", desc: "Locks all enrollment actions for the End of School Year rollover" }
                      ].map(opt => {
                        const isChecked = (isArchived ? "EOSY_CLOSING" : (selectedPhase ?? systemPhase ?? "OFFICIAL_ENROLLMENT")) === opt.value;
                        return (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => {
                              if (isAcademicPhase(opt.value)) {
                                setSelectedPhase(opt.value);
                              }
                            }}
                            aria-pressed={isChecked}
                            className={cn(
                              "relative flex h-full flex-col rounded-md border bg-card px-4 pt-4 pb-2 text-left shadow-sm transition-colors text-foreground",
                              isChecked
                                ? "border-primary ring-1 ring-primary text-primary"
                                : "border-border hover:border-primary"
                            )}
                          >
                            <div className="flex h-full flex-col">
                              <div>
                                <span className="block text-lg font-extrabold leading-snug uppercase break-words">
                                  {opt.title}
                                </span>
                              </div>
                              <div className="mt-auto flex flex-col gap-2">
                                <span className="text-sm font-extrabold mb-2 break-words whitespace-normal">
                                  {opt.desc}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>


                  </div>

                  {/* Term Format Selection */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <h4 className="font-extrabold text-lg text-foreground uppercase tracking-wide break-words">
                        DepEd Grading Period Configuration
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { value: "TRIMESTER", title: "3-Term System" },
                        { value: "QUARTERS", title: "4-Quarter System" }
                      ].map(opt => {
                        const isChecked = (localCalendarState.termFormat ?? activeYear.termFormat ?? "TRIMESTER") === opt.value;
                        return (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => {
                              setLocalCalendarState(prev => ({ ...prev, termFormat: opt.value }));
                            }}
                            aria-pressed={isChecked}
                            className={cn(
                              "relative flex h-full flex-col items-center justify-center rounded-md border bg-card p-4 text-center shadow-sm transition-colors text-foreground",
                              isChecked
                                ? "border-primary ring-1 ring-primary text-primary"
                                : "border-border hover:border-primary"
                            )}
                          >
                            <div className="flex h-full flex-col justify-center">
                              <div>
                                <span className="block text-lg font-extrabold leading-snug uppercase break-words">
                                  {opt.title}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Term Date rows */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <h4 className="font-extrabold text-base text-foreground uppercase tracking-wide">
                        Term Dates
                      </h4>
                    </div>

                    {[
                      { num: 1, label: localCalendarState.termFormat === "QUARTERS" ? "Quarter 1" : "Term 1", startField: "term1Start", endField: "term1End", start: localCalendarState.term1Start, end: localCalendarState.term1End },
                      { num: 2, label: localCalendarState.termFormat === "QUARTERS" ? "Quarter 2" : "Term 2", startField: "term2Start", endField: "term2End", start: localCalendarState.term2Start, end: localCalendarState.term2End },
                      { num: 3, label: localCalendarState.termFormat === "QUARTERS" ? "Quarter 3" : "Term 3", startField: "term3Start", endField: "term3End", start: localCalendarState.term3Start, end: localCalendarState.term3End },
                      ...(localCalendarState.termFormat === "QUARTERS" ? [{ num: 4, label: "Quarter 4", startField: "term4Start", endField: "term4End", start: localCalendarState.term4Start, end: localCalendarState.term4End }] : []),
                    ].map((term) => {
                      const isActiveTerm = localCalendarState.activeTerm === `T${term.num}`;
                      return (
                      <div key={term.num} className={cn("flex flex-col sm:flex-row items-center gap-4 bg/20 p-4 rounded-xl border transition-all", isActiveTerm ? "border-green-500 ring-2 ring-green-500/20" : "border-border/40")}>
                        <div className="w-24 shrink-0 font-extrabold text-primary flex flex-col gap-1 uppercase">
                          {term.label}
                          {isActiveTerm && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-black uppercase tracking-wider whitespace-nowrap rounded-sm bg-green-100 text-green-800 border border-green-500 self-start ">ACTIVE</span>
                          )}
                        </div>
                        <DualPaneDateRangePicker
                          startValue={term.start || ""}
                          endValue={term.end || ""}
                          popoverAlign="center"
                          onApply={(start, end) => {
                            setLocalCalendarState(prev => ({
                              ...prev,
                              [term.startField]: start,
                              [term.endField]: end,
                            }));
                          }}
                          customTrigger={
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 w-full">
                              <div className="w-full sm:flex-1 px-4 py-2 bg-muted rounded-lg border border-border shadow-sm relative cursor-pointer hover:bg-muted/80 transition-colors">
                                <div className="font-extrabold text-foreground uppercase mb-0.5">Start Date</div>
                                <div className="relative w-full flex items-center">
                                  <input
                                    readOnly
                                    value={term.start ? new Date(term.start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ""}
                                    placeholder="MM/DD/YYYY"
                                    className="border-none shadow-none p-0 h-auto font-extrabold text-base text-primary bg-transparent w-full uppercase pr-10 cursor-pointer focus:outline-none placeholder:text-muted-foreground"
                                  />
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-full hover:bg-muted/50 flex items-center justify-center shrink-0 text-foreground">
                                    <CalendarIcon className="h-4 w-4" />
                                  </div>
                                </div>
                              </div>
                              <span className="text-foreground font-extrabold text-center sm:text-left py-1 sm:py-0 self-center sm:self-auto">to</span>
                              <div className="w-full sm:flex-1 px-4 py-2 bg-muted rounded-lg border border-border shadow-sm relative cursor-pointer hover:bg-muted/80 transition-colors">
                                <div className="font-extrabold text-foreground uppercase mb-0.5">End Date</div>
                                <div className="relative w-full flex items-center">
                                  <input
                                    readOnly
                                    value={term.end ? new Date(term.end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ""}
                                    placeholder="MM/DD/YYYY"
                                    className="border-none shadow-none p-0 h-auto font-extrabold text-base text-primary bg-transparent w-full uppercase pr-10 cursor-pointer focus:outline-none placeholder:text-muted-foreground"
                                  />
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-full hover:bg-muted/50 flex items-center justify-center shrink-0 text-foreground">
                                    <CalendarIcon className="h-4 w-4" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          }
                        />
                        {!isActiveTerm && activeYear && !isArchived && (
                          <div className="shrink-0 flex items-stretch justify-end self-stretch mt-2 sm:mt-0">
                            <Button
                              variant="outline"
                              className="h-full px-6 border-primary/40  text-primary hover:text-primary shadow-sm font-extrabold uppercase tracking-wide transition-all"
                              onClick={() => {
                                setLocalCalendarState(prev => ({
                                  ...prev,
                                  activeTerm: `T${term.num}`
                                }));
                              }}
                            >
                              Set as Active {localCalendarState.termFormat === "QUARTERS" ? "Quarter" : "Term"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>


                  {/* BOSY Enrollment Period */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-lg text-foreground uppercase tracking-wide break-words">
                            Official Enrollment Period (BOSY)
                          </h4>
                        </div>
                        <p className="text-base font-bold text-foreground bg/50 px-3 py-1.5 rounded-md inline-block break-words whitespace-normal">
                          Set the official dates when the system will accept incoming Grade 7, Transferees, and Returning Learners for the active school year.
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center justify-center px-3 py-1 text-sm font-bold whitespace-nowrap rounded-full ${enrollmentPhaseStatus.color}`}>
                        {enrollmentPhaseStatus.label}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg/30 p-6 rounded-2xl border-2 border-dashed border-primary/20">
                        <div className="space-y-2 relative">
                          <Label className="text-base font-extrabold uppercase text-foreground">
                            Opens On
                          </Label>
                          <HybridDatePicker
                            value={localCalendarState.enrollOpenDate || ""}
                            onChange={(val) => {
                              setLocalCalendarState(prev => ({ ...prev, enrollOpenDate: val || "" }));
                            }}
                            minDate={new Date()}
                            placeholder="Set start date"
                            className="text-primary"
                          />
                        </div>
                        <div className="space-y-2 relative">
                          <Label className="text-base font-extrabold uppercase text-foreground">
                            Closes On
                          </Label>
                          <HybridDatePicker
                            value={localCalendarState.enrollCloseDate || ""}
                            onChange={(val) => {
                              setLocalCalendarState(prev => ({ ...prev, enrollCloseDate: val || "" }));
                            }}
                            minDate={new Date()}
                            placeholder="Set end date"
                            className="text-primary"
                          />
                        </div>
                      </div>



                      {localCalendarState.enrollOpenDate !== "" &&
                        localCalendarState.enrollCloseDate !== "" &&
                        toManilaDateToken(localCalendarState.enrollCloseDate) < toManilaDateToken(localCalendarState.enrollOpenDate) && (
                          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-base font-extrabold text-destructive">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <p>
                              Please select a closing date that comes after the opening date.
                            </p>
                          </div>
                        )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-foreground font-extrabold max-w-lg mx-auto leading-relaxed">
                    No active school year has been set for the system. Prepare a
                    draft school year below to begin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>



          {/* Automated Sectioning Rules */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                  <Workflow className="h-5 w-5" />
                </div>
                Automated Sectioning Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                <div className="flex flex-col gap-4 rounded-lg border p-4 shadow-sm md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Top Basic Education Curriculum (BEC) Sectioning</Label>
                      <p className="text-base text-foreground">Group top-performing learners into dedicated sections based on General Average.</p>
                    </div>
                    <Switch
                      checked={localAlgorithmState.enableHomogeneousSections}
                      onCheckedChange={(checked) => setLocalAlgorithmState(prev => ({ ...prev, enableHomogeneousSections: checked }))}
                      disabled={isArchived}
                    />
                  </div>
                  {localAlgorithmState.enableHomogeneousSections && (
                    <div className="mt-4 ml-8 pl-6 border-l-2 border-border animate-in fade-in slide-in-from-top-1">
                      <div className="max-w-xs space-y-2">
                        <Label>Number of Top BEC Sections</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="5"
                          className="h-10 py-2 px-3 font-bold"
                          value={localAlgorithmState.homogeneousSectionCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              setLocalAlgorithmState(prev => ({ ...prev, homogeneousSectionCount: val }));
                            }
                          }}
                          disabled={isArchived}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Standard BEC Sectioning (Heterogeneous)</Label>
                      <p className="text-base text-foreground">Evenly distribute remaining learners to ensure balanced sections.</p>
                    </div>
                    <Switch
                      checked={localAlgorithmState.heterogeneousRoundRobin}
                      onCheckedChange={(checked) => setLocalAlgorithmState(prev => ({ ...prev, heterogeneousRoundRobin: checked }))}
                      disabled={isArchived}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {archivedYears.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                    <Archive className="h-5 w-5" />
                  </div>
                  School Year Archive
                </CardTitle>
                <CardDescription>
                  Historical years are kept for audit and reporting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto w-full -mx-4 px-4 sm:mx-0 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center uppercase font-extrabold">School Year</TableHead>
                        <TableHead className="text-center uppercase font-extrabold">
                          Beginning of School Year (BOSY)
                        </TableHead>
                        <TableHead className="text-center uppercase font-extrabold">
                          End of School Year (EOSY)
                        </TableHead>
                        <TableHead className="text-center uppercase font-extrabold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedYears.map((year) => (
                        <TableRow key={year.id}>
                          <TableCell className="text-center uppercase font-extrabold whitespace-nowrap">
                            S.Y. {year.yearLabel}
                          </TableCell>
                          <TableCell className="text-center uppercase font-extrabold whitespace-nowrap">
                            {formatManilaDate(year.classOpeningDate)}
                          </TableCell>
                          <TableCell className="text-center uppercase font-extrabold whitespace-nowrap">
                            {formatManilaDate(year.classEndDate)}
                          </TableCell>
                          <TableCell className="text-center uppercase font-extrabold whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className="gap-1 border-slate-300 text-slate-700 bg-slate-100">
                              Archived
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}




        </>
      ) : null}

      <Dialog
        open={showNextForm}
        onOpenChange={(open) => {
          if (open) {
            setShowNextForm(true);
            return;
          }

          requestCloseNextForm();
        }}>
        <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarIcon className="h-5 w-5" />
              Configure Inaugural Academic Year: {editYearLabel}
            </DialogTitle>
            <DialogDescription>
              Set the official start and end dates for the system's first active school year.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 relative">
                <Label htmlFor="rolloverYearLabel">School Year Label</Label>
                <div className="relative group">
                  <Input
                    id="rolloverYearLabel"
                    value={editYearLabel ? `S.Y. ${editYearLabel}` : ""}
                    readOnly
                    className="font-extrabold bg/50 cursor-not-allowed pl-9"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground opacity-50" />
                </div>
                <p className="text-sm text-foreground font-extrabold">
                  Auto-generated based on selected dates
                </p>
                {isLabelTaken && (
                  <p className="text-sm font-extrabold text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />A school year with this
                    label already exists.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Start of Classes (BOSY)</Label>
                <DatePicker
                  date={editClassOpening}
                  setDate={handleClassOpeningChange}
                  timeZone={MANILA_TIME_ZONE}
                  minDate={openingMinDate}
                  maxDate={openingMaxDate}
                  className="font-extrabold"
                />
              </div>
              <div className="space-y-2">
                <Label>End of School Year (EOSY)</Label>
                <DatePicker
                  date={editClassEnd}
                  setDate={handleClassEndChange}
                  timeZone={MANILA_TIME_ZONE}
                  minDate={classEndMinDate}
                  maxDate={classEndMaxDate}
                  className="font-extrabold"
                />
              </div>
            </div>

            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-4">
              <div className="flex items-center gap-2 text-destructive font-extrabold text-sm  uppercase">
                <AlertTriangle className="h-4 w-4" />
                System Activation
              </div>
              <p className="text-base font-extrabold leading-relaxed">
                Activating this school year will open the enrollment lifecycle and lock these foundation dates into the database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="font-extrabold"
                onClick={requestCloseNextForm}>
                Cancel
              </Button>
              <Button
                onClick={handleActivateNext}
                className={cn(
                  "font-extrabold transition-all shadow-md border-none",
                  "bg-[#800000] hover:bg-[#600000] text-white",
                )}
                disabled={
                  creating ||
                  !editYearLabel.trim() ||
                  !editClassOpening ||
                  !editClassEnd ||
                  isLabelTaken
                }>
                {creating ? "Activating..." : `Activate SY ${editYearLabel}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Phase Shift Confirmation Modal */}
      <ConfirmationModal
        open={showPhaseModal}
        onOpenChange={setShowPhaseModal}
        title={
          selectedPhase === "OFFICIAL_ENROLLMENT"
            ? "Open Regular Enrollment Period?"
            : selectedPhase === "CLASSES_ONGOING"
              ? "Close Regular Enrollment & Tag Late Enrollees?"
              : selectedPhase === "EOSY_CLOSING"
                ? "Close School Year & Begin EOSY Updating?"
                : "Confirm Phase Shift"
        }
        variant="primary"
        confirmClassName="bg-primary text-primary-foreground"
        description={
          <span className="block font-bold text-foreground space-y-4 text-base">
            {selectedPhase === "OFFICIAL_ENROLLMENT" && (
              <>
                <p>You are about to open the official enrollment portals for School Year {activeYear?.yearLabel || "2026–2027"}.</p>
                <p>Confirming this activates encoding for incoming Grade 7, Transferees, and Balik-Aral learners. The system will begin staging learner profiles for Beginning of School Year (BOSY) LIS tagging.</p>
              </>
            )}
            {selectedPhase === "CLASSES_ONGOING" && (
              <>
                <p>You are officially closing the regular enrollment window to mark the start of ongoing classes.</p>
                <p>Public online enrollment closes at this phase. Authorized staff may still encode approved late enrollees through the Learner Enrollment workspace.</p>
              </>
            )}
            {selectedPhase === "EOSY_CLOSING" && (
              <>
                <p>You are officially closing School Year {activeYear?.yearLabel || "2026–2027"} to begin End of School Year (EOSY) finalization.</p>
                <p>This locks enrollment changes across Grades 7 to 10. SMART remains the source of final grades and promotion outcomes, while authorized EnrollPro staff verify synchronized results and record the required school forms.</p>
              </>
            )}
          </span>
        }
        footerWarning={
          selectedPhase === "CLASSES_ONGOING"
            ? "LIS POLICY: Reverting a Late Enrollee timestamp requires an overriding Administrative pass."
            : selectedPhase === "EOSY_CLOSING"
              ? "CRITICAL LIS POLICY: Do not proceed until SMART has published complete final outcomes for every active learner."
              : undefined
        }
        cancelText={
          selectedPhase === "OFFICIAL_ENROLLMENT"
            ? "Keep Enrollment Closed"
            : selectedPhase === "CLASSES_ONGOING"
              ? "Keep Regular Enrollment Open"
              : selectedPhase === "EOSY_CLOSING"
                ? "Keep School Year Active"
                : "Cancel"
        }
        confirmText={
          selectedPhase === "OFFICIAL_ENROLLMENT"
            ? "Open Regular Enrollment"
            : selectedPhase === "CLASSES_ONGOING"
              ? "Begin Classes & Tag Late Enrollees"
              : selectedPhase === "EOSY_CLOSING"
                ? "Lock System for EOSY Updating"
                : "Confirm"
        }
        loading={isSubmittingConfig}
        onConfirm={executeSaveConfiguration}
      />
      
      {/* Global Sticky Footer */}
      {!isArchived && isDirty && (
        <UnsavedChangesBar
          isSubmitting={isSubmittingConfig}
          onDiscard={handleDiscardChanges}
          onSave={handleSaveConfigurationBtn}
          saveLabel="Save Configuration"
          changesList={unsavedChangesList}
        />
      )}
    </fieldset>
  );
}

