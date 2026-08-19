import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import type { LearnerAuthPayload } from "../../middleware/authenticate-learner.js";
import { getStoredSmartSubjects } from "../integration/smart-outcome-envelope.js";
import { isConfiguredDefaultPassword } from "../auth/default-password.service.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN: jwt.SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "24h";

interface StoredSubjectGrades {
  Q1?: number | null;
  Q2?: number | null;
  Q3?: number | null;
  Q4?: number | null;
  T1?: number | null;
  T2?: number | null;
  T3?: number | null;
  term1?: number | null;
  term2?: number | null;
  term3?: number | null;
  Final?: number | null;
  remarks?: string | null;
}

function isStoredSubjectGrades(value: unknown): value is StoredSubjectGrades {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getExpectedGradeNumber(gradeLevelName: string | null | undefined): number | null {
  const match = gradeLevelName?.match(/(?:GRADE[\s_-]*)?(10|[7-9])(?:\D|$)/i);
  return match ? Number(match[1]) : null;
}

function hasReportedGrade(grades: StoredSubjectGrades): boolean {
  return [
    grades.Q1,
    grades.Q2,
    grades.Q3,
    grades.Q4,
    grades.T1,
    grades.T2,
    grades.T3,
    grades.term1,
    grades.term2,
    grades.term3,
    grades.Final,
  ].some((value) => typeof value === "number");
}

function subjectBelongsToGrade(subjectName: string, expectedGrade: number | null): boolean {
  if (expectedGrade === null) return true;
  const match = subjectName.match(/\b(7|8|9|10)\s*$/);
  return match === null || Number(match[1]) === expectedGrade;
}

function parseStoredGrades(
  value: unknown,
  gradeLevelName?: string | null,
): Record<string, StoredSubjectGrades> | null {
  const storedSubjects = getStoredSmartSubjects(value);
  if (!storedSubjects) return null;

  const expectedGrade = getExpectedGradeNumber(gradeLevelName);
  const entries = Object.entries(storedSubjects).filter(([subjectName, grades]) => (
    isStoredSubjectGrades(grades)
    && hasReportedGrade(grades)
    && subjectBelongsToGrade(subjectName, expectedGrade)
  ));
  return entries.length > 0
    ? Object.fromEntries(entries) as Record<string, StoredSubjectGrades>
    : null;
}

function getHistoricalReportedGrades(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return "reportedGrades" in value
    ? (value as { reportedGrades?: unknown }).reportedGrades ?? null
    : null;
}

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
    if (passwordValid && password === DEFAULT_LEARNER_PASSWORD) {
      isDefaultPassword = true;
    }
  }

  if (!passwordValid && password === DEFAULT_LEARNER_PASSWORD && !user) {
    isDefaultPassword = true;
    passwordValid = true;

    const hashed = await bcrypt.hash(password, 12);
    const accountName = `LRN-${learner.lrn}`;

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

  if (await isConfiguredDefaultPassword(newPassword)) {
    res.status(400).json({
      code: "DEFAULT_PASSWORD_NOT_ALLOWED",
      message: "Choose a private password instead of the configured default password.",
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
        select: { yearLabel: true, termFormat: true },
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
  const [allApps, enrollmentHistories] = await Promise.all([
    prisma.enrollmentApplication.findMany({
      where: { learnerId: learnerPayload.learnerId },
      orderBy: { schoolYear: { yearLabel: "desc" } },
      include: {
        gradeLevel: true,
        schoolYear: true,
        familyMembers: true,
        addresses: true,
        enrollmentRecord: {
          include: {
            section: {
              include: {
                advisers: {
                  where: { status: "ACTIVE" },
                  include: { teacher: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.enrollmentHistory.findMany({
      where: { learnerId: learnerPayload.learnerId },
      orderBy: { schoolYear: { yearLabel: "desc" } },
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    }),
  ]);

  // Grades are read only from EnrollPro's validated SMART synchronization
  // snapshot. The SMART SSE bridge and the manual sync route are the only
  // processes allowed to update this data.
  const activeApp = allApps.find(
    (application) => application.schoolYearId === schoolSetting.activeSchoolYearId,
  );

  const identity = {
    lrn: learner.lrn,
    firstName: learner.firstName,
    lastName: learner.lastName,
    middleName: learner.middleName,
    extensionName: learner.extensionName,
  };

  const activeAdviser = activeApp?.enrollmentRecord?.section?.advisers?.[0]?.teacher ?? null;
  const adviserName = activeAdviser
    ? `${activeAdviser.firstName}${activeAdviser.middleName ? ` ${activeAdviser.middleName.charAt(0)}. ${activeAdviser.lastName}` : ` ${activeAdviser.lastName}`}`
    : null;
  const curriculumProgram = activeApp?.assignedProgram ?? activeApp?.applicantType ?? "REGULAR";

  const enrollment = {
    status: activeApp?.status || "NOT_ENROLLED",
    gradeLevel: activeApp?.gradeLevel?.name || null,
    section: activeApp?.enrollmentRecord?.section?.name || null,
    academicStatus: activeApp?.academicStatus || null,
    curriculumProgram,
    advisingTeacher: adviserName,
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

  const applicationHistory = allApps.map(app => {
    const rawGrades = parseStoredGrades(app.reportedGrades, app.gradeLevel?.name);
    const hasGrades =
      rawGrades !== null &&
      typeof rawGrades === "object" &&
      !Array.isArray(rawGrades) &&
      Object.keys(rawGrades).length > 0;
    return {
      grade_level: app.gradeLevel?.name || "Unknown",
      school_year: app.schoolYear.yearLabel,
      status: app.schoolYearId === schoolSetting.activeSchoolYearId ? "Active" : "Completed",
      term_format: app.schoolYear.termFormat ?? "TRIMESTER",
      grades: rawGrades || null,
      general_average: hasGrades ? (app.enrollmentRecord?.finalAverage ?? null) : null,
    };
  });

  const applicationYears = new Set(allApps.map((application) => application.schoolYearId));
  const archivedHistory = enrollmentHistories
    .filter((history) => !applicationYears.has(history.schoolYearId))
    .map((history) => {
      const rawGrades = parseStoredGrades(
        getHistoricalReportedGrades(history.academicOutcomeSnapshot),
        history.gradeLevel.name,
      );
      return {
        grade_level: history.gradeLevel.name,
        school_year: history.schoolYear.yearLabel,
        status: "Completed",
        term_format: history.schoolYear.termFormat ?? "TRIMESTER",
        grades: rawGrades,
        general_average: rawGrades ? history.genAve : null,
      };
    });

  const academicHistory = [...applicationHistory, ...archivedHistory].sort(
    (left, right) => right.school_year.localeCompare(left.school_year),
  );

  res.json({
    identity,
    enrollment,
    sf1,
    academicHistory,
    isEnrollmentActive: schoolSetting.systemPhase === "OFFICIAL_ENROLLMENT",
    activeSchoolYear: schoolSetting.activeSchoolYear?.yearLabel ?? "",
    activeTermFormat: schoolSetting.activeSchoolYear?.termFormat ?? "TRIMESTER",
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

