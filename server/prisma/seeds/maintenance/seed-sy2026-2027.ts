/**
 * Backfill seed: Restores all SY 2026-2027 data from sy-2026-2027-snapshot.json.
 *
 * Prerequisite: Run the dump generator first to create the snapshot:
 *   pnpm --filter server run db:dump-sy2026
 *
 * Then run this backfill on the target DB:
 *   pnpm --filter server run db:seed-sy2026
 *
 * Idempotency guarantees:
 *   - Teachers       → skip if employeeId already exists
 *   - Teacher Users  → skip if accountName or employeeId already exists
 *   - Sections       → skip if (name, gradeLevelId, schoolYearId) already exists
 *   - SectionAdvisers→ skip if an ACTIVE adviser for that section+teacher+SY exists
 *   - Learners       → skip if LRN (or externalId for no-LRN) already exists
 *   - Applications   → skip if (learnerId, schoolYearId) already exists
 *   - Addresses      → upsert by (enrollmentId, addressType)
 *   - FamilyMembers  → upsert by (enrollmentId, relationship)
 *   - EnrollmentRec  → skip if (enrollmentApplicationId) already exists
 */

import "dotenv/config";
import { PrismaClient } from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(dbPool);
const prisma = new PrismaClient({ adapter });

// ── Snapshot types ────────────────────────────────────────────────────────────

interface SnapshotTeacherUser {
  accountName: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  sex: string;
  role: string;
  designation: string | null;
  mobileNumber: string | null;
  email: string | null;
  password: string;
  isActive: boolean;
  mustChangePassword: boolean;
  employeeId: string | null;
}

interface SnapshotTeacher {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  email: string;
  contactNumber: string | null;
  specialization: string | null;
  isActive: boolean;
  plantillaPosition: string | null;
  designation: string | null;
  departmentCode: string | null;
  user: SnapshotTeacherUser | null;
}

interface SnapshotSection {
  name: string;
  gradeLevelName: string;
  programType: string;
  maxCapacity: number;
  sortOrder: number;
  sectionRank: number | null;
  isHomogeneous: boolean;
  isSnake: boolean;
}

interface SnapshotSectionAdviser {
  sectionName: string;
  gradeLevelName: string;
  programType: string;
  teacherEmployeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}

interface SnapshotLearner {
  lrn: string | null;
  externalId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  extensionName: string | null;
  birthdate: string;
  sex: string;
  placeOfBirth: string | null;
  religion: string | null;
  motherTongue: string | null;
  isIpCommunity: boolean;
  ipGroupName: string | null;
  isLearnerWithDisability: boolean;
  disabilityTypes: string[];
  is4PsBeneficiary: boolean;
  householdId4Ps: string | null;
  hasPwdId: boolean;
  isBalikAral: boolean;
  lastGradeLevel: string | null;
  lastYearEnrolled: string | null;
  psaBirthCertNumber: string | null;
  specialNeedsCategory: string | null;
  snedPlacement: string | null;
  isPendingLrnCreation: boolean;
  hasPsaBirthCertificate: boolean;
  birthCertificateType: string | null;
  birthCertificateVerifiedBy: string | null;
  birthCertificateVerifiedDate: string | null;
  previousGenAve: number | null;
  promotionStatus: string | null;
  status: string;
}

interface SnapshotAddress {
  addressType: string;
  houseNoStreet: string | null;
  street: string | null;
  sitio: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  country: string | null;
  zipCode: string | null;
}

interface SnapshotFamilyMember {
  relationship: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  contactNumber: string | null;
  email: string | null;
  occupation: string | null;
  maidenName: string | null;
}

interface SnapshotApplication {
  trackingNumber: string | null;
  status: string;
  gradeLevelName: string;
  applicantType: string;
  learnerType: string;
  admissionChannel: string;
  learningModalities: string[];
  isTemporarilyEnrolled: boolean;
  isPrivacyConsentGiven: boolean;
  contactNumber: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  hasNoFather: boolean;
  hasNoMother: boolean;
  readingProfileLevel: string | null;
  isProfileLocked: boolean;
  intakeMethod: string;
  originatingSchoolName: string | null;
  hasSf9CertificationLetter: boolean;
  hasUnsettledPrivateAccount: boolean;
  isMissingSf9: boolean;
  reportedGrades: unknown | null;
  batchIntakeMethod: string | null;
  confirmationConsent: boolean | null;
  intakeHeightCm: number | null;
  intakeWeightKg: number | null;
  temporaryStatusDeadline: string | null;
  documentaryDeadlineAt: string | null;
  complianceStatus: string | null;
  rejectionReason: string | null;
  addresses: SnapshotAddress[];
  familyMembers: SnapshotFamilyMember[];
}

