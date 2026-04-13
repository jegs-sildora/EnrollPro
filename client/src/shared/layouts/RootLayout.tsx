import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { Outlet } from "react-router";
import { useSettingsStore, type PaletteColor } from "@/store/settings.slice";
import { usePageTitle } from "@/shared/hooks/usePageTitle";
import api from "@/shared/api/axiosInstance";

const DEFAULT_ACCENT_HSL = "221 83% 53%";
const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

/** Relative luminance from HSL values */
function luminanceFromHSL(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * toLinear(f(0)) + 0.7152 * toLinear(f(8)) + 0.0722 * toLinear(f(4))
  );
}

/** Relative luminance from HSL string like "221 83% 53%" */
function relativeLuminance(hsl: string): number {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return 0.5; // fallback
  return luminanceFromHSL(
    parseInt(parts[0]) || 0,
    parseInt(parts[1].replace("%", "")) || 0,
    parseInt(parts[2].replace("%", "")) || 0,
  );
}

function contrastForeground(hsl: string): string {
  const lum = relativeLuminance(hsl);
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "0 0% 100%" : "0 0% 0%";
}

export default function RootLayout({ children }: { children?: ReactNode }) {
  const { colorScheme, selectedAccentHsl, logoUrl, setSettings } =
    useSettingsStore();

  // Dynamically update document.title on every route change
  usePageTitle();

  // Fetch public settings on mount
  useEffect(() => {
    api
      .get("/settings/public")
      .then((res) => {
        setSettings({
          schoolName: res.data.schoolName,
          logoUrl: res.data.logoUrl,
          colorScheme: res.data.colorScheme,
          selectedAccentHsl: res.data.selectedAccentHsl,
          activeSchoolYearId: res.data.activeSchoolYearId,
          activeSchoolYearLabel: res.data.activeSchoolYearLabel,
          enrollmentPhase: res.data.enrollmentPhase,
        });
      })
      .catch(() => {});
  }, [setSettings]);

  // Update favicon dynamically based on logoUrl
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      if (logoUrl) {
        link.href = `${API_BASE}${logoUrl}`;
      } else {
        link.href = "/vite.svg";
      }
    }
  }, [logoUrl]);

  // Apply accent colors with WCAG contrast — use useLayoutEffect to prevent flash
  useLayoutEffect(() => {
    const root = document.documentElement;
    const accent =
      selectedAccentHsl ??
      (colorScheme as { accent_hsl?: string } | null)?.accent_hsl ??
      DEFAULT_ACCENT_HSL;

    const parts = accent.trim().split(/\s+/);
    const fg = contrastForeground(accent);
    const mutedAccent =
      parts.length >= 2 ? `${parts[0]} ${parts[1]} 94%` : accent;
    const mutedFg = contrastForeground(mutedAccent);

    // Special logic for #fefe01 (yellow) accent
    // #fefe01 is approximately HSL: 60 99% 50%
    const h = parseInt(parts[0]) || 0;
    const s = parseInt(parts[1]?.replace("%", "")) || 0;
    const l = parseInt(parts[2]?.replace("%", "")) || 0;

    // Robust check: matches exact hex from palette OR HSL range
    const currentHex = (
      colorScheme?.palette as PaletteColor[] | undefined
    )?.find((p) => p.hsl === accent)?.hex;
    const isFefe01 =
      currentHex?.toLowerCase() === "#fefe01" ||
      (h === 60 && s >= 98 && s <= 100 && l >= 48 && l <= 52);

    const primaryColor = isFefe01 ? "200 68% 9%" : accent; // 200 68% 9% is #061E29
    const primaryFg = isFefe01 ? "0 0% 100%" : fg;
    const ringColor = isFefe01 ? "200 68% 9%" : accent;

    // High-contrast version of the accent for links on white background
    // If accent is too light (meaning its contrast foreground is black), we set the link color to black
    let linkAccent = accent;
    if (fg === "0 0% 0%") {
      linkAccent = "0 0% 0%";
    }

    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", fg);
    root.style.setProperty("--accent-link", linkAccent);
    root.style.setProperty("--accent-ring", ringColor);
    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty("--primary-foreground", primaryFg);
    root.style.setProperty("--ring", ringColor);

    root.style.setProperty("--sidebar-primary", primaryColor);
    root.style.setProperty("--sidebar-primary-foreground", primaryFg);
    root.style.setProperty("--sidebar-ring", ringColor);
    root.style.setProperty("--sidebar-accent", mutedAccent);
    root.style.setProperty("--sidebar-accent-foreground", mutedFg);

    // Update store with calculated foregrounds for toast use
    // Note: setSettings might trigger a re-render, but useLayoutEffect ensures
    // the DOM properties are set before the paint.
    setSettings({
      accentForeground: fg,
      accentMutedForeground: mutedFg,
    });

    // Background stays white always
    root.style.setProperty("--background", "0 0% 96%");
    root.style.setProperty("--card", "0 0% 100%");
  }, [colorScheme, selectedAccentHsl, setSettings]);

  return children ? <>{children}</> : <Outlet />;
}
