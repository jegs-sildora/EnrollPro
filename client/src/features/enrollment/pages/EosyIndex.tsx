import { useState, useEffect, useCallback } from "react";
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
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useAuthStore } from "@/store/auth.slice";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { useMemo } from "react";

type EosyStatus =
  | "PROMOTED"
  | "RETAINED"
  | "IRREGULAR"
  | "TRANSFERRED_OUT"
  | "DROPPED_OUT";

interface EnrollmentRecord {
  id: number;
  eosyStatus: EosyStatus | null;
  dropOutReason: string | null;
  transferOutDate: string | null;
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
  gradeLevel: { name: string };
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

export default function EosyUpdating() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
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
  const [batchPromoteConfirmOpen, setBatchPromoteConfirmOpen] = useState(false);
  const [schoolFinalizeConfirmOpen, setSchoolFinalizeConfirmOpen] =
    useState(false);

  const fetchSections = useCallback(async () => {
    if (!ayId) return;
    setLoading(true);
    try {
      const res = await api.get(`/eosy/sections?schoolYearId=${ayId}`);
      setSections(res.data.sections || []);
    } catch (err) {
      console.error("Failed to fetch sections", err);
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
      console.error("Failed to fetch records", err);
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
    async (recordId: number, status: string) => {
      if (exportLock?.schoolYearFinalized) {
        sileo.error({
          title: "School Year Locked",
          description:
            "School year EOSY is finalized. Status updates are no longer allowed.",
        });
        return;
      }

      if (status === "DROPPED_OUT") {
        setDropoutModal({ open: true, recordId, reason: "" });
        return;
      }
      if (status === "TRANSFERRED_OUT") {
        setTransferModal({
          open: true,
          recordId,
          date: format(new Date(), "yyyy-MM-dd"),
        });
        return;
      }

      try {
        await api.patch(`/eosy/records/${recordId}`, { eosyStatus: status });
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId ? { ...r, eosyStatus: status as EosyStatus } : r,
          ),
        );
        sileo.success({
          title: "Status Updated",
          description: "Learner status saved successfully.",
        });
      } catch {
        sileo.error({
          title: "Error",
          description: "Failed to update status.",
        });
      }
    },
    [exportLock?.schoolYearFinalized],
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
    } catch {
      sileo.error({ title: "Error", description: "Failed to update status." });
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
    } catch {
      sileo.error({ title: "Error", description: "Failed to update status." });
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
    } catch {
      sileo.error({ title: "Error", description: "Failed to finalize class." });
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
    } catch {
      sileo.error({ title: "Error", description: "Failed to re-open class." });
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

  const requestMarkAllPromoted = () => {
    if (isSchoolYearFinalized) {
      sileo.error({
        title: "School Year Locked",
        description:
          "School year EOSY is finalized. Status updates are no longer allowed.",
      });
      return;
    }

    if (emptyRowsCount === 0) {
      sileo.info({
        title: "No Empty Rows",
        description: "All learners already have a status.",
      });
      return;
    }

    setBatchPromoteConfirmOpen(true);
  };

  const handleMarkAllPromoted = async () => {
    const emptyRows = records.filter((r) => !r.eosyStatus);
    if (emptyRows.length === 0) {
      setBatchPromoteConfirmOpen(false);
      return;
    }

    try {
      await Promise.all(
        emptyRows.map((r) =>
          api.patch(`/eosy/records/${r.id}`, { eosyStatus: "PROMOTED" }),
        ),
      );

      setRecords((prev) =>
        prev.map((r) => (!r.eosyStatus ? { ...r, eosyStatus: "PROMOTED" } : r)),
      );
      sileo.success({
        title: "Batch Updated",
        description: `${emptyRows.length} learners marked as PROMOTED.`,
      });
      setBatchPromoteConfirmOpen(false);
    } catch {
      sileo.error({
        title: "Batch Error",
        description: "Failed to update some records.",
      });
    }
  };

  const requestSchoolFinalize = () => {
    if (isSchoolYearFinalized) {
      sileo.info({
        title: "Already Finalized",
        description: "School year EOSY export lock is already active.",
      });
      return;
    }

    if (!canFinalizeSchoolLevel) {
      return;
    }

    const unfinalized = sections.filter((s) => !s.isEosyFinalized);
    if (unfinalized.length > 0) {
      return;
    }

    setSchoolFinalizeConfirmOpen(true);
  };

  const handleSchoolFinalize = async () => {
    if (isSchoolYearFinalized || !canFinalizeSchoolLevel) {
      setSchoolFinalizeConfirmOpen(false);
      return;
    }

    const unfinalized = sections.filter((s) => !s.isEosyFinalized);
    if (unfinalized.length > 0) {
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
      sileo.success({
        title: "School Year Finalized",
        description:
          "All records are now locked and export-ready for the school year.",
      });
      void fetchSections();
    } catch {
      setSchoolFinalizeConfirmOpen(false);
      sileo.error({
        title: "Error",
        description: "Failed to finalize school year.",
      });
    }
  };

  const handleDownloadFinalExport = async () => {
    if (!ayId) return;
    if (!isSchoolYearFinalized) {
      sileo.error({
        title: "Finalize Required",
        description:
          "Finalize the School Year EOSY first before downloading the final LIS export.",
      });
      return;
    }

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
    irregular: records.filter((r) => r.eosyStatus === "IRREGULAR").length,
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
      case "IRREGULAR":
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
        id: "lrn",
        accessorKey: "enrollmentApplication.learner.lrn",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LRN"
          />
        ),
        cell: ({ row }) => (
          <span className="font-bold">
            {row.original.enrollmentApplication.learner.lrn || "N/A"}
          </span>
        ),
      },
      {
        id: "name",
        accessorKey: "enrollmentApplication.learner.lastName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="NAME"
          />
        ),
        cell: ({ row }) => {
          const sex = row.original.enrollmentApplication.learner.sex;
          const genderLabel =
            sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : null;

          return (
            <div className="flex flex-col text-left pl-2">
              <span className="font-bold uppercase">
                {row.original.enrollmentApplication.learner.lastName},{" "}
                {row.original.enrollmentApplication.learner.firstName}
              </span>
              {genderLabel && (
                <span className="text-[10px] text-muted-foreground font-bold uppercase">
                  Gender: {genderLabel}
                </span>
              )}
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
            title="STATUS"
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          const resolvedStatus = r.eosyStatus ?? "PROMOTED";
          const statusLabel = formatStatusLabel(r.eosyStatus);

          if (isFinalized) {
            return (
              <div className="flex justify-center min-w-[200px]">
                <div className="h-9 w-full rounded-md border border-border bg-muted px-3 text-sm font-bold text-muted-foreground flex items-center justify-center">
                  {statusLabel}
                </div>
              </div>
            );
          }

          return (
            <div className="flex justify-center min-w-[200px]">
              <Select
                value={resolvedStatus}
                onValueChange={(val) => handleStatusChange(r.id, val)}
                disabled={isFinalized}>
                <SelectTrigger
                  className={`h-9 font-bold ${!r.eosyStatus || r.eosyStatus === "PROMOTED" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMOTED">Promoted</SelectItem>
                  <SelectItem value="RETAINED">Retained</SelectItem>
                  <SelectItem value="IRREGULAR">Irregular</SelectItem>
                  <SelectItem value="TRANSFERRED_OUT">
                    Transferred Out
                  </SelectItem>
                  <SelectItem value="DROPPED_OUT">Dropped Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "ACTIONS",
        cell: () =>
          isFinalized ? (
            <div
              className="h-8 w-8"
              aria-hidden="true"
            />
          ) : (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ),
      },
    ],
    [isFinalized, handleStatusChange],
  );

  return (
    <div className="flex flex-col space-y-6 px-2 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EOSY Updating</h1>
          <p className="text-muted-foreground">
            End of School Year status finalization for DepEd LIS compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exportLock && (
            <Badge
              variant={isSchoolYearFinalized ? "default" : "outline"}
              className={
                isSchoolYearFinalized
                  ? "font-bold"
                  : "font-bold border-primary/30 text-primary"
              }>
              {isSchoolYearFinalized
                ? "School Year Finalized - Export Locked"
                : `${exportLock.finalizedSections}/${exportLock.totalSections} Classes Finalized`}
            </Badge>
          )}
          {isSchoolYearFinalized ? (
            <Button
              className="h-10 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isDownloadingFinalExport}
              onClick={handleDownloadFinalExport}>
              <Download className="h-4 w-4 mr-2" />
              {isDownloadingFinalExport
                ? "Preparing Final Export..."
                : "Download Final LIS Export"}
            </Button>
          ) : (
            isAdmin && (
              <Button
                className={`h-10 font-bold ${
                  canFinalizeSchoolLevel
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground hover:bg-muted"
                }`}
                disabled={!canFinalizeSchoolLevel}
                onClick={requestSchoolFinalize}>
                <Building2 className="h-4 w-4 mr-2" />
                Finalize School EOSY & Export
              </Button>
            )
          )}
          <Button
            variant="outline"
            className="h-10 font-bold"
            onClick={() => {
              void fetchSections();
              void fetchExportLockState();
            }}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {exportLock?.lockReason && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            isSchoolYearFinalized
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="font-semibold">{exportLock.lockReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 border-none shadow-sm h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">
              Select Class
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">
                Section / Adviser
              </Label>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}>
                <SelectTrigger className="h-11 font-bold">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={String(s.id)}>
                      {s.gradeLevel.name} - {s.name}{" "}
                      {s.isEosyFinalized ? "🔒" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSection && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-bold">
                    Status:
                  </span>
                  <Badge
                    variant={isFinalized ? "default" : "outline"}
                    className="font-bold">
                    {isSchoolYearFinalized
                      ? "SCHOOL LOCKED"
                      : selectedSection.isEosyFinalized
                        ? "FINALIZED"
                        : "EDITABLE"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-bold">
                    Students:
                  </span>
                  <span className="font-bold">
                    {selectedSection._count.enrollmentRecords}
                  </span>
                </div>

                {selectedSection.isEosyFinalized ? (
                  <Button
                    variant="outline"
                    className="w-full h-11 mt-4 font-bold border-primary text-primary hover:bg-primary/5"
                    disabled={isSchoolYearFinalized}
                    onClick={() => handleReopenClass(selectedSection.id)}>
                    <Unlock className="h-4 w-4 mr-2" />
                    Re-open Updating
                  </Button>
                ) : (
                  <Button
                    className="w-full h-11 mt-4 font-bold bg-primary"
                    onClick={handleFinalizeClass}
                    disabled={records.length === 0 || isSchoolYearFinalized}>
                    <Lock className="h-4 w-4 mr-2" />
                    Finalize Class
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-none shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">
                  Learner Status Grid
                </CardTitle>
                <CardDescription className="font-bold text-xs uppercase tracking-tighter text-muted-foreground">
                  {selectedSection
                    ? `Section: ${selectedSection.name}`
                    : "Select a section to begin updating"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {selectedSection && !isFinalized && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 font-bold bg-primary hover:bg-primary/90"
                    disabled={emptyRowsCount === 0 || isSchoolYearFinalized}
                    onClick={requestMarkAllPromoted}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Mark all empty rows as PROMOTED
                  </Button>
                )}
                <div className="h-8 w-px bg-muted" />
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-3">
                  Promoted: {stats.promoted}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200 font-bold px-3">
                  Negative:{" "}
                  {stats.retained +
                    stats.irregular +
                    stats.dropped +
                    stats.transferred}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={records}
              loading={loadingRecords}
              noResultsMessage="No students found in this section."
              className="border-none rounded-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Dropout Reason Modal */}
      <Dialog
        open={dropoutModal.open}
        onOpenChange={(open) =>
          !open && setDropoutModal({ ...dropoutModal, open: false })
        }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Drop Out</DialogTitle>
            <DialogDescription>
              DepEd requires a specific reason for learners who dropped out.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">Select Reason</Label>
              <Select
                value={dropoutModal.reason}
                onValueChange={(val) =>
                  setDropoutModal({ ...dropoutModal, reason: val })
                }>
                <SelectTrigger className="h-10 font-bold">
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
              variant="outline"
              onClick={() =>
                setDropoutModal({ open: false, recordId: null, reason: "" })
              }>
              Cancel
            </Button>
            <Button
              onClick={submitDropoutReason}
              disabled={!dropoutModal.reason}
              className="bg-primary">
              Save Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Date Modal */}
      <Dialog
        open={transferModal.open}
        onOpenChange={(open) =>
          !open && setTransferModal({ ...transferModal, open: false })
        }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Effective Date of Transfer</DialogTitle>
            <DialogDescription>
              Specify the date when the student officially transferred out.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">Effective Date</Label>
              <Input
                type="date"
                value={transferModal.date}
                onChange={(e) =>
                  setTransferModal({ ...transferModal, date: e.target.value })
                }
                className="h-10 font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setTransferModal({ open: false, recordId: null, date: "" })
              }>
              Cancel
            </Button>
            <Button
              onClick={submitTransferDate}
              disabled={!transferModal.date}
              className="bg-primary">
              Save Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Class Modal */}
      <Dialog
        open={finalizeModal.open}
        onOpenChange={(open) =>
          !open && setFinalizeModal({ open: false, section: null })
        }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Finalize Class: {finalizeModal.section?.name}
            </DialogTitle>
            <DialogDescription>
              Review the summary below before locking this section. This will
              prevent further updates by class advisers.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 bg-muted/30 rounded-lg border p-4 space-y-3">
            <div className="flex justify-between font-bold">
              <span>Promoted:</span>
              <span className="text-emerald-700">{stats.promoted}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Retained:</span>
              <span className="text-red-700">{stats.retained}</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>Irregular / Transferred / Dropped:</span>
              <span>{stats.irregular + stats.transferred + stats.dropped}</span>
            </div>
            <div className="pt-2 border-t flex justify-between font-extrabold text-lg">
              <span>TOTAL:</span>
              <span>{records.length}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-xs">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Finalizing a class locks it for everyone. Only a System
              Administrator can re-open it for clerical corrections.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinalizeModal({ open: false, section: null })}>
              Cancel
            </Button>
            <Button
              onClick={confirmFinalizeClass}
              className="bg-primary">
              Confirm & Lock Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={batchPromoteConfirmOpen}
        onOpenChange={setBatchPromoteConfirmOpen}
        title="Confirm Batch Promote"
        description={`Are you sure you want to mark ${emptyRowsCount} learner${emptyRowsCount === 1 ? "" : "s"} as PROMOTED?`}
        confirmText="Yes, Mark as Promoted"
        onConfirm={handleMarkAllPromoted}
        variant="primary"
      />

      <ConfirmationModal
        open={schoolFinalizeConfirmOpen}
        onOpenChange={setSchoolFinalizeConfirmOpen}
        title="Finalize School EOSY & Export"
        description="CRITICAL ACTION: This will finalize the ENTIRE School Year EOSY and lock all records permanently. Proceed?"
        confirmText="Yes, Finalize School EOSY"
        onConfirm={handleSchoolFinalize}
        variant="danger"
      />
    </div>
  );
}
