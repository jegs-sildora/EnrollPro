import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { isAxiosError } from "axios";
import { queryKeys } from "@/shared/lib/queryKeys";
import {
  Search,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  Mars,
  Venus,
  FileCheck
} from "lucide-react";
import { format } from "date-fns";
import api from "@/shared/api/axiosInstance";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { cn, getGradeLevelBadgeStyles, formatGradeLevel } from "@/shared/lib/utils";
import { WalkInEncodePanel } from "./WalkInEncodePanel";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { TwoPanelSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { UserPhoto } from "@/shared/components/UserPhoto";


interface PendingVerification {
  id: number;
  learnerId: number;
  trackingNumber: string | null;
  status: string;
  createdAt: string;
  isTemporarilyEnrolled?: boolean;
  learner: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
    lrn: string | null;
    sex: "MALE" | "FEMALE";
    studentPhoto: string | null;
    previousGenAve: number | null;
    birthdate: string;
    hasPsaBirthCertificate?: boolean;
  };
  gradeLevel: {
    name: string;
  };
  applicantType: string;
  previousSchool: {
    schoolName?: string;
    generalAverage?: number;
  } | null;
  familyMembers: Array<{
    relationship: string;
    firstName: string;
    lastName: string;
    contactNumber: string | null;
  }>;
  checklistVerified: boolean;
  isMissingSf9: boolean;
  isMissingPsa: boolean;
  admissionChannel?: string;
}

interface ApiErrorResponse {
  message?: string;
}



const SCP_LABELS: Record<string, string> = {
  REGULAR: "Regular Basic Education Curriculum (BEC)",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology, and Engineering (STE)",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts (SPA)",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports (SPS)",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism (SPJ)",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "Special Program in Foreign Language (SPFL)",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "Technical Vocational Education (SPTVE)",
};

const getGradeTextColor = (gradeName: string) => {
  const name = gradeName.toUpperCase();
  if (name.includes("7")) return "text-green-700";
  if (name.includes("8")) return "text-yellow-700";
  if (name.includes("9")) return "text-red-700";
  if (name.includes("10")) return "text-blue-700";
  return "text-primary";
};

const getGradeCardClasses = (gradeName: string) => {
  const name = gradeName.toUpperCase();
  if (name.includes("7")) return "bg-green-50 border-green-600 shadow-sm";
  if (name.includes("8")) return "bg-yellow-50 border-yellow-600 shadow-sm";
  if (name.includes("9")) return "bg-red-50 border-red-600 shadow-sm";
  if (name.includes("10")) return "bg-blue-50 border-blue-600 shadow-sm";
  return "bg-slate-50 border-slate-600 shadow-sm";
};

function VerificationRow({ label, children, valueClassName }: { label: React.ReactNode, children?: React.ReactNode, valueClassName?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[30%_70%] border-b border-border last:border-0">
      <div className="bg-muted text-foreground font-bold text-base uppercase px-4 py-3 border-r border-border flex items-center">
        {label}
      </div>
      <div className={cn("bg-card text-base leading-tight font-bold text-foreground px-4 py-3 border-r border-border last:border-0 flex items-center", valueClassName)}>
        {children}
      </div>
    </div>
  );
}

