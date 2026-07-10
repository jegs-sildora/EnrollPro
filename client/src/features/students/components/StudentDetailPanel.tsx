import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  UserRoundPen,
  FileBadge2,
  BadgeAlert,
  CheckCircle2,
  Clock,
  User,
  GraduationCap,
  Loader2,
  Venus,
  Mars,
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
import { Textarea } from "@/shared/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import { getImageUrl, formatEosyStatus, cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
import type { EosyStatus } from "@enrollpro/shared";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { useSettingsStore } from "@/store/settings.slice";
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
import { useUnsavedChanges } from "@/shared/hooks/useUnsavedChanges";

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

const getProgramBadge = (type: string | undefined | null) => {
  if (!type || type === "REGULAR" || type === "LATE_ENROLLEE") return { short: "BEC", full: "Basic Education Curriculum" };
  switch (type) {
    case "SCIENCE_TECHNOLOGY_AND_ENGINEERING": return { short: "STE", full: "Science, Technology, and Engineering" };
    case "SPECIAL_PROGRAM_IN_THE_ARTS": return { short: "SPA", full: "Special Program in the Arts" };
    case "SPECIAL_PROGRAM_IN_SPORTS": return { short: "SPS", full: "Special Program in Sports" };
    case "SPECIAL_PROGRAM_IN_JOURNALISM": return { short: "SPJ", full: "Special Program in Journalism" };
    case "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE": return { short: "SPFL", full: "Special Program in Foreign Language" };
    case "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION": return { short: "SPTVE", full: "Special Program in Technical Vocational Education" };
    default: return { short: type, full: type };
  }
};

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
  ipGroupName?: string | null;
  is4PsBeneficiary?: boolean;
  isLearnerWithDisability?: boolean;
  disabilityTypes?: string[];
  isBalikAral?: boolean;
  motherTongue?: string | null;
  religion?: string | null;
  portalStatus?: string;
  historicalGrades?: {
    gradeLevel: string;
    genAve: number;
    schoolYear: string;
    completedAt?: string;
  }[];
}

interface Props {
  id: number;
  schoolYearId?: number | null;
  onClose: () => void;
  onRefreshData?: () => void;
  onTransferOut?: (payload: StudentTransferOutPayload) => void;
  onDropout?: (payload: StudentDropoutPayload) => void;
  canEditProfile?: boolean;
}

export interface StudentTransferOutPayload {
  student: StudentDetail;
  transferDate: string;
  destinationSchool: string;
  reasonNote: string;
}

export interface StudentDropoutPayload {
  student: StudentDetail;
  dropOutDate: string;
  reasonCode: string;
  interventionNotes: string;
}

