import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
  type StudentDetail,
  type StudentDropoutPayload,
  type StudentTransferOutPayload,
} from "../components/StudentDetailPanel";
import { BackSubjectWorkspace } from "../components/tabs/BackSubjectWorkspace";
import { AcademicHistoryTab } from "../components/tabs/AcademicHistoryTab";

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [refreshVersion, setRefreshVersion] = useState(0);
  
  const uiPreferences = useSettingsStore((state) => state.uiPreferences);
  const updateUiPreference = useSettingsStore((state) => state.updateUiPreference);
  
  const requestedTab = uiPreferences.studentProfileTab;
  const VALID_TABS = ["record", "academic", "back_subjects"] as const;
  type ProfileTab = (typeof VALID_TABS)[number];
  
  const preferredTab: ProfileTab = VALID_TABS.includes(
    (requestedTab ?? "") as ProfileTab,
  )
    ? ((requestedTab as ProfileTab) ?? "record")
    : "record";

  const setActiveTab = (val: string) => {
    updateUiPreference("studentProfileTab", val);
  };

  const learnerId = Number.parseInt(id ?? "", 10);
  const activeSchoolYearId = useSettingsStore((state) => state.activeSchoolYearId);
  const viewingSchoolYearId = useSettingsStore(
    (state) => state.viewingSchoolYearId,
  );
  const systemPhase = useSettingsStore((state) => state.systemPhase);
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();

  const [loadedStudent, setLoadedStudent] = useState<StudentDetail | null>(null);

  const schoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const backSubjectRequestKey = `${id ?? ""}:${schoolYearId ?? 0}`;
  const [backSubjectAvailability, setBackSubjectAvailability] = useState<{
    requestKey: string;
    available: boolean;
  } | null>(null);
  const hasBackSubjects =
    backSubjectAvailability?.requestKey === backSubjectRequestKey &&
    backSubjectAvailability.available;
  const activeTab: ProfileTab =
    preferredTab === "back_subjects" && !hasBackSubjects
      ? "record"
      : preferredTab;
  const handleBackSubjectAvailability = useCallback(
    (available: boolean) => {
      setBackSubjectAvailability({
        requestKey: backSubjectRequestKey,
        available,
      });
    },
    [backSubjectRequestKey],
  );
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
          <Button variant="outline" onClick={() => navigate("/learners")}>
            Return to Learner Directory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="flex items-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/learners")}
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
        <TabsList
          className={cn(
            "relative grid h-auto w-full grid-cols-1 gap-1 rounded-md border border-border bg-muted p-1 shadow-sm",
            hasBackSubjects ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
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
          {hasBackSubjects ? (
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
              <span className={cn("relative z-20 uppercase truncate flex items-center justify-center", activeTab === "back_subjects" ? "text-white" : "text-foreground")}>
                BACK SUBJECTS
              </span>
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent
          value="record"
          forceMount={true}
          hidden={activeTab !== "record"}
          className={cn(
            "min-h-0 flex-1 rounded-md border bg-background relative",
            activeTab !== "record" && "hidden"
          )}
        >
          <div className="absolute inset-0">
            <StudentDetailPanel
              key={`${learnerId}-${schoolYearId ?? "active"}-${refreshVersion}`}
              id={learnerId}
              schoolYearId={schoolYearId}
              onClose={() => navigate("/learners")}
              onRefreshData={refreshProfile}
              onTransferOut={handleTransferOut}
              onDropout={handleDropout}
              canEditProfile={canEditProfile}
              onStudentLoaded={setLoadedStudent}
              showHeader={false}
            />
          </div>
        </TabsContent>

        <TabsContent
          value="academic"
          className="min-h-0 flex-1 rounded-md border bg-background relative"
        >
          <div className="absolute inset-0 overflow-y-auto p-4">
            <AcademicHistoryTab student={loadedStudent} />
          </div>
        </TabsContent>

        <TabsContent
          value="back_subjects"
          forceMount
          className={cn(
            "min-h-0 flex-1 rounded-md border bg-background relative",
            activeTab !== "back_subjects" && "hidden",
          )}
        >
          <div className="absolute inset-0 overflow-y-auto">
            <BackSubjectWorkspace
              learnerIdentifier={id ?? ""}
              schoolYearId={schoolYearId ?? 0}
              onAvailabilityChange={handleBackSubjectAvailability}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
