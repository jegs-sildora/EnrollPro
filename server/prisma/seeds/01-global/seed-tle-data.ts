import "dotenv/config";
import {
  PrismaClient,
  TLECategory,
  TLETrackType,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ──────────────────────────────────────────────────────────────────────────────
// Master TLE catalog – DepEd / TESDA-aligned program names.
// These are the tracks cycled across G9/G10 BEC sections.
// G9  → EXPLORATORY track type  (sampling phase, JHS years 1-2 equivalence)
// G10 → SPECIALIZATION track type (deepening phase)
// ──────────────────────────────────────────────────────────────────────────────
const TLE_CATALOG: {
  name: string;
  category: TLECategory;
  trackType: TLETrackType;
  displayOrder: number;
  description?: string;
}[] = [
  // HOME ECONOMICS
  {
    name: "HE - Cookery",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    displayOrder: 1,
    description: "TESDA NC II – Cookery (Food and Beverage Services)",
  },
  {
    name: "HE - Bread and Pastry Production",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    displayOrder: 2,
    description: "TESDA NC II – Bread and Pastry Production",
  },
  {
    name: "HE - Caregiving",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    displayOrder: 3,
    description: "TESDA NC II – Caregiving",
  },
  {
    name: "HE - Dressmaking",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    displayOrder: 4,
    description: "TESDA NC II – Dressmaking",
  },
  {
    name: "HE - Beauty Care (Nail Care)",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    displayOrder: 5,
    description: "TESDA NC II – Beauty Care (Nail Care)",
  },
  // ICT
  {
    name: "ICT - Computer Systems Servicing",
    category: "ICT",
    trackType: "SPECIALIZATION",
    displayOrder: 6,
    description: "TESDA NC II – Computer Systems Servicing",
  },
  {
    name: "ICT - Technical Drafting",
    category: "ICT",
    trackType: "SPECIALIZATION",
    displayOrder: 7,
    description: "TESDA NC II – Technical Drafting",
  },
  {
    name: "ICT - Animation",
    category: "ICT",
    trackType: "SPECIALIZATION",
    displayOrder: 8,
    description: "TESDA NC II – Animation",
  },
  {
    name: "ICT - Computer Programming",
    category: "ICT",
    trackType: "SPECIALIZATION",
    displayOrder: 9,
    description: "TESDA NC II – Computer Programming",
  },
  // INDUSTRIAL ARTS
  {
    name: "IA - Carpentry",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 10,
    description: "TESDA NC II – Carpentry",
  },
  {
    name: "IA - Electrical Installation and Maintenance",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 11,
    description: "TESDA NC II – Electrical Installation and Maintenance",
  },
  {
    name: "IA - Electronics",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 12,
    description: "TESDA NC II – Electronics",
  },
  {
    name: "IA - Shielded Metal Arc Welding",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 13,
    description: "TESDA NC I – Shielded Metal Arc Welding (SMAW)",
  },
  {
    name: "IA - Plumbing",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 14,
    description: "TESDA NC II – Plumbing",
  },
  // AGRI-FISHERY ARTS
  {
    name: "AFA - Agricultural Crops Production",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 15,
    description: "TESDA NC II – Agricultural Crops Production",
  },
  {
    name: "AFA - Fishery Arts",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 16,
    description: "TESDA NC II – Fishery Arts (Aquaculture)",
  },
  {
    name: "AFA - Animal Production",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    displayOrder: 17,
    description: "TESDA NC II – Animal Production (Swine and Poultry)",
  },
];

// The 7 tracks that are actively cycled across G9/G10 BEC sections.
// Must match names in TLE_CATALOG above.
const SECTION_ASSIGNMENT_TRACKS = [
  "HE - Cookery",
  "HE - Bread and Pastry Production",
  "ICT - Computer Systems Servicing",
  "ICT - Technical Drafting",
  "IA - Electrical Installation and Maintenance",
  "IA - Carpentry",
  "AFA - Agricultural Crops Production",
];

async function upsertTlePrograms() {
  console.log("\n📚 Upserting TLE Program catalog...");
  let created = 0;
  let updated = 0;

  for (const prog of TLE_CATALOG) {
    const result = await prisma.tLEProgram.upsert({
      where: { name: prog.name },
      update: {
        category: prog.category,
        trackType: prog.trackType,
        displayOrder: prog.displayOrder,
        description: prog.description ?? null,
        isActive: true,
      },
      create: {
        name: prog.name,
        category: prog.category,
        trackType: prog.trackType,
        displayOrder: prog.displayOrder,
        description: prog.description ?? null,
        isActive: true,
      },
    });
    if (result.updatedAt === result.createdAt) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`  ✅ TLE Programs: ${created} created, ${updated} updated.`);
}

async function assignTleProgramsToSections() {
  console.log("\n🏫 Assigning TLE programs to Grade 9 & 10 BEC sections...");

  // Build name → id lookup from the assignment tracks
  const programs = await prisma.tLEProgram.findMany({
    where: { name: { in: SECTION_ASSIGNMENT_TRACKS } },
    select: { id: true, name: true },
  });

  const tleMap: Record<string, number> = {};
  for (const p of programs) tleMap[p.name] = p.id;

  const missing = SECTION_ASSIGNMENT_TRACKS.filter((n) => !tleMap[n]);
  if (missing.length > 0) {
    throw new Error(
      `Missing TLE programs in DB (run upsertTlePrograms first): ${missing.join(", ")}`,
    );
  }

  const g9 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 9" } });
  const g10 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 10" },
  });

  if (!g9 || !g10) throw new Error("Grade 9 or Grade 10 not found.");

  const allSchoolYears = await prisma.schoolYear.findMany({
    orderBy: { yearLabel: "asc" },
  });

  let totalUpdated = 0;

  for (const sy of allSchoolYears) {
    for (const grade of [g9, g10]) {
      // Fetch BEC sections ordered by section_rank (nulls last), then name
      const sections = await prisma.section.findMany({
        where: {
          schoolYearId: sy.id,
          gradeLevelId: grade.id,
          programType: "REGULAR",
        },
        orderBy: [{ sectionRank: "asc" }, { name: "asc" }],
      });

      if (sections.length === 0) continue;

      let tleIndex = 0;
      for (const sec of sections) {
        const trackName =
          SECTION_ASSIGNMENT_TRACKS[tleIndex % SECTION_ASSIGNMENT_TRACKS.length];
        const tleProgramId = tleMap[trackName];
        tleIndex++;

        if (sec.tleProgramId === tleProgramId) continue; // already correct

        await prisma.section.update({
          where: { id: sec.id },
          data: { tleProgramId },
        });
        totalUpdated++;
      }

      console.log(
        `  ${sy.yearLabel} ${grade.name}: ${sections.length} BEC section(s) processed.`,
      );
    }
  }

  console.log(`  ✅ Sections updated: ${totalUpdated}`);
}

