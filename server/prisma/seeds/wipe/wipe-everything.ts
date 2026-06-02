import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒÜÇ Starting Global Database Wipe...");

  try {
    // 1. Get all table names from the public schema
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname='public'
    `;

    // 2. Filter out internal Prisma migration tables and format for SQL
    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== "_prisma_migrations")
      .map((name) => `"public"."${name}"`)
      .join(", ");

    if (tables.length > 0) {
      console.log(`≡ƒº╣ Truncating tables: ${tables}`);
      // 3. Truncate all tables using CASCADE to handle foreign key constraints
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      console.log("Γ£à All tables truncated successfully.");
    } else {
      console.log("Γä╣∩╕Å No tables found to truncate.");
    }

  } catch (error) {
    console.error("Γ¥î Error during database wipe:", error);
    process.exit(1);
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
