import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Mars,
  Venus,
  ShieldCheck,
  ShieldAlert,
  Briefcase,
  Mail,
  Smartphone,
  Fingerprint,
  RefreshCw,
  Copy,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
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
} from "@/shared/ui/sheet";
import { Badge } from "@/shared/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/shared/ui/accordion";
import { DEPED_TEACHER_DEPARTMENT_OPTIONS } from "@enrollpro/shared";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  sex: "MALE" | "FEMALE";
  employeeId: string | null;
  designation: string | null;
  mobileNumber: string | null;
  email: string;
  role:
  | "SYSTEM_ADMIN"
  | "HEAD_REGISTRAR"
  | "CLASS_ADVISER"
  | "TEACHER"
  | "LEARNER"
  | "MRF";
  isActive: boolean;
}

interface UserAccountFormState {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  sex: "MALE" | "FEMALE";
  employeeId: string;
  designation: string;
  mobileNumber: string;
  email: string;
  role: User["role"];
  department: string;
  password?: string;
  mustChangePassword?: boolean;
}

interface UserAccountFormSheetProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: UserAccountFormState;
  onFieldChange: (field: keyof UserAccountFormState, value: unknown) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  user: User | null;
  onGeneratePassword?: () => void;
  onCopyPassword?: (password: string) => void;
  passwordCopied?: boolean;
}

