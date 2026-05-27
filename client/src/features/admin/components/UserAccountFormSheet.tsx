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
  Plus,
  Edit2,
  Mars,
  Venus,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  Briefcase,
  Mail,
  Smartphone,
  Fingerprint,
  RefreshCw,
  Copy,
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
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
  onCancel,
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

  const title = mode === "create" ? "Add Staff Account" : "Edit Account Details";
  const description = mode === "create" 
    ? "Create a new administrative or faculty account for the school system."
    : `Modify identity and access permissions for ${user?.lastName}, ${user?.firstName}.`;

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
            <SheetTitle className="text-2xl text-primary-foreground font-black uppercase flex items-center gap-2">
              {mode === "create" ? <Plus className="h-6 w-6" /> : <Edit2 className="h-6 w-6" />}
              {title}
            </SheetTitle>
            <SheetDescription className="text-primary-foreground font-bold">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            {/* Access & Role Section */}
            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-bold uppercase text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Access & Permissions
                </h3>
                <p className="text-xs text-foreground/70 font-bold">
                  System-level authorization and role assignment.
                </p>
              </header>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  System Access Role *
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(v: User["role"]) => onFieldChange("role", v)}>
                  <SelectTrigger className="h-11 font-bold text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-bold">
                    <SelectItem value="SYSTEM_ADMIN">{mode === "create" ? "School Head" : "Admin"}</SelectItem>
                    <SelectItem value="HEAD_REGISTRAR">Registrar</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="CLASS_ADVISER">Class Adviser</SelectItem>
                    <SelectItem value="MRF">MRF Staff</SelectItem>
                    {mode === "edit" && <SelectItem value="LEARNER">Learner</SelectItem>}
                  </SelectContent>
                </Select>
                {/* When role is MRF, treat designation as tied to role and lock editing */}
              </div>
            </section>

            {/* Personal Details Section */}
            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-bold uppercase text-foreground flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" />
                  Personal Information
                </h3>
                <p className="text-xs text-foreground/70 font-bold">
                  Legal name and basic identity details.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    First Name *
                  </Label>
                  <Input
                    placeholder="REGINA"
                    value={formData.firstName}
                    onChange={(e) => onFieldChange("firstName", e.target.value.toUpperCase())}
                    className="h-10 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Last Name *
                  </Label>
                  <Input
                    placeholder="CRUZ"
                    value={formData.lastName}
                    onChange={(e) => onFieldChange("lastName", e.target.value.toUpperCase())}
                    className="h-10 font-bold"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Middle Name
                  </Label>
                  <Input
                    placeholder="OPTIONAL"
                    value={formData.middleName}
                    onChange={(e) => onFieldChange("middleName", e.target.value.toUpperCase())}
                    className="h-10 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Suffix (e.g., Jr., III)
                  </Label>
                  <Input
                    placeholder="JR., III"
                    value={formData.suffix}
                    onChange={(e) => onFieldChange("suffix", e.target.value.toUpperCase())}
                    className="h-10 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-xs uppercase">
                  Sex at Birth *
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
                        "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-sm font-bold uppercase",
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
            </section>

            {/* Employment Details Section (Conditional) */}
            {showEmploymentDetails && (
              <section className="space-y-4 rounded-md border p-4 sm:p-5">
                <header className="space-y-1">
                  <h3 className="text-sm font-bold uppercase text-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Employment Details
                  </h3>
                  <p className="text-xs text-foreground/70 font-bold">
                    Official DepEd credentials and department assignment.
                  </p>
                </header>

                <div className="grid gap-4 sm:grid-cols-2">
                  {needsEmployeeId && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase flex items-center gap-1">
                        <Fingerprint className="h-3 w-3" />
                        Employee ID *
                      </Label>
                      <Input
                        value={formData.employeeId}
                        onChange={(e) => onFieldChange("employeeId", e.target.value.replace(/\D/g, "").toUpperCase())}
                        maxLength={7}
                        placeholder="7-digit ID"
                        className="h-10 font-bold"
                      />
                    </div>
                  )}

                  {needsDepartment && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">
                        Department
                      </Label>
                      <Select
                        value={formData.department || "__NONE__"}
                        onValueChange={(v) => onFieldChange("department", v === "__NONE__" ? "" : v)}>
                        <SelectTrigger className="h-10 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="font-bold uppercase">
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

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    System Designation
                  </Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => onFieldChange("designation", e.target.value.toUpperCase())}
                    placeholder="e.g. Master Teacher II"
                    className="h-10 font-bold"
                    readOnly={formData.role === "MRF"}
                    aria-readonly={formData.role === "MRF"}
                  />
                  {formData.role === "MRF" && (
                    <p className="text-[10px] text-foreground mt-1.5 leading-snug">
                      <strong className="text-foreground">Note:</strong> Designation is tied to the selected role for MRF accounts and cannot be edited here.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Contact Information Section */}
            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-bold uppercase text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Contact Information
                </h3>
                <p className="text-xs text-foreground/70 font-bold">
                  Communication channels for notifications.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Email Address *
                  </Label>
                  <Input
                    type="email"
                    placeholder="regina.cruz@deped.edu.ph"
                    value={formData.email}
                    onChange={(e) => onFieldChange("email", e.target.value)}
                    className="h-10 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    Mobile Number
                  </Label>
                  <Input
                    value={formData.mobileNumber}
                    onChange={(e) => onFieldChange("mobileNumber", e.target.value.replace(/\D/g, ""))}
                    maxLength={11}
                    placeholder="09XXXXXXXXX"
                    className="h-10 font-bold"
                  />
                </div>
              </div>
            </section>

            {/* Security Section (Create Mode Only) */}
            {mode === "create" && (
              <section className="space-y-4 rounded-md border p-4 sm:p-5">
                <header className="space-y-1">
                  <h3 className="text-sm font-bold uppercase text-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    Security & Onboarding
                  </h3>
                  <p className="text-xs text-foreground/70 font-bold">
                    Initial access credentials.
                  </p>
                </header>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Temporary Password *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.password}
                      readOnly
                      className="h-10 font-bold bg-muted/30"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={handleGenerate}>
                      <RefreshCw
                        className={cn("h-4 w-4", isGenerating && "animate-spin")}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
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
              </section>
            )}
          </div>

          <div className="border-t px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0 bg-muted/5">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto font-bold uppercase">
              Discard
            </Button>
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
