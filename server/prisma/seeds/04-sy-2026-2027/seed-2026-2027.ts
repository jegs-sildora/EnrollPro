import "dotenv/config";
import {
  PrismaClient,
  SchoolYearStatus,
  PortalControl,
  Role,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒÜÇ Seeding School Year 2026-2027 Infrastructure...");

  // 1. Get previous school year
  const prevYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!prevYear) {
    throw new Error(
      "Base school year 2025-2026 not found. Please run 'db:seed' first.",
    );
  }

  // 2. Create 2026-2027 School Year
  const targetYear = await prisma.schoolYear.upsert({
    where: { yearLabel: "2026-2027" },
    update: {
      status: "ACTIVE" as SchoolYearStatus,
    },
    create: {
      yearLabel: "2026-2027",
      status: "ACTIVE" as SchoolYearStatus,
      clonedFromId: prevYear.id,
      classOpeningDate: new Date("2026-06-01T00:00:00Z"),
      classEndDate: new Date("2027-03-31T00:00:00Z"),
      earlyRegOpenDate: new Date("2026-01-15T00:00:00Z"),
      earlyRegCloseDate: new Date("2026-02-28T00:00:00Z"),
      enrollOpenDate: new Date("2026-05-01T00:00:00Z"),
      enrollCloseDate: new Date("2026-05-31T00:00:00Z"),
      portalControl: "AUTO" as PortalControl,
    },
  });

  console.log(`✅ School Year 2026-2027 is ${targetYear.status}.`);

  // 2.5 Cleanup existing 2026-2027 Infrastructure/Data (PRESERVING SECTIONS)
  console.log("🧹 Cleaning up 2026-2027 data (preserving sections)...");
  await prisma.enrollmentRecord.deleteMany({ where: { schoolYearId: targetYear.id } });
  await prisma.enrollmentApplication.deleteMany({ where: { schoolYearId: targetYear.id } });
  await prisma.sectionAdviser.deleteMany({ where: { schoolYearId: targetYear.id } });
  await prisma.teacherDesignation.deleteMany({ where: { schoolYearId: targetYear.id } });

  // 3. Clone SCP Program Configurations FIRST (so sections can link to them)
  const prevScpConfigs = await prisma.scpProgramConfig.findMany({
    where: { schoolYearId: prevYear.id },
    include: {
      steps: {
        include: {
          rubricCategories: {
            include: { criteria: true },
          },
        },
      },
      options: true,
    },
  });

  console.log(
    `≡ƒö¼ Cloning ${prevScpConfigs.length} SCP program configurations...`,
  );

  const scpConfigMapping = new Map<number, number>();

  for (const config of prevScpConfigs) {
    const newConfig = await prisma.scpProgramConfig.upsert({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: targetYear.id,
          scpType: config.scpType,
        },
      },
      update: {
        isOffered: config.isOffered,
        isTwoPhase: config.isTwoPhase,
        cutoffScore: config.cutoffScore,
        gradeRequirements: config.gradeRequirements || undefined,
        rankingFormula: config.rankingFormula || undefined,
        notes: config.notes,
      },
      create: {
        schoolYearId: targetYear.id,
        scpType: config.scpType,
        isOffered: config.isOffered,
        isTwoPhase: config.isTwoPhase,
        cutoffScore: config.cutoffScore,
        gradeRequirements: config.gradeRequirements || undefined,
        rankingFormula: config.rankingFormula || undefined,
        notes: config.notes,
      },
    });

    scpConfigMapping.set(config.id, newConfig.id);

    // Clone Steps
    for (const step of config.steps) {
      const newStep = await prisma.scpProgramStep.upsert({
        where: {
          uq_scp_program_steps_order: {
            scpProgramConfigId: newConfig.id,
            stepOrder: step.stepOrder,
          },
        },
        update: {
          kind: step.kind,
          label: step.label,
          description: step.description,
          isRequired: step.isRequired,
          cutoffScore: step.cutoffScore,
          rubric: step.rubric || undefined,
        },
        create: {
          scpProgramConfigId: newConfig.id,
          stepOrder: step.stepOrder,
          kind: step.kind,
          label: step.label,
          description: step.description,
          isRequired: step.isRequired,
          cutoffScore: step.cutoffScore,
          rubric: step.rubric || undefined,
        },
      });

      // Clone Rubric Categories and Criteria (Idempotently)
      for (const cat of step.rubricCategories) {
        let newCat = await prisma.scpInterviewRubricCategory.findFirst({
          where: {
            scpProgramStepId: newStep.id,
            name: cat.name,
          },
        });

        if (!newCat) {
          newCat = await prisma.scpInterviewRubricCategory.create({
            data: {
              scpProgramStepId: newStep.id,
              name: cat.name,
              displayOrder: cat.displayOrder,
            },
          });
        }

        // Criteria
        for (const c of cat.criteria) {
          const existingCriterion = await prisma.scpInterviewRubricCriterion.findFirst({
            where: {
              rubricCategoryId: newCat.id,
              name: c.name,
            },
          });

          if (!existingCriterion) {
            await prisma.scpInterviewRubricCriterion.create({
              data: {
                rubricCategoryId: newCat.id,
                name: c.name,
                description: c.description ?? undefined,
                maxPts: c.maxPts,
                displayOrder: c.displayOrder,
              },
            });
          }
        }
      }
    }

    // Clone Options
    for (const opt of config.options) {
      await prisma.scpProgramOption.upsert({
        where: {
          uq_scp_program_options_value: {
            scpProgramConfigId: newConfig.id,
            optionType: opt.optionType,
            value: opt.value,
          },
        },
        update: {},
        create: {
          scpProgramConfigId: newConfig.id,
          optionType: opt.optionType,
          value: opt.value,
        },
      });
    }
  }

  // 4. Clone Sections from 2025-2026
  const prevSections = await prisma.section.findMany({
    where: { schoolYearId: prevYear.id },
  });

  console.log(`≡ƒôª Cloning ${prevSections.length} sections to 2026-2027...`);

  for (const s of prevSections) {
    const targetScpConfigId = s.scpProgramConfigId ? scpConfigMapping.get(s.scpProgramConfigId) : null;

    await prisma.section.upsert({
      where: {
        uq_sections_name_grade_sy: {
          name: s.name,
          gradeLevelId: s.gradeLevelId,
          schoolYearId: targetYear.id,
        },
      },
      update: {
        programType: s.programType,
        maxCapacity: s.maxCapacity,
        sortOrder: s.sortOrder,
        scpProgramConfigId: targetScpConfigId,
        sectionRank: s.sectionRank,
      },
      create: {
        name: s.name,
        gradeLevelId: s.gradeLevelId,
        schoolYearId: targetYear.id,
        programType: s.programType,
        maxCapacity: s.maxCapacity,
        sortOrder: s.sortOrder,
        scpProgramConfigId: targetScpConfigId,
        sectionRank: s.sectionRank,
      },
    });
  }

  // 5. Clone Teacher Designations (Advisers)
  const prevDesignations = await prisma.teacherDesignation.findMany({
    where: { schoolYearId: prevYear.id, isClassAdviser: true },
    include: { advisorySection: true },
  });

  console.log(
    `≡ƒæ⌐ΓÇì≡ƒÅ½ Cloning ${prevDesignations.length} teacher designations...`,
  );

  const firstAdmin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });

  for (const td of prevDesignations) {
    if (!td.advisorySection) continue;

    // Find the corresponding section in the new year
    const newSection = await prisma.section.findUnique({
      where: {
        uq_sections_name_grade_sy: {
          name: td.advisorySection.name,
          gradeLevelId: td.advisorySection.gradeLevelId,
          schoolYearId: targetYear.id,
        },
      },
    });

    if (newSection) {
      await prisma.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: td.teacherId,
            schoolYearId: targetYear.id,
          },
        },
        update: {
          isClassAdviser: true,
          advisorySectionId: newSection.id,
          effectiveFrom: targetYear.classOpeningDate,
          effectiveTo: targetYear.classEndDate,
          updatedById: firstAdmin?.id,
        },
        create: {
          teacherId: td.teacherId,
          schoolYearId: targetYear.id,
          isClassAdviser: true,
          advisorySectionId: newSection.id,
          effectiveFrom: targetYear.classOpeningDate,
          effectiveTo: targetYear.classEndDate,
          updatedById: firstAdmin?.id,
        },
      });

      // Also ensure SectionAdviser record exists
      const existingSA = await prisma.sectionAdviser.findFirst({
        where: {
          sectionId: newSection.id,
          teacherId: td.teacherId,
          schoolYearId: targetYear.id,
        },
      });

      if (!existingSA) {
        await prisma.sectionAdviser.create({
          data: {
            sectionId: newSection.id,
            teacherId: td.teacherId,
            schoolYearId: targetYear.id,
            effectiveFrom: targetYear.classOpeningDate || new Date(),
            status: "ACTIVE",
          },
        });
      }
    }
  }

  // Archive 2025-2026 now that 2026-2027 is active (matches data.txt: status = ARCHIVED)
  await prisma.schoolYear.update({
    where: { yearLabel: "2025-2026" },
    data: { status: "ARCHIVED" },
  });
  console.log(`✅ School year 2025-2026 marked as ARCHIVED.`);

  // Sync SchoolSetting to point to 2026-2027 as the active school year
  await prisma.schoolSetting.updateMany({
    data: { activeSchoolYearId: targetYear.id },
  });
  console.log(`✅ SchoolSetting.activeSchoolYearId updated to 2026-2027 (id=${targetYear.id}).`);

  console.log("\nΓ£à 2026-2027 Infrastructure seeded successfully.");
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
