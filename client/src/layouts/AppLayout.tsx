import { useEffect, useState, type ReactNode } from 'react';
import type React from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { Toaster } from 'sileo';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  School,
  Settings,
  ScrollText,
  LogOut,
  BookOpen,
  ChevronsUpDown,
  Calendar,
  UserCog,
  Mail,
  Monitor,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import api from '@/api/axiosInstance';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { motion, AnimatePresence } from 'motion/react';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

interface AcademicYearItem {
  id: number;
  yearLabel: string;
  status: string;
  isActive: boolean;
}

function AYSwitcher() {
  const { activeAcademicYearId, viewingAcademicYearId, setViewingAY } = useSettingsStore();
  const [years, setYears] = useState<AcademicYearItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/academic-years').then((r) => setYears(r.data.years)).catch(() => {});
  }, []);

  const currentId = viewingAcademicYearId ?? activeAcademicYearId;
  const currentLabel = years.find((y) => y.id === currentId)?.yearLabel ?? 'No School Year Set';
  const isOverride = viewingAcademicYearId && viewingAcademicYearId !== activeAcademicYearId;

  if (years.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs font-medium"
        onClick={() => setOpen(!open)}
      >
        <Calendar className="size-3.5" />
        <span className={isOverride ? 'text-[hsl(var(--destructive))]' : ''}>{currentLabel}</span>
        <ChevronsUpDown className="size-3 opacity-50" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-45 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 shadow-md">
          {years.map((y) => (
            <button
              key={y.id}
              onClick={() => {
                setViewingAY(y.id === activeAcademicYearId ? null : y.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${
                y.id === currentId ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--accent-foreground))]'
              }`}
            >
              <span className="flex-1 text-left">{y.yearLabel}</span>
              <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${
                y.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                y.status === 'UPCOMING' ? 'bg-blue-100 text-blue-700' :
                y.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {y.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavDivider({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 mt-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] opacity-60">
        {label}
      </span>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, pathname }: { to: string; icon: React.ElementType; label: string; pathname: string }) {
  const isActive = pathname === to || pathname.startsWith(to + '/');
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link to={to}>
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { schoolName, logoUrl } = useSettingsStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isAdmin = user?.role === 'SYSTEM_ADMIN';
  const isRegistrar = user?.role === 'REGISTRAR';
  const isTeacher = user?.role === 'TEACHER';
  const pathname = location.pathname;

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <>
      <Sidebar collapsible="icon">
        {/* ── Header: School Identity ── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-[hsl(var(--sidebar-accent))]" tooltip={schoolName}>
                {logoUrl ? (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      alt="Logo"
                      className="size-8 object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                    <span className="text-xs font-bold">E</span>
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{schoolName}</span>
                  <span className="truncate text-xs text-[hsl(var(--muted-foreground))]">Enrollment System</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* ── Navigation ── */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* ── Always visible ── */}
                <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" pathname={pathname} />

                {/* ── Enrollment section (Registrar + Admin) ── */}
                {(isRegistrar || isAdmin) && (
                  <>
                    <NavDivider label="Enrollment" />
                    <NavItem to="/applications" icon={ClipboardList} label="Applications" pathname={pathname} />
                    <NavItem to="/students" icon={Users} label="Students" pathname={pathname} />
                    <NavItem to="/sections" icon={School} label="Sections" pathname={pathname} />
                  </>
                )}

                {/* ── Teacher-only ── */}
                {isTeacher && (
                  <>
                    <NavDivider label="Classes" />
                    <NavItem to="/my-sections" icon={BookOpen} label="My Sections" pathname={pathname} />
                  </>
                )}

                {/* ── System section (Admin only) ── */}
                {isAdmin && (
                  <>
                    <NavDivider label="System" />
                    <NavItem to="/admin/users" icon={UserCog} label="User Management" pathname={pathname} />
                    <NavItem to="/admin/email-logs" icon={Mail} label="Email Logs" pathname={pathname} />
                    <NavItem to="/admin/system" icon={Monitor} label="System Health" pathname={pathname} />
                    <NavItem to="/audit-logs" icon={ScrollText} label="Audit Logs" pathname={pathname} />
                    <NavItem to="/settings" icon={Settings} label="Settings" pathname={pathname} />
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer: User ── */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={user?.name ?? 'User'}
                onClick={() => setShowLogoutConfirm(true)}
                className="relative"
              >
                {/* Collapsed State: LogOut Icon only */}
                <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 opacity-0 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:scale-100 scale-75">
                  <LogOut className="size-4 text-[hsl(var(--muted-foreground))]" />
                </div>

                {/* Expanded State: Full Profile */}
                <div className="flex w-full items-center gap-2 transition-all duration-200 opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:pointer-events-none">
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] overflow-hidden">
                    <span className="text-xs font-semibold">
                      {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                    </span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{user?.name}</span>
                      {user?.role === 'SYSTEM_ADMIN' && (
                        <Badge variant="outline" className="h-4 px-1 shrink-0 text-[9px] font-bold border-purple-200 bg-purple-50 text-purple-700">
                          ADMIN
                        </Badge>
                      )}
                      {user?.role === 'REGISTRAR' && (
                        <Badge variant="outline" className="h-4 px-1 shrink-0 text-[9px] font-bold border-blue-200 bg-blue-50 text-blue-700">
                          REGISTRAR
                        </Badge>
                      )}
                      {user?.role === 'TEACHER' && (
                        <Badge variant="outline" className="h-4 px-1 shrink-0 text-[9px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700">
                          TEACHER
                        </Badge>
                      )}
                    </div>
                    <span className="truncate text-xs text-[hsl(var(--muted-foreground))]">{user?.email}</span>
                  </div>
                  <LogOut className="ml-auto size-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <ConfirmationModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        onConfirm={handleLogout}
      />
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { selectedAccentHsl, colorScheme, accentForeground } = useSettingsStore();
  const accentHsl = selectedAccentHsl ?? (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;
  const location = useLocation();

  const toastTheme = accentForeground === '0 0% 100%' ? 'light' : 'dark';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Toaster
          position="top-right"
          theme={toastTheme}
          options={accentHsl ? { fill: `hsl(${accentHsl})` } : undefined}
        />

        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4!" />
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">EnrollPro</span>
          <div className="ml-auto">
            <AYSwitcher />
          </div>
        </header>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-auto p-4 md:p-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </SidebarInset>
    </SidebarProvider>
  );
}
