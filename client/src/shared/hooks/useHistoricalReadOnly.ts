import { useSettingsStore } from "@/store/settings.slice";
import { useAuthStore } from "@/store/auth.slice";

export interface HistoricalReadOnlyState {
  /** True when viewing any school year that is not the active one */
  isHistoricalReadOnly: boolean;
  /** True when viewing an ARCHIVED school year specifically */
  isArchivedYear: boolean;
  /** Status string of the currently-viewed year (null when on active year) */
  viewingSchoolYearStatus: string | null;
  /** True when SYSTEM_ADMIN has an active historical correction token */
  hasOverride: boolean;
  /** Whether the current user is a SYSTEM_ADMIN */
  isSystemAdmin: boolean;
}

export function useHistoricalReadOnly(): HistoricalReadOnlyState {
  const {
    activeSchoolYearId,
    viewingSchoolYearId,
    viewingSchoolYearStatus,
    historicalCorrectionToken,
  } = useSettingsStore();
  const { user } = useAuthStore();

  const isHistoricalReadOnly =
    viewingSchoolYearId !== null &&
    activeSchoolYearId !== null &&
    viewingSchoolYearId !== activeSchoolYearId;

  const isArchivedYear =
    isHistoricalReadOnly && viewingSchoolYearStatus === "ARCHIVED";

  const hasOverride = isHistoricalReadOnly && !!historicalCorrectionToken;

  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";

  return {
    isHistoricalReadOnly,
    isArchivedYear,
    viewingSchoolYearStatus,
    hasOverride,
    isSystemAdmin,
  };
}
