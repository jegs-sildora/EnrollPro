import { AnimatedError } from "@/shared/components/AnimatedError";
import { memo, useCallback, useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/shared/lib/zodResolver";
import {
  Briefcase,
  GraduationCap,
  RefreshCw,
  User as UserIcon,
  UserRoundPen,
  Smartphone,
  Mars,
  Venus,
  ShieldAlert,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Textarea } from "@/shared/ui/textarea";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import { SearchableCombobox } from "@/shared/ui/searchable-combobox";
import { UserPhoto } from "@/shared/components/UserPhoto";
import {
  cn,
} from "@/shared/lib/utils";
import type {
  Teacher,
  TeacherFundingSource,
  TeacherNatureOfAppointment,
  TeacherScheduleDay,
  TeacherSchedulePeriod,
} from "../types";
import { formatAdvisorySectionSummary, formatTeacherName, toSentenceCase } from "../utils";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import {
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  TEACHER_FUNDING_SOURCE_OPTIONS,
  TEACHER_NATURE_OF_APPOINTMENT_OPTIONS,
  TEACHER_SCHEDULE_DAY_OPTIONS,
  getDesignationPool,
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS,
  DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS,
  TEACHER_UNDERGRADUATE_DEGREE_OPTIONS,
  TEACHER_POSTGRADUATE_DEGREE_OPTIONS,
  TEACHER_JHS_SPECIALIZATION_OPTIONS,
  TEACHER_JHS_MINOR_SPECIALIZATION_OPTIONS,
  IP_COMMUNITY_OPTIONS,
  IP_COMMUNITY_VALUES,
} from "@enrollpro/shared";
import {
  useUnsavedChanges,
  useUnsavedChangesPrompt,
} from "@/shared/hooks/useUnsavedChanges";

interface TeacherDetailPanelProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSuccess?: () => void;
}

interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface TeacherScheduleResponse {
  periods: TeacherSchedulePeriod[];
  totalWeeklyMinutes: number;
}

interface SchedulePeriodDraft {
  localId: string;
  id?: number;
  dayOfWeek: TeacherScheduleDay;
  startTime: string;
  endTime: string;
  subjectLabel: string;
  sectionLabel: string;
}