export const UserAccountFormSheet = memo(function UserAccountFormSheet({
  mode,
  open,
  onOpenChange,
  formData,
  onFieldChange,
  onSubmit,
  submitting,
  user,
  onGeneratePassword,
  onCopyPassword,
  passwordCopied,
}: UserAccountFormSheetProps) {
  const [panelPercentage, setPanelPercentage] = useState(45);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const isResizing = useRef(false);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(() => {
    if (!onGeneratePassword) return;
    setIsGenerating(true);
    onGeneratePassword();
    setTimeout(() => setIsGenerating(false), 600);
  }, [onGeneratePassword]);

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

  useEffect(() => {
    // When role is MRF, enforce a fixed designation and prevent editing.
    if (formData.role === "MRF") {
      onFieldChange("designation", "MRF Staff");
    }
  }, [formData.role, onFieldChange]);

  const canSubmit = useMemo(() => {
    const basic =
      formData.firstName.trim().length > 0 &&
      formData.lastName.trim().length > 0 &&
      formData.email.trim().length > 0;

    if (mode === "create") {
      return basic && !!formData.password && formData.password.length >= 8;
    }
    return basic;
  }, [formData.firstName, formData.lastName, formData.email, formData.password, mode]);

  const needsEmployeeId = useMemo(() => {
    return (
      formData.role === "SYSTEM_ADMIN" ||
      formData.role === "HEAD_REGISTRAR" ||
      formData.role === "TEACHER" ||
      formData.role === "CLASS_ADVISER" ||
      formData.role === "MRF"
    );
  }, [formData.role]);

  const needsDepartment = useMemo(() => {
    return formData.role === "TEACHER" || formData.role === "CLASS_ADVISER";
  }, [formData.role]);

  const showEmploymentDetails = useMemo(() => {
    return needsEmployeeId || needsDepartment || formData.role === "MRF";
  }, [formData.role, needsDepartment, needsEmployeeId]);

  const displayName = useMemo(() => {
    if (formData.firstName || formData.lastName) {
      return `${formData.lastName.toUpperCase()}, ${formData.firstName.toUpperCase()}`;
    }
    return mode === "create" ? "New Staff Member" : "Staff Member";
  }, [formData.firstName, formData.lastName, mode]);

  const initials = useMemo(() => {
    const f = formData.firstName?.charAt(0) || "N";
    const l = formData.lastName?.charAt(0) || "S";
    return `${f}${l}`.toUpperCase();
  }, [formData.firstName, formData.lastName]);

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
                <p className="text-sm font-black text-primary-foreground/80 uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                  <Fingerprint className="size-3" />
                  Employee ID: {formData.employeeId || "PENDING"}
                </p>
              </div>
            </div>
            {mode === "edit" && user && (
              <div className="flex items-center gap-3 shrink-0 pr-8">
                <Badge
                  className={cn(
                    "text-sm font-bold uppercase transition-all shadow-sm border",
                    user.isActive
                      ? "bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
                      : "bg-destructive/80 text-destructive-foreground border-destructive hover:bg-destructive"
                  )}
                >
                  {user.isActive ? "Active" : "Deactivated"}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">
            <Accordion
              type="multiple"
              defaultValue={["personal", "access", "employment", "contact", "security"]}
              className="space-y-4"
            >
              {/* 1. Access & Role Section */}
              <AccordionItem
                value="access"
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    1. Access & Permissions
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                  <p className="text-[11px] text-foreground/70 font-bold mb-4">
                    Select the staff member's system access level.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-black uppercase text-foreground">
                      System Access Role *
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(v: User["role"]) => onFieldChange("role", v)}>
                      <SelectTrigger className="h-10 font-bold text-sm bg-background text-foreground border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground border-border font-bold text-sm uppercase">
                        <SelectItem value="SYSTEM_ADMIN">{mode === "create" ? "School Head" : "Admin"}</SelectItem>
                        <SelectItem value="HEAD_REGISTRAR">Registrar</SelectItem>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="CLASS_ADVISER">Class Adviser</SelectItem>
                        <SelectItem value="MRF">MRF Staff</SelectItem>
                        {mode === "edit" && <SelectItem value="LEARNER">Learner</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 2. Personal Information Section */}
              <AccordionItem
                value="personal"
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-primary" />
                    2. Personal Information
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                  <p className="text-[11px] text-foreground/70 font-bold mb-4">
                    Legal name and basic identity details.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground">
                        First Name *
                      </Label>
                      <Input
                        placeholder="REGINA"
                        value={formData.firstName}
                        onChange={(e) => onFieldChange("firstName", e.target.value.toUpperCase())}
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground">
                        Last Name *
                      </Label>
                      <Input
                        placeholder="CRUZ"
                        value={formData.lastName}
                        onChange={(e) => onFieldChange("lastName", e.target.value.toUpperCase())}
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground">
                        Middle Name
                      </Label>
                      <Input
                        placeholder="OPTIONAL"
                        value={formData.middleName}
                        onChange={(e) => onFieldChange("middleName", e.target.value.toUpperCase())}
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground">
                        Suffix (e.g., Jr., III)
                      </Label>
                      <Input
                        placeholder="JR., III"
                        value={formData.suffix}
                        onChange={(e) => onFieldChange("suffix", e.target.value.toUpperCase())}
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-black uppercase text-foreground">
                      Sex *
                    </Label>
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
                          onClick={() => onFieldChange("sex", s.val)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-sm font-black uppercase",
                            formData.sex === s.val
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-muted/50 text-foreground",
                          )}>
                          <s.icon
                            className={cn(
                              "w-4 h-4",
                              formData.sex === s.val
                                ? "text-primary"
                                : "text-foreground",
                            )}
                          />
                          {s.val}
                        </button>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 3. Employment Details Section (Conditional) */}
              {showEmploymentDetails && (
                <AccordionItem
                  value="employment"
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      3. Employment Details
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                    <p className="text-[11px] text-foreground/70 font-bold mb-4">
                      Official DepEd credentials and department assignment.
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2 mb-4">
                      {needsEmployeeId && (
                        <div className="space-y-1.5">
                          <Label className="text-sm font-black uppercase text-foreground flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" />
                            Employee ID *
                          </Label>
                          <Input
                            value={formData.employeeId}
                            onChange={(e) => onFieldChange("employeeId", e.target.value.replace(/\D/g, "").toUpperCase())}
                            maxLength={7}
                            placeholder="7-digit ID"
                            className="font-bold text-sm bg-background text-foreground border-border h-10"
                          />
                        </div>
                      )}

                      {needsDepartment && (
                        <div className="space-y-1.5">
                          <Label className="text-sm font-black uppercase text-foreground">
                            Department
                          </Label>
                          <Select
                            value={formData.department || "__NONE__"}
                            onValueChange={(v) => onFieldChange("department", v === "__NONE__" ? "" : v)}>
                            <SelectTrigger className="font-bold text-sm bg-background text-foreground border-border h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground border-border font-bold text-sm uppercase">
                              <SelectItem value="__NONE__">Not set</SelectItem>
                              {DEPED_TEACHER_DEPARTMENT_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground">
                        DepEd Position
                      </Label>
                      <Input
                        value={formData.designation}
                        onChange={(e) => onFieldChange("designation", e.target.value.toUpperCase())}
                        placeholder="e.g. Master Teacher II"
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                        readOnly={formData.role === "MRF"}
                        aria-readonly={formData.role === "MRF"}
                      />
                      {formData.role === "MRF" && (
                        <p className="text-[10px] text-foreground mt-1.5 leading-snug font-bold">
                          <strong className="text-foreground">Note:</strong> Designation is tied to the selected role for MRF accounts and cannot be edited here.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* 4. Contact Information Section */}
              <AccordionItem
                value="contact"
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    4. Contact Information
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                  <p className="text-[11px] text-foreground/70 font-bold mb-4">
                    Communication channels for notifications.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground">
                        Email Address *
                      </Label>
                      <Input
                        type="email"
                        placeholder="regina.cruz@deped.edu.ph"
                        value={formData.email}
                        onChange={(e) => onFieldChange("email", e.target.value)}
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-black uppercase text-foreground flex items-center gap-1">
                        <Smartphone className="h-3 w-3" />
                        Mobile Number
                      </Label>
                      <Input
                        value={formData.mobileNumber}
                        onChange={(e) => onFieldChange("mobileNumber", e.target.value.replace(/\D/g, ""))}
                        maxLength={11}
                        placeholder="09XXXXXXXXX"
                        className="font-bold text-sm bg-background text-foreground border-border h-10"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 5. Security Section (Create Mode Only) */}
              {mode === "create" && (
                <AccordionItem
                  value="security"
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground hover:no-underline hover:bg-muted/10">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      5. Security & Onboarding
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                    <p className="text-[11px] text-foreground/70 font-bold mb-4">
                      Initial access credentials.
                    </p>

                    <div className="space-y-1.5 mb-4">
                      <Label className="text-sm font-black uppercase text-foreground">
                        Temporary Password *
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.password}
                          readOnly
                          className="font-bold text-sm bg-muted/30 text-foreground border-border h-10"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 border-border"
                          onClick={handleGenerate}>
                          <RefreshCw
                            className={cn("h-4 w-4", isGenerating && "animate-spin")}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 border-border"
                          onClick={() => onCopyPassword?.(formData.password || "")}>
                          {passwordCopied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-[10px] font-bold text-orange-800 leading-relaxed uppercase">
                      <div className="flex items-center gap-1.5 mb-1 text-orange-900">
                        <ShieldAlert className="h-3 w-3" />
                        Governance Notice
                      </div>
                      Credential sharing should follow school policy. User must reset this password upon first access.
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>

          <div className="border-t border-border px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0 bg-muted/5">
            <Button
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className="w-full sm:w-auto font-black uppercase px-8 shadow-lg shadow-primary/20">
              {submitting ? (
                <>
                  <Check className="mr-2 h-4 w-4 animate-pulse" />
                  {mode === "create" ? "Creating..." : "Saving..."}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {mode === "create" ? "Create Account" : "Save Changes"}
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});
