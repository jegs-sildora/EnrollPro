import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PaletteColor {
  hsl: string;
  hex: string;
  foreground: string;
}

interface ColorScheme {
  accent_hsl: string;
  accent_foreground?: string;
  palette?: PaletteColor[];
  extracted_at: string;
}

export interface SettingsState {
  schoolName: string;
  logoUrl: string | null;
  colorScheme: ColorScheme | null;
  selectedAccentHsl: string | null;
  activeAcademicYearId: number | null;
  enrollmentPhase: 'EARLY_REGISTRATION' | 'REGULAR_ENROLLMENT' | 'CLOSED' | 'OVERRIDE';
  /** Session-level override for browsing a different AY */
  viewingAcademicYearId: number | null;
  accentForeground: string | null;
  accentMutedForeground: string | null;
  setSettings: (settings: Partial<SettingsState>) => void;
  setViewingAY: (id: number | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      schoolName: 'Hinigaran National High School',
      logoUrl: null,
      colorScheme: null,
      selectedAccentHsl: null,
      activeAcademicYearId: null,
      enrollmentPhase: 'CLOSED',
      viewingAcademicYearId: null,
      accentForeground: null,
      accentMutedForeground: null,
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setViewingAY: (id) => set({ viewingAcademicYearId: id }),
    }),
    {
      name: 'enrollpro-settings',
    }
  )
);
