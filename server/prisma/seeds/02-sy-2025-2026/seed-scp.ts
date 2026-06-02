import "dotenv/config";
import { PrismaClient, ApplicantType, Sex } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SCP_TYPES: ApplicantType[] = [
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
];

const PH_FIRST_NAMES = [
  "JUAN", "MARIA", "JOSE", "ANGELICA", "MIGUEL", "PRINCESS", "CARLO", "JASMINE", "RAFAEL", "NICOLE", "PAOLO", "GABRIELA"
];

const PH_MIDDLE_NAMES = [
  "SANTOS", "REYES", "GARCIA", "CRUZ", "MENDOZA", "AQUINO", "FLORES", "NAVARRO", "TORRES", "BAUTISTA", "CASTRO", "VALDEZ"
];

const PH_LAST_NAMES = [
  "DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA"
];

const PH_PLACE_OF_BIRTHS = [
  "MANILA", "QUEZON CITY", "DAVAO CITY", "CEBU CITY", "ZAMBOANGA CITY", "ANTIPOLO", "PASIG", "CAGAYAN DE ORO"
];

const PH_RELIGIONS = [
  "ROMAN CATHOLIC", "IGLESIA NI CRISTO", "SEVENTH-DAY ADVENTIST", "ISLAM", "BORN AGAIN CHRISTIAN", "JEHOVAH'S WITNESSES"
];

const PH_MOTHER_TONGUES = [
  "TAGALOG",
  "CEBUANO",
  "ILOCANO",
  "HILIGAYNON",
  "WARAY",
  "BIKOL",
  "KAPAMPANGAN",
  "PANGASINAN",
];

const SCP_PREFIXES: Record<string, string> = {
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING": "STE",
  "SPECIAL_PROGRAM_IN_THE_ARTS": "SPA",
  "SPECIAL_PROGRAM_IN_SPORTS": "SPS",
  "SPECIAL_PROGRAM_IN_JOURNALISM": "SPJ",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE": "SPFL",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION": "SPTVE",
};

async function main() {
  try {
    const schoolYear = await prisma.schoolYear.findFirst({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { id: "desc" }
    });

    if (!schoolYear) {
      throw new Error("No active school year found. Run main db:seed first.");
    }

    const grade7 = await prisma.gradeLevel.findFirst({
      where: { name: "Grade 7" },
    });

    if (!grade7) {
      throw new Error("Grade 7 not found.");
    }

    const admin = await prisma.user.findFirst({
      where: { role: "SYSTEM_ADMIN" },
    });

    if (!admin) {
      throw new Error("No SYSTEM_ADMIN found.");
    }

    console.log(`≡ƒî▒ Seeding SCP Applications for School Year: ${schoolYear.yearLabel}`);

    // Seed Applications
    for (let i = 1; i <= 30; i++) {
      const scpType = SCP_TYPES[i % SCP_TYPES.length];
      
      // Cascading index for unique name combinations
      const firstIdx = i % PH_FIRST_NAMES.length;
      const lastIdx = Math.floor(i / PH_FIRST_NAMES.length) % PH_LAST_NAMES.length;
      const midIdx = Math.floor(i / (PH_FIRST_NAMES.length * PH_LAST_NAMES.length)) % PH_MIDDLE_NAMES.length;

      const firstName = PH_FIRST_NAMES[firstIdx];
      const middleName = PH_MIDDLE_NAMES[midIdx];
      const lastName = PH_LAST_NAMES[lastIdx];
      
      // LRN: Source(10) + Year(26) + Padding + Index
      const lrn = `102600${String(i).padStart(6, '0')}`;
      
      const learner = await prisma.learner.upsert({
        where: { lrn },
        update: {},
        create: {
          lrn,
          firstName,
          lastName,
          middleName,
          sex: i % 2 === 0 ? ("FEMALE" as Sex) : ("MALE" as Sex),
          birthdate: new Date("2013-05-15"),
          placeOfBirth: PH_PLACE_OF_BIRTHS[i % PH_PLACE_OF_BIRTHS.length],
          religion: PH_RELIGIONS[i % PH_RELIGIONS.length],
          motherTongue: PH_MOTHER_TONGUES[i % PH_MOTHER_TONGUES.length],
          isIpCommunity: i % 10 === 0,
          ipGroupName: i % 10 === 0 ? "AETA" : null,
          isLearnerWithDisability: i % 15 === 0,
          disabilityTypes: i % 15 === 0 ? ["VISUAL IMPAIRMENT"] : [],
          is4PsBeneficiary: i % 5 === 0,
          householdId4Ps: i % 5 === 0 ? `4PS-${String(i).padStart(6, '0')}` : null,
          psaBirthCertNumber: `PSA-10-${String(i).padStart(8, '0')}`,
        }
      });

      const prefix = SCP_PREFIXES[scpType] || "SCP";
      const startYear = schoolYear.yearLabel.split("-")[0];
      const trackingNumber = `${prefix}-${startYear}-${String(i).padStart(5, '0')}`;
      await prisma.earlyRegistrationApplication.upsert({
        where: { trackingNumber },
        update: {},
        create: {
          learnerId: learner.id,
          schoolYearId: schoolYear.id,
          gradeLevelId: grade7.id,
          trackingNumber,
          applicantType: scpType,
          status: "SUBMITTED_BEERF",
          contactNumber: `0910${String(i).padStart(7, '0')}`,
          isPrivacyConsentGiven: true,
          encodedById: admin.id,
        }
      });
    }

    console.log("Γ£à SCP seeding completed.");
  } catch (error) {
    console.error("ERROR during SCP seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
