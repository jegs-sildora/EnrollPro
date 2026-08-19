import type { NextFunction, Request, Response } from "express"

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export async function historicalReadOnlyGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!MUTATION_METHODS.has(req.method.toUpperCase()) || !req.user) {
    next()
    return
  }

  if (!req.schoolYearId || !req.activeSchoolYearId) {
    next()
    return
  }

  if (req.schoolYearId !== req.activeSchoolYearId) {
    res.status(403).json({
      code: "SY_ARCHIVED_LOCKED",
      message:
        "Archived school years are read-only. Historical corrections cannot reactivate or change the active school year.",
      contextSchoolYearId: req.schoolYearId,
      activeSchoolYearId: req.activeSchoolYearId,
    })
    return
  }

  next()
}
