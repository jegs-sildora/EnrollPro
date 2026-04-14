import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import type { ApplicationStatus, Prisma } from "../../../generated/prisma";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import {
  VALID_TRANSITIONS,
  createEarlyRegistrationSharedService,
} from "../services/early-registration-shared.service.js";

export function createEarlyRegistrationOperationsController(
  deps: AdmissionControllerDeps = createAdmissionControllerDeps(),
) {
  const { prisma, auditLog, normalizeDateToUtcNoon } = deps;
  const {
    findApplicantOrThrow,
    assertTransition,
    queueEmail,
    flattenAssessmentData,
  } = createEarlyRegistrationSharedService(deps);
async function pass(req: Request, res: Response, next: NextFunction) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "PASSED",
      `Cannot mark as passed. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as passed.`,
    );

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "PASSED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_PASSED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as PASSED - ready for section assignment`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Assessment Passed - ${applicant.trackingNumber}`,
      "ASSESSMENT_PASSED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// â"€â"€ Mark as not qualified â"€â"€
async function fail(req: Request, res: Response, next: NextFunction) {
  try {
    const { examNotes } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    assertTransition(
      applicant,
      "NOT_QUALIFIED",
      `Cannot mark as not qualified. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as not qualified.`,
    );

    // Store failure notes on the latest assessment and update status
    const updated = await prisma.$transaction(async (tx) => {
      if (examNotes) {
        const latestAssessment = await tx.applicantAssessment.findFirst({
          where: { applicantId },
          orderBy: { createdAt: "desc" },
        });
        if (latestAssessment) {
          await tx.applicantAssessment.update({
            where: { id: latestAssessment.id },
            data: { notes: examNotes },
          });
        }
      }

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: "NOT_QUALIFIED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_FAILED",
      description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as NOT_QUALIFIED. Notes: ${examNotes || "N/A"}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Assessment Result — ${applicant.trackingNumber}`,
      "ASSESSMENT_FAILED",
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// — Get application timeline (audit history) —
async function getTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));
    await findApplicantOrThrow(applicantId);

    const timeline = await prisma.auditLog.findMany({
      where: {
        subjectType: "Applicant",
        recordId: applicantId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ timeline });
  } catch (error) {
    next(error);
  }
}

// — Offer regular section (for failed SCP applicants) —
async function offerRegular(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { sectionId } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    // Only allow offering regular section to NOT_QUALIFIED SCP applicants
    if (applicant.status !== "NOT_QUALIFIED") {
      throw new AppError(
        422,
        `Cannot offer regular section. Current status: "${applicant.status}". Only NOT_QUALIFIED applications can be offered a regular section.`,
      );
    }

    if (applicant.applicantType === "REGULAR") {
      throw new AppError(
        422,
        "This applicant is already in the regular program.",
      );
    }

    const originalType = applicant.applicantType;

    const result = await prisma.$transaction(async (tx) => {
      // Lock section for capacity check
      const [section] = await tx.$queryRaw<
        { id: number; maxCapacity: number }[]
      >`
        SELECT id, "max_capacity" as "maxCapacity" FROM "sections" WHERE id = ${sectionId} FOR UPDATE
      `;

      if (!section) throw new AppError(404, "Section not found");

      const enrolledCount = await tx.enrollment.count({ where: { sectionId } });
      if (enrolledCount >= section.maxCapacity) {
        throw new AppError(422, "This section has reached maximum capacity");
      }

      // Update applicant to REGULAR type and create enrollment
      await tx.applicant.update({
        where: { id: applicantId },
        data: {
          applicantType: "REGULAR",
          status: "PRE_REGISTERED",
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          applicantId,
          sectionId,
          schoolYearId: applicant.schoolYearId,
          enrolledById: req.user!.userId,
        },
      });

      return enrollment;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "OFFER_REGULAR_SECTION",
      description: `Converted ${applicant.firstName} ${applicant.lastName} (#${applicantId}) from ${originalType} to REGULAR and assigned to section ${sectionId}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    await queueEmail(
      applicantId,
      applicant.emailAddress,
      `Regular Section Placement — ${applicant.trackingNumber}`,
      "APPLICATION_APPROVED",
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// — Navigate to prev/next application —
async function navigate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const currentId = parseInt(String(req.params.id));
    const direction = req.query.direction as "prev" | "next";
    const { status, gradeLevelId, applicantType, search } = req.query;

    if (!direction || !["prev", "next"].includes(direction)) {
      throw new AppError(400, 'Direction must be "prev" or "next"');
    }

    // Build the same filter as the list
    const where: Prisma.ApplicantWhereInput = {};

    // Scope to active School Year by default
    const settings = await prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true },
    });
    if (settings?.activeSchoolYearId) {
      where.schoolYearId = settings.activeSchoolYearId;
    }

    if (search) {
      const s = String(search);
      where.OR = [
        { lrn: { contains: s, mode: "insensitive" } },
        { firstName: { contains: s, mode: "insensitive" } },
        { lastName: { contains: s, mode: "insensitive" } },
        { trackingNumber: { contains: s, mode: "insensitive" } },
      ];
    }
    if (gradeLevelId) where.gradeLevelId = parseInt(String(gradeLevelId));
    if (status && status !== "ALL")
      where.status = status as Prisma.EnumApplicationStatusFilter;
    if (applicantType && applicantType !== "ALL")
      where.applicantType = applicantType as Prisma.EnumApplicantTypeFilter;

    // Get ordered list of IDs
    const applications = await prisma.applicant.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const ids = applications.map((a) => a.id);
    const currentIndex = ids.indexOf(currentId);

    if (currentIndex === -1) {
      throw new AppError(404, "Current application not found in list");
    }

    let targetId: number | null = null;
    if (direction === "prev" && currentIndex > 0) {
      targetId = ids[currentIndex - 1];
    } else if (direction === "next" && currentIndex < ids.length - 1) {
      targetId = ids[currentIndex + 1];
    }

    res.json({
      currentIndex,
      totalCount: ids.length,
      previousId: currentIndex > 0 ? ids[currentIndex - 1] : null,
      nextId: currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null,
      targetId,
    });
  } catch (error) {
    next(error);
  }
}