export function VerificationWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const queryClient = useQueryClient();

  const [processing, setProcessing] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  const [sf9Verified, setSf9Verified] = useState(false);
  const [psaVerified, setPsaVerified] = useState(false);
  const [assignedProgram, setAssignedProgram] = useState<string>("REGULAR");
  const [confirmModalState, setConfirmModalState] = useState<"TEMPORARY" | "OFFICIAL" | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("");

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.patch(`/enrollment/${selectedAppId}/cancel`, { reason }),
    onSuccess: () => {
      sileo.success({
        title: "Application Cancelled",
        description: `${selectedApp?.learner.firstName}'s application has been cancelled.`
      });
      queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      setCancelModalOpen(false);
      setSelectedAppId(null);
    },
    onError: (err: unknown) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err instanceof Error ? err.message : "Unknown error";
      sileo.error({
        title: "Cancellation Failed",
        description: message || "Failed to cancel application."
      });
    }
  });

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const restoreMutation = useMutation({
    mutationFn: () => api.patch(`/enrollment/${selectedAppId}/restore`),
    onSuccess: () => {
      sileo.success({
        title: "Application Restored",
        description: `${selectedApp?.learner.firstName}'s application has been successfully restored.`
      });
      queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      setRestoreModalOpen(false);
      setSelectedAppId(null);
    },
    onError: (err: unknown) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err instanceof Error ? err.message : "Unknown error";
      sileo.error({
        title: "Restore Failed",
        description: message || "Failed to restore application."
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/enrollment/${selectedAppId}`),
    onSuccess: () => {
      sileo.success({
        title: "Application Deleted",
        description: `${selectedApp?.learner.firstName}'s application has been permanently deleted.`
      });
      queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      setDeleteModalOpen(false);
      setSelectedAppId(null);
    },
    onError: (err: unknown) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err instanceof Error ? err.message : "Unknown error";
      sileo.error({
        title: "Delete Failed",
        description: message || "Failed to delete application."
      });
    }
  });

  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [revertReason, setRevertReason] = useState("");

  const revertMutation = useMutation({
    mutationFn: () => api.patch(`/enrollment/${selectedAppId}/revert`, { reason: revertReason }),
    onSuccess: () => {
      sileo.success({
        title: "Enrollment Reverted",
        description: `${selectedApp?.learner.firstName} has been reverted to the For Review queue.`
      });
      queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      setRevertModalOpen(false);
      setRevertReason("");
      setSelectedAppId(null);
    },
    onError: (err: unknown) => {
      const message = isAxiosError(err) ? err.response?.data?.message : err instanceof Error ? err.message : "Unknown error";
      sileo.error({
        title: "Revert Failed",
        description: message || "Failed to revert enrollment."
      });
    }
  });

  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
  } = useDebouncedSearch();

  const [intakeCategoryFilter, setIntakeCategoryFilter] = useState<string>("ALL");
  const [programFilter, setProgramFilter] = useState<string>("ALL");
  type VerificationTab = "PENDING" | "READY" | "INCOMPLETE" | "CANCELLED";
  const activeTab = useSettingsStore((s) => s.uiPreferences.verificationTab) as VerificationTab;
  const setActiveTab = (tab: VerificationTab) => useSettingsStore.getState().updateUiPreference("verificationTab", tab);

  const {
    data: pendingVerifications = [],
    isLoading,
  } = useQuery({
    queryKey: ["enrollment", "pending-verifications"],
    queryFn: () =>
      api.get<PendingVerification[]>("/enrollment/pending-verifications").then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 10_000,
  });

  const { data: publicSettings } = useQuery({
    queryKey: queryKeys.publicSettings,
    queryFn: () => api.get("/settings/public").then((res) => res.data),
  });

  const filteredVerifications = useMemo(() => {
    let result = pendingVerifications;

    if (activeSearchQuery) {
      const q = activeSearchQuery.toLowerCase();
      result = result.filter(app => {
        const tracking = app.trackingNumber?.toLowerCase() || "";
        const lrn = app.learner.lrn?.toLowerCase() || "";
        const fullName = `${app.learner.lastName} ${app.learner.firstName}`.toLowerCase();
        return tracking.includes(q) || lrn.includes(q) || fullName.includes(q);
      });
    }

    if (intakeCategoryFilter !== "ALL") {
      result = result.filter((app) => app.applicantType === intakeCategoryFilter);
    }

    if (programFilter !== "ALL") {
      // Future enhancement: when backend includes program preference in pending verification response
    }

    if (activeTab === "PENDING") {
      result = result.filter((app) => app.status === "PENDING_VERIFICATION");
    } else if (activeTab === "READY") {
      result = result.filter((app) => {
        return app.status === "READY_FOR_SECTIONING" || app.status === "OFFICIALLY_ENROLLED";
      });
    } else if (activeTab === "INCOMPLETE") {
      result = result.filter((app) => {
        const hasMissingDocs = app.isMissingSf9 || !app.learner?.hasPsaBirthCertificate;
        return app.status === "FOR_REVISION" || ((app.status === "READY_FOR_SECTIONING" || app.status === "OFFICIALLY_ENROLLED") && hasMissingDocs);
      });
    } else if (activeTab === "CANCELLED") {
      result = result.filter((app) => app.status === "WITHDRAWN");
    }

    return result;
  }, [pendingVerifications, activeSearchQuery, intakeCategoryFilter, programFilter, activeTab]);

  const selectedApp = useMemo(() => {
    return pendingVerifications.find(app => app.id === selectedAppId);
  }, [pendingVerifications, selectedAppId]);

  const hasChecklistModifications = useMemo(() => {
    if (!selectedApp) return false;
    const initialSf9 = selectedApp.isTemporarilyEnrolled ? !selectedApp.isMissingSf9 : true;
    const initialPsa = selectedApp.isTemporarilyEnrolled ? (selectedApp.learner?.hasPsaBirthCertificate === true) : true;
    return sf9Verified !== initialSf9 || psaVerified !== initialPsa;
  }, [selectedApp, sf9Verified, psaVerified]);

  useEffect(() => {
    if (selectedApp) {
      setAssignedProgram(selectedApp.applicantType);
      if (selectedApp.status === "READY_FOR_SECTIONING" || selectedApp.status === "FOR_REVISION" || selectedApp.status === "OFFICIALLY_ENROLLED") {
        if (!selectedApp.isTemporarilyEnrolled) {
          setSf9Verified(true);
          setPsaVerified(true);
        } else {
          setSf9Verified(!selectedApp.isMissingSf9);
          setPsaVerified(selectedApp.learner?.hasPsaBirthCertificate === true);
        }
      } else {
        setSf9Verified(false);
        setPsaVerified(false);
      }
    }
  }, [selectedApp]);

  const [duplicateInfo, setDuplicateInfo] = useState<{
    firstName: string;
    lastName: string;
    lrn: string | null;
    birthdate: string;
    activeEnrollment: {
      id: number;
      trackingNumber: string | null;
      status: string;
      gradeLevelName: string;
      sectionName: string | null;
    } | null;
  } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  useEffect(() => {
    if (!selectedApp) {
      setDuplicateInfo(null);
      return;
    }

    const lrnVal = selectedApp.learner.lrn ? selectedApp.learner.lrn.trim() : "";
    const fName = selectedApp.learner.firstName.trim();
    const lName = selectedApp.learner.lastName.trim();
    const bDate = selectedApp.learner.birthdate;

    const hasValidLrn = lrnVal.length === 12;
    const hasValidDemographics = fName.length > 0 && lName.length > 0 && bDate && bDate.length > 0;

    if (!hasValidLrn && !hasValidDemographics) {
      setDuplicateInfo(null);
      return;
    }

    api.post("/learner/check-duplicate", {
      lrn: hasValidLrn ? lrnVal : undefined,
      firstName: fName || undefined,
      lastName: lName || undefined,
      birthdate: bDate || undefined,
    }).then((res) => {
      if (res.data?.duplicateFound) {
        const dupLearner = res.data.learner;
        const activeEnrollment = dupLearner.activeEnrollment;
        if (activeEnrollment && activeEnrollment.id !== selectedApp.id) {
          setDuplicateInfo(dupLearner);
          setShowDuplicateModal(true);
        } else {
          setDuplicateInfo(null);
        }
      } else {
        setDuplicateInfo(null);
      }
    }).catch((err) => {
      console.error("Duplicate check failed in VerificationWorkspace", err);
      setDuplicateInfo(null);
    });
  }, [selectedApp]);

  useEffect(() => {
    if (activeSearchQuery && filteredVerifications.length === 1) {
      if (selectedAppId !== filteredVerifications[0].id) {
        setSelectedAppId(filteredVerifications[0].id);
        setSf9Verified(false);
        setPsaVerified(false);
      }
    }
  }, [activeSearchQuery, filteredVerifications, selectedAppId]);

  // If the user is on the Deficient tab and it becomes empty, redirect to Enrolled tab
  useEffect(() => {
    if (isLoading) return;
    if (activeTab === "INCOMPLETE") {
      const deficientCount = pendingVerifications.filter((app) => {
        const hasMissingDocs = app.isMissingSf9 || !app.learner?.hasPsaBirthCertificate;
        return app.status === "FOR_REVISION" || ((app.status === "READY_FOR_SECTIONING" || app.status === "OFFICIALLY_ENROLLED") && hasMissingDocs);
      }).length;
      if (deficientCount === 0) {
        setActiveTab("PENDING");
        setSelectedAppId(null);
      }
    }
  }, [pendingVerifications, activeTab, isLoading]);

  const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (isAxiosError<ApiErrorResponse>(error)) {
      return error.response?.data?.message ?? fallback;
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return fallback;
  };

  const handleSelect = (appId: number) => {
    setSelectedAppId(appId);
  };

  const approveLearner = async () => {
    if (!selectedAppId || !sf9Verified || !psaVerified) return;

    setProcessing(true);
    try {
      await api.post("/enrollment/finalize-intake", {
        applicationId: selectedAppId,
        checklistVerified: true,
        assignedProgram,
      });

      sileo.success({
        title: "Verification Successful",
        description: `Learner has been verified and queued for sectioning.`,
      });
      setSelectedAppId(null);
      setSf9Verified(false);
      setPsaVerified(false);
      setConfirmModalState(null);
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
    } catch (error: unknown) {
      sileo.error({
        title: "Verification Failed",
        description: getApiErrorMessage(
          error,
          "An error occurred while verifying the learner.",
        ),
      });
    } finally {
      setProcessing(false);
      setConfirmModalState(null);
    }
  };

  const enrollTemporary = async () => {
    if (!selectedAppId) return;

    setProcessing(true);
    try {
      await api.post("/enrollment/finalize-intake", {
        applicationId: selectedAppId,
        checklistVerified: false,
        isMissingSf9: !sf9Verified,
        isMissingPsa: !psaVerified,
        assignedProgram,
      });

      sileo.success({
        title: "Temporarily Enrolled",
        description: `Learner has been assigned temporary enrollment status.`,
      });
      setSelectedAppId(null);
      setSf9Verified(false);
      setPsaVerified(false);
      setConfirmModalState(null);
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
    } catch (error: unknown) {
      sileo.error({
        title: "Temporary Enrollment Failed",
        description: getApiErrorMessage(
          error,
          "An error occurred while temporarily enrolling the learner.",
        ),
      });
    } finally {
      setProcessing(false);
      setConfirmModalState(null);
    }
  };

  const updateDeficientDocuments = async () => {
    if (!selectedAppId || !selectedApp) return;

    setProcessing(true);
    try {
      await api.patch(`/enrollment/${selectedAppId}/complete-requirements`, {
        sf9Verified,
        psaVerified,
      });

      const allVerified = sf9Verified && psaVerified;
      sileo.success({
        title: allVerified ? "Requirements Completed" : "Documents Updated",
        description: allVerified
          ? "All requirements verified. Learner is no longer deficient."
          : "Document checklist has been updated.",
      });
      setSelectedAppId(null);
      setSf9Verified(false);
      setPsaVerified(false);
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
    } catch (error: unknown) {
      sileo.error({
        title: "Update Failed",
        description: getApiErrorMessage(
          error,
          "An error occurred while updating the document checklist.",
        ),
      });
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return <TwoPanelSkeleton />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] min-h-0">
      <Card className="flex-1 flex flex-col shadow-sm border-none bg-card overflow-hidden">
        {/* Filter Toolbar */}
        <div className="flex flex-col xl:flex-row items-center gap-3 w-full bg/20 border-border border-b p-3 sm:px-6 shrink-0">
          <div className="relative w-full flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="SEARCH LRN, FIRST NAME, LAST NAME..."
              className="w-full h-10 pl-9 bg border-gray-300 font-bold uppercase"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-row flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto shrink-0">

            <Select
              isFilter
              value={intakeCategoryFilter}
              onValueChange={(val) => setIntakeCategoryFilter(val)}
            >
              <SelectTrigger className="h-10 w-full sm:w-48 leading-tight font-bold transition-colors">
                <SelectValue placeholder="ALL ENROLLMENT STATUSES" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="leading-tight font-bold">ALL ENROLLMENT STATUSES</SelectItem>
                <SelectItem value="NEW_ENROLLEE" className="leading-tight font-bold">NEW ENTRANTS</SelectItem>
                <SelectItem value="TRANSFEREE" className="leading-tight font-bold">TRANSFEREES</SelectItem>
                <SelectItem value="BALIK_ARAL" className="leading-tight font-bold">RETURNEE (Balik-Aral)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              isFilter
              value={programFilter}
              onValueChange={(val) => setProgramFilter(val)}
            >
              <SelectTrigger className="h-10 w-full sm:w-48 leading-tight font-bold transition-colors">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="leading-tight font-bold">All Programs</SelectItem>
                <SelectItem value="REGULAR" className="leading-tight font-bold">Basic Education Curriculum</SelectItem>
                <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING" className="leading-tight font-bold">SCIENCE, TECHNOLOGY, AND ENGINEERING</SelectItem>
                <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS" className="leading-tight font-bold">Special Program in the Arts</SelectItem>
                <SelectItem value="SPECIAL_PROGRAM_IN_SPORTS" className="leading-tight font-bold">Special Program in Sports</SelectItem>
              </SelectContent>
            </Select>



            {!isHistoricalReadOnly && (
              <WalkInEncodePanel />
            )}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* LEFT PANE */}
          <div className="w-[500px] flex flex-col border-r border-border min-h-0 bg-card text-card-foreground">
            <div className="border-b border-border bg-white shrink-0 flex flex-col w-full">
              {(() => {
                const deficientCount = pendingVerifications.filter((app) => {
                  const hasMissingDocs = app.isMissingSf9 || !app.learner?.hasPsaBirthCertificate;
                  return app.status === "FOR_REVISION" || ((app.status === "READY_FOR_SECTIONING" || app.status === "OFFICIALLY_ENROLLED") && hasMissingDocs);
                }).length;

                const metrics = [
                  {
                    key: "PENDING",
                    title: "For Review",
                    value: pendingVerifications.filter(a => a.status === "PENDING_VERIFICATION").length
                  },
                  {
                    key: "READY",
                    title: "Enrolled",
                    value: pendingVerifications.filter((app) => {
                      return app.status === "READY_FOR_SECTIONING" || app.status === "OFFICIALLY_ENROLLED";
                    }).length,
                  },
                  ...(deficientCount > 0 ? [{
                    key: "INCOMPLETE",
                    title: "Deficient",
                    value: deficientCount
                  }] : []),
                  {
                    key: "CANCELLED",
                    title: "Cancelled",
                    value: pendingVerifications.filter(a => a.status === "WITHDRAWN").length
                  }
                ] as const;

                return (
                  <div className={cn("grid h-10 w-full divide-x divide-gray-200", deficientCount > 0 ? "grid-cols-4" : "grid-cols-3")}>
                    {metrics.map((m) => {
                      const isActive = activeTab === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => {
                            setActiveTab(m.key as VerificationTab);
                            setSelectedAppId(null);
                          }}
                          className={cn(
                            "relative flex items-center justify-between px-3 h-full transition-colors uppercase font-bold z-10",
                            isActive
                              ? "text-primary-foreground bg-primary"
                              : "text-foreground hover:bg-gray-50"
                          )}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="verification-active-pill"
                              className="absolute inset-0 bg-primary"
                              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                            />
                          )}
                          <span className="truncate relative z-20 text-xs">{m.title}</span>
                          <span className="ml-1 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-sm text-primary-foreground relative z-20">
                            {m.value > 9 ? "9+" : m.value}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredVerifications.length === 0 ? (
                <div className="h-full flex items-center justify-center flex-col gap-3 text-foreground p-8 text-center">
                  {activeSearchQuery ? (
                    <Search className="h-8 w-8 text-foreground" />
                  ) : activeTab === "CANCELLED" ? (
                    <CheckCircle2 className="h-8 w-8 text-foreground" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  )}
                  <span className="font-bold text-base leading-tight text-foreground">
                    {activeSearchQuery
                      ? "No results found"
                      : activeTab === "PENDING" ? "No pending applications"
                        : activeTab === "READY" ? "All verified learners have been assigned to sections"
                          : activeTab === "INCOMPLETE" ? "No applications require parent follow up"
                            : "No cancelled applications"}
                  </span>
                </div>
              ) : (
                filteredVerifications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => handleSelect(app.id)}
                    className={cn(
                      "cursor-pointer border-2 p-3 transition-all relative overflow-hidden",
                      selectedAppId === app.id
                        ? getGradeCardClasses(app.gradeLevel.name)
                        : "bg-white hover:bg/50 border-border"
                    )}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <UserPhoto
                          photo={app.learner.studentPhoto}
                          containerClassName={cn("w-12 h-12 rounded-full shadow-sm border shrink-0 border-2", selectedAppId === app.id ? "border-primary" : "border-primary")}
                          className="w-full h-full object-cover"
                          alt={`${app.learner.firstName} ${app.learner.lastName}`}
                        />
                        <div className="flex flex-col min-w-0">
                          <h4 className={cn("font-bold text-base leading-tight uppercase tracking-tight truncate", selectedAppId === app.id ? getGradeTextColor(app.gradeLevel.name) : "text-foreground")} title={`${app.learner.lastName}, ${app.learner.firstName}`}>
                            {app.learner.lastName}, {app.learner.firstName}
                          </h4>
                          <span className="text-sm font-bold uppercase text-foreground mt-0.5 truncate text-foreground">
                            LRN: {app.learner.lrn || "NO LRN"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                        {app.status === "WITHDRAWN" ? (
                          <Badge variant="outline" className="text-sm uppercase font-bold w-fit px-2.5 py-0.5 border-red-500/30 text-red-600 bg-red-50">
                            CANCELLED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={cn("text-sm uppercase font-bold w-fit px-2.5 py-0.5", getGradeLevelBadgeStyles(app.gradeLevel.name))}>
                            {formatGradeLevel(app.gradeLevel.name)}
                          </Badge>
                        )}
                        <div className="flex items-center text-sm text-foreground font-bold whitespace-nowrap text-foreground">
                          <Clock className="w-3 h-3 mr-1 shrink-0" />
                          {format(new Date(app.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANE: DETAIL VIEW & ACTIONS */}
          <div className="flex-1 flex flex-col overflow-hidden bg-card text-card-foreground">
            {selectedApp ? (
              <>
                {/* STICKY HEADER */}
                <div className="shrink-0 px-6 md:px-12 pt-6 md:pt-12 pb-4 border-b border-border bg-card z-10 w-full flex flex-wrap justify-between items-center gap-4 shadow-sm relative">
                  <div className="flex items-center gap-3">
                    <UserPhoto
                      photo={selectedApp.learner.studentPhoto}
                      containerClassName="w-12 h-12 rounded-full shadow-sm border shrink-0 border-primary/20"
                      className="w-full h-full object-cover"
                      alt={`${selectedApp.learner.firstName} ${selectedApp.learner.lastName}`}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold uppercase tracking-tight text-foreground whitespace-normal break-words leading-none">
                          {selectedApp.learner.lastName}, {selectedApp.learner.firstName} {selectedApp.learner.middleName}
                        </h2>
                        {selectedApp.learner.sex === "MALE" ? (
                          <Badge variant="outline" className="border-blue-600/30 text-blue-600 bg-blue-50 font-bold text-base px-1 py-1"><Mars className="w-4 h-4" /></Badge>
                        ) : (
                          <Badge variant="outline" className="border-pink-500/30 text-pink-600 bg-pink-50 font-bold text-base px-1 py-1"><Venus className="w-4 h-4" /></Badge>
                        )}
                      </div>
                      <span className="text-sm font-bold text-foreground uppercase">LRN: {selectedApp.learner.lrn || "NO LRN"}</span>
                    </div>
                  </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-6 pt-6 relative w-full overflow-x-hidden">
                  {duplicateInfo && (
                    <div className="mb-8 p-4 rounded-xl border border-rose-200 bg-rose-50 text-left flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-base font-bold text-rose-900">
                          Duplicate Enrollment Sentinel Triggered
                        </p>
                        <p className="text-base text-rose-700 font-bold">
                          A matching active enrollment for this learner was found (Tracking: {duplicateInfo.activeEnrollment?.trackingNumber || "N/A"}, Section: {duplicateInfo.activeEnrollment?.sectionName || "Unassigned"}). Intake is blocked.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedApp.status === "WITHDRAWN" ? (
                    <div className="space-y-4 mb-4">
                      <h3 className="text-base font-bold text-primary uppercase flex items-center gap-2">
                        Application Summary
                      </h3>
                      <div className="w-full bg-white border border-border/50 rounded-sm overflow-hidden shadow-sm flex flex-col">
                        {/* Contact Information */}
                        {(() => {
                          const primaryContact = selectedApp.familyMembers?.find(
                            (m) =>
                              m.relationship === "MOTHER" ||
                              m.relationship === "FATHER" ||
                              m.relationship === "GUARDIAN"
                          ) || selectedApp.familyMembers?.[0];

                          if (primaryContact) {
                            return (
                              <VerificationRow label="Primary Contact">
                                <div className="flex flex-col">
                                  <span className="font-bold text-foreground">{primaryContact.firstName} {primaryContact.lastName}</span>
                                  <span className="text-sm text-foreground uppercase tracking-tight mt-0.5">{primaryContact.relationship}</span>
                                  <span className="text-sm text-foreground mt-0.5">{primaryContact.contactNumber || "N/A"}</span>
                                </div>
                              </VerificationRow>
                            );
                          }
                          return null;
                        })()}

                        {/* Academic Background */}
                        <VerificationRow label="Previous School">
                          {selectedApp.previousSchool?.schoolName || "N/A"}
                        </VerificationRow>
                        <VerificationRow label="Final General Average">
                          {selectedApp.previousSchool?.generalAverage || selectedApp.learner?.previousGenAve || "N/A"}
                        </VerificationRow>
                        {/* Program Assignment */}
                        <VerificationRow label="Requested Curriculum">
                          {SCP_LABELS[selectedApp.applicantType] || selectedApp.applicantType.replace(/_/g, " ")}
                        </VerificationRow>
                        <VerificationRow label="Assigned Program">
                          {SCP_LABELS[assignedProgram] || assignedProgram.replace(/_/g, " ")}
                        </VerificationRow>
                        {/* Required Documents */}
                        <VerificationRow label="Physical SF9 (Report Card)">
                          {!selectedApp.isMissingSf9 ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-700 bg-green-50 uppercase font-bold text-sm">Submitted</Badge>
                          ) : (
                            <span className="text-foreground uppercase font-bold text-sm">Missing</span>
                          )}
                        </VerificationRow>
                        <VerificationRow label="PSA Birth Certificate">
                          {!selectedApp.isMissingPsa ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-700 bg-green-50 uppercase font-bold text-sm">Submitted</Badge>
                          ) : (
                            <span className="text-foreground uppercase font-bold text-sm">Missing</span>
                          )}
                        </VerificationRow>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full bg-white border border-border/50 rounded-sm overflow-hidden shadow-sm mb-2 flex flex-col">
                      {/* Section 1: Contact Information */}
                      {(() => {
                        const primaryContact = selectedApp.familyMembers?.find(
                          (m) =>
                            m.relationship === "MOTHER" ||
                            m.relationship === "FATHER" ||
                            m.relationship === "GUARDIAN"
                        ) || selectedApp.familyMembers?.[0];

                        if (primaryContact) {
                          return (
                            <VerificationRow label="Primary Contact">
                              <div className="flex flex-col">
                                <span className="text-base font-bold text-foreground">{primaryContact.firstName} {primaryContact.lastName}</span>
                                <span className="text-sm text-foreground uppercase tracking-tight mt-0.5">{primaryContact.relationship}</span>
                                <span className="text-sm text-foreground mt-0.5">{primaryContact.contactNumber || "N/A"}</span>
                              </div>
                            </VerificationRow>
                          );
                        }
                        return null;
                      })()}

                      {/* Section 2: Academic History */}
                      <VerificationRow label="Previous School">
                        {selectedApp.previousSchool?.schoolName || "N/A"}
                      </VerificationRow>
                      <VerificationRow label="Final Gen Ave">
                        {selectedApp.previousSchool?.generalAverage || selectedApp.learner?.previousGenAve || "N/A"}
                      </VerificationRow>

                      {/* Section 3: Curriculum Assignment */}
                      {selectedApp.admissionChannel !== "F2F" && (
                        <VerificationRow label="Requested Curriculum">
                          {SCP_LABELS[selectedApp.applicantType] || selectedApp.applicantType.replace(/_/g, " ")}
                        </VerificationRow>
                      )}
                      <VerificationRow label="Official Program">
                        {selectedApp.admissionChannel === "F2F" ||
                        (selectedApp.status !== "PENDING_VERIFICATION" && selectedApp.status !== "FOR_REVISION") ? (
                          <span className="font-bold text-foreground">
                            {SCP_LABELS[assignedProgram] || assignedProgram.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <div className="flex flex-col w-full py-1">
                            <Select value={assignedProgram} onValueChange={setAssignedProgram}>
                              <SelectTrigger className="w-full font-bold h-10 bg-white">
                                <SelectValue placeholder="Select Program" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(SCP_LABELS).map(([value, label]) => {
                                  const show =
                                    value === "REGULAR" ||
                                    (value === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && publicSettings?.steEnabled) ||
                                    (value === "SPECIAL_PROGRAM_IN_THE_ARTS" && publicSettings?.spaEnabled) ||
                                    (value === "SPECIAL_PROGRAM_IN_SPORTS" && publicSettings?.spsEnabled) ||
                                    selectedApp.applicantType === value ||
                                    assignedProgram === value;

                                  if (show) {
                                    return <SelectItem key={value} value={value}>{label}</SelectItem>;
                                  }
                                  return null;
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </VerificationRow>

                      {/* Section 4: Required Documents Verification (Checklist) */}
                      <div className="w-full p-4 sm:p-6 border-t border-border/50 flex flex-col gap-5">
                        <h4 className="flex items-center gap-2 text-base  font-bold text-primary uppercase tracking-tight">
                          Required Documents
                        </h4>

                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="sf9-checkbox"
                            checked={sf9Verified}
                            onCheckedChange={(checked) => setSf9Verified(checked === true)}
                            disabled={isHistoricalReadOnly || (activeTab !== "INCOMPLETE" && activeTab !== "PENDING")}
                            className="mt-1 h-5 w-5 rounded-sm border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor="sf9-checkbox" className="text-base font-bold text-foreground cursor-pointer select-none">
                              Physical SF9 Verified
                            </label>
                            <span className="text-sm text-foreground leading-snug">
                              Original report card signed by previous school principal.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="psa-checkbox"
                            checked={psaVerified}
                            onCheckedChange={(checked) => setPsaVerified(checked === true)}
                            disabled={isHistoricalReadOnly || (activeTab !== "INCOMPLETE" && activeTab !== "PENDING")}
                            className="mt-1 h-5 w-5 rounded-sm border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor="psa-checkbox" className="text-base font-bold text-foreground cursor-pointer select-none">
                              PSA Birth Certificate Verified
                            </label>
                            <span className="text-sm text-foreground leading-snug">
                              Clear copy of Philippine Statistics Authority issued certificate.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                {selectedApp.status === "WITHDRAWN" ? (
                  <div className="p-4 sm:p-6 border-t border-border bg/10 flex gap-4 w-full">
                    <Button
                      variant="ghost"
                      className="w-1/2 h-14 px-8 text-sm sm:text-base leading-tight font-bold uppercase text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                      onClick={() => setDeleteModalOpen(true)}
                      disabled={processing || isHistoricalReadOnly}
                    >
                      Delete Application
                    </Button>
                    <Button
                      className="w-1/2 h-14 px-8 text-sm sm:text-base leading-tight font-bold uppercase bg-primary text-white"
                      onClick={() => setRestoreModalOpen(true)}
                      disabled={processing || isHistoricalReadOnly}
                    >
                      Restore Application
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6 border-t border-border bg/10 flex gap-4 w-full">
                    {(selectedApp.status === "PENDING_VERIFICATION" || selectedApp.status === "FOR_REVISION") && (
                      <Button
                        variant="ghost"
                        className="h-14 w-[35%] text-sm sm:text-base leading-tight font-bold uppercase text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                        onClick={() => setCancelModalOpen(true)}
                        disabled={processing || isHistoricalReadOnly}
                      >
                        Cancel Application
                      </Button>
                    )}
                    {selectedApp.status === "READY_FOR_SECTIONING" && (
                      <Button
                        variant="ghost"
                        className={cn("h-14 text-sm sm:text-base leading-tight font-bold uppercase text-primary hover:bg-primary/15 hover:text-primary/80 border border-primary shrink-0", hasChecklistModifications ? "w-1/2" : "w-full")}
                        onClick={() => setRevertModalOpen(true)}
                        disabled={processing || isHistoricalReadOnly}
                      >
                        Unenroll Learner
                      </Button>
                    )}
                    {(selectedApp.status === "PENDING_VERIFICATION" || selectedApp.status === "FOR_REVISION" || hasChecklistModifications) && (
                      <div className={selectedApp.status === "PENDING_VERIFICATION" || selectedApp.status === "FOR_REVISION" ? "w-[65%]" : "w-1/2"}>
                        {!(sf9Verified && psaVerified) ? (
                          <Button
                            onClick={() => {
                              // For already-enrolled deficient learners: save directly without confirm modal
                              if (selectedApp.status === "READY_FOR_SECTIONING" || selectedApp.status === "OFFICIALLY_ENROLLED") {
                                void updateDeficientDocuments();
                              } else {
                                setConfirmModalState("TEMPORARY");
                              }
                            }}
                            disabled={processing || isHistoricalReadOnly || Boolean(duplicateInfo)}
                            variant="ghost"
                            className="w-full h-14 px-4 text-sm sm:text-base leading-tight font-bold uppercase text-amber-600 hover:bg-amber-600/10 hover:text-amber-700 border-amber-600/30 overflow-hidden"
                          >
                            <span className="truncate">
                              {selectedApp.status === "PENDING_VERIFICATION" || selectedApp.status === "FOR_REVISION" ? "Enroll as Temporary (Missing Docs)" : "Update Changes"}
                            </span>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              // For already-enrolled deficient learners: complete requirements directly
                              if (selectedApp.status === "READY_FOR_SECTIONING" || selectedApp.status === "OFFICIALLY_ENROLLED") {
                                void updateDeficientDocuments();
                              } else {
                                setConfirmModalState("OFFICIAL");
                              }
                            }}
                            disabled={processing || isHistoricalReadOnly || Boolean(duplicateInfo)}
                            className={cn(
                              "w-full h-14 text-sm sm:text-base leading-tight font-bold uppercase transition-all shadow-none overflow-hidden",
                              !duplicateInfo
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                : "bg text-foreground hover:bg opacity-50"
                            )}
                          >
                            {processing ? (
                              <>
                                Saving...
                              </>
                            ) : (
                              <>
                                {selectedApp.status === "PENDING_VERIFICATION" || selectedApp.status === "FOR_REVISION" ? "Officially Enroll" : "Complete Requirements"}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center flex-col gap-4 text-foreground p-8 text-center">
                <div className="w-20 h-20 bg/50 rounded-full flex items-center justify-center mb-2">
                  <Search className="h-10 w-10 text-foreground/40" />
                </div>
                <h3 className="font-bold text-xl text-foreground">No Learner Selected</h3>
                <p className="font-bold text-base leading-tight max-w-[300px]">Select a learner from the left pane to begin verification.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Duplication Sentinel Blocking Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-rose-50 border-b border-rose-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold uppercase text-rose-900">
                Duplicate Profile Detected
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 bg-background space-y-4 text-left">
            <p className="text-base leading-tight font-bold text-rose-900">
              This learner already has an active enrollment record for the current school year. Verification is blocked.
            </p>
            {duplicateInfo && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-base font-bold">
                  <span className="text-foreground">Name:</span>
                  <span className="text-foreground uppercase">
                    {duplicateInfo.lastName}, {duplicateInfo.firstName}
                  </span>
                </div>
                {duplicateInfo.lrn && (
                  <div className="flex justify-between text-base font-bold">
                    <span className="text-foreground">LRN:</span>
                    <span className="text-foreground font-mono">{duplicateInfo.lrn}</span>
                  </div>
                )}
                {duplicateInfo.activeEnrollment && (
                  <>
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-foreground">Tracking Number:</span>
                      <span className="text-foreground font-mono">
                        {duplicateInfo.activeEnrollment.trackingNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-foreground">Active Section:</span>
                      <span className="text-foreground uppercase">
                        {duplicateInfo.activeEnrollment.sectionName || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-foreground">Status:</span>
                      <Badge variant="outline" className="font-bold bg-rose-50 border-rose-200 text-rose-800 text-sm uppercase">
                        {duplicateInfo.activeEnrollment.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 bg/30 border-t border-border flex items-center justify-end">
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-base px-6 shadow-none border-none"
              onClick={() => setShowDuplicateModal(false)}
            >
              Close and Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        open={confirmModalState !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmModalState(null);
        }}
        title={
          confirmModalState === "TEMPORARY"
            ? "Confirm Temporary Enrollment"
            : "Confirm Official Enrollment"
        }
        description={
          confirmModalState === "TEMPORARY"
            ? "This learner has missing requirements and will be temporarily enrolled. They may still proceed to Section Assignment."
            : "All requirements are verified. This learner will be officially enrolled."
        }
        variant={confirmModalState === "TEMPORARY" ? "warning" : "success"}
        confirmText="Enroll"
        loading={processing}
        onConfirm={() => {
          if (confirmModalState === "TEMPORARY") {
            void enrollTemporary();
          } else {
            void approveLearner();
          }
        }}
      />

      <ConfirmationModal
        open={cancelModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCancelModalOpen(false);
            setCancelReason("");
          }
        }}
        title="Cancel Enrollment Application"
        description={
          <div className="space-y-4 text-left">
            <p className="text-foreground">
              Are you sure you want to cancel the application for{" "}
              <strong>
                {selectedApp?.learner.lastName}, {selectedApp?.learner.firstName}
              </strong>
              ? This will remove them from the 'For Review' queue.
            </p>
            <div className="space-y-2 mt-4">
              <label className="text-sm font-bold text-foreground">Cancellation Reason</label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger className="w-full bg-muted font-bold text-base h-12 uppercase">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clerical / Encoding Error (Duplicate)" className="font-bold uppercase">Clerical / Encoding Error (Duplicate)</SelectItem>
                  <SelectItem value="Learner Withdrew Application" className="font-bold uppercase">Learner Withdrew Application</SelectItem>
                  <SelectItem value="Invalid / Missing Credentials" className="font-bold uppercase">Invalid / Missing Credentials</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        variant="danger"
        confirmText="Confirm Cancellation"
        confirmDisabled={!cancelReason}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(cancelReason)}
      />

      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Enrollment Application"
        description={
          <div className="space-y-4 text-left">
            <p className="text-foreground text-center">
              You are about to permanently delete the application for{" "}
              <span className="font-bold">
                {selectedApp?.learner.firstName} {selectedApp?.learner.lastName}
              </span>
              .
            </p>
            <p className="text-foreground text-center">
              This action cannot be undone. All data associated with this application will be removed from the database.
            </p>
          </div>
        }
        variant="danger"
        confirmText="Permanently Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      <ConfirmationModal
        open={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        title="Restore Enrollment Application"
        description={
          <div className="space-y-4 text-left">
            <p className="text-foreground">
              You are about to restore the application for{" "}
              <strong>
                {selectedApp?.learner.lastName}, {selectedApp?.learner.firstName}
              </strong>
              . This will move them back to the 'For Review' queue for active processing.
            </p>
          </div>
        }
        variant="success"
        confirmText="Confirm Restore"
        loading={restoreMutation.isPending}
        onConfirm={() => restoreMutation.mutate()}
      />

      <ConfirmationModal
        open={revertModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRevertModalOpen(false);
            setRevertReason("");
          }
        }}
        title="Revert Enrollment Status"
        description={
          <div className="space-y-4 text-left">
            <p className="text-foreground">
              You are about to reverse the enrollment for{" "}
              <strong>
                {selectedApp?.learner.lastName}, {selectedApp?.learner.firstName}
              </strong>
              . This will remove them from the 'Enrolled' list and place them back into the 'For Review' queue. They will not be available for Section Assignment.
            </p>
            <div className="space-y-2 mt-4">
              <label className="text-sm font-bold text-foreground">Reversal Reason</label>
              <Select value={revertReason} onValueChange={setRevertReason}>
                <SelectTrigger className="w-full bg-muted font-bold text-base h-12 uppercase">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clerical / Encoding Error" className="font-bold uppercase">Clerical / Encoding Error</SelectItem>
                  <SelectItem value="Pending Additional Document Verification" className="font-bold uppercase">Pending Additional Document Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        variant="danger"
        confirmText="Confirm Reversal"
        confirmDisabled={!revertReason}
        loading={revertMutation.isPending}
        onConfirm={() => revertMutation.mutate()}
      />
    </div>
  );
}
