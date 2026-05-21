/**
 * seed-trim-excess.ts
 *
 * Removes excess teachers from departments that are above the stakeholder baseline.
 * Targets (newest-first, fewest associations first):
 *   - MATH : 25 → 22  (remove 3)
 *   - ENG  : 33 → 22  (remove 11)
 *   - AP   : 14 → 13  (remove 1)
 *
 * Deletion order per teacher:
 *   1. TeacherSubject records
 *   2. TeacherDesignation records
 *   3. SectionAdviser records
 *   4. Teacher record
 *   5. Linked User record (if any)
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Departments to trim: code → how many to remove
const TRIM_TARGETS: Record<string, number> = {
  MATH: 3,
  ENG: 11,
  AP: 1,
};

async function removeTeacher(
  teacherId: number,
  userId: number | null,
  deptCode: string,
  teacherName: string,
) {
  // 1. Remove subject assignments
  await prisma.teacherSubject.deleteMany({ where: { teacherId } });

  // 2. Remove designations
  await prisma.teacherDesignation.deleteMany({ where: { teacherId } });

  // 3. Remove section adviser history
  await prisma.sectionAdviser.deleteMany({ where: { teacherId } });

  // 4. Delete teacher record
  await prisma.teacher.delete({ where: { id: teacherId } });

  // 5. Delete linked user account
  if (userId !== null) {
    await prisma.user.delete({ where: { id: userId } });
  }

  console.log(`    🗑️  Removed: ${teacherName} (teacherId=${teacherId})`);
}

async function main() {
  console.log(
    "✂️  Excess Trim: Removing over-baseline teachers to match stakeholder counts...\n",
  );

  const departments = await prisma.department.findMany({
    select: { id: true, code: true },
  });
  const deptByCode = new Map(departments.map((d) => [d.code, d.id]));

  let totalRemoved = 0;

  for (const [deptCode, removeCount] of Object.entries(TRIM_TARGETS)) {
    const deptId = deptByCode.get(deptCode);
    if (!deptId) {
      console.warn(`  WARN  ${deptCode}: department not found — skipping`);
      continue;
    }

    // Fetch teachers in this department, newest first, with association counts
    // to prefer removing those with the fewest ties
    const teachers = await prisma.teacher.findMany({
      where: { departmentId: deptId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        createdAt: true,
        _count: {
          select: {
            advisoryHistory: true,
            teacherDesignations: true,
            subjects: true,
          },
        },
      },
    });

    console.log(
      `  ${deptCode.padEnd(6)} current=${teachers.length}  removing=${removeCount}`,
    );

    // Sort: prefer removing teachers with fewest total associations (advisory + designations + subjects)
    // to minimise disruption. Among ties, newest first.
    const sorted = teachers.slice().sort((a, b) => {
      const aScore =
        a._count.advisoryHistory +
        a._count.teacherDesignations +
        a._count.subjects;
      const bScore =
        b._count.advisoryHistory +
        b._count.teacherDesignations +
        b._count.subjects;
      if (aScore !== bScore) return aScore - bScore; // fewer associations first
      return b.createdAt.getTime() - a.createdAt.getTime(); // newer first among ties
    });

    const toRemove = sorted.slice(0, removeCount);

    for (const t of toRemove) {
      await removeTeacher(
        t.id,
        t.userId,
        deptCode,
        `${t.firstName} ${t.lastName}`,
      );
      totalRemoved++;
    }
  }

  console.log(`\n✅ Done. ${totalRemoved} teacher(s) removed.`);
}

main()
  .catch((err) => {
    console.error("❌ Trim failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
