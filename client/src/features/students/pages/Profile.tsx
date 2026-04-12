import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Fingerprint,
  Key,
} from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState("personal");
  const {
    data: student,
    loading,
    error,
    refetch,
  } = useApplicationDetail(Number(id), true);
  const [photoError, setPhotoError] = useState(false);

  const getImageUrl = (photo: string | null) => {
    if (!photo) return null;
    if (photo.startsWith("data:")) return photo;
    const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(
      /\/api$/,
      "",
    );
    return `${baseUrl}${photo}`;
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

          <div className="w-20 h-20 rounded-full border-2 border-primary/10 shadow-sm overflow-hidden bg-background flex items-center justify-center shrink-0">
            {student.studentPhoto && !photoError ? (
              <img
                src={getImageUrl(student.studentPhoto) || ""}
                alt="Student"
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <User className="w-8 h-8 text-muted-foreground/30" />
            )}
          </div>

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
              <span>{student.gradeLevel.name}</span>
              {student.enrollment?.section && (
                <>
                  <span>•</span>
                  <span>{student.enrollment.section.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block text-right">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
            Tracking Number
          </p>
          <p className="text-lg font-mono font-bold">
            {student.trackingNumber}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted/50">
          <TabsTrigger value="personal" className="py-2">
            Personal Info
          </TabsTrigger>
          <TabsTrigger value="academic" className="py-2">
            Academic History
          </TabsTrigger>
          <TabsTrigger value="application" className="py-2">
            Application Record
          </TabsTrigger>
          <TabsTrigger value="classifications" className="py-2">
            Programs & Tags
          </TabsTrigger>
          <TabsTrigger value="health" className="py-2">
            Health Records
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}>
              <TabsContent value="personal" className="m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
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
                            {format(
                              new Date(student.birthDate),
                              "MMMM d, yyyy",
                            )}
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
                            {student.currentAddress.houseNo}{" "}
                            {student.currentAddress.street},{" "}
                            {student.currentAddress.barangay},{" "}
                            {student.currentAddress.cityMunicipality},{" "}
                            {student.currentAddress.province}
                          </p>
                        </div>
                        {student.permanentAddress && (
                          <div className="space-y-1">
                            <Label className="text-muted-foreground flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5" /> Permanent
                              Address
                            </Label>
                            <p className="font-medium">
                              {student.permanentAddress.houseNo}{" "}
                              {student.permanentAddress.street},{" "}
                              {student.permanentAddress.barangay},{" "}
                              {student.permanentAddress.cityMunicipality},{" "}
                              {student.permanentAddress.province}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Family & Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                            Mother's Information
                          </Label>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p className="font-medium">
                              {student.motherName.firstName}{" "}
                              {student.motherName.lastName}
                            </p>
                            <p className="text-muted-foreground flex items-center gap-2">
                              <Phone className="h-3 w-3" />{" "}
                              {student.motherName.contactNumber || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                            Father's Information
                          </Label>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p className="font-medium">
                              {student.fatherName.firstName}{" "}
                              {student.fatherName.lastName}
                            </p>
                            <p className="text-muted-foreground flex items-center gap-2">
                              <Phone className="h-3 w-3" />{" "}
                              {student.fatherName.contactNumber || "N/A"}
                            </p>
                          </div>
                        </div>
                        {student.guardianInfo && (
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                              Guardian's Information
                            </Label>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <p className="font-medium">
                                {student.guardianInfo.firstName}{" "}
                                {student.guardianInfo.lastName} (
                                {student.guardianInfo.relationship})
                              </p>
                              <p className="text-muted-foreground flex items-center gap-2">
                                <Phone className="h-3 w-3" />{" "}
                                {student.guardianInfo.contactNumber || "N/A"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-1 text-sm">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" /> Email Address
                        </Label>
                        <p className="font-medium">
                          {student.emailAddress || "N/A"}
                        </p>
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
                </div>
              </TabsContent>
              <TabsContent value="academic" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="application" className="m-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <SCPAssessmentBlock applicant={student} />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
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
                      <CardTitle className="text-base">
                        Application Metadata
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Tracking No:
                        </span>
                        <span className="font-mono font-bold">
                          {student.trackingNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Admission Channel:
                        </span>
                        <span className="font-bold">
                          {student.admissionChannel}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Learner Type:
                        </span>
                        <span className="font-bold">
                          {student.learnerType.replace("_", " ")}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Date Applied:
                        </span>
                        <span>
                          {format(new Date(student.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      {student.encodedBy && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Encoded By:
                          </span>
                          <span>
                            {student.encodedBy.firstName}{" "}
                            {student.encodedBy.lastName}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="classifications" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Classifications & Special Programs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            IP Community Membership
                          </Label>
                          <p className="font-bold text-lg">
                            {student.isIpCommunity
                              ? `YES (${student.ipGroupName})`
                              : "NO"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            4Ps Beneficiary
                          </Label>
                          <p className="font-bold text-lg">
                            {student.is4PsBeneficiary
                              ? `YES (${student.householdId4Ps})`
                              : "NO"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">
                            Learner with Disability
                          </Label>
                          <p className="font-bold text-lg">
                            {student.isLearnerWithDisability ? `YES` : "NO"}
                          </p>
                          {student.isLearnerWithDisability &&
                            student.disabilityTypes.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {student.disabilityTypes.map((t) => (
                                  <Badge key={t} variant="outline">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
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
              </TabsContent>

              <TabsContent value="health" className="m-0">
                <Card>
                  <CardContent className="pt-6">
                    <HealthRecords applicant={student} onRefresh={refetch} />
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}
