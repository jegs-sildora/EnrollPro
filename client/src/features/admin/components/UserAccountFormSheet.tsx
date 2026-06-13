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
import { Checkbox } from "@/shared/ui/checkbox";

import {
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  getDesignationPool,
} from "@enrollpro/shared";

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
  roles: (
  | "SYSTEM_ADMIN"
  | "HEAD_REGISTRAR"
  | "CLASS_ADVISER"
  | "TEACHER"
  | "LEARNER"
  | "MRF"
  )[];
  isActive: boolean;
  learnerProfile?: {
    lrn?: string | null;
  } | null;
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
  roles: string[];
  department: string;
  password?: string;
  mustChangePassword?: boolean;
  accountName?: string;
  isActive?: boolean;
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
    if (formData.roles.includes("MRF")) {
      onFieldChange("designation", "MRF STAFF");
    } else {
      const allowedDesignations = getDesignationPool(formData.roles);
      if (
        formData.designation &&
        allowedDesignations.length > 0 &&
        !allowedDesignations.includes(formData.designation)
      ) {
        onFieldChange("designation", "");
      }
    }
  }, [formData.roles, formData.designation, onFieldChange]);

  useEffect(() => {
    // When role is MRF, auto-generate accountName if empty.
    if (formData.roles.includes("MRF") && !formData.accountName && formData.firstName && formData.lastName) {
      const generated = `${formData.firstName.toLowerCase().replace(/\s+/g, "")}${formData.lastName.toLowerCase().replace(/\s+/g, "")}`;
      onFieldChange("accountName", generated);
    }
  }, [formData.roles, formData.firstName, formData.lastName, formData.accountName, onFieldChange]);

  const designationPool = useMemo(() => {
    return getDesignationPool(formData.roles);
  }, [formData.roles]);

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
      formData.roles.some((r: string) => ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"].includes(r))
    );
  }, [formData.roles]);

  const needsDepartment = useMemo(() => {
    return formData.roles.some((r: string) => ["TEACHER", "CLASS_ADVISER"].includes(r));
  }, [formData.roles]);

  const showEmploymentDetails = useMemo(() => {
    return formData.roles.some((r: string) => ["TEACHER", "SYSTEM_ADMIN", "HEAD_REGISTRAR"].includes(r));
  }, [formData.roles]);

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
                {user?.roles?.includes("LEARNER") ? (
                  <p className="text-sm font-black text-primary-foreground/80 uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                    <Fingerprint className="size-3" />
                    LRN: {user.learnerProfile?.lrn || "NO LRN"}
                  </p>
                ) : (
                  <p className="text-sm font-black text-primary-foreground/80 uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                    <Fingerprint className="size-3" />
                    Employee ID: {formData.employeeId || "PENDING"}
                  </p>
                )}
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
                  {user.isActive ? "Active" : "Access Blocked"}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">
            <div className="space-y-4">
              {/* 1. Access & Role Section */}
              {!(mode === "edit" && user?.roles.includes("LEARNER")) && (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    1. Access & Permissions
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <p className="text-[11px] text-foreground/70 font-bold mb-4">
                    Select the staff member's system access level.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-black uppercase text-foreground">
                      SYSTEM ROLES & DESIGNATIONS *
                    </Label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {([
                        { value: "SYSTEM_ADMIN", label: mode === "create" ? "School Head" : "SYSTEM ADMIN / ICT" },
                        { value: "HEAD_REGISTRAR", label: "Registrar" },
                        { value: "TEACHER", label: "Teacher" },
                        { value: "CLASS_ADVISER", label: "Class Adviser" },
                        { value: "MRF", label: "MRF Staff" },
                      ] as const).map((roleOption) => (
                        <div key={roleOption.value} className="flex items-center space-x-2 bg-background p-2 rounded border border-border">
                          <Checkbox
                            id={`role-${roleOption.value}`}
                            checked={formData.roles.includes(roleOption.value)}
                            onCheckedChange={(checked) => {
                              const newRoles = checked
                                ? [...formData.roles, roleOption.value]
                                : formData.roles.filter((r) => r !== roleOption.value);
                              onFieldChange("roles", newRoles);
                            }}
                          />
                          <Label htmlFor={`role-${roleOption.value}`} className="text-xs font-bold uppercase cursor-pointer flex-1">
                            {roleOption.label}
                          </Label>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
              )}

              {/* 2. Personal Information Section */}
              {mode === "create" && (
                <>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-primary" />
                    2. Personal Information
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
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
                </div>
              </div>

              {/* 3. Employment Details Section (Conditional) */}
              {showEmploymentDetails && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                  <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      3. PLANTILLA & ACADEMIC ASSIGNMENT
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4">
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
                      {formData.roles.includes("MRF") || designationPool.length === 0 ? (
                        <Input
                          value={formData.designation}
                          onChange={(e) => onFieldChange("designation", e.target.value.toUpperCase())}
                          placeholder="e.g. MASTER TEACHER II"
                          className="font-bold text-sm bg-background text-foreground border-border h-10"
                          readOnly={formData.roles.includes("MRF")}
                          aria-readonly={formData.roles.includes("MRF")}
                        />
                      ) : (
                        <Select
                          value={formData.designation || "__NONE__"}
                          onValueChange={(v) => onFieldChange("designation", v === "__NONE__" ? "" : v)}
                        >
                          <SelectTrigger className="font-bold text-sm bg-background text-foreground border-border h-10">
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover text-popover-foreground border-border font-bold text-sm uppercase max-h-[300px]">
                            <SelectItem value="__NONE__">Not set</SelectItem>
                            {designationPool.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {formData.roles.includes("MRF") && (
                        <p className="text-[10px] text-foreground mt-1.5 leading-snug font-bold">
                          <strong className="text-foreground">Note:</strong> Designation is tied to the selected role for MRF accounts and cannot be edited here.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Contact Information Section */}
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    4. Contact Information
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
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
                </div>
              </div>
                </>
              )}

              {/* Security Management Section (Edit Mode) */}
              {mode === "edit" && user && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                  <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      2. Account Security
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4 space-y-6">
                    {/* Active Status Switch */}
                    <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-sm font-black uppercase">System Login Access</Label>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">
                          {formData.isActive ? "This account is currently active and can access the system." : "This account is blocked. The user cannot log in."}
                        </p>
                      </div>
                      <Select
                        value={formData.isActive ? "active" : "suspended"}
                        onValueChange={(val) => onFieldChange("isActive", val === "active")}
                      >
                        <SelectTrigger className="w-[150px] font-bold uppercase h-9">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active" className="font-bold uppercase text-xs">Active</SelectItem>
                          <SelectItem value="suspended" className="font-bold uppercase text-xs text-destructive">Access Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Manual Password Override */}
                    <div className="space-y-3 p-4 bg-background border rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-sm font-black uppercase">Reset Account Password</Label>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">
                          Force a new temporary password for this user. They will be required to change it upon next login.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="New Password"
                          value={formData.password || ""}
                          onChange={(e) => onFieldChange("password", e.target.value)}
                          className="font-bold text-sm bg-background h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerate}
                          className="w-10 h-10 px-0"
                        >
                          <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Security Section (Create Mode Only) */}
              {mode === "create" && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4">
                  <div className="px-5 py-4 font-black uppercase text-sm tracking-wider text-foreground bg-muted/5 border-b border-border flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      5. Security & Onboarding
                    </span>
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <p className="text-[11px] text-foreground/70 font-bold mb-4">
                      Initial access credentials.
                    </p>

                    {!needsEmployeeId && (
                      <div className="space-y-1.5 mb-4">
                        <Label className="text-sm font-black uppercase text-foreground">
                          System Username *
                        </Label>
                        <Input
                          value={formData.accountName || ""}
                          onChange={(e) => onFieldChange("accountName", e.target.value.replace(/\s+/g, ""))}
                          className="font-bold text-sm bg-background text-foreground border-border h-10"
                        />
                        <p className="text-[10px] text-foreground/70 font-bold leading-snug">
                          Used for local portal authentication in lieu of a DepEd ID.
                        </p>
                      </div>
                    )}

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
                  </div>
                </div>
              )}
            </div>
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
