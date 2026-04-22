import { useState, useEffect, useCallback, useMemo, startTransition } from "react";
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
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
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
  role: "REGISTRAR" | "SYSTEM_ADMIN";
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

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    sex: "FEMALE" as "MALE" | "FEMALE",
    employeeId: "",
    designation: "",
    mobileNumber: "",
    email: "",
    role: "REGISTRAR" as "REGISTRAR" | "SYSTEM_ADMIN",
  });

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
    role: "REGISTRAR" as "REGISTRAR" | "SYSTEM_ADMIN",
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
    role: "REGISTRAR" as "REGISTRAR" | "SYSTEM_ADMIN",
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const openProfileEditor = (user: User) => {
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
  };

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

  const startEditing = (user: User) => {
    setEditingId(user.id);
    setEditFormData({
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
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id: number) => {
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${id}`, editFormData);
      sileo.success({
        title: "Account Updated",
        description: "Changes saved successfully.",
      });
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      const duplicateEmailMessage = getDuplicateEmailMessage(err);
      if (duplicateEmailMessage) {
        sileo.error({
          title: "Duplicate email",
          description: duplicateEmailMessage,
        });
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    );
  };

  const activeCount = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users],
  );

  const adminCount = useMemo(
    () => users.filter((user) => user.role === "SYSTEM_ADMIN").length,
    [users],
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "staff",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Staff
            {getSortIcon("lastName")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isEditing = editingId === user.id;

          if (isEditing) {
            return (
              <div className="space-y-1 text-left min-w-[200px]">
                <Input
                  placeholder="Last Name"
                  value={editFormData.lastName}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      lastName: e.target.value,
                    })
                  }
                  className="h-7 text-sm"
                />
                <Input
                  placeholder="First Name"
                  value={editFormData.firstName}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      firstName: e.target.value,
                    })
                  }
                  className="h-7 text-sm"
                />
              </div>
            );
          }

          return (
            <div className="flex flex-col text-left min-w-[200px] pl-2">
              <span className="font-bold text-sm uppercase leading-tight">
                {user.lastName}, {user.firstName}
                {user.suffix ? ` ${user.suffix}` : ""}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {user.email}
              </span>
            </div>
          );
        },
      },
      {
        id: "position",
        header: () => (
          <button
            onClick={() => handleSort("designation")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Position and ID
            {getSortIcon("designation")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isEditing = editingId === user.id;

          if (isEditing) {
            return (
              <div className="space-y-1 text-left min-w-[150px]">
                <Input
                  placeholder="Designation"
                  value={editFormData.designation}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      designation: e.target.value,
                    })
                  }
                  className="h-7 text-sm"
                />
                <Input
                  placeholder="Employee ID"
                  value={editFormData.employeeId}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      employeeId: e.target.value,
                    })
                  }
                  className="h-7 text-sm"
                />
              </div>
            );
          }

          return (
            <div className="space-y-0.5 text-center min-w-[150px]">
              <div className="text-xs font-bold text-primary flex items-center justify-center gap-1">
                <Briefcase className="h-3 w-3" />
                {user.designation || "No Position Set"}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <IdCard className="h-3 w-3" />
                {user.employeeId || "No ID Set"}
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
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Contact
            {getSortIcon("email")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isEditing = editingId === user.id;

          if (isEditing) {
            return (
              <div className="space-y-1 text-left min-w-[200px]">
                <Input
                  placeholder="Email"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      email: e.target.value,
                    })
                  }
                  className="h-7 text-sm"
                />
                <Input
                  placeholder="Mobile Number"
                  value={editFormData.mobileNumber}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      mobileNumber: e.target.value,
                    })
                  }
                  className="h-7 text-sm"
                />
              </div>
            );
          }

          return (
            <div className="space-y-0.5 text-center min-w-[200px]">
              <div className="text-sm font-medium">{user.email}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Phone className="h-2.5 w-2.5" />
                {user.mobileNumber || "No Mobile Set"}
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
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Role
            {getSortIcon("role")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isEditing = editingId === user.id;

          if (isEditing) {
            return (
              <div className="flex justify-center min-w-[140px]">
                <Select
                  value={editFormData.role}
                  onValueChange={(value: "REGISTRAR" | "SYSTEM_ADMIN") =>
                    setEditFormData({
                      ...editFormData,
                      role: value,
                    })
                  }>
                  <SelectTrigger className="h-8 w-32 text-xs font-bold uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_ADMIN">ADMIN</SelectItem>
                    <SelectItem value="REGISTRAR">REGISTRAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }

          return (
            <div className="flex justify-center min-w-[140px]">
              <Badge
                variant="outline"
                className={`px-2 py-0.5 text-xs uppercase font-bold tracking-tight ${
                  user.role === "REGISTRAR"
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
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Status
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
              <span className="text-xs font-semibold">
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
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Last Login
            {getSortIcon("lastLoginAt")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap block text-center min-w-[120px]">
            {row.original.lastLoginAt
              ? new Date(row.original.lastLoginAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const user = row.original;
          const isEditing = editingId === user.id;

          if (isEditing) {
            return (
              <div className="flex flex-wrap items-center justify-center gap-1.5 min-w-[200px]">
                <Button
                  size="sm"
                  className="h-8 px-2 text-xs gap-1 font-bold"
                  onClick={() => handleUpdate(user.id)}
                  disabled={submitting}>
                  <CheckIcon className="h-3 w-3" />
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs gap-1 font-bold"
                  onClick={cancelEditing}
                  disabled={submitting}>
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <div className="flex flex-wrap items-center justify-center gap-1.5 min-w-[200px]">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs gap-1 font-bold"
                onClick={() => startEditing(user)}>
                <Edit2 className="h-3 w-3" />
                Quick Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs gap-1 font-bold"
                onClick={() => openProfileEditor(user)}>
                <UserCogIcon className="h-3 w-3" />
                Full Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs gap-1 font-bold"
                onClick={() => {
                  setSelectedUser(user);
                  setFormData({
                    ...formData,
                    password: generatePassword(),
                    mustChangePassword: true,
                  });
                  setResetOpen(true);
                }}>
                <Key className="h-3 w-3 text-orange-600" />
                Password
              </Button>
              {user.isActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentUser?.id === user.id}
                  className="h-8 px-2 text-xs gap-1 font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30"
                  onClick={() => setDeactivateId(user.id)}>
                  <UserMinus className="h-3 w-3" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs gap-1 font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white"
                  onClick={() => setReactivateId(user.id)}>
                  <UserCheck className="h-3 w-3" />
                  Reactivate
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      editingId,
      editFormData,
      submitting,
      currentUser,
      handleSort,
      getSortIcon,
      handleUpdate,
      cancelEditing,
      startEditing,
      openProfileEditor,
      setResetOpen,
      setSelectedUser,
      setFormData,
      formData,
      setDeactivateId,
      setReactivateId,
    ],
  );

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <UserCogIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            User Management
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Provision and manage staff accounts
            {schoolName ? ` for ${schoolName}` : ""}
          </p>
        </div>
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
              role: "REGISTRAR",
              password: generatePassword(),
              mustChangePassword: true,
            });
            setCreateOpen(true);
          }}
          className="h-10 w-full md:w-auto font-bold">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Total Accounts
            </p>
            <CardTitle className="text-2xl font-extrabold">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Active On Current Page
            </p>
            <CardTitle className="text-2xl font-extrabold text-emerald-600">
              {activeCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              System Admins On Page
            </p>
            <CardTitle className="text-2xl font-extrabold text-violet-600">
              {adminCount}
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
                    <SelectItem value="SYSTEM_ADMIN">Admins</SelectItem>
                    <SelectItem value="REGISTRAR">Registrars</SelectItem>
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
                  {editingId === user.id ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Last Name"
                        value={editFormData.lastName}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            lastName: e.target.value,
                          })
                        }
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder="First Name"
                        value={editFormData.firstName}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            firstName: e.target.value,
                          })
                        }
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder="Email"
                        value={editFormData.email}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            email: e.target.value,
                          })
                        }
                        className="h-9 text-sm"
                      />
                      <Select
                        value={editFormData.role}
                        onValueChange={(value: "REGISTRAR" | "SYSTEM_ADMIN") =>
                          setEditFormData({ ...editFormData, role: value })
                        }>
                        <SelectTrigger className="h-9 text-sm font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SYSTEM_ADMIN">Admin</SelectItem>
                          <SelectItem value="REGISTRAR">Registrar</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-9 flex-1 font-bold"
                          onClick={() => handleUpdate(user.id)}
                          disabled={submitting}>
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 flex-1 font-bold"
                          onClick={cancelEditing}
                          disabled={submitting}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm uppercase leading-tight break-words">
                            {user.lastName}, {user.firstName}
                            {user.suffix ? ` ${user.suffix}` : ""}
                          </p>
                          <p className="text-xs font-bold text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase shrink-0 ${
                            user.role === "REGISTRAR"
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-purple-200 bg-purple-50 text-purple-700"
                          }`}>
                          {user.role === "SYSTEM_ADMIN" ? "ADMIN" : "REGISTRAR"}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="font-bold flex items-center gap-1">
                          <Briefcase className="h-3 w-3 text-primary" />
                          {user.designation || "No position set"}
                        </p>
                        <p className="font-medium text-muted-foreground flex items-center gap-1">
                          <IdCard className="h-3 w-3" />
                          {user.employeeId || "No ID set"}
                        </p>
                        <p className="font-medium text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {user.mobileNumber || "No mobile set"}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${
                              user.isActive
                                ? "bg-green-500 ring-green-100"
                                : "bg-slate-400 ring-slate-100"
                            }`}
                          />
                          <span className="text-xs font-semibold">
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {user.lastLoginAt
                            ? `Last login ${new Date(
                                user.lastLoginAt,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}`
                            : "Never logged in"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs font-bold"
                          onClick={() => startEditing(user)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                          Quick Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs font-bold"
                          onClick={() => openProfileEditor(user)}>
                          <UserCogIcon className="h-3.5 w-3.5 mr-1.5" />
                          Full Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs font-bold"
                          onClick={() => {
                            setSelectedUser(user);
                            setFormData({
                              ...formData,
                              password: generatePassword(),
                              mustChangePassword: true,
                            });
                            setResetOpen(true);
                          }}>
                          <Key className="h-3.5 w-3.5 mr-1.5 text-orange-600" />
                          Password
                        </Button>
                        {user.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentUser?.id === user.id}
                            className="h-9 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30"
                            onClick={() => setDeactivateId(user.id)}>
                            <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white"
                            onClick={() => setReactivateId(user.id)}>
                            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block w-full max-w-full overflow-x-hidden">
            <DataTable
              columns={columns}
              data={users}
              loading={showSkeleton}
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

      {/* Add User Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateErrors({});
        }}>
        <DialogContent className="w-[95vw] max-w-2xl sm:w-full overflow-y-auto max-h-[90vh] scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Add User Account</DialogTitle>
            <DialogDescription>
              Add a new Registrar or Admin to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  placeholder="e.g. Regina"
                  value={formData.firstName}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, firstName: "" }));
                    setFormData({ ...formData, firstName: e.target.value });
                  }}
                  className={createErrors.firstName ? "border-destructive" : ""}
                />
                {createErrors.firstName && (
                  <p className="text-xs font-semibold text-destructive">
                    {createErrors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input
                  placeholder="e.g. Alcantara"
                  value={formData.middleName}
                  onChange={(e) =>
                    setFormData({ ...formData, middleName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  placeholder="e.g. Cruz"
                  value={formData.lastName}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, lastName: "" }));
                    setFormData({ ...formData, lastName: e.target.value });
                  }}
                  className={createErrors.lastName ? "border-destructive" : ""}
                />
                {createErrors.lastName && (
                  <p className="text-xs font-semibold text-destructive">
                    {createErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Suffix</Label>
                <Input
                  placeholder="e.g. Jr., III"
                  value={formData.suffix}
                  onChange={(e) =>
                    setFormData({ ...formData, suffix: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="mb-3 block">Sex *</Label>
                <RadioGroup
                  value={formData.sex}
                  onValueChange={(v: "MALE" | "FEMALE") =>
                    setFormData({ ...formData, sex: v })
                  }
                  className="flex gap-6 mt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MALE" id="sex-male" />
                    <Label
                      htmlFor="sex-male"
                      className="font-medium cursor-pointer">
                      Male
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="FEMALE" id="sex-female" />
                    <Label
                      htmlFor="sex-female"
                      className="font-medium cursor-pointer">
                      Female
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID (Optional)</Label>
                <Input
                  placeholder="e.g. 1234567"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Position / Designation</Label>
                <Input
                  placeholder="e.g. Registrar I"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  placeholder="registrar@school.edu.ph"
                  value={formData.email}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, email: "" }));
                    setFormData({ ...formData, email: e.target.value });
                  }}
                  className={createErrors.email ? "border-destructive" : ""}
                />
                {createErrors.email && (
                  <p className="text-xs font-semibold text-destructive">
                    {createErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Mobile Number *</Label>
                <Input
                  placeholder="e.g. 09123456789"
                  value={formData.mobileNumber}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, mobileNumber: "" }));
                    setFormData({ ...formData, mobileNumber: e.target.value });
                  }}
                  className={
                    createErrors.mobileNumber ? "border-destructive" : ""
                  }
                />
                {createErrors.mobileNumber && (
                  <p className="text-xs font-semibold text-destructive">
                    {createErrors.mobileNumber}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground italic -mt-2">
              Official email and mobile number are required for account
              recovery.
            </p>

            <div className="space-y-2">
              <Label>Role *</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(v: "REGISTRAR" | "SYSTEM_ADMIN") =>
                  setFormData({ ...formData, role: v })
                }
                className="flex flex-row gap-4">
                <div
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-all relative flex-1 ${
                    formData.role === "SYSTEM_ADMIN"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border"
                  }`}
                  onClick={() =>
                    setFormData({ ...formData, role: "SYSTEM_ADMIN" })
                  }>
                  <RadioGroupItem value="SYSTEM_ADMIN" id="role-admin" />
                  <Label
                    htmlFor="role-admin"
                    className={`flex flex-col gap-0.5 cursor-pointer flex-1 ${
                      formData.role === "SYSTEM_ADMIN" ? "text-primary" : ""
                    }`}>
                    <span className="font-bold text-sm">Admin</span>
                    <span
                      className={`text-sm leading-tight ${
                        formData.role === "SYSTEM_ADMIN"
                          ? "text-primary/70"
                          : "text-muted-foreground"
                      }`}>
                      Full access & logs.
                    </span>
                  </Label>
                </div>
                <div
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-all relative flex-1 ${
                    formData.role === "REGISTRAR"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border"
                  }`}
                  onClick={() =>
                    setFormData({ ...formData, role: "REGISTRAR" })
                  }>
                  <RadioGroupItem value="REGISTRAR" id="role-reg" />
                  <Label
                    htmlFor="role-reg"
                    className={`flex flex-col gap-0.5 cursor-pointer flex-1 ${
                      formData.role === "REGISTRAR" ? "text-primary" : ""
                    }`}>
                    <span className="font-bold text-sm">Registrar</span>
                    <span
                      className={`text-sm leading-tight ${
                        formData.role === "REGISTRAR"
                          ? "text-primary/70"
                          : "text-muted-foreground"
                      }`}>
                      Enrollment & sections.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.password}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, password: "" }));
                    setFormData({ ...formData, password: e.target.value });
                  }}
                  className={
                    createErrors.password
                      ? "border-destructive text-sm sm:text-sm"
                      : "text-sm sm:text-sm"
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => {
                    setCreateErrors((prev) => ({ ...prev, password: "" }));
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
              {createErrors.password && (
                <p className="text-xs font-semibold text-destructive">
                  {createErrors.password}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-primary text-primary-foreground text-sm leading-relaxed shadow-sm">
              <strong className="flex items-center gap-1.5 mb-0.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Security Notice:
              </strong>
              Users will be required to change this temporary password upon
              their first login for security compliance.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                submitting ||
                !formData.firstName ||
                !formData.lastName ||
                !formData.email ||
                !formData.mobileNumber ||
                !formData.password
              }
              className="w-full sm:w-auto">
              {submitting ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Profile Edit Dialog */}
      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) {
            setProfileUser(null);
            setProfileErrors({});
          }
        }}>
        <DialogContent className="w-[95vw] max-w-2xl sm:w-full overflow-y-auto max-h-[90vh] scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update account information for {profileUser?.lastName},{" "}
              {profileUser?.firstName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>First Name *</Label>
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
                    profileErrors.firstName ? "border-destructive" : ""
                  }
                />
                {profileErrors.firstName && (
                  <p className="text-xs font-semibold text-destructive">
                    {profileErrors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input
                  value={profileFormData.middleName}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      middleName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={profileFormData.lastName}
                  onChange={(e) => {
                    setProfileErrors((prev) => ({ ...prev, lastName: "" }));
                    setProfileFormData({
                      ...profileFormData,
                      lastName: e.target.value,
                    });
                  }}
                  className={profileErrors.lastName ? "border-destructive" : ""}
                />
                {profileErrors.lastName && (
                  <p className="text-xs font-semibold text-destructive">
                    {profileErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Suffix</Label>
                <Input
                  value={profileFormData.suffix}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      suffix: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="mb-3 block">Sex *</Label>
                <RadioGroup
                  value={profileFormData.sex}
                  onValueChange={(v: "MALE" | "FEMALE") =>
                    setProfileFormData({ ...profileFormData, sex: v })
                  }
                  className="flex gap-6 mt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MALE" id="sex-profile-male" />
                    <Label
                      htmlFor="sex-profile-male"
                      className="font-medium cursor-pointer">
                      Male
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="FEMALE" id="sex-profile-female" />
                    <Label
                      htmlFor="sex-profile-female"
                      className="font-medium cursor-pointer">
                      Female
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  value={profileFormData.employeeId}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      employeeId: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Position / Designation</Label>
                <Input
                  value={profileFormData.designation}
                  onChange={(e) =>
                    setProfileFormData({
                      ...profileFormData,
                      designation: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email Address *</Label>
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
                  className={profileErrors.email ? "border-destructive" : ""}
                />
                {profileErrors.email && (
                  <p className="text-xs font-semibold text-destructive">
                    {profileErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
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
                    profileErrors.mobileNumber ? "border-destructive" : ""
                  }
                />
                {profileErrors.mobileNumber && (
                  <p className="text-xs font-semibold text-destructive">
                    {profileErrors.mobileNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <RadioGroup
                value={profileFormData.role}
                onValueChange={(v: "REGISTRAR" | "SYSTEM_ADMIN") =>
                  setProfileFormData({ ...profileFormData, role: v })
                }
                className="flex flex-row gap-4">
                <div
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-all relative flex-1 ${
                    profileFormData.role === "SYSTEM_ADMIN"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border"
                  }`}
                  onClick={() =>
                    setProfileFormData({
                      ...profileFormData,
                      role: "SYSTEM_ADMIN",
                    })
                  }>
                  <RadioGroupItem
                    value="SYSTEM_ADMIN"
                    id="role-profile-admin"
                  />
                  <Label
                    htmlFor="role-profile-admin"
                    className={`flex flex-col gap-0.5 cursor-pointer flex-1 ${
                      profileFormData.role === "SYSTEM_ADMIN"
                        ? "text-primary"
                        : ""
                    }`}>
                    <span className="font-bold text-sm">Admin</span>
                    <span
                      className={`text-sm leading-tight ${
                        profileFormData.role === "SYSTEM_ADMIN"
                          ? "text-primary/70"
                          : "text-muted-foreground"
                      }`}>
                      Full access & logs.
                    </span>
                  </Label>
                </div>
                <div
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-all relative flex-1 ${
                    profileFormData.role === "REGISTRAR"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border"
                  }`}
                  onClick={() =>
                    setProfileFormData({
                      ...profileFormData,
                      role: "REGISTRAR",
                    })
                  }>
                  <RadioGroupItem value="REGISTRAR" id="role-profile-reg" />
                  <Label
                    htmlFor="role-profile-reg"
                    className={`flex flex-col gap-0.5 cursor-pointer flex-1 ${
                      profileFormData.role === "REGISTRAR" ? "text-primary" : ""
                    }`}>
                    <span className="font-bold text-sm">Registrar</span>
                    <span
                      className={`text-sm leading-tight ${
                        profileFormData.role === "REGISTRAR"
                          ? "text-primary/70"
                          : "text-muted-foreground"
                      }`}>
                      Enrollment & sections.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setProfileOpen(false);
                setProfileUser(null);
                setProfileErrors({});
              }}
              disabled={submitting}
              className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleProfileSave}
              disabled={submitting}
              className="w-full sm:w-auto">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
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
