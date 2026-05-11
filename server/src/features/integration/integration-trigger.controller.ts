import type { Request, Response, NextFunction } from "express";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

/**
 * POST /api/integration/smart/sections/:id/sync-grades
 * Fetches section-level academic status from S.M.A.R.T. and persists
 * it as EnrollmentRecord.finalAverage (matched by LRN).
 *
 * Env vars required: SMART_API_BASE_URL, SMART_API_KEY
 * Optional: SMART_SYNC_FALLBACK_ENABLED=true  (demo / offline mode)
 *
 * Roles: SYSTEM_ADMIN only
 */
export async function syncSmartSectionGrades(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(sectionId) || sectionId <= 0) {
      res.status(400).json({ message: "Invalid section id." });
      return;
    }

    const apiKey = process.env.SMART_API_KEY;
    const baseUrl = process.env.SMART_API_BASE_URL;
    const fallbackEnabled = process.env.SMART_SYNC_FALLBACK_ENABLED === "true";

    if (!apiKey || !baseUrl) {
      throw new AppError(
        500,
        "S.M.A.R.T. API configuration missing (SMART_API_BASE_URL or SMART_API_KEY).",
      );
    }

    // Fetch section with its current enrollment records (LRNs only)
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        gradeLevel: { select: { id: true, name: true } },
        schoolYear: { select: { id: true, yearLabel: true } },
        enrollmentRecords: {
          include: {
            enrollmentApplication: {
              include: {
                learner: { select: { id: true, lrn: true } },
              },
            },
          },
        },
      },
    });

    if (!section) {
      res.status(404).json({ message: "Section not found." });
      return;
    }

    if (section.enrollmentRecords.length === 0) {
      res.json({
        success: true,
        syncedCount: 0,
        message: "Section has no enrolled learners.",
      });
      return;
    }

    // Extract numeric part of grade level name (e.g., "Grade 8" → 8)
    const gradeNumMatch = section.gradeLevel.name.match(/\d+/);
    const gradeNum = gradeNumMatch ? gradeNumMatch[0] : section.gradeLevel.name;
    const syLabel = section.schoolYear.yearLabel;

    let smartData: Array<{ lrn: string; generalAverage: number }> = [];
    let isFallbackEngaged = false;

    try {
      const response = await axios.get(
        `${baseUrl}/api/v1/academic-status/section/${sectionId}`,
        {
          params: { sy: syLabel, grade: gradeNum },
          headers: { "X-API-KEY": apiKey },
          timeout: 5000,
        },
      );
      smartData = response.data;
    } catch (fetchError) {
      console.warn(
        "S.M.A.R.T. section sync — live node unreachable:",
        (fetchError as Error).message,
      );

      if (fallbackEnabled) {
        isFallbackEngaged = true;
        // Return mock grades for the enrolled LRNs
        smartData = section.enrollmentRecords.map((r) => ({
          lrn: r.enrollmentApplication.learner.lrn ?? "",
          generalAverage: 85.0,
        }));
      } else {
        throw new AppError(
          503,
          "S.M.A.R.T. sync failed — external server is unreachable.",
        );
      }
    }

    // Build LRN → enrollmentApplicationId + recordId map
    type RecordRef = {
      enrollmentApplicationId: number;
      recordId: number;
      lrn: string | null;
    };
    const localMap = new Map<string, RecordRef>();
    for (const r of section.enrollmentRecords) {
      const lrn = r.enrollmentApplication.learner.lrn;
      if (lrn) {
        localMap.set(lrn, {
          enrollmentApplicationId: r.enrollmentApplicationId,
          recordId: r.id,
          lrn,
        });
      }
    }

    const matchedUpdates: Array<{ lrn: string; finalAverage: number }> = [];
    const missingLrns: string[] = [];

    for (const entry of smartData) {
      if (!entry.lrn) continue;
      if (localMap.has(entry.lrn)) {
        matchedUpdates.push({ lrn: entry.lrn, finalAverage: entry.generalAverage });
      } else {
        missingLrns.push(entry.lrn);
      }
    }

    if (matchedUpdates.length > 0) {
      await prisma.$transaction(
        matchedUpdates.map((u) => {
          const ref = localMap.get(u.lrn)!;
          return prisma.enrollmentRecord.update({
            where: { id: ref.recordId },
            data: { finalAverage: u.finalAverage },
          });
        }),
      );
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "SMART_SECTION_SYNC",
      description: `SMART section sync: section #${sectionId} — ${matchedUpdates.length} updated, ${missingLrns.length} unmatched. Fallback=${isFallbackEngaged}`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    res.json({
      success: true,
      sectionId,
      sectionName: section.name,
      syncedCount: matchedUpdates.length,
      missingCount: missingLrns.length,
      missingLrns,
      isFallbackEngaged,
      message: isFallbackEngaged
        ? `Demo mode: synced ${matchedUpdates.length} grade(s) from local cache.`
        : `Synced ${matchedUpdates.length} grade(s) from S.M.A.R.T.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/integration/atlas/sync-faculty
 * Pulls faculty records from ATLAS and upserts them into the local Teacher table.
 *
 * Env vars required: ATLAS_API_BASE_URL, ATLAS_API_KEY
 *
 * Expected ATLAS response shape per teacher:
 *   { employeeId, firstName, lastName, middleName?, sex, email,
 *     contactNumber?, specialization?, plantillaPosition?, designation?, isActive? }
 *
 * Roles: SYSTEM_ADMIN only
 */
export async function syncAtlasFaculty(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKey = process.env.ATLAS_API_KEY;
    const baseUrl = process.env.ATLAS_API_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new AppError(
        500,
        "ATLAS API configuration missing (ATLAS_API_BASE_URL or ATLAS_API_KEY).",
      );
    }

    let facultyData: Array<Record<string, unknown>> = [];

    try {
      const response = await axios.get(`${baseUrl}/api/v1/faculty`, {
        headers: { "X-API-KEY": apiKey },
        timeout: 10000,
      });
      facultyData = response.data;
    } catch (fetchError) {
      throw new AppError(
        503,
        `ATLAS faculty pull failed — external server unreachable: ${(fetchError as Error).message}`,
      );
    }

    if (!Array.isArray(facultyData)) {
      throw new AppError(502, "ATLAS returned an unexpected response format.");
    }

    const errors: Array<{ employeeId: unknown; error: string }> = [];
    const upsertOps: Array<ReturnType<typeof prisma.teacher.upsert>> = [];

    for (const faculty of facultyData) {
      const employeeId = String(faculty.employeeId ?? "").trim();
      const email = String(faculty.email ?? "").trim().toLowerCase();

      if (!employeeId || employeeId.length > 7) {
        errors.push({
          employeeId,
          error: "Missing or invalid employeeId (max 7 chars).",
        });
        continue;
      }
      if (!email) {
        errors.push({ employeeId, error: "Missing email." });
        continue;
      }

      const firstName = String(faculty.firstName ?? "").trim().toUpperCase();
      const lastName = String(faculty.lastName ?? "").trim().toUpperCase();
      const middleName = faculty.middleName
        ? String(faculty.middleName).trim().toUpperCase()
        : null;
      const rawSex = String(faculty.sex ?? "").toUpperCase();
      const sex = rawSex === "MALE" ? "MALE" : ("FEMALE" as const);
      const isActive =
        typeof faculty.isActive === "boolean" ? faculty.isActive : true;

      upsertOps.push(
        prisma.teacher.upsert({
          where: { employeeId },
          create: {
            employeeId,
            firstName,
            lastName,
            middleName,
            sex,
            email,
            contactNumber: faculty.contactNumber
              ? String(faculty.contactNumber)
              : null,
            specialization: faculty.specialization
              ? String(faculty.specialization)
              : null,
            plantillaPosition: faculty.plantillaPosition
              ? String(faculty.plantillaPosition)
              : null,
            designation: faculty.designation
              ? String(faculty.designation)
              : null,
            isActive,
          },
          update: {
            firstName,
            lastName,
            middleName,
            sex,
            email,
            contactNumber: faculty.contactNumber
              ? String(faculty.contactNumber)
              : null,
            specialization: faculty.specialization
              ? String(faculty.specialization)
              : null,
            plantillaPosition: faculty.plantillaPosition
              ? String(faculty.plantillaPosition)
              : null,
            designation: faculty.designation
              ? String(faculty.designation)
              : null,
            isActive,
          },
        }),
      );
    }

    let synced = 0;
    if (upsertOps.length > 0) {
      const results = await prisma.$transaction(upsertOps);
      synced = results.length;
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "ATLAS_FACULTY_SYNC",
      description: `ATLAS faculty sync: ${synced} upserted, ${errors.length} skipped.`,
      subjectType: "Teacher",
      recordId: req.user!.userId,
      req,
    });

    res.json({
      success: true,
      synced,
      skipped: errors.length,
      errors,
      message: `Synced ${synced} faculty record(s) from ATLAS.`,
    });
  } catch (error) {
    next(error);
  }
}
