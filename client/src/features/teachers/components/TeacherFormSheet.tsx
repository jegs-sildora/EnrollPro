import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Check, ChevronsUpDown, Search, X, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import type { TeacherFormState } from "../types";
import {
  TEACHER_PLANTILLA_POSITION_OPTIONS,
  TEACHER_SPECIALIZATION_GROUPS,
  TEACHER_DEPARTMENT_OPTIONS,
} from "../utils";
import { DEPED_TEACHER_SUBJECT_GROUPS } from "@enrollpro/shared";

type TeacherFormField = keyof TeacherFormState;

const EMPTY_DEPARTMENT_VALUE = "__NONE__";
const EMPTY_PLANTILLA_POSITION_VALUE = "__NONE__";
const EMPTY_SPECIALIZATION_VALUE = "__NONE__";

interface SearchableSpecializationOption {
  value: string;
  label: string;
  flatIndex: number;
}

interface SearchableSpecializationGroup {
  group: string;
  options: SearchableSpecializationOption[];
}

interface TeacherFormSheetProps {
  mode: "create" | "edit";
  open: boolean;
  title: string;
  description: string;
  formData: TeacherFormState;
  submitting: boolean;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: TeacherFormField, value: string | string[]) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const TeacherFormSheet = memo(function TeacherFormSheet({
  mode,
  open,
  title,
  description,
  formData,
  submitting,
  canSubmit,
  onOpenChange,
  onFieldChange,
  onCancel,
  onSubmit,
}: TeacherFormSheetProps) {
  const [panelPercentage, setPanelPercentage] = useState(45);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const isResizing = useRef(false);
  const specializationSearchInputRef = useRef<HTMLInputElement>(null);
  const specializationOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isSpecializationPopoverOpen, setIsSpecializationPopoverOpen] =
    useState(false);
  const [specializationSearchTerm, setSpecializationSearchTerm] = useState("");
  const [activeSpecializationIndex, setActiveSpecializationIndex] = useState(0);

  const [subjectSearchTerm, setSubjectSearchTerm] = useState("");
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);

  const allSpecializationOptions = useMemo(
    () =>
      TEACHER_SPECIALIZATION_GROUPS.flatMap((group) =>
        group.options.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      ),
    [],
  );

  const selectedSpecializationOption = useMemo(
    () =>
      allSpecializationOptions.find(
        (option) => option.value === formData.specialization,
      ) ?? null,
    [allSpecializationOptions, formData.specialization],
  );

  const searchableSpecializationGroups = useMemo<
    SearchableSpecializationGroup[]
  >(() => {
    const normalizedSearch = specializationSearchTerm.trim().toLowerCase();
    let runningFlatIndex = 0;

    return TEACHER_SPECIALIZATION_GROUPS.map((group) => {
      const matchesGroupLabel = group.group
        .toLowerCase()
        .includes(normalizedSearch);

      const filteredOptions = group.options
        .filter((option) => {
          if (!normalizedSearch) {
            return true;
          }

          return (
            matchesGroupLabel ||
            option.label.toLowerCase().includes(normalizedSearch) ||
            option.value.toLowerCase().includes(normalizedSearch)
          );
        })
        .map((option) => ({
          value: option.value,
          label: option.label,
          flatIndex: runningFlatIndex++,
        }));

      return {
        group: group.group,
        options: filteredOptions,
      };
    }).filter((group) => group.options.length > 0);
  }, [specializationSearchTerm]);

  const flatSpecializationOptions = useMemo(
    () => searchableSpecializationGroups.flatMap((group) => group.options),
    [searchableSpecializationGroups],
  );

  useEffect(() => {
    if (!open) {
      setIsSpecializationPopoverOpen(false);
      setSpecializationSearchTerm("");
      setActiveSpecializationIndex(0);
      setIsSubjectPopoverOpen(false);
      setSubjectSearchTerm("");
    }
  }, [open]);

  useEffect(() => {
    if (!isSpecializationPopoverOpen) {
      setSpecializationSearchTerm("");
      setActiveSpecializationIndex(0);
      specializationOptionRefs.current = [];
      return;
    }

    const focusTimer = window.setTimeout(() => {
      specializationSearchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isSpecializationPopoverOpen]);

  useEffect(() => {
    if (flatSpecializationOptions.length === 0) {
      setActiveSpecializationIndex(0);
      return;
    }

    setActiveSpecializationIndex((current) => {
      if (current < 0 || current >= flatSpecializationOptions.length) {
        return 0;
      }

      return current;
    });
  }, [flatSpecializationOptions]);

  useEffect(() => {
    if (
      !isSpecializationPopoverOpen ||
      flatSpecializationOptions.length === 0
    ) {
      return;
    }

    specializationOptionRefs.current[activeSpecializationIndex]?.scrollIntoView(
      {
        block: "nearest",
      },
    );
  }, [
    activeSpecializationIndex,
    flatSpecializationOptions.length,
    isSpecializationPopoverOpen,
  ]);

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

  const selectedPlantillaPositionValue =
    formData.plantillaPosition.trim().length > 0
      ? formData.plantillaPosition
      : EMPTY_PLANTILLA_POSITION_VALUE;

  const selectedSpecializationValue =
    formData.specialization.trim().length > 0
      ? formData.specialization
      : EMPTY_SPECIALIZATION_VALUE;

  const handleSpecializationSelect = useCallback(
    (value: string) => {
      onFieldChange(
        "specialization",
        value === EMPTY_SPECIALIZATION_VALUE ? "" : value,
      );
      setIsSpecializationPopoverOpen(false);
      setSpecializationSearchTerm("");
    },
    [onFieldChange],
  );

  const handleSubjectToggle = useCallback(
    (subject: string) => {
      const currentSubjects = formData.subjects || [];
      const exists = currentSubjects.includes(subject);
      const nextSubjects = exists
        ? currentSubjects.filter((s) => s !== subject)
        : [...currentSubjects, subject];
      onFieldChange("subjects", nextSubjects);
    },
    [formData.subjects, onFieldChange],
  );

  const filteredSubjectGroups = useMemo(() => {
    return DEPED_TEACHER_SUBJECT_GROUPS.map((group) => ({
      ...group,
      options: group.options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(subjectSearchTerm.toLowerCase()) ||
          opt.value.toLowerCase().includes(subjectSearchTerm.toLowerCase()),
      ),
    })).filter((group) => group.options.length > 0);
  }, [subjectSearchTerm]);

  const handleSpecializationSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (flatSpecializationOptions.length === 0) {
        if (event.key === "Escape") {
          setIsSpecializationPopoverOpen(false);
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSpecializationIndex(
          (current) => (current + 1) % flatSpecializationOptions.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSpecializationIndex((current) => {
          if (current <= 0) {
            return flatSpecializationOptions.length - 1;
          }
          return current - 1;
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const activeOption =
          flatSpecializationOptions[activeSpecializationIndex];
        if (activeOption) {
          handleSpecializationSelect(activeOption.value);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsSpecializationPopoverOpen(false);
      }
    },
    [
      activeSpecializationIndex,
      flatSpecializationOptions,
      handleSpecializationSelect,
    ],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
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
            <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black uppercase">
              {title}
            </SheetTitle>
            <SheetDescription className="text-[11px] sm:text-xs text-primary-foreground/90 font-medium">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Personal Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  Basic profile details for the faculty directory.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    First Name *
                  </Label>
                  <Input
                    placeholder="e.g., Anna Liza"
                    value={formData.firstName}
                    onChange={(event) =>
                      onFieldChange("firstName", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Middle Name
                  </Label>
                  <Input
                    placeholder="e.g., M."
                    value={formData.middleName}
                    onChange={(event) =>
                      onFieldChange("middleName", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Last Name *
                  </Label>
                  <Input
                    placeholder="e.g., Dela Cruz"
                    value={formData.lastName}
                    onChange={(event) =>
                      onFieldChange("lastName", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    DepEd Email Address *
                  </Label>
                  <Input
                    type="email"
                    placeholder="firstname.lastname"
                    value={formData.email}
                    onChange={(event) =>
                      onFieldChange("email", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Contact Number
                  </Label>
                  <Input
                    placeholder="0917-123-4567"
                    inputMode="numeric"
                    maxLength={13}
                    pattern="\\d{4}-\\d{3}-\\d{4}"
                    title="Contact number must follow XXXX-XXX-XXXX format"
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
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Employee ID / T.I.N. *
                  </Label>
                  <Input
                    placeholder="e.g., 1234567 (DepEd ID)"
                    value={formData.employeeId}
                    onChange={(event) =>
                      onFieldChange("employeeId", event.target.value)
                    }
                    className="font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Plantilla Position
                  </Label>
                  <Select
                    value={selectedPlantillaPositionValue}
                    onValueChange={(value) =>
                      onFieldChange(
                        "plantillaPosition",
                        value === EMPTY_PLANTILLA_POSITION_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value={EMPTY_PLANTILLA_POSITION_VALUE}
                        className="font-bold">
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
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Department
                  </Label>
                  <Select
                    value={formData.department || EMPTY_DEPARTMENT_VALUE}
                    onValueChange={(value) =>
                      onFieldChange(
                        "department",
                        value === EMPTY_DEPARTMENT_VALUE ? "" : value,
                      )
                    }>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value={EMPTY_DEPARTMENT_VALUE}
                        className="font-bold">
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
                  <Label className="font-bold text-xs uppercase tracking-tight">
                    Specialization / Major
                  </Label>
                  <Popover
                    open={isSpecializationPopoverOpen}
                    onOpenChange={setIsSpecializationPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isSpecializationPopoverOpen}
                        className="w-full justify-between font-bold">
                        <span className="truncate text-left">
                          {selectedSpecializationValue ===
                          EMPTY_SPECIALIZATION_VALUE
                            ? "Not set"
                            : selectedSpecializationOption?.label || "Not set"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      onOpenAutoFocus={(event) => event.preventDefault()}>
                      <div className="sticky top-0 z-10 border-b bg-background p-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            ref={specializationSearchInputRef}
                            value={specializationSearchTerm}
                            onChange={(event) =>
                              setSpecializationSearchTerm(event.target.value)
                            }
                            onKeyDown={handleSpecializationSearchKeyDown}
                            placeholder="Search specialization / major"
                            className="pl-8 pr-8 font-semibold"
                          />
                          {specializationSearchTerm.trim().length > 0 ? (
                            <button
                              type="button"
                              aria-label="Clear specialization search"
                              onClick={() => {
                                setSpecializationSearchTerm("");
                                setActiveSpecializationIndex(0);
                                specializationSearchInputRef.current?.focus();
                              }}
                              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleSpecializationSelect(
                              EMPTY_SPECIALIZATION_VALUE,
                            )
                          }
                          className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-semibold transition hover:bg-muted">
                          <span>Not set</span>
                          {selectedSpecializationValue ===
                          EMPTY_SPECIALIZATION_VALUE ? (
                            <Check className="h-4 w-4" />
                          ) : null}
                        </button>

                        {flatSpecializationOptions.length === 0 ? (
                          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-4 text-center">
                            <p className="text-sm font-semibold text-muted-foreground">
                              No specializations found matching
                              {` "${specializationSearchTerm}"`}.
                            </p>
                            <p className="text-xs text-muted-foreground/90">
                              Please check your spelling.
                            </p>
                          </div>
                        ) : (
                          searchableSpecializationGroups.map((group) => (
                            <div
                              key={group.group}
                              className="mt-2 first:mt-0">
                              <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary/80">
                                {group.group}
                              </p>
                              <div className="space-y-0.5">
                                {group.options.map((option) => {
                                  const isActive =
                                    option.flatIndex ===
                                    activeSpecializationIndex;
                                  const isSelected =
                                    formData.specialization === option.value;

                                  return (
                                    <button
                                      key={option.value}
                                      ref={(node) => {
                                        specializationOptionRefs.current[
                                          option.flatIndex
                                        ] = node;
                                      }}
                                      type="button"
                                      onMouseEnter={() =>
                                        setActiveSpecializationIndex(
                                          option.flatIndex,
                                        )
                                      }
                                      onClick={() =>
                                        handleSpecializationSelect(option.value)
                                      }
                                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-semibold transition ${
                                        isActive
                                          ? "bg-primary/10 text-foreground"
                                          : "hover:bg-muted"
                                      }`}>
                                      <span className="truncate text-left">
                                        {option.label}
                                      </span>
                                      {isSelected ? (
                                        <Check className="ml-2 h-4 w-4 shrink-0" />
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
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Qualified Subjects
                </h3>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Subjects the teacher is licensed or certified to teach.
                </p>
              </header>

              <div className="flex min-h-[40px] flex-wrap gap-2 rounded-lg border-2 border-dashed bg-muted/20 p-2">
                {formData.subjects?.map((sub) => (
                  <Badge
                    key={sub}
                    variant="default"
                    className="gap-1 px-2 py-1 text-[10px] font-black uppercase shadow-sm">
                    {sub}
                    <button
                      type="button"
                      onClick={() => handleSubjectToggle(sub)}
                      className="transition-colors hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Popover
                  open={isSubjectPopoverOpen}
                  onOpenChange={setIsSubjectPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 border-2 border-dashed text-xs font-bold uppercase">
                      <Plus className="h-3 w-3" /> Add Subject
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-80 p-0 shadow-xl border-2">
                    <div className="border-b bg-muted/20 p-3">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={subjectSearchTerm}
                          onChange={(e) => setSubjectSearchTerm(e.target.value)}
                          placeholder="Search subjects..."
                          className="h-8 pl-7 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2 space-y-4">
                      {filteredSubjectGroups.map((group) => (
                        <div
                          key={group.group}
                          className="space-y-1">
                          <p className="px-2 text-[10px] font-black uppercase tracking-widest text-primary/70">
                            {group.group}
                          </p>
                          <div className="grid grid-cols-1 gap-0.5">
                            {group.options.map((opt) => {
                              const isSelected = formData.subjects?.includes(
                                opt.value,
                              );
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleSubjectToggle(opt.value)}
                                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase transition ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "text-foreground hover:bg-muted"
                                  }`}>
                                  <span>{opt.label}</span>
                                  {isSelected && <Check className="h-3 w-3" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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
    </Sheet>
  );
});
