import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
} from "react";
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
  Phone,
  UserCog as UserCogIcon,
  Check as CheckIcon,
  MoreVertical,
  History,
  Mail,
  AlertCircle,
  Mars,
  Venus,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { cn } from "@/shared/lib/utils";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { motion, AnimatePresence } from "motion/react";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

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
    | "GRADE_LEVEL_COORDINATOR"
    | "CLASS_ADVISER"
    | "TEACHER";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
}

interface FetchUsersParams {
  page: number;
  limit: number;
  role?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const PAGE_SIZE = 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEPED_EMAIL_PATTERN = /@deped\.gov\.ph$/i;
const MOBILE_PATTERN = /^09\d{9}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function generatePassword() {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let retVal = "";

  // Ensure at least one of each required type
  retVal += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  retVal += "0123456789"[Math.floor(Math.random() * 10)];
  retVal += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];

  for (let i = 0; i < length - 3; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle
  return retVal
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export default function AdminUsers() {
  const { schoolName } = useSettingsStore();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalActiveStaff: 0,
    pendingUnverified: 0,
    lockedDeactivated: 0,
  });

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
    role: "SYSTEM_ADMIN" as User["role"],
    password: "",
    mustChangePassword: true,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {},
  );
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

    // DepEd governance: Employee ID mandatory for high-level roles
    if (
      (formData.role === "SYSTEM_ADMIN" ||
        formData.role === "HEAD_REGISTRAR") &&
      !formData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    }

    if (!formData.mobileNumber.trim()) {
      nextErrors.mobileNumber = "Mobile number is required.";
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

    // DepEd governance: Employee ID mandatory for high-level roles
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
    const response = (
      err as {
        response?: {
          status?: number;
          data?: {
            field?: string;
            code?: string;
            message?: string;
          };
        };
      }
    ).response;

    if (response?.status !== 409) return null;

    const field = response.data?.field;
    const code = response.data?.code;
    if (field === "email" || code === "DUPLICATE_EMAIL") {
      return (
        response.data?.message ||
        "Email address is already in use by another account."
      );
    }

    return null;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 0);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: FetchUsersParams = {
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter !== "all") params.role = roleFilter;
      if (statusFilter !== "all") params.isActive = statusFilter === "active";

      const res = await api.get("/admin/users", { params });
      setUsers(res.data.users || []);
      setTotal(res.data.total ?? 0);
      setTotalPages(res.data.totalPages ?? 1);
    } catch (err) {
      toastApiError(err as never);
      setUsers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, debouncedSearch, sortBy, sortOrder]);

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

  const handleCreate = async () => {
    const nextErrors = validateCreateForm();
    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/admin/users", formData);
      sileo.success({
        title: "Account Created",
        description: `${formData.lastName}, ${formData.firstName} has been added as a ${formData.role?.toLowerCase() ?? "user"}.`,
      });
      setCreateErrors({});
      setCreateOpen(false);
      fetchUsers();
    } catch (err) {
      const duplicateEmailMessage = getDuplicateEmailMessage(err);
      if (duplicateEmailMessage) {
        setCreateErrors((prev) => ({
          ...prev,
          email: duplicateEmailMessage,
        }));
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
    setProfileErrors({});
    setProfileOpen(true);
  }, []);

  const handleProfileSave = async () => {
    if (!profileUser) return;

    const nextErrors = validateProfileForm();
    setProfileErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.put(`/admin/users/${profileUser.id}`, profileFormData);
      sileo.success({
        title: "Profile Updated",
        description: `${profileFormData.lastName}, ${profileFormData.firstName} profile updated successfully.`,
      });
      setProfileOpen(false);
      setProfileUser(null);
      setProfileErrors({});
      fetchUsers();
    } catch (err) {
      const duplicateEmailMessage = getDuplicateEmailMessage(err);
      if (duplicateEmailMessage) {
        setProfileErrors((prev) => ({
          ...prev,
          email: duplicateEmailMessage,
        }));
        return;
      }

      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${selectedUser.id}/reset-password`, {
        newPassword: formData.password,
        mustChangePassword: true,
      });
      sileo.success({
        title: "Password Reset",
        description: `New password generated for ${selectedUser.lastName}, ${selectedUser.firstName}. User must change password on next login.`,
      });
      setResetOpen(false);
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
      await api.patch(`/admin/users/${id}/${action}`);
      sileo.success({
        title:
          action === "deactivate"
            ? "Account Deactivated"
            : "Account Reactivated",
        description: `User status updated successfully.`,
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
    setSortBy((prevSortBy) => {
      if (prevSortBy === field) {
        setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"));
      } else {
        setSortOrder("asc");
      }
      return field;
    });
    setPage(1);
  }, []);

  const getSortIcon = useCallback(
    (field: string) => {
      if (sortBy !== field) {
        return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
      }
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
        id: "staff",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex h-11 w-full items-center justify-start gap-1 px-4 text-[10px] font-extrabold uppercase tracking-widest text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors rounded-tl-lg">
            Staff Details
            {getSortIcon("lastName")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex flex-col text-left min-w-[220px] pl-2 py-1">
              <span className="font-bold text-sm uppercase leading-tight text-foreground">
                {user.lastName}, {user.firstName}
                {user.suffix ? ` ${user.suffix}` : ""}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-extrabold text-muted-foreground flex items-center gap-1 shrink-0">
                  <IdCard className="h-3 w-3" />
                  {user.employeeId || (
                    <span className="italic font-normal opacity-50">—</span>
                  )}
                </span>
                {user.designation && (
                  <span className="text-[10px] font-extrabold text-primary flex items-center gap-1 truncate">
                    <Briefcase className="h-2.5 w-2.5" />
                    {user.designation}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "contact",
        header: () => (
          <button
            onClick={() => handleSort("email")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-[10px] font-extrabold uppercase tracking-widest text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors">
            Contact Info
            {getSortIcon("email")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="space-y-1 text-center min-w-[200px] py-1">
              <div className="text-sm font-bold leading-none">{user.email}</div>
              <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-1">
                <Phone className="h-2.5 w-2.5" />
                {user.mobileNumber || (
                  <span className="italic font-normal opacity-50">—</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: () => (
          <button
            onClick={() => handleSort("role")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-[10px] font-extrabold uppercase tracking-widest text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors">
            Access Role
            {getSortIcon("role")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex justify-center min-w-[140px]">
              <Badge
                variant="outline"
                className={`text-[10px] font-bold uppercase shrink-0 ${
                  user.role === "HEAD_REGISTRAR"
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-purple-200 bg-purple-50 text-purple-700"
                }`}>
                {user.role}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "status",
        header: () => (
          <button
            onClick={() => handleSort("isActive")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-[10px] font-extrabold uppercase tracking-widest text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors">
            Account Status
            {getSortIcon("isActive")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center justify-center gap-1.5 min-w-[100px]">
              <div
                className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${
                  user.isActive
                    ? "bg-green-500 ring-green-100"
                    : "bg-slate-400 ring-slate-100"
                }`}
              />
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                {user.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          );
        },
      },
      {
        id: "lastLoginAt",
        header: () => (
          <button
            onClick={() => handleSort("lastLoginAt")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-[10px] font-extrabold uppercase tracking-widest text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors">
            Last Activity
            {getSortIcon("lastLoginAt")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap block text-center min-w-[120px]">
            {row.original.lastLoginAt ? (
              new Date(row.original.lastLoginAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            ) : (
              <span className="italic font-normal opacity-50">—</span>
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div className="flex h-11 w-full items-center justify-center px-3 text-[10px] font-extrabold uppercase tracking-widest text-maroon-900 bg-maroon-50/50 rounded-tr-lg">
            Actions
          </div>
        ),
        cell: ({ row }) => {
          const user = row.original;

          return (
            <div className="flex items-center justify-center gap-2 min-w-[120px]">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 font-bold text-xs gap-1 hover:bg-primary hover:text-white transition-colors"
                onClick={() => openProfileEditor(user)}>
                <Edit2 className="h-3 w-3" />
                Edit
              </Button>

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
                  <DropdownMenuLabel className="text-[10px] font-extrabold uppercase tracking-widest opacity-50">
                    Staff Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedUser(user);
                      setFormData((prev) => ({
                        ...prev,
                        password: generatePassword(),
                      }));
                      setResetOpen(true);
                    }}
                    className="gap-2 font-bold text-xs">
                    <Key className="h-3.5 w-3.5 text-orange-600" />
                    Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem
                      disabled={currentUser?.id === user.id}
                      onClick={() => setDeactivateId(user.id)}
                      className="gap-2 font-bold text-xs text-destructive focus:text-destructive">
                      <UserMinus className="h-3.5 w-3.5" />
                      Deactivate User
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setReactivateId(user.id)}
                      className="gap-2 font-bold text-xs text-emerald-600 focus:text-emerald-600">
                      <UserCheck className="h-3.5 w-3.5" />
                      Reactivate User
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="gap-2 font-bold text-xs opacity-50 cursor-not-allowed">
                    <History className="h-3.5 w-3.5" />
                    Audit Trail
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      submitting,
      currentUser,
      handleSort,
      getSortIcon,
      openProfileEditor,
      setResetOpen,
      setSelectedUser,
      setFormData,
      setDeactivateId,
      setReactivateId,
    ],
  );

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-maroon-900">
            <UserCogIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            User Management
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Provision and manage staff accounts
            {schoolName ? ` for ${schoolName}` : ""}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            className="h-10 font-bold gap-2 order-2 sm:order-1"
            onClick={() => {
              sileo.info({
                title: "Coming Soon",
                description:
                  "Bulk LIS/EBEIS export import will be available in the next update.",
              });
            }}>
            <RefreshCw className="h-4 w-4" />
            Bulk Import
          </Button>
          <Button
            onClick={() => {
              setCreateErrors({});
              setFormData({
                firstName: "",
                lastName: "",
                middleName: "",
                suffix: "",
                sex: "FEMALE",
                employeeId: "",
                designation: "",
                mobileNumber: "",
                email: "",
                role: "SYSTEM_ADMIN",
                password: generatePassword(),
                mustChangePassword: true,
              });
              setCreateOpen(true);
            }}
            className="h-10 font-bold order-1 sm:order-2">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Total Active Staff
            </p>
            <CardTitle className="text-2xl font-extrabold text-emerald-600">
              {metrics.totalActiveStaff}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Pending Invites / Unverified
            </p>
            <CardTitle className="text-2xl font-extrabold text-orange-600">
              {metrics.pendingUnverified}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Locked / Deactivated
            </p>
            <CardTitle className="text-2xl font-extrabold text-destructive">
              {metrics.lockedDeactivated}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="w-full min-w-0 overflow-hidden border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                Search Staff
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  placeholder="Name, email, employee ID, designation..."
                  className="pl-9 h-10 text-sm font-bold"
                  value={search}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearch(val);
                    startTransition(() => {
                      setPage(1);
                    });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:flex gap-3 md:gap-4 w-full md:w-auto">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Role
                </Label>
                <Select
                  value={roleFilter}
                  onValueChange={(value) => {
                    startTransition(() => {
                      setRoleFilter(value);
                      setPage(1);
                    });
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-44 text-sm font-bold">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="SYSTEM_ADMIN">System Admins</SelectItem>
                    <SelectItem value="HEAD_REGISTRAR">
                      Head Registrars
                    </SelectItem>
                    <SelectItem value="GRADE_LEVEL_COORDINATOR">
                      Coordinators (GLC)
                    </SelectItem>
                    <SelectItem value="CLASS_ADVISER">
                      Class Advisers
                    </SelectItem>
                    <SelectItem value="TEACHER">Teachers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    startTransition(() => {
                      setStatusFilter(value);
                      setPage(1);
                    });
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-44 text-sm font-bold">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={fetchUsers}>
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                onClick={() => {
                  startTransition(() => {
                    setSearch("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                    setSortBy("createdAt");
                    setSortOrder("desc");
                    setPage(1);
                  });
                }}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="w-full min-w-0 overflow-hidden border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-extrabold">
            Staff Accounts
          </CardTitle>
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
            Showing {users.length} of {total} users
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
                  className={`rounded-xl border bg-[hsl(var(--card))] p-3 ${!user.isActive ? "opacity-70 bg-muted/20" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm uppercase leading-tight break-words">
                        {user.lastName}, {user.firstName}
                        {user.suffix ? ` ${user.suffix}` : ""}
                      </p>
                      <p className="text-xs font-bold text-muted-foreground truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase shrink-0 ${
                        user.role === "HEAD_REGISTRAR"
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-purple-200 bg-purple-50 text-purple-700"
                      }`}>
                      {user.role}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-y-1.5 gap-x-4 text-xs font-bold">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Briefcase className="h-3 w-3 shrink-0" />
                      {user.designation || (
                        <span className="italic font-normal opacity-50">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <IdCard className="h-3 w-3 shrink-0" />
                      {user.employeeId || (
                        <span className="italic font-normal opacity-50">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      {user.mobileNumber || (
                        <span className="italic font-normal opacity-50">—</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-dashed pt-2.5">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${
                          user.isActive
                            ? "bg-green-500 ring-green-100"
                            : "bg-slate-400 ring-slate-100"
                        }`}
                      />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {user.lastLoginAt
                        ? `Active ${new Date(user.lastLoginAt).toLocaleDateString()}`
                        : "No activity"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold gap-1.5"
                      onClick={() => openProfileEditor(user)}>
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit User
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs font-bold gap-1.5">
                          <MoreVertical className="h-3.5 w-3.5" />
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setFormData((prev) => ({
                              ...prev,
                              password: generatePassword(),
                            }));
                            setResetOpen(true);
                          }}
                          className="gap-2 font-bold text-xs">
                          <Key className="h-3.5 w-3.5 text-orange-600" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.isActive ? (
                          <DropdownMenuItem
                            disabled={currentUser?.id === user.id}
                            onClick={() => setDeactivateId(user.id)}
                            className="gap-2 font-bold text-xs text-destructive focus:text-destructive">
                            <UserMinus className="h-3.5 w-3.5" />
                            Deactivate User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setReactivateId(user.id)}
                            className="gap-2 font-bold text-xs text-emerald-600 focus:text-emerald-600">
                            <UserCheck className="h-3.5 w-3.5" />
                            Reactivate User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block w-full max-w-full overflow-x-hidden">
            <DataTable
              columns={columns}
              data={users}
              loading={loading}
              virtualize={true}
              estimatedRowHeight={60}
              tableClassName="table-fixed w-full"
              noResultsMessage="No users found matching the selected criteria."
            />
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <p className="text-sm font-semibold text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Account Drawer */}
      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateErrors({});
        }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-maroon-900">
              <UserCogIcon className="h-6 w-6 text-primary" />
              Add User Account
            </SheetTitle>
            <SheetDescription>
              Create a new administrative or faculty account for the school
              system.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            {/* Identity Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                <IdCard className="h-3.5 w-3.5" />
                Staff Identity
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    First Name *
                  </Label>
                  <Input
                    placeholder="e.g. Regina"
                    value={formData.firstName}
                    onChange={(e) => {
                      setCreateErrors((prev) => ({ ...prev, firstName: "" }));
                      setFormData({ ...formData, firstName: e.target.value });
                    }}
                    className={
                      createErrors.firstName
                        ? "border-destructive h-10 font-bold"
                        : "h-10 font-bold"
                    }
                  />
                  {createErrors.firstName && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                      {createErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Last Name *
                  </Label>
                  <Input
                    placeholder="e.g. Cruz"
                    value={formData.lastName}
                    onChange={(e) => {
                      setCreateErrors((prev) => ({ ...prev, lastName: "" }));
                      setFormData({ ...formData, lastName: e.target.value });
                    }}
                    className={
                      createErrors.lastName
                        ? "border-destructive h-10 font-bold"
                        : "h-10 font-bold"
                    }
                  />
                  {createErrors.lastName && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
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
                    placeholder="Optional"
                    value={formData.middleName}
                    onChange={(e) =>
                      setFormData({ ...formData, middleName: e.target.value })
                    }
                    className="h-10 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Suffix</Label>
                  <Input
                    placeholder="e.g. Jr., III"
                    value={formData.suffix}
                    onChange={(e) =>
                      setFormData({ ...formData, suffix: e.target.value })
                    }
                    className="h-10 font-bold"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase">
                  Sex at Birth <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4 pt-1">
                  {(
                    [
                      { value: "MALE", label: "MALE", icon: Mars },
                      { value: "FEMALE", label: "FEMALE", icon: Venus },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, sex: s.value })}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border-2 px-4 py-2 cursor-pointer transition-colors text-sm uppercase",
                        formData.sex === s.value
                          ? "border-primary bg-primary/5 font-bold"
                          : "border-border hover:bg-muted/50",
                      )}>
                      <s.icon
                        className={cn(
                          "w-4 h-4",
                          formData.sex === s.value
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <span className="font-bold">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Employment Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
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
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_ADMIN">
                      System Administrator
                    </SelectItem>
                    <SelectItem value="HEAD_REGISTRAR">
                      Head Registrar
                    </SelectItem>
                    <SelectItem value="GRADE_LEVEL_COORDINATOR">
                      Grade Level Coordinator (GLC)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "CLASS_ADVISER" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 p-3 bg-muted/50 rounded-lg border border-dashed border-primary/20">
                  <Label className="text-[10px] font-extrabold uppercase text-primary">
                    Assign to Section (Optional)
                  </Label>
                  <Select disabled>
                    <SelectTrigger className="h-10 font-bold opacity-50 italic">
                      <SelectValue placeholder="Loading sections..." />
                    </SelectTrigger>
                  </Select>
                  <p className="text-[10px] font-bold text-muted-foreground italic">
                    Section list will be populated from the active school year.
                  </p>
                </motion.div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Employee ID{" "}
                    {formData.role === "SYSTEM_ADMIN" ||
                    formData.role === "HEAD_REGISTRAR"
                      ? "*"
                      : "(Optional)"}
                  </Label>
                  <Input
                    placeholder="e.g. 1234567"
                    value={formData.employeeId}
                    onChange={(e) => {
                      setCreateErrors((prev) => ({ ...prev, employeeId: "" }));
                      setFormData({ ...formData, employeeId: e.target.value });
                    }}
                    className={
                      createErrors.employeeId
                        ? "border-destructive h-10 font-bold"
                        : "h-10 font-bold"
                    }
                  />
                  {createErrors.employeeId && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                      {createErrors.employeeId}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Plantilla Position
                  </Label>
                  <Input
                    placeholder="e.g. Registrar I"
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                    className="h-10 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Contact Information
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-foreground/80 flex justify-between">
                  Email Address *
                  {formData.email &&
                    !DEPED_EMAIL_PATTERN.test(formData.email) && (
                      <span className="text-[10px] text-orange-600 flex items-center gap-1 lowercase font-bold italic animate-pulse">
                        <AlertCircle className="h-3 w-3" /> non-deped domain
                      </span>
                    )}
                </Label>
                <Input
                  type="email"
                  placeholder="e.g. juana.cruz001@deped.gov.ph"
                  value={formData.email}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, email: "" }));
                    setFormData({ ...formData, email: e.target.value });
                  }}
                  className={
                    createErrors.email
                      ? "border-destructive h-10 font-bold"
                      : "h-10 font-bold"
                  }
                />
                {createErrors.email && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                    {createErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Mobile Number *
                </Label>
                <Input
                  placeholder="e.g. 09123456789"
                  value={formData.mobileNumber}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, mobileNumber: "" }));
                    setFormData({ ...formData, mobileNumber: e.target.value });
                  }}
                  className={
                    createErrors.mobileNumber
                      ? "border-destructive h-10 font-bold"
                      : "h-10 font-bold"
                  }
                />
                {createErrors.mobileNumber && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                    {createErrors.mobileNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Security Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
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
                    className="h-10 font-mono text-sm bg-muted/30"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    onClick={() => {
                      setCreateErrors((prev) => ({ ...prev, password: "" }));
                      setIsGenerating(true);
                      setFormData({
                        ...formData,
                        password: generatePassword(),
                      });
                      setTimeout(() => setIsGenerating(false), 600);
                    }}
                    title="Regenerate">
                    <RefreshCw
                      className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    onClick={() => copyToClipboard(formData.password)}
                    title="Copy">
                    {copied ? (
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-[11px] font-bold text-orange-800 leading-relaxed uppercase tracking-tighter">
                <div className="flex items-center gap-1.5 mb-1 text-orange-900">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Governance Notice
                </div>
                Credential sharing should follow school policy. User must reset
                this password upon first access.
              </div>
            </div>
          </div>
          <SheetFooter className="sticky -bottom-8 bg-background pt-6 pb-6 border-t mt-4 flex flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className="flex-1 h-11 font-bold uppercase tracking-widest text-xs text-maroon-900">
              Discard
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="flex-[2] h-11 font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
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
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) {
            setProfileUser(null);
            setProfileErrors({});
          }
        }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-maroon-900">
              <Edit2 className="h-6 w-6 text-primary" />
              Edit User Profile
            </SheetTitle>
            <SheetDescription>
              Modify staff identity and access permissions for{" "}
              {profileUser?.lastName}.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            {/* Identity Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                <IdCard className="h-3.5 w-3.5" />
                Staff Identity
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    First Name *
                  </Label>
                  <Input
                    value={profileFormData.firstName}
                    onChange={(e) => {
                      setProfileErrors((prev) => ({ ...prev, firstName: "" }));
                      setProfileFormData({
                        ...profileFormData,
                        firstName: e.target.value,
                      });
                    }}
                    className={
                      profileErrors.firstName
                        ? "border-destructive h-10 font-bold"
                        : "h-10 font-bold"
                    }
                  />
                  {profileErrors.firstName && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                      {profileErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Last Name *
                  </Label>
                  <Input
                    value={profileFormData.lastName}
                    onChange={(e) => {
                      setProfileErrors((prev) => ({ ...prev, lastName: "" }));
                      setProfileFormData({
                        ...profileFormData,
                        lastName: e.target.value,
                      });
                    }}
                    className={
                      profileErrors.lastName
                        ? "border-destructive h-10 font-bold"
                        : "h-10 font-bold"
                    }
                  />
                  {profileErrors.lastName && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                      {profileErrors.lastName}
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
                    value={profileFormData.middleName}
                    onChange={(e) =>
                      setProfileFormData({
                        ...profileFormData,
                        middleName: e.target.value,
                      })
                    }
                    className="h-10 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Suffix</Label>
                  <Input
                    value={profileFormData.suffix}
                    onChange={(e) =>
                      setProfileFormData({
                        ...profileFormData,
                        suffix: e.target.value,
                      })
                    }
                    className="h-10 font-bold"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase">
                  Sex at Birth <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4 pt-1">
                  {(
                    [
                      { value: "MALE", label: "MALE", icon: Mars },
                      { value: "FEMALE", label: "FEMALE", icon: Venus },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() =>
                        setProfileFormData({ ...profileFormData, sex: s.value })
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-lg border-2 px-4 py-2 cursor-pointer transition-colors text-sm uppercase",
                        profileFormData.sex === s.value
                          ? "border-primary bg-primary/5 font-bold"
                          : "border-border hover:bg-muted/50",
                      )}>
                      <s.icon
                        className={cn(
                          "w-4 h-4",
                          profileFormData.sex === s.value
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <span className="font-bold">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Employment Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />
                Employment & Role
              </div>
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
                    <SelectItem value="SYSTEM_ADMIN">
                      System Administrator
                    </SelectItem>
                    <SelectItem value="HEAD_REGISTRAR">
                      Head Registrar
                    </SelectItem>
                    <SelectItem value="GRADE_LEVEL_COORDINATOR">
                      Grade Level Coordinator (GLC)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Employee ID{" "}
                    {profileFormData.role === "SYSTEM_ADMIN" ||
                    profileFormData.role === "HEAD_REGISTRAR"
                      ? "*"
                      : "(Optional)"}
                  </Label>
                  <Input
                    value={profileFormData.employeeId}
                    onChange={(e) => {
                      setProfileErrors((prev) => ({ ...prev, employeeId: "" }));
                      setProfileFormData({
                        ...profileFormData,
                        employeeId: e.target.value,
                      });
                    }}
                    className={
                      profileErrors.employeeId
                        ? "border-destructive h-10 font-bold"
                        : "h-10 font-bold"
                    }
                  />
                  {profileErrors.employeeId && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                      {profileErrors.employeeId}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">
                    Plantilla Position
                  </Label>
                  <Input
                    value={profileFormData.designation}
                    onChange={(e) =>
                      setProfileFormData({
                        ...profileFormData,
                        designation: e.target.value,
                      })
                    }
                    className="h-10 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Contact Information
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase flex justify-between">
                  Email Address *
                  {profileFormData.email &&
                    !DEPED_EMAIL_PATTERN.test(profileFormData.email) && (
                      <span className="text-[10px] text-orange-600 flex items-center gap-1 lowercase font-bold italic">
                        <AlertCircle className="h-3 w-3" /> non-deped domain
                      </span>
                    )}
                </Label>
                <Input
                  type="email"
                  value={profileFormData.email}
                  onChange={(e) => {
                    setProfileErrors((prev) => ({ ...prev, email: "" }));
                    setProfileFormData({
                      ...profileFormData,
                      email: e.target.value,
                    });
                  }}
                  className={
                    profileErrors.email
                      ? "border-destructive h-10 font-bold"
                      : "h-10 font-bold"
                  }
                />
                {profileErrors.email && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                    {profileErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  Mobile Number
                </Label>
                <Input
                  value={profileFormData.mobileNumber}
                  onChange={(e) => {
                    setProfileErrors((prev) => ({ ...prev, mobileNumber: "" }));
                    setProfileFormData({
                      ...profileFormData,
                      mobileNumber: e.target.value,
                    });
                  }}
                  className={
                    profileErrors.mobileNumber
                      ? "border-destructive h-10 font-bold"
                      : "h-10 font-bold"
                  }
                />
                {profileErrors.mobileNumber && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
                    {profileErrors.mobileNumber}
                  </p>
                )}
              </div>
            </div>
          </div>
          <SheetFooter className="sticky bottom-0 bg-background pt-6 pb-2 border-t mt-4 flex flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setProfileOpen(false);
                setProfileUser(null);
                setProfileErrors({});
              }}
              disabled={submitting}
              className="flex-1 h-11 font-bold uppercase tracking-widest text-xs text-maroon-900">
              Discard
            </Button>
            <Button
              onClick={handleProfileSave}
              disabled={submitting}
              className="flex-[2] h-11 font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
              {submitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckIcon className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}>
        <DialogContent className="w-[95vw] max-w-md sm:w-full overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Generate a new temporary password for {selectedUser?.lastName},{" "}
              {selectedUser?.firstName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm text-orange-800 leading-relaxed">
              <strong>Warning:</strong> Existing login sessions for this user
              will be invalidated. Share the new password through a secure
              offline channel.
            </div>
            <div className="space-y-2">
              <Label>New Password *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className=" text-sm sm:text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => {
                    setIsGenerating(true);
                    setFormData({ ...formData, password: generatePassword() });
                    setTimeout(() => setIsGenerating(false), 600);
                  }}
                  title="Generate">
                  <motion.div
                    animate={isGenerating ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}>
                    <RefreshCw className="h-4 w-4" />
                  </motion.div>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9 overflow-hidden"
                  onClick={() => copyToClipboard(formData.password)}
                  title="Copy">
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}>
                        <CheckIcon className="h-4 w-4 text-green-600" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}>
                        <Copy className="h-4 w-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-primary text-primary-foreground text-sm leading-relaxed shadow-sm">
              <strong className="flex items-center gap-1.5 mb-0.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Security Policy:
              </strong>
              Password change is mandatory on next login for all administrative
              accounts.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={submitting}
              className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={submitting || !formData.password}
              className="w-full sm:w-auto">
              {submitting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!deactivateId}
        onOpenChange={(open) => !open && setDeactivateId(null)}
        title="Deactivate Account"
        description="This user will immediately lose access to the system. All their historical data (audit logs, approvals) will be preserved."
        confirmText="Yes, Deactivate"
        onConfirm={() =>
          deactivateId && handleToggleStatus(deactivateId, "deactivate")
        }
        loading={submitting}
        variant="warning"
      />

      <ConfirmationModal
        open={!!reactivateId}
        onOpenChange={(open) => !open && setReactivateId(null)}
        title="Reactivate Account"
        description="This user will regain access to the system with their previous role and permissions."
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
