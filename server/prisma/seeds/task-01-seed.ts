import "dotenv/config";
import { PrismaClient, ApplicantType, Sex, SchoolYearStatus, TermFormat, SystemAcademicPhase } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GRADES = [7, 8, 9, 10];
const PROGRAMS = [
  { nameSuffix: "SPA", type: ApplicantType.SPECIAL_PROGRAM_IN_THE_ARTS, homo: false },
  { nameSuffix: "STE", type: ApplicantType.SCIENCE_TECHNOLOGY_AND_ENGINEERING, homo: false },
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

function generateLRN(): string {
  return faker.string.numeric(12);
}

function generateEmployeeId(): string {
  return faker.string.numeric(7);
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
          schoolName: "DepEd National High School",
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
      const sex = faker.helpers.arrayElement(['Male', 'Female']);
      const prismaSex = sex === 'Male' ? Sex.MALE : Sex.FEMALE;
      const firstName = faker.person.firstName(sex === 'Male' ? 'male' : 'female').toUpperCase();
      const lastName = faker.person.lastName().toUpperCase();
      const middleName = faker.person.middleName().toUpperCase();
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@deped.edu.ph`;
      const employeeId = generateEmployeeId();
      const contactNumber = '09' + faker.string.numeric(9);
      
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          middleName,
          sex: prismaSex,
          email,
          employeeId,
          password: defaultPassword,
          roles: ["TEACHER", "CLASS_ADVISER"],
          mobileNumber: contactNumber
        }
      });

      const teacher = await prisma.teacher.create({
        data: {
          employeeId,
          firstName,
          lastName,
          middleName,
          email,
          contactNumber,
          sex: prismaSex,
          userId: user.id,
          plantillaPosition: faker.helpers.arrayElement(POSITIONS),
          designation: "CLASS ADVISER",
          departmentId: deptMap[DEPARTMENTS[i % DEPARTMENTS.length].code]
        }
      });
      teachers.push(teacher);
    }

    // 6. Create Sections and Learners
    let teacherIdx = 0;
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

        for (let l = 0; l < 10; l++) {
          const lSex = faker.helpers.arrayElement(['Male', 'Female']);
          const prismaLSex = lSex === 'Male' ? Sex.MALE : Sex.FEMALE;
          
          const baseAge = 12 + (grade.displayOrder - 7);
          const birthdate = faker.date.birthdate({ min: baseAge, max: baseAge + 1, mode: 'age' });

          const learnerFirstName = faker.person.firstName(lSex === 'Male' ? 'male' : 'female').toUpperCase();
          const learnerLastName = faker.person.lastName().toUpperCase();
          const learnerMiddleName = faker.person.lastName().toUpperCase();
          
          const learner = await prisma.learner.create({
            data: {
              lrn: generateLRN(),
              firstName: learnerFirstName,
              lastName: learnerLastName,
              middleName: learnerMiddleName,
              birthdate,
              sex: prismaLSex,
              status: "ACTIVE",
            }
          });

          const app = await prisma.enrollmentApplication.create({
            data: {
              learnerId: learner.id,
              schoolYearId: sy.id,
              gradeLevelId: grade.id,
              applicantType: prog.type,
              status: "SECTIONED",
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

    console.log("✅ Seeding complete: 20 Teachers, 20 Sections, 200 Learners.");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));