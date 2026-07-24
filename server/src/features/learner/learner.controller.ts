import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import type { LearnerAuthPayload } from "../../middleware/authenticate-learner.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN: jwt.SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "24h";

function computeSchoolAcronym(schoolName: string): string {
  return schoolName
    .replace(/\b(?:de|del|dela|of|the|and|ng|mga|at)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4) || "EP";
}

async function getLearnerEnrollmentData(learnerId: number) {
  const apps = await prisma.enrollmentApplication.findMany({
    where: { learnerId },
    orderBy: { schoolYearId: "desc" },
    take: 1,
    include: {
      gradeLevel: true,
      enrollmentRecord: {
        include: { section: true },
      },
    },
  });
  const app = apps[0];
  return {
    gradeLevelName: app?.gradeLevel?.name ?? null,
    sectionName: app?.enrollmentRecord?.section?.name ?? null,
    enrollmentStatus: app?.status ?? null,
  };
}

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
          take: 2,
          include: {
            gradeLevel: true,
            familyMembers: true,
            previousSchool: true,
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

    const officialRecord = applications.find(app =>
      app.enrollmentRecord?.section?.name &&
      app.status === "OFFICIALLY_ENROLLED"
    );

    let gradeLevelToEnroll = "N/A";
    if (latestApp) {
      if (
        latestApp.status === "OFFICIALLY_ENROLLED"
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
      birthdate: learner.birthdate,
      sex: learner.sex,
      gradeLevelToEnroll,
      previousSection: officialRecord?.enrollmentRecord?.section?.name ?? null,
      previousGenAve: learner.previousGenAve,
      promotionStatus: learner.promotionStatus,
      studentPhoto: learner.studentPhoto,
      familyMembers: latestApp?.familyMembers ?? [],
      previousSchool: latestApp?.previousSchool ?? null,
    });
  } catch (error) {
    console.error("Registrar learner lookup failed:", error);
    return res
      .status(500)
      .json({ message: "Error performing learner lookup." });
  }
};

/**
 * Authenticate a learner using their LRN and password.
 * POST /api/learner/auth
 */
