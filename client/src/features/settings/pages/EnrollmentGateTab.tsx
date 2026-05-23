import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CalendarDays,
  FlaskConical,
  Settings2,
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
import { Switch } from "@/shared/ui/switch";
import { DatePicker } from "@/shared/ui/date-picker";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

import { formatManilaDate } from "@/shared/lib/utils";

const MANILA_TIME_ZONE = "Asia/Manila";
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

function toNullableDateToken(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return toManilaDateToken(value);
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
  requireReadingAssessmentNew: boolean;
  requireReadingAssessmentContinuing: boolean;
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

  // Assessment config state
  const [requireNew, setRequireNew] = useState(true);
  const [requireContinuing, setRequireContinuing] = useState(false);
  const [showDisableNewWarning, setShowDisableNewWarning] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

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

  const resetEditableDates = useCallback((data: AYDates | null) => {
    setRequireNew(data?.requireReadingAssessmentNew ?? true);
    setRequireContinuing(data?.requireReadingAssessmentContinuing ?? false);
    setEarlyRegOpenDate(
      data?.earlyRegOpenDate
        ? normalizeDateToManila(new Date(data.earlyRegOpenDate))
        : undefined,
    );
    setEarlyRegCloseDate(
      data?.earlyRegCloseDate
        ? normalizeDateToManila(new Date(data.earlyRegCloseDate))
        : undefined,
    );
    setEnrollOpenDate(
      data?.enrollOpenDate
        ? normalizeDateToManila(new Date(data.enrollOpenDate))
        : undefined,
    );
    setEnrollCloseDate(
      data?.enrollCloseDate
        ? normalizeDateToManila(new Date(data.enrollCloseDate))
        : undefined,
    );
  }, []);

  const fetchAy = useCallback(async () => {
    if (!activeSchoolYearId) {
      setLoading(false);
      setAy(null);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/school-years/${activeSchoolYearId}`);
      const data = res.data.year;
      setAy(data);
      resetEditableDates(data);
    } catch {
      setAy(null);
    } finally {
      setLoading(false);
    }
  }, [activeSchoolYearId, resetEditableDates]);

  useEffect(() => {
    fetchAy();
  }, [fetchAy]);

  const beginEditing = () => {
    if (!ay) {
      return;
    }

    resetEditableDates(ay);
    setIsEditing(true);
  };

  const discardChanges = () => {
    resetEditableDates(ay);
    setIsEditing(false);
  };

  const effectiveEarlyRegOpen = isEditing
    ? earlyRegOpenDate
    : ay?.earlyRegOpenDate;
  const effectiveEarlyRegClose = isEditing
    ? earlyRegCloseDate
    : ay?.earlyRegCloseDate;
  const effectiveEnrollOpen = isEditing ? enrollOpenDate : ay?.enrollOpenDate;
  const effectiveEnrollClose = isEditing
    ? enrollCloseDate
    : ay?.enrollCloseDate;

  const earlyRegOpenToken = toNullableDateToken(effectiveEarlyRegOpen);
  const earlyRegCloseToken = toNullableDateToken(effectiveEarlyRegClose);
  const enrollOpenToken = toNullableDateToken(effectiveEnrollOpen);
  const enrollCloseToken = toNullableDateToken(effectiveEnrollClose);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (
      earlyRegOpenToken !== null &&
      earlyRegCloseToken !== null &&
      earlyRegCloseToken < earlyRegOpenToken
    ) {
      errors.push(
        "Phase 1 Closes On date cannot be earlier than its Opens On date.",
      );
    }

    if (
      enrollOpenToken !== null &&
      enrollCloseToken !== null &&
      enrollCloseToken < enrollOpenToken
    ) {
      errors.push(
        "Phase 2 Closes On date cannot be earlier than its Opens On date.",
      );
    }

    if (
      earlyRegCloseToken !== null &&
      enrollOpenToken !== null &&
      enrollOpenToken < earlyRegCloseToken
    ) {
      errors.push("Phase 2 Opens On cannot be earlier than Phase 1 Closes On.");
    }

    return errors;
  }, [
    earlyRegCloseToken,
    earlyRegOpenToken,
    enrollCloseToken,
    enrollOpenToken,
  ]);

  const isTimelineDirty = useMemo(() => {
    if (!ay) {
      return false;
    }

    return (
      earlyRegOpenToken !== toNullableDateToken(ay.earlyRegOpenDate) ||
      earlyRegCloseToken !== toNullableDateToken(ay.earlyRegCloseDate) ||
      enrollOpenToken !== toNullableDateToken(ay.enrollOpenDate) ||
      enrollCloseToken !== toNullableDateToken(ay.enrollCloseDate)
    );
  }, [
    ay,
    earlyRegCloseToken,
    earlyRegOpenToken,
    enrollCloseToken,
    enrollOpenToken,
  ]);

  const handleSaveDates = async () => {
    if (!ay) return;

    if (validationErrors.length > 0) {
      sileo.error({
        title: "Timeline Validation Error",
        description: validationErrors[0],
      });
      return;
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

  const handleSaveAssessmentConfig = async () => {
    if (!ay) return;
    setSavingAssessment(true);
    try {
      await api.patch(`/school-years/${ay.id}/assessment-config`, {
        requireReadingAssessmentNew: requireNew,
        requireReadingAssessmentContinuing: requireContinuing,
      });
      sileo.success({
        title: "Assessment Configuration Saved",
        description: "Intake assessment settings have been updated.",
      });
      await fetchAy();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingAssessment(false);
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
              onClick={beginEditing}>
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
                <p className="text-sm font-bold text-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl border-2 border-dashed border-primary/20">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase  text-foreground">
                      Opens On
                    </Label>
                    <DatePicker
                      date={earlyRegOpenDate}
                      setDate={(date) =>
                        setEarlyRegOpenDate(
                          date ? normalizeDateToManila(date) : undefined,
                        )
                      }
                      minDate={minDate}
                      maxDate={maxDate}
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase  text-foreground">
                      Closes On
                    </Label>
                    <DatePicker
                      date={earlyRegCloseDate}
                      setDate={(date) =>
                        setEarlyRegCloseDate(
                          date ? normalizeDateToManila(date) : undefined,
                        )
                      }
                      minDate={earlyRegOpenDate || minDate}
                      maxDate={maxDate}
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                </div>

                {earlyRegOpenToken !== null &&
                  earlyRegCloseToken !== null &&
                  earlyRegCloseToken < earlyRegOpenToken && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Phase 1 Closes On date cannot be earlier than Opens On.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-foreground uppercase  mb-1">
                    Opens
                  </span>
                  <span className="text-2xl font-black text-foreground ">
                    {formatDate(ay.earlyRegOpenDate)}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-foreground uppercase  mb-1">
                    Closes
                  </span>
                  <span className="text-2xl font-black text-foreground ">
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
                <p className="text-sm font-bold text-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block">
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
                    <Label className="text-xs font-bold uppercase  text-foreground">
                      Opens On
                    </Label>
                    <DatePicker
                      date={enrollOpenDate}
                      setDate={(date) =>
                        setEnrollOpenDate(
                          date ? normalizeDateToManila(date) : undefined,
                        )
                      }
                      minDate={earlyRegCloseDate || minDate}
                      maxDate={maxDate}
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase  text-foreground">
                      Closes On
                    </Label>
                    <DatePicker
                      date={enrollCloseDate}
                      setDate={(date) =>
                        setEnrollCloseDate(
                          date ? normalizeDateToManila(date) : undefined,
                        )
                      }
                      minDate={enrollOpenDate || minDate}
                      maxDate={maxDate}
                      className="font-bold h-12 text-lg shadow-sm border-2"
                    />
                  </div>
                </div>

                {isEditing &&
                  enrollOpenToken !== null &&
                  enrollCloseToken !== null &&
                  enrollCloseToken < enrollOpenToken && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Phase 2 Closes On date cannot be earlier than Opens On.
                      </p>
                    </div>
                  )}

                {isEditing &&
                  earlyRegCloseToken !== null &&
                  enrollOpenToken !== null &&
                  enrollOpenToken < earlyRegCloseToken && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Phase 2 Opens On cannot be earlier than Phase 1 Closes
                        On. Same-day handoff is allowed.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-foreground uppercase  mb-1">
                    Opens
                  </span>
                  <span className="text-2xl font-black text-foreground ">
                    {formatDate(ay.enrollOpenDate)}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-2xl border shadow-inner">
                  <span className="text-[0.65rem] font-bold text-foreground uppercase  mb-1">
                    Closes
                  </span>
                  <span className="text-2xl font-black text-foreground ">
                    {formatDate(ay.enrollCloseDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="sticky bottom-0 z-20">
              <div className="rounded-lg border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {isTimelineDirty
                      ? "You have unsaved schedule changes."
                      : "No schedule changes yet."}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      className="font-bold"
                      onClick={discardChanges}
                      disabled={saving}>
                      Discard Changes
                    </Button>
                    <Button
                      className="font-bold"
                      onClick={handleSaveDates}
                      disabled={
                        saving ||
                        validationErrors.length > 0 ||
                        !isTimelineDirty
                      }>
                      {saving
                        ? "Updating Timeline..."
                        : "Save Schedule Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intake Assessment Configuration */}
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background rounded-lg border shadow-sm">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Intake Assessment Configuration
              </CardTitle>
              <CardDescription>S.Y. {ay.yearLabel}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <p className="text-sm text-muted-foreground">
            Controls whether a Phil-IRI reading assessment is required before
            learners can proceed through the admission pipeline.
          </p>

          {/* Toggle: New Admissions */}
          <div className="flex items-start justify-between gap-6 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <Label className="text-sm font-bold">
                  Require Reading Assessment for New Admissions
                </Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Applies to incoming Grade 7, transferees, and balik-aral
                learners. Disabling removes the baseline data required for the
                Tier 3 Sectioning Algorithm.
              </p>
            </div>
            <Switch
              checked={requireNew}
              onCheckedChange={(checked) => {
                if (!checked) {
                  setShowDisableNewWarning(true);
                } else {
                  setRequireNew(true);
                }
              }}
              disabled={savingAssessment}
            />
          </div>

          {/* Toggle: Continuing Learners */}
          <div className="flex items-start justify-between gap-6 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <Label className="text-sm font-bold">
                  Require Reading Assessment for Continuing Learners
                </Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Applies to returning learners confirming re-enrollment for this
                school year.
              </p>
            </div>
            <Switch
              checked={requireContinuing}
              onCheckedChange={setRequireContinuing}
              disabled={savingAssessment}
            />
          </div>

          <div className="flex justify-end">
            <Button
              className="font-bold"
              onClick={handleSaveAssessmentConfig}
              disabled={
                savingAssessment ||
                (requireNew === ay.requireReadingAssessmentNew &&
                  requireContinuing === ay.requireReadingAssessmentContinuing)
              }>
              {savingAssessment ? "Saving..." : "Save Assessment Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={showDisableNewWarning}
        onOpenChange={setShowDisableNewWarning}
        variant="warning"
        icon={AlertTriangle}
        title="Disable Assessment for New Admissions?"
        description="Disabling this removes the baseline data required for the Tier 3 Sectioning Algorithm. The system will fall back to randomized distribution for these learners. Are you sure you want to proceed?"
        confirmText="Yes, Disable Assessment"
        confirmClassName="border-destructive text-destructive hover:bg-destructive/10"
        onConfirm={() => {
          setRequireNew(false);
          setShowDisableNewWarning(false);
        }}
      />
    </div>
  );
}
