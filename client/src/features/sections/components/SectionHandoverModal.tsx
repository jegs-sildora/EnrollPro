import { useState, useMemo } from "react";
import { AlertTriangle, RefreshCcw, Search, ShieldAlert, User } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface SectionHandoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: number;
  sectionName: string;
  gradeLevelName: string;
  currentAdviser: { id: number; name: string } | null;
  teachers: Teacher[];
  onSuccess: () => void;
}

const HANDOVER_REASONS = [
  "Maternity Leave",
  "Medical Leave of Absence",
  "Reassignment / Transfer",
  "Promotion to Administrative Position",
  "Retirement",
  "Study Leave",
  "Resignation",
  "Other Administrative Reason",
];

export function SectionHandoverModal({
  open,
  onOpenChange,
  sectionId,
  sectionName,
  gradeLevelName,
  currentAdviser,
  teachers,
  onSuccess,
}: SectionHandoverModalProps) {
  const [substituteTeacherId, setSubstituteTeacherId] = useState<string>("");
  const [handoverReason, setHandoverReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [handoverDate, setHandoverDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTeachers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return teachers.filter(
      (t) =>
        t.id !== currentAdviser?.id &&
        (t.name.toLowerCase().includes(query) ||
          t.employeeId?.toLowerCase().includes(query)),
    );
  }, [teachers, searchQuery, currentAdviser]);

  const handleHandover = async () => {
    if (!substituteTeacherId || !handoverReason) {
      sileo.warning({
        title: "Incomplete Fields",
        description: "Please select a substitute teacher and a reason for handover.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/sections/${sectionId}/handover-adviser`, {
        substituteTeacherId: parseInt(substituteTeacherId),
        handoverReason: handoverReason === "Other Administrative Reason" ? customReason : handoverReason,
        handoverDate,
      });

      sileo.success({
        title: "Handover Executed",
        description: `Official advisory handover for ${sectionName} is complete.`,
      });
      onSuccess();
      onOpenChange(false);
      // Reset state
      setSubstituteTeacherId("");
      setHandoverReason("");
      setCustomReason("");
    } catch (err: any) {
      sileo.error({
        title: "Handover Failed",
        description: err.response?.data?.message || "An unexpected error occurred during the handover process.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSubstitute = teachers.find(t => t.id.toString() === substituteTeacherId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-2 p-0 overflow-hidden rounded-2xl bg-background">
        <DialogHeader className="px-6 py-6 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-foreground/10 rounded-lg">
              <RefreshCcw className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">
                Initiate Advisory Handover
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80 font-bold text-xs">
                Section: {gradeLevelName} - {sectionName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Current Adviser Section */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Current Adviser (To be relieved)
              </Label>
              <Badge variant="outline" className="text-[9px] font-black uppercase border-amber-200 bg-amber-50 text-amber-700">
                ACTIVE
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-background border flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-black text-base uppercase leading-none">
                  {currentAdviser?.name || "Unassigned"}
                </p>
                <p className="text-[11px] font-bold text-muted-foreground mt-1">
                  Load tracked until handover date
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reason Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Reason for Handover (Audit Required)
                </Label>
                <Select value={handoverReason} onValueChange={setHandoverReason}>
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HANDOVER_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason} className="font-bold text-xs uppercase">
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <AnimatePresence>
                {handoverReason === "Other Administrative Reason" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label className="text-[10px] font-black uppercase tracking-widest">
                      Specify Reason
                    </Label>
                    <Textarea
                      placeholder="Enter detailed reason for audit trail..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="min-h-[80px] font-bold text-sm"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Effective Handover Date
                </Label>
                <Input
                  type="date"
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  className="h-11 font-bold"
                />
                <p className="text-[10px] text-muted-foreground font-bold italic leading-tight">
                  The current adviser remains the signatory until this date. The new adviser assumes authority the following day.
                </p>
              </div>
            </div>

            {/* New Adviser Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  New Designated Adviser (Substitute)
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Teacher Directory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-11 font-bold"
                  />
                </div>
                <div className="border rounded-xl h-[180px] overflow-y-auto bg-card divide-y">
                  {filteredTeachers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <p className="text-xs font-bold text-muted-foreground italic">
                        {searchQuery ? "No matching teachers found" : "Start typing to search..."}
                      </p>
                    </div>
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <button
                        key={teacher.id}
                        onClick={() => setSubstituteTeacherId(teacher.id.toString())}
                        className={cn(
                          "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 flex items-center justify-between group",
                          substituteTeacherId === teacher.id.toString() && "bg-primary/5 border-l-4 border-primary"
                        )}
                      >
                        <div>
                          <p className={cn(
                            "font-black text-xs uppercase",
                            substituteTeacherId === teacher.id.toString() ? "text-primary" : "text-foreground"
                          )}>
                            {teacher.name}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground">
                            ID: {teacher.employeeId || "N/A"}
                          </p>
                        </div>
                        {substituteTeacherId === teacher.id.toString() && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground stroke-[4]" />
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DepEd Notice */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex gap-4">
            <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase text-amber-800 tracking-wider leading-none">
                Official DepEd Compliance Notice
              </p>
              <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                Advisory history is preserved in the ledger for legal audit. Past grading periods will remain officially 
                signed by <span className="underline">{currentAdviser?.name || "the original adviser"}</span>. 
                {selectedSubstitute && (
                  <> <span className="underline">{selectedSubstitute.name}</span> will assume official signing authority for all subsequent periods.</>
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex flex-row items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="font-black uppercase text-xs tracking-widest h-11 px-8"
          >
            Cancel
          </Button>
          <Button
            onClick={handleHandover}
            disabled={submitting || !substituteTeacherId || !handoverReason}
            className="font-black uppercase text-xs tracking-widest h-11 px-8 bg-primary shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing Handover...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" /> Execute Official Handover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