export async function learnerLogin(req: Request, res: Response): Promise<void> {
  const { lrn, password } = req.body as { lrn: string; password: string };

  const learner = await prisma.learner.findUnique({ where: { lrn } });
  if (!learner) {
    res.status(401).json({ code: "INVALID_LRN", message: "Invalid LRN or password." });
    return;
  }

  if (!JWT_SECRET) {
    throw new AppError(500, "JWT secret is not configured.", "JWT_SECRET_MISSING");
  }

  let user = learner.userId
    ? await prisma.user.findUnique({ where: { id: learner.userId } })
    : null;

  const DEFAULT_LEARNER_PASSWORD = "DepEd2026!";
  let isDefaultPassword = false;
  let passwordValid = false;

  if (user) {
    passwordValid = await bcrypt.compare(password, user.password);
  }

  if (!passwordValid && password === DEFAULT_LEARNER_PASSWORD) {
    isDefaultPassword = true;
    passwordValid = true;

    const hashed = await bcrypt.hash(password, 12);
    const accountName = `LRN-${learner.lrn}`;

    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName: learner.firstName,
          lastName: learner.lastName,
          accountName,
          password: hashed,
          roles: ["LEARNER"],
          mustChangePassword: true,
          sex: learner.sex,
          isActive: true,
        },
      });
      await prisma.learner.update({
        where: { id: learner.id },
        data: { userId: user.id },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, mustChangePassword: true },
      });
    }
  }

  if (!passwordValid) {
    res.status(401).json({ code: "INVALID_PASSWORD", message: "Invalid LRN or password." });
    return;
  }

  if (!user) {
    res.status(500).json({ code: "SERVER_ERROR", message: "Authentication failed." });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({
      code: "ACCOUNT_INACTIVE",
      message: "Your account has been deactivated. Contact your Class Adviser.",
    });
    return;
  }

  const requiresPasswordReset = isDefaultPassword || user.mustChangePassword;

  const [enrollment, schoolSetting] = await Promise.all([
    getLearnerEnrollmentData(learner.id),
    prisma.schoolSetting.findFirst({ select: { schoolName: true } }),
  ]);

  const schoolName = schoolSetting?.schoolName || "EnrollPro";
  const schoolAcronym = computeSchoolAcronym(schoolName);

  const token = jwt.sign(
    {
      learnerId: learner.id,
      lrn: learner.lrn,
      role: "learner",
      requiresPasswordReset,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  res.json({
    token,
    requiresPasswordReset,
    schoolName,
    schoolAcronym,
    gradeLevelName: enrollment.gradeLevelName,
    sectionName: enrollment.sectionName,
    learner: {
      id: learner.id,
      lrn: learner.lrn,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleName: learner.middleName,
    },
  });
}

/**
 * Set a new password for the authenticated learner.
 * POST /api/learner/setup-password
 */
export async function learnerSetupPassword(req: Request, res: Response): Promise<void> {
  const learnerPayload = req.learner;
  if (!learnerPayload) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized." });
    return;
  }

  const { newPassword } = req.body as { newPassword: string };

  const learner = await prisma.learner.findUnique({
    where: { id: learnerPayload.learnerId },
    select: { userId: true, lrn: true },
  });

  if (!learner || !learner.userId) {
    res.status(404).json({ code: "NOT_FOUND", message: "Learner account not found." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: learner.userId } });
  if (!user) {
    res.status(404).json({ code: "NOT_FOUND", message: "User account not found." });
    return;
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    res.status(400).json({
      code: "SAME_PASSWORD",
      message: "New password cannot be the same as your current password.",
    });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where: { id: learner.userId },
    data: {
      password: hashed,
      mustChangePassword: false,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      mustChangePassword: true,
      isActive: true,
    },
  });

  if (!JWT_SECRET) {
    throw new AppError(500, "JWT secret is not configured.", "JWT_SECRET_MISSING");
  }

  const token = jwt.sign(
    {
      learnerId: learnerPayload.learnerId,
      lrn: learnerPayload.lrn,
      role: "learner",
      requiresPasswordReset: false,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  res.json({
    token,
    requiresPasswordReset: false,
    learner: {
      id: learnerPayload.learnerId,
      lrn: learnerPayload.lrn,
    },
  });
}

/**
 * Get unified dashboard data for the authenticated learner.
 * GET /api/learner/dashboard-unified
 */
export async function getLearnerDashboardUnified(req: Request, res: Response): Promise<void> {
  const learnerPayload = req.learner as LearnerAuthPayload | undefined;
  if (!learnerPayload) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized." });
    return;
  }

  const schoolSetting = await prisma.schoolSetting.findFirst({
    select: {
      activeSchoolYearId: true,
      systemPhase: true,
      schoolName: true,
      logoUrl: true,
      activeSchoolYear: {
        select: { yearLabel: true },
      },
    },
  });

  if (!schoolSetting?.activeSchoolYearId) {
    res.status(400).json({ code: "NO_ACTIVE_SY", message: "No active school year found." });
    return;
  }

  const learner = await prisma.learner.findUnique({
    where: { id: learnerPayload.learnerId },
    select: {
      lrn: true,
      firstName: true,
      lastName: true,
      middleName: true,
      extensionName: true,
      birthdate: true,
      sex: true,
      placeOfBirth: true,
      religion: true,
      motherTongue: true,
      psaBirthCertNumber: true,
      isIpCommunity: true,
      ipGroupName: true,
      is4PsBeneficiary: true,
      householdId4Ps: true,
      studentPhoto: true,
      user: {
        select: { email: true, mobileNumber: true }
      }
    },
  });

  if (!learner) {
    res.status(404).json({ code: "NOT_FOUND", message: "Learner not found." });
    return;
  }

  // Get all enrollment applications/records
  const allApps = await prisma.enrollmentApplication.findMany({
    where: { learnerId: learnerPayload.learnerId },
    orderBy: { schoolYear: { yearLabel: 'desc' } },
    include: {
      gradeLevel: true,
      schoolYear: true,
      familyMembers: true,
      addresses: true,
      enrollmentRecord: {
        include: { section: true }
      }
    }
  });

  const activeApp = allApps.find(a => a.schoolYearId === schoolSetting.activeSchoolYearId) || allApps[0];

  const identity = {
    lrn: learner.lrn,
    firstName: learner.firstName,
    lastName: learner.lastName,
    middleName: learner.middleName,
    extensionName: learner.extensionName,
  };

  const enrollment = {
    status: activeApp?.status || "NOT_ENROLLED",
    gradeLevel: activeApp?.gradeLevel?.name || null,
    section: activeApp?.enrollmentRecord?.section?.name || null,
    academicStatus: activeApp?.academicStatus || null,
  };

  const sanitizeStr = (str: string | null | undefined) => {
    if (!str) return null;
    const trimmed = str.trim();
    if (trimmed === "" || trimmed === "-") return null;
    return trimmed;
  };

  const sf1 = {
    birthdate: learner.birthdate,
    sex: learner.sex,
    placeOfBirth: sanitizeStr(learner.placeOfBirth),
    religion: sanitizeStr(learner.religion),
    motherTongue: sanitizeStr(learner.motherTongue),
    psaBirthCertNumber: sanitizeStr(learner.psaBirthCertNumber),
    studentPhoto: learner.studentPhoto,
    isIpCommunity: learner.isIpCommunity,
    ipGroupName: sanitizeStr(learner.ipGroupName),
    is4PsBeneficiary: learner.is4PsBeneficiary,
    householdId4Ps: sanitizeStr(learner.householdId4Ps),
    email: learner.user?.email || null,
    mobileNumber: learner.user?.mobileNumber || null,
    permanentAddress: activeApp?.addresses?.find(a => a.addressType === 'PERMANENT') || activeApp?.addresses?.[0] || null,
    currentAddress: (() => {
      const rawCurrent = activeApp?.addresses?.find(a => a.addressType === 'CURRENT');
      if (rawCurrent && (rawCurrent.houseNoStreet || rawCurrent.barangay || rawCurrent.cityMunicipality || rawCurrent.province)) {
        return rawCurrent;
      }
      return null;
    })(),
    mother: (() => {
      const fm = activeApp?.familyMembers?.find(fm => fm.relationship === 'MOTHER');
      if (fm && (fm.firstName || fm.lastName)) return fm;
      return null;
    })(),
    father: (() => {
      const fm = activeApp?.familyMembers?.find(fm => fm.relationship === 'FATHER');
      if (fm && (fm.firstName || fm.lastName)) return fm;
      return null;
    })(),
    guardian: (() => {
      const fm = activeApp?.familyMembers?.find(fm => fm.relationship === 'GUARDIAN');
      if (fm && (fm.firstName || fm.lastName)) return fm;
      return null;
    })(),
  };

  const academicHistory = allApps.map(app => {
    const hasGrades =
      app.reportedGrades !== null &&
      typeof app.reportedGrades === "object" &&
      !Array.isArray(app.reportedGrades) &&
      Object.keys(app.reportedGrades).length > 0;
    return {
      grade_level: app.gradeLevel?.name || "Unknown",
      school_year: app.schoolYear.yearLabel,
      status: app.schoolYearId === schoolSetting.activeSchoolYearId ? "Active" : "Completed",
      grades: app.reportedGrades || null,
      general_average: hasGrades ? (app.enrollmentRecord?.finalAverage || null) : null,
    };
  });

  res.json({
    identity,
    enrollment,
    sf1,
    academicHistory,
    isEnrollmentActive: schoolSetting.systemPhase === "OFFICIAL_ENROLLMENT",
    activeSchoolYear: schoolSetting.activeSchoolYear?.yearLabel ?? "",
    schoolName: schoolSetting.schoolName || "EnrollPro",
    schoolAcronym: computeSchoolAcronym(schoolSetting.schoolName || "EnrollPro"),
    schoolLogoUrl: schoolSetting.logoUrl || null,
  });
}

