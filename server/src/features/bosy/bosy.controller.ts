import type { Request, Response, NextFunction } from "express";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  markTransferRequest,
  bulkConfirmReturn,
  getJHSCompleters,
  syncBOSYQueue,
  getPhase2Queue,
  getPreviousSections,
  type BOSYQueueState,
} from "./bosy.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BOSY_QUEUE_STATES = new Set<BOSYQueueState>([
  "PENDING",
  "CONFIRMED",
  "TEMPORARY",
  "TRANSFER_REQUEST",
  "ENROLLED",
]);

function parseQueueState(value: unknown): BOSYQueueState | undefined {
  if (typeof value !== "string") return undefined;
  return BOSY_QUEUE_STATES.has(value as BOSYQueueState)
    ? (value as BOSYQueueState)
    : undefined;
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
      description: `Synchronized BOSY queue; created ${result.created} missing applications, including ${result.remedialHolds} Grade 10 remedial hold(s).`,
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

    const gradeLevelId = req.query.gradeLevelId
      ? parsePositiveInt(req.query.gradeLevelId, 0) || undefined
      : undefined;
    const targetGradeOrder = req.query.targetGradeOrder
      ? parsePositiveInt(req.query.targetGradeOrder, 0) || undefined
      : undefined;
    if (
      targetGradeOrder !== undefined &&
      (targetGradeOrder < 7 || targetGradeOrder > 10)
    ) {
      res.status(400).json({
        message: "targetGradeOrder must be from Grade 7 to Grade 10.",
      });
      return;
    }
    const queueState = parseQueueState(req.query.queueState);
    if (req.query.queueState !== undefined && !queueState) {
      res.status(400).json({ message: "Invalid BOSY queue state." });
      return;
    }
    const search =
      typeof req.query.search === "string" && req.query.search.length > 0
        ? req.query.search
        : undefined;
    const previousSectionName =
      typeof req.query.previousSectionName === "string" && req.query.previousSectionName.length > 0
        ? req.query.previousSectionName
        : undefined;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 1000000);

    const result = await getBOSYQueue({
      schoolYearId,
      gradeLevelId,
      targetGradeOrder,
      queueState,
      status,
      search,
      previousSectionName,
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

export async function markTransferRequestHandler(
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

    const result = await markTransferRequest(
      applicationId,
      req.user!.userId,
    );

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_TRANSFER_REQUEST_MARKED",
      description:
        `Marked enrollment application #${applicationId} as a transfer request.`,
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
      status: status.length > 0 ? status : ["VERIFIED"],
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



export async function getPreviousSectionsHandler(
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
    const sections = await getPreviousSections(schoolYearId);
    res.json(sections);
  } catch (error) {
    next(error);
  }
}
