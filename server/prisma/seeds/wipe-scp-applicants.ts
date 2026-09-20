import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping ALL SCP ADMISSION APPLICANTS for the ACTIVE school year...");

  try {
    const settings = await prisma.schoolSetting.findFirst();
    if (!settings || !settings.activeSchoolYearId) {
      console.log("⚠️ No active school year found. Aborting.");
      return;
    }

    const activeSchoolYearId = settings.activeSchoolYearId;

    const { count } = await prisma.enrollmentApplication.deleteMany({
      where: {
        schoolYearId: activeSchoolYearId,
        applicantType: {
          in: [
            "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
            "SPECIAL_PROGRAM_IN_THE_ARTS",
            "SPECIAL_PROGRAM_IN_SPORTS",
            "SPECIAL_PROGRAM_IN_JOURNALISM",
            "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
            "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION"
          ]
        }
      }
    });

    console.log(`✅ Successfully wiped ${count} SCP applicants for the active school year (ID: ${activeSchoolYearId}).`);
  } catch (error) {
    console.error("❌ Failed to wipe SCP applicants:", error);
  }
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
