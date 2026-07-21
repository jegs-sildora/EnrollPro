import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  LogOut,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLearnerAuthStore } from "@/store/learner-auth.slice";
import { getLearnerApi } from "@/shared/api/axiosInstance";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";


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
    permanentAddress: any | null;
    currentAddress: any | null;
    mother: any | null;
    father: any | null;
    guardian: any | null;
  };
  academicHistory: {
    grade_level: string;
    school_year: string;
    status: string;
    grades: Record<string, any> | null;
    general_average: number | null;
  }[];
  isEnrollmentActive: boolean;
  schoolName: string;
  schoolAcronym: string;
  schoolLogoUrl: string | null;
  active_quarter: number;
}function formatDate(dateStr: string) {
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
      <div className="bg-muted text-muted-foreground font-extrabold text-base uppercase px-4 py-2 border-r border-border flex items-center">
        {label}
      </div>
      <div className={`text-base leading-tight font-semibold text-foreground px-4 py-2 border-r border-border last:border-0 flex items-center ${valueClassName || ''}`}>
        {(!value || value === "-" || value === "") ? (
          <span className="text-muted-foreground italic font-normal">
            Not Specified
          </span>
        ) : (
          value
        )}
      </div>
    </>
  );
}

function AcademicHistoryAccordion({ history, isDefaultOpen }: { history: any, isDefaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);

  return (
    <div className="mb-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-sm flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors dark:bg-card dark:border-border dark:hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-tight font-extrabold text-gray-900 uppercase dark:text-foreground">
            {history.grade_level} &bull; S.Y. {history.school_year} &bull; Status: {history.status.toUpperCase()}
          </span>
          <span className={`text-base font-extrabold ${history.status === 'Active' ? 'text-green-700 dark:text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
            [ {history.status.toUpperCase()} ]
          </span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </div>

      {isOpen && (
        <div className="border-x border-b border-gray-200 rounded-b-sm overflow-x-auto dark:border-border">
          <div className="w-full overflow-x-auto whitespace-nowrap">
            <table className="w-full border-collapse border border-border text-base leading-tight">
              <thead className="bg-primary text-primary-foreground text-base font-extrabold uppercase tracking-wide py-3">
                <tr>
                  <th className="px-4 py-2 text-center">Learning Areas</th>
                  <th className="px-4 py-2 text-center">Quarter 1</th>
                  <th className="px-4 py-2 text-center">Quarter 2</th>
                  <th className="px-4 py-2 text-center">Quarter 3</th>
                  <th className="px-4 py-2 text-center">Quarter 4</th>
                  <th className="px-4 py-2 text-center">Final Rating</th>
                  <th className="px-4 py-2 text-center">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.grades && Object.keys(history.grades).length > 0 ? (
                  Object.entries(history.grades as Record<string, any>).map(([subject, grades]: [string, any]) => (
                    <tr key={subject} className="hover:bg-muted/50 transition-colors">
                      <td className="border border-border px-4 py-3 text-center text-foreground ">{subject}</td>
                      <td className="border border-border px-4 py-3 text-center text-foreground">{grades?.Q1 ?? "—"}</td>
                      <td className="border border-border px-4 py-3 text-center text-foreground">{grades?.Q2 ?? "—"}</td>
                      <td className="border border-border px-4 py-3 text-center text-foreground">{grades?.Q3 ?? "—"}</td>
                      <td className="border border-border px-4 py-3 text-center text-foreground">{grades?.Q4 ?? "—"}</td>
                      <td className="border border-border px-4 py-3 text-center text-foreground font-extrabold">
                        {grades?.Final ?? "—"}
                      </td>
                      <td className="border border-border px-4 py-3 text-center text-muted-foreground font-extrabold">
                        {grades?.Final ? (Number(grades.Final) >= 75 ? "Passed" : "Failed") : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                      Grades for this grading period have not yet been posted by the subject teachers. Please wait for official posting.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-accent/50 border border-border font-extrabold text-lg">
                <tr>
                  <td colSpan={5} className="text-right pr-4 font-extrabold uppercase bg-muted border border-border text-foreground">General Average:</td>
                  <td className="text-center font-extrabold bg-muted border border-border text-lg text-foreground">
                    {history.general_average}
                  </td>
                  <td className="bg-muted border border-border text-center text-base text-muted-foreground text-primary">
                    {Number(history.general_average) >= 90 ? "WITH HONORS" : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const { user, token, clearAuth } = useLearnerAuthStore();
  const [data, setData] = useState<LearnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <header className="sticky top-0 z-50 w-full bg-muted border-b border-gray-200 shadow-sm print:hidden">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6 mx-auto max-w-6xl">
          <div className="flex items-center gap-2">
            {data?.schoolLogoUrl ? (
              <img src={data.schoolLogoUrl} alt="School Seal" className="h-8 w-8 object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-red-900 flex items-center justify-center">
                <span className="text-base font-extrabold text-white">
                  {data?.schoolAcronym?.slice(0, 2) || "EP"}
                </span>
              </div>
            )}
            <span className="font-extrabold text-lg text-foreground tracking-tight">
              {data ? data.schoolAcronym : "Learner"} Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 border-emerald-200 uppercase text-sm font-extrabold h-5">
              2026-2027 [ACTIVE]
            </Badge>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center">
                <span className="text-base font-extrabold text-gray-700">
                  {user.firstName[0]}{user.lastName[0]}
                </span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-base font-extrabold text-muted-foreground leading-tight">
                  {user.firstName} {user.lastName}
                </span>
                <Badge className="bg-slate-900 text-white hover:bg-slate-800 text-sm uppercase w-fit h-4 px-1 py-0 border-0 leading-none mt-[2px]">LEARNER</Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row w-full min-h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] overflow-hidden bg-muted relative z-10 print:h-auto print:overflow-visible">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center gap-3 shadow-md">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-base leading-tight text-destructive ">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Left Pane (Fixed Identity Sidebar) */}
            <aside className="w-[30%] bg-muted/30 border-r border-border h-full flex flex-col items-center pt-12 px-6">

              <div className="w-40 h-40 object-cover bg-gray-300 shadow-sm border border-border rounded-md mb-6 flex items-center justify-center overflow-hidden shrink-0">
                {data.sf1.studentPhoto ? (
                  <img src={data.sf1.studentPhoto} alt="Learner Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-extrabold text-white/50 tracking-tighter uppercase">
                    {data.identity.firstName.charAt(0)}{data.identity.lastName.charAt(0)}
                  </span>
                )}
              </div>


              <h2 className="text-xl font-extrabold text-foreground uppercase text-center">{data.identity.lastName}, {data.identity.firstName}</h2>
              <p className="text-base leading-tight font-semibold text-muted-foreground text-center mt-1">LRN: {data.identity.lrn}</p>
              <p className="text-base font-extrabold text-primary text-center mt-4">Grade {data.enrollment.gradeLevel} - {data.enrollment.section}</p>
            </aside>

            {/* Right Pane (Flat Document Canvas) */}
            <main className="w-full md:w-[60%] lg:w-[70%] flex-1 h-full overflow-y-auto px-4 py-6 lg:px-12 lg:py-8 space-y-12">
              <div className="mb-6 mt-4">
                <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Learner Dashboard</h1>
                <p className="text-base leading-tight font-semibold text-muted-foreground mt-1">
                  Review official academic records, verify current enrollment status, and validate permanent profile data.
                </p>
              </div>

              {/* Section 3: The Digital SF9 */}
              <div className="bg-background border border-border shadow-sm rounded-sm p-6 mb-8 print:break-inside-avoid space-y-5">
                <div className="bg-transparent pb-0 print:bg-transparent">
                  <div className="mb-8 mt-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-2xl font-extrabold text-gray-900 uppercase dark:text-foreground">
                          Official School Form 9 (SF9) - Historical Academic Records
                        </h3>
                        <p className="text-base leading-tight text-gray-500  mt-1 dark:text-muted-foreground">Grades 7–10</p>
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
                    <div className="text-center text-muted-foreground py-8">
                      No academic records available.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: The Learner Profile (SF1) */}
              <div className="bg-background border border-border shadow-sm rounded-sm p-6 mb-8 print:break-inside-avoid space-y-5">
                <div className="bg-transparent pb-0 print:bg-transparent">
                  <div className="mb-8 mt-12 flex items-center gap-3">
                    <h3 className="text-2xl font-extrabold text-gray-900 uppercase dark:text-foreground">
                      Official Learner Profile (for SF1 Reporting)
                    </h3>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Sub-Section 1: Learner Demographics */}
                  <div className="mb-8">
                    <h3 className="text-lg font-extrabold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">I. LEARNER IDENTITY</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Full Name</span>
                        <span className="text-base leading-tight font-extrabold">{`${data.identity.lastName}, ${data.identity.firstName} ${data.identity.middleName || ""} ${data.identity.extensionName || ""}`.trim().replace(/\s+/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">LRN</span>
                        <span className="text-base leading-tight font-extrabold">{data.identity.lrn}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Sex</span>
                        <span className="text-base leading-tight font-extrabold">{data.sf1.sex === "MALE" ? "Male" : "Female"}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Date of Birth</span>
                        <span className="text-base leading-tight font-extrabold">{formatDate(data.sf1.birthdate)}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Place of Birth</span>
                        <span className="text-base leading-tight font-extrabold">{data.sf1.placeOfBirth || <span className="text-muted-foreground italic font-normal">Not Specified</span>}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Age</span>
                        <span className="text-base leading-tight font-extrabold">{`${Math.floor((Date.now() - new Date(data.sf1.birthdate).getTime()) / 31557600000)} years old`}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Religion</span>
                        <span className="text-base leading-tight font-extrabold">{data.sf1.religion || <span className="text-muted-foreground italic font-normal">Not Specified</span>}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">Mother Tongue</span>
                        <span className="text-base leading-tight font-extrabold">{data.sf1.motherTongue || <span className="text-muted-foreground italic font-normal">Not Specified</span>}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">IP Group Status</span>
                        <span className="text-base leading-tight font-extrabold">{data.sf1.isIpCommunity ? `Yes (${data.sf1.ipGroupName || 'Not specified'})` : "No"}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-border/60 pb-2 pt-4">
                        <span className="text-base uppercase">4Ps Beneficiary</span>
                        <span className="text-base leading-tight font-extrabold">{data.sf1.is4PsBeneficiary ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Section 2: Address & Contact Details */}
                  <div className="mb-8">
                    <h3 className="text-lg font-extrabold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">II. CURRENT RESIDENCY & CONTACT</h3>
                    <div className="border border-border rounded-sm overflow-hidden overflow-x-auto flex flex-col">
                      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border last:border-0 even:bg-muted/30">
                        <SectionItem label="Permanent Home Address" value={
                          data.sf1.permanentAddress ?
                            `${data.sf1.permanentAddress.houseNoStreet || ''} ${data.sf1.permanentAddress.barangay || ''}, ${data.sf1.permanentAddress.cityMunicipality || ''}, ${data.sf1.permanentAddress.province || ''}`.replace(/\s+/g, ' ').trim() : null
                        } />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border last:border-0 even:bg-muted/30">
                        <SectionItem label="Current Home Address" value={
                          (() => {
                            if (!data.sf1.permanentAddress && !data.sf1.currentAddress) return null;
                            if (!data.sf1.currentAddress) return "Same as Permanent Address";
                            return `${data.sf1.currentAddress.houseNoStreet || ''} ${data.sf1.currentAddress.barangay || ''}, ${data.sf1.currentAddress.cityMunicipality || ''}, ${data.sf1.currentAddress.province || ''}`.replace(/\s+/g, ' ').trim();
                          })()
                        } />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0 even:bg-muted/30">
                        <SectionItem label="Personal Email" value={data.sf1.email} />
                        <SectionItem label="Contact Number" value={data.sf1.mobileNumber} />
                      </div>
                    </div>
                  </div>

                  {/* Sub-Section 3: Parent & Guardian Information */}
                  <div className="mb-8">
                    <h3 className="text-lg font-extrabold text-foreground border-b-2 border-primary pb-2 mb-4 mt-8 uppercase">III. PARENT/GUARDIAN BACKGROUND</h3>
                    <div className="border border-border rounded-sm overflow-hidden overflow-x-auto flex flex-col">
                      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0 even:bg-muted/30">
                        <SectionItem label="Mother's Full Maiden Name" value={data.sf1.mother ? `${data.sf1.mother.firstName} ${data.sf1.mother.lastName}` : null} />
                        <SectionItem label="Mother's Contact Number" value={data.sf1.mother?.contactNumber || null} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0 even:bg-muted/30">
                        <SectionItem label="Father's Full Name" value={data.sf1.father ? `${data.sf1.father.firstName} ${data.sf1.father.lastName}` : null} />
                        <SectionItem label="Father's Contact Number" value={data.sf1.father?.contactNumber || null} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0 even:bg-muted/30">
                        <SectionItem label="Guardian's Full Name" value={data.sf1.guardian ? `${data.sf1.guardian.firstName} ${data.sf1.guardian.lastName}` : null} />
                        <SectionItem label="Guardian's Contact Number" value={data.sf1.guardian?.contactNumber || null} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border last:border-0 even:bg-muted/30">
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

                {/* Sub-Section 4: Official Correction Procedure */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-4 border-t border-gray-200 dark:border-border print:hidden">
                  <p className="text-base text-gray-500 leading-relaxed max-w-2xl dark:text-muted-foreground">
                    <strong>Correction Procedure:</strong> For any official corrections to your permanent Learner Profile data, kindly present your PSA Birth Certificate to your Class Adviser. Online edits are not permitted for security and data integrity.
                  </p>
                </div>
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
