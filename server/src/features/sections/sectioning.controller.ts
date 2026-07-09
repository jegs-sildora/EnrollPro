import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { calculateTeacherWorkload } from "./services/workload-guard.service.js";
import { Prisma, SectioningMethod } from "../../generated/prisma/index.js";
import { getAllowedSectionProgramsForPlacement } from "@enrollpro/shared";
import { broadcastRealtimeInvalidation } from "../../lib/sse.js";

function broadcastSectioningInvalidation({
  schoolYearId,
  sectionIds,
  learnerIds,
}: {
  schoolYearId?: number | null;
  sectionIds?: number[];
  learnerIds?: number[];
}): void {
  broadcastRealtimeInvalidation({
    topics: [
      "sectioning:sections",
      "sectioning:pool",
      "homerooms:sections",
      "students:list",
      "dashboard:summary",
    ],
    schoolYearId,
    sectionIds,
    learnerIds,
  });
}

/**
 * TLE Sectioning Workspace: Returns sections with current M/F counts and TLE tracks.
 * GET /api/sectioning/sections-summary
 */
export async function getSectionsSummary(req: Request, res: Response) {
  try {
    const schoolYearId = req.query.schoolYearId
      ? Number(req.query.schoolYearId)
      : req.schoolYearId;

    if (!schoolYearId) {
      return res.status(400).json({ message: "Active school year not found." });
    }

    const sections = await prisma.section.findMany({
      where: { schoolYearId },
      include: {
        gradeLevel: { select: { name: true, displayOrder: true } },
        advisers: {
          where: { status: "ACTIVE" },
          include: { teacher: { select: { firstName: true, lastName: true } } },
        },
        enrollmentRecords: {
          include: { learner: { select: { sex: true } } },
        },
      },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { name: "asc" }
      ],
    });

    const summary = sections.map((s) => {
      const boys = s.enrollmentRecords.filter((r) => r.learner.sex === "MALE").length;
      const girls = s.enrollmentRecords.filter((r) => r.learner.sex === "FEMALE").length;

      return {
        id: s.id,
        name: s.name,
        gradeLevel: s.gradeLevel.name,
        gradeLevelId: s.gradeLevelId,
        gradeLevelOrder: s.gradeLevel.displayOrder,
        sortOrder: s.sortOrder,
        programType: s.programType,
        maxCapacity: s.maxCapacity,
        currentCount: s.enrollmentRecords.length,
        boys,
        girls,
        adviser: s.advisers[0]?.teacher 
          ? `${s.advisers[0].teacher.lastName}, ${s.advisers[0].teacher.firstName}`
          : "No Adviser",
      };
    });

    return res.json(summary);
  } catch (error) {
    console.error("getSectionsSummary failed:", error);
    return res.status(500).json({ message: "Error fetching sections summary." });
  }
}

/**
 * TLE Sectioning Workspace: Returns students READY_FOR_TLE_SECTIONING who have no section assignment.
 * GET /api/sectioning/pool
 */
