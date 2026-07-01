import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

export interface LockDetails {
  userId: number;
  userName: string;
  expiresAt: number;
}

export const activeLocks = new Map<number, LockDetails>();

const authorizeSchema = z.object({
  schoolYearId: z.number().int().positive(),
});

/** POST /api/admin/historical-correction/authorize */
export async function authorize(req: Request, res: Response): Promise<void> {
  const parsed = authorizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid request body",
    });
    return;
  }

  const { schoolYearId } = parsed.data;
  const adminUserId = (req as Request & { user?: { userId: number } }).user?.userId;
  console.log(`[HistoricalCorrectionCtrl] Authorize request. adminUserId: ${adminUserId}, schoolYearId: ${schoolYearId}`);

  if (!adminUserId) {
    res
      .status(401)
      .json({ code: "UNAUTHORIZED", message: "Not authenticated." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!user) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "User not found." });
    return;
  }

  // Check global concurrency lock
  const currentLock = activeLocks.get(schoolYearId);
  if (currentLock && currentLock.expiresAt > Date.now() && currentLock.userId !== adminUserId) {
    res.status(403).json({
      code: "CONCURRENCY_LOCK",
      message: `S.Y. ${schoolYearId} is currently undergoing active correction by ${currentLock.userName}. Records are temporarily locked.`,
      lock: currentLock,
    });
    return;
  }

  // Set or extend lock for 10 minutes
  const userName = `${user.firstName} ${user.lastName}`.trim();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  activeLocks.set(schoolYearId, {
    userId: adminUserId,
    userName,
    expiresAt,
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({
      code: "CONFIGURATION_ERROR",
      message: "Server misconfiguration.",
    });
    return;
  }

  // Short-lived token valid for 10 minutes
  const overrideToken = jwt.sign(
    { userId: adminUserId, schoolYearId, purpose: "HISTORICAL_CORRECTION" },
    jwtSecret,
    { expiresIn: "10m" },
  );

  await auditLog({
    userId: adminUserId,
    actionType: "HISTORICAL_CORRECTION_AUTHORIZED",
    description: `System admin authorized historical correction for school year ID ${schoolYearId}. Lock set for user ${userName}.`,
    req,
  });

  res.json({ overrideToken, expiresAt });
}

/** POST /api/admin/historical-correction/relock */
export async function relock(req: Request, res: Response): Promise<void> {
  const { schoolYearId } = req.body;
  if (!schoolYearId) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "schoolYearId is required.",
    });
    return;
  }

  const syId = Number(schoolYearId);
  activeLocks.delete(syId);

  const adminUserId = (req as Request & { user?: { userId: number } }).user?.userId;
  if (adminUserId) {
    await auditLog({
      userId: adminUserId,
      actionType: "HISTORICAL_CORRECTION_RELOCKED",
      description: `Historical records for school year ID ${syId} have been manually relocked.`,
      req,
    });
  }

  res.json({ success: true });
}
