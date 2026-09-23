import type { Request } from "express"
import { prisma } from "../../lib/prisma.js"

const gradeCoordinatorRoleToOrder = {
  "GRADE 7 COORDINATOR": 7,
  "GRADE 8 COORDINATOR": 8,
  "GRADE 9 COORDINATOR": 9,
  "GRADE 10 COORDINATOR": 10,
} as const

const unrestrictedSectionManagementRoles = new Set([
  "SYSTEM_ADMIN",
  "HEAD_REGISTRAR",
])

export function isGradeLevelCoordinator(req: Request): boolean {
  if ((req.user?.roles ?? []).includes("GRADE_LEVEL_COORDINATOR")) return true

  const ancillaryRoles = req.user?.ancillaryRoles ?? []
  return Object.keys(gradeCoordinatorRoleToOrder).some((role) =>
    ancillaryRoles.includes(role),
  )
}

export async function getGradeCoordinatorGradeLevelIds(
  req: Request,
): Promise<number[]> {
  const ancillaryRoles = req.user?.ancillaryRoles ?? []
  const displayOrders = Object.entries(gradeCoordinatorRoleToOrder)
    .filter(([role]) => ancillaryRoles.includes(role))
    .map(([, displayOrder]) => displayOrder)

  if (displayOrders.length === 0) return []

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { displayOrder: { in: displayOrders } },
    select: { id: true },
  })
  return gradeLevels.map((gradeLevel) => gradeLevel.id)
}

export async function getSectionManagementGradeScope(
  req: Request,
): Promise<number[] | null> {
  const roles = req.user?.roles ?? []
  if (roles.some((role) => unrestrictedSectionManagementRoles.has(role))) {
    return null
  }
  return getGradeCoordinatorGradeLevelIds(req)
}

export function isGradeLevelWithinScope(
  scopedGradeLevelIds: number[] | null,
  gradeLevelId: number,
): boolean {
  return scopedGradeLevelIds === null || scopedGradeLevelIds.includes(gradeLevelId)
}
