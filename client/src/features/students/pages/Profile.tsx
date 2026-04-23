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
  Info,
  UserCheck,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { motion, AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { HealthRecords } from "@/features/students/components/tabs/HealthRecords";
import { StatusTimeline } from "@/features/enrollment/components/StatusTimeline";
import { SCPAssessmentBlock } from "@/features/enrollment/components/SCPAssessmentBlock";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { type AxiosError } from "axios";
import { toastApiError } from "@/shared/hooks/useApiToast";

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
      ]),
    [],
  );

  const initialTabFromQuery = searchParams.get("tab") || "personal";
  const resolvedInitialTab = validTabs.has(initialTabFromQuery)
    ? initialTabFromQuery
    : "personal";

  const [activeTab, setActiveTab] = useState(resolvedInitialTab);
  const {
    data: student,
    loading,
    error,
    refetch,
  } = useApplicationDetail(Number(id), true);

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
              <h1 className="text-2xl font-bold tracking-tight">
                {student.lastName}, {student.firstName}{" "}
                {student.middleName || ""}
              </h1>
              <Badge
                variant={student.status === "ENROLLED" ? "default" : "outline"}
                className={student.status === "ENROLLED" ? "bg-green-600" : ""}>
                {student.status}
              </Badge>
            </div>
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
            <span className="relative z-20 hidden sm:inline">Personal Info</span>
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
        </TabsList>

        <div className="mt-6">
          <TabsContent value="personal" className="m-0 focus-visible:outline-none ring-0">
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
                      <Label className="text-muted-foreground">
                        Religion
                      </Label>
                      <p className="font-medium">
                        {student.religion || "N/A"}
                      </p>
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
                          <MapPin className="h-3.5 w-3.5" /> Permanent
                          Address
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
                          {student.motherName?.contactNumber ||
                            "No contact"}
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
                          {student.fatherName?.contactNumber ||
                            "No contact"}
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
                          {student.guardianInfo?.contactNumber ||
                            "No contact"}
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
                        <p className="text-sm font-medium">
                          Reset Portal PIN
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Generate a new 6-digit PIN for the learner portal.
                          The current PIN will be invalidated.
                        </p>
                      </div>
                      <Button
                        variant="default"
                        onClick={async () => {
                          if (
                            window.confirm(
                              "Are you sure you want to reset the portal PIN? The old PIN will no longer work.",
                            )
                          ) {
                            try {
                              const res = await api.post(
                                `/students/${student.id}/reset-portal-pin`,
                              );
                              const newPin = res.data.pin;
                              sileo.success({
                                title: "PIN Reset Successful",
                                description:
                                  "Please copy this new PIN: " + newPin,
                                duration: 10000,
                              });
                            } catch (e: unknown) {
                              toastApiError(
                                e as AxiosError<{
                                  message?: string;
                                  errors?: Record<string, string[]>;
                                }>,
                              );
                            }
                          }
                        }}>
                        Reset Portal PIN
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="academic" className="m-0 focus-visible:outline-none ring-0">
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

          <TabsContent value="application" className="m-0 focus-visible:outline-none ring-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
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
                    <span className="uppercase">{student.admissionChannel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5" /> Learner Type:
                    </span>
                    <span className="uppercase">{student.learnerType.replace("_", " ")}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" /> Date Applied:
                    </span>
                    <span>{format(new Date(student.createdAt), "MMM d, yyyy")}</span>
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

          <TabsContent value="classifications" className="m-0 focus-visible:outline-none ring-0">
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
                          <p className="font-bold text-lg">
                            {student.scpType}
                          </p>
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

          <TabsContent value="health" className="m-0 focus-visible:outline-none ring-0">
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
                  <HealthRecords applicant={student} onRefresh={refetch} />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
