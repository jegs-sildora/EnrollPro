import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import type { Application } from "../hooks/useEarlyRegistrations";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";
interface SidePanelProps {
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  applications: Application[];
  isDesktopViewport: boolean;
  panelPercentage: number;
  startResizing: () => void;
  fetchData: () => void;
  setSelectedApp: (app: Application | ApplicantDetail | null) => void;
  setActionType: (type: "APPROVE" | "REJECT" | "ELIGIBLE" | null) => void;
  fetchSections: (glId: number) => void;
  setIsScheduleDialogOpen: (open: boolean) => void;
  setScheduleStep: (step: AssessmentStep | null) => void;
  handleInlineSaveStepResult: (
    id: number | null,
    stepOrder: number,
    kind: string,
    score: number,
    cutoffScore: number | null,
  ) => Promise<void>;
}

export function EarlyRegistrationSidePanel({
  selectedId,
  setSelectedId,
  applications,
  isDesktopViewport,
  panelPercentage,
  startResizing,
  fetchData,
  setSelectedApp,
  setActionType,
  fetchSections,
  setIsScheduleDialogOpen,
  setScheduleStep,
  handleInlineSaveStepResult,
}: SidePanelProps) {
  return (
    <Sheet
      open={selectedId !== null}
      onOpenChange={(open) => {
        if (!open) setSelectedId(null);
      }}>
      <SheetContent
        side="right"
        className="p-0 flex flex-row border-l-0 sm:border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
        }>
        {/* Resize Handle — hidden on mobile */}
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden lg:flex items-center justify-center group">
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        {selectedId && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <ApplicationDetailPanel
              id={selectedId}
              endpointBase="/early-registrations"
              onClose={() => setSelectedId(null)}
              onApprove={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("APPROVE");
                  fetchSections(app.gradeLevelId);
                }
              }}
              onReject={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("REJECT");
                }
              }}
              onScheduleExam={async () => {
                try {
                  const fullRes = await api.get(
                    `/early-registrations/${selectedId}/detailed`,
                  );
                  setSelectedApp(fullRes.data);
                  setScheduleStep(null);
                  setIsScheduleDialogOpen(true);
                } catch (err) {
                  toastApiError(err as never);
                }
              }}
              onScheduleStep={async (step: AssessmentStep) => {
                try {
                  const fullRes = await api.get(
                    `/early-registrations/${selectedId}/detailed`,
                  );
                  setSelectedApp(fullRes.data);
                  setScheduleStep(step);
                  setIsScheduleDialogOpen(true);
                } catch (err) {
                  toastApiError(err as never);
                }
              }}
              onSaveStepResult={(stepOrder, kind, score, cutoffScore) =>
                handleInlineSaveStepResult(
                  selectedId,
                  stepOrder,
                  kind,
                  score,
                  cutoffScore,
                )
              }
              onRecordResult={() => {}}
              onPass={async () => {
                try {
                  await api.patch(`/early-registrations/${selectedId}/pass`);
                  sileo.success({
                    title: "Passed",
                    description: "Applicant marked as PASSED.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onFail={async () => {
                try {
                  await api.patch(`/early-registrations/${selectedId}/fail`);
                  sileo.success({
                    title: "Failed",
                    description: "Applicant marked as FAILED.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onOfferRegular={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("APPROVE");
                  fetchSections(app.gradeLevelId);
                }
              }}
              onTemporarilyEnroll={async () => {
                if (
                  !confirm(
                    "Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.",
                  )
                )
                  return;
                try {
                  await api.patch(
                    `/early-registrations/${selectedId}/temporarily-enroll`,
                  );
                  sileo.success({
                    title: "Updated",
                    description: "Applicant is now temporarily enrolled.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onAssignLrn={async () => {
                const raw = window.prompt("Enter the learner's 12-digit LRN:");
                if (!raw) return;
                const lrn = raw.trim();

                if (!/^\d{12}$/.test(lrn)) {
                  sileo.error({
                    title: "Invalid LRN",
                    description: "LRN must be exactly 12 digits.",
                  });
                  return;
                }

                try {
                  await api.patch(
                    `/early-registrations/${selectedId}/assign-lrn`,
                    { lrn },
                  );
                  sileo.success({
                    title: "LRN Assigned",
                    description: "Learner record updated successfully.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onEnroll={async () => {
                if (
                  !confirm(
                    "Finalize this learner's official enrollment? This action will mark the learner as ENROLLED.",
                  )
                )
                  return;
                try {
                  await api.patch(`/early-registrations/${selectedId}/enroll`);
                  sileo.success({
                    title: "Enrolled",
                    description: "Learner is now officially enrolled.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onScheduleInterview={async () => {
                try {
                  const fullRes = await api.get(
                    `/early-registrations/${selectedId}/detailed`,
                  );
                  const fullApp = fullRes.data as ApplicantDetail;
                  setSelectedApp(fullApp);
                  // Find interview step in pipeline
                  const interviewStep = fullApp.assessmentSteps?.find(
                    (s) => s.kind === "INTERVIEW" && s.status !== "COMPLETED",
                  );
                  setScheduleStep(interviewStep || null);
                  setIsScheduleDialogOpen(true);
                } catch (err) {
                  toastApiError(err as never);
                }
              }}
              onMarkInterviewPassed={async () => {
                try {
                  await api.patch(
                    `/early-registrations/${selectedId}/mark-interview-passed`,
                  );
                  sileo.success({
                    title: "Ready for Enrollment",
                    description:
                      "Learner moved to Ready for Enrollment status.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
