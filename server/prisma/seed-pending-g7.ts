import "dotenv/config";
import { PrismaClient, Sex, ApplicantType, ReadingProfileLevel, ApplicationStatus } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PH_FIRST_NAMES_MALE = ["JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA"];

async function main() {
  console.log("🚀 Seeding 875 Pending Grade 7 Learners (70 STE, 805 BEC) without sections...");

  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found. Run main db:seed first.");

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" }
  });

  if (!grade7) throw new Error("Grade 7 level not found.");

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  const totalSTE = 70;
  const totalBEC = 805;
  const total = totalSTE + totalBEC;

  for (let i = 1; i <= total; i++) {
    const isSTE = i <= totalSTE;
    const applicantType: ApplicantType = isSTE ? "SCIENCE_TECHNOLOGY_AND_ENGINEERING" : "REGULAR";
    
    const sex: Sex = i % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = sex === "MALE" 
      ? PH_FIRST_NAMES_MALE[i % PH_FIRST_NAMES_MALE.length]
      : PH_FIRST_NAMES_FEMALE[i % PH_FIRST_NAMES_FEMALE.length];
    const lastName = PH_LAST_NAMES[i % PH_LAST_NAMES.length];
    // Use a specific prefix to avoid colliding with other seeders
    const lrn = `202633${String(i).padStart(6, '0')}`; 
    
    // Ensure general average is not null
    const genAve = isSTE ? (90 + (i % 8)) : (80 + (i % 15));

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {},
      create: {
        lrn,
        firstName: `${firstName} ${isSTE ? '(STE)' : '(BEC)'}`,
        lastName,
        birthdate: new Date(`2014-0${(i % 9) + 1}-15`), // valid birthdates
        sex,
        isPendingLrnCreation: false,
        previousGenAve: genAve, // Redundant storage for engine robustness
      }
    });

    const trackingNumber = `F2F-ENR-${new Date().getFullYear()}-${String(i + 30000).padStart(5, "0")}`;

    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {},
      create: {
        learnerId: learner.id,
        schoolYearId: activeYear.id,
        gradeLevelId: grade7.id,
        applicantType,
        learnerType: "NEW_ENROLLEE",
        status: "VERIFIED" as ApplicationStatus, 
        admissionChannel: "F2F",
        trackingNumber,
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        readingProfileLevel: "INDEPENDENT" as ReadingProfileLevel,
        readingProfileAssessedAt: new Date(),
        readingProfileAssessedById: admin.id,
        intakeMethod: "BEEF_FULL",
      }
    });

    if (isSTE) {
      const earlyReg = await prisma.earlyRegistrationApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: activeYear.id,
          gradeLevelId: grade7.id,
          trackingNumber: `ER-${trackingNumber}`,
          applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          status: "ASSESSMENT_TAKEN",
          contactNumber: "09123456789",
          isPrivacyConsentGiven: true,
          encodedById: admin.id,
        }
      });

      await prisma.earlyRegistrationAssessment.createMany({
        data: [
          {
            applicationId: earlyReg.id,
            type: "QUALIFYING_EXAMINATION",
            score: 75 + (i % 25),
            conductedAt: new Date(),
          },
          {
            applicationId: earlyReg.id,
            type: "INTERVIEW",
            score: 80 + (i % 20),
            conductedAt: new Date(),
          }
        ]
      });

      await prisma.enrollmentApplication.update({
        where: { id: application.id },
        data: { earlyRegistrationId: earlyReg.id }
      });
    }

    await prisma.applicationChecklist.upsert({
      where: { enrollmentId: application.id },
      update: {},
      create: {
        enrollmentId: application.id,
        isSf9Submitted: true,
        isPsaBirthCertPresented: true,
        academicStatus: "PROMOTED",
      }
    });

    await prisma.enrollmentPreviousSchool.upsert({
      where: { applicationId: application.id },
      update: {},
      create: {
        applicationId: application.id,
        schoolName: "Test Elementary School",
        generalAverage: genAve,
      }
    });

    if (i % 100 === 0) {
      console.log(`Seeded ${i} / ${total} learners...`);
    }
  }

  console.log("✅ Successfully seeded 875 pending Grade 7 learners.");
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
