import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";
import { sileo } from "sileo";
import { ChevronDown, GraduationCap, Plus, Upload } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Button } from "@/shared/ui/button";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { TeacherDirectoryCard } from "../components/TeacherDirectoryCard";
import { TeacherFormSheet } from "@/features/teachers/components/TeacherFormSheet";
import { TeacherDesignationSheet } from "../components/TeacherDesignationSheet";
import type {
  AdvisorySectionOption,
  DesignationCollision,
  DesignationFormState,
  Teacher,
  TeacherDesignationFilter,
  TeacherFormState,
  TeacherStatusFilter,
} from "../types";
import {
  createEmptyTeacherForm,
  formatTeacherName,
  normalizeOptionalInput,
} from "../utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import { AlertTriangle, UserMinus, Loader2 } from "lucide-react";
import { TEACHER_DEACTIVATION_REASONS } from "@enrollpro/shared";

type TeacherFormField = keyof TeacherFormState;

const DEPED_EMAIL_DOMAIN = "deped.edu.ph";

interface TeacherUpsertPayload {
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string;
  employeeId: string;
  contactNumber: string | null;
  sex: "MALE" | "FEMALE";
  specialization: string | null;
  department: string | null;
  plantillaPosition: string | null;
  subjects?: string[];
}

function normalizeTeacherFieldValue(
  field: TeacherFormField,
  value: string,
): string {
  if (field === "contactNumber") {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 11);
    if (!digitsOnly) {
      return "";
    }

    const firstPart = digitsOnly.slice(0, 4);
    const secondPart = digitsOnly.slice(4, 7);
    const thirdPart = digitsOnly.slice(7, 11);

    return [firstPart, secondPart, thirdPart].filter(Boolean).join("-");
  }

  // Preserve case for select-based fields, emails, and sex
  if (
    field === "email" ||
    field === "department" ||
    field === "plantillaPosition" ||
    field === "specialization" ||
    field === "sex"
  ) {
    return value;
  }

  return value.toUpperCase();
}

function isValidContactNumber(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length === 0 || /^\d{11}$/.test(digitsOnly);
}

function normalizeEmailLocalPartSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
}

function buildAutoDepedEmail(firstName: string, lastName: string): string {
  const firstSegment = normalizeEmailLocalPartSegment(firstName);
  const lastSegment = normalizeEmailLocalPartSegment(lastName);

  if (!firstSegment || !lastSegment) {
    return "";
  }

  return `${firstSegment}.${lastSegment}@${DEPED_EMAIL_DOMAIN}`;
}

function createEmptyDesignationForm(): DesignationFormState {
  return {
    isClassAdviser: false,
    advisorySectionId: "",
    ancillaryRoles: [],
    designationNotes: "",
    effectiveFrom: "",
    effectiveTo: "",
    isCustomPeriod: false,
    reason: "",
  };
}

