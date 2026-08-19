import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CITIES = ["BACOLOD CITY", "SILAY CITY", "TALISAY CITY", "BAGO CITY", "MURCIA"];

export const fixPlaceOfBirth = async () => {
  console.log("🔍 Checking for learners missing place of birth...");

  try {
    const learners = await prisma.learner.findMany({
      where: {
        placeOfBirth: null,
      },
      select: {
        id: true,
      }
    });

    if (learners.length === 0) {
      console.log("✅ All learners have a place of birth assigned.");
      return;
    }

    console.log(`⚠️ Found ${learners.length} learners without a place of birth. Updating...`);

    let count = 0;
    for (const learner of learners) {
      const city = CITIES[count % CITIES.length];
      await prisma.learner.update({
        where: { id: learner.id },
        data: { placeOfBirth: `${city}, NEGROS OCCIDENTAL` }
      });
      count++;
    }

    console.log(`✅ Successfully updated ${count} learners with a realistic place of birth.`);
  } catch (error) {
    console.error("❌ Error updating learners:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

fixPlaceOfBirth().then(() => process.exit(0)).catch(() => process.exit(1));
