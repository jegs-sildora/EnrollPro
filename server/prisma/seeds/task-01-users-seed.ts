import "dotenv/config";
import { PrismaClient, Role, Sex } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";
import { mergeRequiredSchedulerRoles } from "../../src/features/auth/application-role.service.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const USERS_TO_SEED = [
  {
    employeeId: "1234506",
    firstName: "Juan Miguel",
    lastName: "Santos",
    sex: Sex.MALE,
    roles: [Role.TEACHER],
    ancillaryRoles: ["STE HEAD TEACHER", "GRADE 7 COORDINATOR"],
    departmentCode: "SCI" // SCIENCE
  },
  {
    employeeId: "1234507",
    firstName: "Maria Angela",
    lastName: "Reyes",
    sex: Sex.FEMALE,
    roles: [Role.TEACHER],
    ancillaryRoles: ["SPA HEAD TEACHER", "GRADE 8 COORDINATOR"],
    departmentCode: "MAPEH" // MAPEH
  },
  {
    employeeId: "1234508",
    firstName: "Jose Gabriel",
    lastName: "Cruz",
    sex: Sex.MALE,
    roles: [Role.TEACHER],
    ancillaryRoles: ["SPS HEAD TEACHER", "GRADE 9 COORDINATOR"],
    departmentCode: "MAPEH" // MAPEH
  },
  {
    employeeId: "1234509",
    firstName: "Anna Patricia",
    lastName: "Garcia",
    sex: Sex.FEMALE,
    roles: [Role.TEACHER],
    ancillaryRoles: ["GRADE 10 COORDINATOR"], // Personnel with grade 10 coordinator
    departmentCode: "GEN"
  }
];

export const seedUsers = async () => {
  console.log("🌱 Seeding special users for Task 01...");

  try {
    const activeSetting = await prisma.schoolSetting.findFirst();
    if (!activeSetting || !activeSetting.activeSchoolYearId) {
      throw new Error("No active school year found. Please run the base seed first.");
    }
    const syId = activeSetting.activeSchoolYearId;

    const defaultPassword = await bcrypt.hash("DepEd2026!", 10);

    for (const userData of USERS_TO_SEED) {
      let dept = await prisma.department.findUnique({ where: { code: userData.departmentCode } });
      if (!dept) {
        dept = await prisma.department.create({
          data: {
            code: userData.departmentCode,
            name: userData.departmentCode === 'SCI' ? 'SCIENCE' : (userData.departmentCode === 'MAPEH' ? 'MAPEH' : 'GENERAL EDUCATION')
          }
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { employeeId: userData.employeeId },
        select: { roles: true },
      });
      const roles = mergeRequiredSchedulerRoles(
        userData.employeeId,
        existingUser?.roles ?? userData.roles,
      );

      const user = await prisma.user.upsert({
        where: { employeeId: userData.employeeId },
        update: { roles },
        create: {
          employeeId: userData.employeeId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          sex: userData.sex,
          password: defaultPassword,
          roles,
          isActive: true,
          mustChangePassword: true
        }
      });

      const teacher = await prisma.teacher.upsert({
        where: { employeeId: userData.employeeId },
        update: {
          departments: {
            connect: { id: dept.id }
          },
          majorSpecialization: userData.departmentCode === 'SCI' ? 'SCIENCE' : (userData.departmentCode === 'MAPEH' ? 'MAPEH' : 'GENERAL'),
          ancillaryRoles: userData.ancillaryRoles
        },
        create: {
          employeeId: userData.employeeId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          sex: userData.sex,
          userId: user.id,
          plantillaPosition: "TEACHER I",
          designation: "CLASS ADVISER",
          departments: {
            connect: { id: dept.id }
          },
          personnelType: "TEACHING",
          undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION",
          postgraduateDegree: "NONE",
          majorSpecialization: userData.departmentCode === 'SCI' ? 'SCIENCE' : (userData.departmentCode === 'MAPEH' ? 'MAPEH' : 'GENERAL'),
          minorSpecialization: "NONE",
          indigenousCommunity: "NOT_APPLICABLE",
          natureOfAppointment: "REGULAR_PERMANENT",
          fundingSource: "NATIONAL",
          ancillaryRoles: userData.ancillaryRoles
        }
      });

      await prisma.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: teacher.id,
            schoolYearId: syId,
          }
        },
        update: {
          ancillaryRoles: userData.ancillaryRoles
        },
        create: {
          teacherId: teacher.id,
          schoolYearId: syId,
          isClassAdviser: false,
          ancillaryRoles: userData.ancillaryRoles
        }
      });

      console.log(`✅ Ensured user ${userData.firstName} ${userData.lastName} (${userData.employeeId}) application roles and personnel assignments.`);
    }

    console.log("✅ Seeding complete.");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

seedUsers().then(() => process.exit(0)).catch(() => process.exit(1));



