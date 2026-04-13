import { useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { Calendar as CalendarIcon, Trash2, ChevronDown } from "lucide-react";
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
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { DatePicker } from "@/shared/ui/date-picker";

const MANILA_TIME_ZONE = "Asia/Manila";

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
  classOpeningDate: string | null;
  classEndDate: string | null;
  _count: {
    gradeLevels: number;
    applicants: number;
    enrollments: number;
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

export default function SchoolYearTab() {
  const { setSettings } = useSettingsStore();
  const [years, setYears] = useState<SYItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);

  // Create state
  const [creating, setCreating] = useState(false);
  const [showNextForm, setShowNextForm] = useState(false);

  // Editable fields for setup
  const [editYearLabel, setYearLabel] = useState("");
  const [editClassOpening, setClassOpening] = useState<Date | undefined>();
  const [editClassEnd, setClassEnd] = useState<Date | undefined>();

  const [cloneSettings, setCloneSettings] = useState({
    gradeLevels: true,
    sections: true,
    capacities: false,
  });

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLabel, setDeleteLabel] = useState("");
  const [deleting, setDeleting] = useState(false);

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
    if (!editClassOpening || !editClassEnd) {
      sileo.error({
        title: "Missing dates",
        description: "Select both class opening and class end dates.",
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
      const payload = {
        yearLabel: derivedSchedule.yearLabel,
        classOpeningDate: derivedSchedule.classOpeningDate.toISOString(),
        classEndDate: derivedSchedule.classEndDate.toISOString(),
        earlyRegOpenDate: derivedSchedule.earlyRegOpenDate.toISOString(),
        earlyRegCloseDate: derivedSchedule.earlyRegCloseDate.toISOString(),
        enrollOpenDate: derivedSchedule.enrollOpenDate.toISOString(),
        enrollCloseDate: derivedSchedule.enrollCloseDate.toISOString(),
        cloneFromId: activeYear?.id || null,
        cloneOptions: cloneSettings,
      };

      const res = await api.post("/school-years/activate", payload);
      setSettings({
        activeSchoolYearId: res.data.year.id,
        activeSchoolYearLabel: res.data.year.yearLabel,
      });
      sileo.success({
        title: "School Year Activated",
        description: `School Year ${derivedSchedule.yearLabel} is now active.`,
      });
      setShowNextForm(false);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/school-years/${deleteId}`);
      sileo.success({
        title: "Deleted",
        description: `School Year ${deleteLabel} has been removed.`,
      });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setDeleting(false);
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
              Smart Setup: School Year {editYearLabel}
            </CardTitle>
            <CardDescription>
              We've pre-filled the fields based on DepEd's calendar. You can
              adjust them if needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearLabel">School Year Label</Label>
                <Input
                  id="yearLabel"
                  value={`S.Y. ${editYearLabel}`}
                  readOnly
                  placeholder="e.g. 2026-2027"
                  className="font-bold"
                />
                <p className="text-sm font-bold">
                  Updated based on your start date.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Class Opening</Label>
                <DatePicker
                  date={editClassOpening}
                  setDate={handleClassOpeningChange}
                  timeZone={MANILA_TIME_ZONE}
                  minDate={openingMinDate}
                  maxDate={openingMaxDate}
                  className="font-bold"
                />
                <p className="text-sm font-bold">
                  Select a date through late {currentManilaYear + 1}.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Class End</Label>
                <DatePicker
                  date={editClassEnd}
                  setDate={handleClassEndChange}
                  timeZone={MANILA_TIME_ZONE}
                  minDate={classEndMinDate}
                  maxDate={classEndMaxDate}
                  className="font-bold"
                />
                <p className="text-sm font-bold">
                  Ends in the next calendar year.
                </p>
              </div>
            </div>

            {activeYear && (
              <div className="p-4 border rounded-lg space-y-3">
                <p className="text-sm font-medium">
                  Clone from previous year ({activeYear.yearLabel})?
                </p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="c1"
                      className="h-4 w-4"
                      checked={cloneSettings.gradeLevels}
                      onChange={(e) =>
                        setCloneSettings({
                          ...cloneSettings,
                          gradeLevels: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="c1" className="text-sm">
                      Grade Levels (Grade 7–10)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="c3"
                      className="h-4 w-4"
                      checked={cloneSettings.sections}
                      onChange={(e) =>
                        setCloneSettings({
                          ...cloneSettings,
                          sections: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor="c3" className="text-sm">
                      Section names (without student assignments)
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {activeYear && (
                <Button
                  variant="ghost"
                  className="text-destructive mr-auto"
                  onClick={() => {
                    setDeleteId(activeYear.id);
                    setDeleteLabel(activeYear.yearLabel);
                  }}
                  disabled={activeYear._count.enrollments > 0}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Active Year
                </Button>
              )}
              {activeYear && (
                <Button
                  variant="outline"
                  className="font-bold"
                  onClick={() => setShowNextForm(false)}>
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleActivateNext}
                className="font-bold"
                disabled={creating || !editYearLabel.trim()}>
                {creating ? "Activating..." : "Activate This School Year"}
              </Button>
            </div>
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
                Classes: {formatManilaDate(activeYear.classOpeningDate)} →{" "}
                {formatManilaDate(activeYear.classEndDate)}
              </p>
              <p className="text-sm font-bold">
                Enrolled: {activeYear._count.enrollments} students
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  setDeleteId(activeYear.id);
                  setDeleteLabel(activeYear.yearLabel);
                }}
                disabled={activeYear._count.enrollments > 0}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowNextForm(true)}>
                Prepare S.Y. {defaults?.yearLabel}{" "}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {years.length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-bold ">History</h3>
          {years.map((y) => (
            <div
              key={y.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border text-sm">
              <div className="flex items-center gap-3">
                <span className="font-bold">S.Y. {y.yearLabel}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {y.status}
                </span>
                {y.status === "ACTIVE" && (
                  <Badge className="uppercase" variant="success">
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className=" hidden sm:inline">
                  {y._count.enrollments} Enrolled
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => {
                    setDeleteId(y.id);
                    setDeleteLabel(y.yearLabel);
                  }}
                  disabled={y._count.enrollments > 0}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open: boolean) => !open && setDeleteId(null)}
        title="Delete School Year"
        description={
          <span>
            Are you sure you want to delete{" "}
            <span className="font-bold">School Year "{deleteLabel}"</span>?
          </span>
        }
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        variant="primary"
      />
    </div>
  );
}