interface SnapshotEnrollmentRecord {
  sectionName: string;
  gradeLevelName: string;
  sectionProgramType: string;
  enrolledAt: string;
  sectioningMethod: string;
  dropOutReason: string | null;
  dropOutDate: string | null;
  eosyStatus: string | null;
  sf1Remarks: string | null;
  finalAverage: number | null;
  dateSectioned: string | null;
  contactNumber: string | null;
  guardianName: string | null;
  transferOutDate: string | null;
  transferOutSchoolName: string | null;
  transferOutReason: string | null;
  confirmationConsent: boolean | null;
  intakeMethod: string | null;
  learner: SnapshotLearner;
  application: SnapshotApplication;
}

interface Snapshot {
  generatedAt: string;
  schoolYear: {
    yearLabel: string;
    status: string;
    classOpeningDate: string | null;
    classEndDate: string | null;
    earlyRegOpenDate: string | null;
    earlyRegCloseDate: string | null;
    enrollOpenDate: string | null;
    enrollCloseDate: string | null;
    portalControl: string;
    requireReadingAssessmentNew: boolean;
    requireReadingAssessmentContinuing: boolean;
    isEosyFinalized: boolean;
    sectionShiftWindowDays: number | null;
    sectioningConfig: unknown | null;
  };
  teachers: SnapshotTeacher[];
  sections: SnapshotSection[];
  sectionAdvisers: SnapshotSectionAdviser[];
  enrollmentRecords: SnapshotEnrollmentRecord[];
}

// ── Counter helper ────────────────────────────────────────────────────────────

function counter() {
  let created = 0;
  let skipped = 0;
  return {
    inc: () => created++,
    skip: () => skipped++,
    summary: (label: string) =>
      console.log(
        `   ${label.padEnd(22)}: ${created} created, ${skipped} skipped`,
      ),
  };
}

// ── Step 1: Teachers + linked Users ──────────────────────────────────────────

async function seedTeachers(
  snapshot: Snapshot,
  deptMap: Record<string, number>,
): Promise<Record<string, number>> {
  const teacherIdByEmployeeId: Record<string, number> = {};
  const tc = counter();
  const uc = counter();

  for (const t of snapshot.teachers) {
    // -- Teacher User --
    let userId: number | null = null;
    if (t.user) {
      const lookupClauses = [];
      if (t.user.accountName)
        lookupClauses.push({ accountName: t.user.accountName });
      if (t.user.employeeId)
        lookupClauses.push({ employeeId: t.user.employeeId });

      const existingUser =
        lookupClauses.length > 0
          ? await prisma.user.findFirst({ where: { OR: lookupClauses } })
          : null;

      if (existingUser) {
        userId = existingUser.id;
        uc.skip();
      } else {
        const newUser = await prisma.user.create({
          data: {
            accountName: t.user.accountName ?? undefined,
            firstName: t.user.firstName,
            lastName: t.user.lastName,
            middleName: t.user.middleName ?? undefined,
            suffix: t.user.suffix ?? undefined,
            sex: t.user.sex as never,
            role: t.user.role as never,
            designation: t.user.designation ?? undefined,
            mobileNumber: t.user.mobileNumber ?? undefined,
            email: t.user.email ?? undefined,
            password: t.user.password,
            isActive: t.user.isActive,
            mustChangePassword: t.user.mustChangePassword,
            employeeId: t.user.employeeId ?? undefined,
          },
        });
        userId = newUser.id;
        uc.inc();
      }
    }

    // -- Teacher --
    const existingTeacher = await prisma.teacher.findUnique({
      where: { employeeId: t.employeeId },
    });

    if (existingTeacher) {
      // Link userId if not yet linked
      if (!existingTeacher.userId && userId) {
        await prisma.teacher.update({
          where: { id: existingTeacher.id },
          data: { userId },
        });
      }
      teacherIdByEmployeeId[t.employeeId] = existingTeacher.id;
      tc.skip();
    } else {
      const newTeacher = await prisma.teacher.create({
        data: {
          employeeId: t.employeeId,
          firstName: t.firstName,
          lastName: t.lastName,
          middleName: t.middleName ?? undefined,
          sex: t.sex as never,
          email: t.email,
          contactNumber: t.contactNumber ?? undefined,
          specialization: t.specialization ?? undefined,
          isActive: t.isActive,
          plantillaPosition: t.plantillaPosition ?? undefined,
          designation: t.designation ?? undefined,
          departmentId: t.departmentCode
            ? (deptMap[t.departmentCode] ?? undefined)
            : undefined,
          userId: userId ?? undefined,
        },
      });
      teacherIdByEmployeeId[t.employeeId] = newTeacher.id;
      tc.inc();
    }
  }

  tc.summary("Teachers");
  uc.summary("Teacher users");
  return teacherIdByEmployeeId;
}

