import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/store/settings.slice";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import {
  UserCog,
  Plus,
  Edit2,
  Key,
  UserMinus,
  UserCheck,
  RefreshCw,
  ShieldAlert,
  Check,
  Copy,
  Briefcase,
  IdCard,
  Phone,
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
}

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
  const [page] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
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
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: FetchUsersParams = { page, limit: 20 };
      if (roleFilter !== "all") params.role = roleFilter;
      if (statusFilter !== "all") params.isActive = statusFilter === "active";

      const res = await api.get("/admin/users", { params });
      setUsers(res.data.users);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await api.post("/admin/users", formData);
      sileo.success({
        title: "Account Created",
        description: `${formData.lastName}, ${formData.firstName} has been added as a ${formData.role?.toLowerCase() ?? "user"}.`,
      });
      setCreateOpen(false);
      fetchUsers();
    } catch (err) {
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

  return (
    <div className='p-4 md:p-6 lg:p-8 space-y-6 max-w-full overflow-x-hidden'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div className='space-y-1 text-left'>
          <h1 className='text-2xl md:text-3xl font-bold flex items-center justify-start gap-2 text-balance'>
            <UserCog className='h-7 w-7 md:h-8 md:w-8 text-primary' />
            User Management
          </h1>
          <p className='text-[14px] text-muted-foreground text-balance'>
            Provision and manage staff accounts
            {schoolName ? ` for ${schoolName}` : ""}
          </p>
        </div>
        <div className='flex lg:justify-end'>
          <Button
            onClick={() => {
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
            className='w-full sm:w-fit shadow-sm'>
            <Plus className='h-4 w-4 mr-2' />
            Add User
          </Button>
        </div>
      </div>

      <Card className='max-w-full overflow-hidden'>
        <CardHeader className='pb-3 px-4 md:px-6 border-b bg-muted/10'>
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
            <CardTitle className='text-lg font-semibold'>
              System Users
            </CardTitle>
            <div className='flex flex-wrap items-center gap-2 md:gap-3'>
              <div className='flex items-center gap-2 bg-background border rounded-md px-2 py-1'>
                <Label className='text-[14px] font-bold uppercase opacity-60'>
                  Role
                </Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className='h-7 border-0 bg-transparent focus:ring-0 w-24 md:w-28 text-[14px] shadow-none p-0'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all' className='text-[14px]'>All Roles</SelectItem>
                    <SelectItem value='SYSTEM_ADMIN' className='text-[14px]'>Admins</SelectItem>
                    <SelectItem value='REGISTRAR' className='text-[14px]'>Registrars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center gap-2 bg-background border rounded-md px-2 py-1'>
                <Label className='text-[14px] font-bold uppercase opacity-60'>
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className='h-7 border-0 bg-transparent focus:ring-0 w-24 md:w-28 text-[14px] shadow-none p-0'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all' className='text-[14px]'>All Status</SelectItem>
                    <SelectItem value='active' className='text-[14px]'>Active</SelectItem>
                    <SelectItem value='inactive' className='text-[14px]'>Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant='outline'
                size='icon'
                className='h-9 w-9 shrink-0'
                onClick={fetchUsers}>
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='p-4 md:p-6'>
            <div className='rounded-md border border-border bg-background overflow-hidden'>
              <div className='overflow-x-auto scrollbar-thin pb-2'>
                <table className='w-full text-[14px] border-collapse table-fixed lg:table-auto min-w-[1000px] lg:min-w-full'>
                  <thead className='bg-muted/50 border-b'>
                    <tr>
                      <th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[14px] w-48'>
                        Name
                      </th>
                      <th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[14px] w-64'>
                        Position & ID
                      </th>
                      <th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[14px] w-64'>
                        Contact Info
                      </th>
                      <th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[14px] w-32'>
                        Role
                      </th>
                      <th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[14px] w-32'>
                        Status
                      </th>
                      <th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[14px] hidden xl:table-cell w-48'>
                        Last Login
                      </th>
                      <th className='px-4 py-3.5 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[14px] w-64'>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {users.length === 0 ? (
                      !loading && (
                        <tr>
                          <td
                            colSpan={7}
                            className='px-4 py-12 text-center text-muted-foreground italic'>
                            No users found matching the criteria.
                          </td>
                        </tr>
                      )
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          className={`hover:bg-muted/30 transition-colors ${!user.isActive ? "opacity-60 bg-muted/10" : ""}`}>
                          <td className='px-4 py-4 text-center font-medium border-r last:border-r-0'>
                            {editingId === user.id ? (
                              <div className="space-y-1">
                                <Input
                                  placeholder="Last Name"
                                  value={editFormData.lastName}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      lastName: e.target.value,
                                    })
                                  }
                                  className='h-7 text-[14px]'
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
                                  className='h-7 text-[14px]'
                                />
                              </div>
                            ) : (
                              <div>
                                {user.lastName}, {user.firstName} {user.suffix}
                              </div>
                            )}
                          </td>
                          <td className='px-4 py-4 text-center border-r last:border-r-0'>
                            {editingId === user.id ? (
                                <div className="space-y-1">
                                    <Input
                                        placeholder="Designation"
                                        value={editFormData.designation}
                                        onChange={(e) =>
                                            setEditFormData({
                                            ...editFormData,
                                            designation: e.target.value,
                                            })
                                        }
                                        className='h-7 text-[14px]'
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
                                        className='h-7 text-[14px]'
                                    />
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    <div className="text-[14px] font-bold text-primary flex items-center justify-center gap-1">
                                        <Briefcase className="h-3 w-3" />
                                        {user.designation || "No Position Set"}
                                    </div>
                                    <div className="text-[14px] text-muted-foreground flex items-center justify-center gap-1">
                                        <IdCard className="h-3 w-3" />
                                        {user.employeeId || "No ID Set"}
                                    </div>
                                </div>
                            )}
                          </td>
                          <td className='px-4 py-4 text-center border-r last:border-r-0'>
                            {editingId === user.id ? (
                              <div className="space-y-1">
                                <Input
                                    placeholder="Email"
                                    value={editFormData.email}
                                    onChange={(e) =>
                                    setEditFormData({
                                        ...editFormData,
                                        email: e.target.value,
                                    })
                                    }
                                    className='h-7 text-[14px]'
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
                                    className='h-7 text-[14px]'
                                />
                              </div>
                            ) : (
                              <div className='space-y-0.5'>
                                <div className='text-[14px] font-medium'>{user.email}</div>
                                <div className='text-[14px] text-muted-foreground flex items-center justify-center gap-1'>
                                    <Phone className="h-2.5 w-2.5" />
                                    {user.mobileNumber || "No Mobile Set"}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className='px-4 py-4 text-center border-r last:border-r-0'>
                            <div className='flex justify-center'>
                              {editingId === user.id ? (
                                <Select
                                  value={editFormData.role}
                                  onValueChange={(
                                    v: "REGISTRAR" | "SYSTEM_ADMIN",
                                  ) =>
                                    setEditFormData({
                                      ...editFormData,
                                      role: v,
                                    })
                                  }>
                                  <SelectTrigger className='h-8 w-28 text-[14px] font-bold uppercase'>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value='SYSTEM_ADMIN'>
                                      ADMIN
                                    </SelectItem>
                                    <SelectItem value='REGISTRAR'>
                                      REGISTRAR
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  variant='outline'
                                  className={`px-2 py-0.5 text-[14px] uppercase font-bold tracking-tight ${
                                    user.role === "REGISTRAR"
                                      ? "border-primary/20 bg-primary/10 text-primary"
                                      : "border-purple-200 bg-purple-50 text-purple-700"
                                  }`}>
                                  {user.role}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className='px-4 py-4 text-center border-r last:border-r-0'>
                            <div className='flex items-center justify-center gap-1.5'>
                              <div
                                className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${user.isActive ? "bg-green-500 ring-green-100" : "bg-slate-400 ring-slate-100"}`}
                              />
                              <span className='text-[14px] font-medium'>
                                {user.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>
                          <td className='px-4 py-4 text-center text-[14px] text-muted-foreground border-r last:border-r-0 hidden xl:table-cell whitespace-nowrap'>
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </td>
                          <td className='px-4 py-4 text-center'>
                            <div className='flex flex-wrap items-center justify-center gap-1.5'>
                              {editingId === user.id ? (
                                <>
                                  <Button
                                    variant='default'
                                    size='sm'
                                    className='h-7 px-2 text-[14px] gap-1 bg-primary hover:bg-primary/90'
                                    onClick={() => handleUpdate(user.id)}
                                    disabled={submitting}>
                                    <Check className='h-3 w-3' />
                                    Update
                                  </Button>
                                  <Button
                                    variant='outline'
                                    size='sm'
                                    className='h-7 px-2 text-[14px] gap-1'
                                    onClick={cancelEditing}
                                    disabled={submitting}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant='outline'
                                    size='sm'
                                    className='h-7 px-2 text-[14px] gap-1'
                                    onClick={() => startEditing(user)}>
                                    <Edit2 className='h-3 w-3' />
                                    Edit
                                  </Button>
                                  <Button
                                    variant='outline'
                                    size='sm'
                                    className='h-7 px-2 text-[14px] gap-1'
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setFormData({
                                        ...formData,
                                        password: generatePassword(),
                                        mustChangePassword: true,
                                      });
                                      setResetOpen(true);
                                    }}>
                                    <Key className='h-3 w-3 text-orange-600' />
                                    Password
                                  </Button>
                                  {user.isActive ? (
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      disabled={currentUser?.id === user.id}
                                      className='h-7 px-2 text-[14px] gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30'
                                      onClick={() => setDeactivateId(user.id)}>
                                      <UserMinus className='h-3 w-3' />
                                      Deactivate
                                    </Button>
                                  ) : (
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      className='h-7 px-2 text-[14px] gap-1 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                                      onClick={() => setReactivateId(user.id)}>
                                      <UserCheck className='h-3 w-3' />
                                      Reactivate
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='w-[95vw] max-w-2xl sm:w-full overflow-y-auto max-h-[90vh] scrollbar-thin'>
          <DialogHeader>
            <DialogTitle>Add User Account</DialogTitle>
            <DialogDescription>
              Add a new Registrar or Admin to the system.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-2'>
                <Label>First Name *</Label>
                <Input
                  placeholder='e.g. Regina'
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Middle Name</Label>
                <Input
                  placeholder='e.g. Alcantara'
                  value={formData.middleName}
                  onChange={(e) =>
                    setFormData({ ...formData, middleName: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Last Name *</Label>
                <Input
                  placeholder='e.g. Cruz'
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-2'>
                <Label>Suffix</Label>
                <Input
                  placeholder='e.g. Jr., III'
                  value={formData.suffix}
                  onChange={(e) =>
                    setFormData({ ...formData, suffix: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2 sm:col-span-2'>
                <Label className="mb-3 block">Sex *</Label>
                <RadioGroup
                  value={formData.sex}
                  onValueChange={(v: "MALE" | "FEMALE") =>
                    setFormData({ ...formData, sex: v })
                  }
                  className='flex gap-6 mt-1'>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='MALE' id='sex-male' />
                    <Label htmlFor='sex-male' className="font-medium cursor-pointer">Male</Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='FEMALE' id='sex-female' />
                    <Label htmlFor='sex-female' className="font-medium cursor-pointer">Female</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Employee ID (Optional)</Label>
                <Input
                  placeholder='e.g. 1234567'
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Position / Designation</Label>
                <Input
                  placeholder='e.g. Registrar I'
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                />
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Email Address *</Label>
                <Input
                  type='email'
                  placeholder='registrar@school.edu.ph'
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label>Mobile Number *</Label>
                <Input
                  placeholder='e.g. 09123456789'
                  value={formData.mobileNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, mobileNumber: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-[14px] text-muted-foreground italic -mt-2">
                Official email and mobile number are required for account recovery.
            </p>

            <div className='space-y-2'>
              <Label>Role *</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(v: "REGISTRAR" | "SYSTEM_ADMIN") =>
                  setFormData({ ...formData, role: v })
                }
                className='flex flex-row gap-4'>
                <div 
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-all relative flex-1 ${
                    formData.role === 'SYSTEM_ADMIN' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-border'
                  }`}
                  onClick={() => setFormData({ ...formData, role: 'SYSTEM_ADMIN' })}
                >
                  <RadioGroupItem
                    value='SYSTEM_ADMIN'
                    id='role-admin'
                  />
                  <Label
                    htmlFor='role-admin'
                    className={`flex flex-col gap-0.5 cursor-pointer flex-1 ${
                      formData.role === 'SYSTEM_ADMIN' ? 'text-primary' : ''
                    }`}>
                    <span className='font-bold text-[14px]'>
                      Admin
                    </span>
                    <span className={`text-[14px] leading-tight ${
                      formData.role === 'SYSTEM_ADMIN' ? 'text-primary/70' : 'text-muted-foreground'
                    }`}>
                      Full access & logs.
                    </span>
                  </Label>
                </div>
                <div 
                  className={`flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-all relative flex-1 ${
                    formData.role === 'REGISTRAR' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-border'
                  }`}
                  onClick={() => setFormData({ ...formData, role: 'REGISTRAR' })}
                >
                  <RadioGroupItem
                    value='REGISTRAR'
                    id='role-reg'
                  />
                  <Label
                    htmlFor='role-reg'
                    className={`flex flex-col gap-0.5 cursor-pointer flex-1 ${
                      formData.role === 'REGISTRAR' ? 'text-primary' : ''
                    }`}>
                    <span className='font-bold text-[14px]'>Registrar</span>
                    <span className={`text-[14px] leading-tight ${
                      formData.role === 'REGISTRAR' ? 'text-primary/70' : 'text-muted-foreground'
                    }`}>
                      Enrollment & sections.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className='space-y-2'>
              <Label>Temporary Password *</Label>
              <div className='flex gap-2'>
                <Input
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className=' text-[14px] sm:text-[14px]'
                />
                <Button
                  variant='outline'
                  size='icon'
                  className='shrink-0 h-9 w-9'
                  onClick={() => {
                    setIsGenerating(true);
                    setFormData({ ...formData, password: generatePassword() });
                    setTimeout(() => setIsGenerating(false), 600);
                  }}
                  title='Generate'>
                  <motion.div
                    animate={isGenerating ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <RefreshCw className='h-4 w-4' />
                  </motion.div>
                </Button>
                <Button
                  variant='outline'
                  size='icon'
                  className='shrink-0 h-9 w-9 overflow-hidden'
                  onClick={() => copyToClipboard(formData.password)}
                  title='Copy'>
                  <AnimatePresence mode='wait'>
                    {copied ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Check className='h-4 w-4 text-green-600' />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Copy className='h-4 w-4' />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>
            <div className='p-3 rounded-lg bg-primary text-primary-foreground text-[14px] leading-relaxed shadow-sm'>
              <strong className="flex items-center gap-1.5 mb-0.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Security Notice:
              </strong> 
              Users will be required to change this temporary password upon their first login for security compliance.
            </div>
          </div>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button
              variant='outline'
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className='w-full sm:w-auto'>
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
              className='w-full sm:w-auto'>
              {submitting ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className='w-[95vw] max-w-md sm:w-full overflow-y-auto max-h-[90vh]'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <ShieldAlert className='h-5 w-5 text-orange-600' />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Generate a new temporary password for {selectedUser?.lastName}, {selectedUser?.firstName}.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='p-3 rounded-lg bg-orange-50 border border-orange-100 text-[14px] text-orange-800 leading-relaxed'>
              <strong>Warning:</strong> Existing login sessions for this user
              will be invalidated. Share the new password through a secure
              offline channel.
            </div>
            <div className='space-y-2'>
              <Label>New Password *</Label>
              <div className='flex gap-2'>
                <Input
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className=' text-[14px] sm:text-[14px]'
                />
                <Button
                  variant='outline'
                  size='icon'
                  className='shrink-0 h-9 w-9'
                  onClick={() => {
                    setIsGenerating(true);
                    setFormData({ ...formData, password: generatePassword() });
                    setTimeout(() => setIsGenerating(false), 600);
                  }}
                  title='Generate'>
                  <motion.div
                    animate={isGenerating ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <RefreshCw className='h-4 w-4' />
                  </motion.div>
                </Button>
                <Button
                  variant='outline'
                  size='icon'
                  className='shrink-0 h-9 w-9 overflow-hidden'
                  onClick={() => copyToClipboard(formData.password)}
                  title='Copy'>
                  <AnimatePresence mode='wait'>
                    {copied ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Check className='h-4 w-4 text-green-600' />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Copy className='h-4 w-4' />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>
            <div className='p-3 rounded-lg bg-primary text-primary-foreground text-[14px] leading-relaxed shadow-sm'>
              <strong className="flex items-center gap-1.5 mb-0.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Security Policy:
              </strong> 
              Password change is mandatory on next login for all administrative accounts.
            </div>
          </div>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button
              variant='outline'
              onClick={() => setResetOpen(false)}
              disabled={submitting}
              className='w-full sm:w-auto'>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={submitting || !formData.password}
              className='w-full sm:w-auto'>
              {submitting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!deactivateId}
        onOpenChange={(open) => !open && setDeactivateId(null)}
        title='Deactivate Account'
        description='This user will immediately lose access to the system. All their historical data (audit logs, approvals) will be preserved.'
        confirmText='Yes, Deactivate'
        onConfirm={() =>
          deactivateId && handleToggleStatus(deactivateId, "deactivate")
        }
        loading={submitting}
        variant="warning"
      />

      <ConfirmationModal
        open={!!reactivateId}
        onOpenChange={(open) => !open && setReactivateId(null)}
        title='Reactivate Account'
        description='This user will regain access to the system with their previous role and permissions.'
        confirmText='Yes, Reactivate'
        onConfirm={() =>
          reactivateId && handleToggleStatus(reactivateId, "reactivate")
        }
        loading={submitting}
        variant="info"
      />
    </div>
  );
}
