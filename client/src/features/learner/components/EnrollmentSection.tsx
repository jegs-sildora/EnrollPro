import { Badge } from "@/shared/ui/badge";
import { GraduationCap, History } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";

import type { LearnerProfile } from "../types";

interface Props {
  learner: LearnerProfile;
}

interface EnrollmentHistoryRow {
  schoolYear: string;
  gradeLevel: string;
  curriculum: string;
  sectionOrSchool: string;
  status: string;
}

export function EnrollmentSection({ learner }: Props) {
  const currentEnrollment = learner.enrollment;

  const formatCurriculumLong = (type?: string | null) => {
    if (!type) return "N/A";
    const normalized = type.toUpperCase().replace(/\s+/g, "_");
    
    if (normalized.includes("SCIENCE_TECHNOLOGY_AND_ENGINEERING")) return "Science, Technology & Engineering (STE)";
    if (normalized.includes("REGULAR")) return "Basic Education Curriculum (BEC)";
    if (normalized.includes("ART")) return "Special Program in the Arts (SPA)";
    if (normalized.includes("SPORTS")) return "Special Program in Sports (SPS)";
    if (normalized.includes("FOREIGN_LANGUAGE")) return "SPFL";
    if (normalized.includes("JOURNALISM")) return "SPJ";
    
    return type;
  };

  const formatCurriculumShort = (type?: string | null) => {
    if (!type) return "N/A";
    const normalized = type.toUpperCase().replace(/\s+/g, "_");
    
    if (normalized.includes("SCIENCE_TECHNOLOGY_AND_ENGINEERING")) return "STE";
    if (normalized.includes("REGULAR")) return "BEC";
    if (normalized.includes("ART")) return "SPA";
    if (normalized.includes("SPORTS")) return "SPS";
    if (normalized.includes("FOREIGN_LANGUAGE")) return "SPFL";
    if (normalized.includes("JOURNALISM")) return "SPJ";
    
    return normalized.length <= 4 ? normalized : normalized.split("_").map(w => w[0]).join("").slice(0, 4);
  };

  const getStatusStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s === "OFFICIALLY_ENROLLED" || s === "ENROLLED" || s === "PASSED") {
      return "bg-green-100 text-green-800 border-green-200";
    }
    if (s === "TEMPORARILY_ENROLLED" || s === "VERIFIED" || s === "PENDING") {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
    if (s === "RETAINED" || s === "FAILED" || s === "DROPPED_OUT") {
      return "bg-red-100 text-red-800 border-red-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const history: EnrollmentHistoryRow[] = [
    {
      schoolYear: learner.schoolYear?.yearLabel || "Current",
      gradeLevel: learner.gradeLevel?.name || "N/A",
      curriculum: formatCurriculumShort(learner.curriculum || currentEnrollment?.curriculum),
      sectionOrSchool: currentEnrollment?.section?.name || "N/A",
      status: learner.status || "ENROLLED",
    },
  ];

  if (learner.lastSchoolName) {
    history.push({
      schoolYear: learner.schoolYearLastAttended || "Previous",
      gradeLevel: learner.lastGradeCompleted || "N/A",
      curriculum: "BEC", // Default fallback for prior schools
      sectionOrSchool: learner.lastSchoolName,
      status: "PRIOR SCHOOL",
    });
  }

  const columns = useMemo<ColumnDef<EnrollmentHistoryRow>[]>(
    () => [
      {
        accessorKey: "schoolYear",
        header: () => <div className="text-center">Year</div>,
        cell: ({ row }) => (
          <span className="font-bold text-xs text-center block">
            {row.original.schoolYear}
          </span>
        ),
      },
      {
        accessorKey: "gradeLevel",
        header: () => <div className="text-center">Grade</div>,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-foreground text-center block">
            {row.original.gradeLevel}
          </span>
        ),
      },
      {
        accessorKey: "curriculum",
        header: () => <div className="text-center">Curriculum</div>,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-primary text-center block">
            {row.original.curriculum}
          </span>
        ),
      },
      {
        accessorKey: "sectionOrSchool",
        header: () => <div className="text-center">Section / School</div>,
        cell: ({ row }) => (
          <span className="text-xs font-bold text-foreground text-center block">
            {row.original.sectionOrSchool}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Status</div>,
        cell: () => (
          <div className="flex justify-center">
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-muted text-foreground uppercase ">
              {learner.status?.replace(/_/g, " ") || "ENROLLED"}
            </span>
          </div>
        ),
      },
    ],
    [learner.status],
  );

  return (
    <div className="space-y-10">
      {/* Current Enrollment */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase  text-primary">
            Academic Status
          </h2>
        </div>

        {currentEnrollment ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground uppercase ">
                Curriculum Track
              </span>
              <span className="text-sm font-bold text-foreground mt-1.5">
                {formatCurriculumLong(learner.curriculum || currentEnrollment?.curriculum)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground uppercase ">
                Grade & Section
              </span>
              <span className="text-sm font-bold text-foreground mt-1.5">
                {learner.gradeLevel?.name || "N/A"} - {currentEnrollment.section?.name || "N/A"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground uppercase ">
                Class Adviser
              </span>
              <span className="text-sm font-bold text-foreground mt-1.5">
                {currentEnrollment.section?.advisingTeacher
                  ? `${currentEnrollment.section.advisingTeacher.lastName}, ${currentEnrollment.section.advisingTeacher.firstName}`
                  : "N/A"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground uppercase ">
                Enrollment Status
              </span>
              <div className="mt-1.5">
                <Badge className={cn(
                  "border font-black uppercase h-6 px-2  text-xs",
                  getStatusStyle(learner.status)
                )}>
                  {learner.status?.replace(/_/g, ' ') || "ENROLLED"}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-muted/50 border border-dashed border-border text-center">
            <p className="text-sm text-foreground font-bold italic">
              No active enrollment record found for the current school year.
            </p>
          </div>
        )}
      </section>

      {/* Enrollment History */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase  text-primary">
            Enrollment History
          </h2>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm font-bold">
          <DataTable
            columns={columns}
            data={history}
            className="border-none rounded-none bg-transparent text-center font-bold"
          />
        </div>
      </section>
    </div>
  );
}
