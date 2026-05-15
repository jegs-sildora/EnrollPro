import type { Request, Response, NextFunction } from "express";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  bulkConfirmReturn,
  getJHSCompleters,
  syncBOSYQueue,
  getTLEPrograms,
} from "./bosy.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getBosyReadiness(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = parsePositiveInt(req.query.schoolYearId, 0);
    if (!schoolYearId) {
      res
        .status(400)
        .json({ message: "schoolYearId query param is required." });
      return;
    }

    // Auto-sync missing learners before returning readiness
    await syncBOSYQueue(schoolYearId, req.user!.userId);

    const data = await getBOSYReadiness(schoolYearId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function syncBosyQueueHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = parsePositiveInt(req.body.schoolYearId, 0);
    if (!schoolYearId) {
      res.status(400).json({ message: "schoolYearId is required." });
      return;
    }

    const result = await syncBOSYQueue(schoolYearId, req.user!.userId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_QUEUE_SYNCED",
      description: `Synchronized BOSY queue; created ${result.created} missing applications.`,
      subjectType: "SchoolYear",
      recordId: schoolYearId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getBosyQueue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = parsePositiveInt(req.query.schoolYearId, 0);
    if (!schoolYearId) {
      res
        .status(400)
        .json({ message: "schoolYearId query param is required." });
      return;
    }

    const status =
      typeof req.query.status === "string" && req.query.status.length > 0
        ? req.query.status
        : undefined;

    // If fetching pending confirmation, auto-sync to ensure list is complete
    if (status === "PENDING_CONFIRMATION") {
      await syncBOSYQueue(schoolYearId, req.user!.userId);
    }

    const gradeLevelId = req.query.gradeLevelId
      ? parsePositiveInt(req.query.gradeLevelId, 0) || undefined
      : undefined;
    const search =
      typeof req.query.search === "string" && req.query.search.length > 0
        ? req.query.search
        : undefined;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 1000000);

    const result = await getBOSYQueue({
      schoolYearId,
      gradeLevelId,
      status,
      search,
      page,
      limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmReturnHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "Invalid applicationId." });
      return;
    }

    const tleProgramId =
      req.body?.tleProgramId != null
        ? parsePositiveInt(req.body.tleProgramId, 0) || null
        : null;

    const result = await confirmReturn(
      applicationId,
      req.user!.userId,
      tleProgramId ?? undefined,
    );

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_RETURN_CONFIRMED",
      description: `Confirmed return for enrollment application #${applicationId}`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function bulkConfirmReturnHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationIds, schoolYearId, tleProgramMap } = req.body as {
      applicationIds: unknown;
      schoolYearId: unknown;
      tleProgramMap?: Record<number, number | null>;
    };

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      res
        .status(400)
        .json({ message: "applicationIds must be a non-empty array." });
      return;
    }
    const parsedIds = applicationIds.map((id) => parsePositiveInt(id, 0));
    if (parsedIds.some((id) => id === 0)) {
      res
        .status(400)
        .json({ message: "All applicationIds must be positive integers." });
      return;
    }

    const parsedSchoolYearId = parsePositiveInt(schoolYearId, 0);
    if (!parsedSchoolYearId) {
      res.status(400).json({ message: "schoolYearId is required." });
      return;
    }

    const result = await bulkConfirmReturn(
      parsedIds,
      parsedSchoolYearId,
      req.user!.userId,
      tleProgramMap,
    );

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_BULK_CONFIRM",
      description: `Bulk confirmed return for ${result.confirmed.length} learner(s); ${result.failed.length} failed.`,
      subjectType: "EnrollmentApplication",
      recordId: parsedSchoolYearId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getJHSCompletersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 1000000);
    const search =
      typeof req.query.search === "string" && req.query.search.length > 0
        ? req.query.search
        : undefined;
    const result = await getJHSCompleters({ page, limit, search });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTLEProgramsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = parsePositiveInt(req.query.schoolYearId, 0);
    if (!schoolYearId) {
      res
        .status(400)
        .json({ message: "schoolYearId query param is required." });
      return;
    }
    const programs = await getTLEPrograms(schoolYearId);
    res.json({ programs });
  } catch (error) {
    next(error);
  }
}
