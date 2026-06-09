import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/shared/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  User,
  Briefcase,
  GraduationCap,
  Loader2,
  Fingerprint,
  CheckCircle2,
  Search,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { cn } from "@/shared/lib/utils";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import {
  DEPED_TEACHER_PLANTILLA_POSITION_VALUES,
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS,
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  DEPED_TEACHER_SPECIALIZATION_OPTIONS,
} from "@enrollpro/shared";

// ── eSF7 Validation Schema with Strict Input Masking ──────────────────────────
const eSF7Schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required"),
  extensionName: z.string().trim().optional(),
  birthdate: z.string().min(1, "Date of birth is required"),
  sex: z.enum(["MALE", "FEMALE"]),
  civilStatus: z.enum(["SINGLE", "MARRIED", "WIDOWED", "SEPARATED"]),
  email: z.string().trim().min(1, "DepEd email address is required").email("Invalid email address"),
  contactNumber: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "Mobile number must be exactly 11 digits starting with 09")
    .or(z.literal("")),
  employeeId: z
    .string()
    .trim()
    .regex(/^[0-9]{7}$/, "Employee number must be exactly 7 numeric digits"),
  tin: z
    .string()
    .trim()
    .regex(/^\d{3}-\d{3}-\d{3}-\d{3}$/, "TIN must follow BIR format: 123-456-789-000")
    .or(z.literal("")),
  fundSource: z.enum(["NATIONAL", "LOCAL_SEF"]),
  natureOfAppointment: z.enum([
    "REGULAR_PERMANENT",
    "SUBSTITUTE",
    "CONTRACTUAL",
    "LOCAL_SCHOOL_BOARD",
  ]),
  plantillaPosition: z.enum(DEPED_TEACHER_PLANTILLA_POSITION_VALUES, {
    message: "Select a valid plantilla position",
  }),
  dateOfFirstService: z.string().min(1, "Date of first service is required"),
  degreeFinished: z.string().trim().min(1, "Degree finished is required"),
  specialization: z.string().trim().min(1, "Specialization is required"),
  department: z.string().trim().min(1, "Assigned department is required"),
});

type eSF7TeacherFormValues = z.infer<typeof eSF7Schema>;

// Mock database options complying with DepEd eSF7 definitions
const CIVIL_STATUS_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "SEPARATED", label: "Separated" },
];

const FUND_SOURCE_OPTIONS = [
  { value: "NATIONAL", label: "National (DepEd)" },
  { value: "LOCAL_SEF", label: "Local / SEF" },
];

const APPOINTMENT_OPTIONS = [
  { value: "REGULAR_PERMANENT", label: "Regular Permanent" },
  { value: "SUBSTITUTE", label: "Substitute" },
  { value: "CONTRACTUAL", label: "Contractual" },
  { value: "LOCAL_SCHOOL_BOARD", label: "Local School Board" },
];

const PH_DEGREE_OPTIONS = [
  "BSEd",
  "BEEd",
  "AB English",
  "BS Mathematics",
  "BS General Science",
  "BS Biology",
  "BS Chemistry",
  "BS Physics",
  "BS Computer Science",
  "BS Information Technology",
  "MA Education",
  "PhD in Education",
];

interface TeacherProfilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: number | null;
  onSaveSuccess: () => void;
}

// ── Local Reusable Components ───────────────────────────────────────────────

interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: string[];
  className?: string;
}

