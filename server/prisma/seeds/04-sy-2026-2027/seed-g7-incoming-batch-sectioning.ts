/**
 * seed-g7-incoming-batch-sectioning.ts
 *
 * Capacity-aware seed that fills incoming Grade 7 learners for the batch
 * sectioning algorithm test (SY 2026-2027).
 *
 *   BEC (REGULAR) sections  -> 44 learners each (leaves 1 demo slot, capped at section maxCapacity)
 *   STE sections             -> 69 learners each (leaves 1 demo slot, capped at section maxCapacity)
 *   SCP sections             -> 70 learners each (capped at section maxCapacity)
 *
 * Every learner includes:
 *   - Full demographics (name, sex, birthdate, religion, mother tongue, etc.)
 *   - Parents / guardian (ApplicationFamilyMember: MOTHER, FATHER, GUARDIAN)
 *   - Contact number on the application
 *   - Phil-IRI reading profile level
 *   - Grade 6 general average on both Learner.previousGenAve and
 *     EnrollmentPreviousSchool.generalAverage
 *   - Home address (ApplicationAddress: CURRENT)
 *   - Requirement checklist (ApplicationChecklist)
 *
 * SCP learners additionally get:
 *   - EarlyRegistrationApplication (status: PASSED)
 *   - EarlyRegistrationAssessment with score / result
 *   - EnrollmentProgramDetail (scpType, artField / sportsList)
 *
 * The script also:
 *   - Confirms all Grade 7 PENDING_CONFIRMATION learners -> READY_FOR_SECTIONING
 *   - Back-fills missing Phil-IRI results for those learners
 *
 * Usage:
 *   pnpm --filter server run db:seed-g7-batch-sectioning
 */

