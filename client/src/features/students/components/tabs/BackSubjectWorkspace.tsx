import { Badge } from "@/shared/ui/badge";
import { BookOpen, FileX } from "lucide-react";

interface BackSubjectWorkspaceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any;
  schoolYearId: number;
  onRefreshData?: () => void;
}

interface Deficiency {
  id: number;
  subject: string;
  gradeLevel: string;
  subjectCode: string;
  grade: number;
  status: string;
  schoolYear?: string;
}

export function BackSubjectWorkspace({ student }: BackSubjectWorkspaceProps) {
  const deficiencies: Deficiency[] = student?.academicDeficiencies || [];

  return (
    <div className="p-6 h-full flex flex-col bg-background overflow-y-auto">
      <div className="mb-6 w-full flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase mb-2">Back Subjects Record</h2>
          <p className="text-foreground font-medium w-full">
            This is a historical record of the learner's subject deficiencies from previous school years. Use this for reference when evaluating their Conditionally Promoted status.
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4 pb-20">
        {deficiencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Records Found</h3>
            <p className="text-muted-foreground mt-2 font-medium">
              This learner has no historical subject deficiencies.
            </p>
          </div>
        ) : (
          deficiencies.map((def) => (
            <div key={def.id} className="border rounded-xl p-4 bg-card text-card-foreground shadow-sm grid grid-cols-12 gap-4 items-center transition-all hover:border-primary/30">
              {/* Column 1: Subject Identity */}
              <div className="col-span-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold uppercase text-base leading-tight">{def.gradeLevel} {def.subject}</span>
                  <span className="text-xs font-semibold text-muted-foreground mt-0.5">{def.subjectCode}</span>
                </div>
              </div>

              {/* Column 2: Academic Context */}
              <div className="col-span-3 flex flex-col justify-center pl-4 border-l">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">School Year</span>
                <span className="font-bold text-foreground text-sm">
                  {def.schoolYear ? (def.schoolYear.startsWith("S.Y.") ? def.schoolYear : `S.Y. ${def.schoolYear}`) : "N/A"}
                </span>
              </div>

              {/* Column 3: Academic Result */}
              <div className="col-span-2 flex flex-col items-center justify-center border-l">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Final Rating</span>
                <span className="text-lg font-bold text-destructive leading-tight">{def.grade}</span>
              </div>

              {/* Column 4: Status */}
              <div className="col-span-2 flex items-center justify-end">
                <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 uppercase font-bold border-0 px-2.5 py-1">
                  Unresolved
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
