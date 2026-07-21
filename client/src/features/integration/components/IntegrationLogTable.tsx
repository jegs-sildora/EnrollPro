import { memo } from "react";
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock3,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";

export interface IntegrationLog {
  id: string | number;
  timestamp: string;
  system: string;
  entity: string;
  status: "success" | "failed" | "pending";
  error: string | null;
}

interface IntegrationLogTableProps {
  logs: IntegrationLog[];
  loading: boolean;
  onRetry?: (log: IntegrationLog) => void;
}

export const IntegrationLogTable = memo(function IntegrationLogTable({
  logs,
  loading,
  onRetry,
}: IntegrationLogTableProps) {
  const columns: ColumnDef<IntegrationLog>[] = [
    {
      id: "timestamp",
      accessorKey: "timestamp",
      header: "Timestamp",
      size: 180,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-foreground font-extrabold">
          <Clock3 className="h-3 w-3" />
          {new Date(row.original.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
        </div>
      ),
    },
    {
      id: "system",
      accessorKey: "system",
      header: "Target System",
      size: 120,
      cell: ({ row }) => (
        <Badge variant="outline" className="h-5 text-sm font-extrabold uppercase px-2 border-primary/20 bg-primary/5 text-primary">
          {row.original.system}
        </Badge>
      ),
    },
    {
      id: "entity",
      accessorKey: "entity",
      header: "Entity Identity",
      size: 200,
      cell: ({ row }) => (
        <span className="font-extrabold uppercase text-foreground truncate">
          {row.original.entity}
        </span>
      ),
    },
    {
      id: "report",
      header: "Sync Report",
      size: 350,
      cell: ({ row }) => {
        const { status, error } = row.original;
        if (status === "success") {
          return (
            <div className="flex items-center gap-2 text-emerald-600 font-extrabold uppercase text-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Synchronized Successfully
            </div>
          );
        }
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-600 font-extrabold uppercase text-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              {status === "pending" ? "Awaiting Sync" : "Sync Failed"}
            </div>
            {error && (
              <p className="text-sm font-extrabold text-foreground/80 leading-tight line-clamp-2">
                {error}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      size: 100,
      cell: ({ row }) => (
        <div className="flex justify-center">
          {row.original.status === "failed" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-sm font-extrabold uppercase px-3 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
              onClick={() => onRetry?.(row.original)}
            >
              Retry Sync
            </Button>
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 opacity-40" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-base font-extrabold uppercase text-foreground/70">
          <History className="h-4 w-4 text-primary" />
          Integration Audit & Resolution
        </div>
        <Button variant="ghost" size="sm" className="h-8 font-extrabold uppercase text-sm tracking-widest text-primary">
          Export History
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        className="border-2 rounded-2xl shadow-lg"
        containerHeight="50vh"
        estimatedRowHeight={60}
      />
    </div>
  );
});
