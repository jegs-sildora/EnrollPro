import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PhaseBanner } from "@/shared/components/PhaseBanner";
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
  Loader2,
  AlertTriangle,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { cn } from "@/shared/lib/utils";
import type { EosyStatus } from "@enrollpro/shared";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";

interface EnrollmentRecord {
  id: number;
  eosyStatus: EosyStatus | null;
  dropOutReason: string | null;
  transferOutDate: string | null;
  finalAverage: number | null;
  section: {
    name: string;
    isEosyFinalized: boolean;
  };
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

export default function EosyUpdating() {
  const {
    activeSchoolYearId,
    viewingSchoolYearId,
    systemStatus,
    systemPhase,
  } = useSettingsStore();
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const isEosyPhase = systemPhase === "EOSY_CLOSING";
  const isEosyArchivedState = systemStatus === "ARCHIVED";
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);
  const [exportLock, setExportLock] = useState<EosyExportLockState | null>(null);
  
  const [loadingRecords, setLoadingRecords] = useState(false);
  
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [batchActionStatus, setBatchActionStatus] = useState<EosyStatus | "">("");
  const [batchUpdateLoading, setBatchUpdateLoading] = useState(false);
  
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  const fetchSectionsAndGrades = useCallback(async () => {
    if (!ayId) return;
    try {
      const res = await api.get(`/eosy/sections?schoolYearId=${ayId}`);
      const rawSections: Section[] = res.data.sections || [];
      
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

  const fetchGradeRecords = useCallback(async (gradeLevelId: string) => {
    if (!gradeLevelId || !ayId) return;
    setLoadingRecords(true);
    setRowSelection({});
    try {
      const res = await api.get(`/eosy/grade/${gradeLevelId}/records?schoolYearId=${ayId}`);
      setRecords(res.data.records || []);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoadingRecords(false);
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

  const handleStatusChange = useCallback(
    async (recordId: number, status: string, finalAverage?: number | null) => {
      if (isHistoricalReadOnly && !hasOverride) {
        lifecycleFeedback.error("Read-Only", "This school year is archived. All records are read-only.");
        return;
      }
      if (exportLock?.schoolYearFinalized) {
        lifecycleFeedback.error("School Year Locked", "School year EOSY is finalized. Updates are no longer allowed.");
        return;
      }

      const record = records.find((r) => r.id === recordId);
      const effectiveAve = finalAverage !== undefined ? finalAverage : record?.finalAverage;

      if (status === "PROMOTED" && effectiveAve !== null && effectiveAve !== undefined && effectiveAve < 75) {
        lifecycleFeedback.error("Academic Policy Violation", "Learner with General Average below 75.00 cannot be marked as PROMOTED.");
        return;
      }

      if (record?.section.isEosyFinalized) {
         lifecycleFeedback.error("Section Locked", "This section is already finalized.");
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
                  finalAverage: finalAverage !== undefined ? finalAverage : r.finalAverage,
                }
              : r,
          ),
        );

        if (finalAverage === undefined) {
          lifecycleFeedback.success("Status Updated", "Learner status saved successfully.");
        }
      } catch (err) {
        toastApiError(err as never);
      }
    },
    [exportLock?.schoolYearFinalized, records, isHistoricalReadOnly, hasOverride],
  );

  const handleBatchUpdate = async () => {
    if (!batchActionStatus) return;
    
    const selectedIndexes = Object.keys(rowSelection).map(Number);
    const selectedRecords = selectedIndexes.map((idx) => records[idx]);

    if (selectedRecords.length === 0) {
      lifecycleFeedback.error("No Selection", "Please select at least one learner.");
      return;
    }
    
    // Filter out records from finalized sections
    const editableRecords = selectedRecords.filter(r => !r.section.isEosyFinalized);
    if (editableRecords.length === 0) {
      lifecycleFeedback.error("Action Aborted", "All selected learners belong to finalized sections.");
      return;
    }

    let targetRecords = editableRecords;
    let skippedCount = selectedRecords.length - editableRecords.length;

    if (batchActionStatus === "PROMOTED") {
      targetRecords = editableRecords.filter((r) => r.finalAverage && r.finalAverage >= 75);
      skippedCount += editableRecords.length - targetRecords.length;
    }

    if (targetRecords.length === 0) {
      lifecycleFeedback.error("Action Aborted", "None of the selected learners meet the criteria for this status (e.g. >= 75 for Promoted).");
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

      lifecycleFeedback.success(
        "Batch Updated",
        `${targetRecords.length} learners updated.${skippedCount > 0 ? ` ${skippedCount} skipped due to policy or locked section.` : ""}`,
      );
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
      await api.post(`/eosy/grade/${activeTab}/finalize`, {
        schoolYearId: ayId
      });
      
      lifecycleFeedback.success(
        "Grade Level Finalized",
        "Grade progression executed successfully and sections are now locked.",
      );
      
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

  const isSchoolYearFinalized = exportLock?.schoolYearFinalized ?? false;
  const shouldShowFinalizedView = isEosyArchivedState || isSchoolYearFinalized;
  
  const activeGradeName = gradeLevels.find(g => String(g.id) === activeTab)?.name || "Grade Level";
  const unfinalizedCount = records.filter(r => !r.eosyStatus).length;
  const isGradeFinalized = records.length > 0 && records.every(r => r.section.isEosyFinalized);

  const columns = useMemo<ColumnDef<EnrollmentRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            disabled={isGradeFinalized}
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            disabled={row.original.section.isEosyFinalized}
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
        header: ({ column }) => <DataTableColumnHeader column={column} title="LEARNER" />,
        cell: ({ row }) => {
          const sex = row.original.enrollmentApplication.learner.sex;
          const genderLabel = sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : null;

          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-xs">
              <span className="font-bold uppercase truncate">
                {row.original.enrollmentApplication.learner.lastName}, {row.original.enrollmentApplication.learner.firstName}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-foreground font-black uppercase">
                  LRN: {row.original.enrollmentApplication.learner.lrn || "NO LRN"}
                </span>
                {genderLabel && (
                  <Badge variant="outline" className="h-3 px-1 text-[7px] font-black border-muted-foreground/20">
                    {genderLabel}
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "section",
        accessorKey: "section.name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="SECTION" />,
        cell: ({ row }) => (
          <span className="text-xs font-bold">{row.original.section.name}</span>
        ),
      },
      {
        id: "finalAve",
        accessorKey: "finalAverage",
        header: ({ column }) => <DataTableColumnHeader column={column} title="GEN AVE" className="justify-center" />,
        cell: ({ row }) => {
          const ave = row.original.finalAverage;
          const isFailing = ave !== null && ave < 75;

          return (
            <span className={cn("font-bold text-xs sm:text-sm tabular-nums block text-center", isFailing ? "text-red-600" : "text-emerald-600")}>
              {ave?.toFixed(2) || "0.00"}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "status",
        accessorKey: "eosyStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="EOSY STATUS" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const resolvedStatus = r.eosyStatus ?? "PROMOTED";
          const statusLabel = formatStatusLabel(r.eosyStatus);
          const isSectionFinalized = r.section.isEosyFinalized;

          if (isSectionFinalized || isGradeFinalized) {
            return (
              <div className="flex justify-center">
                <Badge variant="outline" className="h-6 w-24 text-[10px] font-bold bg-muted text-foreground flex items-center justify-center uppercase">
                  {statusLabel}
                </Badge>
              </div>
            );
          }

          return (
            <div className="flex justify-center">
              <Select
                value={resolvedStatus}
                onValueChange={(val) => handleStatusChange(r.id, val)}
                disabled={isSectionFinalized}>
                <SelectTrigger
                  className={cn(
                    "h-7 w-32 font-black uppercase text-[10px]",
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
                  <SelectItem value="TRANSFERRED_OUT">Transferred</SelectItem>
                  <SelectItem value="DROPPED_OUT">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
    ],
    [isGradeFinalized, handleStatusChange],
  );

  if (shouldShowFinalizedView) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div className="text-center space-y-3 max-w-lg">
          <h2 className="text-xl font-black uppercase text-emerald-700">EOSY Successfully Finalized</h2>
          <p className="text-sm font-bold text-foreground leading-relaxed">
            All academic records for this school year are sealed and locked.
          </p>
        </div>
      </div>
    );
  }

  if (!isEosyPhase && !isHistoricalReadOnly) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-black uppercase">EOSY Phase Not Active</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            EOSY status updates are only available during the End of School Year phase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-120px)] min-h-0">
      <PhaseBanner />
      
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between pb-6 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-primary">
            End of School Year (EOSY)
          </h1>
          <p className="text-sm font-bold text-foreground">
            Manage grade progression and learner statuses
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative flex-shrink-0">
          {gradeLevels.map((gl) => (
            <TabsTrigger
              key={gl.id}
              value={String(gl.id)}
              className={cn(
                "flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              )}
            >
              {activeTab === String(gl.id) && (
                <motion.div
                  layoutId="enrollment-eosy-grade-pill"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className={cn("relative z-20 text-xs font-bold uppercase", activeTab === String(gl.id) ? "text-primary-foreground" : "text-foreground")}>
                {gl.name.replace(/grade\s*/i, "Grade ")}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 w-full h-full min-h-0"
          >
            <Card className="flex flex-col shadow-sm border border-border overflow-hidden bg-card h-full">
              <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-3 rounded-md border border-border flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Select
                      value={batchActionStatus}
                      onValueChange={(val) => setBatchActionStatus(val as EosyStatus)}
                      disabled={isGradeFinalized || Object.keys(rowSelection).length === 0}
                    >
                      <SelectTrigger className="w-48 bg-background">
                        <SelectValue placeholder="Batch Action..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROMOTED">Promoted (Requires &gt;= 75)</SelectItem>
                        <SelectItem value="RETAINED">Retained</SelectItem>
                        <SelectItem value="CONDITIONALLY_PROMOTED">Irregular</SelectItem>
                        <SelectItem value="TRANSFERRED_OUT">Transferred Out</SelectItem>
                        <SelectItem value="DROPPED_OUT">Dropped Out</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleBatchUpdate}
                      disabled={!batchActionStatus || Object.keys(rowSelection).length === 0 || batchUpdateLoading}
                      variant="secondary"
                    >
                      {batchUpdateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Apply Selected
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {unfinalizedCount > 0 && !isGradeFinalized && (
                      <Badge variant="destructive" className="animate-pulse">
                        {unfinalizedCount} Missing Statuses
                      </Badge>
                    )}
                    {isGradeFinalized ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Grade Finalized & Locked
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => setFinalizeModalOpen(true)}
                        disabled={unfinalizedCount > 0 || records.length === 0}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        <Lock className="h-4 w-4 mr-2" /> Finalize & Lock {activeGradeName}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 bg-card rounded-md border flex flex-col">
                  {loadingRecords ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm font-medium">Loading {activeGradeName} records...</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto">
                      <DataTable
                        columns={columns}
                        data={records}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>

      <Dialog open={finalizeModalOpen} onOpenChange={setFinalizeModalOpen}>
        <DialogContent className="max-w-md border-red-200">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl text-red-700">Lock {activeGradeName} EOSY?</DialogTitle>
            <DialogDescription className="text-center pt-2 font-medium">
              This action will execute <strong className="text-foreground">Automated Grade Progression</strong> for all learners in this grade level.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 p-4 rounded-md text-sm text-red-800 space-y-2 my-2 border border-red-100">
            <p>• Learner Active States will be updated to reflect their progression.</p>
            <p>• All sections in this grade will be permanently locked for this school year.</p>
            <p>• The records will be added to the immutable Historical Ledger.</p>
            <p className="font-bold underline mt-3">This action cannot be undone.</p>
          </div>
          <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setFinalizeModalOpen(false)}
              disabled={finalizeLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleFinalizeGrade}
              disabled={finalizeLoading}
              className="w-full sm:w-auto font-bold"
            >
              {finalizeLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Execute Progression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
