import { useParams, useNavigate } from "react-router";
import { ArrowLeft, User } from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
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
import { useState } from "react";
import { format } from "date-fns";
import { DocumentManagement } from "@/features/enrollment/components/DocumentManagement";
import { RequirementChecklist } from "@/features/enrollment/components/RequirementChecklist";
import { ActionButtons } from "@/features/enrollment/components/ActionButtons";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { toastApiError } from "@/shared/hooks/useApiToast";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";

export default function EarlyRegistrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const {
    data: applicant,
    loading,
    error,
    refetch,
  } = useApplicationDetail(Number(id), true);
  const [photoError, setPhotoError] = useState(false);

  const getImageUrl = (photo: string | null) => {
    if (!photo) return null;
    if (photo.startsWith("data:")) return photo;
    const baseUrl = (
      import.meta.env.VITE_API_URL || "http://192.168.254.106:3001/api"
    ).replace(/\/api$/, "");
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
      await api.patch(`/applications/${id}/temporarily-enroll`);
      sileo.success({
        title: "Updated",
        description: "Applicant is now temporarily enrolled.",
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
      await api.patch(`/applications/${id}/reject`, {
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
      await api.patch(`/applications/${id}/pass`);
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
      await api.patch(`/applications/${id}/fail`);
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

  if (loading) {
    return <div className="space-y-6"></div>;
  }

  if (error || !applicant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4"></div>
    );
  }

  return (
    <div className="space-y-6 max-w-[78rem] mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Student Photo */}
          <div className="w-24 h-24 rounded-xl border-2 border-primary/10 shadow-sm overflow-hidden bg-background flex items-center justify-center shrink-0">
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
            <h1 className="text-3xl font-bold tracking-tight">
              {applicant.lastName}, {applicant.firstName} {applicant.middleName}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1 font-bold">
              <span>#{applicant.trackingNumber}</span>
              <span>•</span>
              <span>{applicant.gradeLevel.name}</span>
              <span>•</span>
              <span>{applicant.applicantType}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={applicant.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)] overflow-hidden">
        {/* Main Content */}
        <div className="md:col-span-2 flex flex-col h-full overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 shrink-0 mb-4">
              <TabsTrigger
                value="overview"
                className="rounded-lg border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:shadow-none px-4 py-2 transition-all"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="rounded-lg border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:shadow-none px-4 py-2 transition-all"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-lg border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:shadow-none px-4 py-2 transition-all"
              >
                Full History
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              <AnimatePresence mode="wait">
                {activeTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full"
                  >
                    <TabsContent
                      value="overview"
                      forceMount
                      className="mt-0 outline-none"
                    >
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
                    className="w-full"
                  >
                    <TabsContent
                      value="documents"
                      forceMount
                      className="mt-0 outline-none space-y-6"
                    >
                      <RequirementChecklist
                        applicantId={applicant.id}
                        learnerType={applicant.learnerType}
                        checklist={applicant.checklist}
                        onRefresh={refetch}
                      />
                      <DocumentManagement
                        applicantId={applicant.id}
                        documents={applicant.documents || []}
                        checklist={applicant.checklist}
                        encodedBy={applicant.encodedBy}
                        auditLogs={applicant.auditLogs}
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
                    className="w-full"
                  >
                    <TabsContent
                      value="history"
                      forceMount
                      className="mt-0 outline-none"
                    >
                      <Card>
                        <CardContent className="p-6">
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

        {/* Sidebar */}
        <div className="space-y-6 overflow-y-auto pr-2 pb-15">
          <Card>
            <div className="p-4 pb-0">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
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
            />
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  System Info
                </h3>
                <div className="text-sm grid grid-cols-[100px_1fr] gap-2 font-bold">
                  <span className="text-muted-foreground">Channel:</span>
                  <span>
                    {applicant.admissionChannel === "F2F"
                      ? "Face-to-Face"
                      : "Online"}
                  </span>

                  <span className="text-muted-foreground">Created:</span>
                  <span>
                    {format(new Date(applicant.createdAt), "MMMM dd, yyyy 'at' h:mm a")}
                  </span>

                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>
                    {format(new Date(applicant.updatedAt), "MMMM dd, yyyy 'at' h:mm a")}
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
                  <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>✅</span> Enrolled
                  </h3>
                  <div className="text-sm grid grid-cols-[100px_1fr] gap-2">
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
        onSuccess={refetch}
      />
    </div>
  );
}
