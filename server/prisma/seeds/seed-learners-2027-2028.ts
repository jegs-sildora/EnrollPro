import "dotenv/config";
import { PrismaClient, Sex, AddressType, FamilyRelationship, AcademicStatus, LearnerType, AdmissionChannel } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";
import { getFilipinoName, getFilipinoParentName, createLRNGenerator, FilipinoName } from "./seed-g7-helpers.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_SY_LABEL = "2027-2028";
const BASE_YEAR = 2027;

async function seedLearners() {
  console.log(`🌱 Seeding Auto-Sectioning learners (60 per G7-10) for SY ${TARGET_SY_LABEL}...`);
  
  const sy = await prisma.schoolYear.findUnique({ where: { yearLabel: TARGET_SY_LABEL } });
  if (!sy) {
    console.error(`❌ School year ${TARGET_SY_LABEL} not found. Ensure it is created before seeding learners.`);
    process.exit(1);
  }

  console.log(`🧹 Cleaning up existing Auto-Sectioning learners (LRN starting with 2127) for SY ${TARGET_SY_LABEL}...`);
  const autoSectioningUsers = await prisma.user.findMany({
    where: { accountName: { startsWith: "2127" } },
    select: { id: true, learnerProfile: { select: { id: true, enrollmentApplications: { select: { id: true } } } } }
  });

  if (autoSectioningUsers.length > 0) {
    const userIds = autoSectioningUsers.map(u => u.id);
    const learnerIds = autoSectioningUsers.map(u => u.learnerProfile?.id).filter(Boolean) as number[];
    const applicationIds = autoSectioningUsers.flatMap(u => u.learnerProfile?.enrollmentApplications.map(a => a.id) || []);

    if (applicationIds.length > 0) {
      await prisma.enrollmentApplication.deleteMany({ where: { id: { in: applicationIds } } });
    }
    if (learnerIds.length > 0) {
      await prisma.learner.deleteMany({ where: { id: { in: learnerIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`🧹 Wiped ${autoSectioningUsers.length} previous auto-sectioning test learners.`);
  }

  const gradeNames = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const grades = await prisma.gradeLevel.findMany({
    where: { name: { in: gradeNames } }
  });

  if (grades.length !== 4) {
    console.error("❌ Some grade levels not found.");
    process.exit(1);
  }

  const defaultPassword = await bcrypt.hash("DepEd" + BASE_YEAR + "!", 10);
  const generateLRN = createLRNGenerator(BASE_YEAR + 100); // offset to avoid LRN collision

  let maleLearnerIndex = 500;
  let femaleLearnerIndex = 500;
  let totalSeeded = 0;

  for (const grade of grades) {
    console.log(`Seeding 60 learners for ${grade.name}...`);
    for (let l = 0; l < 60; l++) {
      const prismaLSex = l % 2 === 0 ? Sex.MALE : Sex.FEMALE;
      const learnerNameIndex = prismaLSex === Sex.MALE ? maleLearnerIndex++ : femaleLearnerIndex++;
      
      const baseAge = grade.name === "Grade 7" ? 12 : grade.name === "Grade 8" ? 13 : grade.name === "Grade 9" ? 14 : 15;
      const birthdate = new Date(BASE_YEAR - baseAge, l % 12, (l % 28) + 1);

      const learnerName = getFilipinoName(prismaLSex, learnerNameIndex);

      const isIps = [true, false, false, false];
      const isIp = isIps[l % isIps.length];
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
      
      // Gen Ave distributed widely to test Top BEC vs Regular Snake Draft
      // Top 5 learners will have 90-98, rest will be 75-89
      let previousGenAve = 75 + ((learnerNameIndex * 3) % 15) + ((learnerNameIndex % 10) / 10);
      if (l < 5) previousGenAve = 90 + l; // Guarantee some very high grades
      
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
          previousGenAve: previousGenAve,
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

      const barangays = ["BARANGAY 1", "BARANGAY 2", "BARANGAY BATA", "BARANGAY SINGCANG", "BARANGAY MANDALAGAN", "BARANGAY TANGUB"];
      const zips = ["6100", "6116", "6115", "6101"];
      
      const currentPurok = "PUROK " + ((learnerNameIndex % 10) + 1).toString();
      const currentBarangay = barangays[learnerNameIndex % barangays.length];
      const currentCity = cities[learnerNameIndex % cities.length];
      const currentZip = zips[learnerNameIndex % zips.length];

      // Add a couple of Conditionally Promoted to test exclusion logic
      const academicStatus = (l === 6 || l === 15) ? AcademicStatus.CONDITIONALLY_PROMOTED : AcademicStatus.PROMOTED;

      const randomLearnerType = grade.name === "Grade 7" ? LearnerType.NEW_ENROLLEE : LearnerType.CONTINUING;

      await prisma.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: sy.id,
          gradeLevelId: grade.id,
          applicantType: "REGULAR",
          status: "READY_FOR_SECTIONING", // Crucial for auto-assign pool
          academicStatus: academicStatus,
          learnerType: randomLearnerType,
          admissionChannel: AdmissionChannel.ONLINE,
          contactNumber: motherContactNumber,
          guardianFirstName: motherName.firstName,
          guardianMiddleName: motherName.middleName,
          guardianLastName: motherName.lastName,
          guardianRelationship: FamilyRelationship.MOTHER,
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
                }
              ]
            }
          },
          familyMembers: {
            createMany: {
              data: [
                {
                  relationship: FamilyRelationship.MOTHER,
                  firstName: motherName.firstName,
                  lastName: motherName.lastName,
                  middleName: motherName.middleName,
                  maidenName: motherName.lastName,
                  contactNumber: motherContactNumber,
                }
              ]
            }
          }
        }
      });

      totalSeeded++;
    }
  }

  console.log(`✅ Seeded ${totalSeeded} Auto-Sectioning learners for SY ${TARGET_SY_LABEL}`);
}

seedLearners()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
