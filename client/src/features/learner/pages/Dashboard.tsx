import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  LogOut,
  AlertTriangle,
  ChevronDown,
  Menu,
  LayoutDashboard as DashboardIcon,
  BookOpen,
  User,
  Sun,
  Moon,
} from "lucide-react";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { useThemeStore } from "@/store/theme.slice";
import axios from "axios";
import { getLearnerApi } from "@/shared/api/axiosInstance";

import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/shared/ui/button";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { SCP_LABELS, cn } from "@/shared/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";


interface LearnerAddress {
  houseNoStreet: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
}

interface LearnerFamilyMember {
  firstName: string;
  lastName: string;
  contactNumber: string | null;
  relationship: string;
}

interface SubjectGrades {
  Q1?: number | null;
  Q2?: number | null;
  Q3?: number | null;
  Q4?: number | null;
  T1?: number | null;
  T2?: number | null;
  T3?: number | null;
  term1?: number | null;
  term2?: number | null;
  term3?: number | null;
  Final?: number | null;
  remarks?: string | null;
}

import type { AcademicHistory } from "@/shared/components/AcademicHistoryAccordion";

interface LearnerDashboardResponse {
  identity: {
    lrn: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    extensionName: string | null;
  };
  enrollment: {
    status: string;
    gradeLevel: string | null;
    section: string | null;
    academicStatus: string | null;
    curriculumProgram: string | null;
    advisingTeacher: string | null;
  };
  sf1: {
    birthdate: string;
    sex: string;
    placeOfBirth: string | null;
    religion: string | null;
    motherTongue: string | null;
    psaBirthCertNumber: string | null;
    studentPhoto: string | null;
    isIpCommunity: boolean;
    ipGroupName: string | null;
    is4PsBeneficiary: boolean;
    householdId4Ps: string | null;
    email: string | null;
    mobileNumber: string | null;
    permanentAddress: LearnerAddress | null;
    currentAddress: LearnerAddress | null;
    mother: LearnerFamilyMember | null;
    father: LearnerFamilyMember | null;
    guardian: LearnerFamilyMember | null;
  };
  academicHistory: AcademicHistory[];
  isEnrollmentActive: boolean;
  activeSchoolYear: string;
  activeTermFormat?: string;
  schoolName: string;
  schoolAcronym: string;
  schoolLogoUrl: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", {
    timeZone: 'Asia/Manila',
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SectionItem({ label, value, valueClassName }: { label: string; value: string | null | undefined; valueClassName?: string }) {
  return (
    <>
      <div className="bg-muted text-foreground font-bold text-base uppercase px-4 py-2 border-r border-border flex items-center">
        {label}
      </div>
      <div className={`bg-card text-base leading-tight font-bold text-foreground px-4 py-2 border-r border-border last:border-0 flex items-center ${valueClassName || ''}`}>
        {(!value || value === "-" || value === "") ? (
          <span className="text-foreground italic font-semibold">
            Not Specified
          </span>
        ) : (
          <span className="uppercase">{value}</span>
        )}
      </div>
    </>
  );
}

import { AcademicHistoryAccordion } from "@/shared/components/AcademicHistoryAccordion";

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const { user, token, clearAuth } = useLearnerAuthStore();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [currentTimestamp] = useState(() => Date.now());
  const [data, setData] = useState<LearnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("sf9");

