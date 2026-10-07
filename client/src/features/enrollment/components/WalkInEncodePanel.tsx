import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@/shared/lib/zodResolver";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import { sileo } from "sileo";
import { isAxiosError } from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import {
  useUnsavedChanges,
  useUnsavedChangesPrompt,
} from "@/shared/hooks/useUnsavedChanges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

import { SearchableCombobox } from "@/shared/ui/searchable-combobox";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";
import { AnimatedError } from "@/shared/components/AnimatedError";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Loader2, Plus, Search, User, FileText, Phone, FileCheck, Mars, Venus, AlertCircle, CheckCircle2, Camera, Trash2, X, Lock } from "lucide-react";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { LearnerFoundModal } from "@/features/admission/components/LearnerFoundModal";
import api from "@/shared/api/axiosInstance";
import { directEncodeWalkInSchema, type DirectEncodeWalkInPayload } from "@enrollpro/shared";
import { useAuthStore } from "@/store/auth.slice";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/shared/ui/badge";
import { DISABILITY_TYPES_A1, DISABILITY_TYPES_A2, SPECIAL_HEALTH_SUB_OPTIONS, VISUAL_IMPAIRMENT_SUB_OPTIONS } from "@/features/admission/pages/online-enrollment/types";

const MOTHER_TONGUE_OPTIONS = [
  { value: "Tagalog", label: "Tagalog" },
  { value: "Cebuano", label: "Cebuano" },
  { value: "Hiligaynon (Ilonggo)", label: "Hiligaynon (Ilonggo)" },
  { value: "Ilocano (Iloko)", label: "Ilocano (Iloko)" },
  { value: "Bicolano (Central Bikol)", label: "Bicolano (Central Bikol)" },
  { value: "Kapampangan", label: "Kapampangan" },
  { value: "Pangasinan (Pangasinense)", label: "Pangasinan (Pangasinense)" },
  { value: "Waray", label: "Waray" },
  { value: "Tausug", label: "Tausug" },
  { value: "Maguindanaoan", label: "Maguindanaoan" },
  { value: "Maranao", label: "Maranao" },
  { value: "Chavacano (Chabacano)", label: "Chavacano (Chabacano)" },
  { value: "Ybanag (Ibanag)", label: "Ybanag (Ibanag)" },
  { value: "Ivatan", label: "Ivatan" },
  { value: "Sambal", label: "Sambal" },
  { value: "Aklanon", label: "Aklanon" },
  { value: "Kinaray-a", label: "Kinaray-a" },
  { value: "Yakan", label: "Yakan" },
  { value: "Surigaonon", label: "Surigaonon" },
  { value: "Others", label: "Others" },
];

interface SchoolYearGradeLevel {
  id: number;
  name: string;
}

interface ActiveSchoolYearGradeLevelsResponse {
  gradeLevels?: SchoolYearGradeLevel[];
}

interface LearnerLookupResponse {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  extensionName?: string | null;
  birthdate?: string | null;
  sex?: "MALE" | "FEMALE";
  motherTongue?: string | null;
  studentPhoto?: string | null;
  gradeLevelToEnroll?: string | null;
  previousGenAve?: number | null;
  promotionStatus?: "PROMOTED" | "CONDITIONALLY_PROMOTED" | "RETAINED" | null;
  academicStatus?: "PROMOTED" | "CONDITIONALLY_PROMOTED" | "RETAINED" | null;
  assignedProgram?: string | null;
  hasPsaBirthCertificate?: boolean;
  isMissingSf9?: boolean | null;
  isIpCommunity?: boolean;
  ipGroupName?: string | null;
  is4PsBeneficiary?: boolean;
  householdId4Ps?: string | null;
  isBalikAral?: boolean;
  isLearnerWithDisability?: boolean;
  specialNeedsCategory?: string | null;
  disabilityTypes?: string[];
  hasPwdId?: boolean;
  addresses?: Array<{
    addressType: "CURRENT" | "PERMANENT";
    houseNoStreet?: string | null;
    street?: string | null;
    sitio?: string | null;
    barangay?: string | null;
    cityMunicipality?: string | null;
    province?: string | null;
    region?: string | null;
  }>;
  previousSchool?: {
    schoolName?: string | null;
    schoolId?: string | null;
    lastGradeCompleted?: string | null;
    generalAverage?: number | null;
  } | null;
  familyMembers?: Array<{
    relationship: "MOTHER" | "FATHER" | "GUARDIAN";
    firstName: string;
    lastName: string;
    middleName?: string | null;
    contactNumber?: string | null;
  }>;
}

type WalkInProgram = DirectEncodeWalkInPayload["assignedProgram"];

const WALK_IN_PROGRAMS: ReadonlySet<string> = new Set<WalkInProgram>([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
]);

function isWalkInProgram(value: string | null | undefined): value is WalkInProgram {
  return Boolean(value && WALK_IN_PROGRAMS.has(value));
}

function addressesMatch(
  first: NonNullable<LearnerLookupResponse["addresses"]>[number],
  second: NonNullable<LearnerLookupResponse["addresses"]>[number],
): boolean {
  const fields = ["houseNoStreet", "street", "sitio", "barangay", "cityMunicipality", "province", "region"] as const;
  return fields.every((field) => (first[field] ?? "").trim().toUpperCase() === (second[field] ?? "").trim().toUpperCase());
}

interface ApiErrorResponse {
  message?: string;
}

interface AtlasSubjectOption {
  code: string;
  displayCode: string;
  name: string;
}

interface AtlasSubjectCatalogResponse {
  data: AtlasSubjectOption[];
  meta: {
    source: "ATLAS";
    gradeLevelId: number;
    incomingGradeLevel: number;
    subjectGradeLevelId: number;
    subjectGradeLevel: number;
    fetchedAt: string;
  };
}

function getWalkInErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function WalkInEncodePanel() {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isLearnerModalOpen, setIsLearnerModalOpen] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<LearnerLookupResponse | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [noLrn, setNoLrn] = useState(false);
  const lastLookedUpLrn = useRef<string>("");
  const [isOtherMotherTongue, setIsOtherMotherTongue] = useState(false);
  const queryClient = useQueryClient();
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore();
  const { panelPercentage, isDesktopViewport, startResizingRight } = useResizablePanel(80, {
    centered: true,
    storageKey: "walk-in-enrollment-modal",
  });

  const userRoles = useAuthStore((s) => s.user?.roles) ?? [];
  const isAdmin = userRoles.includes("SYSTEM_ADMIN");
  const isHeadRegistrar = userRoles.includes("HEAD_REGISTRAR");
  const ancillaryRoles = useAuthStore((s) => s.user?.ancillaryRoles) ?? [];
  const coordinatorGradeOrder = useMemo(() => {
    const coordinatorRole = ancillaryRoles.find((role) =>
      /^GRADE (7|8|9|10) COORDINATOR$/.test(role),
    );
    const grade = coordinatorRole?.match(/^GRADE (7|8|9|10) COORDINATOR$/)?.[1];
    return grade ? Number(grade) : null;
  }, [ancillaryRoles]);
  const isTransfereeOnlyCoordinator =
    coordinatorGradeOrder !== null && coordinatorGradeOrder > 7;
  const isStrictClassAdviser = userRoles.includes("CLASS_ADVISER") && !isAdmin && !isHeadRegistrar && 
    !ancillaryRoles.includes("GRADE 7 COORDINATOR") &&
    !ancillaryRoles.includes("GRADE 8 COORDINATOR") &&
    !ancillaryRoles.includes("GRADE 9 COORDINATOR") &&
    !ancillaryRoles.includes("GRADE 10 COORDINATOR");

  const { data: activeSchoolYear } = useQuery({
    queryKey: ["schoolYear", "grade-levels"],
    queryFn: async () => {
      const res = await api.get<ActiveSchoolYearGradeLevelsResponse>("/school-years/grade-levels");
      return res.data;
    },
  });

  const activeSyId = useSettingsStore((s) => s.activeSchoolYearId);
  const { data: advisoryData } = useQuery({
    queryKey: ["teacher", "advisory", activeSyId],
    queryFn: () => api.get("/teacher-advisory").then(res => res.data),
    enabled: isStrictClassAdviser && !!activeSyId,
  });

  
  
  let assignedGradeLevelId: number | null = null;
  if (isStrictClassAdviser && advisoryData?.section?.gradeLevelId) {
    assignedGradeLevelId = advisoryData.section.gradeLevelId;
  } else if (!isAdmin && !isHeadRegistrar) {
    const isGrade7Coordinator = ancillaryRoles.includes("GRADE 7 COORDINATOR");
    const isGrade8Coordinator = ancillaryRoles.includes("GRADE 8 COORDINATOR");
    const isGrade9Coordinator = ancillaryRoles.includes("GRADE 9 COORDINATOR");
    const isGrade10Coordinator = ancillaryRoles.includes("GRADE 10 COORDINATOR");

    if (isGrade7Coordinator || isGrade8Coordinator || isGrade9Coordinator || isGrade10Coordinator) {
      if (activeSchoolYear?.gradeLevels) {
        if (isGrade7Coordinator) assignedGradeLevelId = activeSchoolYear.gradeLevels.find(g => g.name === "Grade 7")?.id ?? null;
        else if (isGrade8Coordinator) assignedGradeLevelId = activeSchoolYear.gradeLevels.find(g => g.name === "Grade 8")?.id ?? null;
        else if (isGrade9Coordinator) assignedGradeLevelId = activeSchoolYear.gradeLevels.find(g => g.name === "Grade 9")?.id ?? null;
        else if (isGrade10Coordinator) assignedGradeLevelId = activeSchoolYear.gradeLevels.find(g => g.name === "Grade 10")?.id ?? null;
      }
    }
  }

  const programOptions = [
    { val: "REGULAR", label: "BEC" },
    ...(steEnabled ? [{ val: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" }] : []),
    ...(spaEnabled ? [{ val: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" }] : []),
    ...(spsEnabled ? [{ val: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" }] : []),
  ];

  const form = useForm<DirectEncodeWalkInPayload>({
    resolver: zodResolver(directEncodeWalkInSchema) as Resolver<DirectEncodeWalkInPayload>,
    mode: "onTouched",
    defaultValues: {
      learnerType: isTransfereeOnlyCoordinator ? "TRANSFEREE" : "NEW_ENROLLEE",
      lrn: "",
      firstName: "",
      lastName: "",
      middleName: "",
      birthdate: "",
      sex: "" as unknown as DirectEncodeWalkInPayload["sex"],
      motherTongue: "",
      studentPhoto: "",
      extensionName: "",
      addressStreet: "",
      addressSitio: "",
      addressRegion: "",
      addressProvince: "",
      addressCity: "",
      addressBarangay: "",
      permanentAddressSameAsCurrent: true,
      gradeLevelId: 0,
      assignedProgram: "" as unknown as DirectEncodeWalkInPayload["assignedProgram"],
      previousSchoolName: "",
      lastGradeCompleted: "",
      previousGenAve: undefined,
      guardianFirstName: "",
      guardianMiddleName: "",
      guardianLastName: "",
      guardianRelationship: "" as unknown as DirectEncodeWalkInPayload["guardianRelationship"],
      guardianContact: "",
      hasSf9: false,
      hasPsa: false,
      originatingSchoolId: "",
      sf9EligibilityStatus: "" as unknown as DirectEncodeWalkInPayload["sf9EligibilityStatus"],
      conditionalSubjects: [],
      sectionId: undefined,
      isIpCommunity: undefined,
      ipGroupName: "",
      is4PsBeneficiary: undefined,
      householdId4Ps: "",
      isBalikAral: undefined,
      isLearnerWithDisability: undefined,
      specialNeedsCategory: undefined,
      disabilityTypes: [],
      hasPwdId: undefined,
    },
  });
  const { isDirty, isSubmitting, isValid } = form.formState;

  const { fields: conditionalSubjectFields, append: appendConditionalSubject, remove: removeConditionalSubject, replace: replaceConditionalSubjects } = useFieldArray({
    control: form.control,
    name: "conditionalSubjects",
  });
  const learnerType = form.watch("learnerType");
  const gradeLevelId = form.watch("gradeLevelId");
  const assignedProgram = form.watch("assignedProgram");
  const sf9EligibilityStatus = form.watch("sf9EligibilityStatus");
  const requiresBackSubjects =
    learnerType === "TRANSFEREE" &&
    sf9EligibilityStatus === "CONDITIONALLY_PROMOTED";

  useEffect(() => {
    if (isTransfereeOnlyCoordinator && learnerType !== "TRANSFEREE") {
      form.setValue("learnerType", "TRANSFEREE", {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, isTransfereeOnlyCoordinator, learnerType]);

  
  const sectionsQuery = useQuery({
    queryKey: ["sections", "filtered", activeSyId, gradeLevelId, assignedProgram],
    queryFn: async () => {
      const response = await api.get(`/sections/${activeSyId}`, {
        params: { gradeLevelId, programType: assignedProgram },
      });
      return response.data.sections as Array<{ id: number; name: string; maxCapacity: number; enrolledCount: number; isHomogeneous: boolean; programType: string; }>;
    },
    enabled: !!activeSyId && gradeLevelId > 0 && !!assignedProgram,
    staleTime: 5 * 60 * 1000,
  });

  const atlasSubjectsQuery = useQuery({
    queryKey: ["enrollment", "walk-in", "atlas-subjects", gradeLevelId, assignedProgram],
    queryFn: async () => {
      const response = await api.get<AtlasSubjectCatalogResponse>(
        "/enrollment/walk-in/atlas-subjects",
        { params: { gradeLevelId, programType: assignedProgram } },
      );
      return response.data;
    },
    enabled: requiresBackSubjects && gradeLevelId > 0 && Boolean(assignedProgram),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  
  useEffect(() => {
    form.setValue("sectionId", undefined, { shouldDirty: true, shouldValidate: true });
  }, [gradeLevelId, assignedProgram, form]);

  useEffect(() => {
    if (!requiresBackSubjects) {
      if (conditionalSubjectFields.length > 0) {
        replaceConditionalSubjects([]);
      }
    } else {
      if (conditionalSubjectFields.length === 0) {
        replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
      }
    }
  }, [requiresBackSubjects, conditionalSubjectFields.length, replaceConditionalSubjects]);

  useEffect(() => {
    if (searchParams.get("action") === "walk-in") {
      setOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (assignedGradeLevelId && gradeLevelId !== assignedGradeLevelId) {
      form.setValue("gradeLevelId", assignedGradeLevelId, { shouldDirty: true, shouldValidate: true });
    }
  }, [assignedGradeLevelId, gradeLevelId, form]);

  const handleLrnLookup = async (lrn: string) => {
    if (lrn.length !== 12) return;
    if (lrn === lastLookedUpLrn.current) return; // skip if same LRN already looked up
    lastLookedUpLrn.current = lrn;

    setIsLookingUp(true);
    try {
      const res = await api.get<LearnerLookupResponse>(`/learner/lookup?lrn=${lrn}`);
      const data = res.data;
      setPendingProfile(res.data);
      setIsLearnerModalOpen(true);
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        const currentLearnerType = form.getValues("learnerType");
        form.reset({
          learnerType: currentLearnerType,
          lrn: lrn,
          firstName: "",
          lastName: "",
          middleName: "",
          birthdate: "",
          sex: "" as unknown as DirectEncodeWalkInPayload["sex"],
          motherTongue: "",
          studentPhoto: "",
          extensionName: "",
          addressStreet: "",
          addressSitio: "",
          addressRegion: "",
          addressProvince: "",
          addressCity: "",
          addressBarangay: "",
          permanentAddressSameAsCurrent: true,
          gradeLevelId: 0,
          assignedProgram: "" as unknown as DirectEncodeWalkInPayload["assignedProgram"],
          previousSchoolName: "",
          lastGradeCompleted: "",
          previousGenAve: undefined,
          guardianFirstName: "",
          guardianMiddleName: "",
          guardianLastName: "",
          guardianRelationship: "" as unknown as DirectEncodeWalkInPayload["guardianRelationship"],
          guardianContact: "",
          hasSf9: false,
          hasPsa: false,
          originatingSchoolId: "",
          sf9EligibilityStatus: "" as unknown as DirectEncodeWalkInPayload["sf9EligibilityStatus"],
          conditionalSubjects: [],
          sectionId: undefined,
        });
      } else {
        sileo.error({ title: "Lookup Failed", description: "Could not fetch learner data." });
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const resetPanelState = useCallback(() => {
    form.reset();
    setNoLrn(false);
    setIsOtherMotherTongue(false);
    setIsClearModalOpen(false);
    lastLookedUpLrn.current = "";
  }, [form]);

  const clearForm = useCallback(() => {
    resetPanelState();
    if (assignedGradeLevelId) {
      form.setValue("gradeLevelId", assignedGradeLevelId, { shouldValidate: true });
    }
  }, [assignedGradeLevelId, form, resetPanelState]);

  const closePanel = useCallback(() => {
    resetPanelState();
    setOpen(false);
  }, [resetPanelState]);

  const requestClosePanel = useCallback(() => {
    confirmOrRun(closePanel);
  }, [closePanel, confirmOrRun]);

  useUnsavedChanges({
    id: "walk-in-encode-panel",
    label: "Walk-in learner form",
    isDirty: open && isDirty,
    isSubmitting,
    onDiscard: resetPanelState,
  });

  const onSubmit = async (values: DirectEncodeWalkInPayload) => {
    const payload = {
      ...values,
      firstName: values.firstName?.toUpperCase(),
      lastName: values.lastName?.toUpperCase(),
      middleName: values.middleName?.toUpperCase(),
      previousSchoolName: values.previousSchoolName?.toUpperCase(),
      guardianFirstName: values.guardianFirstName?.toUpperCase(),
      guardianMiddleName: values.guardianMiddleName?.toUpperCase(),
      guardianLastName: values.guardianLastName?.toUpperCase(),
    };
    try {
      await api.post("/enrollment/walk-in", payload);
      sileo.success({
        title: "Successfully Encoded",
        description: "Learner routed directly to unassigned sectioning pool.",
      });
      closePanel();
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      void queryClient.invalidateQueries({ queryKey: ["enrollment", "pending-verifications"] });
    } catch (err: unknown) {
      sileo.error({
        title: "Encoding Failed",
        description: getWalkInErrorMessage(err, "The learner was not encoded. Please review the form and try again."),
      });
    }
  };

  const applyPendingProfile = useCallback(() => {
    if (!pendingProfile) return;
    const data = pendingProfile;
    const updateOptions = { shouldDirty: true, shouldValidate: true } as const;

    const currentAddress = data.addresses?.find((address) => address.addressType === "CURRENT")
      ?? data.addresses?.[0];
    const permanentAddress = data.addresses?.find((address) => address.addressType === "PERMANENT");
    const primaryContact = data.familyMembers?.find((member) => member.relationship === "GUARDIAN")
      ?? data.familyMembers?.find((member) => member.relationship === "MOTHER")
      ?? data.familyMembers?.find((member) => member.relationship === "FATHER");
    const incomingGrade = activeSchoolYear?.gradeLevels?.find(
      (gradeLevel) => gradeLevel.name.trim().toUpperCase() === data.gradeLevelToEnroll?.trim().toUpperCase(),
    );
    const lookupProgram = isWalkInProgram(data.assignedProgram)
      && programOptions.some((program) => program.val === data.assignedProgram)
      ? data.assignedProgram
      : "REGULAR";
    const eligibilityStatus = data.academicStatus ?? data.promotionStatus;

    form.setValue("firstName", data.firstName.trim(), updateOptions);
    form.setValue("lastName", data.lastName.trim(), updateOptions);
    form.setValue("middleName", data.middleName?.trim() ?? "", updateOptions);
    form.setValue("extensionName", data.extensionName?.trim() ?? "", updateOptions);
    form.setValue("birthdate", data.birthdate?.slice(0, 10) ?? "", updateOptions);
    if (data.sex) form.setValue("sex", data.sex, updateOptions);
    form.setValue("motherTongue", data.motherTongue?.trim() ?? "", updateOptions);
    form.setValue("studentPhoto", data.studentPhoto ?? "", updateOptions);

    form.setValue("addressStreet", currentAddress?.houseNoStreet?.trim() || currentAddress?.street?.trim() || "", updateOptions);
    form.setValue("addressSitio", currentAddress?.sitio?.trim() ?? "", updateOptions);
    form.setValue("addressRegion", currentAddress?.region?.trim() ?? "", updateOptions);
    form.setValue("addressProvince", currentAddress?.province?.trim() ?? "", updateOptions);
    form.setValue("addressCity", currentAddress?.cityMunicipality?.trim() ?? "", updateOptions);
    form.setValue("addressBarangay", currentAddress?.barangay?.trim() ?? "", updateOptions);
    form.setValue(
      "permanentAddressSameAsCurrent",
      Boolean(currentAddress && (!permanentAddress || addressesMatch(currentAddress, permanentAddress))),
      updateOptions,
    );

    if (!assignedGradeLevelId && incomingGrade) {
      form.setValue("gradeLevelId", incomingGrade.id, updateOptions);
    }
    form.setValue("assignedProgram", lookupProgram, updateOptions);

    form.setValue("previousSchoolName", data.previousSchool?.schoolName?.trim() ?? "", updateOptions);
    form.setValue("lastGradeCompleted", data.previousSchool?.lastGradeCompleted?.trim() ?? "", updateOptions);
    form.setValue("originatingSchoolId", data.previousSchool?.schoolId?.trim() ?? "", updateOptions);
    form.setValue(
      "previousGenAve",
      data.previousSchool?.generalAverage ?? data.previousGenAve ?? undefined,
      updateOptions,
    );

    form.setValue("guardianFirstName", primaryContact?.firstName.trim() ?? "", updateOptions);
    form.setValue("guardianMiddleName", primaryContact?.middleName?.trim() ?? "", updateOptions);
    form.setValue("guardianLastName", primaryContact?.lastName.trim() ?? "", updateOptions);
    form.setValue("guardianContact", primaryContact?.contactNumber?.trim() ?? "", updateOptions);
    if (primaryContact) {
      form.setValue("guardianRelationship", primaryContact.relationship, updateOptions);
    }

    form.setValue("hasPsa", data.hasPsaBirthCertificate ?? false, updateOptions);
    form.setValue("hasSf9", data.isMissingSf9 === false, updateOptions);
    if (eligibilityStatus) {
      form.setValue("sf9EligibilityStatus", eligibilityStatus, updateOptions);
    }

    if (data.isIpCommunity !== undefined) form.setValue("isIpCommunity", data.isIpCommunity, updateOptions);
    if (data.ipGroupName) form.setValue("ipGroupName", data.ipGroupName, updateOptions);
    if (data.is4PsBeneficiary !== undefined) form.setValue("is4PsBeneficiary", data.is4PsBeneficiary, updateOptions);
    if (data.householdId4Ps) form.setValue("householdId4Ps", data.householdId4Ps, updateOptions);
    if (data.isBalikAral !== undefined) form.setValue("isBalikAral", data.isBalikAral, updateOptions);
    if (data.isLearnerWithDisability !== undefined) form.setValue("isLearnerWithDisability", data.isLearnerWithDisability, updateOptions);
    if (data.specialNeedsCategory) form.setValue("specialNeedsCategory", data.specialNeedsCategory as "a1" | "a2", updateOptions);
    if (data.disabilityTypes) form.setValue("disabilityTypes", data.disabilityTypes, updateOptions);
    if (data.hasPwdId !== undefined) form.setValue("hasPwdId", data.hasPwdId, updateOptions);

    sileo.success({ title: "Learner Found", description: "Profile auto-populated." });
  }, [pendingProfile, form, activeSchoolYear, assignedGradeLevelId, programOptions]);

  // The encoder is intentionally non-dismissible through outside clicks or Escape.
  // Closing is handled only through explicit Cancel, close, discard, or successful save.
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setOpen(true);
      return;
    }
    requestClosePanel();
  };

  const hasSf9 = form.watch("hasSf9");
  const hasPsa = form.watch("hasPsa");
  const isCompleteDocs = hasSf9 && hasPsa;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-11 px-6 text-base font-bold gap-2">
          <Plus className="w-5 h-5" />
          Encode Walk-In
        </Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby={undefined}
        className="p-0 flex flex-col h-[90vh] overflow-visible w-[95vw] sm:w-full max-w-none transition-[width] duration-75 ease-linear"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw`, maxWidth: '90vw', minWidth: '40vw' } : undefined
        }
      >
        <div
          onMouseDown={startResizingRight}
          className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group"
        >
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
            <Plus className="w-6 h-6 text-primary" />
            Walk-In Learner Enrollment
          </DialogTitle>
        </DialogHeader>
        <ConfirmationModal
          open={isClearModalOpen}
          onOpenChange={setIsClearModalOpen}
          title="Clear Entire Form?"
          description="Are you sure you want to start over? This will permanently delete all the information entered in this walk-in enrollment form."
          variant="danger"
          confirmText="Yes, Clear Form"
          cancelText="Cancel"
          onConfirm={clearForm}
        />
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative z-0">
          <div className="absolute inset-0 pointer-events-none -z-10 bg-background overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full opacity-[0.08]"
              xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="walkin-pixel-grid"
                  x="0"
                  y="0"
                  width="80"
                  height="80"
                  patternUnits="userSpaceOnUse">
                  <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#walkin-pixel-grid)" />
            </svg>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)",
              }}
            />
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 relative z-10" autoComplete="off">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-transparent">

                <div className="space-y-4">
                  {/* LEARNER PROFILE BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border flex items-center justify-between gap-4">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Learner Profile
                      </span>
                      <div className="flex items-center gap-3">
                        {isDirty && (
                          <div className="text-sm normal-case font-bold text-foreground flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md border border-border/50">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Draft Auto Saved
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSubmitting || isLookingUp}
                          className="px-2 font-bold text-foreground hover:text-destructive normal-case text-sm"
                          onClick={() => setIsClearModalOpen(true)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Clear Form
                        </Button>
                      </div>
                    </div>
                    <div className="px-5 pt-5 pb-1">
                      <div className={cn("grid gap-4 font-bold", isTransfereeOnlyCoordinator ? "grid-cols-1" : "grid-cols-3")}>
                        {!isTransfereeOnlyCoordinator && <button
                          type="button"
                          onClick={() => {
                            form.setValue("learnerType", "NEW_ENROLLEE", { shouldDirty: true, shouldValidate: true });
                            replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                          }}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                            form.watch('learnerType') === "NEW_ENROLLEE"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground"
                          )}
                        >
                          New Entrant
                        </button>}
                        <button
                          type="button"
                          onClick={() => form.setValue("learnerType", "TRANSFEREE", { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                            form.watch('learnerType') === "TRANSFEREE"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground"
                          )}
                        >
                          Transferee
                        </button>
                        {!isTransfereeOnlyCoordinator && <button
                          type="button"
                          onClick={() => {
                            form.setValue("learnerType", "RETURNING", { shouldDirty: true, shouldValidate: true });
                            replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                          }}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                            form.watch('learnerType') === "RETURNING"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground"
                          )}
                        >
                          Returnee
                        </button>}
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <div className="space-y-4">

                        {form.watch('learnerType') === "TRANSFEREE" ? (
                          <FormField
                            control={form.control}
                            name="lrn"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex justify-between font-bold">
                                  <span>Learner Reference Number (LRN) <span className="text-destructive">*</span></span>
                                  {isLookingUp && <Loader2 className="w-4 h-4  text-primary" />}
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      placeholder="12-digit Learner Reference Number (LRN)"
                                      disabled={false}
                                      className="uppercase font-bold"
                                      value={field.value ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                        field.onChange(val);
                                        if (val.length === 12) {
                                          handleLrnLookup(val);
                                        }
                                      }}
                                      onBlur={() => {
                                        field.onBlur();
                                        const value = field.value ?? "";
                                        if (value.length === 12 && value !== lastLookedUpLrn.current) {
                                          handleLrnLookup(value);
                                        }
                                      }}
                                    />
                                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <>
                            <FormField
                              control={form.control}
                              name="lrn"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex justify-between font-bold">
                                    <span>Learner Reference Number (LRN)</span>
                                    {isLookingUp && <Loader2 className="w-4 h-4  text-primary" />}
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        placeholder="12-digit Learner Reference Number (LRN)"
                                        disabled={noLrn}
                                        className="uppercase font-bold"
                                        value={field.value ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                          field.onChange(val);
                                          if (val.length === 12) {
                                            handleLrnLookup(val);
                                          }
                                        }}
                                        onBlur={() => {
                                          field.onBlur();
                                          const value = field.value ?? "";
                                          if (value.length === 12 && value !== lastLookedUpLrn.current) {
                                            handleLrnLookup(value);
                                          }
                                        }}
                                      />
                                      <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex items-center space-x-2 -mt-2">
                              <Checkbox
                                id="noLrn"
                                checked={noLrn}
                                onCheckedChange={(checked) => {
                                  const isChecked = checked === true;
                                  setNoLrn(isChecked);
                                  if (isChecked) {
                                    form.setValue("lrn", "");
                                    form.clearErrors("lrn");
                                  }
                                }}
                              />
                              <label htmlFor="noLrn" className="text-base  leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground font-bold">
                                Learner has no LRN yet
                              </label>
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-[120px_1fr] gap-6">
                          {/* LEFT COLUMN: Photo */}
                          <div className="flex flex-col space-y-2 items-center">
                            <FormLabel className="font-bold capitalize whitespace-nowrap">Learner's Photo <span className="text-destructive">*</span></FormLabel>
                            <div className="relative group w-[120px]">
                              <UserPhoto
                                photo={form.watch("studentPhoto")}
                                containerClassName={cn(
                                  "w-[120px] h-[120px] rounded-lg border-2 border-dashed transition-all duration-200",
                                  form.watch("studentPhoto")
                                    ? "border-primary/50 bg-background"
                                    : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80",
                                )}
                                fallbackIcon={
                                  <div className="flex flex-col items-center justify-center text-foreground group-hover:text-primary transition-colors h-full w-full">
                                    <Camera className="w-8 h-8 mb-1" />
                                    <span className="text-[0.625rem] uppercase font-bold text-center leading-tight">Upload<br/>Photo</span>
                                  </div>
                                }>
                                {form.watch("studentPhoto") && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); form.setValue("studentPhoto", "", { shouldDirty: true }); }}
                                    type="button"
                                    className="absolute top-1 right-1 p-1 bg-primary text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20">
                                    <X strokeWidth={3} className="w-3 h-3" />
                                  </button>
                                )}
                              </UserPhoto>
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10 w-full h-full"
                                accept="image/jpeg,image/png,image/jpg"
                                title="Upload learner's photo"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 5 * 1024 * 1024) {
                                    alert("File size must be less than 5MB");
                                    return;
                                  }
                                  if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
                                    alert("Only JPG and PNG files are accepted");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    form.setValue("studentPhoto", reader.result as string, { shouldDirty: true });
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </div>
                            <AnimatedError error={form.formState.errors.studentPhoto?.message as string} />
                          </div>

                          {/* RIGHT COLUMN: Dense Data Grid */}
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 font-bold">
                              <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">Last Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl><Input placeholder="e.g. DELA CRUZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">First Name <span className="text-destructive">*</span></FormLabel>
                                    <FormControl><Input placeholder="e.g. JUAN" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4 font-bold">
                              <FormField
                                control={form.control}
                                name="middleName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">Middle Name</FormLabel>
                                    <FormControl><Input placeholder="e.g. PEREZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="extensionName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-bold capitalize">Suffix (Extension)</FormLabel>
                                    <Select
                                      onValueChange={(val) => field.onChange(val === "NONE" ? "" : val)}
                                      value={field.value || "NONE"}>
                                      <SelectTrigger className="font-bold">
                                        <SelectValue placeholder="Select Suffix" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NONE">None</SelectItem>
                                        {["Jr.", "Sr.", "II", "III", "IV", "V"].map((opt) => (
                                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="birthdate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Birthdate <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <HybridDatePicker value={field.value} onChange={field.onChange} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="sex"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Sex <span className="text-destructive">*</span></FormLabel>
                                <div className="flex gap-4">
                                  {(
                                    [
                                      { val: "MALE", icon: Mars, label: "Male" },
                                      { val: "FEMALE", icon: Venus, label: "Female" },
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
                                          : "border-border hover:bg-muted/50 text-foreground"
                                      )}>
                                      <s.icon
                                        className={cn(
                                          "w-4 h-4",
                                          field.value === s.val ? "text-primary" : "text-foreground"
                                        )}
                                      />
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 font-bold">
                          <FormField
                            control={form.control}
                            name="motherTongue"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Mother Tongue <span className="text-destructive">*</span></FormLabel>
                                <div className={cn("grid gap-2", isOtherMotherTongue ? "grid-cols-2" : "grid-cols-1")}>
                                  <FormControl>
                                    <SearchableCombobox
                                      items={MOTHER_TONGUE_OPTIONS}
                                      value={
                                        isOtherMotherTongue
                                          ? "Others"
                                          : MOTHER_TONGUE_OPTIONS.some((o) => o.value === field.value)
                                            ? (field.value ?? "")
                                            : ""
                                      }
                                      onChange={(val) => {
                                        if (val === "Others") {
                                          setIsOtherMotherTongue(true);
                                          field.onChange("");
                                        } else {
                                          setIsOtherMotherTongue(false);
                                          field.onChange(val);
                                        }
                                      }}
                                      placeholder="Select Mother Tongue"
                                      className="uppercase font-bold"
                                    />
                                  </FormControl>
                                  {isOtherMotherTongue && (
                                    <FormControl>
                                      <Input
                                        placeholder="Please specify mother tongue"
                                        className="font-bold uppercase"
                                        {...field}
                                        value={field.value || ""}
                                        autoFocus
                                      />
                                    </FormControl>
                                  )}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="gradeLevelId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">Incoming Grade Level <span className="text-destructive">*</span></FormLabel>
                              <div className="grid grid-cols-4 gap-4">
                                {activeSchoolYear?.gradeLevels?.map((gl) => (
                                  <button
                                    key={gl.id}
                                    type="button"
                                    onClick={() => {
                                      if (assignedGradeLevelId) return;
                                      field.onChange(gl.id);
                                      replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                    }}
                                    className={cn(
                                      "flex items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === gl.id
                                        ? getGradeLevelBadgeStyles(gl.name) + " border-current"
                                        : "border-border hover:bg-muted/50 text-foreground",
                                      assignedGradeLevelId && field.value !== gl.id && "opacity-50 cursor-not-allowed"
                                    )}>
                                    {gl.name}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="assignedProgram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">Curriculum Type <span className="text-destructive">*</span></FormLabel>
                              <div className="flex gap-4">
                                {programOptions.map((prog) => (
                                  <button
                                    key={prog.val}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(prog.val);
                                      replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                    }}
                                    className={cn(
                                      "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === prog.val
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}>
                                    {prog.label}
                                  </button>
                                ))}
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="learningModalities"
                          render={({ field }) => (
                            <FormItem className="col-span-full pt-4 border-t border-border mt-6">
                              <div className="flex flex-col space-y-1 mb-4">
                                <FormLabel className="text-base font-bold uppercase text-foreground">
                                  Alternative Learning Modality Preferences <span className="text-destructive">*</span>
                                </FormLabel>
                                <p className="text-sm">
                                  If the school will implement other distance learning modalities aside from face-to-face instruction, what would you prefer for your child? (Check all that applies)
                                </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {([
                                  { value: "BLENDED", label: "Blended (Combination)" },
                                  { value: "EDUCATIONAL_TELEVISION", label: "Educational Television" },
                                  { value: "HOMESCHOOLING", label: "Homeschooling" },
                                  { value: "MODULAR_DIGITAL", label: "Modular (Digital)" },
                                  { value: "MODULAR_PRINT", label: "Modular (Print)" },
                                  { value: "ONLINE", label: "Online" },
                                  { value: "RADIO_BASED_TELEVISION", label: "Radio-Based Television" },
                                ] as const).map((option) => (
                                  <div key={option.value} className="flex items-center space-x-3">
                                    <Checkbox
                                      id={`walkin-modality-${option.value}`}
                                      checked={field.value?.includes(option.value as any)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const next = checked
                                          ? [...current, option.value as any]
                                          : current.filter((val: string) => val !== option.value);
                                        field.onChange(next as any);
                                      }}
                                      className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary bg-white"
                                    />
                                    <Label htmlFor={`walkin-modality-${option.value}`} className="text-base font-bold cursor-pointer text-slate-700">
                                      {option.label}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* BACKGROUND & SPECIAL CATEGORIES BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border flex items-center justify-between gap-4">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Background & Special Categories
                      </span>
                    </div>
                    <div className="px-5 pt-4 pb-5 space-y-8">
                      {/* IP Community */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base leading-tight font-bold flex items-center gap-2">
                            Is the learner a member of an IP cultural community?
                          </FormLabel>
                          <Badge
                            variant="outline"
                            className="text-sm uppercase border-primary/20 text-primary gap-1 font-bold">
                            <Lock className="w-2.5 h-2.5" /> Confidential
                          </Badge>
                        </div>
                        <div id="isIpCommunity" className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => form.setValue("isIpCommunity", false, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("isIpCommunity") === false
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">No</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => form.setValue("isIpCommunity", true, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("isIpCommunity") === true
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">Yes</span>
                          </button>
                        </div>
                        <AnimatedError error={form.formState.errors.isIpCommunity?.message as string} />
                        <AnimatePresence>
                          {form.watch("isIpCommunity") && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden p-1">
                              <div className="pt-4 space-y-2 w-full">
                                <FormLabel htmlFor="ip-group" className="font-bold uppercase">
                                  Specify IP Group Name
                                </FormLabel>
                                <Input
                                  autoComplete="off"
                                  id="ip-group"
                                  {...form.register("ipGroupName")}
                                  placeholder="e.g. Ati, Mangyan"
                                  className={cn("h-11 font-bold uppercase", form.formState.errors.ipGroupName && "border-destructive focus-visible:ring-destructive")}
                                />
                                <AnimatedError error={form.formState.errors.ipGroupName?.message as string} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* 4Ps Beneficiary */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base leading-tight font-bold">
                            Does the learner's household currently receive benefits under the 4Ps?
                          </FormLabel>
                          <Badge
                            variant="outline"
                            className="text-sm uppercase border-primary/20 text-primary gap-1 font-bold">
                            <Lock className="w-2.5 h-2.5" /> Confidential
                          </Badge>
                        </div>
                        <div id="is4PsBeneficiary" className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => form.setValue("is4PsBeneficiary", false, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("is4PsBeneficiary") === false
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">No</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => form.setValue("is4PsBeneficiary", true, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("is4PsBeneficiary") === true
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">Yes</span>
                          </button>
                        </div>
                        <AnimatedError error={form.formState.errors.is4PsBeneficiary?.message as string} />
                        <AnimatePresence>
                          {form.watch("is4PsBeneficiary") && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden p-1">
                              <div className="pt-4 space-y-2 w-full">
                                <FormLabel htmlFor="household-id" className="font-bold uppercase">
                                  4Ps Household ID Number
                                </FormLabel>
                                <Input
                                  autoComplete="off"
                                  id="household-id"
                                  {...form.register("householdId4Ps")}
                                  placeholder="Household ID"
                                  className={cn("h-11 font-bold uppercase", form.formState.errors.householdId4Ps && "border-destructive focus-visible:ring-destructive")}
                                />
                                <AnimatedError error={form.formState.errors.householdId4Ps?.message as string} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Balik Aral */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base leading-tight font-bold">
                            Is this learner returning to school after a gap of 1 year or more? (Balik-Aral)
                          </FormLabel>
                          <Badge
                            variant="outline"
                            className="text-sm uppercase border-primary/20 text-primary gap-1 font-bold">
                            <Lock className="w-2.5 h-2.5" /> Confidential
                          </Badge>
                        </div>
                        <div id="isBalikAral" className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => form.setValue("isBalikAral", false, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("isBalikAral") === false
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">No</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => form.setValue("isBalikAral", true, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("isBalikAral") === true
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">Yes</span>
                          </button>
                        </div>
                        <AnimatedError error={form.formState.errors.isBalikAral?.message as string} />
                      </div>

                      {/* SNED / Disability */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base leading-tight font-bold">
                            Is the learner under the Special Needs Education Program?
                          </FormLabel>
                          <Badge
                            variant="outline"
                            className="text-sm uppercase border-primary/20 text-primary gap-1 font-bold">
                            <Lock className="w-2.5 h-2.5" /> Confidential
                          </Badge>
                        </div>
                        <div id="isLearnerWithDisability" className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              form.setValue("isLearnerWithDisability", false, { shouldValidate: true, shouldDirty: true });
                              form.setValue("specialNeedsCategory", undefined, { shouldValidate: true, shouldDirty: true });
                              form.setValue("disabilityTypes", [], { shouldValidate: true, shouldDirty: true });
                              form.setValue("hasPwdId", false, { shouldValidate: true, shouldDirty: true });
                            }}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("isLearnerWithDisability") === false
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">No</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => form.setValue("isLearnerWithDisability", true, { shouldValidate: true, shouldDirty: true })}
                            className={cn(
                              "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                              form.watch("isLearnerWithDisability") === true
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                            )}>
                            <span className="font-bold text-base leading-tight">Yes</span>
                          </button>
                        </div>
                        <AnimatedError error={form.formState.errors.isLearnerWithDisability?.message as string} />

                        <AnimatePresence>
                          {form.watch("isLearnerWithDisability") && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden p-1">
                              <div className="pt-4 space-y-6">
                                <p className="text-base font-bold uppercase text-foreground">
                                  If Yes, check only 1, either from a1 or a2
                                </p>
                                <AnimatedError error={form.formState.errors.specialNeedsCategory?.message as string} />

                                {/* a1 */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id="sned-a1"
                                      checked={form.watch("specialNeedsCategory") === "a1"}
                                      onCheckedChange={(checked) => {
                                        form.setValue(
                                          "specialNeedsCategory",
                                          checked ? "a1" : undefined,
                                          { shouldValidate: true, shouldDirty: true }
                                        );
                                        form.setValue("disabilityTypes", [], { shouldValidate: true, shouldDirty: true });
                                      }}
                                      className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                    />
                                    <FormLabel htmlFor="sned-a1" className="text-base leading-tight font-bold cursor-pointer">
                                      a1. With Diagnosis from Licensed Medical Specialist
                                    </FormLabel>
                                  </div>
                                  <AnimatePresence>
                                    {form.watch("specialNeedsCategory") === "a1" && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden">
                                        <div className="ml-7 mt-2 p-4 border border-border/60 bg-muted/10 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {DISABILITY_TYPES_A1.map((type) => {
                                            const isChecked = form.watch("disabilityTypes")?.includes(type);
                                            const subOptions = type === "Special Health Problem/Chronic Disease"
                                              ? SPECIAL_HEALTH_SUB_OPTIONS
                                              : type === "Visual Impairment"
                                                ? VISUAL_IMPAIRMENT_SUB_OPTIONS
                                                : null;

                                            return (
                                              <div key={type} className="flex flex-col space-y-3">
                                                <div className="flex items-center space-x-3">
                                                  <Checkbox
                                                    id={`disability-${type}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => {
                                                      const current = form.watch("disabilityTypes") || [];
                                                      let newTypes = checked ? [...current, type] : current.filter((t) => t !== type);
                                                      if (!checked && subOptions) {
                                                        newTypes = newTypes.filter(t => !subOptions.includes(t));
                                                      }
                                                      form.setValue("disabilityTypes", newTypes, { shouldValidate: true, shouldDirty: true });
                                                    }}
                                                    className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                                  />
                                                  <FormLabel htmlFor={`disability-${type}`} className="text-base leading-tight font-bold cursor-pointer">
                                                    {type}
                                                  </FormLabel>
                                                </div>

                                                <AnimatePresence>
                                                  {isChecked && subOptions && (
                                                    <motion.div
                                                      initial={{ height: 0, opacity: 0 }}
                                                      animate={{ height: "auto", opacity: 1 }}
                                                      exit={{ height: 0, opacity: 0 }}
                                                      className="overflow-hidden ml-7 flex flex-col space-y-3"
                                                    >
                                                      {subOptions.map((subType) => (
                                                        <div key={subType} className="flex items-center space-x-3">
                                                          <Checkbox
                                                            id={`disability-${subType}`}
                                                            checked={form.watch("disabilityTypes")?.includes(subType)}
                                                            onCheckedChange={(checked) => {
                                                              const current = form.watch("disabilityTypes") || [];
                                                              const withoutOtherSubOptions = current.filter(t => !subOptions.includes(t));
                                                              form.setValue(
                                                                "disabilityTypes",
                                                                checked ? [...withoutOtherSubOptions, subType] : current.filter((t) => t !== subType),
                                                                { shouldValidate: true, shouldDirty: true }
                                                              );
                                                            }}
                                                            className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                                          />
                                                          <FormLabel htmlFor={`disability-${subType}`} className="text-sm leading-tight font-bold cursor-pointer">
                                                            {subType}
                                                          </FormLabel>
                                                        </div>
                                                      ))}
                                                    </motion.div>
                                                  )}
                                                </AnimatePresence>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <AnimatedError error={form.formState.errors.disabilityTypes?.message as string} />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* a2 */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id="sned-a2"
                                      checked={form.watch("specialNeedsCategory") === "a2"}
                                      onCheckedChange={(checked) => {
                                        form.setValue(
                                          "specialNeedsCategory",
                                          checked ? "a2" : undefined,
                                          { shouldValidate: true, shouldDirty: true }
                                        );
                                        form.setValue("disabilityTypes", [], { shouldValidate: true, shouldDirty: true });
                                      }}
                                      className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                    />
                                    <FormLabel htmlFor="sned-a2" className="text-base leading-tight font-bold cursor-pointer">
                                      a2. With Manifestations
                                    </FormLabel>
                                  </div>
                                  <AnimatePresence>
                                    {form.watch("specialNeedsCategory") === "a2" && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden">
                                        <div className="ml-7 mt-2 p-4 border border-border/60 bg-muted/10 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {DISABILITY_TYPES_A2.map((type) => (
                                            <div key={type} className="flex items-center space-x-3">
                                              <Checkbox
                                                id={`disability-${type}`}
                                                checked={form.watch("disabilityTypes")?.includes(type)}
                                                onCheckedChange={(checked) => {
                                                  const current = form.watch("disabilityTypes") || [];
                                                  form.setValue(
                                                    "disabilityTypes",
                                                    checked ? [...current, type] : current.filter((t) => t !== type),
                                                    { shouldValidate: true, shouldDirty: true }
                                                  );
                                                }}
                                                className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary"
                                              />
                                              <FormLabel htmlFor={`disability-${type}`} className="text-base leading-tight font-bold cursor-pointer">
                                                {type}
                                              </FormLabel>
                                            </div>
                                          ))}
                                        </div>
                                        <AnimatedError error={form.formState.errors.disabilityTypes?.message as string} />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* b. PWD ID */}
                                <div className="space-y-2">
                                  <FormLabel className="text-base leading-tight font-bold">
                                    b. Does the Learner have a PWD ID?
                                  </FormLabel>
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => form.setValue("hasPwdId", false, { shouldValidate: true, shouldDirty: true })}
                                      className={cn(
                                        "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                                        !form.watch("hasPwdId")
                                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                                          : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                                      )}>
                                      <span className="font-bold text-base leading-tight">No</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => form.setValue("hasPwdId", true, { shouldValidate: true, shouldDirty: true })}
                                      className={cn(
                                        "flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-14 uppercase",
                                        form.watch("hasPwdId")
                                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                                          : "border-border bg-muted hover:bg-primary/5 text-foreground hover:text-foreground",
                                      )}>
                                      <span className="font-bold text-base leading-tight">Yes</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                  
                  {/* CURRENT HOME ADDRESS BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        CURRENT HOME ADDRESS
                      </span>
                    </div>
                    <div className="px-5 pt-4 pb-5 space-y-4">
                      
                      <PhilippineAddressSelector
                        value={{
                          region: form.watch("addressRegion") || "",
                          province: form.watch("addressProvince") || "",
                          cityMunicipality: form.watch("addressCity") || "",
                          barangay: form.watch("addressBarangay") || "",
                        }}
                        onChange={(updates) => {
                          if (updates.region !== undefined) form.setValue("addressRegion", updates.region, { shouldValidate: updates.region !== "", shouldDirty: true });
                          if (updates.province !== undefined) form.setValue("addressProvince", updates.province, { shouldValidate: updates.province !== "", shouldDirty: true });
                          if (updates.cityMunicipality !== undefined) form.setValue("addressCity", updates.cityMunicipality, { shouldValidate: updates.cityMunicipality !== "", shouldDirty: true });
                          if (updates.barangay !== undefined) form.setValue("addressBarangay", updates.barangay, { shouldValidate: updates.barangay !== "", shouldDirty: true });
                        }}
                        errors={{
                          region: form.formState.errors.addressRegion?.message as string,
                          province: form.formState.errors.addressProvince?.message as string,
                          cityMunicipality: form.formState.errors.addressCity?.message as string,
                          barangay: form.formState.errors.addressBarangay?.message as string,
                        }}
                        required={true}
                      />

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name="addressSitio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">Sitio / Purok</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Sitio Calambuga" className="uppercase font-bold" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="addressStreet"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">House No. / Street</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. 123 or Rizal Street" className="uppercase font-bold" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                    </div>
                  </div>

                  {/* PREVIOUS SCHOOL BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Previous School Data
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4 space-y-4">
                      <div>
                        <FormField
                          control={form.control}
                          name="previousSchoolName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">
                                {form.watch('learnerType') === "TRANSFEREE" ? "Transferred From (Previous School)" : "School Name"}
                                <span className="text-destructive"> *</span>
                              </FormLabel>
                              <FormControl><Input placeholder="e.g. RIZAL ELEMENTARY SCHOOL" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      {form.watch("learnerType") === "TRANSFEREE" && (
                        <FormField
                          control={form.control}
                          name="lastGradeCompleted"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold">Last Grade Completed</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Grade 7" className="font-bold" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <div className={form.watch('learnerType') === "TRANSFEREE" ? "grid grid-cols-3 gap-4" : "flex gap-4"}>
                        <div className={form.watch('learnerType') === "TRANSFEREE" ? "" : "flex-1"}>
                          <FormField
                            control={form.control}
                            name="originatingSchoolId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Originating School ID <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g. 123456"
                                    className="font-bold"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                      field.onChange(val);
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        {form.watch('learnerType') === "TRANSFEREE" && (
                          <div>
                            <FormField
                              control={form.control}
                              name="transferCertificateNo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-bold capitalize">Transfer Certificate No.</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g. 98765"
                                      className="font-bold uppercase"
                                      {...field}
                                      value={field.value ?? ""}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        <div className={form.watch('learnerType') === "TRANSFEREE" ? "" : "flex-1"}>
                          <FormField
                            control={form.control}
                            name="previousGenAve"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Final Gen Ave</FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-bold"
                                    type="number"
                                    step="0.01"
                                    min={75}
                                    max={99.99}
                                    placeholder="e.g. 85.50"
                                    value={field.value ?? ""}
                                    onChange={(e) => {
                                      if (e.target.value === "") {
                                        field.onChange(undefined);
                                        return;
                                      }
                                      const num = Number(e.target.value);
                                      field.onChange(Math.min(num, 99.99));
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <div>
                        <FormField
                          control={form.control}
                          name="sf9EligibilityStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold capitalize">SF9 Eligibility Status <span className="text-destructive">*</span></FormLabel>
                              <div className="flex gap-4">
                                {[
                                  { val: "PROMOTED", label: "Promoted" },
                                  { val: "CONDITIONALLY_PROMOTED", label: "Conditionally Promoted" },
                                  { val: "RETAINED", label: "Retained" },
                                ].map((s) => (
                                  <button
                                    key={s.val}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(s.val);
                                      if (s.val !== "CONDITIONALLY_PROMOTED") {
                                        replaceConditionalSubjects([{ subjectCode: "", grade: "" as unknown as number }]);
                                      }
                                    }}
                                    className={cn(
                                      "flex flex-1 items-center justify-center rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight font-bold uppercase",
                                      field.value === s.val
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {requiresBackSubjects && (
                          <div className="mt-4 rounded-lg border border-border bg-muted/10 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                              <FormLabel className="font-bold">
                                {atlasSubjectsQuery.data
                                  ? `Grade ${atlasSubjectsQuery.data.meta.subjectGradeLevel} Back Subjects`
                                  : "Previous Grade Back Subjects"}{" "}
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <span className="text-sm text-muted-foreground">
                                (Maximum of 2 subjects)
                              </span>
                            </div>

                            <div className="space-y-4">
                              {conditionalSubjectFields.map((fieldItem, index) => {
                                const selectedSubjectCodes = form.watch("conditionalSubjects").map(s => s.subjectCode);
                                
                                return (
                                  <div key={fieldItem.id} className="grid grid-cols-12 gap-4 items-start relative">
                                    <div className="col-span-8 relative">
                                      <FormField
                                        control={form.control}
                                        name={`conditionalSubjects.${index}.subjectCode`}
                                        render={({ field, fieldState }) => {
                                          // Exclude subjects that are selected in OTHER rows
                                          const availableSubjects = (atlasSubjectsQuery.data?.data ?? []).filter(
                                            subject => !selectedSubjectCodes.includes(subject.code) || subject.code === field.value
                                          );
                                          
                                          return (
                                            <FormItem className="relative">
                                              <FormControl>
                                                <div className={cn("relative flex items-center w-full", fieldState.error && "border-destructive")}>
                                                  <Select onValueChange={field.onChange} value={field.value || ""}>
                                                    <SelectTrigger 
                                                      className={cn("w-full font-bold", fieldState.error && "border-destructive focus-visible:ring-destructive")}
                                                      disabled={atlasSubjectsQuery.isLoading || atlasSubjectsQuery.isError || (atlasSubjectsQuery.data?.data.length ?? 0) === 0}
                                                    >
                                                      <SelectValue placeholder="Search subject..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {availableSubjects.map((subject) => (
                                                        <SelectItem key={subject.code} value={subject.code} className="font-bold">
                                                          {subject.name}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </FormControl>
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    </div>
                                    <div className="col-span-4 relative flex items-start gap-2">
                                      <FormField
                                        control={form.control}
                                        name={`conditionalSubjects.${index}.grade`}
                                        render={({ field, fieldState }) => (
                                          <FormItem className="flex-1 relative">
                                            <FormControl>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <div className="relative">
                                                      <Input
                                                        {...field}
                                                        type="number"
                                                        min={60}
                                                        max={75}
                                                        maxLength={2}
                                                        placeholder="Rating"
                                                        className={cn(
                                                          "font-bold pr-8",
                                                          fieldState.error && "border-destructive focus-visible:ring-destructive"
                                                        )}
                                                        value={field.value || ""}
                                                      />
                                                      {fieldState.error && (
                                                        <AlertCircle className="w-4 h-4 text-destructive absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                      )}
                                                    </div>
                                                  </TooltipTrigger>
                                                  {fieldState.error && (
                                                    <TooltipContent side="top" className="bg-destructive text-destructive-foreground font-bold text-xs">
                                                      Grade must be between 60-75
                                                    </TooltipContent>
                                                  )}
                                                </Tooltip>
                                              </TooltipProvider>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                      {index > 0 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                                          onClick={() => removeConditionalSubject(index)}
                                        >
                                          <span className="text-xl leading-none">&times;</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {conditionalSubjectFields.length < 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground font-bold hover:text-foreground mt-2"
                                onClick={() => appendConditionalSubject({ subjectCode: "", grade: "" as unknown as number })}
                              >
                                <Plus className="w-4 h-4 mr-2" /> Add Second Subject
                              </Button>
                            )}

                            {gradeLevelId <= 0 || !assignedProgram ? (
                              <p className="text-sm text-foreground mt-4">
                                Select the learner&apos;s incoming grade level and curriculum first.
                              </p>
                            ) : atlasSubjectsQuery.isLoading ? (
                              <div className="flex items-center gap-2 text-sm text-foreground mt-4">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                Loading Grade {gradeLevelId - 1} subjects from ATLAS...
                              </div>
                            ) : atlasSubjectsQuery.isError ? (
                              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 mt-4">
                                <p className="text-sm font-bold text-destructive">
                                  {getWalkInErrorMessage(atlasSubjectsQuery.error, "ATLAS subjects could not be loaded.")}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void atlasSubjectsQuery.refetch()}
                                >
                                  Retry
                                </Button>
                              </div>
                            ) : (atlasSubjectsQuery.data?.data.length ?? 0) === 0 ? (
                              <p className="text-sm text-amber-800 mt-4">
                                ATLAS returned no Grade {gradeLevelId - 1} subjects for the selected curriculum.
                              </p>
                            ) : null}
                            <p className="text-sm">
                              ATLAS subjects are filtered for the grade immediately before the learner&apos;s incoming grade and the selected curriculum.
                            </p>
                            
                            {/* Display array-level errors directly from formState */}
                            {form.formState.errors.conditionalSubjects?.root?.message && (
                              <p className="text-[0.8rem] font-medium text-destructive">
                                {form.formState.errors.conditionalSubjects.root.message}
                              </p>
                            )}
                            {form.formState.errors.conditionalSubjects?.message && typeof form.formState.errors.conditionalSubjects.message === 'string' && (
                              <p className="text-[0.8rem] font-medium text-destructive">
                                {form.formState.errors.conditionalSubjects.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* EMERGENCY CONTACT BLOCK */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground bg-muted/5 border-b border-border">
                      <span className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        Emergency Contact
                      </span>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 font-bold">
                          <FormField
                            control={form.control}
                            name="guardianFirstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">First Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. MARIA" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianMiddleName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Middle Name</FormLabel>
                                <FormControl><Input placeholder="e.g. SANTOS" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianLastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Last Name <span className="text-destructive">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. DELA CRUZ" className="uppercase font-bold" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="guardianContact"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Contact Number <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-bold"
                                    placeholder="e.g. 09123456789"
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                      field.onChange(val);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="guardianRelationship"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-bold capitalize">Relationship to Learner <span className="text-destructive">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                  <FormControl>
                                    <SelectTrigger className="font-bold uppercase">
                                      <SelectValue placeholder="SELECT RELATIONSHIP" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="MOTHER" className="font-bold uppercase">Mother</SelectItem>
                                    <SelectItem value="FATHER" className="font-bold uppercase">Father</SelectItem>
                                    <SelectItem value="GUARDIAN" className="font-bold uppercase">Guardian</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CHECKLIST */}
                  <div className="w-full p-4 sm:p-5 border border-border rounded-xl flex flex-col gap-5 bg-card shadow-sm">
                    <h4 className="flex items-center gap-2 text-base font-bold  uppercase tracking-wide">
                      <FileCheck className="w-4 h-4 text-primary" />
                      Required Documents
                    </h4>

                    <FormField
                      control={form.control}
                      name="hasSf9"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              id="sf9-checkbox"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1 h-5 w-5 rounded-sm border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor="sf9-checkbox" className="text-base font-bold text-foreground cursor-pointer select-none">
                              Physical SF9 Verified
                            </label>
                            <span className="text-sm text-foreground leading-snug">
                              Original report card signed by previous school principal.
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hasPsa"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              id="psa-checkbox"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1 h-5 w-5 rounded-sm border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor="psa-checkbox" className="text-base font-bold text-foreground cursor-pointer select-none">
                              PSA Birth Certificate Verified
                            </label>
                            <span className="text-sm text-foreground leading-snug">
                              Clear copy of Philippine Statistics Authority issued certificate.
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* SECTION ASSIGNMENT BLOCK */}
                  <div className="w-full p-4 sm:p-5 border border-border rounded-xl flex flex-col gap-5 bg-card shadow-sm">
                    <h4 className="flex items-center gap-2 text-base font-bold uppercase tracking-wide">
                      <FileCheck className="w-4 h-4 text-primary" />
                      Section Assignment
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="sectionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold capitalize">Section (Optional)</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "UNASSIGNED" ? undefined : Number(val))}
                            value={field.value ? String(field.value) : "UNASSIGNED"}
                            disabled={!gradeLevelId || !assignedProgram || sectionsQuery.isLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="font-bold uppercase">
                                <SelectValue placeholder={!gradeLevelId || !assignedProgram ? "SELECT GRADE LEVEL FIRST" : sectionsQuery.isLoading ? "LOADING SECTIONS..." : "AUTO-ASSIGN SECTION (UNSECTIONED POOL)"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="UNASSIGNED">AUTO-ASSIGN SECTION (UNSECTIONED POOL)</SelectItem>
                              {sectionsQuery.data?.map((sec) => (
                                <SelectItem key={sec.id} value={String(sec.id)} disabled={sec.enrolledCount >= sec.maxCapacity} className="font-bold uppercase">
                                  {sec.name} {sec.enrolledCount >= sec.maxCapacity ? "(FULL)" : `(${sec.enrolledCount}/${sec.maxCapacity})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-foreground leading-snug">
                            Selecting a section will immediately enroll this learner in that section.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-border grid grid-cols-2 gap-3 shrink-0">
                <Button
                  variant="outline"
                  type="button"
                  onClick={requestClosePanel}
                  disabled={isSubmitting}
                  className="w-full font-bold uppercase text-base border-border px-6 cursor-pointer bg-background text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={`w-full font-bold uppercase text-base px-6 ${(!isValid || isSubmitting)
                    ? 'bg-muted text-foreground cursor-not-allowed'
                    : isCompleteDocs
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                      : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                    }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4  mr-2" />
                  ) : (
                    isCompleteDocs ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />
                  )}
                  {isCompleteDocs ? "Officially Enroll" : "Temporary Enroll"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>

      <LearnerFoundModal
        isOpen={isLearnerModalOpen}
        onOpenChange={setIsLearnerModalOpen}
        learnerName={pendingProfile ? [pendingProfile.firstName, pendingProfile.middleName, pendingProfile.lastName, pendingProfile.extensionName].filter(Boolean).join(" ") : ""}
        lrn={form.getValues("lrn") || ""}
        onProceed={() => {
          setIsLearnerModalOpen(false);
          applyPendingProfile();
          setPendingProfile(null);
        }}
        onCancel={() => {
          setIsLearnerModalOpen(false);
          setPendingProfile(null);
          form.setValue("lrn", "", { shouldValidate: true, shouldDirty: true });
        }}
      />
    </Dialog>
  );
}
