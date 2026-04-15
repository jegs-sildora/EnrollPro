import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, CheckSquare, Square, Save } from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { format } from "date-fns";
import BatchResultsModal from "./BatchResultsModal";
import type { BatchResults } from "./BatchResultsModal";

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

const TARGET_STATUS_OPTIONS = [
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "ASSESSMENT_SCHEDULED", label: "Exam Scheduled" },
  { value: "PASSED", label: "Passed" },
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
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

const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: [
    "VERIFIED",
    "UNDER_REVIEW",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "FOR_REVISION",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "PRE_REGISTERED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["ASSESSMENT_SCHEDULED", "PRE_REGISTERED", "WITHDRAWN"],
  ASSESSMENT_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "NOT_QUALIFIED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "PRE_REGISTERED",
    "INTERVIEW_SCHEDULED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: ["PRE_REGISTERED", "WITHDRAWN"],
  PRE_REGISTERED: ["ENROLLED", "TEMPORARILY_ENROLLED", "WITHDRAWN"],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  NOT_QUALIFIED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  ENROLLED: ["WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

const SAFE_BATCH_TARGETS = new Set(
  TARGET_STATUS_OPTIONS.map((opt) => opt.value),
);

interface Props {
  applicantType: string;
  cutoffScore?: number | null;
  hasAssessment?: boolean;
}

export default function PipelineBatchView({
  applicantType,
  cutoffScore,
  hasAssessment = false,
}: Props) {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 50;

  const showAssessment = hasAssessment && status === "ASSESSMENT_SCHEDULED";

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Batch processing
  const [targetStatus, setTargetStatus] = useState("");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isPreflightOpen, setIsPreflightOpen] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResults | null>(null);

  // Assessment scores
  const [scores, setScores] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (status !== "ALL") params.append("status", status);

      if (applicantType !== "ALL")
        params.append("applicantType", applicantType);
      params.append("page", String(page));
      params.append("limit", String(limit));

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
      const removedCount = res.data.data.length - filteredApps.length;
      setTotal(Math.max(0, res.data.pagination.total - removedCount));
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, applicantType, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, search, applicantType, page]);

  const selectedApplications = useMemo(
    () => applications.filter((app) => selectedIds.has(app.id)),
    [applications, selectedIds],
  );

  const selectedStatuses = useMemo(
    () => Array.from(new Set(selectedApplications.map((app) => app.status))),
    [selectedApplications],
  );

  const availableTargetStatuses = useMemo(() => {
    if (selectedStatuses.length === 0) {
      return TARGET_STATUS_OPTIONS.map((opt) => opt.value);
    }

    return TARGET_STATUS_OPTIONS.map((opt) => opt.value).filter((target) =>
      selectedStatuses.every((currentStatus) =>
        (VALID_TRANSITIONS[currentStatus] ?? []).includes(target),
      ),
    );
  }, [selectedStatuses]);

  const preflightSummary = useMemo(() => {
    if (!targetStatus || selectedApplications.length === 0) {
      return null;
    }

    const eligible: Application[] = [];
    const ineligible: Array<{ app: Application; reason: string }> = [];

    for (const app of selectedApplications) {
      const allowedTargets = VALID_TRANSITIONS[app.status] ?? [];
      if (!SAFE_BATCH_TARGETS.has(targetStatus)) {
        ineligible.push({
          app,
          reason: "Target status is not allowed for bulk processing.",
        });
        continue;
      }

      if (!allowedTargets.includes(targetStatus)) {
        ineligible.push({
          app,
          reason: `${app.status.replaceAll("_", " ")} cannot move to ${targetStatus.replaceAll("_", " ")}.`,
        });
        continue;
      }

      eligible.push(app);
    }

    const reasonGroups = ineligible.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.reason] = (acc[item.reason] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      eligible,
      ineligible,
      reasonGroups,
    };
  }, [selectedApplications, targetStatus]);

  useEffect(() => {
    if (
      targetStatus &&
      selectedIds.size > 0 &&
      !availableTargetStatuses.includes(targetStatus)
    ) {
      setTargetStatus("");
    }
  }, [targetStatus, selectedIds, availableTargetStatuses]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map((a) => a.id)));
    }
  };

  const selectCurrentPage = () => {
    setSelectedIds(new Set(applications.map((app) => app.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const invertCurrentPageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const app of applications) {
        if (next.has(app.id)) {
          next.delete(app.id);
        } else {
          next.add(app.id);
        }
      }
      return next;
    });
  };

  const handleBatchProcess = () => {
    if (selectedIds.size === 0 || !targetStatus) return;
    setIsPreflightOpen(true);
  };

  const handleConfirmBatchProcess = async () => {
    if (!preflightSummary || !targetStatus) return;

    const eligibleIds = preflightSummary.eligible.map((app) => app.id);
    const skippedAsFailed = preflightSummary.ineligible.map((item) => ({
      id: item.app.id,
      name: `${item.app.lastName}, ${item.app.firstName}`,
      trackingNumber: item.app.trackingNumber,
      reason: item.reason,
    }));

    if (eligibleIds.length === 0) {
      setBatchResults({
        processed: selectedIds.size,
        succeeded: [],
        failed: skippedAsFailed,
      });
      setIsPreflightOpen(false);
      return;
    }

    setIsBatchProcessing(true);
    try {
      const res = await api.patch("/early-registrations/batch-process", {
        ids: eligibleIds,
        targetStatus,
      });

      const failed = [...skippedAsFailed, ...(res.data.failed ?? [])];
      setBatchResults({
        processed: selectedIds.size,
        succeeded: res.data.succeeded ?? [],
        failed,
      });

      setSelectedIds(new Set(failed.map((item) => item.id)));
      setIsPreflightOpen(false);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleResultsClose = () => {
    setBatchResults(null);
    fetchData();
  };

  const handleSaveResult = async (appId: number) => {
    const raw = scores[appId];
    if (!raw || isNaN(Number(raw))) return;

    const score = Number(raw);
    setSavingId(appId);
    try {
      const res = await api.patch(
        `/early-registrations/${appId}/record-step-result`,
        {
          stepOrder: 1,
          kind: "EXAM",
          score,
          notes: "Recorded from Registration Pipelines",
        },
      );

      if (res.data?.status === "ASSESSMENT_TAKEN" && cutoffScore != null) {
        if (score >= cutoffScore) {
          await api.patch(`/early-registrations/${appId}/pass`);
        } else {
          await api.patch(`/early-registrations/${appId}/fail`);
        }
      }

      sileo.success({
        title: "Result Recorded",
        description: "Assessment result saved.",
      });
      setScores((prev) => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingId(null);
    }
  };

  const getRemarkByScore = (appId: number): string => {
    const raw = scores[appId];
    if (
      raw == null ||
      raw.trim() === "" ||
      isNaN(Number(raw)) ||
      cutoffScore == null
    ) {
      return "---";
    }

    return Number(raw) >= cutoffScore ? "PASSED" : "FAILED";
  };

  const allSelected =
    applications.length > 0 && selectedIds.size === applications.length;

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

  return (
    <>
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="space-y-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              {STAGE_QUICK_FILTERS.map((stage) => (
                <Button
                  key={stage.value}
                  type="button"
                  size="sm"
                  variant={status === stage.value ? "default" : "outline"}
                  className="h-8 text-xs font-bold"
                  onClick={() => {
                    setStatus(stage.value);
                    setPage(1);
                  }}>
                  {stage.label}
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 text-[10px]">
                    {stageCounts[stage.value] ?? 0}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-sm uppercase tracking-wider font-bold">
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
            <Button
              variant="outline"
              className="h-10 px-3 w-full md:w-auto text-sm font-bold"
              onClick={() => {
                setSearch("");
                setStatus("ALL");
                setPage(1);
              }}>
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {/* Batch Action Toolbar */}
          <div className="sticky top-0 z-20 rounded-xl border border-primary/20 bg-background/95 backdrop-blur px-3 py-3 mb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="h-8 px-3 text-xs font-bold">
                  {selectedIds.size} selected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  onClick={selectCurrentPage}
                  disabled={applications.length === 0 || isBatchProcessing}>
                  Select Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold"
                  onClick={invertCurrentPageSelection}
                  disabled={applications.length === 0 || isBatchProcessing}>
                  Invert Page
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-bold text-muted-foreground"
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0 || isBatchProcessing}>
                  Clear
                </Button>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                <Select value={targetStatus} onValueChange={setTargetStatus}>
                  <SelectTrigger className="h-9 sm:w-56 text-sm font-bold">
                    <SelectValue placeholder="Target status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_STATUS_OPTIONS.map((opt) => {
                      const isAvailableForSelection =
                        selectedIds.size === 0 ||
                        availableTargetStatuses.includes(opt.value);
                      return (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          disabled={!isAvailableForSelection}
                          className="text-sm font-bold">
                          {opt.label}
                          {!isAvailableForSelection
                            ? " (not valid for selection)"
                            : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  disabled={
                    selectedIds.size === 0 ||
                    !targetStatus ||
                    isBatchProcessing ||
                    (preflightSummary?.eligible.length ?? 0) === 0
                  }
                  onClick={handleBatchProcess}
                  className="font-bold">
                  {isBatchProcessing ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Processing...
                    </>
                  ) : (
                    `Review ${selectedIds.size} Applicant${selectedIds.size > 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            </div>

            {selectedIds.size > 0 && availableTargetStatuses.length === 0 && (
              <p className="mt-2 text-xs font-bold text-destructive">
                No shared safe target is available for this selection. Group
                applicants by status first.
              </p>
            )}
            {selectedIds.size > 0 && targetStatus && preflightSummary && (
              <p className="mt-2 text-xs font-bold text-muted-foreground">
                {preflightSummary.eligible.length} ready to process,{" "}
                {preflightSummary.ineligible.length} blocked by transition
                rules.
              </p>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden">
            <Table className="border-collapse">
              <TableHeader className="bg-[hsl(var(--primary))]">
                <TableRow>
                  <TableHead className="w-12 text-center text-primary-foreground">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center"
                      disabled={isBatchProcessing}>
                      {allSelected ? (
                        <CheckSquare className="size-4 text-primary-foreground" />
                      ) : (
                        <Square className="size-4 text-primary-foreground/60" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    APPLICANT
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground hidden md:table-cell text-sm">
                    LRN
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    GRADE LEVEL
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    STATUS
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground hidden xl:table-cell text-sm">
                    DATE
                  </TableHead>
                  {showAssessment && (
                    <>
                      <TableHead className="text-center font-bold text-primary-foreground text-sm">
                        ASSESSMENT SCORE
                      </TableHead>
                      <TableHead className="text-center font-bold text-primary-foreground text-sm">
                        REMARKS
                      </TableHead>
                      <TableHead className="text-center font-bold text-primary-foreground text-sm">
                        ACTIONS
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
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
                      {showAssessment && (
                        <>
                          <TableCell className="text-sm">
                            <div className="flex justify-center">
                              <Skeleton className="h-8 w-28" />
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex justify-center">
                              <Skeleton className="h-4 w-16" />
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex justify-center">
                              <Skeleton className="h-8 w-16" />
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showAssessment ? 9 : 6}
                      className="h-24 text-center text-sm font-bold">
                      No applicants found.
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow
                      key={app.id}
                      className={`hover:bg-[hsl(var(--muted))] transition-colors text-center text-sm ${
                        selectedIds.has(app.id)
                          ? "bg-[hsl(var(--muted))] shadow-inner"
                          : ""
                      }`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(app.id)}
                          onCheckedChange={() => toggleSelect(app.id)}
                          disabled={isBatchProcessing}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm uppercase">
                            {app.lastName}, {app.firstName}{" "}
                            {app.middleName
                              ? `${app.middleName.charAt(0)}.`
                              : ""}
                            {app.suffix ? ` ${app.suffix}` : ""}
                          </span>
                          <span className="text-sm font-bold">
                            {app.trackingNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-bold">
                        {app.lrn || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-sm">
                          {app.gradeLevel?.name ?? "—"}
                        </span>
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
                      {showAssessment && (
                        <>
                          <TableCell>
                            <div className="flex flex-col items-center justify-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                className="h-8 w-20 text-center text-sm font-bold"
                                value={scores[app.id] ?? ""}
                                onChange={(e) =>
                                  setScores((prev) => ({
                                    ...prev,
                                    [app.id]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs font-bold mt-1">
                                Cut-off score: {cutoffScore ?? "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`text-xs font-bold ${
                                getRemarkByScore(app.id) === "PASSED"
                                  ? "text-emerald-700"
                                  : getRemarkByScore(app.id) === "FAILED"
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              }`}>
                              {getRemarkByScore(app.id)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                              disabled={
                                savingId === app.id ||
                                !scores[app.id] ||
                                isNaN(Number(scores[app.id]))
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveResult(app.id);
                              }}>
                              {savingId === app.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Save className="h-3 w-3 mr-1" />
                              )}
                              Save Result
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
            <span className="text-xs">
              Showing {applications.length} applicants
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
                disabled={page * limit >= total}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isPreflightOpen}
        onOpenChange={(open) => {
          if (!isBatchProcessing) {
            setIsPreflightOpen(open);
          }
        }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Confirm Batch Processing
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              Selected target status:{" "}
              {targetStatus.replaceAll("_", " ") || "N/A"}
            </DialogDescription>
          </DialogHeader>

          {preflightSummary && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-xs text-muted-foreground font-bold">
                    Selected
                  </p>
                  <p className="text-lg font-bold">{selectedIds.size}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700 font-bold">Eligible</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {preflightSummary.eligible.length}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs text-red-700 font-bold">Blocked</p>
                  <p className="text-lg font-bold text-red-700">
                    {preflightSummary.ineligible.length}
                  </p>
                </div>
              </div>

              {preflightSummary.ineligible.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 space-y-2">
                  <p className="text-sm font-bold text-red-700">
                    Blocked groups
                  </p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {Object.entries(preflightSummary.reasonGroups).map(
                      ([reason, count]) => (
                        <p
                          key={reason}
                          className="text-xs font-bold text-red-700">
                          {count}x {reason}
                        </p>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPreflightOpen(false)}
              disabled={isBatchProcessing}
              className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBatchProcess}
              disabled={
                isBatchProcessing ||
                (preflightSummary?.eligible.length ?? 0) === 0
              }
              className="font-bold">
              {isBatchProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Processing...
                </>
              ) : (
                `Process ${preflightSummary?.eligible.length ?? 0} Eligible`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Results Modal */}
      <BatchResultsModal
        results={batchResults}
        onReselectFailed={(ids) => setSelectedIds(new Set(ids))}
        onClose={handleResultsClose}
      />
    </>
  );
}
