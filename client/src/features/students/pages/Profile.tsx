import { useMemo, useState } from "react";
import { ArrowLeft, HeartPulse, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { sileo } from "sileo";
import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";

import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useSettingsStore } from "@/store/settings.slice";
import {
  StudentDetailPanel,
  type StudentDropoutPayload,
  type StudentTransferOutPayload,
} from "../components/StudentDetailPanel";
import { Badge } from "@/shared/ui/badge";
import { BackSubjectWorkspace } from "../components/tabs/BackSubjectWorkspace";
import { AcademicHistoryTab } from "../components/tabs/AcademicHistoryTab";

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [activeTab, setActiveTab] = useState("record");
  const learnerId = Number.parseInt(id ?? "", 10);
  const activeSchoolYearId = useSettingsStore((state) => state.activeSchoolYearId);
  const viewingSchoolYearId = useSettingsStore(
    (state) => state.viewingSchoolYearId,
  );
  const systemPhase = useSettingsStore((state) => state.systemPhase);
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();

  // We capture the loaded student here to render the Hero Header
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loadedStudent, setLoadedStudent] = useState<any>(null);

  const schoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const canEditProfile = useMemo(
    () =>
      (!isHistoricalReadOnly || hasOverride) &&
      systemPhase !== "EOSY_CLOSING",
    [hasOverride, isHistoricalReadOnly, systemPhase],
  );

  const refreshProfile = () => {
    setRefreshVersion((version) => version + 1);
  };

  const handleTransferOut = async (payload: StudentTransferOutPayload) => {
    try {
      await api.post(`/students/${payload.student.id}/lifecycle/transfer-out`, {
        transferDate: payload.transferDate,
        destinationSchool: payload.destinationSchool,
        reasonNote: payload.reasonNote || undefined,
      });
      sileo.success({
        title: "Learner transferred out",
        description: "The learner record and active class list were updated.",
      });
      refreshProfile();
    } catch (error: unknown) {
      toastApiError(error as never);
    }
  };

  const handleDropout = async (payload: StudentDropoutPayload) => {
    try {
      await api.post(`/students/${payload.student.id}/lifecycle/dropout`, {
        dropOutDate: payload.dropOutDate,
        reasonCode: payload.reasonCode,
        reasonNote: payload.interventionNotes || undefined,
      });
      sileo.success({
        title: "Learner marked as dropped out",
        description: "The learner record and active class list were updated.",
      });
      refreshProfile();
    } catch (error: unknown) {
      toastApiError(error as never);
    }
  };

  if (!Number.isInteger(learnerId) || learnerId <= 0) {
    return (
      <div className="flex min-h-64 items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-base font-bold">Invalid learner record.</p>
          <Button variant="outline" onClick={() => navigate("/students")}>
            Return to Learner Directory
          </Button>
        </div>
      </div>
    );
  }

  const needsRemedial =
    loadedStudent?.isRemedialRequired ||
    (loadedStudent?.academicDeficiencies && loadedStudent.academicDeficiencies.length > 0) ||
    (loadedStudent?.remedialClasses && loadedStudent.remedialClasses.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="flex items-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/students")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Learner Directory
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList className={cn("grid w-full h-auto gap-1 p-1 bg-muted border border-border rounded-md relative shadow-sm", needsRemedial ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
          <TabsTrigger
            value="record"
            className="w-full font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md py-2"
          >
            {activeTab === "record" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase truncate flex items-center justify-center", activeTab === "record" ? "text-primary-foreground" : "text-foreground")}>
              Primary Profile
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="academic"
            className="w-full font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md py-2"
          >
            {activeTab === "academic" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase truncate flex items-center justify-center", activeTab === "academic" ? "text-primary-foreground" : "text-foreground")}>
              Academic History
            </span>
          </TabsTrigger>
          {needsRemedial && (
            <TabsTrigger
              value="back_subjects"
              className="w-full font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md py-2"
            >
              {activeTab === "back_subjects" && (
                <motion.div
                  layoutId="profile-active-pill"
                  className="absolute inset-0 bg-primary shadow-sm rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className={cn("relative z-20 text-sm uppercase truncate flex items-center justify-center", activeTab === "back_subjects" ? "text-white" : "text-foreground")}>
                Subject Deficiencies
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="record"
          className="min-h-0 flex-1 overflow-hidden rounded-md border bg-background"
        >
          <StudentDetailPanel
            key={`${learnerId}-${schoolYearId ?? "active"}-${refreshVersion}`}
            id={learnerId}
            schoolYearId={schoolYearId}
            onClose={() => navigate("/students")}
            onRefreshData={refreshProfile}
            onTransferOut={handleTransferOut}
            onDropout={handleDropout}
            canEditProfile={canEditProfile}
            onStudentLoaded={setLoadedStudent}
            showHeader={false}
          />
        </TabsContent>

        <TabsContent
          value="academic"
          className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background p-4"
        >
          <AcademicHistoryTab student={loadedStudent} />
        </TabsContent>

        {needsRemedial && (
          <TabsContent
            value="back_subjects"
            className="min-h-0 flex-1 overflow-hidden rounded-md border bg-background"
          >
            <BackSubjectWorkspace student={loadedStudent} schoolYearId={schoolYearId ?? 0} onRefreshData={refreshProfile} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
