import type { Request, Response, NextFunction } from "express"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../lib/AppError.js"
import { getSchoolYearRolloverReadiness } from "../school-year/services/school-year-rollover.service.js"
import { resolveActiveSchoolYearState } from "../school-year/services/active-school-year.service.js"
import {
  clearSystemDateOverride,
  getSystemDateOverride,
  setSystemDateOverride,
} from "../../lib/date-wrapper.js"

export async function updateSystemDateOverride(req: Request, res: Response): Promise<void> {
  const value = typeof req.body === "object" && req.body !== null
    ? (req.body as Record<string, unknown>).mockedDate
    : null

  if (typeof value !== "string") {
    throw new AppError(400, "mockedDate must be an ISO date-time string.")
  }

  const mockedDate = new Date(value)
  if (Number.isNaN(mockedDate.getTime())) {
    throw new AppError(400, "mockedDate must be a valid ISO date-time string.")
  }

  const anchor = Date.now()

  const setting = await prisma.schoolSetting.findFirst()
  if (setting) {
    await prisma.schoolSetting.update({
      where: { id: setting.id },
      data: {
        mockedSystemDate: mockedDate,
        mockedSystemDateAnchor: BigInt(anchor),
      },
    })
  }

  setSystemDateOverride(mockedDate, anchor)
  res.json({ mockedDate: getSystemDateOverride()?.toISOString() ?? null })
}

export async function toggleTimeMachineEnabled(req: Request, res: Response): Promise<void> {
  const enabled = typeof req.body === 'object' && req.body !== null ? Boolean((req.body as Record<string, unknown>).enabled) : false;

  const setting = await prisma.schoolSetting.findFirst();
  if (setting) {
    await prisma.schoolSetting.update({
      where: { id: setting.id },
      data: {
        isTimeMachineEnabled: enabled,
        ...(enabled ? {} : { mockedSystemDate: null, mockedSystemDateAnchor: null }),
      },
    });
  }
  if (!enabled) clearSystemDateOverride();
  res.json({ enabled });
}

export async function resetSystemDateOverride(_req: Request, res: Response): Promise<void> {
  const setting = await prisma.schoolSetting.findFirst()
  if (setting) {
    await prisma.schoolSetting.update({
      where: { id: setting.id },
      data: {
        mockedSystemDate: null,
        mockedSystemDateAnchor: null,
      },
    })
  }

  clearSystemDateOverride()
  res.status(204).send()
}

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
    const activeResolution = await resolveActiveSchoolYearState()
    if (activeResolution.state !== "VALID") {
      throw new AppError(
        409,
        activeResolution.state === "INVALID"
          ? activeResolution.message
          : "No active school year has been initialized.",
      )
    }
    const schoolSetting = await prisma.schoolSetting.findUniqueOrThrow({
      where: { id: activeResolution.active.settingId },
      select: { systemPhase: true },
    })

    const isEosyPhase = schoolSetting.systemPhase === "EOSY_CLOSING"

    const readiness = await getSchoolYearRolloverReadiness(
      activeResolution.active.schoolYearId,
    )
    res.json({
      isEosyPhase,
      ...readiness,
    })
  } catch (error: unknown) {
    next(error)
  }
}

