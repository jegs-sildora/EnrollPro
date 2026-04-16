import { Eye } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { STATUS_CONFIG } from "@/features/enrollment/constants";
import { formatScpType } from "@/shared/lib/utils";
import type { Application } from "../hooks/useEarlyRegistrations";

interface CardsProps {
  applications: Application[];
  showSkeleton: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  getNextAction: (status: string) => string;
}

export function EarlyRegistrationCards({
  applications,
  showSkeleton,
  selectedId,
  setSelectedId,
  getNextAction,
}: CardsProps) {
  return (
    <div className="md:hidden space-y-3">
      {showSkeleton ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
        ))
      ) : applications.length === 0 ? (
        <div className="rounded-xl border p-6 text-center text-sm font-bold">
          No applicants found.
        </div>
      ) : (
        applications.map((app) => (
          <div
            key={app.id}
            className={`rounded-xl border bg-[hsl(var(--card))] p-3 transition-colors cursor-pointer ${
              selectedId === app.id
                ? "ring-2 ring-primary/30 border-primary/40"
                : "hover:bg-[hsl(var(--muted))]"
            }`}
            onClick={() => setSelectedId(app.id)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm uppercase leading-tight break-words">
                  {app.lastName}, {app.firstName}
                </p>
                <p className="text-xs font-bold text-muted-foreground truncate">
                  {app.trackingNumber}
                </p>
              </div>
              <p className="text-xs font-bold shrink-0 text-right">
                {STATUS_CONFIG[app.status]?.label ?? app.status}
              </p>
            </div>

            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold">{app.gradeLevel.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatScpType(app.applicantType)}
                </p>
                {app.isPendingLrnCreation && (
                  <p className="text-[11px] font-bold text-amber-700">
                    Pending LRN Creation
                  </p>
                )}
              </div>
              <p className="text-[10px] font-bold shrink-0 text-right">
                {getNextAction(app.status)}
              </p>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground font-bold">
              Submitted{" "}
              {app.createdAt
                ? format(new Date(app.createdAt), "MMMM dd, yyyy")
                : "N/A"}
            </p>

            <Button
              variant="secondary"
              size="sm"
              className="mt-3 h-9 w-full text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(app.id);
              }}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View Applicant
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
