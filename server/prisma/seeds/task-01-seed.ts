import "dotenv/config";
import { PrismaClient, ApplicantType, Sex, SchoolYearStatus, TermFormat, SystemAcademicPhase, AddressType, FamilyRelationship } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GRADES = [7, 8, 9, 10];
const PROGRAMS = [
  { nameSuffix: "SPA", type: ApplicantType.SPECIAL_PROGRAM_IN_THE_ARTS, homo: false },
  { nameSuffix: "STE", type: ApplicantType.SCIENCE_TECHNOLOGY_AND_ENGINEERING, homo: false },
  { nameSuffix: "SPS", type: ApplicantType.SPECIAL_PROGRAM_IN_SPORTS, homo: false },
  { nameSuffix: "Pilot", type: ApplicantType.REGULAR, homo: true },
  { nameSuffix: "Regular", type: ApplicantType.REGULAR, homo: false },
];
const DEPARTMENTS = [
  { name: 'MATHEMATICS', code: 'MATH' },
  { name: 'SCIENCE', code: 'SCI' },
  { name: 'ENGLISH', code: 'ENG' },
  { name: 'FILIPINO', code: 'FIL' },
  { name: 'ARALING PANLIPUNAN', code: 'AP' },
  { name: 'EDUKASYON SA PAGPAPAKATAO', code: 'ESP' },
  { name: 'MAPEH', code: 'MAPEH' },
  { name: 'TECHNOLOGY AND LIVELIHOOD EDUCATION', code: 'TLE' }
];
const POSITIONS = ['TEACHER I', 'TEACHER II', 'TEACHER III', 'MASTER TEACHER I', 'MASTER TEACHER II'];
const FILIPINO_MALE_FIRST_NAMES = [
  "JUAN MIGUEL",
  "JOSE GABRIEL",
  "MARK ANGELO",
  "CARLO MIGUEL",
  "JOHN PAOLO",
  "MIGUEL ANDRE",
  "JOSHUA LUIS",
  "PAOLO BENJAMIN",
  "ANGELO RAFAEL",
  "CHRISTIAN PAUL",
  "JEROME ANTONIO",
  "NATHANIEL JOSE",
  "GABRIEL ENZO",
  "VINCENT LORENZO",
  "DANIEL MARTIN",
  "FRANCIS MIGUEL",
];
const FILIPINO_FEMALE_FIRST_NAMES = [
  "MARIA ANGELA",
  "ANNA PATRICIA",
  "CAMILLE JOY",
  "MARY GRACE",
  "JANELLA MARIE",
  "SOFIA ISABEL",
  "ANGELICA MAE",
  "BEATRIZ ANNE",
  "CLARISSE JOY",
  "DANIELA ROSE",
  "ELAINE MARIE",
  "FRANCESCA MAE",
  "GABRIELA LUZ",
  "HANNAH THERESE",
  "ISABELLA JOY",
  "KATRINA MAE",
];
const FILIPINO_SURNAMES = [
  "SANTOS",
  "REYES",
  "CRUZ",
  "GARCIA",
  "MENDOZA",
  "BAUTISTA",
  "NAVARRO",
  "RAMOS",
  "FLORES",
  "AQUINO",
  "CASTILLO",
  "DELA CRUZ",
  "VILLANUEVA",
  "FERNANDEZ",
  "DE LEON",
  "MERCADO",
  "SALAZAR",
  "VALDEZ",
  "AGUILAR",
  "DOMINGO",
];

interface FilipinoName {
  firstName: string;
  middleName: string;
  lastName: string;
}

function getFilipinoName(sex: Sex, index: number): FilipinoName {
  const firstNames =
    sex === Sex.MALE
      ? FILIPINO_MALE_FIRST_NAMES
      : FILIPINO_FEMALE_FIRST_NAMES;

  return {
    firstName: firstNames[index % firstNames.length],
    middleName:
      FILIPINO_SURNAMES[(index * 2 + 3) % FILIPINO_SURNAMES.length],
    lastName:
      FILIPINO_SURNAMES[(index * 3 + 1) % FILIPINO_SURNAMES.length],
  };
}

function getFilipinoParentName(sex: Sex, index: number): FilipinoName {
  return getFilipinoName(sex, index + 7);
}

let lrnCounter = 100000000000;
function generateLRN(): string {
  return (lrnCounter++).toString();
}

let empCounter = 1000000;
function generateEmployeeId(): string {
  return (empCounter++).toString();
}

