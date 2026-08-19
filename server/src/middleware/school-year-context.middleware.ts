import type { NextFunction, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { resolveActiveSchoolYearState } from "../features/school-year/services/active-school-year.service.js"

const CONTEXT_SCHOOL_YEAR_HEADER = "x-school-year-context-id"

declare global {
  namespace Express {
    interface Request {
      schoolYearId?: number
      activeSchoolYearId?: number
    }
  }
}

function parseContextHeader(value: string | string[] | undefined): number | null | "INVALID" {
  const normalized = Array.isArray(value) ? value[0] : value
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : "INVALID"
}

export async function schoolYearContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestedId = parseContextHeader(req.headers[CONTEXT_SCHOOL_YEAR_HEADER])
  if (requestedId === "INVALID") {
    res.status(400).json({
      code: "INVALID_SCHOOL_YEAR_CONTEXT",
      message: `${CONTEXT_SCHOOL_YEAR_HEADER} must be a positive integer when provided.`,
    })
    return
  }

  const resolution = await resolveActiveSchoolYearState()
  if (resolution.state === "INVALID") {
    res.status(409).json({ code: resolution.code, message: resolution.message })
    return
  }

  if (resolution.state === "UNINITIALIZED") {
    if (requestedId !== null) {
      res.status(404).json({
        code: "SCHOOL_YEAR_NOT_FOUND",
        message: "No school year has been initialized.",
      })
      return
    }
    next()
    return
  }

  req.activeSchoolYearId = resolution.active.schoolYearId
  if (requestedId !== null) {
    const requestedYear = await prisma.schoolYear.findUnique({
      where: { id: requestedId },
      select: { id: true },
    })
    if (!requestedYear) {
      res.status(404).json({
        code: "SCHOOL_YEAR_NOT_FOUND",
        message: "The requested school year does not exist.",
      })
      return
    }
    req.schoolYearId = requestedId
  } else {
    req.schoolYearId = resolution.active.schoolYearId
  }

  next()
}
