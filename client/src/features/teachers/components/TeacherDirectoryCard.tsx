import { memo } from "react";
import { BookOpen, Users, Eye } from "lucide-react";
import { DEPED_TEACHER_DEPARTMENT_OPTIONS } from "@enrollpro/shared";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { PaginationBar } from "@/shared/components/PaginationBar";
import {
  cn,
} from "@/shared/lib/utils";
import type {
  Teacher,
} from "../types";
import { formatAdvisorySectionSummary, formatDisplayName } from "../utils";

const serviceStatusLabels: Record<Teacher["serviceStatus"], string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  TRANSFERRED: "Transferred",
  RETIRED_RESIGNED: "Retired/Resigned",
  DROPPED_FROM_ROLLS: "Dropped from Rolls",
};

function formatServiceStatus(teacher: Teacher): string {
  if (teacher.serviceStatus && teacher.serviceStatus !== "ACTIVE") {
    return serviceStatusLabels[teacher.serviceStatus];
  }

  return teacher.isActive ? "Active" : "Inactive";
}

function formatJobTitle(value: string): string {
  const romanNumerals = new Set(["I", "II", "III", "IV", "V", "VI"]);

  return value
    .toLocaleLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upperWord = word.toLocaleUpperCase();
      if (romanNumerals.has(upperWord)) {
        return upperWord;
      }

      if (upperWord === "MRF") {
        return upperWord;
      }

      return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function getJobTitle(teacher: Teacher): string {
  if (teacher.plantillaPosition) {
    return formatJobTitle(teacher.plantillaPosition);
  }

  const roles = teacher.userAccount?.roles || [];
  if (roles.includes("SYSTEM_ADMIN")) return "School Head";
  if (roles.includes("HEAD_REGISTRAR")) return "Registrar";
  if (roles.includes("MRF")) return "MRF Staff";
  return "Subject Teacher";
}

interface TeacherDirectoryCardProps {
  showSkeleton: boolean;
  filteredTeachers: Teacher[];
  paginatedTeachers: Teacher[];
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onOpenDetail: (teacher: Teacher) => void;
  controlBar?: React.ReactNode;
}

export const TeacherDirectoryCard = memo(function TeacherDirectoryCard({
  showSkeleton,
  filteredTeachers,
  paginatedTeachers,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onOpenDetail,
  controlBar,
}: TeacherDirectoryCardProps) {


  return (
    <Card className="w-full min-w-0 overflow-hidden shadow-xl border flex flex-col max-h-full min-h-0 rounded-xl">
      {controlBar && (
        <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
          {controlBar}
        </div>
      )}
      <CardContent className="p-0 min-w-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200 flex flex-col flex-1 min-h-0 opacity-100",
          )}>
          <div className="flex flex-col gap-1.5 overflow-y-auto p-4">
            {(showSkeleton) ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm animate-pulse border-r-4 border-r-gray-200">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8 mt-4 md:mt-0 ml-16 md:ml-0 w-full md:w-auto">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              ))
            ) : paginatedTeachers.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed px-4 py-8 text-center text-base leading-tight text-foreground italic font-extrabold">
                No faculty or staff records found.
              </div>
            ) : (
              paginatedTeachers.map((teacher) => (
                <button
                  type="button"
                  key={teacher.id}
                  onClick={() => onOpenDetail(teacher)}
                  aria-label={`View or edit profile for ${teacher.lastName}, ${teacher.firstName}`}
                  className={cn(
                    "group grid w-full grid-cols-1 gap-4 p-4 bg-white border border-gray-200 rounded-4xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer border-l-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 xl:grid-cols-[minmax(260px,1fr)_minmax(420px,1.15fr)_auto] xl:items-center",
                    teacher.isActive ? "border-l-green-500" : "border-l-gray-300"
                  )}>
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="flex items-center justify-center w-12 h-12 text-lg font-extrabold text-primary-foreground rounded-xl bg-primary shadow-sm uppercase shrink-0">
                      {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-primary group-hover:text-slate-700 transition-colors leading-tight truncate uppercase">
                          {formatDisplayName(teacher)}
                        </h3>
                        {formatServiceStatus(teacher) !== "Active" && (
                          <Badge variant="secondary" className="text-[10px] py-0 h-5 shrink-0">
                            {formatServiceStatus(teacher)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-extrabold text-foreground/70 w-full min-w-0">
                        <span className="text-sm uppercase tracking-wider text-foreground/80 whitespace-nowrap shrink-0">
                          {teacher.employeeId ? `Employee ID: ${teacher.employeeId}` : "Employee ID not set"}
                        </span>
                        <span className="hidden sm:inline shrink-0">•</span>
                        <span className="text-primary tracking-wide text-sm font-extrabold uppercase whitespace-nowrap">
                          {(() => {
                            const adv = formatAdvisorySectionSummary(teacher.designation?.advisorySection);
                            return adv !== "-" ? `${adv}` : getJobTitle(teacher);
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-2 mt-2">
                    {teacher.department ? (
                      <Badge variant="outline" className="font-extrabold truncate max-w-full w-fit">
                        <BookOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                        <span className="truncate whitespace-nowrap">
                          {DEPED_TEACHER_DEPARTMENT_OPTIONS.find(opt => opt.value === teacher.department)?.label || teacher.department}
                        </span>
                      </Badge>
                    ) : null}


                  </div>
                  <span className="inline-flex h-9 items-center justify-center rounded-xl border bg-primary/5 px-4 text-sm  text-primary transition-all border-2 border-primary group-hover:bg-primary group-hover:shadow-sm group-hover:text-primary-foreground group-hover:font-extrabold pointer-events-none">
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="shrink-0 border-t">
            <PaginationBar
              page={page}
              total={filteredTeachers.length}
              limit={limit}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
              itemName="Faculty/Staff"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
