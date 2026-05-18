import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const yearLabel = '2025-2026';
  const sy = await prisma.schoolYear.findUnique({ where: { yearLabel } });
  if (!sy) {
    console.error('School year not found:', yearLabel);
    process.exit(1);
  }

  const activePrograms = await prisma.tLEProgram.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
  console.log('Active TLE programs:', activePrograms.length);
  console.log(activePrograms.map(p => ({ id: p.id, name: p.name })));

  const sectionsWithTle = await prisma.section.findMany({
    where: { schoolYearId: sy.id, tleProgramId: { not: null } },
    select: { id: true, name: true, gradeLevelId: true, tleProgramId: true },
    orderBy: [{ gradeLevelId: 'asc' }, { sortOrder: 'asc' }],
  });

  // Enrich sections with grade level and program name
  const enriched = await Promise.all(
    sectionsWithTle.map(async (s) => {
      const grade = await prisma.gradeLevel.findUnique({ where: { id: s.gradeLevelId } });
      const prog = await prisma.tLEProgram.findUnique({ where: { id: s.tleProgramId! } });
      return { id: s.id, name: s.name, grade: grade?.name ?? null, tleProgram: prog?.name ?? null, tleProgramId: s.tleProgramId };
    }),
  );

  console.log(`Sections with tleProgramId for ${yearLabel}: ${enriched.length}`);
  console.log(JSON.stringify(enriched, null, 2));

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });