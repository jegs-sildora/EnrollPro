import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { BookOpen, AlertCircle, CheckCircle2, Save, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { sileo } from "sileo";

interface RemedialWorkspaceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any;
}

interface Deficiency {
  id: number;
  subject: string;
  grade: number;
  status: string;
}

export function RemedialWorkspace({ student }: RemedialWorkspaceProps) {
  const initialDeficiencies: Deficiency[] = student?.academicDeficiencies?.length > 0 ? student.academicDeficiencies : [
    {
      id: 1,
      subject: "Mathematics",
      grade: 74,
      status: "PENDING_ENROLLMENT",
    },
    {
      id: 2,
      subject: "Science",
      grade: 73,
      status: "ENROLLED",
    },
  ];

  const [deficiencies, setDeficiencies] = useState<Deficiency[]>(initialDeficiencies);
  const [isSaving, setIsSaving] = useState(false);

  const handleEnrollSubject = (id: number) => {
    setDeficiencies((prev) =>
      prev.map((def) => (def.id === id ? { ...def, status: "READY_TO_ENROLL" } : def))
    );
  };

  const handleBatchSave = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setDeficiencies((prev) =>
        prev.map((def) =>
          def.status === "READY_TO_ENROLL" ? { ...def, status: "ENROLLED" } : def
        )
      );
      setIsSaving(false);
      sileo.success({ title: "Success", description: "Back subjects enrolled successfully!" });
    }, 800);
  };

  const pendingCount = deficiencies.filter(d => d.status === "PENDING_ENROLLMENT").length;
  const readyCount = deficiencies.filter(d => d.status === "READY_TO_ENROLL").length;

  return (
    <div className="p-6 h-full flex flex-col bg-background overflow-y-auto">
      <div className="mb-6 w-full flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold uppercase mb-2">Back Subject Assignments</h2>
          <p className="text-muted-foreground font-extrabold max-w-3xl">
            The learner "{student?.fullName}" (LRN: {student?.lrn || 'N/A'}) has been flagged as Conditionally Promoted.
            Please tag the learner to their required back subjects.
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4 pb-20">
        {deficiencies.map((def) => (
          <div key={def.id} className="border rounded-xl p-5 bg-card text-card-foreground shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:border-primary/30">
            
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold uppercase text-lg">{def.subject}</span>
                <span className="text-sm font-extrabold text-muted-foreground mt-1">
                  Final Grade: <span className="text-destructive text-base ml-1">{def.grade}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 flex-1 justify-end">
              <Badge
                variant={def.status === "ENROLLED" ? "default" : "outline"}
                className={cn(
                  "uppercase font-extrabold w-fit px-3 py-1.5 text-sm",
                  def.status === "PENDING_ENROLLMENT" && "text-amber-600 border-amber-600 bg-amber-50",
                  def.status === "READY_TO_ENROLL" && "text-blue-600 border-blue-600 bg-blue-50",
                  def.status === "ENROLLED" && "bg-emerald-600 text-white border-transparent"
                )}
              >
                {def.status === "ENROLLED" ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Enrolled
                  </span>
                ) : def.status === "READY_TO_ENROLL" ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Ready to Enroll
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Action Required
                  </span>
                )}
              </Badge>

              <div className="w-full md:w-56 flex justify-end">
                <Button 
                  onClick={() => handleEnrollSubject(def.id)}
                  disabled={def.status !== "PENDING_ENROLLMENT" || isSaving}
                  variant={def.status === "PENDING_ENROLLMENT" ? "outline" : "secondary"}
                  className="w-full font-extrabold uppercase h-11 border-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Enroll Back Subject
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t flex justify-end z-10 md:absolute">
        <div className="max-w-7xl mx-auto w-full flex justify-end">
          <Button 
            onClick={handleBatchSave} 
            disabled={isSaving || readyCount === 0}
            size="lg"
            className="font-extrabold uppercase w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-12 px-8"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSaving ? "Saving..." : "Commit Batch Assignments"}
          </Button>
        </div>
      </div>
    </div>
  );
}
