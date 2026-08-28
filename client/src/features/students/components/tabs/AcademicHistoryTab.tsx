import { PreviousSchool } from "@/features/enrollment/components/BeefSections";
import { FileBadge2 } from "lucide-react";

interface AcademicHistoryTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any;
}

export function AcademicHistoryTab({ student }: AcademicHistoryTabProps) {
  if (!student) return null;

  return (
    <div className="space-y-6">
      {/* Previous School */}
      <PreviousSchool applicant={student} />

      {/* Historical Final Averages */}
      <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
        <div className="p-3 font-bold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
          <FileBadge2 className="h-4 w-4 text-primary" />
          Historical Academic Record
        </div>
        <div className="text-base leading-tight">
          {student.historicalGrades && student.historicalGrades.length > 0 ? (
            <table className="w-full text-center border-collapse border border-border">
              <thead>
                <tr className="font-bold border-b border-border bg-muted/30">
                  <th className="text-foreground p-3 border-r border-border font-bold text-center">
                    Grade Level
                  </th>
                  <th className="text-foreground p-3 border-r border-border font-bold text-center">
                    Final Gen Ave
                  </th>
                  <th className="text-foreground p-3 font-bold text-center">
                    School Year
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {student.historicalGrades.map((hg: any, idx: number) => (
                  <tr
                    key={idx}
                    className="font-bold border-b border-border last:border-b-0"
                  >
                    <td className="p-3 border-r border-border">{hg.gradeLevel}</td>
                    <td className="p-3 border-r border-border">
                      {hg.genAve != null ? hg.genAve.toFixed(2) : "N/A"}
                    </td>
                    <td className="p-3">{hg.schoolYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-foreground text-center font-bold py-6">
              No historical academic records available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
