import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Save, Loader2, Search, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { type Application, type EarlyRegistrationApiRow } from "./pipeline-batch/types";
import { Link } from "react-router";
import BatchResultsModal from "./BatchResultsModal";
import type { BatchResults } from "./BatchResultsModal";

const PAGE_LIMIT = 30;

/** Status groups for score-editability and actions */
const SCOREABLE_STATUSES = ["EXAM_SCHEDULED", "ASSESSMENT_TAKEN"];
const QUALIFY_STATUS = "PASSED";

function getDocsStatusLabel(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (["EXAM_SCHEDULED", "ASSESSMENT_TAKEN", "PASSED", "FAILED_ASSESSMENT", "READY_FOR_ENROLLMENT", "ENROLLED", "TEMPORARILY_ENROLLED"].includes(status)) {
    return { label: "Complete", variant: "default" };
  }
  if (status === "SUBMITTED_BEEF" || status === "VERIFIED" || status === "ELIGIBLE" || status === "UNDER_REVIEW") {
    return { label: "Verified", variant: "secondary" };
  }
  return { label: "Pending", variant: "outline" };
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PASSED" || status === "READY_FOR_ENROLLMENT" || status === "ENROLLED") return "default";
  if (status === "FAILED_ASSESSMENT" || status === "REJECTED") return "destructive";
  if (status === "EXAM_SCHEDULED" || status === "ASSESSMENT_TAKEN" || status === "INTERVIEW_SCHEDULED") return "secondary";
  return "outline";
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SUBMITTED_BEERF: "Submitted",
    SUBMITTED_BEEF: "For Enrollment",
    VERIFIED: "Verified",
    UNDER_REVIEW: "Under Review",
    ELIGIBLE: "Eligible",
    EXAM_SCHEDULED: "Exam Scheduled",
    ASSESSMENT_TAKEN: "Assessed",
    PASSED: "Passed",
    FAILED_ASSESSMENT: "Failed",
    INTERVIEW_SCHEDULED: "Interview Scheduled",
    READY_FOR_ENROLLMENT: "Ready to Enroll",
    TEMPORARILY_ENROLLED: "Temp. Enrolled",
    ENROLLED: "Enrolled",
    REJECTED: "Rejected",
  };
  return labels[status] ?? status;
}

function computeComposite(exam: number | null, interview: number | null, ga: number | null): number | null {
  if (exam == null && interview == null) return null;
  const e = exam ?? 0;
  const i = interview ?? 0;
  const g = ga ?? 0;
  return Number(((e * 0.65) + (i * 0.15) + (g * 0.20)).toFixed(2));
}

interface RowScoreState {
  examScore: string;
  interviewScore: string;
  absentNoShow: boolean;
  dirty: boolean;
}

function initRowScore(app: Application): RowScoreState {
  const examAssessment = app.assessments?.find((a) => a.type !== "INTERVIEW");
  const interviewAssessment = app.assessments?.find((a) => a.type === "INTERVIEW");
  return {
    examScore: examAssessment?.score != null ? String(examAssessment.score) : "",
    interviewScore: interviewAssessment?.score != null ? String(interviewAssessment.score) : "",
    absentNoShow: false,
    dirty: false,
  };
}

interface Props {
  applicantType: string;
  cutoffScore?: number | null;
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "EXAM_SCHEDULED", label: "Exam Scheduled" },
  { value: "ASSESSMENT_TAKEN", label: "Assessed" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED_ASSESSMENT", label: "Failed" },
  { value: "READY_FOR_ENROLLMENT", label: "Ready" },
];

