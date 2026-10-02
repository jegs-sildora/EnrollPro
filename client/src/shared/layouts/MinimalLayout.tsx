import { Outlet } from "react-router";
import { useSettingsStore } from "@/store/settings.slice";
import AdmissionHeader from "@/features/admission/components/AdmissionHeader";

export default function MinimalLayout({ children }: { children?: React.ReactNode }) {
  const { schoolName, logoUrl } = useSettingsStore();

  return (
    <div className="min-h-screen flex flex-col bg-muted/10 font-sans">
      <AdmissionHeader
        logoUrl={logoUrl}
        schoolName={schoolName || "EnrollPro"}
        title="School Management System"
      />
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: "hsl(var(--sidebar-background)/0.5)",
          }}>
          {/* Pixel grid */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.08]"
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="pixel-grid"
                x="0"
                y="0"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse">
                <rect
                  x="2"
                  y="2"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
                <rect
                  x="42"
                  y="2"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
                <rect
                  x="2"
                  y="42"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
                <rect
                  x="42"
                  y="42"
                  width="36"
                  height="36"
                  rx="2"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="url(#pixel-grid)"
            />
          </svg>
          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)",
            }}
          />
        </div>
        <div className="z-10 w-full flex items-center justify-center">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
