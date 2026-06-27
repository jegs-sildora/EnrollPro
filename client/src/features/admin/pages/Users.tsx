import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useSettingsStore } from "@/store/settings.slice";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import {
  Search,
  Plus,
  Edit2,
  Key,
  Ban,
  CheckCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ShieldAlert,
  Copy,
  Briefcase,
  IdCard,
  Check as CheckIcon,
  MoreVertical,
  History,
  Users as UsersIcon,
  GraduationCap,
  Fingerprint,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import {
  cn,
  formatUserRole,
  getRoleColorClasses,
} from "@/shared/lib/utils";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { motion } from "motion/react";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { UserAccountFormSheet } from "../components/UserAccountFormSheet";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  sex: "MALE" | "FEMALE";
  employeeId: string | null;
  accountName: string | null;
  designation: string | null;
  mobileNumber: string | null;
  email: string;
  roles: (
    | "SYSTEM_ADMIN"
    | "HEAD_REGISTRAR"
    | "CLASS_ADVISER"
    | "TEACHER"
    | "MRF"
    | "LEARNER"
  )[];
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
  roles?: string[];
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  gradeLevelId?: string;
  sectionId?: string;
  learnerStatus?: string;
  tab?: "staff" | "learners";
  program?: string;
}

interface GradeLevel {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
  programType: string;
  gradeLevelId: number;
}

