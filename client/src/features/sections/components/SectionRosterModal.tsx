import { useEffect, useState, useCallback } from "react";
import { FileSpreadsheet, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";

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
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

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
  const learners = data?.learners ?? [];
  const males = learners.filter((l) => l.sex === "MALE").length;
  const females = learners.filter((l) => l.sex !== "MALE").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
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
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  {section.gradeLevel}
                  {section.advisingTeacher
                    ? ` · Adviser: ${section.advisingTeacher.name}`
                    : ""}
                </p>
              )}
            </div>

            {!loading && section && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  <Users className="size-3.5" />
                  <span>{learners.length}/{section.maxCapacity}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  M: {males}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  F: {females}
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded" />
              ))}
            </div>
          ) : learners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="size-10 opacity-30 mb-3" />
              <p className="text-sm font-bold">No enrolled learners</p>
              <p className="text-xs mt-1">This section has no active enrollment records.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-black uppercase tracking-wider text-[10px] w-8">#</th>
                  <th className="px-3 py-2 text-left font-black uppercase tracking-wider text-[10px] w-32">LRN</th>
                  <th className="px-3 py-2 text-left font-black uppercase tracking-wider text-[10px]">NAME</th>
                  <th className="px-3 py-2 text-center font-black uppercase tracking-wider text-[10px] w-10">SEX</th>
                  <th className="px-3 py-2 text-left font-black uppercase tracking-wider text-[10px] w-28">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {learners.map((l, i) => (
                  <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {l.lrn ?? (
                        <span className="italic text-muted-foreground text-[10px]">Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {l.lastName.toUpperCase()},{" "}
                      {l.firstName}
                      {l.middleName ? ` ${l.middleName.charAt(0)}.` : ""}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground font-bold">
                      {l.sex === "MALE" ? "M" : "F"}
                    </td>
                    <td className="px-3 py-2">
                      <EnrollmentBadge status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground font-medium">
            {loading
              ? "Loading roster…"
              : `${learners.length} learner${learners.length !== 1 ? "s" : ""} · ${males} male, ${females} female`}
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
              disabled={loading || learners.length === 0 || generatingSf1}
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
