import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Wiping ALL DATA from the database...");

  try {
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename::text as tablename 
      FROM pg_tables 
      WHERE schemaname='public' AND tablename != '_prisma_migrations';
    `;

    if (tablenames.length === 0) {
      console.log("⚠️ No tables to truncate.");
      return;
    }

    const tables = tablenames
      .map(({ tablename }) => `"public"."${tablename}"`)
      .join(", ");

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    console.log(`✅ Successfully wiped everything from the database.`);
  } catch (error) {
    console.error("❌ Failed to wipe database:", error);
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
