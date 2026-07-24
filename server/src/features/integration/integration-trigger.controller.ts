import type { Request, Response, NextFunction } from "express";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  broadcastDomainInvalidation,
  broadcastEosyInvalidation,
} from "../../lib/realtime-events.js";
import { syncFinalSmartSectionOutcomes } from "./smart-eosy.service.js";

/**
 * POST /api/integration/smart/sections/:id/sync-grades
 * Fetches section-level academic status from S.M.A.R.T. and persists
 * it as EnrollmentRecord.finalAverage (matched by LRN).
 */
export async function syncSmartSectionGrades(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      res.status(400).json({ message: "Invalid section id." });
      return;
    }

    const result = await syncFinalSmartSectionOutcomes(sectionId);

    await auditLog({
      userId: req.user!.userId,
      actionType: "SMART_SECTION_SYNC",
      description:
        `SMART final-result sync: section #${sectionId} - `
        + `${result.syncedCount} updated, `
        + `${result.unmatchedSmartLrns.length} unmatched, `
        + `${result.missingSmartLrns.length} missing from SMART.`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    broadcastEosyInvalidation(
      result.schoolYearId,
      [result.sectionId],
      result.learnerIds,
    );
    broadcastDomainInvalidation({ topics: ["integration:hub"] });

    res.json({
      success: true,
      ...result,
      message: `Synchronized ${result.syncedCount} finalized learner outcome(s) from SMART.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/integration/atlas/sync-faculty
 * Triggers ATLAS to pull the latest faculty data from EnrollPro.
 */
export async function syncAtlasFaculty(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const baseUrl = process.env.ATLAS_API_BASE_URL || "http://njgrm.buru-degree.ts.net:5001";

    try {
      // Direct trigger without API key headers
      const response = await axios.post(
        `${baseUrl}/api/v1/faculty/sync`,
        { mode: "reconcile" },
        { timeout: 15000 },
      );

      await auditLog({
        userId: req.user!.userId,
        actionType: "ATLAS_FACULTY_SYNC",
        description: `Triggered ATLAS faculty sync. Result: ${response.data.activeCount || 0} records.`,
        subjectType: "Teacher",
        recordId: req.user!.userId,
        req,
      });

      broadcastDomainInvalidation({
        topics: ["integration:hub", "teachers:list"],
      });

      res.json({
        success: true,
        synced: true,
        message: response.data.message || `ATLAS synchronization triggered successfully.`,
      });
    } catch (fetchError: unknown) {
       const message = axios.isAxiosError(fetchError)
         ? fetchError.message
         : fetchError instanceof Error
           ? fetchError.message
           : "Unknown ATLAS connection error";
       console.error("ATLAS sync trigger failed:", message);
       throw new AppError(
        503,
        `ATLAS handshake failed — server is offline or unreachable via Tailscale: ${message}`,
      );
    }
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/integration/broadcast/phase1
 */
/**
 * GET /api/integration/atlas/faculty/:id/teaching-load
 */
export async function getAtlasTeachingLoad(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const teacherId = req.params.id;
    const schoolYearId = req.query.schoolYearId;
    const baseUrl = process.env.ATLAS_API_BASE_URL || "http://njgrm.buru-degree.ts.net:5001";

    try {
      const response = await axios.get(
        `${baseUrl}/api/v1/faculty-assignments/${teacherId}`,
        {
          params: { schoolYearId },
          timeout: 5000,
        },
      );

      res.json({
        success: true,
        data: response.data.assignments || [],
      });
    } catch (fetchError) {
      if (process.env.NODE_ENV === "development") {
         res.json({
           success: true,
           isDemoData: true,
           data: [
             { subjectCode: "MATH7", subjectName: "Mathematics 7", sectionName: "7-Rizal", gradeLevel: "GRADE_7" },
             { subjectCode: "MATH7", subjectName: "Mathematics 7", sectionName: "7-Mabini", gradeLevel: "GRADE_7" },
           ]
         });
         return;
      }
      throw new AppError(503, "ATLAS scheduling service is unreachable.");
    }
  } catch (error) {
    next(error);
  }
}