// ── Step 2: Sections ──────────────────────────────────────────────────────────

async function seedSections(
  snapshot: Snapshot,
  schoolYearId: number,
  gradeLevelMap: Record<string, number>,
): Promise<Record<string, number>> {
  // Key: "sectionName|gradeLevelName|programType"
  const sectionIdByKey: Record<string, number> = {};
  const c = counter();

  for (const s of snapshot.sections) {
    const gradeLevelId = gradeLevelMap[s.gradeLevelName];
    if (!gradeLevelId) {
      console.warn(
        `   ⚠️  GradeLevel "${s.gradeLevelName}" not found — skipping section "${s.name}"`,
      );
      continue;
    }

    const key = `${s.name}|${s.gradeLevelName}|${s.programType}`;
    const existing = await prisma.section.findUnique({
      where: {
        uq_sections_name_grade_sy: { name: s.name, gradeLevelId, schoolYearId },
      },
    });

    if (existing) {
      sectionIdByKey[key] = existing.id;
      c.skip();
    } else {
      const created = await prisma.section.create({
        data: {
          name: s.name,
          gradeLevelId,
          schoolYearId,
          programType: s.programType as never,
          maxCapacity: s.maxCapacity,
          sortOrder: s.sortOrder,
          sectionRank: s.sectionRank ?? undefined,
          isHomogeneous: s.isHomogeneous,
          isSnake: s.isSnake,
        },
      });
      sectionIdByKey[key] = created.id;
      c.inc();
    }
  }

  c.summary("Sections");
  return sectionIdByKey;
}

// ── Step 3: Section Advisers ──────────────────────────────────────────────────

async function seedSectionAdvisers(
  snapshot: Snapshot,
  schoolYearId: number,
  sectionIdByKey: Record<string, number>,
  teacherIdByEmployeeId: Record<string, number>,
): Promise<void> {
  const c = counter();

  for (const sa of snapshot.sectionAdvisers) {
    const sectionKey = `${sa.sectionName}|${sa.gradeLevelName}|${sa.programType}`;
    const sectionId = sectionIdByKey[sectionKey];
    const teacherId = teacherIdByEmployeeId[sa.teacherEmployeeId];

    if (!sectionId) {
      console.warn(
        `   ⚠️  Section "${sa.sectionName}" not found — skipping adviser`,
      );
      continue;
    }
    if (!teacherId) {
      console.warn(
        `   ⚠️  Teacher "${sa.teacherEmployeeId}" not found — skipping adviser`,
      );
      continue;
    }

    const existing = await prisma.sectionAdviser.findFirst({
      where: { sectionId, teacherId, schoolYearId, status: sa.status as never },
    });

    if (existing) {
      c.skip();
    } else {
      await prisma.sectionAdviser.create({
        data: {
          sectionId,
          teacherId,
          schoolYearId,
          effectiveFrom: new Date(sa.effectiveFrom),
          effectiveTo: sa.effectiveTo ? new Date(sa.effectiveTo) : undefined,
          status: sa.status as never,
        },
      });
      c.inc();
    }
  }

  c.summary("Section advisers");
}

// ── Step 4: Learners ──────────────────────────────────────────────────────────

