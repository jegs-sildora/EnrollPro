import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search,
  Eye,
  Download,
  RefreshCw,
  FileCheck2,
  School,
  UserPlus,
  LogOut,
  ChevronDown,
  UserCheck,
  Zap,
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { formatScpType } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Checkbox } from "@/shared/ui/checkbox";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { format } from "date-fns";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { EnrollmentWorkflowTabs } from "@/features/enrollment/components/EnrollmentWorkflowTabs";
import { OneTimePinSuccessDialog } from "@/features/enrollment/components/OneTimePinSuccessDialog";
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
  learnerType?: string;
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
  readingProfileLevel?: ReadingProfileLevel | null;
  readingProfileNotes?: string | null;
  readingProfileAssessedAt?: string | null;
  readingProfileAssessedById?: number | null;
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

interface PortalPinDialogData {
  learnerName: string;
  trackingNumber: string;
  sectionName: string;
  gradeLevelLabel: string;
  portalPin: string;
}

type PendingQueueFilter = "ALL" | "INCOMING_G7" | "CONTINUING_JHS";
type WalkInRouteType = "new-learner" | "transferee" | "pept" | "balik-aral";
type ReadingProfileLevel =
  | "INDEPENDENT"
  | "INSTRUCTIONAL"
  | "FRUSTRATION"
  | "NON_READER";

const PENDING_QUEUE_FILTER_OPTIONS: Array<{
  value: PendingQueueFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "INCOMING_G7", label: "Incoming G7" },
  { value: "CONTINUING_JHS", label: "Continuing JHS" },
];

const UNENROLL_REASONS = [
  "Data Entry Error",
  "Transferred before opening of classes",
  "Requested withdrawal by guardian",
  "Duplicate enrollment record",
  "Other registrar correction",
] as const;

const READING_PROFILE_LEVEL_OPTIONS: Array<{
  value: ReadingProfileLevel;
  label: string;
}> = [
  { value: "INDEPENDENT", label: "Independent" },
  { value: "INSTRUCTIONAL", label: "Instructional" },
  { value: "FRUSTRATION", label: "Frustration" },
  { value: "NON_READER", label: "Non-reader" },
];

