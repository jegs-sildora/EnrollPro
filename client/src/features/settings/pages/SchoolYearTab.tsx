import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { sileo } from "sileo";
import { AnimatePresence, motion } from "motion/react";
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
import { useSettingsStore } from "@/store/settings.slice";
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
import { Checkbox } from "@/shared/ui/checkbox";
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
import {
  LoaderCore,
  type LoadingState as MultiStepLoadingState,
} from "@/components/ui/multi-step-loader";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

import SystemRolloverModal from "../components/SystemRolloverModal";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

const MANILA_TIME_ZONE = "Asia/Manila";


const ROLLOVER_LOADING_STATES: MultiStepLoadingState[] = [
  { text: "Validating EOSY completion and confirming the approved school calendar." },
  {
    text: "Archiving the current school-year record and locking audit history.",
  },
  {
    text: "Preparing the next school-year timeline, enrollment windows, and registrar controls.",
  },
  {
    text: "Applying rollover options for structure cloning and continuing-learner carryover.",
  },
  { text: "Refreshing active school-year context across connected modules." },
];

const ROLLOVER_CLOSE_COUNTDOWN_SECONDS = 5;

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

function lastSaturdayOfJanuary(year: number) {
  let currentDate = utcNoonDate(year, 0, 31);
  while (currentDate.getUTCDay() !== 6) {
    currentDate = subUtcDays(currentDate, 1);
  }
  return currentDate;
}

