import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
  LearnerType,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MALE_NAMES = [
  "JUAN",
  "JOSE",
  "MIGUEL",
  "PAOLO",
  "GABRIEL",
  "DANIEL",
  "MATEO",
  "CARLO",
];

const FEMALE_NAMES = [
  "MARIA",
  "ANGELICA",
  "JASMINE",
  "NICOLE",
  "SOFIA",
  "ISABELA",
  "BEATRICE",
  "DIANA",
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
];

function toUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function buildLrn(sectionOrdinal: number, index: number): string {
  const sec = String(sectionOrdinal).padStart(2, "0");
  const seq = String(index).padStart(4, "0");
  return `262627${sec}${seq}`;
}

async function main() {
  console.log(
    "Seeding incoming Grade 7 learners (READY_FOR_SECTIONING, no enrollment records)...",
  );

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
  });

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });

  if (!targetYear || !grade7 || !admin) {
    throw new Error(
      "Missing target school year, Grade 7 level, or SYSTEM_ADMIN user.",
    );
  }

  const sections = await prisma.section.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  if (sections.length === 0) {
    throw new Error("No Grade 7 sections found for 2026-2027.");
  }

  let createdApps = 0;
  let updatedApps = 0;
  let createdLearners = 0;

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const sectionOrdinal = sIdx + 1;
    const targetCount = Math.max(0, section.maxCapacity - 1);

    for (let i = 1; i <= targetCount; i++) {
      const sex: Sex = i % 2 === 0 ? "FEMALE" : "MALE";
      const firstNamePool = sex === "MALE" ? MALE_NAMES : FEMALE_NAMES;
      const firstName = firstNamePool[(i - 1) % firstNamePool.length];
      const lastName = LAST_NAMES[(sectionOrdinal + i) % LAST_NAMES.length];
      const lrn = buildLrn(sectionOrdinal, i);

      const existingLearner = await prisma.learner.findUnique({
        where: { lrn },
        select: { id: true },
      });

      const learner = await prisma.learner.upsert({
        where: { lrn },
        update: {
          firstName,
          lastName,
          middleName: "SECTIONING",
          sex,
          previousGenAve: null,
          promotionStatus: null,
          userId: null,
          status: "ACTIVE",
        },
        create: {
          lrn,
          firstName,
          lastName,
          middleName: "SECTIONING",
          sex,
          birthdate: toUtcNoon(2014, (i % 12) + 1, ((i % 27) + 1)),
          isPendingLrnCreation: false,
          status: "ACTIVE",
        },
      });

      if (!existingLearner) {
        createdLearners += 1;
      }

      const trackingNumber = `ING7-2627-S${String(sectionOrdinal).padStart(2, "0")}-N${String(i).padStart(3, "0")}`;  

      const existingApp = await prisma.enrollmentApplication.findUnique({
        where: { trackingNumber },
        select: { id: true },
      });

      await prisma.enrollmentApplication.upsert({
        where: { trackingNumber },
        update: {
          learnerId: learner.id,
          schoolYearId: targetYear.id,
          gradeLevelId: grade7.id,
          applicantType: section.programType,
          learnerType: LearnerType.NEW_ENROLLEE,
          status: ApplicationStatus.READY_FOR_SECTIONING,
          admissionChannel: "F2F",
          isPrivacyConsentGiven: true,
          encodedById: admin.id,
          confirmationConsent: false,
        },
        create: {
          learnerId: learner.id,
          schoolYearId: targetYear.id,
          gradeLevelId: grade7.id,
          applicantType: section.programType,
          learnerType: LearnerType.NEW_ENROLLEE,
          status: ApplicationStatus.READY_FOR_SECTIONING,
          admissionChannel: "F2F",
          trackingNumber,
          isPrivacyConsentGiven: true,
          encodedById: admin.id,
          confirmationConsent: false,
        },
      });

      if (existingApp) {
        updatedApps += 1;
      } else {
        createdApps += 1;
      }
    }
  }

  console.log("Incoming Grade 7 READY_FOR_SECTIONING seed complete.");
  console.log(`Learners created: ${createdLearners}`);
  console.log(`Applications created: ${createdApps}`);
  console.log(`Applications updated: ${updatedApps}`);
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
