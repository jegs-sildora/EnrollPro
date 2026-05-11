import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { useSettingsStore } from "@/store/settings.slice";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import {
  Search,
  Plus,
  Edit2,
  Key,
  UserMinus,
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ShieldAlert,
  Copy,
  Briefcase,
  IdCard,
  UserCog as UserCogIcon,
  Check as CheckIcon,
  MoreVertical,
  History,
  Mail,
  Mars,
  Venus,
  Users as UsersIcon,
  GraduationCap,
  Command,
  Fingerprint,
  Network,
  Lock as LockIcon,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { cn, formatUserRole, getRoleColorClasses } from "@/shared/lib/utils";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { motion, AnimatePresence } from "motion/react";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { PaginationBar } from "@/shared/components/PaginationBar";

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
    | "LEARNER";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
  learnerProfile?: {
    lrn: string | null;
    status: string;
    enrollmentApplications: {
      gradeLevel: { name: string };
      portalPin: string | null;
      isPinPersonalized?: boolean;
      enrollmentRecord: {
        section: { name: string };
      } | null;
    }[];
  } | null;
}

interface FetchUsersParams {
  page: number;
  limit: number;
  role?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  gradeLevelId?: string;
  sectionId?: string;
  learnerStatus?: string;
  tab?: string;
}

interface GradeLevel {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^09\d{9}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function generatePassword() {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let retVal = "";
  retVal += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  retVal += "0123456789"[Math.floor(Math.random() * 10)];
  retVal += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];
  for (let i = 0; i < length - 3; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return retVal
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export default function AdminUsers() {
  const { user: currentUser } = useAuthStore();
  const { activeSchoolYearId } = useSettingsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "learners" ? "learners" : "staff";
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalActiveStaff: 0,
    pendingUnverified: 0,
    lockedDeactivated: 0,
  });

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const showSkeleton = useDelayedLoading(loading);

  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [limit, setLimit] = useState(() => Number(searchParams.get("limit")) || 25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("search") || "");

