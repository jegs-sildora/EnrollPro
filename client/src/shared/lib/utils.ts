import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MANILA_TIME_ZONE = "Asia/Manila";

export const SCP_LABELS: Record<string, string> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology & Engineering",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "Special Program in Foreign Language",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
    "Special Program in Tech-Voc Education",
  REGULAR: "Regular",
  LATE_ENROLLEE: "Late Enrollee",
};

export const SCP_ACRONYMS: Record<string, string> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
  REGULAR: "Regular",
  LATE_ENROLLEE: "Late",
};

/**
 * Formats a date string or object to a human-readable format in Manila timezone.
 */
export function formatManilaDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
) {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", {
    ...options,
    timeZone: MANILA_TIME_ZONE,
  }).format(d);
}

/**
 * Returns the current date/time adjusted to Manila timezone.
 */
export function getManilaNow(): Date {
  // Return a date object that represents "Now" in Manila
  // Note: Date objects are always UTC internally, but this ensures
  // we're thinking about Manila when we perform operations.
  return new Date();
}

/**
 * Maps SCP enum tokens to their full official DepEd names.
 */
export function formatScpType(scpType: string | null | undefined): string {
  if (!scpType) return "N/A";
  return SCP_LABELS[scpType] || scpType;
}

/**
 * Formats a stored time string into 12-hour time with AM/PM for UI display.
 * Supports "HH:mm", "HH:mm:ss", and "h:mm AM/PM" variants.
 */
