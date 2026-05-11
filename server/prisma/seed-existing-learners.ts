import "dotenv/config";
import {
  PrismaClient,
  Sex,
  ApplicantType,
  FamilyRelationship,
  AddressType,
  LearnerType,
  ApplicationStatus,
  ReadingProfileLevel,
  Role,
} from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const defaultPinHash = bcrypt.hashSync("DepEd2026!", 10);

function toUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

const PH_FIRST_NAMES_MALE = [
  "JUAN",
  "JOSE",
  "MIGUEL",
  "CARLO",
  "RAFAEL",
  "PAOLO",
  "ANTONIO",
  "GABRIEL",
  "MATEO",
  "DIEGO",
  "EMMANUEL",
  "CHRISTIAN",
  "JOSHUA",
  "ANGELO",
  "RICARDO",
  "FERDINAND",
  "RODRIGO",
  "MANUEL",
  "CORAZON",
  "BENIGNO",
  "RAMON",
  "ELPIDIO",
  "SERGIO",
  "DIOSDADO",
  "JOSEPH",
];
const PH_FIRST_NAMES_FEMALE = [
  "MARIA",
  "ANGELICA",
  "PRINCESS",
  "JASMINE",
  "NICOLE",
  "GABRIELA",
  "SOFIA",
  "ISABELLA",
  "LIZA",
  "BEA",
  "CRISTINA",
  "PATRICIA",
  "ELENA",
  "ROSA",
  "TERESA",
  "IMELDA",
  "GLORIA",
  "CORAZON",
  "LOURDES",
  "REMEDIOS",
  "CARMELA",
  "JOSEFINA",
  "PERLA",
  "AURORA",
  "ESTRELLA",
];
const PH_LAST_NAMES = [
  "DELA CRUZ",
  "REYES",
  "SANTOS",
  "GARCIA",
  "MENDOZA",
  "FERNANDEZ",
  "NAVARRO",
  "RAMOS",
  "BAUTISTA",
  "GONZALES",
  "TORRES",
  "VILLANUEVA",
  "CRUZ",
  "PASCUAL",
  "AQUINO",
  "MARCOS",
  "DUTERTE",
  "ESTRADA",
  "ARROYO",
  "MAGSAYSAY",
  "QUIRINO",
  "OSMEÑA",
  "MACAPAGAL",
  "ROXAS",
  "QUEZON",
];
const PH_MIDDLE_NAMES = [
  "SANTIAGO",
  "DE LEON",
  "BALTAZAR",
  "CASTILLO",
  "SORIANO",
  "DEL ROSARIO",
  "VALDEZ",
  "RODRIGUEZ",
  "PANGANIBAN",
  "IBARRA",
  "LUNA",
  "SILANG",
];

const PH_CITIES = [
  "QUEZON CITY",
  "MANILA",
  "CALOOCAN",
  "DAVAO CITY",
  "CEBU CITY",
  "ZAMBOANGA CITY",
  "ANTIPOLO",
  "PASIG",
  "TAGUIG",
  "VALENZUELA",
  "DASMARIÑAS",
  "CAVITE CITY",
  "BACOOR",
  "IMUS",
  "LAS PIÑAS",
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
  "CHAVACANO",
  "MAGUINDANAON",
];
const PH_ELEMENTARY_SCHOOLS = [
  "CENTRAL ELEMENTARY SCHOOL",
  "SAN JOSE ELEMENTARY SCHOOL",
  "STA. MARIA ELEMENTARY SCHOOL",
  "STO. NIÑO ELEMENTARY SCHOOL",
  "BAGONG PAG-ASA ELEMENTARY SCHOOL",
  "MALIGAYA ELEMENTARY SCHOOL",
  "MAHABANG PARANG ELEMENTARY SCHOOL",
  "SAN ROQUE ELEMENTARY SCHOOL",
  "P. GOMEZ ELEMENTARY SCHOOL",
  "JOSE RIZAL ELEMENTARY SCHOOL",
  "A. BONIFACIO ELEMENTARY SCHOOL",
];

const PH_BARANGAYS = [
  "BARANGAY 1",
  "BARANGAY 2",
  "SAN ISIDRO",
  "STA. LUCIA",
  "SANTO NIÑO",
  "CONCEPCION",
  "MALANDAY",
  "POBLACION",
  "SAN JOSE",
  "SAN ROQUE",
];

