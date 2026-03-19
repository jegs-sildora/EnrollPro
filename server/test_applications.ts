import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  try {
    const page = "1";
    const limit = "15";
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};

    const settings = await prisma.schoolSettings.findFirst({
      select: { activeAcademicYearId: true },
    });
    console.log("Settings:", settings);
    if (settings?.activeAcademicYearId) {
      where.academicYearId = settings.activeAcademicYearId;
    }

    console.log("Where:", where);
    console.log("Skip:", skip);
    console.log("Take:", parseInt(limit as string));

    console.log("Running findMany...");
    const applications = await prisma.applicant.findMany({
        where,
        /*include: {
          gradeLevel: true,
          strand: true,
          enrollment: { include: { section: true } },
        },*/
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit as string),
      });
    console.log("Applications count:", applications.length);

    console.log("Running count...");
    const total = await prisma.applicant.count({ where });
    console.log("Total count:", total);

  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test();
