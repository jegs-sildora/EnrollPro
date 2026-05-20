import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { verifyPin } from "./portal-pin.service.js";
import { getEnrollmentPhase } from "../settings/enrollment-gate.service.js";

const PORTAL_LOOKUP_ERROR = "Invalid learner credentials.";

/**
 * Rapid lookup for Registrars using only LRN.
 * GET /api/learner/lookup?lrn={LRN}
 */
export const lookupLearnerByLrn = async (req: Request, res: Response) => {
  try {
    const { lrn } = req.query as { lrn: string };

    if (!lrn || lrn.length !== 12) {
      return res
        .status(400)
        .json({ message: "Invalid LRN format. Exactly 12 digits required." });
    }

    const learner = await prisma.learner.findUnique({
      where: { lrn },
      include: {
        enrollmentApplications: {
          orderBy: { schoolYearId: "desc" },
          take: 2, // Fetch two to handle source vs target year
          include: {
            gradeLevel: true,
            enrollmentRecord: {
              include: {
                section: true,
              },
            },
          },
        },
      },
    });

    if (!learner) {
      return res.status(404).json({ message: "Learner not found." });
    }

    const applications = learner.enrollmentApplications;
    const latestApp = applications[0];
    
    // Find the record that actually has a section (the historical/enrolled one)
    const officialRecord = applications.find(app => 
      app.enrollmentRecord?.section?.name && 
      ["OFFICIALLY_ENROLLED", "ENROLLED"].includes(app.status)
    );

    // Determine Grade Level to Enroll
    let gradeLevelToEnroll = "N/A";
    if (latestApp) {
      if (
        ["OFFICIALLY_ENROLLED", "ENROLLED"].includes(latestApp.status) ||
        (latestApp as any).eosyStatus === "PROMOTED"
      ) {
        const numMatch = latestApp.gradeLevel.name.match(/\d+/);
        if (numMatch) {
          const nextGradeNum = parseInt(numMatch[0]) + 1;
          gradeLevelToEnroll = `Grade ${nextGradeNum}`;
        }
      } else {
        gradeLevelToEnroll = latestApp.gradeLevel.name;
      }
    }

    return res.json({
      id: learner.id,
      lrn: learner.lrn,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleName: learner.middleName,
      gradeLevelToEnroll,
      previousSection: officialRecord?.enrollmentRecord?.section?.name ?? null,
      previousGenAve: learner.previousGenAve,
      promotionStatus: learner.promotionStatus,
      studentPhoto: learner.studentPhoto,
    });
  } catch (error) {
    console.error("Registrar learner lookup failed:", error);
    return res
      .status(500)
      .json({ message: "Error performing learner lookup." });
  }
};

/**
 * Lookup learner records using LRN and Password.
 * POST /api/learner/lookup
 */
