import { memo } from "react";
import { BookOpen, Users } from "lucide-react";
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
import { formatAdvisorySectionSummary } from "../utils";

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
          <div className="flex flex-col gap-3 mt-4 overflow-y-auto p-4">
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
              <div className="rounded-xl border-2 border-dashed px-4 py-8 text-center text-base leading-tight text-foreground italic font-bold">
                No teachers found.
              </div>
            ) : (
              paginatedTeachers.map((teacher) => (
                  <div
                  key={teacher.id}
                  onClick={() => onOpenDetail(teacher)}
                  className={cn(
                    "group flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer border-l-4",
                    teacher.isActive ? "border-l-green-500" : "border-l-gray-300"
                  )}>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 text-lg font-black text-primary-foreground rounded-xl bg-primary shadow-sm uppercase shrink-0">
                      {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors uppercase leading-none">
                          {teacher.lastName}, {teacher.firstName}
                        </h3>
                        {!teacher.isActive && (
                           <Badge variant="secondary" className="text-[10px] py-0 h-5">INACTIVE</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground/70">
                        <span className="bg-muted px-2 py-0.5 rounded text-xs uppercase tracking-wider text-foreground/80">ID: {teacher.employeeId || "N/A"}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-primary uppercase tracking-wide text-xs">
                          {teacher.plantillaPosition || 
                            (() => {
                              const roles = teacher.userAccount?.roles || [];
                              if (roles.includes("SYSTEM_ADMIN")) return "SCHOOL HEAD";
                              if (roles.includes("HEAD_REGISTRAR")) return "REGISTRAR";
                              if (roles.includes("MRF")) return "MRF STAFF";
                              return "SUBJECT TEACHER";
                            })()
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 mt-4 md:mt-0 ml-16 md:ml-0 max-w-full md:max-w-[50%]">
                    {teacher.department ? (
                       <Badge variant="outline" className="font-bold truncate max-w-[200px]">
                         <BookOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                         <span className="truncate">
                           {DEPED_TEACHER_DEPARTMENT_OPTIONS.find(opt => opt.value === teacher.department)?.label || teacher.department}
                         </span>
                       </Badge>
                    ) : null}

                    {(() => {
                        const advisory = formatAdvisorySectionSummary(teacher);
                        if (advisory !== "-") {
                          return (
                            <Badge variant="secondary" className="font-bold truncate max-w-[200px]">
                              <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                              <span className="truncate">Adviser: {advisory}</span>
                            </Badge>
                          );
                        }
                        return null;
                    })()}

                  </div>
                </div>
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
              itemName="Personnel"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
