import "dotenv/config";
import {
  PrismaClient,
  Sex,
  ApplicantType,
  TLECategory,
  FamilyRelationship,
  AddressType,
  LearnerType,
  ApplicationStatus,
  ReadingProfileLevel,
  Role,
  EosyStatus,
} from "../../../src/generated/prisma/index.js";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

// --- Grade-level themed section names (matching seed-sections.ts) ---
const HEROES = [
  "JOSE RIZAL",
  "ANDRES BONIFACIO",
  "APOLINARIO MABINI",
  "MARCELO DEL PILAR",
  "JUAN LUNA",
  "EMILIO JACINTO",
  "GABRIELA SILANG",
  "EMILIO AGUINALDO",
  "GRACIANO LOPEZ JAENA",
  "GREGORIO DEL PILAR",
  "MELCHORA AQUINO",
  "DIEGO SILANG",
  "FRANCISCO BALAGTAS",
  "MARCIANA AGONCILLO",
  "TERESA MAGBANUA",
  "TRINIDAD TECSON",
];
const CORE_VALUES = [
  "MAKA-DIYOS",
  "MAKATAO",
  "MAKAKALIKASAN",
  "MAKABANSA",
  "KARANGALAN",
  "KATAPATAN",
  "KATAPANGAN",
  "KAGALINGAN",
  "KAAYUSAN",
  "KALAYAAN",
  "KATARUNGAN",
  "KASIPAGAN",
  "PAGKAKAISA",
  "PAGMAMAHAL",
  "PAGMALASAKIT",
  "PAGTITIPID",
  "PAGKAMALIKHAIN",
];
const FLOWERS = [
  "SAMPAGUITA",
  "GUMAMELA",
  "ROSAS",
  "ORCHID",
  "SUNFLOWER",
  "DAISY",
  "LILY",
  "TULIP",
  "JASMINE",
  "HIBISCUS",
  "ANTHURIUM",
  "CATTLEYA",
];
const MINERALS = [
  "GOLD",
  "SILVER",
  "COPPER",
  "IRON",
  "NICKEL",
  "CHROMITE",
  "QUARTZ",
  "FELDSPAR",
  "MICA",
  "TALC",
  "GYPSUM",
  "CALCITE",
  "APATITE",
];

const FALLBACK_TLE_PROGRAMS: {
  name: string;
  category: TLECategory;
  displayOrder: number;
}[] = [
  { name: "ICT", category: "ICT", displayOrder: 1 },
  { name: "HE - Cookery", category: "HOME_ECONOMICS", displayOrder: 2 },
  {
    name: "HE - Baking and Pastry Arts",
    category: "HOME_ECONOMICS",
    displayOrder: 3,
  },
  { name: "HE - Caregiving", category: "HOME_ECONOMICS", displayOrder: 4 },
  { name: "IA - Carpentry", category: "INDUSTRIAL_ARTS", displayOrder: 5 },
  {
    name: "IA - Electrical Installation",
    category: "INDUSTRIAL_ARTS",
    displayOrder: 6,
  },
  { name: "IA - Electronics", category: "INDUSTRIAL_ARTS", displayOrder: 7 },
  {
    name: "IA - Shielded Metal Arc Welding",
    category: "INDUSTRIAL_ARTS",
    displayOrder: 8,
  },
  {
    name: "AFA - Crop Production",
    category: "AGRI_FISHERY_ARTS",
    displayOrder: 9,
  },
  {
    name: "AFA - Fishery Arts",
    category: "AGRI_FISHERY_ARTS",
    displayOrder: 10,
  },
  {
    name: "AFA - Swine Production",
    category: "AGRI_FISHERY_ARTS",
    displayOrder: 11,
  },
];

type SeedGradeLevel = {
  id: number;
  name: string;
};

type SeedSchoolYear = {
  id: number;
  yearLabel: string;
};

type SeedSection = {
  id: number;
  name: string;
  programType: ApplicantType;
  maxCapacity: number;
  sortOrder: number;
  sectionRank: number | null;
  tleProgramId: number | null;
};

type SeedTleProgram = {
  id: number;
  name: string;
};

// Helper function to get theme pool for a grade level
function getThemePoolForGrade(gradeNum: number): string[] {
  if (gradeNum === 7) return HEROES;
  if (gradeNum === 8) return CORE_VALUES;
  if (gradeNum === 9) return FLOWERS;
  if (gradeNum === 10) return MINERALS;
  return [];
}