async function syncEnrollmentRecords() {
  console.log(
    "\n🔗 Syncing TLE program to enrollment records for Grade 9 & 10...",
  );

  const g9 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 9" } });
  const g10 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 10" },
  });

  if (!g9 || !g10) return;

  // Find all sections that are G9/G10 BEC and have a TLE program assigned
  const sections = await prisma.section.findMany({
    where: {
      gradeLevelId: { in: [g9.id, g10.id] },
      programType: "REGULAR",
      tleProgramId: { not: null },
    },
    select: { id: true, tleProgramId: true },
  });

  let recordsUpdated = 0;
  let appsUpdated = 0;

  for (const sec of sections) {
    if (!sec.tleProgramId) continue;

    // Sync enrollment records where section matches but TLE doesn't
    const recResult = await prisma.enrollmentRecord.updateMany({
      where: {
        sectionId: sec.id,
        tleProgramId: { not: sec.tleProgramId },
      },
      data: { tleProgramId: sec.tleProgramId },
    });
    recordsUpdated += recResult.count;

    // Fill NULL tleProgramId on enrollment records for this section
    const recNullResult = await prisma.enrollmentRecord.updateMany({
      where: {
        sectionId: sec.id,
        tleProgramId: null,
      },
      data: { tleProgramId: sec.tleProgramId },
    });
    recordsUpdated += recNullResult.count;
  }

  console.log(`  ✅ Enrollment records synced: ${recordsUpdated}`);
  console.log(`  ✅ Enrollment applications synced: ${appsUpdated}`);
}

