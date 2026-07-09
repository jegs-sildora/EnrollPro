import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PreFlightBlockerModal } from "@/features/enrollment/components/PreFlightBlockerModal";
import { EosyOverrideModal } from "@/features/enrollment/components/EosyOverrideModal";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { getBOSYReadiness } from "@/features/bosy/api/bosy.api";
import { Card } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  CheckCircle2,
  Lock,
  Unlock,
  Loader2,
  AlertTriangle,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Search,
  MapPin,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useHeaderStore } from "@/store/header.slice";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { cn } from "@/shared/lib/utils";
import type { EosyStatus } from "@enrollpro/shared";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/shared/ui/tooltip";
import { sileo } from "sileo";
import { useEosyStream, type EosyEventPayload } from "@/features/enrollment/hooks/useEosyStream";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Navigate, useNavigate } from "react-router";
import { useRealtimeRefresh } from "@/shared/hooks/useRealtimeRefresh";
import type { RealtimeInvalidationTopic } from "@enrollpro/shared";

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
  isScpDemoted?: boolean;
  scpViolation?: {
    subject: string;
    term: string;
    actualGrade: number;
    requiredGrade: number;
    violationType: string;
  } | null;
  sectionId: number;
  section: {
    id: number;
    name: string;
    isEosyFinalized: boolean;
    programType?: string;
    isHomogeneous?: boolean;
  };
  enrollmentApplication: {
    id: number;
    trackingNumber: string;
    applicantType: string;
    reportedGrades?: Record<string, any> | null;
    learner: {
      id: number;
      lrn: string | null;
      firstName: string;
      lastName: string;
      sex?: "MALE" | "FEMALE" | null;
    };
  };
}