export async function checkDuplicateLearner(req: Request, res: Response) {
  try {
    const { lrn, firstName, lastName, birthdate } = req.body;

    if (!lrn && (!firstName || !lastName || !birthdate)) {
      res.status(400).json({ message: "Provide LRN or full demographic details" });
      return;
    }

    const schoolSetting = await prisma.schoolSetting.findFirst({
      select: { activeSchoolYearId: true }
    });

    if (!schoolSetting?.activeSchoolYearId) {
      res.status(400).json({ message: "No active school year set" });
      return;
    }

    const parsedBirthdate = birthdate ? new Date(birthdate) : undefined;

    const matchConditions = new Array();
    if (lrn && lrn.trim().length === 12) {
      matchConditions.push({ lrn: lrn.trim() });
    }
    if (firstName && lastName && parsedBirthdate && !isNaN(parsedBirthdate.getTime())) {
      matchConditions.push({
        firstName: { equals: firstName.trim(), mode: "insensitive" },
        lastName: { equals: lastName.trim(), mode: "insensitive" },
        birthdate: parsedBirthdate,
      });
    }

    if (matchConditions.length === 0) {
      res.json({ duplicateFound: false });
      return;
    }

    const learner = await prisma.learner.findFirst({
      where: {
        OR: matchConditions,
      },
      include: {
        enrollmentApplications: {
          where: {
            schoolYearId: schoolSetting.activeSchoolYearId,
            status: { notIn: Array.of("REJECTED", "WITHDRAWN") },
          },
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
      res.json({ duplicateFound: false });
      return;
    }

    const activeApp = learner.enrollmentApplications.at(0);

    res.json({
      duplicateFound: true,
      learner: {
        id: learner.id,
        firstName: learner.firstName,
        lastName: learner.lastName,
        lrn: learner.lrn,
        birthdate: learner.birthdate,
        activeEnrollment: activeApp
          ? {
              id: activeApp.id,
              trackingNumber: activeApp.trackingNumber,
              status: activeApp.status,
              gradeLevelName: activeApp.gradeLevel.name,
              sectionName: activeApp.enrollmentRecord?.section?.name ?? null,
            }
          : null,
      },
    });
  } catch (error: unknown) {
    console.error("Duplicate check error:", error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Failed to check duplicate",
    });
  }
}

