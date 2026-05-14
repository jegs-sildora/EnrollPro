import "dotenv/config";
import { PrismaClient, ApplicantType, AssessmentKind } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("≡ƒÜÇ Seeding SCP Program Configurations for 2026-2027...");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" }
  });

  if (!targetYear) {
    throw new Error("School year 2026-2027 not found. Run db:seed-2026-2027 first.");
  }

  // 1. STE - Science, Technology, and Engineering
  await prisma.scpProgramConfig.upsert({
    where: {
      uq_scp_program_configs_type: {
        schoolYearId: targetYear.id,
        scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING" as ApplicantType,
      }
    },
    update: {},
    create: {
      schoolYearId: targetYear.id,
      scpType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING" as ApplicantType,
      isOffered: true,
      isTwoPhase: true,
      cutoffScore: 85,
      gradeRequirements: {
        subjects: ["ENGLISH", "SCIENCE", "MATHEMATICS"],
        minimumAverage: 85
      },
      rankingFormula: {
        qualifyingExam: 0.65,
        interview: 0.15,
        previousGenAve: 0.20
      },
      notes: "HNHS Localized Policy: Exam (65%) + Interview (15%) + G6 Ave (20%)",
      steps: {
        create: [
          {
            stepOrder: 1,
            kind: "QUALIFYING_EXAMINATION" as AssessmentKind,
            label: "Qualifying Examination",
            description: "Coverage: English, Science, Mathematics, and Abstract Reasoning",
            isRequired: true,
            scheduledDate: new Date("2026-03-14T08:00:00Z"),
            venue: "HNHS Main Building",
          },
          {
            stepOrder: 2,
            kind: "INTERVIEW" as AssessmentKind,
            label: "Face-to-Face Interview",
            description: "Assessing learner interest and parent commitment",
            isRequired: true,
            scheduledDate: new Date("2026-03-21T08:00:00Z"),
            venue: "HNHS Science Lab",
          }
        ]
      },
      options: {
        create: [
          { optionType: "ART_FIELD", value: "N/A (Academic)" }
        ]
      }
    }
  });

  // 2. SPS - Special Program in Sports
  await prisma.scpProgramConfig.upsert({
    where: {
      uq_scp_program_configs_type: {
        schoolYearId: targetYear.id,
        scpType: "SPECIAL_PROGRAM_IN_SPORTS" as ApplicantType,
      }
    },
    update: {},
    create: {
      schoolYearId: targetYear.id,
      scpType: "SPECIAL_PROGRAM_IN_SPORTS" as ApplicantType,
      isOffered: true,
      isTwoPhase: true,
      cutoffScore: 85,
      gradeRequirements: {
        minimumGeneralAverage: 85
      },
      notes: "Focus on athletic verification and performance skills",
      steps: {
        create: [
          {
            stepOrder: 1,
            kind: "PHYSICAL_FITNESS_TEST" as AssessmentKind,
            label: "Physical Fitness Test",
            description: "General fitness and agility assessment",
            isRequired: true,
          },
          {
            stepOrder: 2,
            kind: "SPORTS_SKILLS_TRYOUT" as AssessmentKind,
            label: "Sports Skills Tryout",
            description: "Performance in chosen sport",
            isRequired: true,
          }
        ]
      },
      options: {
        create: [
          { optionType: "SPORT", value: "ATHLETICS" },
          { optionType: "SPORT", value: "BASKETBALL" },
          { optionType: "SPORT", value: "VOLLEYBALL" },
          { optionType: "SPORT", value: "SWIMMING" },
          { optionType: "SPORT", value: "BADMINTON" }
        ]
      }
    }
  });

  // 3. SPA - Special Program in the Arts
  await prisma.scpProgramConfig.upsert({
    where: {
      uq_scp_program_configs_type: {
        schoolYearId: targetYear.id,
        scpType: "SPECIAL_PROGRAM_IN_THE_ARTS" as ApplicantType,
      }
    },
    update: {},
    create: {
      schoolYearId: targetYear.id,
      scpType: "SPECIAL_PROGRAM_IN_THE_ARTS" as ApplicantType,
      isOffered: true,
      isTwoPhase: true,
      cutoffScore: 85,
      gradeRequirements: {
        minimumGeneralAverage: 85
      },
      notes: "Auditions deferred to enrollment phase as per HNHS policy",
      steps: {
        create: [
          {
            stepOrder: 1,
            kind: "TALENT_AUDITION" as AssessmentKind,
            label: "Talent Audition",
            description: "Performance assessment in chosen art field",
            isRequired: true,
          }
        ]
      },
      options: {
        create: [
          { optionType: "ART_FIELD", value: "MUSIC" },
          { optionType: "ART_FIELD", value: "DANCE" },
          { optionType: "ART_FIELD", value: "VISUAL ARTS" },
          { optionType: "ART_FIELD", value: "MEDIA ARTS" },
          { optionType: "ART_FIELD", value: "THEATER" },
          { optionType: "ART_FIELD", value: "CREATIVE WRITING" }
        ]
      }
    }
  });

  // 4. SPJ - Special Program in Journalism
  await prisma.scpProgramConfig.upsert({
    where: {
      uq_scp_program_configs_type: {
        schoolYearId: targetYear.id,
        scpType: "SPECIAL_PROGRAM_IN_JOURNALISM" as ApplicantType,
      }
    },
    update: {},
    create: {
      schoolYearId: targetYear.id,
      scpType: "SPECIAL_PROGRAM_IN_JOURNALISM" as ApplicantType,
      isOffered: true,
      isTwoPhase: true,
      cutoffScore: 85,
      gradeRequirements: {
        subjects: ["ENGLISH", "FILIPINO"],
        minimumAverage: 85
      },
      steps: {
        create: [
          {
            stepOrder: 1,
            kind: "QUALIFYING_EXAMINATION" as AssessmentKind,
            label: "Proficiency Examination",
            description: "Written test in news and feature writing",
            isRequired: true,
          },
          {
            stepOrder: 2,
            kind: "INTERVIEW" as AssessmentKind,
            label: "Oral Interview",
            description: "Simulated broadcasting and interview",
            isRequired: true,
          }
        ]
      }
    }
  });

  console.log("Γ£à SCP configurations seeded successfully for 2026-2027.");
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
