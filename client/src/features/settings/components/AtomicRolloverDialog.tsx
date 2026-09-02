import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Settings2, CheckCircle2 } from "lucide-react"
import { sileo } from "sileo"
import api from "@/shared/api/axiosInstance"
import { toastApiError } from "@/shared/hooks/useApiToast"
import { Button } from "@/shared/ui/button"
import { ConfirmationModal } from "@/shared/ui/confirmation-modal"
import { Checkbox } from "@/shared/ui/checkbox"
import { Label } from "@/shared/ui/label"
import { useSettingsStore } from "@/store/settings.slice"

interface AtomicRolloverDialogProps {
  sourceSchoolYearId: number
  sourceYearLabel: string
  disabled?: boolean
  trigger?: React.ReactNode
}

interface RolloverReadinessResponse {
  ready: boolean
  blockers: Array<{
    sectionId: number
    gradeLevel: string
    sectionName: string
    reasons: string[]
  }>
  globalBlockers: Array<{ code: string; message: string }>
}

interface TriggerProps {
  onClick?: (event: React.MouseEvent) => void
  disabled?: boolean
}

function nextYearLabel(label: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(label)
  if (!match) return ""
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
}

const FORMATTED_REASONS: Record<string, string> = {
  SECTION_NOT_FINALIZED: "Section is not finalized",
  LEARNER_RESULT_NOT_FINALIZED: "Pending learner statuses",
  SMART_OUTCOME_MISSING: "Missing SMART outcomes",
  SMART_OUTCOME_MISMATCH: "SMART outcome mismatch",
  SF5_NOT_RECORDED: "Missing School Form 5 (SF5)",
  SF5_STALE: "Outdated School Form 5 (SF5)",
}

export function AtomicRolloverDialog({
  sourceSchoolYearId,
  sourceYearLabel,
  disabled = false,
  trigger,
}: AtomicRolloverDialogProps) {
  const navigate = useNavigate()
  const targetYearLabel = useMemo(
    () => nextYearLabel(sourceYearLabel),
    [sourceYearLabel],
  )
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [readiness, setReadiness] = useState<RolloverReadinessResponse | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setReadinessLoading(true)
    api.get<RolloverReadinessResponse>("/system/rollover-readiness")
      .then((response) => {
        if (!cancelled) setReadiness(response.data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setReadiness(null)
          toastApiError(error as Parameters<typeof toastApiError>[0])
        }
      })
      .finally(() => {
        if (!cancelled) setReadinessLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setConsentChecked(false)
    }
  }

  const runRollover = async () => {
    setBusy(true)
    try {
      const response = await api.post<{
        year: { id: number; yearLabel: string; status: string }
      }>("/school-years/rollover", {
        sourceSchoolYearId,
      })
      useSettingsStore.getState().triggerRolloverSwitch({
        activeSchoolYearId: response.data.year.id,
        activeSchoolYearLabel: response.data.year.yearLabel,
        activeSchoolYearStatus: response.data.year.status,
        viewingSchoolYearId: null,
        systemPhase: "OFFICIAL_ENROLLMENT",
        systemStatus: "ACTIVE",
      }, response.data.year.yearLabel)
      setOpen(false)
      setConsentChecked(false)
      sileo.success({
        title: "New School Year Started",
        description: `School Year ${response.data.year.yearLabel} is now active.`,
      })
      navigate("/dashboard", { replace: true })
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0])
    } finally {
      setBusy(false)
    }
  }

  const description = (
    <div className="flex flex-col items-center">
      <span className="text-center text-base pt-2 pb-4">
        The system will archive the current year and execute the following actions:
      </span>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-left w-full">
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-base text-foreground">
              Teaching and Non-Teaching Personnel profiles carried over
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-base text-foreground">
              Learner masterlists and SF1 records safely archived
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-base text-foreground">
              Grade 7 to 10 class sections regenerated for incoming enrollments
            </span>
          </li>
        </ul>
      </div>
      {readinessLoading && (
        <p className="mt-4 text-sm font-bold text-muted-foreground">
          Checking rollover requirements...
        </p>
      )}
      {!readinessLoading && readiness && !readiness.ready && (
        <div className="mt-4 w-full rounded-lg border border-amber-300 bg-amber-50 p-4 text-left flex flex-col max-h-[40vh]">
          <p className="text-sm font-bold text-amber-900 shrink-0">
            Complete these requirements before rollover:
          </p>
          <div className="overflow-y-auto mt-2 pr-2 custom-scrollbar">
            <ul className="space-y-1.5 text-sm text-amber-900">
              {readiness.globalBlockers.map((blocker) => (
                <li key={blocker.code} className="font-bold flex gap-2"><span className="shrink-0">•</span> {blocker.message}</li>
              ))}
              {readiness.blockers.map((blocker) => (
                <li key={blocker.sectionId} className="flex gap-2">
                  <span className="shrink-0 font-bold">• {blocker.gradeLevel} {blocker.sectionName}:</span>
                  <span className="font-medium">{blocker.reasons.map(r => FORMATTED_REASONS[r] || r).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center space-x-3 mt-6 mb-2">
        <Checkbox
          id="rollover-consent"
          checked={consentChecked}
          onCheckedChange={(checked) => setConsentChecked(checked === true)}
        />
        <Label htmlFor="rollover-consent" className="text-base font-bold cursor-pointer text-foreground text-left">
          I understand this action is permanent and will archive the current school year.
        </Label>
      </div>
    </div>
  )

  return (
    <>
      {trigger && React.isValidElement<TriggerProps>(trigger) ? (
        React.cloneElement(trigger, {
          disabled: disabled || trigger.props.disabled,
          onClick: (event: React.MouseEvent) => {
            if (disabled || trigger.props.disabled) return
            setOpen(true)
            trigger.props.onClick?.(event)
          },
        })
      ) : (
        <Button disabled={disabled} className="text-sm font-bold" onClick={() => setOpen(true)}>
          <Settings2 className="h-4 w-4 mr-2" />
          Prepare New School Year
        </Button>
      )}

      <ConfirmationModal
        open={open}
        onOpenChange={handleOpenChange}
        variant="success"
        title={`Archiving S.Y. ${sourceYearLabel} and Starting S.Y. ${targetYearLabel}`}
        description={description}
        confirmText="Start New School Year"
        cancelText="Cancel"
        loading={busy}
        confirmDisabled={
          !consentChecked
          || busy
          || readinessLoading
          || readiness?.ready !== true
        }
        confirmClassName="disabled:bg-gray-400 disabled:text-white disabled:shadow-none"
        onConfirm={() => void runRollover()}
      />
    </>
  )
}
