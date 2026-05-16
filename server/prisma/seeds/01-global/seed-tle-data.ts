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
  programCode: string;
  category: TLECategory;
  trackType: TLETrackType;
  displayOrder: number;
  description?: string;
}[] = [
  // ICT
  {
    name: "ICT - Computer System Servicing",
    programCode: "TLE_ICTCSS9-12",
    category: "ICT",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "ICT - Computer Programming",
    programCode: "TLE_ICTPROG9-12",
    category: "ICT",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "ICT - Animation",
    programCode: "TLE_ICTAN9-12",
    category: "ICT",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "ICT - Illustration",
    programCode: "TLE_ICTIL9-12",
    category: "ICT",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "ICT - Telecommunication (OSP/Subscribers Line)",
    programCode: "TLE_ICTCST9-12",
    category: "ICT",
    trackType: "SPECIALIZATION",
    
  },
  // AGRI-FISHERY ARTS
  {
    name: "AFA - Crop Production (Agricultural Crop Production)",
    programCode: "TLE_AFACP9-12",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "AFA - Animal Production (Poultry/Swine/Ruminants)",
    programCode: "TLE_AP9-12",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "AFA - Aquaculture (Fish Culture)",
    programCode: "TLE_AFAQ9-12",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "AFA - Fish Capture (Fishing Gear/Capture)",
    programCode: "TLE_AFFC9-12",
    category: "AGRI_FISHERY_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  // HOME ECONOMICS / FAMILY AND CONSUMER SCIENCE
  {
    name: "HE - Food and Beverage Processing",
    programCode: "TLE_AFFP9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Cookery",
    programCode: "TLE_HECK9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Bread and Pastry",
    programCode: "TLE_HEBP9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Dressmaking",
    programCode: "TLE_HEDM9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Tailoring",
    programCode: "TLE_HETL9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Handicrafts (Needlecraft/Macrame)",
    programCode: "TLE_HEHC9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Food and Beverage Services",
    programCode: "TLE_HEFBS9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Beauty Care (Nail Care/Hairdressing)",
    programCode: "TLE_HEBC9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Caregiving",
    programCode: "TLE_HECG9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Tourism Services (Tour Guiding/Travel Services)",
    programCode: "TLE_HETS9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Housekeeping",
    programCode: "TLE_HEHK9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "HE - Front Office Services",
    programCode: "TLE_HEFO9-12",
    category: "HOME_ECONOMICS",
    trackType: "SPECIALIZATION",
    
  },
  // INDUSTRIAL ARTS
  {
    name: "IA - Residential Plumbing",
    programCode: "TLE_IAPB9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "IA - Residential Construction (Masonry/Tile Setting)",
    programCode: "TLE_IAMN9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "IA - Carpentry",
    programCode: "TLE_IACP9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "IA - Shielded Metal Arc Welding (SMAW)",
    programCode: "TLE_IAAW9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "IA - Electrical Installation and Maintenance (EIM)",
    programCode: "TLE_IAEI9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "IA - EPAS",
    programCode: "TLE_IAEP9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
  {
    name: "IA - Automotive Servicing",
    programCode: "TLE_IAAS9-12",
    category: "INDUSTRIAL_ARTS",
    trackType: "SPECIALIZATION",
    
  },
];

// The 7 tracks that are actively cycled across G9/G10 BEC sections.
// Must match names in TLE_CATALOG above.
const SECTION_ASSIGNMENT_TRACKS = [
  "HE - Cookery",
  "HE - Bread and Pastry",
  "ICT - Computer System Servicing",
  "ICT - Computer Programming",
  "IA - Electrical Installation and Maintenance (EIM)",
  "IA - Carpentry",
  "AFA - Crop Production (Agricultural Crop Production)",
];

async function upsertTlePrograms() {
  console.log("\n📚 Upserting TLE Program catalog...");
  let created = 0;
  let updated = 0;
  const seededIds: number[] = [];

  for (const prog of TLE_CATALOG) {
    const existing = await prisma.tLEProgram.findFirst({
      where: {
        OR: [{ programCode: prog.programCode }, { name: prog.name }],
      },
      select: { id: true },
    });

    const result = existing
      ? await prisma.tLEProgram.update({
          where: { id: existing.id },
          data: {
            name: prog.name,
            programCode: prog.programCode,
            category: prog.category,
            trackType: prog.trackType,
            displayOrder: prog.displayOrder,
            description: prog.description ?? null,
            isActive: true,
          },
        })
      : await prisma.tLEProgram.create({
          data: {
            name: prog.name,
            programCode: prog.programCode,
            category: prog.category,
            trackType: prog.trackType,
            displayOrder: prog.displayOrder,
            description: prog.description ?? null,
            isActive: true,
          },
        });

    seededIds.push(result.id);

    if (!existing) {
      created++;
    } else {
      updated++;
    }
  }

  const deactivated = await prisma.tLEProgram.updateMany({
    where: {
      trackType: "SPECIALIZATION",
      id: { notIn: seededIds },
      isActive: true,
    },
    data: { isActive: false },
  });

  console.log(`  ✅ TLE Programs: ${created} created, ${updated} updated.`);
  console.log(`  ✅ Legacy specialization programs deactivated: ${deactivated.count}`);
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