// — Get sections for section assignment dialog —
async function getSectionsForAssignment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { gradeLevel: true },
    });
    if (!applicant) throw new AppError(404, "Applicant not found");

    const sections = await prisma.section.findMany({
      where: { gradeLevelId: applicant.gradeLevelId },
      include: {
        advisingTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: "asc" },
    });

    const formatted = sections.map((s) => ({
      id: s.id,
      name: s.name,
      maxCapacity: s.maxCapacity,
      enrolledCount: s._count.enrollments,
      availableSlots: s.maxCapacity - s._count.enrollments,
      fillPercent:
        s.maxCapacity > 0
          ? Math.round((s._count.enrollments / s.maxCapacity) * 100)
          : 0,
      isFull: s._count.enrollments >= s.maxCapacity,
      isNearFull: s._count.enrollments >= s.maxCapacity * 0.8,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    }));

    res.json({
      applicant: {
        id: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        gradeLevelId: applicant.gradeLevelId,
        gradeLevelName: applicant.gradeLevel.name,
      },
      sections: formatted,
    });
  } catch (error) {
    next(error);
  }
}

// — Update application info —
async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const applicantId = parseInt(String(req.params.id));

    // Whitelist editable fields to prevent status/tracking/schoolYear tampering
    const {
      firstName,
      middleName,
      lastName,
      suffix,
      lrn,
      sex,
      birthDate,
      placeOfBirth,
      motherTongue,
      religion,
      emailAddress,
      isIpCommunity,
      ipGroupName,
      is4PsBeneficiary,
      householdId4Ps,
      gradeLevelId,
      applicantType,
      studentPhoto,
      psaBirthCertNumber,
      learnerType,
    } = req.body;

    const data: Prisma.ApplicantUpdateInput = {
      firstName,
      middleName,
      lastName,
      suffix,
      lrn,
      sex,
      birthDate: birthDate
        ? normalizeDateToUtcNoon(new Date(birthDate))
        : undefined,
      placeOfBirth,
      motherTongue,
      religion,
      emailAddress,
      isIpCommunity,
      ipGroupName,
      is4PsBeneficiary,
      householdId4Ps,
      applicantType,
      studentPhoto,
      psaBirthCertNumber,
      learnerType,
    };

    // Only set gradeLevelId if provided (relation connect)
    if (gradeLevelId !== undefined) {
      data.gradeLevel = { connect: { id: gradeLevelId } };
    }

    // Strip undefined values so Prisma doesn't overwrite unmentioned fields
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      if (data[key] === undefined) delete data[key];
    }

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data,
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_UPDATED",
      description: `Updated application info for ${updated.firstName} ${updated.lastName} (#${applicantId})`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// — Show detailed application info —
