import { useMemo } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { CheckCircle2, Loader2, MoreHorizontal } from "lucide-react";
import type {
  ColumnDef,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { BOSYQueueItem } from "../types";
import {
  formatApplicationStatus,
  cn,
  getGradeLevelBadgeStyles,
} from "@/shared/lib/utils";

interface QueueTableProps {
  priorSyLabel: string;
  items: BOSYQueueItem[];
  loading: boolean;
  isSearching?: boolean;
  queueState: "PENDING" | "CONFIRMED" | "TEMPORARY" | "TRANSFER_REQUEST" | "ENROLLED";
  allowActions: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onConfirmSingle: (applicationId: number) => void;
  onTransferRequest: (item: BOSYQueueItem) => void;
  onRevokeConfirmation: (item: BOSYQueueItem) => void;
  onMarkConfirmedTransferOut: (item: BOSYQueueItem) => void;
  confirmingIds: Set<number>;
  busyActionIds: Set<number>;
}

function buildLearnerDisplayName(item: BOSYQueueItem): string {
  return `${item.lastName}, ${item.firstName}${item.middleName ? ` ${item.middleName[0]}.` : ""}`;
}

function formatDeficiencyText(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("Deficiency:") ? value : `Deficiency: ${value}`;
}

function statusBadge(item: BOSYQueueItem) {
  if (item.status === "PENDING_CONFIRMATION")
    return (
      <Badge
        className="rounded-md border-amber-100 bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-700 hover:bg-amber-50">
        Pending
      </Badge>
    );
  if (item.status === "READY_FOR_SECTIONING" && item.isTemporarilyEnrolled)
    return (
      <div className="flex max-w-72 flex-col items-center gap-1.5 text-center">
        <Badge
          className="rounded-md border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 hover:bg-amber-50">
          Temporarily Enrolled
        </Badge>
        {item.missingDocuments.length > 0 && (
          <span className="text-sm font-bold leading-tight text-amber-800">
            Missing: {item.missingDocuments.join(", ")}
          </span>
        )}
      </div>
    );
  if (item.status === "READY_FOR_SECTIONING")
    return (
      <Badge
        className="rounded-md border-blue-700 bg-blue-600 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white hover:bg-blue-600">
        Ready for Section Assignment
      </Badge>
    );
  if (item.status === "ENROLLED" || item.status === "OFFICIALLY_ENROLLED")
    return (
      <Badge
        className="rounded-md border-emerald-700 bg-emerald-600 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white hover:bg-emerald-600">
        Enrolled
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="rounded-md px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide">
      {formatApplicationStatus(item.status)}
    </Badge>
  );
}

function formatAcademicStatusLabel(status: string | null): string {
  if (status === "PROMOTED") return "Promoted";
  if (status === "CONDITIONALLY_PROMOTED") return "Conditionally Promoted";
  if (status === "RETAINED") return "Retained";
  return "—";
}

function formatGenAve(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  return value.toFixed(2);
}

function ActionMenuButton({
  busy,
  disabled,
  label,
  onSelect,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          className="h-9 w-9 rounded-xl border border-border bg-background hover:bg-muted"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="cursor-pointer text-sm font-extrabold"
          onSelect={onSelect}
        >
          {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QueueMobileCard({
  item,
  queueState,
  allowActions,
  selected,
  onSelectionChange,
  onConfirmSingle,
  onTransferRequest,
  onRevokeConfirmation,
  onMarkConfirmedTransferOut,
  confirmingIds,
  busyActionIds,
}: {
  item: BOSYQueueItem;
  queueState: QueueTableProps["queueState"];
  allowActions: boolean;
  selected: boolean;
  onSelectionChange: (checked: boolean) => void;
  onConfirmSingle: (applicationId: number) => void;
  onTransferRequest: (item: BOSYQueueItem) => void;
  onRevokeConfirmation: (item: BOSYQueueItem) => void;
  onMarkConfirmedTransferOut: (item: BOSYQueueItem) => void;
  confirmingIds: Set<number>;
  busyActionIds: Set<number>;
}) {
  const learnerName = buildLearnerDisplayName(item);
  const isConfirming = confirmingIds.has(item.applicationId);
  const isBusy = busyActionIds.has(item.applicationId);
  const genAve = formatGenAve(item.priorYearGenAve);
  const deficiencyText = formatDeficiencyText(item.priorYearDeficiencyNote);

  const primaryAction = (() => {
    if (!allowActions) return null;

    if (queueState === "PENDING" && item.status === "PENDING_CONFIRMATION") {
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-11 w-full rounded-xl border-2 border-primary bg-primary/5 px-4 text-sm font-extrabold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          disabled={isConfirming || isBusy}
          onClick={() => onConfirmSingle(item.applicationId)}>
          {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enroll
        </Button>
      );
    }

    if (
      (queueState === "CONFIRMED" || queueState === "TEMPORARY")
      && item.status === "READY_FOR_SECTIONING"
    ) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-11 w-full rounded-xl border-2 border-amber-500 bg-amber-50 px-4 text-sm font-extrabold text-amber-800 transition-all hover:bg-amber-500 hover:text-white"
          disabled={isBusy}
          onClick={() => onRevokeConfirmation(item)}>
          {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Revoke Confirmation
        </Button>
      );
    }

    return null;
  })();

  const menuAction = (() => {
    if (!allowActions) return null;

    if (queueState === "PENDING" && item.status === "PENDING_CONFIRMATION") {
      return (
        <ActionMenuButton
          busy={isBusy}
          disabled={isConfirming || isBusy}
          label="Tag as Not Returning"
          onSelect={() => onTransferRequest(item)}
        />
      );
    }

    if (
      (queueState === "CONFIRMED" || queueState === "TEMPORARY")
      && item.status === "READY_FOR_SECTIONING"
    ) {
      return (
        <ActionMenuButton
          busy={isBusy}
          disabled={isBusy}
          label="Mark Transfer Out"
          onSelect={() => onMarkConfirmedTransferOut(item)}
        />
      );
    }

    return null;
  })();

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-background p-4 shadow-sm",
        selected && "border-primary bg-primary/5",
      )}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectionChange(checked === true)}
          aria-label={`Select ${learnerName}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p
                className="truncate text-base font-extrabold uppercase leading-tight text-foreground"
                title={learnerName}>
                {learnerName}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("rounded-full px-3 py-1 text-xs font-extrabold", getGradeLevelBadgeStyles(item.gradeLevelName))}>
                  {item.gradeLevelName}
                </Badge>
                {statusBadge(item)}
              </div>
              <p className="truncate text-sm font-bold uppercase text-foreground/80" title={item.lrn ?? "NO LRN"}>
                LRN: {item.lrn ?? "NO LRN"}
              </p>
            </div>
            {menuAction ? (
              <div className="shrink-0">
                {menuAction}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-left">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Last Year Result
              </p>
              <div className="mt-1 flex flex-col items-start gap-1">
                {item.academicStatus ? (
                  <Badge
                    className={cn(
                      "rounded-md border-transparent px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white",
                      item.academicStatus === "PROMOTED"
                        ? "bg-emerald-600 hover:bg-emerald-600"
                        : item.academicStatus === "CONDITIONALLY_PROMOTED"
                          ? "bg-amber-600 hover:bg-amber-600"
                          : "bg-red-600 hover:bg-red-600",
                    )}>
                    {formatAcademicStatusLabel(item.academicStatus)}
                  </Badge>
                ) : (
                  <span className="text-sm font-extrabold text-foreground">—</span>
                )}
                {genAve && item.academicStatus === "PROMOTED" ? (
                  <span className="truncate text-sm font-bold text-foreground" title={`Gen Ave: ${genAve}`}>
                    Gen Ave: {genAve}
                  </span>
                ) : null}
                {deficiencyText ? (
                  <span className="truncate text-sm font-bold text-amber-800" title={deficiencyText}>
                    {deficiencyText}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {primaryAction ? (
            <div className="mt-4">
              {primaryAction}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function QueueTable({
  priorSyLabel,
  items,
  loading,
  isSearching,
  queueState,
  allowActions,
  rowSelection,
  onRowSelectionChange,
  onConfirmSingle,
  onTransferRequest,
  onRevokeConfirmation,
  onMarkConfirmedTransferOut,
  confirmingIds,
  busyActionIds,
}: QueueTableProps) {
  const columns = useMemo<ColumnDef<BOSYQueueItem>[]>(() => {
    const base: ColumnDef<BOSYQueueItem>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
        meta: {
          className: "w-10",
          headerClassName: "w-10",
        },
      },
      {
        id: "learner",
        accessorKey: "lastName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LRN & Learner's Name"
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          const learnerName = buildLearnerDisplayName(r);
          return (
            <div className="flex min-w-0 flex-col py-3 pl-2 text-left leading-tight">
              <span
                className="truncate text-base font-extrabold uppercase leading-tight xl:whitespace-normal"
                title={learnerName}>
                {learnerName}
              </span>
              <span
                className="mt-1 truncate font-bold uppercase text-foreground xl:whitespace-normal"
                title={r.lrn ?? "NO LRN"}>
                LRN: {r.lrn ?? "NO LRN"}
              </span>
            </div>
          );
        },
        size: 420,
        minSize: 260,
        maxSize: 9999,
        meta: {
          className: "min-w-0",
          headerClassName: "min-w-0",
        },
      },
      {
        id: "academicStatus",
        accessorKey: "academicStatus",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Last Year's Result"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const s = row.original.academicStatus;
          const genAve = formatGenAve(row.original.priorYearGenAve);
          const deficiencyText = row.original.priorYearDeficiencyNote;
          if (!s)
            return (
              <div className="py-3 text-center text-base font-extrabold text-foreground">—</div>
            );
          return (
            <div className="flex flex-col items-center gap-1 py-3 text-center">
              <Badge
                className={cn(
                  "rounded-md border-transparent px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white",
                  s === "PROMOTED"
                    ? "bg-emerald-600 hover:bg-emerald-600"
                    : s === "CONDITIONALLY_PROMOTED"
                      ? "bg-amber-600 hover:bg-amber-600"
                      : "bg-red-600 hover:bg-red-600",
                )}
              >
                {formatAcademicStatusLabel(s)}
              </Badge>
              {genAve && s === "PROMOTED" && (
                <span className="max-w-full truncate text-sm font-bold leading-tight text-foreground" title={`Gen Ave: ${genAve}`}>
                  Gen Ave: {genAve}
                </span>
              )}
              {deficiencyText && (
                <span className="max-w-full truncate text-sm font-bold leading-tight text-amber-800" title={formatDeficiencyText(deficiencyText) ?? undefined}>
                  {formatDeficiencyText(deficiencyText)}
                </span>
              )}
            </div>
          );
        },
        size: 210,
        minSize: 170,
        maxSize: 240,
      },
    ];

    base.push({
      id: "actions",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Action"
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const r = row.original;
        const isConfirming = confirmingIds.has(r.applicationId);
        const isBusy = busyActionIds.has(r.applicationId);

        if (!allowActions) {
          return null;
        }

        if (queueState === "PENDING" && r.status === "PENDING_CONFIRMATION") {
          return (
            <div className="flex w-full items-center justify-center gap-2 py-3">
              <Button
                size="sm"
                variant="outline"
                className="h-9 min-w-[150px] cursor-pointer items-center justify-center rounded-xl border-2 border-primary bg-primary/5 px-4 text-sm font-extrabold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
                disabled={isConfirming || isBusy}
                onClick={() => onConfirmSingle(r.applicationId)}>
                {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enroll
              </Button>
              <ActionMenuButton
                busy={isBusy}
                disabled={isConfirming || isBusy}
                label="Tag as Not Returning"
                onSelect={() => onTransferRequest(r)}
              />
            </div>
          );
        }

        if (
          (queueState === "CONFIRMED" || queueState === "TEMPORARY")
          && r.status === "READY_FOR_SECTIONING"
        ) {
          return (
            <div className="flex w-full items-center justify-center gap-2 py-3">
              <Button
                size="sm"
                variant="outline"
                className="h-9 min-w-[150px] cursor-pointer items-center justify-center rounded-xl border-2 border-amber-500 bg-amber-50 px-4 text-sm font-extrabold text-amber-800 transition-all hover:bg-amber-500 hover:text-white"
                disabled={isBusy}
                onClick={() => onRevokeConfirmation(r)}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Revoke Confirmation
              </Button>
              <ActionMenuButton
                busy={isBusy}
                disabled={isBusy}
                label="Mark Transfer Out"
                onSelect={() => onMarkConfirmedTransferOut(r)}
              />
            </div>
          );
        }

        return null;
      },
      size: 220,
      minSize: 200,
      maxSize: 240,
      enableSorting: false,
    });

    return base;
  }, [
    queueState,
    onConfirmSingle,
    onTransferRequest,
    onRevokeConfirmation,
    onMarkConfirmedTransferOut,
    confirmingIds,
    busyActionIds,
    priorSyLabel,
    allowActions,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {isSearching ? (
          <div className="rounded-2xl border border-border bg-background">
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <CheckCircle2 className="h-10 w-10 animate-pulse text-slate-400" />
              <div className="flex flex-col items-center space-y-1">
                <p className="text-lg font-extrabold text-slate-600">Searching...</p>
                <p className="text-sm text-slate-400">Scanning DepEd records...</p>
              </div>
            </div>
          </div>
        ) : items.length > 0 ? (
          items.map((item) => {
            const rowId = String(item.applicationId);
            const selected = Boolean(rowSelection[rowId]);

            return (
              <QueueMobileCard
                key={rowId}
                item={item}
                queueState={queueState}
                allowActions={allowActions}
                selected={selected}
                onSelectionChange={(checked) =>
                  onRowSelectionChange((prev) => ({
                    ...prev,
                    [rowId]: checked,
                  }))
                }
                onConfirmSingle={onConfirmSingle}
                onTransferRequest={onTransferRequest}
                onRevokeConfirmation={onRevokeConfirmation}
                onMarkConfirmedTransferOut={onMarkConfirmedTransferOut}
                confirmingIds={confirmingIds}
                busyActionIds={busyActionIds}
              />
            );
          })
        ) : (
          <div className="rounded-2xl border border-border bg-background">
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-1.5 text-foreground">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-base font-extrabold text-foreground">
                No continuing learners match this intake status.
              </p>
              <p className="px-4 text-center text-sm">
                Select another target grade or check the learner name or LRN.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:flex flex-col flex-1 min-h-0 w-full h-full">
      <DataTable
      containerHeight="100%"
      className="border-x-0 border-b-0 border-t-0 rounded-none h-full flex-1"
      tableClassName="w-full table-fixed"
      emptyStateContent={
        <div className="flex flex-col items-center justify-center min-h-[220px] max-h-[260px] gap-1.5 text-foreground">
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-base font-extrabold text-foreground">
            No continuing learners match this intake status.
          </p>
          <p className="text-sm">
            Select another target grade or check the learner name or LRN.
          </p>
        </div>
      }
      columns={columns}
      data={items}
      getRowId={(row) => String(row.applicationId)}
      forceEmptyState={Boolean(isSearching)}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        prependBodyRow={
          isSearching ? (
          <TableSearchIndicator colSpan={4} />
        ) : null
      }
    />
      </div>
    </>
  );
}
