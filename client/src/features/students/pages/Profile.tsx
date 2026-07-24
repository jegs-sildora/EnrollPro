import { useMemo, useState } from "react";
import { ArrowLeft, HeartPulse, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { sileo } from "sileo";

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
import { HealthRecords } from "../components/tabs/HealthRecords";

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const learnerId = Number.parseInt(id ?? "", 10);
  const activeSchoolYearId = useSettingsStore((state) => state.activeSchoolYearId);
  const viewingSchoolYearId = useSettingsStore(
    (state) => state.viewingSchoolYearId,
  );
  const systemPhase = useSettingsStore((state) => state.systemPhase);
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();

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
          <p className="text-base font-extrabold">Invalid learner record.</p>
          <Button variant="outline" onClick={() => navigate("/students")}>
            Return to Learner Registry
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
          onClick={() => navigate("/students")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Learner Registry
        </Button>
      </div>

      <Tabs
        defaultValue="record"
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="record">
            <UserRound className="mr-2 h-4 w-4" />
            Learner Record
          </TabsTrigger>
          <TabsTrigger value="health">
            <HeartPulse className="mr-2 h-4 w-4" />
            Health and Nutrition
          </TabsTrigger>
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
          />
        </TabsContent>

        <TabsContent
          value="health"
          className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background p-4"
        >
          <HealthRecords learnerId={learnerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