export const lookupLearner = async (req: Request, res: Response) => {
  try {
    const { lrn, password } = req.body as {
      lrn: string;
      password: string;
    };

    const application = await prisma.enrollmentApplication.findFirst({
      where: {
        portalPin: { not: null },
        OR: [{ learner: { lrn: lrn } }, { trackingNumber: lrn }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        learner: true,
        addresses: true,
        gradeLevel: { select: { name: true, displayOrder: true } },
        schoolYear: { select: { id: true, yearLabel: true } },
        enrollmentRecord: {
          include: {
            section: {
              include: {
                advisers: {
                  where: { status: "ACTIVE" },
                  include: {
                    teacher: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!application || !application.portalPin) {
      return res.status(401).json({ message: PORTAL_LOOKUP_ERROR });
    }

    const passwordMatch = await verifyPin(password, application.portalPin);
    if (!passwordMatch) {
      return res.status(401).json({ message: PORTAL_LOOKUP_ERROR });
    }

    const currentAddress =
      application.addresses.find(
        (address) => address.addressType === "CURRENT",
      ) ?? null;

    const healthRecords = await prisma.healthRecord.findMany({
      where: { learnerId: application.learnerId },
      include: {
        schoolYear: { select: { yearLabel: true } },
      },
      orderBy: [{ assessmentDate: "desc" }, { assessmentPeriod: "asc" }],
    });

    const activeAdviser =
      (application.enrollmentRecord?.section as any)?.advisers?.[0]?.teacher ??
      null;

    return res.json({
      learner: {
        id: application.learner.id,
        lrn: application.learner.lrn,
        firstName: application.learner.firstName,
        lastName: application.learner.lastName,
        middleName: application.learner.middleName,
        suffix: application.learner.extensionName,
        birthDate: application.learner.birthdate,
        sex: application.learner.sex === "MALE" ? "Male" : "Female",
        motherTongue: application.learner.motherTongue,
        religion: application.learner.religion,
        status: application.status,
        curriculum: application.applicantType,
        studentPhoto: application.learner.studentPhoto,
        currentAddress: currentAddress
          ? {
              houseNumber: currentAddress.houseNoStreet,
              street: currentAddress.street,
              barangay: currentAddress.barangay,
              municipality: currentAddress.cityMunicipality,
              province: currentAddress.province,
            }
          : null,
        enrollment: application.enrollmentRecord
          ? {
              curriculum: application.applicantType,

              section: application.enrollmentRecord.section
                ? {
                    name: application.enrollmentRecord.section.name,
                    advisingTeacher: activeAdviser
                      ? {
                          firstName: activeAdviser.firstName,
                          lastName: activeAdviser.lastName,
                        }
                      : null,
                  }
                : null,
            }
          : null,
        schoolYear: application.schoolYear,
        gradeLevel: application.gradeLevel,
        healthRecords: healthRecords.map((record) => ({
          id: record.id,
          schoolYear: record.schoolYear.yearLabel,
          assessmentPeriod: record.assessmentPeriod,
          assessmentDate: record.assessmentDate,
          weightKg: record.weightKg,
          heightCm: record.heightCm,
          notes: record.notes,
        })),
        pendingConfirmation:
          application.status === "PENDING_CONFIRMATION" ||
          application.status === "READY_FOR_SECTIONING"
            ? {
                applicationId: application.id,
                status: application.status,
                gradeLevelName: application.gradeLevel.name,
                gradeLevelDisplayOrder:
                  application.gradeLevel.displayOrder ?? null,
                guardianName: application.guardianName ?? null,
              }
            : null,
      },
    });
  } catch (error) {
    console.error("Learner portal lookup failed:", error);
    return res
      .status(500)
      .json({ message: "Unable to process learner lookup right now." });
  }
};

/**
 * Learner self-confirms return for BOSY (Phase 2 only — no TLE).
 * POST /api/learner/confirm-return
 * Body: { applicationId: number, guardianName?: string }
 */
export const learnerConfirmReturn = async (req: Request, res: Response) => {
  try {
    const { applicationId, guardianName } = req.body as {
      applicationId: unknown;
      guardianName?: string;
    };

    const id = Number(applicationId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid applicationId." });
    }

    const app = await prisma.enrollmentApplication.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        learner: { select: { firstName: true, lastName: true } },
      },
    });

    if (!app) {
      return res.status(404).json({ message: "Application not found." });
    }

    if (app.status !== "PENDING_CONFIRMATION") {
      return res.status(409).json({
        message: `Application is already in status '${app.status}'.`,
      });
    }

    await prisma.enrollmentApplication.update({
      where: { id },
      data: {
        status: "READY_FOR_SECTIONING",
        confirmationConsent: true,
        guardianName: guardianName || undefined,
      },
    });

    if (app.learner) {
      await auditLog({
        userId: req.user?.userId || null,
        actionType: "LEARNER_CONFIRMATION",
        description: `Learner ${app.learner.firstName} ${app.learner.lastName} confirmed return for BOSY${guardianName ? ` (Guardian: ${guardianName})` : ""}`,
        subjectType: "EnrollmentApplication",
        recordId: id,
        req,
      });
    }

    return res.json({ applicationId: id, status: "READY_FOR_SECTIONING" });
  } catch (error) {
    console.error("[Learner Portal] Critical failure in confirm-return:", error);
    return res.status(500).json({ message: "Could not confirm return." });
  }
};

/**
 * Learner requests transfer out.
 * POST /api/learner/request-transfer
 * Body: { applicationId: number, reason?: string }
 */
export const learnerRequestTransfer = async (req: Request, res: Response) => {
  try {
    const { applicationId, reason } = req.body as {
      applicationId: unknown;
      reason?: string;
    };

    const id = Number(applicationId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid applicationId." });
    }

    const app = await prisma.enrollmentApplication.findUnique({
      where: { id },
      select: {
        id: true,
        learnerId: true,
        learner: { select: { firstName: true, lastName: true } },
      },
    });

    if (!app) {
      return res.status(404).json({ message: "Application not found." });
    }

    await prisma.enrollmentApplication.update({
      where: { id },
      data: {
        status: "TRANSFERRED_OUT",
        rejectionReason: reason || "Requested transfer via Learner Portal",
      },
    });

    await auditLog({
      userId: req.user?.userId || null,
      actionType: "LEARNER_TRANSFER_REQUEST",
      description: `Learner ${app.learner.firstName} ${app.learner.lastName} requested transfer out. Reason: ${reason || "N/A"}`,
      subjectType: "EnrollmentApplication",
      recordId: id,
      req,
    });

    return res.json({ success: true, message: "Transfer request recorded." });
  } catch (error) {
    console.error("Learner request-transfer failed:", error);
    return res.status(500).json({ message: "Could not process transfer request." });
  }
};

/**
 * GET /api/learner/onboarding-status
 * Evaluates the learner's application state to determine their position in the onboarding tunnel.
 */
export const getOnboardingStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Resolve active school year similarly to settings/public.
    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    let activeSy = settings?.activeSchoolYear ?? null;
    if (!activeSy) {
      activeSy = await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
    }

    // No active school year means no onboarding tunnel.
    if (!activeSy) {
      return res.json({ nextStep: "COMPLETE" });
    }

    // BOSY wall should only be enforced during REGULAR_ENROLLMENT.
    const enrollmentPhase = getEnrollmentPhase(activeSy);
    const isBosyEnrollmentOpen = enrollmentPhase === "REGULAR_ENROLLMENT";
    if (!isBosyEnrollmentOpen) {
      return res.json({ nextStep: "COMPLETE" });
    }

    const learner = await prisma.learner.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!learner) {
      return res.status(404).json({ message: "Learner profile not found." });
    }

    const application = await prisma.enrollmentApplication.findFirst({
      where: {
        learnerId: learner.id,
        schoolYearId: activeSy.id,
      },
      include: {
        gradeLevel: { select: { displayOrder: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    // If no application for the new year exists, we assume they are already on the dashboard
    // (or they haven't been triggered for promotion yet).
    if (!application) {
      return res.json({ nextStep: "COMPLETE" });
    }

    // Gate 1: Intent Confirmation (The Wall)
    if (application.status === "PENDING_CONFIRMATION") {
      return res.json({ nextStep: "CONFIRMATION" });
    }

    // All gates cleared
    return res.json({ nextStep: "COMPLETE" });
  } catch (error) {
    console.error("getOnboardingStatus failed:", error);
    return res
      .status(500)
      .json({ message: "Error evaluating onboarding status." });
  }
};

/**
 * GET /api/learner/profile
 * Returns the authenticated learner's profile (same shape as lookupLearner).
 * Requires JWT with role=LEARNER.
 */
export const getLearnerProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const learner = await prisma.learner.findFirst({
      where: { userId },
      include: {
        enrollmentApplications: {
          orderBy: { schoolYearId: "desc" },
          take: 2,
          include: {
            addresses: true,
            gradeLevel: { select: { name: true, displayOrder: true } },
            schoolYear: { select: { id: true, yearLabel: true } },
            enrollmentRecord: {
              include: {
                section: {
                  include: {
                    advisers: {
                      where: { status: "ACTIVE" },
                      include: {
                        teacher: {
                          select: { firstName: true, lastName: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!learner) {
      return res.status(404).json({ message: "Learner profile not found." });
    }

    const application = learner.enrollmentApplications[0] ?? null;
    const previousApplication = learner.enrollmentApplications[1] ?? null;
    const currentAddress =
      application?.addresses.find((a: any) => a.addressType === "CURRENT") ??
      null;

    const healthRecords = await prisma.healthRecord.findMany({
      where: { learnerId: learner.id },
      include: { schoolYear: { select: { yearLabel: true } } },
      orderBy: [{ assessmentDate: "desc" }, { assessmentPeriod: "asc" }],
    });

    const activeAdviser =
      (application?.enrollmentRecord?.section as any)?.advisers?.[0]?.teacher ??
      null;

    return res.json({
      learner: {
        id: learner.id,
        lrn: learner.lrn,
        firstName: learner.firstName,
        lastName: learner.lastName,
        middleName: learner.middleName,
        suffix: learner.extensionName,
        birthDate: learner.birthdate,
        sex: learner.sex === "MALE" ? "Male" : "Female",
        motherTongue: learner.motherTongue,
        religion: learner.religion,
        status: application?.status ?? null,
        curriculum: application?.applicantType ?? null,
        studentPhoto: learner.studentPhoto,
        currentAddress: currentAddress
          ? {
              houseNumber: currentAddress.houseNoStreet,
              street: currentAddress.street,
              barangay: currentAddress.barangay,
              municipality: currentAddress.cityMunicipality,
              province: currentAddress.province,
            }
          : null,
        enrollment: application?.enrollmentRecord
          ? {
              curriculum: application.applicantType,
              section: application.enrollmentRecord.section
                ? {
                    name: application.enrollmentRecord.section.name,
                    advisingTeacher: activeAdviser
                      ? {
                          firstName: activeAdviser.firstName,
                          lastName: activeAdviser.lastName,
                        }
                      : null,
                  }
                : null,
            }
          : null,
        schoolYear: application?.schoolYear ?? null,
        gradeLevel: application?.gradeLevel ?? null,
        healthRecords: healthRecords.map((r) => ({
          id: r.id,
          schoolYear: r.schoolYear.yearLabel,
          assessmentPeriod: r.assessmentPeriod,
          assessmentDate: r.assessmentDate,
          weightKg: r.weightKg,
          heightCm: r.heightCm,
          notes: r.notes,
        })),
        pendingConfirmation:
          application?.status === "PENDING_CONFIRMATION" ||
          application?.status === "READY_FOR_SECTIONING"
            ? {
                applicationId: application.id,
                status: application.status,
                gradeLevelId: application.gradeLevelId,
                gradeLevelName: application.gradeLevel.name,
                gradeLevelDisplayOrder:
                  application.gradeLevel.displayOrder ?? null,
                guardianName: application.guardianName ?? null,
                previousEosyStatus:
                  previousApplication?.enrollmentRecord?.eosyStatus ?? null,
              }
            : null,
      },
    });
  } catch (error) {
    console.error("getLearnerProfile failed:", error);
    return res.status(500).json({ message: "Error fetching learner profile." });
  }
};

/**
 * GET /api/learner/academic-history
 * Returns all enrollment applications for the authenticated learner, ordered by school year desc.
 * Requires JWT with role=LEARNER.
 */
export const getLearnerAcademicHistory = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;

    const learner = await prisma.learner.findFirst({ where: { userId } });
    if (!learner) {
      return res.status(404).json({ message: "Learner not found." });
    }

    const applications = await prisma.enrollmentApplication.findMany({
      where: { learnerId: learner.id },
      orderBy: { schoolYearId: "desc" },
      include: {
        schoolYear: { select: { id: true, yearLabel: true } },
        gradeLevel: { select: { id: true, name: true } },
        enrollmentRecord: {
          select: {
            finalAverage: true,
            eosyStatus: true,
            section: { select: { id: true, name: true } },
          },
        },
      },
    });

    const history = applications.map((app) => ({
      id: app.id,
      schoolYear: app.schoolYear,
      gradeLevel: app.gradeLevel,
      status: app.status,
      applicantType: app.applicantType,
      enrollmentRecord: app.enrollmentRecord
        ? {
            section: app.enrollmentRecord.section,
            finalAverage: app.enrollmentRecord.finalAverage,
            eosyStatus: app.enrollmentRecord.eosyStatus,
          }
        : null,
    }));

    return res.json({ history });
  } catch (error) {
    console.error("getLearnerAcademicHistory failed:", error);
    return res
      .status(500)
      .json({ message: "Error fetching academic history." });
  }
};
