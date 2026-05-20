import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"; 
import { Button } from "@/shared/ui/button";
import { Printer, X } from "lucide-react";

interface ConfirmationSlipProps {
  open: boolean;
  onClose: () => void;
  learner: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    suffix?: string | null;
    lrn?: string | null;
  };
  gradeLevelName: string;
  schoolName?: string | null;
  schoolYearLabel?: string | null;
  applicationId: number;
  confirmedAt: Date;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTime(d: Date): string {
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${month}/${day}/${year} ${pad(displayHour)}:${minutes}:${seconds} ${ampm}`;
}

function buildFullName(
  firstName: string,
  lastName: string,
  middleName?: string | null,
  suffix?: string | null,
): string {
  const parts = [
    lastName.toUpperCase(),
    ",",
    firstName.toUpperCase(),
    middleName ? middleName.toUpperCase() : null,
    suffix ? suffix.toUpperCase() : null,
  ].filter(Boolean);
  return parts.join(" ");
}

export function ConfirmationSlip({
  open,
  onClose,
  learner,
  gradeLevelName,
  schoolName,
  schoolYearLabel,
  applicationId,
  confirmedAt,
}: ConfirmationSlipProps) {
  const fullName = buildFullName(
    learner.firstName,
    learner.lastName,
    learner.middleName,
    learner.suffix,
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="sr-only">
          <DialogTitle>BOSY Confirmation Slip</DialogTitle>
        </DialogHeader>

        {/* Action bar — hidden during print */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40 print:hidden">
          <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">
            Confirmation Slip
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-[11px] font-black uppercase"
              onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Printable slip body */}
        <div
          id="bosy-confirmation-slip"
          className="p-8 bg-white text-gray-900 text-[13px] space-y-5 print:p-0"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}>

          {/* Republic Header */}
          <div className="text-center space-y-0.5">
            <p className="text-[11px] uppercase tracking-widest font-bold">
              Republic of the Philippines
            </p>
            <p className="text-[11px] uppercase tracking-widest">
              Department of Education
            </p>
            <p className="text-[11px] uppercase tracking-widest">
              Region VI — Western Visayas
            </p>
          </div>

          <div className="border-t-2 border-b-2 border-gray-800 py-3 text-center space-y-0.5">
            <p className="text-base font-black uppercase tracking-wider">
              {schoolName ?? "Hinigaran National High School"}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
              Junior High School Department
            </p>
          </div>

          {/* Document Title */}
          <div className="text-center space-y-1">
            <p className="text-lg font-black uppercase tracking-widest border-b-2 border-gray-800 pb-2 inline-block px-6">
              BOSY Confirmation Slip
            </p>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
              Beginning of School Year — Official Return Confirmation
            </p>
          </div>

          {/* School Year badge */}
          {schoolYearLabel && (
            <div className="text-center">
              <span className="inline-block border border-gray-400 rounded px-3 py-0.5 text-xs font-black uppercase tracking-widest">
                School Year {schoolYearLabel}
              </span>
            </div>
          )}

          {/* Learner details table */}
          <table
            className="w-full border-collapse text-[12px]"
            style={{ borderCollapse: "collapse" }}>
            <tbody>
              <SlipRow label="FULL NAME" value={fullName} />
              <SlipRow
                label="LRN"
                value={
                  learner.lrn ? (
                    <span className="font-mono tracking-wider">
                      {learner.lrn}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">Pending LRN Issuance</span>
                  )
                }
              />
              <SlipRow
                label="INCOMING GRADE LEVEL"
                value={
                  <span className="font-black uppercase">
                    {gradeLevelName}
                  </span>
                }
              />
              <SlipRow
                label="ENROLLMENT STATUS"
                value={
                  <span className="font-black text-emerald-700 uppercase">
                    Ready for Sectioning
                  </span>
                }
              />
              <SlipRow
                label="DATE &amp; TIME CONFIRMED"
                value={
                  <span className="font-mono">
                    {formatDateTime(confirmedAt)}
                  </span>
                }
              />
              <SlipRow
                label="SYSTEM REFERENCE NO."
                value={
                  <span className="font-mono tracking-wider font-bold">
                    BOSY-{String(applicationId).padStart(6, "0")}
                  </span>
                }
              />
            </tbody>
          </table>

          {/* Notice */}
          <div className="border border-gray-300 bg-gray-50 rounded p-3 text-[11px] text-gray-700 space-y-1">
            <p className="font-bold uppercase tracking-wide">Important Notice</p>
            <p>
              This slip confirms that the above-named learner has officially
              declared their intent to return for the upcoming school year. This
              document is not a final enrollment certificate. Section assignment
              will be communicated separately.
            </p>
          </div>

          {/* Signature blocks */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="space-y-0.5 text-center">
              <div className="border-b border-gray-500 pb-1 mb-1 h-8" />
              <p className="text-[11px] font-bold uppercase">
                Learner / Guardian Signature
              </p>
              <p className="text-[10px] text-gray-500">Over Printed Name</p>
            </div>
            <div className="space-y-0.5 text-center">
              <div className="border-b border-gray-500 pb-1 mb-1 h-8" />
              <p className="text-[11px] font-bold uppercase">
                Registrar / Receiving Officer
              </p>
              <p className="text-[10px] text-gray-500">Over Printed Name</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-300 pt-2 text-center text-[10px] text-gray-400">
            <p>
              Generated by EnrollPro &bull; {formatDateTime(confirmedAt)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SlipRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <tr style={{ borderBottom: "1px solid #d1d5db" }}>
      <td
        className="py-2 pr-4 font-bold uppercase text-gray-600 align-top whitespace-nowrap"
        style={{
          width: "220px",
          fontSize: "11px",
          letterSpacing: "0.04em",
          verticalAlign: "top",
        }}>
        {label}
      </td>
      <td className="py-2" style={{ fontSize: "13px" }}>
        {value}
      </td>
    </tr>
  );
}
