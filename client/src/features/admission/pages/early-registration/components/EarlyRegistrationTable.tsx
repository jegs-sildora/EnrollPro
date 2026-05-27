import { Eye, Lock } from "lucide-react";
import { useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { formatScpType } from "@/shared/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import type { Application } from "../hooks/useEarlyRegistrations";

interface TableProps {
  applications: Application[];
  loading: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  getNextAction: (status: string, applicantType?: string) => string;
  isSearching?: boolean;
  hideActions?: boolean;
}

function isLockedEnrollmentHandoff(application: Application): boolean {
  return (
    application.status === "READY_FOR_ENROLLMENT" ||
    (application.status === "SUBMITTED_BEEF" &&
      application.applicantType === "REGULAR")
  );
}

export function EarlyRegistrationTable({
  applications,
  loading,
  setSelectedId,
  getNextAction,
  isSearching,
  hideActions = false,
}: TableProps) {
  const orderedApplications = useMemo(() => {
    const unlocked: Application[] = [];
    const locked: Application[] = [];

    for (const application of applications) {
      if (isLockedEnrollmentHandoff(application)) {
        locked.push(application);
      } else {
        unlocked.push(application);
      }
    }

    return [...unlocked, ...locked];
  }, [applications]);

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [
      {
        id: "name",
        accessorKey: "lastName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="NAME"
          />
        ),
        cell: ({ row: tableRow }) => {
          const app = tableRow.original;
          return (
            <span
              className="font-bold text-sm uppercase text-left block min-w-[140px] truncate"
              title={`${app.lastName}, ${app.firstName}`}>
              {app.lastName}, {app.firstName}
            </span>
          );
        },
      },
      {
        id: "trackingNumber",
        accessorKey: "trackingNumber",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="TRACKING #"
          />
        ),
        cell: ({ row: tableRow }) => (
          <span className="text-xs text-foreground font-bold text-center block">
            {tableRow.original.trackingNumber}
          </span>
        ),
      },
      {
        id: "lrn",
        accessorKey: "lrn",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LRN"
          />
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
          <DataTableColumnHeader
            column={column}
            title="GRADE LEVEL"
          />
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
          <DataTableColumnHeader
            column={column}
            title="CURRICULUM PROGRAM"
          />
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
          <DataTableColumnHeader
            column={column}
            title="STATUS"
          />
        ),
        cell: ({ row: tableRow }) => {
          const app = tableRow.original;
          const isLockedHandoff = isLockedEnrollmentHandoff(app);
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
            {getNextAction(
              tableRow.original.status,
              tableRow.original.applicantType,
            )}
          </p>
        ),
      },
      {
        id: "date",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="DATE"
          />
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
          const isLockedHandoff = isLockedEnrollmentHandoff(app);
          return (
            <div className="flex justify-center">
              {isLockedHandoff ? (
                <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Awaiting BEEF
                </span>
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
    return hideActions ? cols.filter((c) => c.id !== "actions") : cols;
  }, [getNextAction, setSelectedId, hideActions]);

  return (
    <div className="hidden md:block">
      <DataTable
        columns={columns}
        data={orderedApplications}
        loading={loading}
        forceEmptyState={Boolean(isSearching)}
        virtualize={true}
        estimatedRowHeight={50}
        onRowClick={(app) => {
          if (!isLockedEnrollmentHandoff(app)) {
            setSelectedId(app.id);
          }
        }}
        noResultsMessage="No applicants found."
        prependBodyRow={isSearching ? <TableSearchIndicator colSpan={9} /> : null}
      />
    </div>
  );
}
