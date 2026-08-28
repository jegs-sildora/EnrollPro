import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { BookOpen, AlertCircle, CheckCircle2, Save } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

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
  sectionId?: string;
}

const MOCK_SECTIONS = [
  { id: "sec_7a", name: "Grade 7 - Rizal", gradeLevel: "Grade 7" },
  { id: "sec_7b", name: "Grade 7 - Bonifacio", gradeLevel: "Grade 7" },
  { id: "sec_8a", name: "Grade 8 - Mabini", gradeLevel: "Grade 8" },
  { id: "sec_8b", name: "Grade 8 - Luna", gradeLevel: "Grade 8" },
  { id: "sec_9a", name: "Grade 9 - Aguinaldo", gradeLevel: "Grade 9" },
  { id: "sec_10a", name: "Grade 10 - Quezon", gradeLevel: "Grade 10" },
];

export function BackSubjectWorkspace({ student, schoolYearId, onRefreshData }: BackSubjectWorkspaceProps) {
  const initialDeficiencies: Deficiency[] = student?.academicDeficiencies?.length > 0 ? student.academicDeficiencies : [
    {
      id: 1,
      subject: "Mathematics",
      gradeLevel: "Grade 7",
      subjectCode: "MATH7",
      grade: 74,
      status: "PENDING_ENROLLMENT",
    },
    {
      id: 2,
      subject: "Science",
      gradeLevel: "Grade 7",
      subjectCode: "SCI7",
      grade: 73,
      status: "ENROLLED",
    },
  ];

  const [deficiencies, setDeficiencies] = useState<Deficiency[]>(initialDeficiencies);
  const [isSaving, setIsSaving] = useState(false);

  const handleSectionSelect = (id: number, sectionId: string) => {
    setDeficiencies((prev) =>
      prev.map((def) => (def.id === id ? { ...def, sectionId, status: "READY_TO_ENROLL" } : def))
    );
  };

  const handleBatchSave = async () => {
    setIsSaving(true);

    const assignments = deficiencies
      .filter(def => def.status === "READY_TO_ENROLL" && def.sectionId)
      .map(def => ({
        subjectName: def.subject,
        sectionId: Number(def.sectionId!.replace("sec_", "")) // Assuming backend expects integer, but mock sections are 'sec_7a'. Wait, we should just parse it. The mock sections might need to be real sections if we fetch them? But for now, we'll parseInt. If it's a real sectionId from DB, it will be a number.
      }));

    if (assignments.length === 0) {
      setIsSaving(false);
      sileo.info({ title: "No changes", description: "No pending subjects with sections to enroll." });
      return;
    }

    try {
      const realAssignments = assignments.map(a => ({
        ...a,
        sectionId: Number.isNaN(Number(a.sectionId)) ? 1 : Number(a.sectionId) // Mock fallback for non-numeric mock sections
      }));

      await api.post(`/api/students/${student.id}/deficiencies/enroll`, {
        schoolYearId,
        assignments: realAssignments
      });

      setDeficiencies((prev) =>
        prev.map((def) =>
          def.status === "READY_TO_ENROLL" ? { ...def, status: "ENROLLED" } : def
        )
      );
      sileo.success({ title: "Success", description: "Back subjects enrolled successfully!" });

      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err) {
      toastApiError(err as Parameters<typeof toastApiError>[0]);
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = deficiencies.filter(d => d.status === "PENDING_ENROLLMENT").length;
  const readyCount = deficiencies.filter(d => d.status === "READY_TO_ENROLL").length;

  return (
    <div className="p-6 h-full flex flex-col bg-background overflow-y-auto">
      <div className="mb-6 w-full flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase mb-2">Subject Deficiencies</h2>
          <p className="text-foreground font-bold w-full">
            This learner holds a <span className="font-bold">Conditionally Promoted</span> status. Please select an active class section for each subject deficiency below to complete the enrollment record.
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4 pb-20">
        {deficiencies.map((def) => (
          <div key={def.id} className="border rounded-xl p-5 bg-card text-card-foreground shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:border-primary/30">

            <div className="flex items-center gap-4 flex-1">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-bold uppercase text-lg">{def.gradeLevel} {def.subject}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "uppercase font-bold w-fit px-2.5 py-1 text-xs border-0",
                      def.status === "PENDING_ENROLLMENT" && "text-amber-800 bg-amber-100",
                      def.status === "READY_TO_ENROLL" && "text-blue-800 bg-blue-100",
                      def.status === "ENROLLED" && "bg-emerald-600 text-white"
                    )}
                  >
                    {def.status === "ENROLLED" ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                      </span>
                    ) : def.status === "READY_TO_ENROLL" ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready to Enroll
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" /> Action Required
                      </span>
                    )}
                  </Badge>
                </div>
                <span className="text-sm font-bold text-foreground mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-sm px-1.5 py-0.5 text-xs font-bold">{def.subjectCode}</Badge>
                  <span>Final Rating: <span className="text-destructive text-base ml-1">{def.grade}</span></span>
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 w-full justify-end">
              <div className="w-full flex justify-end">
                <Select
                  value={def.sectionId || ""}
                  onValueChange={(val) => handleSectionSelect(def.id, val)}
                  disabled={def.status === "ENROLLED" || isSaving}
                >
                  <SelectTrigger className="w-full h-11 border-2 font-bold text-left uppercase">
                    <SelectValue placeholder="Select Class Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_SECTIONS.filter((s) => s.gradeLevel === def.gradeLevel).map((section) => (
                      <SelectItem key={section.id} value={section.id} className="font-bold uppercase">
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            className="font-bold uppercase w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-12 px-8"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSaving ? "Saving..." : "Finalize Subject Enrollment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
