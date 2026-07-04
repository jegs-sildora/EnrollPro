import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import {
  Search,
  CheckCircle2,
  Loader2,
  FileText,
  User as UserIcon,
  Clock,
  School,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import api from "@/shared/api/axiosInstance";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { cn } from "@/shared/lib/utils";
import { WalkInEncodePanel } from "./WalkInEncodePanel";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

interface PendingVerification {
  id: number;
  learnerId: number;
  trackingNumber: string | null;
  status: string;
  createdAt: string;
  learner: {
    id: number;
    firstName: string;
    lastName: string;
    middleName: string | null;
    lrn: string | null;
    sex: "MALE" | "FEMALE";
    previousGenAve?: number | null;
    birthdate: string;
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
}

const getGradeColorClasses = (gradeName: string) => {
  const name = gradeName.toUpperCase();
  if (name.includes("7")) return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
  if (name.includes("8")) return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
  if (name.includes("9")) return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
  if (name.includes("10")) return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
  return "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100/80";
};

const SCP_LABELS: Record<string, string> = {
  REGULAR: "Regular Basic Education",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology & Engineering (STE)",
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

export function VerificationWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const queryClient = useQueryClient();

  const [processing, setProcessing] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  const [sf9Verified, setSf9Verified] = useState(false);
  const [psaVerified, setPsaVerified] = useState(false);
  const [assignedProgram, setAssignedProgram] = useState<string>("REGULAR");

  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
  } = useDebouncedSearch();

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
    if (!activeSearchQuery) return pendingVerifications;
    const q = activeSearchQuery.toLowerCase();
    return pendingVerifications.filter(app => {
      const tracking = app.trackingNumber?.toLowerCase() || "";
      const lrn = app.learner.lrn?.toLowerCase() || "";
      const fullName = `${app.learner.lastName} ${app.learner.firstName}`.toLowerCase();
      return tracking.includes(q) || lrn.includes(q) || fullName.includes(q);
    });
  }, [pendingVerifications, activeSearchQuery]);

  const selectedApp = useMemo(() => {
    return pendingVerifications.find(app => app.id === selectedAppId);
  }, [pendingVerifications, selectedAppId]);

  // Sync assigned program when selection changes
  useMemo(() => {
    if (selectedApp) {
      setAssignedProgram(selectedApp.applicantType);
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

  // Effect to auto-select if only 1 exact match via search
  useMemo(() => {
    if (activeSearchQuery && filteredVerifications.length === 1) {
      if (selectedAppId !== filteredVerifications[0].id) {
        setSelectedAppId(filteredVerifications[0].id);
        setSf9Verified(false);
        setPsaVerified(false);
      }
    }
  }, [activeSearchQuery, filteredVerifications, selectedAppId]);

  const handleSelect = (appId: number) => {
    setSelectedAppId(appId);
    setSf9Verified(false);
    setPsaVerified(false);
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
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
    } catch (err: any) {
      sileo.error({
        title: "Verification Failed",
        description: err.response?.data?.message || "An error occurred while verifying the learner.",
      });
    } finally {
      setProcessing(false);
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
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
    } catch (err: any) {
      sileo.error({
        title: "Temporary Enrollment Failed",
        description: err.response?.data?.message || "An error occurred while temporarily enrolling the learner.",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-base leading-tight font-extrabold text-slate-500 uppercase tracking-widest animate-pulse">
            Loading Verifications...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6 min-h-0">
      {/* Search Bar */}
      <div className="flex items-center gap-3 p-1 -mx-1 -mt-1">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Enter LRN/Name..."
            className="pl-12 h-14 text-lg border-2 border-border focus-visible:ring-primary/20 bg-card shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
        {!isHistoricalReadOnly && (
          <WalkInEncodePanel />
        )}
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* LEFT PANE: PENDING VERIFICATION LIST */}
        <Card className="w-[30%] flex flex-col shadow-sm border border-border overflow-hidden bg-card shrink-0">
          <CardHeader className="border-b border-border bg-muted/20 py-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base leading-tight font-extrabold uppercase tracking-wide flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Pending Verification
              </CardTitle>
              <Badge variant="outline" className="font-extrabold bg-background border-border">
                {filteredVerifications.length} Queue
              </Badge>
            </div>
          </CardHeader>
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {filteredVerifications.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col gap-3 text-muted-foreground p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
                <span className="font-extrabold text-base leading-tight">No pending verifications found.</span>
              </div>
            ) : (
              filteredVerifications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => handleSelect(app.id)}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 transition-all relative overflow-hidden",
                    selectedAppId === app.id
                      ? getGradeCardClasses(app.gradeLevel.name)
                      : "bg-background hover:bg-muted/50 border-border"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={cn("font-extrabold text-base leading-tight uppercase tracking-tight", selectedAppId === app.id ? getGradeTextColor(app.gradeLevel.name) : "text-foreground")}>
                      {app.learner.lastName}, {app.learner.firstName}
                    </h4>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className={cn("text-[10px] uppercase font-extrabold", getGradeColorClasses(app.gradeLevel.name))}>
                      {app.gradeLevel.name}
                    </Badge>
                    <div className="flex items-center text-[10px] text-muted-foreground font-extrabold">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(app.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* RIGHT PANE: DETAIL VIEW & ACTIONS */}
        <Card className="flex-1 flex flex-col shadow-sm border border-border overflow-hidden bg-card text-card-foreground">
          {selectedApp ? (
            <>
              <div className="flex-1 overflow-auto p-8 relative">
                <div className={cn("mb-8 p-6 rounded-xl border border-border/50 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between", getGradeCardClasses(selectedApp.gradeLevel.name))}>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-extrabold uppercase tracking-tight text-foreground">
                      {selectedApp.learner.lastName}, {selectedApp.learner.firstName} {selectedApp.learner.middleName}
                    </h2>
                    {selectedApp.learner.sex === "MALE" ? (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-50 uppercase font-extrabold text-base">MALE</Badge>
                    ) : (
                      <Badge variant="outline" className="border-pink-500/30 text-pink-600 bg-pink-50 uppercase font-extrabold text-base">FEMALE</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-base leading-tight font-extrabold text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" /> TRK: <span className="text-foreground">{selectedApp.trackingNumber || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <UserIcon className="w-4 h-4" /> LRN: <span className="text-foreground">{selectedApp.learner.lrn || "NO LRN"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <School className="w-4 h-4" /> Incoming <Badge variant="outline" className={cn("font-extrabold uppercase ml-1 text-base", getGradeColorClasses(selectedApp.gradeLevel.name))}>{selectedApp.gradeLevel.name}</Badge>
                    </div>
                  </div>

                  {/* GLANCEABLE CONTACT SNAPSHOT */}
                  {(() => {
                    const primaryContact = selectedApp.familyMembers?.find(
                      (m) =>
                        m.relationship === "MOTHER" ||
                        m.relationship === "FATHER" ||
                        m.relationship === "GUARDIAN"
                    ) || selectedApp.familyMembers?.[0];

                    if (primaryContact) {
                      return (
                        <div className="mt-4 flex items-center justify-between bg-muted/20 border border-border/50 rounded-lg p-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-widest">Primary Contact</span>
                            <span className="text-base leading-tight font-extrabold text-foreground">
                              {primaryContact.lastName}, {primaryContact.firstName}
                            </span>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col text-right">
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-widest">Relationship</span>
                              <Badge variant="secondary" className="text-[10px] font-extrabold uppercase">{primaryContact.relationship}</Badge>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-widest">Contact Number</span>
                              <span className="text-base leading-tight font-extrabold text-foreground">{primaryContact.contactNumber || "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {duplicateInfo && (
                  <div className="mb-8 p-4 rounded-xl border border-rose-200 bg-rose-50 text-left flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-base font-extrabold text-rose-900">
                        Duplicate Enrollment Sentinel Triggered
                      </p>
                      <p className="text-base text-rose-700 font-extrabold">
                        A matching active enrollment for this learner was found (Tracking: {duplicateInfo.activeEnrollment?.trackingNumber || "N/A"}, Section: {duplicateInfo.activeEnrollment?.sectionName || "Unassigned"}). Intake is blocked.
                      </p>
                    </div>
                  </div>
                )}

                {(selectedApp.previousSchool || selectedApp.learner?.previousGenAve) && (
                  <div className="space-y-4 mb-8">
                    <h3 className="text-base font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                      <School className="w-4 h-4" /> Academic History
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-widest mb-1">School Name</p>
                        <p className="text-base leading-tight font-extrabold">{selectedApp.previousSchool?.schoolName || "N/A"}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <p className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-widest mb-1">General Average</p>
                        <p className="text-base leading-tight font-extrabold">{selectedApp.previousSchool?.generalAverage || selectedApp.learner?.previousGenAve || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 mb-8">
                  <h3 className="text-base font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                    <School className="w-4 h-4" /> Curriculum Assignment
                  </h3>
                  <div className="bg-muted/10 border border-border/50 rounded-xl p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Requested Program (From Online Form)</label>
                        <div className="h-10 px-3 py-2 bg-muted/50 rounded-md border border-border flex items-center text-base leading-tight text-muted-foreground font-semibold">
                          {selectedApp.applicantType.replace(/_/g, " ")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Official Program Assignment</label>
                        <Select value={assignedProgram} onValueChange={setAssignedProgram}>
                          <SelectTrigger className="w-full font-extrabold">
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
                    </div>
                    {assignedProgram !== "REGULAR" && (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200/50 mt-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="text-base font-extrabold">Requires manual verification against the official SCP passers list.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-extrabold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Required Documents
                  </h3>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-6">
                    <label className="flex items-start gap-4 cursor-pointer group">
                      <Checkbox
                        className="mt-1 w-6 h-6 border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        checked={sf9Verified}
                        onCheckedChange={(c) => setSf9Verified(!!c)}
                      />
                      <div className="space-y-1">
                        <p className="text-base font-extrabold group-hover:text-primary transition-colors">Physical SF9 Verified</p>
                        <p className="text-base font-semibold text-muted-foreground">Original report card signed by previous school principal.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-4 cursor-pointer group">
                      <Checkbox
                        className="mt-1 w-6 h-6 border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        checked={psaVerified}
                        onCheckedChange={(c) => setPsaVerified(!!c)}
                      />
                      <div className="space-y-1">
                        <p className="text-base font-extrabold group-hover:text-primary transition-colors">PSA Birth Certificate Verified</p>
                        <p className="text-base font-semibold text-muted-foreground">Clear copy of Philippine Statistics Authority issued certificate.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 sm:p-6 border-t border-border bg-muted/10 flex items-center gap-4">
                {!(sf9Verified && psaVerified) && (
                  <Button
                    onClick={enrollTemporary}
                    disabled={processing || isHistoricalReadOnly || Boolean(duplicateInfo)}
                    variant="outline"
                    className="h-14 px-8 text-base leading-tight font-extrabold uppercase tracking-widest text-amber-600 hover:bg-amber-600/10 hover:text-amber-700 border-amber-600/30"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Enroll as Temporary (Missing Docs)
                  </Button>
                )}

                <Button
                  onClick={approveLearner}
                  disabled={!sf9Verified || !psaVerified || processing || isHistoricalReadOnly || Boolean(duplicateInfo)}
                  className={cn(
                    "flex-1 h-14 text-base leading-tight font-extrabold uppercase tracking-widest transition-all shadow-none",
                    sf9Verified && psaVerified && !duplicateInfo
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted opacity-50"
                  )}
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Officially Enroll
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center flex-col gap-4 text-muted-foreground p-8 text-center">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-2">
                <Search className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="font-extrabold text-xl text-foreground">No Learner Selected</h3>
              <p className="font-extrabold text-base leading-tight max-w-[300px]">Scan a tracking number or select a learner from the left pane to begin verification.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Duplication Sentinel Blocking Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-rose-50 border-b border-rose-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-extrabold uppercase text-rose-900">
                Duplicate Profile Detected
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 bg-background space-y-4 text-left">
            <p className="text-base leading-tight font-extrabold text-rose-900">
              This learner already has an active enrollment record for the current school year. Verification is blocked.
            </p>
            {duplicateInfo && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-base font-extrabold">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="text-foreground uppercase">
                    {duplicateInfo.lastName}, {duplicateInfo.firstName}
                  </span>
                </div>
                {duplicateInfo.lrn && (
                  <div className="flex justify-between text-base font-extrabold">
                    <span className="text-muted-foreground">LRN:</span>
                    <span className="text-foreground font-mono">{duplicateInfo.lrn}</span>
                  </div>
                )}
                {duplicateInfo.activeEnrollment && (
                  <>
                    <div className="flex justify-between text-base font-extrabold">
                      <span className="text-muted-foreground">Tracking Number:</span>
                      <span className="text-foreground font-mono">
                        {duplicateInfo.activeEnrollment.trackingNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold">
                      <span className="text-muted-foreground">Active Section:</span>
                      <span className="text-foreground uppercase">
                        {duplicateInfo.activeEnrollment.sectionName || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="font-extrabold bg-rose-50 border-rose-200 text-rose-800 text-[11px] uppercase">
                        {duplicateInfo.activeEnrollment.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end">
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase text-base px-6 shadow-none border-none"
              onClick={() => setShowDuplicateModal(false)}
            >
              Close and Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
