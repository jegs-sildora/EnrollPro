import "dotenv/config";
import { PrismaClient, Sex, ApplicantType, FamilyRelationship, AddressType, LearnerType, ApplicationStatus, ReadingProfileLevel } from "../src/generated/prisma/index.js";
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
"JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "CORAZON", "BENIGNO", "RAMON", "ELPIDIO", "SERGIO", "DIOSDADO", "JOSEPH"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA", "IMELDA", "GLORIA", "CORAZON", "LOURDES", "REMEDIOS", "CARMELA", "JOSEFINA", "PERLA", "AURORA", "ESTRELLA"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "MARCOS", "DUTERTE", "ESTRADA", "ARROYO", "MAGSAYSAY", "QUIRINO", "OSMEÑA", "MACAPAGAL", "ROXAS", "QUEZON"];
const PH_MIDDLE_NAMES = ["SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG"];

const PH_CITIES = ["QUEZON CITY", "MANILA", "CALOOCAN", "DAVAO CITY", "CEBU CITY", "ZAMBOANGA CITY", "ANTIPOLO", "PASIG", "TAGUIG", "VALENZUELA", "DASMARIÑAS", "CAVITE CITY", "BACOOR", "IMUS", "LAS PIÑAS"];
const PH_MOTHER_TONGUES = ["TAGALOG", "CEBUANO", "ILOCANO", "HILIGAYNON", "WARAY", "BIKOL", "KAPAMPANGAN", "PANGASINAN", "CHAVACANO", "MAGUINDANAON"];
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
  "A. BONIFACIO ELEMENTARY SCHOOL"
];

const PH_BARANGAYS = ["BARANGAY 1", "BARANGAY 2", "SAN ISIDRO", "STA. LUCIA", "SANTO NIÑO", "CONCEPCION", "MALANDAY", "POBLACION", "SAN JOSE", "SAN ROQUE"];

async function main() {
  console.log("🚀 Seeding Existing Learners (Filling all G7-G10 sections to 100% capacity)...");

  // 1. Get Context
  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found.");

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" }
  });

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  // 2. Global Section Cleanup (Ensure consistent naming)
  console.log("🧹 Cleaning up section names...");
  const rawSections = await prisma.section.findMany({
    where: { schoolYearId: activeYear.id }
  });
  
  for (const section of rawSections) {
    let newName = section.name.replace(/ - G\d+/g, "").replace(" (BEC)", "").replace(" (STE)", "").trim();
    
    if (newName !== section.name) {
      await prisma.section.update({
        where: { id: section.id },
        data: { name: newName }
      });
    }
  }

  for (const gradeLevel of gradeLevels) {
    console.log(`\n📦 Processing ${gradeLevel.name}...`);

    // Get all sections for this grade level
    const sections = await prisma.section.findMany({
      where: { 
        gradeLevelId: gradeLevel.id, 
        schoolYearId: activeYear.id 
      }
    });

    if (sections.length === 0) {
      console.warn(`⚠️ No sections found for ${gradeLevel.name}. Skipping...`);
      continue;
    }

    for (const section of sections) {
      // Calculate current enrollment in this section
      const currentEnrollmentCount = await prisma.enrollmentRecord.count({
        where: { 
          sectionId: section.id,
          schoolYearId: activeYear.id
        }
      });

      const needed = section.maxCapacity - currentEnrollmentCount;
      
      if (needed <= 0) {
        console.log(`  ✅ Section ${section.name} is already at full capacity (${section.maxCapacity}).`);
        continue;
      }

      console.log(`  - Filling Section: ${section.name} (${currentEnrollmentCount}/${section.maxCapacity}). Adding ${needed} learners...`);
      
      await seedSectionBatch(
        gradeLevel, 
        section.programType as ApplicantType, 
        needed, 
        section, 
        activeYear, 
        admin.id,
        currentEnrollmentCount + 1 // Start index offset to ensure unique tracking numbers/LRNs if re-run
      );
    }
  }

  console.log("\n✅ Seeding of existing learners completed successfully.");
}