async function showDetailed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        gradeLevel: true,
        schoolYear: true,
        addresses: true,
        familyMembers: true,
        previousSchool: true,
        assessments: { orderBy: { createdAt: "desc" } },
        programDetail: true,
        documents: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        checklist: {
          include: {
            updatedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        encodedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            enrolledBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        emailLogs: {
          orderBy: { attemptedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!application) throw new AppError(404, "Application not found");

    // Fetch audit logs for the applicant
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        subjectType: "Applicant",
        recordId: application.id,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(await flattenAssessmentData({ ...application, auditLogs }));
  } catch (error) {
    next(error);
  }
}

// — Reschedule assessment —
async function rescheduleAssessmentStep(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, scheduledDate, scheduledTime, venue } = req.body;
    const applicantId = parseInt(String(req.params.id));
    const applicant = await findApplicantOrThrow(applicantId);

    // Create a new assessment record for the reschedule
    const updated = await prisma.$transaction(async (tx) => {
      await tx.applicantAssessment.create({
        data: {
          applicantId,
          type: (kind || "QUALIFYING_EXAMINATION") as any,
          stepOrder: stepOrder ?? null,
          scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
          scheduledTime: scheduledTime || null,
          venue: venue || null,
          notes: "Rescheduled",
        },
      });

      return tx.applicant.update({
        where: { id: applicantId },
        data: { status: "ASSESSMENT_SCHEDULED" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ASSESSMENT_RESCHEDULED",
      description: `Rescheduled step ${stepOrder ?? "?"} (${kind || "WRITTEN_EXAM"}) for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) to ${scheduledDate}`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// Legacy alias
const rescheduleExam = rescheduleAssessmentStep;

// ── Batch Process Registration ──

async function batchProcess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ids, targetStatus } = req.body as {
      ids: number[];
      targetStatus: ApplicationStatus;
    };

    // Fetch all applicants in a single query
    const applicants = await prisma.applicant.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        trackingNumber: true,
      },
    });

    const foundIds = new Set(applicants.map((a) => a.id));

    const succeeded: Array<{
      id: number;
      name: string;
      trackingNumber: string;
      previousStatus: string;
    }> = [];
    const failed: Array<{
      id: number;
      name: string;
      trackingNumber: string;
      reason: string;
    }> = [];

    // Categorize: valid transitions vs invalid
    const validApplicants: typeof applicants = [];

    for (const id of ids) {
      if (!foundIds.has(id)) {
        failed.push({
          id,
          name: "Unknown",
          trackingNumber: "",
          reason: "Applicant not found",
        });
        continue;
      }

      const applicant = applicants.find((a) => a.id === id)!;
      const allowedTransitions = VALID_TRANSITIONS[applicant.status] ?? [];

      if (!allowedTransitions.includes(targetStatus)) {
        failed.push({
          id: applicant.id,
          name: `${applicant.lastName}, ${applicant.firstName}`,
          trackingNumber: applicant.trackingNumber,
          reason: `Cannot transition from "${applicant.status}" to "${targetStatus}"`,
        });
        continue;
      }

      validApplicants.push(applicant);
    }

    // Execute all valid transitions in a single atomic transaction
    if (validApplicants.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const applicant of validApplicants) {
          await tx.applicant.update({
            where: { id: applicant.id },
            data: { status: targetStatus },
          });
        }
      });

      // Record successes
      for (const applicant of validApplicants) {
        succeeded.push({
          id: applicant.id,
          name: `${applicant.lastName}, ${applicant.firstName}`,
          trackingNumber: applicant.trackingNumber,
          previousStatus: applicant.status,
        });
      }

      // Audit log each successful transition (non-critical, outside transaction)
      for (const applicant of validApplicants) {
        auditLog({
          userId: req.user!.userId,
          actionType: "STATUS_CHANGED",
          description: `Batch: ${applicant.firstName} ${applicant.lastName} (#${applicant.id}) status changed from ${applicant.status} to ${targetStatus}`,
          subjectType: "Applicant",
          recordId: applicant.id,
          req,
        }).catch(() => {});
      }
    }

    res.json({
      processed: ids.length,
      succeeded,
      failed,
    });
  } catch (error) {
    next(error);
  }
}
  return {
    pass,
    fail,
    getTimeline,
    offerRegular,
    navigate,
    getSectionsForAssignment,
    update,
    showDetailed,
    rescheduleAssessmentStep,
    rescheduleExam,
    batchProcess,
  };
}

const operationsController = createEarlyRegistrationOperationsController();

export const pass = operationsController.pass;
export const fail = operationsController.fail;
export const getTimeline = operationsController.getTimeline;
export const offerRegular = operationsController.offerRegular;
export const navigate = operationsController.navigate;
export const getSectionsForAssignment = operationsController.getSectionsForAssignment;
export const update = operationsController.update;
export const showDetailed = operationsController.showDetailed;
export const rescheduleAssessmentStep = operationsController.rescheduleAssessmentStep;
export const rescheduleExam = operationsController.rescheduleExam;
export const batchProcess = operationsController.batchProcess;
