import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Settings2, CheckCircle2 } from "lucide-react"
import { sileo } from "sileo"
import api from "@/shared/api/axiosInstance"
import { toastApiError } from "@/shared/hooks/useApiToast"
import { Button } from "@/shared/ui/button"
import { ConfirmationModal } from "@/shared/ui/confirmation-modal"
import { useSettingsStore } from "@/store/settings.slice"

interface AtomicRolloverDialogProps {
  sourceSchoolYearId: number
  sourceYearLabel: string
  disabled?: boolean
  trigger?: React.ReactNode
}

function nextYearLabel(label: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(label)
  if (!match) return ""
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
}

export function AtomicRolloverDialog({
  sourceSchoolYearId,
  sourceYearLabel,
  disabled = false,
  trigger,
}: AtomicRolloverDialogProps) {
  const navigate = useNavigate()
  const setSettings = useSettingsStore((state) => state.setSettings)
  const targetYearLabel = useMemo(
    () => nextYearLabel(sourceYearLabel),
    [sourceYearLabel],
  )
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const runRollover = async () => {
    setBusy(true)
    try {
      const response = await api.post<{
        year: { id: number; yearLabel: string; status: string }
      }>("/school-years/rollover", {
        sourceSchoolYearId,
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
      <span className="text-center text-base pt-2 font-normal pb-4">
        The system will lock the current year and copy the following records:
      </span>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-left font-normal w-full">
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-base text-foreground font-medium">
              <strong>Teachers List</strong> will be copied to the new year.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-base text-foreground font-medium">
              <strong>Grade 7 to 10 Sections</strong> will be recreated empty.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-base text-foreground font-medium">
              <strong>Temporary school days</strong> will be used while waiting for the official DepEd Calendar of Activities.
            </span>
          </li>
        </ul>
      </div>
    </div>
  )

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger as React.ReactElement<any>, {
          onClick: (e: React.MouseEvent) => {
            setOpen(true);
            (trigger as React.ReactElement<any>).props?.onClick?.(e);
          }
        })
      ) : (
        <Button disabled={disabled} className="text-sm font-extrabold" onClick={() => setOpen(true)}>
          <Settings2 className="h-4 w-4 mr-2" />
          Prepare New School Year
        </Button>
      )}

      <ConfirmationModal
        open={open}
        onOpenChange={setOpen}
        variant="success"
        title={`Archiving ${sourceYearLabel} and Starting ${targetYearLabel}`}
        description={description}
        confirmText="Start New School Year"
        cancelText="Cancel"
        loading={busy}
        onConfirm={() => void runRollover()}
      />
    </>
  )
}
