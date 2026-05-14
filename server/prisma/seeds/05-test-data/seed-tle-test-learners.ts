import "dotenv/config";
import { 
  PrismaClient, 
  Sex, 
  ApplicantType, 
  ReadingProfileLevel, 
  ApplicationStatus,
  Role,
  LearnerType,
  IntakeMethod
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const defaultPinHash = bcrypt.hashSync("123456", 10);

function toUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

async function main() {
  console.log("🚀 Seeding Grade 9 and 10 TLE test learners with prior-year history for BOSY testing...");

  const sy2025 = await prisma.schoolYear.findUnique({ where: { yearLabel: "2025-2026" } });
  const sy2026 = await prisma.schoolYear.findUnique({ where: { yearLabel: "2026-2027" } });

  if (!sy2025 || !sy2026) {
    console.error("Required school years (2025-2026 or 2026-2027) not found. Please seed them first.");
    return;
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 8", "Grade 9", "Grade 10"] } }
  });

  const g8 = gradeLevels.find(g => g.name === "Grade 8");
  const g9 = gradeLevels.find(g => g.name === "Grade 9");
  const g10 = gradeLevels.find(g => g.name === "Grade 10");

  if (!g8 || !g9 || !g10) {
    console.error("Required grade levels not found.");
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) {
    console.error("SYSTEM_ADMIN not found.");
    return;
  }

  const learnersData = [
    {
      lrn: "100000900001",
      firstName: "ALEXANDER",
      lastName: "GRADE9_TLE_TEST1",
      birthdate: toUtcNoon(2011, 5, 12),
      sex: "MALE" as Sex,
      priorGradeLevelId: g8.id,
      targetGradeLevelId: g9.id,
    },
    {
      lrn: "100000900002",
      firstName: "BEATRICE",
      lastName: "GRADE9_TLE_TEST2",
      birthdate: toUtcNoon(2011, 8, 24),
      sex: "FEMALE" as Sex,
      priorGradeLevelId: g8.id,
      targetGradeLevelId: g9.id,
    },
    {
      lrn: "100000100001",
      firstName: "CHRISTOPHER",
      lastName: "GRADE10_TLE_TEST1",
      birthdate: toUtcNoon(2010, 3, 15),
      sex: "MALE" as Sex,
      priorGradeLevelId: g9.id,
      targetGradeLevelId: g10.id,
    },
    {
      lrn: "100000100002",
      firstName: "DANIELLE",
      lastName: "GRADE10_TLE_TEST2",
      birthdate: toUtcNoon(2010, 11, 2),
      sex: "FEMALE" as Sex,
      priorGradeLevelId: g9.id,
      targetGradeLevelId: g10.id,
    }
  ];

  for (const data of learnersData) {
    // 1. Create/Update User account for the learner
    const user = await prisma.user.upsert({
      where: { accountName: data.lrn },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: true,
      },
      create: {
        accountName: data.lrn,
        password: defaultPinHash,
        role: "LEARNER",
        firstName: data.firstName,
        lastName: data.lastName,
        sex: data.sex,
        isActive: true,
        mustChangePassword: false
      }
    });

    // 2. Create/Update Learner
    const learner = await prisma.learner.upsert({
      where: { lrn: data.lrn },
      update: {
        userId: user.id
      },
      create: {
        lrn: data.lrn,
        firstName: data.firstName,
        lastName: data.lastName,
        birthdate: data.birthdate,
        sex: data.sex,
        isPendingLrnCreation: false,
        previousGenAve: 85,
        userId: user.id
      }
    });

    // 3. Create Prior Year (2025-2026) Record
    const priorTracking = `REG-2025-TLE-PREV-${data.lrn.slice(-4)}`;
    const priorApp = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber: priorTracking },
      update: {
        status: "ENROLLED" as ApplicationStatus,
      },
      create: {
        learnerId: learner.id,
        schoolYearId: sy2025.id,
        gradeLevelId: data.priorGradeLevelId,
        applicantType: "REGULAR",
        learnerType: "NEW_ENROLLEE", // They were new in 2025 for this test case
        status: "ENROLLED" as ApplicationStatus,
        admissionChannel: "F2F",
        trackingNumber: priorTracking,
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        readingProfileLevel: "INDEPENDENT",
        portalPin: defaultPinHash,
      }
    });

    // Find a section in 2025-2026 for the prior grade level
    const section = await prisma.section.findFirst({
      where: { 
        gradeLevelId: data.priorGradeLevelId,
        schoolYearId: sy2025.id
      }
    });

    if (section) {
      await prisma.enrollmentRecord.upsert({
        where: { enrollmentApplicationId: priorApp.id },
        update: {
          sectionId: section.id
        },
        create: {
          enrollmentApplicationId: priorApp.id,
          learnerId: learner.id,
          schoolYearId: sy2025.id,
          sectionId: section.id,
          enrolledById: admin.id,
          enrolledAt: new Date(),
          confirmationConsent: true
        }
      });
    }

    // 4. Create Target Year (2026-2027) Application - PENDING_CONFIRMATION
    const targetTracking = `REG-2026-TLE-${data.lrn.slice(-4)}`;
    const targetApp = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber: targetTracking },
      update: {
        status: "PENDING_CONFIRMATION" as ApplicationStatus,
        tleProgramId: null,
      },
      create: {
        learnerId: learner.id,
        schoolYearId: sy2026.id,
        gradeLevelId: data.targetGradeLevelId,
        applicantType: "REGULAR",
        learnerType: "CONTINUING",
        status: "PENDING_CONFIRMATION" as ApplicationStatus,
        admissionChannel: "F2F",
        trackingNumber: targetTracking,
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        readingProfileLevel: "INDEPENDENT",
        readingProfileAssessedAt: new Date(),
        readingProfileAssessedById: admin.id,
        intakeMethod: "BEEF_FULL",
        contactNumber: "09123456789",
        guardianName: "Test Guardian",
        portalPin: defaultPinHash,
        tleProgramId: null,
      }
    });

    // 5. Create checklist for target application
    await prisma.applicationChecklist.upsert({
      where: { enrollmentId: targetApp.id },
      update: {
        academicStatus: "PROMOTED",
        updatedById: admin.id,
      },
      create: {
        enrollmentId: targetApp.id,
        academicStatus: "PROMOTED",
        updatedById: admin.id,
      }
    });

    console.log(`- Seeded ${data.targetGradeLevelId === g9.id ? 'Grade 9' : 'Grade 10'} learner: ${data.firstName} ${data.lastName} (LRN: ${data.lrn}) with login and 2025-2026 history.`);
  }

  console.log("\n✅ Seeding complete. Learners are now in PENDING_CONFIRMATION for 2026-2027 with prior records and User accounts.");
  }

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
