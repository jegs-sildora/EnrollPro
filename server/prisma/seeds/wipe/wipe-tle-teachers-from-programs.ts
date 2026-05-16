import "dotenv/config";
import { PrismaClient, Role } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const SEEDED_DESIGNATION = "TLE INSTRUCTOR (SEEDED)";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Wiping seeded TLE teachers from TLE-program seed...");

  const seededTeachers = await prisma.teacher.findMany({
    where: {
      designation: SEEDED_DESIGNATION,
      employeeId: { startsWith: "29" },
    },
    select: { id: true, userId: true },
  });

  if (seededTeachers.length === 0) {
    console.log("No seeded TLE teachers found.");
    return;
  }

  const teacherIds = seededTeachers.map((teacher) => teacher.id);
  const userIds = seededTeachers
    .map((teacher) => teacher.userId)
    .filter((id): id is number => typeof id === "number");

  const deletedSubjects = await prisma.teacherSubject.deleteMany({
    where: { teacherId: { in: teacherIds } },
  });

  await prisma.teacherDesignation.deleteMany({
    where: { teacherId: { in: teacherIds } },
  });

  await prisma.sectionAdviser.deleteMany({
    where: { teacherId: { in: teacherIds } },
  });

  const deletedTeachers = await prisma.teacher.deleteMany({
    where: { id: { in: teacherIds } },
  });

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: userIds },
      role: "TEACHER" as Role,
      designation: SEEDED_DESIGNATION,
    },
  });

  console.log(`Teacher subjects deleted: ${deletedSubjects.count}`);
  console.log(`Teachers deleted: ${deletedTeachers.count}`);
  console.log(`Users deleted: ${deletedUsers.count}`);
  console.log("Wipe complete.");
}

main()
  .catch((error) => {
    console.error("Wipe failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
