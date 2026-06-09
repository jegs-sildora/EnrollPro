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

  const {
    firstName,
    lastName,
    middleName,
    lrn,
    gradeLevel,
    learnerType,
    schoolYearId,
    dateCollected,
    notes,
  } = req.body as {
    firstName: string;
    lastName: string;
    middleName?: string;
    lrn?: string;
    gradeLevel: string;
    learnerType?: string;
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
      middleName: middleName ? String(middleName).trim().toUpperCase() : null,
      lrn: lrn ? String(lrn).trim() : null,
      gradeLevel: String(gradeLevel).trim().toUpperCase(),
      learnerType: learnerType ? (learnerType as any) : null,
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
      confirmationConsent: true,
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

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: { confirmationConsent: isConfirmationSlipReceived },
    select: { confirmationConsent: true },
  });

  res.json({ application: { id: applicationId, isConfirmationSlipReceived: updated.confirmationConsent } });
}

// ────────────────────────────────────────────────────────────────────────────────
// Intake pipeline endpoints
// ────────────────────────────────────────────────────────────────────────────────

/** GET /reading-queue?schoolYearId=X — Walk-in listings + digital-first applications awaiting reading assessment */
export async function getReadingQueue(req: Request, res: Response) {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const [listings, applications] = await Promise.all([
    prisma.enrollmentListing.findMany({
      where: { schoolYearId, status: "LISTED" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        lrn: true,
        gradeLevel: true,
        learnerType: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId,
        status: "VERIFIED",
        readingProfileLevel: null,
      },
      select: {
        id: true,
        learnerType: true,
        learner: {
          select: {
            lrn: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        gradeLevel: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  res.json({ listings, applications });
}

/** PATCH /:id/assess — Record Phil-IRI result and advance listing to PROCESSED */
export async function assessListing(req: Request, res: Response) {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const id = Number(req.params.id);
  const { readingLevel } = req.body as { readingLevel: string };

  if (!readingLevel || !VALID_READING_LEVELS.includes(readingLevel as any)) {
    res.status(400).json({
      message: `readingLevel must be one of: ${VALID_READING_LEVELS.join(", ")}.`,
    });
    return;
  }

  const existing = await prisma.enrollmentListing.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Listing not found." });
    return;
  }
  if (existing.status !== "LISTED") {
    res.status(409).json({ message: "Listing is not in LISTED status." });
    return;
  }

  const updated = await prisma.enrollmentListing.update({
    where: { id },
    data: { readingLevel: readingLevel as any, status: "PROCESSED" },
  });

  res.json({ listing: updated });
}

/** PATCH /applications/:applicationId/intake-assess — Record Phil-IRI and advance application to PENDING_VERIFICATION */
export async function assessApplicationForIntake(req: Request, res: Response) {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const applicationId = Number(req.params.applicationId);
  const { readingLevel } = req.body as { readingLevel: ReadingProfileLevel };

  if (!readingLevel || !VALID_READING_LEVELS.includes(readingLevel)) {
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
  if (existing.status !== "VERIFIED") {
    res.status(409).json({
      message: "Application is not in READY_FOR_ENROLLMENT status.",
    });
    return;
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      readingProfileLevel: readingLevel,
      readingProfileAssessedAt: new Date(),
      readingProfileAssessedById: userId,
      status: "VERIFIED",
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

/** GET /confirmation-queue?schoolYearId=X — PROCESSED listings + PENDING_VERIFICATION apps */
export async function getConfirmationQueue(req: Request, res: Response) {
  const schoolYearId = Number(req.query.schoolYearId);
  if (!schoolYearId || isNaN(schoolYearId)) {
    res.status(400).json({ message: "schoolYearId query param is required." });
    return;
  }

  const [listings, applications] = await Promise.all([
    prisma.enrollmentListing.findMany({
      where: { schoolYearId, status: "PROCESSED" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        lrn: true,
        gradeLevel: true,
        learnerType: true,
        readingLevel: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.enrollmentApplication.findMany({
      where: { schoolYearId, status: "VERIFIED" },
      select: {
        id: true,
        status: true,
        learnerType: true,
        readingProfileLevel: true,
        readingProfileAssessedAt: true,
        confirmationConsent: true,
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
    }),
  ]);

  res.json({ listings, applications });
}

/** PATCH /:id/intake-confirm — Officialize walk-in listing with BMI + mark CONFIRMED */
export async function confirmListing(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { heightCm, weightKg, confirmationSlipReceived } = req.body as {
    heightCm?: number;
    weightKg?: number;
    confirmationSlipReceived?: boolean;
  };

  const existing = await prisma.enrollmentListing.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Listing not found." });
    return;
  }
  if (existing.status !== "PROCESSED") {
    res.status(409).json({ message: "Listing is not in PROCESSED status." });
    return;
  }

  const updated = await prisma.enrollmentListing.update({
    where: { id },
    data: {
      heightCm: heightCm != null ? Number(heightCm) : undefined,
      weightKg: weightKg != null ? Number(weightKg) : undefined,
      confirmationSlipReceived: confirmationSlipReceived ?? false,
      status: "CONFIRMED",
    },
  });

  res.json({ listing: updated });
}

/** PATCH /applications/:id/officialize — Advance PENDING_VERIFICATION app with BMI to VERIFIED */
export async function officializeApplication(req: Request, res: Response) {
  const applicationId = Number(req.params.applicationId);
  const { heightCm, weightKg, confirmationSlipReceived } = req.body as {
    heightCm?: number;
    weightKg?: number;
    confirmationSlipReceived?: boolean;
  };

  const existing = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });
  if (!existing) {
    res.status(404).json({ message: "Application not found." });
    return;
  }
  if (existing.status !== "PENDING_VERIFICATION") {
    res.status(409).json({ message: "Application is not in PENDING_VERIFICATION status." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.enrollmentApplication.update({
      where: { id: applicationId },
      data: {
        status: "VERIFIED",
        intakeHeightCm: heightCm != null ? Number(heightCm) : undefined,
        intakeWeightKg: weightKg != null ? Number(weightKg) : undefined,
        confirmationConsent: confirmationSlipReceived ?? false,
      },
    });


  });

  res.json({ message: "Application officialized successfully." });
}
