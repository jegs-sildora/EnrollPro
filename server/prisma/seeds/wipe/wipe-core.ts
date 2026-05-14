import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Wipes the base configuration seeded by seed-core.ts.
 * Counterpart to seed-core.ts.
 *
 * What is deleted:
 *   - Sections (depend on GradeLevel + SchoolYear)
 *   - SCP Program Options, Steps, Configs (depend on SchoolYear)
 *   - SchoolYear records
 *   - GradeLevel records
 *   - SchoolSetting records
 *   - TLE programs (if seeded by seed-core)
 *
 * ⚠️  SAFETY GATE: This script REFUSES to run if Learner or
 *    EnrollmentApplication records exist. Run db:wipe-all first to
 *    clear all dependent data before wiping core configuration.
 *
 * After running this, use db:seed (seed-core.ts) to reinitialize.
 */
async function main() {
  console.log(
    "🗑️  Wiping base configuration (school years, grade levels, settings)...\n",
  );

  // Safety gate — refuse to run if any dependent data exists
  const [learnerCount, appCount, earlyRegCount] = await Promise.all([
    prisma.learner.count(),
    prisma.enrollmentApplication.count(),
    prisma.earlyRegistrationApplication.count(),
  ]);

  if (learnerCount > 0 || appCount > 0 || earlyRegCount > 0) {
    console.error("⛔ Safety gate triggered — dependent data still exists:");
    console.error(`   Learners:                     ${learnerCount}`);
    console.error(`   Enrollment applications:      ${appCount}`);
    console.error(`   Early-reg applications:       ${earlyRegCount}`);
    console.error(
      "\n   Run  db:wipe-all  first to remove all learner/application data,",
    );
    console.error("   then retry  db:wipe-core.");
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    // Sections depend on GradeLevel + SchoolYear — clear first
    const sec = await tx.section.deleteMany({});
    console.log(`✓ Deleted ${sec.count} sections.`);

    // SCP — explicit order: Options → Steps → Configs
    const opts = await tx.scpProgramOption.deleteMany({});
    const steps = await tx.scpProgramStep.deleteMany({});
    const cfgs = await tx.scpProgramConfig.deleteMany({});
    console.log(
      `✓ Deleted ${cfgs.count} SCP configs (${steps.count} steps, ${opts.count} options).`,
    );

    // TLE programs (if present)
    const tle = await tx.tLEProgram.deleteMany({});
    console.log(`✓ Deleted ${tle.count} TLE programs.`);

    // School years (after clearing anything that references them)
    const sy = await tx.schoolYear.deleteMany({});
    console.log(`✓ Deleted ${sy.count} school years.`);

    // Grade levels
    const gl = await tx.gradeLevel.deleteMany({});
    console.log(`✓ Deleted ${gl.count} grade levels.`);

    // School settings (singleton-ish, but deleteMany is safe)
    const ss = await tx.schoolSetting.deleteMany({});
    console.log(`✓ Deleted ${ss.count} school setting row(s).`);
  });

  console.log("\n✅ Base configuration wiped successfully.");
  console.log("   Run  db:seed  (seed-core.ts) to reinitialize.");
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
