import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import type { ApplicationStatus, Prisma } from "../../../generated/prisma/index.js";
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
    getDetailedApplicationOrThrow,
    updateApplicationStatus,
  } = createEarlyRegistrationSharedService(deps);
  async function pass(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } = await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "PASSED",
        `Cannot mark as passed. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as passed.`,
      );

      const updated = await updateApplicationStatus(applicantId, "PASSED");

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_PASSED",
        description: `Marked ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) as PASSED - ready for section assignment`,
        subjectType: appType === "ENROLLMENT" ? "EnrollmentApplication" : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? null,
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
      const { data: applicant, type: appType } = await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "NOT_QUALIFIED",
        `Cannot mark as not qualified. Current status: "${applicant.status}". Only ASSESSMENT_TAKEN applications can be marked as not qualified.`,
      );

      // Store failure notes on the latest assessment and update status
      const updated = await prisma.$transaction(async (tx) => {
        if (examNotes) {
          const earlyRegId = applicant.earlyRegistrationId || (appType === "EARLY_REGISTRATION" ? applicant.id : null);
          if (earlyRegId) {
            const latestAssessment =
              await tx.earlyRegistrationAssessment.findFirst({
                where: { applicationId: earlyRegId },
                orderBy: { createdAt: "desc" },
              });
            if (latestAssessment) {
              await tx.earlyRegistrationAssessment.update({
                where: { id: latestAssessment.id },
                data: { notes: examNotes },
              });
            }
          }
        }

        return updateApplicationStatus(applicantId, "NOT_QUALIFIED");
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_FAILED",
        description: `Marked ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) as NOT_QUALIFIED. Notes: ${examNotes || "N/A"}`,
        subjectType: appType === "ENROLLMENT" ? "EnrollmentApplication" : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? null,
        `Assessment Result — ${applicant.trackingNumber}`,
        "ASSESSMENT_FAILED",
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // — Get application timeline (audit history) —
  async function getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { type: appType } = await findApplicantOrThrow(applicantId);

      const timeline = await prisma.auditLog.findMany({
        where: {
          subjectType: { in: ["Applicant", "EnrollmentApplication", "EarlyRegistrationApplication"] },
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
  async function offerRegular(req: Request, res: Response, next: NextFunction) {
    try {
      const { sectionId } = req.body;
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } = await findApplicantOrThrow(applicantId);

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

        const enrolledCount = await tx.enrollmentRecord.count({
          where: { sectionId },
        });
        if (enrolledCount >= section.maxCapacity) {
          throw new AppError(422, "This section has reached maximum capacity");
        }

        // Update applicant to REGULAR type and create enrollment
        // This promotes an EarlyReg to an EnrollmentApp if it wasn't one already
        let enrollmentAppId = applicantId;
        
        if (appType === "EARLY_REGISTRATION") {
           const newApp = await tx.enrollmentApplication.create({
             data: {
               learnerId: applicant.learnerId,
               earlyRegistrationId: applicant.id,
               schoolYearId: applicant.schoolYearId,
               gradeLevelId: applicant.gradeLevelId,
               applicantType: "REGULAR",
               learnerType: applicant.learnerType,
               status: "PRE_REGISTERED",
               admissionChannel: applicant.channel,
               isPrivacyConsentGiven: applicant.isPrivacyConsentGiven,
               encodedById: req.user!.userId,
             }
           });
           enrollmentAppId = newApp.id;

           await tx.earlyRegistrationApplication.update({
             where: { id: applicant.id },
             data: { status: "PRE_REGISTERED" }
           });

           // Link existing checklist to the new enrollment application
           const existingChecklist = await tx.applicationChecklist.findUnique({
             where: { earlyRegistrationId: applicant.id },
           });

           if (existingChecklist) {
             await tx.applicationChecklist.update({
               where: { id: existingChecklist.id },
               data: { enrollmentId: newApp.id },
             });
           } else {
             await tx.applicationChecklist.create({
               data: {
                 enrollmentId: newApp.id,
                 earlyRegistrationId: applicant.id,
               },
             });
           }
        } else {
          await tx.enrollmentApplication.update({
            where: { id: applicantId },
            data: {
              applicantType: "REGULAR",
              status: "PRE_REGISTERED",
            },
          });
        }

        const enrollment = await tx.enrollmentRecord.create({
          data: {
            enrollmentApplicationId: enrollmentAppId,
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
        description: `Converted ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) from ${originalType} to REGULAR and assigned to section ${sectionId}`,
        subjectType: appType === "ENROLLMENT" ? "EnrollmentApplication" : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? applicant.email ?? null,
        `Regular Section Placement — ${applicant.trackingNumber}`,
        "APPLICATION_APPROVED",
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // — Navigate to prev/next application —
  async function navigate(req: Request, res: Response, next: NextFunction) {
    try {
      const currentId = parseInt(String(req.params.id));
      const direction = req.query.direction as "prev" | "next";
      const { status, gradeLevelId, applicantType, search } = req.query;

      if (!direction || !["prev", "next"].includes(direction)) {
        throw new AppError(400, 'Direction must be "prev" or "next"');
      }

      // Build filters (can be shared as both use Learner relation)
      const buildWhere = (
        type: "ENROLLMENT" | "EARLY_REGISTRATION",
      ): any => {
        const where: any = {};

        if (search) {
          const s = String(search);
          where.OR = [
            { learner: { lrn: { contains: s, mode: "insensitive" } } },
            { learner: { firstName: { contains: s, mode: "insensitive" } } },
            { learner: { lastName: { contains: s, mode: "insensitive" } } },
            { trackingNumber: { contains: s, mode: "insensitive" } },
          ];
        }

        if (gradeLevelId) where.gradeLevelId = parseInt(String(gradeLevelId));
        if (status && status !== "ALL")
          where.status = status as ApplicationStatus;
        if (applicantType && applicantType !== "ALL")
          where.applicantType = applicantType as any;

        return where;
      };

      // Scope to active School Year by default
      const settings = await prisma.schoolSetting.findFirst({
        select: { activeSchoolYearId: true },
      });
      const commonWhere: any = {};
      if (settings?.activeSchoolYearId) {
        commonWhere.schoolYearId = settings.activeSchoolYearId;
      }

      const whereEnrollment = { ...commonWhere, ...buildWhere("ENROLLMENT") };
      const whereEarlyReg = {
        ...commonWhere,
        ...buildWhere("EARLY_REGISTRATION"),
      };

      // Get ordered list of IDs from both tables
      const [enrollmentApps, earlyRegApps] = await Promise.all([
        prisma.enrollmentApplication.findMany({
          where: whereEnrollment,
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.earlyRegistrationApplication.findMany({
          where: whereEarlyReg,
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Merge and sort
      // We store type because IDs can collide
      const combined = [
        ...enrollmentApps.map((a) => ({
          id: a.id,
          createdAt: a.createdAt,
          type: "ENROLLMENT",
        })),
        ...earlyRegApps.map((a) => ({
          id: a.id,
          createdAt: a.createdAt,
          type: "EARLY_REGISTRATION",
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Determine the type of the current ID to avoid collision ambiguity
      const { type: currentType } = await findApplicantOrThrow(currentId);

      const currentIndex = combined.findIndex(
        (a) => a.id === currentId && a.type === currentType,
      );

      if (currentIndex === -1) {
        throw new AppError(404, "Current application not found in list");
      }

      let targetId: number | null = null;
      if (direction === "prev" && currentIndex > 0) {
        targetId = combined[currentIndex - 1].id;
      } else if (direction === "next" && currentIndex < combined.length - 1) {
        targetId = combined[currentIndex + 1].id;
      }

      res.json({
        currentIndex,
        totalCount: combined.length,
        previousId: currentIndex > 0 ? combined[currentIndex - 1].id : null,
        nextId:
          currentIndex < combined.length - 1
            ? combined[currentIndex + 1].id
            : null,
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
      const { data: applicant } = await findApplicantOrThrow(applicantId);

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
          _count: { select: { enrollmentRecords: true } },
        },
        orderBy: { name: "asc" },
      });

      const formatted = sections.map((s) => ({
        id: s.id,
        name: s.name,
        maxCapacity: s.maxCapacity,
        enrolledCount: s._count.enrollmentRecords,
        availableSlots: s.maxCapacity - s._count.enrollmentRecords,
        fillPercent:
          s.maxCapacity > 0
            ? Math.round((s._count.enrollmentRecords / s.maxCapacity) * 100)
            : 0,
        isFull: s._count.enrollmentRecords >= s.maxCapacity,
        isNearFull: s._count.enrollmentRecords >= s.maxCapacity * 0.8,
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
          firstName: applicant.learner.firstName,
          lastName: applicant.learner.lastName,
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
      const { data: applicant, type: appType } = await findApplicantOrThrow(
        applicantId,
      );

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
        isIpCommunity,
        ipGroupName,
        is4PsBeneficiary,
        householdId4Ps,
        gradeLevelId,
        applicantType,
        studentPhoto,
        learnerType,
      } = req.body;

      // Fields that belong to Learner model
      const learnerData: Record<string, any> = {};
      if (firstName !== undefined) learnerData.firstName = firstName;
      if (middleName !== undefined) learnerData.middleName = middleName;
      if (lastName !== undefined) learnerData.lastName = lastName;
      if (suffix !== undefined) learnerData.extensionName = suffix;
      if (lrn !== undefined) learnerData.lrn = lrn;
      if (sex !== undefined) learnerData.sex = sex;
      if (birthDate !== undefined)
        learnerData.birthdate = normalizeDateToUtcNoon(new Date(birthDate));
      if (placeOfBirth !== undefined) learnerData.placeOfBirth = placeOfBirth;
      if (motherTongue !== undefined) learnerData.motherTongue = motherTongue;
      if (religion !== undefined) learnerData.religion = religion;
      if (isIpCommunity !== undefined)
        learnerData.isIpCommunity = isIpCommunity;
      if (ipGroupName !== undefined) learnerData.ipGroupName = ipGroupName;
      if (is4PsBeneficiary !== undefined)
        learnerData.is4PsBeneficiary = is4PsBeneficiary;
      if (householdId4Ps !== undefined)
        learnerData.householdId4Ps = householdId4Ps;

      // Fields that belong to application models
      const appData: Record<string, any> = {};
      if (applicantType !== undefined) appData.applicantType = applicantType;
      if (learnerType !== undefined) appData.learnerType = learnerType;
      if (gradeLevelId !== undefined)
        appData.gradeLevel = { connect: { id: gradeLevelId } };

      const updated = await prisma.$transaction(async (tx) => {
        if (Object.keys(learnerData).length > 0) {
          await tx.learner.update({
            where: { id: applicant.learnerId },
            data: learnerData,
          });
        }

        if (appType === "ENROLLMENT") {
          if (studentPhoto !== undefined) appData.studentPhoto = studentPhoto;
          return tx.enrollmentApplication.update({
            where: { id: applicantId },
            data: appData,
            include: { learner: true },
          });
        } else {
          return tx.earlyRegistrationApplication.update({
            where: { id: applicantId },
            data: appData,
            include: { learner: true },
          });
        }
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_UPDATED",
        description: `Updated application info for ${updated.learner.firstName} ${updated.learner.lastName} (#${applicantId})`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // — Show detailed application info —
  async function showDetailed(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const application = await getDetailedApplicationOrThrow(applicantId, {
        includeAuditLogs: true,
      });
      res.json(application);
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
      const { data: applicant, type: appType } = await findApplicantOrThrow(
        applicantId,
      );

      const earlyRegId =
        applicant.earlyRegistrationId ||
        (appType === "EARLY_REGISTRATION" ? applicant.id : null);
      if (!earlyRegId) throw new AppError(400, "No early registration linked");

      // Create a new assessment record for the reschedule
      const updated = await prisma.$transaction(async (tx) => {
        await tx.earlyRegistrationAssessment.create({
          data: {
            applicationId: earlyRegId,
            type: (kind || "QUALIFYING_EXAMINATION") as any,
            scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
            scheduledTime: scheduledTime || null,
            venue: venue || null,
            notes: "Rescheduled",
          },
        });

        return updateApplicationStatus(applicantId, "ASSESSMENT_SCHEDULED");
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "ASSESSMENT_RESCHEDULED",
        description: `Rescheduled step ${stepOrder ?? "?"} (${kind || "WRITTEN_EXAM"}) for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) to ${scheduledDate}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
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

  async function batchProcess(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, targetStatus } = req.body as {
        ids: number[];
        targetStatus: ApplicationStatus;
      };

      // Fetch from both tables and combine
      const [enrollmentApps, earlyRegApps] = await Promise.all([
        prisma.enrollmentApplication.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            status: true,
            learner: { select: { firstName: true, lastName: true } },
            trackingNumber: true,
          },
        }),
        prisma.earlyRegistrationApplication.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            status: true,
            learner: { select: { firstName: true, lastName: true } },
            trackingNumber: true,
          },
        }),
      ]);

      // Map by ID, prioritizing EnrollmentApplication if ID is same (unlikely but following findApplicantOrThrow logic)
      const appMap = new Map<
        number,
        { data: any; type: "ENROLLMENT" | "EARLY_REGISTRATION" }
      >();
      earlyRegApps.forEach((a) =>
        appMap.set(a.id, { data: a, type: "EARLY_REGISTRATION" }),
      );
      enrollmentApps.forEach((a) =>
        appMap.set(a.id, { data: a, type: "ENROLLMENT" }),
      );

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

      const validApplicants: Array<{
        id: number;
        type: "ENROLLMENT" | "EARLY_REGISTRATION";
        previousStatus: string;
        name: string;
        trackingNumber: string;
      }> = [];

      for (const id of ids) {
        const applicantInfo = appMap.get(id);
        if (!applicantInfo) {
          failed.push({
            id,
            name: "Unknown",
            trackingNumber: "",
            reason: "Applicant not found",
          });
          continue;
        }

        const { data: applicant, type: appType } = applicantInfo;
        const allowedTransitions = VALID_TRANSITIONS[applicant.status] ?? [];

        if (!allowedTransitions.includes(targetStatus)) {
          failed.push({
            id: applicant.id,
            name: `${applicant.learner.lastName}, ${applicant.learner.firstName}`,
            trackingNumber: applicant.trackingNumber ?? "",
            reason: `Cannot transition from "${applicant.status}" to "${targetStatus}"`,
          });
          continue;
        }

        validApplicants.push({
          id: applicant.id,
          type: appType,
          previousStatus: applicant.status,
          name: `${applicant.learner.lastName}, ${applicant.learner.firstName}`,
          trackingNumber: applicant.trackingNumber ?? "",
        });
      }

      // Execute all valid transitions
      if (validApplicants.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const app of validApplicants) {
            if (app.type === "ENROLLMENT") {
              await tx.enrollmentApplication.update({
                where: { id: app.id },
                data: { status: targetStatus },
              });
            } else {
              await tx.earlyRegistrationApplication.update({
                where: { id: app.id },
                data: { status: targetStatus },
              });
            }
          }
        });

        // Record successes and audit logs
        for (const app of validApplicants) {
          succeeded.push({
            id: app.id,
            name: app.name,
            trackingNumber: app.trackingNumber,
            previousStatus: app.previousStatus,
          });

          auditLog({
            userId: req.user!.userId,
            actionType: "STATUS_CHANGED",
            description: `Batch: ${app.name} (#${app.id}) status changed from ${app.previousStatus} to ${targetStatus}`,
            subjectType:
              app.type === "ENROLLMENT"
                ? "EnrollmentApplication"
                : "EarlyRegistrationApplication",
            recordId: app.id,
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
export const getSectionsForAssignment =
  operationsController.getSectionsForAssignment;
export const update = operationsController.update;
export const showDetailed = operationsController.showDetailed;
export const rescheduleAssessmentStep =
  operationsController.rescheduleAssessmentStep;
export const rescheduleExam = operationsController.rescheduleExam;
export const batchProcess = operationsController.batchProcess;
