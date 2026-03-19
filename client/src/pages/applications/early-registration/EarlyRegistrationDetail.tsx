import { useParams, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useApplicationDetail } from "@/hooks/useApplicationDetail";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { SCPAssessmentBlock } from "@/components/applications/SCPAssessmentBlock";
import { StatusTimeline } from "@/components/applications/StatusTimeline";
import {
  PersonalInfo,
  GuardianContact,
  PreviousSchool,
  Classifications,
} from "@/components/applications/BeefSections";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { format } from "date-fns";
import { DocumentManagement } from "@/components/applications/DocumentManagement";
import { RequirementChecklist } from "@/components/applications/RequirementChecklist";
import { ActionButtons } from "@/components/applications/ActionButtons";
import { toastApiError } from "@/hooks/useApiToast";
import api from "@/api/axiosInstance";
import { sileo } from "sileo";

export default function EarlyRegistrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const {
    data: applicant,
    loading,
    error,
    refetch,
  } = useApplicationDetail(Number(id), true);

  const handleTemporarilyEnroll = async () => {
    if (!confirm("Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.")) return;
    try {
      await api.patch(`/applications/${id}/temporarily-enroll`);
      sileo.success({ title: "Updated", description: "Applicant is now temporarily enrolled." });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleApprove = async () => {
    sileo.info({ title: "Section Assignment", description: "Opening section assignment dialog..." });
  };

  const handleReject = async () => {
    const reason = prompt("Please enter the reason for rejection:");
    if (reason === null) return;
    try {
      await api.patch(`/applications/${id}/reject`, { rejectionReason: reason });
      sileo.success({ title: "Rejected", description: "Application has been rejected." });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleScheduleExam = async () => {
    sileo.info({ title: "SCP Flow", description: "Opening assessment scheduler..." });
  };

  const handleRecordResult = async () => {
    sileo.info({ title: "SCP Flow", description: "Opening result recorder..." });
  };

  const handlePass = async () => {
    try {
      await api.patch(`/applications/${id}/pass`);
      sileo.success({ title: "Passed", description: "Applicant passed the assessment." });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleFail = async () => {
    try {
      await api.patch(`/applications/${id}/fail`);
      sileo.success({ title: "Failed", description: "Applicant failed the assessment." });
      refetch();
    } catch (error) {
      toastApiError(error as never);
    }
  };

  const handleOfferRegular = async () => {
    sileo.info({ title: "SCP Flow", description: "Offering regular placement..." });
  };

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-10 w-[200px]' />
        <Card>
          <CardContent className='p-6'>
            <Skeleton className='h-[200px] w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className='flex flex-col items-center justify-center h-64 space-y-4'>
        <h2 className='text-xl font-bold'>Error</h2>
        <p className='text-muted-foreground'>
          {error || "Applicant not found."}
        </p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className='space-y-6 max-w-5xl mx-auto'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigate(-1)}
            className='rounded-full'>
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {applicant.lastName}, {applicant.firstName} {applicant.middleName}
            </h1>
            <p className='text-muted-foreground flex items-center gap-2 mt-1 font-bold'>
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

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='md:col-span-2 space-y-6'>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='w-full'>
            <TabsList className='w-full justify-start border-b rounded-none bg-transparent h-auto p-0'>
              <TabsTrigger
                value='overview'
                className='rounded-lg border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:shadow-none px-4 py-2'>
                Overview
              </TabsTrigger>
              <TabsTrigger
                value='documents'
                className='rounded-lg border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:shadow-none px-4 py-2'>
                Documents
              </TabsTrigger>
              <TabsTrigger
                value='history'
                className='rounded-lg border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:shadow-none px-4 py-2'>
                Full History
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode='wait'>
              {activeTab === "overview" && (
                <motion.div
                  key='overview'
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className='w-full'>
                  <TabsContent value='overview' forceMount className='mt-6 outline-none'>
                    <div className='space-y-4'>
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
                  key='documents'
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className='w-full'>
                  <TabsContent value='documents' forceMount className='mt-6 outline-none'>
                    <DocumentManagement
                      applicantId={applicant.id}
                      documents={applicant.documents || []}
                      onRefresh={refetch}
                    />
                  </TabsContent>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key='history'
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className='w-full'>
                  <TabsContent value='history' forceMount className='mt-6 outline-none'>
                    <Card>
                      <CardContent className='p-6'>
                        <StatusTimeline applicant={applicant} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          <RequirementChecklist
            applicantId={applicant.id}
            learnerType={applicant.learnerType}
            checklist={applicant.checklist}
            onRefresh={refetch}
          />

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
            <CardContent className='p-4 space-y-4'>
              <div>
                <h3 className='text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2'>
                  System Info
                </h3>
                <div className='text-sm grid grid-cols-[100px_1fr] gap-2 font-bold'>
                  <span className='text-muted-foreground'>Channel:</span>
                  <span>
                    {applicant.admissionChannel === "F2F"
                      ? "Face-to-Face"
                      : "Online"}
                  </span>

                  <span className='text-muted-foreground'>Created:</span>
                  <span>
                    {format(new Date(applicant.createdAt), "MM/dd/yyyy")}
                  </span>

                  <span className='text-muted-foreground'>Last Updated:</span>
                  <span>
                    {format(new Date(applicant.updatedAt), "MM/dd/yyyy")}
                  </span>

                  {applicant.encodedBy && (
                    <>
                      <span className='text-muted-foreground'>Encoded By:</span>
                      <span>{applicant.encodedBy.name}</span>
                    </>
                  )}
                </div>
              </div>

              {applicant.enrollment && (
                <div className='pt-4 border-t'>
                  <h3 className='text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2'>
                    <span>✅</span> Enrolled
                  </h3>
                  <div className='text-sm grid grid-cols-[100px_1fr] gap-2'>
                    <span className='text-muted-foreground'>Section:</span>
                    <span className='font-bold'>
                      {applicant.enrollment.section?.name || "N/A"}
                    </span>

                    <span className='text-muted-foreground'>Adviser:</span>
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
    </div>
  );
}