function resolveTleProgramId(
  section: SeedSection,
  gradeValue: number,
  tlePrograms: SeedTleProgram[],
): number | null {
  if (section.programType !== "REGULAR") {
    return null;
  }

  if (gradeValue !== 9 && gradeValue !== 10) {
    return null;
  }

  if (section.tleProgramId) {
    return section.tleProgramId;
  }

  if (tlePrograms.length === 0) {
    return null;
  }

  const programIndex = Math.max((section.sectionRank ?? section.sortOrder) - 1, 0);
  return tlePrograms[programIndex % tlePrograms.length]?.id ?? null;
}

async function ensureActiveTlePrograms(): Promise<SeedTleProgram[]> {
  let tlePrograms = await prisma.tLEProgram.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  if (tlePrograms.length > 0) {
    return tlePrograms;
  }

  console.warn(
    "⚠️ No active TLE programs found. Creating fallback TLE programs for Grade 9/10 BEC specialization.",
  );

  for (const program of FALLBACK_TLE_PROGRAMS) {
    await prisma.tLEProgram.upsert({
      where: { name: program.name },
      update: {
        category: program.category,
        displayOrder: program.displayOrder,
        isActive: true,
      },
      create: {
        name: program.name,
        category: program.category,
        displayOrder: program.displayOrder,
        isActive: true,
      },
    });
  }

  tlePrograms = await prisma.tLEProgram.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return tlePrograms;
}

async function main() {
  const targetYearLabel = process.env.SEED_TARGET_YEAR_LABEL ?? "2025-2026";
  const expectedTotalEnrolled = Number(
    process.env.SEED_EXPECTED_TOTAL_ENROLLED ?? "2890",
  );

  console.log(`Seeding existing learners for ${targetYearLabel}...`);

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: targetYearLabel },
  });

  if (!targetYear) {
    throw new Error(`Target school year not found: ${targetYearLabel}`);
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });

  const tlePrograms = await ensureActiveTlePrograms();

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  const sy2024 = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2024-2025" },
  });
  const sy2023 = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2023-2024" },
  });
  const sy2022 = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2022-2023" },
  });
  const syMap = new Map<number, number>();
  if (sy2024) syMap.set(9, sy2024.id);
  if (sy2023) syMap.set(8, sy2023.id);
  if (sy2022) syMap.set(7, sy2022.id);
  const gradeLevelMap = new Map(
    gradeLevels.map((gl) => [parseInt(gl.name.split(" ")[1]), gl.id]),
  );

  for (const gradeLevel of gradeLevels) {
    console.log(`\nProcessing ${gradeLevel.name}...`);

    const sections = await prisma.section.findMany({
      where: {
        gradeLevelId: gradeLevel.id,
        schoolYearId: targetYear.id,
      },
    });

    if (sections.length === 0) {
      console.warn(`No sections found for ${gradeLevel.name} in ${targetYearLabel}.`);
      continue;
    }

    for (const section of sections) {
      const currentEnrollmentCount = await prisma.enrollmentRecord.count({
        where: { sectionId: section.id, schoolYearId: targetYear.id },
      });

      const needed = section.maxCapacity - currentEnrollmentCount;
      if (needed <= 0) continue;

      console.log(`  - Filling ${section.name}: adding ${needed} learners...`);

      await seedSectionBatch(
        gradeLevel,
        section as SeedSection,
        needed,
        targetYear as SeedSchoolYear,
        admin.id,
        currentEnrollmentCount + 1,
        syMap,
        gradeLevelMap,
        tlePrograms,
      );
    }
  }

  const finalTotal = await prisma.enrollmentRecord.count({
    where: {
      schoolYearId: targetYear.id,
      enrollmentApplication: {
        status: { in: ["ENROLLED", "OFFICIALLY_ENROLLED", "TEMPORARILY_ENROLLED"] },
      },
    },
  });

  console.log(`\nFinal enrolled total for ${targetYearLabel}: ${finalTotal}`);

  if (finalTotal !== expectedTotalEnrolled) {
    throw new Error(
      `Expected ${expectedTotalEnrolled} enrolled learners for ${targetYearLabel}, got ${finalTotal}.`,
    );
  }

  console.log("Existing learners seed completed with expected total.");
}