export function StudentDetailPanel({
  id,
  schoolYearId,
  onClose,
  onRefreshData,
  onTransferOut,
  onDropout,
  canEditProfile = true,
}: Props) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [transferOutDate, setTransferOutDate] = useState("");
  const [transferOutSchoolName, setTransferOutSchoolName] = useState("");
  const [transferOutReason, setTransferOutReason] = useState("");
  const [showTransferOutDialog, setShowTransferOutDialog] = useState(false);

  const [dropoutDate, setDropoutDate] = useState("");
  const [dropoutReasonCode, setDropoutReasonCode] =
    useState<string>("LACK_OF_INTEREST");
  const [dropoutInterventionNotes, setDropoutInterventionNotes] = useState("");
  const [showDropoutDialog, setShowDropoutDialog] = useState(false);

  const handleTransferOutSubmit = () => {
    if (!student) return;

    onTransferOut?.({
      student,
      transferDate: transferOutDate,
      destinationSchool: transferOutSchoolName,
      reasonNote: transferOutReason,
    });
    setShowTransferOutDialog(false);
  };

  const handleDropoutSubmit = () => {
    if (!student) return;

    onDropout?.({
      student,
      dropOutDate: dropoutDate,
      reasonCode: dropoutReasonCode,
      interventionNotes: dropoutInterventionNotes,
    });
    setShowDropoutDialog(false);
  };
  const [error, setError] = useState<string | null>(null);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [portalActive, setPortalActive] = useState(true);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [isPortalActionSubmitting, setIsPortalActionSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setPortalActive(student.portalStatus === "ACTIVE");
    }
  }, [student]);

  const handleTogglePortalAccess = async (active: boolean) => {
    if (!student) return;
    setIsPortalActionSubmitting(true);
    try {
      await api.patch(`/students/${student.id}/portal-access`, { isActive: active });
      setPortalActive(active);
      sileo.success({
        title: "Portal Access Updated",
        description: `Student portal has been ${active ? "activated" : "locked"}.`,
      });
      if (onRefreshData) onRefreshData();
    } catch (err: unknown) {
      sileo.error({
        title: "Failed to Update Portal Access",
        description: "An error occurred while updating portal status.",
      });
    } finally {
      setIsPortalActionSubmitting(false);
    }
  };

  const handleResetPassword = () => {
    setShowResetPasswordConfirm(true);
  };

  const handleResetPasswordConfirm = async () => {
    if (!student) return;
    if (!defaultPasswordInput.trim()) {
      sileo.error({
        title: "Validation Error",
        description: "Default password cannot be empty.",
      });
      return;
    }
    setShowResetPasswordConfirm(false);
    setIsPortalActionSubmitting(true);
    try {
      await api.post(`/students/${student.id}/reset-password`, { password: defaultPasswordInput });
      sileo.success({
        title: "Password Reset Success",
        description: "Student portal password has been reset.",
      });
    } catch (err: unknown) {
      sileo.error({
        title: "Failed to Reset Password",
        description: "An error occurred while resetting password.",
      });
    } finally {
      setIsPortalActionSubmitting(false);
    }
  };
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    sex: "FEMALE",
    birthDate: "",
    contactNumber: "",
    motherFirstName: "",
    motherLastName: "",
    motherMiddleName: "",
    fatherFirstName: "",
    fatherLastName: "",
    fatherMiddleName: "",
    guardianFirstName: "",
    guardianLastName: "",
    guardianMiddleName: "",
    houseNoStreet: "",
    sitioPurok: "",
    region: "",
    province: "",
    cityMunicipality: "",
    barangay: "",
    isIpCommunity: "NO",
    ipGroupName: "",
    is4PsBeneficiary: "NO",
    isBalikAral: "NO",
    disabilityType: "NONE",
    motherTongue: "",
    religion: "",
    primaryContact: "MOTHER",
    motherContactNumber: "",
    fatherContactNumber: "",
    guardianContactNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [defaultPasswordInput, setDefaultPasswordInput] = useState("");

  const showSkeleton = useDelayedLoading(loading);
  const isJhsCompleter = student?.learnerStatus === "JHS_COMPLETER";

  const fetchStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/students/${id}`, {
        params: { schoolYearId: schoolYearId || undefined }
      });
      const { student, historicalGrades } = res.data;
      if (student) {
        student.historicalGrades = historicalGrades;
      }
      setStudent(student);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data
            ?.message
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

  const globalDefaultPassword = useSettingsStore((s) => s.globalDefaultPassword);

  useEffect(() => {
    setDefaultPasswordInput(globalDefaultPassword || "");
  }, [globalDefaultPassword]);

  // Derived check for form dirty state
  const isProfileFormDirty = useMemo(() => {
    if (!student) return false;

    const original = {
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      middleName: student.middleName || "",
      suffix: student.suffix || "",
      sex: student.sex || "FEMALE",
      birthDate: student.birthDate
        ? format(new Date(student.birthDate), "yyyy-MM-dd")
        : "",
      contactNumber:
        student.contactNumber || student.parentGuardianContact || "",
      motherFirstName: student.motherName?.firstName || "",
      motherLastName: student.motherName?.lastName || "",
      motherMiddleName: student.motherName?.middleName || "",
      fatherFirstName: student.fatherName?.firstName || "",
      fatherLastName: student.fatherName?.lastName || "",
      fatherMiddleName: student.fatherName?.middleName || "",
      guardianFirstName: student.guardianInfo?.firstName || "",
      guardianLastName: student.guardianInfo?.lastName || "",
      guardianMiddleName: student.guardianInfo?.middleName || "",
      houseNoStreet: student.currentAddress?.houseNoStreet || "",
      sitioPurok:
        student.currentAddress?.sitio || student.currentAddress?.street || "",
      region: student.currentAddress?.region || "Negros Island Region (NIR)",
      province: student.currentAddress?.province || "Negros Occidental",
      cityMunicipality: student.currentAddress?.cityMunicipality || "",
      barangay: student.currentAddress?.barangay || "",
      isIpCommunity: student.isIpCommunity ? "YES" : "NO",
      ipGroupName: student.ipGroupName || "",
      is4PsBeneficiary: student.is4PsBeneficiary ? "YES" : "NO",
      isBalikAral: student.isBalikAral ? "YES" : "NO",
      disabilityType:
        student.isLearnerWithDisability &&
          student.disabilityTypes &&
          student.disabilityTypes.length > 0
          ? student.disabilityTypes[0]
          : "NONE",
      motherTongue: student.motherTongue || "",
      religion: student.religion || "",
      primaryContact:
        student.contactNumber === student.motherName?.contactNumber &&
          student.motherName?.contactNumber
          ? "MOTHER"
          : student.contactNumber === student.fatherName?.contactNumber &&
            student.fatherName?.contactNumber
            ? "FATHER"
            : student.contactNumber === student.guardianInfo?.contactNumber &&
              student.guardianInfo?.contactNumber
              ? "GUARDIAN"
              : "MOTHER",
      motherContactNumber: student.motherName?.contactNumber || "",
      fatherContactNumber: student.fatherName?.contactNumber || "",
      guardianContactNumber: student.guardianInfo?.contactNumber || "",
    };

    return JSON.stringify(profileForm) !== JSON.stringify(original);
  }, [profileForm, student]);

  const resetProfileEdits = useCallback(() => {
    if (!student) return;

    setProfileForm({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      middleName: student.middleName || "",
      suffix: student.suffix || "",
      sex: student.sex || "FEMALE",
      birthDate: student.birthDate
        ? format(new Date(student.birthDate), "yyyy-MM-dd")
        : "",
      contactNumber:
        student.contactNumber || student.parentGuardianContact || "",
      motherFirstName: student.motherName?.firstName || "",
      motherLastName: student.motherName?.lastName || "",
      motherMiddleName: student.motherName?.middleName || "",
      fatherFirstName: student.fatherName?.firstName || "",
      fatherLastName: student.fatherName?.lastName || "",
      fatherMiddleName: student.fatherName?.middleName || "",
      guardianFirstName: student.guardianInfo?.firstName || "",
      guardianLastName: student.guardianInfo?.lastName || "",
      guardianMiddleName: student.guardianInfo?.middleName || "",
      houseNoStreet: student.currentAddress?.houseNoStreet || "",
      sitioPurok:
        student.currentAddress?.sitio || student.currentAddress?.street || "",
      region: student.currentAddress?.region || "Negros Island Region (NIR)",
      province: student.currentAddress?.province || "Negros Occidental",
      cityMunicipality: student.currentAddress?.cityMunicipality || "",
      barangay: student.currentAddress?.barangay || "",
      isIpCommunity: student.isIpCommunity ? "YES" : "NO",
      ipGroupName: student.ipGroupName || "",
      is4PsBeneficiary: student.is4PsBeneficiary ? "YES" : "NO",
      isBalikAral: student.isBalikAral ? "YES" : "NO",
      disabilityType:
        student.isLearnerWithDisability &&
          student.disabilityTypes &&
          student.disabilityTypes.length > 0
          ? student.disabilityTypes[0]
          : "NONE",
      motherTongue: student.motherTongue || "",
      religion: student.religion || "",
      primaryContact:
        student.contactNumber === student.motherName?.contactNumber &&
          student.motherName?.contactNumber
          ? "MOTHER"
          : student.contactNumber === student.fatherName?.contactNumber &&
            student.fatherName?.contactNumber
            ? "FATHER"
            : student.contactNumber === student.guardianInfo?.contactNumber &&
              student.guardianInfo?.contactNumber
              ? "GUARDIAN"
              : "MOTHER",
      motherContactNumber: student.motherName?.contactNumber || "",
      fatherContactNumber: student.fatherName?.contactNumber || "",
      guardianContactNumber: student.guardianInfo?.contactNumber || "",
    });
    setErrors({});
    setIsEditing(false);
  }, [student]);

  useUnsavedChanges({
    id: "student-detail-panel",
    label: "Learner profile",
    isDirty: isEditing && isProfileFormDirty,
    isSubmitting,
    onDiscard: resetProfileEdits,
  });

  const handleEditClick = () => {
    if (!student) return;

    setProfileForm({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      middleName: student.middleName || "",
      suffix: student.suffix || "",
      sex: student.sex || "FEMALE",
      birthDate: student.birthDate
        ? format(new Date(student.birthDate), "yyyy-MM-dd")
        : "",
      contactNumber:
        student.contactNumber || student.parentGuardianContact || "",
      motherFirstName: student.motherName?.firstName || "",
      motherLastName: student.motherName?.lastName || "",
      motherMiddleName: student.motherName?.middleName || "",
      fatherFirstName: student.fatherName?.firstName || "",
      fatherLastName: student.fatherName?.lastName || "",
      fatherMiddleName: student.fatherName?.middleName || "",
      guardianFirstName: student.guardianInfo?.firstName || "",
      guardianLastName: student.guardianInfo?.lastName || "",
      guardianMiddleName: student.guardianInfo?.middleName || "",
      houseNoStreet: student.currentAddress?.houseNoStreet || "",
      sitioPurok:
        student.currentAddress?.sitio || student.currentAddress?.street || "",
      region: student.currentAddress?.region || "Negros Island Region (NIR)",
      province: student.currentAddress?.province || "Negros Occidental",
      cityMunicipality: student.currentAddress?.cityMunicipality || "",
      barangay: student.currentAddress?.barangay || "",
      isIpCommunity: student.isIpCommunity ? "YES" : "NO",
      ipGroupName: student.ipGroupName || "",
      is4PsBeneficiary: student.is4PsBeneficiary ? "YES" : "NO",
      isBalikAral: student.isBalikAral ? "YES" : "NO",
      disabilityType:
        student.isLearnerWithDisability &&
          student.disabilityTypes &&
          student.disabilityTypes.length > 0
          ? student.disabilityTypes[0]
          : "NONE",
      motherTongue: student.motherTongue || "",
      religion: student.religion || "",
      primaryContact:
        student.contactNumber === student.motherName?.contactNumber &&
          student.motherName?.contactNumber
          ? "MOTHER"
          : student.contactNumber === student.fatherName?.contactNumber &&
            student.fatherName?.contactNumber
            ? "FATHER"
            : student.contactNumber === student.guardianInfo?.contactNumber &&
              student.guardianInfo?.contactNumber
              ? "GUARDIAN"
              : "MOTHER",
      motherContactNumber: student.motherName?.contactNumber || "",
      fatherContactNumber: student.fatherName?.contactNumber || "",
      guardianContactNumber: student.guardianInfo?.contactNumber || "",
    });
    setErrors({});
    setIsEditing(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!profileForm.firstName.trim())
      newErrors.firstName = "First Name is required.";
    if (!profileForm.lastName.trim())
      newErrors.lastName = "Last Name is required.";
    if (!profileForm.birthDate)
      newErrors.birthDate = "Date of Birth is required.";
    if (!profileForm.sex) newErrors.sex = "Sex is required.";

    const selectedContactNo =
      profileForm.primaryContact === "MOTHER"
        ? profileForm.motherContactNumber
        : profileForm.primaryContact === "FATHER"
          ? profileForm.fatherContactNumber
          : profileForm.guardianContactNumber;

    if (!selectedContactNo.trim()) {
      newErrors.contactNumber =
        "Primary Contact No. is required for the selected Emergency Contact.";
    } else if (selectedContactNo.trim().length !== 11) {
      newErrors.contactNumber = "Contact No. must be exactly 11 digits.";
    }

    if (!profileForm.region) newErrors.region = "Region is required.";
    if (!profileForm.province) newErrors.province = "Province is required.";
    if (!profileForm.cityMunicipality)
      newErrors.cityMunicipality = "City / Municipality is required.";
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
        contactNumber: profileForm.contactNumber?.trim() || null, // Keeping for fallback

        isIpCommunity: profileForm.isIpCommunity === "YES",
        ipGroupName:
          profileForm.isIpCommunity === "YES"
            ? profileForm.ipGroupName.trim() || null
            : null,
        is4PsBeneficiary: profileForm.is4PsBeneficiary === "YES",
        isBalikAral: profileForm.isBalikAral === "YES",
        isLearnerWithDisability: profileForm.disabilityType !== "NONE",
        disabilityTypes:
          profileForm.disabilityType !== "NONE"
            ? [profileForm.disabilityType]
            : [],
        motherTongue: profileForm.motherTongue.trim() || null,
        religion: profileForm.religion.trim() || null,
        primaryContact: profileForm.primaryContact,
        currentAddress: {
          region: profileForm.region.trim().toUpperCase() || null,
          barangay: profileForm.barangay.trim().toUpperCase() || null,
          province: profileForm.province.trim().toUpperCase() || null,
          cityMunicipality:
            profileForm.cityMunicipality.trim().toUpperCase() || null,
          sitio: profileForm.sitioPurok.trim().toUpperCase() || null,
          houseNoStreet: profileForm.houseNoStreet.trim().toUpperCase() || null,
        },
      };

      if (
        profileForm.motherFirstName.trim() ||
        profileForm.motherLastName.trim()
      ) {
        payload.motherName = {
          firstName:
            profileForm.motherFirstName.trim().toUpperCase() || "Unknown",
          lastName:
            profileForm.motherLastName.trim().toUpperCase() || "Unknown",
          middleName: profileForm.motherMiddleName.trim().toUpperCase() || null,
          contactNumber: profileForm.motherContactNumber.trim() || null,
        };
      } else {
        payload.motherName = null;
      }

      if (
        profileForm.fatherFirstName.trim() ||
        profileForm.fatherLastName.trim()
      ) {
        payload.fatherName = {
          firstName:
            profileForm.fatherFirstName.trim().toUpperCase() || "Unknown",
          lastName:
            profileForm.fatherLastName.trim().toUpperCase() || "Unknown",
          middleName: profileForm.fatherMiddleName.trim().toUpperCase() || null,
          contactNumber: profileForm.fatherContactNumber.trim() || null,
        };
      } else {
        payload.fatherName = null;
      }

      if (
        profileForm.guardianFirstName.trim() ||
        profileForm.guardianLastName.trim()
      ) {
        payload.guardianInfo = {
          firstName:
            profileForm.guardianFirstName.trim().toUpperCase() || "Unknown",
          lastName:
            profileForm.guardianLastName.trim().toUpperCase() || "Unknown",
          middleName:
            profileForm.guardianMiddleName.trim().toUpperCase() || null,
          contactNumber: profileForm.guardianContactNumber.trim() || null,
        };
      } else {
        payload.guardianInfo = null;
      }

      await api.put(`/students/${student.id}`, payload);

      sileo.success({
        title: "Profile Updated",
        description:
          "Learner contact and address details were saved successfully.",
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
            <SheetTitle className="text-base sm:text-lg font-extrabold  uppercase">
              <Skeleton className="h-6 w-40" />
            </SheetTitle>
            <SheetDescription
              asChild
              className="text-[11px] sm:text-base text-foreground mt-1">
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
          <SheetTitle className="text-base sm:text-lg font-extrabold  uppercase">
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

  const jhsRecord = student.historicalGrades?.find(g => g.gradeLevel === "Grade 10");
  const displaySchoolYear = isJhsCompleter && jhsRecord
    ? jhsRecord.schoolYear
    : student.schoolYear;
  const displayGraduationDate = isJhsCompleter && jhsRecord?.completedAt
    ? formatDate(jhsRecord.completedAt)
    : formatDate(student.updatedAt);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-extrabold">
        <div>
          <SheetTitle className="text-base sm:text-lg text-primary-foreground font-extrabold  uppercase flex items-center gap-2">
            {isJhsCompleter ? (
              <>
                Alumni Record Details
              </>
            ) : (
              <>
                Enrolled Learner Details
              </>
            )}
          </SheetTitle>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-extrabold">
        {/* Summary Block */}
        <div className="bg-[hsl(var(--muted))] p-3 sm:p-4 rounded-md border">
          <div className="flex flex-col items-center mb-6 pt-2">
            <UserPhoto
              photo={student.studentPhoto}
              containerClassName="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-primary border-dashed shadow-md shrink-0"
              className="w-full h-full object-cover rounded-full"
              onEnlarge={() => setIsPhotoEnlarged(true)}
              alt={student.fullName}
              fallbackIcon={
                <div className="w-full h-full rounded-full flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl bg-primary">
                  {((f, l) => `${f}${l}`)(
                    String(student.firstName || "")
                      .trim()
                      .charAt(0)
                      .toUpperCase(),
                    String(student.lastName || "")
                      .trim()
                      .charAt(0)
                      .toUpperCase(),
                  ) || "?"}
                </div>
              }
            />
            <div className="text-center mt-4">
              <h3 className="font-extrabold text-lg sm:text-xl uppercase  break-words">
                {isEditing
                  ? `${profileForm.lastName || ""}, ${profileForm.firstName || ""} ${profileForm.middleName ? profileForm.middleName[0] + "." : ""}`
                    .trim()
                    .replace(/^[,\s]+|[,\s]+$/g, "") || student.fullName
                  : student.fullName}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-1 font-extrabold">
                {isJhsCompleter ? (
                  <Badge className="bg-primary text-primary-foreground gap-1 rounded-md uppercase shadow-sm">
                    JHS Completer
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white gap-1 px-3 py-1 rounded-md uppercase  shadow-sm">
                    Officially Enrolled
                  </Badge>
                )}
                {!isJhsCompleter && student.applicantType === "LATE_ENROLLEE" && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 px-3 py-1 rounded-md uppercase  shadow-sm font-extrabold">
                    Late Enrollee
                  </Badge>
                )}
              </div>
              {!isEditing && canEditProfile && !isJhsCompleter && (
                <div className="mt-4 flex justify-center w-full px-2">
                  <Button
                    variant="default"
                    className="font-extrabold text-sm h-10 uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-md w-full max-w-sm rounded-md transition-all active:scale-[0.98]"
                    onClick={handleEditClick}>
                    <UserRoundPen className="mr-2 h-5 w-5 shrink-0" />
                    Edit Learner Data
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 border-t pt-4">
            {!isJhsCompleter ? (
              <div>
                <p className="text-base uppercase text-foreground mb-1">
                  Grade Level & Section
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base font-extrabold text-foreground">
                    {student.gradeLevel}
                    {student.enrollment?.section && ` - ${student.enrollment.section}`}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="font-extrabold px-2 py-0 rounded-md cursor-help"
                        >
                          {getProgramBadge(student.applicantType).short}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getProgramBadge(student.applicantType).full}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ) : (
              <div></div>
            )}
            <div className="text-left sm:text-right">
              <p className="uppercase text-foreground">
                Learner Reference Number
              </p>
              <p className="leading-tight tabular-nums">
                {student.lrn || "N/A"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 border-t pt-4 mt-4">
            <div>
              <p className="text-base uppercase text-foreground">Address</p>
              <p className="text-base leading-tight pr-2">
                {isEditing
                  ? [
                    profileForm.houseNoStreet,
                    profileForm.sitioPurok,
                    profileForm.barangay,
                    profileForm.cityMunicipality,
                    profileForm.province,
                  ]
                    .filter(Boolean)
                    .join(", ")
                    .toUpperCase() || "N/A"
                  : student.address || "N/A"}
              </p>
            </div>
            <div className="text-left sm:text-right mt-2 sm:mt-0">
              <p className="text-base uppercase text-foreground">
                Primary Contact
              </p>
              <p className="text-base leading-tight">
                {isEditing
                  ? (profileForm.primaryContact === "MOTHER"
                    ? profileForm.motherContactNumber
                    : profileForm.primaryContact === "FATHER"
                      ? profileForm.fatherContactNumber
                      : profileForm.guardianContactNumber) || "N/A"
                  : student.contactNumber ||
                  student.parentGuardianContact ||
                  "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Enrollment Information Section */}
        {isJhsCompleter ? (
          <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden border-amber-200">
            <div className="p-3 font-extrabold text-base leading-tight bg-amber-50 text-amber-700 border-b border-amber-200 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-amber-700" />
              Completion Record
            </div>
            <div className="text-base leading-tight font-extrabold divide-y divide-amber-200">
              <div className="grid grid-cols-[180px_1fr] divide-x divide-amber-200">
                <div className="p-3 text-foreground bg-amber-50/50">School Year:</div>
                <div className="p-3 bg-amber-50/50">{displaySchoolYear}</div>
              </div>
              <div className="grid grid-cols-[180px_1fr] divide-x divide-amber-200">
                <div className="p-3 text-foreground bg-amber-50/50">Date of Graduation:</div>
                <div className="p-3 bg-amber-50/50">
                  {displayGraduationDate}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden">
            <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              Enrollment Information
            </div>
            <div className="p-4 text-base leading-tight grid grid-cols-[140px_1fr] gap-x-2 gap-y-1.5 font-extrabold">
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
        )}

        {/* Lifecycle Outcome (if any) */}
        {student.enrollment?.eosyStatus && (
          <div className="border rounded-md mb-4 border-dashed bg-muted/30 overflow-hidden">
            <div className="p-3 font-extrabold text-base leading-tight bg-muted/50 border-b flex items-center gap-2 text-primary">
              <BadgeAlert className="h-4 w-4" />
              Lifecycle Outcome
            </div>
            <div className="p-4 text-base leading-tight space-y-2">
              <p className="font-extrabold text-primary uppercase">
                {formatEosyStatus(student.enrollment.eosyStatus)}
              </p>
              {student.enrollment.transferOutDate && (
                <p className="text-base">
                  <span className="text-foreground mr-2 font-extrabold uppercase">
                    Date:
                  </span>
                  {formatDate(student.enrollment.transferOutDate)}
                </p>
              )}
              {student.enrollment.transferOutSchoolName && (
                <p className="text-base">
                  <span className="text-foreground mr-2 font-extrabold uppercase">
                    To:
                  </span>
                  {student.enrollment.transferOutSchoolName}
                </p>
              )}
              {student.enrollment.transferOutReason && (
                <p className="text-base">
                  <span className="text-foreground mr-2 font-extrabold uppercase">
                    Reason:
                  </span>
                  {student.enrollment.transferOutReason}
                </p>
              )}
              {student.enrollment.dropOutDate && (
                <p className="text-base">
                  <span className="text-foreground mr-2 font-extrabold uppercase">
                    Date:
                  </span>
                  {formatDate(student.enrollment.dropOutDate)}
                </p>
              )}
              {student.enrollment.dropOutReason && (
                <p className="text-base">
                  <span className="text-foreground mr-2 font-extrabold uppercase">
                    Reason:
                  </span>
                  {student.enrollment.dropOutReason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Historical Final Averages */}
        {student.historicalGrades && (
          <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden">
            <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
              <FileBadge2 className="h-4 w-4 text-primary" />
              Historical Final Averages
            </div>
            <div className="text-base leading-tight">
              {student.historicalGrades.length > 0 ? (
                <table className="w-full text-center border-collapse border border-border">
                  <thead>
                    <tr className="font-extrabold border-b border-border bg-muted/30">
                      <th className="text-foreground p-3 border-r border-border font-extrabold text-center">Grade Level</th>
                      <th className="text-foreground p-3 border-r border-border font-extrabold text-center">Final Gen Ave</th>
                      <th className="text-foreground p-3 font-extrabold text-center">School Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.historicalGrades.map((hg, idx) => (
                      <tr key={idx} className="font-extrabold border-b border-border last:border-b-0">
                        <td className="p-3 border-r border-border">{hg.gradeLevel}</td>
                        <td className="p-3 border-r border-border">
                          {hg.genAve != null ? hg.genAve.toFixed(2) : "N/A"}
                        </td>
                        <td className="p-3">{hg.schoolYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground text-center font-extrabold py-2">
                  No historical grades available.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main Body content: Either Edit Form or Read-only BeefSections */}
        {isEditing ? (
          <form
            id="learner-edit-form"
            onSubmit={submitProfileUpdate}
            className="space-y-6 bg-card border rounded-lg p-5 mt-4 shadow-sm">
            <h3 className="font-extrabold text-lg text-primary flex items-center gap-2 mb-2">
              <UserRoundPen className="h-5 w-5" />
              Update Learner Profile
            </h3>

            {/* Step I: Personal Information */}
            <div className="space-y-8">
              <div className="flex items-center gap-2 border-b pb-2">
                <h3 className="text-lg font-extrabold uppercase text-primary">
                  I. Personal Information
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="firstName"
                    className="font-extrabold text-base uppercase flex gap-1">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={profileForm.firstName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                    className={`font-extrabold text-base leading-tight bg-background uppercase ${errors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.firstName && (
                    <p className="text-base text-destructive font-extrabold">
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="lastName"
                    className="font-extrabold text-base uppercase flex gap-1">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={profileForm.lastName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        lastName: e.target.value,
                      }))
                    }
                    className={`font-extrabold text-base leading-tight bg-background uppercase ${errors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.lastName && (
                    <p className="text-base text-destructive font-extrabold">
                      {errors.lastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="middleName"
                    className="font-extrabold text-base uppercase">
                    Middle Name
                  </Label>
                  <Input
                    id="middleName"
                    value={profileForm.middleName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        middleName: e.target.value,
                      }))
                    }
                    className="font-extrabold text-base leading-tight bg-background uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="suffix"
                    className="font-extrabold text-base uppercase">
                    Extension Name
                  </Label>
                  <Select
                    value={profileForm.suffix || "NONE"}
                    onValueChange={(val) =>
                      setProfileForm((p) => ({
                        ...p,
                        suffix: val === "NONE" ? "" : val,
                      }))
                    }>
                    <SelectTrigger className="bg-background font-extrabold text-base leading-tight">
                      <SelectValue placeholder="Select Extension" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">NONE</SelectItem>
                      <SelectItem value="JR.">JR.</SelectItem>
                      <SelectItem value="SR.">SR.</SelectItem>
                      <SelectItem value="II">II</SelectItem>
                      <SelectItem value="III">III</SelectItem>
                      <SelectItem value="IV">IV</SelectItem>
                      <SelectItem value="V">V</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="birthDate"
                    className="font-extrabold text-base uppercase flex gap-1">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <HybridDatePicker
                    value={profileForm.birthDate}
                    onChange={(val) =>
                      setProfileForm((p) => ({ ...p, birthDate: val }))
                    }
                    className={`font-extrabold text-base leading-tight bg-background ${errors.birthDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.birthDate && (
                    <p className="text-base text-destructive font-extrabold">
                      {errors.birthDate}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="sex"
                    className="font-extrabold text-base uppercase flex gap-1">
                    Sex <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={profileForm.sex}
                    onValueChange={(val) =>
                      setProfileForm((p) => ({ ...p, sex: val }))
                    }>
                    <SelectTrigger
                      className={`bg-background font-extrabold text-base leading-tight ${errors.sex ? "border-destructive focus-visible:ring-destructive" : ""}`}>
                      <SelectValue placeholder="Select Sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">MALE</SelectItem>
                      <SelectItem value="FEMALE">FEMALE</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.sex && (
                    <p className="text-base text-destructive font-extrabold">
                      {errors.sex}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border/40">
                <h4 className="text-base font-extrabold uppercase text-foreground mb-4">
                  Address
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="houseNoStreet"
                      className="font-extrabold text-base uppercase">
                      House No. / Street
                    </Label>
                    <Input
                      id="houseNoStreet"
                      value={profileForm.houseNoStreet}
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          houseNoStreet: e.target.value,
                        }))
                      }
                      placeholder="e.g. 123 OR RIZAL STREET"
                      className="font-extrabold text-base leading-tight bg-background uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="sitioPurok"
                      className="font-extrabold text-base uppercase">
                      Sitio / Purok
                    </Label>
                    <Input
                      id="sitioPurok"
                      value={profileForm.sitioPurok}
                      onInput={(e) => {
                        (e.target as HTMLInputElement).value = (
                          e.target as HTMLInputElement
                        ).value.toUpperCase();
                      }}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          sitioPurok: e.target.value,
                        }))
                      }
                      placeholder="e.g. PUROK 1"
                      className="font-extrabold text-base leading-tight bg-background uppercase"
                    />
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
                      ...(field === "region"
                        ? { province: "", cityMunicipality: "", barangay: "" }
                        : {}),
                      ...(field === "province"
                        ? { cityMunicipality: "", barangay: "" }
                        : {}),
                      ...(field === "cityMunicipality" ? { barangay: "" } : {}),
                    }));
                    setErrors((prev) => ({ ...prev, [field]: "" }));
                  }}
                />
              </div>
            </div>

            {/* Step II: Family Information */}
            <div className="space-y-8">
              <div className="flex items-center gap-2 border-b pb-2">
                <h3 className="text-lg font-extrabold uppercase text-primary">
                  II. Family Information
                </h3>
              </div>

              <div className="space-y-3 pt-3 border-t border-border/40">
                <Label className="font-extrabold text-base uppercase text-primary flex gap-1">
                  Primary Emergency Contact{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      {
                        value: "MOTHER",
                        label: "Mother",
                        icon: Venus,
                        firstName: profileForm.motherFirstName,
                      },
                      {
                        value: "FATHER",
                        label: "Father",
                        icon: Mars,
                        firstName: profileForm.fatherFirstName,
                      },
                      {
                        value: "GUARDIAN",
                        label: "Guardian",
                        icon: User,
                        firstName: profileForm.guardianFirstName,
                      },
                    ] as const
                  ).map((option) => {
                    const displayLabel =
                      option.firstName &&
                        option.firstName.trim() !== "" &&
                        option.firstName.trim() !== "N/A"
                        ? `${option.label} (${option.firstName})`
                        : option.label;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setProfileForm((p) => ({
                            ...p,
                            primaryContact: option.value,
                          }))
                        }
                        className={cn(
                          "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                          profileForm.primaryContact === option.value
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border bg-card hover:bg-muted/50",
                        )}>
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                            profileForm.primaryContact === option.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}>
                          <option.icon className="w-6 h-6" />
                        </div>
                        <span
                          className={cn(
                            "font-extrabold text-base leading-tight uppercase text-center",
                            profileForm.primaryContact === option.value
                              ? "text-primary"
                              : "text-foreground",
                          )}>
                          {displayLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.contactNumber && (
                  <p className="text-base text-destructive font-extrabold">
                    {errors.contactNumber}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-border/40">
                <Label className="font-extrabold text-base uppercase text-primary">
                  Mother's Maiden Name
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    value={profileForm.motherFirstName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        motherFirstName: e.target.value,
                      }))
                    }
                    placeholder="FIRST NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    value={profileForm.motherMiddleName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        motherMiddleName: e.target.value,
                      }))
                    }
                    placeholder="MIDDLE NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    value={profileForm.motherLastName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        motherLastName: e.target.value,
                      }))
                    }
                    placeholder="LAST NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    maxLength={11}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(
                        /[^0-9]/g,
                        "",
                      );
                    }}
                    value={profileForm.motherContactNumber}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        motherContactNumber: e.target.value,
                      }))
                    }
                    placeholder="CONTACT NO. (09XXXXXXXXX)"
                    className="font-extrabold text-base leading-tight bg-background h-11"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border/40">
                <Label className="font-extrabold text-base uppercase text-primary">
                  Father's Name
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    value={profileForm.fatherFirstName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        fatherFirstName: e.target.value,
                      }))
                    }
                    placeholder="FIRST NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    value={profileForm.fatherMiddleName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        fatherMiddleName: e.target.value,
                      }))
                    }
                    placeholder="MIDDLE NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    value={profileForm.fatherLastName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        fatherLastName: e.target.value,
                      }))
                    }
                    placeholder="LAST NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    maxLength={11}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(
                        /[^0-9]/g,
                        "",
                      );
                    }}
                    value={profileForm.fatherContactNumber}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        fatherContactNumber: e.target.value,
                      }))
                    }
                    placeholder="CONTACT NO. (09XXXXXXXXX)"
                    className="font-extrabold text-base leading-tight bg-background h-11"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border/40">
                <Label className="font-extrabold text-base uppercase text-primary">
                  Guardian's Name
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    value={profileForm.guardianFirstName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        guardianFirstName: e.target.value,
                      }))
                    }
                    placeholder="FIRST NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    value={profileForm.guardianMiddleName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        guardianMiddleName: e.target.value,
                      }))
                    }
                    placeholder="MIDDLE NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    value={profileForm.guardianLastName}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        guardianLastName: e.target.value,
                      }))
                    }
                    placeholder="LAST NAME"
                    className="font-extrabold text-base leading-tight bg-background uppercase h-11"
                  />
                  <Input
                    maxLength={11}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(
                        /[^0-9]/g,
                        "",
                      );
                    }}
                    value={profileForm.guardianContactNumber}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        guardianContactNumber: e.target.value,
                      }))
                    }
                    placeholder="CONTACT NO. (09XXXXXXXXX)"
                    className="font-extrabold text-base leading-tight bg-background h-11"
                  />
                </div>
              </div>
            </div>

            {/* Step III: Background & Special Categories */}
            <div className="space-y-8">
              <div className="flex items-center gap-2 border-b pb-2">
                <h3 className="text-lg font-extrabold uppercase text-primary">
                  III. Background & Special Categories
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-extrabold text-base uppercase">
                    IP Community
                  </Label>
                  <Select
                    value={profileForm.isIpCommunity}
                    onValueChange={(val) =>
                      setProfileForm((p) => ({ ...p, isIpCommunity: val }))
                    }>
                    <SelectTrigger className="bg-background font-extrabold text-base leading-tight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES</SelectItem>
                      <SelectItem value="NO">NO</SelectItem>
                    </SelectContent>
                  </Select>
                  {profileForm.isIpCommunity === "YES" && (
                    <div className="mt-2">
                      <Input
                        value={profileForm.ipGroupName}
                        onInput={(e) => {
                          (e.target as HTMLInputElement).value = (
                            e.target as HTMLInputElement
                          ).value.toUpperCase();
                        }}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            ipGroupName: e.target.value,
                          }))
                        }
                        placeholder="SPECIFY IP GROUP"
                        className="font-extrabold text-base leading-tight bg-background uppercase"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="font-extrabold text-base uppercase">
                    4Ps Beneficiary
                  </Label>
                  <Select
                    value={profileForm.is4PsBeneficiary}
                    onValueChange={(val) =>
                      setProfileForm((p) => ({ ...p, is4PsBeneficiary: val }))
                    }>
                    <SelectTrigger className="bg-background font-extrabold text-base leading-tight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES</SelectItem>
                      <SelectItem value="NO">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-extrabold text-base uppercase">
                    Balik-Aral
                  </Label>
                  <Select
                    value={profileForm.isBalikAral}
                    onValueChange={(val) =>
                      setProfileForm((p) => ({ ...p, isBalikAral: val }))
                    }>
                    <SelectTrigger className="bg-background font-extrabold text-base leading-tight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES</SelectItem>
                      <SelectItem value="NO">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-extrabold text-base uppercase">
                    Disability Type
                  </Label>
                  <Select
                    value={profileForm.disabilityType}
                    onValueChange={(val) =>
                      setProfileForm((p) => ({ ...p, disabilityType: val }))
                    }>
                    <SelectTrigger className="bg-background font-extrabold text-base leading-tight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="Visual Impairment">
                        Visual Impairment
                      </SelectItem>
                      <SelectItem value="Hearing Impairment">
                        Hearing Impairment
                      </SelectItem>
                      <SelectItem value="Intellectual Disability">
                        Intellectual Disability
                      </SelectItem>
                      <SelectItem value="Learning Disability">
                        Learning Disability
                      </SelectItem>
                      <SelectItem value="Autism Spectrum Disorder">
                        Autism Spectrum Disorder
                      </SelectItem>
                      <SelectItem value="Emotional-Behavioral Disorder">
                        Emotional-Behavioral Disorder
                      </SelectItem>
                      <SelectItem value="Orthopedic/Physical Handicap">
                        Orthopedic/Physical Handicap
                      </SelectItem>
                      <SelectItem value="Speech/Language Disorder">
                        Speech/Language Disorder
                      </SelectItem>
                      <SelectItem value="Cerebral Palsy">
                        Cerebral Palsy
                      </SelectItem>
                      <SelectItem value="Special Health Problem">
                        Special Health Problem
                      </SelectItem>
                      <SelectItem value="Multiple Disabilities">
                        Multiple Disabilities
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-extrabold text-base uppercase">
                    Mother Tongue
                  </Label>
                  <Input
                    value={profileForm.motherTongue}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        motherTongue: e.target.value,
                      }))
                    }
                    placeholder="e.g. HILIGAYNON"
                    className="font-extrabold text-base leading-tight bg-background uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-extrabold text-base uppercase">
                    Religion
                  </Label>
                  <Input
                    value={profileForm.religion}
                    onInput={(e) => {
                      (e.target as HTMLInputElement).value = (
                        e.target as HTMLInputElement
                      ).value.toUpperCase();
                    }}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        religion: e.target.value,
                      }))
                    }
                    placeholder="e.g. ROMAN CATHOLIC"
                    className="font-extrabold text-base leading-tight bg-background uppercase"
                  />
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

            {!isJhsCompleter && (
              <div className="bg-muted border border-slate-200/80 rounded-md overflow-hidden shadow-sm p-5 space-y-4">
                <div className="font-extrabold uppercase text-base leading-tight tracking-wide text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
                  <FileBadge2 className="h-4 w-4 text-primary" />
                  PORTAL ACCESS & SECURITY
                </div>

                <div className="space-y-2 ">
                  <Label className="text-base font-extrabold uppercase text-foreground">
                    Student Portal Access
                  </Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      disabled={isPortalActionSubmitting}
                      onClick={() => handleTogglePortalAccess(true)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-extrabold uppercase cursor-pointer",
                        portalActive
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-border hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", portalActive ? "bg-emerald-500" : "bg-muted-foreground")} />
                      Allow Login (Active)
                    </button>
                    <button
                      type="button"
                      disabled={isPortalActionSubmitting}
                      onClick={() => handleTogglePortalAccess(false)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-extrabold uppercase cursor-pointer",
                        !portalActive
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-border hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", !portalActive ? "bg-amber-500" : "bg-muted-foreground")} />
                      Block Login (Disabled)
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-base font-extrabold uppercase text-foreground">
                    Password Control
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={defaultPasswordInput}
                      onChange={(e) => setDefaultPasswordInput(e.target.value)}
                      placeholder="Enter default password"
                      className="h-11 font-extrabold text-base bg-background"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPortalActionSubmitting || !defaultPasswordInput.trim()}
                      onClick={handleResetPassword}
                      className="w-full h-11 font-extrabold text-base uppercase border border-border hover:bg-muted/30 shrink-0 cursor-pointer"
                    >
                      Reset to Default Password
                    </Button>
                  </div>
                  <p className="text-xs font-extrabold leading-tight text-foreground/60">
                    This will reset the learner's portal password to the value above and force a password change on next login.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t text-base uppercase text-foreground flex flex-col gap-1">
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
      {isJhsCompleter ? (
        <div className="p-2 border-t bg-[hsl(var(--muted)/30)]">
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1 font-extrabold text-base sm:text-base h-9 uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              onClick={() => sileo.success({ title: "Form Generated", description: "Form 137 SF10 generation is coming soon." })}>
              <FileBadge2 className="h-4 w-4 mr-2" />
              Generate Form 137 SF10
            </Button>
          </div>
        </div>
      ) : isEditing ? (
        <div className="p-4 bg-muted/10 border-t border-border flex gap-3 shrink-0 justify-end sm:flex-row">
          <Button
            variant="outline"
            type="button"
            onClick={resetProfileEdits}
            disabled={isSubmitting}
            className="font-extrabold uppercase text-base border-border px-6 cursor-pointer bg-background text-foreground hover:bg-muted">
            Cancel
          </Button>
          <Button
            type="submit"
            form="learner-edit-form"
            disabled={isSubmitting || !isProfileFormDirty}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold uppercase text-base px-6 cursor-pointer">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4  mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      ) : canEditProfile ? (
        <div className="p-2 border-t bg-[hsl(var(--muted)/30)]">
          <div className="flex gap-2">
            <Dialog
              open={showTransferOutDialog}
              onOpenChange={setShowTransferOutDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 font-extrabold text-base sm:text-base h-9 uppercase bg-orange-50 text-orange-700 hover:text-orange-800 hover:bg-orange-100 border-orange-200 shadow-sm">
                  <FileBadge2 className="h-4 w-4 mr-2" />
                  Transferred Out
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="w-full max-w-3xl p-0 overflow-hidden">
                <div className="p-6 pb-2">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-extrabold text-foreground">
                      Transfer Learner Record
                    </DialogTitle>
                  </DialogHeader>
                </div>
                <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md mx-6 mb-6">
                  This will permanently remove the learner from the active
                  homeroom masterlist.
                </div>
                <div className="space-y-4 px-6 pb-0">
                  <div className="space-y-2">
                    <Label>
                      Destination School{" "}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      className="focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:outline-none !outline-none placeholder:text-muted-foreground"
                      placeholder="e.g., Bacolod City National High School"
                      value={transferOutSchoolName}
                      onChange={(e) => setTransferOutSchoolName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Official Date of Transfer{" "}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <HybridDatePicker
                      className="focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:outline-none !outline-none"
                      value={transferOutDate}
                      onChange={setTransferOutDate}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason for Transfer (Optional)</Label>
                    <Input
                      className="focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:outline-none !outline-none placeholder:text-muted-foreground"
                      placeholder="Optional reason"
                      value={transferOutReason}
                      onChange={(e) => setTransferOutReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 w-full mt-auto">
                  <Button
                    className="bg-muted text-gray-700"
                    variant="outline"
                    onClick={() => setShowTransferOutDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    className="!bg-amber-600 hover:!bg-amber-700 !text-white font-extrabold px-5 py-2 shadow-sm border-none"
                    onClick={handleTransferOutSubmit}
                    disabled={!transferOutSchoolName || !transferOutDate}>
                    Confirm Transfer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={showDropoutDialog}
              onOpenChange={setShowDropoutDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 font-extrabold text-base sm:text-base h-9 uppercase bg-red-50 text-red-700 hover:text-red-800 hover:bg-red-100 border-red-200 shadow-sm">
                  <BadgeAlert className="h-4 w-4 mr-2" />
                  Dropped Out
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="w-full max-w-3xl p-0 overflow-hidden">
                <div className="p-6 pb-2">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-extrabold text-red-700">
                      Process Learner Drop Out
                    </DialogTitle>
                  </DialogHeader>
                </div>
                <div className="text-sm text-red-700 bg-red-50 p-3 border border-red-200 rounded-md mx-6 mb-6">
                  Warning: Dropping out a learner requires recorded intervention
                  history. This action will finalize their status for the
                  current School Year.
                </div>
                <div className="space-y-4 px-6 pb-0">
                  <div className="space-y-2">
                    <Label>
                      Date of Last Attendance{" "}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <HybridDatePicker
                      className="focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:outline-none !outline-none"
                      value={dropoutDate}
                      onChange={setDropoutDate}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Official Reason{" "}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Select
                      value={dropoutReasonCode}
                      onValueChange={setDropoutReasonCode}>
                      <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:outline-none !outline-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FINANCIAL_MATTERS">
                          Financial
                        </SelectItem>
                        <SelectItem value="ILLNESS">Illness</SelectItem>
                        <SelectItem value="FAMILY_MATTERS">
                          Family Matters
                        </SelectItem>
                        <SelectItem value="CHILD_LABOR">Child Labor</SelectItem>
                        <SelectItem value="RELOCATION">Relocation</SelectItem>
                        <SelectItem value="LACK_OF_INTEREST">
                          Lack of Interest
                        </SelectItem>
                        <SelectItem value="OTHERS">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Intervention Notes (Optional)</Label>
                    <Textarea
                      className="focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:outline-none !outline-none placeholder:text-muted-foreground"
                      placeholder="Brief details on home visitations/counseling done"
                      value={dropoutInterventionNotes}
                      onChange={(e) =>
                        setDropoutInterventionNotes(e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 w-full mt-auto">
                  <Button
                    className="bg-muted text-gray-700"
                    variant="outline"
                    onClick={() => setShowDropoutDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    className="!bg-red-600 hover:!bg-red-700 !text-white font-extrabold px-5 py-2 shadow-sm border-none"
                    onClick={handleDropoutSubmit}
                    disabled={!dropoutDate || !dropoutReasonCode}>
                    Finalize Drop Out
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      ) : null}

      {student.studentPhoto && (
        <ImageEnlarger
          src={getImageUrl(student.studentPhoto) || ""}
          isOpen={isPhotoEnlarged}
          onClose={() => setIsPhotoEnlarged(false)}
          alt={`${student.lastName} profile photo`}
        />
      )}

      <ConfirmationModal
        open={showResetPasswordConfirm}
        onOpenChange={setShowResetPasswordConfirm}
        title="Confirm Password Reset"
        description="Are you sure you want to reset this password?"
        confirmText="Reset Password"
        cancelText="Cancel"
        onConfirm={handleResetPasswordConfirm}
        variant="danger"
      />
    </div>
  );
}