export default function Teachers() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [ayLabel, setAyLabel] = useState<string | null>(null);
  const [bosyDate, setBosyDate] = useState<string | null>(null);
  const [eosyDate, setEosyDate] = useState<string | null>(null);

  // Enterprise Standard: Delayed Skeleton for Initial Load (200ms delay)
  const showSkeleton = useDelayedLoading(loading && isInitialLoad, 200);

  // Enterprise Standard: Stale-While-Revalidate for Pagination/Refetch
  const isRefetching = loading && !isInitialLoad;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherToDeactivate, setTeacherToDeactivate] =
    useState<Teacher | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [reactivateId, setReactivateId] = useState<number | null>(null);
  const [designationOpenFor, setDesignationOpenFor] = useState<Teacher | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [advisorySections, setAdvisorySections] = useState<
    AdvisorySectionOption[]
  >([]);
  const [advisorySectionsLoading, setAdvisorySectionsLoading] = useState(false);
  const [designationCollision, setDesignationCollision] =
    useState<DesignationCollision | null>(null);
  const [allowCollisionOverride, setAllowCollisionOverride] = useState(false);
  const [designationDrawerTab, setDesignationDrawerTab] = useState<
    "designation" | "schedule-notes" | "review"
  >("designation");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatusFilter>("all");
  const [designationFilter, setDesignationFilter] =
    useState<TeacherDesignationFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [formData, setFormData] = useState<TeacherFormState>(
    createEmptyTeacherForm,
  );
  const [isCreateEmailManuallyEdited, setIsCreateEmailManuallyEdited] =
    useState(false);

  const [editFormData, setEditFormData] = useState<TeacherFormState>(
    createEmptyTeacherForm,
  );

  const [designationForm, setDesignationForm] = useState<DesignationFormState>(
    createEmptyDesignationForm,
  );

  // Reset page when filters or limit change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, designationFilter, subjectFilter, limit]);

  const handleFieldChange = useCallback(
    (field: TeacherFormField, value: string | string[]) => {
      if (field === "subjects") {
        setFormData((prev) => ({
          ...prev,
          subjects: value as string[],
        }));
        return;
      }

      const normalizedValue = normalizeTeacherFieldValue(
        field,
        value as string,
      );

      if (field === "email") {
        if (normalizedValue.trim().length === 0) {
          setIsCreateEmailManuallyEdited(false);
          setFormData((prev) => ({
            ...prev,
            email: buildAutoDepedEmail(prev.firstName, prev.lastName),
          }));
          return;
        }

        setIsCreateEmailManuallyEdited(true);
        setFormData((prev) => ({
          ...prev,
          email: normalizedValue,
        }));
        return;
      }

      if (field === "firstName" || field === "lastName") {
        setFormData((prev) => {
          const nextData = {
            ...prev,
            [field]: normalizedValue,
          };

          if (!isCreateEmailManuallyEdited) {
            nextData.email = buildAutoDepedEmail(
              nextData.firstName,
              nextData.lastName,
            );
          }

          return nextData;
        });
        return;
      }

      setFormData((prev) => ({
        ...prev,
        [field]: normalizedValue,
      }));
    },
    [isCreateEmailManuallyEdited],
  );

  const handleEditFieldChange = useCallback(
    (field: TeacherFormField, value: string | string[]) => {
      if (field === "subjects") {
        setEditFormData((prev) => ({
          ...prev,
          subjects: value as string[],
        }));
        return;
      }

      setEditFormData((prev) => ({
        ...prev,
        [field]: normalizeTeacherFieldValue(field, value as string),
      }));
    },
    [],
  );

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/teachers", {
        params: ayId ? { schoolYearId: ayId } : undefined,
      });
      setTeachers(res.data.teachers || []);
      setAyLabel(res.data.scope?.yearLabel || null);
      setBosyDate(res.data.scope?.classOpeningDate || null);
      setEosyDate(res.data.scope?.classEndDate || null);
      setIsInitialLoad(false);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const fetchAdvisorySections = useCallback(async () => {
    if (!ayId) {
      setAdvisorySections([]);
      return;
    }

    setAdvisorySectionsLoading(true);
    try {
      const res = await api.get(`/sections/${ayId}`);
      const gradeLevelsData = res.data.gradeLevels || [];

      const options: AdvisorySectionOption[] = gradeLevelsData
        .flatMap((gl: { gradeLevelName: string; sections: Array<{ id: number; name: string; maxCapacity: number; enrolledCount: number; programType: string; isHomogeneous: boolean; advisingTeacher: { id: number; name: string } | null }> }) =>
          (gl.sections || []).map((section) => ({
            id: section.id,
            label: `${gl.gradeLevelName} - ${section.name}`,
            gradeLevelName: gl.gradeLevelName,
            sectionName: section.name,
            maxCapacity: section.maxCapacity,
            enrolledCount: section.enrolledCount,
            programType: section.programType,
            isHomogeneous: section.isHomogeneous,
            currentAdviserId: section.advisingTeacher?.id ?? null,
            currentAdviserName: section.advisingTeacher?.name ?? null,
          })),
        )
        .sort((a: AdvisorySectionOption, b: AdvisorySectionOption) => a.label.localeCompare(b.label));

      setAdvisorySections(options);
    } catch (err) {
      console.error("[fetchAdvisorySections Error]", err);
      toastApiError(err as never);
      setAdvisorySections([]);
    } finally {
      setAdvisorySectionsLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchAdvisorySections();
  }, [fetchAdvisorySections]);

  const handleCreate = useCallback(async () => {
    const payload: TeacherUpsertPayload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      middleName: normalizeOptionalInput(formData.middleName),
      email: formData.email.trim(),
      employeeId: formData.employeeId.trim(),
      contactNumber: normalizeOptionalInput(formData.contactNumber),
      specialization: normalizeOptionalInput(formData.specialization),
      department: normalizeOptionalInput(formData.department),
      plantillaPosition: normalizeOptionalInput(formData.plantillaPosition),
      subjects: formData.subjects,
    };

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.employeeId ||
      !payload.email
    ) {
      sileo.warning({
        title: "Missing Required Fields",
        description:
          "First name, last name, DepEd email address, and Employee ID are required.",
      });
      return;
    }

    if (!isValidContactNumber(formData.contactNumber)) {
      sileo.warning({
        title: "Invalid Contact Number",
        description: "Contact number must follow XXXX-XXX-XXXX (11 digits).",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/teachers", payload);
      sileo.success({
        title: "Teacher Created",
        description: `${payload.lastName}, ${payload.firstName} has been added.`,
      });
      setCreateOpen(false);
      setIsCreateEmailManuallyEdited(false);
      setFormData(createEmptyTeacherForm());
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  }, [formData, fetchTeachers]);

  const startEditing = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditFormData({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      middleName: teacher.middleName || "",
      email: teacher.email || "",
      employeeId: teacher.employeeId || "",
      contactNumber: normalizeTeacherFieldValue(
        "contactNumber",
        teacher.contactNumber || "",
      ),
      sex: teacher.sex,
      specialization: (teacher.specialization || "").toUpperCase(),
      department: (teacher.department || "").toUpperCase(),
      plantillaPosition: (teacher.plantillaPosition || "").toUpperCase(),
      subjects: teacher.subjects || [],
    });
    setEditOpen(true);
  };

  const closeEditSheet = useCallback(() => {
    setEditOpen(false);
    setEditingTeacher(null);
    setEditFormData(createEmptyTeacherForm());
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editingTeacher) {
      return;
    }

    const payload: TeacherUpsertPayload = {
      firstName: editFormData.firstName.trim(),
      lastName: editFormData.lastName.trim(),
      middleName: normalizeOptionalInput(editFormData.middleName),
      email: editFormData.email.trim(),
      employeeId: editFormData.employeeId.trim(),
      contactNumber: normalizeOptionalInput(editFormData.contactNumber),
      specialization: normalizeOptionalInput(editFormData.specialization),
      department: normalizeOptionalInput(editFormData.department),
      plantillaPosition: normalizeOptionalInput(editFormData.plantillaPosition),
      subjects: editFormData.subjects,
    };

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.employeeId ||
      !payload.email
    ) {
      sileo.warning({
        title: "Missing Required Fields",
        description:
          "First name, last name, DepEd email address, and Employee ID are required.",
      });
      return;
    }

    if (!isValidContactNumber(editFormData.contactNumber)) {
      sileo.warning({
        title: "Invalid Contact Number",
        description: "Contact number must follow XXXX-XXX-XXXX (11 digits).",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/teachers/${editingTeacher.id}`, payload);
      sileo.success({
        title: "Teacher Updated",
        description: "Changes saved successfully.",
      });
      closeEditSheet();
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  }, [editingTeacher, editFormData, fetchTeachers, closeEditSheet]);

  const handleToggleStatus = async (
    id: number,
    action: "deactivate" | "reactivate",
    reason?: string,
  ) => {
    setSubmitting(true);
    try {
      await api.patch(`/teachers/${id}/${action}`, { reason });
      sileo.success({
        title:
          action === "deactivate"
            ? "Teacher Deactivated"
            : "Teacher Reactivated",
        description: "Teacher status updated successfully.",
      });
      setTeacherToDeactivate(null);
      setDeactivateReason("");
      setReactivateId(null);
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const hasDeactivationBlocker = useMemo(() => {
    if (!teacherToDeactivate?.designation) return false;
    const d = teacherToDeactivate.designation;
    return d.isClassAdviser;
  }, [teacherToDeactivate]);

  const filteredTeachers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          `${teacher.lastName}, ${teacher.firstName} ${teacher.middleName ?? ""}`,
          teacher.employeeId ?? "",
          teacher.contactNumber ?? "",
          teacher.specialization ?? "",
          teacher.designation?.advisorySection?.name ?? "",
          teacher.designation?.advisorySection?.gradeLevelName ?? "",
          ...(teacher.subjects || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? teacher.isActive : !teacher.isActive);

      const matchesDesignation =
        designationFilter === "all" ||
        (designationFilter === "adviser"
          ? Boolean(teacher.designation?.isClassAdviser)
          : designationFilter === "tic"
            ? Boolean(
                teacher.designation?.ancillaryRoles?.includes(
                  "Teacher-in-Charge (TIC) / Officer-in-Charge (OIC)",
                ),
              )
            : !teacher.designation ||
              (!teacher.designation.isClassAdviser &&
                (!teacher.designation.ancillaryRoles ||
                  teacher.designation.ancillaryRoles.length === 0)));

      const matchesSubject =
        subjectFilter === "all" ||
        (teacher.subjects || []).some(
          (s) => s.toUpperCase() === subjectFilter.toUpperCase(),
        );

      return (
        matchesSearch && matchesStatus && matchesDesignation && matchesSubject
      );
    });
  }, [teachers, searchQuery, statusFilter, designationFilter, subjectFilter]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return filteredTeachers.slice(start, end);
  }, [filteredTeachers, page, limit]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    designationFilter !== "all" ||
    subjectFilter !== "all";

  const openDesignationEditor = useCallback(
    (teacher: Teacher) => {
      setDesignationOpenFor(teacher);
      setDesignationDrawerTab("designation");
      void fetchAdvisorySections(); // Refresh sections list on open

      const bosy = bosyDate?.split("T")[0] || null;
      const eosy = eosyDate?.split("T")[0] || null;

      const teacherFrom =
        teacher.designation?.effectiveFrom?.split("T")[0] || null;
      const teacherTo = teacher.designation?.effectiveTo?.split("T")[0] || null;

      const hasCustomPeriod =
        Boolean(teacherFrom) &&
        Boolean(teacherTo) &&
        (teacherFrom !== bosy || teacherTo !== eosy);

      setDesignationForm({
        isClassAdviser: teacher.designation?.isClassAdviser ?? false,
        advisorySectionId:
          teacher.designation?.advisorySectionId?.toString() ?? "",
        ancillaryRoles: teacher.designation?.ancillaryRoles ?? [],
        designationNotes: teacher.designation?.designationNotes ?? "",
        effectiveFrom: teacherFrom ?? bosy ?? "",
        effectiveTo: teacherTo ?? eosy ?? "",
        isCustomPeriod: hasCustomPeriod,
        reason: "",
      });
      setDesignationCollision(null);
      setAllowCollisionOverride(false);
    },
    [bosyDate, eosyDate, fetchAdvisorySections],
  );

  const closeDesignationEditor = useCallback(() => {
    setDesignationOpenFor(null);
    setDesignationCollision(null);
    setAllowCollisionOverride(false);
  }, []);

  const handleSaveDesignation = useCallback(async () => {
    if (!designationOpenFor || !ayId) {
      return;
    }

    if (designationForm.isClassAdviser && !designationForm.advisorySectionId) {
      sileo.warning({
        title: "Advisory Section Required",
        description:
          "Select an advisory section before saving class adviser designation.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const advisorySectionId = designationForm.advisorySectionId
        ? Number(designationForm.advisorySectionId)
        : null;

      const settings = useSettingsStore.getState();
      const effectiveFrom = designationForm.isCustomPeriod
        ? designationForm.effectiveFrom || null
        : settings.classOpeningDate?.split("T")[0] || null;
      const effectiveTo = designationForm.isCustomPeriod
        ? designationForm.effectiveTo || null
        : settings.classEndDate?.split("T")[0] || null;

      const payload = {
        schoolYearId: ayId,
        isClassAdviser: designationForm.isClassAdviser,
        advisorySectionId,
        ancillaryRoles: designationForm.ancillaryRoles,
        designationNotes: designationForm.designationNotes.trim() || null,
        effectiveFrom,
        effectiveTo,
        reason: designationForm.reason.trim() || null,
      };

      const validationRes = await api.post(
        `/teachers/${designationOpenFor.id}/designation/validate`,
        payload,
      );

      if (validationRes.data?.hasCollision && !allowCollisionOverride) {
        setDesignationCollision(validationRes.data.collision ?? null);
        setDesignationDrawerTab("review");
        sileo.warning({
          title: "Section Adviser Conflict",
          description:
            "This section already has an adviser. Enable override to replace the current adviser.",
        });
        return;
      }

      await api.put(`/teachers/${designationOpenFor.id}/designation`, {
        ...payload,
        allowAdviserOverride: allowCollisionOverride,
      });

      sileo.success({
        title: "Designation Updated",
        description: `${formatTeacherName(designationOpenFor)} designation was saved.`,
      });
      closeDesignationEditor();
      fetchTeachers();
      void fetchAdvisorySections();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  }, [
    designationOpenFor,
    ayId,
    designationForm,
    allowCollisionOverride,
    fetchTeachers,
    fetchAdvisorySections,
    closeDesignationEditor,
  ]);

  const selectedAdvisorySection = advisorySections.find(
    (section) => section.id.toString() === designationForm.advisorySectionId,
  );

  const canSubmitCreate =
    formData.firstName.trim().length > 0 &&
    formData.lastName.trim().length > 0 &&
    formData.email.trim().length > 0 &&
    formData.employeeId.trim().length > 0 &&
    isValidContactNumber(formData.contactNumber);
  const canSubmitEdit =
    editFormData.firstName.trim().length > 0 &&
    editFormData.lastName.trim().length > 0 &&
    editFormData.email.trim().length > 0 &&
    editFormData.employeeId.trim().length > 0 &&
    isValidContactNumber(editFormData.contactNumber);

  const openCreateTeacherSheet = () => {
    setFormData(createEmptyTeacherForm());
    setIsCreateEmailManuallyEdited(false);
    setCreateOpen(true);
  };

  const handleBulkImportPlaceholder = () => {
    sileo.info({
      title: "Bulk Import Coming Soon",
      description:
        "CSV bulk teacher import is queued for the next release. Use Add Teacher for now.",
    });
  };

  const teacherDirectoryCardElement = useMemo(
    () => (
      <TeacherDirectoryCard
        loading={loading}
        isRefetching={isRefetching}
        showSkeleton={showSkeleton}
        filteredTeachers={filteredTeachers}
        paginatedTeachers={paginatedTeachers}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        designationFilter={designationFilter}
        subjectFilter={subjectFilter}
        hasActiveFilters={hasActiveFilters}
        ayId={ayId}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSearchQueryChange={(val) => {
          startTransition(() => {
            setSearchQuery(val);
          });
        }}
        onStatusFilterChange={setStatusFilter}
        onDesignationFilterChange={setDesignationFilter}
        onSubjectFilterChange={setSubjectFilter}
        onClearFilters={() => {
          startTransition(() => {
            setSearchQuery("");
          });
          setStatusFilter("all");
          setDesignationFilter("all");
          setSubjectFilter("all");
        }}
        onRefresh={fetchTeachers}
        onOpenDesignationEditor={openDesignationEditor}
        onEditTeacher={startEditing}
        onDeactivateTeacher={setTeacherToDeactivate}
        onReactivateTeacher={setReactivateId}
      />
    ),
    [
      loading,
      isRefetching,
      showSkeleton,
      filteredTeachers,
      paginatedTeachers,
      searchQuery,
      statusFilter,
      designationFilter,
      subjectFilter,
      hasActiveFilters,
      ayId,
      page,
      limit,
      fetchTeachers,
      openDesignationEditor,
    ],
  );

  const renderedTeacherCreateSheet = useMemo(
    () => (
      <TeacherFormSheet
        mode="create"
        open={createOpen}
        title="Add Teacher"
        description="Create a new permanent faculty profile for the academic roster."
        formData={formData}
        submitting={submitting}
        canSubmit={canSubmitCreate}
        onOpenChange={(open: boolean) => {
          setCreateOpen(open);
          if (!open) {
            setIsCreateEmailManuallyEdited(false);
            setFormData(createEmptyTeacherForm());
          }
        }}
        onFieldChange={handleFieldChange}
        onCancel={() => {
          setCreateOpen(false);
          setIsCreateEmailManuallyEdited(false);
          setFormData(createEmptyTeacherForm());
        }}
        onSubmit={handleCreate}
      />
    ),
    [
      createOpen,
      formData,
      submitting,
      canSubmitCreate,
      handleFieldChange,
      handleCreate,
    ],
  );

  const renderedTeacherEditSheet = useMemo(
    () => (
      <TeacherFormSheet
        mode="edit"
        open={editOpen}
        title="Edit Teacher"
        description={
          editingTeacher
            ? `Update ${formatTeacherName(editingTeacher)} profile fields.`
            : "Update teacher details."
        }
        formData={editFormData}
        submitting={submitting}
        canSubmit={canSubmitEdit && Boolean(editingTeacher)}
        onOpenChange={(open: boolean) => {
          if (!open) {
            closeEditSheet();
            return;
          }
          setEditOpen(true);
        }}
        onFieldChange={handleEditFieldChange}
        onCancel={closeEditSheet}
        onSubmit={handleUpdate}
      />
    ),
    [
      editOpen,
      editingTeacher,
      editFormData,
      submitting,
      canSubmitEdit,
      handleEditFieldChange,
      handleUpdate,
      closeEditSheet,
    ],
  );

  const renderedDesignationSheet = useMemo(
    () => (
      <TeacherDesignationSheet
        open={Boolean(designationOpenFor)}
        ayId={ayId}
        ayLabel={ayLabel}
        submitting={submitting}
        designationOpenFor={designationOpenFor}
        designationDrawerTab={designationDrawerTab}
        setDesignationDrawerTab={setDesignationDrawerTab}
        designationForm={designationForm}
        setDesignationForm={setDesignationForm}
        advisorySections={advisorySections}
        advisorySectionsLoading={advisorySectionsLoading}
        selectedAdvisorySection={selectedAdvisorySection}
        designationCollision={designationCollision}
        setDesignationCollision={setDesignationCollision}
        allowCollisionOverride={allowCollisionOverride}
        setAllowCollisionOverride={setAllowCollisionOverride}
        onClose={closeDesignationEditor}
        onSave={handleSaveDesignation}
      />
    ),
    [
      designationOpenFor,
      ayId,
      ayLabel,
      submitting,
      designationDrawerTab,
      designationForm,
      advisorySections,
      advisorySectionsLoading,
      selectedAdvisorySection,
      designationCollision,
      allowCollisionOverride,
      closeDesignationEditor,
      handleSaveDesignation,
    ],
  );

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-start gap-2 text-balance">
            <GraduationCap className="h-7 w-7 md:h-8 md:w-8" />
            Teacher Management
          </h1>
          <p className="text-sm text-foreground text-balance font-bold">
            Manage teacher profiles, learning areas, and adviser assignments.
          </p>
        </div>
        <div className="flex justify-end gap-2 flex-wrap">
          <div className="inline-flex shadow-sm rounded-lg overflow-hidden">
            <Button
              onClick={openCreateTeacherSheet}
              className="rounded-r-none">
              <Plus className="h-4 w-4 mr-2" />
              Add Teacher
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  className="rounded-l-none border-l border-primary-foreground/20"
                  aria-label="Open add teacher options">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56">
                <DropdownMenuItem
                  onClick={openCreateTeacherSheet}
                  className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Single Teacher
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleBulkImportPlaceholder}
                  className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Import (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {!ayId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-foreground">
          Set an active school year to edit designation metadata.
        </div>
      ) : null}

      {teacherDirectoryCardElement}

      {renderedTeacherCreateSheet}
      {renderedTeacherEditSheet}
      {renderedDesignationSheet}

      <Dialog
        open={Boolean(teacherToDeactivate)}
        onOpenChange={(open) => {
          if (!open) {
            setTeacherToDeactivate(null);
            setDeactivateReason("");
          }
        }}>
        <DialogContent className="max-w-md border-2 p-0 overflow-hidden rounded-2xl bg-background">
          <DialogHeader className="px-6 py-6 bg-destructive text-destructive-foreground">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive-foreground/10 rounded-lg">
                <UserMinus className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-black uppercase  text-white">
                Deactivate Teacher Profile
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground uppercase ">
                Are you sure you want to deactivate:
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-10 w-10 rounded-full bg-muted border flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="font-black text-base uppercase leading-none">
                    {teacherToDeactivate
                      ? formatTeacherName(teacherToDeactivate)
                      : ""}
                  </p>
                  <p className="text-[11px] font-bold text-foreground mt-1 uppercase ">
                    ID: {teacherToDeactivate?.employeeId || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {hasDeactivationBlocker ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase text-amber-800  leading-none">
                    Deactivation Blocked
                  </p>
                  <p className="text-xs font-bold text-amber-700 leading-relaxed">
                    ⚠️ Cannot Deactivate: This teacher has an active advisory
                    assignment. Reassign the advisory section before
                    deactivating this account.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
                  <p className="text-xs font-bold text-foreground leading-relaxed uppercase ">
                    This teacher currently has{" "}
                    <span className="text-foreground font-black">
                      NO ACTIVE ADVISORY ASSIGNMENT
                    </span>
                    . Deactivating will revoke system access and remove them
                    from adviser assignment options. Historical records will be
                    preserved.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase ">
                    Reason for Deactivation (Required for Audit Log)
                  </Label>
                  <Select
                    value={deactivateReason}
                    onValueChange={setDeactivateReason}>
                    <SelectTrigger className="h-11 font-bold uppercase text-xs">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TEACHER_DEACTIVATION_REASONS.map((reason) => (
                        <SelectItem
                          key={reason}
                          value={reason}
                          className="font-bold text-xs uppercase">
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex flex-row items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => setTeacherToDeactivate(null)}
              className="font-black uppercase text-xs  h-11 px-8">
              Cancel
            </Button>
            <Button
              onClick={() =>
                teacherToDeactivate &&
                handleToggleStatus(
                  teacherToDeactivate.id,
                  "deactivate",
                  deactivateReason,
                )
              }
              disabled={
                submitting ||
                hasDeactivationBlocker ||
                !deactivateReason ||
                !teacherToDeactivate
              }
              className="font-black uppercase text-xs  h-11 px-8 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Deactivating...
                </>
              ) : (
                <>
                  <UserMinus className="mr-2 h-4 w-4" /> Yes, Deactivate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={Boolean(reactivateId)}
        onOpenChange={(open) => !open && setReactivateId(null)}
        title="Reactivate Teacher"
        description="This teacher will be marked as active and will appear in section adviser dropdowns again."
        confirmText="Yes, Reactivate"
        onConfirm={() =>
          reactivateId && handleToggleStatus(reactivateId, "reactivate")
        }
        loading={submitting}
        variant="info"
      />
    </div>
  );
}
