import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

const authorizeSchema = z.object({
  password: z.string().min(1),
  schoolYearId: z.number().int().positive(),
  reason: z.string().min(20, "Reason must be at least 20 characters"),
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

  const { password, schoolYearId, reason } = parsed.data;
  const adminUserId = (req as Request & { user?: { id: number } }).user?.id;

  if (!adminUserId) {
    res
      .status(401)
      .json({ code: "UNAUTHORIZED", message: "Not authenticated." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { id: true, password: true },
  });

  if (!user) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "User not found." });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({
      code: "INVALID_PASSWORD",
      message: "Password is incorrect.",
    });
    return;
  }

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
    description: `System admin authorized historical correction for school year ID ${schoolYearId}. Reason: ${reason}`,
    req,
  });

  res.json({ overrideToken });
}
