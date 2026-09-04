import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PreFlightBlockerModal } from "@/features/enrollment/components/PreFlightBlockerModal";
import { EosyOverrideModal } from "@/features/enrollment/components/EosyOverrideModal";
import { AtomicRolloverDialog } from "@/features/settings/components/AtomicRolloverDialog";
import { EosyUnlockModal } from "@/features/enrollment/components/EosyUnlockModal";
import { getBOSYReadiness } from "@/features/bosy/api/bosy.api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Unlock,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Search,
  MapPin,
  RefreshCw,
  Save,
  ChevronDown,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import axios from "axios";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useHeaderStore } from "@/store/header.slice";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { cn, getGradeLevelBadgeStyles, formatGradeLevel } from "@/shared/lib/utils";
import type { EosyStatus } from "@enrollpro/shared";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/shared/ui/tooltip";
import { sileo } from "sileo";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Navigate } from "react-router";
import { useRealtimeRefresh } from "@/shared/hooks/useRealtimeRefresh";
import type { RealtimeInvalidationTopic } from "@enrollpro/shared";
import {
  useGuardedTabChange,
  useUnsavedChanges,
} from "@/shared/hooks/useUnsavedChanges";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { TableCellsTransitionLoader } from "@/shared/components/TableCellsTransitionLoader";
import { EosySf9GradeTable } from "@/features/enrollment/components/EosySf9GradeTable";
import { RemedialClassesTable } from "@/features/enrollment/components/RemedialClassesTable";
import { TableCell, TableRow } from "@/shared/ui/table";

const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const f = String(firstName || "").trim().charAt(0).toUpperCase();
  const l = String(lastName || "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
};

const EOSY_REALTIME_TOPICS: RealtimeInvalidationTopic[] = [
  "eosy:sections",
  "eosy:records",
  "teacher:advisory",
  "school-years:list",
];

export interface EnrollmentRecord {
  id: number;
  eosyStatus: EosyStatus | null;
  academicDeficiencyNote: string | null;
  dropOutReason: string | null;
  finalAverage: number | null;
  nextYearCurriculum: string | null;
  transferOutDate: string | null;
  smartSyncStatus:
  | "FINALIZED_SMART_GRADES_RECEIVED"
  | "WAITING_FOR_SMART_FINALIZATION"
  | "INCOMPLETE_SUBJECT_GRADES"
  | "SMART_DATA_NEEDS_REVIEW"
  | null;
  smartSyncReason: string | null;
  smartSynchronizedAt: string | null;
  isScpDemoted?: boolean;
  scpViolations?: Array<{
    subject: string;
    term: string;
    actualGrade: number;
    requiredGrade: number;
    violationType: string;
  }> | null;
  sectionId: number;
  section: {
    id: number;
    name: string;
    isEosyFinalized: boolean;
    programType?: string;
    isHomogeneous?: boolean;
    advisers?: Array<{
      teacher: {
        firstName: string;
        lastName: string;
        employeeId: string;
      };
    }>;
  };
  enrollmentApplication: {
    id: number;
    trackingNumber: string;
    applicantType: string;
    reportedGrades?: Record<string, unknown> | null;
    learner: {
      id: number;
      lrn: string | null;
      firstName: string;
      lastName: string;
      sex?: "MALE" | "FEMALE" | null;
      studentPhoto?: string | null;
    };
    gradeLevel?: GradeLevel;
  };
}

interface GradeLevel {
  id: number;
  name: string;
  displayOrder: number | null;
}

interface SmartErrorDetails {
  status?: number;
  message: string;
}

interface SmartSyncProgress {
  totalSections: number;
  completedSections: number;
  currentSection: string | null;
  failedSections: string[];
}

function getSmartErrorDetails(error: unknown): SmartErrorDetails {
  if (axios.isAxiosError<unknown>(error)) {
    const responseData = error.response?.data;
    const responseMessage =
      typeof responseData === "object" &&
        responseData !== null &&
        "message" in responseData &&
        typeof responseData.message === "string"
        ? responseData.message
        : null;

    return {
      status: error.response?.status,
      message: responseMessage ?? error.message,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown SMART synchronization error.",
  };
}

interface Section {
  id: number;
  name: string;
  isEosyFinalized: boolean;
  programType: string;
  isHomogeneous: boolean;
  gradeLevelId: number;
  gradeLevel: GradeLevel;
  _count: { enrollmentRecords: number };
  advisers?: Array<{
    teacher: {
      firstName: string;
      lastName: string;
      employeeId: string;
    };
  }>;
}

interface EosyExportLockState {
  schoolYearId: number;
  schoolYearLabel: string;
  schoolYearFinalized: boolean;
  totalSections: number;
  finalizedSections: number;
  canFinalizeSchoolYear: boolean;
  lockReason: string | null;
}

interface SmartConnectionStatus {
  state:
  | "DISABLED"
  | "CONNECTING"
  | "CONNECTED"
  | "UNAVAILABLE"
  | "AUTHENTICATION_FAILED"
  | "PAUSED";
  connectionAttempts: number;
  lastConnectedAt: string | null;
  lastEventAt: string | null;
}

const formatStatusLabel = (status: EosyStatus | string | null, isGrade10: boolean = false) => {
  const normalized = status ?? "PROMOTED";

  switch (normalized as string) {
    case "PROMOTED":
      return isGrade10 ? "COMPLETER" : "PROMOTED";
    case "RETAINED":
      return "RETAINED";
    case "CONDITIONALLY_PROMOTED":
      return "CONDITIONALLY PROMOTED";
    case "PROMOTED_TO_BEC":
      return "PROMOTED (TO BEC)";
    case "TRANSFERRED_OUT":
      return "TRANSFERRED OUT";
    case "DROPPED_OUT":
      return "DROPPED OUT";
    case "ACTION_REQUIRED":
      return "ACTION REQUIRED";
    default:
      return "PROMOTED";
  }
};

const getNextGradeName = (currentName: string) => {
  const match = currentName.match(/\d+/);
  if (match) {
    const nextGrade = parseInt(match[0], 10) + 1;
    return `Grade ${nextGrade}`;
  }
  return "the next grade level";
};

interface GeofencingPopoverProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  onChange: (lat: number, lng: number) => void;
  isChanged: boolean;
  disabled: boolean;
}

