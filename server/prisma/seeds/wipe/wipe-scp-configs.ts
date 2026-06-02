import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Wipes SCP Program Configurations for SY 2026-2027.
 * Counterpart to seed-scp-configs.ts.
 *
 * What is deleted (all scoped to 2026-2027):
 *   - ScpProgramOption (via cascade from steps)
 *   - ScpProgramStep (via cascade from config)
 *   - ScpProgramConfig
 *
 * The cascade from ScpProgramConfig → ScpProgramStep → ScpProgramOption
 * is relied upon here. If your schema has ON DELETE RESTRICT instead of
 * CASCADE, the explicit ordering below still handles it safely.
 */
async function main() {
  console.log("🗑️  Wiping SCP Program Configurations for SY 2026-2027...\n");

  const sy = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!sy) {
    console.log("⚠️  School year 2026-2027 not found. Nothing to wipe.");
    return;
  }

  const configs = await prisma.scpProgramConfig.findMany({
    where: { schoolYearId: sy.id },
    select: { id: true },
  });

  if (configs.length === 0) {
    console.log("No SCP configs found for 2026-2027. Nothing to wipe.");
    return;
  }

  const configIds = configs.map((c) => c.id);
  console.log(`Found ${configIds.length} SCP configs to wipe.`);

  await prisma.$transaction(async (tx) => {
    // Options depend on steps — delete first
    // ScpProgramOption has scpProgramConfigId directly (not via step relation)
    const opts = await tx.scpProgramOption.deleteMany({
      where: { scpProgramConfigId: { in: configIds } },
    });
    console.log(`✓ Deleted ${opts.count} SCP program options.`);

    const steps = await tx.scpProgramStep.deleteMany({
      where: { scpProgramConfigId: { in: configIds } },
    });
    console.log(`✓ Deleted ${steps.count} SCP program steps.`);

    const cfgs = await tx.scpProgramConfig.deleteMany({
      where: { schoolYearId: sy.id },
    });
    console.log(`✓ Deleted ${cfgs.count} SCP program configs.`);
  });

  console.log(
    "\n✅ SCP program configurations for 2026-2027 wiped successfully.",
  );
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
