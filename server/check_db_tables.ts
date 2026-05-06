import { PrismaClient } from "./src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const tableNames = [
      'sections',
      'users',
      'teachers',
      'school_years',
      'grade_levels',
      'learners'
    ];
    
    for (const table of tableNames) {
      try {
        const count = await (prisma as any)[table.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/s$/, '')].count();
        console.log(`${table} count:`, count);
      } catch (e) {
        // Fallback to raw query if mapping fails
        const result = await prisma.$queryRawUnsafe(`SELECT count(*)::int as count FROM "${table}"`);
        console.log(`${table} count (raw):`, (result as any)[0].count);
      }
    }
  } catch (error) {
    console.error("Error checking tables:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
