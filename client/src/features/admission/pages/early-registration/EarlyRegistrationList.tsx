import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Eye } from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { Label } from "@/shared/ui/label";
import { format } from "date-fns";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { Skeleton } from "@/shared/ui/skeleton";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { formatScpType, SCP_LABELS } from "@/shared/lib/utils";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";

interface Application {
  id: number;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  createdAt: string;
}

const APPLICANT_TYPES = [
  { value: "ALL", label: "All Curriculum Programs" },
  ...Object.entries(SCP_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const STAGE_QUICK_FILTERS = [
  { value: "ALL", label: "All Active" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "VERIFIED", label: "Verified" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "ASSESSMENT_SCHEDULED", label: "Exam Scheduled" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
];

const NEXT_ACTION_BY_STATUS: Record<string, string> = {
  SUBMITTED: "Verify Submission",
  VERIFIED: "Review Documents",
  UNDER_REVIEW: "Continue Review",
  FOR_REVISION: "Wait for Revision",
  ELIGIBLE: "Schedule Assessment",
  ASSESSMENT_SCHEDULED: "Record Results",
  ASSESSMENT_TAKEN: "Pass or Fail",
  INTERVIEW_SCHEDULED: "Finalize Interview",
  PASSED: "Pre-register",
  PRE_REGISTERED: "Finalize Enrollment",
  TEMPORARILY_ENROLLED: "Complete Enrollment",
  NOT_QUALIFIED: "Resolve Decision",
  REJECTED: "Review Appeal",
  WITHDRAWN: "No Action",
};

const DESKTOP_PANEL_BREAKPOINT = 1024;

export default function EarlyRegistration() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<
    Application | ApplicantDetail | null
  >(null);
  const [actionType, setActionType] = useState<
    "APPROVE" | "REJECT" | "ELIGIBLE" | null
  >(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<AssessmentStep | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [sections, setSections] = useState<
    {
      id: number;
      name: string;
      maxCapacity: number;
      _count: { enrollments: number };
    }[]
  >([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // --- Resizable Panel Logic (Fluid Percentage) ---
  const [panelPercentage, setPanelPercentage] = useState(45); // Default 45vw
  const isResizing = useRef(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= DESKTOP_PANEL_BREAKPOINT
      : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= DESKTOP_PANEL_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current || !isDesktopViewport) return;
      const newWidthPercent =
        ((window.innerWidth - e.clientX) / window.innerWidth) * 100;

      // Constraints: Between 20% and 95%
      if (newWidthPercent > 20 && newWidthPercent < 95) {
        setPanelPercentage(newWidthPercent);
      }
    },
    [isDesktopViewport],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) return;
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, isDesktopViewport, stopResizing]);
  // ------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));
      if (search) params.append("search", search);

      if (status !== "ALL") {
        params.append("status", status);
      }

      if (type !== "ALL") params.append("applicantType", type);
      params.append("page", String(page));
      params.append("limit", "50");

      const res = await api.get(`/early-registrations?${params.toString()}`);

      let filteredApps = res.data.data.map((app: any) => ({
        ...app,
        firstName: app.learner?.firstName || app.firstName,
        lastName: app.learner?.lastName || app.lastName,
        middleName: app.learner?.middleName || app.middleName,
        suffix: app.learner?.extensionName || app.suffix,
        lrn: app.learner?.lrn || app.lrn,
      }));

      if (status === "ALL") {
        filteredApps = filteredApps.filter(
          (app: Application) =>
            !["ENROLLED", "PRE_REGISTERED", "TEMPORARILY_ENROLLED"].includes(
              app.status,
            ),
        );
      }

      setApplications(filteredApps);
      setTotal(
        status === "ALL"
          ? res.data.pagination.total -
              (res.data.data.length - filteredApps.length)
          : res.data.pagination.total,
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, type, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchSections = async (glId: number) => {
    try {
      const res = await api.get(`/sections?gradeLevelId=${glId}`);
      setSections(res.data.sections);
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp || !selectedSectionId) return;
    try {
      await api.patch(`/early-registrations/${selectedApp.id}/approve`, {
        sectionId: parseInt(selectedSectionId),
      });
      sileo.success({
        title: "Pre-registered",
        description: "Student moved to Enrollment phase.",
      });
      setActionType(null);
      setSelectedId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleMarkEligible = async () => {
    if (!selectedApp) return;
    try {
      await api.patch(`/early-registrations/${selectedApp.id}/mark-eligible`);
      sileo.success({
        title: "Eligible",
        description: "Marked as eligible for assessment.",
      });
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    try {
      await api.patch(`/early-registrations/${selectedApp.id}/reject`, {
        rejectionReason,
      });
      sileo.success({
        title: "Rejected",
        description: "Application has been rejected.",
      });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleInlineSaveStepResult = async (
    stepOrder: number,
    kind: string,
    score: number,
    cutoffScore: number | null,
  ) => {
    if (!selectedId) return;
    try {
      const res = await api.patch(
        `/early-registrations/${selectedId}/record-step-result`,
        {
          stepOrder,
          kind,
          score,
          notes: "Recorded from BASIC EDUCATION EARLY REGISTRATION FORM portal",
        },
      );

      // Only auto-pass/fail if all required steps are done (status moved to ASSESSMENT_TAKEN)
      if (res.data?.status === "ASSESSMENT_TAKEN" && cutoffScore != null) {
        if (score >= cutoffScore) {
          await api.patch(`/early-registrations/${selectedId}/pass`);
        } else {
          await api.patch(`/early-registrations/${selectedId}/fail`);
        }
      }

      sileo.success({
        title: "Result Recorded",
        description: "Assessment result saved.",
      });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const stageCounts = STAGE_QUICK_FILTERS.reduce<Record<string, number>>(
    (acc, stage) => {
      acc[stage.value] =
        stage.value === "ALL"
          ? applications.length
          : applications.filter((app) => app.status === stage.value).length;
      return acc;
    },
    {},
  );

  const getNextAction = (currentStatus: string) =>
    NEXT_ACTION_BY_STATUS[currentStatus] ?? "Review Applicant";

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 overflow-auto px-2 sm:px-4 lg:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Early Registration Monitoring Dashboard
            </h1>
            <p className="text-sm sm:text-base font-bold text-muted-foreground">
              Applicant screening and assessment workflow
            </p>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="px-3 sm:px-6 pb-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                {STAGE_QUICK_FILTERS.map((stage) => (
                  <Button
                    key={stage.value}
                    type="button"
                    size="sm"
                    variant={status === stage.value ? "default" : "outline"}
                    className="h-9 sm:h-8 text-xs font-bold whitespace-nowrap shrink-0"
                    onClick={() => {
                      setStatus(stage.value);
                      setPage(1);
                    }}>
                    {stage.label}
                    <Badge
                      variant="secondary"
                      className="ml-2 h-5 px-1.5 text-[10px] shrink-0">
                      {stageCounts[stage.value] ?? 0}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Search Applicant
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                  <Input
                    placeholder="LRN, First Name, Last Name..."
                    className="pl-9 h-10 text-sm font-bold"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:flex gap-3 md:gap-4 w-full md:w-auto">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold ">
                    Curriculum Program
                  </Label>
                  <Select
                    value={type}
                    onValueChange={(value) => {
                      setType(value);
                      setPage(1);
                    }}>
                    <SelectTrigger className="h-10 w-full md:w-72 lg:w-80 text-sm font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICANT_TYPES.map((t) => (
                        <SelectItem
                          key={t.value}
                          value={t.value}
                          className="text-sm font-bold">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex w-full md:w-auto items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                  onClick={() => {
                    setSearch("");
                    setStatus("ALL");
                    setType("ALL");
                    setPage(1);
                  }}>
                  Reset
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="md:hidden space-y-3">
              {showSkeleton ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))
              ) : applications.length === 0 ? (
                <div className="rounded-xl border p-6 text-center text-sm font-bold">
                  No applicants found.
                </div>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className={`rounded-xl border bg-[hsl(var(--card))] p-3 transition-colors cursor-pointer ${
                      selectedId === app.id
                        ? "ring-2 ring-primary/30 border-primary/40"
                        : "hover:bg-[hsl(var(--muted))]"
                    }`}
                    onClick={() => setSelectedId(app.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm uppercase leading-tight break-words">
                          {app.lastName}, {app.firstName}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground truncate">
                          {app.trackingNumber}
                        </p>
                      </div>
                      <StatusBadge
                        status={app.status}
                        className="text-xs font-bold shrink-0"
                      />
                    </div>

                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold">
                          {app.gradeLevel.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {formatScpType(app.applicantType)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold shrink-0">
                        {getNextAction(app.status)}
                      </Badge>
                    </div>

                    <p className="mt-2 text-[11px] text-muted-foreground font-bold">
                      Submitted{" "}
                      {format(new Date(app.createdAt), "MMMM dd, yyyy")}
                    </p>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 h-9 w-full text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(app.id);
                      }}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      View Applicant
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block rounded-xl border overflow-hidden">
              <Table className="border-collapse">
                <TableHeader className="bg-[hsl(var(--primary))]">
                  <TableRow>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      APPLICANT
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground hidden md:table-cell text-sm">
                      LRN
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      GRADE LEVEL
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground hidden lg:table-cell text-sm">
                      CURRICULUM PROGRAM
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      STATUS
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground hidden lg:table-cell text-sm">
                      NEXT ACTION
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground hidden xl:table-cell text-sm">
                      DATE
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      ACTIONS
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showSkeleton ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-2 text-center flex flex-col items-center">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <div className="flex justify-center">
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex justify-center">
                            <Skeleton className="h-6 w-20 rounded-full" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <div className="flex justify-center">
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm">
                          <div className="flex justify-center">
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex justify-center">
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : applications.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-sm font-bold">
                        No applicants found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    applications.map((app) => (
                      <TableRow
                        key={app.id}
                        className={`hover:bg-[hsl(var(--muted))] transition-colors text-center cursor-pointer text-sm ${selectedId === app.id ? "bg-[hsl(var(--muted))] shadow-inner" : ""}`}
                        onClick={() => setSelectedId(app.id)}>
                        <TableCell>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-sm uppercase">
                              {app.lastName}, {app.firstName}
                            </span>
                            <span className="text-sm font-bold">
                              {app.trackingNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-bold">
                          {app.lrn}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-sm">
                            {app.gradeLevel.name}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            variant="outline"
                            className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
                            {formatScpType(app.applicantType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={app.status}
                            className="text-sm font-bold"
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            variant="secondary"
                            className="text-xs font-bold">
                            {getNextAction(app.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className=" text-sm hidden xl:table-cell font-bold">
                          {format(new Date(app.createdAt), "MMMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(app.id);
                            }}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 font-bold">
              <span className="text-xs sm:text-sm text-center md:text-left">
                Showing {applications.length} applicants
              </span>
              <div className="flex w-full md:w-auto items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}>
                  Previous
                </Button>
                <Badge variant="secondary" className="px-3 h-8 text-xs">
                  Page {page}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 50 >= total || loading}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 1 - SLIDE-OVER PANEL */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}>
        <SheetContent
          side="right"
          className="p-0 flex flex-row border-l-0 sm:border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
          style={
            isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
          }>
          {/* Resize Handle — hidden on mobile */}
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden lg:flex items-center justify-center group">
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          {selectedId && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <ApplicationDetailPanel
                id={selectedId}
                onClose={() => setSelectedId(null)}
                onApprove={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setActionType("APPROVE");
                    fetchSections(app.gradeLevelId);
                  }
                }}
                onReject={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setActionType("REJECT");
                  }
                }}
                onScheduleExam={async () => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setLoading(true);
                    try {
                      const fullRes = await api.get(
                        `/early-registrations/${selectedId}/detailed`,
                      );
                      setSelectedApp(fullRes.data);
                      setScheduleStep(null);
                      setIsScheduleDialogOpen(true);
                    } catch (err) {
                      toastApiError(err as never);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                onScheduleStep={async (step: AssessmentStep) => {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/early-registrations/${selectedId}/detailed`,
                    );
                    setSelectedApp(fullRes.data);
                    setScheduleStep(step);
                    setIsScheduleDialogOpen(true);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }}
                onSaveStepResult={handleInlineSaveStepResult}
                onRecordResult={() => {}}
                onPass={async () => {
                  try {
                    await api.patch(`/early-registrations/${selectedId}/pass`);
                    sileo.success({
                      title: "Passed",
                      description: "Applicant marked as PASSED.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onFail={async () => {
                  try {
                    await api.patch(`/early-registrations/${selectedId}/fail`);
                    sileo.success({
                      title: "Failed",
                      description: "Applicant marked as FAILED.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onOfferRegular={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setActionType("APPROVE");
                    fetchSections(app.gradeLevelId);
                  }
                }}
                onTemporarilyEnroll={async () => {
                  if (
                    !confirm(
                      "Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.",
                    )
                  )
                    return;
                  try {
                    await api.patch(
                      `/early-registrations/${selectedId}/temporarily-enroll`,
                    );
                    sileo.success({
                      title: "Updated",
                      description: "Applicant is now temporarily enrolled.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onScheduleInterview={async () => {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/early-registrations/${selectedId}/detailed`,
                    );
                    const fullApp = fullRes.data as ApplicantDetail;
                    setSelectedApp(fullApp);
                    // Find interview step in pipeline
                    const interviewStep = fullApp.assessmentSteps?.find(
                      (s) => s.kind === "INTERVIEW" && s.status !== "COMPLETED",
                    );
                    setScheduleStep(interviewStep || null);
                    setIsScheduleDialogOpen(true);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }}
                onMarkInterviewPassed={async () => {
                  try {
                    await api.patch(
                      `/early-registrations/${selectedId}/mark-interview-passed`,
                    );
                    sileo.success({
                      title: "Interview Passed",
                      description:
                        "Applicant marked as eligible for enrollment (Pre-registered).",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Action Dialogs */}
      <Dialog
        open={actionType !== null}
        onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold">
              {actionType === "APPROVE" && "Approve & Pre-register"}
              {actionType === "ELIGIBLE" && "Mark as Eligible"}
              {actionType === "REJECT" && "Reject Application"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Candidate: {selectedApp?.lastName}, {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          {actionType === "ELIGIBLE" && (
            <div className="py-4">
              <p className="text-xs sm:text-sm">
                Marking this applicant as{" "}
                <span className="font-bold text-cyan-700">ELIGIBLE</span> means
                their documents are verified and they are cleared for assessment
                or direct pre-registration.
              </p>
            </div>
          )}

          {actionType === "APPROVE" && (
            <div className="space-y-4 py-4">
              <p className="text-xs sm:text-sm text-emerald-700 font-medium">
                This candidate will be moved to the Enrollment phase and
                assigned to a section.
              </p>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">
                  Select Section for {selectedApp?.gradeLevel.name}
                </Label>
                <Select
                  value={selectedSectionId}
                  onValueChange={setSelectedSectionId}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Choose a section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={String(s.id)}
                        disabled={s._count.enrollments >= s.maxCapacity}
                        className="text-xs sm:text-sm">
                        {s.name} ({s._count.enrollments}/{s.maxCapacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {actionType === "REJECT" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">
                  Reason for Rejection
                </Label>
                <textarea
                  className="w-full min-h-[96px] sm:min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-xs sm:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Explain why this application is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionType(null)}
              className="text-xs sm:text-sm h-9">
              Cancel
            </Button>
            {actionType === "ELIGIBLE" && (
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-xs sm:text-sm h-9"
                onClick={handleMarkEligible}>
                Confirm Eligibility
              </Button>
            )}
            {actionType === "APPROVE" && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm h-9"
                onClick={handleApprove}
                disabled={!selectedSectionId}>
                Confirm Pre-registration
              </Button>
            )}
            {actionType === "REJECT" && (
              <Button
                variant="default"
                onClick={handleReject}
                disabled={!rejectionReason}
                className="text-xs sm:text-sm h-9">
                Reject Application
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScheduleExamDialog
        open={isScheduleDialogOpen}
        onOpenChange={isScheduleDialogOpen ? setIsScheduleDialogOpen : () => {}}
        applicant={selectedApp as ApplicantDetail | null}
        step={scheduleStep}
        onSuccess={fetchData}
        onCloseSheet={() => setSelectedId(null)}
      />
    </div>
  );
}