async function main() {
  console.log("🚀 Seeding Existing Learners for 2025-2026 (Demo Data)...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!targetYear) throw new Error("Timeline failure: 2025-2026 not found.");

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  for (const gradeLevel of gradeLevels) {
    console.log(`\n📦 Processing ${gradeLevel.name}...`);

    const sections = await prisma.section.findMany({
      where: {
        gradeLevelId: gradeLevel.id,
        schoolYearId: targetYear.id,
      },
    });

    if (sections.length === 0) {
      console.warn(`⚠️ No sections found for ${gradeLevel.name} in 2025-2026.`);
      continue;
    }

    for (const section of sections) {
      const currentEnrollmentCount = await prisma.enrollmentRecord.count({
        where: { sectionId: section.id, schoolYearId: targetYear.id },
      });

      const needed = section.maxCapacity - currentEnrollmentCount;
      if (needed <= 0) continue;

      console.log(`  - Filling ${section.name}: Adding ${needed} learners...`);

      await seedSectionBatch(
        gradeLevel,
        section.programType as ApplicantType,
        needed,
        section,
        targetYear,
        admin.id,
        currentEnrollmentCount + 1,
      );
    }
  }

  console.log("\n✅ Seeding of existing learners for 2025-2026 completed.");
}

async function seedSectionBatch(
  gradeLevel: any,
  program: ApplicantType,
  count: number,
  section: any,
  targetYear: any,
  adminId: number,
  startIndex: number,
) {
  const gradeValue = parseInt(gradeLevel.name.split(" ")[1]);

  for (let i = 0; i < count; i++) {
    const sequence = startIndex + i;
    const sex: Sex = sequence % 2 === 0 ? "FEMALE" : "MALE";
    const nameIndex = sequence + section.id * 31;
    const firstPool =
      sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;

    const firstName = firstPool[nameIndex % firstPool.length];
    const lastName =
      PH_LAST_NAMES[
        Math.floor(nameIndex / firstPool.length) % PH_LAST_NAMES.length
      ];
    const middleName =
      PH_MIDDLE_NAMES[
        Math.floor(nameIndex / (firstPool.length * PH_LAST_NAMES.length)) %
          PH_MIDDLE_NAMES.length
      ];

    const lrn = `1225${section.id.toString().padStart(3, "0")}${sequence.toString().padStart(5, "0")}`;
    const birthYear = 2025 - (gradeValue + 6);

    const learnerData = {
      lrn,
      firstName,
      lastName,
      middleName,
      extensionName: sequence % 30 === 0 ? "JR" : null,
      sex,
      birthdate: toUtcNoon(birthYear, sequence % 12, 15),
      placeOfBirth: PH_CITIES[sequence % PH_CITIES.length],
      religion: "ROMAN CATHOLIC",
      motherTongue: PH_MOTHER_TONGUES[sequence % PH_MOTHER_TONGUES.length],
      isIpCommunity: sequence % 50 === 0,
      is4PsBeneficiary: sequence % 15 === 0,
      psaBirthCertNumber: `PSA-12-${lrn}`,
      previousGenAve:
        program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
          ? 90 + (sequence % 8)
          : 80 + (sequence % 15),
      promotionStatus: "PROMOTED",
    };

    const programPrefix =
      program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : "REG";
    const startYear = targetYear.yearLabel.split("-")[0];
    const trackingNumber = `${programPrefix}-${startYear}-${section.id.toString().padStart(3, "0")}${sequence.toString().padStart(2, "0")}`;

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: learnerData,
      create: learnerData,
    });

    // Create login account for enrolled learner
    const learnerUser = await prisma.user.upsert({
      where: { accountName: lrn },
      update: { firstName, lastName, middleName },
      create: {
        firstName,
        lastName,
        middleName,
        accountName: lrn,
        password: defaultPinHash,
        role: "LEARNER" as Role,
        sex,
        isActive: true,
        mustChangePassword: false,
      },
    });
    if (!learner.userId) {
      await prisma.learner.update({
        where: { id: learner.id },
        data: { userId: learnerUser.id },
      });
    }

    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {
        learnerId: learner.id,
        gradeLevelId: gradeLevel.id,
        schoolYearId: targetYear.id,
        applicantType: program,
        learnerType: "CONTINUING" as LearnerType,
        status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
        portalPin: defaultPinHash,
      },
      create: {
        learnerId: learner.id,
        gradeLevelId: gradeLevel.id,
        schoolYearId: targetYear.id,
        applicantType: program,
        learnerType: "CONTINUING" as LearnerType,
        status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
        trackingNumber,
        isPrivacyConsentGiven: true,
        admissionChannel: "F2F",
        encodedById: adminId,
        readingProfileLevel: "INDEPENDENT" as ReadingProfileLevel,
        guardianRelationship: "MOTHER",
        portalPin: defaultPinHash,
        familyMembers: {
          create: [
            {
              relationship: "MOTHER" as FamilyRelationship,
              firstName:
                PH_FIRST_NAMES_FEMALE[
                  (nameIndex + 5000) % PH_FIRST_NAMES_FEMALE.length
                ],
              lastName:
                PH_LAST_NAMES[
                  Math.floor(
                    (nameIndex + 5000) / PH_FIRST_NAMES_FEMALE.length,
                  ) % PH_LAST_NAMES.length
                ],
              middleName:
                PH_MIDDLE_NAMES[
                  Math.floor(
                    (nameIndex + 5000) /
                      (PH_FIRST_NAMES_FEMALE.length * PH_LAST_NAMES.length),
                  ) % PH_MIDDLE_NAMES.length
                ],
              contactNumber: `0922${String(nameIndex + 5000)
                .padStart(7, "0")
                .slice(-7)}`,
              occupation: "HOUSEWIFE",
            },
          ],
        },
        addresses: {
          create: [
            {
              addressType: "CURRENT" as AddressType,
              houseNoStreet: `${100 + (sequence % 900)} Street`,
              barangay: PH_BARANGAYS[sequence % PH_BARANGAYS.length],
              cityMunicipality: PH_CITIES[sequence % PH_CITIES.length],
              province: "METRO MANILA",
              zipCode: "1100",
            },
          ],
        },
      },
    });

    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: application.id },
      update: {
        schoolYearId: targetYear.id,
        sectionId: section.id,
        enrolledById: adminId,
      },
      create: {
        enrollmentApplicationId: application.id,
        schoolYearId: targetYear.id,
        sectionId: section.id,
        enrolledById: adminId,
        enrolledAt: new Date(),
        confirmationConsent: true,
      },
    });
  }
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
