import {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { PersonalInfoSection } from "@/features/learner/components/PersonalInfoSection";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Printer,
  LogOut,
  CheckCircle2,
  Loader2,
  AlertCircle,
  BookOpen,
  Activity,
  Medal,
  FileText,
  Sparkles,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { useLearnerStore } from "@/store/learner.slice";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { motion, AnimatePresence } from "motion/react";
import { Navigate, useNavigate } from "react-router";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import api from "@/shared/api/axiosInstance";
import type { AxiosError } from "axios";
import type { AcademicHistoryEntry } from "@/features/learner/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { cn } from "@/shared/lib/utils";
import {
  formatApplicationStatus,
  formatEosyStatus,
  formatScpType,
} from "@/shared/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

const TLE_REQUIRED_GRADE_DISPLAY_ORDERS = [9, 10];

interface TLEProgram {
  id: number;
  name: string;
  category: string;
}

export default function LearnerPortal() {
  const {
    logoUrl,
    schoolName,
    accentForeground,
    depedEmail,
    isBosyEnrollmentOpen,
    setSettings,
  } = useSettingsStore();
  const { learner, setLearner, logout: clearLearnerData } = useLearnerStore();
  const { token, user, clearAuth } = useLearnerAuthStore();
  const navigate = useNavigate();
  const [showExitModal, setShowExitModal] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [tlePrograms, setTlePrograms] = useState<TLEProgram[]>([]);
  const [selectedTleProgramId, setSelectedTleProgramId] = useState<string>("");
  const [academicHistory, setAcademicHistory] = useState<
    AcademicHistoryEntry[]
  >([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("journey");

  const requiresTle =
    learner?.pendingConfirmation?.gradeLevelDisplayOrder != null &&
    TLE_REQUIRED_GRADE_DISPLAY_ORDERS.includes(
      learner.pendingConfirmation.gradeLevelDisplayOrder,
    );

  const fetchData = useCallback(() => {
    if (!token || user?.role !== "LEARNER") return;
    setProfileLoading(true);
    Promise.all([
      api.get("/learner/profile"),
      api.get("/learner/academic-history"),
    ])
      .then(([profileRes, historyRes]) => {
        setLearner(profileRes.data.learner);
        setAcademicHistory(historyRes.data.history ?? []);
      })
      .catch(() => {
        clearAuth();
        navigate("/learner/login", { replace: true });
      })
      .finally(() => setProfileLoading(false));
  }, [token, user?.role, setLearner, clearAuth, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (logoUrl) return;
    api
      .get("/settings/public")
      .then((res) => {
        setSettings({
          logoUrl: res.data.logoUrl,
          schoolName: res.data.schoolName,
        });
      })
      .catch(() => {});
  }, [logoUrl, setSettings]);

  useEffect(() => {
    if (!requiresTle || !learner?.schoolYear?.id) return;
    api
      .get<{ programs: TLEProgram[] }>("/bosy/tle-programs", { params: { schoolYearId: learner?.schoolYear?.id } })
      .then((res) => setTlePrograms(res.data.programs))
      .catch(() => {});
  }, [requiresTle, learner?.schoolYear?.id]);

  useEffect(() => {
    if (learner?.pendingConfirmation?.tleProgramId) {
      setSelectedTleProgramId(String(learner.pendingConfirmation.tleProgramId));
    }
  }, [learner?.pendingConfirmation?.tleProgramId]);

  const fullLogoUrl = useMemo(() => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith("http")) return logoUrl;
    return `${API_BASE}${logoUrl}`;
  }, [logoUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleExit = async () => {
    try {
      await api.post("/auth/logout-learner");
    } catch {
      // Ignore
    }
    clearLearnerData();
    clearAuth();
    sileo.success({
      title: "Signed Out",
      description: "You have successfully exited the Learner Portal.",
    });
  };

  const handleConfirmReturn = async () => {
    const appId = learner?.pendingConfirmation?.applicationId;
    if (!appId) return;
    if (requiresTle && !selectedTleProgramId) {
      sileo.warning({
        title: "TLE Program Required",
        description: "Please select your TLE specialization before confirming.",
      });
      return;
    }
    setConfirmLoading(true);
    try {
      await api.post("/learner/confirm-return", {
        applicationId: appId,
        ...(requiresTle && selectedTleProgramId
          ? { tleProgramId: Number(selectedTleProgramId) }
          : {}),
      });
      setConfirmed(true);
      sileo.success({
        title: "Return Confirmed!",
        description:
          "Your enrollment return has been confirmed. You are now queued for section assignment.",
      });
      fetchData();
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (!token || user?.role !== "LEARNER") {
    return <Navigate to="/learner/login" replace />;
  }

  if (profileLoading || !learner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- IA Data Processing: Academic Journey ---
  // JHS is Grades 7, 8, 9, 10.
  const grades = [
    { level: 7, name: "Grade 7" },
    { level: 8, name: "Grade 8" },
    { level: 9, name: "Grade 9" },
    { level: 10, name: "Grade 10" },
  ];

  const getAcademicStatus = (gradeLevel: string) => {
    const hist = academicHistory.find((h) => h.gradeLevel.name === gradeLevel);

    // Current grade with posted EOSY result should render as completed, not active.
    if (
      learner.gradeLevel?.name === gradeLevel &&
      hist?.enrollmentRecord?.eosyStatus
    ) {
      return { type: "COMPLETED" as const, data: hist };
    }

    // Current Active Enrollment
    if (learner.gradeLevel?.name === gradeLevel) {
      return { type: "ACTIVE" as const, data: learner };
    }

    // Historical Record
    if (hist) {
      return { type: "COMPLETED" as const, data: hist };
    }
    // Upcoming / Pending Confirmation
    if (learner.pendingConfirmation && !confirmed) {
      const currentLevelStr = String(learner.pendingConfirmation.gradeLevelDisplayOrder);
      const targetLevelName = `Grade ${currentLevelStr}`;
      if (gradeLevel === targetLevelName) {
        return { type: "UPCOMING" as const, data: learner.pendingConfirmation };
      }
    }
    return { type: "EMPTY" as const };
  };

  // REMOVE Grade level card if NO RECORD FOR THIS YEAR
  const filteredGrades = grades
    .filter((g) => getAcademicStatus(g.name).type !== "EMPTY")
    .reverse(); // Show latest first

  const strokeColor = accentForeground === "0 0% 0%" ? "stroke-black" : "stroke-white";
  const latestCompletedRecord = academicHistory.find(
    (entry) => entry.enrollmentRecord?.eosyStatus,
  );
  const latestGradeNumber = parseGradeNumber(latestCompletedRecord?.gradeLevel.name);
  const latestEosyStatus = latestCompletedRecord?.enrollmentRecord?.eosyStatus ?? null;
  const isJhsCompleter =
    latestGradeNumber === 10 && latestEosyStatus === "PROMOTED";
  const nextSchoolYearLabel = getNextSchoolYearLabel(
    latestCompletedRecord?.schoolYear?.yearLabel,
  );
  const derivedTargetGradeNumber =
    latestGradeNumber == null
      ? null
      : latestEosyStatus === "RETAINED"
        ? latestGradeNumber
        : latestGradeNumber + 1;
  const targetGradeLabel =
    learner.pendingConfirmation?.gradeLevelName ??
    (derivedTargetGradeNumber ? `Grade ${derivedTargetGradeNumber}` : "Next Grade");
  const showTransitionBanner = Boolean(
    isBosyEnrollmentOpen &&
      learner.pendingConfirmation?.status === "PENDING_CONFIRMATION" &&
      latestEosyStatus &&
      (latestEosyStatus === "PROMOTED" || latestEosyStatus === "RETAINED") &&
      !isJhsCompleter,
  );
  const showJhsCompletionCard = Boolean(isJhsCompleter);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <ConfirmationModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        title="Exit Learner Portal?"
        description="You will be signed out of your session. Ensure you have saved or printed any records you need before leaving."
        confirmText="Exit Portal"
        variant="danger"
        onConfirm={handleExit}
      />
      {/* Global Background */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: "hsl(var(--accent))" }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pixel-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <rect x="2" y="2" width="36" height="36" rx="2" fill="none" className={strokeColor} strokeWidth="1.5" />
              <rect x="42" y="2" width="36" height="36" rx="2" fill="none" className={strokeColor} strokeWidth="1.5" />
              <rect x="2" y="42" width="36" height="36" rx="2" fill="none" className={strokeColor} strokeWidth="1.5" />
              <rect x="42" y="42" width="36" height="36" rx="2" fill="none" className={strokeColor} strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pixel-grid)" />
        </svg>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)" }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="portal"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="p-4 md:p-8 print:bg-white print:p-0">
          <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:space-y-4">
            {/* Zone A: Persistent Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card backdrop-blur-md p-6 rounded-lg shadow-sm border border-border print:shadow-none print:border-0 print:border-b-2 print:border-foreground print:rounded-none">
              <div className="flex items-center gap-4">
                {fullLogoUrl ? (
                  <img src={fullLogoUrl} alt="School Logo" className="h-16 w-auto object-contain" />
                ) : null}
                <div>
                  <h1 className="text-xl font-black uppercase text-foreground">{schoolName || "MY SCHOOL RECORDS"}</h1>
                  <p className="text-xs text-primary font-black uppercase">Official Learner Portal</p>
                </div>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 font-bold shadow-sm bg-card">
                  <Printer className="h-4 w-4" /> Print / Save PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowExitModal(true)} className="gap-2 font-bold text-foreground hover:text-destructive">
                  <LogOut className="h-4 w-4" /> Exit Portal
                </Button>
              </div>
            </div>

            {/* Zone B: Student Passport Hero Card */}
            <Card className="shadow-xl border-primary/5 bg-card/90 backdrop-blur-xl rounded-lg overflow-hidden print:border-0 print:shadow-none">
              <CardContent className="p-0">
                <PersonalInfoSection
                  learner={learner}
                  profileBadge={
                    isJhsCompleter
                      ? {
                          label: "JHS Completer",
                          className:
                            "bg-primary/10 text-primary ring-1 ring-primary/20",
                        }
                      : null
                  }
                />
              </CardContent>
            </Card>

            {/* Zone C: Navigation Tabs with Animated Pill (EnrollPro Design System) */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full flex h-auto gap-1 mb-6 p-1 bg-card border border-border relative rounded-lg">
                <TabsTrigger
                  value="journey"
                  className="flex-1 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3">
                  {activeTab === "journey" && (
                    <motion.div
                      layoutId="learner-portal-pill"
                      className="absolute inset-0 bg-primary rounded-md"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <div className="relative z-20 flex items-center justify-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>Academic Journey</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="health"
                  className="flex-1 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3">
                  {activeTab === "health" && (
                    <motion.div
                      layoutId="learner-portal-pill"
                      className="absolute inset-0 bg-primary rounded-md"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <div className="relative z-20 flex items-center justify-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span>Health & SF8</span>
                  </div>
                </TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                {activeTab === "journey" && (
                  <motion.div
                    key="journey"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full">
                    <TabsContent value="journey" forceMount className="mt-0 focus-visible:outline-none ring-0">
                      <div className="space-y-4">
                        <TransitionBanner
                          isVisible={showTransitionBanner}
                          nextSchoolYearLabel={nextSchoolYearLabel}
                          targetGradeLabel={targetGradeLabel}
                          isRetained={latestEosyStatus === "RETAINED"}
                          requiresTle={requiresTle}
                          tlePrograms={tlePrograms}
                          selectedTleProgramId={selectedTleProgramId}
                          confirmLoading={confirmLoading}
                          onTleProgramChange={setSelectedTleProgramId}
                          onConfirm={() => void handleConfirmReturn()}
                        />
                        <JhsCompletionCard
                          isVisible={showJhsCompletionCard}
                          schoolYearLabel={latestCompletedRecord?.schoolYear?.yearLabel ?? null}
                          depedEmail={depedEmail}
                          learnerName={`${learner.lastName}, ${learner.firstName}`}
                        />
                        <AcademicJourneyTimeline grades={filteredGrades} getStatus={getAcademicStatus} />
                      </div>
                    </TabsContent>
                  </motion.div>
                )}

                {activeTab === "health" && (
                  <motion.div
                    key="health"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full">
                    <TabsContent value="health" forceMount className="mt-0 focus-visible:outline-none ring-0">
                      <Card className="shadow-xl border-primary/5 bg-card/90 backdrop-blur-xl rounded-lg">
                        <CardContent className="p-8 md:p-10">
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Tabs>

            <div className="text-center pb-12 print:hidden">
              <p className="text-xs text-foreground font-black uppercase opacity-50">EnrollPro Learner Portal • Digital Permanent Record Access</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { margin: 1.5cm; } body { background-color: white !important; } .print\\:hidden { display: none !important; } .shadow-xl, .shadow-sm { box-shadow: none !important; } .border-primary\\/5 { border: none !important; } .bg-white\\/90 { background-color: white !important; } .backdrop-blur-xl { backdrop-filter: none !important; } .rounded-lg { border-radius: 0 !important; } .divide-y > * { page-break-inside: avoid; } }` }} />
    </div>
  );
}

function parseGradeNumber(gradeName?: string | null): number | null {
  if (!gradeName) return null;
  const match = gradeName.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getNextSchoolYearLabel(yearLabel?: string | null): string {
  if (!yearLabel) return "Next School Year";
  const [startYear, endYear] = yearLabel.split("-").map(Number);
  if (Number.isNaN(startYear) || Number.isNaN(endYear)) {
    return "Next School Year";
  }
  return `${startYear + 1}-${endYear + 1}`;
}

// --- Sub-components for Academic Journey ---

function TransitionBanner({
  isVisible,
  nextSchoolYearLabel,
  targetGradeLabel,
  isRetained,
  requiresTle,
  tlePrograms,
  selectedTleProgramId,
  confirmLoading,
  onTleProgramChange,
  onConfirm,
}: {
  isVisible: boolean;
  nextSchoolYearLabel: string;
  targetGradeLabel: string;
  isRetained: boolean;
  requiresTle: boolean;
  tlePrograms: TLEProgram[];
  selectedTleProgramId: string;
  confirmLoading: boolean;
  onTleProgramChange: (value: string) => void;
  onConfirm: () => void;
}) {
  if (!isVisible) return null;

  return (
    <Card className="shadow-xl border-2 border-primary/20 bg-primary/10 rounded-lg overflow-hidden print:hidden">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertCircle className="h-8 w-8 text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-black uppercase text-sm text-primary">
              Beginning of School Year Confirmation
            </p>
            <p className="text-sm text-foreground mt-1">
              {isRetained
                ? `S.Y. ${nextSchoolYearLabel} enrollment is now open. Please confirm your re-enrollment for ${targetGradeLabel}.`
                : `S.Y. ${nextSchoolYearLabel} enrollment is now open. Please confirm your return to secure your slot for ${targetGradeLabel}.`}
            </p>
          </div>
        </div>
        {requiresTle && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase text-primary">
              Select Your TLE Specialization
            </p>
            <Select value={selectedTleProgramId} onValueChange={onTleProgramChange}>
              <SelectTrigger className="bg-card border-primary/20 text-sm">
                <SelectValue placeholder="Choose a TLE program..." />
              </SelectTrigger>
              <SelectContent>
                {tlePrograms.map((program) => (
                  <SelectItem key={program.id} value={String(program.id)}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs"
            disabled={confirmLoading || (requiresTle && !selectedTleProgramId)}
            onClick={onConfirm}>
            {confirmLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm Enrollment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function JhsCompletionCard({
  isVisible,
  schoolYearLabel,
  depedEmail,
  learnerName,
}: {
  isVisible: boolean;
  schoolYearLabel: string | null;
  depedEmail: string | null;
  learnerName: string;
}) {
  if (!isVisible) return null;

  const handleRequest = () => {
    if (!depedEmail) return;
    const subject = encodeURIComponent(`Request for SF9 / Form 137 - ${learnerName}`);
    const body = encodeURIComponent(
      `Good day. I would like to request my SF9 / Form 137 after completing Junior High School for S.Y. ${schoolYearLabel ?? "current school year"}.`,
    );
    window.location.href = `mailto:${depedEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <Card className="shadow-xl border-2 border-primary/20 bg-card rounded-lg overflow-hidden print:hidden">
      <CardContent className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black uppercase text-sm text-primary">
              Junior High School Completed
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Congratulations. Your Grade 10 record for S.Y. {schoolYearLabel ?? "current school year"} is marked as promoted, and your learner profile is now classified as a JHS completer.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-primary/20 text-primary hover:bg-primary/10 font-black uppercase text-xs"
          onClick={handleRequest}
          disabled={!depedEmail}>
          <FileText className="h-4 w-4 mr-2" />
          Request SF9 / Form 137
        </Button>
      </CardContent>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AcademicJourneyTimeline({ grades, getStatus }: { grades: {level: number, name: string}[], getStatus: (name: string) => any }) {
  if (grades.length === 0) {
    return (
      <Card className="shadow-xl border-primary/5 bg-card/90 backdrop-blur-xl rounded-lg p-12 text-center">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
        <p className="text-sm font-bold text-muted-foreground">No Academic Records Available</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible defaultValue={grades[0].name}>
        {grades.map((g) => {
          const status = getStatus(g.name);
          const eosyStatus = status.type === "COMPLETED" ? status.data.enrollmentRecord?.eosyStatus ?? null : null;
          return (
            <AccordionItem key={g.name} value={g.name} className="border-none mb-4">
              <Card className={cn(
                "overflow-hidden transition-all duration-300 border-2",
                status.type === "ACTIVE" ? "border-primary shadow-lg ring-4 ring-primary/5" : "border-transparent shadow-sm bg-card"
              )}>
                <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                  <div className="flex items-center justify-between gap-4 text-left w-full">
                    <div className="flex items-center gap-4 text-left">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm transition-transform group-hover:scale-110",
                        status.type === "ACTIVE" ? "bg-primary text-primary-foreground" : 
                        status.type === "COMPLETED" ? "bg-primary/10 text-primary" :
                        status.type === "UPCOMING" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {g.level}
                      </div>
                      <div>
                        <h3 className="font-black uppercase text-sm text-foreground">{g.name}</h3>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5 tracking-wider">
                          {status.type === "ACTIVE" ? `S.Y. ${status.data.schoolYear?.yearLabel} (Active)` :
                           status.type === "COMPLETED" ? `S.Y. ${status.data.schoolYear?.yearLabel} (Completed)` :
                           status.type === "UPCOMING" ? "Upcoming School Year" : "No record for this year"}
                        </p>
                      </div>
                    </div>
                    {eosyStatus ? <EosyStatusBadge status={eosyStatus} /> : null}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="pt-4 border-t border-dashed border-border">
                    {status.type === "ACTIVE" ? (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                         <Detail
                           label="Section"
                           value={status.data.enrollment?.section?.name || "To Be Assigned"}
                         />
                         <Detail
                           label="Class Adviser"
                           value={
                             status.data.enrollment?.section?.advisingTeacher
                               ? `${status.data.enrollment.section.advisingTeacher.lastName}, ${status.data.enrollment.section.advisingTeacher.firstName}`
                               : "To Be Announced"
                           }
                         />
                         <Detail
                           label="Curriculum"
                           value={formatScpType(status.data.curriculum || "REGULAR")}
                         />
                         <Detail label="Status" value={formatApplicationStatus(status.data.status)} />
                       </div>
                    ) : status.type === "COMPLETED" ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          <Detail label="Section" value={status.data.enrollmentRecord?.section?.name || "N/A"} />
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                              Year-End Status
                            </span>
                            <EosyStatusBadge status={status.data.enrollmentRecord?.eosyStatus || null} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Detail label="Final Average" value={status.data.enrollmentRecord?.finalAverage != null ? Number(status.data.enrollmentRecord.finalAverage).toFixed(2) : "N/A"} highlight />
                            {status.data.enrollmentRecord?.finalAverage != null && (
                              <HonorBadge average={status.data.enrollmentRecord.finalAverage} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : status.type === "UPCOMING" ? (
                        <div className="p-8 text-center bg-primary/5 rounded-lg border border-dashed border-primary/20">
                          <p className="text-sm font-bold text-primary uppercase">Pending Confirmation</p>
                          <p className="text-xs text-muted-foreground mt-1 font-bold">Please confirm your intent to return in the action banner above.</p>
                       </div>
                    ) : null}
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function EosyStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase text-muted-foreground">
        N/A
      </span>
    );
  }

  const badgeClass =
    status === "PROMOTED"
      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
      : status === "CONDITIONALLY_PROMOTED"
        ? "bg-secondary text-secondary-foreground ring-1 ring-border"
        : status === "RETAINED"
          ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
          : "bg-muted text-muted-foreground ring-1 ring-border";

  return (
    <span className={cn("inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase", badgeClass)}>
      {formatEosyStatus(status)}
    </span>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{label}</span>
      <span className={cn("text-sm font-black uppercase mt-1", highlight ? "text-primary" : "text-foreground")}>{value}</span>
    </div>
  );
}

function HonorBadge({ average }: { average: number }) {
  let medalColor: string;
  let text: string;

  if (average >= 98 && average <= 100) {
    medalColor = "text-primary";
    text = "WITH HIGHEST HONORS";
  } else if (average >= 95 && average < 98) {
    medalColor = "text-foreground";
    text = "WITH HIGH HONORS";
  } else if (average >= 90 && average < 95) {
    medalColor = "text-primary";
    text = "WITH HONORS";
  } else {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-card border border-border rounded-lg shadow-sm w-fit animate-in fade-in zoom-in duration-500 ring-2 ring-primary/5">
      <Medal className={cn("h-4 w-4", medalColor)} />
      <span className="text-[9px] font-black text-foreground tracking-tighter">{text}</span>
    </div>
  );
}

<Card className="shadow-md border border-gray-200 bg-white p-6">
  <CardHeader>
    <CardTitle className="text-lg font-bold text-center">
      Welcome to Hinigaran National High School
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-center font-medium">
      Step 1: Confirmation of Return
    </p>
  </CardContent>
</Card>
