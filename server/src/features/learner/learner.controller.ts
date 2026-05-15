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
        tleProgram: { select: { name: true } },
        enrollmentRecord: {
          include: {
            tleProgram: { select: { name: true } },
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
              tleProgramName: (application.enrollmentRecord as any).tleProgram?.name ?? null,
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
                tleProgramId: application.tleProgramId ?? null,
                tleProgramName: (application as any).tleProgram?.name ?? null,
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
 * Learner self-confirms return for BOSY.
 * POST /api/learner/confirm-return
 * Body: { applicationId: number, guardianName?: string, tleProgramId?: number, tleProgramChoice2Id?: number }
 */
export const learnerConfirmReturn = async (req: Request, res: Response) => {
  try {
    console.log("[Learner Portal] Incoming request body:", req.body);

    const {
      applicationId,
      tleProgramId,
      guardianName,
      tleProgramChoice2Id,
      confirmAction,
    } =
      req.body as {
        applicationId: unknown;
        tleProgramId?: unknown;
        guardianName?: string;
        tleProgramChoice2Id?: unknown;
        confirmAction?: unknown;
      };

    if (
      confirmAction !== "CONFIRM_RETURN" &&
      confirmAction !== "SUBMIT_TLE_CHOICES"
    ) {
      return res.status(400).json({
        message:
          "Explicit confirmAction is required (CONFIRM_RETURN or SUBMIT_TLE_CHOICES).",
      });
    }

    const id = Number(applicationId);
    if (!Number.isInteger(id) || id <= 0) {
      console.warn("[Learner Portal] Invalid applicationId received:", applicationId);
      return res.status(400).json({ message: "Invalid applicationId." });
    }

    // 1. Fetch Application with Policy Context
    const app = await prisma.enrollmentApplication.findUnique({
      where: { id },
      include: {
        gradeLevel: { select: { displayOrder: true } },
        learner: { 
          select: { 
            firstName: true, 
            lastName: true,
            promotionStatus: true,
            enrollmentRecords: {
               where: { 
                 enrollmentApplication: {
                   gradeLevel: { displayOrder: 9 }
                 }
               },
               take: 1,
               select: { tleProgramId: true } // Explicitly select the ID
            }
          } 
        },
      },
    });

    if (!app) {
      console.warn("[Learner Portal] Application not found for ID:", id);
      return res.status(404).json({ message: "Application not found." });
    }

    // Safety Check: Grade Level
    if (!app.gradeLevel) {
       console.error("[Learner Portal] Integrity Error: Application has no gradeLevel record.");
       return res.status(500).json({ message: "Academic context missing." });
    }

    const gradeOrder = app.gradeLevel.displayOrder;
    const isGrade9 = gradeOrder === 9;
    const isGrade10 = gradeOrder === 10;

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: app.schoolYearId },
    });
    const isBosyEnrollmentOpen = Boolean(
      schoolYear && getEnrollmentPhase(schoolYear) === "REGULAR_ENROLLMENT",
    );

    if (!isBosyEnrollmentOpen) {
      return res.status(403).json({
        message: "BOSY enrollment is currently closed.",
      });
    }

    const previousGradeDisplayOrder =
      typeof gradeOrder === "number" ? gradeOrder - 1 : null;

    const previousGradeRecord =
      previousGradeDisplayOrder != null && previousGradeDisplayOrder >= 7
        ? await prisma.enrollmentRecord.findFirst({
            where: {
              learnerId: app.learnerId,
              enrollmentApplication: {
                gradeLevel: { displayOrder: previousGradeDisplayOrder },
              },
            },
            orderBy: { enrolledAt: "desc" },
            select: { eosyStatus: true },
          })
        : null;

    const priorPromotionStatus =
      previousGradeRecord?.eosyStatus ?? app.learner?.promotionStatus ?? null;

    if (priorPromotionStatus !== "PROMOTED") {
      return res.status(403).json({
        message:
          "Only learners with previous EOSY status PROMOTED can confirm BOSY return.",
      });
    }

    const hasPrimaryTleChoice =
      tleProgramId != null &&
      !isNaN(Number(tleProgramId)) &&
      Number(tleProgramId) > 0;
    const hasFallbackTleChoice =
      tleProgramChoice2Id != null &&
      !isNaN(Number(tleProgramChoice2Id)) &&
      Number(tleProgramChoice2Id) > 0;
    const hasAnyTleChoice = hasPrimaryTleChoice || hasFallbackTleChoice;

    if (confirmAction === "CONFIRM_RETURN") {
      if (hasAnyTleChoice) {
        return res.status(400).json({
          message: "Track choices are not allowed during Stage 1 confirmation.",
        });
      }

      await prisma.enrollmentApplication.update({
        where: { id },
        data: {
          status: "PENDING_CONFIRMATION",
          confirmationConsent: true,
          guardianName: guardianName || undefined,
        },
      });

      if (app.learner) {
        await auditLog({
          userId: req.user?.userId || null,
          actionType: "LEARNER_CONFIRMATION",
          description: `Learner ${app.learner.firstName} ${app.learner.lastName} confirmed BOSY return${guardianName ? ` (Signed by: ${guardianName})` : ""}`,
          subjectType: "EnrollmentApplication",
          recordId: id,
          req,
        });
      }

      return res.json({
        applicationId: id,
        status: "PENDING_CONFIRMATION",
        nextStep: isGrade9 ? "TLE_SELECTION" : "COMPLETE",
      });
    }

    if (!app.confirmationConsent) {
      return res.status(409).json({
        message: "Stage 1 incomplete. Confirm return first before track selection.",
      });
    }

    const isRegularCurriculum = app.applicantType === "REGULAR";

    if (isGrade9 && !isRegularCurriculum) {
      await prisma.enrollmentApplication.update({
        where: { id },
        data: {
          status: "READY_FOR_SECTIONING",
          confirmationConsent: true,
          guardianName: guardianName || undefined,
          tleProgramId: null,
          tleProgramChoice2Id: null,
        },
      });

      if (app.learner) {
        await auditLog({
          userId: req.user?.userId || null,
          actionType: "LEARNER_CONFIRMATION",
          description: `Learner ${app.learner.firstName} ${app.learner.lastName} finalized BOSY confirmation via SCP bypass (${app.applicantType}).`,
          subjectType: "EnrollmentApplication",
          recordId: id,
          req,
        });
      }

      return res.json({
        applicationId: id,
        status: "READY_FOR_SECTIONING",
        bypassedTleSelection: true,
      });
    }

    // 2. MATATAG RULESET ENFORCEMENT
    if (isGrade9) {
      if (!hasPrimaryTleChoice || !hasFallbackTleChoice) {
        return res.status(400).json({ message: "Grade 9 requires both Primary and Fallback choices." });
      }
      if (Number(tleProgramId) === Number(tleProgramChoice2Id)) {
        return res.status(400).json({ message: "Primary and Fallback choices must be unique." });
      }
    }

    if (isGrade10 && hasPrimaryTleChoice) {
      // Safety Check: Learner Enrollment Records
      const g9Record = app.learner?.enrollmentRecords?.[0];
      const prevTleId = g9Record?.tleProgramId;
      
      if (!prevTleId || Number(tleProgramId) !== prevTleId) {
        return res.status(403).json({ 
          message: "Grade 10 must continue their Grade 9 specialization. Track switching is prohibited." 
        });
      }
    }

    // 3. CAPACITY & TRACK VALIDATION
    const validateSpecializationTrack = async (
      programId: number,
      label: "Primary" | "Fallback",
    ) => {
      const selectedTrack = await prisma.tLEProgram.findUnique({
        where: { id: programId },
        select: { id: true, name: true, trackType: true, maxSlots: true }
      });

      if (!selectedTrack || selectedTrack.trackType !== "SPECIALIZATION") {
        return res.status(400).json({ message: "Invalid Specialization Track selected." });
      }

      if (selectedTrack.maxSlots != null) {
        const enrolledCount = await prisma.enrollmentApplication.count({
          where: { 
            tleProgramId: selectedTrack.id, 
            schoolYearId: app.schoolYearId,
            status: {
              in: [
                "READY_FOR_SECTIONING",
                "TEMPORARILY_ENROLLED",
                "ENROLLED",
                "OFFICIALLY_ENROLLED",
              ],
            },
          }
        });
        
        const availableSlots = selectedTrack.maxSlots - enrolledCount;
        if (app.tleProgramId !== selectedTrack.id && availableSlots <= 0) {
          return res.status(409).json({ message: `The ${label} track '${selectedTrack.name}' has no available slots.` });
        }
      }

      return null;
    };

    if (hasPrimaryTleChoice) {
      const trackValidationError = await validateSpecializationTrack(
        Number(tleProgramId),
        "Primary",
      );
      if (trackValidationError) {
        return trackValidationError;
      }
    }

    if (hasFallbackTleChoice) {
      const trackValidationError = await validateSpecializationTrack(
        Number(tleProgramChoice2Id),
        "Fallback",
      );
      if (trackValidationError) {
        return trackValidationError;
      }
    }

    if (
      app.status !== "PENDING_CONFIRMATION" &&
      app.status !== "READY_FOR_SECTIONING"
    ) {
       return res.status(409).json({
         message: `Application is already in status '${app.status}'.`,
       });
    }

    // Update the application
    try {
      await prisma.enrollmentApplication.update({
        where: { id },
        data: {
          status: "READY_FOR_SECTIONING",
          confirmationConsent: true,
          guardianName: guardianName || undefined,
          ...(hasPrimaryTleChoice ? { tleProgramId: Number(tleProgramId) } : {}),
          ...(hasFallbackTleChoice
            ? { tleProgramChoice2Id: Number(tleProgramChoice2Id) }
            : {}),
        },
      });
    } catch (dbError) {
      console.error("[Learner Portal] Database Update Failed:", dbError);
      return res.status(500).json({ message: "Failed to save academic choices." });
    }

    // 4. Log the digital acknowledgment
    if (app.learner) {
      try {
        await auditLog({
          userId: req.user?.userId || null,
          actionType: "LEARNER_CONFIRMATION",
          description: `Learner ${app.learner.firstName} ${app.learner.lastName} submitted TLE specialization choices${guardianName ? ` (Signed by: ${guardianName})` : ""}`,
          subjectType: "EnrollmentApplication",
          recordId: id,
          req,
        });
      } catch (logError) {
        console.warn("[Learner Portal] Audit Log Failed (Non-Critical):", logError);
      }
    }

    return res.json({ applicationId: id, status: "READY_FOR_SECTIONING" });
  } catch (error) {
    console.error("[Learner Portal] Critical failure in confirm-return:", error);
    return res.status(500).json({ message: "Could not confirm return due to policy validation error." });
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
 * GET /api/learner/tle-options/:gradeLevelId
 * Returns dynamic TLE track options based on DepEd curriculum rules for the grade level.
 */
export const getTLEOptions = async (req: Request, res: Response) => {
  try {
    const gradeLevelId = parseInt(req.params.gradeLevelId as string);
    const userId = req.user!.userId;

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: gradeLevelId },
    });

    if (!gradeLevel) {
      return res.status(404).json({ message: "Grade level not found." });
    }

    const order = gradeLevel.displayOrder;

    // Phase 1: Exploratory (Grades 7 & 8)
    if (order === 7 || order === 8) {
      return res.json({
        phase: "EXPLORATORY",
        message: "Exploratory Phase - No NC II Selection Required.",
        options: [],
      });
    }

    // Phase 2: Specialization Selection (Grade 9)
    if (order === 9) {
      const options = await prisma.tLEProgram.findMany({
        where: { trackType: "SPECIALIZATION", isActive: true },
        orderBy: { displayOrder: "asc" },
      });

      const schoolYear = await prisma.schoolYear.findFirst({
        where: { status: { in: ["ACTIVE", "ENROLLMENT_OPEN", "BOSY_LOCKED"] } },
        orderBy: { id: "desc" },
        select: { id: true },
      });

      const programsWithCapacity = await Promise.all(
        options.map(async (program) => {
          if (program.maxSlots == null) {
            return {
              id: program.id,
              name: program.name,
              category: program.trackType,
              availableSlots: null,
            };
          }

          const takenSlots = await prisma.enrollmentApplication.count({
            where: {
              tleProgramId: program.id,
              ...(schoolYear ? { schoolYearId: schoolYear.id } : {}),
              status: {
                in: [
                  "READY_FOR_SECTIONING",
                  "TEMPORARILY_ENROLLED",
                  "ENROLLED",
                  "OFFICIALLY_ENROLLED",
                ],
              },
            },
          });

          return {
            id: program.id,
            name: program.name,
            category: program.trackType,
            availableSlots: Math.max(program.maxSlots - takenSlots, 0),
          };
        }),
      );

      return res.json({
        phase: "SPECIALIZATION",
        options: programsWithCapacity,
      });
    }

    // Phase 3: Continuity (Grade 10)
    if (order === 10) {
      // Find the learner first
      const learner = await prisma.learner.findFirst({
        where: { userId },
      });

      if (!learner) {
        return res.status(404).json({ message: "Learner not found." });
      }

      // Look for the Grade 9 enrollment record to find the locked track
      const prevRecord = await prisma.enrollmentRecord.findFirst({
        where: {
          learnerId: learner.id,
          enrollmentApplication: {
            gradeLevel: { displayOrder: 9 },
          },
        },
        include: {
          tleProgram: true,
        },
      });

      if (!prevRecord || !prevRecord.tleProgram) {
        // Fallback: Check the latest application if record is missing (though should exist)
        const prevApp = await prisma.enrollmentApplication.findFirst({
          where: {
            learnerId: learner.id,
            gradeLevel: { displayOrder: 9 },
            tleProgramId: { not: null },
          },
          include: {
            tleProgram: true,
          },
          orderBy: { schoolYearId: "desc" },
        });

        if (prevApp?.tleProgram) {
          return res.json({
            phase: "CONTINUITY",
            lockedProgram: prevApp.tleProgram,
          });
        }

        return res.json({
          phase: "CONTINUITY_MISSING_TRACK",
          message: "Could not find your locked Grade 9 specialization. Please contact the Registrar.",
        });
      }

      return res.json({
        phase: "CONTINUITY",
        lockedProgram: prevRecord.tleProgram,
      });
    }

    return res.json({ phase: "UNKNOWN", options: [] });
  } catch (error) {
    console.error("getTLEOptions failed:", error);
    return res.status(500).json({ message: "Error fetching TLE options." });
  }
};

