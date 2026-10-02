import { Outlet } from "react-router";
import { useSettingsStore } from "@/store/settings.slice";
import { School } from "lucide-react";
const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export default function MinimalLayout({ children }: { children?: React.ReactNode }) {
  const { schoolName, logoUrl } = useSettingsStore();

  return (
    <div className="min-h-screen flex flex-col bg-muted/10 font-sans">
      <header className="h-16 border-b bg-background flex items-center px-4 md:px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 w-full max-w-7xl mx-auto">
          {logoUrl ? (
            <img src={`${API_BASE}${logoUrl}`} alt="Logo" className="h-10 w-10 object-contain drop-shadow-sm" />
          ) : (
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
              <School className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex flex-col overflow-hidden">
            <span className="font-extrabold text-primary truncate leading-tight uppercase text-sm sm:text-base tracking-tight">
              {schoolName || "EnrollPro"}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              School Management System
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {children || <Outlet />}
      </main>
    </div>
  );
}