export async function getSectioningPool(req: Request, res: Response) {
  try {
    const { gradeLevelId } = req.query;
    const schoolYearId = req.query.schoolYearId
      ? Number(req.query.schoolYearId)
      : req.schoolYearId;

    if (!schoolYearId) {
       return res.status(400).json({ message: "Active school year required." });
    }

    const where: Prisma.EnrollmentApplicationWhereInput = {
      schoolYearId,
      status: "READY_FOR_SECTIONING",
      enrollmentRecord: null, // Critical: Only students not yet assigned
    };

    if (gradeLevelId) where.gradeLevelId = Number(gradeLevelId);

    const applications = await prisma.enrollmentApplication.findMany({
      where,
      include: {
        learner: {
          select: {
            lrn: true,
            firstName: true,
            lastName: true,
            middleName: true,
            sex: true,
            isBalikAral: true,
            previousGenAve: true,
            enrollmentRecords: {
              where: {
                schoolYearId: { not: schoolYearId },
                finalAverage: { not: null },
              },
              orderBy: { schoolYearId: "desc" },
              take: 1,
              select: { finalAverage: true },
            },
          },
        },
        gradeLevel: { select: { name: true, displayOrder: true } },
        previousSchool: { select: { generalAverage: true } },
      },
      orderBy: { learner: { lastName: "asc" } },
    });

    const pool = applications.map((app) => ({
      applicationId: app.id,
      lrn: app.learner.lrn,
      firstName: app.learner.firstName,
      lastName: app.learner.lastName,
      middleName: app.learner.middleName,
      sex: app.learner.sex,
      genAve:
        app.learner.enrollmentRecords?.[0]?.finalAverage ??
        app.previousSchool?.generalAverage ??
        app.learner.previousGenAve ??
        null,
      gradeLevel: app.gradeLevel.name,
      gradeLevelId: app.gradeLevelId,
      duplicateFlag: app.duplicateFlag,
      learnerType: app.learnerType,
      isBalikAral: app.learner.isBalikAral,
      applicantType: app.applicantType,
      assignedProgram: app.assignedProgram,
      programType: app.assignedProgram ?? app.applicantType,
    }));

    return res.json(pool);
  } catch (error) {
    console.error("getSectioningPool failed:", error);
    return res.status(500).json({ message: "Error fetching sectioning pool." });
  }
}

/**
 * TLE Sectioning Workspace: Bulk Assignment with Track-Lock and Capacity Guards.
 * POST /api/sectioning/assign-bulk
 */
export async function assignBulk(req: Request, res: Response) {
  try {
    const { sectionId, applicationIds } = req.body as {
      sectionId: number;
      applicationIds: number[];
    };

    if (!sectionId || !applicationIds || !applicationIds.length) {
      return res.status(400).json({ message: "sectionId and applicationIds[] are required." });
    }

    const userId = req.user!.userId; // Authenticated user (Registrar)
    const schoolYearId = req.schoolYearId;

    // 1. Fetch Section Details and System Setting
    const [section, setting] = await Promise.all([
      prisma.section.findUnique({
        where: { id: sectionId },
        include: { 
          enrollmentRecords: { select: { id: true } },
          gradeLevel: { select: { displayOrder: true } }
        },
      }),
      prisma.schoolSetting.findFirst({ select: { systemPhase: true } })
    ]);

    if (!section) return res.status(404).json({ message: "Section not found." });

    // 2. Capacity Guard (Rule: Hard cap 50 students)
    const currentCount = section.enrollmentRecords.length;
    const requestedCount = applicationIds.length;
    if (currentCount + requestedCount > section.maxCapacity) {
      return res.status(409).json({ 
        message: `Section ${section.name} has ${section.maxCapacity - currentCount} available seat(s), but ${requestedCount} learner(s) were selected.`,
      });
    }

    // 3. Fetch Applications for Validation
    const apps = await prisma.enrollmentApplication.findMany({
      where: { id: { in: applicationIds } },
      include: { 
        learner: {
          select: { firstName: true, lastName: true, isBalikAral: true },
        },
        enrollmentRecord: { select: { id: true } }
      }
    });

    if (apps.length !== applicationIds.length) {
      return res.status(400).json({ message: "One or more applications not found." });
    }

    // 4. Track-Lock & Grade Level Guard (Rule 1 & 2)
    for (const app of apps) {
      // Avoid double assignment
      if (app.enrollmentRecord) {
        return res.status(409).json({ message: `Student ${app.learner.firstName} ${app.learner.lastName} is already assigned to a section.` });
      }

      // Stage Gate: only section learners cleared by Stage 2
      if (app.status !== "READY_FOR_SECTIONING") {
        return res.status(409).json({
          message: `Application ${app.id} is not ready for section assignment.`,
        });
      }

      if (app.schoolYearId !== section.schoolYearId) {
        return res.status(422).json({
          message: "The learner and section belong to different school years.",
        });
      }

      // Grade Level Check
      if (app.gradeLevelId !== section.gradeLevelId) {
         return res.status(422).json({ message: "Grade Level Mismatch: Student grade level does not match section grade level." });
      }

      const allowedPrograms = getAllowedSectionProgramsForPlacement({
        learnerType: app.learnerType,
        isBalikAral: app.learner.isBalikAral,
        applicantType: app.applicantType,
        assignedProgram: app.assignedProgram,
      });
      if (!allowedPrograms.includes(section.programType)) {
        return res.status(422).json({
          message:
            `${app.learner.firstName} ${app.learner.lastName} does not match the selected section program.`,
        });
      }

    }

    // 5. Atomic Transaction
    const results = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const app of apps) {
        // Create Enrollment Record
        const record = await tx.enrollmentRecord.create({
          data: {
            enrollmentApplicationId: app.id,
            sectionId: section.id,
            learnerId: app.learnerId,
            schoolYearId: app.schoolYearId,
            enrolledById: userId,
            dateSectioned: new Date(),
            isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
          }
        });

        // Finalize Application Status
        await tx.enrollmentApplication.update({
          where: { id: app.id },
          data: { status: "OFFICIALLY_ENROLLED" }
        });

        records.push(record);
      }
      return records;
    });

    // 6. Audit Logging
    await auditLog({
      userId,
      actionType: "BULK_SECTION_ASSIGNMENT",
      description: `Bulk sectioned ${applicationIds.length} students into Section: ${section.name}`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    broadcastSectioningInvalidation({
      schoolYearId,
      sectionIds: [sectionId],
      learnerIds: apps.map((app) => app.learnerId),
    });

    return res.json({ 
      success: true, 
      message: `Successfully assigned ${applicationIds.length} students to ${section.name}.`,
      count: results.length 
    });

  } catch (error) {
    console.error("assignBulk failed:", error);
    return res.status(500).json({ message: "Internal server error during bulk sectioning." });
  }
}

