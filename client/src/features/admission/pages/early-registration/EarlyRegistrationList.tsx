import { useState } from "react";
import { Link } from "react-router";
import { RefreshCw, UserPlus } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

// Hooks
import { useEarlyRegistrations } from "./hooks/useEarlyRegistrations";
import { useRegistrationActions } from "./hooks/useRegistrationActions";
import { useResizablePanel } from "./hooks/useResizablePanel";

// Components
import { EarlyRegistrationFilters } from "./components/EarlyRegistrationFilters";
import { EarlyRegistrationTable } from "./components/EarlyRegistrationTable";
import { EarlyRegistrationCards } from "./components/EarlyRegistrationCards";
import { EarlyRegistrationSidePanel } from "./components/EarlyRegistrationSidePanel";
import { EarlyRegistrationActionDialogs } from "./components/EarlyRegistrationActionDialogs";

import type { Application } from "./hooks/useEarlyRegistrations";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";

const NEXT_ACTION_BY_STATUS: Record<string, string> = {
  SUBMITTED: "Verify Submission",
  VERIFIED: "Review Documents",
  UNDER_REVIEW: "Continue Review",
  FOR_REVISION: "Wait for Revision",
  ELIGIBLE: "Schedule Assessment",
  EXAM_SCHEDULED: "Record Results",
  ASSESSMENT_TAKEN: "Pass or Fail",
  PASSED: "Schedule Interview",
  INTERVIEW_SCHEDULED: "Ready for Enrollment",
  READY_FOR_ENROLLMENT: "View in Enrollment",
  FAILED_ASSESSMENT: "Resolve Decision",
  REJECTED: "Review Appeal",
  WITHDRAWN: "No Action",
};

export default function EarlyRegistration() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  // Custom Hooks
  const {
    applications,
    total,
    loading,
    search,
    setSearch,
    status,
    setStatus,
    type,
    setType,
    page,
    setPage,
    stageCounts,
    fetchData,
  } = useEarlyRegistrations(ayId);

  const {
    actionType,
    setActionType,
    rejectionReason,
    setRejectionReason,
    sections,
    selectedSectionId,
    setSelectedSectionId,
    fetchSections,
    handleApprove,
    handleMarkEligible,
    handleReject,
  } = useRegistrationActions(fetchData);

  const { panelPercentage, isDesktopViewport, startResizing } =
    useResizablePanel();

  // Local UI State
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedApp, setSelectedApp] = useState<
    Application | ApplicantDetail | null
  >(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<AssessmentStep | null>(null);

  // Derived State
  const showSkeleton = useDelayedLoading(loading);

  const getNextAction = (currentStatus: string) =>
    NEXT_ACTION_BY_STATUS[currentStatus] ?? "Review Applicant";

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 overflow-auto px-2 sm:px-4 lg:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Early Registration Monitoring Dashboard
            </h1>
            <p className="text-sm font-bold text-foreground">
              Applicant screening and assessment workflow
            </p>
          </div>

          <div className="flex w-full md:w-auto gap-2">
            <Button
              asChild
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold bg-primary hover:bg-primary/90">
              <Link to="/monitoring/f2f-early-registration">
                <UserPlus className="h-4 w-4 mr-2" />+ Walk-In Learner
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
              onClick={() => {
                void fetchData();
              }}
              disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <EarlyRegistrationFilters
            status={status}
            setStatus={setStatus}
            search={search}
            setSearch={setSearch}
            type={type}
            setType={setType}
            setPage={setPage}
            stageCounts={stageCounts}
          />

          <CardContent className="px-3 sm:px-6">
            <EarlyRegistrationCards
              applications={applications}
              showSkeleton={showSkeleton}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              getNextAction={getNextAction}
            />

            <EarlyRegistrationTable
              applications={applications}
              showSkeleton={showSkeleton}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              getNextAction={getNextAction}
            />

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 font-bold">
              <span className="text-xs sm:text-sm text-center md:text-left">
                Showing {applications.length} applicants
              </span>
              <div className="flex w-full md:w-auto items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}>
                  Previous
                </Button>
                <Badge variant="secondary" className="px-3 h-8 text-xs">
                  Page {page}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 50 >= total || loading}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EarlyRegistrationSidePanel
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        applications={applications}
        isDesktopViewport={isDesktopViewport}
        panelPercentage={panelPercentage}
        startResizing={startResizing}
        fetchData={fetchData}
        setSelectedApp={setSelectedApp}
        setActionType={setActionType}
        fetchSections={fetchSections}
        setIsScheduleDialogOpen={setIsScheduleDialogOpen}
        setScheduleStep={setScheduleStep}
      />

      <EarlyRegistrationActionDialogs
        actionType={actionType}
        setActionType={setActionType}
        selectedApp={selectedApp}
        selectedSectionId={selectedSectionId}
        setSelectedSectionId={setSelectedSectionId}
        sections={sections}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        handleMarkEligible={handleMarkEligible}
        handleApprove={handleApprove}
        handleReject={handleReject}
      />

      <ScheduleExamDialog
        open={isScheduleDialogOpen}
        onOpenChange={isScheduleDialogOpen ? setIsScheduleDialogOpen : () => {}}
        applicant={selectedApp as ApplicantDetail | null}
        step={scheduleStep}
        endpointBase="/early-registrations"
        onSuccess={fetchData}
        onCloseSheet={() => setSelectedId(null)}
      />
    </div>
  );
}