export default function ScpInlineAssessmentTable({ applicantType, cutoffScore }: Props) {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rowScores, setRowScores] = useState<Record<number, RowScoreState>>({});
  const [saving, setSaving] = useState(false);
  const [qualifying, setQualifying] = useState<number | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResults | null>(null);

  const {
    inputValue: search,
    setInputValue: setSearch,
    activeFilter: activeSearch,
  } = useDebouncedSearch();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const fetchData = useCallback(async () => {
    if (!ayId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));
      params.append("applicantType", applicantType);
      params.append("page", String(page));
      params.append("limit", String(PAGE_LIMIT));
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (activeSearch) params.append("search", activeSearch);

      const res = await api.get(`/early-registrations?${params.toString()}`);
      const rows = (res.data.data as EarlyRegistrationApiRow[]).map((app) => ({
        ...app,
        firstName: app.learner?.firstName ?? app.firstName,
        lastName: app.learner?.lastName ?? app.lastName,
        middleName: app.learner?.middleName ?? app.middleName,
        suffix: app.learner?.extensionName ?? app.suffix,
        lrn: app.learner?.lrn ?? app.lrn,
      }));

      setApplications(rows);
      setTotal(Number(res.data?.pagination?.total ?? 0));

      // Initialize score state from fetched data (don't overwrite dirty rows)
      setRowScores((prev) => {
        const next = { ...prev };
        for (const app of rows) {
          if (!next[app.id] || !next[app.id].dirty) {
            next[app.id] = initRowScore(app);
          }
        }
        return next;
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, applicantType, page, statusFilter, activeSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, activeSearch]);

  const handleScoreChange = (id: number, field: "examScore" | "interviewScore", value: string) => {
    setRowScores((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  };

  const handleNoShowChange = (id: number, checked: boolean) => {
    setRowScores((prev) => ({
      ...prev,
      [id]: { ...prev[id], absentNoShow: checked, dirty: true },
    }));
  };

  const scoreableRows = useMemo(
    () => applications.filter((app) => SCOREABLE_STATUSES.includes(app.status)),
    [applications],
  );

  const dirtyScoreableRows = useMemo(
    () => scoreableRows.filter((app) => rowScores[app.id]?.dirty),
    [scoreableRows, rowScores],
  );

  const handleSaveAll = async () => {
    const rowsToSave = scoreableRows.filter((app) => {
      const s = rowScores[app.id];
      if (!s) return false;
      if (s.absentNoShow) return true;
      return s.examScore.trim() !== "" || s.interviewScore.trim() !== "";
    });

    if (rowsToSave.length === 0) {
      sileo.info({ title: "Nothing to save", description: "Enter at least one score before saving." });
      return;
    }

    setSaving(true);
    try {
      const payload = rowsToSave.map((app) => {
        const s = rowScores[app.id];
        const componentScores: Record<string, number> = {};
        const examVal = parseFloat(s.examScore);
        const intVal = parseFloat(s.interviewScore);
        if (!s.absentNoShow) {
          if (Number.isFinite(examVal)) componentScores["EXAM"] = examVal;
          if (Number.isFinite(intVal)) componentScores["INTERVIEW"] = intVal;
        }
        return {
          id: app.id,
          componentScores,
          absentNoShow: s.absentNoShow,
        };
      });

      const res = await api.patch("/early-registrations/batch/save-scores", { rows: payload });
      const rawSucceeded: Array<{ id: number; name: string; trackingNumber: string }> = res.data.succeeded ?? [];
      const results: BatchResults = {
        succeeded: rawSucceeded.map((s) => ({ ...s, previousStatus: "" })),
        failed: res.data.failed ?? [],
        processed: res.data.processed ?? rowsToSave.length,
      };

      if (results.failed.length > 0) {
        setBatchResults(results);
      } else {
        sileo.success({
          title: "Scores Saved",
          description: `${results.succeeded.length} applicant(s) processed successfully.`,
        });
      }

      // Clear dirty flag and refresh
      setRowScores((prev) => {
        const next = { ...prev };
        for (const app of rowsToSave) {
          if (next[app.id]) next[app.id] = { ...next[app.id], dirty: false };
        }
        return next;
      });
      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSaving(false);
    }
  };

  const handleQualify = async (app: Application) => {
    setQualifying(app.id);
    try {
      const res = await api.patch("/early-registrations/batch-process", {
        ids: [app.id],
        targetStatus: "READY_FOR_ENROLLMENT",
      });
      const failed = res.data.failed ?? [];
      if (failed.length > 0) {
        sileo.error({ title: "Qualify Failed", description: failed[0]?.reason ?? "Unknown error." });
      } else {
        sileo.success({ title: "Qualified", description: `${app.firstName} ${app.lastName} is now ready for enrollment.` });
        await fetchData();
      }
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setQualifying(null);
    }
  };

  const hasDirty = dirtyScoreableRows.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search by name or LRN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs font-bold"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 font-bold"
            onClick={handleSaveAll}
            disabled={saving || loading || scoreableRows.length === 0}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save All Scores
            {hasDirty && (
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] font-bold">
                {dirtyScoreableRows.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Composite formula hint */}
      <p className="text-[11px] text-muted-foreground font-medium">
        Composite = (Exam × 65%) + (Interview × 15%) + (Gen. Avg × 20%)
        {cutoffScore != null && <span className="ml-2 text-foreground font-bold">· Cut-off: {cutoffScore}</span>}
      </p>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2.5 text-left font-bold text-xs text-muted-foreground">Applicant</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Status</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Docs</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Gen. Avg</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Exam (65%)</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Interview (15%)</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Composite</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">No-Show</th>
              <th className="px-3 py-2.5 text-center font-bold text-xs text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && applications.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">
                  <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                  Loading…
                </td>
              </tr>
            )}
            {!loading && applications.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">
                  No applicants found.
                </td>
              </tr>
            )}
            {applications.map((app, idx) => {
              const s = rowScores[app.id] ?? initRowScore(app);
              const isScoreable = SCOREABLE_STATUSES.includes(app.status);
              const isQualifiable = app.status === QUALIFY_STATUS;

              const examNum = parseFloat(s.examScore);
              const intNum = parseFloat(s.interviewScore);
              const composite = computeComposite(
                Number.isFinite(examNum) ? examNum : null,
                Number.isFinite(intNum) ? intNum : null,
                app.generalAverage,
              );

              const aboveOrMeetsCutoff =
                composite != null && cutoffScore != null && composite >= cutoffScore;

              const docsStatus = getDocsStatusLabel(app.status);

              return (
                <tr
                  key={app.id}
                  className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${s.dirty ? "bg-amber-50/60" : ""}`}
                >
                  {/* Applicant */}
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-xs leading-tight">
                      {app.lastName}, {app.firstName}
                      {app.middleName ? ` ${app.middleName[0]}.` : ""}
                      {app.suffix ? ` ${app.suffix}` : ""}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {app.lrn || "No LRN"}
                      <span className="mx-1">·</span>
                      #{idx + 1 + (page - 1) * PAGE_LIMIT}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant={getStatusBadgeVariant(app.status)} className="text-[10px] font-bold">
                      {getStatusLabel(app.status)}
                    </Badge>
                  </td>

                  {/* Docs */}
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant={docsStatus.variant} className="text-[10px] font-bold">
                      {docsStatus.label}
                    </Badge>
                  </td>

                  {/* GA */}
                  <td className="px-3 py-2.5 text-center font-bold text-xs">
                    {app.generalAverage != null ? app.generalAverage.toFixed(1) : "—"}
                  </td>

                  {/* Exam Score */}
                  <td className="px-3 py-2.5 text-center">
                    {isScoreable ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={s.absentNoShow ? "" : s.examScore}
                        onChange={(e) => handleScoreChange(app.id, "examScore", e.target.value)}
                        disabled={s.absentNoShow}
                        placeholder="0–100"
                        className="h-7 w-20 mx-auto text-center text-xs font-bold"
                      />
                    ) : (
                      <span className="font-bold text-xs">
                        {s.examScore || "—"}
                      </span>
                    )}
                  </td>

                  {/* Interview Score */}
                  <td className="px-3 py-2.5 text-center">
                    {isScoreable ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={s.absentNoShow ? "" : s.interviewScore}
                        onChange={(e) => handleScoreChange(app.id, "interviewScore", e.target.value)}
                        disabled={s.absentNoShow}
                        placeholder="0–100"
                        className="h-7 w-20 mx-auto text-center text-xs font-bold"
                      />
                    ) : (
                      <span className="font-bold text-xs">
                        {s.interviewScore || "—"}
                      </span>
                    )}
                  </td>

                  {/* Composite */}
                  <td className="px-3 py-2.5 text-center">
                    {composite != null ? (
                      <span
                        className={`font-bold text-xs ${
                          cutoffScore != null
                            ? aboveOrMeetsCutoff
                              ? "text-green-700"
                              : "text-red-600"
                            : "text-foreground"
                        }`}
                      >
                        {composite.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* No-Show */}
                  <td className="px-3 py-2.5 text-center">
                    {isScoreable ? (
                      <Checkbox
                        checked={s.absentNoShow}
                        onCheckedChange={(v) => handleNoShowChange(app.id, Boolean(v))}
                        className="mx-auto"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {isQualifiable && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 text-[11px] font-bold"
                          disabled={qualifying === app.id}
                          onClick={() => handleQualify(app)}
                        >
                          {qualifying === app.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "Qualify ✓"
                          )}
                        </Button>
                      )}
                      <Link to={`/admission/early-registration/${app.id}`} target="_blank">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} applicant(s)</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-bold px-1">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
      {totalPages <= 1 && total > 0 && (
        <p className="text-xs text-muted-foreground">{total} applicant(s)</p>
      )}

      {batchResults && (
        <BatchResultsModal
          results={batchResults}
          onClose={() => {
            setBatchResults(null);
            void fetchData();
          }}
        />
      )}
    </div>
  );
}
