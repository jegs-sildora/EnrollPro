import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { TableSkeleton } from "@/shared/ui/table-skeleton";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import type { RegularSectionBatchPreview } from "./types";

interface PipelineBatchRegularSectionAssignmentProps {
  previewLoading: boolean;
  isBatchProcessing: boolean;
  preview: RegularSectionBatchPreview | null;
  selectedGradeLevelLabel: string | null;
  hasMixedGradeLevels: boolean;
  requiredSlots: number;
  onReloadPreview: () => void;
}

export default function PipelineBatchRegularSectionAssignment({
  previewLoading,
  isBatchProcessing,
  preview,
  selectedGradeLevelLabel,
  hasMixedGradeLevels,
  requiredSlots,
  onReloadPreview,
}: PipelineBatchRegularSectionAssignmentProps) {
  const showSkeleton = useDelayedLoading(previewLoading);
  const summary = preview?.summary;
  const sectionPlans = preview?.sections ?? [];
  const blockedReasonCounts = (preview?.blocked ?? []).reduce<
    Record<string, number>
  >((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
        <p className="text-xs font-bold text-foreground">
          Regular Enrollment Lane
        </p>
        <p className="text-sm font-bold text-foreground">
          Hybrid assignment preview: first 5 sections use homogeneous ranking,
          remaining sections use snake distribution.
        </p>
        <p className="text-xs font-bold text-foreground">
          Selected grade level: {selectedGradeLevelLabel ?? "Not detected"}
        </p>
      </div>

      {hasMixedGradeLevels && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs font-bold text-destructive">
            Mixed grade levels detected. Select applicants from one grade level
            before assigning a section.
          </p>
        </div>
      )}

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-foreground">
            Hybrid Assignment Preview
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={onReloadPreview}
            disabled={
              previewLoading || isBatchProcessing || hasMixedGradeLevels
            }>
            {previewLoading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Regenerate Preview
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded border bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">
              Requested
            </p>
            <p className="text-sm font-bold">{requiredSlots}</p>
          </div>
          <div className="rounded border bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-emerald-700">
              Assignable
            </p>
            <p className="text-sm font-bold text-emerald-700">
              {summary?.assignedCount ?? 0}
            </p>
          </div>
          <div className="rounded border bg-red-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-red-700">
              Blocked
            </p>
            <p className="text-sm font-bold text-red-700">
              {summary?.blockedCount ?? 0}
            </p>
          </div>
          <div className="rounded border bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-amber-700">
              Unassigned
            </p>
            <p className="text-sm font-bold text-amber-700">
              {summary?.unassignedCount ?? 0}
            </p>
          </div>
        </div>

        {showSkeleton ? (
          <TableSkeleton />
        ) : !preview ? (
          <p className="text-xs font-bold text-muted-foreground">
            Generate a preview plan to inspect allocations before commit.
          </p>
        ) : sectionPlans.length === 0 ? (
          <p className="text-xs font-bold text-destructive">
            No regular sections are available for this grade level.
          </p>
        ) : (
          <div className="space-y-2">
            {sectionPlans.map((section) => (
              <div
                key={section.sectionId}
                className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">
                    {section.sectionDisplayName}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      Order {section.sortOrder}
                    </Badge>
                    <Badge
                      variant={
                        section.lane === "HOMOGENEOUS" ? "secondary" : "outline"
                      }
                      className="text-[10px]">
                      {section.lane === "HOMOGENEOUS" ? "Homogeneous" : "Snake"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs font-bold text-muted-foreground">
                  Capacity {section.enrolledCount}/{section.maxCapacity} | Slots
                  before plan: {section.availableSlots} | Planned:{" "}
                  {section.plannedCount} | Remaining: {section.remainingSlots}
                </p>
              </div>
            ))}
          </div>
        )}

        {!previewLoading &&
          preview &&
          Object.keys(blockedReasonCounts).length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 space-y-1">
              <p className="text-xs font-bold text-red-700">Blocked Reasons</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {Object.entries(blockedReasonCounts).map(([reason, count]) => (
                  <p key={reason} className="text-xs font-bold text-red-700">
                    {count}x {reason}
                  </p>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