  const [roleFilter, setRoleFilter] = useState<string>(() => searchParams.get("role") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>(() => searchParams.get("gradeLevelId") || "all");
  const [sectionFilter, setSectionFilter] = useState<string>(() => searchParams.get("sectionId") || "all");
  const [learnerStatusFilter, setLearnerStatusFilter] = useState<string>(() => searchParams.get("learnerStatus") || "all");

  const [sortBy, setSortBy] = useState<string>(() => searchParams.get("sortBy") || "createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => (searchParams.get("sortOrder") as "asc" | "desc") || "desc");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const updateUrlParams = useCallback(
    (newParams: Record<string, string | number | undefined | null>) => {
      const current = Object.fromEntries(searchParams.entries());
      const updated = { ...current, ...newParams };

      // Remove undefined, nulls, empty strings, and defaults
      Object.keys(updated).forEach((key) => {
        if (
          updated[key] === undefined || 
          updated[key] === null || 
          updated[key] === "" || 
          updated[key] === "all"
        ) {
          delete updated[key];
        }
      });

      setSearchParams(updated as Record<string, string>, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrlParams({ page: newPage });
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    updateUrlParams({ limit: newLimit, page: 1 });
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    setPage(1);
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setGradeLevelFilter("all");
    setSectionFilter("all");
    setLearnerStatusFilter("all");
    setRowSelection({});
  };

  useEffect(() => {
    setPage(1);
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setGradeLevelFilter("all");
    setSectionFilter("all");
    setLearnerStatusFilter("all");
    setRowSelection({});
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (activeTab === "learners") {
      const fetchLearnerMeta = async () => {
        try {
          const res = await api.get("/curriculum/grade-levels");
          setGradeLevels(res.data.gradeLevels || []);
        } catch (err) {
          console.error("Failed to fetch grade levels", err);
        }
      };
      fetchLearnerMeta();
    }
  }, [activeTab]);

  useEffect(() => {
    if (
      activeTab === "learners" &&
      gradeLevelFilter !== "all" &&
      activeSchoolYearId
    ) {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/sections/${activeSchoolYearId}`);
          const gl = res.data.gradeLevels.find(
            (g: { gradeLevelId: number }) => g.gradeLevelId === parseInt(gradeLevelFilter),
          );
          setSections(gl?.sections || []);
        } catch (err) {
          console.error("Failed to fetch sections", err);
        }
      };
      fetchSections();
    } else {
      setSections([]);
      setSectionFilter("all");
    }
  }, [activeTab, gradeLevelFilter, activeSchoolYearId]);

  // Dialogs & Sheets
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);

  // Create Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    sex: "FEMALE" as "MALE" | "FEMALE",
    employeeId: "",
    designation: "",
    mobileNumber: "",
    email: "",
    role: "TEACHER" as User["role"],
    password: "",
    mustChangePassword: true,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [profileFormData, setProfileFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    sex: "FEMALE" as "MALE" | "FEMALE",
    employeeId: "",
    designation: "",
    mobileNumber: "",
    email: "",
    role: "TEACHER" as User["role"],
  });

  const validateCreateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.firstName.trim())
      nextErrors.firstName = "First name is required.";
    if (!formData.lastName.trim())
      nextErrors.lastName = "Last name is required.";
    if (!formData.email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!EMAIL_PATTERN.test(formData.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (
      (formData.role === "SYSTEM_ADMIN" ||
        formData.role === "HEAD_REGISTRAR") &&
      !formData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }
    if (!formData.mobileNumber.trim()) {
      nextErrors.mobileNumber = "Contact Number is required.";
    } else if (!MOBILE_PATTERN.test(formData.mobileNumber.trim())) {
      nextErrors.mobileNumber = "Use 11-digit mobile format: 09XXXXXXXXX.";
    }
    if (!formData.password.trim()) {
      nextErrors.password = "Temporary password is required.";
    } else if (!PASSWORD_PATTERN.test(formData.password)) {
      nextErrors.password =
        "Password needs 8+ chars, 1 uppercase, 1 number, and 1 symbol.";
    }
    return nextErrors;
  };

  const validateProfileForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!profileFormData.firstName.trim())
      nextErrors.firstName = "First name is required.";
    if (!profileFormData.lastName.trim())
      nextErrors.lastName = "Last name is required.";
    if (!profileFormData.email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!EMAIL_PATTERN.test(profileFormData.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (
      (profileFormData.role === "SYSTEM_ADMIN" ||
        profileFormData.role === "HEAD_REGISTRAR") &&
      !profileFormData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }
    if (
      profileFormData.mobileNumber.trim() &&
      !MOBILE_PATTERN.test(profileFormData.mobileNumber.trim())
    ) {
      nextErrors.mobileNumber = "Use 11-digit mobile format: 09XXXXXXXXX.";
    }
    return nextErrors;
  };

  const getDuplicateEmailMessage = (err: unknown): string | null => {
    const response = (err as { response?: { status?: number; data?: { field?: string; code?: string; message?: string } } }).response;
    if (response?.status !== 409) return null;
    const field = response.data?.field;
    const code = response.data?.code;
    if (field === "email" || code === "DUPLICATE_EMAIL") {
      return response.data?.message || "Email address is already in use.";
    }
    return null;
  };

  useEffect(() => {
    setDebouncedSearch(search.trim());
    setPage(1);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: FetchUsersParams = {
        page,
        limit,
        sortBy,
        sortOrder,
        tab: activeTab,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (activeTab === "learners") {
        params.role = "LEARNER";
        if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
        if (sectionFilter !== "all") params.sectionId = sectionFilter;
        if (learnerStatusFilter !== "all")
          params.learnerStatus = learnerStatusFilter;
      } else {
        if (roleFilter !== "all") params.role = roleFilter;
        if (statusFilter !== "all") params.isActive = statusFilter === "active";
      }
      const res = await api.get("/admin/users", { params });
      let filteredUsers = res.data.users || [];
      if (activeTab === "staff" && roleFilter === "all") {
        filteredUsers = filteredUsers.filter((u: User) => u.role !== "LEARNER");
      }
      setUsers(filteredUsers);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      toastApiError(err as never);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    roleFilter,
    statusFilter,
    gradeLevelFilter,
    sectionFilter,
    learnerStatusFilter,
    debouncedSearch,
    sortBy,
    sortOrder,
    activeTab,
  ]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get("/admin/users/metrics");
      setMetrics(res.data);
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchMetrics();
  }, [fetchUsers, fetchMetrics]);

  const computeEmail = (first: string, last: string) => {
    const f = first.trim().toLowerCase().replace(/\s+/g, "");
    const l = last.trim().toLowerCase().replace(/\s+/g, "");
    if (!f || !l) return "";
    return `${f}.${l}@deped.edu.ph`;
  };

  const handleCreate = async () => {
    const nextErrors = validateCreateForm();
    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await api.post("/admin/users", formData);
      sileo.success({
        title: "Account Created",
        description: `${formData.lastName}, ${formData.firstName} added successfully.`,
      });
      setCreateOpen(false);
      fetchUsers();
    } catch (err) {
      const duplicateEmailMessage = getDuplicateEmailMessage(err);
      if (duplicateEmailMessage) {
        setCreateErrors((prev) => ({ ...prev, email: duplicateEmailMessage }));
        return;
      }
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const openProfileEditor = useCallback((user: User) => {
    setProfileUser(user);
    setProfileFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName || "",
      suffix: user.suffix || "",
      sex: user.sex,
      employeeId: user.employeeId || "",
      designation: user.designation || "",
      mobileNumber: user.mobileNumber || "",
      email: user.email,
      role: user.role,
    });
    setProfileOpen(true);
  }, []);

  const handleProfileSave = async () => {
    if (!profileUser) return;
    const nextErrors = validateProfileForm();
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${profileUser.id}`, profileFormData);
      sileo.success({
        title: "Profile Updated",
        description: "Account updated successfully.",
      });
      setProfileOpen(false);
      fetchUsers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const isLearner = selectedUser.role === "LEARNER";
      await api.patch(`/admin/users/${selectedUser.id}/reset-password`, {
        newPassword: isLearner ? "DepEd2026!" : formData.password,
        mustChangePassword: true,
      });
      sileo.success({
        title: isLearner ? "Password Reset" : "Password Generated",
        description: isLearner
          ? "Account reset to system default."
          : "Temporary password generated.",
      });
      setResetOpen(false);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(true);
      setTimeout(() => setSubmitting(false), 500);
    }
  };

  const handleToggleStatus = async (
    id: number,
    action: "deactivate" | "reactivate",
  ) => {
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${id}/${action}`);
      sileo.success({
        title: "Status Updated",
        description: "Account status updated.",
      });
      setDeactivateId(null);
      setReactivateId(null);
      fetchUsers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSort = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSortOrder("asc");
      }
      return field;
    });
    setPage(1);
  }, []);

  const getSortIcon = useCallback(
    (field: string) => {
      if (sortBy !== field)
        return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
      return sortOrder === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 ml-1" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 ml-1" />
      );
    },
    [sortBy, sortOrder],
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex h-11 items-center justify-center px-3 bg-maroon-50/50 rounded-tl-lg">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
              className="border-maroon-300 data-[state=checked]:bg-maroon-600 data-[state=checked]:border-maroon-600"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center px-3">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="border-maroon-200 data-[state=checked]:bg-maroon-600 data-[state=checked]:border-maroon-600"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        id: "identity",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex h-11 w-full items-center justify-start gap-1 px-4 text-xs font-extrabold uppercase  text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors">
            {activeTab === "staff" ? "Personnel Identity" : "Learner Identity"}
            {getSortIcon("lastName")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          const initials =
            `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
          return (
            <div className="flex items-center gap-3 text-left min-w-[240px] pl-2 py-1">
              <Avatar className="h-9 w-9 border-2 border-primary/10 shadow-sm">
                <AvatarFallback className="text-xs font-bold bg-primary/5 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm uppercase leading-tight text-foreground truncate">
                  {user.lastName}, {user.firstName}
                </span>
                <span className="text-[11px] font-bold text-foreground truncate">
                  {user.email}
                </span>
                {activeTab === "staff" && user.employeeId && (
                  <span className="text-xs font-black text-primary uppercase mt-0.5 flex items-center gap-1">
                    <IdCard className="h-2.5 w-2.5" /> ID: {user.employeeId}
                  </span>
                )}
                {activeTab === "learners" && (
                  <span className="text-xs font-extrabold text-foreground flex items-center gap-1 mt-0.5 shrink-0">
                    <Fingerprint className="h-2.5 w-2.5" />
                    {user.learnerProfile?.lrn || "NO LRN"}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "context",
        header: () => (
          <div className="flex h-11 w-full items-center justify-center text-xs font-extrabold uppercase  text-maroon-900 bg-maroon-50/50">
            {activeTab === "staff" ? "Designation / Role" : "Class Context"}
          </div>
        ),
        cell: ({ row }) => {
          const user = row.original;
          if (activeTab === "learners") {
            const currentApp = user.learnerProfile?.enrollmentApplications?.[0];
            return (
              <div className="space-y-1.5 text-center min-w-[160px] py-1">
                <div className="flex flex-col items-center">
                  <div className="text-[11px] font-black text-primary uppercase leading-none">
                    {currentApp?.gradeLevel?.name || "—"}
                  </div>
                  <div className="text-xs font-bold text-foreground uppercase">
                    {currentApp?.enrollmentRecord?.section?.name ||
                      "UNSECTIONED"}
                  </div>
                </div>

                <div className="flex justify-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-black uppercase px-1.5 h-4",
                      user.learnerProfile?.status === "DROPPED"
                        ? "bg-rose-50 text-rose-700 border-rose-100"
                        : user.learnerProfile?.status === "TRANSFERRED_OUT"
                          ? "bg-amber-50 text-amber-700 border-amber-100"
                          : "bg-blue-50 text-blue-700 border-blue-100",
                    )}>
                    {user.learnerProfile?.status?.replace("_", " ") || "ACTIVE"}
                  </Badge>
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-1 text-center min-w-[140px] py-1">
              <div className="text-[11px] font-black text-primary uppercase  leading-none">
                {user.designation || "NO DESIGNATION"}
              </div>
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] font-black uppercase px-1.5 h-4 border-none",
                    getRoleColorClasses(user.role),
                  )}>
                  {formatUserRole(user.role)}
                </Badge>
              </div>
            </div>
          );
        },
      },
      {
        id: "status",
        header: () => (
          <button
            onClick={() => handleSort("isActive")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-extrabold uppercase  text-maroon-900 bg-maroon-50/50">
            Account Status{getSortIcon("isActive")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;

          if (activeTab === "learners") {
            const isDropped = user.learnerProfile?.status === "DROPPED";
            const app = user.learnerProfile?.enrollmentApplications?.[0];
            const isActivated = app?.isPinPersonalized;

            return (
              <div className="flex flex-col items-center justify-center gap-1 min-w-[110px]">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full ring-2 ring-offset-1",
                      isDropped || !user.isActive
                        ? "bg-slate-400 ring-slate-100"
                        : !isActivated
                          ? "bg-orange-500 ring-orange-100"
                          : "bg-green-500 ring-green-100",
                    )}
                  />
                  <span className="text-xs font-extrabold uppercase ">
                    {isDropped || !user.isActive
                      ? "LOCKED"
                      : !isActivated
                        ? "PENDING ACTIVATION"
                        : "ACTIVATED"}
                  </span>
                </div>
              </div>
            );
          }

          const isPending = !user.lastLoginAt && user.isActive;
          return (
            <div className="flex flex-col items-center justify-center gap-1 min-w-[100px]">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full ring-2 ring-offset-1",
                    !user.isActive
                      ? "bg-slate-400 ring-slate-100"
                      : isPending
                        ? "bg-orange-500 ring-orange-100"
                        : "bg-green-500 ring-green-100",
                  )}
                />
                <span className="text-xs font-extrabold uppercase ">
                  {!user.isActive
                    ? "LOCKED"
                    : isPending
                      ? "PENDING FTL"
                      : "ACTIVE"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="flex h-11 w-full items-center justify-center px-3 text-xs font-extrabold uppercase  text-maroon-900 bg-maroon-50/50 rounded-tr-lg">
            Actions
          </div>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center justify-center gap-1.5 min-w-[140px]">
              {user.role === "LEARNER" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 font-black text-xs uppercase  gap-1.5 border-orange-100 hover:bg-orange-50 hover:text-orange-600 transition-all"
                  title="Reset to Default Password"
                  onClick={() => {
                    setSelectedUser(user);
                    setFormData((p) => ({ ...p, password: "DepEd2026!" }));
                    setResetOpen(true);
                  }}>
                  <RefreshCw className="h-3 w-3" /> Reset to Default
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-orange-50 hover:text-orange-600 transition-colors border-orange-100"
                    title="Reset Password"
                    onClick={() => {
                      setSelectedUser(user);
                      setFormData((p) => ({
                        ...p,
                        password: generatePassword(),
                      }));
                      setResetOpen(true);
                    }}>
                    <Key className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 font-bold text-xs gap-1 hover:bg-primary hover:text-white transition-colors"
                    onClick={() => openProfileEditor(user)}>
                    <Edit2 className="h-3 w-3" /> Edit
                  </Button>
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48">
                  <DropdownMenuLabel className="text-xs font-extrabold uppercase  opacity-50">
                    Account Control
                  </DropdownMenuLabel>
                  {user.role === "LEARNER" && (
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedUser(user);
                        setFormData((p) => ({ ...p, password: "DepEd2026!" }));
                        setResetOpen(true);
                      }}
                      className="gap-2 font-bold text-xs">
                      <RefreshCw className="h-3.5 w-3.5 text-orange-600" />{" "}
                      Reset to Default
                    </DropdownMenuItem>
                  )}
                  {user.role !== "LEARNER" && (
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedUser(user);
                        setFormData((p) => ({
                          ...p,
                          password: generatePassword(),
                        }));
                        setResetOpen(true);
                      }}
                      className="gap-2 font-bold text-xs">
                      <Key className="h-3.5 w-3.5 text-orange-600" /> Reset
                      Password
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem
                      disabled={currentUser?.id === user.id}
                      onClick={() => setDeactivateId(user.id)}
                      className="gap-2 font-bold text-xs text-destructive focus:text-destructive">
                      <UserMinus className="h-3.5 w-3.5" /> Deactivate User
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setReactivateId(user.id)}
                      className="gap-2 font-bold text-xs text-emerald-600 focus:text-emerald-600">
                      <UserCheck className="h-3.5 w-3.5" /> Reactivate User
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="gap-2 font-bold text-xs opacity-50 cursor-not-allowed">
                    <History className="h-3.5 w-3.5" /> Audit Trail
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [currentUser, activeTab, handleSort, getSortIcon, openProfileEditor],
  );

  const metricsElement = useMemo(
    () => (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {[
          {
            label: "Total Active Personnel",
            val: metrics.totalActiveStaff,
            color: "text-emerald-600",
          },
          {
            label: "Pending Invites / Unverified",
            val: metrics.pendingUnverified,
            color: "text-orange-600",
          },
          {
            label: "Locked / Deactivated",
            val: metrics.lockedDeactivated,
            color: "text-destructive",
          },
        ].map((m, i) => (
          <Card
            key={i}
            className="border-none shadow-sm bg-[hsl(var(--card))]">
            <CardHeader className="pb-2">
              <p className="text-xs uppercase  font-bold text-foreground">
                {m.label}
              </p>
              <CardTitle className={cn("text-2xl font-extrabold", m.color)}>
                {m.val}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    ),
    [metrics],
  );

  const filterElement = useMemo(
    () => (
      <Card className="w-full min-w-0 overflow-hidden border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs sm:text-sm uppercase  font-bold flex items-center justify-between">
                <span>
                  {activeTab === "staff"
                    ? "Personnel Filter"
                    : "Learner Filter"}
                </span>
                <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded border text-xs text-foreground font-extrabold">
                  <Command className="h-2.5 w-2.5" /> F or /
                </div>
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder={
                    activeTab === "staff"
                      ? "Search by Employee ID, Email, or Name..."
                      : "Search by LRN, Last Name, or First Name..."
                  }
                  className="pl-9 h-10 text-sm font-bold shadow-inner focus:ring-primary/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:flex gap-3 md:gap-4 w-full md:w-auto">
              {activeTab === "staff" ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm uppercase  font-bold">
                      Role
                    </Label>
                    <Select
                      value={roleFilter}
                      onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-10 w-full md:w-36 text-sm font-bold">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="SYSTEM_ADMIN">Admin</SelectItem>
                        <SelectItem value="HEAD_REGISTRAR">
                          Registrar
                        </SelectItem>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm uppercase  font-bold">
                      Status
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-10 w-full md:w-32 text-sm font-bold">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Locked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm uppercase  font-bold">
                      Grade
                    </Label>
                    <Select
                      value={gradeLevelFilter}
                      onValueChange={setGradeLevelFilter}>
                      <SelectTrigger className="h-10 w-full md:w-32 text-sm font-bold">
                        <SelectValue placeholder="All Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Grade</SelectItem>
                        {gradeLevels.map((gl) => (
                          <SelectItem
                            key={gl.id}
                            value={gl.id.toString()}>
                            {gl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm uppercase  font-bold">
                      Section
                    </Label>
                    <Select
                      value={sectionFilter}
                      onValueChange={setSectionFilter}
                      disabled={gradeLevelFilter === "all"}>
                      <SelectTrigger className="h-10 w-full md:w-36 text-sm font-bold">
                        <SelectValue placeholder="All Section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Section</SelectItem>
                        {sections.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id.toString()}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={fetchUsers}>
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setGradeLevelFilter("all");
                  setSectionFilter("all");
                  setLearnerStatusFilter("all");
                  setPage(1);
                }}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    ),
    [
      search,
      roleFilter,
      statusFilter,
      gradeLevelFilter,
      sectionFilter,
      loading,
      fetchUsers,
      activeTab,
      gradeLevels,
      sections,
    ],
  );

  const tableElement = useMemo(
    () => (
      <Card className="w-full min-w-0 overflow-hidden border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-extrabold">
            {activeTab === "staff" ? "Personnel Accounts" : "Learner Accounts"}
          </CardTitle>
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            Showing {users.length} of {total} records
          </p>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4 min-w-0">
          <div className="md:hidden space-y-3">
            {showSkeleton ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border p-3 space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-9 bg-muted rounded w-full" />
                </div>
              ))
            ) : users.length === 0 ? (
              <div className="rounded-xl border p-6 text-center text-sm font-bold">
                No users found matching the selected criteria.
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "rounded-xl border bg-[hsl(var(--card))] p-3",
                    !user.isActive && "opacity-70 bg-muted/20",
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8 border shrink-0">
                        <AvatarFallback className="text-xs font-bold">
                          {user.firstName.charAt(0)}
                          {user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-sm uppercase leading-tight break-words">
                          {user.lastName}, {user.firstName}
                        </p>
                        <p className="text-xs font-bold text-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-bold uppercase shrink-0 border-none",
                        getRoleColorClasses(user.role),
                      )}>
                      {activeTab === "learners"
                        ? user.learnerProfile?.enrollmentApplications?.[0]
                            ?.gradeLevel?.name || "LEARNER"
                        : formatUserRole(user.role)}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-y-1.5 gap-x-4 text-xs font-bold">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Briefcase className="h-3 w-3" />
                      {user.designation || "—"}
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <IdCard className="h-3 w-3" />
                      {activeTab === "learners"
                        ? user.learnerProfile?.lrn || "—"
                        : user.employeeId || "—"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block w-full max-w-full overflow-x-hidden relative">
            <AnimatePresence>
              {Object.keys(rowSelection).length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-6 py-3 bg-maroon-900 text-white rounded-full shadow-2xl border border-maroon-700/50 backdrop-blur-md">
                  <span className="text-xs font-black uppercase  border-r border-white/20 pr-3">
                    {Object.keys(rowSelection).length} Selected
                  </span>
                  <div className="flex items-center gap-2">
                    {activeTab === "staff" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-bold uppercase  hover:bg-white/10 text-white"
                          onClick={() =>
                            sileo.info({
                              title: "Bulk Action",
                              description:
                                "Batch Email Activation is coming soon.",
                            })
                          }>
                          <Mail className="h-3.5 w-3.5 mr-1.5" /> Resend Invites
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-bold uppercase  hover:bg-white/10 text-white"
                          onClick={() =>
                            sileo.info({
                              title: "Bulk Action",
                              description:
                                "Batch Password Reset is coming soon.",
                            })
                          }>
                          <Key className="h-3.5 w-3.5 mr-1.5" /> Reset Passwords
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-black uppercase  hover:bg-white/10 text-white"
                          onClick={() =>
                            sileo.info({
                              title: "Bulk Action",
                              description:
                                "Batch Reset to Default is coming soon.",
                            })
                          }>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Batch
                          Reset to Default
                        </Button>
                      </>
                    )}
                    <div className="w-px h-4 bg-white/20 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs font-bold uppercase  hover:bg-red-500/20 text-red-200 hover:text-red-100"
                      onClick={() =>
                        sileo.info({
                          title: "Bulk Action",
                          description: "Batch Account Locking is coming soon.",
                        })
                      }>
                      <LockIcon className="h-3.5 w-3.5 mr-1.5" />{" "}
                      {activeTab === "learners"
                        ? "Batch Lock Accounts"
                        : "Deactivate"}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2 hover:bg-white/10 text-white/60 hover:text-white"
                    onClick={() => setRowSelection({})}>
                    <Plus className="h-4 w-4 rotate-45" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <DataTable
              columns={columns}
              data={users}
              loading={loading}
              virtualize={false}
              tableClassName="table-fixed w-full"
              noResultsMessage="No records found matching the selected criteria."
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </div>

          <PaginationBar
            page={page}
            total={total}
            limit={limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            itemName={activeTab === "staff" ? "Personnel" : "Learners"}
            className="mt-4 border shadow-none rounded-lg"
          />
        </CardContent>
      </Card>
    ),
    [
      users,
      columns,
      loading,
      total,
      page,
      limit,
      showSkeleton,
      activeTab,
      rowSelection,
    ],
  );

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-maroon-900">
            <UserCogIcon className="h-7 w-7 text-primary" />
            User Management
          </h1>
          <p className="text-sm font-bold text-foreground">
            Manage authenticated user accounts for personnel and learners.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {activeTab === "staff" && (
            <Button
              onClick={() => {
                setCreateOpen(true);
                setFormData((p) => ({ ...p, password: generatePassword() }));
              }}
              className="h-10 font-bold">
              <Plus className="h-4 w-4 mr-2" />
              Add Staff Account
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative">
          <TabsTrigger
            value="staff"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "staff" && (
              <motion.div
                layoutId="pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <div className="relative z-20 flex items-center justify-center gap-2">
              <UsersIcon
                className={cn(
                  "h-4 w-4",
                  activeTab === "staff" ? "text-white" : "text-primary",
                )}
              />
              <span className={cn(activeTab === "staff" && "text-white")}>
                Staff & Faculty
              </span>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="learners"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "learners" && (
              <motion.div
                layoutId="pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <div className="relative z-20 flex items-center justify-center gap-2">
              <GraduationCap
                className={cn(
                  "h-4 w-4",
                  activeTab === "learners" ? "text-white" : "text-primary",
                )}
              />
              <span className={cn(activeTab === "learners" && "text-white")}>
                Learner Accounts
              </span>
            </div>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full space-y-6">
            <TabsContent
              value={activeTab}
              forceMount
              className="mt-0 focus-visible:outline-none ring-0 space-y-6">
              {activeTab === "staff" && metricsElement}

              {filterElement}
              {tableElement}
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Add User Account Drawer */}
      <Sheet
        open={createOpen}
        onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-maroon-900">
              Add Staff Account
            </SheetTitle>
            <SheetDescription className="font-bold text-foreground">
              Create a new administrative or faculty account for the school
              system.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-4">
              <Label className="text-xs font-black uppercase  text-foreground">
                Staff Identity
              </Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    First Name *
                  </Label>
                  <Input
                    placeholder="REGINA"
                    value={formData.firstName}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setCreateErrors((p) => ({ ...p, firstName: "" }));
                      setFormData({
                        ...formData,
                        firstName: v,
                        email: computeEmail(v, formData.lastName),
                      });
                    }}
                    className={cn(
                      "h-10 font-bold",
                      createErrors.firstName && "border-destructive",
                    )}
                  />
                  {createErrors.firstName && (
                    <p className="text-xs font-bold text-destructive uppercase">
                      {createErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Last Name *
                  </Label>
                  <Input
                    placeholder="CRUZ"
                    value={formData.lastName}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setCreateErrors((p) => ({ ...p, lastName: "" }));
                      setFormData({
                        ...formData,
                        lastName: v,
                        email: computeEmail(formData.firstName, v),
                      });
                    }}
                    className={cn(
                      "h-10 font-bold",
                      createErrors.lastName && "border-destructive",
                    )}
                  />
                  {createErrors.lastName && (
                    <p className="text-xs font-bold text-destructive uppercase">
                      {createErrors.lastName}
                    </p>
                  )}
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
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        middleName: e.target.value.toUpperCase(),
                      })
                    }
                    className="h-10 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Suffix</Label>
                  <Input
                    placeholder="JR., III"
                    value={formData.suffix}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        suffix: e.target.value.toUpperCase(),
                      })
                    }
                    className="h-10 font-bold"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase">
                  Sex at Birth *
                </Label>
                <div className="flex gap-4 pt-1">
                  {(
                    [
                      { val: "MALE", icon: Mars },
                      { val: "FEMALE", icon: Venus },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setFormData({ ...formData, sex: s.val })}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-sm font-bold uppercase",
                        formData.sex === s.val
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
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

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase  text-foreground">
                <Network className="h-3.5 w-3.5" />
                Ecosystem RBAC Matrix
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl border border-dashed">
                {[
                  {
                    id: "enrollpro",
                    label: "EnrollPro (Core)",
                    desc: "Admission & Enrollment",
                  },
                  { id: "atlas", label: "ATLAS", desc: "Grade Encoding & SFs" },
                  {
                    id: "smart",
                    label: "S.M.A.R.T.",
                    desc: "Clinic & Health Records",
                  },
                  { id: "aims", label: "AIMS", desc: "Inventory & Assets" },
                ].map((sys) => (
                  <div
                    key={sys.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-background border shadow-sm">
                    <Checkbox
                      id={`sys-${sys.id}`}
                      className="mt-1"
                      defaultChecked={sys.id === "enrollpro"}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label
                        htmlFor={`sys-${sys.id}`}
                        className="text-[11px] font-black uppercase leading-none cursor-pointer">
                        {sys.label}
                      </label>
                      <p className="text-[9px] font-bold text-foreground uppercase">
                        {sys.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-foreground italic px-1">
                Permissions are instantly broadcasted to sibling subsystems via
                SSO.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase  text-foreground">
                <Briefcase className="h-3.5 w-3.5" />
                Employment & Role
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Assign Access Role *
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(v: User["role"]) =>
                    setFormData({ ...formData, role: v })
                  }>
                  <SelectTrigger className="h-11 font-bold text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_ADMIN">School Head</SelectItem>
                    <SelectItem value="HEAD_REGISTRAR">
                      Head Registrar
                    </SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Employee ID
                  </Label>
                  <Input
                    placeholder="1234567"
                    value={formData.employeeId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employeeId: e.target.value.toUpperCase(),
                      })
                    }
                    className={cn(
                      "h-10 font-bold",
                      createErrors.employeeId && "border-destructive",
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Plantilla Position
                  </Label>
                  <Input
                    placeholder="TEACHER I"
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        designation: e.target.value.toUpperCase(),
                      })
                    }
                    className="h-10 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase  text-foreground">
                <Mail className="h-3.5 w-3.5" />
                Contact Information
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Email Address *
                </Label>
                <Input
                  type="email"
                  placeholder="regina.cruz@deped.edu.ph"
                  value={formData.email}
                  onChange={(e) => {
                    setCreateErrors((p) => ({ ...p, email: "" }));
                    setFormData({ ...formData, email: e.target.value });
                  }}
                  className={cn(
                    "h-10 font-bold",
                    createErrors.email && "border-destructive",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Contact Number *
                </Label>
                <Input
                  placeholder="09123456789"
                  maxLength={11}
                  value={formData.mobileNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mobileNumber: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className={cn(
                    "h-10 font-bold",
                    createErrors.mobileNumber && "border-destructive",
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase  text-foreground">
                <ShieldAlert className="h-3.5 w-3.5" />
                Security & Onboarding
              </div>
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
                    onClick={() => {
                      setIsGenerating(true);
                      setFormData({
                        ...formData,
                        password: generatePassword(),
                      });
                      setTimeout(() => setIsGenerating(false), 600);
                    }}>
                    <RefreshCw
                      className={cn("h-4 w-4", isGenerating && "animate-spin")}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => copyToClipboard(formData.password)}>
                    {copied ? (
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-[11px] font-bold text-orange-800 leading-relaxed uppercase ">
                <div className="flex items-center gap-1.5 mb-1 text-orange-900">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Governance Notice
                </div>
                Credential sharing should follow school policy. User must reset
                this password upon first access.
              </div>
            </div>
          </div>
          <SheetFooter className="sticky bottom-0 bg-background pt-6 pb-6 border-t mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className="flex-1 font-bold uppercase  text-xs">
              Discard
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="flex-[2] font-bold uppercase  text-xs shadow-lg shadow-primary/20">
              {submitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Account
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit User Profile Drawer */}
      <Sheet
        open={profileOpen}
        onOpenChange={setProfileOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl font-bold text-maroon-900">
              <Edit2 className="h-6 w-6 text-primary" />
              Edit Account Details
            </SheetTitle>
            <SheetDescription>
              Modify identity and access permissions.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">
                Update Access Role *
              </Label>
              <Select
                value={profileFormData.role}
                onValueChange={(v: User["role"]) =>
                  setProfileFormData({ ...profileFormData, role: v })
                }>
                <SelectTrigger className="h-11 font-bold text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYSTEM_ADMIN">Admin</SelectItem>
                  <SelectItem value="HEAD_REGISTRAR">Registrar</SelectItem>
                  <SelectItem value="TEACHER">Teacher</SelectItem>
                  <SelectItem value="LEARNER">Learner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  First Name *
                </Label>
                <Input
                  value={profileFormData.firstName}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      firstName: e.target.value,
                    })
                  }
                  className="h-10 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Last Name *
                </Label>
                <Input
                  value={profileFormData.lastName}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      lastName: e.target.value,
                    })
                  }
                  className="h-10 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Email *</Label>
              <Input
                value={profileFormData.email}
                onChange={(e) =>
                  setProfileFormData({
                    ...profileFormData,
                    email: e.target.value,
                  })
                }
                className="h-10 font-bold"
              />
            </div>
          </div>
          <SheetFooter className="border-t pt-6 pb-2 mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setProfileOpen(false)}
              className="flex-1 font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleProfileSave}
              disabled={submitting}
              className="flex-[2] font-bold shadow-lg shadow-primary/20">
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert
                className={cn(
                  "h-5 w-5",
                  selectedUser?.role === "LEARNER"
                    ? "text-primary"
                    : "text-orange-600",
                )}
              />
              {selectedUser?.role === "LEARNER"
                ? "Reset to Default Credential"
                : "Reset Personnel Password"}
            </DialogTitle>
            <DialogDescription className="font-bold text-xs">
              {selectedUser?.role === "LEARNER"
                ? `Confirming reset for ${selectedUser.lastName}, ${selectedUser.firstName}.`
                : "Generate a new temporary password for this staff member."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              className={cn(
                "p-3 rounded-lg border text-[11px] font-bold uppercase leading-relaxed",
                selectedUser?.role === "LEARNER"
                  ? "bg-primary/5 border-primary/10 text-primary"
                  : "bg-orange-50 border-orange-100 text-orange-800",
              )}>
              {selectedUser?.role === "LEARNER"
                ? "This will reset the student's portal access to the universal default: DepEd2026!"
                : "Existing sessions will be invalidated. User must reset this on first login."}
            </div>

            {selectedUser?.role !== "LEARNER" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  New Temporary Password *
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="font-bold h-10"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => {
                      setIsGenerating(true);
                      setFormData({
                        ...formData,
                        password: generatePassword(),
                      });
                      setTimeout(() => setIsGenerating(false), 600);
                    }}>
                    <RefreshCw
                      className={cn("h-4 w-4", isGenerating && "animate-spin")}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => copyToClipboard(formData.password)}>
                    {copied ? (
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              className="flex-1 font-bold uppercase  text-xs h-10">
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={submitting}
              className="flex-[2] font-black uppercase  text-xs h-10">
              {submitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {selectedUser?.role === "LEARNER"
                ? "Confirm Default Reset"
                : "Apply New Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={deactivateId !== null}
        onOpenChange={() => setDeactivateId(null)}
        title="Deactivate Account"
        description="Access will be revoked immediately."
        confirmText="Yes, Deactivate"
        onConfirm={() =>
          deactivateId && handleToggleStatus(deactivateId, "deactivate")
        }
        variant="danger"
        loading={submitting}
      />
      <ConfirmationModal
        open={reactivateId !== null}
        onOpenChange={() => setReactivateId(null)}
        title="Reactivate Account"
        description="Restoring system access."
        confirmText="Yes, Reactivate"
        onConfirm={() =>
          reactivateId && handleToggleStatus(reactivateId, "reactivate")
        }
        variant="primary"
        loading={submitting}
      />
    </div>
  );
}