const formSchema = z
  .object({
    firstName: z.string().min(1, "Enter the first name."),
    lastName: z.string().min(1, "Enter the last name."),
    middleName: z.string().optional().nullable(),
    suffix: z.string().optional().nullable(),
    sex: z.enum(["MALE", "FEMALE"], { message: "Select the sex." }),
    birthdate: z.string().min(1, "Select the date of birth.").nullable(),

    personnelType: z.enum(["TEACHING", "NON_TEACHING"]).nullable(),
    employeeId: z
      .string()
      .trim()
      .regex(/^\d{7}$/, "Enter the 7-digit DepEd Employee ID.")
      .nullable(),
    plantillaPosition: z.string().min(1, "Select the DepEd position (plantilla)."),
    department: z.string().optional().nullable(),
    functionalAssignment: z.string().optional().nullable(),
    specialization: z.string().optional().nullable(),
    undergraduateDegree: z.string().optional().nullable(),
    postgraduateDegree: z.string().optional().nullable(),
    majorSpecialization: z.string().optional().nullable(),
    minorSpecialization: z.string().optional().nullable(),
    indigenousCommunity: z.enum(IP_COMMUNITY_VALUES).optional().nullable().default("NOT APPLICABLE"),
    natureOfAppointment: z.enum([
      "REGULAR_PERMANENT",
      "PROVISIONAL",
      "SUBSTITUTE",
      "CONTRACTUAL",
      "VOLUNTEER",
      "LOCAL_SCHOOL_BOARD",
      "OTHER",
    ]).optional().nullable(),
    fundingSource: z.enum([
      "NATIONAL",
      "SPECIAL_EDUCATION_FUND",
      "LOCAL_SCHOOL_BOARD",
      "PTA",
      "NGO",
      "OTHER",
    ]).optional().nullable(),
    roles: z.array(z.string()),

    contactNumber: z
      .string()
      .trim()
      .regex(/^09\d{2}-\d{3}-\d{4}$/, "Enter an 11-digit mobile number in the format 09XX-XXX-XXXX."),

    serviceStatus: z
      .enum([
        "ACTIVE",
        "ON_LEAVE",
        "TRANSFERRED",
        "RETIRED_RESIGNED",
        "DROPPED_FROM_ROLLS",
      ])
      .optional(),
    serviceEffectiveDate: z.string().optional().nullable(),
    serviceRemarks: z.string().optional().nullable(),
    portalActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {    const isMRF = data.roles.includes("MRF");
    const isTeacherRole = data.roles.includes("TEACHER") || data.roles.includes("CLASS_ADVISER");
    const shouldRequireSF7 = !(isMRF && !isTeacherRole);

    if (shouldRequireSF7) {
      if (!data.undergraduateDegree || data.undergraduateDegree.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the undergraduate degree.",
          path: ["undergraduateDegree"],
        });
      }
      if (!data.natureOfAppointment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select the nature of appointment.",
          path: ["natureOfAppointment"],
        });
      }
      if (!data.fundingSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select the fund source.",
          path: ["fundingSource"],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;
type PersonnelType = FormValues["personnelType"];

function toPersonnelType(value: string | null): PersonnelType {
  return value === "TEACHING" || value === "NON_TEACHING" ? value : null;
}

function formatDateInput(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const apiError = error as ApiErrorResponse;
  return apiError.response?.data?.message ?? fallback;
}

function createBlankSchedulePeriod(): SchedulePeriodDraft {
  return {
    localId: crypto.randomUUID(),
    dayOfWeek: "MONDAY",
    startTime: "07:30",
    endTime: "08:30",
    subjectLabel: "",
    sectionLabel: "",
  };
}

function normalizeSchedulePeriod(period: SchedulePeriodDraft): Omit<SchedulePeriodDraft, "localId"> {
  return {
    id: period.id,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
    subjectLabel: period.subjectLabel.trim().toUpperCase(),
    sectionLabel: period.sectionLabel.trim().toUpperCase(),
  };
}

function scheduleSignature(periods: SchedulePeriodDraft[]): string {
  return JSON.stringify(periods.map(normalizeSchedulePeriod));
}

function toScheduleDraft(period: TeacherSchedulePeriod): SchedulePeriodDraft {
  return {
    localId: String(period.id),
    id: period.id,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
    subjectLabel: period.subjectLabel ?? "",
    sectionLabel: period.sectionLabel ?? "",
  };
}

function scheduleMinutes(startTime: string, endTime: string): number {
  const [startHourRaw, startMinuteRaw] = startTime.split(":");
  const [endHourRaw, endMinuteRaw] = endTime.split(":");
  const start = Number(startHourRaw) * 60 + Number(startMinuteRaw);
  const end = Number(endHourRaw) * 60 + Number(endMinuteRaw);
  return Math.max(0, end - start);
}

export const TeacherDetailPanel = memo(function TeacherDetailPanel({
  teacher,
  open,
  onOpenChange,
  onSaveSuccess,
}: TeacherDetailPanelProps) {
  const [schedulePeriods, setSchedulePeriods] = useState<SchedulePeriodDraft[]>([]);
  const [initialSchedulePeriods, setInitialSchedulePeriods] = useState<SchedulePeriodDraft[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const { panelPercentage, isDesktopViewport, startResizing } = useResizablePanel();
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const { ayId } = useSchoolYearContext();

  const isTeachingStaff = useMemo(() => {
    return teacher?.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
  }, [teacher]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [isPortalActionSubmitting, setIsPortalActionSubmitting] = useState(false);
  const [defaultPasswordInput, setDefaultPasswordInput] = useState("");

  const globalDefaultPassword = useSettingsStore((s) => s.globalDefaultPassword);

  useEffect(() => {
    setDefaultPasswordInput(globalDefaultPassword || "");
  }, [globalDefaultPassword]);

  const handleResetPassword = () => {
    setShowResetPasswordConfirm(true);
  };

  const handleResetPasswordConfirm = async () => {
    if (!teacher) return;
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
      await api.post(`/teachers/${teacher.id}/reset-password`, { password: defaultPasswordInput });
      sileo.success({
        title: "Password Reset Success",
        description: "Teacher portal password has been reset.",
      });
    } catch (err: unknown) {
      sileo.error({
        title: "Failed to Reset Password",
        description: getApiErrorMessage(err, "An error occurred while resetting password."),
      });
    } finally {
      setIsPortalActionSubmitting(false);
    }
  };

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      middleName: "",
      suffix: "",
      sex: undefined as any,
      birthdate: null,
      personnelType: null,
      employeeId: null,
      plantillaPosition: "",
      department: "",
      functionalAssignment: "",
      specialization: "",
      undergraduateDegree: "",
      postgraduateDegree: "",
      majorSpecialization: "",
      minorSpecialization: "",
      indigenousCommunity: "NOT APPLICABLE",
      natureOfAppointment: "REGULAR_PERMANENT",
      fundingSource: "NATIONAL",
      roles: [],
      contactNumber: "",
      serviceStatus: "ACTIVE",
      serviceEffectiveDate: new Date().toISOString().slice(0, 10),
      serviceRemarks: "",
      portalActive: true,
    },
  });

  const formRoles = watch("roles");
  const formPersonnelType = watch("personnelType");

  const isFormTeachingStaff = useMemo(() => {
    return formRoles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
  }, [formRoles]);

  useEffect(() => {
    setValue("personnelType", isFormTeachingStaff ? "TEACHING" : "NON_TEACHING", { shouldValidate: true });
    if (!isFormTeachingStaff) {
      setValue("department", "");
    }
  }, [isFormTeachingStaff, setValue]);

  const formPlantillaPosition = watch("plantillaPosition");
  const formServiceStatus = watch("serviceStatus");
  const formFirstName = watch("firstName");
  const formLastName = watch("lastName");
  const formSuffix = watch("suffix");

  useEffect(() => {
    if (teacher) {
      const isTeacherOrAdviser = teacher.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
      const isMRF = teacher.userAccount?.roles?.includes("MRF") ?? false;
      const serviceMetadata = teacher as Teacher & {
        serviceEffectiveDate?: string | null;
        serviceRemarks?: string | null;
      };

      reset({
        firstName: (teacher.firstName || "").toUpperCase(),
        lastName: (teacher.lastName || "").toUpperCase(),
        middleName: (teacher.middleName || "").toUpperCase(),
        suffix: (teacher.suffix || "").toUpperCase(),
        sex: teacher.sex,
        birthdate: teacher.birthdate ? new Date(teacher.birthdate).toISOString().slice(0, 10) : null,
        personnelType: toPersonnelType(teacher.personnelType),
        employeeId: teacher.employeeId || null,
        plantillaPosition: teacher.plantillaPosition === "MRF Coordinator" ? "" : (teacher.plantillaPosition || ""),
        department: !isTeacherOrAdviser ? "" : (teacher.department || ""),
        functionalAssignment: teacher.functionalAssignment || "",
        specialization: teacher.specialization || "",
        undergraduateDegree: teacher.undergraduateDegree || "",
        postgraduateDegree: teacher.postgraduateDegree || "",
        majorSpecialization: teacher.majorSpecialization || "",
        minorSpecialization: teacher.minorSpecialization || "",
        indigenousCommunity: (teacher.indigenousCommunity as any) || "NOT APPLICABLE",
        natureOfAppointment: teacher.natureOfAppointment || "REGULAR_PERMANENT",
        fundingSource: teacher.fundingSource || "NATIONAL",
        roles: teacher.userAccount?.roles || [],
        contactNumber: teacher.contactNumber || "",
        serviceStatus: teacher.serviceStatus || "ACTIVE",
        serviceEffectiveDate: formatDateInput(serviceMetadata.serviceEffectiveDate),
        serviceRemarks: serviceMetadata.serviceRemarks || "",
        portalActive: teacher.userAccount?.isActive ?? teacher.isActive ?? true,
      });
    } else {
      reset({
        firstName: "",
        lastName: "",
        middleName: "",
        suffix: "",
        sex: undefined as any,
        birthdate: null,
        personnelType: null,
        employeeId: null,
        plantillaPosition: "",
        department: "",
        functionalAssignment: "",
        specialization: "",
        undergraduateDegree: "",
        postgraduateDegree: "",
        majorSpecialization: "",
        minorSpecialization: "",
        indigenousCommunity: "NOT APPLICABLE",
        natureOfAppointment: "REGULAR_PERMANENT",
        fundingSource: "NATIONAL",
        roles: [],
        contactNumber: "",
        serviceStatus: "ACTIVE",
        serviceEffectiveDate: new Date().toISOString().slice(0, 10),
        serviceRemarks: "",
        portalActive: true,
      });
    }
  }, [teacher, reset, open]);

  const isAdding = !teacher || teacher.id === -1;
  const [isEditing, setIsEditing] = useState(isAdding);

  const currentRoles = formRoles || teacher?.userAccount?.roles || [];
  const isFormMRF = currentRoles.includes("MRF");
  const isFormTeacherOrAdviser = currentRoles.includes("TEACHER") || currentRoles.includes("CLASS_ADVISER");
  const showSF7 = !(isFormMRF && !isFormTeacherOrAdviser);

  useEffect(() => {
    if (open) setIsEditing(isAdding);
  }, [open, isAdding]);

  const designationPool = useMemo(() => {
    return getDesignationPool(formRoles);
  }, [formRoles]);

  useEffect(() => {
    if (
      formPlantillaPosition &&
      designationPool.length > 0 &&
      !designationPool.includes(formPlantillaPosition)
    ) {
      setValue("plantillaPosition", "", { shouldDirty: true });
    }
  }, [formRoles, formPlantillaPosition, designationPool, setValue]);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!teacher || !open || !ayId) {
        setSchedulePeriods([]);
        setInitialSchedulePeriods([]);
        return;
      }

      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const res = await api.get<TeacherScheduleResponse>(
          `/teachers/${teacher.id}/schedule-periods`,
          { params: { schoolYearId: ayId } },
        );
        const drafts = res.data.periods.map(toScheduleDraft);
        setSchedulePeriods(drafts);
        setInitialSchedulePeriods(drafts);
      } catch (error: unknown) {
        setScheduleError(
          getApiErrorMessage(error, "Could not load the SF7 teaching schedule."),
        );
      } finally {
        setScheduleLoading(false);
      }
    };

    void fetchSchedule();
  }, [teacher, open, ayId]);

  const scheduleDirty = useMemo(
    () => scheduleSignature(schedulePeriods) !== scheduleSignature(initialSchedulePeriods),
    [schedulePeriods, initialSchedulePeriods],
  );

  const totalScheduleMinutes = useMemo(
    () =>
      schedulePeriods.reduce(
        (sum, period) => sum + scheduleMinutes(period.startTime, period.endTime),
        0,
      ),
    [schedulePeriods],
  );

  const discardProfileChanges = useCallback(() => {
    reset();
    setSchedulePeriods(initialSchedulePeriods);
  }, [initialSchedulePeriods, reset]);

  const closePanel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCloseAttempt = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    confirmOrRun(closePanel);
  }, [closePanel, confirmOrRun, onOpenChange]);

  useUnsavedChanges({
    id: "teacher-detail-panel",
    label: "Faculty/Staff profile",
    isDirty: open && (isDirty || scheduleDirty),
    isSubmitting,
    onDiscard: discardProfileChanges,
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const profilePayload = {
        firstName: data.firstName.toUpperCase(),
        lastName: data.lastName.toUpperCase(),
        middleName: data.middleName ? data.middleName.toUpperCase() : "",
        suffix: data.suffix ? data.suffix.toUpperCase() : "",
        sex: data.sex,
        birthdate: data.birthdate,
        personnelType: data.personnelType,
        employeeId: data.employeeId,
        plantillaPosition: (data.plantillaPosition === "__NONE__" || data.plantillaPosition === "MRF Coordinator") ? "" : data.plantillaPosition,
        department: data.department === "__NONE__" ? "" : data.department,
        functionalAssignment: data.personnelType === "NON_TEACHING" ? data.functionalAssignment : null,
        specialization: data.specialization || "",
        undergraduateDegree: data.undergraduateDegree || "",
        postgraduateDegree: data.postgraduateDegree || "",
        majorSpecialization: data.majorSpecialization || "",
        minorSpecialization: data.minorSpecialization || "",
        indigenousCommunity: data.indigenousCommunity,
        natureOfAppointment: data.natureOfAppointment,
        fundingSource: data.fundingSource,
        roles: data.roles,
        contactNumber: data.contactNumber,
        serviceStatus: data.serviceStatus,
        serviceEffectiveDate: data.serviceEffectiveDate,
        serviceRemarks: data.serviceRemarks,
      };

      if (isAdding) {
        const createPayload = {
          ...profilePayload,
          password: defaultPasswordInput || undefined,
          portalActive: data.portalActive !== undefined ? data.portalActive : true,
        };
        const res = await api.post<{ teacher: Teacher }>(`/teachers`, createPayload);
        if (ayId && schedulePeriods.length > 0) {
          await api.put(`/teachers/${res.data.teacher.id}/schedule-periods`, {
            schoolYearId: ayId,
            periods: schedulePeriods.map(normalizeSchedulePeriod),
          });
        }
        sileo.success({ title: "Faculty/Staff Record Created", description: "The faculty or staff record has been saved." });
      } else {
        await api.patch(`/teachers/${teacher!.id}`, profilePayload);
        if (ayId) {
          await api.put(`/teachers/${teacher!.id}/schedule-periods`, {
            schoolYearId: ayId,
            periods: schedulePeriods.map(normalizeSchedulePeriod),
          });
        }

        const originalPortalActive = teacher!.userAccount?.isActive ?? teacher!.isActive ?? true;
        if (data.portalActive !== undefined && data.portalActive !== originalPortalActive) {
          try {
            await api.patch(`/teachers/${teacher!.id}/portal-access`, { isActive: data.portalActive });
          } catch (err: unknown) {
            sileo.error({ title: "Portal Update Failed", description: getApiErrorMessage(err, "Profile saved, but portal status failed to update.") });
          }
        }

        sileo.success({ title: "Profile Updated", description: "The faculty/staff profile has been saved." });
      }

      if (onSaveSuccess) onSaveSuccess();
      reset(data);
      setInitialSchedulePeriods(schedulePeriods);
      onOpenChange(false);
    } catch (err: unknown) {
      sileo.error({
        title: isAdding ? "Could Not Add Faculty/Staff" : "Could Not Update Profile",
        description: getApiErrorMessage(err, "Please check the required fields and try again.")
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  // Helper maps for human-readable labels in view mode
  const ROLE_LABEL_MAP: Record<string, string> = {
    SYSTEM_ADMIN: "School Head",
    HEAD_REGISTRAR: "Registrar",
    TEACHER: "Teacher",
    CLASS_ADVISER: "Class Adviser",
    MRF: "MRF Coordinator",
  };

  const SERVICE_STATUS_LABEL_MAP: Record<string, string> = {
    ACTIVE: "Active Personnel",
    ON_LEAVE: "On Leave",
    TRANSFERRED: "Transferred",
    RETIRED_RESIGNED: "Retired / Resigned",
    DROPPED_FROM_ROLLS: "Dropped from Rolls",
  };

  const NATURE_OF_APPOINTMENT_MAP: Record<string, string> = {
    REGULAR_PERMANENT: "Regular / Permanent",
    PROVISIONAL: "Provisional",
    SUBSTITUTE: "Substitute",
    CONTRACTUAL: "Contractual",
    VOLUNTEER: "Volunteer",
    LOCAL_SCHOOL_BOARD: "Local School Board",
    OTHER: "Other",
  };

  const FUNDING_SOURCE_MAP: Record<string, string> = {
    NATIONAL: "National",
    SPECIAL_EDUCATION_FUND: "Special Education Fund",
    LOCAL_SCHOOL_BOARD: "Local School Board",
    PTA: "PTA",
    NGO: "NGO",
    OTHER: "Other",
  };

  // View Mode: grid row helper
  const ViewRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
      <div className="p-3 text-foreground bg-muted/30 uppercase">{label}</div>
      <div className="p-3 uppercase">{value || "—"}</div>
    </div>
  );

  const portalIsActive = teacher?.userAccount?.isActive ?? teacher?.isActive ?? true;

  return (
    <>
      <Sheet open={open} onOpenChange={handleCloseAttempt}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (isDirty || scheduleDirty) {
              e.preventDefault();
              confirmOrRun(closePanel);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isDirty || scheduleDirty) {
              e.preventDefault();
              confirmOrRun(closePanel);
            }
          }}
          className="p-0 flex flex-col h-full border-l overflow-visible w-full sm:w-auto sm:max-w-none"
          style={
            isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
          }
        >
          {/* Resize Handle — hidden on mobile */}
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* ─── Header ─── */}
          <SheetHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-extrabold text-left space-y-0 mt-0">
            <div>
              <SheetTitle className="text-base sm:text-lg text-primary-foreground font-extrabold uppercase flex items-center gap-2">
                {isAdding ? "New Personnel Profile" : "Personnel Profile"}
              </SheetTitle>
            </div>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-extrabold">

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SUMMARY BLOCK (Matches StudentDetailPanel)                 */}
              {/* ════════════════════════════════════════════════════════════ */}
              <div className="bg-[hsl(var(--muted))] p-3 sm:p-4 rounded-md border">
                <div className="flex flex-col items-center mb-6 pt-2">
                  <UserPhoto
                    photo={teacher?.photoPath}
                    containerClassName="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-primary border-dashed shadow-md shrink-0"
                    className="w-full h-full object-cover rounded-full"
                    fallbackIcon={
                      <div className="w-full h-full rounded-full flex items-center justify-center text-white font-extrabold text-3xl sm:text-4xl uppercase bg-primary">
                        {isAdding ? (
                          <UserIcon className="size-12" />
                        ) : (
                          <>
                            {(formFirstName || teacher?.firstName || "N").charAt(0)}
                            {(formLastName || teacher?.lastName || "N").charAt(0)}
                          </>
                        )}
                      </div>
                    }
                  />
                  <div className="text-center mt-4">
                    <h3 className="font-extrabold text-lg sm:text-xl uppercase break-words">
                      {isAdding ? "New Personnel" : formatTeacherName({
                        ...teacher!,
                        firstName: formFirstName || teacher?.firstName || "",
                        lastName: formLastName || teacher?.lastName || "",
                        suffix: formSuffix ?? teacher?.suffix ?? null,
                      } as Teacher)}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mt-1 font-extrabold flex-wrap">
                      {!isAdding && (
                        (teacher?.userAccount?.roles || []).length > 0
                          ? (teacher?.userAccount?.roles || []).map((role) => (
                              <Badge key={role} variant="outline" className="gap-1 px-3 py-1 rounded-md uppercase shadow-sm font-extrabold border-primary text-primary bg-primary/5">
                                {ROLE_LABEL_MAP[role] || role}
                              </Badge>
                            ))
                          : <Badge variant="outline" className="gap-1 px-3 py-1 rounded-md uppercase shadow-sm font-extrabold text-muted-foreground">No roles</Badge>
                      )}
                    </div>
                    {!isAdding && (
                      <p className=" mt-2 uppercase text-foreground font-extrabold">
                        Employee ID: <span>{teacher?.employeeId || "—"}</span>
                      </p>
                    )}
                    {!isEditing && !isAdding && (
                      <div className="mt-4 flex justify-center w-full px-2">
                        <Button
                          variant="default"
                          className="font-extrabold text-sm h-10 uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-md w-full max-w-sm rounded-md transition-all active:scale-[0.98]"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsEditing(true);
                          }}
                        >
                          <UserRoundPen className="mr-2 h-5 w-5 shrink-0" />
                          Edit Profile
                        </Button>
                      </div>
                    )}
                  </div>
                </div>


              </div>

              {/* ════════════════════════════════════════════════════════════ */}
              {/* VIEW MODE — read-only grid tables                          */}
              {/* ════════════════════════════════════════════════════════════ */}
              {!isEditing && !isAdding && teacher && (
                <>

                  {/* Personal Information */}
                  <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                    <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-primary" />
                      Personal Information
                    </div>
                    <div className="text-base leading-tight font-extrabold divide-y divide-border">
                      <ViewRow label="First Name" value={teacher.firstName} />
                      <ViewRow label="Middle Name" value={teacher.middleName} />
                      <ViewRow label="Last Name" value={teacher.lastName} />
                      <ViewRow label="Suffix" value={teacher.suffix} />
                      <ViewRow label="Sex" value={teacher.sex} />
                      <ViewRow label="Date of Birth" value={teacher.birthdate ? new Date(teacher.birthdate).toLocaleDateString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }) : null} />
                      <ViewRow label="Mobile No." value={teacher.contactNumber} />
                      <ViewRow label="IP Community" value={teacher.indigenousCommunity || "NOT APPLICABLE"} />
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                    <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      Employment Details
                    </div>
                    <div className="text-base leading-tight font-extrabold divide-y divide-border">
                      <ViewRow label="Personnel Type" value={teacher.personnelType === "TEACHING" ? "Teaching" : teacher.personnelType === "NON_TEACHING" ? "Non-Teaching" : "—"} />
                      <ViewRow label="Position" value={teacher.plantillaPosition} />
                      {teacher.personnelType === "TEACHING" && (
                        <ViewRow label="Subject Area" value={teacher.department} />
                      )}
                      {teacher.personnelType === "NON_TEACHING" && (
                        <ViewRow label="Office" value={teacher.functionalAssignment} />
                      )}
                      {showSF7 && (
                        <>
                          <ViewRow label="Appointment" value={NATURE_OF_APPOINTMENT_MAP[teacher.natureOfAppointment] || teacher.natureOfAppointment} />
                          <ViewRow label="Fund Source" value={FUNDING_SOURCE_MAP[teacher.fundingSource] || teacher.fundingSource} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* SF7 Profile */}
                  {showSF7 && (
                    <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          SF7 Profile
                        </span>
                        <Badge variant="outline" className="font-extrabold uppercase">School Form 7</Badge>
                      </div>
                      <div className="text-base leading-tight font-extrabold divide-y divide-border">
                        <ViewRow label="Undergrad" value={teacher.undergraduateDegree} />
                        <ViewRow label="Postgrad" value={teacher.postgraduateDegree} />
                        <ViewRow label="Major" value={teacher.majorSpecialization} />
                        <ViewRow label="Minor" value={teacher.minorSpecialization} />
                      </div>
                    </div>
                  )}

                  {/* SF7 Teaching Schedule (view mode) */}
                  {showSF7 && teacher.personnelType === "TEACHING" && (
                    <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          SF7 Teaching Schedule
                        </span>
                        <Badge className="font-extrabold uppercase">
                          {totalScheduleMinutes} min/week
                        </Badge>
                      </div>
                      <div className="p-0">
                        {scheduleLoading ? (
                          <div className="p-4 text-sm font-extrabold text-foreground">
                            Loading SF7 schedule...
                          </div>
                        ) : schedulePeriods.length === 0 ? (
                          <div className="p-4 text-sm font-extrabold text-foreground italic">
                            No SF7 teaching periods encoded yet.
                          </div>
                        ) : (
                          <table className="w-full text-base font-extrabold">
                            <thead>
                              <tr className="border-b bg-muted/30 uppercase text-foreground">
                                <th className="p-2 text-left">Day</th>
                                <th className="p-2 text-left">Time</th>
                                <th className="p-2 text-left">Subject</th>
                                <th className="p-2 text-left">Section</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {schedulePeriods.map((period) => (
                                <tr key={period.localId}>
                                  <td className="p-2 uppercase">{toSentenceCase(period.dayOfWeek)}</td>
                                  <td className="p-2">{period.startTime} – {period.endTime}</td>
                                  <td className="p-2 uppercase">{period.subjectLabel || "—"}</td>
                                  <td className="p-2 uppercase">{period.sectionLabel || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Service Status */}
                  <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                    <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      Service Status
                    </div>
                    <div className="text-base leading-tight font-extrabold divide-y divide-border">
                      <ViewRow label="Status" value={SERVICE_STATUS_LABEL_MAP[teacher.serviceStatus] || teacher.serviceStatus} />
                      {teacher.serviceStatus !== "ACTIVE" && (
                        <>
                          <ViewRow label="Effective Date" value={(teacher as Teacher & { serviceEffectiveDate?: string | null }).serviceEffectiveDate ? new Date((teacher as Teacher & { serviceEffectiveDate?: string | null }).serviceEffectiveDate!).toLocaleDateString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }) : null} />
                          <ViewRow label="Notes" value={(teacher as Teacher & { serviceRemarks?: string | null }).serviceRemarks} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Portal Access Status */}
                  <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                    <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      Portal Access and Security
                    </div>
                    <div className="text-base leading-tight font-extrabold divide-y divide-border">
                      <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
                        <div className="p-3 text-foreground bg-muted/30 uppercase">Portal</div>
                        <div className="p-3 uppercase flex items-center gap-2">
                          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", portalIsActive ? "bg-emerald-500" : "bg-amber-500")} />
                          {portalIsActive ? "Active — Login Allowed" : "Disabled — Login Blocked"}
                        </div>
                      </div>
                      <ViewRow label="Last Login" value={teacher.userAccount?.lastLoginAt ? new Date(teacher.userAccount.lastLoginAt).toLocaleDateString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"} />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/10 text-center rounded-xl">
                    <p className="text-sm font-extrabold text-foreground uppercase tracking-widest">
                      Record created {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }) : "date not available"}
                    </p>
                  </div>
                </>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* EDIT / ADD MODE — full interactive form                     */}
              {/* ════════════════════════════════════════════════════════════ */}
              {(isEditing || isAdding) && (
                <>
                  {/* Card 1: Personal Information */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-primary" />
                        Personal Information
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4 space-y-4">
                      <div className="space-y-2 mb-6">
                        <Label className="text-base font-extrabold uppercase text-foreground">
                          SYSTEM ROLES *
                        </Label>
                        <Controller
                          name="roles"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                              {([
                                { value: "SYSTEM_ADMIN", label: "School Head" },
                                { value: "HEAD_REGISTRAR", label: "Registrar" },
                                { value: "TEACHER", label: "Teacher" },
                                { value: "CLASS_ADVISER", label: "Class Adviser" },
                                { value: "MRF", label: "MRF Coordinator" },
                              ] as const).map((roleOption) => (
                                <div key={roleOption.value} className="flex items-center space-x-2 bg-background p-2 rounded border border-border">
                                  <Checkbox
                                    disabled={!isEditing}
                                    id={`role-${roleOption.value}`}
                                    checked={field.value.includes(roleOption.value)}
                                    onCheckedChange={(checked) => {
                                      const isChecked = checked === true;
                                      const newRoles = isChecked
                                        ? [...field.value, roleOption.value]
                                        : field.value.filter((r) => r !== roleOption.value);
                                      field.onChange(newRoles);
                                    }}
                                    className="cursor-pointer"
                                  />
                                  <Label htmlFor={`role-${roleOption.value}`} className="text-base font-extrabold uppercase cursor-pointer flex-1">
                                    {roleOption.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">First Name *</Label>
                          <Controller
                            name="firstName"
                            control={control}
                            render={({ field }) => (
                              <Input autoComplete="off" disabled={!isEditing}
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                placeholder="e.g. JUAN"
                                className={cn(
                                  "font-extrabold text-base leading-tight bg-background text-foreground border-border h-10 uppercase",
                                  errors.firstName && "border-destructive focus-visible:ring-destructive"
                                )}
                              />
                            )}
                          />
                          <AnimatedError error={errors.firstName?.message as string || errors.firstName as unknown as string} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">Middle Name <span className="text-foreground font-extrabold ml-1">(optional)</span></Label>
                          <Controller
                            name="middleName"
                            control={control}
                            render={({ field }) => (
                              <Input autoComplete="off" disabled={!isEditing}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                placeholder="e.g. SANTOS"
                                className="font-extrabold text-base leading-tight bg-background text-foreground border-border h-10 uppercase"
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">Last Name *</Label>
                          <Controller
                            name="lastName"
                            control={control}
                            render={({ field }) => (
                              <Input autoComplete="off" disabled={!isEditing}
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                placeholder="e.g. DELA CRUZ"
                                className={cn(
                                  "font-extrabold text-base leading-tight bg-background text-foreground border-border h-10 uppercase",
                                  errors.lastName && "border-destructive focus-visible:ring-destructive"
                                )}
                              />
                            )}
                          />
                          <AnimatedError error={errors.lastName?.message as string || errors.lastName as unknown as string} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">Suffix <span className="text-foreground font-extrabold ml-1">(e.g., JR., III)</span></Label>
                          <Controller
                            name="suffix"
                            control={control}
                            render={({ field }) => (
                              <Input autoComplete="off" disabled={!isEditing}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                placeholder="JR., III"
                                className="font-extrabold text-base leading-tight bg-background text-foreground border-border h-10 uppercase"
                              />
                            )}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">Sex *</Label>
                          <Controller
                            name="sex"
                            control={control}
                            render={({ field }) => (
                              <div className="flex gap-4">
                                {(
                                  [
                                    { val: "MALE", icon: Mars },
                                    { val: "FEMALE", icon: Venus },
                                  ] as const
                                ).map((s) => (
                                  <button
                                    key={s.val}
                                    type="button"
                                    onClick={() => field.onChange(s.val)}
                                    className={cn(
                                      "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-extrabold uppercase",
                                      field.value === s.val
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border hover:bg-muted/50 text-foreground",
                                    )}>
                                    <s.icon
                                      className={cn(
                                        "w-4 h-4",
                                        field.value === s.val
                                          ? "text-primary"
                                          : "text-foreground",
                                      )}
                                    />
                                    {s.val}
                                  </button>
                                ))}
                              </div>
                            )}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">Date of Birth *</Label>
                          <Controller
                            name="birthdate"
                            control={control}
                            render={({ field }) => (
                              <HybridDatePicker disabled={!isEditing}
                                value={field.value || ""}
                                onChange={field.onChange}
                                className={cn(
                                  "h-10 font-extrabold text-base leading-tight",
                                  errors.birthdate && "border-destructive focus-visible:ring-destructive"
                                )}
                              />
                            )}
                          />
                          <AnimatedError error={errors.birthdate?.message as string || errors.birthdate as unknown as string} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground flex items-center gap-1 h-6">
                            <Smartphone className="size-3" />
                            Mobile Number *
                          </Label>
                          <Controller
                            name="contactNumber"
                            control={control}
                            render={({ field }) => (
                              <Input autoComplete="off" disabled={!isEditing}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                                  let formatted = raw;
                                  if (raw.length > 4) {
                                    formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
                                  }
                                  if (raw.length > 7) {
                                    formatted = `${raw.slice(0, 4)}-${raw.slice(4, 7)}-${raw.slice(7)}`;
                                  }
                                  field.onChange(formatted);
                                }}
                                maxLength={13}
                                placeholder="e.g., 0917-123-4567"
                                className={cn("font-extrabold text-base leading-tight", errors.contactNumber && "border-destructive")}
                              />
                            )}
                          />
                          <AnimatedError error={errors.contactNumber?.message as string || errors.contactNumber as unknown as string} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground flex items-center h-6">IP Community / Ethnic Group</Label>
                          <Controller
                            name="indigenousCommunity"
                            control={control}
                            render={({ field }) => (
                              <SearchableCombobox
                                items={IP_COMMUNITY_OPTIONS}
                                value={field.value || "NOT APPLICABLE"}
                                onChange={(value) => field.onChange(value)}
                                disabled={!isEditing}
                                placeholder="Select ethnic group (e.g., Aeta, Mangyan)"
                                searchPlaceholder="Search communities..."
                                className="w-full font-extrabold text-base leading-tight uppercase"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Employment Details */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        Employment Details
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">DepEd Employee ID *</Label>
                          <Controller
                            name="employeeId"
                            control={control}
                            render={({ field }) => (
                              <Input autoComplete="off" disabled={!isEditing}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                                maxLength={7}
                                placeholder="e.g., 1234567"
                                className={cn(
                                  "font-extrabold text-base leading-tight h-10",
                                  errors.employeeId && "border-destructive"
                                )}
                              />
                            )}
                          />
                          <AnimatedError error={errors.employeeId?.message as string || errors.employeeId as unknown as string} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-base font-extrabold uppercase text-foreground">DepEd Position (Plantilla) *</Label>
                          <Controller
                            name="plantillaPosition"
                            control={control}
                            render={({ field }) => (
                                <SearchableCombobox
                                  items={[
                                    ...(designationPool.length > 0
                                      ? designationPool.map(opt => ({ value: opt, label: opt }))
                                      : DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS)
                                  ]}
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!isEditing}
                                  placeholder="Search position (e.g., Teacher I, Master Teacher II)"
                                  searchPlaceholder="Search positions..."
                                  className="w-full h-10 font-extrabold text-base leading-tight bg-background text-foreground border-border"
                                />
                            )}
                          />
                          <AnimatedError error={errors.plantillaPosition?.message as string} />
                        </div>
                      </div>

                      {formPersonnelType === "TEACHING" && (
                        <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-border">
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Subject Area / Major</Label>
                            <Controller
                              name="department"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={(v) => field.onChange(v === "__NONE__" ? "" : v)} value={field.value || "__NONE__"}>
                                  <SelectTrigger disabled={!isEditing} className="font-extrabold text-base leading-tight h-10">
                                    <SelectValue placeholder="Search department (e.g., Mathematics, Science, English)" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    <SelectItem value="__NONE__">No subject area set yet</SelectItem>
                                    {DEPED_TEACHER_DEPARTMENT_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>
                      )}


                      {showSF7 && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-extrabold uppercase text-foreground">
                                SF7 Profile
                              </p>
                            <p className="text-sm font-extrabold leading-tight text-foreground">
                              Used for School Form 7 personnel reporting.
                            </p>
                          </div>
                          <Badge variant="outline" className="font-extrabold uppercase">
                            School Form 7
                          </Badge>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Undergraduate Degree *</Label>
                            <Controller
                              name="undergraduateDegree"
                              control={control}
                              render={({ field }) => (
                                <SearchableCombobox
                                  items={TEACHER_UNDERGRADUATE_DEGREE_OPTIONS}
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!isEditing}
                                  placeholder="Select undergraduate degree"
                                  searchPlaceholder="Search degrees..."
                                  className={cn(
                                    "w-full h-10 font-extrabold text-base leading-tight bg-background text-foreground border-border",
                                    errors.undergraduateDegree && "border-destructive focus-visible:ring-destructive"
                                  )}
                                />
                              )}
                            />
                            <AnimatedError error={errors.undergraduateDegree?.message as string} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Postgraduate Degree</Label>
                            <Controller
                              name="postgraduateDegree"
                              control={control}
                              render={({ field }) => (
                                <SearchableCombobox
                                  items={TEACHER_POSTGRADUATE_DEGREE_OPTIONS}
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!isEditing}
                                  placeholder="Select postgraduate degree"
                                  searchPlaceholder="Search degrees..."
                                  className="w-full h-10 font-extrabold text-base leading-tight bg-background text-foreground border-border"
                                />
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Major / Specialization</Label>
                            <Controller
                              name="majorSpecialization"
                              control={control}
                              render={({ field }) => (
                                <SearchableCombobox
                                  items={TEACHER_JHS_SPECIALIZATION_OPTIONS}
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!isEditing}
                                  placeholder="Select major specialization"
                                  searchPlaceholder="Search specializations..."
                                  className="w-full h-10 font-extrabold text-base leading-tight bg-background text-foreground border-border"
                                />
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Minor</Label>
                            <Controller
                              name="minorSpecialization"
                              control={control}
                              render={({ field }) => (
                                <SearchableCombobox
                                  items={TEACHER_JHS_MINOR_SPECIALIZATION_OPTIONS}
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!isEditing}
                                  placeholder="Select minor specialization"
                                  searchPlaceholder="Search specializations..."
                                  className="w-full h-10 font-extrabold text-base leading-tight bg-background text-foreground border-border"
                                />
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Nature of Appointment *</Label>
                            <Controller
                              name="natureOfAppointment"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  onValueChange={(value) => field.onChange(value as TeacherNatureOfAppointment)}
                                  value={field.value ?? undefined}
                                >
                                  <SelectTrigger disabled={!isEditing} className={cn("font-extrabold text-base leading-tight h-10 uppercase", errors.natureOfAppointment && "border-destructive focus-visible:ring-destructive")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TEACHER_NATURE_OF_APPOINTMENT_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value} className="uppercase">
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            <AnimatedError error={errors.natureOfAppointment?.message as string} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Fund Source *</Label>
                            <Controller
                              name="fundingSource"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  onValueChange={(value) => field.onChange(value as TeacherFundingSource)}
                                  value={field.value ?? undefined}
                                >
                                  <SelectTrigger disabled={!isEditing} className={cn("font-extrabold text-base leading-tight h-10 uppercase", errors.fundingSource && "border-destructive focus-visible:ring-destructive")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TEACHER_FUNDING_SOURCE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value} className="uppercase">
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            <AnimatedError error={errors.fundingSource?.message as string} />
                          </div>

                        </div>
                      </div>
                      )}

                      {showSF7 && formPersonnelType === "TEACHING" && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-base font-extrabold uppercase text-foreground flex items-center gap-2">
                                <Clock className="size-4 text-primary" />
                                SF7 Teaching Schedule
                              </p>
                              <p className="text-sm font-extrabold leading-tight text-foreground">
                                Official school-form snapshot. ATLAS remains the external schedule reference.
                              </p>
                            </div>
                            <Badge className="font-extrabold uppercase">
                              {totalScheduleMinutes} minutes/week
                            </Badge>
                          </div>

                          {scheduleError && (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-extrabold text-destructive">
                              {scheduleError}
                            </div>
                          )}

                          <div className="space-y-3">
                            {scheduleLoading ? (
                              <div className="rounded-lg border border-dashed p-4 text-sm font-extrabold text-foreground">
                                Loading SF7 schedule...
                              </div>
                            ) : schedulePeriods.length === 0 ? (
                              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm font-extrabold text-foreground">
                                No SF7 teaching periods encoded yet.
                              </div>
                            ) : (
                              schedulePeriods.map((period, index) => (
                                <div key={period.localId} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1.1fr_0.8fr_0.8fr_1.2fr_1.2fr]">
                                  <Select
                                    value={period.dayOfWeek}
                                    onValueChange={(value) => {
                                      const nextDay = value as TeacherScheduleDay;
                                      setSchedulePeriods((current) =>
                                        current.map((item, rowIndex) =>
                                          rowIndex === index ? { ...item, dayOfWeek: nextDay } : item,
                                        ),
                                      );
                                    }}
                                  >
                                    <SelectTrigger disabled={true} className="h-10 font-extrabold">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TEACHER_SCHEDULE_DAY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input autoComplete="off"
                                    disabled={true}
                                    type="time"
                                    value={period.startTime}
                                    onChange={(event) => {
                                      const startTime = event.target.value;
                                      setSchedulePeriods((current) =>
                                        current.map((item, rowIndex) =>
                                          rowIndex === index ? { ...item, startTime } : item,
                                        ),
                                      );
                                    }}
                                    className="h-10 font-extrabold"
                                  />
                                  <Input autoComplete="off"
                                    disabled={true}
                                    type="time"
                                    value={period.endTime}
                                    onChange={(event) => {
                                      const endTime = event.target.value;
                                      setSchedulePeriods((current) =>
                                        current.map((item, rowIndex) =>
                                          rowIndex === index ? { ...item, endTime } : item,
                                        ),
                                      );
                                    }}
                                    className="h-10 font-extrabold"
                                  />
                                  <Input autoComplete="off"
                                    disabled={true}
                                    value={period.subjectLabel}
                                    placeholder="e.g. MATH 7"
                                    onChange={(event) => {
                                      const subjectLabel = event.target.value.toUpperCase();
                                      setSchedulePeriods((current) =>
                                        current.map((item, rowIndex) =>
                                          rowIndex === index ? { ...item, subjectLabel } : item,
                                        ),
                                      );
                                    }}
                                    className="h-10 font-extrabold"
                                  />
                                  <Input autoComplete="off"
                                    disabled={true}
                                    value={period.sectionLabel}
                                    placeholder="e.g. RIZAL"
                                    onChange={(event) => {
                                      const sectionLabel = event.target.value.toUpperCase();
                                      setSchedulePeriods((current) =>
                                        current.map((item, rowIndex) =>
                                          rowIndex === index ? { ...item, sectionLabel } : item,
                                        ),
                                      );
                                    }}
                                    className="h-10 font-extrabold"
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4 pt-4 border-t border-border mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Service Status</Label>
                            <Controller
                              name="serviceStatus"
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || "ACTIVE"}>
                                  <SelectTrigger disabled={!isEditing} className="font-extrabold text-base leading-tight h-10 uppercase">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent className="uppercase">
                                    <SelectItem value="ACTIVE">Active Personnel</SelectItem>
                                    <SelectItem value="TRANSFERRED">Transferred to another school/office</SelectItem>
                                    <SelectItem value="RETIRED_RESIGNED">Retired / Resigned</SelectItem>
                                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                                    <SelectItem value="DROPPED_FROM_ROLLS">Dropped from Rolls</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          {formServiceStatus !== "ACTIVE" && (
                            <div className="space-y-1.5">
                              <Label className="text-base font-extrabold uppercase text-foreground">Date Started</Label>
                              <Controller
                                name="serviceEffectiveDate"
                                control={control}
                                render={({ field }) => (
                                  <HybridDatePicker disabled={!isEditing}
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="h-10 font-extrabold text-base leading-tight"
                                  />
                                )}
                              />
                            </div>
                          )}
                        </div>
                        {formServiceStatus !== "ACTIVE" && (
                          <div className="space-y-1.5">
                            <Label className="text-base font-extrabold uppercase text-foreground">Notes for this status <span className="text-foreground font-extrabold ml-1">(optional)</span></Label>
                            <Controller
                              name="serviceRemarks"
                              control={control}
                              render={({ field }) => (
                                <Textarea autoComplete="off" disabled={!isEditing}
                                  placeholder="e.g., maternity leave, transferred to another school, retired"
                                  className="min-h-[80px] resize-none font-extrabold text-base leading-tight"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: PORTAL ACCESS AND SECURITY */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-primary" />
                        PORTAL ACCESS AND SECURITY
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4 space-y-4">
                        <div className="space-y-4 pt-4 border-t border-border">
                          <div className="space-y-2">
                            <Label className="text-base font-extrabold uppercase text-foreground">
                              Portal Access Status
                            </Label>
                            <p className="text-sm font-extrabold leading-tight text-foreground">
                              Toggle whether this user can sign in to the portal.
                            </p>
                            <Controller
                              name="portalActive"
                              control={control}
                              render={({ field }) => (
                                <div className="flex gap-4">
                                  <button
                                    type="button"
                                    disabled={!isEditing || isPortalActionSubmitting}
                                    onClick={() => field.onChange(true)}
                                    className={cn(
                                      "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-extrabold uppercase",
                                      field.value
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", field.value ? "bg-emerald-500" : "bg-muted-foreground")} />
                                    Allow Login (Active)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!isEditing || isPortalActionSubmitting}
                                    onClick={() => field.onChange(false)}
                                    className={cn(
                                      "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-extrabold uppercase",
                                      field.value === false
                                        ? "border-amber-500 bg-amber-50 text-amber-700"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", field.value === false ? "bg-amber-500" : "bg-muted-foreground")} />
                                    Block Login (Disabled)
                                  </button>
                                </div>
                              )}
                            />
                          </div>

                            <div className="space-y-2 pt-2">
                              <Label className="text-base font-extrabold uppercase text-foreground">
                                {isAdding ? "Initial Password" : "Password Control"}
                              </Label>
                              <div className={cn("grid gap-2", isAdding ? "grid-cols-1" : "grid-cols-2")}>
                                <Input autoComplete="off" disabled={!isEditing}
                                  value={defaultPasswordInput}
                                  onChange={(e) => setDefaultPasswordInput(e.target.value)}
                                  placeholder="e.g., DepEd@1234"
                                  className="h-11 font-extrabold text-base bg-background"
                                />
                                {!isAdding && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={!isEditing || isPortalActionSubmitting || !defaultPasswordInput.trim()}
                                    onClick={handleResetPassword}
                                    className="w-full h-11 font-extrabold text-base uppercase border border-border hover:bg-muted/30 shrink-0 cursor-pointer"
                                  >
                                    Reset to Default Password
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm font-extrabold leading-tight text-foreground">
                                {isAdding 
                                  ? "The initial portal password for this user. They will be forced to change it on their first login."
                                  : "This will reset the user's portal password to the value above and force a password change on next login."
                                }
                              </p>
                            </div>
                        </div>
                    </div>
                  </div>

                  {!isAdding && (
                    <div className="mt-4 p-3 bg-muted/10 text-center rounded-xl">
                      <p className="text-sm font-extrabold text-foreground uppercase tracking-widest">
                        Record created {teacher?.createdAt ? new Date(teacher.createdAt).toLocaleDateString(undefined, { timeZone: 'Asia/Manila',  year: 'numeric', month: 'long', day: 'numeric' }) : "date not available"}
                      </p>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* ─── Footer ─── */}
            {(isEditing || isAdding) && (
              <div className="p-4 bg-background border-t flex gap-3 shrink-0">
                {!isAdding && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="font-extrabold uppercase"
                    onClick={() => {
                      discardProfileChanges();
                      setIsEditing(false);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  className={cn(
                    "flex-1 font-extrabold uppercase transition-all duration-200",
                    !(isDirty || scheduleDirty) ? "opacity-50 bg-gray-400 cursor-not-allowed text-primary-foreground hover:bg-gray-400" : ""
                  )}
                  disabled={!(isDirty || scheduleDirty) || isSubmitting}
                >
                  {isSubmitting ? (isAdding ? "Saving..." : "Updating...") : (isAdding ? "Save Faculty/Staff Record" : "Save Profile Changes")}
                </Button>
              </div>
            )}
          </form>
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
});
