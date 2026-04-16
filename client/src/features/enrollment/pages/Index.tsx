import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { Search, Eye, Download } from "lucide-react";
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
import { EnrollmentWorkflowTabs } from "@/features/enrollment/components/EnrollmentWorkflowTabs";
import {
  ENROLLMENT_SUB_MENU_DESCRIPTIONS,
  ENROLLMENT_SUB_MENU_OPTIONS,
  PENDING_VERIFICATION_STATUSES,
  SECTION_ASSIGNMENT_STATUSES,
  type EnrollmentSubMenu,
} from "@/features/enrollment/workflow.constants";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";

interface Application {
  id: number;
  lrn: string;
  isPendingLrnCreation: boolean;
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
  enrollmentRecord?: {
    sectionId: number;
    section?: { id: number; name: string } | null;
  } | null;
  section?: { name: string } | null;
}

interface SectionOption {
  id: number;
  name: string;
  maxCapacity: number;
  enrolledCount: number;
  availableSlots: number;
  isFull: boolean;
}

function formatGradeLevelLabel(gradeLevelName: string): string {
  if (/^grade\s+/i.test(gradeLevelName)) {
    return gradeLevelName;
  }
  return `Grade ${gradeLevelName}`;
}

function resolveApplicationSectionName(
  application: Application,
): string | null {
  return (
    application.enrollmentRecord?.section?.name ??
    application.section?.name ??
    null
  );
}

function resolveSelectedApplicationSectionName(
  selectedApp: Application | ApplicantDetail | null,
): string | null {
  if (!selectedApp) return null;

  if ("enrollment" in selectedApp && selectedApp.enrollment?.section?.name) {
    return selectedApp.enrollment.section.name;
  }

  if (
    "enrollmentRecord" in selectedApp &&
    selectedApp.enrollmentRecord?.section?.name
  ) {
    return selectedApp.enrollmentRecord.section.name;
  }

  if ("section" in selectedApp && selectedApp.section?.name) {
    return selectedApp.section.name;
  }

  return null;
}

function resolveWorkflowFromQuery(value: string | null): EnrollmentSubMenu {
  if (!value) {
    return "PENDING_VERIFICATION";
  }

  const matched = ENROLLMENT_SUB_MENU_OPTIONS.some(
    (option) => option.value === value,
  );

  return matched ? (value as EnrollmentSubMenu) : "PENDING_VERIFICATION";
}

