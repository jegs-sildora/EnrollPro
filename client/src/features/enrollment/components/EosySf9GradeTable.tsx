interface Sf9SubjectGrades {
  T1: number | null;
  T2: number | null;
  T3: number | null;
  Final: number | null;
  remarks: string | null;
}

interface Sf9SubjectRow extends Sf9SubjectGrades {
  name: string;
}

interface EosySf9GradeTableProps {
  reportedGrades: Record<string, unknown> | null | undefined;
  finalAverage: number | null;
  schoolYearLabel: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readSubjectGrades(value: unknown): Sf9SubjectGrades | null {
  const subject = asObject(value);
  if (!subject) return null;

  const hasGradeField = [
    "T1",
    "T2",
    "T3",
    "Q1",
    "Q2",
    "Q3",
    "Final",
    "finalRating",
  ].some((key) => key in subject);
  if (!hasGradeField) return null;

  return {
    T1: asFiniteNumber(subject.T1 ?? subject.Q1),
    T2: asFiniteNumber(subject.T2 ?? subject.Q2),
    T3: asFiniteNumber(subject.T3 ?? subject.Q3),
    Final: asFiniteNumber(subject.Final ?? subject.finalRating),
    remarks: typeof subject.remarks === "string" ? subject.remarks : null,
  };
}

function getSubjects(
  reportedGrades: Record<string, unknown> | null | undefined,
): { subjects: Sf9SubjectRow[]; envelopeAverage: number | null } {
  const root = reportedGrades ?? {};
  const envelope = asObject(root.__smartOutcome);
  const issue = asObject(root.__smartSyncIssue);
  const subjectMap = asObject(envelope?.subjects) ?? asObject(issue?.partialSubjects);
  const subjects: Sf9SubjectRow[] = [];

  if (!subjectMap) {
    return { subjects, envelopeAverage: null };
  }

  for (const [subjectName, value] of Object.entries(subjectMap)) {
    const grades = readSubjectGrades(value);
    if (!grades) continue;
    subjects.push({ name: subjectName, ...grades });
  }

  return {
    subjects,
    envelopeAverage: asFiniteNumber(envelope?.finalGeneralAverage),
  };
}

function formatGrade(value: number | null): string {
  return value === null ? "--" : String(value);
}

function getAcademicStanding(averageValue: number | null): string {
  if (averageValue === null) return "--";
  if (averageValue >= 98) return "WITH HIGHEST HONORS";
  if (averageValue >= 95) return "WITH HIGH HONORS";
  if (averageValue >= 90) return "WITH HONORS";
  if (averageValue >= 75) return "PASSED";
  return "FAILED";
}

export function EosySf9GradeTable({
  reportedGrades,
  finalAverage,
  schoolYearLabel,
}: EosySf9GradeTableProps) {
  const { subjects, envelopeAverage } = getSubjects(reportedGrades);
  const displayedAverage = envelopeAverage ?? finalAverage;

  return (
    <div className="bg-muted/20 px-5 py-4 sm:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-bold uppercase text-foreground">
          School Form 9 (SF9) Grades
        </p>
        <span className="rounded-md border border-border bg-card px-3 py-1 text-sm font-bold text-foreground">
          S.Y. {schoolYearLabel}
        </span>
      </div>

      {subjects.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-muted text-foreground uppercase">
              <tr>
                <th rowSpan={2} className="border border-border px-4 py-2 text-center font-bold align-middle">
                  Learning Areas
                </th>
                <th colSpan={3} className="border border-border px-4 py-2 text-center font-bold">
                  Term
                </th>
                <th rowSpan={2} className="border border-border px-4 py-2 text-center font-bold align-middle">
                  Final Grading
                </th>
                <th rowSpan={2} className="border border-border px-4 py-2 text-center font-bold align-middle">
                  Remarks
                </th>
              </tr>
              <tr>
                {[1, 2, 3].map((term) => (
                  <th key={term} className="border border-border px-4 py-2 text-center font-bold">
                    {term}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const remarks = subject.remarks ?? "--";
                return (
                  <tr key={subject.name} className="bg-card">
                    <td className="border border-border px-4 py-3 text-center font-bold text-foreground">
                      {subject.name}
                    </td>
                    <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                      {formatGrade(subject.T1)}
                    </td>
                    <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                      {formatGrade(subject.T2)}
                    </td>
                    <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                      {formatGrade(subject.T3)}
                    </td>
                    <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                      {formatGrade(subject.Final)}
                    </td>
                    <td className="border border-border px-4 py-3 text-center font-bold uppercase">
                      {remarks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="border border-border bg-muted px-4 py-3 text-right text-base font-bold uppercase">
                  General Average:
                </td>
                <td className="border border-border bg-card px-4 py-3 text-center text-base font-bold tabular-nums">
                  {displayedAverage === null ? "--" : displayedAverage.toFixed(2)}
                </td>
                <td className="border border-border bg-card px-4 py-3 text-center text-sm font-bold text-primary">
                  {getAcademicStanding(displayedAverage)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-card px-5 py-8 text-center text-sm font-bold text-muted-foreground">
          No EOSY grades are available for this learner in S.Y. {schoolYearLabel}.
        </div>
      )}
    </div>
  );
}
