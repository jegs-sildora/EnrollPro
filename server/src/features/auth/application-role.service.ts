import type { Role } from "@enrollpro/shared"

export function normalizeApplicationRoles(roles: readonly Role[]): Role[] {
  return [...new Set(roles)]
}

export function mergeRequiredSchedulerRoles(
  employeeId: string,
  currentRoles: readonly Role[],
): Role[] {
  return normalizeApplicationRoles(currentRoles)
}