// For each learner, create historical applications and enrollment records for archived years (2024-2025, 2023-2024, 2022-2023)
async function seedHistoricalAcademicHistory(
  learnerId: number,
  lrn: string,
  gradeValue: number,
  program: ApplicantType,
  adminId: number,
  syMap: Map<number, number>,
  gradeLevelMap: Map<number, number>,
  tleProgramId: number | null,
  section: SeedSection,
  tlePrograms: SeedTleProgram[],
  nameIndex: number,
  previousGenAve: number,
) {
  // For each prior grade, create an application and enrollment record
  for (let priorGrade = gradeValue - 1; priorGrade >= 7; priorGrade--) {
    const syId = syMap.get(priorGrade);
    const gradeLevelId = gradeLevelMap.get(priorGrade);
    if (!syId || !gradeLevelId) continue;
    const trackingNumber = `HIST-${lrn}-G${priorGrade}`;
    
    // Find a section for prior grade using GRADE-APPROPRIATE THEME
    // Instead of matching by name, find ANY section of the same program type with the appropriate grade theme
    const themePool = getThemePoolForGrade(priorGrade);
    
    let historicalSection: SeedSection | null = null;
    if (themePool.length > 0) {
      // Try to find a section with a name from the theme pool for this grade
      historicalSection = (await prisma.section.findFirst({
        where: {
          schoolYearId: syId,
          gradeLevelId: gradeLevelId,
          programType: section.programType,
          name: { in: themePool },
        },
      })) as SeedSection | null;
    }
    
    if (!historicalSection) {
      // Fallback: find ANY section for this grade/program if no themed match
      historicalSection = (await prisma.section.findFirst({
        where: {
          schoolYearId: syId,
          gradeLevelId: gradeLevelId,
          programType: section.programType,
        },
        orderBy: { sortOrder: "asc" },
      })) as SeedSection | null;
    }
    
    if (!historicalSection) {
      console.warn(
        `⚠ No section found for G${priorGrade} (${section.programType}) in school year ${syId}. Skipping this year.`,
      );
      continue;
    }
    
    // Assign TLE program for G9/G10, else null
    let historicalTleProgramId: number | null = null;
    if (priorGrade === 9 || priorGrade === 10) {
      // Use same TLE as current if available, else resolve by section
      historicalTleProgramId =
        tleProgramId ??
        resolveTleProgramId(
          {
            ...section,
            id: historicalSection.id,
            tleProgramId: historicalSection.tleProgramId,
            sectionRank: historicalSection.sectionRank,
          },
          priorGrade,
          tlePrograms,
        );
    }
    // Calculate year-end status and final average for archived year
    const eosyStatuses: EosyStatus[] = ["PROMOTED", "CONDITIONALLY_PROMOTED"];
    const eosyStatus = eosyStatuses[(nameIndex + priorGrade) % eosyStatuses.length] as EosyStatus;
    // Final average: vary from previousGenAve by ±3 points
    const variance = ((nameIndex + priorGrade * 7) % 7) - 3;
    const finalAverage = Math.max(60, Math.min(100, previousGenAve + variance));
    // Upsert application
    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {
        status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
        tleProgramId: historicalTleProgramId,
      },
      create: {
        trackingNumber,
        learnerId,
        gradeLevelId,
        schoolYearId: syId,
        applicantType: program,
        learnerType: "CONTINUING" as LearnerType,
        status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
        isPrivacyConsentGiven: true,
        admissionChannel: "F2F",
        encodedById: adminId,
        tleProgramId: historicalTleProgramId,
      },
    });
    // Upsert enrollment record for this application with the historical section (dynamically selected by grade theme)
    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: application.id },
      update: {
        schoolYearId: syId,
        sectionId: historicalSection.id,
        enrolledById: adminId,
        learnerId,
        tleProgramId: historicalTleProgramId,
        eosyStatus,
        finalAverage,
      },
      create: {
        enrollmentApplicationId: application.id,
        schoolYearId: syId,
        sectionId: historicalSection.id,
        enrolledById: adminId,
        learnerId,
        enrolledAt: new Date(),
        confirmationConsent: true,
        tleProgramId: historicalTleProgramId,
        eosyStatus,
        finalAverage,
      },
    });
  }
}

