import { useParams, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Fingerprint,
  Key,
  User,
  GraduationCap,
  ClipboardList,
  Tags,
  Activity,
  History,
  FileText,
  Info,
  UserCheck,
  ShieldCheck,
  Stethoscope,
  Users,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { HealthRecords } from "@/features/students/components/tabs/HealthRecords";
import { PinResetHandoverModal } from "@/features/students/components/PinResetHandoverModal";
import { StatusTimeline } from "@/features/enrollment/components/StatusTimeline";
import { SCPAssessmentBlock } from "@/features/enrollment/components/SCPAssessmentBlock";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { cn } from "@/shared/lib/utils";
import { DocumentAuthModal } from "@/features/students/components/DocumentAuthModal";

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs = useMemo(
    () =>
      new Set([
        "personal",
        "academic",
        "application",
        "classifications",
        "health",
        "documents",
      ]),
    [],
  );

  const initialTabFromQuery = searchParams.get("tab") || "personal";
  const resolvedInitialTab = validTabs.has(initialTabFromQuery)
    ? initialTabFromQuery
    : "personal";

  const [activeTab, setActiveTab] = useState(resolvedInitialTab);
  const [isPinResetModalOpen, setIsPinResetModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const {
    data: student,
    loading,
    error,
    refetch,
  } = useApplicationDetail(Number(id), true);

  const handleVerifyPsa = async (type: "PSA" | "SECONDARY") => {
    if (!student) return;
    try {
      await api.post(`/students/${student.id}/verify-psa`, { type });
      sileo.success({
        title: "Document Verified",
        description:
          type === "PSA"
            ? "PSA Birth Certificate has been added to the learner's vault."
            : "Secondary document accepted for temporary clearance.",
      });
      refetch();
    } catch (err: unknown) {
      toastApiError(err);
    }
  };

  const handleConfirmResetPin = async (): Promise<string> => {
    if (!student) throw new Error("Student not found");
    const res = await api.post(`/students/${student.id}/reset-portal-pin`);
    return res.data.pin;
  };

  if (loading)
    return <div className="p-8 text-center">Loading student profile...</div>;
  if (error || !student)
    return (
      <div className="p-8 text-center text-red-500">
        Error: {error || "Student not found"}
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/students")}
            className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <UserPhoto
            photo={student.studentPhoto}
            containerClassName="w-20 h-20 rounded-full border-2 border-primary/10 shadow-sm"
            alt={`${student.firstName} ${student.lastName}`}
          />

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold ">
                {student.lastName}, {student.firstName}{" "}
                {student.middleName || ""}
              </h1>
              <Badge
                variant={student.status === "ENROLLED" ? "default" : "outline"}
                className={cn(
                  student.status === "ENROLLED" ? "bg-green-600" : "",
                  student.status === "TEMPORARILY_ENROLLED" &&
                    "bg-amber-100 text-amber-800 border-amber-300",
                )}>
                {student.status?.replace("_", " ")}
              </Badge>
              {student.applicantType === "LATE_ENROLLEE" && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 uppercase font-black">
                  Late Enrolled
                </Badge>
              )}
            </div>

            {student.status === "TEMPORARILY_ENROLLED" && (
              <div className="flex items-center gap-2 mt-1 px-3 py-1 rounded-lg bg-amber-50 border border-amber-100 animate-in fade-in slide-in-from-left-2 duration-500">
                <ShieldCheck className="h-3 w-3 text-amber-600" />
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  Deficiency:{" "}
                  {student.isMissingSf9 && "Missing SF9 (Report Card)"}
                  {student.isMissingSf9 &&
                    student.hasUnsettledPrivateAccount &&
                    " & "}
                  {student.hasUnsettledPrivateAccount &&
                    `Unsettled Account (${student.originatingSchoolName || "Private School"})`}
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 mt-1 text-muted-foreground text-sm font-medium">
              <span className="flex items-center gap-1">
                <Fingerprint className="h-3.5 w-3.5" />{" "}
                {student.lrn || "NO LRN"}
              </span>
              <span>•</span>
              <span>
                {student.gradeLevel.name}
                {student.enrollment?.section &&
                  ` • ${student.enrollment.section.name}`}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:block text-right">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            Tracking Number
          </p>
          <p className="text-lg  font-bold">{student.trackingNumber}</p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          const next = new URLSearchParams(searchParams);
          next.set("tab", tab);
          setSearchParams(next, { replace: true });
        }}
        className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border border-border relative rounded-lg">
          <TabsTrigger
            value="personal"
            className="flex-1 min-w-32 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "personal" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <User className="h-4 w-4 relative z-20" />
            <span className="relative z-20 hidden sm:inline">
              Personal Info
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="academic"
            className="flex-1 min-w-32 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "academic" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <GraduationCap className="h-4 w-4 relative z-20" />
            <span className="relative z-20 hidden sm:inline">
              Academic History
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="application"
            className="flex-1 min-w-32 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "application" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <ClipboardList className="h-4 w-4 relative z-20" />
            <span className="relative z-20 hidden sm:inline">
              Application Record
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="classifications"
            className="flex-1 min-w-32 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "classifications" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <Tags className="h-4 w-4 relative z-20" />
            <span className="relative z-20 hidden sm:inline">
              Programs & Tags
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="health"
            className="flex-1 min-w-32 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "health" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <Activity className="h-4 w-4 relative z-20" />
            <span className="relative z-20 hidden sm:inline">
              Health Records
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="flex-1 min-w-32 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "documents" && (
              <motion.div
                layoutId="profile-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <FileText className="h-4 w-4 relative z-20" />
            <span className="relative z-20 hidden sm:inline">Requirements</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent
            value="personal"
            className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        Birth Date
                      </Label>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(student.birthDate), "MMMM d, yyyy")}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Sex</Label>
                      <p className="font-medium uppercase">{student.sex}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        Place of Birth
                      </Label>
                      <p className="font-medium">
                        {student.placeOfBirth || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Religion</Label>
                      <p className="font-medium">{student.religion || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        Mother Tongue
                      </Label>
                      <p className="font-medium">
                        {student.motherTongue || "N/A"}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" /> Current Address
                      </Label>
                      <p className="font-medium">
                        {student?.currentAddress ? (
                          <>
                            {student.currentAddress.houseNo || ""}{" "}
                            {student.currentAddress.street || ""}{" "}
                            {student.currentAddress.barangay || ""}{" "}
                            {student.currentAddress.cityMunicipality || ""}{" "}
                            {student.currentAddress.province || ""}
                          </>
                        ) : (
                          "N/A"
                        )}
                      </p>
                    </div>
                    {student?.permanentAddress && (
                      <div className="space-y-1">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" /> Permanent Address
                        </Label>
                        <p className="font-medium">
                          {student.permanentAddress.houseNo || ""}{" "}
                          {student.permanentAddress.street || ""}{" "}
                          {student.permanentAddress.barangay || ""}{" "}
                          {student.permanentAddress.cityMunicipality || ""}{" "}
                          {student.permanentAddress.province || ""}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Family & Contact (SF1)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                        Mother's Maiden Name
                      </Label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {student.motherName?.firstName ||
                        student.motherName?.lastName ? (
                          <p className="font-medium">
                            {student.motherName.firstName}{" "}
                            {student.motherName.lastName}
                          </p>
                        ) : (
                          <p className="font-medium text-muted-foreground/50 italic">
                            Not provided
                          </p>
                        )}
                        <p
                          className={`flex items-center gap-2 ${
                            student.motherName?.contactNumber
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50 italic"
                          }`}>
                          <Phone className="h-3 w-3" />{" "}
                          {student.motherName?.contactNumber || "No contact"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                        Father's Name
                      </Label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {student.fatherName?.firstName ||
                        student.fatherName?.lastName ? (
                          <p className="font-medium">
                            {student.fatherName.firstName}{" "}
                            {student.fatherName.lastName}
                          </p>
                        ) : (
                          <p className="font-medium text-muted-foreground/50 italic">
                            Not provided
                          </p>
                        )}
                        <p
                          className={`flex items-center gap-2 ${
                            student.fatherName?.contactNumber
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50 italic"
                          }`}>
                          <Phone className="h-3 w-3" />{" "}
                          {student.fatherName?.contactNumber || "No contact"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                        Guardian's Name & Relationship
                      </Label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {student.guardianInfo?.firstName ||
                        student.guardianInfo?.lastName ? (
                          <p className="font-medium">
                            {student.guardianInfo.firstName}{" "}
                            {student.guardianInfo.lastName}{" "}
                            {student.guardianInfo.relationship &&
                              `(${student.guardianInfo.relationship})`}
                          </p>
                        ) : (
                          <p className="font-medium text-muted-foreground/50 italic">
                            Not provided
                          </p>
                        )}
                        <p
                          className={`flex items-center gap-2 ${
                            student.guardianInfo?.contactNumber
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50 italic"
                          }`}>
                          <Phone className="h-3 w-3" />{" "}
                          {student.guardianInfo?.contactNumber || "No contact"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1 text-sm">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Learner Email Address
                    </Label>
                    {student.emailAddress ? (
                      <p className="font-medium">{student.emailAddress}</p>
                    ) : (
                      <p className="font-medium text-muted-foreground/50 italic">
                        No email address provided
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {student.status === "ENROLLED" && (
                <Card className="col-span-1 md:col-span-2 border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Key className="h-4 w-4" />
                      Learner Portal Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Reset Portal PIN</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Generate a new 6-digit PIN for the learner portal. The
                          current PIN will be invalidated.
                        </p>
                      </div>
                      <Button
                        variant="default"
                        onClick={() => setIsPinResetModalOpen(true)}>
                        Reset Portal PIN
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent
            value="academic"
            className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Previous Academic Record
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          Last School Attended
                        </Label>
                        <p className="font-bold text-lg">
                          {student.lastSchoolName || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          School ID
                        </Label>
                        <p className="font-medium">
                          {student.lastSchoolId || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          School Address
                        </Label>
                        <p className="font-medium">
                          {student.lastSchoolAddress || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          Last Grade Level Completed
                        </Label>
                        <p className="font-bold text-lg">
                          {student.lastGradeCompleted || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          School Year Last Attended
                        </Label>
                        <p className="font-medium">
                          {student.schoolYearLastAttended || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          School Type
                        </Label>
                        <p className="font-medium uppercase">
                          {student.lastSchoolType || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          General Average
                        </Label>
                        <p className="font-bold text-lg text-primary">
                          {student.generalAverage != null
                            ? Number(student.generalAverage).toFixed(2)
                            : "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">
                          Phil-IRI (Reading Profile)
                        </Label>
                        <p className="font-bold text-lg text-primary uppercase">
                          {student.readingProfileLevel?.replace("_", " ") ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent
            value="application"
            className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {student.status === "TEMPORARILY_ENROLLED" && (
                  <Card className="border-amber-200 bg-amber-50/30 overflow-hidden">
                    <CardHeader className="bg-amber-100/50 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-600 rounded-lg text-white">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-black uppercase text-amber-900 leading-none">
                            Deficiency Resolution
                          </CardTitle>
                          <p className="text-[10px] font-bold text-amber-700/70 mt-1 uppercase tracking-widest">
                            DepEd Order 017, s. 2025 Compliance
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="p-4 bg-white rounded-xl border border-amber-200 space-y-3">
                        <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                          "Learners lacking transfer credentials or with private
                          school debt must be admitted temporarily but
                          restricted from official clearance generation."
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                          {student.isMissingSf9 && (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 gap-2"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    "Confirm that SF9 (Report Card) has been officially received and verified?",
                                  )
                                ) {
                                  try {
                                    await api.post(
                                      `/students/${student.id}/clear-deficiency`,
                                      { deficiencyType: "SF9" },
                                    );
                                    sileo.success({
                                      title: "SF9 Verified",
                                      description:
                                        "Learner's documentary deficiency has been updated.",
                                    });
                                    refetch();
                                  } catch (err: unknown) {
                                    toastApiError(err);
                                  }
                                }
                              }}>
                              <ClipboardList className="h-4 w-4" />
                              Verify / Receive SF9
                            </Button>
                          )}

                          {student.hasUnsettledPrivateAccount && (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 gap-2"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `Confirm that LIS clearance has been received from ${student.originatingSchoolName || "the private school"}?`,
                                  )
                                ) {
                                  try {
                                    await api.post(
                                      `/students/${student.id}/clear-deficiency`,
                                      { deficiencyType: "FINANCIAL" },
                                    );
                                    sileo.success({
                                      title: "Financial Clearance Received",
                                      description:
                                        "Learner's private account flag has been cleared.",
                                    });
                                    refetch();
                                  } catch (err: unknown) {
                                    toastApiError(err);
                                  }
                                }
                              }}>
                              <ShieldCheck className="h-4 w-4" />
                              Confirm LIS Clearance
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <SCPAssessmentBlock applicant={student} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Status History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatusTimeline applicant={student} />
                  </CardContent>
                </Card>
              </div>
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Application Metadata
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm font-bold">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Fingerprint className="h-3.5 w-3.5" /> Tracking No:
                    </span>
                    <span className="uppercase">{student.trackingNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" /> Admission Channel:
                    </span>
                    <span className="uppercase">
                      {student.admissionChannel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5" /> Learner Type:
                    </span>
                    <span className="uppercase">
                      {student.learnerType?.replace("_", " ")}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" /> Date Applied:
                    </span>
                    <span>
                      {format(new Date(student.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  {student.encodedBy && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <User className="h-3.5 w-3.5" /> Encoded By:
                      </span>
                      <span>
                        {student.encodedBy.firstName}{" "}
                        {student.encodedBy.lastName}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent
            value="classifications"
            className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tags className="h-4 w-4 text-primary" />
                    Classifications & Special Programs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground block mb-2">
                          IP Community Membership
                        </Label>
                        {student.isIpCommunity ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                            ✓ IP Member ({student.ipGroupName})
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground/50 border-muted">
                            ✕ Not an IP Member
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground block mb-2">
                          4Ps Beneficiary
                        </Label>
                        {student.is4PsBeneficiary ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                            ✓ 4Ps Beneficiary ({student.householdId4Ps})
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground/50 border-muted">
                            ✕ Not a 4Ps Beneficiary
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground block mb-2">
                          Learner with Disability
                        </Label>
                        {student.isLearnerWithDisability ? (
                          <div className="space-y-2">
                            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">
                              ✓ Has Disability
                            </Badge>
                            {student.disabilityTypes.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {student.disabilityTypes.map((t) => (
                                  <Badge
                                    key={t}
                                    variant="outline"
                                    className="border-rose-200 text-rose-700">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground/50 border-muted">
                            ✕ No Disability
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-6">
                      {student.isScpApplication && (
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            Special Curricular Program
                          </Label>
                          <p className="font-bold text-lg">{student.scpType}</p>
                          <div className="text-muted-foreground">
                            {student.artField && (
                              <p>Field: {student.artField}</p>
                            )}
                            {student.sportsList.length > 0 && (
                              <p>Sports: {student.sportsList.join(", ")}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent
            value="health"
            className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    Nutritional Status & Health History
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <HealthRecords
                    applicant={student}
                    onRefresh={refetch}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent
            value="documents"
            className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Permanent Documentary Vault
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {student.hasPsaBirthCertificate ||
                    student.birthCertificateType === "PSA" ||
                    student.birthCertificateType === "SECONDARY" ? (
                      <div
                        className={cn(
                          "flex flex-col p-6 rounded-2xl border-2 space-y-4 animate-in zoom-in-95 duration-300",
                          student.hasPsaBirthCertificate
                            ? "bg-card border-emerald-200"
                            : "bg-amber-50 border-amber-100",
                        )}>
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-lg text-white",
                              student.hasPsaBirthCertificate ||
                                student.birthCertificateType === "PSA"
                                ? "bg-emerald-600"
                                : "bg-amber-600",
                            )}>
                            {student.hasPsaBirthCertificate ||
                            student.birthCertificateType === "PSA" ? (
                              <ShieldCheck className="h-5 w-5" />
                            ) : (
                              <AlertTriangle className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "font-black uppercase leading-none",
                                student.hasPsaBirthCertificate ||
                                  student.birthCertificateType === "PSA"
                                  ? "text-foreground"
                                  : "text-amber-900",
                              )}>
                              {student.hasPsaBirthCertificate ||
                              student.birthCertificateType === "PSA"
                                ? "PSA Birth Certificate"
                                : "Secondary Birth Document"}
                            </h3>
                            <p
                              className={cn(
                                "text-[10px] font-bold mt-1 uppercase tracking-widest",
                                student.hasPsaBirthCertificate ||
                                  student.birthCertificateType === "PSA"
                                  ? "text-emerald-600"
                                  : "text-amber-700/70",
                              )}>
                              {student.hasPsaBirthCertificate ||
                              student.birthCertificateType === "PSA"
                                ? "SECURED IN VAULT"
                                : "Temporary Compliance (D.O. 017)"}
                            </p>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "pt-3 pb-4 px-4 space-y-2 rounded-xl",
                            student.hasPsaBirthCertificate ||
                              student.birthCertificateType === "PSA"
                              ? "bg-muted/50 border border-border"
                              : "",
                          )}>
                          <p
                            className={cn(
                              "text-[10px] font-black uppercase ",
                              student.hasPsaBirthCertificate ||
                                student.birthCertificateType === "PSA"
                                ? "text-muted-foreground/60"
                                : "text-amber-800/40",
                            )}>
                            Verification Metadata
                          </p>
                          <p
                            className={cn(
                              "text-xs font-bold",
                              student.hasPsaBirthCertificate ||
                                student.birthCertificateType === "PSA"
                                ? "text-foreground"
                                : "text-amber-900",
                            )}>
                            Document Type:{" "}
                            <span className="uppercase">
                              {student.hasPsaBirthCertificate ||
                              student.birthCertificateType === "PSA"
                                ? "Original PSA"
                                : "Secondary"}
                            </span>
                          </p>
                          <p
                            className={cn(
                              "text-xs font-bold",
                              student.hasPsaBirthCertificate ||
                                student.birthCertificateType === "PSA"
                                ? "text-foreground"
                                : "text-amber-900",
                            )}>
                            Authenticated by:{" "}
                            <span className="uppercase">
                              {student.birthCertificateVerifiedBy ||
                                "Registrar"}
                            </span>
                          </p>
                          <p
                            className={cn(
                              "text-xs font-medium",
                              student.hasPsaBirthCertificate ||
                                student.birthCertificateType === "PSA"
                                ? "text-muted-foreground"
                                : "text-amber-700",
                            )}>
                            Date Secured:{" "}
                            {student.birthCertificateVerifiedDate
                              ? format(
                                  new Date(
                                    student.birthCertificateVerifiedDate,
                                  ),
                                  "MMMM d, yyyy, hh:mm a",
                                )
                              : "N/A"}
                          </p>
                        </div>

                        {student.hasPsaBirthCertificate ||
                        student.birthCertificateType === "PSA" ? (
                          <div className="flex items-center gap-2 bg-primary/10 p-3 rounded-lg border border-primary/20 mt-2">
                            <Lock className="h-4 w-4 text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                              Vault Locked - DepEd "Once Only" Rule Satisfied
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white/50 p-3 rounded-lg border border-amber-200">
                            <p className="text-xs font-bold text-amber-900">
                              PSA Deadline:{" "}
                              <span className="text-rose-600 font-black underline">
                                October 31, 2026
                              </span>
                            </p>
                            <p className="text-[10px] font-medium text-amber-700 mt-1 leading-tight">
                              Secondary proof accepted. PSA must be submitted by
                              the deadline to finalize the permanent record.
                            </p>
                          </div>
                        )}

                        <div
                          className={cn(
                            "p-3 rounded-lg border",
                            student.hasPsaBirthCertificate ||
                              student.birthCertificateType === "PSA"
                              ? "bg-white/50 border-emerald-100"
                              : "bg-white/50 border-amber-100",
                          )}>
                          <p
                            className={cn(
                              "text-[10px] font-medium leading-relaxed italic",
                              student.hasPsaBirthCertificate ||
                                student.birthCertificateType === "PSA"
                                ? "text-emerald-800"
                                : "text-amber-800",
                            )}>
                            "In compliance with DepEd Order 017, s. 2025, this
                            document is only required once and will be carried
                            over for all future enrollments."
                          </p>
                        </div>

                        {!(
                          student.hasPsaBirthCertificate ||
                          student.birthCertificateType === "PSA"
                        ) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-amber-300 text-amber-800 hover:bg-amber-100 font-bold uppercase text-[10px] tracking-widest h-8 mt-2"
                            onClick={() => setIsAuthModalOpen(true)}>
                            Update to PSA Original
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col p-6 rounded-2xl bg-rose-50 border-2 border-rose-100 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-rose-600 rounded-lg text-white">
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-rose-900 uppercase leading-none">
                              PSA Birth Certificate
                            </h3>
                            <p className="text-[10px] font-bold text-rose-700/70 mt-1 uppercase tracking-widest text-rose-600">
                              Missing from Vault
                            </p>
                          </div>
                        </div>

                        <div className="bg-white/50 p-3 rounded-lg border border-rose-100">
                          <p className="text-xs font-bold text-rose-900 leading-relaxed">
                            Requirement Deadline:{" "}
                            <span className="text-rose-600">
                              October 31, 2026
                            </span>
                          </p>
                        </div>

                        <Button
                          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-wide gap-2 shadow-lg shadow-primary/20"
                          onClick={() => setIsAuthModalOpen(true)}>
                          <ShieldCheck className="h-5 w-5" />
                          Verify Physical Document
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-col p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 space-y-4 opacity-60 grayscale cursor-not-allowed">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-400 rounded-lg text-white">
                          <Lock className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 uppercase leading-none">
                            SF10 (Permanent Record)
                          </h3>
                          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                            Awaiting Graduation / Transfer
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic">
                        "Original SF10 is held by the school until formal
                        transfer out or completion of JHS."
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </div>
      </Tabs>

      <PinResetHandoverModal
        open={isPinResetModalOpen}
        onOpenChange={setIsPinResetModalOpen}
        studentName={`${student.lastName}, ${student.firstName}`}
        gradeLevel={student.gradeLevel.name}
        onConfirmReset={handleConfirmResetPin}
      />

      <DocumentAuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        studentName={`${student.lastName}, ${student.firstName}`}
        trackingNumber={student.trackingNumber}
        onConfirm={handleVerifyPsa}
      />
    </div>
  );
}
