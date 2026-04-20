import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { Link } from "react-router";
import {
  ChevronDown,
  CloudUpload,
  GraduationCap,
  Plus,
  Upload,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Button } from "@/shared/ui/button";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
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
  TeacherSyncFilter,
} from "../types";
import {
  MAX_TEACHER_PHOTO_BYTES,
  convertImageToBase64,
  createEmptyTeacherForm,
  formatTeacherName,
  getImageUrl,
  getSyncFilterValue,
  normalizeOptionalInput,
  parseSubjectsInput,
} from "../utils";

type TeacherFormField = Exclude<keyof TeacherFormState, "photo">;

function normalizeTeacherFieldValue(
  field: TeacherFormField,
  value: string,
): string {
  if (field === "contactNumber") {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  if (field === "email") {
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
    isTic: false,
    isTeachingExempt: false,
    customTargetTeachingHoursPerWeek: "",
    designationNotes: "",
    effectiveFrom: "",
    effectiveTo: "",
    reason: "",
  };
}

export default function Teachers() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const showSkeleton = useDelayedLoading(loading);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editPhotoChanged, setEditPhotoChanged] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);
  const [designationOpenFor, setDesignationOpenFor] = useState<Teacher | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [forceSyncingTeacherId, setForceSyncingTeacherId] = useState<
    number | null
  >(null);
  const [forceSyncingAll, setForceSyncingAll] = useState(false);
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
  const [syncFilter, setSyncFilter] = useState<TeacherSyncFilter>("all");

  const [formData, setFormData] = useState<TeacherFormState>(
    createEmptyTeacherForm,
  );

  const [editFormData, setEditFormData] = useState<TeacherFormState>(
    createEmptyTeacherForm,
  );

  const [designationForm, setDesignationForm] = useState<DesignationFormState>(
    createEmptyDesignationForm,
  );

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/teachers", {
        params: ayId ? { schoolYearId: ayId } : undefined,
      });
      setTeachers(res.data.teachers || []);
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
            label: `${gradeLevel.gradeLevelName} - ${section.name}`,
            gradeLevelName: gradeLevel.gradeLevelName,
            sectionName: section.name,
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
    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      middleName: normalizeOptionalInput(formData.middleName),
      email: normalizeOptionalInput(formData.email),
      employeeId: normalizeOptionalInput(formData.employeeId),
      contactNumber: normalizeOptionalInput(formData.contactNumber),
      specialization: normalizeOptionalInput(formData.specialization),
      subjects: parseSubjectsInput(formData.subjectsText),
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
      specialization: teacher.specialization || "",
      subjectsText: teacher.subjects.join(", "),
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

    const payload: Record<string, unknown> = {
      firstName: editFormData.firstName.trim(),
      lastName: editFormData.lastName.trim(),
      middleName: normalizeOptionalInput(editFormData.middleName),
      email: normalizeOptionalInput(editFormData.email),
      employeeId: normalizeOptionalInput(editFormData.employeeId),
      contactNumber: normalizeOptionalInput(editFormData.contactNumber),
      specialization: normalizeOptionalInput(editFormData.specialization),
      subjects: parseSubjectsInput(editFormData.subjectsText),
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
  ) => {
    setSubmitting(true);
    try {
      await api.patch(`/teachers/${id}/${action}`);
      sileo.success({
        title:
          action === "deactivate"
            ? "Teacher Deactivated"
            : "Teacher Reactivated",
        description: "Teacher status updated successfully.",
      });
      setDeactivateId(null);
      setReactivateId(null);
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

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
            ? Boolean(teacher.designation?.isTic)
            : designationFilter === "exempt"
              ? Boolean(teacher.designation?.isTeachingExempt)
              : !teacher.designation ||
                (!teacher.designation.isClassAdviser &&
                  !teacher.designation.isTic &&
                  !teacher.designation.isTeachingExempt));

      const matchesSync =
        syncFilter === "all" || getSyncFilterValue(teacher) === syncFilter;

      return (
        matchesSearch && matchesStatus && matchesDesignation && matchesSync
      );
    });
  }, [teachers, searchQuery, statusFilter, designationFilter, syncFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    designationFilter !== "all" ||
    syncFilter !== "all";

  const openDesignationEditor = (teacher: Teacher) => {
    setDesignationOpenFor(teacher);
    setDesignationDrawerTab("role-load");
    setDesignationForm({
      isClassAdviser: teacher.designation?.isClassAdviser ?? false,
      advisorySectionId:
        teacher.designation?.advisorySectionId?.toString() ?? "",
      advisoryEquivalentHoursPerWeek: String(
        teacher.designation?.advisoryEquivalentHoursPerWeek ?? 5,
      ),
      isTic: teacher.designation?.isTic ?? false,
      isTeachingExempt: teacher.designation?.isTeachingExempt ?? false,
      customTargetTeachingHoursPerWeek:
        teacher.designation?.customTargetTeachingHoursPerWeek?.toString() ?? "",
      designationNotes: teacher.designation?.designationNotes ?? "",
      effectiveFrom: teacher.designation?.effectiveFrom ?? "",
      effectiveTo: teacher.designation?.effectiveTo ?? "",
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

  const handleForceSyncTeacher = async (teacher: Teacher) => {
    setForceSyncingTeacherId(teacher.id);
    try {
      const res = await api.post(`/teachers/${teacher.id}/atlas/push`, {
        schoolYearId: ayId,
      });

      const status = res.data?.atlasSync?.status;
      const statusDescription =
        status === "SYNCED"
          ? "Delivery was successful."
          : status === "FAILED"
            ? "Sync was attempted but failed."
            : "Sync was queued for retry.";

      sileo.success({
        title: "ATLAS Sync Triggered",
        description: `${formatTeacherName(teacher)}: ${statusDescription}`,
      });
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setForceSyncingTeacherId(null);
    }
  };

  const handleForceSyncAll = async () => {
    const targetTeacherIds = filteredTeachers.map((teacher) => teacher.id);

    if (targetTeacherIds.length === 0) {
      sileo.warning({
        title: "No Teachers To Sync",
        description:
          "Adjust your filters or add teachers before triggering a batch sync.",
      });
      return;
    }

    setForceSyncingAll(true);
    try {
      const res = await api.post("/teachers/atlas/push", {
        schoolYearId: ayId,
        teacherIds: targetTeacherIds,
      });
      const summary = res.data?.summary;
      const total = summary?.total ?? targetTeacherIds.length;
      const queued = summary?.queued ?? 0;
      const synced = summary?.synced ?? 0;
      const failed = summary?.failed ?? 0;
      const skipped = summary?.skipped ?? 0;

      sileo.success({
        title: "Bulk Sync Requested",
        description: `${total} teacher records processed (${queued} queued, ${synced} synced, ${failed} failed, ${skipped} skipped).`,
      });
      fetchTeachers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setForceSyncingAll(false);
    }
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
        ? Number(designationForm.advisoryEquivalentHoursPerWeek || "5")
        : 0;

      const customTargetRaw =
        designationForm.customTargetTeachingHoursPerWeek.trim();
      const customTargetTeachingHoursPerWeek = customTargetRaw
        ? Number(customTargetRaw)
        : null;

      const advisorySectionId = designationForm.advisorySectionId
        ? Number(designationForm.advisorySectionId)
        : null;

      const payload = {
        schoolYearId: ayId,
        isClassAdviser: designationForm.isClassAdviser,
        advisorySectionId,
        advisoryEquivalentHoursPerWeek,
        isTic: designationForm.isTic,
        isTeachingExempt: designationForm.isTeachingExempt,
        customTargetTeachingHoursPerWeek,
        designationNotes: designationForm.designationNotes.trim() || null,
        effectiveFrom: designationForm.effectiveFrom || null,
        effectiveTo: designationForm.effectiveTo || null,
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

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-start gap-2 text-balance">
            <GraduationCap className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            Teacher Management
          </h1>
          <p className="text-sm text-muted-foreground text-balance">
            Manage teacher profiles, learning areas, and adviser assignments.
          </p>
        </div>
        <div className="flex justify-end gap-2 flex-wrap">
          <Button asChild variant="outline" className="w-fit shadow-sm">
            <Link to="/admin/atlas">
              <CloudUpload className="h-4 w-4 mr-2" />
              ATLAS Sync Health
            </Link>
          </Button>
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
          Set an active school year to edit ATLAS designation metadata.
        </div>
      ) : null}

      <TeacherDirectoryCard
        loading={loading}
        showSkeleton={showSkeleton}
        teachers={teachers}
        filteredTeachers={filteredTeachers}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        designationFilter={designationFilter}
        syncFilter={syncFilter}
        hasActiveFilters={hasActiveFilters}
        ayId={ayId}
        forceSyncingAll={forceSyncingAll}
        forceSyncingTeacherId={forceSyncingTeacherId}
        onSearchQueryChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onDesignationFilterChange={setDesignationFilter}
        onSyncFilterChange={setSyncFilter}
        onClearFilters={() => {
          setSearchQuery("");
          setStatusFilter("all");
          setDesignationFilter("all");
          setSyncFilter("all");
        }}
        onRefresh={fetchTeachers}
        onForceSyncAll={handleForceSyncAll}
        onOpenDesignationEditor={openDesignationEditor}
        onEditTeacher={startEditing}
        onForceSyncTeacher={handleForceSyncTeacher}
        onDeactivateTeacher={setDeactivateId}
        onReactivateTeacher={setReactivateId}
      />

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
        onFieldChange={(field, value) =>
          setFormData((prev) => ({
            ...prev,
            [field]: normalizeTeacherFieldValue(field, value),
          }))
        }
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
        onFieldChange={(field, value) =>
          setEditFormData((prev) => ({
            ...prev,
            [field]: normalizeTeacherFieldValue(field, value),
          }))
        }
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
        forceSyncingTeacherId={forceSyncingTeacherId}
        onClose={closeDesignationEditor}
        onSave={handleSaveDesignation}
        onForceSyncTeacher={handleForceSyncTeacher}
      />

      <ConfirmationModal
        open={Boolean(deactivateId)}
        onOpenChange={(open) => !open && setDeactivateId(null)}
        title="Deactivate Teacher"
        description="This teacher will be marked as inactive and won't appear in section adviser dropdowns."
        confirmText="Yes, Deactivate"
        onConfirm={() =>
          deactivateId && handleToggleStatus(deactivateId, "deactivate")
        }
        loading={submitting}
        variant="warning"
      />

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
