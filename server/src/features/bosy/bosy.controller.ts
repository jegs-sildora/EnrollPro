import type { Request, Response, NextFunction } from "express";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  bulkConfirmReturn,
  getJHSCompleters,
  syncBOSYQueue,
  getPhase2Queue,
  confirmScpSlot,
  verifyBeef,
  routeToScpScreening,
  markBeefPending,
  resolveAndConfirmBeef,
  revertToPendingBeef,
  downgradeToBeef,
  flushNoShows,
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

    const result = await confirmReturn(
      applicationId,
      req.user!.userId,
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
    const { applicationIds, schoolYearId } = req.body as {
      applicationIds: unknown;
      schoolYearId: unknown;
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

export async function getPhase2QueueHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = parsePositiveInt(req.query.schoolYearId, 0);
    if (!schoolYearId) {
      res.status(400).json({ message: "schoolYearId query param is required." });
      return;
    }
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 200);
    const search =
      typeof req.query.search === "string" && req.query.search.length > 0
        ? req.query.search
        : undefined;

    const rawStatus = req.query.status;
    const status = Array.isArray(rawStatus)
      ? (rawStatus as string[])
      : typeof rawStatus === "string"
        ? rawStatus.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const rawChannel = req.query.admissionChannel;
    const admissionChannel =
      rawChannel === "ONLINE" || rawChannel === "F2F" ? rawChannel : undefined;

    const result = await getPhase2Queue({
      schoolYearId,
      status: status.length > 0 ? status : ["SUBMITTED_BEEF"],
      admissionChannel,
      search,
      page,
      limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmScpSlotHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "applicationId param is required." });
      return;
    }
    const pendingDocs = Boolean(req.body.pendingDocs);
    const result = await confirmScpSlot(applicationId, req.user!.userId, pendingDocs);

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_SCP_SLOT_CONFIRMED",
      description: `Confirmed SCP slot for application #${applicationId} → ${result.status}.`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyBeefHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "applicationId param is required." });
      return;
    }
    const result = await verifyBeef(applicationId, req.user!.userId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_BEEF_VERIFIED",
      description: `BEEF verified for application #${applicationId} → READY_FOR_SECTIONING.`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function routeToScpScreeningHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "applicationId param is required." });
      return;
    }
    const result = await routeToScpScreening(applicationId, req.user!.userId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_WALK_IN_ROUTED_SCP",
      description: `Walk-in BEEF application #${applicationId} routed to SCP screening → UNDER_REVIEW.`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function markBeefPendingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "applicationId param is required." });
      return;
    }
    const result = await markBeefPending(applicationId, req.user!.userId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_BEEF_MARKED_PENDING",
      description: `BEEF application #${applicationId} marked pending (docs missing) → PENDING_BEEF.`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resolveBeefHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "applicationId param is required." });
      return;
    }
    const result = await resolveAndConfirmBeef(applicationId, req.user!.userId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_BEEF_RESOLVED",
      description: `Pending BEEF application #${applicationId} resolved → READY_FOR_SECTIONING.`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function revertToPendingBeefHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "Invalid application ID." });
      return;
    }
    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (!reason || reason.length < 5) {
      res
        .status(400)
        .json({ message: "A reason of at least 5 characters is required." });
      return;
    }
    const result = await revertToPendingBeef(
      applicationId,
      req.user!.userId,
      reason,
    );
    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_REVERTED_TO_PENDING",
      description: `Reverted application #${applicationId} to PENDING_BEEF. Reason: ${reason}`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function downgradeToBeefHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const applicationId = parsePositiveInt(req.params.applicationId, 0);
    if (!applicationId) {
      res.status(400).json({ message: "Invalid application ID." });
      return;
    }
    const result = await downgradeToBeef(applicationId, req.user!.userId);
    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_DOWNGRADED_TO_BEEF",
      description: `Downgraded application #${applicationId} from FAILED_ASSESSMENT to BEC track (SUBMITTED_BEEF).`,
      subjectType: "EnrollmentApplication",
      recordId: applicationId,
      req,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function flushNoShowsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { applicationIds, reason } = req.body as {
      applicationIds?: unknown;
      reason?: unknown;
    };
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      res
        .status(400)
        .json({ message: "applicationIds must be a non-empty array." });
      return;
    }
    const ids = (applicationIds as unknown[])
      .map((id) => parsePositiveInt(id, 0))
      .filter((id) => id > 0);
    if (ids.length === 0) {
      res.status(400).json({ message: "No valid application IDs provided." });
      return;
    }
    const reasonStr =
      typeof reason === "string" && reason.trim()
        ? reason.trim()
        : "No reason provided";
    const result = await flushNoShows(ids, req.user!.userId);
    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_NO_SHOWS_FLUSHED",
      description: `Flushed ${result.flushed} no-show application(s) to WITHDRAWN. Reason: ${reasonStr}. Skipped: ${result.skipped}.`,
      subjectType: "EnrollmentApplication",
      recordId: 0,
      req,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