interface CommitDraftAssignmentInput {
  sectionId: number;
  applicationIds: number[];
}

interface CommitDraftPayload {
  assignments: CommitDraftAssignmentInput[];
  overrides: Record<number, boolean>;
  allowCapacityOverride: boolean;
}

interface DraftPlacementCandidate {
  sectionId: number;
  applicationId: number;
  isOverridden: boolean;
}

interface SkippedApplication {
  applicationId: number;
  reason: string;
}

interface CommittedApplication {
  applicationId: number;
  enrollmentRecordId: number;
  sectionId: number;
  sectioningMethod: SectioningMethod;
}

class DraftCommitConflictError extends Error {
  constructor() {
    super("Learner changed during draft commit.");
    this.name = "DraftCommitConflictError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseCommitDraftPayload(body: unknown): CommitDraftPayload | null {
  if (!isRecord(body) || !Array.isArray(body.assignments)) {
    return null;
  }

  const assignments: CommitDraftAssignmentInput[] = [];
  for (const rawAssignment of body.assignments) {
    if (!isRecord(rawAssignment) || !Array.isArray(rawAssignment.applicationIds)) {
      return null;
    }

    const sectionId = parsePositiveInteger(rawAssignment.sectionId);
    if (sectionId === null) return null;

    const applicationIds: number[] = [];
    for (const rawApplicationId of rawAssignment.applicationIds) {
      const applicationId = parsePositiveInteger(rawApplicationId);
      if (applicationId === null) return null;
      applicationIds.push(applicationId);
    }

    assignments.push({ sectionId, applicationIds });
  }

  const overrides: Record<number, boolean> = {};
  if (body.overrides !== undefined) {
    if (!isRecord(body.overrides)) return null;

    for (const [key, value] of Object.entries(body.overrides)) {
      const applicationId = Number(key);
      if (!Number.isInteger(applicationId) || applicationId <= 0 || typeof value !== "boolean") {
        return null;
      }
      overrides[applicationId] = value;
    }
  }

  return {
    assignments,
    overrides,
    allowCapacityOverride: body.allowCapacityOverride === true,
  };
}

function isKnownPrismaConflict(error: unknown): boolean {
  return (
    error instanceof DraftCommitConflictError ||
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2025"].includes(error.code)
  );
}

/**
 * POST /api/sectioning/commit-draft
 * Commits reviewed draft placements while skipping learners changed by another user.
 */
export async function commitDraft(req: Request, res: Response) {
  const payload = parseCommitDraftPayload(req.body);
  if (!payload || payload.assignments.length === 0) {
    return res.status(400).json({
      message: "Draft sectioning assignments are required.",
    });
  }

  const userId = req.user!.userId;
  const flattenedCandidates: DraftPlacementCandidate[] = [];
  const skippedApplications: SkippedApplication[] = [];
  const seenApplicationIds = new Set<number>();

  for (const assignment of payload.assignments) {
    for (const applicationId of assignment.applicationIds) {
      if (seenApplicationIds.has(applicationId)) {
        skippedApplications.push({
          applicationId,
          reason: "This learner appeared more than once in the draft.",
        });
        continue;
      }

      seenApplicationIds.add(applicationId);
      flattenedCandidates.push({
        sectionId: assignment.sectionId,
        applicationId,
        isOverridden: payload.overrides[applicationId] === true,
      });
    }
  }

  if (flattenedCandidates.length === 0) {
    return res.status(400).json({
      message: "No valid learner placements were found in the draft.",
      committedCount: 0,
      committedApplications: [],
      skippedApplications,
    });
  }

  try {
    const sectionIds = Array.from(
      new Set(flattenedCandidates.map((candidate) => candidate.sectionId)),
    );
    const applicationIds = Array.from(
      new Set(flattenedCandidates.map((candidate) => candidate.applicationId)),
    );

    const [sections, applications, setting] = await Promise.all([
      prisma.section.findMany({
        where: { id: { in: sectionIds } },
        include: {
          enrollmentRecords: { select: { id: true } },
        },
      }),
      prisma.enrollmentApplication.findMany({
        where: { id: { in: applicationIds } },
        include: {
          learner: {
            select: { firstName: true, lastName: true, isBalikAral: true },
          },
          enrollmentRecord: { select: { id: true } },
        },
      }),
      prisma.schoolSetting.findFirst({ select: { systemPhase: true } }),
    ]);

    const sectionsById = new Map(sections.map((section) => [section.id, section]));
    const applicationsById = new Map(
      applications.map((application) => [application.id, application]),
    );
    const acceptedCountBySection = new Map<number, number>();
    const validCandidates: DraftPlacementCandidate[] = [];

    for (const candidate of flattenedCandidates) {
      const section = sectionsById.get(candidate.sectionId);
      const application = applicationsById.get(candidate.applicationId);

      if (!section) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: "The selected section no longer exists.",
        });
        continue;
      }

