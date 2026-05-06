import "dotenv/config";
import { PrismaClient, Sex, ApplicantType, FamilyRelationship, AddressType, LearnerType, ApplicationStatus, ReadingProfileLevel } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PH_FIRST_NAMES_MALE = ["JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "CORAZON", "BENIGNO", "RAMON", "ELPIDIO", "SERGIO", "DIOSDADO", "JOSEPH"];
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
  console.log("🚀 Seeding Existing Learners (70 STE, 850 BEC per Grade Level G7-G9)...");

  // 1. Get Context
  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found.");

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9"] } }
  });

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  // 2. Global Section Cleanup (Ensure consistent naming)
  console.log("🧹 Cleaning up section names...");
  const rawSections = await prisma.section.findMany();
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

    const steSections = await prisma.section.findMany({
      where: { gradeLevelId: gradeLevel.id, schoolYearId: activeYear.id, programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING" }
    });

    const becSections = await prisma.section.findMany({
      where: { gradeLevelId: gradeLevel.id, schoolYearId: activeYear.id, programType: "REGULAR" }
    });

    if (steSections.length === 0 || becSections.length === 0) {
      console.warn(`⚠️ Missing sections for ${gradeLevel.name}. Skipping...`);
      continue;
    }

    // Process STE (70)
    await seedBatch(gradeLevel, "SCIENCE_TECHNOLOGY_AND_ENGINEERING", 70, steSections, activeYear, admin.id);
    
    // Process BEC (850)
    await seedBatch(gradeLevel, "REGULAR", 850, becSections, activeYear, admin.id);
  }

  console.log("\n✅ Seeding of existing learners completed successfully.");
}

