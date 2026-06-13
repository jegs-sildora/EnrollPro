import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  UserRoundPen,
  Fingerprint,
  FileBadge2,
  BadgeAlert,
  CheckCircle2,
  Clock,
  User,
  GraduationCap,
  Loader2,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import { getImageUrl, formatEosyStatus } from "@/shared/lib/utils";
import type { EosyStatus } from "@enrollpro/shared";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import {
  PersonalInfo,
  AddressInfo,
  GuardianContact,
  PreviousSchool,
  Classifications,
} from "@/features/enrollment/components/BeefSections";
import { sileo } from "sileo";
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

interface Address {
  houseNoStreet?: string;
  houseNo?: string;
  street?: string;
  sitio?: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  region?: string;
  zipCode?: string;
  type?: string;
}

interface FamilyMember {
  firstName: string;
  lastName: string;
  middleName?: string;
  maidenName?: string;
  contactNumber?: string;
  email?: string;
  relationship: string;
  fullName?: string;
}

export interface StudentDetail {
  id: number;
  lrn: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  sex: string;
  birthDate: string;
  address: string;
  currentAddress: Address | null;
  permanentAddress: Address | null;
  motherName: FamilyMember | null;
  fatherName: FamilyMember | null;
  guardianInfo: FamilyMember | null;
  parentGuardianName: string;
  parentGuardianContact: string;
  emailAddress: string;
  contactNumber?: string;
  trackingNumber: string;
  status: string;
  learnerStatus: string;
  applicantType?: string;
  rejectionReason: string | null;
  gradeLevel: string;
  gradeLevelId: number;
  schoolYear: string;
  schoolYearId: number;
  generalAverage?: number | null;
  readingProfileLevel?: string | null;
  enrollment: {
    id: number;
    section: string;
    sectionId: number;
    advisingTeacher: string | null;
    enrolledAt: string;
    enrolledBy: string;
    eosyStatus?: EosyStatus | null;
    dropOutReason?: string | null;
    dropOutDate?: string | null;
    transferOutDate?: string | null;
    transferOutSchoolName?: string | null;
    transferOutReason?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  studentPhoto?: string | null;
  isIpCommunity?: boolean;
  is4PsBeneficiary?: boolean;
  isLearnerWithDisability?: boolean;
  disabilityTypes?: string[];
  isBalikAral?: boolean;
}

interface Props {
  id: number;
  onClose: () => void;
  onRefreshData?: () => void;
  onTransferOut: (student: StudentDetail) => void;
  onDropout: (student: StudentDetail) => void;
  canMutate?: boolean;
}

export function StudentDetailPanel({
  id,
  onClose,
  onRefreshData,
  onTransferOut,
  onDropout,
  canMutate = true,
}: Props) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    sex: "FEMALE",
    birthDate: "",
    contactNumber: "",
    emailAddress: "",
    motherName: "",
    fatherName: "",
    guardianName: "",
    houseNoStreet: "",
    sitioPurok: "",
    region: "",
    province: "",
    cityMunicipality: "",
    barangay: "",
    isIpCommunity: "NO",
    is4PsBeneficiary: "NO",
    isBalikAral: "NO",
    disabilityType: "NONE",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showSkeleton = useDelayedLoading(loading);

