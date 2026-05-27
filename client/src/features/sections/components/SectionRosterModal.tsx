import { useEffect, useState, useCallback } from "react";
import { FileSpreadsheet, Loader2, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useSettingsStore } from "@/store/settings.slice";

// ── Program-type short labels (matches Homerooms.tsx) ───────────────────────

const SCP_SHORT_LABELS: Record<string, string> = {
  REGULAR: "BEC",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface RosterLearner {
  id: number;
  enrollmentApplicationId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  status: string;
  enrolledAt: string | null;
}

interface RosterSection {
  id: number;
  name: string;
  maxCapacity: number;
  programType: string;
  gradeLevel: string;
  advisingTeacher: { id: number; name: string } | null;
}

interface RosterResponse {
  section: RosterSection;
  learners: RosterLearner[];
}

// Flat row union for DataTable (divider group headers + learner rows share ColumnDef[])
type DividerRow = {
  _kind: "divider";
  id: number; // -1 = male group header, -2 = female group header
  label: string;
  count: number;
};

type LearnerRow = RosterLearner & {
  _kind: "learner";
  rowIndex: number; // SF1-compliant continuous row number
};

type TableRow = DividerRow | LearnerRow;

// ── Status badge helper ───────────────────────────────────────────────────────

function EnrollmentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    OFFICIALLY_ENROLLED: {
      label: "Official",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    ENROLLED: {
      label: "Enrolled",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    TEMPORARILY_ENROLLED: {
      label: "Temporary",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
  };
  const cfg = map[status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-muted text--foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────────

const ROSTER_COLUMNS: ColumnDef<TableRow>[] = [
  {
    id: "num",
    size: 40,
    header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
    cell: ({ row }) => {
      const r = row.original;
      if (r._kind === "divider") return null;
      return <span className="text--foreground">{r.rowIndex}</span>;
    },
  },
  {
    id: "lrn",
    size: 128,
    header: ({ column }) => <DataTableColumnHeader column={column} title="LRN" />,
    cell: ({ row }) => {
      const r = row.original;
      if (r._kind === "divider") return null;
      return r.lrn ? (
        <span className="text-[11px] font-bold">{r.lrn}</span>
      ) : (
        <span className="italic  -foreground text-[10px]">Pending</span>
      );
    },
  },
  {
    id: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="NAME" className="justify-start" />
    ),
    cell: ({ row }) => {
      const r = row.original;
      if (r._kind === "divider") {
        return (
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">
            {r.label}{" "}
            <span className="font-normal normal-case">({r.count})</span>
          </span>
        );
      }
      return (
        <div className="text-left font-bold">
          {r.lastName.toUpperCase()}, {r.firstName}
          {r.middleName ? ` ${r.middleName.charAt(0)}.` : ""}
        </div>
      );
    },
  },
  {
    id: "sex",
    size: 48,
    header: ({ column }) => <DataTableColumnHeader column={column} title="SEX" />,
    cell: ({ row }) => {
      const r = row.original;
      if (r._kind === "divider") return null;
      return (
        <span className="font-bold text--foreground">
          {r.sex === "MALE" ? "M" : "F"}
        </span>
      );
    },
  },
  {
    id: "status",
    size: 112,
    header: ({ column }) => <DataTableColumnHeader column={column} title="STATUS" />,
    cell: ({ row }) => {
      const r = row.original;
      if (r._kind === "divider") return null;
      return <EnrollmentBadge status={r.status} />;
    },
  },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface SectionRosterModalProps {
  sectionId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SectionRosterModal({
  sectionId,
  open,
  onOpenChange,
}: SectionRosterModalProps) {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingSf1, setGeneratingSf1] = useState(false);

  const { isHistoricalReadOnly, isArchivedYear } = useHistoricalReadOnly();
  const { viewingSchoolYearLabel } = useSettingsStore();

  const fetchRoster = useCallback(async (id: number) => {
    setLoading(true);
    setData(null);
    try {
      const res = await api.get<RosterResponse>(`/sections/${id}/roster`);
      setData(res.data);
    } catch {
      sileo.error({
        title: "Failed to load roster",
        description: "Could not retrieve the section roster. Please try again.",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (open && sectionId !== null) {
      void fetchRoster(sectionId);
    }
  }, [open, sectionId, fetchRoster]);

  const handleGenerateSf1 = async () => {
    if (!sectionId) return;
    setGeneratingSf1(true);
    try {
      const res = await api.get(`/sections/${sectionId}/roster/sf1`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
      const link = document.createElement("a");
      link.href = url;
      const sectionName = data?.section.name ?? `section-${sectionId}`;
      link.download = `SF1-${sectionName.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      sileo.success({
        title: "SF1 downloaded",
        description: `School Form 1 for ${sectionName} has been saved.`,
      });
    } catch {
      sileo.error({
        title: "SF1 generation failed",
        description: "Could not generate the SF1 file. Please try again.",
      });
    } finally {
      setGeneratingSf1(false);
    }
  };

  const section = data?.section ?? null;
  const allLearners = data?.learners ?? [];

  // ── SF1 ordering: Males first, then Females — each group sorted by last name
  const sortByLastName = (a: RosterLearner, b: RosterLearner) =>
    a.lastName.localeCompare(b.lastName);
  const sortedMales = allLearners.filter((l) => l.sex === "MALE").sort(sortByLastName);
  const sortedFemales = allLearners.filter((l) => l.sex !== "MALE").sort(sortByLastName);
  const totalLearners = allLearners.length;

  // ── Program track label (e.g. "STE", "SPA"; omitted for plain BEC) ─────────
  const programTrack =
    section && section.programType !== "REGULAR"
      ? (SCP_SHORT_LABELS[section.programType] ?? section.programType)
      : null;

  // ── Build flat rows array with sex-group dividers (SF1 order) ────────────────
  const rows: TableRow[] = [];
  if (sortedMales.length > 0) {
    rows.push({ _kind: "divider", id: -1, label: "Male", count: sortedMales.length });
    sortedMales.forEach((l, i) =>
      rows.push({ ...l, _kind: "learner", rowIndex: i + 1 }),
    );
  }
  if (sortedFemales.length > 0) {
    rows.push({ _kind: "divider", id: -2, label: "Female", count: sortedFemales.length });
    sortedFemales.forEach((l, i) =>
      rows.push({ ...l, _kind: "learner", rowIndex: sortedMales.length + i + 1 }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          {/* Historical / Archived year badge */}
          {isHistoricalReadOnly && (
            <div className="mb-2.5">
              <Badge variant="secondary" className="text-[10px]">
                {isArchivedYear ? "Archived" : "Historical"} SY {viewingSchoolYearLabel ?? "–"}
              </Badge>
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-wide">
                {loading || !section ? (
                  <Skeleton className="h-5 w-48" />
                ) : (
                  section.name
                )}
              </DialogTitle>
              {loading || !section ? (
                <Skeleton className="h-3.5 w-64 mt-1.5" />
              ) : (
                <p className="text-xs text--foreground mt-1 font-bold">
                  {section.gradeLevel}
                  {programTrack ? ` — ${programTrack}` : ""}
                  {section.advisingTeacher
                    ? ` · Adviser: ${section.advisingTeacher.name}`
                    : ""}
                </p>
              )}
            </div>

            {!loading && section && (
              <div className="flex items-center gap-1 text-xs text--foreground font-bold shrink-0">
                <Users className="size-3.5" />
                <span>{totalLearners}/{section.maxCapacity}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <DataTable
            columns={ROSTER_COLUMNS}
            data={rows}
            loading={loading}
            virtualize={false}
            getRowId={(row) => String(row.id)}
            getRowClassName={(row) =>
              row._kind === "divider" ? "bg-muted/50 pointer-events-none" : ""
            }
            emptyStateContent={
              <div className="flex flex-col items-center justify-center py-16 text--foreground">
                <Users className="size-10 opacity-30 mb-3" />
                <p className="text-sm font-bold">No enrolled learners</p>
                <p className="text-xs mt-1">This section has no active enrollment records.</p>
              </div>
            }
            className="h-auto rounded-none border-0"
          />
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text--foreground font-bold">
            {loading
              ? "Loading roster…"
              : `${totalLearners} learner${totalLearners !== 1 ? "s" : ""} · ${sortedMales.length} male, ${sortedFemales.length} female`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold">
              Close
            </Button>
            <Button
              size="sm"
              disabled={loading || totalLearners === 0 || generatingSf1}
              onClick={() => void handleGenerateSf1()}
              className="text-xs font-bold gap-1.5">
              {generatingSf1 ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-3.5" />
              )}
              Generate SF1
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
