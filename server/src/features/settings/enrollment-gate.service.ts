import type { SchoolYear } from '../../generated/prisma/index.js';

/**
 * Normalizes a Date object to a YYYY-MM-DD string in Manila timezone
 */
function toManilaDateString(date: Date): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Manila',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
}

export function isEnrollmentOpen(year: SchoolYear): boolean {
	if (year.isManualOverrideOpen) return true;

	const now = new Date();
	const todayStr = toManilaDateString(now);

	const inPhase1 =
		year.earlyRegOpenDate &&
		year.earlyRegCloseDate &&
		todayStr >= toManilaDateString(year.earlyRegOpenDate) &&
		todayStr <= toManilaDateString(year.earlyRegCloseDate);

	const inPhase2 =
		year.enrollOpenDate &&
		year.enrollCloseDate &&
		todayStr >= toManilaDateString(year.enrollOpenDate) &&
		todayStr <= toManilaDateString(year.enrollCloseDate);

	return Boolean(inPhase1 || inPhase2);
}

export function getEnrollmentPhase(
	year: SchoolYear,
): 'EARLY_REGISTRATION' | 'REGULAR_ENROLLMENT' | 'CLOSED' | 'OVERRIDE' {
	if (year.isManualOverrideOpen) return 'OVERRIDE';

	const now = new Date();
	const todayStr = toManilaDateString(now);

	if (
		year.earlyRegOpenDate &&
		year.earlyRegCloseDate &&
		todayStr >= toManilaDateString(year.earlyRegOpenDate) &&
		todayStr <= toManilaDateString(year.earlyRegCloseDate)
	) {
		return 'EARLY_REGISTRATION';
	}

	if (
		year.enrollOpenDate &&
		year.enrollCloseDate &&
		todayStr >= toManilaDateString(year.enrollOpenDate) &&
		todayStr <= toManilaDateString(year.enrollCloseDate)
	) {
		return 'REGULAR_ENROLLMENT';
	}

	return 'CLOSED';
}
