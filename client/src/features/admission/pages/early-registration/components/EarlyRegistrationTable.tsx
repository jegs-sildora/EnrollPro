import { ArrowRight, Eye, Lock } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { formatScpType } from "@/shared/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import type { Application } from "../hooks/useEarlyRegistrations";

interface TableProps {
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

export function EarlyRegistrationTable({
  applications,
  showSkeleton,
  selectedId: _selectedId,
  setSelectedId,
  getNextAction,
}: TableProps) {
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

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    return [
      {
        id: "applicant",
        accessorKey: "lastName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="APPLICANT" />
        ),
        cell: ({ row: tableRow }) => {
          const app = tableRow.original;
          return (
            <div className="flex min-w-0 flex-col text-left pl-1">
              <span
                className="font-bold text-sm uppercase whitespace-nowrap truncate"
                title={`${app.lastName}, ${app.firstName}`}>
                {app.lastName}, {app.firstName}
              </span>
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                {app.trackingNumber}
              </span>
            </div>
          );
        },
      },
      {
        id: "lrn",
        accessorKey: "lrn",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="LRN" />
        ),
        cell: ({ row: tableRow }) => (
          <span className="font-bold text-sm">
            {tableRow.original.isPendingLrnCreation
              ? "PENDING"
              : tableRow.original.lrn || "N/A"}
          </span>
        ),
      },
      {
        id: "gradeLevel",
        accessorKey: "gradeLevel.name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="GRADE LEVEL" />
        ),
        cell: ({ row: tableRow }) => (
          <span className="font-bold text-sm">
            {tableRow.original.gradeLevel.name}
          </span>
        ),
      },
      {
        id: "applicantType",
        accessorKey: "applicantType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="CURRICULUM PROGRAM" />
        ),
        cell: ({ row: tableRow }) => (
          <p className="font-bold text-xs leading-tight text-center">
            {formatScpType(tableRow.original.applicantType)}
          </p>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="STATUS" />
        ),
        cell: ({ row: tableRow }) => {
          const app = tableRow.original;
          const isLockedHandoff = app.status === LOCKED_HANDOFF_STATUS;
          return (
            <div className="flex justify-center">
              {isLockedHandoff ? (
                <Badge
                  variant="outline"
                  className="h-auto min-w-24 whitespace-normal text-center leading-tight justify-center border-slate-500 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  <Lock className="mr-1 h-3 w-3" />
                  Locked: Sent to Enrollment
                </Badge>
              ) : (
                <StatusBadge
                  status={app.status}
                  className="text-[11px] px-2.5 py-0.5 min-w-24"
                />
              )}
            </div>
          );
        },
      },
      {
        id: "nextAction",
        header: "NEXT ACTION",
        cell: ({ row: tableRow }) => (
          <p className="text-xs font-bold text-center">
            {getNextAction(tableRow.original.status)}
          </p>
        ),
      },
      {
        id: "date",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="DATE" />
        ),
        cell: ({ row: tableRow }) => (
          <span className="text-sm font-bold block text-center">
            {tableRow.original.createdAt
              ? format(new Date(tableRow.original.createdAt), "MMMM dd, yyyy")
              : "N/A"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        cell: ({ row: tableRow }) => {
          const app = tableRow.original;
          const isLockedHandoff = app.status === LOCKED_HANDOFF_STATUS;
          return (
            <div className="flex justify-center">
              {isLockedHandoff ? (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="h-8 px-0 text-xs font-bold text-primary">
                  <a href="/monitoring/enrollment">
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    View in Enrollment
                  </a>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(app.id);
                  }}>
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>
              )}
            </div>
          );
        },
      },
    ];
  }, [getNextAction, setSelectedId, handleNavigateToEnrollment]);

  return (
    <div className="hidden md:block">
      <DataTable
        columns={columns}
        data={orderedApplications}
        loading={showSkeleton}
        onRowClick={(app) => {
          if (app.status !== LOCKED_HANDOFF_STATUS) {
            setSelectedId(app.id);
          }
        }}
        noResultsMessage="No applicants found."
      />
    </div>
  );
}
