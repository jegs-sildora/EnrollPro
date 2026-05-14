import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
  SectioningMethod,
  ApplicantType,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STARS = [
  "SIRIUS",
  "VEGA",
  "RIGEL",
  "ARCTURUS",
  "CAPELLA",
  "CANOPUS",
  "ALTAIR",
  "PROCYON",
];

const HEROES = [
  "JOSE RIZAL",
  "ANDRES BONIFACIO",
  "APOLINARIO MABINI",
  "MARCELO DEL PILAR",
  "JUAN LUNA",
  "EMILIO JACINTO",
  "GABRIELA SILANG",
  "EMILIO AGUINALDO",
  "GRACIANO LOPEZ JAENA",
  "GREGORIO DEL PILAR",
  "MELCHORA AQUINO",
  "DIEGO SILANG",
  "FRANCISCO BALAGTAS",
  "MARCIANA AGONCILLO",
  "TERESA MAGBANUA",
  "TRINIDAD TECSON",
  "LAPU-LAPU",
  "SULTAN KUDARAT",
  "MACARIO SAKAY",
  "ARTEMIO RICARTE",
];

async function main() {
  console.log("🚀 Enrolling Pending Grade 7 Learners for 2026-2027 (Dynamic Mode)...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    throw new Error("Timeline failure: 2026-2027 not found. Run SY 2026-2027 infra seed first.");
  }

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
  });

  if (!grade7) throw new Error("Grade 7 level not found.");

  const firstAdmin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });

  if (!firstAdmin) throw new Error("No SYSTEM_ADMIN found to act as encoder.");

  // 1. Fetch all verified applications for Grade 7 in 2026-2027
  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      status: "VERIFIED" as ApplicationStatus,
    },
    include: {
      learner: true,
    },
    orderBy: { id: "asc" },
  });

  if (applications.length === 0) {
    console.log("ℹ️ No pending Grade 7 applications found with 'VERIFIED' status.");
    return;
  }

  console.log(`📊 Found ${applications.length} verified applications.`);

  // 2. Load existing sections and their current enrollment counts
  const loadSections = async () => {
    const sections = await prisma.section.findMany({
      where: {
        schoolYearId: targetYear.id,
        gradeLevelId: grade7.id,
      },
      include: {
        _count: {
          select: { enrollmentRecords: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
    return sections;
  };

  let sections = await loadSections();

  // Helper to find a section with capacity
  const findAvailableSection = (type: ApplicantType) => {
    return sections.find(
      (s) =>
        s.programType === type &&
        s._count.enrollmentRecords < s.maxCapacity
    );
  };

  // Helper to create a new section
  const createNewSection = async (type: ApplicantType) => {
    const theme = type === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? STARS : HEROES;
    const existingNames = sections
      .filter((s) => s.programType === type)
      .map((s) => s.name);
    
    const nextName = theme.find((name) => !existingNames.includes(name));
    
    if (!nextName) {
      throw new Error(`Exhausted theme pool for ${type} in Grade 7 2026-2027.`);
    }

    const lastSection = sections[sections.length - 1];
    const newSortOrder = (lastSection?.sortOrder ?? 0) + 1;
    const maxCapacity = type === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 35 : 45;

    console.log(`✨ Creating new section: ${nextName} (${type})`);

    const newSection = await prisma.section.create({
      data: {
        name: nextName,
        gradeLevelId: grade7.id,
        schoolYearId: targetYear.id,
        programType: type,
        maxCapacity,
        sortOrder: newSortOrder,
      },
    });

    // Refresh local section list
    sections = await loadSections();
    return sections.find((s) => s.id === newSection.id)!;
  };

  // 3. Process Enrollments
  let steCount = 0;
  let regCount = 0;

  for (const app of applications) {
    const isSTE = app.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
    const programType: ApplicantType = isSTE ? "SCIENCE_TECHNOLOGY_AND_ENGINEERING" : "REGULAR";

    let targetSection = findAvailableSection(programType);

    if (!targetSection) {
      targetSection = await createNewSection(programType);
    }

    // Create Enrollment Record
    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: app.id },
      update: {
        sectionId: targetSection.id,
        enrolledById: firstAdmin.id,
        sectioningMethod: "BATCH_ALGORITHM" as SectioningMethod,
      },
      create: {
        enrollmentApplicationId: app.id,
        learnerId: app.learnerId,
        sectionId: targetSection.id,
        schoolYearId: targetYear.id,
        enrolledById: firstAdmin.id,
        sectioningMethod: "BATCH_ALGORITHM" as SectioningMethod,
        enrolledAt: new Date(),
      },
    });

    // Update Application Status
    await prisma.enrollmentApplication.update({
      where: { id: app.id },
      data: {
        status: "ENROLLED" as ApplicationStatus,
      },
    });

    // Update local count for the section to avoid unnecessary refreshes/duplicate checks
    targetSection._count.enrollmentRecords++;

    if (isSTE) steCount++;
    else regCount++;

    if ((steCount + regCount) % 100 === 0) {
      console.log(`✅ Processed ${steCount + regCount} / ${applications.length} enrollments...`);
    }
  }

  console.log("\n✨ Dynamic Enrollment Complete!");
  console.log(`   - STE Learners Enrolled: ${steCount}`);
  console.log(`   - Regular Learners Enrolled: ${regCount}`);
  console.log(`   - Total: ${steCount + regCount}`);
  console.log(`   - Total Grade 7 Sections: ${sections.length}`);
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
