import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping ALL ENROLLMENT DATA from the database...");

  try {
    // Truncating tables that are related to the enrollment processes.
    // Using TRUNCATE with CASCADE to cleanly remove all relationships.
    const tablesToTruncate = [
      "enrollment_records",
      "enrollment_previous_schools",
      "application_addresses",
      "application_family_members",
      "enrollment_applications",
      "enrollment_listings",
      "health_records",
      "learners"
    ];

    const tables = tablesToTruncate
      .map((tablename) => `"public"."${tablename}"`)
      .join(", ");

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    console.log(`✅ Successfully wiped all enrollment processes and learner data.`);
  } catch (error) {
    console.error("❌ Failed to wipe enrollment data:", error);
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
