import { useEffect } from "react";
import { useLocation } from "react-router";
import { useSettingsStore } from "@/store/settings.slice";

const APP_NAME = "EnrollPro";

/**
 * Maps a pathname to a human-readable page title.
 * Returns null for paths that should use the bare app name (e.g. root redirect).
 */
function resolvePageTitle(pathname: string, search: string): string | null {
  if (pathname === "/settings") {
    const tab = new URLSearchParams(search).get("tab");
    if (tab === "requirements") {
      return "Enrollment Requirements";
    }
  }

  // Exact matches first
  const exact: Record<string, string> = {
    "/": "Master Dashboard",
    "/dashboard": "Master Dashboard",
    "/login": "Sign In",
    "/change-password": "Change Password",
    "/enrollment": "Basic Education Enrollment Form",
    "/applications/enrollment": "Enrollment",
    "/continuing-learners": "Confirmation of Continuing Learners",
    "/monitoring/enrollment": "Sectioning & SF1 Prep",
    "/monitoring/enrollment/walk-in": "Late Enrollee Form",
    "/eosy": "EOSY Grade Finalization",
    "/students": "Learner Registry",
    "/sections": "Class Sections (SF1)",
    "/sections/homerooms": "Class Sections (SF1)",
    "/audit-logs": "Activity Logs",
    "/settings": "System Configuration",
    "/teachers": "Faculty & Staff",
    "/admin/users": "Account Access",
    "/admin/system": "System Health",
    "/admin/integration": "Integrated Systems",
    "/monitoring/enrollment/requirements": "Documentary Requirements",
    "/teacher/eosy": "EOSY Updating",
    "/teacher/advisory": "My Advisory Class",
  };

  if (exact[pathname]) return exact[pathname];

  // Prefix matches for dynamic segments
  if (pathname.startsWith("/students/")) return "Learner Profile";
  if (pathname.startsWith("/teachers/")) return "Teacher Profile";
  if (pathname.startsWith("/applications/")) return "Application Detail";
  if (pathname.startsWith("/settings/")) return "Settings";
  if (pathname.startsWith("/admin/")) return "Administration";

  return null;
}

/**
 * Reactively updates document.title on every route change.
 * Format: "Page Name — School Name | EnrollPro"
 *         or "Page Name | EnrollPro" when school name is not yet loaded.
 *         or "EnrollPro" for unknown routes.
 */
export function usePageTitle(customTitle?: string) {
  const { pathname, search } = useLocation();
  const schoolName = useSettingsStore((s) => s.schoolName);

  useEffect(() => {
    const page = customTitle ?? resolvePageTitle(pathname, search);

    let title: string;
    if (page) {
      title = schoolName
        ? `${page} | ${schoolName} | ${APP_NAME}`
        : `${page} | ${APP_NAME}`;
    } else {
      title = schoolName ? `${schoolName} | ${APP_NAME}` : APP_NAME;
    }

    document.title = title;
  }, [pathname, search, schoolName, customTitle]);
}
