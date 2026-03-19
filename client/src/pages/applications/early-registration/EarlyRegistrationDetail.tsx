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

export default function EarlyRegistrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: applicant, loading, error } = useApplicationDetail(Number(id), true);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[200px]" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <h2 className="text-xl font-bold text-destructive">Error</h2>
        <p className="text-muted-foreground">{error || "Applicant not found."}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {applicant.lastName}, {applicant.firstName} {applicant.middleName}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <span>#{applicant.trackingNumber}</span>
              <span>•</span>
              <span>Grade {applicant.gradeLevel.name}</span>
              <span>•</span>
              <span>{applicant.applicantType}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={applicant.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0">
              <TabsTrigger 
                value="overview" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                Full History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-4">
              <SCPAssessmentBlock applicant={applicant} />
              <PersonalInfo applicant={applicant} />
              <GuardianContact applicant={applicant} />
              <PreviousSchool applicant={applicant} />
              <Classifications applicant={applicant} />
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <Card>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2 h-48">
                  <p className="text-muted-foreground">Document management will be implemented in a future phase.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <StatusTimeline applicant={applicant} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  System Info
                </h3>
                <div className="text-sm grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground">Channel:</span>
                  <span>{applicant.admissionChannel === 'F2F' ? 'Face-to-Face' : 'Online'}</span>

                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(applicant.createdAt).toLocaleDateString()}</span>

                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{new Date(applicant.updatedAt).toLocaleDateString()}</span>

                  {applicant.encodedBy && (
                    <>
                      <span className="text-muted-foreground">Encoded By:</span>
                      <span>{applicant.encodedBy.name}</span>
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
                    <span className="font-bold">{applicant.enrollment.section?.name || 'N/A'}</span>
                    
                    <span className="text-muted-foreground">Adviser:</span>
                    <span>
                      {applicant.enrollment.section?.advisingTeacher?.firstName}{' '}
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