export const seedDatabase = async () => {
  console.log("🌱 Initiating DepEd Standardized Seeding Protocol...");

  try {
    // 1. Create School Year
    const sy = await prisma.schoolYear.upsert({
      where: { yearLabel: "2026-2027" },
      update: {},
      create: {
        yearLabel: "2026-2027",
        status: SchoolYearStatus.ACTIVE,
        termFormat: TermFormat.QUARTERS,
      }
    });

    // 2. Create School Setting
    let setting = await prisma.schoolSetting.findFirst();
    if (!setting) {
      setting = await prisma.schoolSetting.create({
        data: {
          schoolName: "Hinigaran National High School",
          activeSchoolYearId: sy.id,
          steEnabled: true,
          spaEnabled: true,
          spsEnabled: true,
          systemPhase: SystemAcademicPhase.CLASSES_ONGOING
        }
      });
    }

    // 3. Create Grade Levels
    const grades = [];
    for (const g of GRADES) {
      grades.push(await prisma.gradeLevel.upsert({
        where: { name: `Grade ${g}` },
        update: {},
        create: { name: `Grade ${g}`, displayOrder: g }
      }));
    }

    // 4. Create Departments
    const deptMap: Record<string, number> = {};
    for (const d of DEPARTMENTS) {
      const dept = await prisma.department.upsert({
        where: { code: d.code },
        update: {},
        create: { name: d.name, code: d.code }
      });
      deptMap[d.code] = dept.id;
    }

    const defaultPassword = await bcrypt.hash("DepEd2026!", 10);
    const teachers = [];

    const SECTION_NAMES: Record<number, string[]> = {
      7: ["Rizal", "Bonifacio", "Mabini", "Luna", "Aguinaldo"],
      8: ["Maka-Diyos", "Makatao", "Makakalikasan", "Makabansa", "Matapat"],
      9: ["Sampaguita", "Rose", "Daisy", "Orchid", "Tulip"],
      10: ["Gold", "Silver", "Diamond", "Pearl", "Jade"]
    };

    // 5. Create 20 Teachers & their Users
    for (let i = 1; i <= 20; i++) {
      const isMale = i % 2 !== 0;
      const prismaSex = isMale ? Sex.MALE : Sex.FEMALE;
      const nameData = getFilipinoName(prismaSex, i);
      const firstName = nameData.firstName;
      const lastName = nameData.lastName;
      const middleName = nameData.middleName;
      const employeeId = generateEmployeeId();
      const contactNumber = '0910' + i.toString().padStart(7, '0');
      const plantillaPosition = POSITIONS[i % POSITIONS.length];
      
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          middleName,
          sex: prismaSex,
          employeeId,
          password: defaultPassword,
          roles: ["TEACHER", "CLASS_ADVISER"],
          mobileNumber: contactNumber,
          isActive: true,
          mustChangePassword: true
        }
      });

      const teacher = await prisma.teacher.create({
        data: {
          employeeId,
          firstName,
          lastName,
          middleName,
          contactNumber,
          sex: prismaSex,
          userId: user.id,
          plantillaPosition,
          designation: "CLASS ADVISER",
          departmentId: deptMap[DEPARTMENTS[i % DEPARTMENTS.length].code]
        }
      });
      teachers.push(teacher);
    }

    // 6. Create Sections and Learners
    let teacherIdx = 0;
    let maleLearnerIndex = 0;
    let femaleLearnerIndex = 0;
    for (const grade of grades) {
      const gNum = parseInt(grade.name.replace("Grade ", ""), 10);
      const names = SECTION_NAMES[gNum] || PROGRAMS.map(p => p.nameSuffix);
      
      let progIdx = 0;
      for (const prog of PROGRAMS) {
        const sectionName = names[progIdx];
        
        const section = await prisma.section.upsert({
          where: {
            uq_sections_name_grade_sy: {
              name: sectionName,
              gradeLevelId: grade.id,
              schoolYearId: sy.id,
            }
          },
          update: {},
          create: {
            name: sectionName,
            maxCapacity: 40,
            gradeLevelId: grade.id,
            schoolYearId: sy.id,
            programType: prog.type,
            isHomogeneous: prog.homo,
          }
        });
        
        progIdx++;

        const teacher = teachers[teacherIdx++];
        await prisma.sectionAdviser.create({
          data: {
            sectionId: section.id,
            teacherId: teacher.id,
            schoolYearId: sy.id,
            effectiveFrom: new Date(),
          }
        });

        await prisma.teacherDesignation.create({
          data: {
            teacherId: teacher.id,
            schoolYearId: sy.id,
            isClassAdviser: true,
            advisorySectionId: section.id,
          }
        });

        for (let l = 0; l < 4; l++) {
          const prismaLSex = l < 2 ? Sex.MALE : Sex.FEMALE;
          const learnerNameIndex =
            prismaLSex === Sex.MALE
              ? maleLearnerIndex++
              : femaleLearnerIndex++;
          const baseAge = 12 + (grade.displayOrder - 7);
          const birthdate = new Date(2026 - baseAge, l % 12, (l % 28) + 1);

          const learnerName = getFilipinoName(
            prismaLSex,
            learnerNameIndex
          );

          const isIps = [true, false, false, false];
          const isIp = isIps[l % isIps.length];
          const ipGroupNames = ["ATI", "AETA", "BADJAO", "MAMANWA"];
          const ipGroupName = isIp ? ipGroupNames[l % ipGroupNames.length] : null;
          const religions = ["ROMAN CATHOLIC", "ISLAM", "IGLESIA NI CRISTO", "SEVENTH-DAY ADVENTIST", "BIBLE BAPTIST"];
          const religion = religions[l % religions.length];
          const motherTongues = ["TAGALOG", "CEBUANO", "HILIGAYNON", "ILOCANO", "WARAY"];
          const motherTongue = motherTongues[l % motherTongues.length];
          
          const lrn = generateLRN();
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
              hasPsaBirthCertificate: true,
              birthCertificateType: "PSA_BIRTH_CERTIFICATE",
              previousGenAve: 75 + ((learnerNameIndex * 3) % 25) + ((learnerNameIndex % 10) / 10),
            }
          });

          const generatedFatherName = getFilipinoParentName(
            Sex.MALE,
            learnerNameIndex * 3,
          );
          const fatherName: FilipinoName = {
            ...generatedFatherName,
            lastName: learnerName.lastName,
          };
          const motherName = getFilipinoParentName(
            Sex.FEMALE,
            learnerNameIndex * 3 + 1,
          );
          const guardianSex =
            learnerNameIndex % 2 === 0 ? Sex.FEMALE : Sex.MALE;
          const guardianName = getFilipinoParentName(
            guardianSex,
            learnerNameIndex * 3 + 2,
          );
          const baseContact = 100000000 + learnerNameIndex;
          const fatherContactNumber = '091' + baseContact.toString().substring(1);
          const motherContactNumber = '092' + baseContact.toString().substring(1);
          const guardianContactNumber = '093' + baseContact.toString().substring(1);
          const familyContacts = [
            {
              relationship: FamilyRelationship.FATHER,
              name: fatherName,
              contactNumber: fatherContactNumber,
            },
            {
              relationship: FamilyRelationship.MOTHER,
              name: motherName,
              contactNumber: motherContactNumber,
            },
            {
              relationship: FamilyRelationship.GUARDIAN,
              name: guardianName,
              contactNumber: guardianContactNumber,
            },
          ] as const;
          const primaryContact = familyContacts[l % familyContacts.length];

          const barangays = ["BARANGAY 1", "BARANGAY 2", "BARANGAY BATA", "BARANGAY SINGCANG", "BARANGAY MANDALAGAN", "BARANGAY TANGUB"];
          const cities = ["BACOLOD CITY", "SILAY CITY", "TALISAY CITY", "BAGO CITY", "MURCIA"];
          const zips = ["6100", "6116", "6115", "6101"];
          
          const currentPurok = "PUROK " + ((learnerNameIndex % 10) + 1).toString();
          const currentBarangay = barangays[learnerNameIndex % barangays.length];
          const currentCity = cities[learnerNameIndex % cities.length];
          const currentZip = zips[learnerNameIndex % zips.length];

          const permanentPurok = "PUROK " + (((learnerNameIndex + 1) % 10) + 1).toString();
          const permanentBarangay = barangays[(learnerNameIndex + 1) % barangays.length];
          const permanentCity = cities[(learnerNameIndex + 1) % cities.length];
          const permanentZip = zips[(learnerNameIndex + 1) % zips.length];

          const isGrade7 = grade.name === "Grade 7";
          const g7Types = ["NEW_ENROLLEE", "TRANSFEREE"] as const;
          const otherTypes = ["CONTINUING", "TRANSFEREE", "RETURNING"] as const;
          const randomLearnerType = isGrade7 
            ? g7Types[learnerNameIndex % g7Types.length]
            : otherTypes[learnerNameIndex % otherTypes.length];
            
          const channels = ["ONLINE", "F2F"] as const;
          const randomChannel = channels[learnerNameIndex % channels.length];

          const app = await prisma.enrollmentApplication.create({
            data: {
              learnerId: learner.id,
              schoolYearId: sy.id,
              gradeLevelId: grade.id,
              applicantType: prog.type,
              status: "OFFICIALLY_ENROLLED",
              learnerType: randomLearnerType,
              admissionChannel: randomChannel,
              contactNumber: primaryContact.contactNumber,
              guardianName: `${primaryContact.name.lastName}, ${primaryContact.name.firstName} ${primaryContact.name.middleName}`,
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
              enrolledById: teacher.userId!,
            }
          });
        }
      }
    }

    console.log("✅ Seeding complete: 20 Teachers, 16 Sections, 64 Learners (2 male and 2 female per section).");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
