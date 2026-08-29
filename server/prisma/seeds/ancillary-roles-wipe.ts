import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

/**
 * Wipes the ancillary roles assigned to the recent teacher, and removes the 4 dummy faculty 
 * records created for ATLAS scheduling validation.
 * 
 * # EnrollPro Dummy Faculty Staffing Recommendation
 * Date: 2026-08-29
 * [See ancillary-roles-seed.ts for full context]
 */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Wiping ancillary roles and dummy faculty...");
  
  // 1. Remove the 4 dummy teachers
  const dummyEmployeeIds = ["2000061", "2000062", "2000063", "2000064"];
  const deleteResult = await prisma.teacher.deleteMany({
    where: { employeeId: { in: dummyEmployeeIds } }
  });
  console.log(`Deleted ${deleteResult.count} dummy teachers.`);

  // 2. Wipe ancillary roles from all teachers to ensure a clean slate
  await prisma.teacher.updateMany({
    data: {
      ancillaryRoles: []
    }
  });
  console.log("Cleared ancillary roles for all teachers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
