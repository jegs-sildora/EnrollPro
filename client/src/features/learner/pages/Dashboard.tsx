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
import { getLearnerApi } from "@/shared/api/axiosInstance";

import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/shared/ui/button";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";
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
}

interface AcademicHistory {
  grade_level: string;
  school_year: string;
  status: string;
  term_format?: string | null;
  grades: Record<string, SubjectGrades> | null;
  general_average: number | null;
}

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
  return d.toLocaleDateString("en-PH", { timeZone: 'Asia/Manila', 
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
      <div className={`bg-card text-base leading-tight font-extrabold text-foreground px-4 py-2 border-r border-border last:border-0 flex items-center ${valueClassName || ''}`}>
        {(!value || value === "-" || value === "") ? (
          <span className="text-foreground italic font-normal">
            Not Specified
          </span>
        ) : (
          value
        )}
      </div>
    </>
  );
}

const DEPED_JHS_CORE_SUBJECTS = [
  "Filipino",
  "English",
  "Mathematics",
  "Science",
  "Araling Panlipunan",
  "Edukasyon sa Pagpapakatao",
  "Technology and Livelihood Education",
  "MAPEH",
];

function AcademicHistoryAccordion({
  history,
  isDefaultOpen,
}: {
  history: AcademicHistory;
  isDefaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);
  const isTrimester = history.term_format === "TRIMESTER" || history.term_format !== "QUARTERS";

  const existingSubjects = history.grades ? Object.keys(history.grades) : [];
  const extraSubjects = existingSubjects.filter(
    (key) => !DEPED_JHS_CORE_SUBJECTS.some((core) => core.toLowerCase() === key.trim().toLowerCase())
  );
  const subjectsToRender = [...DEPED_JHS_CORE_SUBJECTS, ...extraSubjects];

  const getSubjectGrades = (subjectName: string): SubjectGrades | null => {
    if (!history.grades) return null;
    if (history.grades[subjectName]) return history.grades[subjectName];
    const matchKey = Object.keys(history.grades).find(
      (key) => key.trim().toLowerCase() === subjectName.trim().toLowerCase()
    );
    return matchKey ? (history.grades[matchKey] ?? null) : null;
  };

  return (
    <div className="mb-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-card border border-border px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-all duration-200 ${
          isOpen ? "rounded-t-sm border-b-0" : "rounded-sm"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-tight font-extrabold text-foreground uppercase">
            {history.grade_level} &bull; S.Y. {history.school_year}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ease-in-out ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        />
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border border-border rounded-b-sm overflow-x-auto">
              <div className="w-full overflow-x-auto whitespace-nowrap">
                <table className="w-full border-collapse border border-border text-base leading-tight">
                  <thead className="bg-muted text-foreground text-base font-bold uppercase tracking-wide">
                    <tr className="border-b border-border">
                      <th rowSpan={2} className="px-4 py-2 text-center font-bold align-middle border-r border-border">Learning Areas</th>
                      <th colSpan={isTrimester ? 3 : 4} className="px-4 py-2 text-center font-bold border-r border-border">
                        {isTrimester ? "Term" : "Quarter"}
                      </th>
                      <th rowSpan={2} className="px-4 py-2 text-center font-bold align-middle border-r border-border">Final Rating</th>
                      <th rowSpan={2} className="px-4 py-2 text-center font-bold align-middle">Remarks</th>
                    </tr>
                    <tr>
                      <th className="px-4 py-1.5 text-center font-bold border-r border-border">1</th>
                      <th className="px-4 py-1.5 text-center font-bold border-r border-border">2</th>
                      <th className="px-4 py-1.5 text-center font-bold border-r border-border">3</th>
                      {!isTrimester && (
                        <th className="px-4 py-1.5 text-center font-bold border-r border-border">4</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsToRender.map((subject) => {
                      const subjectGrades = getSubjectGrades(subject);
                      const term1 = isTrimester ? (subjectGrades?.T1 ?? subjectGrades?.term1 ?? subjectGrades?.Q1 ?? "—") : (subjectGrades?.Q1 ?? subjectGrades?.T1 ?? "—");
                      const term2 = isTrimester ? (subjectGrades?.T2 ?? subjectGrades?.term2 ?? subjectGrades?.Q2 ?? "—") : (subjectGrades?.Q2 ?? subjectGrades?.T2 ?? "—");
                      const term3 = isTrimester ? (subjectGrades?.T3 ?? subjectGrades?.term3 ?? subjectGrades?.Q3 ?? "—") : (subjectGrades?.Q3 ?? subjectGrades?.T3 ?? "—");
                      const term4 = !isTrimester ? (subjectGrades?.Q4 ?? "—") : null;

                      return (
                        <tr key={subject} className="bg-card hover:bg-muted/50 transition-colors">
                          <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">{subject}</td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">{term1}</td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">{term2}</td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">{term3}</td>
                          {!isTrimester && (
                            <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">{term4}</td>
                          )}
                          <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">
                            {subjectGrades?.Final ?? "—"}
                          </td>
                          <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">
                            {subjectGrades?.Final ? (Number(subjectGrades.Final) >= 75 ? "Passed" : "Failed") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border border-border text-lg">
                    <tr>
                      <td colSpan={isTrimester ? 4 : 5} className="text-right pr-4 font-bold uppercase bg-muted border border-border text-foreground">General Average:</td>
                      <td className="text-center font-extrabold bg-card border border-border text-lg text-foreground">
                        {history.general_average}
                      </td>
                      <td className="bg-card border border-border text-center text-base text-primary font-extrabold">
                        {Number(history.general_average) >= 90 ? "WITH HONORS" : ""}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const { user, token, clearAuth } = useLearnerAuthStore();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [currentTimestamp] = useState(() => Date.now());
  const [data, setData] = useState<LearnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      .catch(() => setError("Failed to load dashboard data. Please try again later."))
      .finally(() => setLoading(false));
  }, [token]);

  if (!user || !token) {
    return <Navigate to="/learner/login" replace />;
  }

  const handleLogout = () => {
    clearAuth();
    navigate("/learner/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <PageLoadingSkeleton variant="dashboard" />
      </div>
    );
  }

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
                      <SheetTitle className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                        {data.schoolLogoUrl ? (
                          <img src={data.schoolLogoUrl} alt="School Seal" className="h-7 w-7 object-contain shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="text-sm font-extrabold text-primary-foreground">
                              {data.schoolAcronym?.slice(0, 2) || "EP"}
                            </span>
                          </div>
                        )}
                        <span>{data.schoolAcronym} Learner Portal</span>
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
                          className="w-full justify-start font-extrabold text-base h-11 px-3 gap-3 text-foreground hover:bg-muted/60"
                          onClick={() => handleNavClick("sf9", "dashboard-overview")}
                        >
                          <DashboardIcon className="h-5 w-5 text-primary shrink-0" />
                          <span>Dashboard Overview</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-extrabold text-base h-11 px-3 gap-3 text-foreground hover:bg-muted/60"
                          onClick={() => handleNavClick("sf9", "sf9-section")}
                        >
                          <BookOpen className="h-5 w-5 text-primary shrink-0" />
                          <span>Official School Form 9 (SF9)</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-extrabold text-base h-11 px-3 gap-3 text-foreground hover:bg-muted/60"
                          onClick={() => handleNavClick("sf1", "sf1-section")}
                        >
                          <User className="h-5 w-5 text-primary shrink-0" />
                          <span>Official Learner Profile (SF1)</span>
                        </Button>
                      </div>
                    </div>

                    <div className="py-6 flex flex-col items-center w-full">
                      <div className="w-28 h-28 sm:w-32 sm:h-32 object-cover bg-primary shadow-sm outline-2 outline-dashed outline-primary rounded-full mb-4 flex items-center justify-center overflow-hidden shrink-0">
                        {data.sf1.studentPhoto ? (
                          <img src={data.sf1.studentPhoto} alt="Learner Photo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl font-extrabold text-primary-foreground tracking-tighter uppercase">
                            {data.identity.firstName.charAt(0)}{data.identity.lastName.charAt(0)}
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-extrabold text-foreground uppercase text-center leading-tight">
                        {data.identity.firstName} {data.identity.middleName}  {data.identity.lastName}
                      </h2>
                      <p className="text-base leading-tight font-extrabold text-foreground text-center mt-1">
                        LRN: {data.identity.lrn}
                      </p>

                      <hr className="w-full border-t border-border/60 my-4" />

                      <div className="flex flex-col items-center text-center w-full space-y-1 uppercase">
                        <p className="text-lg font-extrabold text-primary">
                          {data.enrollment.gradeLevel || "Not Enrolled"} - {data.enrollment.section || "Unsectioned"}
                        </p>
                        <p className="text-base font-extrabold text-foreground">
                          {data.enrollment.curriculumProgram
                            ? (SCP_LABELS[data.enrollment.curriculumProgram] || data.enrollment.curriculumProgram)
                            : "Basic Education Curriculum"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full pt-4 border-t border-border/50 flex flex-col items-center text-center mt-auto">
                    <span className="font-extrabold text-sm uppercase text-foreground">
                      Official Class Adviser
                    </span>
                    <p className="text-lg font-extrabold text-foreground mt-1 uppercase">
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
                <span className="text-base font-extrabold text-primary-foreground">
                  {data?.schoolAcronym?.slice(0, 2) || "EP"}
                </span>
              </div>
            )}
            <span className="font-extrabold text-xl text-foreground tracking-tight">
              {data ? data.schoolAcronym : ""} Learner Information System
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
              onClick={handleLogout}
              className="h-9 w-9 text-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row w-full min-h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] overflow-hidden bg-background relative z-10 print:h-auto print:overflow-visible">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center gap-3 shadow-md">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-base leading-tight text-destructive ">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Left Pane (Fixed Identity Sidebar) */}
            <aside className="hidden md:flex md:w-[30%] bg-muted/30 md:border-r border-border md:h-full flex-col justify-between py-8 px-6 sm:py-12 overflow-y-auto shrink-0">
              <div className="flex flex-col items-center w-full">
                <div className="w-36 h-36 sm:w-40 sm:h-40 object-cover bg-primary shadow-sm outline-2 outline-dashed outline-primary rounded-full mb-5 sm:mb-6 flex items-center justify-center overflow-hidden shrink-0">
                  {data.sf1.studentPhoto ? (
                    <img src={data.sf1.studentPhoto} alt="Learner Photo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl font-extrabold text-primary-foreground tracking-tighter uppercase">
                      {data.identity.firstName.charAt(0)}{data.identity.lastName.charAt(0)}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-extrabold text-foreground uppercase text-center leading-tight">
                  {data.identity.firstName} {data.identity.middleName}  {data.identity.lastName}
                </h2>
                <p className="text-xl leading-tight font-extrabold text-foreground text-center mt-1">
                  LRN: {data.identity.lrn}
                </p>

                <hr className="w-full border-t border-border/60 my-6" />

                <div className="flex flex-col items-center text-center w-full space-y-1 uppercase">
                  <p className="text-xl font-extrabold text-primary">
                    {data.enrollment.gradeLevel || "Not Enrolled"} - {data.enrollment.section || "Unsectioned"}
                  </p>
                  <p className="text-xl font-extrabold text-foreground">
                    {data.enrollment.curriculumProgram
                      ? (SCP_LABELS[data.enrollment.curriculumProgram] || data.enrollment.curriculumProgram)
                      : "Basic Education Curriculum"}
                  </p>
                </div>
              </div>

              <div className="w-full mt-8 pt-4 border-t border-border/50 flex flex-col items-center text-center">
                <span className="font-extrabold uppercase text-foreground">
                  Official Class Adviser
                </span>
                <p className="text-xl font-extrabold text-foreground mt-1 uppercase">
                  {data.enrollment.advisingTeacher || "To Be Assigned"}
                </p>
              </div>
            </aside>

            {/* Right Pane (Flat Document Canvas) */}
            <main className="w-full md:w-[60%] lg:w-[70%] flex-1 h-full overflow-y-auto px-4 py-6 lg:px-12 lg:py-8 space-y-12">
              <div id="dashboard-overview" className="mb-6 mt-4">
                <h1 className="text-3xl font-extrabold text-foreground">Learner Profile</h1>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-6 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
                  <TabsTrigger
                    value="sf9"
                    className="flex-1 min-w-25 py-3 px-3 text-sm sm:text-base font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
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
                    className="flex-1 min-w-25 py-3 px-3 text-sm sm:text-base font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
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
                            <h3 className="text-2xl font-extrabold text-gray-900 uppercase dark:text-foreground">
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
                        <h3 className="text-2xl font-extrabold text-gray-900 uppercase dark:text-foreground">
                          Official Learner Profile (for SF1 Reporting)
                        </h3>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {/* Sub-Section 1: Learner Demographics */}
                      <div className="mb-8">
                        <h3 className="text-lg font-extrabold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">I. LEARNER IDENTITY</h3>
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
                        <h3 className="text-lg font-extrabold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">II. CURRENT RESIDENCY & CONTACT</h3>
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
                          <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                            <SectionItem label="Personal Email" value={data.sf1.email} />
                            <SectionItem label="Contact Number" value={data.sf1.mobileNumber} />
                          </div>
                        </div>
                      </div>

                      {/* Sub-Section 3: Parent & Guardian Information */}
                      <div className="mb-8">
                        <h3 className="text-lg font-extrabold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">III. PARENT/GUARDIAN BACKGROUND</h3>
                        <div className="border border-border rounded-sm overflow-hidden overflow-x-auto flex flex-col">
                          <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                            <SectionItem label="Mother's Full Maiden Name" value={data.sf1.mother ? `${data.sf1.mother.firstName} ${data.sf1.mother.lastName}` : null} />
                            <SectionItem label="Mother's Contact Number" value={data.sf1.mother?.contactNumber || null} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                            <SectionItem label="Father's Full Name" value={data.sf1.father ? `${data.sf1.father.firstName} ${data.sf1.father.lastName}` : null} />
                            <SectionItem label="Father's Contact Number" value={data.sf1.father?.contactNumber || null} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                            <SectionItem label="Guardian's Full Name" value={data.sf1.guardian ? `${data.sf1.guardian.firstName} ${data.sf1.guardian.lastName}` : null} />
                            <SectionItem label="Guardian's Contact Number" value={data.sf1.guardian?.contactNumber || null} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0">
                            <SectionItem
                              label="Guardian's Relationship"
                              value={data.sf1.guardian?.relationship || null}
                              valueClassName={!data.sf1.is4PsBeneficiary ? "md:col-span-3" : ""}
                            />
                            {data.sf1.is4PsBeneficiary && (
                              <SectionItem label="4Ps Household Number" value={data.sf1.householdId4Ps} />
                            )}
                          </div>
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
    </div>
  );
}
