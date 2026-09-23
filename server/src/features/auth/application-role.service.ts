import type { Role } from "@enrollpro/shared"

export const GRADE_LEVEL_COORDINATOR_EMPLOYEE_IDS = [
  "1234506",
  "1234507",
  "1234508",
  "1234509",
] as const

const gradeLevelCoordinatorIds = new Set<string>(
  GRADE_LEVEL_COORDINATOR_EMPLOYEE_IDS,
)

export function normalizeApplicationRoles(roles: readonly Role[]): Role[] {
  return [...new Set(roles)]
}

export function mergeRequiredSchedulerRoles(
  employeeId: string,
  currentRoles: readonly Role[],
): Role[] {
  const roles = normalizeApplicationRoles(currentRoles)
  if (!gradeLevelCoordinatorIds.has(employeeId)) return roles

  return normalizeApplicationRoles([
    ...roles,
    "TEACHER",
    "GRADE_LEVEL_COORDINATOR",
  ])
}
