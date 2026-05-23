import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Label } from "@/shared/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Textarea } from "@/shared/ui/textarea"
import { Badge } from "@/shared/ui/badge"
import { cn } from "@/shared/lib/utils"

const HANDOVER_REASONS = [
  "Maternity Leave",
  "Administrative Reassignment",
  "Resignation",
  "Medical Leave",
  "Promotion",
  "Other",
] as const

interface HandoverConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAdviserName: string
  newAdviserName: string
  submitting?: boolean
  onConfirm: (reason: string) => Promise<void> | void
}

export function HandoverConfirmationModal({
  open,
  onOpenChange,
  currentAdviserName,
  newAdviserName,
  submitting = false,
  onConfirm,
}: HandoverConfirmationModalProps) {
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  useEffect(() => {
    if (!open) {
      setReason("")
      setCustomReason("")
    }
  }, [open])

  const resolvedReason = useMemo(() => {
    if (reason !== "Other") return reason
    return customReason.trim()
  }, [customReason, reason])

  const canConfirm = resolvedReason.trim().length > 0 && !submitting

  const handleConfirm = async () => {
    if (!canConfirm) return
    await onConfirm(resolvedReason.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border-2 border-amber-300/60 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 bg-gradient-to-r from-amber-100 via-amber-50 to-red-50 border-b border-amber-200">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-200/70 text-amber-900 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-black uppercase text-amber-900">
                Handover Confirmation Required
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-amber-800">
                You are replacing an active class adviser. This action must be logged for audit compliance.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-amber-900 mb-3">
              Adviser Transfer Summary
            </p>
            <div className="flex items-center gap-2 text-xs font-bold">
              <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                Current Adviser
              </Badge>
              <span className="text-foreground">{currentAdviserName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold mt-2">
              <ArrowRightLeft className="h-3.5 w-3.5 text-amber-700" />
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                New Adviser
              </Badge>
              <span className="text-foreground">{newAdviserName}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-foreground">
              REASON FOR HANDOVER (Required for Audit Log)
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-11 font-bold">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {HANDOVER_REASONS.map((item) => (
                  <SelectItem key={item} value={item} className="font-bold text-xs uppercase">
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "Other" && (
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-foreground">
                Additional Details
              </Label>
              <Textarea
                value={customReason}
                onChange={(event) => setCustomReason(event.target.value)}
                placeholder="Describe the reason for handover..."
                className="min-h-24 font-semibold"
              />
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row items-center justify-between">
          <Button
            variant="ghost"
            className="font-bold uppercase text-xs"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "font-black uppercase text-xs",
              !canConfirm && "cursor-not-allowed opacity-60",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm & Transfer Adviser"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
