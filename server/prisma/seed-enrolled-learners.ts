import "dotenv/config";
import { PrismaClient, Sex, ApplicantType } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PH_FIRST_NAMES_MALE = ["JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA"];

async function main() {
  console.log("🚀 Seeding 100 Enrolled Learners for Load Testing...");

  // 1. Get Context
  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found. Run main db:seed first.");

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" }
  });

  if (!grade7) throw new Error("Grade 7 level not found.");

  const sections = await prisma.section.findMany({
    where: { gradeLevelId: grade7.id, schoolYearId: activeYear.id }
  });

  if (sections.length === 0) throw new Error("No sections found for Grade 7. Run db:seed-sections first.");

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  for (let i = 1; i <= 100; i++) {
    const sex: Sex = i % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = sex === "MALE" 
      ? PH_FIRST_NAMES_MALE[i % PH_FIRST_NAMES_MALE.length]
      : PH_FIRST_NAMES_FEMALE[i % PH_FIRST_NAMES_FEMALE.length];
    const lastName = PH_LAST_NAMES[i % PH_LAST_NAMES.length];
    const lrn = `202611${String(i).padStart(6, '0')}`;
    
    // 1. Create Learner with full fields
    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {},
      create: {
        lrn,
        firstName,
        lastName,
        middleName: "REYES",
        extensionName: i % 10 === 0 ? "JR" : null,
        sex,
        birthdate: new Date("2013-05-15"),
        placeOfBirth: "QUEZON CITY",
        religion: "ROMAN CATHOLIC",
        motherTongue: "TAGALOG",
        isIpCommunity: i % 20 === 0,
        ipGroupName: i % 20 === 0 ? "TAGALOG" : null,
        isLearnerWithDisability: false,
        disabilityTypes: [],
        is4PsBeneficiary: i % 8 === 0,
        householdId4Ps: i % 8 === 0 ? `HH-ID-${i}` : null,
        psaBirthCertNumber: `PSA-BC-${String(i).padStart(8, '0')}`,
        previousGenAve: 85.5,
        promotionStatus: "PROMOTED",
      }
    });

    // 2. Create Enrollment Application
    const trackingNumber = `ENR-${activeYear.id}-${String(i).padStart(5, '0')}`;
    
    await prisma.enrollmentApplication.upsert({
        where: { trackingNumber },
        update: {},
        create: {
            learnerId: learner.id,
            gradeLevelId: grade7.id,
            schoolYearId: activeYear.id,
            applicantType: "REGULAR" as ApplicantType,
            learnerType: "NEW_ENROLLEE",
            status: "ENROLLED",
            trackingNumber,
            isPrivacyConsentGiven: true,
            admissionChannel: "ONLINE",
            encodedById: admin.id,
            readingProfileLevel: "INSTRUCTIONAL",
            guardianRelationship: "MOTHER",
            hasNoMother: false,
            hasNoFather: false,
            previousSchool: {
              create: {
                schoolName: "MANILA ELEMENTARY SCHOOL",
                schoolType: "Public",
                gradeCompleted: "Grade 6",
                schoolYearAttended: "2025-2026",
                generalAverage: 88.0
              }
            }
        }
    });

    const application = await prisma.enrollmentApplication.findUnique({
        where: { trackingNumber },
        select: { id: true }
    });

    // 3. Create Enrollment Record (Section Assignment)
    const section = sections[i % sections.length];
    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: application!.id },
      update: {
        schoolYearId: activeYear.id,
        sectionId: section.id,
        enrolledById: admin.id,
      },
      create: {
        enrollmentApplicationId: application!.id,
        schoolYearId: activeYear.id,
        sectionId: section.id,
        enrolledById: admin.id,
        enrolledAt: new Date(),
        confirmationConsent: true,
      }
    });

    if (i % 20 === 0) console.log(`  - Seeded ${i} enrolled learners...`);
  }

  console.log("✅ Seeded 100 enrolled learners successfully.");
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