const PROGRAM_FILTER_OPTIONS = [
  { value: "REGULAR", label: "Basic Education Curriculum" },
  { value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" },
  { value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" },
  { value: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" },
  { value: "SPECIAL_PROGRAM_IN_JOURNALISM", label: "SPJ" },
  { value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE", label: "SPFL" },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "SPTVE",
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^09\d{9}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMPLOYEE_ID_PATTERN = /^[0-9]{7}$/;

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
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { activeSchoolYearId, globalDefaultPassword } = useSettingsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "learners" ? "learners" : "staff";
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);


  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const showSkeleton = useDelayedLoading(loading);

  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [limit, setLimit] = useState(
    () => Number(searchParams.get("limit")) || 25,
  );
  const [total, setTotal] = useState(0);
  const {
    inputValue: search,
    setInputValue: setSearch,
    activeFilter: debouncedSearch,
    clearSearch,
  } = useDebouncedSearch(searchParams.get("search") || "");

  const [roleFilter, setRoleFilter] = useState<string>(
    () => searchParams.get("role") || "all",
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    () => searchParams.get("status") || "all",
  );
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>(
    () => searchParams.get("gradeLevelId") || "all",
  );
  const [sectionFilter, setSectionFilter] = useState<string>(
    () => searchParams.get("sectionId") || "all",
  );
  const [learnerStatusFilter, setLearnerStatusFilter] = useState<string>(
    () => searchParams.get("learnerStatus") || "all",
  );
  const [programFilter, setProgramFilter] = useState<string>("all");

  const [sortBy, setSortBy] = useState<string>(
    () => searchParams.get("sortBy") || "createdAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    () => (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
  );

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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    updateUrlParams({ page: newPage });
  }, [updateUrlParams]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    updateUrlParams({ limit: newLimit, page: 1 });
  }, [updateUrlParams]);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    setPage(1);
    clearSearch();
    setRoleFilter("all");
    setStatusFilter("all");
    setGradeLevelFilter("all");
    setSectionFilter("all");
    setLearnerStatusFilter("all");
  };

  const handleCreateFieldChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "firstName" || field === "lastName") {
        next.email = computeEmail(next.firstName, next.lastName);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setPage(1);
    clearSearch();
    setRoleFilter("all");
    setStatusFilter("all");
    setGradeLevelFilter("all");
    setSectionFilter("all");
    setLearnerStatusFilter("all");
  }, [activeTab]);


  useEffect(() => {
    if (activeTab === "learners") {
      const fetchLearnerMeta = async () => {
        try {
          const res = await api.get("/school-years/grade-levels");
          setGradeLevels(res.data.gradeLevels || []);
        } catch (err) {
          console.error("Failed to fetch grade levels", err);
        }
      };
      fetchLearnerMeta();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "learners" && activeSchoolYearId) {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/sections/${activeSchoolYearId}`);
          const allSections = (res.data.gradeLevels || []).flatMap(
            (gl: { gradeLevelId: number; sections: Section[] }) =>
              (gl.sections || []).map((s: Section) => ({
                ...s,
                gradeLevelId: gl.gradeLevelId,
              })),
          );
          setSections(allSections);
        } catch (err) {
          console.error("Failed to fetch sections", err);
        }
      };
      fetchSections();
    } else {
      setSections([]);
      setSectionFilter("all");
    }
  }, [activeTab, activeSchoolYearId]);

  useEffect(() => {
    if (gradeLevelFilter === "all") {
      setFilteredSections(
        programFilter === "all"
          ? sections
          : sections.filter((s) => s.programType === programFilter),
      );
    } else {
      setFilteredSections(
        sections.filter((s) => {
          const isGradeMatch = s.gradeLevelId === parseInt(gradeLevelFilter, 10);
          const isProgramMatch =
            programFilter === "all" || s.programType === programFilter;
          return isGradeMatch && isProgramMatch;
        }),
      );
    }
    setSectionFilter("all");
  }, [gradeLevelFilter, programFilter, sections]);

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
    roles: ["TEACHER"] as string[],
    password: "",
    mustChangePassword: true,
    department: "",
    accountName: "",
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setCreateErrors] = useState<Record<string, string>>({});
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
    roles: ["TEACHER"] as string[],
    department: "",
    accountName: "",
    isActive: true,
    password: "",
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
      (formData.roles?.includes("SYSTEM_ADMIN") ||
        formData.roles?.includes("HEAD_REGISTRAR") ||
        formData.roles?.includes("TEACHER") ||
        formData.roles?.includes("CLASS_ADVISER") ||
        formData.roles?.includes("MRF")) &&
      !formData.employeeId.trim()
    ) {
      nextErrors.employeeId = "Employee ID is mandatory for this role.";
    } else if (
      formData.employeeId.trim() &&
      !EMPLOYEE_ID_PATTERN.test(formData.employeeId.trim())
    ) {
      nextErrors.employeeId = "Employee ID must be exactly 7 numeric digits.";
    }
    if (
      formData.roles?.includes("MRF") &&
      !formData.accountName?.trim()
    ) {
      nextErrors.accountName = "System Username is required for MRF staff.";
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
    if (profileFormData.password && profileFormData.password.trim()) {
      if (!PASSWORD_PATTERN.test(profileFormData.password)) {
        nextErrors.password =
          "Password needs 8+ chars, 1 uppercase, 1 number, and 1 symbol.";
      }
    }
    return nextErrors;
  };

  const getDuplicateEmailMessage = (err: unknown): string | null => {
    const response = (
      err as {
        response?: {
          status?: number;
          data?: { field?: string; code?: string; message?: string };
        };
      }
    ).response;
    if (response?.status !== 409) return null;
    const field = response.data?.field;
    const code = response.data?.code;
    if (field === "email" || code === "DUPLICATE_EMAIL") {
      return response.data?.message || "Email address is already in use.";
    }
    return null;
  };

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
        params.roles = ["LEARNER"];
        const isLrnSearch = debouncedSearch && /^\d{12}$/.test(debouncedSearch.trim());
        if (!isLrnSearch) {
          if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
          if (sectionFilter !== "all") params.sectionId = sectionFilter;
          if (programFilter !== "all") params.program = programFilter;
          if (learnerStatusFilter !== "all")
            params.learnerStatus = learnerStatusFilter;
        }
      } else {
        if (roleFilter !== "all") params.roles = [roleFilter];
        if (statusFilter !== "all") params.isActive = statusFilter === "active";
      }
      const res = await api.get("/admin/users", { params });
      let filteredUsers = res.data.users || [];
      if (activeTab === "staff" && roleFilter === "all") {
        filteredUsers = filteredUsers.filter((u: User) => !u.roles?.includes("LEARNER"));
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        middleName: formData.middleName.trim() || null,
        suffix: formData.suffix.trim() || null,
        sex: formData.sex,
        employeeId: formData.employeeId.trim() || null,
        designation: formData.designation.trim() || null,
        mobileNumber: formData.mobileNumber.trim() || null,
        email: formData.email.trim() || null,
        password: formData.password,
        roles: formData.roles,
        mustChangePassword: formData.mustChangePassword,
        department: formData.department || null,
        accountName: formData.accountName?.trim() || null,
      };
      await api.post("/admin/users", payload);
      sileo.success({
        title: "Account Created",
        description:
          formData.roles?.includes("MRF")
            ? `${formData.lastName}, ${formData.firstName} added as MRF Staff.`
            : `${formData.lastName}, ${formData.firstName} added successfully.`,
      });
      setCreateOpen(false);
      fetchUsers();
    } catch (err) {
      const duplicateEmailMessage = getDuplicateEmailMessage(err);
      if (duplicateEmailMessage) {
        setCreateErrors((prev) => ({ ...prev, email: duplicateEmailMessage }));
        return;
      }
      const response = (
        err as {
          response?: {
            status?: number;
            data?: { code?: string; message?: string };
          };
        }
      ).response;
      if (
        response?.status === 409 &&
        response.data?.code === "DUPLICATE_EMPLOYEE_ID"
      ) {
        setCreateErrors((prev) => ({
          ...prev,
          employeeId: response.data?.message ?? "Employee ID already in use.",
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
      roles: user.roles,
      department: "",
      accountName: user.accountName || "",
      isActive: user.isActive,
      password: "",
    });
    setProfileOpen(true);
  }, []);

  const handleProfileFieldChange = useCallback((field: string, value: unknown) => {
    setProfileFormData((prev) => ({ ...prev, [field]: value as never }));
  }, []);

  const handleProfileSave = async () => {
    if (!profileUser) return;
    const nextErrors = validateProfileForm();
    if (Object.keys(nextErrors).length > 0) {
      sileo.error({
        title: "Validation Error",
        description: Object.values(nextErrors)[0],
      });
      return;
    }
    setSubmitting(true);
    try {
      const patchPayload = {
        roles: profileFormData.roles,
        isActive: profileFormData.isActive,
        password: profileFormData.password || undefined,
      };
      await api.patch(`/admin/users/${profileUser.id}`, patchPayload);
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

  const handleResetToDefault = useCallback(async (password: string) => {
    if (!profileUser) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/learners/${profileUser.id}/reset-password`, {
        new_password_string: password,
      });
      sileo.success({
        title: "Password Reset",
        description: "Learner password reset and global default updated.",
      });
      fetchUsers();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  }, [profileUser, fetchUsers]);

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const isLearner = selectedUser.roles?.includes("LEARNER");
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
    const user = users.find(u => u.id === id);
    if (!user) return;
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${id}/${action}`);
      const newState = action === "reactivate" ? "Active" : "Deactivated";

      setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: action === "reactivate" } : u));

      sileo.success({
        title: "Status Updated",
        description: `${user.firstName} ${user.lastName}'s account has been successfully ${newState}.`,
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
        id: "identity",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex h-11 w-full items-center justify-start gap-1 px-4 text-base font-extrabold uppercase  text-maroon-900 bg-maroon-50/50 hover:bg-maroon-100/50 transition-colors">
            {activeTab === "staff" ? "Name & Contact Details" : "LEARNER & LRN"}
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
                <AvatarFallback className="text-base font-extrabold bg-primary/5 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-base uppercase leading-tight text-foreground truncate">
                  {user.lastName}, {user.firstName}
                </span>
                <span className="text-[11px] font-extrabold text-foreground truncate">
                  {user.email}
                </span>
                {activeTab === "staff" && user.employeeId && (
                  <span className="text-base font-extrabold text-primary uppercase mt-0.5 flex items-center gap-1">
                    <IdCard className="h-2.5 w-2.5" /> ID: {user.employeeId}
                  </span>
                )}
                {activeTab === "learners" && (
                  <span className="text-base font-extrabold text-foreground flex items-center gap-1 mt-0.5 shrink-0">
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
        id: "status",
        header: () => (
          <button
            onClick={() => handleSort("isActive")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-base font-extrabold uppercase  text-maroon-900 bg-maroon-50/50 border-r border-maroon-100">
            Account Status{getSortIcon("isActive")}
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;

          if (activeTab === "learners") {
            const isRestricted = !user.isActive || user.learnerProfile?.status === "DROPPED" || user.learnerProfile?.status === "TRANSFERRED_OUT";

            return (
              <div className="flex flex-col items-center justify-center gap-1 min-w-[110px]">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full ring-2 ring-offset-1",
                      isRestricted
                        ? "bg-red-500 ring-red-100"
                        : "bg-green-500 ring-green-100",
                    )}
                  />
                  <span className="text-base font-extrabold uppercase ">
                    {isRestricted ? "RESTRICTED" : "ACTIVE"}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center justify-center gap-1 min-w-[100px]">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full ring-2 ring-offset-1",
                    !user.isActive
                      ? "bg-red-500 ring-red-100"
                      : "bg-green-500 ring-green-100",
                  )}
                />
                <span className="text-base font-extrabold uppercase ">
                  {!user.isActive
                    ? "RESTRICTED"
                    : "ACTIVE"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "context",
        header: () => (
          <div className="flex h-11 w-full items-center justify-start text-base font-extrabold uppercase text-maroon-900 bg-maroon-50/50 px-4">
            {activeTab === "staff" ? "System Roles" : "GRADE & SECTION"}
          </div>
        ),
        cell: ({ row }) => {
          const user = row.original;
          if (activeTab === "learners") {
            const currentApp = user.learnerProfile?.enrollmentApplications?.[0];
            return (
              <div className="space-y-1.5 text-left min-w-[160px] py-1 px-4">
                <div className="flex flex-col items-start">
                  <div className="text-[11px] font-extrabold text-primary uppercase leading-none">
                    {currentApp?.gradeLevel?.name || "—"}
                  </div>
                  <div className="text-base font-extrabold text-foreground uppercase">
                    {currentApp?.enrollmentRecord?.section?.name ||
                      "UNSECTIONED"}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className="flex justify-start px-4 min-w-[140px] py-1">
              <span
                className={cn(
                  "inline-flex px-3 py-1 text-sm font-extrabold whitespace-nowrap rounded-full bg-secondary text-secondary-foreground border border-border"
                )}>
                {formatUserRole(user.roles?.[0])}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="flex h-11 w-full items-center justify-center px-3 text-base font-extrabold uppercase  text-maroon-900 bg-maroon-50/50 rounded-tr-lg">
            Actions
          </div>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center justify-center gap-1.5 min-w-[140px]">

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
                  <DropdownMenuLabel className="text-base font-extrabold uppercase  opacity-50">
                    Account Control
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => openProfileEditor(user)}
                    className="gap-2 font-extrabold text-base group focus:bg-primary focus:text-primary-foreground">
                    <Edit2 className="h-3.5 w-3.5 text-primary group-focus:text-primary-foreground" /> {user.roles?.includes("LEARNER") ? "Manage Security" : "Edit Account"}
                  </DropdownMenuItem>
                  {!user.roles?.includes("LEARNER") && (
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedUser(user);
                        const newPass = generatePassword();
                        setFormData((p) => ({
                          ...p,
                          password: newPass,
                        }));
                        copyToClipboard(newPass);
                        setResetOpen(true);
                      }}
                      className="gap-2 font-extrabold text-base group focus:bg-primary focus:text-primary-foreground">
                      <Key className="h-3.5 w-3.5 text-orange-600 group-focus:text-primary-foreground" /> Reset
                      Password
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem
                      disabled={currentUser?.id === user.id}
                      onClick={() => setDeactivateId(user.id)}
                      className="gap-2 font-extrabold text-base text-destructive focus:bg-destructive focus:text-destructive-foreground">
                      <Ban className="h-3.5 w-3.5" /> Restrict Access
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setReactivateId(user.id)}
                      className="gap-2 font-extrabold text-base text-green-600 focus:bg-green-600 focus:text-white">
                      <CheckCircle className="h-3.5 w-3.5" /> Reactivate Access
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => navigate(`/audit-logs?actorId=${user.id}`)}
                    className="gap-2 font-extrabold text-base focus:text-primary-foreground focus:bg-primary group">
                    <History className="h-3.5 w-3.5 group-focus:text-primary-foreground" /> Audit Trail
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [currentUser, activeTab, handleSort, getSortIcon, openProfileEditor, handleToggleStatus],
  );

  const metricsElement = useMemo(
    () => {
      const active = users.filter(u => u.isActive && !u.roles?.includes("LEARNER")).length;
      const Deactivated = users.filter(u => !u.isActive && !u.roles?.includes("LEARNER")).length;
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {[
            {
              label: "Total Active Personnel",
              val: active,
              color: "text-emerald-600",
            },
            {
              label: "Total Inactive Personnel",
              val: Deactivated,
              color: "text-destructive",
            },
          ].map((m, i) => (
            <Card
              key={i}
              className="border-none shadow-sm bg-[hsl(var(--card))]">
              <CardHeader className="pb-2">
                <p className="text-base uppercase font-extrabold text-foreground">
                  {m.label}
                </p>
                <CardTitle className={cn("text-2xl font-extrabold", m.color)}>
                  {m.val}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      );
    },
    [users],
  );

  const availableProgramTypes = useMemo(() => {
    return Array.from(new Set(sections.map((s) => s.programType)));
  }, [sections]);

  const dynamicProgramOptions = useMemo(() => {
    return PROGRAM_FILTER_OPTIONS.filter((option) =>
      availableProgramTypes.includes(option.value)
    );
  }, [availableProgramTypes]);

  const filterElement = useMemo(
    () => (
      <Card className="w-full min-w-0 overflow-hidden border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-base sm:text-base leading-tight uppercase font-extrabold flex items-center justify-between">
                <span>
                  {activeTab === "staff"
                    ? "Personnel Filter"
                    : "Search Learner"}
                </span>
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder={
                    activeTab === "staff"
                      ? "Search by Employee ID, Email, or Name..."
                      : "LRN, first name, last name..."
                  }
                  className="pl-9 h-10 text-base leading-tight font-extrabold shadow-inner focus:ring-primary/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:flex gap-3 md:gap-4 w-full md:w-auto">
              {activeTab === "staff" ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-base sm:text-base leading-tight uppercase  font-extrabold">
                      Role
                    </Label>
                    <Select
                      value={roleFilter}
                      onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-10 w-full md:w-36 text-base leading-tight font-extrabold">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="SYSTEM_ADMIN">Admin</SelectItem>
                        <SelectItem value="HEAD_REGISTRAR">
                          Registrar
                        </SelectItem>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="MRF">MRF Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base sm:text-base leading-tight uppercase  font-extrabold">
                      Status
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-10 w-full md:w-32 text-base leading-tight font-extrabold">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Restricted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-base sm:text-base leading-tight uppercase  font-extrabold">
                      Grade Level
                    </Label>
                    <Select
                      value={gradeLevelFilter}
                      onValueChange={setGradeLevelFilter}>
                      <SelectTrigger className="h-10 w-full md:w-52 text-base leading-tight font-extrabold">
                        <SelectValue placeholder="All Grades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-base leading-tight font-extrabold">All Grades</SelectItem>
                        {gradeLevels.map((gl) => (
                          <SelectItem
                            key={gl.id}
                            value={gl.id.toString()}
                            className="text-base leading-tight font-extrabold">
                            {gl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base sm:text-base leading-tight uppercase  font-extrabold">
                      Specialized Program
                    </Label>
                    <Select
                      value={programFilter}
                      onValueChange={setProgramFilter}>
                      <SelectTrigger className="h-10 w-full md:w-52 text-base leading-tight font-extrabold">
                        <SelectValue placeholder="All Specialized Programs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-base leading-tight font-extrabold">All Specialized Programs</SelectItem>
                        {dynamicProgramOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="text-base leading-tight font-extrabold">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base sm:text-base leading-tight uppercase  font-extrabold">
                      Section
                    </Label>
                    <Select
                      value={sectionFilter}
                      onValueChange={setSectionFilter}>
                      <SelectTrigger className="h-10 w-full md:w-52 text-base leading-tight font-extrabold hover:bg-accent hover:text-accent-foreground transition-colors">
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-base leading-tight font-extrabold">All Sections</SelectItem>
                        {filteredSections.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id.toString()}
                            className="text-base leading-tight font-extrabold">
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
                className="h-10 px-3 text-base leading-tight font-extrabold w-full md:w-auto"
                onClick={() => {
                  clearSearch();
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setGradeLevelFilter("all");
                  setProgramFilter("all");
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
      programFilter,
      sectionFilter,
      filteredSections,
      loading,
      fetchUsers,
      activeTab,
      gradeLevels,
      dynamicProgramOptions,
    ],
  );

  const tableElement = useMemo(
    () => (
      <Card className="w-full min-w-0 overflow-hidden border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-extrabold">
            {activeTab === "staff" ? "Personnel Accounts" : "Learner Accounts"}
          </CardTitle>
          <p className="text-base sm:text-base leading-tight font-extrabold text-foreground">
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
              <div className="rounded-xl border p-6 text-center text-base leading-tight font-extrabold">
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
                        <AvatarFallback className="text-base font-extrabold">
                          {user.firstName.charAt(0)}
                          {user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-extrabold text-base uppercase leading-tight break-words">
                          {user.lastName}, {user.firstName}
                        </p>
                        <p className="text-base font-extrabold text-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-base font-extrabold uppercase shrink-0 border-none",
                        getRoleColorClasses(user.roles?.[0]),
                      )}>
                      {activeTab === "learners"
                        ? user.learnerProfile?.enrollmentApplications?.[0]
                          ?.gradeLevel?.name || "LEARNER"
                        : formatUserRole(user.roles?.[0])}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-y-1.5 gap-x-4 text-base font-extrabold">
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
            <DataTable
              columns={columns.filter(c => c.id !== "actions")}
              data={users}
              loading={loading}
              virtualize={false}
              tableClassName="table-fixed w-full"
              noResultsMessage="No records found matching the selected criteria."
              onRowClick={openProfileEditor}
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
      handlePageChange,
      handleLimitChange,
    ],
  );

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-maroon-900">
            Learner Account Management
          </h1>
          <p className="text-base leading-tight font-extrabold text-foreground">
            Manage portal access, monitor account statuses, and reset learner passwords.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {activeTab === "staff" && (
            <Button
              onClick={() => {
                setCreateOpen(true);
                setFormData((p) => ({ ...p, password: generatePassword() }));
              }}
              className="h-10 font-extrabold">
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
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
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
                Personnel
              </span>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="learners"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
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

        <div className="w-full space-y-6">
          <TabsContent
            value={activeTab}
            forceMount
            className="mt-0 focus-visible:outline-none ring-0 space-y-6">
            {activeTab === "staff" && metricsElement}

            {filterElement}
            {tableElement}
          </TabsContent>
        </div>
      </Tabs>

      <UserAccountFormSheet
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        formData={formData}
        onFieldChange={handleCreateFieldChange}
        onSubmit={handleCreate}
        onCancel={() => setCreateOpen(false)}
        submitting={submitting}
        user={null}
        onGeneratePassword={() =>
          setFormData((p) => ({ ...p, password: generatePassword() }))
        }
        onCopyPassword={copyToClipboard}
        passwordCopied={copied}
      />

      <UserAccountFormSheet
        mode="edit"
        open={profileOpen}
        onOpenChange={setProfileOpen}
        formData={profileFormData}
        onFieldChange={handleProfileFieldChange}
        onSubmit={handleProfileSave}
        onCancel={() => setProfileOpen(false)}
        submitting={submitting}
        user={profileUser}
        onGeneratePassword={() =>
          setProfileFormData((p) => ({ ...p, password: generatePassword() }))
        }
        onCopyPassword={copyToClipboard}
        passwordCopied={copied}
        defaultPassword={globalDefaultPassword}
        onResetToDefault={handleResetToDefault}
      />

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
                  selectedUser?.roles?.includes("LEARNER")
                    ? "text-primary"
                    : "text-orange-600",
                )}
              />
              {selectedUser?.roles?.includes("LEARNER")
                ? "Reset to Default Password"
                : "Reset Staff Password"}
            </DialogTitle>
            <DialogDescription className="font-extrabold text-base">
              {selectedUser?.roles?.includes("LEARNER")
                ? `Confirming reset for ${selectedUser.lastName}, ${selectedUser.firstName}.`
                : "Generate a new temporary password for this staff member."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              className={cn(
                "p-3 rounded-lg border text-[11px] font-extrabold uppercase leading-relaxed",
                selectedUser?.roles?.includes("LEARNER")
                  ? "bg-primary/5 border-primary/10 text-primary"
                  : "bg-orange-50 border-orange-100 text-orange-800",
              )}>
              {selectedUser?.roles?.includes("LEARNER")
                ? "This will reset the student's portal access to the universal default: DepEd2026!"
                : "They will be logged out immediately and required to change this password upon signing back in."}
            </div>

            {!selectedUser?.roles?.includes("LEARNER") && (
              <div className="space-y-2">
                <Label className="text-base font-extrabold uppercase">
                  New Temporary Password *
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="font-extrabold h-10"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => {
                      setIsGenerating(true);
                      const newPass = generatePassword();
                      setFormData({
                        ...formData,
                        password: newPass,
                      });
                      copyToClipboard(newPass);
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
              className="flex-1 font-extrabold uppercase  text-base h-10">
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={submitting}
              className="flex-[2] font-extrabold uppercase  text-base h-10">
              {submitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {selectedUser?.roles?.includes("LEARNER")
                ? "Confirm Default Reset"
                : "Apply New Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={deactivateId !== null}
        onOpenChange={() => setDeactivateId(null)}
        title="Restrict Access"
        description="System access will be revoked immediately."
        confirmText="Yes, Restrict Access"
        onConfirm={() =>
          deactivateId && handleToggleStatus(deactivateId, "deactivate")
        }
        variant="danger"
        loading={submitting}
      />
      <ConfirmationModal
        open={reactivateId !== null}
        onOpenChange={() => setReactivateId(null)}
        title="Reactivate Access"
        description="Restoring system login access."
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