import "dotenv/config";
import {
  PrismaClient,
  ApplicationStatus,
  LearnerType,
  Sex,
  FamilyRelationship,
  AddressType,
  ReadingProfileLevel,
  AssessmentKind,
  ApplicantType,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Name / locale pools ───────────────────────────────────────────────────────

const FIRST_MALE = [
  "JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL",
  "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO",
  "FERDINAND", "RODRIGO", "MANUEL", "RAMON", "ELPIDIO", "SERGIO", "DIOSDADO",
];
const FIRST_FEMALE = [
  "MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA",
  "ISABELLA", "LIZA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA",
  "IMELDA", "GLORIA", "LOURDES", "REMEDIOS", "CARMELA", "JOSEFINA", "AURORA",
];
const LAST_NAMES = [
  "DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO",
  "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA", "CRUZ", "PASCUAL",
  "AQUINO", "MAGSAYSAY", "MACAPAGAL", "ROXAS", "QUEZON", "LAUREL", "OSMENA",
];
const MIDDLE_NAMES = [
  "SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO",
  "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG", "DIZON",
];
const CITIES = [
  "QUEZON CITY", "MANILA", "CALOOCAN", "DAVAO CITY", "CEBU CITY",
  "ZAMBOANGA CITY", "ANTIPOLO", "PASIG", "TAGUIG", "VALENZUELA",
  "DASMARINAS", "BACOOR", "IMUS", "LAS PINAS",
];
const BARANGAYS = [
  "BARANGAY 1", "BARANGAY 2", "SAN ISIDRO", "STA. LUCIA", "SANTO NINO",
  "CONCEPCION", "MALANDAY", "POBLACION", "SAN JOSE", "SAN ROQUE",
  "BAGONG SILANG", "LAGING HANDA",
];
const MOTHER_TONGUES = [
  "TAGALOG", "CEBUANO", "ILOCANO", "HILIGAYNON",
  "WARAY", "BIKOL", "KAPAMPANGAN", "PANGASINAN",
];
const OCC_MALE = ["DRIVER", "EMPLOYEE", "CARPENTER", "FARMER", "VENDOR", "SECURITY GUARD"];
const OCC_FEMALE = ["HOUSEWIFE", "EMPLOYEE", "VENDOR", "TEACHER", "NURSE", "CAREGIVER"];
const ELEM_SCHOOLS = [
  "SAN ISIDRO ELEMENTARY SCHOOL",
  "RIZAL ELEMENTARY SCHOOL",
  "BAGONG SILANG ELEMENTARY SCHOOL",
  "SAN JOSE ELEMENTARY SCHOOL",
  "MALANDAY ELEMENTARY SCHOOL",
  "CONCEPCION ELEMENTARY SCHOOL",
];

// Reading level distribution: ~33% INDEPENDENT, ~44% INSTRUCTIONAL, ~17% FRUSTRATION, ~6% NON_READER
const READING_POOL: ReadingProfileLevel[] = [
  "INDEPENDENT", "INDEPENDENT", "INDEPENDENT",
  "INSTRUCTIONAL", "INSTRUCTIONAL", "INSTRUCTIONAL", "INSTRUCTIONAL",
  "FRUSTRATION", "FRUSTRATION",
  "NON_READER",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUtcNoon(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function pick<T>(arr: T[], idx: number): T {
  return arr[Math.abs(idx) % arr.length];
}

/** 12-digit LRN: prefix 7826 + section-index (3 digits) + sequence (5 digits) */
function buildLrn(sIdx: number, seq: number): string {
  return `7826${String(sIdx).padStart(3, "0")}${String(seq).padStart(5, "0")}`;
}

function buildEnrollTracking(prefix: string, sIdx: number, seq: number): string {
  return `G7BS-${prefix}-${String(sIdx).padStart(3, "0")}-${String(seq).padStart(3, "0")}`;
}

function buildEarlyRegTracking(sIdx: number, seq: number): string {
  return `EREG-G7-${String(sIdx).padStart(3, "0")}-${String(seq).padStart(3, "0")}`;
}

function getReadingLevel(idx: number): ReadingProfileLevel {
  return READING_POOL[Math.abs(idx) % READING_POOL.length];
}

function getGenAve(isSCP: boolean, seq: number): number {
  return isSCP ? 88 + (seq % 8) : 82 + (seq % 8); // SCP: 88-95 | BEC: 82-89
}

function getSectionSeedTarget(programType: ApplicantType): number {
  if (programType === "REGULAR") return 44;
  if (programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") return 69;
  return 70;
}

function getProgramPrefix(pt: ApplicantType): string {
  const map: Partial<Record<ApplicantType, string>> = {
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
    SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
    SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  };
  return map[pt] ?? "BEC";
}

function getSCPAssessmentKind(pt: ApplicantType): AssessmentKind {
  if (pt === "SPECIAL_PROGRAM_IN_THE_ARTS") return "TALENT_AUDITION";
  if (pt === "SPECIAL_PROGRAM_IN_SPORTS") return "SPORTS_SKILLS_TRYOUT";
  return "QUALIFYING_EXAMINATION"; // STE and any other
}

function getSCPArtField(pt: ApplicantType, seq: number): string | null {
  if (pt !== "SPECIAL_PROGRAM_IN_THE_ARTS") return null;
  return pick(["VISUAL ARTS", "PERFORMING ARTS", "MUSIC", "DANCE"], seq);
}

function getSCPSports(pt: ApplicantType, seq: number): string[] {
  if (pt !== "SPECIAL_PROGRAM_IN_SPORTS") return [];
  return [pick(["BASKETBALL", "VOLLEYBALL", "SWIMMING", "ATHLETICS", "BADMINTON"], seq)];
}

// ── Per-section learner seeder ────────────────────────────────────────────────

async function seedLearnerForSection(params: {
  sectionProgramType: ApplicantType;
  sectionMaxCapacity: number;
  sIdx: number;
  seq: number;
  yearId: number;
  grade7Id: number;
  adminId: number;
}): Promise<void> {
  const { sectionProgramType, sIdx, seq, yearId, grade7Id, adminId } = params;
  const isSCP = sectionProgramType !== ("REGULAR" as ApplicantType);
  const gIdx = sIdx * 1000 + seq;

  const sex: Sex = seq % 2 === 0 ? "FEMALE" : "MALE";
  const firstName = pick(sex === "MALE" ? FIRST_MALE : FIRST_FEMALE, gIdx);
  const lastName = pick(LAST_NAMES, gIdx + 17);
  const middleName = pick(MIDDLE_NAMES, gIdx + 5);
  const lrn = buildLrn(sIdx, seq);
  const genAve = getGenAve(isSCP, seq);
  const readingLevel = getReadingLevel(seq);

  // Learner -----------------------------------------------------------------
  const learner = await prisma.learner.upsert({
    where: { lrn },
    update: {
      firstName, lastName, middleName, sex,
      previousGenAve: genAve, promotionStatus: "PROMOTED",
      placeOfBirth: pick(CITIES, seq),
      religion: "ROMAN CATHOLIC",
      motherTongue: pick(MOTHER_TONGUES, seq),
      psaBirthCertNumber: `PSA-2025-${lrn}`,
    },
    create: {
      lrn, firstName, lastName, middleName, sex,
      birthdate: toUtcNoon(2013, (seq % 12) + 1, (seq % 27) + 1),
      placeOfBirth: pick(CITIES, seq),
      religion: "ROMAN CATHOLIC",
      motherTongue: pick(MOTHER_TONGUES, seq),
      isIpCommunity: false,
      is4PsBeneficiary: seq % 10 === 0,
      psaBirthCertNumber: `PSA-2025-${lrn}`,
      previousGenAve: genAve,
      promotionStatus: "PROMOTED",
      isPendingLrnCreation: false,
    },
  });

  // Early Registration Application + Assessment (SCP only) ------------------
  let earlyRegId: number | null = null;
  if (isSCP) {
    const erTracking = buildEarlyRegTracking(sIdx, seq);
    const erContact = `0917${String(gIdx + 10000).padStart(7, "0").slice(-7)}`;
    const erApp = await prisma.earlyRegistrationApplication.upsert({
      where: { trackingNumber: erTracking },
      update: { status: "PASSED" as ApplicationStatus },
      create: {
        learnerId: learner.id,
        schoolYearId: yearId,
        gradeLevelId: grade7Id,
        trackingNumber: erTracking,
        applicantType: sectionProgramType,
        learnerType: "NEW_ENROLLEE" as LearnerType,
        status: "PASSED" as ApplicationStatus,
        channel: "F2F",
        contactNumber: erContact,
        isPrivacyConsentGiven: true,
        encodedById: adminId,
        guardianRelationship: "MOTHER",
        reportedGrades: { grade6GeneralAverage: genAve },
      },
    });
    earlyRegId = erApp.id;

    const assessmentKind = getSCPAssessmentKind(sectionProgramType);
    const existingAssessment = await prisma.earlyRegistrationAssessment.findFirst({
      where: { applicationId: erApp.id, type: assessmentKind },
    });
    if (!existingAssessment) {
      await prisma.earlyRegistrationAssessment.create({
        data: {
          applicationId: erApp.id,
          type: assessmentKind,
          scheduledDate: toUtcNoon(2026, 3, 15),
          score: 75 + (seq % 21), // 75-95
          result: "PASSED",
          conductedAt: new Date("2026-03-15T08:00:00Z"),
        },
      });
    }
  }

  // Enrollment Application --------------------------------------------------
  const prefix = getProgramPrefix(sectionProgramType);
  const tracking = buildEnrollTracking(prefix, sIdx, seq);
  const contactNumber = `0922${String(gIdx + 5000).padStart(7, "0").slice(-7)}`;

  const app = await prisma.enrollmentApplication.upsert({
    where: { trackingNumber: tracking },
    update: {
      status: "READY_FOR_SECTIONING" as ApplicationStatus,
      readingProfileLevel: readingLevel,
      readingProfileAssessedAt: new Date("2026-05-27T08:00:00Z"),
      readingProfileAssessedById: adminId,
      contactNumber,
      confirmationConsent: true,
      ...(earlyRegId !== null ? { earlyRegistrationId: earlyRegId } : {}),
    },
    create: {
      learnerId: learner.id,
      schoolYearId: yearId,
      gradeLevelId: grade7Id,
      applicantType: sectionProgramType,
      learnerType: "NEW_ENROLLEE" as LearnerType,
      status: "READY_FOR_SECTIONING" as ApplicationStatus,
      trackingNumber: tracking,
      admissionChannel: "F2F",
      isPrivacyConsentGiven: true,
      encodedById: adminId,
      readingProfileLevel: readingLevel,
      readingProfileAssessedAt: new Date("2026-05-27T08:00:00Z"),
      readingProfileAssessedById: adminId,
      guardianRelationship: "MOTHER",
      contactNumber,
      confirmationConsent: true,
      ...(earlyRegId !== null ? { earlyRegistrationId: earlyRegId } : {}),
    },
  });

  // Family Members ----------------------------------------------------------
  const motherFirst = pick(FIRST_FEMALE, gIdx + 1000);
  const motherLast = pick(LAST_NAMES, gIdx + 1000);
  const fatherFirst = pick(FIRST_MALE, gIdx + 2000);
  const fatherLast = pick(LAST_NAMES, gIdx + 2000);

  const familyRows: {
    relationship: FamilyRelationship;
    firstName: string;
    lastName: string;
    middleName: string;
    contactNumber: string;
    occupation: string;
  }[] = [
    {
      relationship: "MOTHER",
      firstName: motherFirst,
      lastName: motherLast,
      middleName: pick(MIDDLE_NAMES, gIdx + 3000),
      contactNumber: `0922${String(gIdx + 1000).padStart(7, "0").slice(-7)}`,
      occupation: pick(OCC_FEMALE, seq),
    },
    {
      relationship: "FATHER",
      firstName: fatherFirst,
      lastName: fatherLast,
      middleName: pick(MIDDLE_NAMES, gIdx + 4000),
      contactNumber: `0917${String(gIdx + 2000).padStart(7, "0").slice(-7)}`,
      occupation: pick(OCC_MALE, seq),
    },
    {
      relationship: "GUARDIAN",
      firstName: motherFirst,
      lastName: motherLast,
      middleName: pick(MIDDLE_NAMES, gIdx + 5000),
      contactNumber: `0998${String(gIdx + 3000).padStart(7, "0").slice(-7)}`,
      occupation: pick(OCC_FEMALE, seq + 1),
    },
  ];

  for (const fm of familyRows) {
    await prisma.applicationFamilyMember.upsert({
      where: {
        uq_enrollment_family_members_rel: {
          enrollmentId: app.id,
          relationship: fm.relationship,
        },
      },
      update: {},
      create: { enrollmentId: app.id, ...fm },
    });
  }

  // Address -----------------------------------------------------------------
  await prisma.applicationAddress.upsert({
    where: {
      uq_enrollment_addresses_type: {
        enrollmentId: app.id,
        addressType: "CURRENT" as AddressType,
      },
    },
    update: {},
    create: {
      enrollmentId: app.id,
      addressType: "CURRENT" as AddressType,
      houseNoStreet: `${100 + (seq % 900)} Street`,
      barangay: pick(BARANGAYS, seq),
      cityMunicipality: pick(CITIES, seq),
      province: "METRO MANILA",
      zipCode: "1100",
    },
  });

  // Previous School ---------------------------------------------------------
  await prisma.enrollmentPreviousSchool.upsert({
    where: { applicationId: app.id },
    update: { generalAverage: genAve },
    create: {
      applicationId: app.id,
      schoolName: `${pick(ELEM_SCHOOLS, sIdx + seq)} ${sIdx}`,
      gradeCompleted: "Grade 6",
      schoolYearAttended: "2025-2026",
      schoolType: "PUBLIC",
      generalAverage: genAve,
    },
  });

  // Checklist ---------------------------------------------------------------
  const existingChecklist = await prisma.applicationChecklist.findUnique({
    where: { enrollmentId: app.id },
    select: { id: true },
  });
  if (!existingChecklist) {
    await prisma.applicationChecklist.create({
      data: {
        enrollmentId: app.id,
        isPsaBirthCertPresented: true,
        isOriginalPsaBcCollected: false,
        isSf9Submitted: true,
        isGoodMoralPresented: true,
        academicStatus: "PROMOTED",
      },
    });
  }

  // SCP Program Detail ------------------------------------------------------
  if (isSCP) {
    await prisma.enrollmentProgramDetail.upsert({
      where: { applicationId: app.id },
      update: {},
      create: {
        applicationId: app.id,
        scpType: sectionProgramType,
        artField: getSCPArtField(sectionProgramType, seq),
        sportsList: getSCPSports(sectionProgramType, seq),
      },
    });
  }
}

// ── Confirm PENDING_CONFIRMATION -> READY_FOR_SECTIONING ──────────────────────

async function confirmPendingConfirmation(
  yearId: number,
  adminId: number,
): Promise<void> {
  console.log("\n Confirming ALL PENDING_CONFIRMATION learners (all grade levels)...");

  const pending = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: yearId,
      status: "PENDING_CONFIRMATION" as ApplicationStatus,
    },
    select: { id: true, readingProfileLevel: true },
  });

  if (pending.length === 0) {
    console.log("   No PENDING_CONFIRMATION learners found.");
    return;
  }

  let confirmed = 0;
  let philiriAdded = 0;

  for (const app of pending) {
    const data: Record<string, unknown> = {
      status: "READY_FOR_SECTIONING" as ApplicationStatus,
      confirmationConsent: true,
    };
    if (!app.readingProfileLevel) {
      data.readingProfileLevel = getReadingLevel(app.id);
      data.readingProfileAssessedAt = new Date();
      data.readingProfileAssessedById = adminId;
      philiriAdded++;
    }
    await prisma.enrollmentApplication.update({ where: { id: app.id }, data });
    confirmed++;
  }

  console.log(`   Confirmed: ${confirmed} | Phil-IRI back-filled: ${philiriAdded}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Seeding Grade 7 incoming learners for batch sectioning (SY 2026-2027)...\n");

  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });
  const grade7 = await prisma.gradeLevel.findFirst({ where: { name: "Grade 7" } });
  const admin = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });

  if (!targetYear || !grade7 || !admin) {
    throw new Error("Missing SY 2026-2027, Grade 7, or SYSTEM_ADMIN user.");
  }

  const sections = await prisma.section.findMany({
    where: { schoolYearId: targetYear.id, gradeLevelId: grade7.id },
    orderBy: [{ programType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  if (sections.length === 0) {
    throw new Error("No Grade 7 sections found for 2026-2027. Run db:seed-2026-2027 first.");
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sIdx = i + 1;
    const isSCP = section.programType !== ("REGULAR" as ApplicantType);
    const target = getSectionSeedTarget(section.programType as ApplicantType);
    const actualTarget = Math.min(target, section.maxCapacity);
    const prefix = getProgramPrefix(section.programType);

    console.log(
      `Section [${sIdx}/${sections.length}] "${section.name}" ` +
      `(${prefix} | cap: ${section.maxCapacity}) -> seeding ${actualTarget} learners`,
    );

    let sectionCreated = 0;
    let sectionSkipped = 0;

    for (let seq = 1; seq <= actualTarget; seq++) {
      const tracking = buildEnrollTracking(prefix, sIdx, seq);
      const exists = await prisma.enrollmentApplication.findUnique({
        where: { trackingNumber: tracking },
        select: { id: true },
      });
      if (exists) {
        sectionSkipped++;
        totalSkipped++;
        continue;
      }

      await seedLearnerForSection({
        sectionProgramType: section.programType as ApplicantType,
        sectionMaxCapacity: section.maxCapacity,
        sIdx,
        seq,
        yearId: targetYear.id,
        grade7Id: grade7.id,
        adminId: admin.id,
      });
      sectionCreated++;
      totalCreated++;
    }

    console.log(`   -> Created: ${sectionCreated} | Skipped (exists): ${sectionSkipped}`);
  }

  await confirmPendingConfirmation(targetYear.id, admin.id);

  console.log(
    `\nDone! Total created: ${totalCreated} | Total skipped: ${totalSkipped}`,
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