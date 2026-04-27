import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Eye,
  FileText,
  FileCheck2,
  UserRoundPen,
  Fingerprint,
  ArrowRightLeft,
  FileBadge2,
  BadgeAlert,
  CheckCircle2,
  Clock,
  User,
  GraduationCap,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import { getImageUrl } from "@/shared/lib/utils";
import {
  PersonalInfo,
  AddressInfo,
  GuardianContact,
  PreviousSchool,
  Classifications,
} from "@/features/enrollment/components/BeefSections";

interface Address {
  houseNo?: string;
  street?: string;
  sitio?: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  zipCode?: string;
  type?: string;
}

interface FamilyMember {
  firstName: string;
  lastName: string;
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
  trackingNumber: string;
  status: string;
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
    eosyStatus?: "TRANSFERRED_OUT" | "DROPPED_OUT" | null;
    dropOutReason?: string | null;
    dropOutDate?: string | null;
    transferOutDate?: string | null;
    transferOutSchoolName?: string | null;
    transferOutReason?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  studentPhoto?: string | null;
}

interface Props {
  id: number;
  onClose: () => void;
  onOpenProfilePage: (id: number) => void;
  onOpenPermanentRecord: (id: number) => void;
  onOpenGoodMoral: (id: number) => void;
  onQuickEdit: (student: StudentDetail) => void;
  onAssignLrn: (student: StudentDetail) => void;
  onShift: (student: StudentDetail) => void;
  onTransferOut: (student: StudentDetail) => void;
  onDropout: (student: StudentDetail) => void;
}

export function StudentDetailPanel({
  id,
  onClose,
  onOpenProfilePage,
  onOpenPermanentRecord,
  onOpenGoodMoral,
  onQuickEdit,
  onAssignLrn,
  onShift,
  onTransferOut,
  onDropout,
}: Props) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);

  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    const fetchStudent = async () => {
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
        toastApiError(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      void fetchStudent();
    }
  }, [id]);

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
              className="text-[11px] sm:text-xs text-muted-foreground mt-1">
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
  const studentShim = student
    ? {
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
      }
    : null;

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
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider shadow-sm">
                  <CheckCircle2 className="h-3 w-3" />
                  Officially Enrolled
                </Badge>
                {student.applicantType === "LATE_ENROLLEE" && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 gap-1 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider shadow-sm font-black">
                    Late Enrolled
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 border-t pt-4">
            <div>
              <p className="text-[10px] sm:text-[0.625rem] uppercase tracking-widest text-muted-foreground">
                Grade Level & Section
              </p>
              <p className="text-xs sm:text-sm">
                {student.gradeLevel}
                {student.enrollment?.section &&
                  ` • ${student.enrollment.section}`}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] sm:text-[0.625rem] uppercase tracking-widest text-muted-foreground">
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
            <span className="text-muted-foreground">School Year:</span>
            <span>{student.schoolYear}</span>
            <span className="text-muted-foreground">Enrolled At:</span>
            <span>
              {student.enrollment?.enrolledAt
                ? formatDate(student.enrollment.enrolledAt)
                : "N/A"}
            </span>
            <span className="text-muted-foreground">Enrolled By:</span>
            <span className="uppercase">
              {student.enrollment?.enrolledBy || "N/A"}
            </span>
            {student.enrollment?.advisingTeacher && (
              <>
                <span className="text-muted-foreground">Advising Teacher:</span>
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
                {student.enrollment.eosyStatus.replace("_", " ")}
              </p>
              {student.enrollment.transferOutDate && (
                <p className="text-xs">
                  <span className="text-muted-foreground mr-2 font-bold uppercase">
                    Date:
                  </span>
                  {formatDate(student.enrollment.transferOutDate)}
                </p>
              )}
              {student.enrollment.transferOutSchoolName && (
                <p className="text-xs">
                  <span className="text-muted-foreground mr-2 font-bold uppercase">
                    To:
                  </span>
                  {student.enrollment.transferOutSchoolName}
                </p>
              )}
              {student.enrollment.transferOutReason && (
                <p className="text-xs">
                  <span className="text-muted-foreground mr-2 font-bold uppercase">
                    Reason:
                  </span>
                  {student.enrollment.transferOutReason}
                </p>
              )}
              {student.enrollment.dropOutDate && (
                <p className="text-xs">
                  <span className="text-muted-foreground mr-2 font-bold uppercase">
                    Date:
                  </span>
                  {formatDate(student.enrollment.dropOutDate)}
                </p>
              )}
              {student.enrollment.dropOutReason && (
                <p className="text-xs">
                  <span className="text-muted-foreground mr-2 font-bold uppercase">
                    Reason:
                  </span>
                  {student.enrollment.dropOutReason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Beef Sections - Reusing shared components */}
        <div className="space-y-2">
          <PersonalInfo applicant={typedStudentShim} />
          <AddressInfo applicant={typedStudentShim} />
          <GuardianContact applicant={typedStudentShim} />
          <PreviousSchool applicant={typedStudentShim} />
          <Classifications applicant={typedStudentShim} />
        </div>

        {/* Quick Metadata */}
        <div className="pt-4 border-t text-[10px] uppercase tracking-widest text-muted-foreground flex flex-col gap-1">
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

      {/* Action Footer */}
      <div className="p-3 sm:p-4 border-t bg-[hsl(var(--muted)/30)] grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="font-bold text-xs h-9 uppercase tracking-widest border shadow-sm"
          onClick={() => onOpenProfilePage(student.id)}>
          <Eye className="mr-2 h-4 w-4" />
          Full Profile
        </Button>
        <Button
          variant="secondary"
          className="font-bold text-xs h-9 uppercase tracking-widest border shadow-sm"
          onClick={() => onOpenPermanentRecord(student.id)}>
          <FileText className="mr-2 h-4 w-4" />
          Permanent Record
        </Button>
        <Button
          variant="secondary"
          className="font-bold text-xs h-9 uppercase tracking-widest border shadow-sm"
          onClick={() => onOpenGoodMoral(student.id)}>
          <FileCheck2 className="mr-2 h-4 w-4" />
          Good Moral
        </Button>
        <Button
          variant="secondary"
          className="font-bold text-xs h-9 uppercase tracking-widest border shadow-sm"
          onClick={() => onQuickEdit(student)}>
          <UserRoundPen className="mr-2 h-4 w-4" />
          Quick Edit
        </Button>
        <Button
          variant="secondary"
          className="font-bold text-xs h-9 uppercase tracking-widest border shadow-sm"
          onClick={() => onAssignLrn(student)}>
          <Fingerprint className="mr-2 h-4 w-4" />
          Assign LRN
        </Button>
        <Button
          variant="secondary"
          className="font-bold text-xs h-9 uppercase tracking-widest border shadow-sm"
          onClick={() => onShift(student)}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Shift
        </Button>
        <Button
          variant="outline"
          className="font-bold text-xs h-9 uppercase tracking-widest text-amber-700 hover:text-amber-700 hover:bg-amber-50 border-amber-200 shadow-sm"
          onClick={() => onTransferOut(student)}>
          <FileBadge2 className="mr-2 h-4 w-4" />
          Transfer
        </Button>
        <Button
          variant="outline"
          className="font-bold text-xs h-9 uppercase tracking-widest text-rose-700 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shadow-sm"
          onClick={() => onDropout(student)}>
          <BadgeAlert className="mr-2 h-4 w-4" />
          Dropout
        </Button>
      </div>

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
