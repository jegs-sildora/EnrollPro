import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search, Trash2, X } from "lucide-react";
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
  TEACHER_SUBJECT_OPTIONS,
  TEACHER_DEPARTMENT_OPTIONS,
} from "../utils";

type TeacherFormField = Exclude<keyof TeacherFormState, "photo" | "subjects">;
const EMPTY_DEPARTMENT_VALUE = "__NONE__";
const EMPTY_PLANTILLA_POSITION_VALUE = "__NONE__";

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

export function TeacherFormSheet({
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
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);
  const [isSubjectsPopoverOpen, setIsSubjectsPopoverOpen] = useState(false);
  const [subjectSearchTerm, setSubjectSearchTerm] = useState("");

  useEffect(() => {
    if (!open) {
      setIsSubjectsPopoverOpen(false);
      setSubjectSearchTerm("");
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

  const filteredSubjectOptions = useMemo(() => {
    const normalizedQuery = subjectSearchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return TEACHER_SUBJECT_OPTIONS;
    }

    return TEACHER_SUBJECT_OPTIONS.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.value.toLowerCase().includes(normalizedQuery),
    );
  }, [subjectSearchTerm]);

  const subjectLabelMap = useMemo(
    () =>
      new Map<string, string>(
        TEACHER_SUBJECT_OPTIONS.map((option) => [option.value, option.label]),
      ),
    [],
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
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        onPhotoSelect(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className="max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={onRemovePhoto}
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
                  <Label>Last Name *</Label>
                  <Input
                    placeholder="e.g. Santos"
                    value={formData.lastName}
                    onChange={(event) =>
                      onFieldChange("lastName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="e.g. Maria"
                    value={formData.firstName}
                    onChange={(event) =>
                      onFieldChange("firstName", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input
                    placeholder="e.g. Cruz"
                    value={formData.middleName}
                    onChange={(event) =>
                      onFieldChange("middleName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="e.g. maria.santos@example.com"
                    value={formData.email}
                    onChange={(event) =>
                      onFieldChange("email", event.target.value)
                    }
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
                  <Label>Contact Number</Label>
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
                  <Label>Employee ID</Label>
                  <Input
                    placeholder="Leave blank to auto-generate"
                    value={formData.employeeId}
                    onChange={(event) =>
                      onFieldChange("employeeId", event.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    If empty, the system assigns the next ID (for example,
                    TCH-0001).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input
                    placeholder="e.g. MASTER TEACHER I, TEACHER III"
                    value={formData.designation}
                    onChange={(event) =>
                      onFieldChange("designation", event.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Plantilla Position</Label>
                  <Select
                    value={selectedPlantillaPositionValue}
                    onValueChange={(value) =>
                      onFieldChange(
                        "plantillaPosition",
                        value === EMPTY_PLANTILLA_POSITION_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plantilla position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_PLANTILLA_POSITION_VALUE}>
                        Not set
                      </SelectItem>
                      {TEACHER_PLANTILLA_POSITION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={formData.department || EMPTY_DEPARTMENT_VALUE}
                    onValueChange={(value) =>
                      onFieldChange(
                        "department",
                        value === EMPTY_DEPARTMENT_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_DEPARTMENT_VALUE}>
                        Not set
                      </SelectItem>
                      {TEACHER_DEPARTMENT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Specialization / Learning Area</Label>
                  <Input
                    placeholder="e.g. Pure Mathematics, Organic Chemistry"
                    value={formData.specialization}
                    onChange={(event) =>
                      onFieldChange("specialization", event.target.value)
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Specific expertise within the department.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Teaching Subjects (Qualifications)</Label>
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
                        className="w-full justify-between font-normal">
                        <span className="truncate">
                          {selectedSubjects.length > 0
                            ? `${selectedSubjects.length} selected`
                            : "Select one or more subjects"}
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
                          placeholder="Search subjects"
                          value={subjectSearchTerm}
                          onChange={(event) =>
                            setSubjectSearchTerm(event.target.value)
                          }
                          className="pl-8"
                        />
                      </div>

                      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                        {filteredSubjectOptions.length === 0 ? (
                          <p className="px-2 py-3 text-sm text-muted-foreground">
                            No subjects match your search.
                          </p>
                        ) : (
                          filteredSubjectOptions.map((option) => {
                            const isSelected = selectedSubjects.includes(
                              option.value,
                            );

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleSubject(option.value)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition",
                                  isSelected
                                    ? "bg-primary/10 text-foreground"
                                    : "hover:bg-muted",
                                )}>
                                <span>{option.label}</span>
                                {isSelected ? (
                                  <span className="text-xs font-semibold uppercase text-primary">
                                    Added
                                  </span>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedSubjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Select all teaching subjects assigned to this teacher.
                      </p>
                    ) : (
                      selectedSubjects.map((subject) => (
                        <Badge
                          key={subject}
                          variant="secondary"
                          className="gap-1.5 pr-1">
                          <span>{subjectLabelMap.get(subject) ?? subject}</span>
                          <button
                            type="button"
                            onClick={() => toggleSubject(subject)}
                            className="rounded-full p-0.5 text-muted-foreground transition hover:text-foreground"
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
}
