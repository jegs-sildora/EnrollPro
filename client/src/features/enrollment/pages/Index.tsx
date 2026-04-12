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
import { Skeleton } from "@/shared/ui/skeleton";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { format } from "date-fns";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
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
  section?: { name: string } | null;
}

export default function Enrollment() {
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
  const [page, setPage] = useState(1);

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<
    Application | ApplicantDetail | null
  >(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<AssessmentStep | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // --- Resizable Panel Logic (Fluid Percentage) ---
  const [panelPercentage, setPanelPercentage] = useState(45);
  const isResizing = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidthPercent =
      ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
    if (newWidthPercent > 20 && newWidthPercent < 95) {
      setPanelPercentage(newWidthPercent);
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, stopResizing]);
  // ------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      if (status !== "ALL") {
        params.append("status", status);
      }

      params.append("page", String(page));
      params.append("limit", "15");

      const res = await api.get(`/applications?${params.toString()}`);

      let filteredApps = res.data.applications;
      if (status === "ALL") {
        filteredApps = filteredApps.filter((app: Application) =>
          ["PRE_REGISTERED", "ENROLLED"].includes(app.status),
        );
      }

      setApplications(filteredApps);
      setTotal(
        status === "ALL"
          ? res.data.total -
              (res.data.applications.length - filteredApps.length)
          : res.data.total,
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEnroll = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.patch(`/applications/${selectedApp.id}/enroll`);

      setIsEnrollModalOpen(false);
      fetchData();

      if (res.data.rawPortalPin) {
        alert(
          `SUCCESS: Official enrollment confirmed.\n\nIMPORTANT: The Learner Portal PIN is ${res.data.rawPortalPin}\n\nPlease write this down on the enrollment slip. This PIN will only be shown once.`,
        );
      } else {
        sileo.success({
          title: "Enrolled",
          description: "Official enrollment confirmed.",
        });
      }
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 overflow-auto px-2 sm:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Enrollment Management
            </h1>
            <p className="font-bold">
              Finalize registration and section assignments
            </p>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="px-3 sm:px-6 pb-3">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label className="text-sm uppercase tracking-wider font-bold">
                  Search Student
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                  <Input
                    placeholder="LRN, First Name, Last Name..."
                    className="pl-9 h-10 text-sm font-bold"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:flex gap-3 md:gap-4 w-full md:w-auto">
                <div className="space-y-2">
                  <Label className="text-sm uppercase tracking-wider font-bold">
                    Enrollment Status
                  </Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-10 md:w-56 text-sm font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-sm font-bold">
                        All Enrolling
                      </SelectItem>
                      <SelectItem
                        value="PRE_REGISTERED"
                        className="text-sm font-bold">
                        Pre-registered
                      </SelectItem>
                      <SelectItem
                        value="ENROLLED"
                        className="text-sm font-bold">
                        Officially Enrolled
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="outline"
                className="h-10 px-3 w-full md:w-auto text-sm font-bold"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                }}>
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="rounded-xl border overflow-hidden">
              <Table className="border-collapse">
                <TableHeader className="bg-[hsl(var(--primary))]">
                  <TableRow>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      STUDENT
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground hidden md:table-cell text-sm">
                      LRN
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      GRADE LEVEL
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground hidden lg:table-cell text-sm">
                      SECTION
                    </TableHead>
                    <TableHead className="text-center font-bold text-primary-foreground text-sm">
                      STATUS
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
                        colSpan={7}
                        className="h-24 text-center text-sm font-bold">
                        No students found.
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
                            Grade {app.gradeLevel.name}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            variant="outline"
                            className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
                            {app.section?.name ?? "Not Assigned"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={app.status}
                            className="text-sm font-bold"
                          />
                        </TableCell>
                        <TableCell className="text-sm hidden xl:table-cell font-bold">
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

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
              <span className="text-xs">
                Showing {applications.length} students
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}>
                  Previous
                </Button>
                <Badge variant="secondary" className="px-3 h-8 text-xs">
                  Page {page}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 text-xs"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 15 >= total}>
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
          className="p-0 flex flex-row border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
          style={
            typeof window !== "undefined" && window.innerWidth >= 640
              ? { width: `${panelPercentage}vw` }
              : undefined
          }>
          {/* Resize Handle — hidden on mobile */}
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
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
                    setIsEnrollModalOpen(true);
                  }
                }}
                onReject={() => {
                  /* not applicable in enrollment phase */
                }}
                onScheduleExam={async () => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setLoading(true);
                    try {
                      const fullRes = await api.get(
                        `/applications/${selectedId}`,
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
                      `/applications/${selectedId}`,
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
                onRecordStepResult={async (step: AssessmentStep) => {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/applications/${selectedId}`,
                    );
                    setSelectedApp(fullRes.data);
                    setScheduleStep(step);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }}
                onRecordResult={() => {
                  /* not primary in enrollment phase */
                }}
                onPass={async () => {
                  try {
                    await api.patch(`/applications/${selectedId}/pass`);
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
                    await api.patch(`/applications/${selectedId}/fail`);
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
                    setIsEnrollModalOpen(true);
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
                      `/applications/${selectedId}/temporarily-enroll`,
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
                      `/applications/${selectedId}`,
                    );
                    const fullApp = fullRes.data as ApplicantDetail;
                    setSelectedApp(fullApp);
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
                      `/applications/${selectedId}/mark-interview-passed`,
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

      {/* Enrollment Confirmation Dialog */}
      <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs">
              Official Enrollment Confirmation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirming enrollment for {selectedApp?.lastName},{" "}
              {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-xs">
              This action confirms the{" "}
              <span className="font-bold text-green-700">
                OFFICIAL ENROLLMENT
              </span>{" "}
              for Phase 2.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700">Section:</span>
                <span className="font-bold">
                  {"section" in (selectedApp ?? {})
                    ? (selectedApp as Application)?.section?.name
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700">Grade Level:</span>
                <span className="font-bold">
                  {selectedApp?.gradeLevel.name}
                </span>
              </div>
            </div>
            <p className="text-xs mt-4 italic">
              Ensure all physical documents (PSA, SF9) have been verified in
              person before proceeding.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEnrollModalOpen(false)}
              className="text-xs">
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-xs"
              onClick={handleEnroll}>
              Confirm Official Enrollment
            </Button>
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
