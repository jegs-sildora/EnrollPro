import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { sileo } from "sileo";
import {
  Calendar as CalendarIcon,
  ArrowRight,
  Pencil,
  AlertTriangle,
  Lock,
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
  const { setSettings } = useSettingsStore();
  const [years, setYears] = useState<SYItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);

  // Create state
  const [creating, setCreating] = useState(false);
  const [updatingDraft, setUpdatingDraft] = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);
  const [isRolloverDateEditMode, setIsRolloverDateEditMode] = useState(false);
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

  // Delete state
  const [showActivationConfirm, setShowActivationConfirm] = useState(false);
  const [activationPhraseInput, setActivationPhraseInput] = useState("");
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

  const activeYear = years.find((y) => y.status === "ACTIVE");
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
    () => years.filter((year) => year.status === "ARCHIVED"),
    [years],
  );

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

  const selectedStartYear = useMemo(() => {
    const parsedFromLabel = Number.parseInt(
      editYearLabel.split("-")[0] ?? "",
      10,
    );
    if (Number.isInteger(parsedFromLabel)) {
      return parsedFromLabel;
    }
    if (editClassOpening) {
      return editClassOpening.getUTCFullYear();
    }
    return currentManilaYear;
  }, [currentManilaYear, editClassOpening, editYearLabel]);

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
      return false;
    }

    return (
      currentRolloverDraft.yearLabel !== rolloverDraftBaseline.yearLabel ||
      currentRolloverDraft.classOpeningDate !==
        rolloverDraftBaseline.classOpeningDate ||
      currentRolloverDraft.classEndDate !== rolloverDraftBaseline.classEndDate
    );
  }, [currentRolloverDraft, rolloverDraftBaseline]);

  const activationActionToken = activeYear ? "ROLLOVER" : "INITIALIZE";
  const activationConfirmPhrase = `${activationActionToken} ${selectedStartYear}`;
  const activationButtonLabel = activeYear
    ? "Execute School Year Rollover"
    : editYearLabel
      ? `Initialize S.Y. ${editYearLabel}`
      : "Initialize School Year";

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

  const handleOpenActivationConfirm = () => {
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

    if (!editYearLabel.trim()) {
      sileo.error({
        title: "Missing school year label",
        description: "School Year Label is required before executing rollover.",
      });
      return;
    }

    setActivationPhraseInput("");
    setShowActivationConfirm(true);
  };

  const handleUpdateRolloverDraft = () => {
    if (!activeYear) {
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

    if (!isRolloverDraftChanged) {
      sileo.info({
        title: "No draft changes",
        description: "Update any rollover field before saving.",
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

        const rolloverDraft = response.data.rolloverDraft as {
          yearLabel: string;
          classOpeningDate: string;
          classEndDate: string;
        };

        const normalizedOpeningDate = normalizeDateToManila(
          new Date(rolloverDraft.classOpeningDate),
        );
        const normalizedClassEndDate = normalizeDateToManila(
          new Date(rolloverDraft.classEndDate),
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
          title: "Rollover draft updated",
          description: "School year label and BOSY/EOSY dates were saved.",
        });
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
      setIsRolloverDateEditMode(false);
      setRolloverDraftBaseline(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setCreating(false);
    }
  };

  const handlePrepareRollover = () => {
    if (!activeYear) {
      return;
    }

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
    } else if (editClassOpening && editClassEnd) {
      setRolloverDraftBaseline({
        yearLabel: editYearLabel.trim(),
        classOpeningDate: editClassOpening.toISOString(),
        classEndDate: editClassEnd.toISOString(),
      });
    }

    setIsRolloverDateEditMode(true);
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

  if (loading) return null;

  return (
    <div className="space-y-6">
      {!activeYear || showNextForm ? (
        <Card className="shadow-sm">
          <CardHeader className="bg-muted border-3 border-border rounded-tl-lg rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarIcon className="h-5 w-5" />
              {activeYear
                ? `School Year Rollover: ${editYearLabel}`
                : `School Year Setup: ${editYearLabel}`}
            </CardTitle>
            <CardDescription>
              {activeYear
                ? `Create and activate the next school year from ${activeYear.yearLabel}.`
                : "We pre-filled the dates based on DepEd calendar defaults. Adjust them as needed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearLabel">School Year Label</Label>
                <Input
                  id="yearLabel"
                  value={editYearLabel}
                  onChange={(event) =>
                    setYearLabel(
                      event.target.value.replace(/^S\.Y\.\s*/i, "").trimStart(),
                    )
                  }
                  placeholder="e.g. 2026-2027"
                  className="font-bold"
                />
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

            <div className="text-sm text-muted-foreground">
              Need to set Early Registration dates?{" "}
              <Button variant="link" className="h-auto p-0" asChild>
                <Link to="/settings?tab=enrollment">Go to Enrollment Gate</Link>
              </Button>
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
                    <input
                      type="checkbox"
                      id="c1"
                      className="h-4 w-4"
                      checked={rolloverOptions.cloneStructure}
                      onChange={(e) =>
                        setRolloverOptions({
                          ...rolloverOptions,
                          cloneStructure: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="c1" className="text-sm">
                      Clone grade levels, sections, and SCPs (Adviser
                      assignments will be wiped clean)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="c3"
                      className="h-4 w-4"
                      checked={rolloverOptions.carryOverLearners}
                      onChange={(e) =>
                        setRolloverOptions({
                          ...rolloverOptions,
                          carryOverLearners: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="c3" className="text-sm">
                      Carry over eligible enrolled learners as continuing status
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {activeYear && (
                <Button
                  variant="outline"
                  className="font-bold"
                  onClick={() => {
                    setShowNextForm(false);
                    setIsRolloverDateEditMode(false);
                    setRolloverDraftBaseline(null);
                  }}>
                  Cancel
                </Button>
              )}
              {activeYear && isRolloverDateEditMode && (
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
                    !isRolloverDraftChanged
                  }>
                  {updatingDraft ? "Updating..." : "Update Button"}
                </Button>
              )}
              <Button
                onClick={handleOpenActivationConfirm}
                className="font-bold"
                disabled={
                  creating ||
                  updatingDraft ||
                  !editYearLabel.trim() ||
                  !editClassOpening ||
                  !editClassEnd ||
                  (activeYear ? !isRolloverReady : false)
                }>
                {creating
                  ? activeYear
                    ? "Running rollover..."
                    : "Activating..."
                  : activationButtonLabel}
              </Button>
            </div>
            {activeYear && !isRolloverReady && (
              <div className="flex items-center justify-end gap-1 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Waiting for EOSY Finalization.</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-bold">
                  School Year {activeYear.yearLabel}
                </span>
                <Badge variant="success" className="animate-pulse">
                  ACTIVE
                </Badge>
              </div>
              <p className="text-sm font-bold">
                Start of Classes (BOSY):{" "}
                {formatManilaDate(activeYear.classOpeningDate)}
              </p>
              <p className="text-sm font-bold">
                End of School Year (EOSY):{" "}
                {formatManilaDate(activeYear.classEndDate)}
              </p>
              <p className="text-sm font-bold">
                Enrolled: {activeYear._count.enrollmentRecords} learners
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="font-bold"
                onClick={handleOpenEditCalendarModal}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Dates
              </Button>
              <Button className="font-bold" onClick={handlePrepareRollover}>
                Prepare Rollover to S.Y. {nextRolloverYearLabel}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      <Dialog
        open={showActivationConfirm}
        onOpenChange={(open) => {
          setShowActivationConfirm(open);
          if (!open) {
            setActivationPhraseInput("");
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {activeYear
                ? "Confirm School Year Rollover"
                : "Confirm School Year Initialization"}
            </DialogTitle>
            <DialogDescription>
              This action changes system-wide school year state and affects
              enrollment lifecycle data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-bold text-destructive">
                Proceed only if you intend to{" "}
                {activeYear ? "roll over" : "initialize"} School Year{" "}
                {editYearLabel}.
              </p>
              <p className="mt-1 text-foreground font-semibold">
                {activeYear
                  ? "Rollover archives the current active year and initializes the next cycle."
                  : "Initialization sets the first active school year for this installation."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activation-phrase" className="font-semibold">
                Type{" "}
                <span className="font-mono uppercase">
                  {" "}
                  "{activationConfirmPhrase}"{" "}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id="activation-phrase"
                value={activationPhraseInput}
                onChange={(event) =>
                  setActivationPhraseInput(event.target.value)
                }
                placeholder={activationConfirmPhrase}
                autoComplete="off"
                className="font-mono uppercase font-bold"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowActivationConfirm(false)}
              disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={
                creating ||
                activationPhraseInput.trim().toUpperCase() !==
                  activationConfirmPhrase
              }
              onClick={async () => {
                await handleActivateNext();
                setShowActivationConfirm(false);
                setActivationPhraseInput("");
              }}>
              {creating
                ? activeYear
                  ? "Running rollover..."
                  : "Initializing..."
                : activeYear
                  ? "Execute School Year Rollover"
                  : `Initialize SY ${editYearLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
