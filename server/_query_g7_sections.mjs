import "dotenv/config";
import { PrismaClient } from "./server/src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const sy = await prisma.schoolYear.findFirst({ where: { yearLabel: "2026-2027" } });
const gl = await prisma.gradeLevel.findFirst({ where: { name: "Grade 7" } });

const sections = await prisma.section.findMany({
  where: { schoolYearId: sy.id, gradeLevelId: gl.id },
  select: { id: true, name: true, programType: true, maxCapacity: true, sectionRank: true, isHomogeneous: true, sortOrder: true },
  orderBy: [{ programType: "asc" }, { sortOrder: "asc" }],
});

console.log("SY:", sy.yearLabel, "| Grade 7 sections:", sections.length);
for (const s of sections) {
  console.log(`  [${s.programType.padEnd(35)}] rank=${String(s.sectionRank ?? "-").padStart(2)} homo=${s.isHomogeneous ? "Y" : "N"} cap=${s.maxCapacity} | ${s.name}`);
}
await prisma.$disconnect(); await pool.end();
