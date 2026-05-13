import "dotenv/config";
import { PrismaClient, Sex, ApplicantType, ReadingProfileLevel, ApplicationStatus } from "../../../src/generated/prisma/index.js";
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
  console.log("≡ƒÜÇ Seeding incoming Grade 9 and 10 learners for TLE specialization feature testing...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" }
  });

  if (!targetYear) {
    console.error("School year 2026-2027 not found. Please ensure it is seeded first.");
    return;
  }

  const grade9 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 9" } });
  const grade10 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 10" } });

  if (!grade9 || !grade10) {
    console.error("Grade levels not found.");
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) {
    console.error("SYSTEM_ADMIN not found.");
    return;
  }

  const learnersData = [
    {
      gradeLevelId: grade9.id,
      lrn: "100000900001",
      firstName: "ALEXANDER",
      lastName: "GRADE9_TLE_TEST1",
      birthdate: toUtcNoon(2011, 5, 12),
      sex: "MALE" as Sex,
    },
    {
      gradeLevelId: grade9.id,
      lrn: "100000900002",
      firstName: "BEATRICE",
      lastName: "GRADE9_TLE_TEST2",
      birthdate: toUtcNoon(2011, 8, 24),
      sex: "FEMALE" as Sex,
    },
    {
      gradeLevelId: grade10.id,
      lrn: "100000100001",
      firstName: "CHRISTOPHER",
      lastName: "GRADE10_TLE_TEST1",
      birthdate: toUtcNoon(2010, 3, 15),
      sex: "MALE" as Sex,
    },
    {
      gradeLevelId: grade10.id,
      lrn: "100000100002",
      firstName: "DANIELLE",
      lastName: "GRADE10_TLE_TEST2",
      birthdate: toUtcNoon(2010, 11, 2),
      sex: "FEMALE" as Sex,
    }
  ];

  for (const data of learnersData) {
    const learner = await prisma.learner.upsert({
      where: { lrn: data.lrn },
      update: {},
      create: {
        lrn: data.lrn,
        firstName: data.firstName,
        lastName: data.lastName,
        birthdate: data.birthdate,
        sex: data.sex,
        isPendingLrnCreation: false,
        previousGenAve: 85,
      }
    });

    const startYear = targetYear.yearLabel.split("-")[0];
    const trackingNumber = `REG-${startYear}-TLE-${data.lrn.slice(-4)}`;

    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {
        portalPin: defaultPinHash,
        tleProgramId: null, // explicit no TLE specialization for testing selection
      },
      create: {
        learnerId: learner.id,
        schoolYearId: targetYear.id,
        gradeLevelId: data.gradeLevelId,
        applicantType: "REGULAR",
        learnerType: "CONTINUING",
        status: "PENDING_CONFIRMATION" as ApplicationStatus,
        admissionChannel: "F2F",
        trackingNumber,
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        readingProfileLevel: "INDEPENDENT" as ReadingProfileLevel,
        readingProfileAssessedAt: new Date(),
        readingProfileAssessedById: admin.id,
        intakeMethod: "BEEF_FULL",
        contactNumber: "09123456789",
        guardianName: "Test Guardian",
        portalPin: defaultPinHash,
        tleProgramId: null, // explicit no TLE specialization for testing selection
      }
    });

    // Create checklist record which is required for BOSY confirmation logic/visibility
    await prisma.applicationChecklist.upsert({
      where: { enrollmentId: application.id },
      update: {
        academicStatus: "PROMOTED",
        updatedById: admin.id,
      },
      create: {
        enrollmentId: application.id,
        academicStatus: "PROMOTED",
        updatedById: admin.id,
      }
    });

    console.log(`- Seeded ${data.gradeLevelId === grade9.id ? 'Grade 9' : 'Grade 10'} learner: ${data.firstName} ${data.lastName} (LRN: ${data.lrn})`);
  }

  console.log("\n≡ƒÿÄ Seeding complete. All test learners have no TLE specialization.");
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