async function syncEnrollmentApplications() {
  console.log(
    "\n📋 Syncing TLE program to enrollment applications for Grade 9 & 10...",
  );

  const g9 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 9" } });
  const g10 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 10" },
  });

  if (!g9 || !g10) return;

  // For applications with status ENROLLED that have an enrollment record,
  // copy the TLE from the record to the application if mismatched or null.
  const enrolledRecords = await prisma.enrollmentRecord.findMany({
    where: {
      section: {
        gradeLevelId: { in: [g9.id, g10.id] },
        programType: "REGULAR",
      },
      tleProgramId: { not: null },
    },
    select: {
      enrollmentApplicationId: true,
      tleProgramId: true,
    },
  });

  let appsUpdated = 0;

  for (const rec of enrolledRecords) {
    if (!rec.tleProgramId) continue;

    const result = await prisma.enrollmentApplication.updateMany({
      where: {
        id: rec.enrollmentApplicationId,
        OR: [
          { tleProgramId: null },
          { tleProgramId: { not: rec.tleProgramId } },
        ],
      },
      data: { tleProgramId: rec.tleProgramId },
    });
    appsUpdated += result.count;
  }

  console.log(`  ✅ Enrollment applications synced: ${appsUpdated}`);
}

async function verifyTleAssignments() {
  console.log("\n🔍 Verifying TLE assignments...");

  const gradeNames = ["Grade 9", "Grade 10"];

  for (const gradeName of gradeNames) {
    const grade = await prisma.gradeLevel.findFirst({
      where: { name: gradeName },
    });
    if (!grade) continue;

    const allBec = await prisma.section.count({
      where: { gradeLevelId: grade.id, programType: "REGULAR" },
    });
    const withTle = await prisma.section.count({
      where: {
        gradeLevelId: grade.id,
        programType: "REGULAR",
        tleProgramId: { not: null },
      },
    });
    const withoutTle = allBec - withTle;

    console.log(
      `  ${gradeName}: ${withTle}/${allBec} sections have TLE assigned` +
        (withoutTle > 0 ? ` ⚠️  ${withoutTle} still missing` : " ✅"),
    );
  }

  const tleProgramCount = await prisma.tLEProgram.count();
  const activeCount = await prisma.tLEProgram.count({
    where: { isActive: true },
  });
  console.log(
    `  TLE Programs in DB: ${tleProgramCount} total, ${activeCount} active`,
  );

  const g9Records = await prisma.enrollmentRecord.count({
    where: {
      section: { gradeLevelId: (await prisma.gradeLevel.findFirst({ where: { name: "Grade 9" } }))?.id, programType: "REGULAR" },
      tleProgramId: { not: null },
    },
  });
  const g10Records = await prisma.enrollmentRecord.count({
    where: {
      section: { gradeLevelId: (await prisma.gradeLevel.findFirst({ where: { name: "Grade 10" } }))?.id, programType: "REGULAR" },
      tleProgramId: { not: null },
    },
  });

  console.log(
    `  Grade 9 enrollment records with TLE:  ${g9Records}`,
  );
  console.log(
    `  Grade 10 enrollment records with TLE: ${g10Records}`,
  );
}

async function main() {
  console.log("🚀 TLE Data Seed — DepEd Grade 9 & 10 TLE Programs");
  console.log("======================================================");

  await upsertTlePrograms();
  await assignTleProgramsToSections();
  await syncEnrollmentRecords();
  await syncEnrollmentApplications();
  await verifyTleAssignments();

  console.log("\n✅ TLE data seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
