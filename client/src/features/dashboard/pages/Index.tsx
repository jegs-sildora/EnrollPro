import { motion } from "motion/react";
import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { useHeaderStore } from "@/store/header.slice";
import { useAuthStore } from "@/store/auth.slice";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/utils";

import { GlobalAdminDashboardView } from "./views/GlobalAdminDashboardView";
import { GradeLevelCoordinatorDashboardView } from "./views/GradeLevelCoordinatorDashboardView";
import { SCPCoordinatorDashboardView } from "./views/SCPCoordinatorDashboardView";
import { ClassAdviserDashboardView } from "./views/ClassAdviserDashboardView";
import { SubjectTeacherDashboardView } from "./views/SubjectTeacherDashboardView";

export default function DashboardIndex() {
  const { ayLabel } = useSchoolYearContext();
  const setTitle = useHeaderStore((s) => s.setTitle);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setTitle(`Dashboard | S.Y. ${ayLabel || ""}`);
    return () => setTitle(null);
  }, [setTitle, ayLabel]);

  const [loading, setLoading] = useState(true);

  // Simulate loading to prove layout scaffold
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const availableViews = useMemo(() => {
    if (!user) return [];
    
    const views: { id: string; label: string; component: ReactNode }[] = [];
    const roles = user.roles || [];
    const ancillary = user.ancillaryRoles || [];

    // 1. Global Admin View
    if (roles.includes("SYSTEM_ADMIN") || roles.includes("HEAD_REGISTRAR") || roles.includes("PRINCIPAL")) {
      views.push({
        id: "global",
        label: "Global Admin",
        component: <GlobalAdminDashboardView 
          totalEnrollees={3450} 
          pendingEnrollments={124} 
          missingRequirementsCount={45} 
          sectionCapacities={[
            { gradeLevel: 7, currentEnrolled: 800, totalCapacity: 850 },
            { gradeLevel: 8, currentEnrolled: 820, totalCapacity: 850 },
            { gradeLevel: 9, currentEnrolled: 900, totalCapacity: 950 },
            { gradeLevel: 10, currentEnrolled: 930, totalCapacity: 950 },
          ]}
          onOpenEnrollment={() => {}}
          onAutoAssignSections={() => {}}
          onViewAuditLogs={() => {}}
        />
      });
    }

    // 2. Grade Level Coordinator View
    const glcMatch = ancillary.find(r => r.includes("GRADE") && r.includes("COORDINATOR"));
    if (roles.includes("GRADE_LEVEL_COORDINATOR") || glcMatch) {
      views.push({
        id: "glc",
        label: glcMatch ? `${glcMatch} View` : "GLC View",
        component: <GradeLevelCoordinatorDashboardView 
          assignedGradeLevel={glcMatch?.split(" ")[1] ? `Grade ${glcMatch.split(" ")[1]}` : "Assigned Grade"}
          totalGradeEnrollees={800}
          unsectionedLearnersCount={15}
          pendingWalkInApprovals={4}
          sectionFillRates={[
            { sectionName: "Pearl", fillPercentage: 100, maleCount: 20, femaleCount: 25 },
            { sectionName: "Diamond", fillPercentage: 95, maleCount: 18, femaleCount: 24 },
          ]}
          onAssignSections={() => {}}
          onViewMasterlist={() => {}}
        />
      });
    }

    // 3. SCP Coordinator View
    const scpMatch = ancillary.find(r => (r.includes("STE") || r.includes("SPA") || r.includes("SPS")) && (r.includes("HEAD") || r.includes("COORDINATOR")));
    if (scpMatch || roles.includes("STE_COORDINATOR") || roles.includes("SPA_COORDINATOR") || roles.includes("SPS_COORDINATOR")) {
      views.push({
        id: "scp",
        label: scpMatch ? `${scpMatch.split(" ")[0]} Coordinator` : "SCP Coordinator",
        component: <SCPCoordinatorDashboardView 
          scpProgramName={scpMatch ? scpMatch.split(" ")[0] : "SCP"}
          totalApplicants={120}
          availableSlotsPerGrade={{ 7: 70, 8: 10, 9: 5, 10: 2 }}
          pendingScreeningCount={45}
          missingRequirementsAlerts={[
            { applicantName: "Dela Cruz, Juan", missingDocs: ["Medical Certificate"] }
          ]}
          onReviewApplications={() => {}}
          onGenerateRankList={() => {}}
        />
      });
    }

    // 4. Class Adviser View
    if (roles.includes("CLASS_ADVISER")) {
      views.push({
        id: "adviser",
        label: "Advisory Class",
        component: <ClassAdviserDashboardView 
          advisorySectionName="Grade 10 - Rizal"
          totalLearners={45}
          maxCapacity={45}
          maleCount={20}
          femaleCount={25}
          missingDocumentsAlerts={[
            { learnerName: "Santos, Maria", missingDocs: ["SF9"] }
          ]}
          onGoToAdvisoryRoster={() => {}}
          onDownloadSF1={() => {}}
          onEncodeSF9Grades={() => {}}
        />
      });
    }

    // 5. Subject Teacher View
    if (roles.includes("TEACHER")) {
      views.push({
        id: "teacher",
        label: "Teaching Loads",
        component: <SubjectTeacherDashboardView 
          assignedTeachingLoads={6}
          classesToday={4}
          pendingGradeEncodings={[
            { subjectName: "Mathematics 10", sectionName: "Grade 10 - Rizal", deadline: "Oct 15" }
          ]}
          onViewSchedule={() => {}}
          onAccessSMART={() => {}}
        />
      });
    }

    return views;
  }, [user]);

  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    if (availableViews.length > 0 && !activeTab) {
      setActiveTab(availableViews[0].id);
    }
  }, [availableViews, activeTab]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-0 min-w-0 w-full flex-1 flex-col pb-6"
    >
      {availableViews.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No dashboard views available for your role.
        </div>
      ) : availableViews.length === 1 ? (
        <div className="pt-6">
          {availableViews[0].component}
        </div>
      ) : (
        <Tabs value={activeTab || availableViews[0].id} onValueChange={setActiveTab} className="w-full mt-6">
          <TabsList className="w-full flex flex-col sm:flex-row h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
            {availableViews.map((view) => (
              <TabsTrigger 
                key={view.id} 
                value={view.id}
                className="w-full sm:flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg py-2"
              >
                {activeTab === view.id && (
                  <motion.div
                    layoutId="dashboard-active-pill"
                    className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className={cn("relative z-20 uppercase text-sm sm:text-base", activeTab === view.id ? "text-primary-foreground" : "text-foreground")}>
                  {view.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {availableViews.map((view) => (
            <TabsContent key={view.id} value={view.id} className="pt-2 mt-0 border-none outline-none">
              {view.component}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </motion.div>
  );
}
