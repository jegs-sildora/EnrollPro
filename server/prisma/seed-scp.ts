import "dotenv/config";
import { PrismaClient, ApplicantType } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import {
  SCP_DEFAULT_PIPELINES,
  getSteSteps,
  type ScpType,
} from "@enrollpro/shared";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SCP_TYPES: ApplicantType[] = [
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
];

const PROGRAM_PREFIX: Record<ApplicantType, string> = {
  REGULAR: "REG",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};

type ScpOptionSeed = {
  optionType: "ART_FIELD" | "LANGUAGE" | "SPORT";
  value: string;
};

const DEFAULT_SCP_OPTIONS: Partial<Record<ApplicantType, ScpOptionSeed[]>> = {
  SPECIAL_PROGRAM_IN_THE_ARTS: [
    { optionType: "ART_FIELD", value: "MUSIC" },
    { optionType: "ART_FIELD", value: "DANCE" },
    { optionType: "ART_FIELD", value: "VISUAL_ARTS" },
  ],
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [
    { optionType: "LANGUAGE", value: "MANDARIN" },
    { optionType: "LANGUAGE", value: "JAPANESE" },
  ],
  SPECIAL_PROGRAM_IN_SPORTS: [
    { optionType: "SPORT", value: "BASKETBALL" },
    { optionType: "SPORT", value: "VOLLEYBALL" },
    { optionType: "SPORT", value: "ATHLETICS" },
  ],
};

const PH_FIRST_NAMES = [
  "Juan",
  "Maria",
  "Jose",
  "Angelica",
  "Miguel",
  "Princess",
  "Carlo",
  "Jasmine",
  "Rafael",
  "Nicole",
  "Paolo",
  "Gabriela",
];

const PH_MIDDLE_NAMES = [
  "Santos",
  "Reyes",
  "Garcia",
  "Cruz",
  "Mendoza",
  "Aquino",
  "Flores",
  "Navarro",
  "Torres",
  "Bautista",
  "Castro",
  "Valdez",
];

const PH_LAST_NAMES = [
  "Dela Cruz",
  "Reyes",
  "Santos",
  "Garcia",
  "Mendoza",
  "Fernandez",
  "Navarro",
  "Ramos",
  "Bautista",
  "Gonzales",
  "Torres",
  "Villanueva",
];

const PH_PLACE_OF_BIRTHS = [
  "Tandag City, Surigao del Sur",
  "Bislig City, Surigao del Sur",
  "Butuan City, Agusan del Norte",
  "Davao City, Davao del Sur",
  "Cebu City, Cebu",
  "Iligan City, Lanao del Norte",
];

const PH_RELIGIONS = [
  "ROMAN CATHOLIC",
  "IGLESIA NI CRISTO",
  "SEVENTH-DAY ADVENTIST",
  "ISLAM",
  "BORN AGAIN CHRISTIAN",
  "UNITED CHURCH OF CHRIST IN THE PHILIPPINES",
];

const PH_MOTHER_TONGUES = [
  "CEBUANO",
  "TAGALOG",
  "SURIGAONON",
  "MANDAYA",
  "BISAYA",
  "ENGLISH",
];

const SCP_DEFAULT_CUTOFFS: Partial<Record<ApplicantType, number>> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: 85,
  SPECIAL_PROGRAM_IN_THE_ARTS: 80,
  SPECIAL_PROGRAM_IN_SPORTS: 82,
  SPECIAL_PROGRAM_IN_JOURNALISM: 80,
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: 78,
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: 79,
};

function getPipelineForScpType(scpType: ApplicantType, isTwoPhase: boolean) {
  if (scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
    return getSteSteps(isTwoPhase);
  }
  return SCP_DEFAULT_PIPELINES[scpType as ScpType] ?? [];
}

function buildTrackingNumber(
  scpType: ApplicantType,
  year: number,
  sequence: number,
) {
  return `${PROGRAM_PREFIX[scpType]}-${year}-${String(sequence).padStart(5, "0")}`;
}

