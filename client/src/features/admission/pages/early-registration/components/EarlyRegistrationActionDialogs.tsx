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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { Application } from "../hooks/useEarlyRegistrations";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";

interface ActionDialogsProps {
  actionType: "APPROVE" | "REJECT" | "ELIGIBLE" | null;
  setActionType: (type: "APPROVE" | "REJECT" | "ELIGIBLE" | null) => void;
  selectedApp: Application | ApplicantDetail | null;
  selectedSectionId: string;
  setSelectedSectionId: (id: string) => void;
  sections: any[];
  rejectionReason: string;
  setRejectionReason: (reason: string) => void;
  handleMarkEligible: (app: Application | ApplicantDetail | null) => void;
  handleApprove: (app: Application | ApplicantDetail | null) => void;
  handleReject: (app: Application | ApplicantDetail | null) => void;
}

export function EarlyRegistrationActionDialogs({
  actionType,
  setActionType,
  selectedApp,
  selectedSectionId,
  setSelectedSectionId,
  sections,
  rejectionReason,
  setRejectionReason,
  handleMarkEligible,
  handleApprove,
  handleReject,
}: ActionDialogsProps) {
  return (
    <Dialog
      open={actionType !== null}
      onOpenChange={(open) => !open && setActionType(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base font-bold">
            {actionType === "APPROVE" && "Approve & Pre-register"}
            {actionType === "ELIGIBLE" && "Mark as Eligible"}
            {actionType === "REJECT" && "Reject Application"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Candidate: {selectedApp?.lastName}, {selectedApp?.firstName}
          </DialogDescription>
        </DialogHeader>

        {actionType === "ELIGIBLE" && (
          <div className="py-4">
            <p className="text-xs sm:text-sm">
              Marking this applicant as{" "}
              <span className="font-bold text-cyan-700">ELIGIBLE</span> means
              their documents are verified and they are cleared for assessment
              or direct pre-registration.
            </p>
          </div>
        )}

        {actionType === "APPROVE" && (
          <div className="space-y-4 py-4">
            <p className="text-xs sm:text-sm text-emerald-700 font-medium">
              This candidate will be moved to the Enrollment phase and
              assigned to a section.
            </p>
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">
                Select Section for {selectedApp?.gradeLevel.name}
              </Label>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}>
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Choose a section..." />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={String(s.id)}
                      disabled={s._count.enrollments >= s.maxCapacity}
                      className="text-xs sm:text-sm">
                      {s.name} ({s._count.enrollments}/{s.maxCapacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {actionType === "REJECT" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">
                Reason for Rejection
              </Label>
              <textarea
                className="w-full min-h-[96px] sm:min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-xs sm:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Explain why this application is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setActionType(null)}
            className="text-xs sm:text-sm h-9">
            Cancel
          </Button>
          {actionType === "ELIGIBLE" && (
            <Button
              className="bg-cyan-600 hover:bg-cyan-700 text-xs sm:text-sm h-9"
              onClick={() => handleMarkEligible(selectedApp)}>
              Confirm Eligibility
            </Button>
          )}
          {actionType === "APPROVE" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm h-9"
              onClick={() => handleApprove(selectedApp)}
              disabled={!selectedSectionId}>
              Confirm Pre-registration
            </Button>
          )}
          {actionType === "REJECT" && (
            <Button
              variant="default"
              onClick={() => handleReject(selectedApp)}
              disabled={!rejectionReason}
              className="text-xs sm:text-sm h-9">
              Reject Application
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
