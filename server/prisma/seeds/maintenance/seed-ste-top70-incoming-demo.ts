import "dotenv/config";
import {
  PrismaClient,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SY_LABEL = "2026-2027";
const GRADE_LEVEL_NAME = "Grade 7";
const TARGET_COUNT = 70;
const TRACKING_PREFIX = "STE-2026";
const LRN_PREFIX = "737027";
const DEMO_TAG = "STE_TOP_70_PRE_PUBLISH";

const FIRST_NAMES_MALE = [
  "JUAN",
  "JOSE",
  "MIGUEL",
  "PAOLO",
  "GABRIEL",
  "DANIEL",
  "MATEO",
  "CARLO",
  "MARK",
  "JOSHUA",
];

const FIRST_NAMES_FEMALE = [
  "MARIA",
  "ANGELICA",
  "JASMINE",
  "NICOLE",
  "SOFIA",
  "ISABELA",
  "BEATRICE",
  "DIANA",
  "ANNA",
  "CHLOE",
];

const LAST_NAMES = [
  "DELA CRUZ",
  "REYES",
  "SANTOS",
  "GARCIA",
  "RAMOS",
  "MENDOZA",
  "TORRES",
  "BAUTISTA",
  "CASTILLO",
  "PANGANIBAN",
];

const MIDDLE_NAMES = [
  "SANTIAGO",
  "DE LEON",
  "BALTAZAR",
  "DEL ROSARIO",
  "VALDEZ",
  "RODRIGUEZ",
  "LUNA",
];

function toUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function pick<T>(arr: T[], idx: number): T {
  return arr[Math.abs(idx) % arr.length];
}

function buildLrn(seq: number): string {
  return `${LRN_PREFIX}${String(seq).padStart(6, "0")}`;
}

function buildTracking(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

function buildSteTracking(seq: number): string {
  return `STE-2026-${String(seq).padStart(5, "0")}`;
}

function pseudoRandomUnit(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function scorePlan(seq: number): {
  examScore: number;
  interviewScore: number;
  gradeAverage: number;
} {
  // Deterministic pseudo-randomized scores by sequence so ranking is fully determined
  // by the system algorithm, not by hardcoded rank ordering in seed data.
  const examScore = Number((84 + pseudoRandomUnit(seq, 1) * 15).toFixed(4));
  const interviewScore = Number((82 + pseudoRandomUnit(seq, 2) * 16).toFixed(4));
  const gradeAverage = Number((88 + pseudoRandomUnit(seq, 3) * 11).toFixed(4));

  return {
    examScore,
    interviewScore,
    gradeAverage,
  };
}

async function ensureSteRankingFormula(schoolYearId: number): Promise<void> {
  const expectedRankingFormula = {
    components: [
      { key: "QUALIFYING_EXAMINATION", label: "Exam", weight: 0.65 },
      { key: "INTERVIEW", label: "Interview", weight: 0.15 },
      { key: "GRADE_AVERAGE", label: "Grade Average", weight: 0.2 },
    ],
  };

  const existingConfig = await prisma.scpProgramConfig.findUnique({
    where: {
      uq_scp_program_configs_type: {
        schoolYearId,
        scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      },
    },
    select: {
      id: true,
      rankingFormula: true,
      isOffered: true,
    },
  });

  if (!existingConfig) {
    await prisma.scpProgramConfig.create({
      data: {
        schoolYearId,
        scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
        isOffered: true,
        rankingFormula: expectedRankingFormula,
      },
    });

    console.log("Created missing STE SCP config with default ranking formula.");
    return;
  }

  const existingFormula = existingConfig.rankingFormula as
    | { components?: unknown; weights?: unknown; maxSlots?: unknown }
    | null;

  const hasUsableFormula = Boolean(
    (existingFormula && Array.isArray(existingFormula.components) && existingFormula.components.length > 0) ||
      (existingFormula && typeof existingFormula.weights === "object" && existingFormula.weights !== null && Object.keys(existingFormula.weights).length > 0),
  );

  if (!existingConfig.isOffered || !hasUsableFormula) {
    await prisma.scpProgramConfig.update({
      where: { id: existingConfig.id },
      data: {
        isOffered: true,
        rankingFormula: expectedRankingFormula,
      },
    });
    console.log("Repaired existing STE SCP config ranking formula.");
  }
}

async function main() {
  console.log("Seeding STE Top 70 incoming demo applications (pre-publish state)...");

  if (TARGET_COUNT > 70) {
    throw new Error(`TARGET_COUNT must not exceed 70. Received: ${TARGET_COUNT}`);
  }

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: SY_LABEL },
    select: { id: true },
  });

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: GRADE_LEVEL_NAME },
    select: { id: true },
  });

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
    select: { id: true },
  });

  if (!targetYear || !grade7 || !admin) {
    throw new Error("Missing target school year, Grade 7, or SYSTEM_ADMIN user.");
  }

  await ensureSteRankingFormula(targetYear.id);

  // Reset only demo-seeded rows so real/existing applicants remain in the ranking board.
  const existingDemoEnrollments = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      learnerType: "NEW_ENROLLEE",
      batchIntakeMethod: DEMO_TAG,
    },
    select: {
      id: true,
      earlyRegistrationId: true,
    },
  });

  const existingEnrollmentIds = existingDemoEnrollments.map((row) => row.id);
  const existingDemoEarlyRegs = await prisma.earlyRegistrationApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      learnerType: "NEW_ENROLLEE",
      reportedGrades: {
        path: ["demoCohort"],
        equals: DEMO_TAG,
      },
    },
    select: { id: true },
  });

  const existingEarlyRegIds = existingDemoEarlyRegs.map((row) => row.id);

  if (existingEnrollmentIds.length > 0) {
    await prisma.enrollmentApplication.deleteMany({
      where: { id: { in: existingEnrollmentIds } },
    });
    console.log(`Reset demo STE enrollment rows: ${existingEnrollmentIds.length}`);
  }

  if (existingEarlyRegIds.length > 0) {
    await prisma.earlyRegistrationApplication.deleteMany({
      where: { id: { in: existingEarlyRegIds } },
    });
    console.log(`Reset demo STE early registration rows: ${existingEarlyRegIds.length}`);
  }

  let createdLearners = 0;
  let createdEarlyRegs = 0;
  let createdEnrollments = 0;

  for (let seq = 1; seq <= TARGET_COUNT; seq += 1) {
    const sex: Sex = seq % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = pick(sex === "MALE" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE, seq);
    const lastName = pick(LAST_NAMES, seq + 2);
    const middleName = pick(MIDDLE_NAMES, seq + 5);

    const lrn = buildLrn(seq);
    const enrollmentTracking = buildSteTracking(seq);
    const earlyRegTracking = buildSteTracking(seq);

    const { examScore, interviewScore, gradeAverage } = scorePlan(seq);

    const existingLearner = await prisma.learner.findUnique({
      where: { lrn },
      select: { id: true },
    });

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {
        firstName,
        lastName,
        middleName,
        sex,
        previousGenAve: gradeAverage,
        promotionStatus: "PROMOTED",
        isPendingLrnCreation: false,
        status: "ACTIVE",
      },
      create: {
        lrn,
        firstName,
        lastName,
        middleName,
        sex,
        birthdate: toUtcNoon(2013 + (seq % 2), seq % 12, (seq % 27) + 1),
        previousGenAve: gradeAverage,
        promotionStatus: "PROMOTED",
        isPendingLrnCreation: false,
        status: "ACTIVE",
      },
    });

    if (!existingLearner) {
      createdLearners += 1;
    }

    const existingEarlyReg = await prisma.earlyRegistrationApplication.findUnique({
      where: {
        trackingNumber: earlyRegTracking,
      },
      select: { id: true },
    });

    const earlyReg = await prisma.earlyRegistrationApplication.upsert({
      where: {
        trackingNumber: earlyRegTracking,
      },
      update: {
        trackingNumber: earlyRegTracking,
        learnerId: learner.id,
        schoolYearId: targetYear.id,
        gradeLevelId: grade7.id,
        applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
        learnerType: "NEW_ENROLLEE",
        status: "PASSED",
        channel: "F2F",
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        guardianRelationship: "MOTHER",
        reportedGrades: {
          grade6GeneralAverage: gradeAverage,
          seedSequence: seq,
          demoCohort: DEMO_TAG,
        },
        contactNumber: `0917${String(1000000 + seq).slice(-7)}`,
      },
      create: {
        learnerId: learner.id,
        schoolYearId: targetYear.id,
        gradeLevelId: grade7.id,
        trackingNumber: earlyRegTracking,
        applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
        learnerType: "NEW_ENROLLEE",
        status: "PASSED",
        channel: "F2F",
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        guardianRelationship: "MOTHER",
        reportedGrades: {
          grade6GeneralAverage: gradeAverage,
          seedSequence: seq,
          demoCohort: DEMO_TAG,
        },
        contactNumber: `0917${String(1000000 + seq).slice(-7)}`,
      },
      select: { id: true },
    });

    if (!existingEarlyReg) {
      createdEarlyRegs += 1;
    }

    const existingExam = await prisma.earlyRegistrationAssessment.findFirst({
      where: {
        applicationId: earlyReg.id,
        type: "QUALIFYING_EXAMINATION",
      },
      select: { id: true },
    });

    if (existingExam) {
      await prisma.earlyRegistrationAssessment.update({
        where: { id: existingExam.id },
        data: {
          score: examScore,
          result: "PASSED",
          conductedAt: new Date("2026-04-10T08:00:00.000Z"),
        },
      });
    } else {
      await prisma.earlyRegistrationAssessment.create({
        data: {
          applicationId: earlyReg.id,
          type: "QUALIFYING_EXAMINATION",
          scheduledDate: toUtcNoon(2026, 3, 10),
          score: examScore,
          result: "PASSED",
          conductedAt: new Date("2026-04-10T08:00:00.000Z"),
        },
      });
    }

    const existingInterview = await prisma.earlyRegistrationAssessment.findFirst({
      where: {
        applicationId: earlyReg.id,
        type: "INTERVIEW",
      },
      select: { id: true },
    });

    if (existingInterview) {
      await prisma.earlyRegistrationAssessment.update({
        where: { id: existingInterview.id },
        data: {
          score: interviewScore,
          result: "PASSED",
          conductedAt: new Date("2026-04-17T08:00:00.000Z"),
        },
      });
    } else {
      await prisma.earlyRegistrationAssessment.create({
        data: {
          applicationId: earlyReg.id,
          type: "INTERVIEW",
          scheduledDate: toUtcNoon(2026, 3, 17),
          score: interviewScore,
          result: "PASSED",
          conductedAt: new Date("2026-04-17T08:00:00.000Z"),
        },
      });
    }

    const existingEnrollment = await prisma.enrollmentApplication.findUnique({
      where: {
        trackingNumber: enrollmentTracking,
      },
      select: { id: true },
    });

    let enrollment: { id: number };
    if (existingEnrollment) {
      enrollment = await prisma.enrollmentApplication.update({
        where: { id: existingEnrollment.id },
        data: {
          learnerId: learner.id,
          earlyRegistrationId: earlyReg.id,
          schoolYearId: targetYear.id,
          gradeLevelId: grade7.id,
          applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          learnerType: "NEW_ENROLLEE",
          status: "PASSED",
          admissionChannel: "F2F",
          trackingNumber: enrollmentTracking,
          encodedById: admin.id,
          isPrivacyConsentGiven: true,
          contactNumber: `0918${String(1000000 + seq).slice(-7)}`,
          guardianRelationship: "MOTHER",
          batchIntakeMethod: DEMO_TAG,
        },
        select: { id: true },
      });
    } else {
      enrollment = await prisma.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          earlyRegistrationId: earlyReg.id,
          schoolYearId: targetYear.id,
          gradeLevelId: grade7.id,
          applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          learnerType: "NEW_ENROLLEE",
          status: "PASSED",
          admissionChannel: "F2F",
          trackingNumber: enrollmentTracking,
          encodedById: admin.id,
          isPrivacyConsentGiven: true,
          contactNumber: `0918${String(1000000 + seq).slice(-7)}`,
          guardianRelationship: "MOTHER",
          batchIntakeMethod: DEMO_TAG,
        },
        select: { id: true },
      });
    }

    if (!existingEnrollment) {
      createdEnrollments += 1;
    }

    await prisma.enrollmentPreviousSchool.upsert({
      where: { applicationId: enrollment.id },
      update: {
        schoolName: `DEMO ELEMENTARY SCHOOL ${String((seq % 5) + 1)}`,
        gradeCompleted: "Grade 6",
        schoolYearAttended: "2025-2026",
        schoolType: "PUBLIC",
        generalAverage: gradeAverage,
      },
      create: {
        applicationId: enrollment.id,
        schoolName: `DEMO ELEMENTARY SCHOOL ${String((seq % 5) + 1)}`,
        gradeCompleted: "Grade 6",
        schoolYearAttended: "2025-2026",
        schoolType: "PUBLIC",
        generalAverage: gradeAverage,
      },
    });

    await prisma.enrollmentProgramDetail.upsert({
      where: { applicationId: enrollment.id },
      update: {
        scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      },
      create: {
        applicationId: enrollment.id,
        scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      },
    });
  }

  const seededCount = await prisma.enrollmentApplication.count({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      learnerType: "NEW_ENROLLEE",
      status: "PASSED",
      batchIntakeMethod: DEMO_TAG,
    },
  });

  const totalSteCount = await prisma.enrollmentApplication.count({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      learnerType: "NEW_ENROLLEE",
      status: "PASSED",
    },
  });

  if (seededCount !== TARGET_COUNT) {
    throw new Error(
      `Seed guard failed: expected exactly ${TARGET_COUNT} STE demo applicants, got ${seededCount}.`,
    );
  }

  console.log("STE Top 70 incoming demo seed complete.");
  console.log(`Learners created: ${createdLearners}`);
  console.log(`Early registrations created: ${createdEarlyRegs}`);
  console.log(`Enrollment applications created: ${createdEnrollments}`);
  console.log(`Current demo cohort count: ${seededCount}`);
  console.log(`Current total STE PASSED cohort count (demo + existing): ${totalSteCount}`);
  console.log("State: Top 70 pre-publish (PASSED assessments, not yet READY_FOR_ENROLLMENT).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
