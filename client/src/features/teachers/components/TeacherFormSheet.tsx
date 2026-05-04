import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import { UserPhoto } from "@/shared/components/UserPhoto";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { cn } from "@/shared/lib/utils";
import type { TeacherFormState } from "../types";
import {
  DEPED_LEARNING_AREA_OPTIONS,
  TEACHER_PLANTILLA_POSITION_OPTIONS,
  TEACHER_SUBJECT_GROUPS,
  TEACHER_SPECIALIZATION_GROUPS,
  TEACHER_DEPARTMENT_OPTIONS,
  TEACHER_ACADEMIC_DESIGNATION_OPTIONS,
} from "../utils";
import { SelectGroup, SelectLabel } from "@/shared/ui/select";

type TeacherFormField = Exclude<keyof TeacherFormState, "photo" | "subjects">;
const EMPTY_DEPARTMENT_VALUE = "__NONE__";
const EMPTY_PLANTILLA_POSITION_VALUE = "__NONE__";
const EMPTY_DESIGNATION_VALUE = "__NONE__";

interface TeacherFormSheetProps {
  mode: "create" | "edit";
  open: boolean;
  title: string;
  description: string;
  formData: TeacherFormState;
  photoPreviewUrl: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: TeacherFormField, value: string) => void;
  onSubjectsChange: (subjects: string[]) => void;
  onPhotoSelect: (file: File | undefined) => void;
  onRemovePhoto: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const TeacherFormSheet = memo(function TeacherFormSheet({
  mode,
  open,
  title,
  description,
  formData,
  photoPreviewUrl,
  submitting,
  canSubmit,
  onOpenChange,
  onFieldChange,
  onSubjectsChange,
  onPhotoSelect,
  onRemovePhoto,
  onCancel,
  onSubmit,
}: TeacherFormSheetProps) {
  const [panelPercentage, setPanelPercentage] = useState(45);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const isResizing = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);
  const [isSubjectsPopoverOpen, setIsSubjectsPopoverOpen] = useState(false);
  const [subjectSearchTerm, setSubjectSearchTerm] = useState("");

  useEffect(() => {
    if (!open) {
      setIsSubjectsPopoverOpen(false);
      setSubjectSearchTerm("");
      setSelectedFileName(null);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 640);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing.current || !isDesktopViewport) {
        return;
      }

      const newWidthPercent =
        ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      if (newWidthPercent > 20 && newWidthPercent < 95) {
        setPanelPercentage(newWidthPercent);
      }
    },
    [isDesktopViewport],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) {
      return;
    }

    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, isDesktopViewport, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mouseup", stopResizing);
      stopResizing();
    };
  }, [stopResizing]);

  const submitLabel = mode === "create" ? "Create Teacher" : "Save Changes";
  const submittingLabel = mode === "create" ? "Creating..." : "Saving...";
  const photoHint =
    mode === "create"
      ? "Upload JPG, PNG, or WEBP (max 5 MB)."
      : "Upload a new photo to replace the current one.";
  const canShowPhoto = Boolean(photoPreviewUrl);

  const selectedPlantillaPositionValue =
    formData.plantillaPosition.trim().length > 0
      ? formData.plantillaPosition
      : EMPTY_PLANTILLA_POSITION_VALUE;

  const selectedSubjects = useMemo(() => {
    return Array.from(new Set(formData.subjects));
  }, [formData.subjects]);

  const allSubjectOptions = useMemo(
    () => TEACHER_SUBJECT_GROUPS.flatMap((g) => g.options),
    [],
  );

  const filteredSubjectGroups = useMemo(() => {
    const normalizedQuery = subjectSearchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return TEACHER_SUBJECT_GROUPS;
    }

    return TEACHER_SUBJECT_GROUPS.map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedQuery) ||
          option.value.toLowerCase().includes(normalizedQuery),
      ),
    })).filter((group) => group.options.length > 0);
  }, [subjectSearchTerm]);

  const subjectLabelMap = useMemo(
    () =>
      new Map<string, string>(
        allSubjectOptions.map((option) => [option.value, option.label]),
      ),
    [allSubjectOptions],
  );

  const toggleSubject = useCallback(
    (subjectValue: string) => {
      const nextSubjects = selectedSubjects.includes(subjectValue)
        ? selectedSubjects.filter((subject) => subject !== subjectValue)
        : [...selectedSubjects, subjectValue];

      onSubjectsChange(nextSubjects);
    },
    [onSubjectsChange, selectedSubjects],
  );

  const selectedSpecializationValue =
    formData.specialization.trim().length > 0
      ? formData.specialization
      : "__NONE__";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setIsPhotoEnlarged(false);
        }
        onOpenChange(nextOpen);
      }}>
      <SheetContent
        side="right"
        className="p-0 flex flex-row border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
        }>
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <SheetHeader className="space-y-1 border-b bg-primary px-6 py-4 pr-14 shrink-0">
            <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black  uppercase">
              {title}
            </SheetTitle>
            <SheetDescription className="text-[11px] sm:text-xs text-primary-foreground/90 font-medium">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            <section className="rounded-md border bg-[hsl(var(--muted))] p-3 sm:p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <UserPhoto
                  photo={photoPreviewUrl}
                  containerClassName={cn(
                    "h-20 w-20 shrink-0 rounded-xl border border-dashed border-primary",
                    canShowPhoto
                      ? "cursor-zoom-in transition hover:border-solid"
                      : "",
                  )}
                  onEnlarge={
                    canShowPhoto ? () => setIsPhotoEnlarged(true) : undefined
                  }
                  alt="Teacher preview"
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Profile Photo
                  </p>
                  <p className="text-xs text-muted-foreground">{photoHint}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setSelectedFileName(file.name);
                        }
                        onPhotoSelect(file);
                        event.target.value = "";
                      }}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="font-bold"
                      onClick={() => fileInputRef.current?.click()}>
                      {selectedFileName ? "Change Photo" : "Choose Photo"}
                    </Button>
                    {selectedFileName && (
                      <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">
                        {selectedFileName}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setSelectedFileName(null);
                        onRemovePhoto();
                      }}
                      disabled={!formData.photo}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Personal Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  Basic profile details for the faculty directory.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Last Name *</Label>
                  <Input
                    placeholder="e.g. Santos"
                    value={formData.lastName}
                    onChange={(event) =>
                      onFieldChange("lastName", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">First Name *</Label>
                  <Input
                    placeholder="e.g. Maria"
                    value={formData.firstName}
                    onChange={(event) =>
                      onFieldChange("firstName", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Middle Name</Label>
                  <Input
                    placeholder="e.g. Cruz"
                    value={formData.middleName}
                    onChange={(event) =>
                      onFieldChange("middleName", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Email</Label>
                  <Input
                    type="email"
                    placeholder="e.g. maria.santos@example.com"
                    value={formData.email}
                    onChange={(event) =>
                      onFieldChange("email", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Contact
                </h3>
                <p className="text-xs text-muted-foreground">
                  Contact information used for notifications and records.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Contact Number</Label>
                  <Input
                    placeholder="e.g. 09171234567"
                    inputMode="numeric"
                    maxLength={11}
                    pattern="\\d{11}"
                    title="Contact number must be 11 digits"
                    value={formData.contactNumber}
                    onChange={(event) =>
                      onFieldChange("contactNumber", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  DepEd Employment
                </h3>
                <p className="text-xs text-muted-foreground">
                  Assignment and plantilla data aligned to the DepEd catalog.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Employee ID</Label>
                  <Input
                    placeholder="Leave blank to auto-generate"
                    value={formData.employeeId}
                    onChange={(event) =>
                      onFieldChange("employeeId", event.target.value)
                    }
                    className="font-bold"
                  />
                  <p className="text-xs text-muted-foreground font-medium">
                    If empty, the system assigns the next ID (for example,
                    TCH-0001).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Academic Designation</Label>
                  <Select
                    value={formData.designation || EMPTY_DESIGNATION_VALUE}
                    onValueChange={(value) =>
                      onFieldChange(
                        "designation",
                        value === EMPTY_DESIGNATION_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_DESIGNATION_VALUE} className="font-bold">
                        Not set
                      </SelectItem>
                      {TEACHER_ACADEMIC_DESIGNATION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="font-bold uppercase text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Plantilla Position</Label>
                  <Select
                    value={selectedPlantillaPositionValue}
                    onValueChange={(value) =>
                      onFieldChange(
                        "plantillaPosition",
                        value === EMPTY_PLANTILLA_POSITION_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Select plantilla position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_PLANTILLA_POSITION_VALUE} className="font-bold">
                        Not set
                      </SelectItem>
                      {TEACHER_PLANTILLA_POSITION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="font-bold uppercase text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Department</Label>
                  <Select
                    value={formData.department || EMPTY_DEPARTMENT_VALUE}
                    onValueChange={(value) =>
                      onFieldChange(
                        "department",
                        value === EMPTY_DEPARTMENT_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_DEPARTMENT_VALUE} className="font-bold">
                        Not set
                      </SelectItem>
                      {TEACHER_DEPARTMENT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="font-bold uppercase text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Specialization / Learning Area</Label>
                  <Select
                    value={selectedSpecializationValue}
                    onValueChange={(value) =>
                      onFieldChange(
                        "specialization",
                        value === "__NONE__" ? "" : value,
                      )
                    }>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Select primary specialization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__" className="font-bold">Not set</SelectItem>
                      {TEACHER_SPECIALIZATION_GROUPS.map((group) => (
                        <SelectGroup key={group.group}>
                          <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70 py-2">
                            {group.group}
                          </SelectLabel>
                          {group.options.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-xs uppercase font-bold">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground font-bold italic">
                    Primary degree or major qualification.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">Teaching Subjects (Qualifications)</Label>
                  <Popover
                    open={isSubjectsPopoverOpen}
                    onOpenChange={(nextOpen) => {
                      setIsSubjectsPopoverOpen(nextOpen);
                      if (!nextOpen) {
                        setSubjectSearchTerm("");
                      }
                    }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-bold">
                        <span className="truncate">
                          {selectedSubjects.length > 0
                            ? `${selectedSubjects.length} selected`
                            : "Select all assigned subjects"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-80 p-3 sm:w-96">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search BEC or SCP subjects..."
                          value={subjectSearchTerm}
                          onChange={(event) =>
                            setSubjectSearchTerm(event.target.value)
                          }
                          className="pl-8 font-bold"
                        />
                      </div>

                      <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1">
                        {filteredSubjectGroups.length === 0 ? (
                          <p className="px-2 py-3 text-sm text-muted-foreground font-bold italic">
                            No subjects match your search.
                          </p>
                        ) : (
                          filteredSubjectGroups.map((group) => (
                            <div
                              key={group.group}
                              className="space-y-1">
                              <h4 className="px-2 text-[10px] font-black uppercase tracking-widest text-primary/80">
                                {group.group}
                              </h4>
                              <div className="space-y-0.5">
                                {group.options.map((option) => {
                                  const isSelected = selectedSubjects.includes(
                                    option.value,
                                  );

                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => toggleSubject(option.value)}
                                      className={cn(
                                        "flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition",
                                        isSelected
                                          ? "bg-primary text-primary-foreground font-black"
                                          : "hover:bg-muted text-foreground font-bold text-xs uppercase",
                                      )}>
                                      <span>{option.label}</span>
                                      {isSelected ? (
                                        <Check className="h-3.5 w-3.5 stroke-[4]" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedSubjects.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground font-bold italic">
                        Select all teaching subjects (both BEC and SCP) assigned to this teacher.
                      </p>
                    ) : (
                      selectedSubjects.map((subject) => (
                        <Badge
                          key={subject}
                          variant="secondary"
                          className="gap-1.5 pr-1 py-1 text-[10px] font-black uppercase border-primary/20">
                          <span>{subjectLabelMap.get(subject) ?? subject}</span>
                          <button
                            type="button"
                            onClick={() => toggleSubject(subject)}
                            className="rounded-full p-0.5 text-muted-foreground transition hover:text-foreground hover:bg-muted"
                            aria-label={`Remove ${subject}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className="w-full sm:w-auto">
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </SheetContent>

      {canShowPhoto && (
        <ImageEnlarger
          src={photoPreviewUrl || ""}
          isOpen={isPhotoEnlarged}
          onClose={() => setIsPhotoEnlarged(false)}
          alt="Teacher photo"
        />
      )}
    </Sheet>
  );
});
