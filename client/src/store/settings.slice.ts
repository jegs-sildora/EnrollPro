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
    | "OVERRIDE";
  systemPhase: "PRE_REGISTRATION" | "BOSY_ENROLLMENT" | "OFFICIAL_ENROLLMENT" | "CLASSES_ONGOING" | "EOSY_CLOSING" | null;
  systemStatus:
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
  historicalCorrectionExpiresAt: number | null;
  accentForeground: string | null;
  accentMutedForeground: string | null;
  fontSize: number; // 100 by default (percentage)
  activeCorrection: { userId: number; userName: string; expiresAt: number; } | null;
  isHydrated: boolean;
  initialized: boolean;
  isSwitchingSchoolYear: boolean;
  switchingToSchoolYearLabel: string | null;
  setSettings: (settings: Partial<SettingsState>) => void;
  setViewingSY: (
    id: number | null,
    status?: string | null,
    label?: string | null,
  ) => void;
  setHistoricalCorrectionToken: (token: string | null, expiresAt?: number | null) => void;
  setFontSize: (size: number) => void;
  setHydrated: () => void;
  triggerSchoolYearSwitch: (
    id: number | null,
    status?: string | null,
    label?: string | null,
  ) => void;
  triggerRolloverSwitch: (
    settings: Partial<SettingsState>,
    targetLabel: string,
  ) => void;
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
      systemStatus: "ACTIVE",
      bosyLockedAt: null,
      globalDefaultPassword: "DepEd2026!",
      viewingSchoolYearId: null,
      viewingSchoolYearStatus: null,
      viewingSchoolYearLabel: null,
      historicalCorrectionToken: null,
      historicalCorrectionExpiresAt: null,
      accentForeground: null,
      accentMutedForeground: null,
      fontSize: 100, // percentage
      isSwitchingSchoolYear: false,
      switchingToSchoolYearLabel: null,
      activeCorrection: null,
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
      setHistoricalCorrectionToken: (token, expiresAt) =>
        set({ historicalCorrectionToken: token, historicalCorrectionExpiresAt: expiresAt ?? null }),
      setFontSize: (size) => set({ fontSize: size }),
      setHydrated: () => set({ isHydrated: true }),
      triggerSchoolYearSwitch: (id, status, label) => {
        set({
          isSwitchingSchoolYear: true,
          switchingToSchoolYearLabel: label ?? "Active School Year",
        });
        
        setTimeout(async () => {
          set({
            viewingSchoolYearId: id,
            viewingSchoolYearStatus: status ?? null,
            viewingSchoolYearLabel: label ?? null,
            isSwitchingSchoolYear: false,
            switchingToSchoolYearLabel: null,
          });
          
          // Dynamically import queryClient to avoid circular dependency issues at the top level
          const { queryClient } = await import("@/shared/lib/queryClient");
          queryClient.invalidateQueries();
        }, 2000);
      },
      triggerRolloverSwitch: (settings, targetLabel) => {
        set({
          isSwitchingSchoolYear: true,
          switchingToSchoolYearLabel: targetLabel,
        });
        
        setTimeout(async () => {
          set((state) => ({
            ...state,
            ...settings,
            viewingSchoolYearId: null,
            viewingSchoolYearStatus: null,
            viewingSchoolYearLabel: null,
            isSwitchingSchoolYear: false,
            switchingToSchoolYearLabel: null,
            initialized: true,
          }));
          
          const { queryClient } = await import("@/shared/lib/queryClient");
          queryClient.invalidateQueries();
          
          window.dispatchEvent(new CustomEvent("ROLLOVER_COMPLETE"));
        }, 2000);
      },
    }),
    {
      name: "enrollpro-settings",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
      // historicalCorrectionToken is ephemeral — never persist across page loads
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          historicalCorrectionToken,
          historicalCorrectionExpiresAt,
          activeCorrection,
          isSwitchingSchoolYear,
          switchingToSchoolYearLabel,
          ...rest
        } = state;
        return rest;
      },
    },
  ),
);
