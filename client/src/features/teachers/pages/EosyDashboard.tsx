import { useState, useEffect, useCallback, useMemo } from "react";

import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { CheckCircle2, Lock, Loader2, AlertTriangle, Users } from "lucide-react";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/shared/lib/utils";

interface Learner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  sex?: "MALE" | "FEMALE" | null;
}

interface EnrollmentApplication {
  id: number;
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
      const res = await api.get("/teacher-eosy/advisory");
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
      
      lifecycleFeedback.success(
        "Advisory Finalized",
        "Your section's EOSY grades and statuses have been submitted to the Registrar."
      );
      
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
        id: "finalAve",
        accessorKey: "finalAverage",
        header: ({ column }) => <DataTableColumnHeader column={column} title="GEN AVE" className="justify-center" />,
        cell: ({ row }) => {
          const r = row.original;
          const ave = r.finalAverage;
          const isFailing = ave !== null && ave < 75;

          if (isFinalized) {
            return (
              <span className={cn("font-bold text-xs sm:text-sm tabular-nums block text-center", isFailing ? "text-red-600" : "text-emerald-600")}>
                {ave?.toFixed(0) || "0"}
              </span>
            );
          }

          return (
            <div className="flex justify-center">
              <Input
                type="number"
                step="1"
                min="60"
                max="100"
                className={cn(
                  "h-8 w-24 text-center font-bold text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all",
                  isFailing ? "text-red-600 border-red-300 focus:ring-red-500" : "text-emerald-600"
                )}
                value={ave ?? ""}
                onChange={(e) => handleAverageChange(r.id, e.target.value)}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-", "."].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="0"
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

          if (isFinalized) {
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
              >
                <SelectTrigger
                  className={cn(
                    "h-8 w-32 font-black uppercase text-[10px]",
                    resolvedStatus === "PROMOTED"
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-amber-700 bg-amber-50 border-amber-200",
                  )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMOTED">Promoted</SelectItem>
                  <SelectItem value="RETAINED">Retained</SelectItem>
                  <SelectItem value="DROPPED_OUT">Dropped Out</SelectItem>
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

  if (loading) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading Advisory Records...</p>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-6 p-6">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-black uppercase">No Advisory Assigned</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You do not have an active advisory section assigned for this school year.
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
              EOSY Finalization
            </h1>
            <p className="text-sm font-bold text-foreground">
              {section.gradeLevel.name} - {section.name}
            </p>
          </div>
        </div>

        <Card className="flex flex-col shadow-sm border border-border overflow-hidden bg-card h-full">
          <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 space-y-4">
            
            {/* Header / Actions Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-3 rounded-md border border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                {isFinalized ? (
                  <Badge variant="outline" className="bg-emerald-600 text-white border-emerald-700 px-3 py-1.5 shadow-sm text-xs uppercase font-black">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> ✓ Submitted & Locked
                  </Badge>
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    Please review grades and statuses before submitting.
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {!isFinalized && (
                  <Button
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={isSubmitDisabled}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    <Lock className="h-4 w-4 mr-2" /> Submit to Registrar
                  </Button>
                )}
              </div>
            </div>

            {isFinalized && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-emerald-800 text-sm font-medium">
                Your section's records have been submitted and locked. They are now read-only and await Registrar's batch sectioning algorithm.
              </div>
            )}

            {/* Table */}
            <div className="flex-1 min-h-0 bg-card rounded-md border flex flex-col">
              <div className="flex-1 overflow-auto">
                <DataTable
                  columns={columns}
                  data={records}
                />
              </div>
            </div>
            
          </div>
        </Card>
      </div>

      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md border-amber-200">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center text-xl text-amber-700">Submit to Registrar?</DialogTitle>
            <DialogDescription className="text-center pt-2 font-medium text-amber-800">
              Warning: This action is final. Are you sure you want to lock these grades and forward them to the Head Registrar?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 p-4 rounded-md text-sm text-amber-800 space-y-2 my-2 border border-amber-100">
            <p>• All entered grades and statuses will be forwarded to the Registrar.</p>
            <p>• Your section's records will be locked and become read-only.</p>
            <p className="font-bold underline mt-3">This action cannot be undone by a teacher.</p>
          </div>
          <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={submitLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={submitLoading}
              className="w-full sm:w-auto font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
