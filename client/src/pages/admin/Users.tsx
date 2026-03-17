import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { sileo } from 'sileo';
import { useAuthStore } from '@/stores/authStore';
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
  Copy
} from 'lucide-react';
import api from '@/api/axiosInstance';
import { toastApiError } from '@/hooks/useApiToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'REGISTRAR' | 'TEACHER' | 'SYSTEM_ADMIN';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
}

interface FetchUsersParams {
  page: number;
  limit: number;
  role?: string;
  isActive?: boolean;
}

function generatePassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let retVal = "";
  
  // Ensure at least one of each required type
  retVal += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  retVal += "0123456789"[Math.floor(Math.random() * 10)];
  retVal += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];
  
  for (let i = 0; i < length - 3; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle
  return retVal.split('').sort(() => 0.5 - Math.random()).join('');
}

export default function AdminUsers() {
  const { schoolName } = useSettingsStore();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [reactivateId, setReactivateId] = useState<number | null>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'TEACHER' as 'REGISTRAR' | 'TEACHER' | 'SYSTEM_ADMIN'
  });

  // Create Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'TEACHER' as 'REGISTRAR' | 'TEACHER' | 'SYSTEM_ADMIN',
    password: '',
    mustChangePassword: true
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: FetchUsersParams = { page, limit: 20 };
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';
      
      const res = await api.get('/admin/users', { params });
      setUsers(res.data.users);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await api.post('/admin/users', formData);
      sileo.success({ title: 'Account Created', description: `${formData.name} has been added as a ${formData.role.toLowerCase()}.` });
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
      name: user.name,
      email: user.email,
      role: user.role
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id: number) => {
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${id}`, editFormData);
      sileo.success({ title: 'Account Updated', description: 'Changes saved successfully.' });
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
        mustChangePassword: formData.mustChangePassword
      });
      sileo.success({ title: 'Password Reset', description: `New password generated for ${selectedUser.name}.` });
      setResetOpen(false);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: number, action: 'deactivate' | 'reactivate') => {
    setSubmitting(true);
    try {
      await api.patch(`/admin/users/${id}/${action}`);
      sileo.success({ 
        title: action === 'deactivate' ? 'Account Deactivated' : 'Account Reactivated',
        description: `User status updated successfully.`
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
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-start gap-2 text-balance">
            <UserCog className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground text-balance">
            Provision and manage staff accounts{schoolName ? ` for ${schoolName}` : ''}
          </p>
        </div>
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              setFormData({ name: '', email: '', role: 'TEACHER', password: generatePassword(), mustChangePassword: true });
              setCreateOpen(true);
            }} 
            className="w-fit shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden max-w-full">
        <CardHeader className="pb-3 px-4 md:px-6 border-b bg-muted/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">System Users</CardTitle>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2 bg-background border rounded-md px-2 py-1">
                <Label className="text-[10px] md:text-xs font-bold uppercase opacity-60">Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-7 border-0 bg-transparent focus:ring-0 w-24 md:w-28 text-[11px] md:text-xs shadow-none p-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="SYSTEM_ADMIN">Admins</SelectItem>
                    <SelectItem value="REGISTRAR">Registrars</SelectItem>
                    <SelectItem value="TEACHER">Teachers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 bg-background border rounded-md px-2 py-1">
                <Label className="text-[10px] md:text-xs font-bold uppercase opacity-60">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 border-0 bg-transparent focus:ring-0 w-24 md:w-28 text-[11px] md:text-xs shadow-none p-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={fetchUsers}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 md:p-6">
            <div className="rounded-md border border-border bg-background overflow-hidden">
              <div className="w-full overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm border-collapse table-fixed lg:table-auto min-w-250">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-48">Name</th>
                      <th className="px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-64">Email</th>
                      <th className="px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-32">Role</th>
                      <th className="px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-32">Status</th>
                      <th className="px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] hidden xl:table-cell w-48">Last Login</th>
                      <th className="px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] hidden 2xl:table-cell w-40">Created By</th>
                      <th className="px-4 py-3.5 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-64">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={7} className="px-4 py-6"><div className="h-4 bg-muted rounded w-3/4 mx-auto"></div></td>
                        </tr>
                      ))
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground italic">
                          No users found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className={`hover:bg-muted/30 transition-colors ${!user.isActive ? 'opacity-60 bg-muted/10' : ''}`}>
                          <td className="px-4 py-4 text-center font-medium border-r last:border-r-0 max-w-37.5">
                            {editingId === user.id ? (
                              <Input 
                                value={editFormData.name} 
                                onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                className="h-8 text-xs"
                              />
                            ) : (
                              <div className="truncate">{user.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center font-mono text-xs border-r last:border-r-0 max-w-50">
                            {editingId === user.id ? (
                              <Input 
                                value={editFormData.email} 
                                onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                                className="h-8 text-[11px]"
                              />
                            ) : (
                              <div className="truncate">{user.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center border-r last:border-r-0">
                            <div className="flex justify-center">
                              {editingId === user.id ? (
                                <Select 
                                  value={editFormData.role} 
                                  onValueChange={(v: 'REGISTRAR' | 'TEACHER' | 'SYSTEM_ADMIN') => setEditFormData({ ...editFormData, role: v })}
                                >
                                  <SelectTrigger className="h-8 w-28 text-[10px] font-bold uppercase">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="SYSTEM_ADMIN">ADMIN</SelectItem>
                                    <SelectItem value="REGISTRAR">REGISTRAR</SelectItem>
                                    <SelectItem value="TEACHER">TEACHER</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-tight ${
                                  user.role === 'REGISTRAR' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                  user.role === 'TEACHER' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                  'border-purple-200 bg-purple-50 text-purple-700'
                                }`}>
                                  {user.role}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center border-r last:border-r-0">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${user.isActive ? 'bg-green-500 ring-green-100' : 'bg-slate-400 ring-slate-100'}`} />
                              <span className="text-[11px] font-medium">{user.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-xs text-muted-foreground border-r last:border-r-0 hidden xl:table-cell whitespace-nowrap">
                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td className="px-4 py-4 text-center text-xs border-r last:border-r-0 hidden 2xl:table-cell truncate max-w-30">{user.createdBy?.name || '—'}</td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {editingId === user.id ? (
                                <>
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-7 px-2 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700"
                                    onClick={() => handleUpdate(user.id)}
                                    disabled={submitting}
                                  >
                                    <Check className="h-3 w-3" />
                                    Update
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 px-2 text-[10px] gap-1"
                                    onClick={cancelEditing}
                                    disabled={submitting}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 px-2 text-[10px] gap-1"
                                    onClick={() => startEditing(user)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 px-2 text-[10px] gap-1"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setFormData({ ...formData, password: generatePassword(), mustChangePassword: true });
                                      setResetOpen(true);
                                    }}
                                  >
                                    <Key className="h-3 w-3 text-orange-600" />
                                    Password
                                  </Button>
                                  {user.isActive ? (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      disabled={currentUser?.id === user.id}
                                      className="h-7 px-2 text-[10px] gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30"
                                      onClick={() => setDeactivateId(user.id)}
                                    >
                                      <UserMinus className="h-3 w-3" />
                                      Deactivate
                                    </Button>
                                  ) : (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-7 px-2 text-[10px] gap-1 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                                      onClick={() => setReactivateId(user.id)}
                                    >
                                      <UserCheck className="h-3 w-3" />
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
        <DialogContent className="w-[95vw] max-w-lg sm:w-full overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add User Account</DialogTitle>
            <DialogDescription>Add a new Registrar or Teacher to the system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input 
                  placeholder="e.g. Cruz, Regina A." 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input 
                  type="email" 
                  placeholder="registrar@school.edu.ph" 
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <RadioGroup value={formData.role} onValueChange={(v: 'REGISTRAR' | 'TEACHER' | 'SYSTEM_ADMIN') => setFormData({ ...formData, role: v })} className="grid gap-2">
                <div className="flex items-start gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-colors relative">
                  <RadioGroupItem value="SYSTEM_ADMIN" id="role-admin" className="mt-1" />
                  <Label htmlFor="role-admin" className="flex flex-col gap-0.5 cursor-pointer flex-1">
                    <span className="font-bold text-sm">System Administrator</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Full access, audit logs, and system health.</span>
                  </Label>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-colors relative">
                  <RadioGroupItem value="REGISTRAR" id="role-reg" className="mt-1" />
                  <Label htmlFor="role-reg" className="flex flex-col gap-0.5 cursor-pointer flex-1">
                    <span className="font-bold text-sm">Registrar</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Access to enrollment and sections.</span>
                  </Label>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-2.5 hover:bg-muted/50 cursor-pointer transition-colors relative">
                  <RadioGroupItem value="TEACHER" id="role-tea" className="mt-1" />
                  <Label htmlFor="role-tea" className="flex flex-col gap-0.5 cursor-pointer flex-1">
                    <span className="font-bold text-sm">Teacher</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Read-only access to class lists.</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password *</Label>
              <div className="flex gap-2">
                <Input 
                  value={formData.password} 
                  onChange={e => setFormData({ ...formData, password: e.target.value })} 
                  className="font-mono text-xs sm:text-sm"
                />
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => setFormData({ ...formData, password: generatePassword() })} title="Generate">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => copyToClipboard(formData.password)} title="Copy">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox 
                id="must-change" 
                checked={formData.mustChangePassword} 
                onCheckedChange={(v: boolean) => setFormData({ ...formData, mustChangePassword: v })} 
              />
              <Label htmlFor="must-change" className="text-xs sm:text-sm cursor-pointer">Require password change on first login</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !formData.name || !formData.email || !formData.password} className="w-full sm:w-auto">
              {submitting ? 'Creating...' : 'Create Account'}
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
            <DialogDescription>Generate a new temporary password for {selectedUser?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-[11px] text-orange-800 leading-relaxed">
              <strong>Warning:</strong> Existing login sessions for this user will be invalidated. Share the new password through a secure offline channel.
            </div>
            <div className="space-y-2">
              <Label>New Password *</Label>
              <div className="flex gap-2">
                <Input 
                  value={formData.password} 
                  onChange={e => setFormData({ ...formData, password: e.target.value })} 
                  className="font-mono text-xs sm:text-sm"
                />
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => setFormData({ ...formData, password: generatePassword() })}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => copyToClipboard(formData.password)}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox 
                id="reset-must-change" 
                checked={formData.mustChangePassword} 
                onCheckedChange={(v: boolean) => setFormData({ ...formData, mustChangePassword: v })} 
              />
              <Label htmlFor="reset-must-change" className="text-xs sm:text-sm cursor-pointer">Require password change on next login</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={submitting} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleResetPassword} disabled={submitting || !formData.password} className="w-full sm:w-auto">
              {submitting ? 'Resetting...' : 'Reset Password'}
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
        onConfirm={() => deactivateId && handleToggleStatus(deactivateId, 'deactivate')}
        loading={submitting}
      />

      <ConfirmationModal
        open={!!reactivateId}
        onOpenChange={(open) => !open && setReactivateId(null)}
        title="Reactivate Account"
        description="This user will regain access to the system with their previous role and permissions."
        confirmText="Yes, Reactivate"
        onConfirm={() => reactivateId && handleToggleStatus(reactivateId, 'reactivate')}
        loading={submitting}
      />
    </div>
  );
}
