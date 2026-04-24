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

  if (pathname === "/monitoring/early-registration") {
    const view = new URLSearchParams(search).get("view");
    return view === "batch"
      ? "Registration Pipelines"
      : "Basic Education Early Registration Form — Monitoring";
  }

  // Exact matches first
  const exact: Record<string, string> = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/login": "Sign In",
    "/early-registration": "Basic Education Early Registration Form",
    "/change-password": "Change Password",
    "/enrollment": "Basic Education Enrollment Form",
    "/monitoring/f2f-early-registration":
      "Walk-in Basic Education Early Registration Form",
    "/applications": "Basic Education Early Registration Form",
    "/applications/early-registration":
      "Basic Education Early Registration Form",
    "/applications/enrollment": "Enrollment",
    "/monitoring/early-registration/pipelines": "Registration Pipelines",
    "/monitoring/enrollment": "Enrollment Monitoring",
    "/students": "Learner Directory",
    "/sections": "Sections",
    "/audit-logs": "Audit Logs",
    "/settings": "Settings",
    "/teachers": "Teachers",
    "/admin/users": "User Management",
    "/admin/system": "System Health",
    "/monitoring/enrollment/requirements": "Documentary Requirements",
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
 * Format: "Page Name â€” School Name | EnrollPro"
 *         or "Page Name | EnrollPro" when school name is not yet loaded.
 *         or "EnrollPro" for unknown routes.
 */
export function usePageTitle() {
  const { pathname, search } = useLocation();
  const schoolName = useSettingsStore((s) => s.schoolName);

  useEffect(() => {
    const page = resolvePageTitle(pathname, search);

    let title: string;
    if (page) {
      title = schoolName
        ? `${page} | ${schoolName} | ${APP_NAME}`
        : `${page} | ${APP_NAME}`;
    } else {
      title = schoolName ? `${schoolName} | ${APP_NAME}` : APP_NAME;
    }

    document.title = title;
  }, [pathname, search, schoolName]);
}
