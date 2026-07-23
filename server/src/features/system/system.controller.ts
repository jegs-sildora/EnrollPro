import type { Request, Response, NextFunction } from "express"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../lib/AppError.js"
import { getSchoolYearRolloverReadiness } from "../school-year/services/school-year-rollover.service.js"

export async function getPublicConfig(
  _req: Request,
  res: Response,
): Promise<void> {
  const setting = await prisma.schoolSetting.findFirst({
    include: { activeSchoolYear: true },
  })

  if (!setting) {
    res.json({
      schoolName: "EnrollPro",
      schoolAcronym: "EP",
      logoUrl: null,
      depedSchoolId: null,
      region: null,
      division: null,
      globalDefaultPassword: "DepEd2026!",
    })
    return
  }

  const schoolName = setting.schoolName || "EnrollPro"
  const acronym =
    schoolName
      .replace(/\b(?:de|del|dela|of|the|and|ng|mga|at)\b/gi, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4) || "EP"

  res.json({
    schoolName,
    schoolAcronym: acronym,
    logoUrl: setting.logoUrl,
    depedSchoolId: setting.depedSchoolId,
    region: setting.region,
    division: setting.division,
    globalDefaultPassword: setting.globalDefaultPassword,
  })
}

export async function getRolloverReadiness(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolSetting = await prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true, systemPhase: true },
    })

    if (!schoolSetting?.activeSchoolYearId) {
      throw new AppError(400, "No active school year found.")
    }

    const isEosyPhase = schoolSetting.systemPhase === "EOSY_CLOSING"
    const calendarPolicyId =
      typeof req.query.calendarPolicyId === "string"
        ? Number.parseInt(req.query.calendarPolicyId, 10)
        : undefined

    const readiness = await getSchoolYearRolloverReadiness(
      schoolSetting.activeSchoolYearId,
      Number.isInteger(calendarPolicyId) ? calendarPolicyId : undefined,
    )
    res.json({
      isEosyPhase,
      ...readiness,
    })
  } catch (error: unknown) {
    next(error)
  }
}
