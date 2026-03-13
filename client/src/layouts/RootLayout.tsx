import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import api from '@/api/axiosInstance';

const DEFAULT_ACCENT_HSL = '221 83% 53%';

/** Relative luminance from HSL values */
function luminanceFromHSL(h: number, s: number, l: number): number {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(f(0)) + 0.7152 * toLinear(f(8)) + 0.0722 * toLinear(f(4));
}

/** Relative luminance from HSL string like "221 83% 53%" */
function relativeLuminance(hsl: string): number {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return 0.5; // fallback
  return luminanceFromHSL(
    parseInt(parts[0]) || 0,
    parseInt(parts[1].replace('%', '')) || 0,
    parseInt(parts[2].replace('%', '')) || 0
  );
}

function contrastForeground(hsl: string): string {
  const lum = relativeLuminance(hsl);
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? '0 0% 100%' : '0 0% 0%';
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const { colorScheme, selectedAccentHsl, setSettings } = useSettingsStore();

  // Fetch public settings on mount
  useEffect(() => {
    api
      .get('/settings/public')
      .then((res) => {
        setSettings({
          schoolName: res.data.schoolName,
          logoUrl: res.data.logoUrl,
          colorScheme: res.data.colorScheme,
          selectedAccentHsl: res.data.selectedAccentHsl,
          activeAcademicYearId: res.data.activeAcademicYearId,
          enrollmentPhase: res.data.enrollmentPhase,
        });
      })
      .catch(() => {});
  }, [setSettings]);

  // Apply accent colors with WCAG contrast — use useLayoutEffect to prevent flash
  useLayoutEffect(() => {
    const root = document.documentElement;
    const accent = selectedAccentHsl
      ?? (colorScheme as { accent_hsl?: string } | null)?.accent_hsl
      ?? DEFAULT_ACCENT_HSL;

    const parts = accent.trim().split(/\s+/);
    const fg = contrastForeground(accent);
    const mutedAccent = parts.length >= 2 ? `${parts[0]} ${parts[1]} 94%` : accent;
    const mutedFg = contrastForeground(mutedAccent);

    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-foreground', fg);
    root.style.setProperty('--accent-ring', accent);
    root.style.setProperty('--primary', accent);
    root.style.setProperty('--primary-foreground', fg);
    root.style.setProperty('--ring', accent);

    root.style.setProperty('--sidebar-primary', accent);
    root.style.setProperty('--sidebar-primary-foreground', fg);
    root.style.setProperty('--sidebar-ring', accent);
    root.style.setProperty('--sidebar-accent', mutedAccent);
    root.style.setProperty('--sidebar-accent-foreground', mutedFg);

    // Update store with calculated foregrounds for toast use
    // Note: setSettings might trigger a re-render, but useLayoutEffect ensures
    // the DOM properties are set before the paint.
    setSettings({
      accentForeground: fg,
      accentMutedForeground: mutedFg
    });

    // Background stays white always
    root.style.setProperty('--background', '0 0% 100%');
    root.style.setProperty('--card', '0 0% 100%');
  }, [colorScheme, selectedAccentHsl, setSettings]);

  return <>{children}</>;
}