async function seedLearners(
  snapshot: Snapshot,
): Promise<Record<string, number>> {
  // Key: externalId (always unique); resolve to DB learner id
  const learnerIdByExternal: Record<string, number> = {};
  const c = counter();

  for (const rec of snapshot.enrollmentRecords) {
    const l = rec.learner;

    // Look up by LRN first, then by externalId
    const existing = await prisma.learner.findFirst({
      where: {
        OR: [...(l.lrn ? [{ lrn: l.lrn }] : []), { externalId: l.externalId }],
      },
    });

    if (existing) {
      learnerIdByExternal[l.externalId] = existing.id;
      c.skip();
    } else {
      const created = await prisma.learner.create({
        data: {
          lrn: l.lrn ?? undefined,
          externalId: l.externalId,
          firstName: l.firstName,
          lastName: l.lastName,
          middleName: l.middleName ?? undefined,
          extensionName: l.extensionName ?? undefined,
          birthdate: new Date(l.birthdate),
          sex: l.sex as never,
          placeOfBirth: l.placeOfBirth ?? undefined,
          religion: l.religion ?? undefined,
          motherTongue: l.motherTongue ?? undefined,
          isIpCommunity: l.isIpCommunity,
          ipGroupName: l.ipGroupName ?? undefined,
          isLearnerWithDisability: l.isLearnerWithDisability,
          disabilityTypes: l.disabilityTypes,
          is4PsBeneficiary: l.is4PsBeneficiary,
          householdId4Ps: l.householdId4Ps ?? undefined,
          hasPwdId: l.hasPwdId,
          isBalikAral: l.isBalikAral,
          lastGradeLevel: l.lastGradeLevel ?? undefined,
          lastYearEnrolled: l.lastYearEnrolled ?? undefined,
          psaBirthCertNumber: l.psaBirthCertNumber ?? undefined,
          specialNeedsCategory: l.specialNeedsCategory ?? undefined,
          snedPlacement: l.snedPlacement ?? undefined,
          isPendingLrnCreation: l.isPendingLrnCreation,
          hasPsaBirthCertificate: l.hasPsaBirthCertificate,
          birthCertificateType: l.birthCertificateType ?? undefined,
          birthCertificateVerifiedBy: l.birthCertificateVerifiedBy ?? undefined,
          birthCertificateVerifiedDate: l.birthCertificateVerifiedDate
            ? new Date(l.birthCertificateVerifiedDate)
            : undefined,
          previousGenAve: l.previousGenAve ?? undefined,
          promotionStatus: l.promotionStatus ?? undefined,
          status: l.status as never,
        },
      });
      learnerIdByExternal[l.externalId] = created.id;
      c.inc();
    }
  }

  c.summary("Learners");
  return learnerIdByExternal;
}

// ── Step 5: Enrollment Applications + Addresses + Family Members ──────────────

