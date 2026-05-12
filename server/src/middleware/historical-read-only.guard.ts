import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CONTEXT_SCHOOL_YEAR_HEADER = "x-school-year-context-id";
const CORRECTION_TOKEN_HEADER = "x-historical-correction-token";
const HISTORICAL_READ_ONLY_CODE = "SY_ARCHIVED_LOCKED";

function parsePositiveIntHeaderValue(
  value: string | string[] | undefined,
): number | null | "invalid" {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === undefined || normalized === "") {
    return null;
  }

  const parsed = Number.parseInt(String(normalized), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "invalid";
  }

  return parsed;
}

async function resolveActiveSchoolYearId(): Promise<number | null> {
  const schoolSetting = await prisma.schoolSetting.findFirst({
    select: { activeSchoolYearId: true },
  });

  if (schoolSetting?.activeSchoolYearId) {
    return schoolSetting.activeSchoolYearId;
  }

  const activeSchoolYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return activeSchoolYear?.id ?? null;
}

export async function historicalReadOnlyGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 1. NEVER block GET or non-mutation requests
  if (!MUTATION_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Keep auth/session-related actions (e.g., logout) available at all times.
  if (req.path.startsWith("/api/auth")) {
    return next();
  }

  const hasBearerToken = req.headers.authorization?.startsWith("Bearer ");
  if (!hasBearerToken) {
    return next();
  }

  const contextSchoolYearId = parsePositiveIntHeaderValue(
    req.headers[CONTEXT_SCHOOL_YEAR_HEADER],
  );

  if (contextSchoolYearId === "invalid") {
    const rawValue = req.headers[CONTEXT_SCHOOL_YEAR_HEADER];
    console.warn(
      `[Guard] 400 Bad Request: Invalid ${CONTEXT_SCHOOL_YEAR_HEADER} value: "${rawValue}"`,
    );
    res.status(400).json({
      code: "INVALID_SCHOOL_YEAR_CONTEXT",
      message: `${CONTEXT_SCHOOL_YEAR_HEADER} must be a positive integer when provided`,
    });
    return;
  }

  // If no school-year browsing context is provided, preserve existing behavior.
  if (!contextSchoolYearId) {
    next();
    return;
  }

  const activeSchoolYearId = await resolveActiveSchoolYearId();

  if (!activeSchoolYearId) {
    next();
    return;
  }

  if (contextSchoolYearId !== activeSchoolYearId) {
    // Check for a valid historical correction override token
    const correctionToken = req.headers[CORRECTION_TOKEN_HEADER];
    if (correctionToken && typeof correctionToken === "string") {
      try {
        const payload = jwt.verify(
          correctionToken,
          process.env.JWT_SECRET!,
        ) as {
          purpose?: string;
          schoolYearId?: number;
        };
        if (
          payload.purpose === "HISTORICAL_CORRECTION" &&
          payload.schoolYearId === contextSchoolYearId
        ) {
          return next();
        }
      } catch {
        res.status(403).json({
          code: "CORRECTION_TOKEN_INVALID",
          message: "Historical correction token is invalid or expired.",
        });
        return;
      }
    }

    res.status(403).json({
      code: HISTORICAL_READ_ONLY_CODE,
      message: "This school year is archived and cannot be modified.",
      contextSchoolYearId,
      activeSchoolYearId,
    });
    return;
  }

  next();
}
