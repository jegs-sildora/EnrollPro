import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { GraduationCap, BookOpen, Trophy, Minus } from "lucide-react";
import type { AcademicHistoryEntry } from "@/features/learner/types";

interface Props {
  history: AcademicHistoryEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  OFFICIALLY_ENROLLED: "Officially Enrolled",
  ENROLLED: "Enrolled",
  PENDING_REQUIREMENTS: "Pending Requirements",
  READY_FOR_SECTIONING: "Ready for Sectioning",
  PENDING_CONFIRMATION: "Pending Confirmation",
  WITHDRAWN: "Withdrawn",
  DROPPED: "Dropped",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  OFFICIALLY_ENROLLED: "default",
  ENROLLED: "default",
  PENDING_REQUIREMENTS: "secondary",
  READY_FOR_SECTIONING: "secondary",
  PENDING_CONFIRMATION: "outline",
  WITHDRAWN: "destructive",
  DROPPED: "destructive",
};

const EOSY_LABELS: Record<string, string> = {
  PROMOTED: "Promoted",
  RETAINED: "Retained",
  DROPPED: "Dropped",
};

export function AcademicHistorySection({ history }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    history.length > 0 ? String(history[0].id) : "",
  );

  if (history.length === 0) {
    return (
      <div>
        <SectionHeader />
        <p className="text-sm text-foreground mt-4">
          No academic history records found.
        </p>
      </div>
    );
  }

  const selected =
    history.find((e) => String(e.id) === selectedId) ?? history[0];

  return (
    <div>
      <SectionHeader />

      {/* School Year Selector */}
      <div className="mt-4 mb-6 flex items-center gap-3">
        <label className="text-xs font-bold uppercase text-foreground whitespace-nowrap">
          School Year
        </label>
        <Select
          value={selectedId}
          onValueChange={setSelectedId}>
          <SelectTrigger className="w-64 text-sm font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {history.map((entry) => (
              <SelectItem
                key={entry.id}
                value={String(entry.id)}>
                {entry.schoolYear.yearLabel} — {entry.gradeLevel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Record Card */}
      <HistoryCard entry={selected} />
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
        <GraduationCap className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-black uppercase text-foreground tracking-wide">
          Academic History
        </h2>
        <p className="text-xs text-foreground font-bold">
          Enrollment records per school year
        </p>
      </div>
    </div>
  );
}

function HistoryCard({ entry }: { entry: AcademicHistoryEntry }) {
  const statusLabel = STATUS_LABELS[entry.status] ?? entry.status;
  const statusVariant = STATUS_VARIANTS[entry.status] ?? "outline";

  return (
    <div className="rounded-lg border border-border bg-slate-50/60 p-5 space-y-4">
      {/* Grade + SY header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-black uppercase text-sm text-foreground">
            {entry.gradeLevel.name}
          </span>
          <span className="text-xs text-foreground font-bold">
            · {entry.schoolYear.yearLabel}
          </span>
        </div>
        <Badge
          variant={statusVariant}
          className="text-xs font-bold uppercase">
          {statusLabel}
        </Badge>
      </div>

      {/* Applicant type */}
      <Row
        label="Applicant Type"
        value={entry.applicantType}
      />

      {/* Section info */}
      {entry.enrollmentRecord?.section ? (
        <Row
          label="Section"
          value={entry.enrollmentRecord.section.name}
        />
      ) : (
        <div className="flex justify-between items-center py-0.5">
          <span className="text-xs font-bold uppercase text-foreground">
            Section
          </span>
          <span className="text-xs text-foreground italic flex items-center gap-1">
            <Minus className="h-3 w-3" />
            No section record
          </span>
        </div>
      )}

      {/* Final Average */}
      {entry.enrollmentRecord?.finalAverage != null ? (
        <Row
          label="Final Average"
          value={Number(entry.enrollmentRecord.finalAverage).toFixed(2)}
          highlight
        />
      ) : null}

      {/* EOSY Status */}
      {entry.enrollmentRecord?.eosyStatus ? (
        <div className="flex justify-between items-center py-0.5">
          <span className="text-xs font-bold uppercase text-foreground">
            Year-End Status
          </span>
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-bold uppercase text-foreground">
              {EOSY_LABELS[entry.enrollmentRecord.eosyStatus] ??
                entry.enrollmentRecord.eosyStatus}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs font-bold uppercase text-foreground">
        {label}
      </span>
      <span
        className={
          highlight
            ? "text-sm font-black text-primary"
            : "text-xs font-bold text-foreground"
        }>
        {value}
      </span>
    </div>
  );
}