  const fetchStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/students/${id}`);
      setStudent(res.data.student);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response
              .data?.message
          : "Failed to load student details";
      setError(message || "An unexpected error occurred.");
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchStudent();
      setIsEditing(false); // Reset edit mode on ID change
      setErrors({}); // Reset errors
    }
  }, [id, fetchStudent]);

  // Derived check for form dirty state
  const isProfileFormDirty = useMemo(() => {
    if (!student) return false;
    
    const motherName = student.motherName 
      ? `${student.motherName.firstName} ${student.motherName.middleName ? student.motherName.middleName + ' ' : ''}${student.motherName.lastName}`.trim()
      : "";
    const fatherName = student.fatherName 
      ? `${student.fatherName.firstName} ${student.fatherName.middleName ? student.fatherName.middleName + ' ' : ''}${student.fatherName.lastName}`.trim()
      : "";
    const guardianName = student.guardianInfo 
      ? `${student.guardianInfo.firstName} ${student.guardianInfo.middleName ? student.guardianInfo.middleName + ' ' : ''}${student.guardianInfo.lastName}`.trim()
      : student.parentGuardianName || "";
      
    const original = {
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      middleName: student.middleName || "",
      suffix: student.suffix || "",
      sex: student.sex || "FEMALE",
      birthDate: student.birthDate ? format(new Date(student.birthDate), "yyyy-MM-dd") : "",
      contactNumber: student.contactNumber || student.parentGuardianContact || "",
      emailAddress: student.emailAddress || "",
      motherName,
      fatherName,
      guardianName,
      emergencyContactNumber: student.guardianInfo?.contactNumber || "",
      streetSitio: student.currentAddress?.sitio || student.currentAddress?.street || "",
      region: student.currentAddress?.region || "Negros Island Region (NIR)",
      province: student.currentAddress?.province || "Negros Occidental",
      cityMunicipality: student.currentAddress?.cityMunicipality || "",
      barangay: student.currentAddress?.barangay || "",
      isIpCommunity: student.isIpCommunity ? "YES" : "NO",
      is4PsBeneficiary: student.is4PsBeneficiary ? "YES" : "NO",
      isBalikAral: student.isBalikAral ? "YES" : "NO",
      disabilityType: student.isLearnerWithDisability && student.disabilityTypes && student.disabilityTypes.length > 0 ? student.disabilityTypes[0] : "NONE",
    };

    return JSON.stringify(profileForm) !== JSON.stringify(original);
  }, [profileForm, student]);

  const handleEditClick = () => {
    if (!student) return;
    const motherName = student.motherName 
      ? `${student.motherName.firstName} ${student.motherName.middleName ? student.motherName.middleName + ' ' : ''}${student.motherName.lastName}`.trim()
      : "";
    const fatherName = student.fatherName 
      ? `${student.fatherName.firstName} ${student.fatherName.middleName ? student.fatherName.middleName + ' ' : ''}${student.fatherName.lastName}`.trim()
      : "";
    const guardianName = student.guardianInfo 
      ? `${student.guardianInfo.firstName} ${student.guardianInfo.middleName ? student.guardianInfo.middleName + ' ' : ''}${student.guardianInfo.lastName}`.trim()
      : student.parentGuardianName || "";
      
    setProfileForm({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      middleName: student.middleName || "",
      suffix: student.suffix || "",
      sex: student.sex || "FEMALE",
      birthDate: student.birthDate ? format(new Date(student.birthDate), "yyyy-MM-dd") : "",
      contactNumber: student.contactNumber || student.parentGuardianContact || "",
      emailAddress: student.emailAddress || "",
      motherName,
      fatherName,
      guardianName,
      houseNoStreet: student.currentAddress?.houseNoStreet || "",
      sitioPurok: student.currentAddress?.sitio || student.currentAddress?.street || "",
      region: student.currentAddress?.region || "Negros Island Region (NIR)",
      province: student.currentAddress?.province || "Negros Occidental",
      cityMunicipality: student.currentAddress?.cityMunicipality || "",
      barangay: student.currentAddress?.barangay || "",
      isIpCommunity: student.isIpCommunity ? "YES" : "NO",
      is4PsBeneficiary: student.is4PsBeneficiary ? "YES" : "NO",
      isBalikAral: student.isBalikAral ? "YES" : "NO",
      disabilityType: student.isLearnerWithDisability && student.disabilityTypes && student.disabilityTypes.length > 0 ? student.disabilityTypes[0] : "NONE",
    });
    setErrors({});
    setIsEditing(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!profileForm.firstName.trim()) newErrors.firstName = "First Name is required.";
    if (!profileForm.lastName.trim()) newErrors.lastName = "Last Name is required.";
    if (!profileForm.birthDate) newErrors.birthDate = "Date of Birth is required.";
    if (!profileForm.sex) newErrors.sex = "Sex is required.";
    
    if (!profileForm.contactNumber.trim()) {
      newErrors.contactNumber = "Primary Contact No. is required.";
    } else if (profileForm.contactNumber.trim().length !== 11) {
      newErrors.contactNumber = "Contact No. must be exactly 11 digits.";
    }
    
    if (!profileForm.region) newErrors.region = "Region is required.";
    if (!profileForm.province) newErrors.province = "Province is required.";
    if (!profileForm.cityMunicipality) newErrors.cityMunicipality = "City / Municipality is required.";
    if (!profileForm.barangay) newErrors.barangay = "Barangay is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    if (!validateForm()) {
      sileo.error({
        title: "Validation Error",
        description: "Please check the required fields.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: profileForm.firstName.trim().toUpperCase() || undefined,
        lastName: profileForm.lastName.trim().toUpperCase() || undefined,
        middleName: profileForm.middleName.trim().toUpperCase() || null,
        suffix: profileForm.suffix.trim().toUpperCase() || null,
        sex: profileForm.sex,
        birthDate: profileForm.birthDate || undefined,
        contactNumber: profileForm.contactNumber.trim() || null,
        emailAddress: profileForm.emailAddress.trim() || null,
        isIpCommunity: profileForm.isIpCommunity === "YES",
        is4PsBeneficiary: profileForm.is4PsBeneficiary === "YES",
        isBalikAral: profileForm.isBalikAral === "YES",
        isLearnerWithDisability: profileForm.disabilityType !== "NONE",
        disabilityTypes: profileForm.disabilityType !== "NONE" ? [profileForm.disabilityType] : [],
        currentAddress: {
          region: profileForm.region.trim().toUpperCase() || null,
          barangay: profileForm.barangay.trim().toUpperCase() || null,
          province: profileForm.province.trim().toUpperCase() || null,
          cityMunicipality: profileForm.cityMunicipality.trim().toUpperCase() || null,
          sitio: profileForm.sitioPurok.trim().toUpperCase() || null,
          houseNoStreet: profileForm.houseNoStreet.trim().toUpperCase() || null,
        },
      };

      const parseName = (fullName: string) => {
        const parts = fullName.trim().toUpperCase().split(" ");
        const lastName = parts.length > 1 ? parts.pop() : "";
        const firstName = parts.join(" ") || fullName.trim().toUpperCase();
        return { firstName: firstName || "Unknown", lastName: lastName || "Unknown" };
      };

      if (profileForm.motherName.trim()) {
        payload.motherName = { ...parseName(profileForm.motherName) };
      }
      if (profileForm.fatherName.trim()) {
        payload.fatherName = { ...parseName(profileForm.fatherName) };
      }

      if (profileForm.guardianName.trim()) {
        const guardian = parseName(profileForm.guardianName);
        payload.guardianInfo = {
          ...guardian,
          contactNumber: profileForm.contactNumber.trim() || null,
        };
      }

      await api.put(`/students/${student.id}`, payload);

      sileo.success({
        title: "Profile Updated",
        description: "Learner contact and address details were saved successfully.",
      });
      
      setIsEditing(false);
      await fetchStudent();
      onRefreshData?.();
    } catch (err) {
      console.error(err);
      toastApiError(err as never);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSkeleton) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <div>
            <SheetTitle className="text-base sm:text-lg font-bold  uppercase">
              <Skeleton className="h-6 w-40" />
            </SheetTitle>
            <SheetDescription
              asChild
              className="text-[11px] sm:text-xs text-foreground mt-1">
              <div>
                <Skeleton className="h-3 w-24" />
              </div>
            </SheetDescription>
          </div>
        </div>
        <div className="flex-1 p-3 sm:p-6 space-y-4 overflow-y-auto">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[200px] w-full mt-8" />
          <Skeleton className="h-[100px] w-full mt-4" />
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <SheetTitle className="text-base sm:text-lg font-bold  uppercase">
            Error
          </SheetTitle>
        </div>
        <div className="h-full flex flex-col p-4 sm:p-6 items-center justify-center text-center">
          <p className="text-destructive mb-4">
            {error || "Student not found"}
          </p>
          <Button
            variant="outline"
            onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM d, yyyy");
    } catch {
      return "N/A";
    }
  };

  // Create a shim to make StudentDetail compatible with BeefSections components
  const studentShim = {
    ...student,
    learner: {
      firstName: student.firstName,
      lastName: student.lastName,
      middleName: student.middleName,
      extensionName: student.suffix,
      sex: student.sex,
      birthdate: student.birthDate,
      lrn: student.lrn,
      studentPhoto: student.studentPhoto,
    },
    addresses: [
      student.currentAddress && {
        ...student.currentAddress,
        type: "CURRENT",
      },
      student.permanentAddress && {
        ...student.permanentAddress,
        type: "PERMANENT",
      },
    ].filter(Boolean),
    familyMembers: [
      student.motherName && {
        ...student.motherName,
        relationship: "MOTHER",
        fullName: `${student.motherName.lastName}, ${student.motherName.firstName}`,
      },
      student.fatherName && {
        ...student.fatherName,
        relationship: "FATHER",
        fullName: `${student.fatherName.lastName}, ${student.fatherName.firstName}`,
      },
      student.guardianInfo && {
        ...student.guardianInfo,
        relationship: "GUARDIAN",
        fullName: `${student.guardianInfo.lastName}, ${student.guardianInfo.firstName}`,
      },
    ].filter(Boolean),
    previousSchool: {
      ...student,
      generalAverage:
        student.enrollment?.eosyStatus === null && student.enrollment // Use enrollment average if available or fallback
          ? student.generalAverage
          : student.generalAverage,
    },
    readingProfileLevel: student.readingProfileLevel,
  };

  const typedStudentShim = studentShim as unknown as ApplicantDetail;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-black">
        <div>
          <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black  uppercase flex items-center gap-2">
            <User className="h-5 w-5" />
            Enrolled Learner Details
          </SheetTitle>
          <SheetDescription className="text-[11px] sm:text-xs text-primary-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="flex items-center gap-1">
              <Fingerprint className="h-3 w-3" />#{student.trackingNumber}
            </span>
            <span className="hidden sm:inline">|</span>
            <span>Official Roster</span>
            <span className="hidden sm:inline">|</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(student.createdAt)}
            </span>
          </SheetDescription>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-bold">
        {/* Summary Block */}
        <div className="bg-[hsl(var(--muted))] p-3 sm:p-4 rounded-md border">
          <div className="flex flex-col items-center mb-6 pt-2">
            <UserPhoto
              photo={student.studentPhoto}
              containerClassName="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-primary border-dashed shadow-md"
              onEnlarge={() => setIsPhotoEnlarged(true)}
              alt={student.fullName}
            />
            <div className="text-center mt-4">
              <h3 className="font-black text-lg sm:text-xl uppercase  break-words">
                {student.fullName}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-1 font-black">
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-3 py-1 rounded-full text-[11px] uppercase  shadow-sm">
                  <CheckCircle2 className="h-3 w-3" />
                  Officially Enrolled
                </Badge>
                {student.applicantType === "LATE_ENROLLEE" && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 gap-1 px-3 py-1 rounded-full text-[11px] uppercase  shadow-sm font-black">
                    🕒 Late Enrollee
                  </Badge>
                )}
              </div>
              {!isEditing && canMutate && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="font-bold text-xs h-8 uppercase border shadow-sm w-full max-w-[200px]"
                    onClick={handleEditClick}>
                    <UserRoundPen className="mr-2 h-3.5 w-3.5 shrink-0" />
                    Edit Learner Data
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 border-t pt-4">
            <div>
              <p className="text-xs sm:text-[0.625rem] uppercase  text-foreground">
                Grade Level & Section
              </p>
              <p className="text-xs sm:text-sm">
                {student.gradeLevel}
                {student.enrollment?.section &&
                  ` • ${student.enrollment.section}`}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs sm:text-[0.625rem] uppercase  text-foreground">
                Learner Reference Number
              </p>
              <p className="text-xs sm:text-sm tabular-nums">
                {student.lrn || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Enrollment Information Section */}
        <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden">
          <div className="p-3 font-bold text-sm bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Enrollment Information
          </div>
          <div className="p-4 text-sm grid grid-cols-[140px_1fr] gap-x-2 gap-y-1.5 font-bold">
            <span className="text-foreground">School Year:</span>
            <span>{student.schoolYear}</span>
            <span className="text-foreground">Enrolled At:</span>
            <span>
              {student.enrollment?.enrolledAt
                ? formatDate(student.enrollment.enrolledAt)
                : "N/A"}
            </span>
            <span className="text-foreground">Enrolled By:</span>
            <span className="uppercase">
              {student.enrollment?.enrolledBy || "N/A"}
            </span>
            {student.enrollment?.advisingTeacher && (
              <>
                <span className="text-foreground">Advising Teacher:</span>
                <span className="uppercase">
                  {student.enrollment.advisingTeacher}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Lifecycle Outcome (if any) */}
        {student.enrollment?.eosyStatus && (
          <div className="border rounded-md mb-4 border-dashed bg-muted/30 overflow-hidden">
            <div className="p-3 font-bold text-sm bg-muted/50 border-b flex items-center gap-2 text-primary">
              <BadgeAlert className="h-4 w-4" />
              Lifecycle Outcome
            </div>
            <div className="p-4 text-sm space-y-2">
              <p className="font-black text-primary uppercase">
                {formatEosyStatus(student.enrollment.eosyStatus)}
              </p>
              {student.enrollment.transferOutDate && (
                <p className="text-xs">
                  <span className="text-foreground mr-2 font-bold uppercase">
                    Date:
                  </span>
                  {formatDate(student.enrollment.transferOutDate)}
                </p>
              )}
              {student.enrollment.transferOutSchoolName && (
                <p className="text-xs">
                  <span className="text-foreground mr-2 font-bold uppercase">
                    To:
                  </span>
                  {student.enrollment.transferOutSchoolName}
                </p>
              )}
              {student.enrollment.transferOutReason && (
                <p className="text-xs">
                  <span className="text-foreground mr-2 font-bold uppercase">
                    Reason:
                  </span>
                  {student.enrollment.transferOutReason}
                </p>
              )}
              {student.enrollment.dropOutDate && (
                <p className="text-xs">
                  <span className="text-foreground mr-2 font-bold uppercase">
                    Date:
                  </span>
                  {formatDate(student.enrollment.dropOutDate)}
                </p>
              )}
              {student.enrollment.dropOutReason && (
                <p className="text-xs">
                  <span className="text-foreground mr-2 font-bold uppercase">
                    Reason:
                  </span>
                  {student.enrollment.dropOutReason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main Body content: Either Edit Form or Read-only BeefSections */}
        {isEditing ? (
          <form id="learner-edit-form" onSubmit={submitProfileUpdate} className="space-y-6 bg-card border rounded-lg p-5 mt-4 shadow-sm">
            <h3 className="font-black text-lg text-primary flex items-center gap-2 mb-2">
              <UserRoundPen className="h-5 w-5" />
              Update Learner Profile
            </h3>

            {/* Section 1: Personal Information */}
            <div className="space-y-4">
              <p className="text-xs uppercase font-black text-foreground border-b pb-1">
                Personal Information
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-bold text-xs uppercase flex gap-1">First Name <span className="text-destructive">*</span></Label>
                  <Input id="firstName" value={profileForm.firstName} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, firstName: e.target.value }))} className={`font-bold text-sm bg-background uppercase ${errors.firstName ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                  {errors.firstName && <p className="text-xs text-destructive font-bold">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-bold text-xs uppercase flex gap-1">Last Name <span className="text-destructive">*</span></Label>
                  <Input id="lastName" value={profileForm.lastName} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, lastName: e.target.value }))} className={`font-bold text-sm bg-background uppercase ${errors.lastName ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                  {errors.lastName && <p className="text-xs text-destructive font-bold">{errors.lastName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName" className="font-bold text-xs uppercase">Middle Name</Label>
                  <Input id="middleName" value={profileForm.middleName} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, middleName: e.target.value }))} className="font-bold text-sm bg-background uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix" className="font-bold text-xs uppercase">Extension (e.g. Jr, III)</Label>
                  <Input id="suffix" value={profileForm.suffix} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, suffix: e.target.value }))} className="font-bold text-sm bg-background uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="font-bold text-xs uppercase flex gap-1">Date of Birth <span className="text-destructive">*</span></Label>
                  <HybridDatePicker value={profileForm.birthDate} onChange={(val) => setProfileForm(p => ({ ...p, birthDate: val }))} className={`font-bold text-sm bg-background ${errors.birthDate ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                  {errors.birthDate && <p className="text-xs text-destructive font-bold">{errors.birthDate}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex" className="font-bold text-xs uppercase flex gap-1">Sex <span className="text-destructive">*</span></Label>
                  <Select value={profileForm.sex} onValueChange={(val) => setProfileForm(p => ({ ...p, sex: val }))}>
                    <SelectTrigger className={`bg-background font-bold text-sm ${errors.sex ? 'border-destructive focus-visible:ring-destructive' : ''}`}>
                      <SelectValue placeholder="Select Sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">MALE</SelectItem>
                      <SelectItem value="FEMALE">FEMALE</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.sex && <p className="text-xs text-destructive font-bold">{errors.sex}</p>}
                </div>
              </div>
            </div>

            {/* Section 2: Parents & Guardian (SF1) */}
            <div className="space-y-4">
              <p className="text-xs uppercase font-black text-foreground border-b pb-1">
                Parents & Guardian
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="motherName" className="font-bold text-xs uppercase">Mother's Maiden Name</Label>
                  <Input id="motherName" value={profileForm.motherName} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, motherName: e.target.value }))} placeholder="FIRST LAST" className="font-bold text-sm bg-background uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fatherName" className="font-bold text-xs uppercase">Father's Name</Label>
                  <Input id="fatherName" value={profileForm.fatherName} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, fatherName: e.target.value }))} placeholder="FIRST LAST" className="font-bold text-sm bg-background uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianName" className="font-bold text-xs uppercase">Guardian's Name</Label>
                  <Input id="guardianName" value={profileForm.guardianName} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, guardianName: e.target.value }))} placeholder="FIRST LAST" className="font-bold text-sm bg-background uppercase" />
                </div>
              </div>
            </div>

            {/* Section 3: Contact & Address */}
            <div className="space-y-4">
              <p className="text-xs uppercase font-black text-foreground border-b pb-1">
                Contact & Address
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profileContact" className="font-bold text-xs uppercase flex gap-1">Primary Contact No. <span className="text-destructive">*</span></Label>
                  <Input id="profileContact" maxLength={11} onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ""); }} value={profileForm.contactNumber} onChange={(e) => setProfileForm(p => ({ ...p, contactNumber: e.target.value }))} placeholder="09XXXXXXXXX" className={`font-bold text-sm bg-background ${errors.contactNumber ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                  {errors.contactNumber && <p className="text-xs text-destructive font-bold">{errors.contactNumber}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileEmail" className="font-bold text-xs uppercase">Learner Email</Label>
                  <Input id="profileEmail" type="email" value={profileForm.emailAddress} onChange={(e) => setProfileForm(p => ({ ...p, emailAddress: e.target.value }))} placeholder="learner@email.com" className="font-bold text-sm bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="houseNoStreet" className="font-bold text-xs uppercase">House No. / Street</Label>
                  <Input id="houseNoStreet" value={profileForm.houseNoStreet} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, houseNoStreet: e.target.value }))} placeholder="e.g. 123 OR RIZAL STREET" className="font-bold text-sm bg-background uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sitioPurok" className="font-bold text-xs uppercase">Sitio / Purok</Label>
                  <Input id="sitioPurok" value={profileForm.sitioPurok} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }} onChange={(e) => setProfileForm(p => ({ ...p, sitioPurok: e.target.value }))} placeholder="e.g. PUROK 1" className="font-bold text-sm bg-background uppercase" />
                </div>
              </div>
              <PhilippineAddressSelector
                required
                errors={{
                  region: errors.region,
                  province: errors.province,
                  cityMunicipality: errors.cityMunicipality,
                  barangay: errors.barangay,
                }}
                value={{
                  region: profileForm.region,
                  province: profileForm.province,
                  cityMunicipality: profileForm.cityMunicipality,
                  barangay: profileForm.barangay,
                }}
                onChange={(field, val) => {
                  setProfileForm((prev) => ({
                    ...prev,
                    [field]: val,
                    ...(field === "region" ? { province: "", cityMunicipality: "", barangay: "" } : {}),
                    ...(field === "province" ? { cityMunicipality: "", barangay: "" } : {}),
                    ...(field === "cityMunicipality" ? { barangay: "" } : {}),
                  }));
                  // Clear the error for this field when the user changes it
                  setErrors((prev) => ({ ...prev, [field]: "" }));
                }}
              />
            </div>

            {/* Section 4: Special Demographics */}
            <div className="space-y-4">
              <p className="text-xs uppercase font-black text-foreground border-b pb-1">
                Special Demographics & Interventions
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase">IP Community</Label>
                  <Select value={profileForm.isIpCommunity} onValueChange={(val) => setProfileForm(p => ({ ...p, isIpCommunity: val }))}>
                    <SelectTrigger className="bg-background font-bold text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="YES">YES</SelectItem><SelectItem value="NO">NO</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase">4Ps Beneficiary</Label>
                  <Select value={profileForm.is4PsBeneficiary} onValueChange={(val) => setProfileForm(p => ({ ...p, is4PsBeneficiary: val }))}>
                    <SelectTrigger className="bg-background font-bold text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="YES">YES</SelectItem><SelectItem value="NO">NO</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase">Balik-Aral</Label>
                  <Select value={profileForm.isBalikAral} onValueChange={(val) => setProfileForm(p => ({ ...p, isBalikAral: val }))}>
                    <SelectTrigger className="bg-background font-bold text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="YES">YES</SelectItem><SelectItem value="NO">NO</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase">Disability Type</Label>
                  <Select value={profileForm.disabilityType} onValueChange={(val) => setProfileForm(p => ({ ...p, disabilityType: val }))}>
                    <SelectTrigger className="bg-background font-bold text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="Visual Impairment">Visual Impairment</SelectItem>
                      <SelectItem value="Hearing Impairment">Hearing Impairment</SelectItem>
                      <SelectItem value="Intellectual Disability">Intellectual Disability</SelectItem>
                      <SelectItem value="Learning Disability">Learning Disability</SelectItem>
                      <SelectItem value="Autism Spectrum Disorder">Autism Spectrum Disorder</SelectItem>
                      <SelectItem value="Emotional-Behavioral Disorder">Emotional-Behavioral Disorder</SelectItem>
                      <SelectItem value="Orthopedic/Physical Handicap">Orthopedic/Physical Handicap</SelectItem>
                      <SelectItem value="Speech/Language Disorder">Speech/Language Disorder</SelectItem>
                      <SelectItem value="Cerebral Palsy">Cerebral Palsy</SelectItem>
                      <SelectItem value="Special Health Problem">Special Health Problem</SelectItem>
                      <SelectItem value="Multiple Disabilities">Multiple Disabilities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <PersonalInfo applicant={typedStudentShim} />
            <AddressInfo applicant={typedStudentShim} />
            <GuardianContact applicant={typedStudentShim} />
            <PreviousSchool applicant={typedStudentShim} />
            <Classifications applicant={typedStudentShim} />
            
            <div className="pt-4 border-t text-xs uppercase text-foreground flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Record Created: {formatDate(student.createdAt)}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Last System Update: {formatDate(student.updatedAt)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {isEditing ? (
        <div className="p-4 bg-muted/10 border-t border-border flex gap-3 shrink-0 justify-end sm:flex-row">
          <Button
            variant="outline"
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isSubmitting}
            className="font-bold uppercase text-xs border-border px-6 cursor-pointer bg-background text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="learner-edit-form"
            disabled={isSubmitting || !isProfileFormDirty}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase text-xs px-6 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      ) : (
        <div className="p-2 border-t bg-[hsl(var(--muted)/30)]">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 font-bold text-xs sm:text-xs h-9 uppercase bg-orange-50 text-orange-700 hover:text-orange-800 hover:bg-orange-100 border-orange-200 shadow-sm"
              onClick={() => onTransferOut(student)}>
              <FileBadge2 className="h-4 w-4 mr-2" />
              Transferred Out
            </Button>
            <Button
              variant="outline"
              className="flex-1 font-bold text-xs sm:text-xs h-9 uppercase bg-rose-50 text-rose-700 hover:text-rose-800 hover:bg-rose-100 border-rose-200 shadow-sm"
              onClick={() => onDropout(student)}>
              <BadgeAlert className="h-4 w-4 mr-2" />
              Dropped Out
            </Button>
          </div>
        </div>
      )}

      {student.studentPhoto && (
        <ImageEnlarger
          src={getImageUrl(student.studentPhoto) || ""}
          isOpen={isPhotoEnlarged}
          onClose={() => setIsPhotoEnlarged(false)}
          alt={`${student.lastName} profile photo`}
        />
      )}
    </div>
  );
}
