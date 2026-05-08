import "dotenv/config";
import { PrismaClient, Sex, ApplicantType, FamilyRelationship, AddressType, LearnerType, ApplicationStatus, ReadingProfileLevel } from "../src/generated/prisma/index.js";
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
"JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "ERNESTO", "ORLANDO", "SALVADOR", "EFREN", "ROLANDO"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA", "CORAZON", "LETICIA", "LEONORA", "IMELDA", "GLORIA"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "LUNA", "CASTRO", "BELTRAN", "VILLAR", "ZUBIRI"];
const PH_MIDDLE_NAMES = ["SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "MABINI", "PANGANIBAN"];

const PH_CITIES = ["QUEZON CITY", "MANILA", "CALOOCAN", "DAVAO CITY", "CEBU CITY", "ZAMBOANGA CITY", "ANTIPOLO", "PASIG", "TAGUIG", "VALENZUELA"];
const PH_MOTHER_TONGUES = ["TAGALOG", "CEBUANO", "ILOCANO", "HILIGAYNON", "WARAY", "BIKOL", "KAPAMPANGAN", "PANGASINAN"];
const PH_ELEMENTARY_SCHOOLS = [
  "CENTRAL ELEMENTARY SCHOOL",
  "SAN JOSE ELEMENTARY SCHOOL",
  "STA. MARIA ELEMENTARY SCHOOL",
  "STO. NIÑO ELEMENTARY SCHOOL",
  "BAGONG PAG-ASA ELEMENTARY SCHOOL",
  "MALIGAYA ELEMENTARY SCHOOL",
  "MAHABANG PARANG ELEMENTARY SCHOOL",
  "SAN ROQUE ELEMENTARY SCHOOL"
];

const PH_BARANGAYS = ["BARANGAY 1", "BARANGAY 2", "SAN ISIDRO", "STA. LUCIA", "SANTO NIÑO", "CONCEPCION", "MALANDAY", "POBLACION"];

async function main() {
  console.log("🚀 Scaling Enrollment Data: Provisioning 400+ Learners...");

  // 1. Get Context
  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found. Run main db:seed first.");

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" }
  });

  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (!admin) throw new Error("No SYSTEM_ADMIN found.");

  const totalLearners = 420; // Scale to 400+

  for (let i = 1; i <= totalLearners; i++) {
    const sex: Sex = i % 2 === 0 ? "FEMALE" : "MALE";
    const firstName = sex === "MALE" 
      ? PH_FIRST_NAMES_MALE[i % PH_FIRST_NAMES_MALE.length]
      : PH_FIRST_NAMES_FEMALE[i % PH_FIRST_NAMES_FEMALE.length];
    const lastName = PH_LAST_NAMES[i % PH_LAST_NAMES.length];
    const middleName = PH_MIDDLE_NAMES[i % PH_MIDDLE_NAMES.length];
    
    // Distribute across grade levels
    const gradeLevel = gradeLevels[(i - 1) % gradeLevels.length];
    const lrn = `2026${gradeLevel.id}${String(i).padStart(6, '0')}`;
    
    const learnerData = {
      lrn,
      firstName,
      lastName,
      middleName,
      extensionName: i % 30 === 0 ? "JR" : null,
      sex,
      birthdate: toUtcNoon(2013 - (parseInt(gradeLevel.name.split(" ")[1]) - 7), 4, 15 + (i % 15)),
      placeOfBirth: PH_CITIES[i % PH_CITIES.length],
      religion: "ROMAN CATHOLIC",
      motherTongue: PH_MOTHER_TONGUES[i % PH_MOTHER_TONGUES.length],
      isIpCommunity: i % 50 === 0,
      ipGroupName: i % 50 === 0 ? "TAGALOG" : null,
      isLearnerWithDisability: false,
      disabilityTypes: [],
      is4PsBeneficiary: i % 20 === 0,
      householdId4Ps: i % 20 === 0 ? `HH-ID-${i}` : null,
      psaBirthCertNumber: `PSA-BC-${String(i).padStart(8, '0')}`,
      previousGenAve: 85 + (i % 12),
      promotionStatus: "PROMOTED",
    };

    // 4. Create/Update Learner
    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: learnerData,
      create: learnerData
    });

    // 5. Create Enrollment Application
    const trackingNumber = `ENR-${activeYear.id}-${String(i).padStart(5, '0')}`;
    
    // We'll use a transaction or simplified logic for family/address to speed up seeding
    await prisma.enrollmentApplication.upsert({
        where: { trackingNumber },
        update: {
            learnerId: learner.id,
            gradeLevelId: gradeLevel.id,
            schoolYearId: activeYear.id,
            applicantType: "REGULAR" as ApplicantType,
            learnerType: "NEW_ENROLLEE" as LearnerType,
            status: "ENROLLED" as ApplicationStatus,
            isPrivacyConsentGiven: true,
            admissionChannel: "ONLINE",
            encodedById: admin.id,
            readingProfileLevel: "INSTRUCTIONAL" as ReadingProfileLevel,
            guardianRelationship: "MOTHER",
            portalPin: defaultPinHash,
        },
        create: {
            learnerId: learner.id,
            gradeLevelId: gradeLevel.id,
            schoolYearId: activeYear.id,
            applicantType: "REGULAR" as ApplicantType,
            learnerType: "NEW_ENROLLEE" as LearnerType,
            status: "ENROLLED" as ApplicationStatus,
            trackingNumber,
            isPrivacyConsentGiven: true,
            admissionChannel: "ONLINE",
            encodedById: admin.id,
            readingProfileLevel: "INSTRUCTIONAL" as ReadingProfileLevel,
            guardianRelationship: "MOTHER",
            hasNoMother: false,
            hasNoFather: false,
            portalPin: defaultPinHash,
            familyMembers: {
              create: [
                {
                  relationship: "MOTHER" as FamilyRelationship,
                  firstName: PH_FIRST_NAMES_FEMALE[(i + 1) % PH_FIRST_NAMES_FEMALE.length],
                  lastName: PH_LAST_NAMES[i % PH_LAST_NAMES.length],
                  middleName: PH_MIDDLE_NAMES[(i + 2) % PH_MIDDLE_NAMES.length],
                  contactNumber: `0917${String(i).padStart(7, '0')}`,
                  occupation: "HOUSEWIFE"
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
            }
        }
    });

    const application = await prisma.enrollmentApplication.findUnique({
        where: { trackingNumber },
        select: { id: true }
    });

    // 6. Create Enrollment Record (Section Assignment)
    // Find sections for this grade level
    const sections = await prisma.section.findMany({
      where: { gradeLevelId: gradeLevel.id, schoolYearId: activeYear.id }
    });

    if (sections.length > 0) {
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
    }

    if (i % 50 === 0 || i === totalLearners) {
      console.log(`  📊 Progress: ${i}/${totalLearners} Learners enrolled and sectioned.`);
    }
  }

  console.log(`\n🎉 Successfully scaled to ${totalLearners} enrolled learners across all grades.`);
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