async function seedBatch(gradeLevel: any, program: ApplicantType, count: number, sections: any[], activeYear: any, adminId: number) {
  const programLabel = program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : "BEC";
  console.log(`  - Seeding ${count} ${programLabel} learners...`);

  for (let i = 1; i <= count; i++) {
    const uniqueId = `${gradeLevel.id}-${programLabel}-${i}`;
    const sex: Sex = i % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = sex === "MALE" 
      ? PH_FIRST_NAMES_MALE[i % PH_FIRST_NAMES_MALE.length]
      : PH_FIRST_NAMES_FEMALE[i % PH_FIRST_NAMES_FEMALE.length];
    const lastName = PH_LAST_NAMES[i % PH_LAST_NAMES.length];
    const middleName = PH_MIDDLE_NAMES[i % PH_MIDDLE_NAMES.length];
    
    // LRN: GradeLevel (2) + Program (1: STE=3, BEC=4) + Index (6)
    const programDigit = program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "3" : "4";
    const lrn = `2026${gradeLevel.id}${programDigit}${String(i).padStart(5, '0')}`;
    
    const learnerData = {
      lrn,
      firstName,
      lastName,
      middleName,
      extensionName: i % 20 === 0 ? "JR" : null,
      sex,
      birthdate: new Date(2013 - (gradeLevel.id - 1), 4, 15 + (i % 15)),
      placeOfBirth: PH_CITIES[i % PH_CITIES.length],
      religion: "ROMAN CATHOLIC",
      motherTongue: PH_MOTHER_TONGUES[i % PH_MOTHER_TONGUES.length],
      isIpCommunity: i % 50 === 0,
      is4PsBeneficiary: i % 15 === 0,
      psaBirthCertNumber: `PSA-BC-${gradeLevel.id}-${programDigit}-${String(i).padStart(6, '0')}`,
      previousGenAve: program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 90 + (i % 8) : 80 + (i % 15),
      promotionStatus: "PROMOTED",
    };

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: learnerData,
      create: learnerData
    });

    const trackingNumber = `EXIST-${gradeLevel.id}-${programLabel}-${String(i).padStart(5, '0')}`;
    
    // Ensure relations are handled
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
            familyMembers: {
              create: [
                {
                  relationship: "MOTHER" as FamilyRelationship,
                  firstName: PH_FIRST_NAMES_FEMALE[(i + 1) % PH_FIRST_NAMES_FEMALE.length],
                  lastName: PH_LAST_NAMES[i % PH_LAST_NAMES.length],
                  middleName: PH_MIDDLE_NAMES[(i + 2) % PH_MIDDLE_NAMES.length],
                  contactNumber: `0917${String(i).padStart(7, '0')}`,
                  occupation: "HOUSEWIFE"
                },
                {
                  relationship: "FATHER" as FamilyRelationship,
                  firstName: PH_FIRST_NAMES_MALE[(i + 3) % PH_FIRST_NAMES_MALE.length],
                  lastName: PH_LAST_NAMES[i % PH_LAST_NAMES.length],
                  middleName: PH_MIDDLE_NAMES[(i + 4) % PH_MIDDLE_NAMES.length],
                  contactNumber: `0918${String(i).padStart(7, '0')}`,
                  occupation: "EMPLOYED"
                }
              ]
            },
            addresses: {
              create: [
                {
                  addressType: "CURRENT" as AddressType,
                  houseNoStreet: `${100 + i} Street`,
                  barangay: PH_BARANGAYS[i % PH_BARANGAYS.length],
                  cityMunicipality: PH_CITIES[i % PH_CITIES.length],
                  province: "METRO MANILA",
                  zipCode: "1100"
                }
              ]
            },
            previousSchool: {
              create: {
                schoolName: PH_ELEMENTARY_SCHOOLS[i % PH_ELEMENTARY_SCHOOLS.length],
                schoolType: "Public",
                gradeCompleted: `Grade ${parseInt(gradeLevel.name.split(" ")[1]) - 1}`,
                schoolYearAttended: "2025-2026",
                generalAverage: learnerData.previousGenAve
              }
            }
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
            familyMembers: {
              create: [
                {
                  relationship: "MOTHER" as FamilyRelationship,
                  firstName: PH_FIRST_NAMES_FEMALE[(i + 1) % PH_FIRST_NAMES_FEMALE.length],
                  lastName: PH_LAST_NAMES[i % PH_LAST_NAMES.length],
                  middleName: PH_MIDDLE_NAMES[(i + 2) % PH_MIDDLE_NAMES.length],
                  contactNumber: `0917${String(i).padStart(7, '0')}`,
                  occupation: "HOUSEWIFE"
                },
                {
                  relationship: "FATHER" as FamilyRelationship,
                  firstName: PH_FIRST_NAMES_MALE[(i + 3) % PH_FIRST_NAMES_MALE.length],
                  lastName: PH_LAST_NAMES[i % PH_LAST_NAMES.length],
                  middleName: PH_MIDDLE_NAMES[(i + 4) % PH_MIDDLE_NAMES.length],
                  contactNumber: `0918${String(i).padStart(7, '0')}`,
                  occupation: "EMPLOYED"
                }
              ]
            },
            addresses: {
              create: [
                {
                  addressType: "CURRENT" as AddressType,
                  houseNoStreet: `${100 + i} Street`,
                  barangay: PH_BARANGAYS[i % PH_BARANGAYS.length],
                  cityMunicipality: PH_CITIES[i % PH_CITIES.length],
                  province: "METRO MANILA",
                  zipCode: "1100"
                }
              ]
            },
            previousSchool: {
              create: {
                schoolName: PH_ELEMENTARY_SCHOOLS[i % PH_ELEMENTARY_SCHOOLS.length],
                schoolType: "Public",
                gradeCompleted: `Grade ${parseInt(gradeLevel.name.split(" ")[1]) - 1}`,
                schoolYearAttended: "2025-2026",
                generalAverage: learnerData.previousGenAve
              }
            }
        }
    });

    const section = sections[i % sections.length];
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

    if (i % 100 === 0) console.log(`    - Seeded ${i} learners...`);
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
