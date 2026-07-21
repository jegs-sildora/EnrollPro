import { Link, useLocation } from "react-router";
import { cn } from "@/shared/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter
} from "@/shared/ui/sidebar";
import { useAuthStore } from "@/store/auth.slice";
import { LogOut } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useNavigate } from "react-router";

// Reuse the NavBrand component logic or define it here
function NavBrand({
  schoolName,
  logoUrl,
  workspaceName,
}: {
  schoolName?: string | null;
  logoUrl?: string | null;
  workspaceName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${schoolName || "School"} Logo`}
          className="size-8 rounded shadow-sm object-contain bg-muted"
        />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 shadow-sm ring-1 ring-primary/20">
          <span className="text-sm font-extrabold text-primary">EP</span>
        </div>
      )}
      <div className="flex flex-col text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="font-extrabold tracking-tight text-foreground line-clamp-1">
          {schoolName || "EnrollPro"}
        </span>
        {workspaceName && (
          <span className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground line-clamp-1">
            {workspaceName}
          </span>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({
  groups,
  schoolName,
  logoUrl,
  workspaceName,
}: {
  groups: any[];
  schoolName?: string | null;
  logoUrl?: string | null;
  workspaceName?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    clearAuth();
    navigate("/staff/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <NavBrand schoolName={schoolName} logoUrl={logoUrl} workspaceName={workspaceName} />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sm font-extrabold uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item: any) => {
                  const isActive =
                    item.to === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link to={item.to}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 group-data-[collapsible=icon]:justify-center">
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
