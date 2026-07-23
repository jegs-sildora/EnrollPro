import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { CalendarCheck2, ShieldCheck } from "lucide-react"
import { sileo } from "sileo"
import api from "@/shared/api/axiosInstance"
import { toastApiError } from "@/shared/hooks/useApiToast"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { AdminPinInput } from "@/shared/components/AdminPinInput"
import {
  getRolloverReadiness,
  type RolloverReadinessPayload,
} from "../api/system.api"
import { useSettingsStore } from "@/store/settings.slice"

interface AtomicRolloverDialogProps {
  sourceSchoolYearId: number
  sourceYearLabel: string
  disabled: boolean
}

interface CalendarPolicy {
  id: number
  status: "DRAFT" | "APPROVED" | "APPLIED"
}

interface CalendarFields {
  depedIssuance: string
  sourceUrl: string
  classOpeningDate: string
  classEndDate: string
  enrollOpenDate: string
  enrollCloseDate: string
  termFormat: "TRIMESTER" | "QUARTERS"
  term1Start: string
  term1End: string
  term2Start: string
  term2End: string
  term3Start: string
  term3End: string
  term4Start: string
  term4End: string
}

const EMPTY_CALENDAR: CalendarFields = {
  depedIssuance: "",
  sourceUrl: "",
  classOpeningDate: "",
  classEndDate: "",
  enrollOpenDate: "",
  enrollCloseDate: "",
  termFormat: "QUARTERS",
  term1Start: "",
  term1End: "",
  term2Start: "",
  term2End: "",
  term3Start: "",
  term3End: "",
  term4Start: "",
  term4End: "",
}

function nextYearLabel(label: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(label)
  if (!match) return ""
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
}

