import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const CONTEXT_SCHOOL_YEAR_HEADER = "x-school-year-context-id";

declare global {
  namespace Express {
    interface Request {
      schoolYearId?: number;
    }
  }
}

export async function schoolYearContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 1. Try to get ID from header
  const headerValue = req.headers[CONTEXT_SCHOOL_YEAR_HEADER];
  const normalized = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  
  if (normalized) {
    const parsed = Number.parseInt(normalized, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      req.schoolYearId = parsed;
      return next();
    }
  }

  // 2. Fallback to SchoolSetting.activeSchoolYearId
  const settings = await prisma.schoolSetting.findFirst({
    select: { activeSchoolYearId: true },
  });

  if (settings?.activeSchoolYearId) {
    req.schoolYearId = settings.activeSchoolYearId;
    return next();
  }

  // 3. Last resort: Find any ACTIVE school year
  const activeSy = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { id: "desc" },
    select: { id: true },
  });

  if (activeSy) {
    req.schoolYearId = activeSy.id;
  }

  next();
}
