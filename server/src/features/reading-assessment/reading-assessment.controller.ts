import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

const VALID_READING_LEVELS = [
  "INDEPENDENT",
  "INSTRUCTIONAL",
  "FRUSTRATION",
  "NON_READER",
] as const;
type ReadingProfileLevel = (typeof VALID_READING_LEVELS)[number];

// ── GET /reading-assessment/queue ───────────────────────────────────────────

/**
 * Returns all learners pending Phil-IRI assessment.
 * Conditions:
 *   - status is SUBMITTED_BEEF (Lane 2 / BEC) OR READY_FOR_ENROLLMENT (Lane 1 / SCP)
 *   - readingProfileLevel is null (not yet assessed)
 * Query params: schoolYearId (required), search (optional: name or LRN)
 */
export async function getReadingAssessmentQueue(
  req: Request,
  res: Response,
): Promise<void> {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const searchFilter = search
    ? {
        OR: [
          { learner: { firstName: { contains: search, mode: "insensitive" as const } } },
          { learner: { lastName: { contains: search, mode: "insensitive" as const } } },
          { learner: { lrn: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: { in: ["VERIFIED", "VERIFIED"] },
      readingProfileLevel: null,
      ...searchFilter,
    },
    select: {
      id: true,
      status: true,
      applicantType: true,
      learnerType: true,
      admissionChannel: true,
      learner: {
        select: {
          id: true,
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      gradeLevel: { select: { id: true, name: true } },
    },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
  });

  res.json({ applications, total: applications.length });
}

// ── GET /reading-assessment/adviser-queue ─────────────────────────────────

/**
 * Unified Teacher (Adviser) queue.
 * Returns ALL SUBMITTED_BEEF | READY_FOR_ENROLLMENT learners for the school year,
 * regardless of readingProfileLevel, so the teacher can handle both Phil-IRI
 * assessment and BOSY confirmation in a single sitting.
 */
export async function getAdviserQueue(
  req: Request,
  res: Response,
): Promise<void> {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const searchFilter = search
    ? {
        OR: [
          {
            learner: {
              firstName: { contains: search, mode: "insensitive" as const },
            },
          },
          {
            learner: {
              lastName: { contains: search, mode: "insensitive" as const },
            },
          },
          {
            learner: { lrn: { contains: search, mode: "insensitive" as const } },
          },
        ],
      }
    : {};

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: { in: ["VERIFIED", "VERIFIED"] },
      ...searchFilter,
    },
    select: {
      id: true,
      status: true,
      applicantType: true,
      learnerType: true,
      admissionChannel: true,
      readingProfileLevel: true,
      learner: {
        select: {
          id: true,
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      gradeLevel: { select: { id: true, name: true } },
    },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
  });

  res.json({ applications, total: applications.length });
}

// ── GET /reading-assessment/continuing-queue ─────────────────────────────

/**
 * Returns PENDING_CONFIRMATION CONTINUING learners for the school year.
 * Used by the Teacher/Adviser Intake Hub to show and confirm returning learners.
 * Returns items in the same shape as BOSYQueueItem for easy client consumption.
 */
export async function getContinuingQueue(
  req: Request,
  res: Response,
): Promise<void> {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const searchFilter = search
    ? {
        OR: [
          {
            learner: {
              firstName: { contains: search, mode: "insensitive" as const },
            },
          },
          {
            learner: {
              lastName: { contains: search, mode: "insensitive" as const },
            },
          },
          {
            learner: { lrn: { contains: search, mode: "insensitive" as const } },
          },
        ],
      }
    : {};

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      learnerType: "CONTINUING",
      status: "VERIFIED",
      ...searchFilter,
    },
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      learner: {
        select: {
          id: true,
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      gradeLevel: { select: { id: true, name: true, displayOrder: true } },
    },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
  });

  const items = applications.map((a) => ({
    applicationId: a.id,
    trackingNumber: a.trackingNumber,
    status: a.status,
    learnerId: a.learner.id,
    lrn: a.learner.lrn,
    firstName: a.learner.firstName,
    lastName: a.learner.lastName,
    middleName: a.learner.middleName,
    gradeLevelId: a.gradeLevel.id,
    gradeLevelName: a.gradeLevel.name,
    gradeLevelDisplayOrder: a.gradeLevel.displayOrder,
  }));

  res.json({ items, total: items.length });
}

// ── PUT /reading-assessment/:applicationId ──────────────────────────────────

/**
 * Record a Phil-IRI reading level for an application.
 * Does NOT mutate EnrollmentStatus — only sets readingProfileLevel.
 */
export async function recordReadingLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const applicationId = Number(req.params.applicationId);
  if (!applicationId || isNaN(applicationId)) {
    res.status(400).json({ message: "Invalid applicationId." });
    return;
  }

  const { readingLevel } = req.body as { readingLevel: string };
  if (!readingLevel || !VALID_READING_LEVELS.includes(readingLevel as ReadingProfileLevel)) {
    res.status(400).json({
      message: `readingLevel must be one of: ${VALID_READING_LEVELS.join(", ")}.`,
    });
    return;
  }

  const existing = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });
  if (!existing) {
    res.status(404).json({ message: "Application not found." });
    return;
  }
  if (
    existing.status !== "VERIFIED"
  ) {
    res.status(422).json({
      message: `Application status '${existing.status}' is not eligible for Phil-IRI assessment.`,
    });
    return;
  }

  // Update ONLY the reading profile fields — status is intentionally preserved.
  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      readingProfileLevel: readingLevel as ReadingProfileLevel,
      readingProfileAssessedAt: new Date(),
      readingProfileAssessedById: userId,
    },
    select: {
      id: true,
      status: true,
      readingProfileLevel: true,
      readingProfileAssessedAt: true,
    },
  });

  res.json({ application: updated });
}