function CreatableCombobox({
  value,
  onChange,
  placeholder = "Select or type custom...",
  options,
  className,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    return options.filter((opt) =>
      opt.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [searchTerm, options]);

  const exactMatchExists = useMemo(() => {
    return options.some(
      (opt) => opt.toLowerCase() === searchTerm.toLowerCase().trim()
    );
  }, [searchTerm, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between font-bold text-xs h-9 text-left px-3 border border-border bg-background hover:bg-muted/50 transition-colors text-foreground",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <span className="text-foreground font-normal">▼</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border border-border shadow-lg rounded-lg overflow-hidden z-[100]"
        align="start"
      >
        <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/10">
          <Search className="h-3.5 w-3.5 text-foreground shrink-0" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search or add custom..."
            autoComplete="off"
            className="h-8 font-bold text-xs bg-background border-border focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
                setSearchTerm("");
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-between hover:bg-muted/50 cursor-pointer",
                value === opt
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-foreground"
              )}
            >
              <span>{opt}</span>
              {value === opt && <span className="text-primary">✓</span>}
            </button>
          ))}

          {/* Creatable custom input row */}
          {searchTerm.trim() && !exactMatchExists && (
            <button
              type="button"
              onClick={() => {
                onChange(searchTerm.trim());
                setOpen(false);
                setSearchTerm("");
              }}
              className="w-full text-left px-3 py-2 rounded-md text-xs font-black text-primary hover:bg-primary/5 cursor-pointer border border-dashed border-primary/30 mt-1 bg-primary/5"
            >
              <span>+ Create &quot;{searchTerm.trim()}&quot;</span>
            </button>
          )}

          {filteredOptions.length === 0 && !searchTerm.trim() && (
            <div className="text-center py-4 text-xs text-foreground font-bold">
              No options available
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: readonly SearchableSelectOption[] | SearchableSelectOption[];
  className?: string;
}

function SearchableSelect({
  value,
  onChange,
  placeholder = "Select option...",
  options,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term)
    );
  }, [searchTerm, options]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [value, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between font-bold text-xs h-9 text-left px-3 border border-border bg-background hover:bg-muted/50 transition-colors text-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span className="text-foreground font-normal">▼</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border border-border shadow-lg rounded-lg overflow-hidden z-[100]"
        align="start"
      >
        <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/10">
          <Search className="h-3.5 w-3.5 text-foreground shrink-0" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            autoComplete="off"
            className="h-8 font-bold text-xs bg-background border-border focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
          {filteredOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                setSearchTerm("");
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-between hover:bg-muted/50 cursor-pointer",
                value === opt.value
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-foreground"
              )}
            >
              <span>{opt.label}</span>
              {value === opt.value && <span className="text-primary">✓</span>}
            </button>
          ))}

          {filteredOptions.length === 0 && (
            <div className="text-center py-4 text-xs text-foreground font-bold">
              No options found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Drawer Component ────────────────────────────────────────────────────

export function TeacherProfilePanel({
  open,
  onOpenChange,
  teacherId,
  onSaveSuccess,
}: TeacherProfilePanelProps) {
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [initialActive, setInitialActive] = useState<boolean>(true);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<eSF7TeacherFormValues>({
    resolver: zodResolver(eSF7Schema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      extensionName: "",
      birthdate: "",
      sex: "FEMALE",
      civilStatus: "SINGLE",
      email: "",
      contactNumber: "",
      employeeId: "",
      tin: "",
      fundSource: "NATIONAL",
      natureOfAppointment: "REGULAR_PERMANENT",
      plantillaPosition: "" as unknown as typeof DEPED_TEACHER_PLANTILLA_POSITION_VALUES[number],
      dateOfFirstService: "",
      degreeFinished: "",
      specialization: "",
      department: "",
    },
  });

  // Watch names to show in header live
  const watchedFirstName = watch("firstName");
  const watchedLastName = watch("lastName");
  const watchedEmployeeId = watch("employeeId");

  const displayName = useMemo(() => {
    if (watchedFirstName || watchedLastName) {
      return `${watchedLastName.toUpperCase()}, ${watchedFirstName}`;
    }
    return "New Faculty Member";
  }, [watchedFirstName, watchedLastName]);

  const initials = useMemo(() => {
    const f = watchedFirstName?.charAt(0) || "N";
    const l = watchedLastName?.charAt(0) || "F";
    return `${f}${l}`.toUpperCase();
  }, [watchedFirstName, watchedLastName]);

  const hasUnsavedChanges = isDirty || isActive !== initialActive;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (hasUnsavedChanges) {
        setShowUnsavedModal(true);
        return;
      }
    }
    onOpenChange(nextOpen);
  };

  // Load teacher details if editing
  useEffect(() => {
    const loadTeacher = async () => {
      if (!teacherId || !open) return;
      setLoadingProfile(true);
      try {
        const res = await api.get(`/teachers/${teacherId}`);
        const teacher = res.data.teacher || res.data;
        setIsActive(teacher.isActive);
        setInitialActive(teacher.isActive);

        // Map details into form fields
        reset({
          firstName: teacher.firstName || "",
          middleName: teacher.middleName || "",
          lastName: teacher.lastName || "",
          extensionName: teacher.extensionName || "",
          birthdate: teacher.birthdate
            ? format(new Date(teacher.birthdate), "yyyy-MM-dd")
            : "",
          sex: teacher.sex === "MALE" ? "MALE" : "FEMALE",
          civilStatus: teacher.civilStatus || "SINGLE",
          email: teacher.email || "",
          contactNumber: teacher.contactNumber || "",
          employeeId: teacher.employeeId || "",
          tin: teacher.tin || "",
          fundSource: teacher.fundSource || "NATIONAL",
          natureOfAppointment: teacher.natureOfAppointment || "REGULAR_PERMANENT",
          plantillaPosition: (teacher.plantillaPosition || "").toUpperCase() as unknown as typeof DEPED_TEACHER_PLANTILLA_POSITION_VALUES[number],
          dateOfFirstService: teacher.dateOfFirstService
            ? format(new Date(teacher.dateOfFirstService), "yyyy-MM-dd")
            : "",
          degreeFinished: teacher.degreeFinished || "",
          specialization: teacher.specialization || "",
          department: teacher.department || "",
        });
      } catch (err: unknown) {
        console.error("Failed to load teacher:", err);
        sileo.error({
          title: "Profile Load Error",
          description: "Could not retrieve the teacher profile. Please try again.",
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    if (open && teacherId) {
      void loadTeacher();
    } else if (open && !teacherId) {
      // Reset to defaults for fresh creation
      setIsActive(true);
      setInitialActive(true);
      reset({
        firstName: "",
        middleName: "",
        lastName: "",
        extensionName: "",
        birthdate: "",
        sex: "FEMALE",
        civilStatus: "SINGLE",
        email: "",
        contactNumber: "",
        employeeId: "",
        tin: "",
        fundSource: "NATIONAL",
        natureOfAppointment: "REGULAR_PERMANENT",
        plantillaPosition: "" as unknown as typeof DEPED_TEACHER_PLANTILLA_POSITION_VALUES[number],
        dateOfFirstService: "",
        degreeFinished: "",
        specialization: "",
        department: "",
      });
    }
  }, [open, teacherId, reset]);

  const handleSave = async (data: eSF7TeacherFormValues) => {
    setIsSubmitting(true);
    try {
      // Filter out eSF7 local fields to match strict backend schema validator (preventing strict 400 validation error)
      const apiPayload = {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        email: data.email,
        employeeId: data.employeeId,
        contactNumber: data.contactNumber || null,
        sex: data.sex,
        specialization: data.specialization,
        department: data.department,
        plantillaPosition: data.plantillaPosition,
      };

      if (teacherId) {
        // Edit Mode
        await api.put(`/teachers/${teacherId}`, apiPayload);

        // Reactivate/deactivate only if status has changed
        if (isActive !== initialActive) {
          if (!isActive) {
            await api.patch(`/teachers/${teacherId}/deactivate`, {
              reason: "Extended Leave",
            });
          } else {
            await api.patch(`/teachers/${teacherId}/reactivate`);
          }
        }

        sileo.success({
          title: "eSF7 Profile Saved",
          description: `${data.lastName}, ${data.firstName}'s plantilla record was successfully updated.`,
        });
      } else {
        // Create Mode
        const res = await api.post("/teachers", apiPayload);
        const newTeacher = res.data.teacher || res.data;
        if (!isActive) {
          await api.patch(`/teachers/${newTeacher.id}/deactivate`, {
            reason: "Extended Leave",
          });
        }
        sileo.success({
          title: "Faculty Created Successfully",
          description: `${data.lastName}, ${data.firstName} is now registered in eSF7 registry.`,
        });
      }
      onSaveSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Profile save failed:", err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      sileo.error({
        title: "Save Failed",
        description:
          axiosErr?.response?.data?.message || "Failed to persist teacher profile.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        onPointerDownOutside={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
            setShowUnsavedModal(true);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
            setShowUnsavedModal(true);
          }
        }}
        className="sm:max-w-2xl w-full p-0 flex flex-col h-full border-l-0 overflow-hidden bg-background"
      >
        {/* Sticky Header with Curated HSL Accent & Glassmorphism */}
        <div className="bg-primary px-6 py-5 relative shrink-0 border-b border-border shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-primary-foreground/10 flex items-center justify-center font-black text-primary-foreground text-xl uppercase border border-primary-foreground/20 shadow-md">
              {initials}
            </div>
            <div className="space-y-0.5">
              <h2 className="text-base font-black text-primary-foreground uppercase leading-none">
                {displayName}
              </h2>
              <p className="text-xs font-black text-primary-foreground/80 uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                <Fingerprint className="size-3" />
                Employee ID: {watchedEmployeeId || "PENDING"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 pr-8">
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className="cursor-pointer animate-fade-in"
            >
              <Badge
                className={cn(
                  "text-xs font-bold uppercase transition-all shadow-sm border",
                  isActive
                    ? "bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
                    : "bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
                )}
              >
                {isActive ? "Active" : "On Leave"}
              </Badge>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit(handleSave)}
          autoComplete="off"
          className="flex-1 flex flex-col overflow-hidden"
        >
          {loadingProfile ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-black uppercase tracking-widest text-foreground animate-pulse">
                Decrypting eSF7 Profile Vault...
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">

              {/* Main eSF7 Collapsible Accordion */}
              <Accordion
                type="multiple"
                defaultValue={["personal", "employment", "academic"]}
                className="space-y-4"
              >
                {/* 1. PERSONAL PROFILE */}
                <AccordionItem
                  value="personal"
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-5 py-4 font-black uppercase text-xs tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      1. Personal Profile & Demographics
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                    <div className="space-y-4">
                      {/* Name Fields (Split into 4) */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            First Name *
                          </Label>
                          <Controller
                            name="firstName"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="First Name"
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.firstName && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.firstName.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Middle Name
                          </Label>
                          <Controller
                            name="middleName"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="Middle Name"
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Last Name *
                          </Label>
                          <Controller
                            name="lastName"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="Last Name"
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.lastName && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.lastName.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Name Extension (Jr/Sr/III)
                          </Label>
                          <Controller
                            name="extensionName"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="e.g., Jr., III"
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                        </div>
                      </div>

                      {/* Birthdate, Sex, Civil Status */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Date of Birth *
                          </Label>
                          <Controller
                            name="birthdate"
                            control={control}
                            render={({ field }) => (
                              <HybridDatePicker
                                value={field.value}
                                onChange={field.onChange}
                                className="bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.birthdate && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.birthdate.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Sex *
                          </Label>
                          <Controller
                            name="sex"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="font-bold text-xs h-9 bg-background text-foreground border-border">
                                  <SelectValue placeholder="Select sex" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border">
                                  <SelectItem
                                    value="MALE"
                                    className="text-xs font-bold uppercase hover:bg-muted"
                                  >
                                    Male
                                  </SelectItem>
                                  <SelectItem
                                    value="FEMALE"
                                    className="text-xs font-bold uppercase hover:bg-muted"
                                  >
                                    Female
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.sex && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.sex.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Civil Status *
                          </Label>
                          <Controller
                            name="civilStatus"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="font-bold text-xs h-9 bg-background text-foreground border-border">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border">
                                  {CIVIL_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                      className="text-xs font-bold uppercase hover:bg-muted"
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.civilStatus && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.civilStatus.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Contact Channels */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Email Address (DepEd) *
                          </Label>
                          <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="email"
                                placeholder="firstname.lastname@deped.edu.ph"
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.email && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.email.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Mobile Number
                          </Label>
                          <Controller
                            name="contactNumber"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="09171234567"
                                maxLength={11}
                                onChange={(e) => {
                                  // reject all alphabetical characters
                                  const val = e.target.value
                                    .replace(/[^0-9]/g, "")
                                    .slice(0, 11);
                                  field.onChange(val);
                                }}
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.contactNumber && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.contactNumber.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2. EMPLOYMENT & PLANTILLA (eSF7 CORE) */}
                <AccordionItem
                  value="employment"
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-5 py-4 font-black uppercase text-xs tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      2. Employment & Plantilla Records
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                    <div className="space-y-4">
                      {/* Employee ID & TIN */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Employee ID Number *
                          </Label>
                          <Controller
                            name="employeeId"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="e.g., 1234567"
                                maxLength={7}
                                onChange={(e) => {
                                  // reject all alphabetical characters
                                  const val = e.target.value
                                    .replace(/[^0-9]/g, "")
                                    .slice(0, 7);
                                  field.onChange(val);
                                }}
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.employeeId && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.employeeId.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Tax Identification Number (TIN)
                          </Label>
                          <Controller
                            name="tin"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="123-456-789-000"
                                maxLength={15}
                                onChange={(e) => {
                                  // reject alpha & implement strict BIR Philippine format: xxx-xxx-xxx-xxx
                                  let val = e.target.value.replace(/[^0-9]/g, "");
                                  if (val.length > 12) val = val.slice(0, 12);

                                  let formatted = "";
                                  if (val.length > 0) {
                                    formatted += val.slice(0, 3);
                                  }
                                  if (val.length > 3) {
                                    formatted += "-" + val.slice(3, 6);
                                  }
                                  if (val.length > 6) {
                                    formatted += "-" + val.slice(6, 9);
                                  }
                                  if (val.length > 9) {
                                    formatted += "-" + val.slice(9, 12);
                                  }
                                  field.onChange(formatted);
                                }}
                                autoComplete="off"
                                className="font-bold text-xs bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.tin && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.tin.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Fund Source & Nature of Appointment */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Fund Source *
                          </Label>
                          <Controller
                            name="fundSource"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="font-bold text-xs h-9 bg-background text-foreground border-border">
                                  <SelectValue placeholder="Select fund source" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border">
                                  {FUND_SOURCE_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                      className="text-xs font-bold uppercase hover:bg-muted"
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.fundSource && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.fundSource.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Nature of Appointment *
                          </Label>
                          <Controller
                            name="natureOfAppointment"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="font-bold text-xs h-9 bg-background text-foreground border-border">
                                  <SelectValue placeholder="Select appointment" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border">
                                  {APPOINTMENT_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                      className="text-xs font-bold uppercase hover:bg-muted"
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.natureOfAppointment && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.natureOfAppointment.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Plantilla Position & Date of First Service */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Plantilla Position *
                          </Label>
                          <Controller
                            name="plantillaPosition"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="font-bold text-xs h-9 bg-background text-foreground border-border">
                                  <SelectValue placeholder="Select official plantilla position..." />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border max-h-[300px] overflow-y-auto">
                                  {DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                      className="text-xs font-bold uppercase hover:bg-muted"
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.plantillaPosition && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.plantillaPosition.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Date of First Service *
                          </Label>
                          <Controller
                            name="dateOfFirstService"
                            control={control}
                            render={({ field }) => (
                              <HybridDatePicker
                                value={field.value}
                                onChange={field.onChange}
                                className="bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.dateOfFirstService && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.dateOfFirstService.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 3. ACADEMIC QUALIFICATIONS & DEPARTMENT */}
                <AccordionItem
                  value="academic"
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-5 py-4 font-black uppercase text-xs tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      3. Academic Qualifications & Department
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                    <div className="space-y-4">
                      {/* Degree Finished & Specialization */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Degree / Baccalaureate Finished *
                          </Label>
                          <Controller
                            name="degreeFinished"
                            control={control}
                            render={({ field }) => (
                              <CreatableCombobox
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select or type custom degree..."
                                options={PH_DEGREE_OPTIONS}
                                className="bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.degreeFinished && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.degreeFinished.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-foreground">
                            Major / Specialization *
                          </Label>
                          <Controller
                            name="specialization"
                            control={control}
                            render={({ field }) => (
                              <SearchableSelect
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select official specialization..."
                                options={DEPED_TEACHER_SPECIALIZATION_OPTIONS}
                                className="bg-background text-foreground border-border"
                              />
                            )}
                          />
                          {errors.specialization && (
                            <p className="text-xs font-bold text-destructive">
                              {errors.specialization.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Assigned Department */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase text-foreground">
                          Assigned Department *
                        </Label>
                        <Controller
                          name="department"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="font-bold text-xs h-9 bg-background text-foreground border-border">
                                <SelectValue placeholder="Select assigned department" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover text-popover-foreground border-border">
                                {DEPED_TEACHER_DEPARTMENT_OPTIONS.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="text-xs font-bold uppercase hover:bg-muted"
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.department && (
                          <p className="text-xs font-bold text-destructive">
                            {errors.department.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* Sticky Footer */}
          <div className="p-4 bg-muted/10 border-t border-border flex gap-3 shrink-0 justify-end sm:flex-row">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="font-bold uppercase text-xs border-border px-6 cursor-pointer bg-background text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase text-xs px-6 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Add Teacher
            </Button>
          </div>
        </form>
      </SheetContent>
      <ConfirmationModal
        open={showUnsavedModal}
        onOpenChange={setShowUnsavedModal}
        title="Discard Unsaved Changes?"
        description="You have unsaved changes in this teacher profile. Are you sure you want to discard them? This action cannot be undone."
        confirmText="Discard Changes"
        variant="danger"
        onConfirm={() => {
          setShowUnsavedModal(false);
          reset();
          onOpenChange(false);
        }}
      />
    </Sheet>
  );
}

// Format Date Utility helper function
function format(date: Date, pattern: string): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  if (pattern === "yyyy-MM-dd") {
    return `${yyyy}-${mm}-${dd}`;
  }
  return date.toLocaleDateString();
}
