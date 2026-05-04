import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { sileo } from "sileo";
import { ChevronDown, GraduationCap, Plus, Upload } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { getImageUrl } from "@/shared/lib/utils";
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
import { TeacherFormSheet } from "../components/TeacherFormSheet";
import { TeacherDesignationSheet } from "../components/TeacherDesignationSheet";
import type {
  AdvisorySectionOption,
  DesignationCollision,
  DesignationFormState,
  SectionsApiResponse,
  Teacher,
  TeacherDesignationFilter,
  TeacherFormState,
  TeacherStatusFilter,
} from "../types";
import {
  MAX_TEACHER_PHOTO_BYTES,
  convertImageToBase64,
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

type TeacherFormField = Exclude<keyof TeacherFormState, "photo" | "subjects">;

function normalizeTeacherFieldValue(
  field: TeacherFormField,
  value: string,
): string {
  if (field === "contactNumber") {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  // Preserve case for select-based fields and emails
  if (
    field === "email" ||
    field === "designation" ||
    field === "department" ||
    field === "plantillaPosition" ||
    field === "specialization"
  ) {
    return value;
  }

  return value.toUpperCase();
}

function isValidContactNumber(value: string): boolean {
  const normalized = value.trim();
  return normalized.length === 0 || /^\d{11}$/.test(normalized);
}

function createEmptyDesignationForm(): DesignationFormState {
  return {
    isClassAdviser: false,
    advisorySectionId: "",
    advisoryEquivalentHoursPerWeek: "5",
    ancillaryRoles: [],
    isTeachingExempt: false,
    customTargetTeachingHoursPerWeek: "",
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
  const [bosyDate, setBosyDate] = useState<string | null>(null);
  const [eosyDate, setEosyDate] = useState<string | null>(null);

  const showSkeleton = useDelayedLoading(loading);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editPhotoChanged, setEditPhotoChanged] = useState(false);
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
    "role-load" | "schedule-notes" | "review"
  >("role-load");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatusFilter>("all");
  const [designationFilter, setDesignationFilter] =
    useState<TeacherDesignationFilter>("all");

  const [formData, setFormData] = useState<TeacherFormState>(
    createEmptyTeacherForm,
  );

  const [editFormData, setEditFormData] = useState<TeacherFormState>(
    createEmptyTeacherForm,
  );

  const [designationForm, setDesignationForm] = useState<DesignationFormState>(
    createEmptyDesignationForm,
  );

  const handleFieldChange = useCallback(
    (field: TeacherFormField, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: normalizeTeacherFieldValue(field, value),
      }));
    },
    [],
  );

  const handleEditFieldChange = useCallback(
    (field: TeacherFormField, value: string) => {
      setEditFormData((prev) => ({
        ...prev,
        [field]: normalizeTeacherFieldValue(field, value),
      }));
    },
    [],
  );

  const handleSubjectsChange = useCallback((subjects: string[]) => {
    setFormData((prev) => ({ ...prev, subjects }));
  }, []);

  const handleEditSubjectsChange = useCallback((subjects: string[]) => {
    setEditFormData((prev) => ({ ...prev, subjects }));
  }, []);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/teachers", {
        params: ayId ? { schoolYearId: ayId } : undefined,
      });
      setTeachers(res.data.teachers || []);
      setBosyDate(res.data.scope?.classOpeningDate || null);
      setEosyDate(res.data.scope?.classEndDate || null);
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
      const response = res.data as SectionsApiResponse;
      const options: AdvisorySectionOption[] = (response.gradeLevels ?? [])
        .flatMap((gradeLevel) =>
          (gradeLevel.sections ?? []).map((section) => ({
            id: section.id,
            label: `${gradeLevel.gradeLevelName} - ${section.name} (${section.enrolledCount}/${section.maxCapacity} Learners)`,
            gradeLevelName: gradeLevel.gradeLevelName,
            sectionName: section.name,
            maxCapacity: section.maxCapacity,
            enrolledCount: section.enrolledCount,
            currentAdviserId: section.advisingTeacher?.id ?? null,
            currentAdviserName: section.advisingTeacher?.name ?? null,
          })),
        )
        .sort((a, b) => a.label.localeCompare(b.label));

      setAdvisorySections(options);
    } catch (err) {
      toastApiError(err as never);
      setAdvisorySections([]);
    } finally {
      setAdvisorySectionsLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchAdvisorySections();
  }, [fetchAdvisorySections]);

  const handlePhotoFileSelection = async (
    file: File | undefined,
    mode: "create" | "edit",
  ) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      sileo.warning({
        title: "Invalid Photo",
        description: "Only image files are allowed for teacher photos.",
      });
      return;
    }

    if (file.size > MAX_TEACHER_PHOTO_BYTES) {
      sileo.warning({
        title: "Photo Too Large",
        description: "Use an image smaller than 5 MB.",
      });
      return;
    }

    try {
      const base64Image = await convertImageToBase64(file);
      if (mode === "create") {
        setFormData((prev) => ({ ...prev, photo: base64Image }));
        return;
      }

      setEditFormData((prev) => ({ ...prev, photo: base64Image }));
      setEditPhotoChanged(true);
    } catch {
      sileo.error({
        title: "Photo Upload Failed",
        description: "Unable to process the selected photo. Try another file.",
      });
    }
  };

  const handleCreate = async () => {
    const subjects = Array.from(
      new Set(
        formData.subjects
          .map((subject) => subject.trim())
          .filter((subject) => subject.length > 0),
      ),
    );

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      middleName: normalizeOptionalInput(formData.middleName),
      email: normalizeOptionalInput(formData.email),
      employeeId: normalizeOptionalInput(formData.employeeId),
      contactNumber: normalizeOptionalInput(formData.contactNumber),
      designation: normalizeOptionalInput(formData.designation),
      specialization: normalizeOptionalInput(formData.specialization),
      department: normalizeOptionalInput(formData.department),
      plantillaPosition: normalizeOptionalInput(formData.plantillaPosition),
      subjects,
      photo: formData.photo,
    };

    if (!payload.firstName || !payload.lastName) {
      sileo.warning({
        title: "Missing Required Fields",
        description: "First name and last name are required.",
      });
      return;
    }

    if (!isValidContactNumber(formData.contactNumber)) {
      sileo.warning({
        title: "Invalid Contact Number",
        description: "Contact number must be exactly 11 digits.",
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
      setFormData(createEmptyTeacherForm());
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditPhotoChanged(false);
    setEditFormData({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      middleName: teacher.middleName || "",
      email: teacher.email || "",
      employeeId: teacher.employeeId || "",
      contactNumber: teacher.contactNumber || "",
      designation: (teacher.designationTitle || "").toUpperCase(),
      specialization: (teacher.specialization || "").toUpperCase(),
      department: (teacher.department || "").toUpperCase(),
      plantillaPosition: (teacher.plantillaPosition || "").toUpperCase(),
      subjects: teacher.subjects.map((s) => s.toUpperCase()),
      photo: teacher.photoPath,
    });
    setEditOpen(true);
  };

  const closeEditSheet = () => {
    setEditOpen(false);
    setEditingTeacher(null);
    setEditPhotoChanged(false);
    setEditFormData(createEmptyTeacherForm());
  };

  const handleUpdate = async () => {
    if (!editingTeacher) {
      return;
    }

    const subjects = Array.from(
      new Set(
        editFormData.subjects
          .map((subject) => subject.trim())
          .filter((subject) => subject.length > 0),
      ),
    );

    const payload: Record<string, unknown> = {
      firstName: editFormData.firstName.trim(),
      lastName: editFormData.lastName.trim(),
      middleName: normalizeOptionalInput(editFormData.middleName),
      email: normalizeOptionalInput(editFormData.email),
      employeeId: normalizeOptionalInput(editFormData.employeeId),
      contactNumber: normalizeOptionalInput(editFormData.contactNumber),
      designation: normalizeOptionalInput(editFormData.designation),
      specialization: normalizeOptionalInput(editFormData.specialization),
      department: normalizeOptionalInput(editFormData.department),
      plantillaPosition: normalizeOptionalInput(editFormData.plantillaPosition),
      subjects,
    };

    if (editPhotoChanged) {
      payload.photo = editFormData.photo;
    }

    if (!payload.firstName || !payload.lastName) {
      sileo.warning({
        title: "Missing Required Fields",
        description: "First name and last name are required.",
      });
      return;
    }

    if (!isValidContactNumber(editFormData.contactNumber)) {
      sileo.warning({
        title: "Invalid Contact Number",
        description: "Contact number must be exactly 11 digits.",
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
  };

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
    return (
      d.isClassAdviser ||
      (Number(d.advisoryEquivalentHoursPerWeek) || 0) > 0 ||
      (Number(d.customTargetTeachingHoursPerWeek) || 0) > 0
    );
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
            : designationFilter === "exempt"
              ? Boolean(teacher.designation?.isTeachingExempt)
              : !teacher.designation ||
                (!teacher.designation.isClassAdviser &&
                  (!teacher.designation.ancillaryRoles ||
                    teacher.designation.ancillaryRoles.length === 0) &&
                  !teacher.designation.isTeachingExempt));

      return matchesSearch && matchesStatus && matchesDesignation;
    });
  }, [teachers, searchQuery, statusFilter, designationFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    designationFilter !== "all";

  const openDesignationEditor = (teacher: Teacher) => {
    setDesignationOpenFor(teacher);
    setDesignationDrawerTab("role-load");

    const bosy = bosyDate?.split("T")[0] || null;
    const eosy = eosyDate?.split("T")[0] || null;

    const teacherFrom = teacher.designation?.effectiveFrom?.split("T")[0] || null;
    const teacherTo = teacher.designation?.effectiveTo?.split("T")[0] || null;

    const hasCustomPeriod =
      Boolean(teacherFrom) &&
      Boolean(teacherTo) &&
      (teacherFrom !== bosy || teacherTo !== eosy);

    setDesignationForm({
      isClassAdviser: teacher.designation?.isClassAdviser ?? false,
      advisorySectionId:
        teacher.designation?.advisorySectionId?.toString() ?? "",
      advisoryEquivalentHoursPerWeek: String(
        teacher.designation?.advisoryEquivalentHoursPerWeek ?? 5,
      ),
      ancillaryRoles: teacher.designation?.ancillaryRoles ?? [],
      isTeachingExempt: teacher.designation?.isTeachingExempt ?? false,
      customTargetTeachingHoursPerWeek:
        teacher.designation?.customTargetTeachingHoursPerWeek?.toString() ?? "",
      designationNotes: teacher.designation?.designationNotes ?? "",
      effectiveFrom: teacherFrom ?? bosy ?? "",
      effectiveTo: teacherTo ?? eosy ?? "",
      isCustomPeriod: hasCustomPeriod,
      reason: "",
    });
    setDesignationCollision(null);
    setAllowCollisionOverride(false);
  };

  const closeDesignationEditor = () => {
    setDesignationOpenFor(null);
    setDesignationCollision(null);
    setAllowCollisionOverride(false);
  };

  const handleSaveDesignation = async () => {
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
      const advisoryEquivalentHoursPerWeek = designationForm.isClassAdviser
        ? 5
        : 0;

      const customTargetRaw =
        designationForm.customTargetTeachingHoursPerWeek.trim();
      const customTargetTeachingHoursPerWeek = customTargetRaw
        ? Number(customTargetRaw)
        : null;

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
        advisoryEquivalentHoursPerWeek,
        ancillaryRoles: designationForm.ancillaryRoles,
        isTeachingExempt: designationForm.isTeachingExempt,
        customTargetTeachingHoursPerWeek,
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
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAdvisorySection = advisorySections.find(
    (section) => section.id.toString() === designationForm.advisorySectionId,
  );

  const createPhotoPreviewUrl = getImageUrl(formData.photo);
  const editPhotoPreviewUrl = getImageUrl(editFormData.photo);
  const canSubmitCreate =
    formData.firstName.trim().length > 0 &&
    formData.lastName.trim().length > 0 &&
    isValidContactNumber(formData.contactNumber);
  const canSubmitEdit =
    editFormData.firstName.trim().length > 0 &&
    editFormData.lastName.trim().length > 0 &&
    isValidContactNumber(editFormData.contactNumber);

  const openCreateTeacherSheet = () => {
    setFormData(createEmptyTeacherForm());
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
        showSkeleton={showSkeleton}
        teachers={teachers}
        filteredTeachers={filteredTeachers}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        designationFilter={designationFilter}
        hasActiveFilters={hasActiveFilters}
        ayId={ayId}
        onSearchQueryChange={(val) => {
          startTransition(() => {
            setSearchQuery(val);
          });
        }}
        onStatusFilterChange={setStatusFilter}
        onDesignationFilterChange={setDesignationFilter}
        onClearFilters={() => {
          startTransition(() => {
            setSearchQuery("");
          });
          setStatusFilter("all");
          setDesignationFilter("all");
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
      showSkeleton,
      teachers,
      filteredTeachers,
      searchQuery,
      statusFilter,
      designationFilter,
      hasActiveFilters,
      ayId,
      fetchTeachers,
      bosyDate,
      eosyDate,
    ]
  );

  const renderedTeacherCreateSheet = useMemo(
    () => (
      <TeacherFormSheet
        mode="create"
        open={createOpen}
        title="Add Teacher"
        description="Create a teacher profile using full schema fields including photo, email, and teaching subjects."
        formData={formData}
        photoPreviewUrl={createPhotoPreviewUrl}
        submitting={submitting}
        canSubmit={canSubmitCreate}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setFormData(createEmptyTeacherForm());
          }
        }}
        onFieldChange={handleFieldChange}
        onSubjectsChange={handleSubjectsChange}
        onPhotoSelect={(file) => {
          void handlePhotoFileSelection(file, "create");
        }}
        onRemovePhoto={() => setFormData((prev) => ({ ...prev, photo: null }))}
        onCancel={() => {
          setCreateOpen(false);
          setFormData(createEmptyTeacherForm());
        }}
        onSubmit={handleCreate}
      />
    ),
    [
      createOpen,
      formData,
      createPhotoPreviewUrl,
      submitting,
      canSubmitCreate,
      handleFieldChange,
      handleSubjectsChange,
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
            ? `Update ${formatTeacherName(editingTeacher)} profile fields and photo.`
            : "Update teacher details."
        }
        formData={editFormData}
        photoPreviewUrl={editPhotoPreviewUrl}
        submitting={submitting}
        canSubmit={canSubmitEdit && Boolean(editingTeacher)}
        onOpenChange={(open) => {
          if (!open) {
            closeEditSheet();
            return;
          }
          setEditOpen(true);
        }}
        onFieldChange={handleEditFieldChange}
        onSubjectsChange={handleEditSubjectsChange}
        onPhotoSelect={(file) => {
          void handlePhotoFileSelection(file, "edit");
        }}
        onRemovePhoto={() => {
          setEditFormData((prev) => ({ ...prev, photo: null }));
          setEditPhotoChanged(true);
        }}
        onCancel={closeEditSheet}
        onSubmit={handleUpdate}
      />
    ),
    [
      editOpen,
      editingTeacher,
      editFormData,
      editPhotoPreviewUrl,
      submitting,
      canSubmitEdit,
      handleEditFieldChange,
      handleEditSubjectsChange,
      handleUpdate,
    ],
  );

  const renderedDesignationSheet = useMemo(
    () => (
      <TeacherDesignationSheet
        open={Boolean(designationOpenFor)}
        ayId={ayId}
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
      submitting,
      designationDrawerTab,
      designationForm,
      advisorySections,
      advisorySectionsLoading,
      selectedAdvisorySection,
      designationCollision,
      allowCollisionOverride,
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
            <Button onClick={openCreateTeacherSheet} className="rounded-r-none">
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
              <DropdownMenuContent align="end" className="w-56">
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
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
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
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">
                Deactivate Teacher Profile
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Are you sure you want to deactivate:
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-10 w-10 rounded-full bg-muted border flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-black text-base uppercase leading-none">
                    {teacherToDeactivate
                      ? formatTeacherName(teacherToDeactivate)
                      : ""}
                  </p>
                  <p className="text-[11px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">
                    ID: {teacherToDeactivate?.employeeId || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {hasDeactivationBlocker ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase text-amber-800 tracking-wider leading-none">
                    Deactivation Blocked
                  </p>
                  <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                    ⚠️ Cannot Deactivate: This teacher has an active advisory
                    section or teaching load. You must reassign their load before
                    deactivating their account.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase tracking-tight">
                    This teacher currently has{" "}
                    <span className="text-foreground font-black">
                      NO ACTIVE LOAD
                    </span>
                    . Deactivating will revoke system access and remove them from
                    future scheduling. Historical records will be preserved.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
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
              className="font-black uppercase text-xs tracking-widest h-11 px-8">
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
              className="font-black uppercase text-xs tracking-widest h-11 px-8 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
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
