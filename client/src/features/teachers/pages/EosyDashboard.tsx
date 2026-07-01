import { useState, useEffect, useCallback, useMemo } from "react";

import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import { PhaseBanner } from "@/shared/components/PhaseBanner";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Input } from "@/shared/ui/input";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { CheckCircle2, Lock, Loader2, AlertTriangle, Users } from "lucide-react";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/shared/ui/tooltip";
import { useEosyStream, type EosyEventPayload } from "@/features/enrollment/hooks/useEosyStream";

interface Learner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  sex?: "MALE" | "FEMALE" | null;
}

interface EnrollmentApplication {
  id: number;
  applicantType: string;
  learner: Learner;
}

interface EnrollmentRecord {
  id: number;
  eosyStatus: "PROMOTED" | "RETAINED" | "DROPPED_OUT" | string | null;
  finalAverage: number | null;
  enrollmentApplication: EnrollmentApplication;
}

interface Section {
  id: number;
  name: string;
  isEosyFinalized: boolean;
  programType?: string;
  gradeLevel: {
    name: string;
  };
}

const formatStatusLabel = (status: string | null) => {
  const normalized = status ?? "PROMOTED";
  switch (normalized) {
    case "PROMOTED":
      return "Promoted";
    case "RETAINED":
      return "Retained";
    case "DROPPED_OUT":
      return "Dropped Out";
    default:
      return "Promoted";
  }
};

