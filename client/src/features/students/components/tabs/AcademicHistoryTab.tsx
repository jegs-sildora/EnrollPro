import { PreviousSchool } from "@/features/enrollment/components/BeefSections";
import { FileBadge2 } from "lucide-react";
import { AcademicHistoryAccordion } from "@/shared/components/AcademicHistoryAccordion";
import type { AcademicHistory } from "@/shared/components/AcademicHistoryAccordion";

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
          Official School Form 9 (SF9) - Historical Academic Records
        </div>
        <div className="text-base leading-tight bg-muted/10 p-4">
          {student.academicHistory && student.academicHistory.length > 0 ? (
            <div className="flex flex-col gap-4">
              {student.academicHistory.map((history: AcademicHistory, idx: number) => (
                <AcademicHistoryAccordion
                  key={idx}
                  history={history}
                  isDefaultOpen={idx === 0}
                />
              ))}
            </div>
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