export function formatDisplayTime12Hour(
  time: string | null | undefined,
): string {
  if (!time) return "";

  const trimmed = time.trim();

  const twelveHourMatch = trimmed.match(
    /^([0-9]{1,2}):([0-9]{2})\s*([AaPp][Mm])$/,
  );
  if (twelveHourMatch) {
    const rawHour = Number(twelveHourMatch[1]);
    const minute = twelveHourMatch[2];
    const period = twelveHourMatch[3].toUpperCase();

    if (Number.isNaN(rawHour) || rawHour < 1 || rawHour > 12) return trimmed;
    return `${rawHour}:${minute} ${period}`;
  }

  const twentyFourHourMatch = trimmed.match(
    /^([0-9]{1,2}):([0-9]{2})(?::[0-9]{2})?$/,
  );
  if (!twentyFourHourMatch) return trimmed;

  let hour = Number(twentyFourHourMatch[1]);
  const minute = twentyFourHourMatch[2];

  if (Number.isNaN(hour) || hour < 0 || hour > 23) return trimmed;

  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minute} ${period}`;
}

/**
 * Recursively converts all string values in an object to uppercase and trims them.
 * Useful for ensuring uniform data entry in the database.
 * Skips specific keys that should remain case-sensitive (e.g., base64 strings, emails).
 */
export function toUpperCaseRecursive<T>(obj: T): T {
  const skipKeys = [
    "studentPhoto",
    "contactNumber",
    "password",
    "email",
    "emailAddress",
  ];

  if (Array.isArray(obj)) {
    return obj.map((v) => toUpperCaseRecursive(v)) as unknown as T;
  } else if (
    obj !== null &&
    typeof obj === "object" &&
    !(obj instanceof Date)
  ) {
    const newObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (skipKeys.includes(key)) {
        newObj[key] = (obj as Record<string, unknown>)[key];
      } else {
        newObj[key] = toUpperCaseRecursive(
          (obj as Record<string, unknown>)[key],
        );
      }
    }
    return newObj as T;
  } else if (typeof obj === "string") {
    return obj.trim().toUpperCase() as unknown as T;
  }
  return obj;
}

/**
 * Checks if all mandatory documents for a specific learner type are met based on the checklist.
 */
export function isMandatoryDocumentsMet(
  learnerType: string | null | undefined,
  checklist: Record<string, unknown> | null | undefined,
): boolean {
  if (!checklist || !learnerType) return false;

  const requirements = [
    {
      key: "isPsaBirthCertPresented",
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "isSf9Submitted",
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "isConfirmationSlipReceived",
      isMandatory: learnerType === "CONTINUING",
    },
    {
      key: "isUndertakingSigned",
      isMandatory: learnerType === "TRANSFEREE",
    },
  ];

  return requirements
    .filter((r) => r.isMandatory)
    .every((r) => !!checklist[r.key]);
}

/**
 * Maps learner type enum tokens to human-readable DepEd category labels.
 */
export function getLearnerTypeLabel(type: string | null | undefined): string {
  if (!type) return "Regular";
  switch (type) {
    case "NEW_ENROLLEE":
      return "New Enrollee";
    case "TRANSFEREE":
      return "Transferee";
    case "RETURNING":
      return "Balik-Aral";
    case "CONTINUING":
      return "Continuing";
    case "OSCYA":
      return "OSCYA";
    default:
      return type.replaceAll("_", " ");
  }
}

/**
 * Formats a user role enum token by replacing underscores with spaces.
 */
export function formatUserRole(role: string | null | undefined): string {
  if (!role) return "N/A";
  if (role === "HEAD_REGISTRAR") return "Head Registrar";
  if (role === "CLASS_ADVISER") return "Class Adviser";
  if (role === "MRF") return "MRF Staff";
  return role.replaceAll("_", " ");
}

/**
 * Returns DepEd-aligned Tailwind CSS color classes for RBAC badges.
 * Aligned with official DepEd visual identity guidelines.
 */
export function getRoleColorClasses(role: string | null | undefined): string {
  if (!role) return "bg-slate-100 text-slate-600 border-slate-200";

  switch (role) {
    case "SYSTEM_ADMIN":
      return "bg-slate-800 text-white border-slate-900";
    case "HEAD_REGISTRAR":
    case "REGISTRAR":
      return "bg-red-800 text-white border-red-900";
    case "CLASS_ADVISER":
      return "bg-emerald-600 text-white border-emerald-700";
    case "TEACHER":
      return "bg-blue-600 text-white border-blue-700";
    case "MRF":
      return "bg-teal-600 text-white border-teal-700";
    case "LEARNER":
      return "bg-amber-500 text-slate-900 border-amber-600";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

/**
 * Returns DepEd-aligned Tailwind CSS classes for Plantilla (Permanent Rank) badges.
 * Level 1: Foundational (Muted, professional colors)
 */
export function getPlantillaColorClasses(
  position: string | null | undefined,
): string {
  if (!position) return "bg-slate-50 text-slate-600 border-slate-200";

  const p = position.toUpperCase();

  if (p.includes("PRINCIPAL") || p.includes("HEAD TEACHER")) {
    return "bg-slate-800 text-white border-slate-900";
  }
  if (p.includes("MASTER TEACHER")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }
  if (p.includes("TEACHER")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

/**
 * Returns DepEd-aligned Tailwind CSS classes for Academic Designation (Functional Role) badges.
 * Level 2: Actionable (Strong, primary RBAC colors)
 */
export function getAcademicDesignationColorClasses(
  designation: string | null | undefined,
): string {
  if (!designation) return "bg-slate-100 text-slate-600 border-slate-200";

  const d = designation.toUpperCase();

  if (d.includes("CLASS ADVISER")) {
    return "bg-emerald-600 text-white border-emerald-700 shadow-sm";
  }
  if (d.includes("DEPARTMENT HEAD")) {
    return "bg-amber-500 text-slate-900 border-amber-600 shadow-sm font-extrabold";
  }
  if (d.includes("SUBJECT TEACHER")) {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
}

/**
 * Returns DepEd-aligned Tailwind CSS classes for Core Enrollment Statuses.
 * Level 1: Master Directory (Permanent states)
 */
export function getLearnerStatusColorClasses(
  status: string | null | undefined,
): string {
  if (!status) return "bg-slate-100 text-slate-600 border-slate-300";

  const s = status.toUpperCase();

  switch (s) {
    case "ACTIVE":
      return "bg-emerald-600 text-white font-extrabold shadow-sm border-none";
    case "JHS_COMPLETER":
      return "bg-primary text-primary-foreground font-extrabold shadow-sm border-none";
    case "DROPPED":
      return "bg-red-800 text-white font-extrabold shadow-sm border-none";
    case "TRANSFERRED_OUT":
      return "bg-slate-100 text-slate-600 border-slate-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

/**
 * Returns DepEd-aligned Tailwind CSS classes for Application & Admission Statuses.
 * Uses a Semantic Intensity Model (Muted for pipeline, Solid for terminal).
 */
export function getApplicationStatusColorClasses(
  status: string | null | undefined,
): string {
  if (!status) return "bg-slate-50 text-slate-500 border-slate-200";

  const s = status.toUpperCase();

  // 1. Pipeline / Transitional (Muted Blues/Indigos)
  if (
    s === "SUBMITTED" ||
    s === "EARLY_REG_SUBMITTED" ||
    s === "SUBMITTED_BEERF" ||
    s === "SUBMITTED_BEEF" ||
    s === "PRE_REGISTERED"
  ) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (
    s === "UNDER_REVIEW" ||
    s === "ELIGIBLE" ||
    s === "IN_PROGRESS" ||
    s === "PENDING_VERIFICATION" ||
    s === "AWAITING_VERIFICATION" ||
    s === "VERIFIED" ||
    s === "PENDING_BEEF"
  ) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }

  // 2. Progression (Soft Greens/Teals/Purples)
  if (
    s === "ASSESSMENT_TAKEN" ||
    s === "PASSED" ||
    s === "QUALIFIED" ||
    s === "READY_FOR_SECTIONING" ||
    s === "READY_FOR_ENROLLMENT"
  ) {
    return "bg-teal-50 text-teal-700 border-teal-200";
  }
  if (s === "EXAM_SCHEDULED" || s === "INTERVIEW_SCHEDULED") {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }

  // 3. Warning State (High-Visibility Amber)
  if (s === "TEMPORARILY_ENROLLED" || s === "PENDING_VERIFICATION") {
    return "bg-amber-100 text-amber-800 border-amber-400 font-extrabold";
  }

  // 4. The Finish Line (Solid DepEd Royal Blue)
  if (s === "ENROLLED" || s === "OFFICIALLY_ENROLLED") {
    return "bg-blue-600 text-white font-extrabold shadow-sm border-none";
  }

  // 5. Specialized / Edge Cases
  if (s === "DRAFT") {
    return "bg-gray-50 text-gray-500 border border-gray-200 border-dashed";
  }
  if (s === "FOR_REVISION") {
    return "bg-orange-50 text-orange-700 border-orange-300";
  }
  if (
    s === "REJECTED" ||
    s === "WITHDRAWN" ||
    s === "FAILED" ||
    s === "FAILED_ASSESSMENT" ||
    s === "NOT_QUALIFIED"
  ) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (s === "LINKED") {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }
  if (s === "DROPPED_OUT") {
    return "bg-red-100 text-red-700 border-red-300 font-extrabold";
  }
  if (s === "NO_LONGER_PARTICIPATING") {
    return "bg-amber-100 text-amber-800 border-amber-400 font-extrabold";
  }
  if (
    s === "TRANSFERRING_OUT" ||
    s === "TRANSFERRED_OUT" ||
    s === "DROPPED" ||
    s === "TRANSFERRED"
  ) {
    return "bg-slate-200 text-slate-700 border-slate-300 font-extrabold";
  }

  return "bg-slate-50 text-slate-500 border-slate-200";
}

/**
 * Returns DepEd-aligned Tailwind CSS classes for Ancillary Role (Special Assignment) badges.
 * Level 3: Lightweight Tags (Outlined or pastel to prevent UI clutter)
 */
export function getAncillaryRoleColorClasses(
  role: string | null | undefined,
): string {
  if (!role) return "bg-slate-50 text-slate-500 border-slate-200";

  const r = role.toUpperCase();

  // Tech & Data Domain
  if (r.includes("LIS") || r.includes("ICT")) {
    return "bg-cyan-50 text-cyan-800 border-cyan-100";
  }

  // Health & Safety Domain
  if (
    r.includes("CLINIC") ||
    r.includes("HEALTH") ||
    r.includes("SDRRM") ||
    r.includes("FEEDING")
  ) {
    return "bg-rose-50 text-rose-800 border-rose-100";
  }

  // Student Affairs Domain
  if (
    r.includes("GUIDANCE") ||
    r.includes("SSLG") ||
    r.includes("SPA") ||
    r.includes("SPORTS") ||
    r.includes("GPP") ||
    r.includes("BSP") ||
    r.includes("GSP")
  ) {
    return "bg-violet-50 text-violet-800 border-violet-100";
  }

  // Administrative / Leadership
  if (r.includes("TIC") || r.includes("OIC") || r.includes("CUSTODIAN")) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return "bg-slate-50 text-slate-500 border-slate-100";
}

/**
 * Returns standardized image URL from local path or base64.
 */
export function getImageUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  if (photo.startsWith("data:") || photo.startsWith("http")) return photo;

  // Standardize backend origin detection
  let apiUrl = import.meta.env.VITE_API_URL || "";

  if (!apiUrl || apiUrl === "/api") {
    // Fallback for relative proxy or missing env in development
    // Assuming backend is on port 5002 if not specified
    apiUrl = window.location.origin.replace(/:\d+$/, ":5002") + "/api";
  }

  const origin = apiUrl.replace(/\/api$/, "");
  // Ensure we don't double slash
  const cleanPhoto = photo.startsWith("/") ? photo : `/${photo}`;
  return `${origin}${cleanPhoto}`;
}

/**
 * Formats application status tokens into human-readable labels.
 */
export function formatApplicationStatus(
  status: string | null | undefined,
): string {
  if (!status) return "N/A";
  const s = status.toUpperCase();

  if (s === "PRE_REGISTERED") return "Pre-registered";
  if (s === "UNDER_REVIEW") return "Under Review";
  if (s === "FOR_REVISION") return "For Revision";
  if (s === "ASSESSMENT_TAKEN") return "Assessment Taken";
  if (s === "TEMPORARILY_ENROLLED") return "Temporarily Enrolled";
  if (s === "OFFICIALLY_ENROLLED") return "Officially Enrolled";
  if (s === "SUBMITTED_BEERF") return "Submitted (BEERF)";
  if (s === "SUBMITTED_BEEF") return "Submitted (BEEF)";
  if (s === "PENDING_BEEF") return "Pending BEEF";
  if (s === "EARLY_REG_SUBMITTED") return "Early Reg Submitted";
  if (s === "READY_FOR_SECTIONING") return "Ready for Sectioning";
  if (s === "READY_FOR_ENROLLMENT") return "Ready for Enrollment";
  if (s === "TRANSFERRING_OUT") return "Transferring Out";
  if (s === "TRANSFERRED_OUT") return "Transferred Out";
  if (s === "DROPPED_OUT") return "Dropped Out";
  if (s === "NO_LONGER_PARTICIPATING") return "NLP";

  return s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Formats EOSY status tokens into human-readable labels.
 */
export function formatEosyStatus(status: string | null | undefined): string {
  if (!status) return "N/A";
  const s = status.toUpperCase();

  switch (s) {
    case "PROMOTED":
      return "Promoted";
    case "RETAINED":
      return "Retained";
    case "IRREGULAR":
      return "Conditionally Promoted";
    case "CONDITIONALLY_PROMOTED":
      return "Conditionally Promoted";
    case "TRANSFERRED_OUT":
      return "Transferred Out";
    case "DROPPED_OUT":
      return "Dropped Out";
    default:
      return s
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
  }
}

