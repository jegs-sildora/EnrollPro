import "dotenv/config";
import { PrismaClient, ApplicantType, Sex, AssessmentKind } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PH_FIRST_NAMES_MALE = ["Juan", "Jose", "Miguel", "Carlo", "Rafael", "Paolo", "Antonio", "Gabriel", "Mateo", "Diego"];
const PH_FIRST_NAMES_FEMALE = ["Maria", "Angelica", "Princess", "Jasmine", "Nicole", "Gabriela", "Sofia", "Isabella", "Liza", "Bea"];
const PH_LAST_NAMES = ["Dela Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Fernandez", "Navarro", "Ramos", "Bautista", "Gonzales", "Torres", "Villanueva"];

async function main() {
  console.log("🚀 Seeding 300 Verified Learners for HNHS Policy Testing...");

  // 1. Get Context
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
  }) || await prisma.schoolYear.findFirst({ orderBy: { createdAt: "desc" } });

  if (!schoolYear) throw new Error("No school year found. Run base seed first.");

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { schoolYearId: schoolYear.id, name: { contains: "7" } }
  });

  if (!grade7) throw new Error("Grade 7 level not found.");

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  // 1.2 Seed Sections according to HNHS Policy
  console.log("  - Seeding HNHS Policy compliant sections...");
  
  // Tier 1: STE Sections
  const steA = await prisma.section.findFirst({ where: { name: "STE-A", gradeLevelId: grade7.id } });
  if (!steA) {
    await prisma.section.create({
      data: { 
        name: "STE-A", 
        programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", 
        gradeLevelId: grade7.id, 
        maxCapacity: 35,
        sortOrder: 1
      }
    });
  }

  const steB = await prisma.section.findFirst({ where: { name: "STE-B", gradeLevelId: grade7.id } });
  if (!steB) {
    await prisma.section.create({
      data: { 
        name: "STE-B", 
        programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", 
        gradeLevelId: grade7.id, 
        maxCapacity: 35,
        sortOrder: 2
      }
    });
  }

  // Tier 2: Pilot Sections (Numerical) - Homogeneous
  for (let i = 1; i <= 5; i++) {
    const sectionName = `Section ${i}`;
    const pilot = await prisma.section.findFirst({ where: { name: sectionName, gradeLevelId: grade7.id } });
    if (!pilot) {
      await prisma.section.create({
        data: { 
          name: sectionName, 
          programType: "REGULAR", 
          gradeLevelId: grade7.id, 
          maxCapacity: 40,
          sortOrder: 10 + i,
          isHomogeneous: true,
          isSnake: false
        }
      });
    }
  }

  // Tier 3: Heterogeneous Sections (National Heroes) - Snake
  const heroes = ["RIZAL", "BONIFACIO", "MABINI", "LUNA", "DEL PILAR", "SILANG"];
  for (let i = 0; i < heroes.length; i++) {
    const hero = await prisma.section.findFirst({ where: { name: heroes[i], gradeLevelId: grade7.id } });
    if (!hero) {
      await prisma.section.create({
        data: { 
          name: heroes[i], 
          programType: "REGULAR", 
          gradeLevelId: grade7.id, 
          maxCapacity: 40,
          sortOrder: 20 + i,
          isHomogeneous: false,
          isSnake: true
        }
      });
    }
  }

  // 2. Prepare Distribution Counts
  const totalStudents = 400;
  const steApplicantCount = 100; // 70 slots + 30 spillover
  
  for (let i = 1; i <= totalStudents; i++) {
    const isSteApplicant = i <= steApplicantCount;
    const sex: Sex = i % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = sex === "MALE" 
      ? PH_FIRST_NAMES_MALE[i % PH_FIRST_NAMES_MALE.length]
      : PH_FIRST_NAMES_FEMALE[i % PH_FIRST_NAMES_FEMALE.length];
    const lastName = PH_LAST_NAMES[i % PH_LAST_NAMES.length];
    const lrn = `2026${String(i).padStart(8, '0')}`;
    
    // Create Learner
    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {},
      create: {
        lrn,
        firstName,
        lastName,
        middleName: "S.",
        sex,
        birthdate: new Date("2013-05-15"),
        placeOfBirth: "Hinigaran",
        religion: "ROMAN CATHOLIC",
        motherTongue: "HILIGAYNON"
      }
    });

    // For STE testing, we need an Early Registration record with an exam score
    let earlyRegId = null;
    if (isSteApplicant) {
      const earlyReg = await prisma.earlyRegistrationApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: schoolYear.id,
          gradeLevelId: grade7.id,
          trackingNumber: `STE-PRE-${String(i).padStart(5, '0')}`,
          applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          status: "READY_FOR_ENROLLMENT",
          contactNumber: "09123456789",
          isPrivacyConsentGiven: true,
          assessments: {
            create: {
              type: "QUALIFYING_EXAMINATION",
              score: 70 + (Math.random() * 30), // Random score 70-100
              result: "PASSED",
              conductedAt: new Date()
            }
          }
        }
      });
      earlyRegId = earlyReg.id;
    }

    // Determine Reading Profile (20% Frustrated)
    const readingLevels = ["INDEPENDENT", "INSTRUCTIONAL", "FRUSTRATION", "NON_READER"];
    const readingProfileLevel = i % 5 === 0 
      ? readingLevels[2 + (i % 2)] // FRUSTRATION or NON_READER
      : readingLevels[i % 2];      // INDEPENDENT or INSTRUCTIONAL

    // Create Enrollment Application in VERIFIED status
    await prisma.enrollmentApplication.create({
      data: {
        learnerId: learner.id,
        gradeLevelId: grade7.id,
        schoolYearId: schoolYear.id,
        earlyRegistrationId: earlyRegId,
        applicantType: isSteApplicant ? "SCIENCE_TECHNOLOGY_AND_ENGINEERING" : "REGULAR",
        learnerType: "NEW_ENROLLEE",
        status: "VERIFIED", // Ready for Sectioning
        trackingNumber: `ENR-2026-${String(i).padStart(5, '0')}`,
        isPrivacyConsentGiven: true,
        readingProfileLevel: readingProfileLevel as any,
        previousSchool: {
          create: {
            schoolName: "Hinigaran Elementary",
            schoolType: "Public",
            gradeCompleted: "Grade 6",
            schoolYearAttended: "2025-2026",
            // STE applicants generally have higher averages
            generalAverage: isSteApplicant ? (88 + Math.random() * 10) : (75 + Math.random() * 20)
          }
        }
      }
    });

    if (i % 50 === 0) console.log(`  - Seeded ${i} verified learners...`);
  }

  console.log("\n✨ Seeding Complete!");
  console.log("--------------------------------------------------");
  console.log("Total Verified Learners: 400");
  console.log("STE Applicants (Tier 1): 100 (Expect 30 spillover)");
  console.log("Regular Applicants     : 300");
  console.log("--------------------------------------------------");
  console.log("Ready to test Batch Sectioning Wizard for Grade 7.");
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
