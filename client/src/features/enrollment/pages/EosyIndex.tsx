import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  TrendingUp,
  Lock,
  Unlock,
  Building2,
  Download,
  RefreshCw,
  AlertCircle,
  Search,
  Printer,
  CheckCircle2,
  GraduationCap,
  ChevronDown,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useAuthStore } from "@/store/auth.slice";
import { format } from "date-fns";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { cn } from "@/shared/lib/utils";
import { motion } from "motion/react";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { RemedialResolutionModal } from "../components/RemedialResolutionModal";
import type { EosyStatus } from "@enrollpro/shared";

interface EnrollmentRecord {
  id: number;
  eosyStatus: EosyStatus | null;
  dropOutReason: string | null;
  transferOutDate: string | null;
  finalAverage: number | null;
  remarks?: string | null;
  enrollmentApplication: {
    id: number;
    trackingNumber: string;
    learner: {
      id: number;
      lrn: string | null;
      firstName: string;
      lastName: string;
      sex?: "MALE" | "FEMALE" | null;
    };
  };
}

interface Section {
  id: number;
  name: string;
  isEosyFinalized: boolean;
  programType: string;
  isHomogeneous: boolean;
  gradeLevelId: number;
  gradeLevel: { name: string; displayOrder: number | null };
  _count: { enrollmentRecords: number };
  advisers?: Array<{
    teacher: { firstName: string; lastName: string };
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

export default function EosyUpdating() {
  const navigate = useNavigate();
  const { activeSchoolYearId, viewingSchoolYearId, activeSchoolYearLabel } =
    useSettingsStore();
  const user = useAuthStore((state) => state.user);
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const isAdmin = user?.role === "SYSTEM_ADMIN";

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);
  const [exportLock, setExportLock] = useState<EosyExportLockState | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [isDownloadingFinalExport, setIsDownloadingFinalExport] =
    useState(false);
  const [sectionSearch, setSectionSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isSyncingSmart, setIsSyncingSmart] = useState(false);

  // Reset selection when section changes
  useEffect(() => {
    setRowSelection({});
  }, [selectedSectionId]);

  // Modals
  const [dropoutModal, setDropoutModal] = useState<{
    open: boolean;
    recordId: number | null;
    reason: string;
  }>({
    open: false,
    recordId: null,
    reason: "",
  });
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    recordId: number | null;
    date: string;
  }>({
    open: false,
    recordId: null,
    date: format(new Date(), "yyyy-MM-dd"),
  });
  const [finalizeModal, setFinalizeModal] = useState<{
    open: boolean;
    section: Section | null;
  }>({
    open: false,
    section: null,
  });
  const [schoolFinalizeConfirmOpen, setSchoolFinalizeConfirmOpen] =
    useState(false);
  const [showRolloverSuccess, setShowRolloverSuccess] = useState(false);
  const [unlockModal, setUnlockModal] = useState({
    open: false,
    pin: "",
    justification: "",
    loading: false,
  });
  const [batchPromoteConfirmOpen, setBatchPromoteConfirmOpen] = useState(false);
  const [remedialModal, setRemedialModal] = useState<{
    open: boolean;
    recordId: number | null;
    learnerName: string;
    lrn: string | null;
  }>({ open: false, recordId: null, learnerName: "", lrn: null });

