import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useSettingsStore } from '@/store/settings.slice';

const APP_NAME = 'EnrollPro';

/**
 * Maps a pathname to a human-readable page title.
 * Returns null for paths that should use the bare app name (e.g. root redirect).
 */
function resolvePageTitle(pathname: string): string | null {
	// Exact matches first
	const exact: Record<string, string> = {
		'/': 'Dashboard',
		'/dashboard': 'Dashboard',
		'/login': 'Sign In',
		'/early-registration': 'BASIC EDUCATION EARLY REGISTRATION FORM',
		'/change-password': 'Change Password',
		'/enrollment': 'BASIC EDUCATION EARLY REGISTRATION FORM',
		'/monitoring/f2f-early-registration': 'Walk-in BASIC EDUCATION EARLY REGISTRATION FORM',
		'/applications': 'BASIC EDUCATION EARLY REGISTRATION FORM',
		'/applications/early-registration': 'BASIC EDUCATION EARLY REGISTRATION FORM',
		'/applications/enrollment': 'Enrollment',
		'/monitoring/early-registration': 'BASIC EDUCATION EARLY REGISTRATION FORM — Monitoring',
		'/monitoring/early-registration/pipelines': 'Registration Pipelines',
		'/monitoring/enrollment': 'Enrollment Monitoring',
		'/students': 'Students',
		'/sections': 'Sections',
		'/audit-logs': 'Audit Logs',
		'/settings': 'Settings',
		'/teachers': 'Teachers',
		'/admin/users': 'User Management',
		'/admin/email-logs': 'Email Logs',
		'/admin/system': 'System Health',
		'/monitoring/enrollment/requirements': 'Documentary Requirements',
	};

	if (exact[pathname]) return exact[pathname];

	// Prefix matches for dynamic segments
	if (pathname.startsWith('/students/')) return 'Student Profile';
	if (pathname.startsWith('/teachers/')) return 'Teacher Profile';
	if (pathname.startsWith('/applications/')) return 'Application Detail';
	if (pathname.startsWith('/settings/')) return 'Settings';
	if (pathname.startsWith('/admin/')) return 'Administration';

	return null;
}

/**
 * Reactively updates document.title on every route change.
 * Format: "Page Name â€” School Name | EnrollPro"
 *         or "Page Name | EnrollPro" when school name is not yet loaded.
 *         or "EnrollPro" for unknown routes.
 */
export function usePageTitle() {
	const { pathname } = useLocation();
	const schoolName = useSettingsStore((s) => s.schoolName);

	useEffect(() => {
		const page = resolvePageTitle(pathname);

		let title: string;
		if (page) {
			title = schoolName
				? `${page} | ${schoolName} | ${APP_NAME}`
				: `${page} | ${APP_NAME}`;
		} else {
			title = schoolName ? `${schoolName} | ${APP_NAME}` : APP_NAME;
		}

		document.title = title;
	}, [pathname, schoolName]);
}
