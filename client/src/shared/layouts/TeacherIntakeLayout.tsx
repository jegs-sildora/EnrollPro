import { useState } from "react";
import { useNavigate, Link, Outlet, useLocation } from "react-router";
import { AnimatePresence } from "motion/react";
import { ChevronDown, LogOut, Settings, School } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { cn, formatUserRole, getRoleColorClasses } from "@/shared/lib/utils";
import { useAuthStore } from "@/store/auth.slice";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { PageTransition } from "@/shared/components/PageTransition";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

// ── Minimal user nav (no sidebar context needed) ──────────────────────────────

function TeacherUserNav() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network/logout failures and clear local session regardless.
    }
    clearAuth();
    navigate("/staff/login");
  };

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-fit gap-2 px-2.5 rounded-xl border border-border/45 hover:border-border/80 bg-card/60 hover:bg-card transition-all shadow-xs hover:shadow-sm"
          >
            <Avatar className="h-7 w-7 border shadow-sm">
              <AvatarFallback className="text-sm font-extrabold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-col items-start text-left leading-tight hidden lg:flex">
              <span className="text-sm font-extrabold truncate max-w-[120px]">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="flex justify-start">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-sm font-extrabold uppercase px-1 h-3.5 border-none",
                    getRoleColorClasses(user?.roles?.[0]),
                  )}
                >
                  {formatUserRole(user?.roles?.[0])}
                </Badge>
              </div>
            </div>
            <ChevronDown className="size-3 opacity-50 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56"
          align="end"
          forceMount
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-base font-extrabold leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm leading-none text-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-extrabold text-sm"
            asChild
          >
            <Link to="/change-password">
              <Settings className="mr-2 h-4 w-4" />
              Change Password
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-extrabold text-sm text-destructive focus:text-primary-foreground"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        onConfirm={handleLogout}
        variant="primary"
      />
    </>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TeacherIntakeLayout() {
  const { schoolName, logoUrl } = useSettingsStore();
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}${location.hash}:${location.key}`;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Slim top bar — no sidebar, no SY switcher */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-4 sticky top-0 z-40 backdrop-blur-md bg-background/80">
        {/* School identity */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {logoUrl ? (
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden border bg-muted p-0.5 shrink-0">
              <img
                src={`${API_BASE}${logoUrl}`}
                alt="School Logo"
                className="size-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <School className="size-4 text-primary" />
            </div>
          )}
          {schoolName && (
            <span className="font-extrabold text-base uppercase text-primary truncate leading-tight">
              {schoolName}
            </span>
          )}
        </div>

        {/* User nav (right) */}
        <TeacherUserNav />
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-6 scrollbar-thin">
        <AnimatePresence mode="wait">
          <PageTransition key={routeKey} className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
