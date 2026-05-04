import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import { CalendarClock, CalendarDays, Settings2 } from "lucide-react";
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
import { Skeleton } from "@/shared/ui/skeleton";
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
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

type PortalControl =
  | "AUTO"
  | "FORCE_OPEN_PHASE_1"
  | "FORCE_OPEN_PHASE_2"
  | "FORCE_CLOSE_ALL";

interface AYDates {
  id: number;
  yearLabel: string;
  classOpeningDate: string | null;
  earlyRegOpenDate: string | null;
  earlyRegCloseDate: string | null;
  enrollOpenDate: string | null;
  enrollCloseDate: string | null;
  portalControl: PortalControl;
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
    return { label: "⚫ UNSCHEDULED", color: "bg-gray-100 text-gray-700" };
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

export default function EnrollmentGateTab() {
  const { activeSchoolYearId, setSettings } = useSettingsStore();
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

  const handleSaveDates = async () => {
    if (!ay) return;

    // ─── UX Blueprint Validation: Timeline Collision Check ───
    /* Commented out for demonstration: 
    if (earlyRegCloseDate && enrollOpenDate) {
      if (enrollOpenDate.getTime() <= earlyRegCloseDate.getTime()) {
        sileo.error({
          title: "Timeline Collision Detected",
          description:
            "⚠️ Phase dates cannot overlap. Please ensure Early Registration (Phase 1) concludes before Official Enrollment (Phase 2) begins (minimum 1-day gap).",
        });
        return;
      }
    }

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
    }
    */

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

  if (loading || !ay) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const phase1Status = getPhaseStatus(
    ay.earlyRegOpenDate,
    ay.earlyRegCloseDate,
  );
  const phase2Status = getPhaseStatus(ay.enrollOpenDate, ay.enrollCloseDate);

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background rounded-lg border shadow-sm">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Admission Schedule Configuration
              </CardTitle>
              <CardDescription>S.Y. {ay.yearLabel}</CardDescription>
            </div>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              className="font-bold"
              onClick={() => setIsEditing(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Edit Timeline
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-10 pt-8">
          {/* Phase 1 */}
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-primary/5 text-primary border-primary/20 px-2 py-0.5">
                    PHASE 1
                  </Badge>
                  <h4 className="font-bold text-lg text-foreground">
                    Early Registration
                  </h4>
                </div>
                <p className="text-sm font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
                  For:{" "}
                  <span className="text-foreground">
                    Incoming Grade 7, Transferees, and Balik-Aral
                  </span>
                </p>
              </div>
              {!isEditing && (
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm ${phase1Status.color}`}>
                  {phase1Status.label}
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border-2 border-dashed border-primary/20">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Opens On
                  </Label>
                  <DatePicker
                    date={earlyRegOpenDate}
                    setDate={setEarlyRegOpenDate}
                    minDate={minDate}
                    maxDate={maxDate}
                    className="font-bold h-12 text-lg shadow-sm border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Closes On
                  </Label>
                  <DatePicker
                    date={earlyRegCloseDate}
                    setDate={setEarlyRegCloseDate}
                    minDate={minDate}
                    maxDate={maxDate}
                    className="font-bold h-12 text-lg shadow-sm border-2"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">
                    Opens
                  </span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {formatDate(ay.earlyRegOpenDate)}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">
                    Closes
                  </span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {formatDate(ay.earlyRegCloseDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Phase 2 */}
          <div className="">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-blue-500/5 text-blue-600 border-blue-500/20 px-2 py-0.5">
                    PHASE 2
                  </Badge>
                  <h4 className="font-bold text-lg text-foreground">
                    Official BOSY Enrollment
                  </h4>
                </div>
                <p className="text-sm font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
                  For:{" "}
                  <span className="text-foreground">
                    All grade levels (Continuing & New)
                  </span>
                </p>
              </div>
              {!isEditing && (
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm ${phase2Status.color}`}>
                  {phase2Status.label}
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border-2 border-dashed border-blue-500/20">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Opens On
                    </Label>
                    <DatePicker
                      date={enrollOpenDate}
                      setDate={setEnrollOpenDate}
                      /* Commented out for demonstration: 
                      minDate={
                        earlyRegCloseDate
                          ? new Date(earlyRegCloseDate.getTime() + 86400000)
                          : minDate
                      }
                      maxDate={maxDate}
                      */
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Closes On
                    </Label>
                    <DatePicker
                      date={enrollCloseDate}
                      setDate={setEnrollCloseDate}
                      /* Commented out for demonstration: 
                      minDate={enrollOpenDate || minDate}
                      maxDate={maxDate}
                      */
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                </div>
                {/* Commented out for demonstration:
                <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 leading-relaxed font-bold">
                    <strong>Timeline Enforcement:</strong> Official Enrollment
                    (Phase 2) cannot open before Early Registration (Phase 1)
                    concludes. It must also close on or before the Start of
                    Classes.
                  </p>
                </div>
                */}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">
                    Opens
                  </span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {formatDate(ay.enrollOpenDate)}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">
                    Closes
                  </span>
                  <span className="text-2xl font-black text-foreground tracking-tight">
                    {formatDate(ay.enrollCloseDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-6 border-t">
              <Button
                variant="ghost"
                className="font-bold text-muted-foreground h-11 px-6"
                onClick={() => setIsEditing(false)}>
                Discard Changes
              </Button>
              <Button
                className="font-bold h-11 px-8 shadow-lg shadow-primary/20"
                onClick={handleSaveDates}
                disabled={saving}>
                {saving ? "Updating Timeline..." : "Save Schedule Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
