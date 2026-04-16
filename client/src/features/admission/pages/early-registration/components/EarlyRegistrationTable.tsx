import { Eye } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Skeleton } from "@/shared/ui/skeleton";
import { STATUS_CONFIG } from "@/features/enrollment/constants";
import { formatScpType } from "@/shared/lib/utils";
import type { Application } from "../hooks/useEarlyRegistrations";

interface TableProps {
  applications: Application[];
  showSkeleton: boolean;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  getNextAction: (status: string) => string;
}

export function EarlyRegistrationTable({
  applications,
  showSkeleton,
  selectedId,
  setSelectedId,
  getNextAction,
}: TableProps) {
  return (
    <div className="hidden md:block rounded-xl border overflow-hidden">
      <Table className="border-collapse">
        <TableHeader className="bg-[hsl(var(--primary))]">
          <TableRow>
            <TableHead className="text-center font-bold text-primary-foreground text-sm">
              APPLICANT
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground hidden md:table-cell text-sm">
              LRN
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground text-sm">
              GRADE LEVEL
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground hidden lg:table-cell text-sm">
              CURRICULUM PROGRAM
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground text-sm">
              STATUS
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground hidden lg:table-cell text-sm">
              NEXT ACTION
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground hidden xl:table-cell text-sm">
              DATE
            </TableHead>
            <TableHead className="text-center font-bold text-primary-foreground text-sm">
              ACTIONS
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSkeleton ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-sm">
                  <div className="space-y-2 text-center flex flex-col items-center">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-16" />
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex justify-center">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell text-sm">
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex justify-center">
                    <Skeleton className="h-8 w-16" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : applications.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="h-24 text-center text-sm font-bold">
                No applicants found.
              </TableCell>
            </TableRow>
          ) : (
            applications.map((app) => (
              <TableRow
                key={app.id}
                className={`hover:bg-[hsl(var(--muted))] transition-colors text-center cursor-pointer text-sm ${selectedId === app.id ? "bg-[hsl(var(--muted))] shadow-inner" : ""}`}
                onClick={() => setSelectedId(app.id)}>
                <TableCell>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-sm uppercase">
                      {app.lastName}, {app.firstName}
                    </span>
                    <span className="text-xs font-bold">
                      {app.trackingNumber}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm font-bold">
                  {app.isPendingLrnCreation ? "PENDING" : app.lrn || "N/A"}
                </TableCell>
                <TableCell>
                  <span className="font-bold text-sm">
                    {app.gradeLevel.name}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <p className="font-bold text-xs leading-tight text-center">
                    {formatScpType(app.applicantType)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-xs font-bold text-center">
                    {STATUS_CONFIG[app.status]?.label ?? app.status}
                  </p>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <p className="text-xs font-bold text-center">
                    {getNextAction(app.status)}
                  </p>
                </TableCell>
                <TableCell className=" text-sm hidden xl:table-cell font-bold">
                  {app.createdAt
                    ? format(new Date(app.createdAt), "MMMM dd, yyyy")
                    : "N/A"}
                </TableCell>

                <TableCell className="text-center">
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
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