async function seedEnrollmentApplications(
  snapshot: Snapshot,
  schoolYearId: number,
  gradeLevelMap: Record<string, number>,
  learnerIdByExternal: Record<string, number>,
): Promise<Record<string, number>> {
  // Key: externalId → enrollmentApplicationId
  const appIdByExternal: Record<string, number> = {};
  const appC = counter();
  const addrC = counter();
  const famC = counter();

  for (const rec of snapshot.enrollmentRecords) {
    const learnerId = learnerIdByExternal[rec.learner.externalId];
    if (!learnerId) continue;

    const gradeLevelId = gradeLevelMap[rec.application.gradeLevelName];
    if (!gradeLevelId) {
      console.warn(
        `   ⚠️  GradeLevel "${rec.application.gradeLevelName}" not found — skipping application`,
      );
      continue;
    }

    // Idempotency: one application per learner per school year
    const existing = await prisma.enrollmentApplication.findFirst({
      where: { learnerId, schoolYearId },
    });

    let appId: number;

    if (existing) {
      appId = existing.id;
      appC.skip();
    } else {
      const app = await prisma.enrollmentApplication.create({
        data: {
          learnerId,
          schoolYearId,
          gradeLevelId,
          applicantType: rec.application.applicantType as never,
          learnerType: rec.application.learnerType as never,
          status: rec.application.status as never,
          admissionChannel: rec.application.admissionChannel as never,
          trackingNumber: rec.application.trackingNumber ?? undefined,
          learningModalities: rec.application.learningModalities,
          isTemporarilyEnrolled: rec.application.isTemporarilyEnrolled,
          isPrivacyConsentGiven: rec.application.isPrivacyConsentGiven,
          contactNumber: rec.application.contactNumber ?? undefined,
          guardianName: rec.application.guardianName ?? undefined,
          guardianRelationship:
            rec.application.guardianRelationship ?? undefined,
          hasNoFather: rec.application.hasNoFather,
          hasNoMother: rec.application.hasNoMother,
          readingProfileLevel: rec.application.readingProfileLevel as never,
          isProfileLocked: rec.application.isProfileLocked,
          intakeMethod: rec.application.intakeMethod as never,
          originatingSchoolName:
            rec.application.originatingSchoolName ?? undefined,
          hasSf9CertificationLetter: rec.application.hasSf9CertificationLetter,
          hasUnsettledPrivateAccount:
            rec.application.hasUnsettledPrivateAccount,
          isMissingSf9: rec.application.isMissingSf9,
          reportedGrades: rec.application.reportedGrades ?? undefined,
          batchIntakeMethod: rec.application.batchIntakeMethod ?? undefined,
          confirmationConsent: rec.application.confirmationConsent ?? undefined,
          intakeHeightCm: rec.application.intakeHeightCm ?? undefined,
          intakeWeightKg: rec.application.intakeWeightKg ?? undefined,
          temporaryStatusDeadline: rec.application.temporaryStatusDeadline
            ? new Date(rec.application.temporaryStatusDeadline)
            : undefined,
          documentaryDeadlineAt: rec.application.documentaryDeadlineAt
            ? new Date(rec.application.documentaryDeadlineAt)
            : undefined,
          complianceStatus: rec.application.complianceStatus as never,
          rejectionReason: rec.application.rejectionReason ?? undefined,
        },
      });
      appId = app.id;
      appC.inc();
    }

    appIdByExternal[rec.learner.externalId] = appId;

    // -- Addresses --
    for (const addr of rec.application.addresses) {
      const existingAddr = await prisma.applicationAddress.findUnique({
        where: {
          uq_enrollment_addresses_type: {
            enrollmentId: appId,
            addressType: addr.addressType as never,
          },
        },
      });

      if (existingAddr) {
        addrC.skip();
      } else {
        await prisma.applicationAddress.create({
          data: {
            enrollmentId: appId,
            addressType: addr.addressType as never,
            houseNoStreet: addr.houseNoStreet ?? undefined,
            street: addr.street ?? undefined,
            sitio: addr.sitio ?? undefined,
            barangay: addr.barangay ?? undefined,
            cityMunicipality: addr.cityMunicipality ?? undefined,
            province: addr.province ?? undefined,
            country: addr.country ?? "PHILIPPINES",
            zipCode: addr.zipCode ?? undefined,
          },
        });
        addrC.inc();
      }
    }

    // -- Family Members --
    for (const fm of rec.application.familyMembers) {
      const existingFm = await prisma.applicationFamilyMember.findUnique({
        where: {
          uq_enrollment_family_members_rel: {
            enrollmentId: appId,
            relationship: fm.relationship as never,
          },
        },
      });

      if (existingFm) {
        famC.skip();
      } else {
        await prisma.applicationFamilyMember.create({
          data: {
            enrollmentId: appId,
            relationship: fm.relationship as never,
            firstName: fm.firstName,
            lastName: fm.lastName,
            middleName: fm.middleName ?? undefined,
            contactNumber: fm.contactNumber ?? undefined,
            email: fm.email ?? undefined,
            occupation: fm.occupation ?? undefined,
            maidenName: fm.maidenName ?? undefined,
          },
        });
        famC.inc();
      }
    }
  }

  appC.summary("Applications");
  addrC.summary("Addresses");
  famC.summary("Family members");
  return appIdByExternal;
}

// ── Step 6: Enrollment Records ────────────────────────────────────────────────

