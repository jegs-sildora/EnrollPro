import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  activeSchoolYearId: number | null;
  activeSchoolYearLabel: string | null;
  activeSchoolYearStatus: string | null;
  depedSchoolId: string | null;
  classOpeningDate: string | null;
  classEndDate: string | null;
  enrollOpenDate: string | null;
  enrollCloseDate: string | null;
  facebookPageUrl: string | null;
  depedEmail: string | null;
  schoolWebsite: string | null;
  region: string | null;
  division: string | null;
  schoolHeadName: string | null;
  schoolHeadTitle: string | null;
  steEnabled: boolean;
  spaEnabled: boolean;
  spsEnabled: boolean;
  enableHomogeneousSections: boolean;
  homogeneousSectionCount: number;
  heterogeneousRoundRobin: boolean;
  isBosyEnrollmentOpen: boolean;
  enrollmentPhase:
    | "EARLY_REGISTRATION"
    | "REGULAR_ENROLLMENT"
    | "CLOSED"
    | "OVERRIDE"
    | "BOSY_LOCKED";
  systemPhase: "PRE_REGISTRATION" | "OFFICIAL_ENROLLMENT" | "CLASSES_ONGOING" | "EOSY_CLOSING" | null;
  systemStatus:
    | "DRAFT"
    | "UPCOMING"
    | "PREPARATION"
    | "ENROLLMENT_OPEN"
    | "BOSY_LOCKED"
    | "EOSY_PROCESSING"
    | "ACTIVE"
    | "ARCHIVED";
  globalDefaultPassword: string;
  bosyLockedAt: string | null;
  /** Session-level override for browsing a different SY */
  viewingSchoolYearId: number | null;
  /** Status of the currently-viewed SY (e.g. 'ARCHIVED', 'ACTIVE') */
  viewingSchoolYearStatus: string | null;
  /** Label of the currently-viewed SY (e.g. '2024-2025') */
  viewingSchoolYearLabel: string | null;
  /** Short-lived JWT allowing SYSTEM_ADMIN historical corrections — NOT persisted */
  historicalCorrectionToken: string | null;
  accentForeground: string | null;
  accentMutedForeground: string | null;
  fontSize: number; // 100 by default (percentage)
  isHydrated: boolean;
  initialized: boolean;
  setSettings: (settings: Partial<SettingsState>) => void;
  setViewingSY: (
    id: number | null,
    status?: string | null,
    label?: string | null,
  ) => void;
  setHistoricalCorrectionToken: (token: string | null) => void;
  setFontSize: (size: number) => void;
  setHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      schoolName: "",
      logoUrl: null,
      colorScheme: null,
      selectedAccentHsl: null,
      activeSchoolYearId: null,
      activeSchoolYearLabel: null,
      activeSchoolYearStatus: null,
      depedSchoolId: null,
      classOpeningDate: null,
      classEndDate: null,
      enrollOpenDate: null,
      enrollCloseDate: null,
      facebookPageUrl: null,
      depedEmail: null,
      schoolWebsite: null,
      region: null,
      division: null,
      schoolHeadName: null,
      schoolHeadTitle: null,
      steEnabled: false,
      spaEnabled: false,
      spsEnabled: false,
      enableHomogeneousSections: true,
      homogeneousSectionCount: 5,
      heterogeneousRoundRobin: true,
      isBosyEnrollmentOpen: false,
      enrollmentPhase: "CLOSED",
      systemPhase: null,
      systemStatus: "DRAFT",
      bosyLockedAt: null,
      globalDefaultPassword: "DepEd2026!",
      viewingSchoolYearId: null,
      viewingSchoolYearStatus: null,
      viewingSchoolYearLabel: null,
      historicalCorrectionToken: null,
      accentForeground: null,
      accentMutedForeground: null,
      fontSize: 100, // percentage
      isHydrated: false,
      initialized: false,
      setSettings: (settings) =>
        set((state) => ({ ...state, ...settings, initialized: true })),
      setViewingSY: (id, status, label) =>
        set({
          viewingSchoolYearId: id,
          viewingSchoolYearStatus: status ?? null,
          viewingSchoolYearLabel: label ?? null,
        }),
      setHistoricalCorrectionToken: (token) =>
        set({ historicalCorrectionToken: token }),
      setFontSize: (size) => set({ fontSize: size }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "enrollpro-settings",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
      // historicalCorrectionToken is ephemeral — never persist across page loads
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { historicalCorrectionToken, ...rest } = state;
        return rest;
      },
    },
  ),
);
