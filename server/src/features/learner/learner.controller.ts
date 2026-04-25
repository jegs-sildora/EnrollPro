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
      return res.status(400).json({ message: "Invalid LRN format. Exactly 12 digits required." });
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
    return res.status(500).json({ message: "Error performing learner lookup." });
  }
};

/**
 * Lookup learner records using LRN, Birthdate, and PIN.
 * POST /api/learner/lookup
 */
export const lookupLearner = async (req: Request, res: Response) => {
  try {
    const { lrn, birthDate, pin } = req.body as {
      lrn: string;
      birthDate: string;
      pin: string;
    };

    const normalizedBirthDate = normalizeDateToUtcNoon(new Date(birthDate));
    if (Number.isNaN(normalizedBirthDate.getTime())) {
      return res.status(401).json({ message: PORTAL_LOOKUP_ERROR });
    }

    const application = await prisma.enrollmentApplication.findFirst({
      where: {
        status: "ENROLLED",
        portalPin: { not: null },
        learner: { lrn },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        learner: true,
        addresses: true,
        gradeLevel: { select: { name: true } },
        schoolYear: { select: { yearLabel: true } },
        enrollmentRecord: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: { firstName: true, lastName: true },
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

    const inputBirthDate = toDateOnly(normalizedBirthDate);
    const learnerBirthDate = toDateOnly(application.learner.birthdate);
    if (learnerBirthDate !== inputBirthDate) {
      return res.status(401).json({ message: PORTAL_LOOKUP_ERROR });
    }

    const pinMatch = await verifyPin(pin, application.portalPin);
    if (!pinMatch) {
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
              section: application.enrollmentRecord.section
                ? {
                    name: application.enrollmentRecord.section.name,
                    advisingTeacher: application.enrollmentRecord.section
                      .advisingTeacher
                      ? {
                          firstName:
                            application.enrollmentRecord.section.advisingTeacher
                              .firstName,
                          lastName:
                            application.enrollmentRecord.section.advisingTeacher
                              .lastName,
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
      },
    });
  } catch (error) {
    console.error("Learner portal lookup failed:", error);
    return res
      .status(500)
      .json({ message: "Unable to process learner lookup right now." });
  }
};
