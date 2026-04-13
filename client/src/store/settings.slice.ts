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
	enrollmentPhase:
		| 'EARLY_REGISTRATION'
		| 'REGULAR_ENROLLMENT'
		| 'CLOSED'
		| 'OVERRIDE';
	/** Session-level override for browsing a different SY */
	viewingSchoolYearId: number | null;
	accentForeground: string | null;
	accentMutedForeground: string | null;
	fontSize: number; // 100 by default (percentage)
	setSettings: (settings: Partial<SettingsState>) => void;
	setViewingSY: (id: number | null) => void;
	setFontSize: (size: number) => void;
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
			enrollmentPhase: 'CLOSED',
			viewingSchoolYearId: null,
			accentForeground: null,
			accentMutedForeground: null,
			fontSize: 100, // percentage
			setSettings: (settings) => set((state) => ({ ...state, ...settings })),
			setViewingSY: (id) => set({ viewingSchoolYearId: id }),
			setFontSize: (size) => set({ fontSize: size }),
		}),
		{
			name: 'enrollpro-settings',
		},
	),
);
