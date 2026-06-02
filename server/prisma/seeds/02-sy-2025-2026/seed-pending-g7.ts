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

const PH_FIRST_NAMES_MALE = [
"JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "CORAZON", "BENIGNO", "RAMON", "ELPIDIO", "SERGIO", "DIOSDADO", "JOSEPH"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA", "IMELDA", "GLORIA", "CORAZON", "LOURDES", "REMEDIOS", "CARMELA", "JOSEFINA", "PERLA", "AURORA", "ESTRELLA"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "MARCOS", "DUTERTE", "ESTRADA", "ARROYO", "MAGSAYSAY", "QUIRINO", "OSMEÑA", "MACAPAGAL", "ROXAS", "QUEZON"];
const PH_MIDDLE_NAMES = ["SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG"];

async function main() {
  console.log("≡ƒÜÇ Seeding 875 Pending Grade 7 Learners for 2026-2027 (Phase 1 Demo)...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" }
  });

  if (!targetYear) throw new Error("Timeline failure: 2026-2027 not found.");

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
    
    const firstPool = sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;
    const firstIdx = i % firstPool.length;
    const lastIdx = Math.floor(i / firstPool.length) % PH_LAST_NAMES.length;
    const midIdx = Math.floor(i / (firstPool.length * PH_LAST_NAMES.length)) % PH_MIDDLE_NAMES.length;

    const firstNameBase = firstPool[firstIdx];
    const lastName = PH_LAST_NAMES[lastIdx];
    const middleName = PH_MIDDLE_NAMES[midIdx];

    const lrn = `132600${String(i).padStart(6, '0')}`; 
    const genAve = isSTE ? (90 + (i % 8)) : (80 + (i % 15));

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {},
      create: {
        lrn,
        firstName: `${firstNameBase} ${isSTE ? '(STE)' : '(BEC)'}`,
        lastName,
        middleName,
        birthdate: toUtcNoon(2014, (i % 9) + 1, 15),
        sex,
        isPendingLrnCreation: false,
        previousGenAve: genAve,
      }
    });

    const startYear = targetYear.yearLabel.split("-")[0];
    const trackingNumber = `REG-${startYear}-${String(i).padStart(5, "0")}`;

    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {
        portalPin: defaultPinHash,
      },
      create: {
        learnerId: learner.id,
        schoolYearId: targetYear.id,
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
        portalPin: defaultPinHash,
      }
    });

    if (isSTE) {
      const erTrackingNumber = `ER-${trackingNumber}`;
      let earlyReg = await prisma.earlyRegistrationApplication.findUnique({
        where: { trackingNumber: erTrackingNumber }
      });

      if (!earlyReg) {
        earlyReg = await prisma.earlyRegistrationApplication.create({
          data: {
            learnerId: learner.id,
            schoolYearId: targetYear.id,
            gradeLevelId: grade7.id,
            trackingNumber: erTrackingNumber,
            applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
            status: "ASSESSMENT_TAKEN",
            contactNumber: `0923${String(i).padStart(7, '0')}`,
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
      }

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
      console.log(`Seeded ${i} / ${total} incoming learners...`);
    }
  }

  console.log("Γ£à Successfully seeded 875 pending Grade 7 learners for 2026-2027.");
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