async function seedEnrollmentRecords(
  snapshot: Snapshot,
  schoolYearId: number,
  sectionIdByKey: Record<string, number>,
  learnerIdByExternal: Record<string, number>,
  appIdByExternal: Record<string, number>,
  fallbackUserId: number,
): Promise<void> {
  const c = counter();

  for (const rec of snapshot.enrollmentRecords) {
    const appId = appIdByExternal[rec.learner.externalId];
    const learnerId = learnerIdByExternal[rec.learner.externalId];
    const sectionKey = `${rec.sectionName}|${rec.gradeLevelName}|${rec.sectionProgramType}`;
    const sectionId = sectionIdByKey[sectionKey];

    if (!appId || !learnerId || !sectionId) {
      console.warn(
        `   ⚠️  Missing references for learner externalId=${rec.learner.externalId} — skipping enrollment record`,
      );
      continue;
    }

    const existing = await prisma.enrollmentRecord.findUnique({
      where: { enrollmentApplicationId: appId },
    });

    if (existing) {
      c.skip();
    } else {
      await prisma.enrollmentRecord.create({
        data: {
          enrollmentApplicationId: appId,
          learnerId,
          sectionId,
          schoolYearId,
          enrolledAt: new Date(rec.enrolledAt),
          enrolledById: fallbackUserId,
          sectioningMethod: rec.sectioningMethod as never,
          dropOutReason: rec.dropOutReason ?? undefined,
          dropOutDate: rec.dropOutDate ? new Date(rec.dropOutDate) : undefined,
          eosyStatus: rec.eosyStatus as never,
          sf1Remarks: rec.sf1Remarks ?? undefined,
          finalAverage: rec.finalAverage ?? undefined,
          dateSectioned: rec.dateSectioned
            ? new Date(rec.dateSectioned)
            : undefined,
          contactNumber: rec.contactNumber ?? undefined,
          guardianName: rec.guardianName ?? undefined,
          transferOutDate: rec.transferOutDate
            ? new Date(rec.transferOutDate)
            : undefined,
          transferOutSchoolName: rec.transferOutSchoolName ?? undefined,
          transferOutReason: rec.transferOutReason ?? undefined,
          confirmationConsent: rec.confirmationConsent ?? undefined,
          intakeMethod: rec.intakeMethod ?? undefined,
        },
      });
      c.inc();
    }
  }

  c.summary("Enrollment records");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const snapshotPath = path.join(__dirname, "sy-2026-2027-snapshot.json");
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(
      `Snapshot file not found: ${snapshotPath}\nRun first: pnpm --filter server run db:dump-sy2026`,
    );
  }

  const snapshot: Snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  console.log(
    `\n🌱 Seeding SY 2026-2027 from snapshot (generated: ${snapshot.generatedAt})\n`,
  );

  // ── Resolve SchoolYear ────────────────────────────────────────────────────
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: snapshot.schoolYear.yearLabel },
  });
  if (!schoolYear) {
    throw new Error(
      `School year "${snapshot.schoolYear.yearLabel}" not found in target DB.\n` +
        "Ensure the target DB has been initialised with the main seed scripts first.",
    );
  }
  console.log(`  School year : ${schoolYear.yearLabel} (id=${schoolYear.id})`);

  // ── Resolve Departments ───────────────────────────────────────────────────
  const departments = await prisma.department.findMany();
  const deptMap: Record<string, number> = {};
  for (const d of departments) deptMap[d.code] = d.id;
  console.log(`  Departments : ${departments.length} found`);

  // ── Resolve Grade Levels ──────────────────────────────────────────────────
  const gradeLevels = await prisma.gradeLevel.findMany();
  const gradeLevelMap: Record<string, number> = {};
  for (const g of gradeLevels) gradeLevelMap[g.name] = g.id;
  console.log(`  Grade levels: ${gradeLevels.length} found`);

  // ── Fallback User for enrolledById (required, non-nullable) ──────────────
  const fallbackUser = await prisma.user.findFirst({
    where: { role: { in: ["REGISTRAR" as never, "SYSTEM_ADMIN" as never] } },
    orderBy: { id: "asc" },
  });
  if (!fallbackUser) {
    throw new Error(
      "No REGISTRAR or SYSTEM_ADMIN user found. Seed user accounts first.",
    );
  }
  console.log(
    `  Fallback user: ${fallbackUser.firstName} ${fallbackUser.lastName} (id=${fallbackUser.id})\n`,
  );

  console.log(
    "── Seeding ─────────────────────────────────────────────────────\n",
  );

  // ── Run all steps ─────────────────────────────────────────────────────────
  const teacherIdByEmployeeId = await seedTeachers(snapshot, deptMap);

  const sectionIdByKey = await seedSections(
    snapshot,
    schoolYear.id,
    gradeLevelMap,
  );

  await seedSectionAdvisers(
    snapshot,
    schoolYear.id,
    sectionIdByKey,
    teacherIdByEmployeeId,
  );

  const learnerIdByExternal = await seedLearners(snapshot);

  const appIdByExternal = await seedEnrollmentApplications(
    snapshot,
    schoolYear.id,
    gradeLevelMap,
    learnerIdByExternal,
  );

  await seedEnrollmentRecords(
    snapshot,
    schoolYear.id,
    sectionIdByKey,
    learnerIdByExternal,
    appIdByExternal,
    fallbackUser.id,
  );

  console.log("\n✅ SY 2026-2027 backfill complete.");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await dbPool.end();
  });
