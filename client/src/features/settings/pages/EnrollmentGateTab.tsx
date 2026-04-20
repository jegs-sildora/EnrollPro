import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import { CalendarClock, CalendarDays } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { DatePicker } from "@/shared/ui/date-picker";

import { formatManilaDate } from "@/shared/lib/utils";

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

interface AYDates {
  id: number;
  yearLabel: string;
  classOpeningDate: string | null;
  earlyRegOpenDate: string | null;
  earlyRegCloseDate: string | null;
  enrollOpenDate: string | null;
  enrollCloseDate: string | null;
  isManualOverrideOpen: boolean;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not set";
  return formatManilaDate(dateString, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPhaseStatus(openDate: string | null, closeDate: string | null) {
  if (!openDate || !closeDate)
    return { label: "UNSCHEDULED", color: "bg-gray-100 text-gray-700" };
  const now = new Date().getTime();
  const start = new Date(openDate).getTime();
  const end = new Date(closeDate).getTime();

  if (now < start) {
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return {
      label: `SCHEDULED · Opens in ${days} day(s)`,
      color: "bg-blue-100 text-blue-700",
    };
  }
  if (now > end) {
    return { label: "CLOSED", color: "bg-red-100 text-red-700" };
  }
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return {
    label: `● OPEN · Closes in ${daysLeft} day(s)`,
    color: "bg-green-100 text-green-700 animate-pulse",
  };
}

export default function EnrollmentGateTab() {
  const { activeSchoolYearId, enrollmentPhase, setSettings } =
    useSettingsStore();
  const [ay, setAy] = useState<AYDates | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [earlyRegOpenDate, setEarlyRegOpenDate] = useState<Date | undefined>();
  const [earlyRegCloseDate, setEarlyRegCloseDate] = useState<
    Date | undefined
  >();
  const [enrollOpenDate, setEnrollOpenDate] = useState<Date | undefined>();
  const [enrollCloseDate, setEnrollCloseDate] = useState<Date | undefined>();

  const currentManilaYear = useMemo(
    () => getDatePartsInTimeZone(new Date()).year,
    [],
  );
  // Min = start of current year, Max = end of next year
  const minDate = useMemo(
    () => utcNoonDate(currentManilaYear, 0, 1),
    [currentManilaYear],
  );
  const maxDate = useMemo(
    () => utcNoonDate(currentManilaYear + 1, 11, 31),
    [currentManilaYear],
  );
  const enrollmentPhaseMaxDate = useMemo(() => {
    if (!ay?.classOpeningDate) {
      return maxDate;
    }

    const classOpeningDate = new Date(ay.classOpeningDate);
    return classOpeningDate.getTime() < maxDate.getTime()
      ? classOpeningDate
      : maxDate;
  }, [ay?.classOpeningDate, maxDate]);

  const fetchAy = useCallback(async () => {
    if (!activeSchoolYearId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/school-years/${activeSchoolYearId}`);
      const data = res.data.year;
      setAy(data);
      setEarlyRegOpenDate(
        data.earlyRegOpenDate ? new Date(data.earlyRegOpenDate) : undefined,
      );
      setEarlyRegCloseDate(
        data.earlyRegCloseDate ? new Date(data.earlyRegCloseDate) : undefined,
      );
      setEnrollOpenDate(
        data.enrollOpenDate ? new Date(data.enrollOpenDate) : undefined,
      );
      setEnrollCloseDate(
        data.enrollCloseDate ? new Date(data.enrollCloseDate) : undefined,
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeSchoolYearId]);

  useEffect(() => {
    fetchAy();
  }, [fetchAy]);

  const handleToggleOverride = async (checked: boolean) => {
    if (!ay) return;
    try {
      await api.patch(`/school-years/${ay.id}/override`, {
        isManualOverrideOpen: checked,
      });
      setAy({ ...ay, isManualOverrideOpen: checked });

      // Also fetch public settings to sync store Phase
      const pubRes = await api.get("/settings/public");
      setSettings({ enrollmentPhase: pubRes.data.enrollmentPhase });

      if (checked) {
        sileo.warning({
          title: "Manual Override Active",
          description:
            "The Basic Education Early Registration Form portal is now forced OPEN.",
        });
      } else {
        sileo.success({
          title: "Override Disabled",
          description: "Enrollment gate is back on schedule.",
        });
      }
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleSaveDates = async () => {
    if (!ay) return;

    if (ay.classOpeningDate) {
      const classOpeningDate = new Date(ay.classOpeningDate);

      if (
        enrollOpenDate &&
        enrollOpenDate.getTime() > classOpeningDate.getTime()
      ) {
        sileo.error({
          title: "Invalid Regular Enrollment window",
          description: "Regular enrollment cannot open after Start of Classes.",
        });
        return;
      }

      if (
        enrollCloseDate &&
        enrollCloseDate.getTime() > classOpeningDate.getTime()
      ) {
        sileo.error({
          title: "Invalid Regular Enrollment window",
          description:
            "Regular enrollment cannot extend past Start of Classes.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      await api.patch(`/school-years/${ay.id}/dates`, {
        earlyRegOpenDate: earlyRegOpenDate?.toISOString() || null,
        earlyRegCloseDate: earlyRegCloseDate?.toISOString() || null,
        enrollOpenDate: enrollOpenDate?.toISOString() || null,
        enrollCloseDate: enrollCloseDate?.toISOString() || null,
      });
      setIsEditing(false);
      sileo.success({
        title: "Dates Updated",
        description: "Enrollment schedule has been updated.",
      });

      await fetchAy();
      const pubRes = await api.get("/settings/public");
      setSettings({ enrollmentPhase: pubRes.data.enrollmentPhase });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSaving(false);
    }
  };

  if (!activeSchoolYearId) {
    return (
      <div className="flex h-[calc(100vh-20rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">No Active School Year</p>
              <p className="text-sm text-foreground leading-relaxed px-4 font-semibold">
                Activate a school year to configure the enrollment schedule.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !ay) return null;

  const phase1Status = getPhaseStatus(
    ay.earlyRegOpenDate,
    ay.earlyRegCloseDate,
  );
  const phase2Status = getPhaseStatus(ay.enrollOpenDate, ay.enrollCloseDate);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarClock className="h-5 w-5" />
              Enrollment Schedule{" "}
              <span className="text-muted-foreground text-sm font-normal ml-2">
                SY {ay.yearLabel}
              </span>
            </CardTitle>
            <CardDescription>
              DepEd Two-Phase Enrollment structure. The portal opens
              automatically on these dates.
            </CardDescription>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}>
              Edit Dates
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Phase 1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground">
                  PHASE 1 · Basic Education Early Registration Form
                </h4>
                <p className="text-xs text-muted-foreground">
                  For: Grade 7, Transferees, First-time enrollees
                </p>
              </div>
              {!isEditing && (
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-md ${phase1Status.color}`}>
                  {phase1Status.label}
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-3 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs">Opens On</Label>
                  <DatePicker
                    date={earlyRegOpenDate}
                    setDate={setEarlyRegOpenDate}
                    minDate={minDate}
                    maxDate={maxDate}
                    className="font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Closes On</Label>
                  <DatePicker
                    date={earlyRegCloseDate}
                    setDate={setEarlyRegCloseDate}
                    minDate={minDate}
                    maxDate={maxDate}
                    className="font-bold"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-sm bg-muted p-3 rounded-lg border border-border">
                <div className="flex-1 text-center border-r border-border">
                  <span className="block text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                    Opens
                  </span>
                  <span className="font-medium">
                    {formatDate(ay.earlyRegOpenDate)}
                  </span>
                </div>
                <div className="flex-1 text-center">
                  <span className="block text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                    Closes
                  </span>
                  <span className="font-medium">
                    {formatDate(ay.earlyRegCloseDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Phase 2 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground">
                  PHASE 2 · Regular Enrollment
                </h4>
                <p className="text-xs text-muted-foreground">
                  For: All grade levels
                </p>
              </div>
              {!isEditing && (
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-md ${phase2Status.color}`}>
                  {phase2Status.label}
                </span>
              )}
            </div>

            {isEditing ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-3 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">Opens On</Label>
                    <DatePicker
                      date={enrollOpenDate}
                      setDate={setEnrollOpenDate}
                      minDate={minDate}
                      maxDate={enrollmentPhaseMaxDate}
                      className="font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Closes On</Label>
                    <DatePicker
                      date={enrollCloseDate}
                      setDate={setEnrollCloseDate}
                      minDate={minDate}
                      maxDate={enrollmentPhaseMaxDate}
                      className="font-bold"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Regular enrollment must close on or before Start of Classes
                  from the School Year tab.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-4 text-sm bg-muted p-3 rounded-lg border border-border">
                <div className="flex-1 text-center border-r border-border">
                  <span className="block text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                    Opens
                  </span>
                  <span className="font-medium">
                    {formatDate(ay.enrollOpenDate)}
                  </span>
                </div>
                <div className="flex-1 text-center">
                  <span className="block text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                    Closes
                  </span>
                  <span className="font-medium">
                    {formatDate(ay.enrollCloseDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="font-bold"
                onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                className="font-bold"
                onClick={handleSaveDates}
                disabled={saving}>
                {saving ? "Saving..." : "Save Dates"}
              </Button>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Manual Override</p>
                <p className="text-xs text-muted-foreground">
                  Force-open the portal regardless of schedule. Use for
                  emergencies only.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {enrollmentPhase === "OVERRIDE" && (
                  <Badge variant="warning">OVERRIDE ACTIVE</Badge>
                )}
                <Switch
                  checked={ay.isManualOverrideOpen}
                  onCheckedChange={handleToggleOverride}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