async function seedSectionBatch(
  gradeLevel: any, 
  program: ApplicantType, 
  count: number, 
  section: any, 
  activeYear: any, 
  adminId: number,
  startIndex: number
) {
  const programLabel = program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : "BEC";
  const gradeValue = parseInt(gradeLevel.name.split(" ")[1]);

  for (let i = 0; i < count; i++) {
    const sequence = startIndex + i;
    const sex: Sex = sequence % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = sex === "MALE" 
      ? PH_FIRST_NAMES_MALE[sequence % PH_FIRST_NAMES_MALE.length]
      : PH_FIRST_NAMES_FEMALE[sequence % PH_FIRST_NAMES_FEMALE.length];
    const lastName = PH_LAST_NAMES[sequence % PH_LAST_NAMES.length];
    const middleName = PH_MIDDLE_NAMES[sequence % PH_MIDDLE_NAMES.length];
    
    // LRN: Prefix(2026) + SectionId padded to 4 digits + Sequence padded to 4 digits
    // Total: 4 + 4 + 4 = 12 digits (exactly matching VarChar(12) constraint)
    const lrn = `2026${section.id.toString().padStart(4, '0')}${sequence.toString().padStart(4, '0')}`;
    
    // Birthdate offset based on grade (G7 typically 12-13 years old in 2026, so born ~2013-2014)
    const birthYear = 2026 - (gradeValue + 6); // Approximation for JHS ages
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
      psaBirthCertNumber: `PSA-BC-${lrn}`,
      previousGenAve: program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 90 + (sequence % 8) : 80 + (sequence % 15),
      promotionStatus: "PROMOTED",
    };

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: learnerData,
      create: learnerData
    });

    const trackingNumber = `EXIST-${section.id}-${sequence.toString().padStart(5, '0')}`;
    
    // Ensure relations are handled for cleanup
    const existingApp = await prisma.enrollmentApplication.findUnique({ where: { trackingNumber } });
    if (existingApp) {
      await prisma.applicationFamilyMember.deleteMany({ where: { enrollmentId: existingApp.id } });
      await prisma.applicationAddress.deleteMany({ where: { enrollmentId: existingApp.id } });
      await prisma.enrollmentPreviousSchool.deleteMany({ where: { applicationId: existingApp.id } });
    }

    const application = await prisma.enrollmentApplication.upsert({
        where: { trackingNumber },
        update: {
            learnerId: learner.id,
            gradeLevelId: gradeLevel.id,
            schoolYearId: activeYear.id,
            applicantType: program,
            learnerType: "CONTINUING" as LearnerType,
            status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
            isPrivacyConsentGiven: true,
            admissionChannel: "F2F",
            encodedById: adminId,
            readingProfileLevel: "INDEPENDENT" as ReadingProfileLevel,
            guardianRelationship: "MOTHER",
            portalPin: defaultPinHash,
        },
        create: {
            learnerId: learner.id,
            gradeLevelId: gradeLevel.id,
            schoolYearId: activeYear.id,
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
                  firstName: PH_FIRST_NAMES_FEMALE[(sequence + 1) % PH_FIRST_NAMES_FEMALE.length],
                  lastName: PH_LAST_NAMES[sequence % PH_LAST_NAMES.length],
                  middleName: PH_MIDDLE_NAMES[(sequence + 2) % PH_MIDDLE_NAMES.length],
                  contactNumber: `0917${String(sequence).padStart(7, '0').slice(-7)}`,
                  occupation: "HOUSEWIFE"
                }
              ]
            },
            addresses: {
              create: [
                {
                  addressType: "CURRENT" as AddressType,
                  houseNoStreet: `${100 + (sequence % 900)} Street`,
                  barangay: PH_BARANGAYS[sequence % PH_BARANGAYS.length],
                  cityMunicipality: PH_CITIES[sequence % PH_CITIES.length],
                  province: "METRO MANILA",
                  zipCode: "1100"
                }
              ]
            },
            previousSchool: {
              create: {
                schoolName: PH_ELEMENTARY_SCHOOLS[sequence % PH_ELEMENTARY_SCHOOLS.length],
                schoolType: "Public",
                gradeCompleted: `Grade ${gradeValue - 1}`,
                schoolYearAttended: "2025-2026",
                generalAverage: learnerData.previousGenAve
              }
            }
        }
    });

    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: application.id },
      update: {
        schoolYearId: activeYear.id,
        sectionId: section.id,
        enrolledById: adminId,
      },
      create: {
        enrollmentApplicationId: application.id,
        schoolYearId: activeYear.id,
        sectionId: section.id,
        enrolledById: adminId,
        enrolledAt: new Date(),
        confirmationConsent: true,
      }
    });

    if ((i + 1) % 20 === 0 || (i + 1) === count) {
       // Log progress within the section
    }
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