      if (!application) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: "The learner application no longer exists.",
        });
        continue;
      }

      const learnerName = `${application.learner.lastName}, ${application.learner.firstName}`;
      if (application.enrollmentRecord) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: `${learnerName} has already been assigned to a section.`,
        });
        continue;
      }

      if (application.status !== "READY_FOR_SECTIONING") {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: `${learnerName} is no longer ready for class sectioning.`,
        });
        continue;
      }

      if (application.schoolYearId !== section.schoolYearId) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: `${learnerName} belongs to a different school year.`,
        });
        continue;
      }

      if (application.gradeLevelId !== section.gradeLevelId) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: `${learnerName} does not match the selected grade level section.`,
        });
        continue;
      }

      const allowedPrograms = getAllowedSectionProgramsForPlacement({
        learnerType: application.learnerType,
        isBalikAral: application.learner.isBalikAral,
        applicantType: application.applicantType,
        assignedProgram: application.assignedProgram,
      });
      if (!allowedPrograms.includes(section.programType)) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: `${learnerName} does not match the section program.`,
        });
        continue;
      }

      const acceptedCount = acceptedCountBySection.get(section.id) ?? 0;
      const nextCount = section.enrollmentRecords.length + acceptedCount + 1;
      if (!payload.allowCapacityOverride && nextCount > section.maxCapacity) {
        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: `${section.name} is already at its standard class capacity.`,
        });
        continue;
      }

      acceptedCountBySection.set(section.id, acceptedCount + 1);
      validCandidates.push(candidate);
    }

    const committedApplications: CommittedApplication[] = [];
    const commitDate = new Date();

    for (const candidate of validCandidates) {
      const application = applicationsById.get(candidate.applicationId);
      if (!application) continue;

      try {
        const sectioningMethod = candidate.isOverridden
          ? SectioningMethod.MANUAL_OVERRIDE
          : SectioningMethod.BATCH_ALGORITHM;

        const record = await prisma.$transaction(async (tx) => {
          const freshApplication = await tx.enrollmentApplication.findUnique({
            where: { id: candidate.applicationId },
            include: { enrollmentRecord: { select: { id: true } } },
          });

          if (
            !freshApplication ||
            freshApplication.status !== "READY_FOR_SECTIONING" ||
            freshApplication.enrollmentRecord
          ) {
            throw new DraftCommitConflictError();
          }

          const created = await tx.enrollmentRecord.create({
            data: {
              enrollmentApplicationId: application.id,
              sectionId: candidate.sectionId,
              learnerId: application.learnerId,
              schoolYearId: application.schoolYearId,
              enrolledById: userId,
              dateSectioned: commitDate,
              enrolledAt: commitDate,
              isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
              sectioningMethod,
            },
          });

          await tx.enrollmentApplication.update({
            where: { id: application.id },
            data: { status: "OFFICIALLY_ENROLLED" },
          });

          return created;
        });

        committedApplications.push({
          applicationId: application.id,
          enrollmentRecordId: record.id,
          sectionId: candidate.sectionId,
          sectioningMethod,
        });
      } catch (error: unknown) {
        if (!isKnownPrismaConflict(error)) throw error;

        skippedApplications.push({
          applicationId: candidate.applicationId,
          reason: "This learner was changed by another user during draft review.",
        });
      }
    }

    await auditLog({
      userId,
      actionType: "COMMIT_DRAFT_SECTIONING",
      description:
        `Committed ${committedApplications.length} draft sectioning placement(s); ` +
        `${skippedApplications.length} learner(s) skipped.`,
      subjectType: "Sectioning",
      recordId: req.schoolYearId ?? null,
      metadata: {
        committedCount: committedApplications.length,
        skippedCount: skippedApplications.length,
        overrideCount: committedApplications.filter(
          (application) => application.sectioningMethod === SectioningMethod.MANUAL_OVERRIDE,
        ).length,
        allowCapacityOverride: payload.allowCapacityOverride,
      },
      req,
    });

    broadcastSectioningInvalidation({
      schoolYearId: req.schoolYearId,
      sectionIds: Array.from(
        new Set(committedApplications.map((application) => application.sectionId)),
      ),
      learnerIds: committedApplications
        .map((application) => applicationsById.get(application.applicationId)?.learnerId)
        .filter((learnerId): learnerId is number => typeof learnerId === "number"),
    });

    return res.json({
      success: true,
      committedCount: committedApplications.length,
      committedApplications,
      skippedApplications,
    });
  } catch (error) {
    console.error("commitDraft failed:", error);
    return res.status(500).json({
      message: "Could not commit the draft sectioning placements.",
    });
  }
}


