import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface SubjectGrades {
  T1?: number | null;
  T2?: number | null;
  T3?: number | null;
  Q1?: number | null;
  Q2?: number | null;
  Q3?: number | null;
  Q4?: number | null;
  Final?: number | null;
  term1?: number | null;
  term2?: number | null;
  term3?: number | null;
  remarks?: string | null;
}

export interface AcademicHistory {
  grade_level: string;
  section_name?: string | null;
  school_year: string;
  status: string;
  term_format?: string | null;
  grades: Record<string, SubjectGrades> | null;
  general_average: number | null;
}

export const DEPED_JHS_CORE_SUBJECTS = [
  "Filipino",
  "English",
  "Mathematics",
  "Science",
  "Araling Panlipunan",
  "Edukasyon sa Pagpapakatao",
  "Technology and Livelihood Education",
  "MAPEH",
];

export function AcademicHistoryAccordion({
  history,
  isDefaultOpen,
}: {
  history: AcademicHistory;
  isDefaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);
  const isTrimester = history.term_format === "TRIMESTER" || history.term_format !== "QUARTERS";

  const hasGrades = history.grades && Object.keys(history.grades).length > 0;

  const getCombinedLearningArea = (subjectName: string): "Science" | "TLE" | null => {
    const normalized = subjectName.trim().toLowerCase();
    if (
      normalized === "science" ||
      /^science \d+$/.test(normalized) ||
      normalized.startsWith("science - ")
    ) {
      return "Science";
    }
    if (
      normalized === "tle" ||
      /^tle \d+$/.test(normalized) ||
      normalized === "technology and livelihood education" ||
      normalized.startsWith("tle - ") ||
      normalized.startsWith("tle exploratory - ")
    ) {
      return "TLE";
    }
    return null;
  };

  const isDirectLearningArea = (subjectName: string, area: "Science" | "TLE"): boolean => {
    const normalized = subjectName.trim().toLowerCase();
    return area === "Science"
      ? normalized === "science" || /^science \d+$/.test(normalized)
      : normalized === "tle" || /^tle \d+$/.test(normalized) || normalized === "technology and livelihood education";
  };

  const averageGrades = (grades: SubjectGrades[]): SubjectGrades => {
    const average = (values: Array<number | null | undefined>): number | null => {
      const numericValues = values.filter((value): value is number => typeof value === "number");
      return numericValues.length > 0
        ? Math.round(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length)
        : null;
    };

    // SMART's API merges rotation subjects (like Science and TLE) into a single unified grade across all terms.
    let unifiedGrade = average(grades.map((grade) => grade.Final));
    if (unifiedGrade === null) {
      // Fallback: average all available terms across all components if Final is missing
      const allTermGrades = grades.flatMap(g => [g.T1 ?? g.term1 ?? g.Q1, g.T2 ?? g.term2 ?? g.Q2, g.T3 ?? g.term3 ?? g.Q3]);
      unifiedGrade = average(allTermGrades);
    }

    return {
      T1: unifiedGrade,
      T2: unifiedGrade,
      T3: unifiedGrade,
      Q4: unifiedGrade,
      Final: unifiedGrade,
      remarks: unifiedGrade !== null ? (unifiedGrade >= 75 ? "Passed" : "Failed") : null,
    };
  };

  const subjectsToRender: string[] = hasGrades ? [] : DEPED_JHS_CORE_SUBJECTS;
  const processedGrades: Record<string, SubjectGrades> = {};

  if (hasGrades) {
    const combinedComponents: Record<"Science" | "TLE", SubjectGrades[]> = {
      Science: [],
      TLE: [],
    };
    const directLearningAreas: Partial<Record<"Science" | "TLE", SubjectGrades>> = {};

    for (const [subjectName, subjectGrades] of Object.entries(history.grades!)) {
      const combinedArea = getCombinedLearningArea(subjectName);
      if (!combinedArea) {
        subjectsToRender.push(subjectName);
        processedGrades[subjectName] = subjectGrades;
        continue;
      }

      if (isDirectLearningArea(subjectName, combinedArea)) {
        directLearningAreas[combinedArea] = subjectGrades;
      } else {
        combinedComponents[combinedArea].push(subjectGrades);
      }
    }

    for (const combinedArea of ["Science", "TLE"] as const) {
      const directGrades = directLearningAreas[combinedArea];
      const componentGrades = combinedComponents[combinedArea];
      if (directGrades) {
        processedGrades[combinedArea] = directGrades;
        subjectsToRender.push(combinedArea);
      } else if (componentGrades.length > 0) {
        processedGrades[combinedArea] = averageGrades(componentGrades);
        subjectsToRender.push(combinedArea);
      }
    }
  }

  const getSubjectGrades = (subjectName: string): SubjectGrades | null => {
    if (processedGrades[subjectName]) return processedGrades[subjectName];
    const matchKey = Object.keys(processedGrades).find(
      (key) => key.trim().toLowerCase() === subjectName.trim().toLowerCase()
    );
    return matchKey ? (processedGrades[matchKey] ?? null) : null;
  };

  const getAcademicHonors = (average: number | null | undefined): string => {
    if (average === null || average === undefined) return "—";
    const num = Number(average);
    if (num >= 98 && num <= 100) return "WITH HIGHEST HONORS";
    if (num >= 95 && num <= 97) return "WITH HIGH HONORS";
    if (num >= 90 && num <= 94) return "WITH HONORS";
    if (num >= 75) return "PASSED";
    return "FAILED";
  };

  const formatVal = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === "") return "—";
    return String(val);
  };

  return (
    <div className="mb-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-card border border-border px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-all duration-200 ${isOpen ? "rounded-t-sm border-b-0" : "rounded-sm"
          }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-tight font-bold text-foreground uppercase">
            {history.grade_level}{history.section_name ? ` - ${history.section_name}` : ''} &bull; S.Y. {history.school_year}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ease-in-out ${isOpen ? "rotate-180" : "rotate-0"
            }`}
        />
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
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
                      <th rowSpan={2} className="px-4 py-2 text-center font-bold align-middle border-r border-border">Learning Areas</th>
                      <th colSpan={isTrimester ? 3 : 4} className="px-4 py-2 text-center font-bold border-r border-border">
                        {isTrimester ? "Term Rating" : "Quarter Rating"}
                      </th>
                      <th rowSpan={2} className="px-4 py-2 text-center font-bold align-middle border-r border-border">Final Rating</th>
                      <th rowSpan={2} className="px-4 py-2 text-center font-bold align-middle">Remarks</th>
                    </tr>
                    <tr>
                      <th className="px-4 py-1.5 text-center font-bold border-r border-border">1</th>
                      <th className="px-4 py-1.5 text-center font-bold border-r border-border">2</th>
                      <th className="px-4 py-1.5 text-center font-bold border-r border-border">3</th>
                      {!isTrimester && (
                        <th className="px-4 py-1.5 text-center font-bold border-r border-border">4</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsToRender.map((subject) => {
                      const subjectGrades = getSubjectGrades(subject);
                      const term1 = formatVal(isTrimester ? (subjectGrades?.T1 ?? subjectGrades?.term1 ?? subjectGrades?.Q1) : (subjectGrades?.Q1 ?? subjectGrades?.T1));
                      const term2 = formatVal(isTrimester ? (subjectGrades?.T2 ?? subjectGrades?.term2 ?? subjectGrades?.Q2) : (subjectGrades?.Q2 ?? subjectGrades?.T2));
                      const term3 = formatVal(isTrimester ? (subjectGrades?.T3 ?? subjectGrades?.term3 ?? subjectGrades?.Q3) : (subjectGrades?.Q3 ?? subjectGrades?.T3));
                      const term4 = !isTrimester ? formatVal(subjectGrades?.Q4) : null;
                      const finalRating = formatVal(subjectGrades?.Final);
                      const remarks = subjectGrades?.remarks || (subjectGrades?.Final !== null && subjectGrades?.Final !== undefined ? (Number(subjectGrades.Final) >= 75 ? "Passed" : "Failed") : "—");

                      return (
                        <tr key={subject} className="bg-card hover:bg-muted/50 transition-colors">
                          <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">{subject}</td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">{term1}</td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">{term2}</td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">{term3}</td>
                          {!isTrimester && (
                            <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">{term4}</td>
                          )}
                          <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">
                            {finalRating}
                          </td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-bold uppercase">
                            {remarks}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border border-border text-lg">
                    <tr>
                      <td colSpan={isTrimester ? 4 : 5} className="text-right pr-4 font-bold uppercase bg-muted border border-border text-foreground uppercase">General Average:</td>
                      <td className="text-center font-bold bg-card border border-border text-lg text-foreground">
                        {formatVal(history.general_average)}
                      </td>
                      <td className="bg-card border border-border text-center text-base text-primary font-bold">
                        {getAcademicHonors(history.general_average)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
