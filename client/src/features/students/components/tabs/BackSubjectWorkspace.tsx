import { useEffect, useState } from "react";
import { ChevronDown, FileX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type {
  LearnerBackSubjectsResponse,
  SmartBackSubject,
} from "@enrollpro/shared";

import api from "@/shared/api/axiosInstance";

interface BackSubjectWorkspaceProps {
  learnerIdentifier: string;
  schoolYearId: number;
  onAvailabilityChange: (hasBackSubjects: boolean) => void;
}

export function BackSubjectWorkspace({
  learnerIdentifier,
  schoolYearId,
  onAvailabilityChange,
}: BackSubjectWorkspaceProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [subjects, setSubjects] = useState<SmartBackSubject[] | null>(null);
  const [failedSchoolYear, setFailedSchoolYear] = useState<string | null>(null);

  useEffect(() => {
    if (!learnerIdentifier || schoolYearId <= 0) return;

    let cancelled = false;

    void api
      .get<LearnerBackSubjectsResponse>(
        `/students/${encodeURIComponent(learnerIdentifier)}/back-subjects`,
        { params: { schoolYearId } },
      )
      .then((response) => {
        if (cancelled) return;
        const nextSubjects = response.data.learner?.backSubjects ?? [];
        setSubjects(nextSubjects);
        setFailedSchoolYear(response.data.failedSchoolYear);
        onAvailabilityChange(nextSubjects.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [learnerIdentifier, onAvailabilityChange, schoolYearId]);

  const gradeLevelLabel = subjects?.[0]?.gradeLevel.replace("_", " ");

  return (
    <div className="p-6 h-full flex flex-col bg-background overflow-y-auto">
      <div className="w-full flex flex-col gap-4 pb-20">
        {subjects === null ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground animate-pulse">
            Loading SMART back subjects...
          </div>
        ) : subjects.length > 0 ? (
          <div className="mb-2">
            <div
              onClick={() => setIsOpen((current) => !current)}
              className={`w-full bg-card border border-border px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-all duration-200 ${
                isOpen ? "rounded-t-sm border-b-0" : "rounded-sm"
              }`}
            >
              <span className="text-base leading-tight font-bold text-foreground uppercase">
                {gradeLevelLabel ?? "Back Subjects"}
                {failedSchoolYear ? (
                  <>
                    <span aria-hidden="true"> &bull; </span>
                    S.Y. {failedSchoolYear}
                  </>
                ) : null}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ease-in-out ${
                  isOpen ? "rotate-180" : "rotate-0"
                }`}
              />
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="back-subjects-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="border border-border rounded-b-sm overflow-x-auto">
                    <div className="w-full overflow-x-auto whitespace-nowrap">
                      <table className="w-full border-collapse border border-border text-base leading-tight">
                        <thead className="bg-muted text-foreground text-base font-bold uppercase tracking-wide">
                          <tr className="border-b border-border">
                            <th className="border-r border-border px-4 py-2 text-center font-bold">
                              Learning Areas
                            </th>
                            <th className="w-[14%] border-r border-border px-4 py-2 text-center font-bold">
                              Final Rating
                            </th>
                            <th className="w-[14%] border-r border-border px-4 py-2 text-center font-bold">
                              RCM
                            </th>
                            <th className="w-[14%] border-r border-border px-4 py-2 text-center font-bold">
                              RFG
                            </th>
                            <th className="w-[18%] px-4 py-2 text-center font-bold">
                              Outcome
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((subject) => (
                            <tr
                              className="bg-card hover:bg-muted/50 transition-colors"
                              key={subject.subjectCode}
                            >
                              <td className="border border-border px-4 py-3 text-center font-bold uppercase text-foreground">
                                {subject.subjectName}
                              </td>
                              <td className="border border-border px-4 py-3 text-center font-bold uppercase text-foreground">
                                {subject.originalGrade}
                              </td>
                              <td className="border border-border px-4 py-3 text-center font-bold uppercase text-foreground">
                                {subject.remedialMark ?? "--"}
                              </td>
                              <td className="border border-border px-4 py-3 text-center font-bold uppercase text-foreground">
                                {subject.recomputedGrade ?? "--"}
                              </td>
                              <td className="border border-border px-4 py-3 text-center font-bold uppercase text-foreground">
                                {subject.outcome ?? "--"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileX className="h-8 w-8 text-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Records Found</h3>
            <p className="text-muted-foreground mt-2 font-medium">
              No back subject records were found from SMART for this learner.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
