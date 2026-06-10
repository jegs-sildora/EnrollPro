import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { sileo } from "sileo";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/shared/lib/utils";
import {
  Calendar as CalendarIcon,
  Pencil,
  AlertTriangle,
  Lock,
  Plus,
  School,
  CalendarDays,
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
  CardFooter,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
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
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import {
  LoaderCore,
  type LoadingState as MultiStepLoadingState,
} from "@/components/ui/multi-step-loader";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import ExecuteRolloverModal from "../components/ExecuteRolloverModal";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";

const MANILA_TIME_ZONE = "Asia/Manila";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

function dateTokenToUtcMillis(token: number): number {
  const year = Math.floor(token / 10000);
  const month = Math.floor((token % 10000) / 100);
  const day = token % 100;
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

function diffTokenDays(laterToken: number, earlierToken: number): number {
  const diffMs =
    dateTokenToUtcMillis(laterToken) - dateTokenToUtcMillis(earlierToken);
  return Math.max(0, Math.round(diffMs / DAY_IN_MS));
}

function getDateWindowStatus(
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
) {
  if (!openDate || !closeDate) {
    return { label: "⚫ UNSCHEDULED", color: "bg-gray-100 text-gray-700" };
  }

  const todayToken = toManilaDateToken(new Date());
  const startToken = toManilaDateToken(openDate);
  const endToken = toManilaDateToken(closeDate);

  if (todayToken < startToken) {
    const days = diffTokenDays(startToken, todayToken);
    return {
      label: `🔵 SCHEDULED (Opens in ${days} day(s))`,
      color: "bg-blue-100 text-blue-700",
    };
  }

  if (todayToken > endToken) {
    return { label: "⚫ CONCLUDED", color: "bg-slate-100 text-slate-500" };
  }

  const daysLeft = diffTokenDays(endToken, todayToken);
  return {
    label: `🟢 ACTIVE · Closes in ${daysLeft} day(s)`,
    color: "bg-green-100 text-green-700 font-bold",
  };
}

function getEnrollmentWindowStatus(
  openDate: string | null | undefined,
  closeDate: string | null | undefined,
) {
  if (!openDate || !closeDate) {
    return { label: "⚫ UNSCHEDULED", color: "bg-gray-100 text-gray-700" };
  }

  const todayToken = toManilaDateToken(new Date());
  const startToken = toManilaDateToken(openDate);
  const endToken = toManilaDateToken(closeDate);

  if (todayToken < startToken) {
    const days = diffTokenDays(startToken, todayToken);
    return {
      label: `🔵 SCHEDULED (Opens in ${days} day(s))`,
      color: "bg-blue-100 text-blue-700",
    };
  }

  if (todayToken > endToken) {
    return { label: "⚫ ENROLLMENT CLOSED", color: "bg-slate-100 text-slate-500 font-bold" };
  }

  const daysLeft = diffTokenDays(endToken, todayToken);
  return {
    label: `🟢 ENROLLMENT OPEN · Closes in ${daysLeft} day(s)`,
    color: "bg-green-100 text-green-700 font-bold",
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
    gradeLevels: number;
    earlyRegistrationApplications: number;
    enrollmentApplications: number;
    enrollmentRecords: number;
  };
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
  const { setSettings, activeSchoolYearId, systemPhase } = useSettingsStore();
  const [years, setYears] = useState<SYItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  // Create state
  const [creating, setCreating] = useState(false);
  const [updatingDraft, setUpdatingDraft] = useState(false);
  const [isRolloverLoaderOpen, setIsRolloverLoaderOpen] = useState(false);
  const [rolloverLoaderStep, setRolloverLoaderStep] = useState(0);
  const [isRolloverFinishing, setIsRolloverFinishing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [isExecuteRolloverOpen, setIsExecuteRolloverOpen] = useState(false);
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

  const isRolloverReady = Boolean(activeYear?.isEosyFinalized);

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

  const activeCalendarStatus = useMemo(
    () =>
      getDateWindowStatus(
        activeYear?.classOpeningDate ?? null,
        activeYear?.classEndDate ?? null,
      ),
    [activeYear?.classEndDate, activeYear?.classOpeningDate],
  );

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

  const handleOpenActivationConfirmFromDraft = (draft: SYItem) => {
    setYearLabel(draft.yearLabel);
    setClassOpening(
      draft.classOpeningDate
        ? normalizeDateToManila(new Date(draft.classOpeningDate))
        : undefined,
    );
    setClassEnd(
      draft.classEndDate
        ? normalizeDateToManila(new Date(draft.classEndDate))
        : undefined,
    );
    setIsAgreedToActivation(false);
    setShowNextForm(true);
  };

  const handleEditDraft = (draft: SYItem) => {
    setYearLabel(draft.yearLabel);
    const opening = draft.classOpeningDate
      ? normalizeDateToManila(new Date(draft.classOpeningDate))
      : undefined;
    const end = draft.classEndDate
      ? normalizeDateToManila(new Date(draft.classEndDate))
      : undefined;
    setClassOpening(opening);
    setClassEnd(end);
    setRolloverDraftBaseline({
      yearLabel: draft.yearLabel,
      classOpeningDate: opening?.toISOString() ?? "",
      classEndDate: end?.toISOString() ?? "",
    });
    setShowNextForm(true);
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

  const handleAutoFillTerms = async () => {
    if (!activeYear || !activeYear.classOpeningDate || !activeYear.classEndDate) {
      sileo.error({ title: "Missing Dates", description: "BOSY and EOSY must be set first." });
      return;
    }
    const start = new Date(activeYear.classOpeningDate);
    const end = new Date(activeYear.classEndDate);
    const totalDays = (end.getTime() - start.getTime()) / DAY_IN_MS;
    if (totalDays < 28) {
      sileo.error({ title: "Invalid duration", description: "School year is too short." });
      return;
    }
    
    const isTrimester = activeYear.termFormat === "TRIMESTER" || !activeYear.termFormat;
    const termCount = isTrimester ? 3 : 4;
    const termDays = Math.floor(totalDays / termCount);

    setIsUpdatingTimeline(true);
    try {
      const startYear = start.getUTCFullYear();
      const endYear = startYear + 1;
      const payload: Record<string, string | null> = {};

      if (termCount === 3) {
        payload.term1Start = new Date(Date.UTC(startYear, 5, 8, 12, 0, 0)).toISOString();
        payload.term1End = new Date(Date.UTC(startYear, 8, 15, 12, 0, 0)).toISOString();
        payload.term2Start = new Date(Date.UTC(startYear, 8, 16, 12, 0, 0)).toISOString();
        payload.term2End = new Date(Date.UTC(startYear, 11, 18, 12, 0, 0)).toISOString();
        payload.term3Start = new Date(Date.UTC(endYear, 0, 4, 12, 0, 0)).toISOString();
        payload.term3End = new Date(Date.UTC(endYear, 3, 8, 12, 0, 0)).toISOString();
        payload.term4Start = null;
        payload.term4End = null;
      } else {
        let currentStart = start;
        for (let i = 1; i <= 4; i++) {
          if (i <= termCount) {
            const isLastTerm = i === termCount;
            const currentEnd = isLastTerm ? end : addUtcDays(currentStart, termDays);
            payload[`term${i}Start`] = currentStart.toISOString();
            payload[`term${i}End`] = currentEnd.toISOString();
            currentStart = addUtcDays(currentEnd, 1);
          } else {
            payload[`term${i}Start`] = null;
            payload[`term${i}End`] = null;
          }
        }
      }

      await api.put(`/school-years/${activeYear.id}`, payload);
      sileo.success({ title: "Terms auto-filled", description: `Standard duration distributed across ${termCount} terms.` });
      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsUpdatingTimeline(false);
    }
  };

  const handleSaveTermDate = async (
    field: "term1Start" | "term1End" | "term2Start" | "term2End" | "term3Start" | "term3End" | "term4Start" | "term4End",
    date: Date,
  ) => {
    if (!activeYear) return;
    setIsUpdatingTimeline(true);
    try {
      const payload: Record<string, string> = { 
        [field]: date.toISOString() 
      };

      if (field === "term1Start") {
        payload.classOpeningDate = date.toISOString();
      }
      if (field === "term1End") {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        payload.term2Start = nextDay.toISOString();
      }
      if (field === "term2End") {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        payload.term3Start = nextDay.toISOString();
      }
      if (field === "term3End") {
        if (activeYear.termFormat === "TRIMESTER" || !activeYear.termFormat) {
          payload.classEndDate = date.toISOString();
        } else {
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          payload.term4Start = nextDay.toISOString();
        }
      }
      if (field === "term4End") {
        payload.classEndDate = date.toISOString();
      }

      await api.put(`/school-years/${activeYear.id}`, payload);
      sileo.success({
        title: "Date updated",
        description: "The quarter date has been saved.",
      });
      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsUpdatingTimeline(false);
    }
  };

  const handleSaveEnrollmentDate = async (
    field: "enrollOpenDate" | "enrollCloseDate",
    date: Date,
  ) => {
    if (!activeYear) return;
    setIsUpdatingTimeline(true);
    try {
      const payload: Record<string, any> = { 
        [field]: date.toISOString() 
      };

      await api.patch(`/school-years/${activeYear.id}/dates`, payload);
      sileo.success({
        title: "Date updated",
        description: "The enrollment date has been saved.",
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
          <CardHeader className="bg-muted border-b border-border rounded-t-lg">
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
    <div className="space-y-6 mx-auto bg-white p-6 rounded-lg shadow">
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
                <h3 className="text-md font-black text-foreground uppercase">
                  Processing School Year Rollover
                </h3>
                <p className="text-md font-bold text-foreground">
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

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold ">
            School Year Management
          </h2>
        </div>
      </div>

      {!loading && isZeroState ? (
        <Card className="shadow-lg bg-white">
          <CardContent className="pt-12 pb-14 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-200">
              <School className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-black  mb-3 text-foreground uppercase">
              Active School Year Required
            </h3>
            <p className="text-foreground font-bold max-w-lg mb-8 leading-relaxed">
              Before the system can process official enrollments, accept Early
              Registration data, or generate School Form 1 (SF1) rosters, a
              primary academic year must be established.
            </p>
            <Button
              size="lg"
              className="font-bold shadow-md bg-[#800000] hover:bg-[#600000] text-white border-none"
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
            <CardHeader
              className={cn(
                "border-b pb-4 rounded-t-lg flex flex-row items-center justify-between",
                activeYear
                  ? "bg-green-500/5 border-green-500/10"
                  : "bg-amber-500/5 border-amber-500/20",
              )}>
              <CardTitle
                className={cn(
                  "text-sm font-bold flex items-center gap-2 uppercase",
                  activeYear ? "text-green-700" : "text-amber-700",
                )}>
                {activeYear ? (
                  <>
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    School Year {activeYear.yearLabel} Configuration
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    No Active School Year
                  </>
                )}
              </CardTitle>
              {activeYear && (
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm w-fit ${activeCalendarStatus.color}`}>
                  {activeCalendarStatus.label}
                </span>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {activeYear ? (
                <div className="space-y-6">
                  {/* System Academic Phase */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg text-foreground uppercase tracking-wider">
                            System Academic Phase
                          </h4>
                        </div>
                        <p className="text-sm font-bold text-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
                          Control the current phase of the academic year. This affects how late enrollments are processed.
                        </p>
                      </div>
                    </div>
                    <RadioGroup
                      value={selectedPhase ?? systemPhase ?? "OFFICIAL_ENROLLMENT"}
                      onValueChange={(value) => setSelectedPhase(value)}
                      className="flex flex-col space-y-4"
                    >
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="OFFICIAL_ENROLLMENT" id="OFFICIAL_ENROLLMENT" className="mt-1" />
                        <div>
                          <Label htmlFor="OFFICIAL_ENROLLMENT" className="font-bold cursor-pointer text-foreground block">Official Enrollment</Label>
                          <p className="text-xs text-muted-foreground mt-1">Opens the public intake forms and processes normal verify/confirm workflows.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="CLASSES_ONGOING" id="CLASSES_ONGOING" className="mt-1" />
                        <div>
                          <Label htmlFor="CLASSES_ONGOING" className="font-bold cursor-pointer text-foreground block">Classes Ongoing (Late Enrollment)</Label>
                          <p className="text-xs text-muted-foreground mt-1">Public forms remain open, but all new submissions are permanently tagged as Late Enrollees.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="EOSY_CLOSING" id="EOSY_CLOSING" className="mt-1" />
                        <div>
                          <Label htmlFor="EOSY_CLOSING" className="font-bold cursor-pointer text-foreground block">EOSY Closing</Label>
                          <p className="text-xs text-muted-foreground mt-1">Locks public intake forms and readies the database for end-of-year grade finalization.</p>
                        </div>
                      </div>
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
                      <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
                        DepEd Term Configuration
                      </h4>
                    </div>
                    <RadioGroup
                      value={activeYear.termFormat ?? "TRIMESTER"}
                      onValueChange={async (value) => {
                        setIsUpdatingTimeline(true);
                        try {
                          await api.put(`/school-years/${activeYear.id}`, { termFormat: value });
                          sileo.success({ title: "Term format updated", description: "Term format has been updated." });
                          await fetchData();
                        } catch (err) {
                          toastApiError(err as never);
                        } finally {
                          setIsUpdatingTimeline(false);
                        }
                      }}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="TRIMESTER" id="TRIMESTER" />
                        <Label htmlFor="TRIMESTER" className="font-bold cursor-pointer text-foreground">3-Term System (Mandated DO 9, s. 2026)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="QUARTERS" id="QUARTERS" />
                        <Label htmlFor="QUARTERS" className="font-bold cursor-pointer text-foreground">4-Quarter System</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Term Date rows */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">
                        Term Dates
                      </h4>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAutoFillTerms}
                        className="font-bold text-xs"
                      >
                        Auto-Fill Standard Terms
                      </Button>
                    </div>
                    {[
                      { num: 1, label: activeYear.termFormat === "QUARTERS" ? "Quarter 1" : "Term 1", startField: "term1Start", endField: "term1End", start: activeYear.term1Start, end: activeYear.term1End },
                      { num: 2, label: activeYear.termFormat === "QUARTERS" ? "Quarter 2" : "Term 2", startField: "term2Start", endField: "term2End", start: activeYear.term2Start, end: activeYear.term2End },
                      { num: 3, label: activeYear.termFormat === "QUARTERS" ? "Quarter 3" : "Term 3", startField: "term3Start", endField: "term3End", start: activeYear.term3Start, end: activeYear.term3End },
                      ...(activeYear.termFormat === "QUARTERS" ? [{ num: 4, label: "Quarter 4", startField: "term4Start", endField: "term4End", start: (activeYear as any).term4Start, end: (activeYear as any).term4End }] : []),
                    ].map((term) => (
                        <div key={term.num} className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                          <div className="w-24 shrink-0 font-bold text-primary">{term.label}</div>
                          <div className="flex items-center gap-3 flex-1 w-full">
                              <div className="flex-1 px-4 py-2 bg-white rounded-lg border border-border shadow-sm relative">
                                <div className="text-xs font-semibold text-foreground uppercase mb-0.5">Start Date</div>
                                <HybridDatePicker
                                  value={term.start ? term.start.split('T')[0] : ""}
                                  onChange={(val) => {
                                    if (val) {
                                      const [y, m, d] = val.split('-');
                                      const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
                                      handleSaveTermDate(term.startField as Parameters<typeof handleSaveTermDate>[0], dateObj);
                                    }
                                  }}
                                  className="border-none shadow-none p-0 h-auto font-bold text-sm bg-transparent w-full"
                                  placeholder="Set date"
                                />
                              </div>
                            <span className="text-foreground font-bold">to</span>
                            <div className="flex-1 px-4 py-2 bg-white rounded-lg border border-border shadow-sm relative">
                              <div className="text-xs font-semibold text-foreground uppercase mb-0.5">End Date</div>
                              <HybridDatePicker
                                value={term.end ? term.end.split('T')[0] : ""}
                                onChange={(val) => {
                                  if (val) {
                                    const [y, m, d] = val.split('-');
                                    const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
                                    handleSaveTermDate(term.endField as Parameters<typeof handleSaveTermDate>[0], dateObj);
                                  }
                                }}
                                className="border-none shadow-none p-0 h-auto font-bold text-sm bg-transparent w-full"
                                placeholder="Set date"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  {/* Summary footer mapping to Total Academic Duration */}
                  <div className="mt-8 pt-4 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between text-muted-foreground bg-muted/10 rounded-lg p-4 mb-8">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">First Day of Classes — Last Day of Classes</span>
                    <span className="text-sm font-bold text-foreground">
                      {activeYear.classOpeningDate && activeYear.classEndDate 
                        ? `${formatManilaDate(activeYear.classOpeningDate)} — ${formatManilaDate(activeYear.classEndDate)}`
                        : "Dates not fully configured"}
                    </span>
                  </div>

                  {/* BOSY Enrollment Period */}
                  <div className="space-y-4 pt-6 border-t border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg text-foreground uppercase tracking-wider">
                            BOSY Enrollment Period
                          </h4>
                        </div>
                        <p className="text-sm font-bold text-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
                          Set the official dates when the system will accept incoming Grade 7, Transferees, and Returning Learners for the active school year.
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold px-3 py-1.5 rounded-full border shadow-sm ${enrollmentPhaseStatus.color}`}>
                        {enrollmentPhaseStatus.label}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border-2 border-dashed border-primary/20">
                        <div className="space-y-2 relative">
                          <Label className="text-sm font-bold uppercase text-foreground">
                            Opens On
                          </Label>
                          <HybridDatePicker
                            value={activeYear.enrollOpenDate ? activeYear.enrollOpenDate.split('T')[0] : ""}
                            onChange={(val) => {
                              if (val) {
                                const [y, m, d] = val.split('-');
                                const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
                                handleSaveEnrollmentDate("enrollOpenDate", dateObj);
                              }
                            }}
                            placeholder="Set start date"
                          />
                        </div>
                        <div className="space-y-2 relative">
                          <Label className="text-sm font-bold uppercase text-foreground">
                            Closes On
                          </Label>
                          <HybridDatePicker
                            value={activeYear.enrollCloseDate ? activeYear.enrollCloseDate.split('T')[0] : ""}
                            onChange={(val) => {
                              if (val) {
                                const [y, m, d] = val.split('-');
                                const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
                                handleSaveEnrollmentDate("enrollCloseDate", dateObj);
                              }
                            }}
                            placeholder="Set end date"
                          />
                        </div>
                      </div>

                      {activeYear.enrollOpenDate !== null &&
                        activeYear.enrollCloseDate !== null &&
                        toManilaDateToken(activeYear.enrollCloseDate) < toManilaDateToken(activeYear.enrollOpenDate) && (
                          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-bold text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                              Closes On date cannot be earlier than Opens On.
                            </p>
                          </div>
                        )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-foreground font-bold max-w-lg mx-auto leading-relaxed">
                    No active school year has been set for the system. Prepare a
                    draft school year below to begin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 shadow-sm">
            <CardHeader className="bg-blue-500/5 border-b border-blue-500/10 pb-4 rounded-t-lg">
              <CardTitle className="text-sm font-bold  flex items-center gap-2 text-blue-700 uppercase">
                Upcoming / Draft School Year
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {draftYear ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-left">
                      <span className="text-2xl font-black text-foreground">
                        S.Y. {draftYear.yearLabel}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 uppercase font-black  text-xs">
                        Draft
                      </Badge>
                    </div>
                    <div className="space-y-1 text-left">
                      <p className="text-sm font-bold text-foreground">
                        Start of Classes:{" "}
                        <span className="text-foreground font-bold">
                          {formatManilaDate(draftYear.classOpeningDate)}
                        </span>
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        End of School Year:{" "}
                        <span className="text-foreground font-bold">
                          {formatManilaDate(draftYear.classEndDate)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 min-w-[260px]">
                    <Button
                      variant="outline"
                      className="font-bold w-full justify-center shadow-sm"
                      onClick={() => handleEditDraft(draftYear)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit Draft Dates
                    </Button>
                    <Button
                      className="font-bold w-full shadow-sm"
                      onClick={() =>
                        handleOpenActivationConfirmFromDraft(draftYear)
                      }>
                      {activeYear ? "Execute Rollover" : "Activate School Year"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-5">
                  <p className="text-foreground font-bold max-w-lg mx-auto leading-relaxed">
                    No upcoming school year has been drafted yet. Prepare the
                    next academic year.
                  </p>
                  <Button
                    className="font-bold shadow-sm"
                    onClick={handlePrepareRollover}>
                    Prepare {activeYear ? "Next" : "First"} School Year (S.Y.{" "}
                    {nextRolloverYearLabel})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {archivedYears.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">School Year Archive</CardTitle>
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
                        <TableCell className="font-bold text-left">
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

          {activeYear && (
            <Card
              className={cn(
                "shadow-sm mt-8 border-red-200",
                isRolloverReady ? "bg-white" : "bg-slate-50/50",
              )}>
              <CardHeader className="border-b border-red-100 bg-red-50/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle
                      className={cn(
                        "text-xl flex items-center gap-2",
                        !isRolloverReady ? "text-slate-500" : "text-red-700",
                      )}>
                      <RotateCcw
                        className={cn(
                          "h-5 w-5",
                          isRolloverReady ? "text-red-600" : "text-slate-400",
                        )}
                      />
                      Danger Zone: School Year Rollover
                    </CardTitle>
                    <CardDescription>
                      Irreversible actions for active school year:{" "}
                      <span className="font-bold text-foreground">
                        {activeYear.yearLabel}
                      </span>
                    </CardDescription>
                  </div>
                  <div
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-black uppercase border",
                      isRolloverReady
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "bg-slate-100 text-slate-500 border-slate-200",
                    )}>
                    {isRolloverReady ? "READY" : "LOCKED"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {isRolloverReady ? (
                  <Alert className="bg-red-50 border-red-200 text-red-900">
                    <CheckCircle2 className="h-4 w-4 text-red-600" />
                    <AlertTitle className="font-bold">
                      EOSY Finalized — Ready for Rollover
                    </AlertTitle>
                    <AlertDescription className="text-sm font-bold">
                      All sections have been finalized and EOSY is complete. Initiating rollover will archive
                      the current school year and create the next one with the carried-over learner population.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="font-bold">Rollover Locked</AlertTitle>
                    <AlertDescription className="text-sm font-bold">
                      All class sections must complete End of School Year (EOSY) finalization before
                      rollover can be initiated.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter
                className={cn(
                  "border-t p-6",
                  isRolloverReady ? "bg-white" : "bg-slate-50/50",
                )}>
                {isRolloverReady && (
                  <Button
                    className="font-black uppercase bg-red-600 hover:bg-red-700 text-white border-b-4 border-red-800 active:border-b-0 active:translate-y-1 shadow-lg"
                    onClick={() => setIsExecuteRolloverOpen(true)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Initiate School Year Rollover
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}

          <ExecuteRolloverModal
            open={isExecuteRolloverOpen}
            activeSchoolYearLabel={activeYear?.yearLabel ?? null}
            onOpenChange={setIsExecuteRolloverOpen}
            onSuccess={async () => {
              const pubRes = await api.get("/settings/public");
              setSettings(pubRes.data);
              await fetchData();
            }}
          />


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
                    className="font-bold bg-muted/50 cursor-not-allowed pl-9"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground opacity-50" />
                </div>
                <p className="text-xs text-foreground font-bold">
                  Auto-generated based on selected dates
                </p>
                {isLabelTaken && (
                  <p className="text-[0.7rem] font-bold text-destructive flex items-center gap-1 mt-1">
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
                  className="font-bold"
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
                  className="font-bold"
                />
              </div>
            </div>

            {activeYear && (
              <div className="p-4 border rounded-lg space-y-3">
                <p className="text-sm font-bold">
                  Rollover options from {activeYear.yearLabel}
                </p>
                <p className="text-xs text-foreground">
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
                      className="text-sm cursor-pointer select-none">
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
                      className="text-sm cursor-pointer select-none">
                      Carry over eligible enrolled learners as continuing status
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-4">
              <div className="flex items-center gap-2 text-destructive font-black text-xs  uppercase">
                <AlertTriangle className="h-4 w-4" />
                System Activation
              </div>
              <p className="text-sm font-bold leading-relaxed">
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
                  className="text-sm font-bold leading-tight cursor-pointer select-none">
                  I confirm that these dates align with the official DepEd
                  School Calendar Memorandum and I am authorized to activate the
                  system.
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="font-bold"
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
                  variant="secondary"
                  className="font-bold"
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
                  "font-bold transition-all shadow-md border-none",
                  isAgreedToActivation
                    ? "bg-[#800000] hover:bg-[#600000] text-white"
                    : "bg-muted text-foreground grayscale",
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
              <div className="flex items-center justify-end gap-1 text-xs font-bold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Waiting for EOSY Finalization.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase Shift Confirmation Modal */}
      <Dialog open={showPhaseModal} onOpenChange={setShowPhaseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Phase Shift</DialogTitle>
            <DialogDescription>
              {selectedPhase === "CLASSES_ONGOING" && "Are you sure? All new submissions from this point forward will be flagged as Late Enrollees."}
              {selectedPhase === "EOSY_CLOSING" && "Are you sure? This will lock all public forms and prepare the database for the end of the school year. You cannot easily undo this."}
              {selectedPhase === "OFFICIAL_ENROLLMENT" && "Are you sure you want to shift to Official Enrollment?"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowPhaseModal(false)} disabled={isUpdatingPhase}>Cancel</Button>
            <Button 
              disabled={isUpdatingPhase}
              onClick={async () => {
                if (!selectedPhase) return;
                setIsUpdatingPhase(true);
                try {
                  await api.patch(`/settings/phase`, { phase: selectedPhase });
                  sileo.success({ title: "System phase updated", description: "The system phase has been updated." });
                  const pubRes = await api.get("/settings/public");
                  setSettings({ systemPhase: pubRes.data.systemPhase });
                  setShowPhaseModal(false);
                  setSelectedPhase(null);
                } catch (err) {
                  toastApiError(err as never);
                } finally {
                  setIsUpdatingPhase(false);
                }
              }}
            >
              {isUpdatingPhase ? "Applying..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
