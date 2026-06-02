import "dotenv/config";
import {
  PrismaClient,
  Sex,
  ApplicantType,
  ApplicationStatus,
  SectioningMethod,
  FamilyRelationship,
  AddressType,
  LearnerType,
  AdmissionChannel,
  IntakeMethod,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Marker used by wipe script to identify demo-seeded records ---
const DEMO_SF1_REMARKS = "DEMO_SEED";
const DEMO_TRACKING_PREFIX = "DEMO-G7-2026";
// LRN prefix: 229600 + 6-digit sequence = 12-digit LRN (unique range for demo)
const DEMO_LRN_PREFIX = "229600";

// --- Reference data (realistic Filipino names) ---
const FIRST_NAMES_MALE = [
  "JUAN",
  "JOSE",
  "MIGUEL",
  "CARLO",
  "RAFAEL",
  "PAOLO",
  "ANTONIO",
  "GABRIEL",
  "MATEO",
  "DIEGO",
  "EMMANUEL",
  "CHRISTIAN",
  "JOSHUA",
  "ANGELO",
  "RICARDO",
  "BENIGNO",
  "RAMON",
  "ELPIDIO",
  "DIOSDADO",
  "JOSEPH",
  "MARK",
  "RYAN",
  "JEROME",
  "ARNEL",
  "ROEL",
];
const FIRST_NAMES_FEMALE = [
  "MARIA",
  "ANGELICA",
  "PRINCESS",
  "JASMINE",
  "NICOLE",
  "GABRIELA",
  "SOFIA",
  "ISABELLA",
  "LIZA",
  "BEA",
  "CRISTINA",
  "PATRICIA",
  "ELENA",
  "ROSA",
  "TERESA",
  "LOURDES",
  "REMEDIOS",
  "CARMELA",
  "JOSEFINA",
  "PERLA",
  "AURORA",
  "ESTRELLA",
  "JENNY",
  "MARY",
  "ANNA",
];
const LAST_NAMES = [
  "DELA CRUZ",
  "REYES",
  "SANTOS",
  "GARCIA",
  "MENDOZA",
  "FERNANDEZ",
  "NAVARRO",
  "RAMOS",
  "BAUTISTA",
  "GONZALES",
  "TORRES",
  "VILLANUEVA",
  "CRUZ",
  "PASCUAL",
  "AQUINO",
  "CASTILLO",
  "MANALO",
  "DIZON",
  "PANGANIBAN",
  "SORIANO",
  "LIM",
  "TAN",
  "ONG",
  "JAVIER",
  "SALAZAR",
];
const MIDDLE_NAMES = [
  "SANTIAGO",
  "DE LEON",
  "BALTAZAR",
  "CASTILLO",
  "SORIANO",
  "DEL ROSARIO",
  "VALDEZ",
  "RODRIGUEZ",
  "PANGANIBAN",
  "IBARRA",
  "LUNA",
  "SILANG",
  "AGUILAR",
  "BERNARDO",
  "CRISTOBAL",
];
const CITIES = [
  "QUEZON CITY",
  "MANILA",
  "CALOOCAN",
  "LAS PIÑAS",
  "MAKATI",
  "MALABON",
  "MANDALUYONG",
  "MARIKINA",
  "MUNTINLUPA",
  "NAVOTAS",
  "PARAÑAQUE",
  "PASAY",
  "PASIG",
  "TAGUIG",
  "VALENZUELA",
];
const BARANGAYS = [
  "BAGONG SILANGAN",
  "BAGUMBAYAN",
  "BATASAN HILLS",
  "COMMONWEALTH",
  "HOLY SPIRIT",
  "PAYATAS",
  "TANDANG SORA",
  "SAUYO",
  "NOVALICHES",
  "SAN ISIDRO",
  "STA. LUCIA",
  "CONCEPCION",
  "MALANDAY",
  "POBLACION",
  "BAGBAG",
  "PASONG PUTIK",
];
const RELIGIONS = [
  "ROMAN CATHOLIC",
  "IGLESIA NI CRISTO",
  "PROTESTANT",
  "BORN AGAIN CHRISTIAN",
  "SEVENTH DAY ADVENTIST",
];
const MOTHER_TONGUES = [
  "TAGALOG",
  "CEBUANO",
  "ILOCANO",
  "HILIGAYNON",
  "BIKOL",
  "KAPAMPANGAN",
  "WARAY",
  "PANGASINAN",
];
const OCCUPATIONS = [
  "TEACHER",
  "VENDOR",
  "DRIVER",
  "FARMER",
  "NURSE",
  "ENGINEER",
  "HOUSEWIFE",
  "OFW",
  "CARPENTER",
  "SEAMAN",
];
const ELEMENTARY_SCHOOLS = [
  "BAGONG SILANGAN ELEMENTARY SCHOOL",
  "COMMONWEALTH ELEMENTARY SCHOOL",
  "HOLY SPIRIT ELEMENTARY SCHOOL",
  "BATASAN ELEMENTARY SCHOOL",
  "PAYATAS ELEMENTARY SCHOOL",
  "NOVALICHES ELEMENTARY SCHOOL",
  "SAUYO ELEMENTARY SCHOOL",
  "BAGUMBAYAN ELEMENTARY SCHOOL",
  "SAN ISIDRO ELEMENTARY SCHOOL",
  "TANDANG SORA ELEMENTARY SCHOOL",
];

// --- Helpers ---
function toUtcNoon(year: number, monthZeroBased: number, day: number): Date {
  return new Date(Date.UTC(year, monthZeroBased, day, 12, 0, 0, 0));
}

function pick<T>(arr: T[], idx: number): T {
  return arr[Math.abs(idx) % arr.length];
}

/**
 * Generates a general average for the i-th learner (0-indexed) out of total,
 * distributed across [minGA, maxGA] in descending order.
 * Top learners get higher GAs.
 */
function generateGA(
  i: number,
  total: number,
  minGA: number,
  maxGA: number,
): number {
  if (total <= 1) return maxGA;
  const raw = maxGA - ((maxGA - minGA) * i) / (total - 1);
  return Math.round(raw * 100) / 100;
}

// --- Main ---
async function main() {
  console.log("🌱 Seeding Demo Grade 7 Learners for SY 2026-2027...\n");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });
  if (!targetYear)
    throw new Error("SY 2026-2027 not found. Run base seed first.");

  const grade7 = await prisma.gradeLevel.findFirst({
    where: { name: "Grade 7" },
  });
  if (!grade7) throw new Error("Grade 7 grade level not found.");

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  if (!admin) throw new Error("No SYSTEM_ADMIN user found.");

  // --- Load all Grade 7 REGULAR sections with current enrollment counts ---
  const sections = await prisma.section.findMany({
    where: {
      schoolYearId: targetYear.id,
      gradeLevelId: grade7.id,
      programType: "REGULAR" as ApplicantType,
    },
    include: {
      enrollmentRecords: {
        where: { schoolYearId: targetYear.id },
        select: { id: true },
      },
    },
    orderBy: { sectionRank: "asc" },
  });

  if (sections.length === 0) {
    throw new Error(
      "No Grade 7 REGULAR sections found for SY 2026-2027. Run section seed first.",
    );
  }

  // --- Build seeding plan: how many learners to add per section ---
  const JOSE_RIZAL = "JOSE RIZAL";
  interface SectionPlan {
    id: number;
    name: string;
    isHomogeneous: boolean;
    rank: number;
    toAdd: number;
  }

  const homoPlans: SectionPlan[] = [];
  const heteroPlans: SectionPlan[] = [];

  for (const s of sections) {
    const current = s.enrollmentRecords.length;
    // Leave 1 empty seat in JOSE RIZAL for the demo (shows upcoming transfer student)
    const target = s.name === JOSE_RIZAL ? s.maxCapacity - 1 : s.maxCapacity;
    const toAdd = Math.max(0, target - current);
    const plan: SectionPlan = {
      id: s.id,
      name: s.name,
      isHomogeneous: s.isHomogeneous,
      rank: s.sectionRank ?? 99,
      toAdd,
    };
    if (s.isHomogeneous) {
      homoPlans.push(plan);
    } else {
      heteroPlans.push(plan);
    }
  }

  const homoTotal = homoPlans.reduce((sum, p) => sum + p.toAdd, 0);
  const heteroTotal = heteroPlans.reduce((sum, p) => sum + p.toAdd, 0);
  const grandTotal = homoTotal + heteroTotal;

  // --- Print plan ---
  console.log("📋 Seeding plan (REGULAR/BEC sections only):");
  console.log("  Homogeneous (rank 1-5) → GA range 88–99:");
  for (const p of homoPlans) {
    console.log(`    ${p.name} (rank ${p.rank}) → add ${p.toAdd} learners`);
  }
  console.log("  Heterogeneous (rank 6+) → GA range 75–87:");
  for (const p of heteroPlans) {
    console.log(`    ${p.name} (rank ${p.rank}) → add ${p.toAdd} learners`);
  }
  console.log(
    `\n  Total to seed: ${grandTotal} learners (${homoTotal} homo + ${heteroTotal} hetero)`,
  );

  if (grandTotal === 0) {
    console.log(
      "\n✅ All sections already at target capacity. Nothing to seed.",
    );
    return;
  }

  // --- Global counter for LRN and tracking number uniqueness ---
  let counter = 0;

  async function seedLearnerToSection(
    plan: SectionPlan,
    ga: number,
  ): Promise<void> {
    counter++;
    const seq = counter;

    const sex: Sex = seq % 2 === 0 ? "FEMALE" : "MALE";
    const firstPool = sex === "MALE" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
    const firstName = pick(firstPool, seq);
    const lastName = pick(LAST_NAMES, seq + 7);
    const middleName = pick(MIDDLE_NAMES, seq + 3);

    const lrn = `${DEMO_LRN_PREFIX}${String(seq).padStart(6, "0")}`;
    const trackingNumber = `${DEMO_TRACKING_PREFIX}-${String(seq).padStart(5, "0")}`;

    // Grade 7 learners in 2026-2027 are ~12-13 years old (born 2013-2014)
    const birthYear = seq % 3 === 0 ? 2014 : 2013;
    const birthMonth = seq % 12; // 0-indexed for Date.UTC
    const birthDay = 1 + (seq % 28);

    // 1. Learner
    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {},
      create: {
        lrn,
        firstName,
        lastName,
        middleName,
        birthdate: toUtcNoon(birthYear, birthMonth, birthDay),
        sex,
        placeOfBirth: pick(CITIES, seq),
        religion: pick(RELIGIONS, seq),
        motherTongue: pick(MOTHER_TONGUES, seq),
        isIpCommunity: false,
        isLearnerWithDisability: false,
        is4PsBeneficiary: seq % 25 === 0,
        isPendingLrnCreation: false,
        previousGenAve: ga,
        promotionStatus: "PROMOTED",
      },
    });

    // 2. EnrollmentApplication (status: ENROLLED)
    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {},
      create: {
        learnerId: learner.id,
        schoolYearId: targetYear.id,
        gradeLevelId: grade7.id,
        applicantType: "REGULAR" as ApplicantType,
        learnerType: "NEW_ENROLLEE" as LearnerType,
        status: "ENROLLED" as ApplicationStatus,
        admissionChannel: "F2F" as AdmissionChannel,
        trackingNumber,
        isPrivacyConsentGiven: true,
        encodedById: admin.id,
        intakeMethod: "BEEF_FULL" as IntakeMethod,
        contactNumber: `092${String(seq).padStart(8, "0").slice(0, 8)}`,
        guardianName: `GUARDIAN OF ${firstName} ${lastName}`,
        guardianRelationship: "MOTHER",
        reportedGrades: { grade6GeneralAverage: ga },
        hasNoMother: false,
        hasNoFather: false,
      },
    });

    // 3. EnrollmentRecord (tagged with DEMO_SEED for wipe identification)
    const existingRecord = await prisma.enrollmentRecord.findUnique({
      where: { enrollmentApplicationId: application.id },
    });
    if (!existingRecord) {
      await prisma.enrollmentRecord.create({
        data: {
          enrollmentApplicationId: application.id,
          sectionId: plan.id,
          schoolYearId: targetYear.id,
          learnerId: learner.id,
          enrolledById: admin.id,
          finalAverage: ga,
          sectioningMethod: "BATCH_ALGORITHM" as SectioningMethod,
          dateSectioned: new Date(),
          sf1Remarks: DEMO_SF1_REMARKS,
        },
      });
    }

    // 4. CURRENT address
    const existingAddr = await prisma.applicationAddress.findFirst({
      where: {
        enrollmentId: application.id,
        addressType: "CURRENT" as AddressType,
      },
    });
    if (!existingAddr) {
      await prisma.applicationAddress.create({
        data: {
          enrollmentId: application.id,
          addressType: "CURRENT" as AddressType,
          barangay: pick(BARANGAYS, seq),
          cityMunicipality: pick(CITIES, seq + 5),
          province: "METRO MANILA",
          country: "PHILIPPINES",
        },
      });
    }

    // 5. Family member (MOTHER)
    const existingFam = await prisma.applicationFamilyMember.findFirst({
      where: {
        enrollmentId: application.id,
        relationship: "MOTHER" as FamilyRelationship,
      },
    });
    if (!existingFam) {
      await prisma.applicationFamilyMember.create({
        data: {
          enrollmentId: application.id,
          relationship: "MOTHER" as FamilyRelationship,
          firstName: pick(FIRST_NAMES_FEMALE, seq + 1000),
          lastName,
          middleName: pick(MIDDLE_NAMES, seq + 500),
          contactNumber: `091${String(seq + 1000)
            .padStart(8, "0")
            .slice(0, 8)}`,
          occupation: pick(OCCUPATIONS, seq),
        },
      });
    }

    // 6. Previous school (Grade 6 record)
    const existingPrev = await prisma.enrollmentPreviousSchool.findUnique({
      where: { applicationId: application.id },
    });
    if (!existingPrev) {
      await prisma.enrollmentPreviousSchool.create({
        data: {
          applicationId: application.id,
          schoolName: pick(ELEMENTARY_SCHOOLS, seq),
          gradeCompleted: "Grade 6",
          schoolYearAttended: "2025-2026",
          generalAverage: ga,
        },
      });
    }

    // 7. Checklist
    const existingChecklist = await prisma.applicationChecklist.findUnique({
      where: { enrollmentId: application.id },
    });
    if (!existingChecklist) {
      await prisma.applicationChecklist.create({
        data: {
          enrollmentId: application.id,
          isSf9Submitted: true,
          isPsaBirthCertPresented: true,
          academicStatus: "PROMOTED",
        },
      });
    }

    if (seq % 50 === 0) {
      console.log(`  ⏳ Progress: ${seq} / ${grandTotal} learners seeded...`);
    }
  }

  // --- Seed homogeneous sections (rank 1–5) with top GAs (88–99) ---
  console.log("\n🏅 Seeding homogeneous sections (top GAs)...");
  let homoIdx = 0;
  for (const plan of homoPlans) {
    if (plan.toAdd === 0) {
      console.log(`  ✓ ${plan.name} already at target capacity — skipped.`);
      continue;
    }
    console.log(
      `  → ${plan.name} (rank ${plan.rank}): seeding ${plan.toAdd} learners (GA ~${generateGA(homoIdx, homoTotal, 88, 99)}–${generateGA(homoIdx + plan.toAdd - 1, homoTotal, 88, 99)})`,
    );
    for (let i = 0; i < plan.toAdd; i++) {
      const ga = generateGA(homoIdx + i, homoTotal, 88, 99);
      await seedLearnerToSection(plan, ga);
    }
    homoIdx += plan.toAdd;
  }

  // --- Seed heterogeneous sections (rank 6+) with lower GAs (75–87) ---
  console.log("\n📚 Seeding heterogeneous sections (remaining GAs)...");
  let heteroIdx = 0;
  for (const plan of heteroPlans) {
    if (plan.toAdd === 0) {
      console.log(`  ✓ ${plan.name} already at target capacity — skipped.`);
      continue;
    }
    console.log(
      `  → ${plan.name} (rank ${plan.rank}): seeding ${plan.toAdd} learners (GA ~${generateGA(heteroIdx, heteroTotal, 75, 87)}–${generateGA(heteroIdx + plan.toAdd - 1, heteroTotal, 75, 87)})`,
    );
    for (let i = 0; i < plan.toAdd; i++) {
      const ga = generateGA(heteroIdx + i, heteroTotal, 75, 87);
      await seedLearnerToSection(plan, ga);
    }
    heteroIdx += plan.toAdd;
  }

  console.log(
    `\n✅ Demo seed complete! ${counter} Grade 7 BEC learners added.`,
  );
  console.log(
    `   LRN range: ${DEMO_LRN_PREFIX}000001 – ${DEMO_LRN_PREFIX}${String(counter).padStart(6, "0")}`,
  );
  console.log(
    `   Tracking range: ${DEMO_TRACKING_PREFIX}-00001 – ${DEMO_TRACKING_PREFIX}-${String(counter).padStart(5, "0")}`,
  );
  console.log(
    `   Sections not touched: SIRIUS, VEGA, SPA A, SPA B, SPS A, SPS B (already full).`,
  );
  console.log(`\n   To undo: pnpm --filter server run db:wipe-demo-g7`);
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