interface GradeLevel {
  id: number;
  name: string;
  displayOrder: number | null;
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

const formatStatusLabel = (status: EosyStatus | string | null, isGrade10: boolean = false) => {
  const normalized = status ?? "PROMOTED";

  switch (normalized as string) {
    case "PROMOTED":
      return isGrade10 ? "JHS COMPLETER" : "PROMOTED";
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
            "h-8 px-2 flex gap-1 items-center font-extrabold cursor-pointer transition-colors shrink-0",
            isChanged ? "border-amber-500 bg-amber-50 text-amber-900" : "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <MapPin className={cn("h-4 w-4", isChanged ? "text-amber-500" : "text-muted-foreground")} />
          <span className="text-[10px]">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
          {isChanged && <span className="text-[9px] text-amber-600 font-black uppercase">Unsaved</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4 text-center space-y-3" align="end">
        <h4 className="text-sm font-extrabold uppercase text-foreground leading-none border-b pb-2">
          Residency Geofence Coordinates
        </h4>
        <p className="text-[11px] text-muted-foreground leading-normal">
          Click on the map or drag the pin to correct past geofencing coordinates.
        </p>

        <div
          ref={mapRef}
          onMouseDown={handleMouseDown}
          className="relative w-[240px] h-[180px] mx-auto bg-slate-100 border border-slate-200 rounded-md overflow-hidden cursor-crosshair select-none"
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <circle cx="120" cy="90" r="50" fill="rgba(14, 165, 233, 0.05)" stroke="rgba(14, 165, 233, 0.3)" strokeDasharray="3 3" strokeWidth="1.5" />
            <text x="120" y="32" textAnchor="middle" fill="#0284c7" className="text-[9px] font-extrabold font-sans uppercase">School Geofence Radius (1km)</text>
            <line x1="120" y1="0" x2="120" y2="180" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            <line x1="0" y1="90" x2="240" y2="90" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            <text x="24" y="20" fill="#64748b" className="text-[8px] font-bold">Brgy. San Jose</text>
            <text x="175" y="160" fill="#64748b" className="text-[8px] font-bold">Brgy. Taculing</text>
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

        <div className="bg-slate-50 border p-2 rounded text-[11px] font-mono flex flex-col items-center">
          <span className="font-extrabold text-foreground">Lat: {lat.toFixed(6)}° N</span>
          <span className="font-extrabold text-foreground">Lng: {lng.toFixed(6)}° E</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function EosyUpdating() {
  const navigate = useNavigate();
  const {
    activeSchoolYearId,
    viewingSchoolYearId,
    systemStatus,
    systemPhase,
    setHistoricalCorrectionToken,
  } = useSettingsStore();
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const isEosyPhase = systemPhase === "EOSY_CLOSING";
  const isEosyArchivedState = systemStatus === "ARCHIVED";
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);
  const [exportLock, setExportLock] = useState<EosyExportLockState | null>(null);

  const [overrideRecord, setOverrideRecord] = useState<EnrollmentRecord | null>(null);

  const [loadingRecords, setLoadingRecords] = useState(false);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [batchActionStatus, setBatchActionStatus] = useState<EosyStatus | "">("");
  const [batchUpdateLoading, setBatchUpdateLoading] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [preFlightModalOpen, setPreFlightModalOpen] = useState(false);
  const [sf5WatermarkOpen, setSf5WatermarkOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  const [reopenModalOpen, setReopenModalOpen] = useState<boolean>(false);
  const [reopenPin, setReopenPin] = useState<string>("");
  const [reopenJustification, setReopenJustification] = useState<string>("");
  const [reopenLoading, setReopenLoading] = useState<boolean>(false);

  const [dismissSuccessCard, setDismissSuccessCard] = useState<boolean>(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState<boolean>(false);

  const [transitionLoading, setTransitionLoading] = useState<boolean>(false);

  const [allSections, setAllSections] = useState<Section[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<number, {
    lrn?: string;
    firstName?: string;
    lastName?: string;
    sectionId?: number;
    finalAverage?: number | null;
    eosyStatus?: EosyStatus;
    academicDeficiencyNote?: string | null;
    latitude?: number;
    longitude?: number;
  }>>({});
  const [isCommitting, setIsCommitting] = useState(false);

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

  // Listen for commit triggers from HistoricalBanner
  useEffect(() => {
    const handleCommit = async () => {
      if (isCommitting) return;
      setIsCommitting(true);

      try {
        const validUpdates: Record<number, any> = {};
        const revertedRecords: number[] = [];

        for (const [idStr, changes] of Object.entries(unsavedChanges)) {
          const recordId = Number(idStr);
          const original = records.find(r => r.id === recordId);
          if (!original) continue;

          let hasInvalidField = false;

          // LRN validation (Philippines LRN must be 12 digits)
          if (changes.hasOwnProperty("lrn") && changes.lrn !== original.enrollmentApplication.learner.lrn) {
            if (!/^\d{12}$/.test(changes.lrn || "")) {
              hasInvalidField = true;
            }
          }

          // Names validation (Must not be empty)
          if (changes.hasOwnProperty("firstName") && !changes.firstName?.trim()) {
            hasInvalidField = true;
          }
          if (changes.hasOwnProperty("lastName") && !changes.lastName?.trim()) {
            hasInvalidField = true;
          }

          // General average validation (60-100)
          if (changes.hasOwnProperty("finalAverage") && changes.finalAverage !== original.finalAverage) {
            const avg = changes.finalAverage;
            if (avg !== null && avg !== undefined && (avg < 60 || avg > 100)) {
              hasInvalidField = true;
            }
          }

          // DepEd Status Logic: General Average < 75 cannot be PROMOTED
          const resolvedStatus = changes.hasOwnProperty("eosyStatus") ? changes.eosyStatus : original.eosyStatus;
          const resolvedAvg = changes.hasOwnProperty("finalAverage") ? changes.finalAverage : original.finalAverage;
          if (resolvedStatus === "PROMOTED" && resolvedAvg !== null && resolvedAvg !== undefined && resolvedAvg < 75) {
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
            description: `${revertedRecords.length} record(s) failed validation (invalid LRN, empty name, average out of 60-100, or average below 75 while Promoted) and were reverted.`,
          });
        }

        const validEntries = Object.entries(validUpdates);
        if (validEntries.length > 0) {
          const promises = validEntries.map(([idStr, changes]) => {
            return api.post(`/eosy/records/${idStr}/override`, changes);
          });
          await Promise.all(promises);
        }

        // Manually trigger relock
        if (ayId) {
          await api.post("/admin/historical-correction/relock", { schoolYearId: ayId });
        }

        setHistoricalCorrectionToken(null);
        setUnsavedChanges({});

        sileo.success({
          title: "Changes Saved & Session Locked",
          description: "All valid historical corrections have been committed and audit logs recorded.",
        });

        setTimeout(() => window.location.reload(), 100);
      } catch (err) {
        sileo.error({
          title: "Commit Error",
          description: "Failed to commit historical corrections. Please try again.",
        });
      } finally {
        setIsCommitting(false);
      }
    };

    window.addEventListener("historical-correction:trigger-commit", handleCommit);
    return () => {
      window.removeEventListener("historical-correction:trigger-commit", handleCommit);
    };
  }, [unsavedChanges, records, ayId, setHistoricalCorrectionToken, isCommitting]);

  useEffect(() => {
    if (!ayId) return;
    getBOSYReadiness(ayId).catch(() => { });
  }, [ayId]);

  const fetchSectionsAndGrades = useCallback(async () => {
    if (!ayId) return;
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
      }
    } catch (err) {
      toastApiError(err as never);
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
      setLoadingRecords(true);
      setRowSelection({});
      setSectionFilter("ALL");
    }
    try {
      const res = await api.get(`/eosy/grade/${gradeLevelId}/records?schoolYearId=${ayId}&_t=${Date.now()}`);
      setRecords(res.data.records || []);
    } catch (err) {
      if (!silent) toastApiError(err as never);
    } finally {
      if (!silent) setLoadingRecords(false);
    }
  }, [ayId]);

  useEffect(() => {
    void fetchSectionsAndGrades();
    void fetchExportLockState();
  }, [fetchSectionsAndGrades, fetchExportLockState]);

  useEffect(() => {
    if (activeTab) {
      void fetchGradeRecords(activeTab);
    }
  }, [activeTab, fetchGradeRecords]);

  // Auto-refresh when teacher submits/locks their section using Server-Sent Events
  useEosyStream(
    useCallback((payload: EosyEventPayload) => {
      if (!activeTab || isHistoricalReadOnly) return;
      const relevantEvents = ["TEACHER_EOSY_SUBMITTED", "SECTION_UNLOCKED", "SECTION_FINALIZED", "GRADE_LEVEL_FINALIZED"];
      if (relevantEvents.includes(payload.type)) {
        void fetchSectionsAndGrades();
        void fetchGradeRecords(activeTab, true);
        void fetchExportLockState();
      }
    }, [activeTab, isHistoricalReadOnly, fetchSectionsAndGrades, fetchGradeRecords, fetchExportLockState])
  );

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

  const handleStatusChange = useCallback(
    async (
      recordId: number,
      status: string,
      finalAverage?: number | null,
      academicDeficiencyNote?: string | null,
    ) => {
      if (isHistoricalReadOnly && !hasOverride) {
        sileo.error({ title: "Read-Only", description: "This school year is archived. All records are read-only." });
        return;
      }
      if (exportLock?.schoolYearFinalized) {
        sileo.error({ title: "School Year Locked", description: "School year EOSY is finalized. Updates are no longer allowed." });
        return;
      }

      const record = records.find((r) => r.id === recordId);
      const effectiveAve = finalAverage !== undefined ? finalAverage : record?.finalAverage;

      if (status === "PROMOTED" && effectiveAve !== null && effectiveAve !== undefined && effectiveAve < 75) {
        sileo.error({ title: "Academic Policy Violation", description: "Learner with General Average below 75.00 cannot be marked as PROMOTED." });
        return;
      }

      if (record?.section.isEosyFinalized) {
        sileo.error({ title: "Section Locked", description: "This section is already finalized." });
        return;
      }

      try {
        const payload: Record<string, unknown> = { eosyStatus: status };
        if (finalAverage !== undefined) payload.finalAverage = finalAverage;
        if (status !== "CONDITIONALLY_PROMOTED") {
          payload.academicDeficiencyNote = null;
        } else if (academicDeficiencyNote !== undefined) {
          payload.academicDeficiencyNote = academicDeficiencyNote;
        }

        await api.patch(`/eosy/records/${recordId}`, payload);

        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? {
                ...r,
                eosyStatus: status as EosyStatus,
                academicDeficiencyNote:
                  status === "CONDITIONALLY_PROMOTED"
                    ? academicDeficiencyNote ?? r.academicDeficiencyNote
                    : null,
                finalAverage: finalAverage !== undefined ? finalAverage : r.finalAverage,
              }
              : r,
          ),
        );

        if (finalAverage === undefined) {
          sileo.success({ title: "Status Updated", description: "Learner status saved successfully." });
        }
      } catch (err) {
        toastApiError(err as never);
      }
    },
    [exportLock?.schoolYearFinalized, records, isHistoricalReadOnly, hasOverride],
  );

  const handleAcademicDeficiencyNoteSave = useCallback(
    async (recordId: number, note: string) => {
      const record = records.find((item) => item.id === recordId);
      if (!record || record.eosyStatus !== "CONDITIONALLY_PROMOTED") {
        return;
      }

      try {
        await api.patch(`/eosy/records/${recordId}`, {
          eosyStatus: record.eosyStatus,
          academicDeficiencyNote: note,
        });

        setRecords((prev) =>
          prev.map((item) =>
            item.id === recordId
              ? { ...item, academicDeficiencyNote: note.trim() || null }
              : item,
          ),
        );
      } catch (err) {
        toastApiError(err as never);
      }
    },
    [records],
  );

  const handleBatchUpdate = async () => {
    if (!batchActionStatus) return;

    const selectedIndexes = Object.keys(rowSelection).map(Number);
    const selectedRecords = selectedIndexes.map((idx) => filteredRecords[idx]);

    if (selectedRecords.length === 0) {
      sileo.error({ title: "No Selection", description: "Please select at least one learner." });
      return;
    }

    // Filter out records from finalized sections
    const editableRecords = selectedRecords.filter(r => !r.section.isEosyFinalized);
    if (editableRecords.length === 0) {
      sileo.error({ title: "Action Aborted", description: "All selected learners belong to finalized sections." });
      return;
    }

    let targetRecords = editableRecords;
    let skippedCount = selectedRecords.length - editableRecords.length;

    if (batchActionStatus === "PROMOTED") {
      targetRecords = editableRecords.filter((r) => r.finalAverage && r.finalAverage >= 75);
      skippedCount += editableRecords.length - targetRecords.length;
    }

    if (targetRecords.length === 0) {
      sileo.error({ title: "Action Aborted", description: "None of the selected learners meet the criteria for this status (e.g. >= 75 for Promoted)." });
      return;
    }

    setBatchUpdateLoading(true);
    try {
      const payload = {
        schoolYearId: ayId,
        updates: targetRecords.map(r => ({ recordId: r.id, status: batchActionStatus }))
      };

      await api.put(`/eosy/grade/${activeTab}/batch-status`, payload);

      setRecords((prev) =>
        prev.map((r) => {
          const match = targetRecords.find((tr) => tr.id === r.id);
          return match ? { ...r, eosyStatus: batchActionStatus as EosyStatus } : r;
        }),
      );

      sileo.success({
        title: "Batch Updated",
        description: `${targetRecords.length} learners updated.${skippedCount > 0 ? ` ${skippedCount} skipped due to policy or locked section.` : ""}`,
      });
      setRowSelection({});
      setBatchActionStatus("");
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setBatchUpdateLoading(false);
    }
  };

  const handleFinalizeGrade = async () => {
    setFinalizeLoading(true);
    try {
      const sectionIdPayload = sectionFilter === "ALL"
        ? "all"
        : records.find(r => r.section.name === sectionFilter)?.section?.id ?? "all";

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
  const handleUnlockSection = async () => {
    if (sectionFilter === "ALL") return;

    const sectionIdPayload = records.find(r => r.section.name === sectionFilter)?.section?.id;
    if (!sectionIdPayload) return;

    setUnlockLoading(true);
    try {
      await api.post(`/eosy/sections/${sectionIdPayload}/unlock`);
      sileo.success({
        title: "Section Unlocked",
        description: `Section ${sectionFilter} has been successfully unlocked.`,
      });
      void fetchExportLockState();
      void fetchSectionsAndGrades();
      void fetchGradeRecords(activeTab);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setUnlockLoading(false);
      setUnlockModalOpen(false);
    }
  };

  const handleReopenEosySubmit = async () => {
    setReopenLoading(true);
    try {
      await api.post("/eosy/school-year/unlock", {
        schoolYearId: ayId,
        pin: reopenPin,
        justification: reopenJustification,
      });

      sileo.success({
        title: "EOSY Reopened",
        description: "The End of School Year updating has been reopened successfully.",
      });

      setReopenModalOpen(false);
      setReopenPin("");
      setReopenJustification("");

      void fetchExportLockState();
      void fetchSectionsAndGrades();
      if (activeTab) {
        void fetchGradeRecords(activeTab);
      }
    } catch (err) {
      toastApiError(err as Parameters<typeof toastApiError>[0]);
    } finally {
      setReopenLoading(false);
    }
  };
  const isSchoolYearFinalized = exportLock?.schoolYearFinalized ?? false;
  const shouldShowFinalizedView = isEosyArchivedState || isSchoolYearFinalized;

  const isAllFinalized = exportLock?.canFinalizeSchoolYear === true;


  const handleTransitionSubmit = async () => {
    setTransitionLoading(true);
    try {
      const finalizeRes = await api.post("/eosy/school-year/finalize", { schoolYearId: ayId });

      const nextSy = finalizeRes.data.nextSchoolYear;
      if (nextSy) {
        useSettingsStore.getState().triggerRolloverSwitch({
          activeSchoolYearId: nextSy.id,
          activeSchoolYearLabel: nextSy.yearLabel,
          activeSchoolYearStatus: nextSy.status,
          systemPhase: "OFFICIAL_ENROLLMENT",
          systemStatus: "ACTIVE",
        }, nextSy.yearLabel);
      } else {
        window.dispatchEvent(new CustomEvent("ROLLOVER_COMPLETE"));
      }
    } catch (err) {
      toastApiError(err as Parameters<typeof toastApiError>[0]);
      setTransitionLoading(false);
    }
  };

  // Reset success card dismissal when the finalization status of the school year changes
  useEffect(() => {
    if (!isAllFinalized) {
      setDismissSuccessCard(false);
    }
  }, [isAllFinalized]);

  const activeGradeName = gradeLevels.find((g) => String(g.id) === activeTab)?.name || "Grade Level";

  const sectionOptions = useMemo(() => {
    const sectionsSet = new Set<string>();
    records.forEach(r => {
      const name = r.section?.name?.trim();
      if (name) {
        sectionsSet.add(name);
      }
    });
    return Array.from(sectionsSet).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (sectionFilter !== "ALL") {
      list = list.filter(r => r.section.name === sectionFilter);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        const { firstName, lastName, lrn } = r.enrollmentApplication.learner;
        return (
          firstName.toLowerCase().includes(q) ||
          lastName.toLowerCase().includes(q) ||
          (lrn && lrn.toLowerCase().includes(q))
        );
      });
    }

    return [...list].sort((a, b) => {
      // 1. STE
      // 2. SPA
      // 3. SPS
      // 4. PILOT/HOMOGENEOUS
      // 5. HETEROGENEOUS
      const getRank = (r: EnrollmentRecord) => {
        if (r.section.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") return 1;
        if (r.section.programType === "SPECIAL_PROGRAM_IN_THE_ARTS") return 2;
        if (r.section.programType === "SPECIAL_PROGRAM_IN_SPORTS") return 3;
        if (r.section.isHomogeneous) return 4;
        return 5;
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;

      // Keep section alphabetical order as secondary sort
      const sectionCompare = a.section.name.localeCompare(b.section.name);
      if (sectionCompare !== 0) return sectionCompare;

      // Finally, student last name
      return a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName);
    });
  }, [records, sectionFilter, searchQuery]);

  const pendingCount = filteredRecords.filter(r =>
    (r.finalAverage === null || r.finalAverage === undefined) &&
    r.eosyStatus !== "TRANSFERRED_OUT" &&
    r.eosyStatus !== "DROPPED_OUT"
  ).length;

  const scopeRecords = useMemo(() => {
    return sectionFilter === "ALL" ? records : records.filter(r => r.section.name === sectionFilter);
  }, [records, sectionFilter]);

  const isScopeFinalized = scopeRecords.length > 0 && scopeRecords.every(r => r.section.isEosyFinalized);

  const pendingClassesList = useMemo(() => {
    const sets = new Set<string>();
    filteredRecords.forEach((r) => {
      if (
        (r.finalAverage === null || r.finalAverage === undefined) &&
        r.eosyStatus !== "TRANSFERRED_OUT" &&
        r.eosyStatus !== "DROPPED_OUT"
      ) {
        sets.add(r.section.name);
      }
    });
    return Array.from(sets);
  }, [filteredRecords]);

  const pendingIrregularCount = useMemo(() => {
    return filteredRecords.filter((r) => !r.eosyStatus).length;
  }, [filteredRecords]);

  const scopedUnlockedClassesCount = pendingClassesList.length;
  const hasUnlockedClasses = scopedUnlockedClassesCount > 0;
  const scopedIrregularBlockerCount = pendingIrregularCount;
  const hasIrregularBlockers = scopedIrregularBlockerCount > 0;
  const blockersCount = (hasUnlockedClasses ? 1 : 0) + (hasIrregularBlockers ? 1 : 0);

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
          const sex = r.enrollmentApplication.learner.sex;
          const genderLabel = sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : null;

          const unsaved = unsavedChanges[recordId] || {};
          const currentLrn = unsaved.hasOwnProperty("lrn") ? unsaved.lrn : r.enrollmentApplication.learner.lrn;
          const currentFirstName = unsaved.hasOwnProperty("firstName") ? unsaved.firstName : r.enrollmentApplication.learner.firstName;
          const currentLastName = unsaved.hasOwnProperty("lastName") ? unsaved.lastName : r.enrollmentApplication.learner.lastName;

          const isLrnChanged = unsaved.hasOwnProperty("lrn") && unsaved.lrn !== r.enrollmentApplication.learner.lrn;
          const isNameChanged = (unsaved.hasOwnProperty("firstName") && unsaved.firstName !== r.enrollmentApplication.learner.firstName) ||
            (unsaved.hasOwnProperty("lastName") && unsaved.lastName !== r.enrollmentApplication.learner.lastName);

          const reportedGrades = (r.enrollmentApplication.reportedGrades as Record<string, any>) || {};
          const geofencing = reportedGrades.geofencing || {};
          const currentLat = unsaved.hasOwnProperty("latitude") ? unsaved.latitude : geofencing.latitude;
          const currentLng = unsaved.hasOwnProperty("longitude") ? unsaved.longitude : geofencing.longitude;
          const isCoordsChanged = unsaved.hasOwnProperty("latitude") || unsaved.hasOwnProperty("longitude");

          if (hasOverride) {
            return (
              <div className="flex flex-col gap-2 p-1 text-left">
                <div className="flex gap-2 items-center">
                  <Input
                    value={currentLastName || ""}
                    onChange={(e) => handleFieldChange(recordId, "lastName", e.target.value)}
                    disabled={isCommitting}
                    className={cn("h-8 text-sm font-extrabold uppercase w-32", isNameChanged && "border-amber-500 focus-visible:ring-amber-500")}
                    placeholder="Last Name"
                  />
                  <Input
                    value={currentFirstName || ""}
                    onChange={(e) => handleFieldChange(recordId, "firstName", e.target.value)}
                    disabled={isCommitting}
                    className={cn("h-8 text-sm font-extrabold uppercase w-32", isNameChanged && "border-amber-500 focus-visible:ring-amber-500")}
                    placeholder="First Name"
                  />
                  {isNameChanged && <span className="text-[10px] text-amber-600 font-extrabold shrink-0">Unsaved</span>}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex gap-1 items-center">
                    <span className="text-xs font-extrabold text-muted-foreground whitespace-nowrap">LRN:</span>
                    <Input
                      value={currentLrn || ""}
                      onChange={(e) => handleFieldChange(recordId, "lrn", e.target.value)}
                      disabled={isCommitting}
                      className={cn("h-8 text-sm font-extrabold w-36", isLrnChanged && "border-amber-500 focus-visible:ring-amber-500")}
                      placeholder="12-digit LRN"
                    />
                    {isLrnChanged && <span className="text-[10px] text-amber-600 font-extrabold shrink-0">Unsaved</span>}
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
            );
          }

          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-base">
              <span className="font-extrabold uppercase truncate">
                {row.original.enrollmentApplication.learner.lastName}, {row.original.enrollmentApplication.learner.firstName}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base text-foreground font-extrabold uppercase">
                  LRN: {row.original.enrollmentApplication.learner.lrn || "NO LRN"}
                </span>
                {row.original.nextYearCurriculum === "REGULAR" &&
                  row.original.enrollmentApplication.applicantType !== "REGULAR" &&
                  row.original.enrollmentApplication.applicantType !== "LATE_ENROLLEE"}
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
          const currentSectionId = unsaved.hasOwnProperty("sectionId") ? unsaved.sectionId : r.sectionId;
          const isSectionChanged = unsaved.hasOwnProperty("sectionId") && unsaved.sectionId !== r.sectionId;

          const gradeSections = allSections.filter(s => String(s.gradeLevelId) === activeTab);

          if (hasOverride) {
            return (
              <div className="flex flex-col gap-1 items-start">
                <Select
                  value={currentSectionId ? String(currentSectionId) : ""}
                  onValueChange={(val) => handleFieldChange(recordId, "sectionId", Number(val))}
                  disabled={isCommitting}
                >
                  <SelectTrigger className={cn("h-8 text-sm font-extrabold w-36", isSectionChanged && "border-amber-500 focus:ring-amber-500")}>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeSections.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSectionChanged && <span className="text-[10px] text-amber-600 font-extrabold">Unsaved</span>}
              </div>
            );
          }

          return (
            <span className="text-base font-extrabold uppercase">{row.original.section.name}</span>
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
          const recordId = r.id;
          const ave = r.finalAverage;

          const unsaved = unsavedChanges[recordId] || {};
          const currentAve = unsaved.hasOwnProperty("finalAverage") ? unsaved.finalAverage : ave;
          const isAveChanged = unsaved.hasOwnProperty("finalAverage") && unsaved.finalAverage !== ave;

          if (hasOverride) {
            return (
              <div className="flex flex-col gap-1 items-center">
                <Input
                  type="number"
                  step="0.01"
                  min="60"
                  max="100"
                  value={currentAve !== null && currentAve !== undefined ? currentAve : ""}
                  onChange={(e) => handleFieldChange(recordId, "finalAverage", e.target.value === "" ? null : parseFloat(e.target.value))}
                  disabled={isCommitting}
                  className={cn("h-8 w-20 text-center text-sm font-extrabold", isAveChanged && "border-amber-500 focus-visible:ring-amber-500")}
                />
                {isAveChanged && <span className="text-[10px] text-amber-600 font-extrabold">Unsaved</span>}
              </div>
            );
          }

          if (ave === null || ave === undefined) {
            return (
              <span className="font-extrabold text-base sm:text-base leading-tight block text-center text-muted-foreground opacity-60">
                --
              </span>
            );
          }
          const isFailing = ave < 75;

          return (
            <div className="flex justify-center items-center gap-1">
              <span className={cn("text-base sm:text-base leading-tight tabular-nums block text-center",
                isFailing ? "text-red-600 font-extrabold" : "text-gray-900 font-extrabold"
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
          const recordId = r.id;
          const isScpDemoted = !activeGradeName.includes("10") && (r.isScpDemoted || !!r.scpViolation);
          const scpViolation = r.scpViolation;

          const unsaved = unsavedChanges[recordId] || {};
          const currentStatus = unsaved.hasOwnProperty("eosyStatus") ? unsaved.eosyStatus : r.eosyStatus;
          const isStatusChanged = unsaved.hasOwnProperty("eosyStatus") && unsaved.eosyStatus !== r.eosyStatus;
          const currentDeficiencyNote = unsaved.hasOwnProperty("academicDeficiencyNote")
            ? unsaved.academicDeficiencyNote
            : r.academicDeficiencyNote;

          const isScp = Boolean(r.section?.programType && r.section.programType !== "REGULAR");
          const currentAve = unsaved.hasOwnProperty("finalAverage") ? unsaved.finalAverage : r.finalAverage;
          const hasZeroOrBlankGrade = currentAve === 0 || currentAve === null || currentAve === undefined || isNaN(currentAve as number);
          const isFailing = currentAve !== null && currentAve !== undefined && currentAve > 0 && currentAve < 75;
          const isScpDemotedGrades = !activeGradeName.includes("10") && isScp && currentAve !== null && currentAve !== undefined && currentAve >= 75 && currentAve < 85;

          let resolvedStatus: string = currentStatus ?? "";
          if (!resolvedStatus) {
            if (hasZeroOrBlankGrade || isFailing) {
              resolvedStatus = "ACTION_REQUIRED";
            } else {
              resolvedStatus = "PROMOTED";
            }
          }
          const isGrade10 = activeGradeName.includes("10");
          const statusLabel = formatStatusLabel(resolvedStatus as string, isGrade10);
          const isSectionFinalized = r.section.isEosyFinalized;

          const renderStatusContent = () => (
            <div
              className={cn(
                "inline-flex items-center justify-center w-full min-w-[220px] px-3 py-1.5 text-sm font-extrabold text-center whitespace-nowrap rounded-md border transition-colors",
                isScpDemoted && resolvedStatus === "PROMOTED"
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : resolvedStatus === "ACTION_REQUIRED"
                    ? "text-red-700 bg-red-50 border-red-200"
                    : !resolvedStatus || resolvedStatus === "PROMOTED"
                      ? "text-green-700 bg-green-50 border-green-200"
                      : "text-amber-700 bg-amber-50 border-amber-200"
              )}>
              <span>{isScpDemoted && resolvedStatus === "PROMOTED" ? "PROMOTED (TO BEC)" : statusLabel}</span>
            </div>
          );

          const renderTooltip = (trigger: React.ReactNode) => (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {trigger}
                </TooltipTrigger>
                <TooltipContent className="bg-amber-50 border border-amber-300 text-amber-900 shadow-lg rounded-md p-4 w-100 text-left">
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-amber-800 border-b border-amber-200 pb-2 mb-2">
                    Special Program Retention Alert
                  </h4>
                  <p className="text-base  leading-snug">
                    Learner will be laterally transferred to the Basic Education Curriculum (BEC) next school year due to the following grade deficiency:
                  </p>
                  {scpViolation && (
                    <div className="mt-3 bg-amber-100/50 rounded p-2 text-base leading-tight border border-amber-200/50">
                      <p><span className="font-bold text-amber-900">Subject:</span> {scpViolation.subject}</p>
                      <p><span className="font-bold text-amber-900">Term:</span> {scpViolation.term}</p>
                      <p className="mt-1 text-red-700 font-extrabold">
                        Grade: {scpViolation.actualGrade} <span className="text-amber-700  text-base">(Required: {scpViolation.requiredGrade})</span>
                      </p>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );

          if (hasOverride) {
            return (
              <div className="flex flex-col gap-1 items-center">
                <Select
                  value={resolvedStatus === "ACTION_REQUIRED" ? "" : resolvedStatus}
                  onValueChange={(val) => handleFieldChange(recordId, "eosyStatus", val as EosyStatus)}
                  disabled={isCommitting}
                >
                  <SelectTrigger className={cn("h-8 text-sm font-extrabold w-full min-w-[220px]", isStatusChanged && "border-amber-500 focus:ring-amber-500", resolvedStatus === "ACTION_REQUIRED" && "border-red-500 text-red-700 bg-red-50")}>
                    <SelectValue placeholder={resolvedStatus === "ACTION_REQUIRED" ? "ACTION REQUIRED" : ""} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROMOTED">{formatStatusLabel("PROMOTED", isGrade10)}</SelectItem>
                    <SelectItem value="RETAINED">{formatStatusLabel("RETAINED", isGrade10)}</SelectItem>
                    <SelectItem value="CONDITIONALLY_PROMOTED">{formatStatusLabel("CONDITIONALLY_PROMOTED", isGrade10)}</SelectItem>
                    <SelectItem value="TRANSFERRED_OUT">{formatStatusLabel("TRANSFERRED_OUT", isGrade10)}</SelectItem>
                    <SelectItem value="DROPPED_OUT">{formatStatusLabel("DROPPED_OUT", isGrade10)}</SelectItem>
                  </SelectContent>
                </Select>
                {resolvedStatus === "CONDITIONALLY_PROMOTED" && (
                  <Input
                    value={currentDeficiencyNote ?? ""}
                    onChange={(e) => handleFieldChange(
                      recordId,
                      "academicDeficiencyNote",
                      e.target.value,
                    )}
                    disabled={isCommitting}
                    placeholder="Enter failing subject or deficiency note"
                    className="h-8 w-full min-w-[220px] text-sm font-bold"
                  />
                )}
                {isStatusChanged && <span className="text-[10px] text-amber-600 font-extrabold">Unsaved</span>}
              </div>
            );
          }

          if (isSectionFinalized || isScopeFinalized) {
            return (
              <div className="flex flex-col items-center gap-1">
                {isScpDemoted && resolvedStatus === "PROMOTED" ? renderTooltip(renderStatusContent()) : renderStatusContent()}
                {resolvedStatus === "CONDITIONALLY_PROMOTED" && currentDeficiencyNote && (
                  <span className="max-w-[220px] text-center text-sm font-bold text-amber-800">
                    Deficiency: {currentDeficiencyNote}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center gap-2">
              <Select
                value={isScpDemoted && resolvedStatus === "PROMOTED" ? "PROMOTED_TO_BEC" : resolvedStatus === "ACTION_REQUIRED" ? "" : resolvedStatus}
                onValueChange={(val) => {
                  if (val === "PROMOTED_TO_BEC") handleStatusChange(r.id, "PROMOTED");
                  else handleStatusChange(
                    r.id,
                    val,
                    undefined,
                    val === "CONDITIONALLY_PROMOTED"
                      ? currentDeficiencyNote ?? ""
                      : null,
                  );
                }}
                disabled={isSectionFinalized || isScpDemotedGrades}>
                {isScpDemoted && resolvedStatus === "PROMOTED" ? (
                  renderTooltip(
                    <SelectTrigger
                      className={cn(
                        "inline-flex items-center justify-between w-full min-w-[220px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border disabled:opacity-100",
                        "text-amber-700 bg-amber-50 border-amber-200 cursor-help"
                      )}>
                      <span className="flex-1 text-left">PROMOTED (TO BEC)</span>
                    </SelectTrigger>
                  )
                ) : (
                  <SelectTrigger
                    className={cn(
                      "inline-flex items-center justify-between w-full min-w-[220px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border disabled:opacity-100",
                      resolvedStatus === "ACTION_REQUIRED"
                        ? "text-red-700 bg-red-50 border-red-200"
                        : !r.eosyStatus || r.eosyStatus === "PROMOTED"
                          ? "text-green-700 bg-green-50 border-green-200"
                          : "text-amber-700 bg-amber-50 border-amber-200",
                    )}>
                    <SelectValue placeholder={resolvedStatus === "ACTION_REQUIRED" ? "ACTION REQUIRED" : ""} />
                  </SelectTrigger>
                )}
                <SelectContent className="font-extrabold">
                  {!hasZeroOrBlankGrade && !isFailing && !isScpDemotedGrades && (
                    <SelectItem value="PROMOTED">{formatStatusLabel("PROMOTED", isGrade10)}</SelectItem>
                  )}

                  {!hasZeroOrBlankGrade && (
                    <>
                      <SelectItem value="RETAINED">{formatStatusLabel("RETAINED", isGrade10)}</SelectItem>
                      <SelectItem value="CONDITIONALLY_PROMOTED">{formatStatusLabel("CONDITIONALLY_PROMOTED", isGrade10)}</SelectItem>
                    </>
                  )}
                  <SelectItem value="TRANSFERRED_OUT">{formatStatusLabel("TRANSFERRED_OUT", isGrade10)}</SelectItem>
                  <SelectItem value="DROPPED_OUT">{formatStatusLabel("DROPPED_OUT", isGrade10)}</SelectItem>
                </SelectContent>
              </Select>
              {resolvedStatus === "CONDITIONALLY_PROMOTED" && (
                <Input
                  defaultValue={currentDeficiencyNote ?? ""}
                  onBlur={(e) => void handleAcademicDeficiencyNoteSave(recordId, e.target.value)}
                  placeholder="Enter failing subject or deficiency note"
                  className="h-8 w-full min-w-[220px] text-sm font-bold"
                />
              )}
            </div>
          );
        },
        meta: { className: "w-[240px] text-center" }
      },
    ],
    [isScopeFinalized, handleStatusChange, handleAcademicDeficiencyNoteSave, hasOverride, unsavedChanges, allSections, activeTab, isCommitting, handleFieldChange],
  );

  const columns = useMemo(() => {
    return baseColumns;
  }, [baseColumns]);

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("EOSY Updating");
    return () => setTitle(null);
  }, [setTitle]);



  if (!isEosyPhase && !isHistoricalReadOnly) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <div className="flex flex-col pb-8">



        {/* ── Grade Tabs + Transition Button Row ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <div className="flex items-center gap-4 mb-4 flex-shrink-0">
            <TabsList className="flex-1 flex flex-wrap sm:flex-nowrap h-auto gap-1 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
              {gradeLevels.map((gl) => (
                <TabsTrigger
                  key={gl.id}
                  value={String(gl.id)}
                  className={cn(
                    "flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
                  )}
                >
                  {activeTab === String(gl.id) && (
                    <motion.div
                      layoutId="enrollment-eosy-grade-pill"
                      className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className={cn("relative z-20 text-base font-extrabold uppercase", activeTab === String(gl.id) ? "text-primary-foreground" : "text-foreground")}>
                    {gl.name.replace(/grade\s*/i, "Grade ")}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {(!isHistoricalReadOnly && (isAllFinalized || isSchoolYearFinalized)) && (
              <Button
                onClick={() => {
                  setTransitionModalOpen(true);
                }}
                size="lg"
                className="bg-primary text-primary-foreground font-extrabold shadow-sm px-8 py-3 h-auto whitespace-nowrap shrink-0 rounded-xl uppercase"
              >
                Transition to New School Year
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full flex flex-col space-y-4"
            >
              {isScopeFinalized && (
                <div className="flex items-center justify-center w-full bg-amber-50 border border-amber-200 rounded-sm py-3 shrink-0">
                  <span className="text-base leading-tight font-extrabold text-amber-900 uppercase tracking-widest">
                    EOSY FINALIZED: OFFICIAL RECORDS LOCKED. NO FURTHER CHANGES ALLOWED.
                  </span>
                </div>
              )}

              <div className="bg-muted border border-slate-200 rounded-none shadow-sm flex flex-col overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">
                    {/* Left Side Actions */}
                    <div className="flex-1 w-full min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search learner name or LRN..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-4 bg-muted/50 focus:bg-muted transition-colors h-10 w-full font-extrabold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <Select
                        value={sectionFilter}
                        onValueChange={setSectionFilter}
                      >
                        <SelectTrigger className="w-56 bg-background border-border font-extrabold">
                          <SelectValue placeholder="Filter by Section / Adviser" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL" className="font-extrabold">All Sections</SelectItem>
                          {sectionOptions.map(sec => (
                            <SelectItem key={sec} value={sec} className="font-extrabold">{sec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {isScopeFinalized ? (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="font-extrabold border-border hover:bg-primary hover:text-primary-foreground" onClick={() => {
                            if (pendingCount > 0) {
                              setSf5WatermarkOpen(true);
                            } else {
                              sileo.success({ title: "Download", description: "Downloading Clean SF5 (Section)..." });
                            }
                          }}>
                            Export SF5
                          </Button>
                          <Button variant="outline" className="font-extrabold border-border hover:bg-primary hover:text-primary-foreground" onClick={() => sileo.success({ title: "Download", description: "Downloading SF6 (Grade Level Summary)..." })}>
                            Export SF6
                          </Button>
                        </div>
                      ) : Object.keys(rowSelection).length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={batchActionStatus}
                            onValueChange={(val) => setBatchActionStatus(val as EosyStatus)}
                            disabled={Object.keys(rowSelection).length === 0}
                          >
                            <SelectTrigger className="w-48 bg-background border-border font-extrabold">
                              <SelectValue placeholder="Select New Status..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PROMOTED">PROMOTED</SelectItem>
                              <SelectItem value="RETAINED">RETAINED</SelectItem>
                              <SelectItem value="CONDITIONALLY_PROMOTED">CONDITIONALLY PROMOTED</SelectItem>
                              <SelectItem value="TRANSFERRED_OUT">TRANSFERRED OUT</SelectItem>
                              <SelectItem value="DROPPED_OUT">DROPPED OUT</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleBatchUpdate}
                            disabled={!batchActionStatus || Object.keys(rowSelection).length === 0 || batchUpdateLoading}
                            variant={batchActionStatus ? "default" : "outline"}
                            className={cn(
                              "transition-all font-extrabold px-6",
                              batchActionStatus && Object.keys(rowSelection).length > 0
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                                : "text-muted-foreground border-border bg-muted/30 cursor-not-allowed"
                            )}
                          >
                            {batchUpdateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Apply to Selected
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {/* Right Side Status & Finalize */}
                    <div className="flex flex-wrap items-center gap-4 xl:justify-end">
                      {/* Status Indicators */}
                      <div className="flex items-center gap-3">
                        {pendingCount > 0 && !isScopeFinalized && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-base font-extrabold shadow-sm border border-border">
                            {pendingCount} Pending Submissions
                          </div>
                        )}

                        {!isScopeFinalized && blockersCount > 0 && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-base font-extrabold cursor-help transition-colors hover:bg-destructive/20">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {blockersCount} {blockersCount === 1 ? "Blocker" : "Blockers"} Detected
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="end" className="bg-destructive text-destructive-foreground border-none p-4 shadow-xl rounded-lg text-base leading-tight max-w-xs">
                                <p className="font-extrabold mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  Pending Requirements
                                </p>
                                <div className="space-y-1.5 text-destructive-foreground/90">
                                  {hasUnlockedClasses && <p>• {scopedUnlockedClassesCount} sections missing School Form 5 (SF5).</p>}
                                  {hasIrregularBlockers && <p>• {scopedIrregularBlockerCount ?? 0} learners require encoded EOSY (Summer) classes.</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      {/* Finalize Button */}
                      {!isScopeFinalized && blockersCount === 0 && filteredRecords.length > 0 && (
                        <Button
                          onClick={() => setFinalizeModalOpen(true)}
                          size="lg"
                          className="font-extrabold shadow-md transition-all bg-primary text-primary-foreground uppercase"
                        >
                          Finalize & Lock {targetScopeName}
                        </Button>
                      )}

                      {isScopeFinalized && sectionFilter !== "ALL" && !isSchoolYearFinalized && !isHistoricalReadOnly && (
                        <Button
                          onClick={() => setUnlockModalOpen(true)}
                          disabled={unlockLoading}
                          size="lg"
                          variant="outline"
                          className="font-extrabold shadow-md transition-all uppercase border-primary text-primary hover:text-primary"
                        >
                          Unlock Section Roster
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col bg-card">
                  {loadingRecords ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 py-10">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-base leading-tight ">Loading {activeGradeName} records...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <DataTable
                        columns={columns}
                        data={filteredRecords}
                        containerHeight="100%"
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        getRowClassName={(row) => isScopeFinalized || row.section.isEosyFinalized ? "pointer-events-none hover:bg-transparent" : ""}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Tabs>

      </div>

      <Dialog open={finalizeModalOpen} onOpenChange={setFinalizeModalOpen}>
        <DialogContent className={cn("w-full max-w-3xl rounded-lg p-8 overflow-hidden", "bg-sidebar shadow-2xl")}>
          <DialogHeader className="space-y-2 text-center items-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(var(--primary))] ring-[6px] ring-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-5 text-[hsl(var(--primary-foreground))]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-center text-xl font-extrabold">Lock {targetScopeName} End of School Year (EOSY)?</DialogTitle>
            <DialogDescription className="text-center pt-2 font-bold text-md">
              {activeGradeName.includes("10") ? (
                `Are you sure you want to finalize ${descriptionTarget}? This will officially close the school year and generate their Junior High School completion records.`
              ) : (
                <>
                  Are you sure you want to finalize {descriptionTarget}? This will officially close the school year and determine their promotion to{' '}
                  <span className="font-extrabold">{getNextGradeName(activeGradeName)}</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[hsl(var(--primary)/0.05)] p-4 rounded-md text-md text-foreground space-y-2 my-2 border border-[hsl(var(--primary)/0.2)] font-bold">
            <p>• Final grades and EOSY statuses (Promoted, Retained, Irregular) will be permanently saved.</p>
            <p>• The School Form 5 (SF5) for {descriptionTarget} will be locked. Class advisers can no longer change the grades.</p>
            <p>• This data will be permanently written to the learners' Permanent Academic Record (SF10 / Form 137).</p>
            <p className="font-extrabold text-[hsl(var(--primary))] underline mt-3">This action is final and cannot be undone.</p>
          </div>
          <DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setFinalizeModalOpen(false)}
              disabled={finalizeLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
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
                "flex-1 h-12 rounded-lg font-extrabold text-md",
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
        targetScopeName={targetScopeName}
      />

      <Dialog open={sf5WatermarkOpen} onOpenChange={setSf5WatermarkOpen}>
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden bg-muted border border-gray-300 shadow-2xl">
          <DialogHeader className="p-4 border-b bg-gray-50 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-extrabold">School Form 5 (SF5) Preview</DialogTitle>
              <DialogDescription asChild>
                <span>Document generated with unsubmitted grades</span>
              </DialogDescription>
            </div>
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-extrabold border border-red-200">
              UNFINALIZED
            </div>
          </DialogHeader>
          <div className="relative h-[600px] w-full bg-gray-100 p-8 flex items-center justify-center overflow-hidden">
            {/* The Document Paper */}
            <div className="relative bg-muted w-full h-full shadow-lg border border-gray-200 p-8 flex flex-col justify-between">

              {/* WATERMARK OVERLAY */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                <div className="transform -rotate-45 text-[6rem] font-extrabold text-red-600/10 whitespace-nowrap select-none">
                  DRAFT COPY
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 mt-48 overflow-hidden">
                <div className="transform -rotate-45 text-[2rem] font-extrabold text-red-600/10 whitespace-nowrap select-none">
                  PENDING ACADEMIC CLEARANCE
                </div>
              </div>

              {/* Fake Document Content */}
              <div>
                <h2 className="text-2xl font-serif text-center font-extrabold mb-8">School Form 5 (SF5)</h2>
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
                  <p className="text-xs font-extrabold">Class Adviser</p>
                </div>
                <div className="text-center w-1/3 relative">
                  {/* Blocked Signature Field */}
                  <div className="absolute inset-0 bg-red-100/80 backdrop-blur-sm flex items-center justify-center border-2 border-red-500 border-dashed z-40">
                    <span className="text-red-700 font-extrabold text-xs uppercase text-center leading-tight">Signature Blocked<br />(Pending Finalization)</span>
                  </div>
                  <div className="border-b border-black mb-2 h-8"></div>
                  <p className="text-xs font-extrabold">Official Registrar Signature</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-sm text-gray-500 italic">This copy cannot be officially distributed.</span>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setSf5WatermarkOpen(false)}>Close Preview</Button>
              <Button onClick={() => setSf5WatermarkOpen(false)} className="bg-primary hover:bg-primary/90 text-white font-extrabold">
                Download Draft PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EosyOverrideModal
        record={overrideRecord}
        onClose={() => setOverrideRecord(null)}
        onSuccess={() => {
          void fetchGradeRecords(activeTab);
          void fetchExportLockState();
        }}
      />

      <ConfirmationModal
        open={unlockModalOpen}
        onOpenChange={setUnlockModalOpen}
        title="Unlock Section Roster?"
        description={`Are you sure you want to unlock the section roster for ${sectionFilter}? This will revert control back to the Class Adviser.`}
        onConfirm={handleUnlockSection}
        confirmText="Unlock Section Roster"
        cancelText="Cancel"
        loading={unlockLoading}
        variant="warning"
        icon={Unlock}
      />

      <Dialog open={reopenModalOpen} onOpenChange={setReopenModalOpen}>
        <DialogContent className={cn("w-full max-w-3xl rounded-lg p-8 overflow-hidden", "bg-sidebar shadow-2xl")}>
          <DialogHeader className="space-y-2 text-center items-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(var(--primary))] ring-[6px] ring-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-5 text-[hsl(var(--primary-foreground))]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-center text-xl font-extrabold">Reopen EOSY Updating</DialogTitle>
            <DialogDescription className="text-center pt-2 font-bold text-md">
              Are you sure you want to reopen End of School Year (EOSY) updates? This will unlock the global lock and revert the system phase to allow roster corrections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-4 text-left">
            <div className="space-y-1">
              <label className="text-sm font-extrabold text-foreground">Security PIN</label>
              <Input
                type="password"
                placeholder="Enter 6-digit Security PIN"
                value={reopenPin}
                onChange={(e) => setReopenPin(e.target.value)}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-extrabold text-foreground">Justification</label>
              <Input
                type="text"
                placeholder="Reason for reopening (min. 10 characters)"
                value={reopenJustification}
                onChange={(e) => setReopenJustification(e.target.value)}
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setReopenModalOpen(false);
                setReopenPin("");
                setReopenJustification("");
              }}
              disabled={reopenLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
                "border border-gray-200 bg-muted text-foreground",
                "hover:bg-gray-50 active:bg-gray-100",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleReopenEosySubmit}
              disabled={reopenLoading || !reopenPin || reopenJustification.trim().length < 10}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                "hover:bg-[hsl(var(--primary)/0.9)]",
                "shadow-md",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              {reopenLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                "Confirm Reopen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transitionModalOpen} onOpenChange={setTransitionModalOpen}>
        <DialogContent
          className={cn("w-full max-w-3xl rounded-lg p-8 overflow-hidden", "bg-sidebar shadow-2xl")}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-2 text-center items-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(var(--primary))] ring-[6px] ring-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-5 text-[hsl(var(--primary-foreground))]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-center text-xl font-extrabold">Transition to New School Year</DialogTitle>
            <DialogDescription className="text-center pt-2 font-bold text-md font-extrabold">
              You are initiating the highest level of system transition. Please review the following:
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[hsl(var(--primary)/0.05)] p-4 rounded-md text-md text-foreground space-y-2 my-2 border border-[hsl(var(--primary)/0.2)] text-left font-bold">
            <p>• Grade 10 learners will be permanently archived as JHS Completers.</p>
            <p>• Promoted Grade 7 to 9 learners will be updated for the next grade level.</p>
            <p>• All previous Section assignments will be cleared for the incoming school year.</p>
          </div>


          <DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setTransitionModalOpen(false);
              }}
              disabled={transitionLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
                "border border-gray-200 bg-muted text-foreground",
                "hover:bg-gray-50 active:bg-gray-100",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleTransitionSubmit}
              disabled={transitionLoading}
              className={cn(
                "flex-1 h-12 rounded-lg font-extrabold text-md",
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                "hover:bg-[hsl(var(--primary)/0.9)]",
                "shadow-md",
                "transition-all duration-150 active:scale-[0.97]"
              )}
            >
              {transitionLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                "Transition to New School Year"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
