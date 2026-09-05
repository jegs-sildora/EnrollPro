import { useQuery } from "@tanstack/react-query"
import { Loader2, AlertCircle } from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"

interface RemedialClass {
  learningAreas: string
  finalRating: number | string
  remedialClassMark?: number | string
  conductedFrom?: string
  conductedTo?: string
  status: string
  outcome?: string
}

interface AcademicHistoryItem {
  school_year: string
  status?: string
  remedialClasses: RemedialClass[] | null
}

interface StudentDetail {
  student: {
    academicHistory?: AcademicHistoryItem[]
  }
}

interface RemedialClassesTableProps {
  learnerId: number
  activeSchoolYearLabel: string
}

export function RemedialClassesTable({ learnerId, activeSchoolYearLabel: _activeSchoolYearLabel }: RemedialClassesTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-detail-remedial", learnerId],
    queryFn: async () => {
      const response = await api.get<StudentDetail>(`/students/${learnerId}`)
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading remedial records...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load remedial records from SMART.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const remedialRecords = data?.student?.academicHistory?.filter(h => {
    const isConditional = h.status && typeof h.status === 'string' && h.status.toUpperCase().includes("CONDITIONALLY");
    const hasRemedial = h.remedialClasses && h.remedialClasses.length > 0;
    return isConditional || hasRemedial;
  }) || []

  if (remedialRecords.length === 0) {
    return null 
  }

  return (
    <div className="bg-muted/20 px-5 py-4 sm:px-8 border-t border-border">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-bold uppercase text-foreground">
          Remedial Classes (Back Subjects)
        </p>
      </div>
      
      <div className="space-y-6">
        {remedialRecords.map((record) => (
          <div key={record.school_year} className="space-y-3">
            {remedialRecords.length > 1 && (
              <span className="rounded-md border border-border bg-card px-3 py-1 text-sm font-bold text-foreground inline-block">
                S.Y. {record.school_year}
              </span>
            )}
            
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-muted text-foreground uppercase">
                  <tr>
                    <th className="border border-border px-4 py-2 text-center font-bold">Learning Area</th>
                    <th className="border border-border px-4 py-2 text-center font-bold w-28">Final Rating</th>
                    <th className="border border-border px-4 py-2 text-center font-bold w-32">Remedial Mark</th>
                    <th className="border border-border px-4 py-2 text-center font-bold w-32">Recomputed</th>
                    <th className="border border-border px-4 py-2 text-center font-bold">Date Conducted</th>
                    <th className="border border-border px-4 py-2 text-center font-bold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {record.remedialClasses?.map((rc, idx) => {
                    const final = Number(rc.finalRating)
                    const mark = rc.remedialClassMark ? Number(rc.remedialClassMark) : null
                    const recomputed = mark !== null && !isNaN(final) && !isNaN(mark) 
                      ? Math.round((final + mark) / 2) 
                      : null
                    
                    const fromDate = rc.conductedFrom ? new Date(rc.conductedFrom).toLocaleDateString() : ""
                    const toDate = rc.conductedTo ? new Date(rc.conductedTo).toLocaleDateString() : ""
                    const dateStr = fromDate && toDate ? `${fromDate} - ${toDate}` : ""

                    return (
                      <tr key={idx} className="bg-card">
                        <td className="border border-border px-4 py-3 text-center font-bold text-foreground">
                          {rc.learningAreas}
                        </td>
                        <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                          {rc.finalRating}
                        </td>
                        <td className="border border-border px-4 py-3 text-center font-bold text-blue-600 tabular-nums">
                          {rc.remedialClassMark || "--"}
                        </td>
                        <td className="border border-border px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">
                          {recomputed || "--"}
                        </td>
                        <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                          {dateStr || "Pending"}
                        </td>
                        <td className="border border-border px-4 py-3 text-center font-bold uppercase">
                          {rc.status === "PENDING" ? (
                            <span className="text-amber-600">
                              Pending
                            </span>
                          ) : rc.outcome === "PASSED" ? (
                            <span className="text-emerald-600">
                              Passed
                            </span>
                          ) : (
                            <span className="text-destructive">
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {(!record.remedialClasses || record.remedialClasses.length === 0) && (
                    <tr className="bg-card">
                      <td colSpan={6} className="border border-border px-4 py-8 text-center text-sm font-bold text-muted-foreground">
                        No remedial subjects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
