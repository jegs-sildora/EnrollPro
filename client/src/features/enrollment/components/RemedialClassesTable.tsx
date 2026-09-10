import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Loader2 } from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"

interface RemedialClass {
  learningAreas: string
  finalRating: number | string
  remedialClassMark?: number | string | null
  conductedFrom?: string | null
  conductedTo?: string | null
  status?: string | null
  outcome?: string | null
}

interface SmartRemedialRecord {
  schoolYear: string
  remedialClasses?: RemedialClass[]
}

interface RemedialClassesResponse {
  activeSchoolYear: string
  previousSchoolYear: string | null
  records: SmartRemedialRecord[]
}

interface RemedialClassesTableProps {
  learnerId: number
  schoolYearId: number
  activeSchoolYearLabel: string
}

function hasEncodedRemedialMark(value: number | string | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  return typeof value === "string" && value.trim().length > 0
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString()
}

export function RemedialClassesTable({
  learnerId,
  schoolYearId,
  activeSchoolYearLabel,
}: RemedialClassesTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["eosy", "remedial-classes", learnerId, schoolYearId],
    queryFn: async () => {
      const response = await api.get<RemedialClassesResponse>(
        `/eosy/learners/${learnerId}/remedial-classes`,
        { params: { schoolYearId } },
      )
      return response.data
    },
    enabled: learnerId > 0 && schoolYearId > 0,
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
          <AlertTitle>Remedial records unavailable</AlertTitle>
          <AlertDescription>EnrollPro could not load the learner&apos;s remedial records from SMART.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const remedialRecords = data?.records ?? []
  if (remedialRecords.length === 0) return null
  const currentSchoolYearLabel = data?.activeSchoolYear ?? activeSchoolYearLabel

  return (
    <div className="border-t border-border bg-muted/20 px-5 py-4 sm:px-8">
      <p className="mb-3 text-base font-bold uppercase text-foreground">
        Remedial Classes (Back Subjects)
      </p>

      <div className="space-y-6">
        {remedialRecords.map((record) => {
          const isCurrentYear = record.schoolYear === currentSchoolYearLabel
          const isMissingPreviousYearMark = !isCurrentYear
            && record.remedialClasses?.some((item) => !hasEncodedRemedialMark(item.remedialClassMark))

          return (
            <div key={record.schoolYear} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block rounded-md border border-border bg-card px-3 py-1 text-sm font-bold text-foreground">
                  S.Y. {record.schoolYear}
                </span>
                {isCurrentYear ? (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                    Current year - does not block finalization
                  </span>
                ) : isMissingPreviousYearMark ? (
                  <span className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-bold text-red-700">
                    Previous year - remedial mark required
                  </span>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="bg-muted uppercase text-foreground">
                    <tr>
                      <th className="border border-border px-4 py-2 text-center font-bold">Learning Area</th>
                      <th className="w-28 border border-border px-4 py-2 text-center font-bold">Final Rating</th>
                      <th className="w-32 border border-border px-4 py-2 text-center font-bold">Remedial Mark</th>
                      <th className="w-32 border border-border px-4 py-2 text-center font-bold">Recomputed</th>
                      <th className="border border-border px-4 py-2 text-center font-bold">Date Conducted</th>
                      <th className="border border-border px-4 py-2 text-center font-bold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.remedialClasses?.map((remedialClass, index) => {
                      const finalRating = Number(remedialClass.finalRating)
                      const remedialMark = hasEncodedRemedialMark(remedialClass.remedialClassMark)
                        ? Number(remedialClass.remedialClassMark)
                        : null
                      const recomputed = remedialMark !== null
                        && Number.isFinite(finalRating)
                        && Number.isFinite(remedialMark)
                        ? Math.round((finalRating + remedialMark) / 2)
                        : null
                      const fromDate = formatDate(remedialClass.conductedFrom)
                      const toDate = formatDate(remedialClass.conductedTo)
                      const dateRange = fromDate && toDate ? `${fromDate} - ${toDate}` : "Pending"
                      const outcome = remedialClass.outcome?.toUpperCase()

                      return (
                        <tr key={`${record.schoolYear}-${remedialClass.learningAreas}-${index}`} className="bg-card">
                          <td className="border border-border px-4 py-3 text-center font-bold text-foreground">
                            {remedialClass.learningAreas}
                          </td>
                          <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                            {remedialClass.finalRating}
                          </td>
                          <td className="border border-border px-4 py-3 text-center font-bold text-blue-600 tabular-nums">
                            {remedialClass.remedialClassMark ?? "--"}
                          </td>
                          <td className="border border-border px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">
                            {recomputed ?? "--"}
                          </td>
                          <td className="border border-border px-4 py-3 text-center font-bold tabular-nums">
                            {dateRange}
                          </td>
                          <td className="border border-border px-4 py-3 text-center font-bold uppercase">
                            {outcome === "PASSED" ? (
                              <span className="text-emerald-600">Passed</span>
                            ) : outcome ? (
                              <span className="text-destructive">Failed</span>
                            ) : (
                              <span className="text-amber-600">Pending</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