  const fetchSections = useCallback(async () => {
    if (!ayId) return;
    setLoading(true);
    try {
      const res = await api.get(`/eosy/sections?schoolYearId=${ayId}`);
      const rawSections: Section[] = res.data.sections || [];

      // Implement Institutional Hierarchy Sorting
      const sorted = [...rawSections].sort((a, b) => {
        // 1. Grade Level Priority (G7 -> G10)
        const glA = a.gradeLevel.displayOrder ?? 99;
        const glB = b.gradeLevel.displayOrder ?? 99;
        if (glA !== glB) return glA - glB;

        // 2. Program Priority (SCP first)
        const isScpA = a.programType !== "REGULAR";
        const isScpB = b.programType !== "REGULAR";
        if (isScpA !== isScpB) return isScpA ? -1 : 1;

        // 3. Section Type Priority (Star/Pilot sections first)
        const isStarA =
          a.name.toUpperCase().startsWith("PILOT") ||
          /^SECTION\s*[1-5](\s|$)/i.test(a.name) ||
          a.isHomogeneous;
        const isStarB =
          b.name.toUpperCase().startsWith("PILOT") ||
          /^SECTION\s*[1-5](\s|$)/i.test(b.name) ||
          b.isHomogeneous;
        if (isStarA !== isStarB) return isStarA ? -1 : 1;

        // 4. Alphabetical Name
        return a.name.localeCompare(b.name);
      });

      setSections(sorted);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

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

  const fetchRecords = useCallback(async (sectionId: string) => {
    if (!sectionId) return;
    setLoadingRecords(true);
    try {
      const res = await api.get(`/eosy/sections/${sectionId}/records`);
      setRecords(res.data.records || []);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    void fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    void fetchExportLockState();
  }, [fetchExportLockState]);

  useEffect(() => {
    if (selectedSectionId) {
      void fetchRecords(selectedSectionId);
    } else {
      setRecords([]);
    }
  }, [selectedSectionId, fetchRecords]);

  const handleStatusChange = useCallback(
    async (recordId: number, status: string, finalAverage?: number | null) => {
      if (exportLock?.schoolYearFinalized) {
        sileo.error({
          title: "School Year Locked",
          description:
            "School year EOSY is finalized. Updates are no longer allowed.",
        });
        return;
      }

      const record = records.find((r) => r.id === recordId);
      const effectiveAve =
        finalAverage !== undefined ? finalAverage : record?.finalAverage;

      if (
        status === "PROMOTED" &&
        effectiveAve !== null &&
        effectiveAve !== undefined &&
        effectiveAve < 75
      ) {
        sileo.error({
          title: "Academic Policy Violation",
          description:
            "Learner with General Average below 75.00 cannot be marked as PROMOTED.",
        });
        return;
      }

      if (status === "DROPPED_OUT" && !finalAverage) {
        setDropoutModal({ open: true, recordId, reason: "" });
        return;
      }
      if (status === "TRANSFERRED_OUT" && !finalAverage) {
        setTransferModal({
          open: true,
          recordId,
          date: format(new Date(), "yyyy-MM-dd"),
        });
        return;
      }

      try {
        const payload: Record<string, unknown> = { eosyStatus: status };
        if (finalAverage !== undefined) payload.finalAverage = finalAverage;

        await api.patch(`/eosy/records/${recordId}`, payload);

        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  eosyStatus: status as EosyStatus,
                  finalAverage:
                    finalAverage !== undefined ? finalAverage : r.finalAverage,
                }
              : r,
          ),
        );

        if (finalAverage === undefined) {
          sileo.success({
            title: "Status Updated",
            description: "Learner status saved successfully.",
          });
        }
      } catch (err) {
        toastApiError(err as never);
      }
    },
    [exportLock?.schoolYearFinalized, records],
  );

  const submitDropoutReason = async () => {
    if (!dropoutModal.recordId) return;
    if (exportLock?.schoolYearFinalized) {
      sileo.error({
        title: "School Year Locked",
        description:
          "School year EOSY is finalized. Status updates are no longer allowed.",
      });
      return;
    }

    try {
      await api.patch(`/eosy/records/${dropoutModal.recordId}`, {
        eosyStatus: "DROPPED_OUT",
        dropOutReason: dropoutModal.reason,
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.id === dropoutModal.recordId
            ? {
                ...r,
                eosyStatus: "DROPPED_OUT",
                dropOutReason: dropoutModal.reason,
              }
            : r,
        ),
      );
      setDropoutModal({ open: false, recordId: null, reason: "" });
      sileo.success({
        title: "Status Updated",
        description: "Learner status saved successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const submitTransferDate = async () => {
    if (!transferModal.recordId) return;
    if (exportLock?.schoolYearFinalized) {
      sileo.error({
        title: "School Year Locked",
        description:
          "School year EOSY is finalized. Status updates are no longer allowed.",
      });
      return;
    }

    try {
      await api.patch(`/eosy/records/${transferModal.recordId}`, {
        eosyStatus: "TRANSFERRED_OUT",
        transferOutDate: transferModal.date,
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.id === transferModal.recordId
            ? {
                ...r,
                eosyStatus: "TRANSFERRED_OUT",
                transferOutDate: transferModal.date,
              }
            : r,
        ),
      );
      setTransferModal({ open: false, recordId: null, date: "" });
      sileo.success({
        title: "Status Updated",
        description: "Learner status saved successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleFinalizeClass = async () => {
    if (exportLock?.schoolYearFinalized) {
      sileo.error({
        title: "School Year Locked",
        description:
          "School year EOSY is finalized. Classes can no longer be modified.",
      });
      return;
    }

    const section = sections.find((s) => String(s.id) === selectedSectionId);
    if (!section) return;
    setFinalizeModal({ open: true, section });
  };

  const confirmFinalizeClass = async () => {
    if (!finalizeModal.section) return;
    try {
      await api.post(`/eosy/sections/${finalizeModal.section.id}/finalize`);
      setSections((prev) =>
        prev.map((s) =>
          s.id === finalizeModal.section?.id
            ? { ...s, isEosyFinalized: true }
            : s,
        ),
      );
      setFinalizeModal({ open: false, section: null });
      sileo.success({
        title: "Class Finalized",
        description: "Section has been locked for EOSY.",
      });
      await fetchExportLockState();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleReopenClass = async (sectionId: number) => {
    if (exportLock?.schoolYearFinalized) {
      sileo.error({
        title: "School Year Locked",
        description:
          "School year EOSY is finalized. Reopening classes is not allowed.",
      });
      return;
    }

    if (
      !confirm(
        "Are you sure you want to RE-OPEN this class for updating? This will allow further status changes.",
      )
    )
      return;
    try {
      await api.post(`/eosy/sections/${sectionId}/reopen`);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, isEosyFinalized: false } : s,
        ),
      );
      sileo.success({
        title: "Class Re-opened",
        description: "Section is now editable.",
      });
      await fetchExportLockState();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const selectedSection = sections.find(
    (s) => String(s.id) === selectedSectionId,
  );
  const isSchoolYearFinalized = exportLock?.schoolYearFinalized ?? false;
  const canFinalizeSchoolLevel =
    (exportLock?.canFinalizeSchoolYear ?? false) && !isSchoolYearFinalized;
  const isFinalized = Boolean(
    selectedSection?.isEosyFinalized || isSchoolYearFinalized,
  );
  const emptyRowsCount = records.filter((r) => !r.eosyStatus).length;
  const irregularCount = records.filter(
    (r) => r.eosyStatus === "CONDITIONALLY_PROMOTED",
  ).length;

  const handleMarkAllPromoted = async () => {
    const targetRows = records.filter(
      (r) => !r.eosyStatus && r.finalAverage && r.finalAverage >= 75,
    );

    if (targetRows.length === 0) {
      setBatchPromoteConfirmOpen(false);
      sileo.info({
        title: "No Eligible Records",
        description: "No un-set learners with passing averages (75+) found.",
      });
      return;
    }

    try {
      await Promise.all(
        targetRows.map((r) =>
          api.patch(`/eosy/records/${r.id}`, { eosyStatus: "PROMOTED" }),
        ),
      );

      setRecords((prev) =>
        prev.map((r) =>
          !r.eosyStatus && r.finalAverage && r.finalAverage >= 75
            ? { ...r, eosyStatus: "PROMOTED" }
            : r,
        ),
      );
      sileo.success({
        title: "Batch Updated",
        description: `${targetRows.length} learners with passing averages marked as PROMOTED.`,
      });
      setBatchPromoteConfirmOpen(false);
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleSmartSync = async () => {
    if (!selectedSection) return;
    setIsSyncingSmart(true);
    try {
      await api.post("/enrollment/sync-smart-grades", {
        gradeLevelId: selectedSection.gradeLevelId, // We need to add this to the interface
        schoolYearId: ayId,
      });
      sileo.success({
        title: "SMART Sync Successful",
        description: `Academic records for ${selectedSection.name} have been updated from the SMART system.`,
      });
      if (selectedSectionId) {
        await fetchRecords(selectedSectionId);
      }
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsSyncingSmart(false);
    }
  };

  const handleBulkAction = async (status: EosyStatus) => {
    const selectedIndexes = Object.keys(rowSelection).map(Number);
    const selectedRecords = selectedIndexes.map((idx) => visibleRecords[idx]);

    if (selectedRecords.length === 0) return;

    let targetRecords = selectedRecords;
    let skippedCount = 0;

    if (status === "PROMOTED") {
      targetRecords = selectedRecords.filter(
        (r) => r.finalAverage && r.finalAverage >= 75,
      );
      skippedCount = selectedRecords.length - targetRecords.length;
    }

    if (targetRecords.length === 0) {
      sileo.error({
        title: "Action Aborted",
        description:
          "None of the selected learners meet the criteria for this status.",
      });
      return;
    }

    try {
      await Promise.all(
        targetRecords.map((r) =>
          api.patch(`/eosy/records/${r.id}`, { eosyStatus: status }),
        ),
      );

      setRecords((prev) =>
        prev.map((r) => {
          const match = targetRecords.find((tr) => tr.id === r.id);
          return match ? { ...r, eosyStatus: status } : r;
        }),
      );

      sileo.success({
        title: "Bulk Action Complete",
        description: `${targetRecords.length} learners marked as ${formatStatusLabel(status)}.${
          skippedCount > 0
            ? ` ${skippedCount} skipped due to academic policy (Gen Ave < 75).`
            : ""
        }`,
      });

      setRowSelection({});
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleSchoolFinalize = async () => {
    if (isSchoolYearFinalized || !canFinalizeSchoolLevel) {
      setSchoolFinalizeConfirmOpen(false);
      return;
    }

    try {
      const response = await api.post("/eosy/school-year/finalize", {
        schoolYearId: ayId,
      });
      if (response.data?.exportLock) {
        setExportLock(response.data.exportLock as EosyExportLockState);
      }
      setSchoolFinalizeConfirmOpen(false);
      setShowRolloverSuccess(true);
      void fetchSections();
    } catch (err) {
      setSchoolFinalizeConfirmOpen(false);
      toastApiError(err as never);
    }
  };

  const handleUnlockSchoolYear = async () => {
    setUnlockModal((p) => ({ ...p, loading: true }));
    try {
      const response = await api.post("/eosy/school-year/unlock", {
        schoolYearId: ayId,
        pin: unlockModal.pin,
        justification: unlockModal.justification,
      });
      if (response.data?.exportLock) {
        setExportLock(response.data.exportLock as EosyExportLockState);
      }
      setUnlockModal({
        open: false,
        pin: "",
        justification: "",
        loading: false,
      });
      sileo.success({
        title: "Emergency Unlock Successful",
        description: "School year has been unlocked for corrections.",
      });
      void fetchSections();
    } catch (err) {
      toastApiError(err as never);
      setUnlockModal((p) => ({ ...p, loading: false }));
    }
  };

  const handleDownloadFinalExport = async () => {
    if (!ayId) return;
    setIsDownloadingFinalExport(true);
    try {
      const response = await api.get(
        `/eosy/school-year/${ayId}/final-lis-export`,
        {
          responseType: "blob",
        },
      );

      const contentDisposition =
        (response.headers?.["content-disposition"] as string | undefined) ?? "";
      const fileNameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i,
      );
      const fileName = fileNameMatch?.[1]
        ? decodeURIComponent(fileNameMatch[1].replace(/"/g, ""))
        : `final-lis-export-${ayId}.csv`;

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
        title: "Final LIS Export Ready",
        description: "Final school-year LIS CSV downloaded successfully.",
      });
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;

      sileo.error({
        title: "Export Error",
        description: apiMessage ?? "Failed to download final LIS export.",
      });
    } finally {
      setIsDownloadingFinalExport(false);
    }
  };

  const stats = {
    promoted: records.filter(
      (r) => r.eosyStatus === "PROMOTED" || !r.eosyStatus,
    ).length,
    retained: records.filter((r) => r.eosyStatus === "RETAINED").length,
    irregular: records.filter((r) => r.eosyStatus === "CONDITIONALLY_PROMOTED").length,
    dropped: records.filter((r) => r.eosyStatus === "DROPPED_OUT").length,
    transferred: records.filter((r) => r.eosyStatus === "TRANSFERRED_OUT")
      .length,
  };

  const formatStatusLabel = (status: EosyStatus | null) => {
    const normalized = status ?? "PROMOTED";

    switch (normalized) {
      case "PROMOTED":
        return "Promoted";
      case "RETAINED":
        return "Retained";
      case "CONDITIONALLY_PROMOTED":
        return "Irregular";
      case "TRANSFERRED_OUT":
        return "Transferred Out";
      case "DROPPED_OUT":
        return "Dropped Out";
      default:
        return "Promoted";
    }
  };

  const columns = useMemo<ColumnDef<EnrollmentRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-[2px] border-white data-[state=checked]:bg-white data-[state=checked]:text-primary"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        id: "student",
        accessorKey: "enrollmentApplication.learner.lastName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LEARNER"
          />
        ),
        cell: ({ row }) => {
          const sex = row.original.enrollmentApplication.learner.sex;
          const genderLabel =
            sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : null;

          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-xs">
              <span className="font-bold uppercase truncate">
                {row.original.enrollmentApplication.learner.lastName},{" "}
                {row.original.enrollmentApplication.learner.firstName}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-foreground font-black uppercase">
                  LRN:{" "}
                  {row.original.enrollmentApplication.learner.lrn || "NO LRN"}
                </span>
                {genderLabel && (
                  <Badge
                    variant="outline"
                    className="h-3 px-1 text-[7px] font-black border-muted-foreground/20">
                    {genderLabel}
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "finalAve",
        accessorKey: "finalAverage",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="General AVE"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const ave = row.original.finalAverage;
          const isFailing = ave !== null && ave < 75;

          return (
            <span
              className={cn(
                "font-bold text-xs sm:text-sm tabular-nums block text-center",
                isFailing ? "text-red-600" : "text-emerald-600",
              )}>
              {ave?.toFixed(2) || "0.00"}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "remarks",
        accessorKey: "remarks",
        header: () => (
          <div className="text-center font-bold text-primary-foreground text-xs uppercase ">
            Remarks
          </div>
        ),
        cell: ({ row }) => {
          const ave = row.original.finalAverage;
          const status = row.original.eosyStatus;

          if (status === "DROPPED_OUT")
            return (
              <div className="text-center">
                <span className="text-xs font-bold text-amber-600 uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                  Dropped
                </span>
              </div>
            );
          if (status === "TRANSFERRED_OUT")
            return (
              <div className="text-center">
                <span className="text-xs font-bold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                  Transferred
                </span>
              </div>
            );

          if (ave !== null) {
            const isPassed = ave >= 75;
            return (
              <div className="text-center">
                <span
                  className={cn(
                    "text-xs font-black uppercase ",
                    isPassed ? "text-emerald-600" : "text-red-600",
                  )}>
                  {isPassed ? "PASSED" : "FAILED"}
                </span>
              </div>
            );
          }

          return (
            <div className="text-center">
              <span className="text-xs font-bold text-foreground uppercase opacity-40">
                —
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        accessorKey: "eosyStatus",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="EOSY STATUS"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          const resolvedStatus =
            r.eosyStatus ??
            (r.finalAverage && r.finalAverage >= 75 ? "PROMOTED" : "RETAINED");
          const statusLabel = formatStatusLabel(r.eosyStatus);

          if (isFinalized) {
            return (
              <Badge
                variant="outline"
                className="h-6 w-24 text-xs font-bold bg-muted text-foreground flex items-center justify-center mx-auto uppercase">
                {statusLabel}
              </Badge>
            );
          }

          return (
            <div className="flex flex-col items-center gap-1">
              <Select
                value={resolvedStatus}
                onValueChange={(val) => handleStatusChange(r.id, val)}
                disabled={isFinalized}>
                <SelectTrigger
                  className={cn(
                    "h-7 w-32 font-black uppercase text-xs r",
                    !r.eosyStatus || r.eosyStatus === "PROMOTED"
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-amber-700 bg-amber-50 border-amber-200",
                  )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMOTED">Promoted</SelectItem>
                  <SelectItem value="RETAINED">Retained</SelectItem>
                  <SelectItem value="CONDITIONALLY_PROMOTED">Irregular</SelectItem>
                  <SelectItem value="TRANSFERRED_OUT">
                    Transferred Out
                  </SelectItem>
                  <SelectItem value="DROPPED_OUT">Dropped Out</SelectItem>
                </SelectContent>
              </Select>
              {r.eosyStatus === "CONDITIONALLY_PROMOTED" && !isFinalized && (
                <button
                  className="text-[10px] font-black uppercase text-orange-600 hover:underline cursor-pointer"
                  onClick={() =>
                    setRemedialModal({
                      open: true,
                      recordId: r.id,
                      learnerName: `${r.enrollmentApplication.learner.lastName}, ${r.enrollmentApplication.learner.firstName}`,
                      lrn: r.enrollmentApplication.learner.lrn,
                    })
                  }>
                  Resolve Remedial
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [isFinalized, handleStatusChange, setRemedialModal],
  );

  const groupedSections = useMemo(() => {
    const groups: Record<string, Section[]> = {};
    sections.forEach((s) => {
      const gl = s.gradeLevel.name;
      if (!groups[gl]) groups[gl] = [];
      groups[gl].push(s);
    });
    return groups;
  }, [sections]);

  const gradeLevels = useMemo(() => {
    const unique = Array.from(new Set(sections.map((s) => s.gradeLevel.name)));
    return unique.sort((a, b) => {
      const orderA =
        sections.find((s) => s.gradeLevel.name === a)?.gradeLevel
          .displayOrder ?? 99;
      const orderB =
        sections.find((s) => s.gradeLevel.name === b)?.gradeLevel
          .displayOrder ?? 99;
      return orderA - orderB;
    });
  }, [sections]);

  const filteredGroups = useMemo(() => {
    const search = sectionSearch.toLowerCase().trim();
    const filtered: Record<string, Section[]> = {};

    Object.entries(groupedSections).forEach(([gl, secs]) => {
      if (gradeFilter !== "ALL" && gl !== gradeFilter) return;

      const matching = secs.filter((s) => {
        const adviser = s.advisers?.[0]?.teacher;
        const adviserName = adviser
          ? `${adviser.firstName} ${adviser.lastName}`
          : "";
        return (
          s.name.toLowerCase().includes(search) ||
          adviserName.toLowerCase().includes(search)
        );
      });
      if (matching.length > 0) filtered[gl] = matching;
    });
    return filtered;
  }, [groupedSections, sectionSearch, gradeFilter]);

  const visibleRecords = useMemo(() => {
    if (!incompleteOnly) return records;
    return records.filter((r) => !r.eosyStatus);
  }, [records, incompleteOnly]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4 px-2 sm:px-0 overflow-hidden">
      {/* Global Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold ">EOSY Updating</h1>
          <p className="text-sm font-bold text-foreground mt-1">
            End of School Year status finalization for DepEd LIS compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exportLock && (
            <div className="flex flex-col items-end mr-2">
              <span className="text-xs font-black uppercase  text-foreground mb-1">
                Progression Tracker
              </span>
              <Badge
                variant={isSchoolYearFinalized ? "default" : "outline"}
                className={cn(
                  "font-black text-xs px-3 h-7",
                  isSchoolYearFinalized
                    ? "bg-slate-800 text-white shadow-sm"
                    : "border-primary/40 text-primary bg-primary/5",
                )}>
                {isSchoolYearFinalized ? (
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    SYSTEM LOCKED (100%)
                  </div>
                ) : (
                  `${exportLock.finalizedSections}/${exportLock.totalSections} Classes Finalized`
                )}
              </Badge>
            </div>
          )}

          {isSchoolYearFinalized ? (
            <Button
              className="h-10 px-6 font-black uppercase text-xs bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95"
              disabled={isDownloadingFinalExport}
              onClick={handleDownloadFinalExport}>
              <Download className="h-4 w-4 mr-2" />
              {isDownloadingFinalExport
                ? "Exporting Master..."
                : "Export Master LIS Data (SF5)"}
            </Button>
          ) : (
            isAdmin && (
              <Button
                className={cn(
                  "h-10 px-6 font-black uppercase text-xs shadow-md transition-all",
                  canFinalizeSchoolLevel
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-foreground cursor-not-allowed opacity-50",
                )}
                disabled={!canFinalizeSchoolLevel}
                onClick={() => setSchoolFinalizeConfirmOpen(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Finalize School EOSY & Export
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 border-2"
            onClick={() => {
              void fetchSections();
              void fetchExportLockState();
            }}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {exportLock?.lockReason && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-xl border-2 px-6 py-5 flex-shrink-0 shadow-sm transition-all",
            isSchoolYearFinalized
              ? "border-slate-200 bg-slate-50/50"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}>
          {/* Section 1: The State */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3
                className={cn(
                  "text-lg font-black uppercase tracking-tight",
                  isSchoolYearFinalized ? "text-slate-900" : "text-amber-900",
                )}>
                {isSchoolYearFinalized
                  ? `EOSY Permanently Finalized & Archived (S.Y. ${activeSchoolYearLabel})`
                  : "Operational Status"}
              </h3>
              <p className="text-sm font-bold opacity-80 mt-1 leading-relaxed max-w-3xl">
                {isSchoolYearFinalized
                  ? `School year ${activeSchoolYearLabel} is globally locked. All class statuses and academic records are now read-only to preserve DepEd LIS integrity and audit readiness.`
                  : exportLock.lockReason}
              </p>
            </div>
          </div>

          {/* Section 2: The Actions */}
          {isSchoolYearFinalized && (
            <>
              <div className="my-5 border-t border-slate-200/60" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left Side: The Golden Path */}
                <div className="flex items-center gap-4">
                  {isAdmin ? (
                    <>
                      <Button
                        size="lg"
                        className="h-11 px-6 font-black uppercase text-sm tracking-tight shadow-lg bg-primary hover:scale-[1.02] active:scale-95 transition-all"
                        onClick={() =>
                          navigate("/settings?tab=school-year", {
                            state: { highlightUpcoming: true },
                          })
                        }>
                        Initiate Next Academic Year Rollover
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <p className="hidden md:block text-xs font-bold text-slate-500 max-w-[240px]">
                        Begin preparing the system for the upcoming enrollment
                        cycle and class assignments.
                      </p>
                    </>
                  ) : user?.role === "HEAD_REGISTRAR" ? (
                    <div className="flex items-center gap-3 py-1 bg-slate-100 px-4 rounded-full border border-slate-200">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <p className="text-xs font-black uppercase text-slate-600 tracking-tight">
                        EOSY Locked. Awaiting System Administrator to initiate
                        rollover.
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Right Side: The Danger Zone */}
                {isAdmin && (
                  <button
                    onClick={() =>
                      setUnlockModal((p) => ({ ...p, open: true }))
                    }
                    className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-amber-700 transition-colors group">
                    <Lock className="h-3.5 w-3.5 group-hover:animate-bounce" />
                    <span>Requires emergency unlock?</span>
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {irregularCount > 0 && !isSchoolYearFinalized && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 text-orange-800 px-4 py-3 shadow-sm flex-shrink-0">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-black uppercase text-xs">
              Remedial Processing Required
            </p>
            <p className="font-bold text-sm mt-0.5">
              {irregularCount} learner{irregularCount !== 1 ? "s" : ""} in this
              section {irregularCount !== 1 ? "have" : "has"} CONDITIONALLY
              PROMOTED status. Resolve their remedial grades before initiating
              year rollover.
            </p>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR: Class Tracker */}
        <Card className="w-full md:w-80 border-none shadow-sm flex flex-col h-full bg-card overflow-hidden shrink-0">
          <CardHeader className="p-4 border-b bg-muted/20 flex-shrink-0">
            <CardTitle className="text-sm font-black uppercase  flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              Class Tracker
            </CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-foreground" />
              <Input
                placeholder="Search section or adviser..."
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                className="pl-8 h-9 text-xs font-bold bg-background border-2"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Button
                variant={gradeFilter === "ALL" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs font-black uppercase"
                onClick={() => setGradeFilter("ALL")}>
                All
              </Button>
              {gradeLevels.map((gl) => (
                <Button
                  key={gl}
                  variant={gradeFilter === gl ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs font-black uppercase"
                  onClick={() => setGradeFilter(gl)}>
                  {gl.replace(/Grade\s*/i, "G")}
                </Button>
              ))}
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent min-h-0">
            <div className="p-2 space-y-4">
              {Object.entries(filteredGroups).map(([gl, secs]) => (
                <div
                  key={gl}
                  className="space-y-1">
                  <h3 className="px-3 py-1 text-xs font-black uppercase  text-foreground bg-muted/40 rounded-md mb-2">
                    {gl}
                  </h3>
                  {secs.map((s) => {
                    const adviser = s.advisers?.[0]?.teacher;
                    const adviserName = adviser
                      ? `${adviser.lastName}, ${adviser.firstName}`
                      : "No Adviser Assigned";

                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSectionId(String(s.id))}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left group",
                          selectedSectionId === String(s.id)
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "hover:bg-muted",
                        )}>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black uppercase truncate">
                            {s.name}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-bold uppercase truncate",
                              selectedSectionId === String(s.id)
                                ? "text-primary-foreground/70"
                                : "text-foreground",
                            )}>
                            Adviser: {adviserName}
                          </span>
                        </div>
                        <div className="shrink-0 ml-2">
                          {s.isEosyFinalized ? (
                            <CheckCircle2
                              className={cn(
                                "h-4 w-4",
                                selectedSectionId === String(s.id)
                                  ? "text-white"
                                  : "text-emerald-500",
                              )}
                            />
                          ) : (
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                selectedSectionId === String(s.id)
                                  ? "bg-white/50"
                                  : "bg-red-400",
                              )}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* RIGHT CONTENT: Status Grid */}
        <Card className="flex-1 border-none shadow-sm flex flex-col overflow-hidden bg-card h-full">
          {/* ROW 1: IDENTITY */}
          <CardHeader className="p-5 border-b bg-muted/5 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl font-bold uppercase truncate">
                    {selectedSection ? selectedSection.name : "Select Section"}
                  </CardTitle>
                  {selectedSection?.isEosyFinalized && (
                    <Badge className="bg-emerald-600 text-white font-black uppercase text-xs st h-5 shrink-0">
                      <Lock className="h-3 w-3 mr-1" />
                      Finalized
                    </Badge>
                  )}
                </div>
                <CardDescription className="font-bold text-xs uppercase text-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {selectedSection ? (
                    <>
                      <span>{selectedSection.gradeLevel.name}</span>
                      <span className="opacity-30">•</span>
                      <span>End of School Year Reporting</span>
                      {selectedSection.advisers?.[0] && (
                        <>
                          <span className="opacity-30">•</span>
                          <span className="text-primary font-black">
                            Adviser:{" "}
                            {selectedSection.advisers[0].teacher.lastName},{" "}
                            {selectedSection.advisers[0].teacher.firstName}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    "Choose a class from the tracker to start updating statuses"
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {/* ROW 2: CONTROLS & ACTIONS */}
          {selectedSection && (
            <div className="px-5 py-3 border-b bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
              <div className="flex items-center bg-muted/30 p-1 rounded-xl border w-fit">
                <button
                  onClick={() => setIncompleteOnly(false)}
                  className={cn(
                    "h-8 px-4 text-xs font-black uppercase  transition-all",
                    !incompleteOnly
                      ? "bg-white shadow-sm text-primary border border-border"
                      : "text-foreground hover:text-primary",
                  )}>
                  All ({records.length})
                </button>
                <button
                  onClick={() => setIncompleteOnly(true)}
                  className={cn(
                    "h-8 px-4 text-xs font-black uppercase  transition-all flex items-center gap-2",
                    incompleteOnly
                      ? "bg-white shadow-sm text-amber-600 border border-amber-100"
                      : "text-foreground hover:text-amber-600",
                  )}>
                  {emptyRowsCount > 0 && (
                    <AlertCircle className="h-3 w-3 fill-amber-500 text-white" />
                  )}
                  Missing Status ({emptyRowsCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSyncingSmart || isFinalized}
                  className="h-9 px-4 font-black text-xs uppercase  border-2 border-primary/20 text-primary hover:bg-primary/5 shadow-sm"
                  onClick={handleSmartSync}>
                  {isSyncingSmart ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-2" />
                      Sync with SMART
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 font-black text-xs uppercase  border-2 shadow-sm"
                  disabled={!selectedSection || selectedSection.isEosyFinalized}
                  onClick={() =>
                    sileo.info({
                      title: "Module Ready",
                      description: "SF5/SF6 Generation Engine initialized.",
                    })
                  }>
                  <Printer className="h-3.5 w-3.5 mr-2 text-primary" />
                  Generate SF5 & SF6
                </Button>

                {!isFinalized && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 font-black text-xs uppercase border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 shadow-sm"
                      onClick={() => navigate(`/monitoring/enrollment/eosy/workspace?sectionId=${selectedSectionId}`)}
                    >
                      <TrendingUp className="h-3.5 w-3.5 mr-2" />
                      Rapid Entry Workspace
                    </Button>
                    
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-9 px-4 font-black text-xs uppercase  bg-emerald-600 hover:bg-emerald-700 shadow-md"
                        disabled={
                          Object.keys(rowSelection).length === 0 ||
                          isSchoolYearFinalized
                        }>
                        <TrendingUp className="h-3.5 w-3.5 mr-2" />
                        Bulk Actions ({Object.keys(rowSelection).length})
                        <ChevronDown className="h-3.5 w-3.5 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48">
                      <DropdownMenuItem
                        onClick={() => handleBulkAction("PROMOTED")}
                        className="font-bold text-emerald-600">
                        Mark Promoted
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleBulkAction("RETAINED")}
                        className="font-bold text-red-600">
                        Mark Retained
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleBulkAction("CONDITIONALLY_PROMOTED")}
                        className="font-bold text-amber-600">
                        Mark Cond. Promoted
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        )}

          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col relative min-h-0">
            <div className="flex-1 bg-muted/5 relative min-h-0 overflow-hidden">
              <DataTable<EnrollmentRecord, unknown>
                columns={columns}
                data={visibleRecords}
                loading={loadingRecords}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                getRowClassName={(row: EnrollmentRecord) =>
                  !row.eosyStatus
                    ? "bg-amber-50/40 hover:bg-amber-100/40 transition-colors"
                    : ""
                }
                noResultsMessage={
                  selectedSectionId
                    ? incompleteOnly
                      ? "No students missing EOSY status. Great job!"
                      : "No students found."
                    : "Please select a section from the Class Tracker sidebar."
                }
                className="border-none rounded-none absolute inset-0"
                tableClassName="border-separate border-spacing-0 w-full"
                containerHeight="100%"
                virtualize={false}
              />
            </div>

            {/* ROW 4: STICKY FOOTER */}
            {selectedSection && !isSchoolYearFinalized && (
              <div className="p-5 border-t bg-white flex-shrink-0 z-30 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.04)]">
                {selectedSection.isEosyFinalized ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3 text-emerald-700 font-bold text-sm">
                        <div className="bg-emerald-100 p-1.5 rounded-full">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        Section finalized and locked for SF5/SF6 reporting.
                      </div>
                      <div className="hidden md:block h-6 w-px bg-border" />
                      <span className="text-sm font-bold text-foreground uppercase ">
                        Showing {visibleRecords.length} of {records.length}{" "}
                        Learners
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 px-8 font-black uppercase text-xs border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all"
                      onClick={() => handleReopenClass(selectedSection.id)}>
                      <Unlock className="h-4 w-4 mr-2" />
                      Re-open Section
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col">
                        {emptyRowsCount > 0 ? (
                          <>
                            <div className="flex items-center gap-2 text-red-600">
                              <AlertCircle className="h-5 w-5" />
                              <span className="font-black text-xs uppercase ">
                                {emptyRowsCount} learners require an EOSY Status
                              </span>
                            </div>
                            <p className="text-xs font-bold text-foreground uppercase mt-1">
                              Please use{" "}
                              <button
                                onClick={() => setBatchPromoteConfirmOpen(true)}
                                className="text-primary hover:underline font-black cursor-pointer">
                                'Bulk Mark'
                              </button>{" "}
                              or assign statuses manually to activate lock.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-emerald-600">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="font-black text-xs uppercase ">
                                Ready for Finalization
                              </span>
                            </div>
                            <p className="text-xs font-bold text-foreground uppercase mt-1">
                              All {records.length} learners have been assigned
                              an EOSY status.
                            </p>
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-black uppercase text-emerald-600/70">
                              <CheckCircle2 className="h-3 w-3" />
                              System Check: No learner with Gen Ave &lt; 75 is
                              marked as PROMOTED.
                            </div>
                          </>
                        )}
                      </div>

                      <div className="hidden lg:block h-10 w-px bg-border" />

                      <div className="hidden lg:flex flex-col">
                        <span className="text-xs font-black uppercase  text-foreground">
                          Roster Metrics
                        </span>
                        <span className="text-sm font-bold text-primary mt-0.5">
                          Showing {visibleRecords.length} of {records.length}{" "}
                          Learners
                        </span>
                      </div>
                    </div>

                    <Button
                      className={cn(
                        "h-14 px-10 font-black uppercase  text-sm transition-all shadow-xl",
                        emptyRowsCount > 0
                          ? "bg-slate-200 text-foreground cursor-not-allowed shadow-none"
                          : "bg-primary hover:scale-[1.02] shadow-primary/20",
                      )}
                      onClick={handleFinalizeClass}
                      disabled={records.length === 0 || emptyRowsCount > 0}>
                      <Lock className="h-5 w-5 mr-3" />
                      Finalize & Lock Section
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals & Dialogs */}
      <Dialog
        open={unlockModal.open}
        onOpenChange={(open) =>
          !open && setUnlockModal((p) => ({ ...p, open: false }))
        }>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-bold uppercase  text-red-700">
              <div className="bg-red-100 p-2 rounded-lg">
                <Unlock className="h-5 w-5" />
              </div>
              Emergency Archive Unlock
            </DialogTitle>
            <DialogDescription className="font-semibold text-sm">
              This action will breach the terminal lock for the entire school
              year. This is only permitted for critical record corrections.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase  text-foreground">
                Security PIN
              </Label>
              <Input
                type="password"
                placeholder="Enter Admin Security PIN"
                value={unlockModal.pin}
                onChange={(e) =>
                  setUnlockModal((p) => ({ ...p, pin: e.target.value }))
                }
                className="h-11 font-bold border-2"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase  text-foreground">
                Justification (Min 10 chars)
              </Label>
              <textarea
                placeholder="Describe the reason for unlocking this archive..."
                value={unlockModal.justification}
                onChange={(e) =>
                  setUnlockModal((p) => ({
                    ...p,
                    justification: e.target.value,
                  }))
                }
                className="w-full h-24 p-3 rounded-lg border-2 font-bold text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-900">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">
                All unlock events are recorded in the permanent system audit
                logs. The system status will revert to BOSY_LOCKED.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setUnlockModal((p) => ({ ...p, open: false }))}
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleUnlockSchoolYear}
              disabled={
                unlockModal.pin.length < 4 ||
                unlockModal.justification.length < 10 ||
                unlockModal.loading
              }
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase  px-8">
              {unlockModal.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Authorize Override"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dropoutModal.open}
        onOpenChange={(open) =>
          !open && setDropoutModal({ ...dropoutModal, open: false })
        }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold uppercase ">
              Reason for Drop Out
            </DialogTitle>
            <DialogDescription className="font-semibold">
              DepEd requires a specific reason for learners who dropped out.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase  text-foreground">
                Select Reason
              </Label>
              <Select
                value={dropoutModal.reason}
                onValueChange={(val) =>
                  setDropoutModal({ ...dropoutModal, reason: val })
                }>
                <SelectTrigger className="h-11 font-bold border-2">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARMED_CONFLICT">Armed Conflict</SelectItem>
                  <SelectItem value="ILLNESS">Illness</SelectItem>
                  <SelectItem value="FINANCIAL_DIFFICULTY">
                    Financial Difficulty
                  </SelectItem>
                  <SelectItem value="FAMILY_PROBLEM">Family Problem</SelectItem>
                  <SelectItem value="LACK_OF_INTEREST">
                    Lack of Interest
                  </SelectItem>
                  <SelectItem value="EMPLOYMENT">
                    Employment / Working
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() =>
                setDropoutModal({ open: false, recordId: null, reason: "" })
              }
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={submitDropoutReason}
              disabled={!dropoutModal.reason}
              className="bg-primary font-bold px-8">
              Save Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferModal.open}
        onOpenChange={(open) =>
          !open && setTransferModal({ ...transferModal, open: false })
        }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold uppercase ">
              Effective Date of Transfer
            </DialogTitle>
            <DialogDescription className="font-semibold">
              Specify the date when the student officially transferred out.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase  text-foreground">
                Effective Date
              </Label>
              <Input
                type="date"
                value={transferModal.date}
                onChange={(e) =>
                  setTransferModal({ ...transferModal, date: e.target.value })
                }
                className="h-11 font-bold border-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() =>
                setTransferModal({ open: false, recordId: null, date: "" })
              }
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={submitTransferDate}
              disabled={!transferModal.date}
              className="bg-primary font-bold px-8">
              Save Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={finalizeModal.open}
        onOpenChange={(open) =>
          !open && setFinalizeModal({ open: false, section: null })
        }>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-bold uppercase ">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              Finalize Class: {finalizeModal.section?.name}
            </DialogTitle>
            <DialogDescription className="font-semibold text-sm">
              Review the promotion summary before locking this section.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <p className="text-xs font-black uppercase text-emerald-800 ">
                  Promoted
                </p>
                <p className="text-2xl font-black text-emerald-700">
                  {stats.promoted}
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <p className="text-xs font-black uppercase text-red-800 ">
                  Retained
                </p>
                <p className="text-2xl font-black text-red-700">
                  {stats.retained}
                </p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 border-2 border-dashed">
              <div className="flex justify-between items-center text-xs font-bold text-foreground uppercase ">
                <span>Irregular / Transferred / Dropped</span>
                <span>
                  {stats.irregular + stats.transferred + stats.dropped}
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between items-center">
                <span className="text-sm font-black uppercase ">
                  Total Learners
                </span>
                <span className="text-lg font-black">{records.length}</span>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-900">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs font-bold leading-relaxed">
                Finalizing locks this section for all advisers. System Admins
                must manually unlock it for corrections.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setFinalizeModal({ open: false, section: null })}
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={confirmFinalizeClass}
              className="bg-primary font-black uppercase  px-8">
              Confirm & Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={batchPromoteConfirmOpen}
        onOpenChange={setBatchPromoteConfirmOpen}
        title="⚡ Smart Bulk Promotion"
        description={`Apply 'PROMOTED' status to all ${
          records.filter(
            (r) => !r.eosyStatus && r.finalAverage && r.finalAverage >= 75,
          ).length
        } learner(s) with a passing average (75.00+) who currently have no status?`}
        confirmText="Confirm Smart Bulk Promotion"
        onConfirm={handleMarkAllPromoted}
        variant="primary"
      />

      <ConfirmationModal
        open={schoolFinalizeConfirmOpen}
        onOpenChange={setSchoolFinalizeConfirmOpen}
        title="🔒 MASTER EOSY FINALIZATION"
        description={`CRITICAL: This will lock the entire ${activeSchoolYearLabel} school year. No further class updates or status changes will be allowed across all 128 sections. Proceed with Master Lock?`}
        confirmText="Yes, Finalize & Lock School Year"
        onConfirm={handleSchoolFinalize}
        variant="danger"
      />

      <RemedialResolutionModal
        open={remedialModal.open}
        recordId={remedialModal.recordId}
        learnerName={remedialModal.learnerName}
        lrn={remedialModal.lrn}
        onClose={() =>
          setRemedialModal({
            open: false,
            recordId: null,
            learnerName: "",
            lrn: null,
          })
        }
        onResolved={(recordId, newStatus) => {
          setRecords((prev) =>
            prev.map((r) =>
              r.id === recordId ? { ...r, eosyStatus: newStatus } : r,
            ),
          );
        }}
      />

      <Dialog
        open={showRolloverSuccess}
        onOpenChange={setShowRolloverSuccess}>
        <DialogContent className="sm:max-w-md border-t-8 border-t-emerald-600">
          <DialogHeader className="pt-4 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner border border-emerald-200">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase text-emerald-800">
              School Year Finalized
            </DialogTitle>
            <DialogDescription className="font-bold text-base mt-2 text-foreground">
              All records for S.Y. {activeSchoolYearLabel} have been locked and
              are ready for LIS export.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
              <p className="text-sm font-bold text-center leading-relaxed">
                The academic cycle is now complete. The next logical step is to
                initiate the <span className="text-primary font-black uppercase">Academic Rollover</span> to
                prepare for the upcoming school year.
              </p>
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="lg"
                className="font-black uppercase tracking-tight shadow-lg bg-[#800000] hover:bg-[#600000] text-white"
                onClick={() => {
                  setShowRolloverSuccess(false);
                  navigate("/settings?tab=school-year", {
                    state: { highlightUpcoming: true },
                  });
                }}>
                🚀 Start Next Year Rollover
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="font-bold text-foreground opacity-60 hover:opacity-100"
                onClick={() => setShowRolloverSuccess(false)}>
                I'll do this later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
