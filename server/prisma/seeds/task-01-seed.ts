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

const ANCILLARY_ROLES_POOL = [
  "LIS COORDINATOR",
  "ICT COORDINATOR",
  "SDRRM COORDINATOR",
  "GUIDANCE DESIGNATE",
  "SCHOOL PAPER ADVISER (SPA)",
  "PROPERTY CUSTODIAN",
  "CLINIC TEACHER / HEALTH COORDINATOR",
  "SPORTS COORDINATOR",
  "BSP / GSP COORDINATOR",
  "GULAYAN SA PAARALAN (GPP) COORDINATOR",
  "FEEDING COORDINATOR",
  "SUPREME SECONDARY LEARNER GOVERNMENT (SSLG) ADVISER",
  "SSG ADVISER",
  "GRADE LEVEL CHAIRMAN",
  "SUBJECT AREA COORDINATOR",
  "BSP COORDINATOR",
  "GSP COORDINATOR",
  "YES-O ADVISER",
  "BARKADA KONTRA DROGA ADVISER",
  "BIDS AND AWARDS COMMITTEE MEMBER",
  "SCHOOL-BASED MANAGEMENT COORDINATOR",
  "GENDER AND DEVELOPMENT COORDINATOR",
  "WASH IN SCHOOLS COORDINATOR",
  "CHILD PROTECTION POLICY COORDINATOR",
  "NATIONAL ACHIEVEMENT TEST COORDINATOR"
];
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

      // Calculate realistic random data
      const year = 1980 + (i % 15);
      const month = i % 12;
      const day = (i % 28) + 1;
      const birthdate = new Date(year, month, day);
      
      const departmentName = DEPARTMENTS[i % DEPARTMENTS.length].name;
      const majorSpecialization = departmentName;

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
          departmentId: deptMap[DEPARTMENTS[i % DEPARTMENTS.length].code],
          birthdate,
          personnelType: "TEACHING",
          undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION",
          postgraduateDegree: "NONE",
          majorSpecialization,
          minorSpecialization: "NONE",
          indigenousCommunity: "NOT_APPLICABLE",
          natureOfAppointment: "REGULAR_PERMANENT",
          fundingSource: "NATIONAL"
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

        const roleCount = (teacherIdx % 3) + 1;
        const generatedRoles = [];
        for (let r = 0; r < roleCount; r++) {
          generatedRoles.push(ANCILLARY_ROLES_POOL[(teacherIdx * 5 + r) % ANCILLARY_ROLES_POOL.length]);
        }

        await prisma.teacherDesignation.create({
          data: {
            teacherId: teacher.id,
            schoolYearId: sy.id,
            isClassAdviser: true,
            advisorySectionId: section.id,
            ancillaryRoles: generatedRoles
          }
        });

        // Learners are no longer seeded here. See year-specific grade 7 seeds.
      }
    }

    while (teacherIdx < teachers.length) {
      const teacher = teachers[teacherIdx];
      const roleCount = (teacherIdx % 3) + 1;
      const generatedRoles = [];
      for (let r = 0; r < roleCount; r++) {
        generatedRoles.push(ANCILLARY_ROLES_POOL[(teacherIdx * 5 + r) % ANCILLARY_ROLES_POOL.length]);
      }

      await prisma.teacherDesignation.create({
        data: {
          teacherId: teacher.id,
          schoolYearId: sy.id,
          isClassAdviser: false,
          ancillaryRoles: generatedRoles
        }
      });
      teacherIdx++;
    }

    console.log("✅ Base Seeding complete: 20 Teachers, 16 Sections.");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
