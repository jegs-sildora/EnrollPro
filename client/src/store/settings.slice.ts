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
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	earlyRegOpenDate: string | null;
	earlyRegCloseDate: string | null;
	classOpeningDate: string | null;
	classEndDate: string | null;
	enrollOpenDate: string | null;
	enrollCloseDate: string | null;
	facebookPageUrl: string | null;
	depedEmail: string | null;
	schoolWebsite: string | null;
	enrollmentPhase:
		| 'EARLY_REGISTRATION'
		| 'REGULAR_ENROLLMENT'
		| 'CLOSED'
		| 'OVERRIDE'
		| 'BOSY_LOCKED';
	systemStatus:
		| 'DRAFT'
		| 'UPCOMING'
		| 'PREPARATION'
		| 'ENROLLMENT_OPEN'
		| 'BOSY_LOCKED'
		| 'EOSY_PROCESSING'
		| 'ACTIVE'
		| 'ARCHIVED';
	bosyLockedAt: string | null;
	/** Session-level override for browsing a different SY */
	viewingSchoolYearId: number | null;
	accentForeground: string | null;
	accentMutedForeground: string | null;
	fontSize: number; // 100 by default (percentage)
	isHydrated: boolean;
	initialized: boolean;
	setSettings: (settings: Partial<SettingsState>) => void;
	setViewingSY: (id: number | null) => void;
	setFontSize: (size: number) => void;
	setHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			schoolName: '',
			logoUrl: null,
			colorScheme: null,
			selectedAccentHsl: null,
			activeSchoolYearId: null,
			activeSchoolYearLabel: null,
			earlyRegOpenDate: null,
			earlyRegCloseDate: null,
			classOpeningDate: null,
			classEndDate: null,
			enrollOpenDate: null,
			enrollCloseDate: null,
			facebookPageUrl: null,
			depedEmail: null,
			schoolWebsite: null,
			enrollmentPhase: 'CLOSED',
			systemStatus: 'DRAFT',
			bosyLockedAt: null,
			viewingSchoolYearId: null,
			accentForeground: null,
			accentMutedForeground: null,
			fontSize: 100, // percentage
			isHydrated: false,
			initialized: false,
			setSettings: (settings) => set((state) => ({ ...state, ...settings, initialized: true })),
			setViewingSY: (id) => set({ viewingSchoolYearId: id }),
			setFontSize: (size) => set({ fontSize: size }),
			setHydrated: () => set({ isHydrated: true }),
		}),
		{
			name: 'enrollpro-settings',
			onRehydrateStorage: () => (state) => {
				state?.setHydrated();
			},
		},
	),
);
