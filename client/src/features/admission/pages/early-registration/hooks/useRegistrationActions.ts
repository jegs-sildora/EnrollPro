import { useState } from "react";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import type { Application } from "./useEarlyRegistrations";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";

export function useRegistrationActions(onSuccess: () => void) {
  const [actionType, setActionType] = useState<
    "APPROVE" | "REJECT" | "ELIGIBLE" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [sections, setSections] = useState<
    {
      id: number;
      name: string;
      maxCapacity: number;
      _count: { enrollments: number };
    }[]
  >([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const fetchSections = async (glId: number) => {
    try {
      const res = await api.get(`/sections?gradeLevelId=${glId}`);
      setSections(res.data.sections);
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleApprove = async (
    selectedApp: Application | ApplicantDetail | null,
  ) => {
    if (!selectedApp || !selectedSectionId) return;
    try {
      await api.patch(`/early-registrations/${selectedApp.id}/approve`, {
        sectionId: parseInt(selectedSectionId),
      });
      sileo.success({
        title: "Ready for Enrollment",
        description: "Learner moved to Ready for Enrollment status.",
      });
      setActionType(null);
      onSuccess();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleMarkEligible = async (
    selectedApp: Application | ApplicantDetail | null,
  ) => {
    if (!selectedApp) return;
    try {
      await api.patch(`/early-registrations/${selectedApp.id}/mark-eligible`);
      sileo.success({
        title: "Eligible",
        description: "Marked as eligible for assessment.",
      });
      setActionType(null);
      onSuccess();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleReject = async (
    selectedApp: Application | ApplicantDetail | null,
  ) => {
    if (!selectedApp) return;
    try {
      await api.patch(`/early-registrations/${selectedApp.id}/reject`, {
        rejectionReason,
      });
      sileo.success({
        title: "Rejected",
        description: "Application has been rejected.",
      });
      setActionType(null);
      onSuccess();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleInlineSaveStepResult = async (
    selectedId: number | null,
    stepOrder: number,
    kind: string,
    score: number,
  ) => {
    if (!selectedId) return;
    try {
      await api.patch(`/early-registrations/${selectedId}/record-step-result`, {
        stepOrder,
        kind,
        score,
      });

      sileo.success({
        title: "Result Recorded",
        description: "Assessment result saved.",
      });
      onSuccess();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return {
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
    handleInlineSaveStepResult,
  };
}
