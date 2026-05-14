import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";
import { verifyPin } from "./portal-pin.service.js";

const PORTAL_LOOKUP_ERROR = "Invalid learner credentials.";

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

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
          take: 1,
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

    const latestApp = learner.enrollmentApplications[0];

    return res.json({
      id: learner.id,
      lrn: learner.lrn,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleName: learner.middleName,
      previousGradeLevel: latestApp?.gradeLevel.name ?? "N/A",
      previousSection: latestApp?.enrollmentRecord?.section?.name ?? "N/A",
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
        schoolYear: { select: { yearLabel: true } },
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
        curriculum: application.applicantType, // Ensure this is correctly assigned
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
          application.status === "PENDING_CONFIRMATION"
            ? {
                applicationId: application.id,
                status: application.status,
                gradeLevelDisplayOrder:
                  application.gradeLevel.displayOrder ?? null,
                tleProgramId: application.tleProgramId ?? null,
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
 * Learner self-confirms return for BOSY.
 * POST /api/learner/confirm-return
 * Body: { applicationId: number }
 */
export const learnerConfirmReturn = async (req: Request, res: Response) => {
  try {
    const { applicationId, tleProgramId } = req.body as {
      applicationId: unknown;
      tleProgramId?: unknown;
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
        learnerId: true,
        gradeLevel: { select: { displayOrder: true } },
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

    const requiresTle = [9, 10].includes(app.gradeLevel?.displayOrder ?? 0);
    const resolvedTleProgramId =
      tleProgramId != null ? Number(tleProgramId) : null;

    if (requiresTle && !resolvedTleProgramId) {
      return res.status(422).json({
        message:
          "TLE program selection is required for Grade 9 and Grade 10 learners.",
      });
    }

    await prisma.enrollmentApplication.update({
      where: { id },
      data: {
        status: "READY_FOR_SECTIONING",
        confirmationConsent: true,
        ...(requiresTle && resolvedTleProgramId
          ? { tleProgramId: resolvedTleProgramId }
          : {}),
      },
    });

    return res.json({ applicationId: id, status: "READY_FOR_SECTIONING" });
  } catch (error) {
    console.error("Learner confirm-return failed:", error);
    return res.status(500).json({ message: "Could not confirm return." });
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
        addresses: true,
        enrollmentApplications: {
          orderBy: { schoolYearId: "desc" },
          take: 1,
          include: {
            gradeLevel: { select: { name: true, displayOrder: true } },
            schoolYear: { select: { yearLabel: true } },
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
    const currentAddress =
      learner.addresses.find((a) => a.addressType === "CURRENT") ?? null;

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
          application?.status === "PENDING_CONFIRMATION"
            ? {
                applicationId: application.id,
                status: application.status,
                gradeLevelDisplayOrder:
                  application.gradeLevel.displayOrder ?? null,
                tleProgramId: application.tleProgramId ?? null,
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
