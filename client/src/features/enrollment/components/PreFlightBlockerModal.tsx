import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { AlertCircle } from "lucide-react";

interface PreFlightBlockerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unlockedClassesCount: number;
  irregularBlockerCount: number;
  incompleteSubjectGradesCount: number;
  targetScopeName: string;
}

export function PreFlightBlockerModal({
  open,
  onOpenChange,
  unlockedClassesCount,
  irregularBlockerCount,
  incompleteSubjectGradesCount,
  targetScopeName,
}: PreFlightBlockerModalProps) {
  const hasUnlockedClasses = unlockedClassesCount > 0;
  const hasIrregularBlockers = irregularBlockerCount > 0;
  const hasIncompleteGrades = incompleteSubjectGradesCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-700 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" /> Cannot Finalize {targetScopeName}
          </DialogTitle>
          <DialogDescription className="text-foreground pt-2">
            You must resolve the following DepEd compliance blockers before the system can securely lock the end-of-school-year data:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {hasUnlockedClasses && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="flex items-start text-amber-900  text-base leading-tight">
                <span className="mr-2">⚠️</span>
                <span>{unlockedClassesCount} Sections pending School Form 5 (SF5) submission.</span>
              </div>
              <span className="text-amber-700 block text-base ml-6 mt-0.5">
                Synchronize the finalized SMART outcomes, then record the current SF5 for each section.
              </span>
            </div>
          )}

          {hasIrregularBlockers && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="flex items-start text-amber-900  text-base leading-tight">
                <span className="mr-2">⚠️</span>
                <span>{irregularBlockerCount} Learner(s) require End-of-School-Year (EOSY) Class grades.</span>
              </div>
              <span className="text-amber-700 block text-base ml-6 mt-0.5">
                Review the unresolved SMART results or record an official dropped-out or transferred-out status.
              </span>
            </div>
          )}

          {hasIncompleteGrades && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="flex items-start text-amber-900  text-base leading-tight">
                <span className="mr-2">⚠️</span>
                <span>{incompleteSubjectGradesCount} Learner(s) have INCOMPLETE SUBJECT GRADES fetched from SMART API.</span>
              </div>
              <span className="text-amber-700 block text-base ml-6 mt-0.5">
                Ensure all subjects are graded before finalizing the school year.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto font-bold">
            Close & Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
