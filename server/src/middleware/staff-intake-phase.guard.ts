import type { NextFunction, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { isStaffIntakeAllowed } from "../features/settings/enrollment-gate.service.js"

export async function staffIntakePhaseGuard(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const setting = await prisma.schoolSetting.findFirst({
    select: { systemPhase: true },
  })

  if (!isStaffIntakeAllowed(setting?.systemPhase)) {
    res.status(403).json({
      code: "EOSY_INTAKE_LOCKED",
      message:
        "Learner intake and class placement are locked during EOSY Closing.",
    })
    return
  }

  next()
}
