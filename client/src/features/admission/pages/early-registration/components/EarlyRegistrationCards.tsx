import { ArrowRight, Eye, Lock } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { formatScpType } from "@/shared/lib/utils";
import type { Application } from "../hooks/useEarlyRegistrations";

interface CardsProps {
  applications: Application[];
  showSkeleton: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  getNextAction: (status: string) => string;
}

const LOCKED_HANDOFF_STATUS = "READY_FOR_ENROLLMENT";

function resolveHandoffSearchToken(application: Application): string {
  const normalizedLrn = application.lrn?.trim();
  return normalizedLrn && normalizedLrn.length > 0
    ? normalizedLrn
    : application.trackingNumber;
}

export function EarlyRegistrationCards({
  applications,
  showSkeleton,
  selectedId,
  setSelectedId,
  getNextAction,
}: CardsProps) {
  const navigate = useNavigate();

  const orderedApplications = useMemo(() => {
    const unlocked: Application[] = [];
    const locked: Application[] = [];

    for (const application of applications) {
      if (application.status === LOCKED_HANDOFF_STATUS) {
        locked.push(application);
      } else {
        unlocked.push(application);
      }
    }

    return [...unlocked, ...locked];
  }, [applications]);

  const handleNavigateToEnrollment = (application: Application) => {
    const query = new URLSearchParams({
      workflow: "PENDING_VERIFICATION",
      search: resolveHandoffSearchToken(application),
      source: "early-registration",
    });

    navigate(`/monitoring/enrollment?${query.toString()}`);
  };

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
        orderedApplications.map((app) => {
          const isLockedHandoff = app.status === LOCKED_HANDOFF_STATUS;

          return (
            <div
              key={app.id}
              className={`rounded-xl border p-3 transition-colors ${
                isLockedHandoff
                  ? "cursor-default bg-gray-50/80 opacity-70"
                  : "cursor-pointer bg-[hsl(var(--card))]"
              } ${
                selectedId === app.id
                  ? "ring-2 ring-primary/30 border-primary/40"
                  : !isLockedHandoff
                    ? "hover:bg-[hsl(var(--muted))]"
                    : ""
              }`}
              onClick={() => {
                if (!isLockedHandoff) {
                  setSelectedId(app.id);
                }
              }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm uppercase leading-tight break-words">
                    {app.lastName}, {app.firstName}
                  </p>
                  <p className="text-xs font-bold text-muted-foreground truncate">
                    {app.trackingNumber}
                  </p>
                </div>
                {isLockedHandoff ? (
                  <Badge
                    variant="outline"
                    className="h-auto shrink-0 whitespace-normal border-slate-500 bg-slate-100 px-2 py-0.5 text-[10px] font-bold leading-tight text-slate-700">
                    <Lock className="mr-1 h-3 w-3" />
                    Locked: Sent to Enrollment
                  </Badge>
                ) : (
                  <StatusBadge
                    status={app.status}
                    className="text-[10px] px-2 py-0.5 shrink-0"
                  />
                )}
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

              {isLockedHandoff ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-9 w-full border-primary/40 text-xs font-bold text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigateToEnrollment(app);
                  }}>
                  View in Enrollment
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ) : (
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
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
