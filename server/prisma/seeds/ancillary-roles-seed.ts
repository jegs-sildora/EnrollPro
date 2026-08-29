import "dotenv/config";
import { PrismaClient, Sex } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

/**
 * # EnrollPro Dummy Faculty Staffing Recommendation
 * Date: 2026-08-29
 * ATLAS evidence source: Tailnet run 440, schoolId 1, schoolYearId 2
 * Tailnet target: https://njgrm.buru-degree.ts.net
 * 
 * ## Executive Decision
 * Add 4 real dummy faculty records in EnrollPro:
 * | Department | Current active ATLAS faculty | Add | Target active faculty | Why |
 * |---|---:|---:|---:|---|
 * | ENG | 3 | 1 | 4 | Clears 30 Developmental Reading sessions, 22.5 hours |
 * | MATH | 2 | 1 | 3 | Clears 20 Mathematics sessions, 15 hours |
 * | ESP | 2 | 1 | 3 | Clears 20 ESP sessions, 15 hours, including 10 no-slot sessions caused by both ESP teachers being saturated or occupied |
 * | MAPEH | 2 real + 1 placeholder | 1 real | 3 real | Clears 20 SPS specialization sessions, 15 hours, and allows retiring or ignoring Teacher X |
 * 
 * Do not add a SCI or TLE teacher solely for the current Robotics blocker. In run 440, Robotics is blocked because Grade 10 Silver has no remaining section periods, not because the assigned Robotics teacher lacks weekly capacity.
 * 
 * ## EnrollPro Dummy Data Instructions
 * Create exactly these new active faculty records in EnrollPro dummy data:
 * 
 * | Suggested employee id | Department | Suggested name | Scheduling attributes |
 * |---|---|---|---|
 * | 2000061 | ENG | Dummy ENG Reading Teacher | active, non-stale, max 30h/week, can teach Developmental Reading |
 * | 2000062 | MATH | Dummy Mathematics Teacher | active, non-stale, max 30h/week, can teach Mathematics |
 * | 2000063 | ESP | Dummy ESP GMRC Teacher | active, non-stale, max 30h/week, can teach ESP/GMRC |
 * | 2000064 | MAPEH | Dummy SPS MAPEH Teacher | active, non-stale, max 30h/week, can teach SPS specialization / MAPEH-owned SPS classes |
 * 
 * Constraints:
 * - Do not create placeholder teachers for this fix. These should be real dummy EnrollPro faculty records.
 * - Do not assign ancillary minutes to the new dummy teachers.
 * - Keep all four active for schoolId 1 and the 2026-2027 active school year.
 * - Ensure EnrollPro department values match ATLAS department codes exactly: ENG, MATH, ESP, MAPEH.
 * - Ensure the new teachers sync into ATLAS faculty mirrors as active and non-stale.
 */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding ancillary roles and dummy faculty...");
  
  // 1. Assign ancillary roles to the most recent existing teacher in the database
  const mostRecentTeacher = await prisma.teacher.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (mostRecentTeacher) {
    await prisma.teacher.update({
      where: { id: mostRecentTeacher.id },
      data: {
        ancillaryRoles: {
          push: "SDRRM COORDINATOR"
        }
      }
    });
    console.log(`Updated recent teacher (Employee ID: ${mostRecentTeacher.employeeId}) with ancillary role SDRRM COORDINATOR.`);
  }

  // 2. Add the 4 dummy teachers without ancillary roles
  const departments = await prisma.department.findMany({
    where: { code: { in: ['ENG', 'MATH', 'ESP', 'MAPEH'] } }
  });

  const getDeptId = (code: string) => departments.find(d => d.code === code)?.id;

  const dummyTeachers = [
    { employeeId: "2000061", deptCode: "ENG", firstName: "Jose Gabriel", lastName: "Santos", sex: Sex.MALE },
    { employeeId: "2000062", deptCode: "MATH", firstName: "Maria Angela", lastName: "Reyes", sex: Sex.FEMALE },
    { employeeId: "2000063", deptCode: "ESP", firstName: "Juan Miguel", lastName: "Cruz", sex: Sex.MALE },
    { employeeId: "2000064", deptCode: "MAPEH", firstName: "Anna Patricia", lastName: "Garcia", sex: Sex.FEMALE },
  ];

  for (const t of dummyTeachers) {
    const deptId = getDeptId(t.deptCode);
    if (!deptId) {
      console.warn(`Department ${t.deptCode} not found, skipping dummy teacher ${t.employeeId}`);
      continue;
    }

    await prisma.teacher.upsert({
      where: { employeeId: t.employeeId },
      update: {},
      create: {
        employeeId: t.employeeId,
        firstName: t.firstName,
        lastName: t.lastName,
        sex: t.sex,
        departmentId: deptId,
        isActive: true,
        serviceStatus: "ACTIVE",
        natureOfAppointment: "REGULAR_PERMANENT",
        fundingSource: "NATIONAL",
        ancillaryRoles: [] // Do not assign ancillary minutes to the new dummy teachers
      }
    });
    console.log(`Inserted dummy teacher ${t.employeeId} for department ${t.deptCode}`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