export function AtomicRolloverDialog({
  sourceSchoolYearId,
  sourceYearLabel,
  disabled,
}: AtomicRolloverDialogProps) {
  const navigate = useNavigate()
  const setSettings = useSettingsStore((state) => state.setSettings)
  const targetYearLabel = useMemo(
    () => nextYearLabel(sourceYearLabel),
    [sourceYearLabel],
  )
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<CalendarFields>(EMPTY_CALENDAR)
  const [policy, setPolicy] = useState<CalendarPolicy | null>(null)
  const [readiness, setReadiness] =
    useState<RolloverReadinessPayload | null>(null)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)

  const requiredDates = [
    fields.classOpeningDate,
    fields.classEndDate,
    fields.term1Start,
    fields.term1End,
    fields.term2Start,
    fields.term2End,
    fields.term3Start,
    fields.term3End,
    ...(fields.termFormat === "QUARTERS"
      ? [fields.term4Start, fields.term4End]
      : []),
  ]
  const calendarComplete =
    fields.depedIssuance.trim().length >= 3 &&
    requiredDates.every(Boolean)

  const updateField = <K extends keyof CalendarFields>(
    key: K,
    value: CalendarFields[K],
  ) => {
    setFields((current) => ({ ...current, [key]: value }))
    setPolicy(null)
    setReadiness(null)
  }

  const saveDraft = async () => {
    setBusy(true)
    try {
      const response = await api.post<{
        calendarPolicy: CalendarPolicy
      }>("/school-years/calendar-policies", {
        yearLabel: targetYearLabel,
        ...fields,
        sourceUrl: fields.sourceUrl || null,
        enrollOpenDate: fields.enrollOpenDate || null,
        enrollCloseDate: fields.enrollCloseDate || null,
        term4Start:
          fields.termFormat === "QUARTERS" ? fields.term4Start : null,
        term4End:
          fields.termFormat === "QUARTERS" ? fields.term4End : null,
      })
      setPolicy(response.data.calendarPolicy)
      sileo.success({
        title: "Calendar draft saved",
        description:
          "Review the dates, then approve the official school calendar.",
      })
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0])
    } finally {
      setBusy(false)
    }
  }

  const approvePolicy = async () => {
    if (!policy) return
    setBusy(true)
    try {
      const response = await api.post<{
        calendarPolicy: CalendarPolicy
      }>(`/school-years/calendar-policies/${policy.id}/approve`)
      const approved = response.data.calendarPolicy
      setPolicy(approved)
      setReadiness(await getRolloverReadiness(approved.id))
      sileo.success({
        title: "School calendar approved",
        description:
          "The system has checked the EOSY records and official forms.",
      })
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0])
    } finally {
      setBusy(false)
    }
  }

  const runRollover = async () => {
    if (!policy || policy.status !== "APPROVED") return
    setBusy(true)
    try {
      const response = await api.post<{
        year: { id: number; yearLabel: string; status: string }
      }>("/school-years/rollover", {
        sourceSchoolYearId,
        calendarPolicyId: policy.id,
        pin,
      })
      setSettings({
        activeSchoolYearId: response.data.year.id,
        activeSchoolYearLabel: response.data.year.yearLabel,
        activeSchoolYearStatus: response.data.year.status,
        viewingSchoolYearId: null,
        systemPhase: "OFFICIAL_ENROLLMENT",
        systemStatus: "ACTIVE",
      })
      setOpen(false)
      sileo.success({
        title: "New school year opened",
        description:
          `School Year ${response.data.year.yearLabel} is now active.`,
      })
      navigate("/dashboard", { replace: true })
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0])
      if (policy) {
        setReadiness(await getRolloverReadiness(policy.id))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="text-sm font-extrabold">
          <CalendarCheck2 className="h-4 w-4" />
          Prepare New School Year
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approved School Calendar and Rollover</DialogTitle>
          <DialogDescription className="text-sm">
            Encode the dates from the applicable DepEd issuance for School
            Year {targetYearLabel}. No dates are copied or guessed by the
            system.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="depedIssuance">DepEd Issuance</Label>
            <Input
              id="depedIssuance"
              value={fields.depedIssuance}
              onChange={(event) =>
                updateField("depedIssuance", event.target.value)
              }
              placeholder="Example: DepEd Order No. __, s. ____"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="calendarSource">Reference Link</Label>
            <Input
              id="calendarSource"
              value={fields.sourceUrl}
              onChange={(event) =>
                updateField("sourceUrl", event.target.value)
              }
              placeholder="Optional official source link"
            />
          </div>
          <div className="space-y-2">
            <Label>Start of Classes</Label>
            <Input
              type="date"
              value={fields.classOpeningDate}
              onChange={(event) =>
                updateField("classOpeningDate", event.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>End of School Year</Label>
            <Input
              type="date"
              value={fields.classEndDate}
              onChange={(event) =>
                updateField("classEndDate", event.target.value)
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Grading Period Format</Label>
            <Select
              value={fields.termFormat}
              onValueChange={(value) =>
                updateField(
                  "termFormat",
                  value as CalendarFields["termFormat"],
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUARTERS">Four Quarters</SelectItem>
                <SelectItem value="TRIMESTER">Three Terms</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {[1, 2, 3, ...(fields.termFormat === "QUARTERS" ? [4] : [])].map(
            (term) => (
              <div
                key={term}
                className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:col-span-2"
              >
                <div className="space-y-2">
                  <Label>Period {term} Start</Label>
                  <Input
                    type="date"
                    value={
                      fields[
                        `term${term}Start` as keyof CalendarFields
                      ]
                    }
                    onChange={(event) =>
                      updateField(
                        `term${term}Start` as keyof CalendarFields,
                        event.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period {term} End</Label>
                  <Input
                    type="date"
                    value={
                      fields[`term${term}End` as keyof CalendarFields]
                    }
                    onChange={(event) =>
                      updateField(
                        `term${term}End` as keyof CalendarFields,
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>
            ),
          )}
        </div>

        {readiness && !readiness.ready && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-950">
              Requirements still to complete
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-950">
              {readiness.globalBlockers.map((blocker) => (
                <li key={blocker.code}>{blocker.message}</li>
              ))}
              {readiness.blockers.map((blocker) => (
                <li key={blocker.sectionId}>
                  {blocker.gradeLevel} {blocker.sectionName}: complete the
                  final results and official SF5 record.
                </li>
              ))}
            </ul>
          </div>
        )}

        {policy?.status === "APPROVED" && readiness?.ready && (
          <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              All rollover requirements are complete
            </div>
            <AdminPinInput value={pin} onChange={setPin} />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Close
          </Button>
          {!policy && (
            <Button
              type="button"
              onClick={() => void saveDraft()}
              disabled={busy || !calendarComplete}
            >
              {busy ? "Saving..." : "Save Calendar Draft"}
            </Button>
          )}
          {policy?.status === "DRAFT" && (
            <Button
              type="button"
              onClick={() => void approvePolicy()}
              disabled={busy}
            >
              {busy ? "Approving..." : "Approve Calendar"}
            </Button>
          )}
          {policy?.status === "APPROVED" && (
            <Button
              type="button"
              onClick={() => void runRollover()}
              disabled={busy || !readiness?.ready || pin.length !== 6}
            >
              {busy ? "Opening New School Year..." : "Start New School Year"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
