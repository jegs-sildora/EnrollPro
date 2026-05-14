import { useSettingsStore } from "@/store/settings.slice";

export interface SchoolYearContext {
  /** Resolved school year ID: viewing override, or active fallback */
  ayId: number | null;
  /** Resolved school year label: viewing override, or active fallback */
  ayLabel: string | null;
  /** Status string of the resolved SY (null when using active year) */
  viewingStatus: string | null;
  /** True when viewingSchoolYearId is set to a different year than activeSchoolYearId */
  isViewingOverride: boolean;
}

/**
 * Returns the effective school year context for the current session.
 * Use `ayId` and `ayLabel` instead of manually computing
 * `viewingSchoolYearId ?? activeSchoolYearId` in every page.
 */
export function useSchoolYearContext(): SchoolYearContext {
  const {
    activeSchoolYearId,
    activeSchoolYearLabel,
    viewingSchoolYearId,
    viewingSchoolYearLabel,
    viewingSchoolYearStatus,
  } = useSettingsStore();

  const isViewingOverride =
    viewingSchoolYearId !== null && viewingSchoolYearId !== activeSchoolYearId;

  return {
    ayId: viewingSchoolYearId ?? activeSchoolYearId,
    ayLabel: viewingSchoolYearLabel ?? activeSchoolYearLabel,
    viewingStatus: viewingSchoolYearStatus,
    isViewingOverride,
  };
}
