import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/store/settings.slice';

export interface ScpStep {
	id: number;
	stepOrder: number;
	kind: string;
	label: string;
	isRequired: boolean;
	cutoffScore: number | null;
}

export interface ScpConfig {
	id: number;
	scpType: string;
	isOffered: boolean;
	isTwoPhase: boolean;
	cutoffScore: number | null;
	notes: string | null;
	steps: ScpStep[];
}

export function useScpConfigs() {
	const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
	const ayId = viewingSchoolYearId ?? activeSchoolYearId;

	const [configs, setConfigs] = useState<ScpConfig[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchConfigs = useCallback(async () => {
		if (!ayId) return;

		setLoading(true);
		setError(null);

		try {
			setConfigs([]);
		} catch (err: unknown) {
			setError('Failed to load SCP configs');
		} finally {
			setLoading(false);
		}
	}, [ayId]);

	useEffect(() => {
		fetchConfigs();
	}, [fetchConfigs]);

	return { configs, loading, error };
}