function GeofencingPopover({
  latitude,
  longitude,
  onChange,
  isChanged,
  disabled,
}: GeofencingPopoverProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const lat = latitude ?? 10.6765;
  const lng = longitude ?? 122.9510;

  const pinX = 120 + (lng - 122.9510) / 0.0001;
  const pinY = 90 - (lat - 10.6765) / 0.0001;

  const xClamped = Math.max(0, Math.min(240, pinX));
  const yClamped = Math.max(0, Math.min(180, pinY));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateCoords = (clientX: number, clientY: number) => {
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const newLat = 10.6765 - (y - 90) * 0.0001;
      const newLng = 122.9510 + (x - 120) * 0.0001;
      onChange(Number(newLat.toFixed(6)), Number(newLng.toFixed(6)));
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateCoords(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    updateCoords(e.clientX, e.clientY);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 px-2 flex gap-1 items-center font-bold cursor-pointer transition-colors shrink-0",
            isChanged ? "border-amber-500 bg-amber-50 text-amber-900" : "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <MapPin className={cn("h-4 w-4", isChanged ? "text-amber-500" : "text-muted-foreground")} />
          <span className="text-sm">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
          {isChanged && <span className="text-sm text-amber-600 font-bold uppercase">Unsaved</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4 text-center space-y-3" align="end">
        <h4 className="text-sm font-bold uppercase text-foreground leading-none border-b pb-2">
          Residency Geofence Coordinates
        </h4>
        <p className="text-sm text-muted-foreground leading-normal">
          Click on the map or drag the pin to correct past geofencing coordinates.
        </p>

        <div
          ref={mapRef}
          onMouseDown={handleMouseDown}
          className="relative w-[240px] h-[180px] mx-auto bg-slate-100 border border-slate-200 rounded-md overflow-hidden cursor-crosshair select-none"
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <circle cx="120" cy="90" r="50" fill="rgba(14, 165, 233, 0.05)" stroke="rgba(14, 165, 233, 0.3)" strokeDasharray="3 3" strokeWidth="1.5" />
            <text x="120" y="32" textAnchor="middle" fill="#0284c7" className="text-sm font-bold font-sans uppercase">School Geofence Radius (1km)</text>
            <line x1="120" y1="0" x2="120" y2="180" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            <line x1="0" y1="90" x2="240" y2="90" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            <text x="24" y="20" fill="#64748b" className="text-sm font-bold">Brgy. San Jose</text>
            <text x="175" y="160" fill="#64748b" className="text-sm font-bold">Brgy. Taculing</text>
          </svg>

          <div
            style={{ left: `${xClamped}px`, top: `${yClamped}px` }}
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-75"
          >
            <MapPin className="h-6 w-6 text-red-600 drop-shadow-md animate-bounce" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-600 rounded-full border border-white opacity-40 shrink-0" />
          </div>

          <div className="absolute top-[90px] left-[120px] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-sky-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
            <div className="w-1.5 h-1.5 bg-muted rounded-full" />
          </div>
        </div>

        <div className="bg-slate-50 border p-2 rounded text-sm font-mono flex flex-col items-center">
          <span className="font-bold text-foreground">Lat: {lat.toFixed(6)}° N</span>
          <span className="font-bold text-foreground">Lng: {lng.toFixed(6)}° E</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function EosyUpdating() {
  const queryClient = useQueryClient();
  const {
    activeSchoolYearId,
    viewingSchoolYearId,
    systemPhase,
    setHistoricalCorrectionToken,
    activeSchoolYearLabel,
  } = useSettingsStore();
  const { isHistoricalReadOnly, hasOverride, isSystemAdmin } = useHistoricalReadOnly();
  const isEosyPhase = systemPhase === "EOSY_CLOSING";
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);
  const [exportLock, setExportLock] = useState<EosyExportLockState | null>(null);

  const [overrideRecord, setOverrideRecord] = useState<EnrollmentRecord | null>(null);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [preFlightModalOpen, setPreFlightModalOpen] = useState(false);
  const [sf5WatermarkOpen, setSf5WatermarkOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  const [syncingSmart, setSyncingSmart] = useState(false);
  const [smartSyncProgress, setSmartSyncProgress] = useState<SmartSyncProgress | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

  const [recordingForms, setRecordingForms] = useState(false);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<number, {
    lrn?: string;
    firstName?: string;
    lastName?: string;
    sectionId?: number;
    latitude?: number;
    longitude?: number;
  }>>({});
  const [isCommitting, setIsCommitting] = useState(false);
  const hasUnsavedEosyChanges = Object.keys(unsavedChanges).length > 0;
  const discardUnsavedEosyChanges = useCallback(() => {
    setUnsavedChanges({});
  }, []);
  const guardedSetActiveTab = useGuardedTabChange(setActiveTab);

  useEffect(() => {
    setExpandedRecordId(null);
  }, [activeTab, ayId]);

  useUnsavedChanges({
    id: "eosy-updating",
    label: "EOSY learner updates",
    isDirty: hasUnsavedEosyChanges,
    isSubmitting: isCommitting,
    onDiscard: discardUnsavedEosyChanges,
  });

  const recordsQuery = useQuery({
    queryKey: ["eosy", "grade-records", ayId, activeTab],
    queryFn: async () => {
      const res = await api.get(`/eosy/grade/${activeTab}/records?schoolYearId=${ayId}&_t=${Date.now()}`);
      return (res.data.records || []) as EnrollmentRecord[];
    },
    enabled: Boolean(ayId && activeTab),
  });

  const smartConnectionQuery = useQuery({
    queryKey: ["integration", "smart-status"],
    queryFn: async () => {
      const response = await api.get<SmartConnectionStatus>("/integration/smart/status");
      return response.data;
    },
    enabled: !isHistoricalReadOnly,
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: false,
  });

  const loadingRecords = isInitialLoad || (Boolean(ayId && activeTab) && (recordsQuery.isPending || recordsQuery.isFetching));
  const showSkeleton = useDelayedLoading(loadingRecords && isInitialLoad);

  useEffect(() => {
    if (recordsQuery.data) {
      setRecords(recordsQuery.data);
      setIsInitialLoad(false);
    }
  }, [recordsQuery.data]);

  useEffect(() => {
    if (recordsQuery.isError) {
      toastApiError(recordsQuery.error as never);
      setIsInitialLoad(false);
    }
  }, [recordsQuery.isError, recordsQuery.error]);

  const handleFieldChange = useCallback((
    recordId: number,
    field: string,
    value: string | number | null | EosyStatus | undefined,
  ) => {
    setUnsavedChanges(prev => {
      const existing = prev[recordId] || {};
      return {
        ...prev,
        [recordId]: {
          ...existing,
          [field]: value
        }
      };
    });
  }, []);

  const handleCommitChanges = useCallback(async () => {
    if (isCommitting || Object.keys(unsavedChanges).length === 0) return;
    setIsCommitting(true);

    try {
      const validUpdates: typeof unsavedChanges = {};
      const revertedRecords: number[] = [];

      for (const [idStr, changes] of Object.entries(unsavedChanges)) {
        const recordId = Number(idStr);
        const original = records.find(r => r.id === recordId);
        if (!original) continue;

        let hasInvalidField = false;

        // LRN validation (Philippines LRN must be 12 digits if provided)
        if ("lrn" in changes && changes.lrn !== original.enrollmentApplication.learner.lrn) {
          if (changes.lrn && !/^\d{12}$/.test(changes.lrn)) {
            hasInvalidField = true;
          }
        }

        // Names validation
        if ("firstName" in changes && !changes.firstName?.trim()) {
          hasInvalidField = true;
        }
        if ("lastName" in changes && !changes.lastName?.trim()) {
          hasInvalidField = true;
        }

        if (hasInvalidField) {
          revertedRecords.push(recordId);
        } else {
          validUpdates[recordId] = changes;
        }
      }

      if (revertedRecords.length > 0) {
        sileo.warning({
          title: "Validation Reverted",
          description: `${revertedRecords.length} record(s) failed learner identity validation and were reverted.`,
        });
      }

      const validEntries = Object.entries(validUpdates);
      if (validEntries.length > 0) {
        const promises = validEntries.map(([idStr, changes]) => {
          if (hasOverride) {
            return api.post(`/eosy/records/${idStr}/override`, changes);
          }
          return api.patch(`/eosy/records/${idStr}`, changes);
        });
        await Promise.all(promises);

        setRecords(prev =>
          prev.map(r => {
            const update = validUpdates[r.id];
            if (!update) return r;
            return {
              ...r,
              enrollmentApplication: {
                ...r.enrollmentApplication,
                learner: {
                  ...r.enrollmentApplication.learner,
                  lrn: update.lrn !== undefined ? (update.lrn ?? null) : r.enrollmentApplication.learner.lrn,
                  firstName: update.firstName !== undefined ? (update.firstName ?? r.enrollmentApplication.learner.firstName) : r.enrollmentApplication.learner.firstName,
                  lastName: update.lastName !== undefined ? (update.lastName ?? r.enrollmentApplication.learner.lastName) : r.enrollmentApplication.learner.lastName,
                }
              }
            };
          })
        );
      }

      if (hasOverride && ayId) {
        await api.post("/admin/historical-correction/relock", { schoolYearId: ayId });
        setHistoricalCorrectionToken(null);
      }

      setUnsavedChanges({});

      sileo.success({
        title: "Changes Saved",
        description: `Successfully committed ${validEntries.length} learner modification(s) to the database.`,
      });

      if (hasOverride) {
        setTimeout(() => window.location.reload(), 100);
      }
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsCommitting(false);
    }
  }, [unsavedChanges, records, hasOverride, ayId, setHistoricalCorrectionToken, isCommitting]);

  // Listen for commit triggers from HistoricalBanner
  useEffect(() => {
    const handleCommit = () => {
      void handleCommitChanges();
    };

    window.addEventListener("historical-correction:trigger-commit", handleCommit);
    return () => {
      window.removeEventListener("historical-correction:trigger-commit", handleCommit);
    };
  }, [handleCommitChanges]);

  useEffect(() => {
    if (!ayId) return;
    getBOSYReadiness(ayId).catch(() => { });
  }, [ayId]);

  const fetchSectionsAndGrades = useCallback(async () => {
    if (!ayId) {
      setIsInitialLoad(false);
      return;
    }
    try {
      const res = await api.get(`/eosy/sections?schoolYearId=${ayId}&_t=${Date.now()}`);
      const rawSections: Section[] = res.data.sections || [];
      setAllSections(rawSections);

      const glMap = new Map<number, GradeLevel>();
      rawSections.forEach(s => {
        if (!glMap.has(s.gradeLevelId)) {
          glMap.set(s.gradeLevelId, s.gradeLevel);
        }
      });

      const grades = Array.from(glMap.values()).sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
      setGradeLevels(grades);

      if (grades.length > 0 && !activeTab) {
        setActiveTab(String(grades[0].id));
      } else if (grades.length === 0) {
        setIsInitialLoad(false);
      }
    } catch (err) {
      toastApiError(err as never);
      setIsInitialLoad(false);
    }
  }, [ayId, activeTab]);

  const fetchExportLockState = useCallback(async () => {
    if (!ayId) {
      setExportLock(null);
      return;
    }

    try {
      const res = await api.get(`/eosy/school-year/${ayId}/export-lock`);
      setExportLock(res.data);
    } catch (err) {
      console.error("Failed to fetch export lock state", err);
      setExportLock(null);
    }
  }, [ayId]);

  const fetchGradeRecords = useCallback(async (gradeLevelId: string, silent = false) => {
    if (!gradeLevelId || !ayId) return;
    if (!silent) {
      setSectionFilter("ALL");
    }
    if (gradeLevelId !== activeTab) {
      setActiveTab(gradeLevelId);
      return;
    }
    await queryClient.refetchQueries({ queryKey: ["eosy", "grade-records", ayId, gradeLevelId] });
  }, [activeTab, ayId, queryClient]);

  const handleSyncSmartGrades = useCallback(async () => {
    if (!ayId || isHistoricalReadOnly) return;

    // Collect all unfinalized sections across all grade levels
    const targetSections = allSections.filter((s) => !s.isEosyFinalized);

    if (targetSections.length === 0) {
      sileo.info({
        title: "No Active Sections",
        description: "All sections across all grade levels are already finalized or no sections were found.",
      });
      return;
    }

    setSyncingSmart(true);
    setSmartSyncProgress({
      totalSections: targetSections.length,
      completedSections: 0,
      currentSection: null,
      failedSections: [],
    });
    try {
      let totalSynced = 0;
      let totalUnresolved = 0;
      const failedSections: string[] = [];
      let firstError: unknown = null;

      for (const sec of targetSections) {
        let sectionSucceeded = false;
        setSmartSyncProgress((previous) => previous ? {
          ...previous,
          currentSection: `${sec.gradeLevel?.name || `Grade Level ${sec.gradeLevelId}`} - ${sec.name}`,
        } : previous);

        try {
          const res = await api.post(`/integration/smart/sections/${sec.id}/sync-grades`);
          if (res.data?.syncedCount) {
            totalSynced += res.data.syncedCount;
          }
          if (Array.isArray(res.data?.unresolvedOutcomes)) {
            totalUnresolved += res.data.unresolvedOutcomes.length;
          }
          sectionSucceeded = true;
        } catch (secErr: unknown) {
          console.error(`SMART sync failed for section ${sec.name}:`, secErr);
          failedSections.push(sec.name);
          setSmartSyncProgress((previous) => previous ? {
            ...previous,
            failedSections: [...previous.failedSections, sec.name],
          } : previous);
          if (!firstError) firstError = secErr;

          // Fail fast if SMART is completely unreachable / offline
          const { status, message: msg } = getSmartErrorDetails(secErr);
          if (
            status === 502 ||
            status === 503 ||
            status === 504 ||
            msg.includes("ECONNREFUSED") ||
            msg.includes("offline") ||
            msg.includes("unreachable") ||
            msg.includes("Bad Gateway") ||
            msg.includes("Proxy Error")
          ) {
            throw secErr;
          }
        } finally {
          setSmartSyncProgress((previous) => previous ? {
            ...previous,
            completedSections: previous.completedSections + (sectionSucceeded ? 1 : 0),
            currentSection: null,
          } : previous);
        }
      }

      if (failedSections.length === targetSections.length) {
        if (firstError) {
          throw firstError;
        }
        throw new Error(
          `SMART did not return complete final outcomes for the selected sections: ${failedSections.join(", ")}.`
        );
      }

      // Refresh all EOSY data only after every section request has finished.
      await queryClient.invalidateQueries({ queryKey: ["eosy", "grade-records", ayId] });
      await queryClient.invalidateQueries({ queryKey: ["eosy-records"] });
      await queryClient.invalidateQueries({ queryKey: ["eosy-sections"] });
      await queryClient.invalidateQueries({ queryKey: ["integration", "smart-status"] });
      await fetchSectionsAndGrades();
      await fetchExportLockState();
      if (activeTab) {
        await fetchGradeRecords(activeTab, true);
      }

      if (failedSections.length > 0 || totalUnresolved > 0) {
        sileo.warning({
          title: "SMART Sync Partially Complete",
          description: `${totalSynced} learner outcome(s) synchronized across ${targetSections.length - failedSections.length} section(s). ${totalUnresolved} learner outcome(s) still need complete final grades.${failedSections.length > 0 ? ` Review ${failedSections.length} section(s) with pending grades: ${failedSections.join(", ")}.` : ""}`,
        });
      } else {
        sileo.success({
          title: "EOSY Grades Synchronized",
          description: `Successfully synchronized ${totalSynced} EOSY grades across all ${targetSections.length} section(s) in Grades 7–10`,
        });
      }
    } catch (err: unknown) {
      const { status, message: apiMessage } = getSmartErrorDetails(err);

      let description = apiMessage;
      if (status === 503 || apiMessage.includes("ECONNREFUSED") || apiMessage.includes("offline")) {
        description = "SMART server is offline or unreachable on port 5003. Please ensure the SMART service is running.";
      } else if (status === 504 || apiMessage.includes("timeout") || apiMessage.includes("timed out")) {
        description = "Connection to SMART timed out. The SMART server took too long to respond.";
      } else if (status === 502) {
        description = apiMessage || "SMART integration returned an invalid payload or rejected the connection token.";
      }

      sileo.error({
        title: "SMART Sync Failed",
        description,
      });
    } finally {
      setSyncingSmart(false);
      setSmartSyncProgress(null);
    }
  }, [
    ayId,
    isHistoricalReadOnly,
    allSections,
    queryClient,
    activeTab,
    fetchExportLockState,
    fetchGradeRecords,
    fetchSectionsAndGrades,
  ]);

  useEffect(() => {
    void fetchSectionsAndGrades();
    void fetchExportLockState();
  }, [fetchSectionsAndGrades, fetchExportLockState]);

  useEffect(() => {
    if (activeTab) {
      void fetchGradeRecords(activeTab);
    }
  }, [activeTab, fetchGradeRecords]);

  const refreshEosyWorkspace = useCallback(() => {
    if (!activeTab || isHistoricalReadOnly) return;
    void fetchSectionsAndGrades();
    void fetchGradeRecords(activeTab, true);
    void fetchExportLockState();
  }, [activeTab, fetchExportLockState, fetchGradeRecords, fetchSectionsAndGrades, isHistoricalReadOnly]);

  useRealtimeRefresh({
    topics: EOSY_REALTIME_TOPICS,
    schoolYearId: ayId,
    onRefresh: refreshEosyWorkspace,
  });

  const handleFinalizeGrade = async () => {
    setFinalizeLoading(true);
    try {
      const sectionIdPayload = sectionFilter === "ALL"
        ? "all"
        : records.find(r => r.section?.name === sectionFilter)?.section?.id ?? "all";

      await api.post(`/eosy/grade/${activeTab}/finalize`, {
        schoolYearId: ayId,
        section_id: sectionIdPayload
      });

      sileo.success({
        title: sectionFilter === "ALL" ? "Grade Level Finalized" : "Section Finalized",
        description: "Grade progression executed successfully and section(s) are now locked.",
      });

      setFinalizeModalOpen(false);
      void fetchExportLockState();
      void fetchSectionsAndGrades();
      void fetchGradeRecords(activeTab);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setFinalizeLoading(false);
    }
  };

  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const handleUnlock = async () => {
    setUnlockLoading(true);
    try {
      if (sectionFilter === "ALL" || sectionFilter === "all" || !sectionFilter) {
        await api.post(`/eosy/grade/${activeTab}/unlock`, { schoolYearId: ayId });
        sileo.success({
          title: "Grade Level Unlocked",
          description: `${activeGradeName} has been successfully unlocked.`,
        });
      } else {
        const sectionIdPayload = records.find(r => r.section?.name === sectionFilter)?.section?.id;
        if (!sectionIdPayload) throw new Error("Section ID not found for unlock.");

        await api.post(`/eosy/sections/${sectionIdPayload}/unlock`);
        sileo.success({
          title: "Section Unlocked",
          description: `Section ${sectionFilter} has been successfully unlocked.`,
        });
      }

      void fetchExportLockState();
      void fetchSectionsAndGrades();
      void fetchGradeRecords(activeTab, true);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setUnlockLoading(false);
      setUnlockModalOpen(false);
    }
  };

  const isSchoolYearFinalized = exportLock?.schoolYearFinalized ?? false;

  const recordSf5ForScope = async () => {
    const sections = allSections.filter(
      (section) =>
        String(section.gradeLevelId) === activeTab &&
        (sectionFilter === "ALL" || section.name === sectionFilter),
    );
    if (sections.length === 0) return;
    setRecordingForms(true);
    try {
      for (const section of sections) {
        await api.post(`/eosy/sections/${section.id}/forms/sf5/record`);
      }
      sileo.success({
        title: "SF5 officially recorded",
        description:
          `${sections.length} class SF5 record(s) were saved for rollover review.`,
      });
      await fetchExportLockState();
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0]);
    } finally {
      setRecordingForms(false);
    }
  };

  const recordSf6 = async () => {
    if (!ayId) return;
    setRecordingForms(true);
    try {
      await api.post(`/eosy/school-years/${ayId}/forms/sf6/record`);
      sileo.success({
        title: "SF6 officially recorded",
        description:
          "The school-wide SF6 record is ready for rollover review.",
      });
      await fetchExportLockState();
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0]);
    } finally {
      setRecordingForms(false);
    }
  };

  const activeGradeName = gradeLevels.find((g) => String(g.id) === activeTab)?.name || "Grade Level";

  const sectionGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    const uniqueSections = new Map<
      string,
      EnrollmentRecord["section"]
    >();
    records.forEach(r => {
      const sec = r.section;
      if (sec && sec.name && !uniqueSections.has(sec.name)) {
        uniqueSections.set(sec.name, sec);
      }
    });

    uniqueSections.forEach(sec => {
      let groupName = "BEC";
      if (sec.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") groupName = "SCIENCE, TECHNOLOGY, AND ENGINEERING";
      else if (sec.programType === "SPECIAL_PROGRAM_IN_THE_ARTS") groupName = "SPECIAL PROGRAM IN THE ARTS";
      else if (sec.programType === "SPECIAL_PROGRAM_IN_SPORTS") groupName = "SPECIAL PROGRAM IN SPORTS";
      else if (sec.programType !== "REGULAR") groupName = "BASIC EDUCATION CURRICULUM";
      else if (sec.isHomogeneous) groupName = "BASIC EDUCATION CURRICULUM (TOP SECTIONS)";

      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName)!.push(sec.name);
    });

    const sortedGroups = Array.from(map.entries()).sort((a, b) => {
      const rank = (name: string) => {
        if (name.includes("STE")) return 1;
        if (name.includes("SPA")) return 2;
        if (name.includes("SPS")) return 3;
        if (name.includes("SCP")) return 4;
        if (name.includes("TOP")) return 5;
        return 6;
      };
      return rank(a[0]) - rank(b[0]);
    });

    sortedGroups.forEach(g => g[1].sort());
    return sortedGroups;
  }, [records]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (sectionFilter !== "ALL") {
      list = list.filter(r => r.section?.name === sectionFilter);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        const learner = r.enrollmentApplication?.learner;
        if (!learner) return false;
        const { firstName, lastName, lrn } = learner;
        return (
          (firstName && firstName.toLowerCase().includes(q)) ||
          (lastName && lastName.toLowerCase().includes(q)) ||
          (lrn && lrn.toLowerCase().includes(q)) ||
          (r.section?.name && r.section.name.toLowerCase().includes(q))
        );
      });
    }

    const sortedList = [...list].sort((a, b) => {
      // 1. STE
      // 2. SPA
      // 3. SPS
      // 4. PILOT/HOMOGENEOUS
      // 5. HETEROGENEOUS
      const getRank = (r: EnrollmentRecord) => {
        if (r.section?.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") return 1;
        if (r.section?.programType === "SPECIAL_PROGRAM_IN_THE_ARTS") return 2;
        if (r.section?.programType === "SPECIAL_PROGRAM_IN_SPORTS") return 3;
        if (r.section?.isHomogeneous) return 4;
        return 5;
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;

      // Keep section alphabetical order as secondary sort
      const aName = a.section?.name || "";
      const bName = b.section?.name || "";
      const sectionCompare = aName.localeCompare(bName);
      if (sectionCompare !== 0) return sectionCompare;

      // Finally, student last name
      return a.enrollmentApplication?.learner?.lastName?.localeCompare(b.enrollmentApplication?.learner?.lastName || "") || 0;
    });

    return sortedList;
  }, [records, sectionFilter, searchQuery]);

  const suppressEmptyState = loadingRecords && !showSkeleton && filteredRecords.length === 0;

  const pendingLearners = useMemo(() => {
    return filteredRecords.filter(r => {
      if (r.eosyStatus === "TRANSFERRED_OUT" || r.eosyStatus === "DROPPED_OUT") {
        return false;
      }
      return r.smartSyncStatus !== "FINALIZED_SMART_GRADES_RECEIVED";
    });
  }, [filteredRecords]);
  const pendingCount = pendingLearners.length;

  const latestSmartSyncAt = useMemo(() => {
    const timestamps = records
      .map((record) => record.smartSynchronizedAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [records]);

  const scopeSections = useMemo(() => {
    return allSections.filter(s =>
      String(s.gradeLevelId) === activeTab &&
      (sectionFilter === "ALL" || s.name === sectionFilter)
    );
  }, [allSections, activeTab, sectionFilter]);

  const isScopeFinalized = scopeSections.length > 0 && scopeSections.every(s => s.isEosyFinalized);

  const pendingClassesList = useMemo(() => {
    const sets = new Set<string>();
    filteredRecords.forEach((r) => {
      if (
        r.smartSyncStatus !== "FINALIZED_SMART_GRADES_RECEIVED" &&
        r.eosyStatus !== "TRANSFERRED_OUT" &&
        r.eosyStatus !== "DROPPED_OUT" &&
        r.section?.name
      ) {
        sets.add(r.section.name);
      }
    });
    return Array.from(sets);
  }, [filteredRecords]);

  const pendingIrregularCount = useMemo(() => {
    return filteredRecords.filter((r) => {
      return r.eosyStatus !== "DROPPED_OUT"
        && r.eosyStatus !== "TRANSFERRED_OUT"
        && r.smartSyncStatus !== "FINALIZED_SMART_GRADES_RECEIVED"
        && r.smartSyncStatus !== "INCOMPLETE_SUBJECT_GRADES"
        && r.smartSyncReason !== "Learner has pending remedial classes.";
    }).length;
  }, [filteredRecords]);

  const pendingRemedialLearners = useMemo(() => {
    return filteredRecords.filter((r) => {
      return r.eosyStatus !== "DROPPED_OUT"
        && r.eosyStatus !== "TRANSFERRED_OUT"
        && r.smartSyncReason === "Learner has pending remedial classes.";
    });
  }, [filteredRecords]);

  const incompleteSubjectGradesCount = useMemo(() => {
    return filteredRecords.filter((r) => {
      return r.eosyStatus !== "DROPPED_OUT"
        && r.eosyStatus !== "TRANSFERRED_OUT"
        && r.smartSyncStatus === "INCOMPLETE_SUBJECT_GRADES";
    }).length;
  }, [filteredRecords]);

  const scopedUnlockedClassesCount = pendingClassesList.length;
  const hasUnlockedClasses = scopedUnlockedClassesCount > 0;
  const scopedIrregularBlockerCount = pendingIrregularCount;
  const hasIrregularBlockers = scopedIrregularBlockerCount > 0;
  const scopedIncompleteGradesCount = incompleteSubjectGradesCount;
  const hasIncompleteGrades = scopedIncompleteGradesCount > 0;
  const scopedRemedialBlockerCount = pendingRemedialLearners.length;
  const hasRemedialBlockers = scopedRemedialBlockerCount > 0;
  const blockersCount = (hasUnlockedClasses ? 1 : 0) + (hasIrregularBlockers ? 1 : 0) + (hasIncompleteGrades ? 1 : 0) + (pendingCount > 0 ? 1 : 0) + (hasRemedialBlockers ? 1 : 0);

  const targetScopeName = sectionFilter === "ALL" ? `All ${activeGradeName}` : `Section: ${sectionFilter}`;
  const descriptionTarget = sectionFilter === "ALL"
    ? `all ${activeGradeName} learners`
    : `the ${activeGradeName} - ${sectionFilter} section`;

  const baseColumns = useMemo<ColumnDef<EnrollmentRecord>[]>(
    () => [
      {
        id: "student",
        accessorKey: "enrollmentApplication.learner.lastName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="LEARNER" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const recordId = r.id;

          const unsaved = unsavedChanges[recordId] || {};
          const currentLrn = "lrn" in unsaved ? unsaved.lrn : r.enrollmentApplication.learner.lrn;
          const currentFirstName = "firstName" in unsaved ? unsaved.firstName : r.enrollmentApplication.learner.firstName;
          const currentLastName = "lastName" in unsaved ? unsaved.lastName : r.enrollmentApplication.learner.lastName;

          const isLrnChanged = "lrn" in unsaved && unsaved.lrn !== r.enrollmentApplication.learner.lrn;
          const isNameChanged = ("firstName" in unsaved && unsaved.firstName !== r.enrollmentApplication.learner.firstName) ||
            ("lastName" in unsaved && unsaved.lastName !== r.enrollmentApplication.learner.lastName);

          const reportedGrades =
            r.enrollmentApplication.reportedGrades ?? {};
          const geofencingValue = reportedGrades.geofencing;
          const geofencing =
            typeof geofencingValue === "object" &&
              geofencingValue !== null
              ? (geofencingValue as Record<string, unknown>)
              : {};
          const storedLatitude =
            typeof geofencing.latitude === "number"
              ? geofencing.latitude
              : null;
          const storedLongitude =
            typeof geofencing.longitude === "number"
              ? geofencing.longitude
              : null;
          const currentLat = "latitude" in unsaved
            ? unsaved.latitude
            : storedLatitude;
          const currentLng = "longitude" in unsaved
            ? unsaved.longitude
            : storedLongitude;
          const isCoordsChanged = "latitude" in unsaved || "longitude" in unsaved;

          if (hasOverride) {
            const initials = getInitials(r.enrollmentApplication.learner.firstName, r.enrollmentApplication.learner.lastName);
            return (
              <div className="flex min-w-0 items-center gap-3 py-1 pl-1">
                <UserPhoto
                  photo={r.enrollmentApplication.learner.studentPhoto}
                  containerClassName="w-12 h-12 rounded-full shadow-sm border shrink-0"
                  className="w-full h-full object-cover"
                  alt={`${r.enrollmentApplication.learner.lastName}, ${r.enrollmentApplication.learner.firstName}`}
                  fallbackIcon={
                    <div className="w-full h-full rounded-full flex items-center justify-center text-white  text-sm bg-primary">
                      {initials}
                    </div>
                  }
                />
                <div className="flex flex-col gap-2 text-left min-w-0 flex-1">
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input
                      value={currentLastName || ""}
                      onChange={(e) => handleFieldChange(recordId, "lastName", e.target.value)}
                      disabled={isCommitting}
                      className={cn("h-8 text-sm font-bold uppercase w-32", isNameChanged && "border-amber-500 focus-visible:ring-amber-500")}
                      placeholder="Last Name"
                    />
                    <Input
                      value={currentFirstName || ""}
                      onChange={(e) => handleFieldChange(recordId, "firstName", e.target.value)}
                      disabled={isCommitting}
                      className={cn("h-8 text-sm font-bold uppercase w-32", isNameChanged && "border-amber-500 focus-visible:ring-amber-500")}
                      placeholder="First Name"
                    />
                    {isNameChanged && <span className="text-sm text-amber-600 font-bold shrink-0">Unsaved</span>}
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex-1 flex gap-1 items-center">
                      <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">LRN:</span>
                      <Input
                        value={currentLrn || ""}
                        onChange={(e) => handleFieldChange(recordId, "lrn", e.target.value)}
                        disabled={isCommitting}
                        className={cn("h-8 text-sm font-bold w-36", isLrnChanged && "border-amber-500 focus-visible:ring-amber-500")}
                        placeholder="12-digit LRN"
                      />
                      {isLrnChanged && <span className="text-sm text-amber-600 font-bold shrink-0">Unsaved</span>}
                    </div>

                    <GeofencingPopover
                      latitude={currentLat}
                      longitude={currentLng}
                      onChange={(latVal, lngVal) => {
                        handleFieldChange(recordId, "latitude", latVal);
                        handleFieldChange(recordId, "longitude", lngVal);
                      }}
                      isChanged={isCoordsChanged}
                      disabled={isCommitting}
                    />
                  </div>
                </div>
              </div>
            );
          }

          const initials = getInitials(r.enrollmentApplication.learner.firstName, r.enrollmentApplication.learner.lastName);

          return (
            <div className="flex min-w-0 items-center gap-3 py-1 pl-1">
              <UserPhoto
                photo={r.enrollmentApplication.learner.studentPhoto}
                containerClassName="w-12 h-12 rounded-full shadow-sm shrink-0 border-2 border-primary border-solid"
                className="w-full h-full object-cover"
                alt={`${r.enrollmentApplication.learner.lastName}, ${r.enrollmentApplication.learner.firstName}`}
                fallbackIcon={
                  <div className="w-full h-full rounded-full flex items-center justify-center text-white  text-sm bg-primary">
                    {initials}
                  </div>
                }
              />
              <div className="flex flex-col text-left leading-tight text-sm sm:text-base min-w-0">
                <span className="font-bold uppercase truncate">
                  {row.original.enrollmentApplication.learner.lastName}, {row.original.enrollmentApplication.learner.firstName}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="text-base text-foreground uppercase">
                    LRN: {row.original.enrollmentApplication.learner.lrn || "NO LRN"}
                  </span>
                  {row.original.nextYearCurriculum === "REGULAR" &&
                    row.original.enrollmentApplication.applicantType !== "REGULAR" &&
                    row.original.enrollmentApplication.applicantType !== "LATE_ENROLLEE"}
                </div>
              </div>
            </div>
          );
        },
        meta: { className: "min-w-[250px] text-left w-full" }
      },
      {
        id: "section",
        accessorKey: "section.name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="SECTION" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const recordId = r.id;
          const unsaved = unsavedChanges[recordId] || {};
          const currentSectionId = "sectionId" in unsaved ? unsaved.sectionId : r.sectionId;
          const isSectionChanged = "sectionId" in unsaved && unsaved.sectionId !== r.sectionId;

          const gradeSections = allSections.filter(s => String(s.gradeLevelId) === activeTab);

          if (hasOverride) {
            return (
              <div className="flex flex-col gap-1 items-start">
                <Select
                  value={currentSectionId ? String(currentSectionId) : ""}
                  onValueChange={(val) => handleFieldChange(recordId, "sectionId", Number(val))}
                  disabled={isCommitting}
                >
                  <SelectTrigger className={cn("h-8 text-sm font-bold w-36", isSectionChanged && "border-amber-500 focus:ring-amber-500")}>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeSections.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSectionChanged && <span className="text-sm text-amber-600 font-bold">Unsaved</span>}
              </div>
            );
          }

          return (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center w-full">
                    <span className="text-base font-bold uppercase cursor-help">{row.original.section?.name || "--"}</span>
                  </div>
                </TooltipTrigger>
                {row.original.section?.advisers?.[0]?.teacher && (
                  <TooltipContent className={cn("px-3 py-2 border", getGradeLevelBadgeStyles(row.original.enrollmentApplication.gradeLevel?.name))}>
                    <p className="font-bold">ADVISER: {`${row.original.section.advisers[0].teacher.firstName} ${row.original.section.advisers[0].teacher.lastName}`}</p>
                    <p className="font-bold">EMPLOYEE ID: {row.original.section.advisers[0].teacher.employeeId}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        },
        meta: { className: "min-w-[150px] text-center" }
      },
      {
        id: "finalAve",
        accessorKey: "finalAverage",
        header: ({ column }) => <DataTableColumnHeader column={column} title="FINAL GEN AVE" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const root = (r.enrollmentApplication.reportedGrades as Record<string, unknown>) ?? {};
          const envelope = (typeof root.__smartOutcome === 'object' && root.__smartOutcome !== null && !Array.isArray(root.__smartOutcome)) 
            ? (root.__smartOutcome as Record<string, unknown>)
            : null;
          const envelopeAve = typeof envelope?.finalGeneralAverage === "number" && Number.isFinite(envelope.finalGeneralAverage) 
            ? envelope.finalGeneralAverage 
            : null;
            
          const ave = envelopeAve ?? r.finalAverage;

          if (ave === null || ave === undefined) {
            return (
              <span className="font-bold text-base sm:text-base leading-tight block text-center text-muted-foreground opacity-60">
                --
              </span>
            );
          }
          const isFailing = ave < 75;

          return (
            <div className="flex justify-center items-center gap-1 w-full">
              <span className={cn("text-base sm:text-base leading-tight tabular-nums block text-center",
                isFailing ? "text-red-600 font-bold" : "text-gray-900 font-bold"
              )}>
                {ave.toFixed(2)}
              </span>
            </div>
          );
        },
        size: 100,
        meta: { className: "w-[100px] text-center" }
      },
      {
        id: "status",
        accessorKey: "eosyStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="EOSY STATUS" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const resolvedStatus: string = r.eosyStatus ?? "ACTION_REQUIRED";
          const isGrade10 = activeGradeName.includes("10");
          const statusLabel = formatStatusLabel(resolvedStatus as string, isGrade10);
          const isDeparture = resolvedStatus === "DROPPED_OUT" || resolvedStatus === "TRANSFERRED_OUT";
          const syncLabel = r.smartSyncStatus === "FINALIZED_SMART_GRADES_RECEIVED"
            ? "Finalized SMART Grades Received"
            : r.smartSyncStatus === "INCOMPLETE_SUBJECT_GRADES"
              ? "Incomplete Subject Grades"
              : r.smartSyncStatus === "SMART_DATA_NEEDS_REVIEW"
                ? "SMART Data Needs Review"
                : "Waiting for Finalization";
          const displayLabel = isDeparture ? statusLabel : r.smartSyncStatus === "FINALIZED_SMART_GRADES_RECEIVED"
            ? (r.isScpDemoted && resolvedStatus === "PROMOTED" ? "PROMOTED (TO BEC)" : statusLabel)
            : syncLabel;
          const canRecordDeparture = !r.section.isEosyFinalized && !isScopeFinalized && !isHistoricalReadOnly;

          const currentAve = r.finalAverage;
          const isScpDemoted = r.isScpDemoted;
          const currentDeficiencyNote = r.academicDeficiencyNote;

          const renderTooltip = (trigger: React.ReactNode) => {
            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {trigger}
                  </TooltipTrigger>
                  <TooltipContent collisionPadding={24} className="bg-amber-50 border border-amber-300 text-amber-900 shadow-lg rounded-md p-4 w-100 text-left mr-6">
                    <h4 className="text-base font-extrabold uppercase tracking-wide text-amber-800 border-b border-amber-200 pb-2 mb-2">
                      BEC Lateral Transfer
                    </h4>
                    <p className="text-base leading-snug">
                      Learner will be laterally transferred to the Basic Education Curriculum (BEC) next school year due to the following grade deficiency:
                    </p>
                    <ul className="list-disc pl-6 font-extrabold space-y-1 mt-2">
                      {r.scpViolations?.map((v, i) => (
                        <li key={i}>{v.subject} ({v.actualGrade})</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          };

          const renderRetainedTooltip = (trigger: React.ReactNode) => {
            const isFailingAve = currentAve !== null && currentAve !== undefined && currentAve < 75;
            const reason = isFailingAve ? `Final average of ${currentAve} is below the passing threshold of 75` : "Learner passed the general average but failed 3 or more individual learning areas";
            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {trigger}
                  </TooltipTrigger>
                  <TooltipContent collisionPadding={24} className="bg-red-50 border border-red-300 text-red-900 shadow-lg rounded-md p-4 w-100 text-left mr-6">
                    <h4 className="text-base font-extrabold uppercase tracking-wide text-red-800 border-b border-red-200 pb-2 mb-2">
                      Retention Reason
                    </h4>
                    <p className="text-base leading-snug">
                      {reason}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          };

          const renderGeneralTooltip = (trigger: React.ReactNode) => {
            if (isScpDemoted && resolvedStatus === "PROMOTED") {
              return renderTooltip(trigger);
            }
            if (resolvedStatus === "RETAINED") {
              return renderRetainedTooltip(trigger);
            }

            let title = "";
            let description: React.ReactNode = "";
            let colorClass = "bg-green-50 border-green-300 text-green-900";
            let titleColorClass = "text-green-800 border-green-200";

            switch (resolvedStatus) {
              case "PROMOTED":
                title = isGrade10 ? "COMPLETER" : "PROMOTED";
                description = "Learner met all academic requirements and is eligible for the next grade level.";
                break;
              case "CONDITIONALLY_PROMOTED":
                title = "CONDITIONALLY PROMOTED";
                description = currentDeficiencyNote
                  ? (
                    <>
                      <span className="block mb-1">Learner has academic deficiencies. {currentDeficiencyNote.split(',').length > 1 ? "Deficiencies:" : "Deficiency:"}</span>
                      <ul className="list-disc pl-6 font-extrabold space-y-1">
                        {currentDeficiencyNote.split(',').map((def, i) => (
                          <li key={i}>{def.trim()}</li>
                        ))}
                      </ul>
                    </>
                  )
                  : "Learner has academic deficiencies that must be addressed.";
                colorClass = "bg-amber-50 border-amber-300 text-amber-900";
                titleColorClass = "text-amber-800 border-amber-200";
                break;
              case "DROPPED_OUT":
                title = "DROPPED OUT";
                description = "Learner did not complete the school year.";
                colorClass = "bg-amber-50 border-amber-300 text-amber-900";
                titleColorClass = "text-amber-800 border-amber-200";
                break;
              case "TRANSFERRED_OUT":
                title = "TRANSFERRED OUT";
                description = "Learner transferred to another school before completing the year.";
                colorClass = "bg-amber-50 border-amber-300 text-amber-900";
                titleColorClass = "text-amber-800 border-amber-200";
                break;
              case "ACTION_REQUIRED":
                title = "ACTION REQUIRED";
                description = "Please review the learner's records and select an appropriate EOSY status.";
                colorClass = "bg-red-50 border-red-300 text-red-900";
                titleColorClass = "text-red-800 border-red-200";
                break;
              default:
                return trigger;
            }

            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {trigger}
                  </TooltipTrigger>
                  <TooltipContent collisionPadding={24} className={cn("shadow-lg rounded-md p-4 w-100 text-left mr-6", colorClass)}>
                    <h4 className={cn("text-base font-extrabold uppercase tracking-wide border-b pb-2 mb-2", titleColorClass)}>
                      {title}
                    </h4>
                    <div className="text-base leading-snug">
                      {description}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          };

          const statusBadge = (
            <div className={cn(
              "flex min-w-[220px] flex-col items-start rounded-md border px-3 py-2 text-left",
              isDeparture || resolvedStatus === "CONDITIONALLY_PROMOTED" || resolvedStatus === "RETAINED"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : r.smartSyncStatus === "FINALIZED_SMART_GRADES_RECEIVED"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700",
            )}>
              <span className="text-sm font-bold uppercase cursor-help">{displayLabel}</span>
            </div>
          );

          return (
            <div className="flex w-full items-center justify-center gap-2">
              {r.smartSyncStatus !== "FINALIZED_SMART_GRADES_RECEIVED" && !isDeparture ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {statusBadge}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-sm font-bold flex flex-col gap-1">
                      <span>{r.smartSyncReason ?? syncLabel}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                renderGeneralTooltip(statusBadge)
              )}

              {canRecordDeparture && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      aria-label={`Learner status actions for ${r.enrollmentApplication.learner.firstName} ${r.enrollmentApplication.learner.lastName}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem onSelect={() => setOverrideRecord(r)}>
                      Record Dropped Out or Transferred Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        },
        meta: { className: "w-[240px] text-center" }
      },
    ],
    [isScopeFinalized, hasOverride, unsavedChanges, allSections, activeTab, isCommitting, handleFieldChange, activeGradeName, isHistoricalReadOnly],
  );

  const columns = useMemo(() => {
    return baseColumns;
  }, [baseColumns]);

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("EOSY Updating");
    return () => setTitle(null);
  }, [setTitle]);

  const isRolloverReady = useMemo(() => {
    if (!allSections || allSections.length === 0) return false;

    const grade7Sections = allSections.filter(s => s.gradeLevel.name.toLowerCase().includes("grade 7"));
    const grade7HasLearners = grade7Sections.some(s => (s._count?.enrollmentRecords || 0) > 0);
    if (!grade7HasLearners) return false;

    const hasUnfinalizedActiveSections = allSections.some(s =>
      !s.isEosyFinalized && (s._count?.enrollmentRecords || 0) > 0
    );

    return !hasUnfinalizedActiveSections;
  }, [allSections]);



  if (!isEosyPhase && !isHistoricalReadOnly) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <div className="flex min-h-0 flex-col overflow-hidden">



        {/* ── Grade Tabs + Transition Button Row ── */}
        <Tabs value={activeTab} onValueChange={guardedSetActiveTab} className="flex flex-col">
          <div className="flex items-center gap-4 mb-4 flex-shrink-0">
            <TabsList className="flex-1 flex flex-wrap sm:flex-nowrap h-auto gap-1 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
              {gradeLevels.map((gl) => (
                <TabsTrigger
                  key={gl.id}
                  value={String(gl.id)}
                  disabled={syncingSmart}
                  className={cn(
                    "flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
                  )}
                >
                  {activeTab === String(gl.id) && (
                    <motion.div
                      layoutId="enrollment-eosy-grade-pill"
                      className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className={cn("relative z-20 text-base font-bold uppercase", activeTab === String(gl.id) ? "text-primary-foreground" : "text-foreground")}>
                    {gl.name.replace(/grade\s*/i, "Grade ")}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {!isHistoricalReadOnly && isRolloverReady && (
              <AtomicRolloverDialog
                sourceSchoolYearId={activeSchoolYearId ?? 0}
                sourceYearLabel={activeSchoolYearLabel ?? ""}
                trigger={
                  <Button
                    size="lg"
                    className="bg-primary text-primary-foreground font-bold shadow-sm px-8 py-3 h-auto whitespace-nowrap shrink-0 rounded-xl uppercase"
                  >
                    Review Rollover Readiness
                  </Button>
                }
              />
            )}
          </div>

          {activeTab ? (
            <AnimatePresence mode="wait">
              {!suppressEmptyState && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-h-0 w-full flex-col space-y-4"
                >
                  {isScopeFinalized && (
                    <div className="flex items-center justify-between w-full bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 shrink-0">
                      <span className="text-base leading-tight font-bold text-amber-900 uppercase tracking-widest">
                        EOSY FINALIZED: OFFICIAL RECORDS LOCKED. NO FURTHER CHANGES ALLOWED.
                      </span>
                      {isSystemAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUnlockModalOpen(true)}
                          className="font-bold text-amber-800 border-amber-300 hover:bg-amber-100/80 uppercase text-xs tracking-wider shadow-sm shrink-0"
                        >
                          <Unlock className="w-3 h-3 mr-1.5" />
                          Override Lock
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="bg-muted border border-slate-200 rounded-md shadow-sm flex h-[calc(100dvh-11rem)] min-h-0 flex-col overflow-hidden sm:h-[calc(100dvh-10rem)]">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
                      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">
                        {/* Left Side Actions */}
                        <div className="flex-1 w-full min-w-[200px]">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="SEARCH LRN, FIRST NAME, LAST NAME..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 pr-4 bg-muted/50 focus:bg-muted transition-colors h-10 w-full font-bold"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          <Select
                            isFilter
                            value={sectionFilter}
                            onValueChange={setSectionFilter}
                          >
                            <SelectTrigger className="w-44 bg-background border-border font-bold">
                              <SelectValue placeholder="Filter by Section / Adviser" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL" className="font-bold cursor-pointer">All Sections</SelectItem>
                              {sectionGroups.map(([groupName, secs]) => (
                                <SelectGroup key={groupName}>
                                  <SelectLabel className="font-bold text-foreground uppercase text-sm tracking-wider bg-muted/30 py-1.5 px-2">{groupName}</SelectLabel>
                                  {secs.map(sec => (
                                    <SelectItem key={sec} value={sec} className="font-bold pl-6">{sec}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            disabled={syncingSmart || isScopeFinalized}
                            onClick={() => void handleSyncSmartGrades()}
                            className="font-bold border-border hover:bg-primary hover:text-primary-foreground flex items-center gap-1.5 shrink-0"
                          >
                            {syncingSmart ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Syncing EOSY Grades</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" />
                                <span>SYNC GRADES</span>
                              </>
                            )}
                          </Button>

                          {hasUnsavedEosyChanges && (
                            <Button
                              onClick={() => void handleCommitChanges()}
                              disabled={isCommitting}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 flex items-center gap-1.5 shadow-md shrink-0"
                            >
                              {isCommitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              <span>Save Changes ({Object.keys(unsavedChanges).length})</span>
                            </Button>
                          )}

                          {(isScopeFinalized || (blockersCount === 0 && pendingCount === 0)) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  disabled={recordingForms}
                                  className="font-bold border-border hover:bg-primary hover:text-primary-foreground uppercase"
                                >
                                  {recordingForms ? "Exporting..." : (
                                    <>
                                      <FileText className="w-4 h-4 mr-2" />
                                      Export Forms
                                      <ChevronDown className="w-4 h-4 ml-2" />
                                    </>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 font-bold">
                                <DropdownMenuItem onClick={() => void recordSf5ForScope()} className="cursor-pointer">
                                  Export Official SF5
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void recordSf6()} className="cursor-pointer">
                                  Export Official SF6
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>

                        {/* Right Side Status & Finalize */}
                        <div className="flex flex-wrap items-center gap-4 xl:justify-end">
                          {/* Status Indicators */}
                          <div className="flex items-center gap-3">
                            {pendingCount > 0 && !isScopeFinalized && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-base font-bold shadow-sm border border-border cursor-help transition-colors hover:bg-secondary/80">
                                      {pendingCount} Waiting for Finalization
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground border-border p-4 shadow-xl rounded-lg text-sm max-w-[400px] max-h-[300px] overflow-y-auto">
                                    <p className="font-bold mb-3 border-b pb-2">Learners Waiting for Finalization</p>
                                    <ul className="list-disc pl-5 space-y-1.5">
                                      {pendingLearners.map(learner => (
                                        <li key={learner.id} className="text-foreground">
                                          <span className="font-bold text-foreground">{learner.enrollmentApplication.learner.lastName}, {learner.enrollmentApplication.learner.firstName}</span>
                                          <br />
                                          <span className="text-sm">LRN: {learner.enrollmentApplication.learner.lrn || "N/A"}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {!isScopeFinalized && blockersCount > 0 && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-base font-bold cursor-help transition-colors hover:bg-destructive/20">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      {blockersCount} {blockersCount === 1 ? "Blocker" : "Blockers"} Detected
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground border-border p-4 shadow-xl rounded-lg text-sm max-w-[400px] max-h-[400px] overflow-y-auto">
                                    <p className="font-bold mb-3 border-b pb-2 text-destructive">
                                      Pending Requirements
                                    </p>
                                    <div className="space-y-4 text-foreground">
                                      {hasUnlockedClasses && (
                                        <div>
                                          <p className="font-bold text-sm mb-1">{scopedUnlockedClassesCount} section(s) waiting for finalized EOSY grades:</p>
                                          <ul className="list-disc pl-5 space-y-0.5">
                                            {pendingClassesList.map(section => (
                                              <li key={section} className="text-foreground">
                                                <span className="font-bold text-foreground">{section}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {hasRemedialBlockers && (
                                        <div>
                                          <p className="font-bold text-sm mb-1">{scopedRemedialBlockerCount} learner(s) with pending remedial class grades:</p>
                                          <ul className="list-disc pl-5 space-y-1.5">
                                            {pendingRemedialLearners.map(learner => (
                                              <li key={learner.id} className="text-foreground">
                                                <span className="font-bold text-foreground">{learner.enrollmentApplication.learner.lastName}, {learner.enrollmentApplication.learner.firstName}</span>
                                                <br />
                                                <span className="text-sm">LRN: {learner.enrollmentApplication.learner.lrn || "N/A"}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {hasIrregularBlockers && (
                                        <div>
                                          <p className="font-semibold text-sm">
                                            • {scopedIrregularBlockerCount ?? 0} learner(s) have incomplete or unverified SMART outcomes.
                                          </p>
                                        </div>
                                      )}
                                      {hasIncompleteGrades && (
                                        <div>
                                          <p className="font-semibold text-sm">
                                            • {scopedIncompleteGradesCount ?? 0} learner(s) have INCOMPLETE SUBJECT GRADES fetched from SMART API.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>

                          {/* Finalize Button */}
                          {!isScopeFinalized && blockersCount === 0 && scopeSections.length > 0 && (
                            <Button
                              onClick={() => setFinalizeModalOpen(true)}
                              size="lg"
                              className="font-bold shadow-md transition-all bg-primary text-primary-foreground uppercase"
                            >
                              Finalize {targetScopeName}
                            </Button>
                          )}

                          {isScopeFinalized && sectionFilter !== "ALL" && !isSchoolYearFinalized && !isHistoricalReadOnly && (
                            <Button
                              onClick={() => setUnlockModalOpen(true)}
                              disabled={unlockLoading}
                              size="lg"
                              variant="outline"
                              className="font-bold shadow-md transition-all uppercase border-primary text-primary hover:text-primary"
                            >
                              Unlock Section Roster
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col bg-card h-full min-h-0 relative">
                      <div className="overflow-x-auto flex-1 min-h-0 relative">
                        <DataTable
                          columns={columns}
                          data={filteredRecords}
                          loading={loadingRecords && isInitialLoad}
                          loadingBehavior="delayed"
                          containerHeight="100%"
                          bodyOverlay={(
                            <AnimatePresence>
                              {syncingSmart && smartSyncProgress && (
                                <TableCellsTransitionLoader
                                  currentSection={smartSyncProgress.currentSection}
                                  completedSections={smartSyncProgress.completedSections}
                                  failedSections={smartSyncProgress.failedSections.length}
                                  totalSections={smartSyncProgress.totalSections}
                                />
                              )}
                            </AnimatePresence>
                          )}
                          disableScrolling={syncingSmart && !!smartSyncProgress}
                          virtualize={false}
                          onRowClick={(row) => {
                            if (syncingSmart) return;
                            setExpandedRecordId((current) => current === row.id ? null : row.id);
                          }}
                          isRowClickable={() => !syncingSmart}
                          getRowAriaExpanded={(row) => expandedRecordId === row.id}
                          getRowAriaLabel={(row) => {
                            const learner = row.enrollmentApplication.learner;
                            const action = expandedRecordId === row.id ? "Hide" : "Show";
                            return `${action} SF9 grades for ${learner.lastName}, ${learner.firstName}`;
                          }}
                          getRowClassName={(row: EnrollmentRecord) =>
                            expandedRecordId === row.id
                              ? "bg-muted/60 hover:bg-muted/60"
                              : ""
                          }
                          renderRowAfter={(row) => (
                            <TableRow className="border-0 bg-background hover:bg-background">
                              <TableCell colSpan={columns.length} className="border-0 p-0">
                                <AnimatePresence initial={false}>
                                  {expandedRecordId === row.id && (
                                    <motion.div
                                      key={`sf9-${row.id}`}
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25, ease: "easeInOut" }}
                                      className="overflow-hidden border-b border-border"
                                    >
                                      <EosySf9GradeTable
                                        reportedGrades={row.enrollmentApplication.reportedGrades}
                                        finalAverage={row.finalAverage}
                                        schoolYearLabel={exportLock?.schoolYearLabel ?? activeSchoolYearLabel ?? "Selected School Year"}
                                      />
                                      <RemedialClassesTable 
                                        learnerId={row.enrollmentApplication.learner.id} 
                                        activeSchoolYearLabel={exportLock?.schoolYearLabel ?? activeSchoolYearLabel ?? "Selected School Year"}
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </TableCell>
                            </TableRow>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : !isInitialLoad && gradeLevels.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-muted/30 border border-dashed rounded-lg mt-4">
              <p className="text-muted-foreground font-bold text-lg">No sections found for this school year.</p>
            </div>
          ) : null}
        </Tabs>

      </div>

      <Dialog open={finalizeModalOpen} onOpenChange={setFinalizeModalOpen}>
        <DialogContent className={cn("w-full max-w-3xl rounded-lg p-8 overflow-hidden", "bg-sidebar shadow-2xl")}>
          <DialogHeader className="space-y-2 text-center items-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(var(--primary))] ring-[6px] ring-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-5 text-[hsl(var(--primary-foreground))]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Lock {targetScopeName} End of School Year (EOSY)?</DialogTitle>
            <DialogDescription className="text-center pt-2 font-bold text-md">
              {activeGradeName.includes("10") ? (
                `Are you sure you want to finalize ${descriptionTarget}? This will officially close the school year and generate their Junior High School completion records.`
              ) : (
                <>
                  Are you sure you want to finalize {descriptionTarget}? This will officially close the school year and determine their promotion to{' '}
                  <span className="font-bold">{getNextGradeName(activeGradeName)}</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[hsl(var(--primary)/0.05)] p-4 rounded-md text-md text-foreground my-2 border border-[hsl(var(--primary)/0.2)] font-bold">
            <ul className="list-disc pl-5 space-y-2">
              <li>Finalized SMART grades and EOSY outcomes will be locked for this reporting period.</li>
              <li>The School Form 5 (SF5) for {descriptionTarget} will be locked until an authorized registrar reopens the section for a newer SMART result.</li>
              <li>This data will be permanently written to the learners' Permanent Academic Record (SF10 / Form 137).</li>
            </ul>
            <p className="font-bold text-[hsl(var(--primary))] underline mt-5 text-center">This action is final and cannot be undone.</p>
          </div>
          <DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setFinalizeModalOpen(false)}
              disabled={finalizeLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-bold text-md",
                "border border-gray-200 bg-muted text-foreground",
                "hover:bg-gray-50 active:bg-gray-100",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleFinalizeGrade}
              disabled={finalizeLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-bold text-md",
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                "hover:bg-[hsl(var(--primary)/0.9)]",
                "shadow-md",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              {finalizeLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                `Finalize & Lock ${targetScopeName}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PreFlightBlockerModal
        open={preFlightModalOpen}
        onOpenChange={setPreFlightModalOpen}
        unlockedClassesCount={scopedUnlockedClassesCount}
        irregularBlockerCount={scopedIrregularBlockerCount ?? 0}
        incompleteSubjectGradesCount={scopedIncompleteGradesCount ?? 0}
        targetScopeName={targetScopeName}
      />

      <Dialog open={sf5WatermarkOpen} onOpenChange={setSf5WatermarkOpen}>
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden bg-muted border border-gray-300 shadow-2xl">
          <DialogHeader className="p-4 border-b bg-gray-50 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">School Form 5 (SF5) Preview</DialogTitle>
              <DialogDescription asChild>
                <span>Document generated with unresolved SMART outcomes</span>
              </DialogDescription>
            </div>
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold border border-red-200">
              UNFINALIZED
            </div>
          </DialogHeader>
          <div className="relative h-[600px] w-full bg-gray-100 p-8 flex items-center justify-center overflow-hidden">
            {/* The Document Paper */}
            <div className="relative bg-muted w-full h-full shadow-lg border border-gray-200 p-8 flex flex-col justify-between">

              {/* WATERMARK OVERLAY */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                <div className="transform -rotate-45 text-[6rem] font-bold text-red-600/10 whitespace-nowrap select-none">
                  DRAFT COPY
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mt-48 overflow-hidden">
                <div className="transform -rotate-45 text-[2rem] font-bold text-red-600/10 whitespace-nowrap select-none">
                  PENDING ACADEMIC CLEARANCE
                </div>
              </div>

              {/* Fake Document Content */}
              <div>
                <h2 className="text-2xl font-serif text-center font-bold mb-8">School Form 5 (SF5)</h2>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between mt-16 pt-8 border-t border-gray-300">
                <div className="text-center w-1/3">
                  <div className="border-b border-black mb-2 h-8"></div>
                  <p className="text-sm font-bold">Class Adviser</p>
                </div>
                <div className="text-center w-1/3 relative">
                  {/* Blocked Signature Field */}
                  <div className="absolute inset-0 bg-red-100/80 backdrop-blur-sm flex items-center justify-center border-2 border-red-500 border-dashed z-40">
                    <span className="text-red-700 font-bold text-sm uppercase text-center leading-tight">Signature Blocked<br />(Pending Finalization)</span>
                  </div>
                  <div className="border-b border-black mb-2 h-8"></div>
                  <p className="text-sm font-bold">Official Registrar Signature</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-sm text-gray-500 italic">This copy cannot be officially distributed.</span>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setSf5WatermarkOpen(false)}>Close Preview</Button>
              <Button onClick={() => setSf5WatermarkOpen(false)} className="bg-primary hover:bg-primary/90 text-white font-bold">
                Download Draft PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EosyOverrideModal
        record={overrideRecord}
        historicalOverride={hasOverride}
        onClose={() => setOverrideRecord(null)}
        onSuccess={() => {
          void fetchGradeRecords(activeTab);
          void fetchExportLockState();
        }}
      />



      <EosyUnlockModal
        open={unlockModalOpen}
        onOpenChange={setUnlockModalOpen}
        onConfirm={handleUnlock}
        loading={unlockLoading}
        targetName={
          sectionFilter === "ALL" || sectionFilter === "all" || !sectionFilter
            ? activeGradeName
            : `Section ${sectionFilter}`
        }
      />
    </>
  );
}
