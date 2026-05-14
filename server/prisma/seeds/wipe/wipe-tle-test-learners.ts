import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒÿæ Wiping TLE test learners and associated records...");

  const testLrns = [
    "100000900001",
    "100000900002",
    "100000100001",
    "100000100002"
  ];

  // 1. Find the learners to get their IDs and application IDs
  const learners = await prisma.learner.findMany({
    where: { lrn: { in: testLrns } },
    include: {
      enrollmentApplications: {
        select: { id: true }
      }
    }
  });

  const learnerIds = learners.map(l => l.id);
  const applicationIds = learners.flatMap(l => l.enrollmentApplications.map(a => a.id));

  if (learnerIds.length === 0) {
    console.log("No TLE test learners found to wipe.");
    return;
  }

  // 2. Delete checklist records
  const checklistResult = await prisma.applicationChecklist.deleteMany({
    where: { enrollmentId: { in: applicationIds } }
  });
  console.log(`- Deleted ${checklistResult.count} ApplicationChecklist records.`);

  // 3. Delete enrollment applications
  const appResult = await prisma.enrollmentApplication.deleteMany({
    where: { id: { in: applicationIds } }
  });
  console.log(`- Deleted ${appResult.count} EnrollmentApplication records.`);

  // 4. Delete learners
  const learnerResult = await prisma.learner.deleteMany({
    where: { id: { in: learnerIds } }
  });
  console.log(`- Deleted ${learnerResult.count} Learner records.`);

  console.log("\n≡ƒÿÄ Wipe complete. TLE test data has been removed.");
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
