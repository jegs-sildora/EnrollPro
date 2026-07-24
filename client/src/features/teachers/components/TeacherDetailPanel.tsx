import { AnimatedError } from "@/shared/components/AnimatedError";
import { memo, useCallback, useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/shared/lib/zodResolver";
import {
  Briefcase,
  GraduationCap,
  Fingerprint,
  RefreshCw,
  User as UserIcon,
  Smartphone,
  Mail,
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
import { formatAdvisorySectionSummary, formatTeacherName } from "../utils";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import {
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  TEACHER_FUNDING_SOURCE_OPTIONS,
  TEACHER_NATURE_OF_APPOINTMENT_OPTIONS,
  TEACHER_SCHEDULE_DAY_OPTIONS,
  getDesignationPool,
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

interface TeachingLoadItem {
  subjectName: string;
  subjectCode: string;
  sectionName: string;
  gradeLevel: string;
}

interface TeachingLoadResponse {
  data?: TeachingLoadItem[];
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
    sex: z.enum(["MALE", "FEMALE"]),
    birthdate: z.string().min(1, "Select the date of birth.").nullable(),

    personnelType: z.enum(["TEACHING", "NON_TEACHING"]).nullable(),
    employeeId: z
      .string()
      .trim()
      .regex(/^\d{7}$/, "Enter the 7-digit DepEd Employee ID.")
      .nullable(),
    plantillaPosition: z.string(),
    department: z.string().optional().nullable(),
    functionalAssignment: z.string().optional().nullable(),
    specialization: z.string().optional().nullable(),
    undergraduateDegree: z.string().optional().nullable(),
    postgraduateDegree: z.string().optional().nullable(),
    majorSpecialization: z.string().optional().nullable(),
    minorSpecialization: z.string().optional().nullable(),
    administrativeRemarks: z.string().optional().nullable(),
    indigenousCommunity: z.string().optional().nullable(),
    natureOfAppointment: z.enum([
      "REGULAR_PERMANENT",
      "PROVISIONAL",
      "SUBSTITUTE",
      "CONTRACTUAL",
      "VOLUNTEER",
      "LOCAL_SCHOOL_BOARD",
      "OTHER",
    ]),
    fundingSource: z.enum([
      "NATIONAL",
      "SPECIAL_EDUCATION_FUND",
      "LOCAL_SCHOOL_BOARD",
      "PTA",
      "NGO",
      "OTHER",
    ]),
    roles: z.array(z.string()),

    contactNumber: z
      .string()
      .trim()
      .regex(/^09\d{9}$/, "Enter an 11-digit mobile number starting with 09.")
      .or(z.literal(""))
      .nullable(),

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
  .superRefine((data, ctx) => {
    if (data.personnelType === "NON_TEACHING") {
      if (!data.functionalAssignment || data.functionalAssignment.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the office assignment for non-teaching staff.",
          path: ["functionalAssignment"],
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
  const [teachingLoad, setTeachingLoad] = useState<TeachingLoadItem[]>([]);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schedulePeriods, setSchedulePeriods] = useState<SchedulePeriodDraft[]>([]);
  const [initialSchedulePeriods, setInitialSchedulePeriods] = useState<SchedulePeriodDraft[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
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
      sex: "FEMALE",
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
      administrativeRemarks: "",
      indigenousCommunity: "",
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
        firstName: teacher.firstName || "",
        lastName: teacher.lastName || "",
        middleName: teacher.middleName || "",
        suffix: teacher.suffix || "",
        sex: teacher.sex === "MALE" ? "MALE" : "FEMALE",
        birthdate: teacher.birthdate ? new Date(teacher.birthdate).toISOString().slice(0, 10) : null,
        personnelType: toPersonnelType(teacher.personnelType),
        employeeId: teacher.employeeId || null,
        plantillaPosition: isMRF ? "MRF STAFF" : (teacher.plantillaPosition || ""),
        department: !isTeacherOrAdviser ? "" : (teacher.department || ""),
        functionalAssignment: teacher.functionalAssignment || "",
        specialization: teacher.specialization || "",
        undergraduateDegree: teacher.undergraduateDegree || "",
        postgraduateDegree: teacher.postgraduateDegree || "",
        majorSpecialization: teacher.majorSpecialization || "",
        minorSpecialization: teacher.minorSpecialization || "",
        administrativeRemarks: teacher.administrativeRemarks || "",
        indigenousCommunity: teacher.indigenousCommunity || "",
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
        sex: "FEMALE",
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
        administrativeRemarks: "",
        indigenousCommunity: "",
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

  const isAdding = !teacher;
  const [isEditing, setIsEditing] = useState(isAdding);

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
      !designationPool.includes(formPlantillaPosition) &&
      !formRoles.includes("MRF")
    ) {
      setValue("plantillaPosition", "", { shouldDirty: true });
    }
    if (formRoles.includes("MRF")) {
      setValue("plantillaPosition", "MRF STAFF", { shouldDirty: true });
    }
  }, [formRoles, formPlantillaPosition, designationPool, setValue]);

  // Fetch teaching load
  useEffect(() => {
    const fetchLoad = async () => {
      if (!teacher || !open) return;
      if (isTeachingStaff) {
        setLoadLoading(true);
        setLoadError(null);
        try {
          const res = await api.get<TeachingLoadResponse>(`/integration/atlas/faculty/${teacher.id}/teaching-load`);
          setTeachingLoad(res.data.data || []);
        } catch {
          setLoadError("Integration Service Offline");
        } finally {
          setLoadLoading(false);
        }
      }
    };
    if (open && teacher) fetchLoad();
    else if (!open) setTeachingLoad([]);
  }, [teacher, open]);

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
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        suffix: data.suffix,
        sex: data.sex,
        birthdate: data.birthdate,
        personnelType: data.personnelType,
        employeeId: data.employeeId,
        plantillaPosition: (data.plantillaPosition === "__NONE__" || data.plantillaPosition === "MRF STAFF") ? "" : data.plantillaPosition,
        department: data.department === "__NONE__" ? "" : data.department,
        functionalAssignment: data.personnelType === "NON_TEACHING" ? data.functionalAssignment : null,
        specialization: data.specialization || "",
        undergraduateDegree: data.undergraduateDegree || "",
        postgraduateDegree: data.postgraduateDegree || "",
        majorSpecialization: data.majorSpecialization || "",
        minorSpecialization: data.minorSpecialization || "",
        administrativeRemarks: data.administrativeRemarks || "",
        indigenousCommunity: data.indigenousCommunity || "",
        natureOfAppointment: data.natureOfAppointment,
        fundingSource: data.fundingSource,
        roles: data.roles,
        contactNumber: data.contactNumber,
        serviceStatus: data.serviceStatus,
        serviceEffectiveDate: data.serviceEffectiveDate,
        serviceRemarks: data.serviceRemarks,
      };

      if (isAdding) {
        const res = await api.post<{ teacher: Teacher }>(`/teachers`, profilePayload);
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
          className="p-0 flex flex-col h-full border-l-0 overflow-hidden"
        >
          <SheetHeader className="bg-primary px-6 py-6 space-y-1 relative shrink-0">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-2xl bg-muted/10 flex items-center justify-center font-extrabold text-white text-2xl uppercase border-2 border-white/20 shadow-xl">
                {(formFirstName || teacher?.firstName || "N").charAt(0)}
                {(formLastName || teacher?.lastName || "N").charAt(0)}
              </div>
              <div className="space-y-0.5">
                <SheetTitle className="text-2xl font-extrabold text-white uppercase leading-none">
                  {isAdding
                    ? "New Faculty/Staff Profile"
                    : formatTeacherName({
                      ...teacher!,
                      firstName: formFirstName || teacher!.firstName,
                      lastName: formLastName || teacher!.lastName,
                      suffix: formSuffix ?? teacher!.suffix,
                    } as Teacher)}
                </SheetTitle>
                <SheetDescription className="text-white/80 font-extrabold uppercase text-base flex items-center gap-2">
                  <Fingerprint className="size-3" />
                  {isAdding ? "Create a new faculty or staff record" : `Employee ID: ${teacher?.employeeId || "not set"}`}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-6 bg-muted/10">

              {/* Card 1: Personal Information */}
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-primary" />
                    1. Personal Information
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-base font-extrabold uppercase text-foreground">First Name *</Label>
                      <Controller
                        name="firstName"
                        control={control}
                        render={({ field }) => (
                          <Input disabled={!isEditing}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            className={cn(
                              "font-extrabold text-base leading-tight bg-background text-foreground border-border h-10",
                              errors.firstName && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                        )}
                      />
                      <AnimatedError error={errors.firstName?.message as string || errors.firstName as unknown as string} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-base font-extrabold uppercase text-foreground">Last Name *</Label>
                      <Controller
                        name="lastName"
                        control={control}
                        render={({ field }) => (
                          <Input disabled={!isEditing}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            className={cn(
                              "font-extrabold text-base leading-tight bg-background text-foreground border-border h-10",
                              errors.lastName && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                        )}
                      />
                      <AnimatedError error={errors.lastName?.message as string || errors.lastName as unknown as string} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-base font-extrabold uppercase text-foreground">Middle Name <span className="text-foreground/50 font-extrabold ml-1">(optional)</span></Label>
                      <Controller
                        name="middleName"
                        control={control}
                        render={({ field }) => (
                          <Input disabled={!isEditing}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            className="font-extrabold text-base leading-tight bg-background text-foreground border-border h-10"
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-base font-extrabold uppercase text-foreground">Suffix <span className="text-foreground/50 font-extrabold ml-1">(e.g., JR., III)</span></Label>
                      <Controller
                        name="suffix"
                        control={control}
                        render={({ field }) => (
                          <Input disabled={!isEditing}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            placeholder="JR., III"
                            className="font-extrabold text-base leading-tight bg-background text-foreground border-border h-10"
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
                  </div>
                </div>
              </div>

              {/* Card 2: Employment Details */}
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    2. Employment Details
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
                          <Input disabled={!isEditing}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                            maxLength={7}
                            placeholder="7 digits"
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
                      <Label className="text-base font-extrabold uppercase text-foreground">DepEd Position (Plantilla)</Label>
                      <Controller
                        name="plantillaPosition"
                        control={control}
                        render={({ field }) => (
                          <>
                            {formRoles.includes("MRF") || designationPool.length === 0 ? (
                              <Input disabled={!isEditing}
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                placeholder="e.g. MASTER TEACHER II"
                                className="font-extrabold text-base leading-tight bg-background text-foreground border-border h-10"
                                readOnly={formRoles.includes("MRF")}
                              />
                            ) : (
                              <Select onValueChange={(v) => field.onChange(v === "__NONE__" ? "" : v)} value={field.value || "__NONE__"}>
                                <SelectTrigger disabled={!isEditing} className="font-extrabold text-base leading-tight h-10">
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  <SelectItem value="__NONE__">No position set yet</SelectItem>
                                  {designationPool.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </>
                        )}
                      />
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
                                <SelectValue placeholder="Select subject area" />
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

                  {formPersonnelType === "NON_TEACHING" && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="space-y-1.5">
                        <Label className="text-base font-extrabold uppercase text-foreground flex items-center gap-1">Office Assignment *</Label>
                        <Controller
                          name="functionalAssignment"
                          control={control}
                          render={({ field }) => (
                            <Input disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              placeholder="e.g. PROPERTY CUSTODIAN"
                              className={cn("font-extrabold text-base leading-tight h-10", errors.functionalAssignment && "border-destructive")}
                            />
                          )}
                        />
                        <AnimatedError error={errors.functionalAssignment?.message as string || errors.functionalAssignment as unknown as string} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-border mt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-extrabold uppercase text-foreground">
                          SF7 Profile
                        </p>
                        <p className="text-sm font-extrabold leading-tight text-foreground/60">
                          Used for School Form 7 personnel reporting.
                        </p>
                      </div>
                      <Badge variant="outline" className="font-extrabold uppercase">
                        School Form 7
                      </Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-base font-extrabold uppercase text-foreground">Undergraduate Degree</Label>
                        <Controller
                          name="undergraduateDegree"
                          control={control}
                          render={({ field }) => (
                            <Input disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              placeholder="e.g. BSED"
                              className="font-extrabold text-base leading-tight h-10"
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-base font-extrabold uppercase text-foreground">Postgraduate Degree</Label>
                        <Controller
                          name="postgraduateDegree"
                          control={control}
                          render={({ field }) => (
                            <Input disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              placeholder="e.g. MAED"
                              className="font-extrabold text-base leading-tight h-10"
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
                            <Input disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              placeholder="e.g. MATHEMATICS"
                              className="font-extrabold text-base leading-tight h-10"
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
                            <Input disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              placeholder="e.g. ENGLISH"
                              className="font-extrabold text-base leading-tight h-10"
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-base font-extrabold uppercase text-foreground">Nature of Appointment</Label>
                        <Controller
                          name="natureOfAppointment"
                          control={control}
                          render={({ field }) => (
                            <Select
                              onValueChange={(value) => field.onChange(value as TeacherNatureOfAppointment)}
                              value={field.value}
                            >
                              <SelectTrigger disabled={!isEditing} className="font-extrabold text-base leading-tight h-10">
                                <SelectValue placeholder="Select appointment" />
                              </SelectTrigger>
                              <SelectContent>
                                {TEACHER_NATURE_OF_APPOINTMENT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-base font-extrabold uppercase text-foreground">Fund Source</Label>
                        <Controller
                          name="fundingSource"
                          control={control}
                          render={({ field }) => (
                            <Select
                              onValueChange={(value) => field.onChange(value as TeacherFundingSource)}
                              value={field.value}
                            >
                              <SelectTrigger disabled={!isEditing} className="font-extrabold text-base leading-tight h-10">
                                <SelectValue placeholder="Select fund source" />
                              </SelectTrigger>
                              <SelectContent>
                                {TEACHER_FUNDING_SOURCE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-base font-extrabold uppercase text-foreground">IP Community / Ethnic Group</Label>
                        <Controller
                          name="indigenousCommunity"
                          control={control}
                          render={({ field }) => (
                            <Input disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              placeholder="Leave blank if not applicable"
                              className="font-extrabold text-base leading-tight h-10"
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-base font-extrabold uppercase text-foreground">Administrative Remarks</Label>
                        <Controller
                          name="administrativeRemarks"
                          control={control}
                          render={({ field }) => (
                            <Textarea disabled={!isEditing}
                              {...field}
                              value={field.value || ""}
                              placeholder="e.g. school ICT coordinator, guidance-designate, property custodian"
                              className="min-h-[80px] resize-none font-extrabold text-base leading-tight"
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {formPersonnelType === "TEACHING" && (
                    <div className="space-y-4 pt-4 border-t border-border mt-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-base font-extrabold uppercase text-foreground flex items-center gap-2">
                            <Clock className="size-4 text-primary" />
                            SF7 Teaching Schedule
                          </p>
                          <p className="text-sm font-extrabold leading-tight text-foreground/60">
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
                          <div className="rounded-lg border border-dashed p-4 text-sm font-extrabold text-foreground/60">
                            Loading SF7 schedule...
                          </div>
                        ) : schedulePeriods.length === 0 ? (
                          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm font-extrabold text-foreground/60">
                            No SF7 teaching periods encoded yet.
                          </div>
                        ) : (
                          schedulePeriods.map((period, index) => (
                            <div key={period.localId} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1.1fr_0.8fr_0.8fr_1.2fr_1.2fr_auto]">
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
                                <SelectTrigger disabled={!isEditing} className="h-10 font-extrabold">
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
                              <Input
                                disabled={!isEditing}
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
                              <Input
                                disabled={!isEditing}
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
                              <Input
                                disabled={!isEditing}
                                value={period.subjectLabel}
                                onChange={(event) => {
                                  const subjectLabel = event.target.value.toUpperCase();
                                  setSchedulePeriods((current) =>
                                    current.map((item, rowIndex) =>
                                      rowIndex === index ? { ...item, subjectLabel } : item,
                                    ),
                                  );
                                }}
                                placeholder="Subject"
                                className="h-10 font-extrabold"
                              />
                              <Input
                                disabled={!isEditing}
                                value={period.sectionLabel}
                                onChange={(event) => {
                                  const sectionLabel = event.target.value.toUpperCase();
                                  setSchedulePeriods((current) =>
                                    current.map((item, rowIndex) =>
                                      rowIndex === index ? { ...item, sectionLabel } : item,
                                    ),
                                  );
                                }}
                                placeholder="Section"
                                className="h-10 font-extrabold"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!isEditing}
                                onClick={() => {
                                  setSchedulePeriods((current) =>
                                    current.filter((_, rowIndex) => rowIndex !== index),
                                  );
                                }}
                                aria-label="Remove teaching period"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={!isEditing || scheduleLoading}
                        onClick={() => {
                          setSchedulePeriods((current) => [...current, createBlankSchedulePeriod()]);
                        }}
                        className="w-full font-extrabold uppercase"
                      >
                        <Plus className="mr-2 size-4" />
                        Add Teaching Period
                      </Button>
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
                              <SelectTrigger disabled={!isEditing} className="font-extrabold text-base leading-tight h-10">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
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
                        <Label className="text-base font-extrabold uppercase text-foreground">Notes for this status <span className="text-foreground/50 font-extrabold ml-1">(optional)</span></Label>
                        <Controller
                          name="serviceRemarks"
                          control={control}
                          render={({ field }) => (
                            <Textarea disabled={!isEditing}
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

              {/* Card 3: Contact Details & Portal Security */}
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    3. Contact Details & Portal Security
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-base font-extrabold uppercase text-foreground flex items-center gap-1">
                        <Smartphone className="size-3" />
                        Mobile Number
                      </Label>
                      <Controller
                        name="contactNumber"
                        control={control}
                        render={({ field }) => (
                          <Input disabled={!isEditing}
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                            maxLength={11}
                            placeholder="09XXXXXXXXX"
                            className={cn("font-extrabold text-base leading-tight h-10", errors.contactNumber && "border-destructive")}
                          />
                        )}
                      />
                      <AnimatedError error={errors.contactNumber?.message as string || errors.contactNumber as unknown as string} />
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-border">
                    <Label className="text-base font-extrabold uppercase text-foreground">
                      SYSTEM ROLES *
                    </Label>
                    <p className="text-sm font-extrabold leading-tight text-foreground/60">
                      Controls what this person can open in EnrollPro.
                    </p>
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
                            { value: "MRF", label: "MRF Staff" },
                          ] as const).map((roleOption) => (
                            <div key={roleOption.value} className="flex items-center space-x-2 bg-background p-2 rounded border border-border">
                              <Checkbox disabled={!isEditing}
                                id={`role-${roleOption.value}`}
                                checked={field.value.includes(roleOption.value)}
                                onCheckedChange={(checked) => {
                                  const newRoles = checked
                                    ? [...field.value, roleOption.value]
                                    : field.value.filter((r) => r !== roleOption.value);
                                  field.onChange(newRoles);
                                }}
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

                  {!isAdding && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <div className="space-y-2">
                        <Label className="text-base font-extrabold uppercase text-foreground">
                          Portal Access Status
                        </Label>
                        <p className="text-sm font-extrabold leading-tight text-foreground/60">
                          Toggle whether this teacher can sign in to the portal.
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
                          Password Control
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input disabled={!isEditing}
                            value={defaultPasswordInput}
                            onChange={(e) => setDefaultPasswordInput(e.target.value)}
                            placeholder="Enter default password"
                            className="h-11 font-extrabold text-base bg-background"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!isEditing || isPortalActionSubmitting || !defaultPasswordInput.trim()}
                            onClick={handleResetPassword}
                            className="w-full h-11 font-extrabold text-base uppercase border border-border hover:bg-muted/30 shrink-0 cursor-pointer"
                          >
                            Reset to Default Password
                          </Button>
                        </div>
                        <p className="text-sm font-extrabold leading-tight text-foreground/60">
                          This will reset the teacher's portal password to the value above and force a password change on next login.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Assignments for This School Year */}
              {!isAdding && isTeachingStaff && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 font-extrabold uppercase text-base leading-tight tracking-wide text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      4. Assignments for This School Year
                    </span>
                  </div>
                  <div className="divide-y">
                    <div className="p-4">
                      <div className="space-y-1">
                        <p className="text-base font-extrabold uppercase text-foreground leading-none">Advisory Class</p>
                        {teacher?.designation?.advisorySection ? (
                          <div className="space-y-0.5 pt-1">
                            <p className="font-extrabold text-base leading-tight text-slate-700">
                              {formatAdvisorySectionSummary(teacher.designation.advisorySection)} Adviser
                            </p>
                          </div>
                        ) : (
                          <p className="text-base leading-tight font-extrabold text-slate-400 italic pt-1">No advisory class assigned</p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-base font-extrabold uppercase text-foreground leading-none">Subject Teaching Load</p>
                        {loadLoading ? (
                          <div className="flex items-center gap-1.5 text-base font-extrabold text-primary animate-pulse">
                            <RefreshCw className="h-3 w-3 " />
                            Checking ATLAS...
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-base font-extrabold border-dashed border-primary/30 text-primary/60 bg-primary/5">
                            {loadError ? "Could Not Load Teaching Schedule" : "From ATLAS Schedule"}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        {loadLoading ? (
                          <div className="space-y-2">
                            <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
                          </div>
                        ) : teachingLoad.length > 0 ? (
                          <div className="grid gap-2">
                            {teachingLoad.map((load, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div className="space-y-0.5">
                                  <p className="text-base font-extrabold uppercase text-primary leading-none">{load.subjectName}</p>
                                  <p className="text-base font-extrabold text-foreground uppercase">{load.subjectCode}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-extrabold text-base uppercase text-foreground leading-none">{load.sectionName}</p>
                                  <p className="text-base font-extrabold text-foreground uppercase">{load.gradeLevel}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border-2 border-dashed bg-muted/30 flex flex-col items-center justify-center text-center">
                            <p className="text-base font-extrabold uppercase text-foreground mb-1">
                              {loadError ? "Could Not Load Teaching Schedule" : "No Teaching Load Found"}
                            </p>
                            <p className="text-base font-extrabold text-foreground/60 leading-tight max-w-[240px]">
                              {loadError
                                ? "Class schedule data is currently unavailable. Please ask the System Admin to check the ATLAS connection."
                                : "No teaching load found in ATLAS."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/10 text-center">
                      <p className="text-sm font-extrabold text-foreground/50 uppercase tracking-widest">
                        Record created {teacher?.createdAt ? new Date(teacher.createdAt).toLocaleDateString(undefined, { timeZone: 'Asia/Manila',  year: 'numeric', month: 'long', day: 'numeric' }) : "date not available"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 bg-background border-t flex gap-3 shrink-0">
              {!isEditing ? (
                <Button
                  type="button"
                  variant="default"
                  className="flex-1 font-extrabold uppercase transition-all duration-200"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsEditing(true);
                  }}
                >
                  Edit Profile
                </Button>
              ) : (
                <>
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
                      !(isDirty || scheduleDirty) ? "opacity-50 bg-gray-400 cursor-not-allowed text-white hover:bg-gray-400" : ""
                    )}
                    disabled={!(isDirty || scheduleDirty) || isSubmitting}
                  >
                    {isSubmitting ? (isAdding ? "Saving..." : "Updating...") : (isAdding ? "Save Faculty/Staff Record" : "Save Profile Changes")}
                  </Button>
                </>
              )}
            </div>
          </form>
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