function lastFridayOfFebruary(year: number) {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  let currentDate = utcNoonDate(year, 1, isLeapYear ? 29 : 28);
  while (currentDate.getUTCDay() !== 5) {
    currentDate = subUtcDays(currentDate, 1);
  }
  return currentDate;
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
    earlyRegOpenDate: lastSaturdayOfJanuary(startYear),
    earlyRegCloseDate: lastFridayOfFebruary(startYear),
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

  if (todayToken > endToken) {
    return { label: " ENROLLMENT CLOSED", color: "bg-slate-100 text-slate-800" };
  }

  return {
    label: ` ENROLLMENT OPEN`,
    color: "bg-green-100 text-green-800",
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
  _count: {
    sections: number;
    gradeLevels: number;
    earlyRegistrationApplications: number;
    enrollmentApplications: number;
    enrollmentRecords: number;
  };
  sections?: { id: number }[];
}

interface Defaults {
  yearLabel: string;
  classOpeningDate: string;
  classEndDate: string;
  earlyRegOpenDate: string;
  earlyRegCloseDate: string;
  enrollOpenDate: string;
  enrollCloseDate: string;
}

interface RolloverSummary {
  processedRecords: number;
  createdApplications: number;
  skippedByEosyOutcome: number;
  skippedNoTargetGrade: number;
  skippedExistingApplications: number;
  skippedDuplicateRecords: number;
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
  const location = useLocation();
  const {
    setSettings,
    activeSchoolYearId,
    systemPhase,
    enableHomogeneousSections,
    homogeneousSectionCount,
    heterogeneousRoundRobin
  } = useSettingsStore();
  const [years, setYears] = useState<SYItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  // Create state
  const [creating, setCreating] = useState(false);
  const [updatingAlgorithm, setUpdatingAlgorithm] = useState(false);
  const [updatingDraft, setUpdatingDraft] = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [isRolloverLoaderOpen, setIsRolloverLoaderOpen] = useState(false);
  const [rolloverLoaderStep, setRolloverLoaderStep] = useState(0);
  const [isRolloverFinishing, setIsRolloverFinishing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [rolloverDraftBaseline, setRolloverDraftBaseline] =
    useState<RolloverDraftSnapshot | null>(null);
  const pendingSuccessToastRef = useRef<(() => void) | null>(null);

  // Phase Shift State
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [isUpdatingPhase, setIsUpdatingPhase] = useState(false);

  // Editable fields for setup
  const [editYearLabel, setYearLabel] = useState("");
  const [editClassOpening, setClassOpening] = useState<Date | undefined>();
  const [editClassEnd, setClassEnd] = useState<Date | undefined>();

  const [rolloverOptions, setRolloverOptions] = useState({
    cloneStructure: true,
    carryOverLearners: true,
  });

  // Activation & Legal state
  const [isAgreedToActivation, setIsAgreedToActivation] = useState(false);
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
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();

    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  const handleUpdateAlgorithm = async (
    updates: Partial<{
      enableHomogeneousSections: boolean;
      homogeneousSectionCount: number;
      heterogeneousRoundRobin: boolean;
    }>
  ) => {
    setUpdatingAlgorithm(true);
    try {
      const payload = {
        enableHomogeneousSections,
        homogeneousSectionCount,
        heterogeneousRoundRobin,
        ...updates,
      };
      const res = await api.patch("/settings/algorithm", payload);
      setSettings({
        enableHomogeneousSections: res.data.enableHomogeneousSections,
        homogeneousSectionCount: res.data.homogeneousSectionCount,
        heterogeneousRoundRobin: res.data.heterogeneousRoundRobin,
      });
      sileo.success({
        title: "Algorithm Updated",
        description: "Sectioning rules saved successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setUpdatingAlgorithm(false);
    }
  };


  useEffect(() => {
    // Check for bridge state
    if (location.state?.highlightUpcoming) {
      // Small delay to ensure data is fetched and form is ready
      const timer = setTimeout(() => {
        handlePrepareRollover();
        // Clear state to prevent re-triggering on manual tab changes
        window.history.replaceState({}, document.title);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

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
    if (activeSchoolYearId) {
      const match = years.find((y) => y.id === activeSchoolYearId);
      if (match) return match;
    }

    // Fallback 1: Explicit operational statuses
    const OPERATIONAL_STATUSES = [
      "ACTIVE",
      "BOSY_LOCKED",
      "ENROLLMENT_OPEN",
      "EOSY_PROCESSING",
      "PREPARATION",
    ];
    const statusMatch = years.find((y) =>
      OPERATIONAL_STATUSES.includes(y.status),
    );
    if (statusMatch) return statusMatch;

    // Fallback 2: Any non-archived, non-draft record
    return years.find((y) => y.status !== "ARCHIVED" && y.status !== "DRAFT");
  }, [years, activeSchoolYearId]);

  const draftYear = useMemo(() => {
    // Find a year explicitly marked as DRAFT
    const draft = years.find((y) => y.status === "DRAFT");
    if (draft) return draft;

    // If we have an active year, check if there's a different year marked as UPCOMING
    if (activeYear) {
      return years.find(
        (y) => y.status === "UPCOMING" && y.id !== activeYear.id,
      );
    }

    return undefined;
  }, [years, activeYear]);

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
        term4Start: (activeYear as any).term4Start ? (activeYear as any).term4Start.split('T')[0] : "",
        term4End: (activeYear as any).term4End ? (activeYear as any).term4End.split('T')[0] : "",
        enrollOpenDate: activeYear.enrollOpenDate ? activeYear.enrollOpenDate.split('T')[0] : "",
        enrollCloseDate: activeYear.enrollCloseDate ? activeYear.enrollCloseDate.split('T')[0] : "",
      });
    }
  }, [activeYear]);

  const isCalendarChanged = useMemo(() => {
    if (!activeYear) return false;
    const getVal = (val: any) => val ? val.split('T')[0] : "";
    return (
      localCalendarState.termFormat !== (activeYear.termFormat ?? "TRIMESTER") ||
      localCalendarState.term1Start !== getVal(activeYear.term1Start) ||
      localCalendarState.term1End !== getVal(activeYear.term1End) ||
      localCalendarState.term2Start !== getVal(activeYear.term2Start) ||
      localCalendarState.term2End !== getVal(activeYear.term2End) ||
      localCalendarState.term3Start !== getVal(activeYear.term3Start) ||
      localCalendarState.term3End !== getVal(activeYear.term3End) ||
      localCalendarState.term4Start !== getVal((activeYear as any).term4Start) ||
      localCalendarState.term4End !== getVal((activeYear as any).term4End) ||
      localCalendarState.enrollOpenDate !== getVal(activeYear.enrollOpenDate) ||
      localCalendarState.enrollCloseDate !== getVal(activeYear.enrollCloseDate)
    );
  }, [localCalendarState, activeYear]);

  const isRolloverReady = Boolean(activeYear?.isEosyFinalized) || systemPhase === "EOSY_CLOSING";

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
    // Draft can be re-saved with its own label
    return years.some(
      (y) => y.yearLabel.toLowerCase() === label && y.status !== "DRAFT",
    );
  }, [editYearLabel, years]);



  const enrollmentPhaseStatus = useMemo(
    () =>
      getEnrollmentWindowStatus(
        activeYear?.enrollOpenDate ?? null,
        activeYear?.enrollCloseDate ?? null,
      ),
    [activeYear?.enrollCloseDate, activeYear?.enrollOpenDate],
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


  const handleUpdateRolloverDraft = () => {
    if (!editClassOpening || !editClassEnd) {
      sileo.error({
        title: "Missing dates",
        description:
          "Select both Start of Classes (BOSY) and End of School Year (EOSY).",
      });
      return;
    }

    if (!isRolloverDraftChanged) {
      sileo.info({
        title: "No draft changes",
        description: "Update any field before saving.",
      });
      return;
    }

    const submit = async () => {
      setUpdatingDraft(true);
      try {
        const response = await api.post("/school-years/rollover-draft", {
          yearLabel: editYearLabel.trim(),
          classOpeningDate: editClassOpening.toISOString(),
          classEndDate: editClassEnd.toISOString(),
        });

        const rolloverDraft = response.data.rolloverDraft as SYItem;

        const normalizedOpeningDate = normalizeDateToManila(
          new Date(rolloverDraft.classOpeningDate!),
        );
        const normalizedClassEndDate = normalizeDateToManila(
          new Date(rolloverDraft.classEndDate!),
        );

        setYearLabel(rolloverDraft.yearLabel);
        setClassOpening(normalizedOpeningDate);
        setClassEnd(normalizedClassEndDate);
        setRolloverDraftBaseline({
          yearLabel: rolloverDraft.yearLabel,
          classOpeningDate: normalizedOpeningDate.toISOString(),
          classEndDate: normalizedClassEndDate.toISOString(),
        });

        sileo.success({
          title: "Draft saved",
          description: "School year draft and BOSY/EOSY dates were saved.",
        });
        fetchData();
      } catch (err) {
        toastApiError(err as never);
      } finally {
        setUpdatingDraft(false);
      }
    };

    void submit();
  };

  const handleActivateNext = async () => {
    if (activeYear && !isRolloverReady) {
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

    const isRolloverFlow = Boolean(activeYear);

    setCreating(true);
    if (isRolloverFlow) {
      setRolloverLoaderStep(0);
      setIsRolloverFinishing(false);
      setIsRolloverLoaderOpen(true);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const derivedSchedule = buildSchoolYearSchedule(
        editClassOpening,
        editClassEnd,
      );
      const resolvedYearLabel =
        editYearLabel.trim() || derivedSchedule.yearLabel;

      const activationPayload = {
        yearLabel: resolvedYearLabel,
        classOpeningDate: derivedSchedule.classOpeningDate.toISOString(),
        classEndDate: derivedSchedule.classEndDate.toISOString(),
        earlyRegOpenDate: derivedSchedule.earlyRegOpenDate.toISOString(),
        earlyRegCloseDate: derivedSchedule.earlyRegCloseDate.toISOString(),
        enrollOpenDate: derivedSchedule.enrollOpenDate.toISOString(),
        enrollCloseDate: derivedSchedule.enrollCloseDate.toISOString(),
      };

      const requestPath = activeYear
        ? "/school-years/rollover"
        : "/school-years/activate";
      const requestPayload = activeYear
        ? {
          yearLabel: activationPayload.yearLabel,
          classOpeningDate: activationPayload.classOpeningDate,
          classEndDate: activationPayload.classEndDate,
          cloneStructure: rolloverOptions.cloneStructure,
          carryOverLearners: rolloverOptions.carryOverLearners,
        }
        : {
          ...activationPayload,
          cloneFromId: null,
        };

      if (isRolloverFlow) {
        setRolloverLoaderStep(1);
      }

      const res = await api.post(requestPath, requestPayload);

      if (isRolloverFlow) {
        setRolloverLoaderStep(2);
      }

      const rolloverSummary =
        (res.data.rolloverSummary as RolloverSummary | null | undefined) ??
        null;

      setSettings({
        activeSchoolYearId: res.data.year.id,
        activeSchoolYearLabel: res.data.year.yearLabel,
      });

      if (isRolloverFlow) {
        setRolloverLoaderStep(3);
      }

      const successDescription = activeYear
        ? rolloverSummary
          ? `School Year ${res.data.year.yearLabel} is now active. ${rolloverSummary.createdApplications} learner application(s) were carried over.`
          : `School Year ${res.data.year.yearLabel} is now active.`
        : `School Year ${res.data.year.yearLabel} is now active.`;

      if (isRolloverFlow) {
        pendingSuccessToastRef.current = () => {
          sileo.success({
            title: activeYear ? "Rollover Completed" : "School Year Activated",
            description: successDescription,
          });
        };
      } else {
        sileo.success({
          title: activeYear ? "Rollover Completed" : "School Year Activated",
          description: successDescription,
        });
      }

      setShowNextForm(false);
      setRolloverDraftBaseline(null);

      if (isRolloverFlow) {
        setRolloverLoaderStep(4);
      }

      await fetchData();

      if (isRolloverFlow) {
        setIsRolloverFinishing(true);
        await new Promise((resolve) =>
          setTimeout(resolve, ROLLOVER_CLOSE_COUNTDOWN_SECONDS * 1000),
        );
      }
    } catch (err) {
      pendingSuccessToastRef.current = null;
      toastApiError(err as never);
    } finally {
      setCreating(false);
      if (isRolloverFlow) {
        setIsRolloverLoaderOpen(false);
        setIsRolloverFinishing(false);
        if (!prefersReducedMotion) {
          await new Promise((resolve) => setTimeout(resolve, 420));
        }
        pendingSuccessToastRef.current?.();
        pendingSuccessToastRef.current = null;
        setRolloverLoaderStep(0);
      }
    }
  };

  const handlePrepareRollover = () => {
    if (activeYear) {
      const activeOpeningDate = activeYear.classOpeningDate
        ? normalizeDateToManila(new Date(activeYear.classOpeningDate))
        : undefined;
      const parsedStartYear = parseStartYearFromLabel(activeYear.yearLabel);

      const nextStartYear = activeOpeningDate
        ? activeOpeningDate.getUTCFullYear() + 1
        : parsedStartYear
          ? parsedStartYear + 1
          : null;

      if (activeOpeningDate && nextStartYear) {
        const classEndTemplate = activeYear.classEndDate
          ? normalizeDateToManila(new Date(activeYear.classEndDate))
          : undefined;

        const nextOpeningDate = utcNoonDate(
          nextStartYear,
          activeOpeningDate.getUTCMonth(),
          activeOpeningDate.getUTCDate(),
        );

        const nextSchedule = buildSchoolYearSchedule(
          nextOpeningDate,
          classEndTemplate,
        );
        setYearLabel(nextSchedule.yearLabel);
        setClassOpening(nextSchedule.classOpeningDate);
        setClassEnd(nextSchedule.classEndDate);
        setRolloverDraftBaseline({
          yearLabel: nextSchedule.yearLabel,
          classOpeningDate: nextSchedule.classOpeningDate.toISOString(),
          classEndDate: nextSchedule.classEndDate.toISOString(),
        });
      }
    } else if (editClassOpening && editClassEnd) {
      // First time initialization
      setRolloverDraftBaseline({
        yearLabel: editYearLabel.trim(),
        classOpeningDate: editClassOpening.toISOString(),
        classEndDate: editClassEnd.toISOString(),
      });
    }

    setShowNextForm(true);
  };

  const handleSaveCalendarSettings = async () => {
    if (!activeYear) return;
    setIsUpdatingTimeline(true);
    try {
      const payload: Record<string, string> = { ...localCalendarState };
      // Map back to classOpeningDate and classEndDate if needed, but our backend handles termDates now.
      // Wait, we need to ensure classOpeningDate is term1Start, and classEndDate is the last term's end date.
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
      sileo.success({
        title: "Calendar Settings Saved",
        description: "The calendar settings have been successfully updated.",
      });
      await fetchData();
      const pubRes = await api.get("/settings/public");
      setSettings({ enrollmentPhase: pubRes.data.enrollmentPhase });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsUpdatingTimeline(false);
    }
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
    <div className="space-y-6 relative">
      <AnimatePresence>
        {isRolloverLoaderOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] flex min-h-dvh w-screen items-center justify-center overflow-hidden bg-white/75 backdrop-blur-2xl"
            role="status"
            aria-live="polite"
            aria-label="Running school year rollover"
          >
            <div className="absolute inset-0 pointer-events-none">
              <svg
                aria-hidden="true"
                className="h-full w-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <pattern
                    id="school-year-rollover-pixel-grid"
                    x="0"
                    y="0"
                    width="80"
                    height="80"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.12)"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="42"
                      y="2"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.1)"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="2"
                      y="42"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.09)"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="42"
                      y="42"
                      width="36"
                      height="36"
                      rx="6"
                      fill="none"
                      stroke="rgba(128,0,0,0.11)"
                      strokeWidth="1.1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#school-year-rollover-pixel-grid)" />
              </svg>
            </div>

            <div className="relative z-10 w-full max-w-3xl px-6">
              <div className="text-center mb-5">
                <h3 className="text-md font-extrabold text-foreground uppercase">
                  Processing School Year Rollover
                </h3>
                <p className="text-md font-extrabold text-foreground">
                  Please keep this window open while records are being updated.
                </p>
              </div>
              <LoaderCore
                loadingStates={ROLLOVER_LOADING_STATES}
                value={rolloverLoaderStep}
                showCompletionMessage={isRolloverFinishing}
                completionCountdownSeconds={ROLLOVER_CLOSE_COUNTDOWN_SECONDS}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {!loading && isZeroState ? (
        <Card className="shadow-lg bg-white">
          <CardContent className="pt-12 pb-14 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-200">
              <School className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-extrabold  mb-3 text-foreground uppercase">
              Active School Year Required
            </h3>
            <p className="text-foreground font-extrabold max-w-lg mb-8 leading-relaxed">
              Before the system can process official enrollments, accept Early
              Registration data, or generate School Form 1 (SF1) masterlists, a
              primary academic year must be established.
            </p>
            <Button
              size="lg"
              className="font-extrabold shadow-md bg-[#800000] hover:bg-[#600000] text-white border-none"
              onClick={handlePrepareRollover}>
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
                      <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                      <div>
                        {activeYear ? (
                          <>Current School Year: {activeYear.yearLabel}</>
                        ) : (
                          <>No Active School Year</>
                        )}
                      </div>
                    </CardTitle>
                  </div>
                </div>

                {activeYear && activeYear._count?.sections > 0 && activeYear.sections?.length === 0 && (
                  <div className="flex flex-col items-end w-full lg:w-auto mt-2 lg:mt-0">
                    <SystemRolloverModal disabled={false} activeYearLabel={activeYear.yearLabel} />
                  </div>
                )}
              </div>

              {activeYear ? (
                <div className="space-y-6">
                  {/* System Academic Phase */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-lg text-foreground uppercase tracking-wide">
                            System Academic Phase
                          </h4>
                        </div>
                        <p className="text-base font-bold text-foreground rounded-md inline-block">
                          Control the current phase of the academic year. This affects how late enrollments are processed.
                        </p>
                      </div>
                    </div>
                    <RadioGroup
                      value={selectedPhase ?? systemPhase ?? "OFFICIAL_ENROLLMENT"}
                      onValueChange={(value: string) => setSelectedPhase(value)}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                      <Label
                        htmlFor="OFFICIAL_ENROLLMENT"
                        className="group relative flex flex-col cursor-pointer rounded-lg border-2 border-border bg-white p-4 transition-colors hover:border-primary/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                      >
                        <RadioGroupItem value="OFFICIAL_ENROLLMENT" id="OFFICIAL_ENROLLMENT" className="sr-only" />
                        <span className="font-extrabold text-foreground mb-1 block group-[&:has([data-state=checked])]:text-primary">Official Enrollment</span>
                        <span className="text-sm font-bold text-foreground block group-[&:has([data-state=checked])]:text-primary">Opens the public enrollment forms and processes normal verify/confirm workflows.</span>
                      </Label>
                      <Label
                        htmlFor="CLASSES_ONGOING"
                        className="group relative flex flex-col cursor-pointer rounded-lg border-2 border-border bg-white p-4 transition-colors hover:border-primary/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                      >
                        <RadioGroupItem value="CLASSES_ONGOING" id="CLASSES_ONGOING" className="sr-only" />
                        <span className="font-extrabold text-foreground mb-1 block group-[&:has([data-state=checked])]:text-primary">Classes Ongoing (Late)</span>
                        <span className="text-sm font-bold text-foreground block group-[&:has([data-state=checked])]:text-primary">Public forms remain open, but all new submissions are permanently tagged as Late Enrollees.</span>
                      </Label>
                      <Label
                        htmlFor="EOSY_CLOSING"
                        className="group relative flex flex-col cursor-pointer rounded-lg border-2 border-border bg-white p-4 transition-colors hover:border-primary/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                      >
                        <RadioGroupItem value="EOSY_CLOSING" id="EOSY_CLOSING" className="sr-only" />
                        <span className="font-extrabold text-foreground mb-1 block group-[&:has([data-state=checked])]:text-primary">EOSY Closing</span>
                        <span className="text-sm font-bold text-foreground block group-[&:has([data-state=checked])]:text-primary">Locks public enrollment forms and readies the database for end-of-year grade finalization.</span>
                      </Label>
                    </RadioGroup>

                    {selectedPhase && selectedPhase !== systemPhase && (
                      <div className="mt-6 flex justify-end">
                        <Button
                          onClick={() => setShowPhaseModal(true)}
                          className="w-full sm:w-auto"
                        >
                          Apply Phase Change
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Term Format Selection */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <h4 className="font-extrabold text-base text-foreground uppercase tracking-wide">
                        DepEd Term Configuration
                      </h4>
                    </div>
                    <RadioGroup
                      value={localCalendarState.termFormat ?? activeYear.termFormat ?? "TRIMESTER"}
                      onValueChange={(value: string) => {
                        setLocalCalendarState(prev => ({ ...prev, termFormat: value }));
                      }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >
                      <Label
                        htmlFor="TRIMESTER"
                        className="group relative flex flex-col justify-center cursor-pointer rounded-lg border-2 border-border bg-white p-4 transition-colors hover:border-primary/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                      >
                        <RadioGroupItem value="TRIMESTER" id="TRIMESTER" className="sr-only" />
                        <span className="font-extrabold text-foreground block group-[&:has([data-state=checked])]:text-primary">3-Term System</span>
                        <span className="text-sm font-bold text-foreground mt-1 block group-[&:has([data-state=checked])]:text-primary">Mandated DO 9, s. 2026</span>
                      </Label>
                      <Label
                        htmlFor="QUARTERS"
                        className="group relative flex flex-col justify-center cursor-pointer rounded-lg border-2 border-border bg-white p-4 transition-colors hover:border-primary/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                      >
                        <RadioGroupItem value="QUARTERS" id="QUARTERS" className="sr-only" />
                        <span className="font-extrabold text-foreground block group-[&:has([data-state=checked])]:text-primary">4-Quarter System</span>
                        <span className="text-sm font-bold text-foreground mt-1 block group-[&:has([data-state=checked])]:text-primary">Traditional academic calendar</span>
                      </Label>
                    </RadioGroup>
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
                    ].map((term) => (
                      <div key={term.num} className="flex flex-col sm:flex-row items-center gap-4 bg/20 p-4 rounded-xl border border-border/40">
                        <div className="w-24 shrink-0 font-extrabold text-primary">{term.label}</div>
                        <div className="flex items-center gap-3 flex-1 w-full">
                          <div className="flex-1 px-4 py-2 bg-white rounded-lg border border-border shadow-sm relative">
                            <div className="text-sm font-semibold text-foreground uppercase mb-0.5">Start Date</div>
                            <HybridDatePicker
                              value={term.start || ""}
                              onChange={(val) => {
                                setLocalCalendarState(prev => ({ ...prev, [term.startField]: val || "" }));
                              }}
                              className="border-none shadow-none p-0 h-auto font-extrabold text-base bg-transparent w-full"
                              placeholder="MM/DD/YYYY"
                            />
                          </div>
                          <span className="text-foreground font-extrabold">to</span>
                          <div className="flex-1 px-4 py-2 bg-white rounded-lg border border-border shadow-sm relative">
                            <div className="text-sm font-semibold text-foreground uppercase mb-0.5">End Date</div>
                            <HybridDatePicker
                              value={term.end || ""}
                              onChange={(val) => {
                                setLocalCalendarState(prev => ({ ...prev, [term.endField]: val || "" }));
                              }}
                              className="border-none shadow-none p-0 h-auto font-extrabold text-base bg-transparent w-full"
                              placeholder="MM/DD/YYYY"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>


                  {/* BOSY Enrollment Period */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-lg text-foreground uppercase tracking-wide">
                            Official Intake Period (BOSY)
                          </h4>
                        </div>
                        <p className="text-base font-bold text-foreground bg/50 px-3 py-1.5 rounded-md inline-block">
                          Set the official dates when the system will accept incoming Grade 7, Transferees, and Returning Learners for the active school year.
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-3 py-1 text-sm font-bold whitespace-nowrap rounded-full ${enrollmentPhaseStatus.color}`}>
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
                          />
                        </div>
                      </div>



                      {localCalendarState.enrollOpenDate !== "" &&
                        localCalendarState.enrollCloseDate !== "" &&
                        toManilaDateToken(localCalendarState.enrollCloseDate) < toManilaDateToken(localCalendarState.enrollOpenDate) && (
                          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-base font-extrabold text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                              Closes On date cannot be earlier than Opens On.
                            </p>
                          </div>
                        )}
                    </div>

                    {isCalendarChanged && (
                      <div className="mt-6 flex justify-end">
                        <Button
                          onClick={handleSaveCalendarSettings}
                          className="w-full sm:w-auto"
                        >
                          Save Calendar Settings
                        </Button>
                      </div>
                    )}
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
                      checked={enableHomogeneousSections}
                      onCheckedChange={(checked) => handleUpdateAlgorithm({ enableHomogeneousSections: checked })}
                      disabled={updatingAlgorithm}
                    />
                  </div>
                  {enableHomogeneousSections && (
                    <div className="mt-4 ml-8 pl-6 border-l-2 border-border animate-in fade-in slide-in-from-top-1">
                      <div className="max-w-xs space-y-2">
                        <Label>Number of Top BEC Sections</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="5"
                          className="h-10 py-2 px-3 font-bold"
                          value={homogeneousSectionCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              setSettings({ homogeneousSectionCount: val });
                            }
                          }}
                          onBlur={() => handleUpdateAlgorithm({ homogeneousSectionCount })}
                          disabled={updatingAlgorithm}
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
                      checked={heterogeneousRoundRobin}
                      onCheckedChange={(checked) => handleUpdateAlgorithm({ heterogeneousRoundRobin: checked })}
                      disabled={updatingAlgorithm}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">School Year</TableHead>
                      <TableHead className="text-left">
                        Beginning of School Year (BOSY)
                      </TableHead>
                      <TableHead className="text-left">
                        End of School Year (EOSY)
                      </TableHead>
                      <TableHead className="text-left">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedYears.map((year) => (
                      <TableRow key={year.id}>
                        <TableCell className="font-extrabold text-left">
                          S.Y. {year.yearLabel}
                        </TableCell>
                        <TableCell className="text-left">
                          {formatManilaDate(year.classOpeningDate)}
                        </TableCell>
                        <TableCell className="text-left">
                          {formatManilaDate(year.classEndDate)}
                        </TableCell>
                        <TableCell className="text-left">
                          <Badge
                            variant="outline"
                            className="gap-1 border-slate-300 text-slate-700 bg-slate-100">
                            <Lock className="h-3 w-3" />
                            Archived
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}




        </>
      ) : null}

      <Dialog
        open={showNextForm}
        onOpenChange={(open) => {
          if (isRolloverLoaderOpen) {
            return;
          }
          setShowNextForm(open);
          if (!open) {
            setRolloverDraftBaseline(null);
            setIsAgreedToActivation(false);
          }
        }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarIcon className="h-5 w-5" />
              {activeYear
                ? `Prepare School Year Rollover: ${editYearLabel}`
                : `Configure Inaugural Academic Year: ${editYearLabel}`}
            </DialogTitle>
            <DialogDescription>
              {activeYear
                ? `Create and activate the next school year from ${activeYear.yearLabel}.`
                : "Set the official start and end dates for the system's first active school year."}
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
                  <p className="text-[0.7rem] font-extrabold text-destructive flex items-center gap-1 mt-1">
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

            {activeYear && (
              <div className="p-4 border rounded-lg space-y-3">
                <p className="text-base font-extrabold">
                  Rollover options from {activeYear.yearLabel}
                </p>
                <p className="text-sm text-foreground">
                  EOSY finalization must be completed before rollover can run.
                </p>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="c1"
                      checked={rolloverOptions.cloneStructure}
                      onCheckedChange={(checked) =>
                        setRolloverOptions({
                          ...rolloverOptions,
                          cloneStructure: checked === true,
                        })
                      }
                    />
                    <label
                      htmlFor="c1"
                      className="text-base cursor-pointer select-none">
                      Clone grade levels, sections, and SCPs (Adviser
                      assignments will be wiped clean)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="c3"
                      checked={rolloverOptions.carryOverLearners}
                      onCheckedChange={(checked) =>
                        setRolloverOptions({
                          ...rolloverOptions,
                          carryOverLearners: checked === true,
                        })
                      }
                    />
                    <label
                      htmlFor="c3"
                      className="text-base cursor-pointer select-none">
                      Carry over eligible enrolled learners as continuing status
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-4">
              <div className="flex items-center gap-2 text-destructive font-extrabold text-sm  uppercase">
                <AlertTriangle className="h-4 w-4" />
                System Activation
              </div>
              <p className="text-base font-extrabold leading-relaxed">
                {activeYear
                  ? "Executing rollover will archive the current academic cycle. This action cannot be reversed."
                  : "Activating this school year will open the enrollment lifecycle and lock these foundation dates into the database."}
              </p>
              <div className="flex items-start space-x-3 pt-1">
                <Checkbox
                  id="agreed-to-activation"
                  checked={isAgreedToActivation}
                  onCheckedChange={(checked) =>
                    setIsAgreedToActivation(checked === true)
                  }
                  className="mt-1"
                />
                <label
                  htmlFor="agreed-to-activation"
                  className="text-base font-extrabold leading-tight cursor-pointer select-none">
                  I confirm that these dates align with the official DepEd
                  School Calendar Memorandum and I am authorized to activate the
                  system.
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="font-extrabold"
                onClick={() => {
                  if (isRolloverLoaderOpen) {
                    return;
                  }
                  setShowNextForm(false);
                  setRolloverDraftBaseline(null);
                }}
                disabled={isRolloverLoaderOpen}>
                Cancel
              </Button>
              {activeYear && (
                <Button
                  variant="default"
                  className="font-extrabold"
                  onClick={handleUpdateRolloverDraft}
                  disabled={
                    creating ||
                    updatingDraft ||
                    isRolloverLoaderOpen ||
                    !editYearLabel.trim() ||
                    !editClassOpening ||
                    !editClassEnd ||
                    !isRolloverDraftChanged ||
                    isLabelTaken
                  }>
                  {updatingDraft ? "Updating..." : "Save Draft"}
                </Button>
              )}
              <Button
                onClick={handleActivateNext}
                className={cn(
                  "font-extrabold transition-all shadow-md border-none",
                  isAgreedToActivation
                    ? "bg-[#800000] hover:bg-[#600000] text-white"
                    : "bg text-foreground grayscale",
                )}
                disabled={
                  creating ||
                  updatingDraft ||
                  isRolloverLoaderOpen ||
                  !editYearLabel.trim() ||
                  !editClassOpening ||
                  !editClassEnd ||
                  isLabelTaken ||
                  !isAgreedToActivation ||
                  (activeYear && !isRolloverReady)
                }>
                {creating
                  ? activeYear
                    ? "Running rollover..."
                    : "Activating..."
                  : activeYear
                    ? "Execute School Year Rollover"
                    : `Activate SY ${editYearLabel}`}
              </Button>
            </div>
            {activeYear && !isRolloverReady && (
              <div className="flex items-center justify-end gap-1 text-sm font-extrabold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Waiting for EOSY Finalization.</span>
              </div>
            )}
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
          <span className="block text-left text-foreground space-y-4">
            {selectedPhase === "OFFICIAL_ENROLLMENT" && (
              <>
                <p>You are about to open the official enrollment portals for School Year {activeYear?.yearLabel || "2026–2027"}.</p>
                <p>Confirming this activates encoding for incoming Grade 7, Transferees, and Balik-Aral learners. The system will begin staging learner profiles for Beginning of School Year (BOSY) LIS tagging.</p>
              </>
            )}
            {selectedPhase === "CLASSES_ONGOING" && (
              <>
                <p>You are officially closing the regular enrollment window to mark the start of ongoing classes.</p>
                <p>The public forms will remain open, but all learners encoded after today will be permanently flagged as "Late Enrollees" for BOSY LIS reporting.</p>
              </>
            )}
            {selectedPhase === "EOSY_CLOSING" && (
              <>
                <p>You are officially closing School Year {activeYear?.yearLabel || "2026–2027"} to begin End of School Year (EOSY) finalization.</p>
                <p>This locks all active class rolls across Grades 7 to 10. Class advisers will no longer be able to encode learner transfers or update profile details, allowing the administration to safely finalize promotional statuses and general averages.</p>
              </>
            )}
          </span>
        }
        footerWarning={
          selectedPhase === "CLASSES_ONGOING"
            ? "LIS POLICY: Reverting a Late Enrollee timestamp requires an overriding Administrative pass."
            : selectedPhase === "EOSY_CLOSING"
              ? "CRITICAL LIS POLICY: Do not proceed until all class advisers have finalized their SMART electronic class records."
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
        loading={isUpdatingPhase}
        onConfirm={async () => {
          if (!selectedPhase) return;

          setIsUpdatingPhase(true);

          // Optimistic UI Update
          const previousPhase = systemPhase;
          setSettings({ systemPhase: selectedPhase as any });
          setShowPhaseModal(false);

          try {
            await api.patch(`/settings/phase`, { phase: selectedPhase });
            sileo.success({ title: "System phase updated", description: "The system phase has been updated successfully." });
            // Re-fetch to ensure sync with backend, but without blocking the initial UI update
            const pubRes = await api.get("/settings/public");
            setSettings({ systemPhase: pubRes.data.systemPhase });
            setSelectedPhase(null);
          } catch (err) {
            // Revert optimistic update
            setSettings({ systemPhase: previousPhase });
            toastApiError(err as never);
          } finally {
            setIsUpdatingPhase(false);
          }
        }}
      />
    </div>
  );
}