function buildContactNumber(sequence: number) {
  const lastNineDigits = String(100000000 + sequence).slice(-9);
  return `09${lastNineDigits}`;
}

function buildEmail(firstName: string, lastName: string, sequence: number) {
  const safeFirst = firstName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const safeLast = lastName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${safeFirst}.${safeLast}${sequence}@example.com`;
}

function buildPsaBirthCertNumber(sequence: number) {
  return `PSA-${new Date().getUTCFullYear()}-${String(sequence).padStart(8, "0")}`;
}

function buildScpCutoffScore(scpType: ApplicantType) {
  return SCP_DEFAULT_CUTOFFS[scpType] ?? 75;
}

function buildScpGradeRequirements(scpType: ApplicantType) {
  const rules = [
    {
      ruleType: "GENERAL_AVERAGE_MIN",
      minAverage: 85,
      subjects: [],
      subjectThresholds: [],
    },
  ];

  if (scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
    rules.push({
      ruleType: "SUBJECT_AVERAGE_MIN",
      minAverage: 85,
      subjects: ["ENGLISH", "SCIENCE", "MATHEMATICS"],
      subjectThresholds: [],
    });
  }

  return rules;
}

function buildScpRankingFormula(scpType: ApplicantType) {
  if (scpType === "SPECIAL_PROGRAM_IN_SPORTS") {
    return {
      components: [
        { metric: "sports_skills_tryout", weight: 0.7 },
        { metric: "interview", weight: 0.2 },
        { metric: "general_average", weight: 0.1 },
      ],
      tieBreaker: ["sports_skills_tryout", "general_average", "lrn"],
    };
  }

  return {
    components: [
      { metric: "qualifying_exam", weight: 0.6 },
      { metric: "interview", weight: 0.25 },
      { metric: "general_average", weight: 0.15 },
    ],
    tieBreaker: ["qualifying_exam", "general_average", "lrn"],
  };
}

function buildStepCutoffScore(kind: string, defaultCutoff: number) {
  return kind === "INTERVIEW" ? null : defaultCutoff;
}

function buildProgramStepDate(stepOrder: number) {
  const baseYear = new Date().getUTCFullYear();
  return new Date(Date.UTC(baseYear, 0, 10 + stepOrder * 4));
}

async function seedScpConfigurations(schoolYearId: number) {
  for (const scpType of SCP_TYPES) {
    const cutoffScore = buildScpCutoffScore(scpType);
    const gradeRequirements = buildScpGradeRequirements(scpType);
    const rankingFormula = buildScpRankingFormula(scpType);

    const config = await prisma.scpProgramConfig.upsert({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId,
          scpType,
        },
      },
      update: {
        isOffered: true,
        cutoffScore,
        gradeRequirements,
        rankingFormula,
      },
      create: {
        schoolYearId,
        scpType,
        isOffered: true,
        isTwoPhase: false,
        cutoffScore,
        gradeRequirements,
        rankingFormula,
      },
    });

    const pipeline = getPipelineForScpType(scpType, config.isTwoPhase);

    await prisma.scpProgramStep.deleteMany({
      where: { scpProgramConfigId: config.id },
    });

    if (pipeline.length > 0) {
      await prisma.scpProgramStep.createMany({
        data: pipeline.map((step) => ({
          scpProgramConfigId: config.id,
          stepOrder: step.stepOrder,
          kind: step.kind,
          label: step.label,
          description: step.description,
          isRequired: step.isRequired,
          scheduledDate: buildProgramStepDate(step.stepOrder),
          scheduledTime: "08:00",
          venue: `${PROGRAM_PREFIX[scpType]} Assessment Center`,
          notes: `Default schedule for ${scpType} pipeline step ${step.stepOrder}.`,
          cutoffScore: buildStepCutoffScore(step.kind, cutoffScore),
        })),
      });
    }

    await prisma.scpProgramOption.deleteMany({
      where: { scpProgramConfigId: config.id },
    });

    const optionData = (DEFAULT_SCP_OPTIONS[scpType] ?? []).map((option) => ({
      scpProgramConfigId: config.id,
      optionType: option.optionType,
      value: option.value,
    }));

    if (optionData.length > 0) {
      await prisma.scpProgramOption.createMany({ data: optionData });
    }

    console.log(
      `Configured ${scpType}: ${pipeline.length} step(s), ${optionData.length} option(s).`,
    );
  }
}

async function seedScpApplications(
  schoolYearId: number,
  gradeLevelId: number,
  encodedById: number,
) {
  const year = new Date().getFullYear();
  let globalCounter = 1;

  for (const scpType of SCP_TYPES) {
    for (let i = 1; i <= 3; i++) {
      const seedNumber = globalCounter;
      const firstName =
        PH_FIRST_NAMES[(seedNumber - 1) % PH_FIRST_NAMES.length];
      const middleName =
        PH_MIDDLE_NAMES[(seedNumber - 1) % PH_MIDDLE_NAMES.length];
      const lastName = PH_LAST_NAMES[(seedNumber - 1) % PH_LAST_NAMES.length];
      const lrn = `190000${String(seedNumber).padStart(6, "0")}`;
      const sex = seedNumber % 2 === 0 ? "FEMALE" : "MALE";
      const extensionName = seedNumber % 6 === 0 ? "JR" : null;
      const placeOfBirth =
        PH_PLACE_OF_BIRTHS[(seedNumber - 1) % PH_PLACE_OF_BIRTHS.length];
      const religion = PH_RELIGIONS[(seedNumber - 1) % PH_RELIGIONS.length];
      const motherTongue =
        PH_MOTHER_TONGUES[(seedNumber - 1) % PH_MOTHER_TONGUES.length];
      const isIpCommunity = seedNumber % 7 === 0;
      const isLearnerWithDisability = seedNumber % 5 === 0;
      const is4PsBeneficiary = seedNumber % 4 === 0;
      const isBalikAral = seedNumber % 11 === 0;

      const disabilityTypes = isLearnerWithDisability
        ? ["HEARING IMPAIRMENT"]
        : [];
      const ipGroupName = isIpCommunity ? "MANOBO" : null;
      const specialNeedsCategory = isLearnerWithDisability
        ? "HEARING IMPAIRMENT"
        : null;
      const householdId4Ps = is4PsBeneficiary
        ? `4PS-${String(seedNumber).padStart(6, "0")}`
        : null;
      const lastYearEnrolled = isBalikAral ? String(year - 2) : null;
      const lastGradeLevel = isBalikAral ? "Grade 6" : null;

      const birthMonth = (seedNumber % 12) + 1;
      const birthDay = ((seedNumber * 3) % 28) + 1;
      const birthdate = new Date(
        `2014-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
      );

      const psaBirthCertNumber = buildPsaBirthCertNumber(seedNumber);
      const trackingNumber = buildTrackingNumber(scpType, year, seedNumber);

      const learner = await prisma.learner.upsert({
        where: { lrn },
        update: {
          isPendingLrnCreation: false,
          psaBirthCertNumber,
          firstName,
          middleName,
          lastName,
          extensionName,
          birthdate,
          sex,
          studentPhoto: `/uploads/students/${trackingNumber.toLowerCase()}.jpg`,
          placeOfBirth,
          religion,
          motherTongue,
          isIpCommunity,
          ipGroupName,
          isLearnerWithDisability,
          disabilityTypes,
          specialNeedsCategory,
          hasPwdId: isLearnerWithDisability,
          is4PsBeneficiary,
          householdId4Ps,
          isBalikAral,
          lastYearEnrolled,
          lastGradeLevel,
        },
        create: {
          lrn,
          isPendingLrnCreation: false,
          psaBirthCertNumber,
          firstName,
          middleName,
          lastName,
          extensionName,
          birthdate,
          sex,
          studentPhoto: `/uploads/students/${trackingNumber.toLowerCase()}.jpg`,
          placeOfBirth,
          religion,
          motherTongue,
          isIpCommunity,
          ipGroupName,
          isLearnerWithDisability,
          disabilityTypes,
          specialNeedsCategory,
          hasPwdId: isLearnerWithDisability,
          is4PsBeneficiary,
          householdId4Ps,
          isBalikAral,
          lastYearEnrolled,
          lastGradeLevel,
        },
      });

      const contactNumber = buildContactNumber(seedNumber);
      const email = buildEmail(firstName, lastName, seedNumber);
      const submittedAt = new Date(Date.UTC(year, 0, 5 + seedNumber));
      const primaryContact =
        seedNumber % 3 === 0
          ? "GUARDIAN"
          : seedNumber % 2 === 0
            ? "MOTHER"
            : "FATHER";
      const guardianRelationship =
        primaryContact === "GUARDIAN" ? "AUNT" : primaryContact;

      const application = await prisma.earlyRegistrationApplication.upsert({
        where: { trackingNumber },
        update: {
          learnerId: learner.id,
          schoolYearId,
          gradeLevelId,
          applicantType: scpType,
          learnerType: "NEW_ENROLLEE",
          status: "SUBMITTED_BEERF",
          channel: "F2F",
          contactNumber,
          email,
          primaryContact,
          guardianRelationship,
          hasNoMother: false,
          hasNoFather: false,
          isPrivacyConsentGiven: true,
          encodedById,
          verifiedAt: null,
          verifiedById: null,
          submittedAt,
        },
        create: {
          learnerId: learner.id,
          schoolYearId,
          gradeLevelId,
          trackingNumber,
          applicantType: scpType,
          learnerType: "NEW_ENROLLEE",
          status: "SUBMITTED_BEERF",
          channel: "F2F",
          contactNumber,
          email,
          primaryContact,
          guardianRelationship,
          hasNoMother: false,
          hasNoFather: false,
          isPrivacyConsentGiven: true,
          encodedById,
          verifiedAt: null,
          verifiedById: null,
          submittedAt,
        },
      });

      // Keep SCP seeding focused on learner + core application data only.
      await Promise.all([
        prisma.applicationChecklist.deleteMany({
          where: { earlyRegistrationId: application.id },
        }),
        prisma.applicationFamilyMember.deleteMany({
          where: { earlyRegistrationId: application.id },
        }),
        prisma.applicationAddress.deleteMany({
          where: { earlyRegistrationId: application.id },
        }),
        prisma.earlyRegistrationAssessment.deleteMany({
          where: { applicationId: application.id },
        }),
      ]);

      console.log(`Seeded SCP application ${trackingNumber} (${scpType}).`);
      globalCounter++;
    }
  }
}

async function seed() {
  try {
    const schoolYear = await prisma.schoolYear.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!schoolYear) {
      throw new Error(
        "No active school year found. Run db:seed first and ensure one school year is ACTIVE.",
      );
    }

    const grade7 = await prisma.gradeLevel.findFirst({
      where: {
        schoolYearId: schoolYear.id,
        OR: [{ name: "Grade 7" }, { displayOrder: 7 }],
      },
      orderBy: { id: "asc" },
    });

    if (!grade7) {
      throw new Error(
        'Grade level "Grade 7" (displayOrder 7) not found for the active school year.',
      );
    }

    const admin = await prisma.user.findFirst({
      where: { role: "SYSTEM_ADMIN" },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    if (!admin) {
      throw new Error("No SYSTEM_ADMIN user found. Run db:seed first.");
    }

    console.log(`Using School Year: ${schoolYear.yearLabel}`);
    await seedScpConfigurations(schoolYear.id);
    await seedScpApplications(schoolYear.id, grade7.id, admin.id);

    console.log("SCP seeding completed.");
  } catch (error) {
    console.error("ERROR during SCP seeding:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seed();
