import "dotenv/config";
import { PrismaClient, SchoolYearStatus, PortalControl, Role, Sex } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Seeding School Year 2026-2027 Infrastructure...");

  // 1. Get previous school year
  const prevYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!prevYear) {
    throw new Error("Base school year 2025-2026 not found. Please run 'db:seed' first.");
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

  // 3. Clone Sections from 2025-2026
  const prevSections = await prisma.section.findMany({
    where: { schoolYearId: prevYear.id },
  });

  console.log(`📦 Cloning ${prevSections.length} sections to 2026-2027...`);
  
  for (const s of prevSections) {
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
        tleSpecialization: s.tleSpecialization,
      },
      create: {
        name: s.name,
        gradeLevelId: s.gradeLevelId,
        schoolYearId: targetYear.id,
        programType: s.programType,
        maxCapacity: s.maxCapacity,
        sortOrder: s.sortOrder,
        tleSpecialization: s.tleSpecialization,
      },
    });
  }

  // 4. Clone Teacher Designations (Advisers)
  const prevDesignations = await prisma.teacherDesignation.findMany({
    where: { schoolYearId: prevYear.id, isClassAdviser: true },
    include: { advisorySection: true },
  });

  console.log(`👩‍🏫 Cloning ${prevDesignations.length} teacher designations...`);

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
        }
      });

      if (!existingSA) {
        await prisma.sectionAdviser.create({
          data: {
            sectionId: newSection.id,
            teacherId: td.teacherId,
            schoolYearId: targetYear.id,
            effectiveFrom: targetYear.classOpeningDate || new Date(),
            status: "ACTIVE",
          }
        });
      }
    }
  }

  // 5. Clone SCP Program Configurations
  const prevScpConfigs = await prisma.scpProgramConfig.findMany({
    where: { schoolYearId: prevYear.id },
    include: {
      steps: {
        include: {
          rubricCategories: {
            include: { criteria: true }
          }
        }
      },
      options: true,
    }
  });

  console.log(`🔬 Cloning ${prevScpConfigs.length} SCP program configurations...`);

  for (const config of prevScpConfigs) {
    const newConfig = await prisma.scpProgramConfig.upsert({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: targetYear.id,
          scpType: config.scpType,
        }
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
      }
    });

    // Clone Steps
    for (const step of config.steps) {
      const newStep = await prisma.scpProgramStep.upsert({
        where: {
          uq_scp_program_steps_order: {
            scpProgramConfigId: newConfig.id,
            stepOrder: step.stepOrder,
          }
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
        }
      });

      // Clone Rubric Categories and Criteria
      for (const cat of step.rubricCategories) {
        const newCat = await prisma.scpInterviewRubricCategory.create({
          data: {
            scpProgramStepId: newStep.id,
            name: cat.name,
            displayOrder: cat.displayOrder,
            criteria: {
              create: cat.criteria.map(c => ({
                name: c.name,
                description: c.description,
                maxPts: c.maxPts,
                displayOrder: c.displayOrder,
              }))
            }
          }
        });
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
          }
        },
        update: {},
        create: {
          scpProgramConfigId: newConfig.id,
          optionType: opt.optionType,
          value: opt.value,
        }
      });
    }
  }

  console.log("\n✅ 2026-2027 Infrastructure seeded successfully.");
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