  const handleNavClick = (tabKey: string, elementId?: string) => {
    setActiveTab(tabKey);
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      const targetId = elementId ?? (tabKey + "-section");
      const element = document.getElementById(targetId) || document.getElementById("dashboard-overview");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 150);
  };

  useEffect(() => {
    if (!token) return;
    const api = getLearnerApi(token);
    api
      .get<LearnerDashboardResponse>("/learner/dashboard-unified")
      .then((res) => setData(res.data))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          clearAuth();
          navigate("/learner/login", { replace: true });
        } else {
          setError("Failed to load dashboard data. Please try again later.");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (!user || !token) {
    return <Navigate to="/learner/login" replace />;
  }

  const handleLogout = () => {
    clearAuth();
    navigate("/learner/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background relative">
      <svg
        className="fixed inset-0 h-full w-full opacity-[0.08] pointer-events-none z-0 print:hidden"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="learner-dashboard-pixel-grid"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#learner-dashboard-pixel-grid)" />
      </svg>
      <header className="sticky top-0 z-50 w-full bg-muted border-b border-border shadow-sm print:hidden">
        <div className="w-full flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9 text-foreground hover:bg-muted"
                  aria-label="Open mobile navigation"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              {data && (
                <SheetContent side="left" className="w-[85vw] sm:max-w-[380px] p-6 overflow-y-auto bg-[hsl(var(--background))] border-r border-border flex flex-col justify-between" aria-describedby="mobile-nav-description">
                  <div>
                    <SheetHeader className="pb-4 border-b border-border text-left">
                      <SheetTitle className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        {data.schoolLogoUrl ? (
                          <img src={data.schoolLogoUrl} alt="School Seal" className="h-7 w-7 object-contain shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary-foreground">
                              {data.schoolAcronym?.slice(0, 2) || "EP"}
                            </span>
                          </div>
                        )}
                        <span>{data.schoolAcronym} Learner Information System</span>
                      </SheetTitle>
                      <SheetDescription id="mobile-nav-description">
                        Navigate academic records and verify student identity profile.
                      </SheetDescription>
                    </SheetHeader>

                    <div className="py-4 space-y-2 border-b border-border">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Quick Navigation</span>
                      <div className="flex flex-col gap-1 mt-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-bold text-base h-11 px-3 gap-3 text-foreground hover:bg-muted/60"
                          onClick={() => handleNavClick("sf9", "dashboard-overview")}
                        >
                          <DashboardIcon className="h-5 w-5 text-primary shrink-0" />
                          <span>Dashboard Overview</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-bold text-base h-11 px-3 gap-3 text-foreground hover:bg-muted/60"
                          onClick={() => handleNavClick("sf9", "sf9-section")}
                        >
                          <BookOpen className="h-5 w-5 text-primary shrink-0" />
                          <span>Official School Form 9 (SF9)</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-bold text-base h-11 px-3 gap-3 text-foreground hover:bg-muted/60"
                          onClick={() => handleNavClick("sf1", "sf1-section")}
                        >
                          <User className="h-5 w-5 text-primary shrink-0" />
                          <span>Official Learner Profile (SF1)</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-bold text-base h-11 px-3 gap-3 text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => setShowLogoutConfirm(true)}
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Secure Sign Out</span>
                        </Button>
                      </div>
                    </div>

                    <div className="py-6 flex flex-col items-center w-full">
                      <div className="w-28 h-28 sm:w-32 sm:h-32 object-cover bg-primary shadow-sm outline-2 outline-dashed outline-primary rounded-full mb-4 flex items-center justify-center overflow-hidden shrink-0">
                        {data.sf1.studentPhoto ? (
                          <img src={data.sf1.studentPhoto} alt="Learner Photo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl font-bold text-primary-foreground tracking-tighter uppercase">
                            {data.identity.firstName.charAt(0)}{data.identity.lastName.charAt(0)}
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-bold text-foreground uppercase text-center leading-tight">
                        {data.identity.firstName} {data.identity.middleName}  {data.identity.lastName}
                      </h2>
                      <p className="text-base leading-tight font-bold text-foreground text-center mt-1">
                        LRN: {data.identity.lrn}
                      </p>

                      <hr className="w-full border-t border-border/60 my-4" />

                      <div className="flex flex-col items-center text-center w-full space-y-1 uppercase">
                        <p className="text-lg font-bold text-primary">
                          {data.enrollment.gradeLevel || "Not Enrolled"} - {data.enrollment.section || "Unsectioned"}
                        </p>
                        <p className="text-base font-bold text-foreground">
                          {data.enrollment.curriculumProgram
                            ? (SCP_LABELS[data.enrollment.curriculumProgram] || data.enrollment.curriculumProgram)
                            : "Basic Education Curriculum"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full pt-4 border-t border-border/50 flex flex-col items-center text-center mt-auto">
                    <span className="font-bold text-sm uppercase text-foreground">
                      Official Class Adviser
                    </span>
                    <p className="text-lg font-bold text-foreground mt-1 uppercase">
                      {data.enrollment.advisingTeacher || "To Be Assigned"}
                    </p>
                  </div>
                </SheetContent>
              )}
            </Sheet>
            {data?.schoolLogoUrl ? (
              <img src={data.schoolLogoUrl} alt="School Seal" className="h-8 w-8 object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-base font-bold text-primary-foreground">
                  {data?.schoolAcronym?.slice(0, 2) || "HN"}
                </span>
              </div>
            )}
            <span className="font-bold text-xl text-foreground tracking-tight">
              {data?.schoolAcronym || "HNHS"} Learner Information System
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-foreground hover:bg-muted transition-colors relative"
              aria-label="Toggle theme lighting state"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-primary" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-slate-200" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLogoutConfirm(true)}
              className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
              aria-label="Sign out"
            >  <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row w-full min-h-[calc(100vh-56px)] md:h-[calc(100vh-56px)] overflow-hidden bg-background relative z-10 print:h-auto print:overflow-visible">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center gap-3 shadow-md">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-base leading-tight text-destructive ">{error}</p>
          </div>
        )}

        {loading ? (
          <PageLoadingSkeleton variant="learnerProfile" className="gap-0 w-full h-full" />
        ) : error ? (
          <div className="flex-1 w-full p-4 sm:p-6 flex flex-col items-center justify-center min-h-[50vh]">
            <div className="bg-destructive/10 border border-destructive/20 p-6 rounded-xl max-w-md text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-bold text-foreground mb-2">Dashboard Error</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="font-bold w-full">
                Refresh Page
              </Button>
            </div>
          </div>
        ) : data && (
          <>
            {/* Left Pane (Fixed Identity Sidebar) */}
            <aside className="hidden md:flex md:w-[30%] bg-muted/30 md:border-r border-border md:h-full flex-col justify-between py-8 px-6 sm:py-12 overflow-y-auto shrink-0">
              <div className="flex flex-col items-center w-full">
                <div className="w-36 h-36 sm:w-40 sm:h-40 object-cover bg-primary shadow-sm outline-2 outline-dashed outline-primary rounded-full mb-5 sm:mb-6 flex items-center justify-center overflow-hidden shrink-0">
                  {data.sf1.studentPhoto ? (
                    <img src={data.sf1.studentPhoto} alt="Learner Photo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl font-bold text-primary-foreground tracking-tighter uppercase">
                      {data.identity.firstName.charAt(0)}{data.identity.lastName.charAt(0)}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-foreground uppercase text-center leading-tight">
                  {data.identity.firstName} {data.identity.middleName}  {data.identity.lastName}
                </h2>
                <p className="text-xl leading-tight font-bold text-foreground text-center mt-1">
                  LRN: {data.identity.lrn}
                </p>

                <hr className="w-full border-t border-border/60 my-6" />

                <div className="flex flex-col items-center text-center w-full space-y-1 uppercase">
                  <p className="text-xl font-bold text-primary">
                    {data.enrollment.gradeLevel || "Not Enrolled"} - {data.enrollment.section || "Unsectioned"}
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {data.enrollment.curriculumProgram
                      ? (SCP_LABELS[data.enrollment.curriculumProgram] || data.enrollment.curriculumProgram)
                      : "Basic Education Curriculum"}
                  </p>
                </div>
              </div>

              <div className="w-full mt-8 pt-4 border-t border-border/50 flex flex-col items-center text-center">
                <span className="font-bold uppercase text-foreground">
                  Official Class Adviser
                </span>
                <p className="text-xl font-bold text-foreground mt-1 uppercase">
                  {data.enrollment.advisingTeacher || "To Be Assigned"}
                </p>
              </div>
            </aside>

            {/* Right Pane (Flat Document Canvas) */}
            <main className="w-full md:w-[60%] lg:w-[70%] flex-1 h-full overflow-y-auto px-4 py-6 lg:px-12 lg:py-8 space-y-12">
              <div id="dashboard-overview" className="mb-6 mt-4">
                <h1 className="text-3xl font-bold text-foreground">Learner Profile</h1>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-6 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
                  <TabsTrigger
                    value="sf9"
                    className="flex-1 min-w-25 py-3 px-3 text-sm sm:text-base font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
                  >
                    {activeTab === "sf9" && (
                      <motion.div
                        layoutId="learner-dashboard-active-pill"
                        className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span className={cn("relative z-20 flex items-center justify-center gap-2 uppercase", activeTab === "sf9" ? "text-primary-foreground" : "text-foreground")}>
                      <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                      <span className="truncate">Historical Academic Records (SF9)</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="sf1"
                    className="flex-1 min-w-25 py-3 px-3 text-sm sm:text-base font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
                  >
                    {activeTab === "sf1" && (
                      <motion.div
                        layoutId="learner-dashboard-active-pill"
                        className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span className={cn("relative z-20 flex items-center justify-center gap-2 uppercase", activeTab === "sf1" ? "text-primary-foreground" : "text-foreground")}>
                      <User className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                      <span className="truncate">Official Learner Profile (SF1)</span>
                    </span>
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  {activeTab === "sf9" && (
                    <motion.div
                      key="sf9"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      {/* Section 3: The Digital SF9 */}
                      <TabsContent value="sf9" forceMount className="mt-0 focus-visible:outline-none ring-0">
                        <div id="sf9-section" className="bg-background border border-border shadow-sm rounded-sm p-6 mb-8 print:break-inside-avoid space-y-5">
                          <div className="bg-transparent pb-0 print:bg-transparent">
                            <div className="mb-8 mt-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <h3 className="text-2xl font-bold text-gray-900 uppercase dark:text-foreground">
                                    Official School Form 9 (SF9) - Historical Academic Records
                                  </h3>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="pb-8">
                            {data.academicHistory && data.academicHistory.length > 0 ? (
                              data.academicHistory.map((history, idx) => (
                                <AcademicHistoryAccordion
                                  key={idx}
                                  history={history}
                                  isDefaultOpen={history.status === "Active"}
                                />
                              ))
                            ) : (
                              <div className="text-center text-foreground py-8">
                                No academic records available.
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </motion.div>
                  )}

                  {activeTab === "sf1" && (
                    <motion.div
                      key="sf1"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      {/* Section 4: The Learner Profile (SF1) */}
                      <TabsContent value="sf1" forceMount className="mt-0 focus-visible:outline-none ring-0">
                        <div id="sf1-section" className="bg-background border border-border shadow-sm rounded-sm p-6 mb-8 print:break-inside-avoid space-y-5">
                          <div className="bg-transparent pb-0 print:bg-transparent">
                            <div className="mb-8 mt-0 flex items-center gap-3">
                              <h3 className="text-2xl font-bold text-gray-900 uppercase dark:text-foreground">
                                Official Learner Profile
                              </h3>
                            </div>
                          </div>
                          <div className="space-y-4">
                            {/* Sub-Section 1: Learner Demographics */}
                            <div className="mb-8">
                              <h3 className="text-lg font-bold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">I. LEARNER IDENTITY</h3>
                              <div className="border border-border rounded-sm overflow-hidden overflow-x-auto flex flex-col">
                                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                  <SectionItem label="Sex" value={data.sf1.sex === "MALE" ? "Male" : "Female"} />
                                  <SectionItem label="Date of Birth" value={formatDate(data.sf1.birthdate)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                  <SectionItem label="Place of Birth" value={data.sf1.placeOfBirth || null} />
                                  <SectionItem label="Age" value={`${Math.floor((currentTimestamp - new Date(data.sf1.birthdate).getTime()) / 31557600000)} years old`} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                  <SectionItem label="Religion" value={data.sf1.religion || null} />
                                  <SectionItem label="Mother Tongue" value={data.sf1.motherTongue || null} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                  <SectionItem label="IP Group Status" value={data.sf1.isIpCommunity ? `Yes (${data.sf1.ipGroupName || 'Not specified'})` : "No"} />
                                  <SectionItem label="4Ps Beneficiary" value={data.sf1.is4PsBeneficiary ? "Yes" : "No"} />
                                </div>
                              </div>
                            </div>

                            {/* Sub-Section 2: Address & Contact Details */}
                            <div className="mb-8">
                              <h3 className="text-lg font-bold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">II. CURRENT RESIDENCY</h3>
                              <div className="border border-border rounded-sm overflow-hidden overflow-x-auto flex flex-col">
                                <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border last:border-0">
                                  <SectionItem label="Permanent Home Address" value={
                                    data.sf1.permanentAddress ?
                                      `${data.sf1.permanentAddress.houseNoStreet || ''} ${data.sf1.permanentAddress.barangay || ''}, ${data.sf1.permanentAddress.cityMunicipality || ''}, ${data.sf1.permanentAddress.province || ''}`.replace(/\s+/g, ' ').trim() : null
                                  } />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border last:border-0">
                                  <SectionItem label="Current Home Address" value={
                                    (() => {
                                      if (!data.sf1.permanentAddress && !data.sf1.currentAddress) return null;
                                      if (!data.sf1.currentAddress) return "Same as Permanent Address";
                                      return `${data.sf1.currentAddress.houseNoStreet || ''} ${data.sf1.currentAddress.barangay || ''}, ${data.sf1.currentAddress.cityMunicipality || ''}, ${data.sf1.currentAddress.province || ''}`.replace(/\s+/g, ' ').trim();
                                    })()
                                  } />
                                </div>
                              </div>
                            </div>

                            {/* Sub-Section 3: Parent & Guardian Information */}
                            <div className="mb-8">
                              <h3 className="text-lg font-bold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">III. PARENT/GUARDIAN BACKGROUND</h3>
                              <div className="border border-border rounded-sm overflow-hidden overflow-x-auto flex flex-col">
                                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                  <SectionItem label="Mother's Full Maiden Name" value={data.sf1.mother ? `${data.sf1.mother.firstName} ${data.sf1.mother.lastName}` : null} />
                                  <SectionItem label="Mother's Contact Number" value={data.sf1.mother?.contactNumber || null} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                  <SectionItem label="Father's Full Name" value={data.sf1.father ? `${data.sf1.father.firstName} ${data.sf1.father.lastName}` : null} />
                                  <SectionItem label="Father's Contact Number" value={data.sf1.father?.contactNumber || null} />
                                </div>
                                {data.sf1.guardian && (
                                  <>
                                    <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                      <SectionItem label="Guardian's Full Name" value={`${data.sf1.guardian.firstName} ${data.sf1.guardian.lastName}`} />
                                      <SectionItem label="Guardian's Contact Number" value={data.sf1.guardian.contactNumber || null} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                      <SectionItem
                                        label="Relationship to Learner"
                                        value={data.sf1.guardian.relationship}
                                        valueClassName={!data.sf1.is4PsBeneficiary ? "md:col-span-3" : ""}
                                      />
                                      {data.sf1.is4PsBeneficiary && (
                                        <SectionItem label="4Ps Household Number" value={data.sf1.householdId4Ps} />
                                      )}
                                    </div>
                                  </>
                                )}
                                {!data.sf1.guardian && data.sf1.is4PsBeneficiary && (
                                  <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                                    <SectionItem label="4Ps Household Number" value={data.sf1.householdId4Ps} valueClassName="md:col-span-3" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      </TabsContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Tabs>
            </main>
          </>
        )}
      </div>

      <ConfirmationModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of the learner information system?"
        confirmText="Sign Out"
        onConfirm={handleLogout}
        variant="primary"
        icon={LogOut}
      />
    </div>
  );
}
