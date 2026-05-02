import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { sileo } from "sileo";
import { cn } from "@/shared/lib/utils";
import {
  Calendar as CalendarIcon,
  ArrowRight,
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
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

const MANILA_TIME_ZONE = "Asia/Manila";
const MIN_ACTIVE_CALENDAR_SPAN_DAYS = 240;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

interface SYItem {
  id: number;
  yearLabel: string;
  status: string;
  isEosyFinalized: boolean;
  classOpeningDate: string | null;
  classEndDate: string | null;
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
  const { setSettings, activeSchoolYearId } = useSettingsStore();
  const [years, setYears] = useState<SYItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  // Create state
  const [creating, setCreating] = useState(false);
  const [updatingDraft, setUpdatingDraft] = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [rolloverDraftBaseline, setRolloverDraftBaseline] =
    useState<RolloverDraftSnapshot | null>(null);

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
  const [showEditCalendarModal, setShowEditCalendarModal] = useState(false);
  const [savingActiveCalendarDates, setSavingActiveCalendarDates] =
    useState(false);
  const [editActiveClassOpening, setEditActiveClassOpening] = useState<
    Date | undefined
  >();
  const [editActiveClassEnd, setEditActiveClassEnd] = useState<
    Date | undefined
  >();

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

  const activeCalendarMinEosyDate = useMemo(() => {
    return editActiveClassOpening
      ? addUtcDays(editActiveClassOpening, 1)
      : undefined;
  }, [editActiveClassOpening]);

  const activeCalendarSpanDays = useMemo(() => {
    if (!editActiveClassOpening || !editActiveClassEnd) {
      return 0;
    }

    return Math.floor(
      (editActiveClassEnd.getTime() - editActiveClassOpening.getTime()) /
        DAY_IN_MS,
    );
  }, [editActiveClassEnd, editActiveClassOpening]);

  const isActiveCalendarRangeValid = useMemo(() => {
    if (!editActiveClassOpening || !editActiveClassEnd) {
      return false;
    }

    if (editActiveClassEnd.getTime() <= editActiveClassOpening.getTime()) {
      return false;
    }

    return activeCalendarSpanDays >= MIN_ACTIVE_CALENDAR_SPAN_DAYS;
  }, [activeCalendarSpanDays, editActiveClassEnd, editActiveClassOpening]);

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

    setCreating(true);
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

      const res = await api.post(requestPath, requestPayload);
      const rolloverSummary =
        (res.data.rolloverSummary as RolloverSummary | null | undefined) ??
        null;

      setSettings({
        activeSchoolYearId: res.data.year.id,
        activeSchoolYearLabel: res.data.year.yearLabel,
      });

      const successDescription = activeYear
        ? rolloverSummary
          ? `School Year ${res.data.year.yearLabel} is now active. ${rolloverSummary.createdApplications} learner application(s) were carried over.`
          : `School Year ${res.data.year.yearLabel} is now active.`
        : `School Year ${res.data.year.yearLabel} is now active.`;

      sileo.success({
        title: activeYear ? "Rollover Completed" : "School Year Activated",
        description: successDescription,
      });

      setShowNextForm(false);
      setRolloverDraftBaseline(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setCreating(false);
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

  const handleOpenEditCalendarModal = () => {
    if (!activeYear) {
      return;
    }

    setEditActiveClassOpening(
      activeYear.classOpeningDate
        ? normalizeDateToManila(new Date(activeYear.classOpeningDate))
        : undefined,
    );
    setEditActiveClassEnd(
      activeYear.classEndDate
        ? normalizeDateToManila(new Date(activeYear.classEndDate))
        : undefined,
    );
    setShowEditCalendarModal(true);
  };

  const handleSaveActiveCalendarDates = async () => {
    if (!activeYear || !editActiveClassOpening || !editActiveClassEnd) {
      return;
    }

    if (!isActiveCalendarRangeValid) {
      sileo.error({
        title: "Invalid calendar range",
        description:
          "EOSY must be later than BOSY and at least 240 days after BOSY.",
      });
      return;
    }

    setSavingActiveCalendarDates(true);
    try {
      await api.patch(`/school-years/${activeYear.id}/dates`, {
        classOpeningDate: editActiveClassOpening.toISOString(),
        classEndDate: editActiveClassEnd.toISOString(),
      });

      sileo.success({
        title: "Active calendar updated",
        description: "BOSY and EOSY dates were saved successfully.",
      });
      setShowEditCalendarModal(false);
      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingActiveCalendarDates(false);
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
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            School Year Management
          </h2>
          <p className="text-[14px] text-foreground font-bold">
            Manage active, upcoming, and historical academic years.
          </p>
        </div>
      </div>

      {isZeroState ? (
        <Card className="shadow-lg bg-white">
          <CardContent className="pt-12 pb-14 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-200">
              <School className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-3 text-foreground uppercase">
              Active School Year Required
            </h3>
            <p className="text-muted-foreground font-medium max-w-lg mb-8 leading-relaxed">
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
      ) : (
        <>
          <Card
            className={cn(
              "shadow-md",
              activeYear ? "border-green-500/20" : "border-amber-500/30",
            )}>
            <CardHeader
              className={cn(
                "border-b pb-4 rounded-t-lg",
                activeYear
                  ? "bg-green-500/5 border-green-500/10"
                  : "bg-amber-500/5 border-amber-500/20",
              )}>
              <CardTitle
                className={cn(
                  "text-sm font-bold tracking-widest flex items-center gap-2 uppercase",
                  activeYear ? "text-green-700" : "text-amber-700",
                )}>
                {activeYear ? (
                  <>
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    Currently Active School Year
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    No Active School Year
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {activeYear ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-foreground">
                        S.Y. {activeYear.yearLabel}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Start of Classes:{" "}
                        <span className="text-foreground font-bold">
                          {formatManilaDate(activeYear.classOpeningDate)}
                        </span>
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
                        End of School Year:{" "}
                        <span className="text-foreground font-bold">
                          {formatManilaDate(activeYear.classEndDate)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 min-w-[260px]">
                    <Button
                      variant="outline"
                      className="font-bold w-full justify-center shadow-sm"
                      onClick={handleOpenEditCalendarModal}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit Dates
                    </Button>
                    <Button
                      variant="secondary"
                      className="font-bold w-full justify-between shadow-sm border"
                      asChild>
                      <Link to="/settings?tab=enrollment">
                        Go to Enrollment Gate <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground font-medium max-w-lg mx-auto leading-relaxed">
                    No active school year has been set for the system. Prepare a
                    draft school year below to begin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 shadow-sm">
            <CardHeader className="bg-blue-500/5 border-b border-blue-500/10 pb-4 rounded-t-lg">
              <CardTitle className="text-sm font-bold tracking-widest flex items-center gap-2 text-blue-700 uppercase">
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
                        className="bg-blue-50 text-blue-700 border-blue-200 uppercase font-black tracking-tighter text-[10px]">
                        Draft
                      </Badge>
                    </div>
                    <div className="space-y-1 text-left">
                      <p className="text-sm font-medium text-muted-foreground">
                        Start of Classes:{" "}
                        <span className="text-foreground font-bold">
                          {formatManilaDate(draftYear.classOpeningDate)}
                        </span>
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
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
                  <p className="text-muted-foreground font-medium max-w-lg mx-auto leading-relaxed">
                    No upcoming school year has been drafted yet. Prepare the
                    next academic year to allow for Early Registration setup.
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

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">School Year Archive</CardTitle>
              <CardDescription>
                Historical years are kept for audit and reporting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {archivedYears.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">School Year</TableHead>
                      <TableHead className="text-left">
                        Start of Classes (BOSY)
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
                        <TableCell className="font-semibold text-left">
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
              ) : (
                <p className="text-sm text-muted-foreground">
                  No archived school years yet.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={showNextForm}
        onOpenChange={(open) => {
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold">
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
                <p className="text-sm font-semibold">
                  Rollover options from {activeYear.yearLabel}
                </p>
                <p className="text-xs text-muted-foreground">
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
              <div className="flex items-center gap-2 text-destructive font-black text-xs tracking-widest uppercase">
                <AlertTriangle className="h-4 w-4" />
                System Activation
              </div>
              <p className="text-sm font-medium leading-relaxed">
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
                  setShowNextForm(false);
                  setRolloverDraftBaseline(null);
                }}>
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
                    : "bg-muted text-muted-foreground grayscale",
                )}
                disabled={
                  creating ||
                  updatingDraft ||
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
              <div className="flex items-center justify-end gap-1 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Waiting for EOSY Finalization.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditCalendarModal}
        onOpenChange={(open) => {
          setShowEditCalendarModal(open);
          if (!open) {
            setSavingActiveCalendarDates(false);
          }
        }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Active Calendar</DialogTitle>
            <DialogDescription>
              Adjust BOSY and EOSY for the currently active school year.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start of Classes (BOSY)</Label>
                <DatePicker
                  date={editActiveClassOpening}
                  setDate={(date) =>
                    setEditActiveClassOpening(
                      date ? normalizeDateToManila(date) : undefined,
                    )
                  }
                  timeZone={MANILA_TIME_ZONE}
                  className="font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label>End of School Year (EOSY)</Label>
                <DatePicker
                  date={editActiveClassEnd}
                  setDate={(date) =>
                    setEditActiveClassEnd(
                      date ? normalizeDateToManila(date) : undefined,
                    )
                  }
                  timeZone={MANILA_TIME_ZONE}
                  minDate={activeCalendarMinEosyDate}
                  className="font-bold"
                />
              </div>
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-semibold">
                Adjusting these dates does not automatically change your
                Enrollment Gate deadlines.
              </p>
            </div>

            {editActiveClassOpening &&
              editActiveClassEnd &&
              !isActiveCalendarRangeValid && (
                <p className="text-xs font-semibold text-destructive">
                  EOSY must be later than BOSY and at least 240 days after BOSY.
                </p>
              )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingActiveCalendarDates}
              onClick={() => setShowEditCalendarModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                savingActiveCalendarDates ||
                !editActiveClassOpening ||
                !editActiveClassEnd ||
                !isActiveCalendarRangeValid
              }
              onClick={handleSaveActiveCalendarDates}>
              {savingActiveCalendarDates ? "Saving..." : "Save Dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
