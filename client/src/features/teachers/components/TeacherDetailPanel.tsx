import { AnimatedError } from "@/shared/components/AnimatedError";
import { memo, useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/shared/lib/zodResolver";
import {
  Briefcase,
  GraduationCap,
  User as UserIcon,
  UserRoundPen,
  Smartphone,
  Mars,
  Venus,
  ShieldAlert,
  Key,
  Camera,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
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
import { MultiSearchableCombobox } from "@/shared/ui/multi-searchable-combobox";
import { UserPhoto } from "@/shared/components/UserPhoto";
import {
  cn,
} from "@/shared/lib/utils";
import type {
  Teacher,
  TeacherFundingSource,
  TeacherNatureOfAppointment,
} from "../types";
import { formatTeacherName } from "../utils";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import {
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  TEACHER_FUNDING_SOURCE_OPTIONS,
  TEACHER_NATURE_OF_APPOINTMENT_OPTIONS,
  getDesignationPool,
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS,
  DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS,
  TEACHER_UNDERGRADUATE_DEGREE_OPTIONS,
  TEACHER_UNDERGRADUATE_DEGREE_VALUES,
  DEPED_TEACHER_SPECIALIZATION_VALUES,
  DEPED_TEACHER_SPECIALIZATION_OPTIONS,
  TEACHER_POSTGRADUATE_DEGREE_OPTIONS,
  TEACHER_POSTGRADUATE_DEGREE_VALUES,
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

const TEMPORARY_APPOINTMENT_VALUES = new Set<TeacherNatureOfAppointment>([
  "SUBSTITUTE",
  "CONTRACTUAL",
  "LOCAL_SCHOOL_BOARD",
]);

const TEMPORARY_PLANTILLA_OPTIONS = [
  { value: "SUBSTITUTE TEACHER", label: "Substitute Teacher" },
  { value: "LGU HIRE", label: "LGU Hire" },
] as const;

function isTemporaryAppointment(
  value: TeacherNatureOfAppointment | null | undefined,
): boolean {
  return value ? TEMPORARY_APPOINTMENT_VALUES.has(value) : false;
}


const formSchema = z
  .object({
    firstName: z.string().min(1, "Please enter the name using only letters and spaces.").regex(/^[A-Za-z\s.-]+$/, "Please enter the name using only letters and spaces."),
    lastName: z.string().min(1, "Please enter the name using only letters and spaces.").regex(/^[A-Za-z\s.-]+$/, "Please enter the name using only letters and spaces."),
    middleName: z.string().optional().nullable(),
    suffix: z.string().optional().nullable(),
    sex: z.enum(["MALE", "FEMALE"], { message: "Please select a biological sex." }),
    birthdate: z.string()
      .min(1, "Please enter a valid date of birth. The personnel must be at least 18 years old.")
      .refine((dateStr) => {
        const bd = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - bd.getFullYear();
        const m = today.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) {
          age--;
        }
        return age >= 18;
      }, "Please enter a valid date of birth. The personnel must be at least 18 years old."),

    personnelType: z.enum(["TEACHING", "NON_TEACHING"]).nullable(),
    employeeId: z.string().trim().optional().nullable(),
    plantillaPosition: z.string().min(1, "Please select the official DepEd Plantilla position."),
    departments: z.array(z.string()).default([]),
    functionalAssignment: z.string().optional().nullable(),
    specialization: z.enum(DEPED_TEACHER_SPECIALIZATION_VALUES as unknown as [string, ...string[]], { message: "Invalid option: expected a valid specialization." }).optional().nullable().or(z.literal("")),
    undergraduateDegree: z.enum(TEACHER_UNDERGRADUATE_DEGREE_VALUES as unknown as [string, ...string[]], { message: "Invalid option: expected a valid undergraduate degree." }).optional().nullable().or(z.literal("")),
    bachelorMajor: z.string().optional().nullable(),
    bachelorMajorCustom: z.string().optional().nullable(),
    bachelorMinor: z.string().optional().nullable(),
    bachelorMinorCustom: z.string().optional().nullable(),
    postgraduateDegrees: z.array(z.object({
      degree: z.enum(TEACHER_POSTGRADUATE_DEGREE_VALUES as unknown as [string, ...string[]], { message: "Invalid option: expected a valid postgraduate degree." }),
      major: z.string().optional().nullable(),
      majorCustom: z.string().optional().nullable(),
      minor: z.string().optional().nullable(),
      minorCustom: z.string().optional().nullable(),
    })).superRefine((data, ctx) => {
      data.forEach((item, index) => {
        if ((item.major?.trim() || item.minor?.trim()) && (!item.degree || item.degree.trim() === "")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select a postgraduate degree if you have provided a major or minor.",
            path: [index, "degree"],
          });
        }
      });
    }),
    indigenousCommunity: z.enum(IP_COMMUNITY_VALUES as unknown as [string, ...string[]], { message: "Please select a valid group from the dropdown list, or choose 'NOT APPLICABLE'." }).optional().nullable().default("NOT APPLICABLE"),
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
    ancillaryRoles: z.array(z.string()).default([]),
    atlasAssignTeachingLoad: z.boolean().default(false),
    atlasBuildSchedules: z.boolean().default(false),
    roles: z.array(z.string()).min(1, "Please select at least one system role for this personnel."),

    contactNumber: z
      .string()
      .trim()
      .regex(/^09\d{9}$/, "Please enter a valid 11-digit mobile number starting with 09 (e.g., 09123456789)."),

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
    accessExpirationDate: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const isMRF = data.roles.includes("MRF");
    const isTeacherRole = data.roles.includes("TEACHER") || data.roles.includes("CLASS_ADVISER");
    const shouldRequireSF7 = !(isMRF && !isTeacherRole);
    const isTemporary = isTemporaryAppointment(data.natureOfAppointment);

    if (!isTemporary && !data.employeeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid 7-digit DepEd Employee ID.",
        path: ["employeeId"],
      });
    }

    if (data.employeeId && !/^\d{7}$/.test(data.employeeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid 7-digit DepEd Employee ID.",
        path: ["employeeId"],
      });
    }

    if (isTemporary && !data.accessExpirationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select the contract end date.",
        path: ["accessExpirationDate"],
      });
    }

    if (data.undergraduateDegree) {
      if (!data.bachelorMajor || data.bachelorMajor.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify the major or specialization.",
          path: ["bachelorMajor"],
        });
      } else if (data.bachelorMajor === "OTHER" && (!data.bachelorMajorCustom || data.bachelorMajorCustom.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify your custom major.",
          path: ["bachelorMajorCustom"],
        });
      }
    }

    if (data.bachelorMinor === "OTHER" && (!data.bachelorMinorCustom || data.bachelorMinorCustom.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify your custom minor.",
        path: ["bachelorMinorCustom"],
      });
    }

    data.postgraduateDegrees?.forEach((pg, index) => {
      if (pg.major === "OTHER" && (!pg.majorCustom || pg.majorCustom.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify your custom major.",
          path: ["postgraduateDegrees", index, "majorCustom"],
        });
      }
      if (pg.minor === "OTHER" && (!pg.minorCustom || pg.minorCustom.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify your custom minor.",
          path: ["postgraduateDegrees", index, "minorCustom"],
        });
      }
    });

    if (shouldRequireSF7) {
      if (!data.undergraduateDegree || data.undergraduateDegree.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select a bachelor's degree.",
          path: ["undergraduateDegree"],
        });
      }

      if (!data.natureOfAppointment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select the nature of appointment.",
          path: ["natureOfAppointment"],
        });
      }
      if (!data.fundingSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select the fund source.",
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

function formatManilaDateInput(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const apiError = error as ApiErrorResponse;
  return apiError.response?.data?.message ?? fallback;
}



export const TeacherDetailPanel = memo(function TeacherDetailPanel({
  teacher,
  open,
  onOpenChange,
  onSaveSuccess,
}: TeacherDetailPanelProps) {
  const { panelPercentage, isDesktopViewport, startResizing, startResizingRight } = useResizablePanel(75, {
    centered: true,
    storageKey: "teacher-detail-modal",
  });
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const _isTeachingStaff = useMemo(() => {
    return teacher?.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
  }, [teacher]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [isPortalActionSubmitting, setIsPortalActionSubmitting] = useState(false);
  const [defaultPasswordInput, setDefaultPasswordInput] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const globalDefaultPassword = useSettingsStore((s) => s.globalDefaultPassword);
  const activeSchoolYearLabel = useSettingsStore((s) => s.activeSchoolYearLabel);

  useEffect(() => {
    let pwd = globalDefaultPassword || "DepEd2026!";
    if (activeSchoolYearLabel) {
      const year = activeSchoolYearLabel.split("-")[0];
      if (year) {
        pwd = `DepEd${year}!`;
      }
    }
    setDefaultPasswordInput(pwd);
  }, [globalDefaultPassword, activeSchoolYearLabel]);

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
    trigger,
    formState: { isDirty, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      middleName: "",
      suffix: "",
      sex: undefined as unknown as FormValues["sex"],
      birthdate: "",
      personnelType: null,
      employeeId: null,
      plantillaPosition: "",
      departments: [],
      functionalAssignment: "",
      specialization: "",
      undergraduateDegree: "",
      bachelorMajor: "",
      bachelorMajorCustom: "",
      bachelorMinor: "",
      bachelorMinorCustom: "",
      postgraduateDegrees: [{ degree: "", major: "", majorCustom: "", minor: "", minorCustom: "" }],
      indigenousCommunity: "NOT APPLICABLE",
      natureOfAppointment: "REGULAR_PERMANENT",
      fundingSource: "NATIONAL",
      roles: [],
      ancillaryRoles: [],
      atlasAssignTeachingLoad: false,
      atlasBuildSchedules: false,
      contactNumber: "",
      serviceStatus: "ACTIVE",
      serviceEffectiveDate: new Date().toISOString().slice(0, 10),
      serviceRemarks: "",
      portalActive: true,
      accessExpirationDate: null,
    },
  });

  const { fields: postgraduateFields, append: appendPostgraduateDegree, remove: removePostgraduateDegree } = useFieldArray({
    control,
    name: "postgraduateDegrees",
  });

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedPhoto]);

  const formRoles = watch("roles");
  const formPersonnelType = watch("personnelType");

  const isFormTeachingStaff = useMemo(() => {
    return formRoles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
  }, [formRoles]);

  useEffect(() => {
    setValue("personnelType", isFormTeachingStaff ? "TEACHING" : "NON_TEACHING", { shouldValidate: true });
    if (!isFormTeachingStaff) {
      setValue("departments", []);
    }
  }, [isFormTeachingStaff, setValue]);

  const formPlantillaPosition = watch("plantillaPosition");
  const formNatureOfAppointment = watch("natureOfAppointment");
  const isTemporaryPersonnel = isTemporaryAppointment(formNatureOfAppointment);
  const formAccessExpirationDate = watch("accessExpirationDate");
  const formServiceStatus = watch("serviceStatus");
  const formFirstName = watch("firstName");
  const formLastName = watch("lastName");
  const formSuffix = watch("suffix");

  useEffect(() => {
    if (teacher) {
      const isTeacherOrAdviser = teacher.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
      const _isMRF = teacher.userAccount?.roles?.includes("MRF") ?? false;
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
        birthdate: teacher.birthdate ? new Date(teacher.birthdate).toISOString().slice(0, 10) : "",
        personnelType: toPersonnelType(teacher.personnelType),
        employeeId: teacher.employeeId || null,
        plantillaPosition: teacher.plantillaPosition === "MRF Coordinator" ? "" : (teacher.plantillaPosition || ""),
        departments: !isTeacherOrAdviser ? [] : (teacher.departments || []),
        functionalAssignment: teacher.functionalAssignment || "",
        specialization: (teacher.specialization === "NONE" ? "" : teacher.specialization) || "",
        undergraduateDegree: (teacher.undergraduateDegree === "NONE" ? "" : teacher.undergraduateDegree) || "",
        bachelorMajor: (() => {
          const val = (teacher.bachelorMajor === "NONE" ? "" : teacher.bachelorMajor) || "";
          return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? "OTHER" : val;
        })(),
        bachelorMajorCustom: (() => {
          const val = (teacher.bachelorMajor === "NONE" ? "" : teacher.bachelorMajor) || "";
          return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? val : "";
        })(),
        bachelorMinor: (() => {
          const val = (teacher.bachelorMinor === "NONE" ? "" : teacher.bachelorMinor) || "";
          return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? "OTHER" : val;
        })(),
        bachelorMinorCustom: (() => {
          const val = (teacher.bachelorMinor === "NONE" ? "" : teacher.bachelorMinor) || "";
          return val && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(val as any) ? val : "";
        })(),
        postgraduateDegrees: teacher.postgraduateDegrees?.length
          ? teacher.postgraduateDegrees.map((entry) => ({
            degree: entry.degree === "NONE" ? "" : entry.degree,
            major: entry.major && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.major as any) ? "OTHER" : (entry.major || ""),
            majorCustom: entry.major && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.major as any) ? entry.major : "",
            minor: entry.minor && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.minor as any) ? "OTHER" : (entry.minor || ""),
            minorCustom: entry.minor && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(entry.minor as any) ? entry.minor : "",
          }))
          : [{
            degree: (teacher.postgraduateDegree === "NONE" ? "" : teacher.postgraduateDegree) || "",
            major: teacher.majorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.majorSpecialization as any) ? "OTHER" : (teacher.majorSpecialization || ""),
            majorCustom: teacher.majorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.majorSpecialization as any) ? teacher.majorSpecialization : "",
            minor: teacher.minorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.minorSpecialization as any) ? "OTHER" : (teacher.minorSpecialization || ""),
            minorCustom: teacher.minorSpecialization && !DEPED_TEACHER_SPECIALIZATION_VALUES.includes(teacher.minorSpecialization as any) ? teacher.minorSpecialization : "",
          }],
        indigenousCommunity: (teacher.indigenousCommunity as unknown as FormValues['indigenousCommunity']) || "NOT APPLICABLE",
        natureOfAppointment: teacher.natureOfAppointment || "REGULAR_PERMANENT",
        fundingSource: teacher.fundingSource || "NATIONAL",
        roles: teacher.userAccount?.roles || [],
        ancillaryRoles: teacher.designation?.ancillaryRoles || teacher.ancillaryRoles || [],
        atlasAssignTeachingLoad: teacher.designation?.atlasAssignTeachingLoad ?? false,
        atlasBuildSchedules: teacher.designation?.atlasBuildSchedules ?? false,
        contactNumber: teacher.contactNumber || "",
        serviceStatus: teacher.serviceStatus || "ACTIVE",
        serviceEffectiveDate: formatDateInput(serviceMetadata.serviceEffectiveDate),
        serviceRemarks: serviceMetadata.serviceRemarks || "",
        portalActive: teacher.userAccount?.isActive ?? teacher.isActive ?? true,
        accessExpirationDate: teacher.userAccount?.accessExpirationDate
          ? formatManilaDateInput(teacher.userAccount.accessExpirationDate)
          : null,
      });
    } else {
      reset({
        firstName: "",
        lastName: "",
        middleName: "",
        suffix: "",
        sex: undefined as unknown as FormValues["sex"],
        birthdate: "",
        personnelType: null,
        employeeId: null,
        plantillaPosition: "",
        departments: [],
        functionalAssignment: "",
        specialization: "",
        undergraduateDegree: "",
        bachelorMajor: "",
        bachelorMajorCustom: "",
        bachelorMinor: "",
        bachelorMinorCustom: "",
        postgraduateDegrees: [{ degree: "", major: "", majorCustom: "", minor: "", minorCustom: "" }],
        indigenousCommunity: "NOT APPLICABLE",
        natureOfAppointment: "REGULAR_PERMANENT",
        fundingSource: "NATIONAL",
        roles: [],
        ancillaryRoles: [],
        atlasAssignTeachingLoad: false,
        atlasBuildSchedules: false,
        contactNumber: "",
        serviceStatus: "ACTIVE",
        serviceEffectiveDate: new Date().toISOString().slice(0, 10),
        serviceRemarks: "",
        portalActive: true,
        accessExpirationDate: null,
      });
    }
    setSelectedPhoto(null);
    setRemoveExistingPhoto(false);
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

  const plantillaOptions = useMemo(() => {
    const baseOptions = designationPool.length > 0
      ? designationPool.map((option) => ({ value: option, label: option }))
      : [...DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS];
    const options = new Map(baseOptions.map((option) => [option.value, option]));
    TEMPORARY_PLANTILLA_OPTIONS.forEach((option) => options.set(option.value, option));
    return Array.from(options.values());
  }, [designationPool]);

  useEffect(() => {
    if (
      formPlantillaPosition &&
      designationPool.length > 0 &&
      !designationPool.includes(formPlantillaPosition) &&
      !TEMPORARY_PLANTILLA_OPTIONS.some((option) => option.value === formPlantillaPosition)
    ) {
      setValue("plantillaPosition", "", { shouldDirty: true });
    }
  }, [formRoles, formPlantillaPosition, designationPool, setValue]);

  useEffect(() => {
    if (!isTemporaryPersonnel && formAccessExpirationDate) {
      setValue("accessExpirationDate", null, { shouldDirty: true, shouldValidate: true });
    }
  }, [formAccessExpirationDate, isTemporaryPersonnel, setValue]);

  const discardProfileChanges = useCallback(() => {
    reset();
  }, [reset]);

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

  const hasUnsavedChanges = isDirty || selectedPhoto !== null || removeExistingPhoto;

  useUnsavedChanges({
    id: "teacher-detail-panel",
    label: "Faculty/Staff profile",
    isDirty: open && hasUnsavedChanges,
    isSubmitting,
    onDiscard: discardProfileChanges,
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const postgraduateDegrees = data.postgraduateDegrees
        .filter((entry) => entry.degree.trim().length > 0)
        .map((entry) => ({
          degree: entry.degree,
          major: (entry.major === "OTHER" ? entry.majorCustom?.trim() : entry.major?.trim()) || null,
          minor: (entry.minor === "OTHER" ? entry.minorCustom?.trim() : entry.minor?.trim()) || null,
        }));
      const primaryPostgraduateDegree = postgraduateDegrees[0];
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
        departments: data.departments,
        functionalAssignment: data.personnelType === "NON_TEACHING" ? data.functionalAssignment : null,
        specialization: data.specialization || "",
        undergraduateDegree: data.undergraduateDegree || "",
        bachelorMajor: (data.bachelorMajor === "OTHER" ? data.bachelorMajorCustom?.trim() : data.bachelorMajor?.trim()) || null,
        bachelorMinor: (data.bachelorMinor === "OTHER" ? data.bachelorMinorCustom?.trim() : data.bachelorMinor?.trim()) || null,
        postgraduateDegrees,
        postgraduateDegree: primaryPostgraduateDegree?.degree || "",
        majorSpecialization: primaryPostgraduateDegree?.major || "",
        minorSpecialization: primaryPostgraduateDegree?.minor || "",
        indigenousCommunity: data.indigenousCommunity,
        natureOfAppointment: data.natureOfAppointment,
        fundingSource: data.fundingSource,
        roles: data.roles,
        ancillaryRoles: data.ancillaryRoles,
        atlasAssignTeachingLoad: data.atlasAssignTeachingLoad,
        atlasBuildSchedules: data.atlasBuildSchedules,
        contactNumber: data.contactNumber,
        serviceStatus: data.serviceStatus,
        serviceEffectiveDate: data.serviceEffectiveDate,
        serviceRemarks: data.serviceRemarks,
        accessExpirationDate: isTemporaryAppointment(data.natureOfAppointment)
          ? data.accessExpirationDate
          : null,
      };

      let savedTeacherId: number;

      if (isAdding) {
        const createPayload = {
          ...profilePayload,
          password: defaultPasswordInput || undefined,
          portalActive: data.portalActive !== undefined ? data.portalActive : true,
        };
        const response = await api.post<{ teacher: Teacher }>(`/teachers`, createPayload);
        savedTeacherId = response.data.teacher.id;
        sileo.success({ title: "Faculty/Staff Record Created", description: "The faculty or staff record has been saved." });
      } else {
        savedTeacherId = teacher!.id;
        await api.patch(`/teachers/${savedTeacherId}`, profilePayload);

        const originalPortalActive = teacher!.userAccount?.isActive ?? teacher!.isActive ?? true;
        if (data.portalActive !== undefined && data.portalActive !== originalPortalActive) {
          try {
            await api.patch(`/teachers/${teacher!.id}/portal-access`, { isActive: data.portalActive });
          } catch (err: unknown) {
            sileo.error({ title: "Portal Update Failed", description: getApiErrorMessage(err, "Profile saved, but portal status failed to update.") });
          }
        }

        sileo.success({ title: "Profile Updated", description: "The personnel profile has been saved." });
      }

      if (selectedPhoto) {
        const photoData = new FormData();
        photoData.append("photo", selectedPhoto);
        await api.post(`/teachers/${savedTeacherId}/photo`, photoData);
      } else if (removeExistingPhoto && teacher?.photoPath) {
        await api.delete(`/teachers/${savedTeacherId}/photo`);
      }

      if (onSaveSuccess) onSaveSuccess();
      setSelectedPhoto(null);
      setRemoveExistingPhoto(false);
      reset(data);
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

  const scrollToFirstError = () => {
    setTimeout(() => {
      // Look for elements commonly indicating an error
      const errorElement = document.querySelector(
        '[aria-invalid="true"], .border-destructive, .animated-error'
      ) as HTMLElement;

      if (errorElement) {
        if (
          errorElement.tagName === "INPUT" ||
          errorElement.tagName === "SELECT" ||
          errorElement.tagName === "TEXTAREA" ||
          errorElement.tagName === "BUTTON"
        ) {
          errorElement.focus({ preventScroll: true });
        }
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
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
      <div className="p-3 text-foreground bg-muted/30 capitalize font-extrabold">{label}</div>
      <div className="p-3 uppercase">{value || "—"}</div>
    </div>
  );

  const portalIsActive = teacher?.userAccount?.isActive ?? teacher?.isActive ?? true;

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseAttempt}>
        <DialogContent
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (hasUnsavedChanges) {
              e.preventDefault();
              confirmOrRun(closePanel);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasUnsavedChanges) {
              e.preventDefault();
              confirmOrRun(closePanel);
            }
          }}
          className="p-0 flex flex-col h-[90vh] md:h-[95vh] border overflow-visible w-full sm:w-auto sm:max-w-none max-w-[95vw]"
          style={
            isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
          }
        >
          {/* Left Resize Handle */}
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group rounded-l-md">
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          {/* Right Resize Handle */}
          <div
            onMouseDown={startResizingRight}
            className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group rounded-r-md">
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden bg-background rounded-md">
            {/* ─── Header ─── */}
            <DialogHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-bold text-left space-y-0 mt-0">
              <div>
                <DialogTitle className="text-base sm:text-lg text-primary-foreground font-bold uppercase flex items-center gap-2">
                  {isAdding ? "New Personnel Profile" : "Personnel Profile"}
                </DialogTitle>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit, scrollToFirstError)} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-bold">

                {/* ════════════════════════════════════════════════════════════ */}
                {/* SUMMARY BLOCK (Matches StudentDetailPanel)                 */}
                {/* ════════════════════════════════════════════════════════════ */}
                {!isAdding && (
                  <div className="bg-[hsl(var(--muted))] p-4 sm:p-6 rounded-md border">
                    {/* Top Row: Identity & Actions */}
                    <div className="flex justify-between items-start">
                      {/* Left Side: Media Object */}
                      <div className="flex items-start gap-4 sm:gap-6">
                        <UserPhoto
                          photo={teacher?.photoPath}
                          containerClassName="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-primary border-dashed shadow-md shrink-0"
                          className="w-full h-full object-cover rounded-full"
                          fallbackIcon={
                            <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl uppercase bg-primary">
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
                        <div className="flex flex-col mt-1">
                          <h3 className="text-2xl font-extrabold text-foreground leading-tight uppercase break-words">
                            {isAdding ? "New Personnel" : formatTeacherName({
                              ...teacher!,
                              firstName: formFirstName || teacher?.firstName || "",
                              lastName: formLastName || teacher?.lastName || "",
                              suffix: formSuffix ?? teacher?.suffix ?? null,
                            } as Teacher)}
                          </h3>
                          {!isAdding && (
                            <p className="font-bold uppercase mb-2 text-lg">
                              Employee ID: {teacher?.employeeId || "—"}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {!isAdding && (
                              (teacher?.userAccount?.roles || []).length > 0
                                ? (teacher?.userAccount?.roles || []).map((role) => (
                                  <Badge key={role} className="bg-primary text-primary-foreground rounded-full uppercase shadow-sm px-3 py-0.5 text-sm font-bold border-0">
                                    {ROLE_LABEL_MAP[role] || role}
                                  </Badge>
                                ))
                                : <Badge variant="outline" className="gap-1 px-3 py-1 rounded-full uppercase shadow-sm font-bold text-muted-foreground border-0">No roles</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Action Button */}
                      {!isEditing && !isAdding && (
                        <div className="shrink-0 ml-4 hidden sm:flex flex-col gap-2">
                          <Button
                            variant="outline"
                            className="font-bold text-sm h-9 px-4 uppercase border-primary text-primary hover:bg-primary hover:text-primary-foreground shadow-sm rounded-md transition-all active:scale-[0.98] w-full justify-start"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsEditing(true);
                            }}
                          >
                            <UserRoundPen className="mr-2 h-4 w-4 shrink-0" />
                            Edit Profile
                          </Button>
                          <Button
                            variant="outline"
                            className="font-bold text-sm h-9 px-4 uppercase border-muted-foreground text-muted-foreground hover:bg-muted/50 hover:text-foreground shadow-sm rounded-md transition-all active:scale-[0.98] w-full justify-start"
                            onClick={(e) => {
                              e.preventDefault();
                              handleResetPassword();
                            }}
                          >
                            <Key className="mr-2 h-4 w-4 shrink-0" />
                            Reset Password
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Mobile Edit Button */}
                    {!isEditing && !isAdding && (
                      <div className="mt-4 sm:hidden flex flex-col gap-2 w-full">
                        <Button
                          variant="outline"
                          className="font-bold text-sm h-9 px-4 uppercase border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm rounded-md transition-all active:scale-[0.98] w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsEditing(true);
                          }}
                        >
                          <UserRoundPen className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
                          Edit Profile
                        </Button>
                        <Button
                          variant="outline"
                          className="font-bold text-sm h-9 px-4 uppercase border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm rounded-md transition-all active:scale-[0.98] w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            handleResetPassword();
                          }}
                        >
                          <Key className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
                          Reset Password
                        </Button>
                      </div>
                    )}

                    {!isAdding && (
                      <div className="mt-6 mb-4">
                        <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                          <div className="text-base leading-tight font-bold divide-y divide-border">
                            {/* Header Row */}
                            <div className="grid grid-cols-2 divide-x divide-border">
                              <div className="p-3 text-foreground bg-muted/30 font-extrabold text-center capitalize">
                                Position
                              </div>
                              <div className="p-3 text-foreground bg-muted/30 font-extrabold text-center capitalize">
                                Contact Number
                              </div>
                            </div>
                            {/* Value Row */}
                            <div className="grid grid-cols-2 divide-x divide-border">
                              <div className="p-3 flex items-center justify-center uppercase min-w-0">
                                <span className="text-base font-bold text-foreground text-center">
                                  {teacher?.plantillaPosition || "—"}
                                </span>
                              </div>
                              <div className="p-3 flex items-center justify-center uppercase min-w-0">
                                <span className="text-base font-bold text-foreground leading-tight uppercase tabular-nums text-center">
                                  {teacher?.contactNumber || "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════════ */}
                {/* VIEW MODE — read-only grid tables                          */}
                {/* ════════════════════════════════════════════════════════════ */}
                {!isEditing && !isAdding && teacher && (
                  <>

                    {/* Personal Information */}
                    <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2 uppercase">
                        <UserIcon className="h-4 w-4 text-primary" />
                        Personal Information
                      </div>
                      <div className="text-base leading-tight font-bold divide-y divide-border">
                        <ViewRow label="First Name" value={teacher.firstName} />
                        <ViewRow label="Middle Name" value={teacher.middleName} />
                        <ViewRow label="Last Name" value={teacher.lastName} />
                        {!!teacher.suffix?.trim() && (
                          <ViewRow label="Suffix" value={teacher.suffix} />
                        )}
                        <ViewRow label="Sex" value={teacher.sex} />
                        <ViewRow label="Date of Birth" value={teacher.birthdate ? new Date(teacher.birthdate).toLocaleDateString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }) : null} />
                        <ViewRow label="Mobile No." value={teacher.contactNumber} />
                        {teacher.indigenousCommunity && teacher.indigenousCommunity !== "NOT_APPLICABLE" && teacher.indigenousCommunity !== "NOT APPLICABLE" && (
                          <ViewRow label="IP Community" value={teacher.indigenousCommunity} />
                        )}
                      </div>
                    </div>

                    {/* Employment Details */}
                    <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2 uppercase">
                        <Briefcase className="h-4 w-4 text-primary" />
                        Employment Details
                      </div>
                      <div className="text-base leading-tight font-bold divide-y divide-border">
                        <ViewRow label="Personnel Type" value={teacher.personnelType === "TEACHING" ? "Teaching" : teacher.personnelType === "NON_TEACHING" ? "Non-Teaching" : "—"} />
                        <ViewRow label="Position" value={teacher.plantillaPosition} />
                        {teacher.personnelType === "TEACHING" && (
                          <ViewRow label="Subject Area" value={(teacher.departments || []).map(d => DEPED_TEACHER_DEPARTMENT_OPTIONS.find(opt => opt.value === d)?.label || d).join(", ")} />
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
                        <ViewRow label="Ancillary Roles" value={teacher.designation?.ancillaryRoles?.length ? teacher.designation.ancillaryRoles.join(', ') : "—"} />
                      </div>
                    </div>

                    {/* ATLAS Configuration */}
                    <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center justify-between uppercase">
                        <span className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-primary" />
                          ATLAS Access Options
                        </span>
                      </div>
                      <div className="text-base leading-tight font-bold divide-y divide-border">
                        <ViewRow label="Assign Teaching Load" value={teacher.designation?.atlasAssignTeachingLoad ? "Yes" : "No"} />
                        <ViewRow label="Build Schedules" value={teacher.designation?.atlasBuildSchedules ? "Yes" : "No"} />
                      </div>
                    </div>

                    {/* SF7 Profile */}
                    {showSF7 && (
                      <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                        <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center justify-between uppercase">
                          <span className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            SF7 Profile
                          </span>
                          <Badge variant="outline" className="font-bold uppercase">School Form 7</Badge>
                        </div>
                        <div className="text-base leading-tight font-bold divide-y divide-border">
                          <ViewRow label="Bachelor Degree" value={teacher.undergraduateDegree} />
                          <ViewRow label="Bachelor Major" value={teacher.bachelorMajor} />
                          <ViewRow label="Bachelor Minor" value={teacher.bachelorMinor} />
                          <ViewRow
                            label="Postgrad"
                            value={teacher.postgraduateDegrees?.length
                              ? teacher.postgraduateDegrees.map((entry) => entry.degree).join(" / ")
                              : teacher.postgraduateDegree}
                          />
                          <ViewRow
                            label="Major"
                            value={teacher.postgraduateDegrees?.length
                              ? teacher.postgraduateDegrees.map((entry) => entry.major).filter(Boolean).join(" / ")
                              : teacher.majorSpecialization}
                          />
                          <ViewRow
                            label="Minor"
                            value={teacher.postgraduateDegrees?.length
                              ? teacher.postgraduateDegrees.map((entry) => entry.minor).filter(Boolean).join(" / ")
                              : teacher.minorSpecialization}
                          />
                        </div>
                      </div>
                    )}



                    {/* Service Status */}
                    <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2 uppercase">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        Service Status
                      </div>
                      <div className="text-base leading-tight font-bold divide-y divide-border">
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
                      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2 uppercase">
                        <Smartphone className="h-4 w-4 text-primary" />
                        Portal Access and Security
                      </div>
                      <div className="text-base leading-tight font-bold divide-y divide-border">
                        <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
                          <div className="p-3 text-foreground bg-muted/30 capitalize font-extrabold">Portal</div>
                          <div className="p-3 uppercase flex items-center gap-2">
                            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", portalIsActive ? "bg-emerald-500" : "bg-amber-500")} />
                            {portalIsActive ? "Active — Login Allowed" : "Disabled — Login Blocked"}
                          </div>
                        </div>
                        <ViewRow label="Last Login" value={teacher.userAccount?.lastLoginAt ? new Date(teacher.userAccount.lastLoginAt).toLocaleDateString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"} />
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-muted/10 text-center rounded-xl">
                      <p className="text-sm font-bold text-foreground uppercase tracking-widest">
                        Record created {teacher.createdAt ? new Date(teacher.createdAt).toLocaleString(undefined, { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "date not available"}
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
                          <Label className="text-base font-bold uppercase text-foreground">
                            SYSTEM ROLES <span className="text-destructive">*</span>
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
                                        let newRoles = isChecked
                                          ? [...field.value, roleOption.value]
                                          : field.value.filter((r) => r !== roleOption.value);

                                        if (isChecked && roleOption.value === "CLASS_ADVISER" && !newRoles.includes("TEACHER")) {
                                          newRoles.push("TEACHER");
                                        }

                                        if (!isChecked && roleOption.value === "TEACHER") {
                                          newRoles = newRoles.filter(r => r !== "CLASS_ADVISER");
                                        }

                                        field.onChange(newRoles);
                                      }}
                                      className="cursor-pointer"
                                    />
                                    <Label htmlFor={`role-${roleOption.value}`} className="text-base font-bold uppercase cursor-pointer flex-1">
                                      {roleOption.label}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:items-start w-full">
                          <div className="flex flex-col items-center space-y-2 pl-2 md:col-span-1">
                            <Label className="whitespace-nowrap text-base font-bold leading-tight text-foreground uppercase">
                              Personnel Photo
                            </Label>
                            <div className="group relative h-[150px] w-[130px]">
                              <UserPhoto
                                photo={photoPreviewUrl ?? (removeExistingPhoto ? null : teacher?.photoPath)}
                                containerClassName={cn(
                                  "h-[150px] w-[130px] rounded-lg border-2 border-dashed transition-all duration-200",
                                  photoPreviewUrl || (!removeExistingPhoto && teacher?.photoPath)
                                    ? "border-primary/50 bg-background"
                                    : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80",
                                )}
                                className="h-full w-full object-cover"
                                fallbackIcon={
                                  <div className="flex h-full w-full flex-col items-center justify-center text-foreground transition-colors group-hover:text-primary">
                                    <Camera className="mb-1 h-8 w-8" />
                                    <span className="text-center text-[0.625rem] font-bold uppercase leading-tight">
                                      Upload<br />Photo
                                    </span>
                                  </div>
                                }
                              >
                                {isEditing && (selectedPhoto || (!removeExistingPhoto && teacher?.photoPath)) && (
                                  <button
                                    type="button"
                                    className="absolute right-1 top-1 z-20 rounded-full bg-primary p-1 text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setSelectedPhoto(null);
                                      setRemoveExistingPhoto(true);
                                    }}
                                    aria-label="Remove personnel photo"
                                  >
                                    <X className="h-3 w-3" strokeWidth={3} />
                                  </button>
                                )}
                              </UserPhoto>
                              <input
                                ref={photoInputRef}
                                type="file"
                                disabled={!isEditing}
                                accept="image/jpeg,image/png,image/jpg"
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                title="Upload personnel photo"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  event.target.value = "";
                                  if (!file) return;
                                  if (file.size > 5 * 1024 * 1024) {
                                    sileo.error({ title: "Photo Too Large", description: "The photo must be smaller than 5 MB." });
                                    return;
                                  }
                                  if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
                                    sileo.error({ title: "Unsupported Photo", description: "Only JPG and PNG photos are accepted." });
                                    return;
                                  }
                                  setSelectedPhoto(file);
                                  setRemoveExistingPhoto(false);
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-4 md:col-span-2">
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">First Name <span className="text-destructive">*</span></Label>
                              <Controller
                                name="firstName"
                                control={control}
                                render={({ field }) => (
                                  <Input autoComplete="off" disabled={!isEditing}
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                    placeholder="e.g. JUAN"
                                    className={cn(
                                      "font-bold text-base leading-tight bg-background text-foreground border-border h-10 uppercase",
                                      errors.firstName && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                )}
                              />
                              <AnimatedError error={errors.firstName?.message as string || errors.firstName as unknown as string} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Last Name <span className="text-destructive">*</span></Label>
                              <Controller
                                name="lastName"
                                control={control}
                                render={({ field }) => (
                                  <Input autoComplete="off" disabled={!isEditing}
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                    placeholder="e.g. DELA CRUZ"
                                    className={cn(
                                      "font-bold text-base leading-tight bg-background text-foreground border-border h-10 uppercase",
                                      errors.lastName && "border-destructive focus-visible:ring-destructive"
                                    )}
                                  />
                                )}
                              />
                              <AnimatedError error={errors.lastName?.message as string || errors.lastName as unknown as string} />
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 md:col-span-2">
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Middle Name <span className="text-foreground font-bold ml-1">(optional)</span></Label>
                              <Controller
                                name="middleName"
                                control={control}
                                render={({ field }) => (
                                  <Input autoComplete="off" disabled={!isEditing}
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                    placeholder="e.g. SANTOS"
                                    className="font-bold text-base leading-tight bg-background text-foreground border-border h-10 uppercase"
                                  />
                                )}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Suffix <span className="text-foreground font-bold ml-1">(e.g., JR., III)</span></Label>
                              <Controller
                                name="suffix"
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    disabled={!isEditing}
                                    value={field.value || "NONE"}
                                    onValueChange={(val) => field.onChange(val === "NONE" ? "" : val)}
                                  >
                                    <SelectTrigger className={cn("font-bold text-base leading-tight bg-background text-foreground border-border h-10 uppercase", !field.value && "text-muted-foreground")}>
                                      <SelectValue placeholder="Select Suffix" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE" className="uppercase font-bold">None</SelectItem>
                                      <SelectItem value="JR." className="uppercase font-bold">JR.</SelectItem>
                                      <SelectItem value="SR." className="uppercase font-bold">SR.</SelectItem>
                                      <SelectItem value="I" className="uppercase font-bold">I</SelectItem>
                                      <SelectItem value="II" className="uppercase font-bold">II</SelectItem>
                                      <SelectItem value="III" className="uppercase font-bold">III</SelectItem>
                                      <SelectItem value="IV" className="uppercase font-bold">IV</SelectItem>
                                      <SelectItem value="V" className="uppercase font-bold">V</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label className="text-base font-bold uppercase text-foreground">Sex <span className="text-destructive">*</span></Label>
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
                                        "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
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
                            <AnimatedError error={errors.sex?.message as string} />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-base font-bold uppercase text-foreground">Date of Birth <span className="text-destructive">*</span></Label>
                            <Controller
                              name="birthdate"
                              control={control}
                              render={({ field }) => (
                                <HybridDatePicker disabled={!isEditing}
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  className={cn(
                                    "h-10 font-bold text-base leading-tight",
                                    errors.birthdate && "border-destructive focus-visible:ring-destructive"
                                  )}
                                />
                              )}
                            />
                            <AnimatedError error={errors.birthdate?.message as string || errors.birthdate as unknown as string} />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-base font-bold uppercase text-foreground flex items-center gap-1 h-6">
                              <Smartphone className="size-3" />
                              Mobile Number <span className="text-destructive">*</span>
                            </Label>
                            <Controller
                              name="contactNumber"
                              control={control}
                              render={({ field }) => (
                                <Input autoComplete="off" disabled={!isEditing}
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                  maxLength={11}
                                  placeholder="e.g., 09123456789"
                                  className={cn("font-bold text-base leading-tight", errors.contactNumber && "border-destructive")}
                                />
                              )}
                            />
                            <AnimatedError error={errors.contactNumber?.message as string || errors.contactNumber as unknown as string} />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-base font-bold uppercase text-foreground flex items-center h-6">IP Community / Ethnic Group</Label>
                            <Controller
                              name="indigenousCommunity"
                              control={control}
                              render={({ field }) => (
                                <SearchableCombobox
                                  items={IP_COMMUNITY_OPTIONS}
                                  value={field.value || "NOT APPLICABLE"}
                                  onChange={(value) => field.onChange(value || "NOT APPLICABLE")}
                                  disabled={!isEditing}
                                  placeholder="Select ethnic group (e.g., Aeta, Mangyan)"
                                  searchPlaceholder="Search communities..."
                                  className={cn(
                                    "w-full font-bold text-base leading-tight uppercase",
                                    errors.indigenousCommunity && "border-destructive focus-visible:ring-destructive"
                                  )}
                                />
                              )}
                            />
                            <AnimatedError error={errors.indigenousCommunity?.message as string} />
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
                            <Label className="text-base font-bold uppercase text-foreground">
                              DepEd Employee ID {!isTemporaryPersonnel && <span className="text-destructive">*</span>}
                            </Label>
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
                                    "font-bold text-base leading-tight h-10",
                                    errors.employeeId && "border-destructive"
                                  )}
                                />
                              )}
                            />
                            <AnimatedError error={errors.employeeId?.message as string || errors.employeeId as unknown as string} />
                            {isTemporaryPersonnel && (
                              <p className="text-sm text-foreground">
                                Optional for Substitute/LSB personnel.
                              </p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-base font-bold uppercase text-foreground">DepEd Position (Plantilla) <span className="text-destructive">*</span></Label>
                            <Controller
                              name="plantillaPosition"
                              control={control}
                              render={({ field }) => (
                                <SearchableCombobox
                                  items={plantillaOptions}
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!isEditing}
                                  placeholder="Search position (e.g., Teacher I, Master Teacher II)"
                                  searchPlaceholder="Search positions..."
                                  className="w-full h-10 font-bold text-base leading-tight bg-background text-foreground border-border"
                                />
                              )}
                            />
                            <AnimatedError error={errors.plantillaPosition?.message as string} />
                          </div>
                        </div>

                        {formPersonnelType === "TEACHING" && (
                          <div className="grid gap-4 mt-4 pt-4 border-t border-border">
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Subject Area / Major</Label>
                              <Controller
                                name="departments"
                                control={control}
                                render={({ field }) => (
                                  <MultiSearchableCombobox
                                    items={[...DEPED_TEACHER_DEPARTMENT_OPTIONS]}
                                    value={field.value || []}
                                    onChange={(value) => field.onChange(value)}
                                    disabled={!isEditing}
                                    placeholder="Select subject areas"
                                    searchPlaceholder="Search subject areas..."
                                    className="w-full font-bold text-base leading-tight bg-background text-foreground border-border"
                                  />
                                )}
                              />
                            </div>
                          </div>
                        )}


                        {showSF7 && (
                          <div className="space-y-4 pt-4 border-t border-border mt-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-base font-bold uppercase text-foreground">
                                  SF7 Profile
                                </p>
                                <p className="text-sm font-bold leading-tight text-foreground">
                                  Used for School Form 7 personnel reporting.
                                </p>
                              </div>
                              <Badge variant="outline" className="font-bold uppercase">
                                School Form 7
                              </Badge>
                            </div>

                            <div className="space-y-4">
                              <div className="mb-6 rounded-lg border border-border bg-muted/10 p-3">
                                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr] lg:items-start">
                                  <div className="space-y-1.5">
                                    <Label className="text-sm font-bold uppercase text-foreground">Bachelor Degree <span className="text-destructive">*</span></Label>
                                    <Controller
                                      name="undergraduateDegree"
                                      control={control}
                                      render={({ field }) => (
                                        <SearchableCombobox
                                          items={TEACHER_UNDERGRADUATE_DEGREE_OPTIONS}
                                          value={field.value || ""}
                                          onChange={(value) => field.onChange(value)}
                                          disabled={!isEditing}
                                          placeholder="Select bachelor degree"
                                          searchPlaceholder="Search degrees..."
                                          className={cn(
                                            "h-10 w-full bg-background text-base font-bold leading-tight text-foreground border-border",
                                            errors.undergraduateDegree && "border-destructive focus-visible:ring-destructive",
                                          )}
                                        />
                                      )}
                                    />
                                    <AnimatedError error={errors.undergraduateDegree?.message as string} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-sm font-bold uppercase text-foreground">Major / Specialization <span className="text-destructive">*</span></Label>
                                    <Controller
                                      name="bachelorMajor"
                                      control={control}
                                      render={({ field }) => (
                                        <SearchableCombobox
                                          items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                          value={field.value || ""}
                                          onChange={(value) => field.onChange(value)}
                                          disabled={!isEditing || !watch("undergraduateDegree")}
                                          placeholder="SELECT MAJOR"
                                          searchPlaceholder="SEARCH MAJORS..."
                                          className={cn(
                                            "h-10 w-full bg-background text-base font-bold leading-tight uppercase text-foreground border-border",
                                            errors.bachelorMajor && "border-destructive focus-visible:ring-destructive",
                                          )}
                                        />
                                      )}
                                    />
                                    <AnimatedError error={errors.bachelorMajor?.message as string} />
                                    {watch("bachelorMajor") === "OTHER" && (
                                      <div className="mt-2">
                                        <Controller
                                          name="bachelorMajorCustom"
                                          control={control}
                                          render={({ field }) => (
                                            <Input
                                              {...field}
                                              value={field.value ?? ""}
                                              disabled={!isEditing || !watch("undergraduateDegree")}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder="SPECIFY MAJOR"
                                              className={cn(
                                                "h-10 bg-background text-base font-bold uppercase",
                                                errors.bachelorMajorCustom && "border-destructive focus-visible:ring-destructive"
                                              )}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.bachelorMajorCustom?.message as string} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-sm font-bold uppercase text-foreground">Minor <span className="text-foreground/60">(optional)</span></Label>
                                    <Controller
                                      name="bachelorMinor"
                                      control={control}
                                      render={({ field }) => (
                                        <SearchableCombobox
                                          items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                          value={field.value || ""}
                                          onChange={(value) => field.onChange(value)}
                                          disabled={!isEditing || !watch("undergraduateDegree")}
                                          placeholder="SELECT MINOR"
                                          searchPlaceholder="SEARCH MINORS..."
                                          className={cn(
                                            "h-10 w-full bg-background text-base font-bold leading-tight uppercase text-foreground border-border",
                                            errors.bachelorMinor && "border-destructive focus-visible:ring-destructive",
                                          )}
                                        />
                                      )}
                                    />
                                    <AnimatedError error={errors.bachelorMinor?.message as string} />
                                    {watch("bachelorMinor") === "OTHER" && (
                                      <div className="mt-2">
                                        <Controller
                                          name="bachelorMinorCustom"
                                          control={control}
                                          render={({ field }) => (
                                            <Input
                                              {...field}
                                              value={field.value ?? ""}
                                              disabled={!isEditing || !watch("undergraduateDegree")}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder="SPECIFY MINOR"
                                              className={cn(
                                                "h-10 bg-background text-base font-bold uppercase",
                                                errors.bachelorMinorCustom && "border-destructive focus-visible:ring-destructive"
                                              )}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.bachelorMinorCustom?.message as string} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {postgraduateFields.map((postgraduateField, index) => (
                                  <div key={postgraduateField.id} className="rounded-lg border border-border bg-muted/10 p-3">
                                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-start">
                                      <div className="space-y-1.5">
                                        <Label className="text-sm font-bold uppercase text-foreground">Postgraduate Degree</Label>
                                        <Controller
                                          name={`postgraduateDegrees.${index}.degree`}
                                          control={control}
                                          render={({ field }) => (
                                            <SearchableCombobox
                                              items={TEACHER_POSTGRADUATE_DEGREE_OPTIONS}
                                              value={field.value}
                                              onChange={field.onChange}
                                              disabled={!isEditing}
                                              placeholder="Select postgraduate degree"
                                              searchPlaceholder="Search degrees..."
                                              className={cn("h-10 w-full bg-background text-base font-bold leading-tight text-foreground border-border", errors.postgraduateDegrees?.[index]?.degree && "border-destructive focus-visible:ring-destructive")}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.postgraduateDegrees?.[index]?.degree?.message as string} />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-sm font-bold uppercase text-foreground">Major / Specialization</Label>
                                        <Controller
                                          name={`postgraduateDegrees.${index}.major`}
                                          control={control}
                                          render={({ field }) => (
                                            <SearchableCombobox
                                              items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                              value={field.value || ""}
                                              onChange={(value) => field.onChange(value)}
                                              disabled={!isEditing || !watch(`postgraduateDegrees.${index}.degree`)}
                                              placeholder="SELECT MAJOR"
                                              searchPlaceholder="SEARCH MAJORS..."
                                              className={cn(
                                                "h-10 w-full bg-background text-base font-bold leading-tight uppercase text-foreground border-border",
                                                errors.postgraduateDegrees?.[index]?.major && "border-destructive focus-visible:ring-destructive",
                                              )}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.postgraduateDegrees?.[index]?.major?.message as string} />
                                        {watch(`postgraduateDegrees.${index}.major`) === "OTHER" && (
                                          <div className="mt-2">
                                            <Controller
                                              name={`postgraduateDegrees.${index}.majorCustom`}
                                              control={control}
                                              render={({ field }) => (
                                                <Input
                                                  {...field}
                                                  value={field.value ?? ""}
                                                  disabled={!isEditing || !watch(`postgraduateDegrees.${index}.degree`)}
                                                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                                  placeholder="SPECIFY MAJOR"
                                                  className={cn("h-10 bg-background text-base font-bold uppercase", errors.postgraduateDegrees?.[index]?.majorCustom && "border-destructive")}
                                                />
                                              )}
                                            />
                                            <AnimatedError error={errors.postgraduateDegrees?.[index]?.majorCustom?.message as string} />
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-sm font-bold uppercase text-foreground">Minor <span className="text-foreground/60">(optional)</span></Label>
                                        <Controller
                                          name={`postgraduateDegrees.${index}.minor`}
                                          control={control}
                                          render={({ field }) => (
                                            <SearchableCombobox
                                              items={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                              value={field.value || ""}
                                              onChange={(value) => field.onChange(value)}
                                              disabled={!isEditing || !watch(`postgraduateDegrees.${index}.degree`)}
                                              placeholder="SELECT MINOR"
                                              searchPlaceholder="SEARCH MINORS..."
                                              className={cn(
                                                "h-10 w-full bg-background text-base font-bold leading-tight uppercase text-foreground border-border",
                                                errors.postgraduateDegrees?.[index]?.minor && "border-destructive focus-visible:ring-destructive",
                                              )}
                                            />
                                          )}
                                        />
                                        <AnimatedError error={errors.postgraduateDegrees?.[index]?.minor?.message as string} />
                                        {watch(`postgraduateDegrees.${index}.minor`) === "OTHER" && (
                                          <div className="mt-2">
                                            <Controller
                                              name={`postgraduateDegrees.${index}.minorCustom`}
                                              control={control}
                                              render={({ field }) => (
                                                <Input
                                                  {...field}
                                                  value={field.value ?? ""}
                                                  disabled={!isEditing || !watch(`postgraduateDegrees.${index}.degree`)}
                                                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                                  placeholder="SPECIFY MINOR"
                                                  className={cn("h-10 bg-background text-base font-bold uppercase", errors.postgraduateDegrees?.[index]?.minorCustom && "border-destructive")}
                                                />
                                              )}
                                            />
                                            <AnimatedError error={errors.postgraduateDegrees?.[index]?.minorCustom?.message as string} />
                                          </div>
                                        )}

                                      </div>
                                      {index > 0 && isEditing && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-10 w-10 text-destructive hover:text-destructive"
                                          onClick={() => removePostgraduateDegree(index)}
                                          aria-label={`Remove postgraduate degree ${index + 1}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {isEditing && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => appendPostgraduateDegree({ degree: "", major: "", minor: "" })}
                                    className="gap-2"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add Another Postgraduate Degree
                                  </Button>
                                )}
                              </div>
                              <div className={cn("grid gap-4", isTemporaryPersonnel ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                                <div className="space-y-1.5">
                                  <Label className="text-base font-bold uppercase text-foreground">Nature of Appointment <span className="text-destructive">*</span></Label>
                                  <Controller
                                    name="natureOfAppointment"
                                    control={control}
                                    render={({ field }) => (
                                      <Select
                                        onValueChange={(value) => field.onChange(value as TeacherNatureOfAppointment)}
                                        value={field.value ?? undefined}
                                      >
                                        <SelectTrigger disabled={!isEditing} className={cn("font-bold text-base leading-tight h-10 uppercase", errors.natureOfAppointment && "border-destructive focus-visible:ring-destructive")}>
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
                                {isTemporaryPersonnel && (
                                  <div className="space-y-1.5">
                                    <Label className="text-base font-bold uppercase text-foreground">
                                      Contract End Date <span className="text-destructive">*</span>
                                    </Label>
                                    <Controller
                                      name="accessExpirationDate"
                                      control={control}
                                      render={({ field }) => (
                                        <HybridDatePicker
                                          disabled={!isEditing}
                                          value={field.value || ""}
                                          onChange={field.onChange}
                                          minDate={new Date()}
                                          className={cn(
                                            "h-10 font-bold text-base leading-tight",
                                            errors.accessExpirationDate && "border-destructive focus-visible:ring-destructive",
                                          )}
                                        />
                                      )}
                                    />
                                    <AnimatedError error={errors.accessExpirationDate?.message as string} />
                                  </div>
                                )}
                                <div className="space-y-1.5">
                                  <Label className="text-base font-bold uppercase text-foreground">Fund Source <span className="text-destructive">*</span></Label>
                                  <Controller
                                    name="fundingSource"
                                    control={control}
                                    render={({ field }) => (
                                      <Select
                                        onValueChange={(value) => field.onChange(value as TeacherFundingSource)}
                                        value={field.value ?? undefined}
                                      >
                                        <SelectTrigger disabled={!isEditing} className={cn("font-bold text-base leading-tight h-10 uppercase", errors.fundingSource && "border-destructive focus-visible:ring-destructive")}>
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

                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Ancillary Roles</Label>
                              <Controller
                                name="ancillaryRoles"
                                control={control}
                                render={({ field }) => (
                                  <MultiSearchableCombobox
                                    items={[...DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS]}
                                    value={field.value || []}
                                    onChange={(value) => field.onChange(value)}
                                    disabled={!isEditing}
                                    placeholder="Select ancillary roles"
                                    searchPlaceholder="Search roles..."
                                    className="w-full font-bold text-base leading-tight bg-background text-foreground border-border"
                                  />
                                )}
                              />
                            </div>

                            <div className="col-span-1 sm:col-span-2 space-y-4 border rounded-md p-4 bg-muted/10">
                              <Label className="text-base font-bold uppercase text-foreground flex items-center gap-2 border-b pb-2">
                                <ShieldAlert className="w-4 h-4 text-primary" />
                                ATLAS Access Toggles
                              </Label>
                              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                                <Controller
                                  name="atlasAssignTeachingLoad"
                                  control={control}
                                  render={({ field }) => (
                                    <div className={cn("flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background", !isEditing && "opacity-60")}>
                                      <Checkbox
                                        id="toggle-assign-load"
                                        checked={field.value}
                                        onCheckedChange={(checked) => field.onChange(checked === true)}
                                        disabled={!isEditing}
                                        className="mt-1"
                                      />
                                      <label htmlFor="toggle-assign-load" className={cn("leading-none", isEditing ? "cursor-pointer" : "cursor-not-allowed")}>
                                        <p className="font-bold uppercase">Assign Teaching Load</p>
                                        <p className="text-sm text-foreground">Allow this user to manage teaching loads in ATLAS.</p>
                                      </label>
                                    </div>
                                  )}
                                />
                                <Controller
                                  name="atlasBuildSchedules"
                                  control={control}
                                  render={({ field }) => (
                                    <div className={cn("flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background", !isEditing && "opacity-60")}>
                                      <Checkbox
                                        id="toggle-build-schedules"
                                        checked={field.value}
                                        onCheckedChange={(checked) => field.onChange(checked === true)}
                                        disabled={!isEditing}
                                        className="mt-1"
                                      />
                                      <label htmlFor="toggle-build-schedules" className={cn("leading-none", isEditing ? "cursor-pointer" : "cursor-not-allowed")}>
                                        <p className="font-bold uppercase">Build Schedules</p>
                                        <p className="text-sm text-foreground">Allow this user to build section schedules in ATLAS.</p>
                                      </label>
                                    </div>
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        )}



                        <div className="space-y-4 pt-4 border-t border-border mt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Service Status</Label>
                              <Controller
                                name="serviceStatus"
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value || "ACTIVE"}>
                                    <SelectTrigger disabled={!isEditing} className="font-bold text-base leading-tight h-10 uppercase">
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
                                <Label className="text-base font-bold uppercase text-foreground">Date Started</Label>
                                <Controller
                                  name="serviceEffectiveDate"
                                  control={control}
                                  render={({ field }) => (
                                    <HybridDatePicker disabled={!isEditing}
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      className="h-10 font-bold text-base leading-tight"
                                    />
                                  )}
                                />
                              </div>
                            )}
                          </div>
                          {formServiceStatus !== "ACTIVE" && (
                            <div className="space-y-1.5">
                              <Label className="text-base font-bold uppercase text-foreground">Notes for this status <span className="text-foreground font-bold ml-1">(optional)</span></Label>
                              <Controller
                                name="serviceRemarks"
                                control={control}
                                render={({ field }) => (
                                  <Textarea autoComplete="off" disabled={!isEditing}
                                    placeholder="e.g., maternity leave, transferred to another school, retired"
                                    className="min-h-[80px] resize-none font-bold text-base leading-tight"
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
                            <Label className="text-base font-bold uppercase text-foreground">
                              Portal Access Status
                            </Label>
                            <p className="text-sm font-bold leading-tight text-foreground">
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
                                      "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", field.value ? "bg-emerald-500" : "bg-muted-foreground")} />
                                    ENABLE LOGIN
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!isEditing || isPortalActionSubmitting}
                                    onClick={() => field.onChange(false)}
                                    className={cn(
                                      "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === false
                                        ? "border-amber-500 bg-amber-50 text-amber-700"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", field.value === false ? "bg-amber-500" : "bg-muted-foreground")} />
                                    DISABLE LOGIN
                                  </button>
                                </div>
                              )}
                            />
                          </div>

                          {isTemporaryPersonnel && watch("accessExpirationDate") && (
                            <div className="space-y-1.5 pt-2">
                              <p className="text-sm font-bold text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 uppercase flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                PORTAL ACCESS WILL AUTOMATICALLY BE DISABLED ON {new Date(watch("accessExpirationDate") as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} BASED ON THE CONTRACT END DATE.
                              </p>
                            </div>
                          )}
                          <div className="space-y-2 pt-2">
                            <Label className="text-base font-bold uppercase text-foreground">
                              {isAdding ? "Default Password" : "Password Control"}
                            </Label>
                            <div className={cn("grid gap-2", isAdding ? "grid-cols-1" : "grid-cols-2")}>
                              <Input autoComplete="off" disabled={!isEditing}
                                value={defaultPasswordInput}
                                onChange={(e) => setDefaultPasswordInput(e.target.value)}
                                placeholder="e.g., DepEd@1234"
                                className="h-11 font-bold text-base bg-background"
                              />
                              {!isAdding && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={!isEditing || isPortalActionSubmitting || !defaultPasswordInput.trim()}
                                  onClick={handleResetPassword}
                                  className="w-full h-11 font-bold text-base uppercase border border-border hover:bg-muted/30 shrink-0 cursor-pointer"
                                >
                                  Reset to Default Password
                                </Button>
                              )}
                            </div>
                            <p className="text-sm font-bold leading-tight text-foreground">
                              {isAdding
                                ? "The default portal password for this user. They will be forced to change it on their first login."
                                : "This will reset the user's portal password to the value above and force a password change on next login."
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!isAdding && (
                      <div className="mt-4 p-3 bg-muted/10 text-center rounded-xl">
                        <p className="text-sm font-bold text-foreground uppercase tracking-widest">
                          Record created {teacher?.createdAt ? new Date(teacher.createdAt).toLocaleDateString(undefined, { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }) : "date not available"}
                        </p>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* ─── Footer ─── */}
              {(isEditing || isAdding) && (
                <div className="p-4 bg-background border-t grid grid-cols-2 gap-4 shrink-0">
                  {!isAdding && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="font-bold uppercase w-full"
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
                      "font-bold uppercase transition-all duration-200 w-full",
                      isAdding ? "col-span-2" : "",
                      !hasUnsavedChanges ? "opacity-50 bg-gray-400 cursor-not-allowed text-primary-foreground hover:bg-gray-400" : ""
                    )}
                    disabled={!hasUnsavedChanges || isSubmitting}
                  >
                    {isSubmitting ? (isAdding ? "Saving..." : "Updating...") : (isAdding ? "Add Personnel Record" : "Save Profile Changes")}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={showResetPasswordConfirm}
        onOpenChange={setShowResetPasswordConfirm}
        title="Confirm Password Reset"
        description="Are you sure you want to reset this password to its default password?"
        confirmText="Reset Password"
        cancelText="Cancel"
        onConfirm={handleResetPasswordConfirm}
        variant="danger"
      />
    </>
  );
});