async function seedSectionBatch(
  gradeLevel: SeedGradeLevel,
  section: SeedSection,
  count: number,
  targetYear: SeedSchoolYear,
  adminId: number,
  startIndex: number,
  syMap: Map<number, number>,
  gradeLevelMap: Map<number, number>,
  tlePrograms: SeedTleProgram[],
) {
  const gradeValue = parseInt(gradeLevel.name.split(" ")[1]);
  const program: ApplicantType = section.programType;
  const sectionTleProgramId = resolveTleProgramId(section, gradeValue, tlePrograms);

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

    const lrn = `1225${(section.id % 1000).toString().padStart(3, "0")}${(sequence % 100000).toString().padStart(5, "0")}`;
    const birthYear = 2025 - (gradeValue + 6);

    const learnerData = {
      lrn,
      firstName,
      lastName: lastName || "UNKNOWN",
      middleName: middleName || "UNKNOWN",
      extensionName: sequence % 30 === 0 ? "JR" : undefined,
      sex: sex || "MALE",
      birthdate: toUtcNoon(birthYear, sequence % 12, 15),
      placeOfBirth: PH_CITIES[sequence % PH_CITIES.length] || "MANILA",
      religion: "ROMAN CATHOLIC",
      motherTongue: PH_MOTHER_TONGUES[sequence % PH_MOTHER_TONGUES.length] || "TAGALOG",
      isIpCommunity: typeof sequence === "number" ? sequence % 50 === 0 : false,
      is4PsBeneficiary: typeof sequence === "number" ? sequence % 15 === 0 : false,
      psaBirthCertNumber: lrn ? `PSA-12-${lrn}` : "PSA-12-0000000",
      previousGenAve:
        program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
          ? 90 + (sequence % 8)
          : 80 + (sequence % 15),
      promotionStatus: "PROMOTED",
    };

    const programPrefix =
      program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : "REG";
    const startYear = targetYear.yearLabel.split("-")[0];
    const trackingNumber = `${programPrefix}-${startYear}-${(section.id % 1000).toString().padStart(3, "0")}${(sequence % 100).toString().padStart(2, "0")}`;

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
        mustChangePassword: true,
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
        tleProgramId: sectionTleProgramId,
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
        tleProgramId: sectionTleProgramId,
        familyMembers: {
          create: [
            // Mother
            {
              relationship: "MOTHER" as FamilyRelationship,
              firstName: PH_FIRST_NAMES_FEMALE[(nameIndex + 5000) % PH_FIRST_NAMES_FEMALE.length],
              lastName: PH_LAST_NAMES[Math.floor((nameIndex + 5000) / PH_FIRST_NAMES_FEMALE.length) % PH_LAST_NAMES.length],
              middleName: PH_MIDDLE_NAMES[Math.floor((nameIndex + 5000) / (PH_FIRST_NAMES_FEMALE.length * PH_LAST_NAMES.length)) % PH_MIDDLE_NAMES.length],
              contactNumber: `0922${String(nameIndex + 5000).padStart(7, "0").slice(-7)}`,
              occupation: "HOUSEWIFE",
            },
            // Father
            {
              relationship: "FATHER" as FamilyRelationship,
              firstName: PH_FIRST_NAMES_MALE[(nameIndex + 3000) % PH_FIRST_NAMES_MALE.length],
              lastName: PH_LAST_NAMES[Math.floor((nameIndex + 3000) / PH_FIRST_NAMES_MALE.length) % PH_LAST_NAMES.length],
              middleName: PH_MIDDLE_NAMES[Math.floor((nameIndex + 3000) / (PH_FIRST_NAMES_MALE.length * PH_LAST_NAMES.length)) % PH_MIDDLE_NAMES.length],
              contactNumber: `0917${String(nameIndex + 3000).padStart(7, "0").slice(-7)}`,
              occupation: "EMPLOYEE",
            },
            // Guardian (sample: uncle/aunt)
            {
              relationship: "GUARDIAN" as FamilyRelationship,
              firstName: firstName || "GUARDIAN",
              lastName: lastName || "GUARDIAN",
              middleName: middleName || "GUARDIAN",
              contactNumber: `0998${String(nameIndex + 7000).padStart(7, "0").slice(-7)}`,
              occupation: "GUARDIAN",
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
        learnerId: learner.id,
        tleProgramId: sectionTleProgramId,
      },
      create: {
        enrollmentApplicationId: application.id,
        schoolYearId: targetYear.id,
        sectionId: section.id,
        enrolledById: adminId,
        learnerId: learner.id,
        enrolledAt: new Date(),
        confirmationConsent: true,
        tleProgramId: sectionTleProgramId,
      },
    });

    // Add academic history for archived years (2024-2025, 2023-2024, 2022-2023)
    await seedHistoricalAcademicHistory(
      learner.id,
      lrn,
      gradeValue,
      program,
      adminId,
      syMap,
      gradeLevelMap,
      sectionTleProgramId,
      section,
      tlePrograms,
      nameIndex,
      learnerData.previousGenAve,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
