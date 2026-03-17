import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Loader2, Lock, Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react';
import { sileo } from 'sileo';
import api from '@/api/axiosInstance';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const schema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function ChangePassword() {
  const { user, token, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });
  const newPassword = useWatch({ control, name: 'newPassword', defaultValue: '' });
  const confirmPassword = useWatch({ control, name: 'confirmPassword', defaultValue: '' });

  const rules = [
    { label: 'Minimum 8 characters', pass: newPassword.length >= 8 },
    { label: 'At least one uppercase letter', pass: /[A-Z]/.test(newPassword) },
    { label: 'At least one number', pass: /[0-9]/.test(newPassword) },
    { label: 'At least one special character', pass: /[^A-Za-z0-9]/.test(newPassword) },
    { label: 'Passwords match', pass: newPassword.length > 0 && newPassword === confirmPassword },
  ];
  const newPasswordInvalid = newPassword.length > 0 && rules.slice(0, 4).some(r => !r.pass);
  const confirmPasswordInvalid = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // If no token, redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If password change is NOT required, redirect to dashboard
  if (!user.mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.patch('/auth/change-password', {
        newPassword: data.newPassword
      });
      
      // Update auth store with new token and updated user object
      setAuth(res.data.token, res.data.user);
      
      sileo.success({ 
        title: 'Password Updated', 
        description: 'Your new password has been set. You can now access the system.' 
      });
      
      navigate('/dashboard');
    } catch (err: unknown) {
      sileo.error({ 
        title: 'Update Failed', 
        description: (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not update password. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-xl shadow-lg border-t-4 border-t-[hsl(var(--primary))]">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--primary))]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Secure Your Account</CardTitle>
          <CardDescription>
            For your security, you are required to change your temporary password before continuing.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••••••"
                  className={`pl-10 pr-10 ${newPasswordInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••••••"
                  className={`pl-10 ${confirmPasswordInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register('confirmPassword')}
                />
              </div>

            </div>

            <div className="rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
              <p className="font-bold mb-2 uppercase opacity-70 text-muted-foreground">Password Requirements:</p>
              <ul className="space-y-1">
                {rules.map((r) => (
                  <li key={r.label} className={`flex items-center gap-2 transition-colors ${r.pass ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {r.pass
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      : <Circle className="h-3.5 w-3.5 shrink-0" />}
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Security...
                </>
              ) : (
                'Update Password & Continue'
              )}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full text-xs h-8"
              onClick={() => { clearAuth(); navigate('/login'); }}
            >
              Sign out and try later
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