/**
 * GET /api/learner/onboarding-status
 * Evaluates the learner's application state to determine their position in the onboarding tunnel.
 */
export const getOnboardingStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const learner = await prisma.learner.findFirst({
      where: { userId },
      include: {
        enrollmentApplications: {
          orderBy: { schoolYearId: "desc" },
          take: 1,
          include: {
            gradeLevel: { select: { displayOrder: true } },
            schoolYear: true,
          },
        },
      },
    });

    if (!learner) {
      return res.status(404).json({ message: "Learner profile not found." });
    }

    const application = learner.enrollmentApplications[0];

    // If no application for the new year exists, we assume they are already on the dashboard
    // (or they haven't been triggered for promotion yet).
    if (!application) {
      return res.json({ nextStep: "COMPLETE" });
    }

    // If BOSY is closed or this year is already EOSY-finalized,
    // do not force the learner through onboarding tunnel.
    const isBosyEnrollmentOpen = Boolean(
      application.schoolYear &&
        getEnrollmentPhase(application.schoolYear) === "REGULAR_ENROLLMENT",
    );

    if (!isBosyEnrollmentOpen || application.schoolYear?.isEosyFinalized) {
      return res.json({ nextStep: "COMPLETE" });
    }

    // Gate 1: Intent Confirmation (The Wall)
    if (
      application.status === "PENDING_CONFIRMATION" &&
      !application.confirmationConsent
    ) {
      return res.json({ nextStep: "CONFIRMATION" });
    }

    // Gate 2: TLE Selection (Grade 9 Choice & Grade 10 Continuity)
    const isSpecializationGrade =
      application.gradeLevel?.displayOrder === 9 ||
      application.gradeLevel?.displayOrder === 10;
    const requiresTleSelection =
      isSpecializationGrade && application.applicantType === "REGULAR";

    if (
      requiresTleSelection &&
      application.confirmationConsent &&
      !application.tleProgramId
    ) {
      return res.json({ nextStep: "TLE_SELECTION" });
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
          take: 5,
          include: {
            addresses: true,
            gradeLevel: { select: { name: true, displayOrder: true } },
            schoolYear: { select: { id: true, yearLabel: true } },
            tleProgram: { select: { name: true } },
            enrollmentRecord: {
              include: {
                tleProgram: { select: { name: true } },
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
    const addressSourceApplication =
      learner.enrollmentApplications.find((app) =>
        app.addresses.some((a: any) => a.addressType === "CURRENT"),
      ) ?? null;

    const currentAddress =
      addressSourceApplication?.addresses.find(
        (a: any) => a.addressType === "CURRENT",
      ) ?? null;

    const healthRecords = await prisma.healthRecord.findMany({
      where: { learnerId: learner.id },
      include: { schoolYear: { select: { yearLabel: true } } },
      orderBy: [{ assessmentDate: "desc" }, { assessmentPeriod: "asc" }],
    });

    const activeAdviser =
      (application?.enrollmentRecord?.section as any)?.advisers?.[0]?.teacher ??
      null;

    const previousGradeDisplayOrder =
      application?.gradeLevel?.displayOrder != null
        ? application.gradeLevel.displayOrder - 1
        : null;

    const previousGradeRecord =
      previousGradeDisplayOrder != null && previousGradeDisplayOrder >= 7
        ? await prisma.enrollmentRecord.findFirst({
            where: {
              learnerId: learner.id,
              enrollmentApplication: {
                gradeLevel: { displayOrder: previousGradeDisplayOrder },
              },
            },
            orderBy: { enrolledAt: "desc" },
            select: { eosyStatus: true },
          })
        : null;

    const previousEosyStatus =
      previousGradeRecord?.eosyStatus ?? learner.promotionStatus ?? null;

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
              tleProgramName: (application.enrollmentRecord as any).tleProgram?.name ?? null,
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
                tleProgramId: application.tleProgramId ?? null,
                tleProgramName: (application as any).tleProgram?.name ?? null,
                guardianName: application.guardianName ?? null,
                previousEosyStatus,
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