const READING_PROFILE_LABELS: Record<ReadingProfileLevel, string> =
  Object.fromEntries(
    READING_PROFILE_LEVEL_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<ReadingProfileLevel, string>;

function resolveReadingProfileLabel(level?: string | null): string {
  if (!level) {
    return "Not Set";
  }

  return (
    READING_PROFILE_LABELS[level as ReadingProfileLevel] ??
    level
      .toLowerCase()
      .split("_")
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ")
  );
}

function extractGradeLevelNumber(rawGradeLevel: string): number | null {
  const match = rawGradeLevel.match(/\d+/);
  if (!match) return null;

  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatGradeLevelLabel(gradeLevelName: string): string {
  if (/^grade\s+/i.test(gradeLevelName)) {
    return gradeLevelName;
  }
  return `Grade ${gradeLevelName}`;
}

function formatLearnerDisplayName(lastName: string, firstName: string): string {
  return `${lastName}, ${firstName}`;
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workflowParam = searchParams.get("workflow");
  const searchParam = searchParams.get("search");

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExportingLis, setIsExportingLis] = useState(false);
  const [workflowView, setWorkflowView] = useState<EnrollmentSubMenu>(() =>
    resolveWorkflowFromQuery(workflowParam),
  );

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  // Filters
  const [search, setSearch] = useState(() => searchParam?.trim() ?? "");
  const [page, setPage] = useState(1);
  const [pendingQueueFilter, setPendingQueueFilter] =
    useState<PendingQueueFilter>("ALL");

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
  const [portalPinDialogData, setPortalPinDialogData] =
    useState<PortalPinDialogData | null>(null);

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<
    Application | ApplicantDetail | null
  >(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<AssessmentStep | null>(null);

  const [unenrollDialog, setUnenrollDialog] = useState<{
    open: boolean;
    application: Application | null;
    reason: string;
    note: string;
  }>({
    open: false,
    application: null,
    reason: "",
    note: "",
  });

  const [readingProfileDialog, setReadingProfileDialog] = useState<{
    open: boolean;
    application: Application | null;
    level: ReadingProfileLevel | "";
    notes: string;
    saving: boolean;
  }>({
    open: false,
    application: null,
    level: "",
    notes: "",
    saving: false,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Batch Selection state
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);
  const [batchSectionId, setBatchSectionId] = useState<string>("");
  const [isBatchAssignModalOpen, setIsBatchAssignModalOpen] = useState(false);
  const [batchSectionOptions, setBatchSectionOptions] = useState<
    SectionOption[]
  >([]);
  const [batchSectionOptionsLoading, setBatchSectionOptionsLoading] =
    useState(false);

  const visibleApplications = useMemo(() => {
    if (workflowView !== "PENDING_VERIFICATION") {
      return applications;
    }

    if (pendingQueueFilter === "ALL") {
      return applications;
    }

    return applications.filter((application) => {
      const gradeLevelNumber = extractGradeLevelNumber(
        application.gradeLevel.name,
      );

      if (pendingQueueFilter === "INCOMING_G7") {
        return gradeLevelNumber === 7;
      }

      return application.learnerType === "CONTINUING";
    });
  }, [applications, pendingQueueFilter, workflowView]);

  const visibleApplicationIds = useMemo(
    () => visibleApplications.map((application) => application.id),
    [visibleApplications],
  );

  const isAllVisibleSelected = useMemo(
    () =>
      visibleApplicationIds.length > 0 &&
      visibleApplicationIds.every((id) => selectedBatchIds.includes(id)),
    [visibleApplicationIds, selectedBatchIds],
  );

  const toggleBatchSelect = useCallback((id: number) => {
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const selectAllVisible = useCallback(() => {
    if (visibleApplicationIds.length === 0) return;

    if (isAllVisibleSelected) {
      setSelectedBatchIds((prev) =>
        prev.filter((id) => !visibleApplicationIds.includes(id)),
      );
      return;
    }

    setSelectedBatchIds((prev) =>
      Array.from(new Set([...prev, ...visibleApplicationIds])),
    );
  }, [isAllVisibleSelected, visibleApplicationIds]);

  const openWalkInEncoder = useCallback(
    (type: WalkInRouteType) => {
      navigate(`/monitoring/enrollment/walk-in?type=${type}`);
    },
    [navigate],
  );

  const handlePortalPinAcknowledge = useCallback(() => {
    setPortalPinDialogData(null);
    setSelectedId(null);
    setWorkflowView("PENDING_VERIFICATION");
    setPendingQueueFilter("ALL");
    setPage(1);
    navigate("/monitoring/enrollment?workflow=PENDING_VERIFICATION");
  }, [navigate]);

  const openBatchAssignModal = useCallback(async () => {
    if (selectedBatchIds.length === 0) {
      sileo.error({
        title: "No Learners Selected",
        description: "Select at least one learner before opening batch action.",
      });
      return;
    }

    const selectedApplications = applications.filter((application) =>
      selectedBatchIds.includes(application.id),
    );
    const missingReadingProfile = selectedApplications.filter(
      (application) => !application.readingProfileLevel,
    );

    if (missingReadingProfile.length > 0) {
      sileo.error({
        title: "Reading Profile Required",
        description:
          "Encode Reading Profile first for all selected learners before batch section assignment.",
      });
      return;
    }

    setBatchSectionId("");
    setBatchSectionOptions([]);
    setIsBatchAssignModalOpen(true);
    setBatchSectionOptionsLoading(true);

    try {
      const response = await api.get(
        `/applications/${selectedBatchIds[0]}/sections`,
      );
      setBatchSectionOptions(response.data.sections ?? []);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setBatchSectionOptionsLoading(false);
    }
  }, [applications, selectedBatchIds]);

  const openReadingProfileDialog = useCallback((application: Application) => {
    const isKnownReadingProfile = READING_PROFILE_LEVEL_OPTIONS.some(
      (option) => option.value === application.readingProfileLevel,
    );

    setReadingProfileDialog({
      open: true,
      application,
      level: isKnownReadingProfile
        ? (application.readingProfileLevel as ReadingProfileLevel)
        : "",
      notes: application.readingProfileNotes ?? "",
      saving: false,
    });
  }, []);

  const closeReadingProfileDialog = useCallback(() => {
    setReadingProfileDialog({
      open: false,
      application: null,
      level: "",
      notes: "",
      saving: false,
    });
  }, []);

  const handleSaveReadingProfile = useCallback(async () => {
    if (!readingProfileDialog.application) {
      return;
    }

    if (!readingProfileDialog.level) {
      sileo.error({
        title: "Reading Profile Required",
        description: "Select a Reading Profile level before saving.",
      });
      return;
    }

    const applicationId = readingProfileDialog.application.id;
    const readingProfileLevel: ReadingProfileLevel = readingProfileDialog.level;
    const readingProfileNotes = readingProfileDialog.notes.trim() || null;

    setReadingProfileDialog((prev) => ({ ...prev, saving: true }));

    try {
      await api.patch(`/applications/${applicationId}/reading-profile`, {
        readingProfileLevel,
        readingProfileNotes,
      });

      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                readingProfileLevel,
                readingProfileNotes,
              }
            : application,
        ),
      );

      sileo.success({
        title: "Reading Profile Saved",
        description:
          "Reading Profile was encoded successfully. You can now proceed to section assignment.",
      });

      closeReadingProfileDialog();
    } catch (err) {
      toastApiError(err as never);
      setReadingProfileDialog((prev) => ({ ...prev, saving: false }));
    }
  }, [closeReadingProfileDialog, readingProfileDialog]);

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
        params.append(
          "status",
          Array.from(PENDING_VERIFICATION_STATUSES).join(","),
        );
        params.append("withoutSection", "true");
      }

      if (workflowView === "SECTION_ASSIGNMENT") {
        params.append(
          "status",
          Array.from(SECTION_ASSIGNMENT_STATUSES).join(","),
        );
        params.append("withoutSection", "true");
      }

      if (workflowView === "OFFICIAL_ROSTER") {
        params.append("status", "OFFICIALLY_ENROLLED,ENROLLED");
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
          return PENDING_VERIFICATION_STATUSES.has(app.status) && !hasSection;
        }

        if (workflowView === "SECTION_ASSIGNMENT") {
          return SECTION_ASSIGNMENT_STATUSES.has(app.status) && !hasSection;
        }

        return (
          (app.status === "OFFICIALLY_ENROLLED" || app.status === "ENROLLED") &&
          hasSection
        );
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
      if (!application.readingProfileLevel) {
        sileo.error({
          title: "Reading Profile Required",
          description:
            "Encode Reading Profile before assigning this learner to a section.",
        });
        openReadingProfileDialog(application);
        return;
      }

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
        const approveResponse = await api.patch(
          `/applications/${application.id}/approve`,
          {
            sectionId: Number(selectedSectionId),
          },
        );

        // If the application was auto-migrated from Phase 1, the new ID will be in the response
        // Note: approve returns an EnrollmentRecord which has enrollmentApplicationId
        const migratedId =
          approveResponse.data.enrollmentApplicationId || application.id;

        const enrollResponse = await api.patch(
          `/applications/${migratedId}/enroll`,
        );

        setSectionSelectionByApplicationId((prev) => {
          const next = { ...prev };
          delete next[application.id];
          return next;
        });

        const generatedPortalPin = enrollResponse.data?.rawPortalPin;

        if (generatedPortalPin) {
          const selectedSectionName =
            sectionOptionsByApplicationId[application.id]?.find(
              (section) => section.id === Number(selectedSectionId),
            )?.name ??
            resolveApplicationSectionName(application) ??
            "Not Assigned";

          setPortalPinDialogData({
            learnerName: formatLearnerDisplayName(
              application.lastName,
              application.firstName,
            ),
            trackingNumber: application.trackingNumber,
            sectionName: selectedSectionName,
            gradeLevelLabel: formatGradeLevelLabel(application.gradeLevel.name),
            portalPin: String(generatedPortalPin),
          });
        } else {
          sileo.success({
            title: "Assigned & Enrolled",
            description: `${application.lastName}, ${application.firstName} is now officially enrolled.`,
          });
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
    [
      sectionSelectionByApplicationId,
      sectionOptionsByApplicationId,
      fetchData,
      openReadingProfileDialog,
    ],
  );

  const openUnenrollDialog = useCallback((app: Application) => {
    setUnenrollDialog({
      open: true,
      application: app,
      reason: "",
      note: "",
    });
  }, []);

  const closeUnenrollDialog = useCallback(() => {
    setUnenrollDialog({
      open: false,
      application: null,
      reason: "",
      note: "",
    });
  }, []);

  const handleUnenrollSubmit = useCallback(async () => {
    if (!unenrollDialog.application) return;

    if (!unenrollDialog.reason) {
      sileo.error({
        title: "Reason Required",
        description: "Select a reason before un-enrolling this learner.",
      });
      return;
    }

    try {
      await api.patch(
        `/applications/${unenrollDialog.application.id}/unenroll`,
        {
          reason: unenrollDialog.reason,
          note: unenrollDialog.note.trim() || undefined,
        },
      );

      sileo.success({
        title: "Un-enrolled",
        description: "Learner has been removed from the official roster.",
      });

      closeUnenrollDialog();
      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  }, [closeUnenrollDialog, fetchData, unenrollDialog]);

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [];

    if (workflowView === "SECTION_ASSIGNMENT") {
      cols.push({
        id: "select",
        header: () => (
          <Checkbox
            checked={isAllVisibleSelected}
            onCheckedChange={selectAllVisible}
            className="border-primary-foreground data-[state=checked]:bg-white data-[state=checked]:text-primary mx-auto block"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedBatchIds.includes(row.original.id)}
            onCheckedChange={() => toggleBatchSelect(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto block"
          />
        ),
      });
    }

    cols.push(
      {
        id: "student",
        header: "LEARNER",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-left min-w-[200px]">
            <span className="font-bold text-sm uppercase">
              {row.original.lastName}, {row.original.firstName}
            </span>
            <span className="text-sm font-bold">
              {row.original.trackingNumber}
            </span>
          </div>
        ),
      },
      {
        id: "lrn",
        header: "LRN",
        cell: ({ row }) => (
          <span className="font-bold text-sm block">
            {row.original.lrn ||
              (row.original.isPendingLrnCreation ? "PENDING" : "N/A")}
          </span>
        ),
      },
      {
        id: "gradeLevel",
        header: "GRADE LEVEL",
        cell: ({ row }) => (
          <span className="font-bold text-sm block">
            {formatGradeLevelLabel(row.original.gradeLevel.name)}
          </span>
        ),
      },
      ...(workflowView === "SECTION_ASSIGNMENT"
        ? [
            {
              id: "readingProfile",
              header: "READING PROFILE",
              cell: ({ row }: CellContext<Application, unknown>) => {
                const app = row.original;

                if (!app.readingProfileLevel) {
                  return (
                    <div
                      className="flex justify-center"
                      onClick={(event) => event.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-bold"
                        onClick={() => openReadingProfileDialog(app)}>
                        <FileCheck2 className="h-3 w-3 mr-1" />
                        Set Profile
                      </Button>
                    </div>
                  );
                }

                return (
                  <div className="flex justify-center">
                    <Badge
                      variant="outline"
                      className="font-bold px-2 py-0.5 h-auto border-emerald-300 text-emerald-700 text-xs leading-tight text-center">
                      {resolveReadingProfileLabel(app.readingProfileLevel)}
                    </Badge>
                  </div>
                );
              },
            },
          ]
        : []),
      {
        id: "context",
        header: workflowView === "PENDING_VERIFICATION" ? "PROGRAM" : "SECTION",
        cell: ({ row }) => {
          const app = row.original;
          const sectionName = resolveApplicationSectionName(app);
          const hasSection = Boolean(sectionName);
          const isPendingVerification = workflowView === "PENDING_VERIFICATION";
          const isSectionAssignment = workflowView === "SECTION_ASSIGNMENT";
          const selectedSectionId =
            sectionSelectionByApplicationId[app.id] ?? "";
          const sectionOptions = sectionOptionsByApplicationId[app.id] ?? [];
          const isLoadingOptions =
            loadingSectionOptionsByApplicationId[app.id] === true;

          if (isPendingVerification) {
            return (
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
                  {formatScpType(app.applicantType)}
                </Badge>
              </div>
            );
          }

          if (isSectionAssignment && !hasSection) {
            return (
              <div
                className="flex items-center justify-center gap-2 min-w-[160px]"
                onClick={(e) => e.stopPropagation()}>
                <Select
                  value={selectedSectionId}
                  onValueChange={(value) =>
                    setSectionSelectionByApplicationId((prev) => ({
                      ...prev,
                      [app.id]: value,
                    }))
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
                    {!isLoadingOptions && sectionOptions.length === 0 && (
                      <SelectItem value="NO_SECTION_AVAILABLE" disabled>
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
            );
          }

          return (
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
                {sectionName ?? "Not Assigned"}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "STATUS",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <StatusBadge
              status={row.original.status}
              className="text-sm font-bold"
            />
          </div>
        ),
      },
      {
        id: "date",
        header: "DATE",
        cell: ({ row }) => (
          <span className="text-sm font-bold block text-center min-w-[140px]">
            {format(new Date(row.original.createdAt), "MMMM dd, yyyy")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        cell: ({ row }) => {
          const app = row.original;
          const isPendingVerification = workflowView === "PENDING_VERIFICATION";
          const isSectionAssignment = workflowView === "SECTION_ASSIGNMENT";
          const hasReadingProfile = Boolean(app.readingProfileLevel);
          const selectedSectionId =
            sectionSelectionByApplicationId[app.id] ?? "";
          const isSavingSection = savingSectionByApplicationId[app.id] === true;

          if (workflowView === "OFFICIAL_ROSTER") {
            return (
              <div className="flex items-center justify-center gap-2 min-w-[200px]">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-sm font-bold border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    openUnenrollDialog(app);
                  }}>
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  Un-enrol
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-center min-w-[150px]">
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
                    if (!hasReadingProfile) {
                      openReadingProfileDialog(app);
                      return;
                    }
                    void handleAssignAndEnroll(app);
                    return;
                  }
                  setSelectedId(app.id);
                }}
                disabled={
                  isSectionAssignment &&
                  (isSavingSection || (hasReadingProfile && !selectedSectionId))
                }>
                {isPendingVerification ? (
                  <>
                    <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                    Verify Docs
                  </>
                ) : isSectionAssignment ? (
                  !hasReadingProfile ? (
                    <>
                      <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                      Encode Reading
                    </>
                  ) : isSavingSection ? (
                    "Assigning..."
                  ) : (
                    <>
                      <School className="h-3.5 w-3.5 mr-1" />
                      Finalize + Assign
                    </>
                  )
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </>
                )}
              </Button>
            </div>
          );
        },
      },
    );

    return cols;
  }, [
    workflowView,
    isAllVisibleSelected,
    selectedBatchIds,
    sectionSelectionByApplicationId,
    sectionOptionsByApplicationId,
    loadingSectionOptionsByApplicationId,
    savingSectionByApplicationId,
    selectAllVisible,
    toggleBatchSelect,
    ensureSectionOptionsLoaded,
    handleAssignAndEnroll,
    openReadingProfileDialog,
    openUnenrollDialog,
    setSelectedId,
  ]);

  useEffect(() => {
    if (workflowView !== "PENDING_VERIFICATION") {
      setPendingQueueFilter("ALL");
    }

    if (workflowView !== "SECTION_ASSIGNMENT") {
      setSelectedBatchIds([]);
      setBatchSectionId("");
    }
  }, [workflowView]);

  const handleBatchAssign = async () => {
    if (!batchSectionId) {
      sileo.error({
        title: "Section Required",
        description: "Please select a section for batch assignment.",
      });
      return;
    }

    const hasMissingReadingProfile = selectedBatchIds.some((id) => {
      const application = applications.find((entry) => entry.id === id);
      return !application?.readingProfileLevel;
    });

    if (hasMissingReadingProfile) {
      sileo.error({
        title: "Reading Profile Required",
        description:
          "Encode Reading Profile first for all selected learners before batch section assignment.",
      });
      return;
    }

    setIsBatchAssigning(true);
    try {
      await api.post("/applications/batch-assign-section", {
        applicationIds: selectedBatchIds,
        sectionId: Number(batchSectionId),
      });

      sileo.success({
        title: "Batch Assignment Success",
        description: `${selectedBatchIds.length} learners were finalized and assigned to the selected LIS section.`,
      });

      setSelectedBatchIds([]);
      setBatchSectionId("");
      setIsBatchAssignModalOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsBatchAssigning(false);
    }
  };

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

    const learnerName = formatLearnerDisplayName(
      selectedApp.lastName,
      selectedApp.firstName,
    );
    const sectionName =
      resolveSelectedApplicationSectionName(selectedApp) ?? "Not Assigned";
    const gradeLevelLabel = selectedApp.gradeLevel?.name
      ? formatGradeLevelLabel(selectedApp.gradeLevel.name)
      : "N/A";

    try {
      const res = await api.patch(`/applications/${selectedApp.id}/enroll`);

      setIsEnrollModalOpen(false);
      await fetchData();

      if (res.data.rawPortalPin) {
        setPortalPinDialogData({
          learnerName,
          trackingNumber: selectedApp.trackingNumber,
          sectionName,
          gradeLevelLabel,
          portalPin: String(res.data.rawPortalPin),
        });
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
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 overflow-auto px-2 sm:px-0 pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Enrollment Management
            </h1>
            <p className="text-xs font-bold">
              {ENROLLMENT_SUB_MENU_DESCRIPTIONS[workflowView]}
            </p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  className="h-10 px-3 flex-1 md:flex-none text-sm font-bold bg-primary hover:bg-primary/90">
                  <UserPlus className="h-4 w-4 mr-2" />
                  + Walk-In Learner
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-bold">
                <DropdownMenuItem
                  onClick={() => openWalkInEncoder("new-learner")}
                  className="cursor-pointer">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Enroll New Learner (No existing LRN)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openWalkInEncoder("transferee")}
                  className="cursor-pointer">
                  <School className="mr-2 h-4 w-4" />
                  Enroll Transferee (From another school)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openWalkInEncoder("pept")}
                  className="cursor-pointer">
                  <Zap className="mr-2 h-4 w-4 text-amber-500" />
                  Enroll Accelerated / PEPT Passer
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openWalkInEncoder("balik-aral")}
                  className="cursor-pointer">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Enroll Balik-Aral
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
              onClick={() => {
                void fetchData();
              }}
              disabled={loading || !ayId}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Button
              variant="outline"
              className={`h-10 px-3 flex-1 md:flex-none text-sm font-bold ${
                workflowView !== "OFFICIAL_ROSTER"
                  ? "opacity-60 cursor-not-allowed"
                  : ""
              }`}
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
                <Label className="text-sm uppercase tracking-wider font-bold text-muted-foreground">
                  Search Learner
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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

            {workflowView === "PENDING_VERIFICATION" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Queue Filter
                </span>
                {PENDING_QUEUE_FILTER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      pendingQueueFilter === option.value
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-8 text-xs font-bold"
                    onClick={() => {
                      setPendingQueueFilter(option.value);
                    }}>
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            {workflowView === "SECTION_ASSIGNMENT" && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    LIS BOSY Batch Action
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Selected learners: {selectedBatchIds.length}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  disabled={selectedBatchIds.length === 0}
                  onClick={() => {
                    void openBatchAssignModal();
                  }}>
                  <School className="h-3.5 w-3.5 mr-1" />
                  Open Batch Section Assignment
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="px-3 sm:px-6">
            <DataTable
              columns={columns}
              data={visibleApplications}
              loading={showSkeleton}
              onRowClick={(app) => {
                if (workflowView === "SECTION_ASSIGNMENT") {
                  toggleBatchSelect(app.id);
                } else {
                  setSelectedId(app.id);
                }
              }}
              noResultsMessage="No learners found."
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
              <span className="text-xs text-muted-foreground">
                Showing {visibleApplications.length} learners in{" "}
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
                  className="h-9 sm:h-8 text-xs font-bold"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}>
                  Previous
                </Button>
                <Badge
                  variant="secondary"
                  className="px-3 h-8 text-xs font-bold">
                  Page {page}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 text-xs font-bold"
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
                      title: "Pre-Registered",
                      description:
                        "Learner moved to Pre-Registered / Ready for Sectioning.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onMarkVerified={async () => {
                  try {
                    const res = await api.patch(
                      `/applications/${selectedId}/verify`,
                    );

                    // Handle ID change if migrated from Early Registration
                    if (res.data.id && res.data.id !== selectedId) {
                      setSelectedId(res.data.id);
                    }

                    sileo.success({
                      title: "Ready for Sectioning",
                      description:
                        "Physical documents verified. Learner is now in the Ready for Sectioning queue.",
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
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Official Enrollment Confirmation
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Confirming enrollment for {selectedApp?.lastName},{" "}
              {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-xs font-medium">
              This action confirms the{" "}
              <span className="font-bold text-green-700">
                OFFICIAL ENROLLMENT
              </span>{" "}
              for Phase 2.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700 font-bold">Section:</span>
                <span className="font-bold">
                  {selectedAppSectionName ?? "Not Assigned"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700 font-bold">Grade Level:</span>
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
            <p className="text-xs mt-4 italic text-muted-foreground font-medium">
              Ensure all physical documents (PSA, SF9) have been verified in
              person before proceeding.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEnrollModalOpen(false)}
              className="text-xs font-bold">
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-xs font-bold"
              disabled={!canConfirmOfficialEnrollment}
              onClick={handleEnroll}>
              Confirm Official Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {portalPinDialogData && (
        <OneTimePinSuccessDialog
          learnerName={portalPinDialogData.learnerName}
          trackingNumber={portalPinDialogData.trackingNumber}
          sectionName={portalPinDialogData.sectionName}
          gradeLevelLabel={portalPinDialogData.gradeLevelLabel}
          portalPin={portalPinDialogData.portalPin}
          onAcknowledge={handlePortalPinAcknowledge}
        />
      )}

      <ScheduleExamDialog
        open={isScheduleDialogOpen}
        onOpenChange={isScheduleDialogOpen ? setIsScheduleDialogOpen : () => {}}
        applicant={selectedApp as ApplicantDetail | null}
        step={scheduleStep}
        onSuccess={fetchData}
        onCloseSheet={() => setSelectedId(null)}
      />

      <Dialog
        open={readingProfileDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeReadingProfileDialog();
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Encode Reading Profile
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Reading Profile is required before section assignment and official
              enrollment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Learner
              </Label>
              <p className="text-xs font-semibold">
                {readingProfileDialog.application
                  ? `${readingProfileDialog.application.lastName}, ${readingProfileDialog.application.firstName}`
                  : "N/A"}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="readingProfileLevel"
                className="text-xs font-bold uppercase tracking-wider">
                Reading Profile Level
              </Label>
              <Select
                value={readingProfileDialog.level}
                onValueChange={(value) => {
                  setReadingProfileDialog((prev) => ({
                    ...prev,
                    level: value as ReadingProfileLevel,
                  }));
                }}>
                <SelectTrigger
                  id="readingProfileLevel"
                  className="h-10 text-xs font-bold">
                  <SelectValue placeholder="Select reading profile" />
                </SelectTrigger>
                <SelectContent>
                  {READING_PROFILE_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="readingProfileNotes"
                className="text-xs font-bold uppercase tracking-wider">
                Notes (Optional)
              </Label>
              <Textarea
                id="readingProfileNotes"
                value={readingProfileDialog.notes}
                onChange={(event) => {
                  setReadingProfileDialog((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }));
                }}
                placeholder="Record assessment notes or remarks"
                className="min-h-24 text-xs font-semibold"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-xs font-bold"
              onClick={closeReadingProfileDialog}
              disabled={readingProfileDialog.saving}>
              Cancel
            </Button>
            <Button
              className="text-xs font-bold"
              disabled={
                readingProfileDialog.saving || !readingProfileDialog.level
              }
              onClick={() => {
                void handleSaveReadingProfile();
              }}>
              {readingProfileDialog.saving
                ? "Saving..."
                : "Save Reading Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unenrollDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeUnenrollDialog();
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Un-enrol Learner
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Record the reason for removing this learner from the official
              roster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Learner
              </Label>
              <p className="text-xs font-semibold">
                {unenrollDialog.application
                  ? `${unenrollDialog.application.lastName}, ${unenrollDialog.application.firstName}`
                  : "N/A"}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="unenrollReason"
                className="text-xs font-bold uppercase tracking-wider">
                Reason
              </Label>
              <Select
                value={unenrollDialog.reason}
                onValueChange={(value) => {
                  setUnenrollDialog((prev) => ({ ...prev, reason: value }));
                }}>
                <SelectTrigger
                  id="unenrollReason"
                  className="h-10 text-xs font-bold">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {UNENROLL_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="unenrollNote"
                className="text-xs font-bold uppercase tracking-wider">
                Note (Optional)
              </Label>
              <Textarea
                id="unenrollNote"
                value={unenrollDialog.note}
                onChange={(event) => {
                  setUnenrollDialog((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }));
                }}
                placeholder="Add extra details for audit context"
                className="min-h-24 text-xs font-semibold"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-xs font-bold"
              onClick={closeUnenrollDialog}>
              Cancel
            </Button>
            <Button
              className="text-xs font-bold bg-destructive hover:bg-destructive/90"
              disabled={!unenrollDialog.reason}
              onClick={() => {
                void handleUnenrollSubmit();
              }}>
              Confirm Un-enrol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBatchAssignModalOpen}
        onOpenChange={(open) => {
          setIsBatchAssignModalOpen(open);
          if (!open) {
            setBatchSectionId("");
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Batch Section Assignment
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Finalize official enrollment and assign selected learners to one
              section in a single LIS BOSY action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Selected Learners
              </p>
              <p className="text-sm font-bold">{selectedBatchIds.length}</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="batchSection"
                className="text-xs font-bold uppercase tracking-wider">
                Target Section
              </Label>
              <Select value={batchSectionId} onValueChange={setBatchSectionId}>
                <SelectTrigger
                  id="batchSection"
                  className="h-10 text-xs font-bold">
                  <SelectValue
                    placeholder={
                      batchSectionOptionsLoading
                        ? "Loading sections..."
                        : "Select section"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {batchSectionOptionsLoading && (
                    <SelectItem value="LOADING" disabled>
                      Loading sections...
                    </SelectItem>
                  )}
                  {!batchSectionOptionsLoading &&
                    batchSectionOptions.length === 0 && (
                      <SelectItem value="NO_SECTION_AVAILABLE" disabled>
                        No sections available
                      </SelectItem>
                    )}
                  {batchSectionOptions.map((section) => (
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-xs font-bold"
              onClick={() => {
                setIsBatchAssignModalOpen(false);
              }}>
              Cancel
            </Button>
            <Button
              className="text-xs font-bold"
              disabled={
                isBatchAssigning ||
                !batchSectionId ||
                selectedBatchIds.length === 0
              }
              onClick={() => {
                void handleBatchAssign();
              }}>
              {isBatchAssigning ? "Assigning..." : "Confirm Batch Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