export default function TeacherEosyDashboard() {
  const { systemPhase } = useSettingsStore();
  const isEosyPhase = systemPhase === "EOSY_CLOSING";

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section | null>(null);
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchAdvisory = useCallback(async () => {
    setLoading(true);
    try {
      // Use cache buster to guarantee we get fresh data every time, especially after an SSE trigger
      const res = await api.get(`/teacher-eosy/advisory?_t=${Date.now()}`);
      if (res.data.section) {
        setSection(res.data.section);
        // Default null statuses to PROMOTED locally
        const initializedRecords = (res.data.records || []).map((r: EnrollmentRecord) => ({
          ...r,
          eosyStatus: r.eosyStatus || "PROMOTED"
        }));
        setRecords(initializedRecords);
      }
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdvisory();
  }, [fetchAdvisory]);

  const handleStatusChange = (recordId: number, newStatus: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, eosyStatus: newStatus } : r))
    );
  };

  const handleAverageChange = (recordId: number, value: string) => {
    const num = value ? parseFloat(value) : null;
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, finalAverage: num } : r))
    );
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const payload = {
        updates: records.map(r => ({
          recordId: r.id,
          eosyStatus: r.eosyStatus,
          finalAverage: r.finalAverage
        }))
      };

      await api.post("/teacher-eosy/advisory/submit", payload);

      sileo.success({
        title: "Advisory Finalized",
        description: "Your section's EOSY grades and statuses have been submitted to the Registrar."
      });

      setConfirmModalOpen(false);
      void fetchAdvisory();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitLoading(false);
    }
  };

  const isFinalized = section?.isEosyFinalized ?? false;
  const isSubmitDisabled = records.length === 0 || isFinalized;

  // Listen to EOSY SSE for real-time section updates (e.g. unlock from admin)
  useEosyStream(
    useCallback((payload: EosyEventPayload) => {
      const relevantEvents = ["SECTION_UNLOCKED", "TEACHER_EOSY_SUBMITTED", "SECTION_FINALIZED", "GRADE_LEVEL_FINALIZED"];
      if (relevantEvents.includes(payload.type)) {
        void fetchAdvisory();
      }
    }, [fetchAdvisory])
  );

  const columns = useMemo<ColumnDef<EnrollmentRecord>[]>(
    () => [
      {
        id: "student",
        accessorKey: "enrollmentApplication.learner.lastName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="LEARNER" />,
        cell: ({ row }) => {
          const sex = row.original.enrollmentApplication.learner.sex;
          const genderLabel = sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : null;

          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-base">
              <span className="font-extrabold uppercase truncate">
                {row.original.enrollmentApplication.learner.lastName}, {row.original.enrollmentApplication.learner.firstName}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-base text-foreground font-extrabold uppercase">
                  LRN: {row.original.enrollmentApplication.learner.lrn || "NO LRN"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "finalAve",
        accessorKey: "finalAverage",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Final GEN AVE" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const ave = r.finalAverage;
          const isFailing = ave !== null && ave < 75;
          const applicantType = r.enrollmentApplication.applicantType;
          const isScpWarning = applicantType !== "REGULAR" && applicantType !== "LATE_ENROLLEE" && ave !== null && ave >= 75 && ave < 85;

          if (isFinalized) {
            return (
              <span className={cn("text-base sm:text-base leading-tight tabular-nums block text-center font-extrabold", isFailing ? "text-red-600" : "text-gray-900")}>
                {ave !== null ? ave.toFixed(2) : "--"}
              </span>
            );
          }

          return (
            <div className="flex justify-center">
              <Input
                type="number"
                step="0.01"
                min="60"
                max="100"
                className={cn(
                  "h-8 w-24 text-center font-extrabold text-base leading-tight bg-white border rounded-md shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all",
                  isFailing ? "text-red-600 border-red-300 focus:ring-red-500" :
                    isScpWarning ? "text-amber-600 border-amber-500 focus:ring-amber-500" : "text-gray-900 border-gray-300",
                  "disabled:opacity-100 disabled:bg-gray-50"
                )}
                value={ave ?? ""}
                onChange={(e) => handleAverageChange(r.id, e.target.value)}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="0.00"
              />
            </div>
          );
        },
        size: 120,
      },
      {
        id: "status",
        accessorKey: "eosyStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="EOSY STATUS" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const resolvedStatus = r.eosyStatus ?? "PROMOTED";
          const statusLabel = formatStatusLabel(r.eosyStatus);

          const ave = r.finalAverage;
          const isScp = Boolean(section?.programType && section.programType !== "REGULAR");
          const isScpWarning = isScp && ave !== null && ave !== undefined && ave >= 75 && ave < 85;
          const isFailing = ave !== null && ave !== undefined && ave > 0 && ave < 75;
          const hasZeroOrBlankGrade = ave === 0 || ave === null || ave === undefined || isNaN(ave);

          const renderStatusContent = () => (
            <div
              className={cn(
                "inline-flex items-center justify-between w-max min-w-[140px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border transition-colors",
                isScpWarning
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : !r.eosyStatus || r.eosyStatus === "PROMOTED"
                    ? "text-green-700 bg-green-50 border-green-200"
                    : "text-amber-700 bg-amber-50 border-amber-200"
              )}>
              <span>{isScpWarning ? "PROMOTED (TO BEC)" : statusLabel}</span>
              {isScpWarning && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 ml-2 cursor-help" />
              )}
            </div>
          );

          const renderTooltip = (trigger: React.ReactNode) => (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {trigger}
                </TooltipTrigger>
                <TooltipContent className="bg-amber-50 border border-amber-300 text-amber-900 shadow-lg rounded-md p-4 w-80 text-left">
                  <h4 className="text-base font-extrabold uppercase tracking-wide text-amber-800 border-b border-amber-200 pb-2 mb-2">
                    Special Program Retention Alert
                  </h4>
                  <p className="text-base leading-snug">
                    Learner did not meet the 85 minimum grade requirement for their special program. They will be promoted to the next grade level but transferred to Regular (BEC) classes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );

          if (isFinalized) {
            return (
              <div className="flex justify-center">
                {isScpWarning ? renderTooltip(renderStatusContent()) : renderStatusContent()}
              </div>
            );
          }

          return (
            <div className="flex justify-center items-center gap-2">
              <Select
                value={isScpWarning ? "PROMOTED_TO_BEC" : resolvedStatus}
                onValueChange={(val) => {
                  if (val === "PROMOTED_TO_BEC") handleStatusChange(r.id, "PROMOTED");
                  else handleStatusChange(r.id, val);
                }}
                disabled={isScpWarning}
              >
                {isScpWarning ? (
                  renderTooltip(
                    <SelectTrigger
                      className={cn(
                        "inline-flex items-center justify-between w-max min-w-[140px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border disabled:opacity-100",
                        "text-amber-700 bg-amber-50 border-amber-200 cursor-help"
                      )}>
                      <span className="flex-1 text-left">PROMOTED (TO BEC)</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 ml-1" />
                    </SelectTrigger>
                  )
                ) : (
                  <SelectTrigger
                    className={cn(
                      "inline-flex items-center justify-between w-max min-w-[140px] px-3 py-1.5 text-sm font-extrabold whitespace-nowrap rounded-md border disabled:opacity-100",
                      !r.eosyStatus || r.eosyStatus === "PROMOTED"
                        ? "text-green-700 bg-green-50 border-green-200"
                        : "text-amber-700 bg-amber-50 border-amber-200",
                    )}>
                    <SelectValue />
                  </SelectTrigger>
                )}
                <SelectContent>
                  {!hasZeroOrBlankGrade && !isFailing && !isScpWarning && (
                    <SelectItem value="PROMOTED">PROMOTED</SelectItem>
                  )}
                  {isScp && !hasZeroOrBlankGrade && !isFailing && (
                    <SelectItem value="PROMOTED_TO_BEC">PROMOTED (TO BEC)</SelectItem>
                  )}
                  {!hasZeroOrBlankGrade && (
                    <SelectItem value="RETAINED">RETAINED</SelectItem>
                  )}
                  <SelectItem value="DROPPED_OUT">DROPPED OUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
        size: 150,
      },
    ],
    [isFinalized]
  );

  if (!isEosyPhase) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
          <Lock className="h-8 w-8 text-foreground" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-extrabold uppercase">EOSY Phase Not Active</h2>
          <p className="text-base text-foreground leading-relaxed">
            EOSY status updates are only available during the End of School Year phase.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center text-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-base leading-tight ">Loading Advisory Records...</p>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
          <Users className="h-8 w-8 text-foreground" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-extrabold uppercase">No Advisory Assigned</h2>
          <p className="text-base text-foreground leading-relaxed">
            You do not have an active advisory section assigned for this school year.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-0 pb-6">
        <PhaseBanner />

        {/* ── Top Header ── */}
        <div className="flex items-center justify-between pb-6 flex-shrink-0">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-foreground">
              EOSY Finalization
            </h1>
            <p className="text-base leading-tight font-extrabold text-foreground uppercase">
              {section.gradeLevel.name} - {section.name}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-none shadow-sm flex flex-col overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
            {/* Header / Actions Row */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">
              <div className="flex items-center gap-2">
                {isFinalized ? (
                  <Badge variant="outline" className="bg-emerald-600 text-white border-emerald-700 px-3 py-1.5 shadow-sm text-base uppercase font-extrabold">
                    ✓ Submitted & Locked
                  </Badge>
                ) : (
                  <span className="text-base leading-tight font-extrabold text-foreground">
                    Please review grades and statuses before submitting.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 xl:justify-end">
                {!isFinalized && (
                  <Button
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={isSubmitDisabled}
                    size="lg"
                    className="bg-primary text-primary-foreground font-extrabold shadow-md transition-all uppercase"
                  >
                    Submit to Registrar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-card">
            {isFinalized && (
              <div className="bg-emerald-50 border-b border-emerald-200 p-4 text-emerald-800 text-base leading-tight font-extrabold text-center">
                Your section's records have been submitted and locked.
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={records}
                containerHeight="100%"
              />
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Submit to Registrar?"
        description={
          <span className="font-extrabold">
            Are you sure you want to lock these grades and forward them to the Head Registrar?
          </span>
        }
        footerWarning={
          <div className="text-left space-y-1">
            <p>• All entered grades and statuses will be forwarded to the Registrar.</p>
            <p>• Your section's records will be locked and become read-only.</p>
            <p className="font-extrabold underline mt-3">This action cannot be undone by a teacher.</p>
          </div>
        }
        onConfirm={handleSubmit}
        confirmText="Confirm & Submit"
        loading={submitLoading}
        variant="primary"
        icon={AlertTriangle}
      />
    </>
  );
}
