import { useParams, useNavigate } from "react-router";
import { ArrowLeft, User } from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import type { AssessmentStep } from "@/features/enrollment/hooks/useApplicationDetail";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { SCPAssessmentBlock } from "@/features/enrollment/components/SCPAssessmentBlock";
import { StatusTimeline } from "@/features/enrollment/components/StatusTimeline";
import {
  PersonalInfo,
  GuardianContact,
  PreviousSchool,
  Classifications,
} from "@/features/enrollment/components/BeefSections";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent } from "@/shared/ui/card";
import { motion, AnimatePresence } from "motion/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { format } from "date-fns";
import { DocumentManagement } from "@/features/enrollment/components/DocumentManagement";
import { RequirementChecklist } from "@/features/enrollment/components/RequirementChecklist";
import { ActionButtons } from "@/features/enrollment/components/ActionButtons";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { toastApiError } from "@/shared/hooks/useApiToast";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { Skeleton } from "@/shared/ui/skeleton";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import { formatScpType } from "@/shared/lib/utils";

export default function EarlyRegistrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<AssessmentStep | null>(null);
  const {
    data: applicant,
    loading,
    error,
    refetch,
  } = useApplicationDetail(Number(id), true, "/early-registrations");

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  const [photoError, setPhotoError] = useState(false);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);

  // --- Resizable Logic (Fluid Percentage) ---
  const [sidebarPercentage, setSidebarPercentage] = useState(30); // Default 30%
  const isResizing = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidthPercent =
      ((window.innerWidth - e.clientX) / window.innerWidth) * 100;

    // Constraints: Between 15% and 80%
    if (newWidthPercent > 15 && newWidthPercent < 80) {
      setSidebarPercentage(newWidthPercent);
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  const startResizing = useCallback(() => {
    isResizing.current = true;

    const onMouseUp = () => {
      stopResizing();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);
  // ------------------------------------------

  const getImageUrl = (photo: string | null) => {
    if (!photo) return null;
    if (photo.startsWith("data:")) return photo;
    const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(
      /\/api$/,
      "",
    );
    return `${baseUrl}${photo}`;
  };

  const handleTemporarilyEnroll = async () => {
    if (
      !confirm(
        "Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.",
      )
    )
      return;
    try {
      await api.patch(`/early-registrations/${id}/temporarily-enroll`);
      sileo.success({
        title: "Updated",
        description: "Applicant is now temporarily enrolled.",
      });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleEnroll = async () => {
    if (
      !confirm(
        "Finalize this learner's official enrollment? This action will mark the learner as ENROLLED.",
      )
    )
      return;
    try {
      await api.patch(`/early-registrations/${id}/enroll`);
      sileo.success({
        title: "Enrolled",
        description: "Learner is now officially enrolled.",
      });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleApprove = async () => {
    sileo.info({
      title: "Section Assignment",
      description: "Opening section assignment dialog...",
    });
  };

  const handleReject = async () => {
    const reason = prompt("Please enter the reason for rejection:");
    if (reason === null) return;
    try {
      await api.patch(`/early-registrations/${id}/reject`, {
        rejectionReason: reason,
      });
      sileo.success({
        title: "Rejected",
        description: "Application has been rejected.",
      });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleScheduleExam = async () => {
    setScheduleStep(null);
    setIsScheduleDialogOpen(true);
  };

  const handleScheduleStep = (step: AssessmentStep) => {
    setScheduleStep(step);
    setIsScheduleDialogOpen(true);
  };

  const handleScheduleInterview = () => {
    // Find interview step in pipeline
    const interviewStep = applicant?.assessmentSteps?.find(
      (s) => s.kind === "INTERVIEW" && s.status !== "COMPLETED",
    );
    setScheduleStep(interviewStep || null);
    setIsScheduleDialogOpen(true);
  };

  const handleRecordResult = async () => {
    sileo.info({
      title: "SCP Flow",
      description: "Opening result recorder...",
    });
  };

  const handlePass = async () => {
    try {
      await api.patch(`/early-registrations/${id}/pass`);
      sileo.success({
        title: "Passed",
        description: "Applicant passed the assessment.",
      });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleFail = async () => {
    try {
      await api.patch(`/early-registrations/${id}/fail`);
      sileo.success({
        title: "Failed",
        description: "Applicant failed the assessment.",
      });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleOfferRegular = async () => {
    sileo.info({
      title: "SCP Flow",
      description: "Offering regular placement...",
    });
  };

  if (showSkeleton) {
    return (
      <div className="space-y-6 px-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-24 w-24 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
          <div className="w-[30%] space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4"></div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full overflow-hidden px-3 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Student Photo */}
          <div
            className={`w-16 h-16 sm:w-24 sm:h-24 rounded-xl border-2 border-primary/10 shadow-sm overflow-hidden bg-background flex items-center justify-center shrink-0 ${applicant.studentPhoto && !photoError ? "cursor-zoom-in hover:border-primary transition-all" : ""}`}
            onClick={() =>
              applicant.studentPhoto && !photoError && setIsPhotoEnlarged(true)
            }>
            {applicant.studentPhoto && !photoError ? (
              <img
                src={getImageUrl(applicant.studentPhoto) || ""}
                alt="Student"
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                <User className="w-6 h-6 opacity-20" />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xs font-bold tracking-tight">
              {applicant.lastName}, {applicant.firstName} {applicant.middleName}
            </h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1 sm:gap-2 mt-1 font-bold text-xs">
              <span>#{applicant.trackingNumber}</span>
              <span>•</span>
              <span>{applicant.gradeLevel.name}</span>
              <span>•</span>
              <span>{formatScpType(applicant.applicantType)}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={applicant.status} />
      </div>

      <div className="flex flex-col lg:flex-row gap-0 h-auto lg:h-[calc(100vh-200px)] overflow-hidden border rounded-xl bg-card/30">
        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border">
              <TabsTrigger
                value="overview"
                className="flex-1 min-w-25 font-bold transition-all text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="flex-1 min-w-25 font-bold transition-all text-xs">
                Documents
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex-1 min-w-25 font-bold transition-all text-xs">
                Full History
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-10 max-h-[60vh] lg:max-h-none">
              <AnimatePresence mode="wait">
                {activeTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full">
                    <TabsContent
                      value="overview"
                      forceMount
                      className="mt-0 focus-visible:outline-none ring-0">
                      <div className="space-y-4">
                        <SCPAssessmentBlock applicant={applicant} />
                        <PersonalInfo applicant={applicant} />
                        <GuardianContact applicant={applicant} />
                        <PreviousSchool applicant={applicant} />
                        <Classifications applicant={applicant} />
                      </div>
                    </TabsContent>
                  </motion.div>
                )}

                {activeTab === "documents" && (
                  <motion.div
                    key="documents"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full">
                    <TabsContent
                      value="documents"
                      forceMount
                      className="mt-0 focus-visible:outline-none ring-0 space-y-6">
                      <RequirementChecklist
                        applicantId={applicant.id}
                        learnerType={applicant.learnerType}
                        checklist={applicant.checklist}
                        documents={applicant.documents}
                        endpointBase="/early-registrations"
                        onRefresh={refetch}
                      />
                      <DocumentManagement
                        applicantId={applicant.id}
                        documents={applicant.documents || []}
                        checklist={applicant.checklist}
                        encodedBy={applicant.encodedBy}
                        auditLogs={applicant.auditLogs}
                        endpointBase="/early-registrations"
                        onRefresh={refetch}
                        hideUpload
                      />
                    </TabsContent>
                  </motion.div>
                )}

                {activeTab === "history" && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full">
                    <TabsContent
                      value="history"
                      forceMount
                      className="mt-0 focus-visible:outline-none ring-0">
                      <Card className="border-none shadow-none bg-transparent">
                        <CardContent className="p-0">
                          <StatusTimeline applicant={applicant} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Tabs>
        </div>

        {/* Resizer — hidden on mobile/tablet */}
        <div
          onMouseDown={startResizing}
          className="w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors hidden lg:flex items-center justify-center group bg-border/50">
          <div className="h-8 w-1 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        {/* Sidebar (Flexible Percentage Width) */}
        <div
          style={
            typeof window !== "undefined" && window.innerWidth >= 1024
              ? { flexBasis: `${sidebarPercentage}%` }
              : undefined
          }
          className="w-full lg:w-auto space-y-4 sm:space-y-6 overflow-y-auto p-3 sm:p-6 custom-scrollbar bg-muted/10 lg:shrink-0">
          <Card>
            <div className="p-4 pb-0">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Actions
              </h3>
            </div>
            <ActionButtons
              applicant={applicant}
              onApprove={handleApprove}
              onReject={handleReject}
              onScheduleExam={handleScheduleExam}
              onRecordResult={handleRecordResult}
              onPass={handlePass}
              onFail={handleFail}
              onOfferRegular={handleOfferRegular}
              onTemporarilyEnroll={handleTemporarilyEnroll}
              onEnroll={handleEnroll}
              onScheduleInterview={handleScheduleInterview}
              onScheduleStep={handleScheduleStep}
            />
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  System Info
                </h3>
                <div className="text-xs grid grid-cols-[100px_1fr] gap-2 font-bold">
                  <span className="text-muted-foreground">Channel:</span>
                  <span>
                    {applicant.admissionChannel === "F2F"
                      ? "Face-to-Face"
                      : "Online"}
                  </span>

                  <span className="text-muted-foreground">Created:</span>
                  <span>
                    {format(
                      new Date(applicant.createdAt),
                      "MMMM dd, yyyy 'at' h:mm a",
                    )}
                  </span>

                  <span className="text-muted-foreground ">Last Updated:</span>
                  <span>
                    {format(
                      new Date(applicant.updatedAt),
                      "MMMM dd, yyyy 'at' h:mm a",
                    )}
                  </span>

                  {applicant.encodedBy && (
                    <>
                      <span className="text-muted-foreground">Encoded By:</span>
                      <span>
                        {applicant.encodedBy.firstName}{" "}
                        {applicant.encodedBy.lastName}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {applicant.enrollment && (
                <div className="pt-4 border-t">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>✅</span> Enrolled
                  </h3>
                  <div className="text-xs grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground">Section:</span>
                    <span className="font-bold">
                      {applicant.enrollment.section?.name || "N/A"}
                    </span>

                    <span className="text-muted-foreground">Adviser:</span>
                    <span>
                      {applicant.enrollment.section?.advisingTeacher?.firstName}{" "}
                      {applicant.enrollment.section?.advisingTeacher?.lastName}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ScheduleExamDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        applicant={applicant}
        step={scheduleStep}
        endpointBase="/early-registrations"
        onSuccess={refetch}
      />

      {applicant.studentPhoto && (
        <ImageEnlarger
          src={getImageUrl(applicant.studentPhoto) || ""}
          isOpen={isPhotoEnlarged}
          onClose={() => setIsPhotoEnlarged(false)}
          alt={`${applicant.lastName} profile photo`}
        />
      )}
    </div>
  );
}
