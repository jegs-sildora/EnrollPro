import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import {
  CalendarClock,
  CalendarDays,
  Settings2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

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
  const now = new Date().getTime();
  const start = new Date(openDate).getTime();
  const end = new Date(closeDate).getTime();

  if (now < start) {
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return {
      label: `🔵 SCHEDULED (Opens in ${days} day(s))`,
      color: "bg-blue-100 text-blue-700",
    };
  }
  if (now > end) {
    return { label: "⚫ CONCLUDED", color: "bg-slate-100 text-slate-500" };
  }
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
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

  const transitionRange = useMemo(() => {
    if (!ay?.earlyRegCloseDate || !ay?.enrollOpenDate) return null;

    const start = new Date(ay.earlyRegCloseDate);
    start.setUTCDate(start.getUTCDate() + 1);

    const end = new Date(ay.enrollOpenDate);
    end.setUTCDate(end.getUTCDate() - 1);

    return {
      start: formatManilaDate(start.toISOString(), {
        month: "short",
        day: "numeric",
      }),
      end: formatManilaDate(end.toISOString(), {
        month: "short",
        day: "numeric",
      }),
      rawStart: start,
      rawEnd: end,
    };
  }, [ay]);

  const isCurrentlyInTransition = useMemo(() => {
    if (!transitionRange) return false;
    const now = new Date().getTime();
    return (
      now >= transitionRange.rawStart.getTime() &&
      now <= transitionRange.rawEnd.getTime()
    );
  }, [transitionRange]);

  const isPortalActuallyOpen = useMemo(() => {
    if (!ay) return false;
    if (ay.portalControl === "FORCE_OPEN_PHASE_1") return true;
    if (ay.portalControl === "FORCE_OPEN_PHASE_2") return true;
    if (ay.portalControl === "FORCE_CLOSE_ALL") return false;

    // AUTO Mode logic
    const now = new Date().getTime();
    const p1Start = ay.earlyRegOpenDate
      ? new Date(ay.earlyRegOpenDate).getTime()
      : 0;
    const p1End = ay.earlyRegCloseDate
      ? new Date(ay.earlyRegCloseDate).getTime()
      : 0;
    const p2Start = ay.enrollOpenDate
      ? new Date(ay.enrollOpenDate).getTime()
      : 0;
    const p2End = ay.enrollCloseDate
      ? new Date(ay.enrollCloseDate).getTime()
      : 0;

    return (now >= p1Start && now <= p1End) || (now >= p2Start && now <= p2End);
  }, [ay]);

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

  const handlePortalControlChange = async (value: string) => {
    if (!ay) return;
    try {
      await api.patch(`/school-years/${ay.id}/override`, {
        portalControl: value,
      });
      setAy({ ...ay, portalControl: value as PortalControl });

      // Sync store Phase
      const pubRes = await api.get("/settings/public");
      setSettings({ enrollmentPhase: pubRes.data.enrollmentPhase });

      sileo.success({
        title: "Portal Mode Updated",
        description: `Global control set to ${value.replace(/_/g, " ")}.`,
      });
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleSaveDates = async () => {
    if (!ay) return;

    // ─── UX Blueprint Validation: Timeline Collision Check ───
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
      {/* Global Control Card */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">GLOBAL PORTAL CONTROL</CardTitle>
              <CardDescription>
                Determine how the public-facing portals behave.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-xl border border-border/50">
            <div className="space-y-1">
              <p className="text-sm font-bold flex items-center gap-1.5">
                Control Mode
                {ay.portalControl !== "AUTO" && (
                  <Badge
                    variant="warning"
                    className="h-5 px-1.5">
                    Override Active
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Determines if the enrollment forms are currently accessible to
                the public.
              </p>
            </div>

            <Select
              value={ay.portalControl}
              onValueChange={handlePortalControlChange}>
              <SelectTrigger className="w-full sm:w-[280px] font-bold bg-background shadow-sm border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="AUTO"
                  className="font-medium">
                  Auto-Schedule (Follows dates below)
                </SelectItem>
                <SelectItem
                  value="FORCE_OPEN_PHASE_1"
                  className="text-amber-600 font-bold">
                  Force-Open Phase 1 (Override)
                </SelectItem>
                <SelectItem
                  value="FORCE_OPEN_PHASE_2"
                  className="text-amber-600 font-bold">
                  Force-Open Phase 2 (Override)
                </SelectItem>
                <SelectItem
                  value="FORCE_CLOSE_ALL"
                  className="text-destructive font-bold">
                  {" "}
                  Force-Close All Portals
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background rounded-lg border shadow-sm">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Enrollment Schedule Configuration
              </CardTitle>
              <CardDescription>SY {ay.yearLabel}</CardDescription>
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
                <p className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
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

          {transitionRange ? (
            <div className="relative py-2">
              <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-2xl p-6 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <span className="text-xl"></span>
                  <span className="text-xs font-black uppercase tracking-[0.2em]">
                    System Transition Period
                  </span>
                </div>
                <p className="text-lg font-black text-foreground">
                  {transitionRange.start} — {transitionRange.end}
                </p>
                <div className="text-xs text-muted-foreground mx-auto leading-relaxed font-medium space-y-1">
                  <p>
                    Public portals{" "}
                    {isCurrentlyInTransition ? "are currently" : "will be"}{" "}
                    <span
                      className={`font-bold underline decoration-2 ${
                        isPortalActuallyOpen
                          ? "text-green-600 decoration-green-600/30"
                          : "text-foreground decoration-destructive/30"
                      }`}>
                      {isPortalActuallyOpen ? "OPEN" : "CLOSED"}
                    </span>
                    {ay.portalControl !== "AUTO" && (
                      <span className="ml-1 opacity-70">
                        (Manual Override Active)
                      </span>
                    )}
                  </p>
                  {isCurrentlyInTransition && (
                    <p>
                      Registrars should utilize this time to consolidate Early
                      Registration projections and configure section capacities.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative py-4">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true">
                <div className="w-full border-t-2 border-dashed border-muted-foreground/20"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-4 text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">
                  Transition
                </span>
              </div>
            </div>
          )}

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
                <p className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
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
                      minDate={
                        earlyRegCloseDate
                          ? new Date(earlyRegCloseDate.getTime() + 86400000)
                          : minDate
                      }
                      maxDate={maxDate}
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
                      minDate={enrollOpenDate || minDate}
                      maxDate={maxDate}
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    <strong>Timeline Enforcement:</strong> Official Enrollment
                    (Phase 2) cannot open before Early Registration (Phase 1)
                    concludes. It must also close on or before the Start of
                    Classes.
                  </p>
                </div>
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
