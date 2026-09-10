import "dotenv/config";
import { PrismaClient, Sex, AddressType, FamilyRelationship } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";
import { getFilipinoName, getFilipinoParentName, createLRNGenerator, FilipinoName } from "./seed-g7-helpers.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_SY_LABEL = "2030-2031";
const BASE_YEAR = 2030;
const TARGET_LEARNER_COUNT = 20;

async function seedGrade7() {
  console.log(`🌱 Seeding Grade 7 learners for SY ${TARGET_SY_LABEL}...`);
  
  const sy = await prisma.schoolYear.findUnique({ where: { yearLabel: TARGET_SY_LABEL } });
  if (!sy) {
    console.error(`❌ School year ${TARGET_SY_LABEL} not found. Ensure it is created before seeding learners.`);
    process.exit(1);
  }

  const grade7 = await prisma.gradeLevel.findUnique({ where: { name: "Grade 7" } });
  if (!grade7) {
    console.error("❌ Grade 7 not found.");
    process.exit(1);
  }

  const sections = await prisma.section.findMany({
    where: { schoolYearId: sy.id, gradeLevelId: grade7.id },
    orderBy: { id: "asc" }
  });

  if (sections.length === 0) {
    console.error(`❌ No Grade 7 sections found for ${TARGET_SY_LABEL}.`);
    process.exit(1);
  }

  const defaultPassword = await bcrypt.hash("DepEd" + BASE_YEAR + "!", 10);
  const generateLRN = createLRNGenerator(BASE_YEAR);

  let maleLearnerIndex = 563;
  let femaleLearnerIndex = 563;
  let totalSeeded = 0;

  for (const [sectionIndex, section] of sections.entries()) {
    const sectionAdviser = await prisma.sectionAdviser.findFirst({
      where: { sectionId: section.id, schoolYearId: sy.id },
      include: { teacher: true }
    });
    
    const enrolledById = sectionAdviser?.teacher?.userId || null;
    if (!enrolledById) {
      throw new Error(`No section adviser found for section ${section.name}.`);
    }

    const baseSectionCount = Math.floor(TARGET_LEARNER_COUNT / sections.length);
    const sectionsWithExtraLearner = TARGET_LEARNER_COUNT % sections.length;
    const sectionLearnerCount = baseSectionCount + (sectionIndex < sectionsWithExtraLearner ? 1 : 0);

    for (let l = 0; l < sectionLearnerCount; l++) {
      const learnerOrdinal = totalSeeded;
      const prismaLSex = learnerOrdinal % 2 === 0 ? Sex.MALE : Sex.FEMALE;
      const learnerNameIndex = prismaLSex === Sex.MALE ? maleLearnerIndex++ : femaleLearnerIndex++;
      
      const baseAge = 12; // Grade 7
      const birthdate = new Date(BASE_YEAR - baseAge, learnerOrdinal % 12, (learnerOrdinal % 28) + 1);

      const learnerName = getFilipinoName(prismaLSex, learnerNameIndex);

      const isIps = [true, false, false, false];
      const isIp = isIps[learnerOrdinal % isIps.length];
      const ipGroupNames = ["ATI", "AETA", "BADJAO", "MAMANWA"];
      const ipGroupName = isIp ? ipGroupNames[l % ipGroupNames.length] : null;
      const religions = ["ROMAN CATHOLIC", "ISLAM", "IGLESIA NI CRISTO", "SEVENTH-DAY ADVENTIST", "BIBLE BAPTIST"];
      const religion = religions[l % religions.length];
      const motherTongues = ["TAGALOG", "CEBUANO", "HILIGAYNON", "ILOCANO", "WARAY"];
      const motherTongue = motherTongues[l % motherTongues.length];
      
      const lrn = generateLRN();
      
      const offset = (BASE_YEAR - 2026) * 20;
      const randomPhotoNum = (learnerNameIndex + offset) % 100;
      const studentPhoto = prismaLSex === Sex.MALE 
        ? `https://randomuser.me/api/portraits/men/${randomPhotoNum}.jpg` 
        : `https://randomuser.me/api/portraits/women/${randomPhotoNum}.jpg`;

      const learnerUser = await prisma.user.create({
        data: {
          firstName: learnerName.firstName,
          lastName: learnerName.lastName,
          middleName: learnerName.middleName,
          sex: prismaLSex,
          password: defaultPassword,
          roles: ["LEARNER"],
          isActive: true,
          accountName: lrn
        }
      });

      const cities = ["BACOLOD CITY", "SILAY CITY", "TALISAY CITY", "BAGO CITY", "MURCIA"];
      const placeOfBirth = `${cities[learnerNameIndex % cities.length]}, NEGROS OCCIDENTAL`;

      const learner = await prisma.learner.create({
        data: {
          lrn,
          userId: learnerUser.id,
          firstName: learnerName.firstName,
          lastName: learnerName.lastName,
          middleName: learnerName.middleName,
          birthdate,
          sex: prismaLSex,
          status: "ACTIVE",
          religion,
          motherTongue,
          isIpCommunity: isIp,
          ipGroupName,
          placeOfBirth,
          hasPsaBirthCertificate: true,
          birthCertificateType: "PSA_BIRTH_CERTIFICATE",
          previousGenAve: 75 + ((learnerNameIndex * 3) % 25) + ((learnerNameIndex % 10) / 10),
          studentPhoto,
        }
      });

      const generatedFatherName = getFilipinoParentName(Sex.MALE, learnerNameIndex * 3);
      const fatherName: FilipinoName = { ...generatedFatherName, lastName: learnerName.lastName };
      const motherName = getFilipinoParentName(Sex.FEMALE, learnerNameIndex * 3 + 1);
      const guardianSex = learnerNameIndex % 2 === 0 ? Sex.FEMALE : Sex.MALE;
      const guardianName = getFilipinoParentName(guardianSex, learnerNameIndex * 3 + 2);
      const baseContact = 100000000 + learnerNameIndex;
      const fatherContactNumber = '091' + baseContact.toString().substring(1);
      const motherContactNumber = '092' + baseContact.toString().substring(1);
      const guardianContactNumber = '093' + baseContact.toString().substring(1);
      const familyContacts = [
        { relationship: FamilyRelationship.FATHER, name: fatherName, contactNumber: fatherContactNumber },
        { relationship: FamilyRelationship.MOTHER, name: motherName, contactNumber: motherContactNumber },
        { relationship: FamilyRelationship.GUARDIAN, name: guardianName, contactNumber: guardianContactNumber },
      ] as const;
      const primaryContact = familyContacts[learnerOrdinal % familyContacts.length];

      const barangays = ["BARANGAY 1", "BARANGAY 2", "BARANGAY BATA", "BARANGAY SINGCANG", "BARANGAY MANDALAGAN", "BARANGAY TANGUB"];
      const zips = ["6100", "6116", "6115", "6101"];
      
      const currentPurok = "PUROK " + ((learnerNameIndex % 10) + 1).toString();
      const currentBarangay = barangays[learnerNameIndex % barangays.length];
      const currentCity = cities[learnerNameIndex % cities.length];
      const currentZip = zips[learnerNameIndex % zips.length];

      const permanentPurok = "PUROK " + (((learnerNameIndex + 1) % 10) + 1).toString();
      const permanentBarangay = barangays[(learnerNameIndex + 1) % barangays.length];
      const permanentCity = cities[(learnerNameIndex + 1) % cities.length];
      const permanentZip = zips[(learnerNameIndex + 1) % zips.length];

      const g7Types = ["NEW_ENROLLEE", "TRANSFEREE"] as const;
      const randomLearnerType = g7Types[learnerOrdinal % g7Types.length];
        
      const channels = ["ONLINE", "F2F"] as const;
      const randomChannel = channels[learnerOrdinal % channels.length];

      const app = await prisma.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: sy.id,
          gradeLevelId: grade7.id,
          applicantType: section.programType,
          status: "OFFICIALLY_ENROLLED",
          learnerType: randomLearnerType,
          admissionChannel: randomChannel,
          contactNumber: primaryContact.contactNumber,
          guardianFirstName: primaryContact.name.firstName,
          guardianMiddleName: primaryContact.name.middleName,
          guardianLastName: primaryContact.name.lastName,
          guardianRelationship: primaryContact.relationship,
          isMissingSf9: false,
          addresses: {
            createMany: {
              data: [
                {
                  addressType: AddressType.CURRENT,
                  houseNoStreet: currentPurok,
                  barangay: currentBarangay,
                  cityMunicipality: currentCity,
                  province: "NEGROS OCCIDENTAL",
                  country: "PHILIPPINES",
                  zipCode: currentZip,
                },
                {
                  addressType: AddressType.PERMANENT,
                  houseNoStreet: permanentPurok,
                  barangay: permanentBarangay,
                  cityMunicipality: permanentCity,
                  province: "NEGROS OCCIDENTAL",
                  country: "PHILIPPINES",
                  zipCode: permanentZip,
                }
              ]
            }
          },
          familyMembers: {
            createMany: {
              data: [
                {
                  relationship: FamilyRelationship.FATHER,
                  firstName: fatherName.firstName,
                  lastName: fatherName.lastName,
                  middleName: fatherName.middleName,
                  contactNumber: fatherContactNumber,
                },
                {
                  relationship: FamilyRelationship.MOTHER,
                  firstName: motherName.firstName,
                  lastName: motherName.lastName,
                  middleName: motherName.middleName,
                  maidenName: motherName.lastName,
                  contactNumber: motherContactNumber,
                },
                {
                  relationship: FamilyRelationship.GUARDIAN,
                  firstName: guardianName.firstName,
                  lastName: guardianName.lastName,
                  middleName: guardianName.middleName,
                  contactNumber: guardianContactNumber,
                }
              ]
            }
          }
        }
      });

      await prisma.enrollmentRecord.create({
        data: {
          enrollmentApplicationId: app.id,
          sectionId: section.id,
          schoolYearId: sy.id,
          learnerId: learner.id,
          enrolledById: enrolledById,
        }
      });

      totalSeeded++;
    }
  }

  if (totalSeeded !== TARGET_LEARNER_COUNT) {
    throw new Error(
      `Expected to seed ${TARGET_LEARNER_COUNT} Grade 7 learners, but seeded ${totalSeeded}.`
    );
  }

  console.log(`✅ Seeded ${totalSeeded} Grade 7 learners for SY ${TARGET_SY_LABEL}`);
}

seedGrade7()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
