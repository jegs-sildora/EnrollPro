import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

type AuthRequest = Request & { user?: { id: number } };

export async function list(req: Request, res: Response) {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const listings = await prisma.enrollmentListing.findMany({
    where: { schoolYearId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ listings });
}

export async function create(req: Request, res: Response) {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const { firstName, lastName, gradeLevel, schoolYearId, dateCollected, notes } =
    req.body as {
      firstName: string;
      lastName: string;
      gradeLevel: string;
      schoolYearId: number;
      dateCollected?: string;
      notes?: string;
    };

  if (!firstName || !lastName || !gradeLevel || !schoolYearId) {
    res
      .status(400)
      .json({ message: "firstName, lastName, gradeLevel, and schoolYearId are required." });
    return;
  }

  const listing = await prisma.enrollmentListing.create({
    data: {
      firstName: String(firstName).trim().toUpperCase(),
      lastName: String(lastName).trim().toUpperCase(),
      gradeLevel: String(gradeLevel).trim().toUpperCase(),
      schoolYearId: Number(schoolYearId),
      createdById: userId,
      dateCollected: dateCollected ? new Date(dateCollected) : undefined,
      notes: notes ? String(notes).trim() : undefined,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  res.status(201).json({ listing });
}

export async function updateStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { status } = req.body as { status: "LISTED" | "PROCESSED" };

  if (!status || !["LISTED", "PROCESSED"].includes(status)) {
    res.status(400).json({ message: "status must be LISTED or PROCESSED." });
    return;
  }

  const existing = await prisma.enrollmentListing.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Listing not found." });
    return;
  }

  const updated = await prisma.enrollmentListing.update({
    where: { id },
    data: { status },
  });

  res.json({ listing: updated });
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.enrollmentListing.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Listing not found." });
    return;
  }

  await prisma.enrollmentListing.delete({ where: { id } });
  res.status(204).send();
}

// ────────────────────────────────────────────────────────────────────────────────
// Reading Profile endpoints
// ────────────────────────────────────────────────────────────────────────────────

const VALID_READING_LEVELS = [
  "INDEPENDENT",
  "INSTRUCTIONAL",
  "FRUSTRATION",
  "NON_READER",
] as const;

type ReadingProfileLevel = (typeof VALID_READING_LEVELS)[number];

export async function listEnrolledLearners(req: Request, res: Response) {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: "ENROLLED",
    },
    select: {
      id: true,
      status: true,
      readingProfileLevel: true,
      readingProfileNotes: true,
      readingProfileAssessedAt: true,
      checklist: { select: { isConfirmationSlipReceived: true } },
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
      enrollmentRecord: {
        select: { section: { select: { id: true, name: true } } },
      },
    },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
  });

  res.json({ applications });
}

export async function updateReadingProfile(req: Request, res: Response) {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const applicationId = Number(req.params.applicationId);
  const { readingProfileLevel, readingProfileNotes } = req.body as {
    readingProfileLevel: ReadingProfileLevel;
    readingProfileNotes?: string;
  };

  if (!readingProfileLevel || !VALID_READING_LEVELS.includes(readingProfileLevel)) {
    res.status(400).json({
      message: `readingProfileLevel must be one of: ${VALID_READING_LEVELS.join(", ")}.`,
    });
    return;
  }

  const existing = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ message: "Application not found." });
    return;
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      readingProfileLevel,
      readingProfileNotes: readingProfileNotes ?? null,
      readingProfileAssessedAt: new Date(),
      readingProfileAssessedById: userId,
    },
    select: {
      id: true,
      readingProfileLevel: true,
      readingProfileNotes: true,
      readingProfileAssessedAt: true,
    },
  });

  res.json({ application: updated });
}

export async function updateConfirmationSlip(req: Request, res: Response) {
  const applicationId = Number(req.params.applicationId);
  const { isConfirmationSlipReceived } = req.body as {
    isConfirmationSlipReceived: boolean;
  };

  if (typeof isConfirmationSlipReceived !== "boolean") {
    res.status(400).json({ message: "isConfirmationSlipReceived must be a boolean." });
    return;
  }

  const existing = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ message: "Application not found." });
    return;
  }

  const updated = await prisma.applicationChecklist.upsert({
    where: { enrollmentId: applicationId },
    create: { enrollmentId: applicationId, isConfirmationSlipReceived },
    update: { isConfirmationSlipReceived },
    select: { isConfirmationSlipReceived: true },
  });

  res.json({ application: { id: applicationId, ...updated } });
}