export default function Enrollment() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const [searchParams] = useSearchParams();
  const workflowParam = searchParams.get("workflow");
  const searchParam = searchParams.get("search");

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExportingLis, setIsExportingLis] = useState(false);
  const [workflowView, setWorkflowView] = useState<EnrollmentSubMenu>(
    () => resolveWorkflowFromQuery(workflowParam),
  );

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  // Filters
  const [search, setSearch] = useState(() => searchParam?.trim() ?? "");
  const [page, setPage] = useState(1);

  const [sectionOptionsByApplicationId, setSectionOptionsByApplicationId] =
    useState<Record<number, SectionOption[]>>({});
  const [sectionSelectionByApplicationId, setSectionSelectionByApplicationId] =
    useState<Record<number, string>>({});
  const [
    loadingSectionOptionsByApplicationId,
    setLoadingSectionOptionsByApplicationId,
  ] = useState<Record<number, boolean>>({});
  const [savingSectionByApplicationId, setSavingSectionByApplicationId] =
    useState<Record<number, boolean>>({});

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

  useEffect(() => {
    if (!workflowParam && searchParam === null) {
      return;
    }

    if (workflowParam) {
      setWorkflowView(resolveWorkflowFromQuery(workflowParam));
    }

    if (searchParam !== null) {
      setSearch(searchParam.trim());
    }

    setPage(1);
  }, [workflowParam, searchParam]);

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

      if (workflowView === "PENDING_VERIFICATION") {
        params.append("status", "UNDER_REVIEW");
      }

      if (workflowView === "SECTION_ASSIGNMENT") {
        params.append("status", "VERIFIED");
        params.append("withoutSection", "true");
      }

      if (workflowView === "OFFICIAL_ROSTER") {
        params.append("status", "ENROLLED");
        params.append("withSection", "true");
      }

      params.append("page", String(page));
      params.append("limit", "15");

      const res = await api.get(`/applications?${params.toString()}`);

      let filteredApps = (res.data.applications as Application[]).map(
        (app) => ({
          ...app,
          lrn: app.lrn || "",
          isPendingLrnCreation: Boolean(
            (app as unknown as { isPendingLrnCreation?: boolean })
              .isPendingLrnCreation,
          ),
        }),
      );

      filteredApps = filteredApps.filter((app) => {
        const hasSection = Boolean(resolveApplicationSectionName(app));

        if (workflowView === "PENDING_VERIFICATION") {
          return PENDING_VERIFICATION_STATUSES.has(app.status);
        }

        if (workflowView === "SECTION_ASSIGNMENT") {
          return SECTION_ASSIGNMENT_STATUSES.has(app.status) && !hasSection;
        }

        return app.status === "ENROLLED" && hasSection;
      });

      setApplications(filteredApps);

      const apiTotal = Number(
        res.data?.total ?? res.data?.pagination?.total ?? filteredApps.length,
      );
      setTotal(apiTotal);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, page, workflowView]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ensureSectionOptionsLoaded = useCallback(
    async (applicationId: number) => {
      if (sectionOptionsByApplicationId[applicationId]) {
        return;
      }

      setLoadingSectionOptionsByApplicationId((prev) => ({
        ...prev,
        [applicationId]: true,
      }));

      try {
        const response = await api.get(
          `/applications/${applicationId}/sections`,
        );
        setSectionOptionsByApplicationId((prev) => ({
          ...prev,
          [applicationId]: response.data.sections ?? [],
        }));
      } catch (err) {
        toastApiError(err as never);
      } finally {
        setLoadingSectionOptionsByApplicationId((prev) => ({
          ...prev,
          [applicationId]: false,
        }));
      }
    },
    [sectionOptionsByApplicationId],
  );

  const handleAssignAndEnroll = useCallback(
    async (application: Application) => {
      const selectedSectionId = sectionSelectionByApplicationId[application.id];
      if (!selectedSectionId) {
        sileo.error({
          title: "Section Required",
          description: "Select a section before assigning and enrolling.",
        });
        return;
      }

      setSavingSectionByApplicationId((prev) => ({
        ...prev,
        [application.id]: true,
      }));

      try {
        await api.patch(`/applications/${application.id}/approve`, {
          sectionId: Number(selectedSectionId),
        });

        const enrollResponse = await api.patch(
          `/applications/${application.id}/enroll`,
        );

        setSectionSelectionByApplicationId((prev) => {
          const next = { ...prev };
          delete next[application.id];
          return next;
        });

        sileo.success({
          title: "Assigned & Enrolled",
          description: `${application.lastName}, ${application.firstName} is now officially enrolled.`,
        });

        if (enrollResponse.data?.rawPortalPin) {
          alert(
            `SUCCESS: Official enrollment confirmed.\n\nIMPORTANT: The Learner Portal PIN is ${enrollResponse.data.rawPortalPin}\n\nPlease write this down on the enrollment slip. This PIN will only be shown once.`,
          );
        }

        await fetchData();
      } catch (err) {
        toastApiError(err as never);
      } finally {
        setSavingSectionByApplicationId((prev) => ({
          ...prev,
          [application.id]: false,
        }));
      }
    },
    [sectionSelectionByApplicationId, fetchData],
  );


  const handleExportLis = async () => {
    if (workflowView !== "OFFICIAL_ROSTER") {
      sileo.error({
        title: "Official Roster Required",
        description:
          "Switch to Official Roster before exporting LIS Master CSV.",
      });
      return;
    }

    if (!ayId) return;

    setIsExportingLis(true);
    try {
      const response = await api.get("/applications/exports/lis-master", {
        params: { schoolYearId: ayId },
        responseType: "blob",
      });

      const contentDisposition =
        (response.headers?.["content-disposition"] as string | undefined) ?? "";
      const fileNameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i,
      );
      const fileName = fileNameMatch?.[1]
        ? decodeURIComponent(fileNameMatch[1].replace(/"/g, ""))
        : `lis-master-${ayId}.csv`;

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      sileo.success({
        title: "LIS Export Ready",
        description: "Master CSV downloaded successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsExportingLis(false);
    }
  };

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

  const selectedAppSectionName =
    resolveSelectedApplicationSectionName(selectedApp);
  const canConfirmOfficialEnrollment = Boolean(selectedAppSectionName);

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 overflow-auto px-2 sm:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Enrollment Management
            </h1>
            <p className="font-bold">
              {ENROLLMENT_SUB_MENU_DESCRIPTIONS[workflowView]}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-10 px-3 w-full md:w-auto text-sm font-bold"
            onClick={handleExportLis}
            disabled={
              isExportingLis || !ayId || workflowView !== "OFFICIAL_ROSTER"
            }>
            <Download className="h-4 w-4 mr-2" />
            {isExportingLis
              ? "Exporting LIS..."
              : workflowView === "OFFICIAL_ROSTER"
                ? "Export LIS Master CSV"
                : "Export LIS (Official Roster Only)"}
          </Button>
        </div>

        <EnrollmentWorkflowTabs
          value={workflowView}
          onValueChange={(nextView) => {
            setWorkflowView(nextView);
            setPage(1);
          }}
        />

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
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              <Button
                variant="outline"
                className="h-10 px-3 w-full md:w-auto text-sm font-bold"
                onClick={() => {
                  setSearch("");
                  setPage(1);
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
                            <Skeleton className="h-9 w-36" />
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
                    applications.map((app) => {
                      const sectionName = resolveApplicationSectionName(app);
                      const hasSection = Boolean(sectionName);
                      const isPendingVerification =
                        workflowView === "PENDING_VERIFICATION";
                      const isSectionAssignment =
                        workflowView === "SECTION_ASSIGNMENT";
                      const selectedSectionId =
                        sectionSelectionByApplicationId[app.id] ?? "";
                      const sectionOptions =
                        sectionOptionsByApplicationId[app.id] ?? [];
                      const isLoadingOptions =
                        loadingSectionOptionsByApplicationId[app.id] === true;
                      const isSavingSection =
                        savingSectionByApplicationId[app.id] === true;

                      return (
                        <TableRow
                          key={app.id}
                          className={`hover:bg-[hsl(var(--muted))] transition-colors text-center cursor-pointer text-sm ${selectedId === app.id ? "bg-[hsl(var(--muted))] shadow-inner" : ""}`}
                          onClick={() => setSelectedId(app.id)}>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-left">
                              <span className="font-bold text-sm uppercase">
                                {app.lastName}, {app.firstName}
                              </span>
                              <span className="text-sm font-bold">
                                {app.trackingNumber}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="hidden md:table-cell text-sm font-bold">
                            {app.lrn ||
                              (app.isPendingLrnCreation ? "PENDING" : "N/A")}
                          </TableCell>

                          <TableCell>
                            <span className="font-bold text-sm">
                              {formatGradeLevelLabel(app.gradeLevel.name)}
                            </span>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell">
                            {isSectionAssignment && !hasSection ? (
                              <div
                                className="flex items-center justify-center gap-2"
                                onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={selectedSectionId}
                                  onValueChange={(value) =>
                                    setSectionSelectionByApplicationId(
                                      (prev) => ({
                                        ...prev,
                                        [app.id]: value,
                                      }),
                                    )
                                  }
                                  onOpenChange={(open) => {
                                    if (open) {
                                      void ensureSectionOptionsLoaded(app.id);
                                    }
                                  }}>
                                  <SelectTrigger className="h-8 w-40 text-xs font-bold">
                                    <SelectValue placeholder="Select section" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isLoadingOptions && (
                                      <SelectItem value="LOADING" disabled>
                                        Loading sections...
                                      </SelectItem>
                                    )}
                                    {!isLoadingOptions &&
                                      sectionOptions.length === 0 && (
                                        <SelectItem
                                          value="NO_SECTION_AVAILABLE"
                                          disabled>
                                          No sections available
                                        </SelectItem>
                                      )}
                                    {sectionOptions.map((section) => (
                                      <SelectItem
                                        key={section.id}
                                        value={String(section.id)}
                                        disabled={section.isFull}>
                                        {section.name} ({section.enrolledCount}/
                                        {section.maxCapacity})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
                                {sectionName ?? "Not Assigned"}
                              </Badge>
                            )}
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
                              variant={
                                isPendingVerification || isSectionAssignment
                                  ? "default"
                                  : "secondary"
                              }
                              size="sm"
                              className={
                                isPendingVerification || isSectionAssignment
                                  ? "h-8 bg-[hsl(var(--primary))] text-sm font-bold text-primary-foreground hover:opacity-90"
                                  : "h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSectionAssignment) {
                                  void handleAssignAndEnroll(app);
                                  return;
                                }

                                setSelectedId(app.id);
                              }}
                              disabled={
                                isSectionAssignment &&
                                (!selectedSectionId || isSavingSection)
                              }
                              title={
                                isSectionAssignment && !selectedSectionId
                                  ? "Select a section before assigning and enrolling."
                                  : undefined
                              }>
                              {isPendingVerification ? (
                                "Verify Physical Documents"
                              ) : isSectionAssignment ? (
                                isSavingSection ? "Assigning..." : "Assign & Enroll"
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-1" /> View
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
              <span className="text-xs">
                Showing {applications.length} students in{" "}
                {
                  ENROLLMENT_SUB_MENU_OPTIONS.find(
                    (option) => option.value === workflowView,
                  )?.label
                }
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
                onAssignLrn={async () => {
                  const raw = window.prompt(
                    "Enter the learner's 12-digit LRN:",
                  );
                  if (!raw) return;
                  const lrn = raw.trim();

                  if (!/^\d{12}$/.test(lrn)) {
                    sileo.error({
                      title: "Invalid LRN",
                      description: "LRN must be exactly 12 digits.",
                    });
                    return;
                  }

                  try {
                    await api.patch(`/applications/${selectedId}/assign-lrn`, {
                      lrn,
                    });
                    sileo.success({
                      title: "LRN Assigned",
                      description: "Learner record updated successfully.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onEnroll={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setIsEnrollModalOpen(true);
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
                      title: "Ready for Enrollment",
                      description:
                        "Learner moved to Ready for Enrollment status.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onMarkVerified={async () => {
                  try {
                    await api.patch(`/applications/${selectedId}/verify`);
                    sileo.success({
                      title: "Verified",
                      description:
                        "Physical documents verified. Learner is now ready for section assignment.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onSetProfileLock={async (lock) => {
                  if (selectedId === null) return;

                  const actionVerb = lock ? "lock" : "unlock";
                  const confirmed = window.confirm(
                    `Are you sure you want to ${actionVerb} this enrollment profile?`,
                  );
                  if (!confirmed) return;

                  const reasonInput = window
                    .prompt(
                      `Optional reason to ${actionVerb} this enrollment profile:`,
                    )
                    ?.trim();

                  try {
                    await api.patch(
                      `/applications/${selectedId}/profile-lock`,
                      {
                        lock,
                        reason: reasonInput || undefined,
                      },
                    );
                    sileo.success({
                      title: lock ? "Profile Locked" : "Profile Unlocked",
                      description: lock
                        ? "Enrollment profile updates are now restricted."
                        : "Enrollment profile updates are now allowed.",
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
                  {selectedAppSectionName ?? "Not Assigned"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700">Grade Level:</span>
                <span className="font-bold">
                  {selectedApp?.gradeLevel?.name
                    ? formatGradeLevelLabel(selectedApp.gradeLevel.name)
                    : "N/A"}
                </span>
              </div>
            </div>
            {!canConfirmOfficialEnrollment && (
              <p className="text-xs mt-2 font-bold text-amber-700">
                Official enrollment is locked until a section is assigned.
              </p>
            )}
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
              disabled={!canConfirmOfficialEnrollment}
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
