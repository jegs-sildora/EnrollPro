/**
 * Dump generator: Snapshots all SY 2026-2027 data from the live DB.
 * Output: sy-2026-2027-snapshot.json (same directory as this file)
 *
 * Run FIRST to capture the current live state:
 *   pnpm --filter server run db:dump-sy2026
 *
 * ⚠️  IMPORTANT: The snapshot includes hashed passwords and learner PII.
 *    Do NOT commit sy-2026-2027-snapshot.json to a public repository.
 *
 * After generating, use the backfill seed to restore:
 *   pnpm --filter server run db:seed-sy2026
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

async function main() {
  console.log("📦 Dumping SY 2026-2027 data from live DB...\n");

  // ── School Year ──────────────────────────────────────────────────────────
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });
  if (!schoolYear) {
    throw new Error(
      'School year "2026-2027" not found. Ensure the DB is seeded first.',
    );
  }
  console.log(
    `  ✅ School year: ${schoolYear.yearLabel} (id=${schoolYear.id})`,
  );

  // ── Teachers + linked User + Department ──────────────────────────────────
  const teachers = await prisma.teacher.findMany({
    include: {
      department: { select: { code: true } },
      user: {
        select: {
          accountName: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          sex: true,
          role: true,
          designation: true,
          mobileNumber: true,
          email: true,
          password: true,
          isActive: true,
          mustChangePassword: true,
          employeeId: true,
        },
      },
    },
    orderBy: { employeeId: "asc" },
  });
  console.log(`  ✅ Teachers: ${teachers.length}`);

  // ── Sections for SY 2026-2027 ────────────────────────────────────────────
  const sections = await prisma.section.findMany({
    where: { schoolYearId: schoolYear.id },
    include: { gradeLevel: { select: { name: true } } },
    orderBy: [{ gradeLevelId: "asc" }, { sortOrder: "asc" }],
  });
  console.log(`  ✅ Sections: ${sections.length}`);

  // ── Section Advisers for SY 2026-2027 ────────────────────────────────────
  const sectionAdvisers = await prisma.sectionAdviser.findMany({
    where: { schoolYearId: schoolYear.id },
    include: {
      teacher: { select: { employeeId: true } },
      section: { include: { gradeLevel: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  });
  console.log(`  ✅ Section advisers: ${sectionAdvisers.length}`);

  // ── Enrollment Records + Application + Learner for SY 2026-2027 ──────────
  const enrollmentRecords = await prisma.enrollmentRecord.findMany({
    where: { schoolYearId: schoolYear.id },
    include: {
      learner: true,
      section: { include: { gradeLevel: { select: { name: true } } } },
      enrollmentApplication: {
        include: {
          addresses: true,
          familyMembers: true,
          gradeLevel: { select: { name: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });
  console.log(
    `  ✅ Enrollment records (enrolled learners): ${enrollmentRecords.length}`,
  );

  // ── Build Snapshot ────────────────────────────────────────────────────────
  const snapshot = {
    _warning:
      "Contains hashed passwords and learner PII. Do not commit to a public repository.",
    generatedAt: new Date().toISOString(),

    schoolYear: {
      yearLabel: schoolYear.yearLabel,
      status: schoolYear.status,
      classOpeningDate: schoolYear.classOpeningDate?.toISOString() ?? null,
      classEndDate: schoolYear.classEndDate?.toISOString() ?? null,
      earlyRegOpenDate: schoolYear.earlyRegOpenDate?.toISOString() ?? null,
      earlyRegCloseDate: schoolYear.earlyRegCloseDate?.toISOString() ?? null,
      enrollOpenDate: schoolYear.enrollOpenDate?.toISOString() ?? null,
      enrollCloseDate: schoolYear.enrollCloseDate?.toISOString() ?? null,
      portalControl: schoolYear.portalControl,
      requireReadingAssessmentNew: schoolYear.requireReadingAssessmentNew,
      requireReadingAssessmentContinuing:
        schoolYear.requireReadingAssessmentContinuing,
      isEosyFinalized: schoolYear.isEosyFinalized,
      sectionShiftWindowDays: schoolYear.sectionShiftWindowDays ?? null,
      sectioningConfig: schoolYear.sectioningConfig ?? null,
    },

    teachers: teachers.map((t) => ({
      employeeId: t.employeeId,
      firstName: t.firstName,
      lastName: t.lastName,
      middleName: t.middleName ?? null,
      sex: t.sex,
      email: t.email,
      contactNumber: t.contactNumber ?? null,
      specialization: t.specialization ?? null,
      isActive: t.isActive,
      plantillaPosition: t.plantillaPosition ?? null,
      designation: t.designation ?? null,
      departmentCode: t.department?.code ?? null,
      user: t.user
        ? {
            accountName: t.user.accountName ?? null,
            firstName: t.user.firstName,
            lastName: t.user.lastName,
            middleName: t.user.middleName ?? null,
            suffix: t.user.suffix ?? null,
            sex: t.user.sex,
            role: t.user.role,
            designation: t.user.designation ?? null,
            mobileNumber: t.user.mobileNumber ?? null,
            email: t.user.email ?? null,
            password: t.user.password,
            isActive: t.user.isActive,
            mustChangePassword: t.user.mustChangePassword,
            employeeId: t.user.employeeId ?? null,
          }
        : null,
    })),

    sections: sections.map((s) => ({
      name: s.name,
      gradeLevelName: s.gradeLevel.name,
      programType: s.programType,
      maxCapacity: s.maxCapacity,
      sortOrder: s.sortOrder,
      sectionRank: s.sectionRank ?? null,
      isHomogeneous: s.isHomogeneous,
      isSnake: s.isSnake,
    })),

    sectionAdvisers: sectionAdvisers.map((sa) => ({
      sectionName: sa.section.name,
      gradeLevelName: sa.section.gradeLevel.name,
      programType: sa.section.programType,
      teacherEmployeeId: sa.teacher.employeeId,
      effectiveFrom: sa.effectiveFrom.toISOString(),
      effectiveTo: sa.effectiveTo?.toISOString() ?? null,
      status: sa.status,
    })),

    enrollmentRecords: enrollmentRecords.map((er) => ({
      sectionName: er.section.name,
      gradeLevelName: er.section.gradeLevel.name,
      sectionProgramType: er.section.programType,
      enrolledAt: er.enrolledAt.toISOString(),
      sectioningMethod: er.sectioningMethod,
      dropOutReason: er.dropOutReason ?? null,
      dropOutDate: er.dropOutDate?.toISOString() ?? null,
      eosyStatus: er.eosyStatus ?? null,
      sf1Remarks: er.sf1Remarks ?? null,
      finalAverage: er.finalAverage ?? null,
      dateSectioned: er.dateSectioned?.toISOString() ?? null,
      contactNumber: er.contactNumber ?? null,
      guardianName: er.guardianName ?? null,
      transferOutDate: er.transferOutDate?.toISOString() ?? null,
      transferOutSchoolName: er.transferOutSchoolName ?? null,
      transferOutReason: er.transferOutReason ?? null,
      confirmationConsent: er.confirmationConsent ?? null,
      intakeMethod: er.intakeMethod ?? null,

      learner: {
        lrn: er.learner.lrn ?? null,
        externalId: er.learner.externalId,
        firstName: er.learner.firstName,
        lastName: er.learner.lastName,
        middleName: er.learner.middleName ?? null,
        extensionName: er.learner.extensionName ?? null,
        birthdate: er.learner.birthdate.toISOString(),
        sex: er.learner.sex,
        placeOfBirth: er.learner.placeOfBirth ?? null,
        religion: er.learner.religion ?? null,
        motherTongue: er.learner.motherTongue ?? null,
        isIpCommunity: er.learner.isIpCommunity,
        ipGroupName: er.learner.ipGroupName ?? null,
        isLearnerWithDisability: er.learner.isLearnerWithDisability,
        disabilityTypes: er.learner.disabilityTypes,
        is4PsBeneficiary: er.learner.is4PsBeneficiary,
        householdId4Ps: er.learner.householdId4Ps ?? null,
        hasPwdId: er.learner.hasPwdId,
        isBalikAral: er.learner.isBalikAral,
        lastGradeLevel: er.learner.lastGradeLevel ?? null,
        lastYearEnrolled: er.learner.lastYearEnrolled ?? null,
        psaBirthCertNumber: er.learner.psaBirthCertNumber ?? null,
        specialNeedsCategory: er.learner.specialNeedsCategory ?? null,
        snedPlacement: er.learner.snedPlacement ?? null,
        isPendingLrnCreation: er.learner.isPendingLrnCreation,
        hasPsaBirthCertificate: er.learner.hasPsaBirthCertificate,
        birthCertificateType: er.learner.birthCertificateType ?? null,
        birthCertificateVerifiedBy:
          er.learner.birthCertificateVerifiedBy ?? null,
        birthCertificateVerifiedDate:
          er.learner.birthCertificateVerifiedDate?.toISOString() ?? null,
        previousGenAve: er.learner.previousGenAve ?? null,
        promotionStatus: er.learner.promotionStatus ?? null,
        status: er.learner.status,
      },

      application: {
        trackingNumber: er.enrollmentApplication.trackingNumber ?? null,
        status: er.enrollmentApplication.status,
        gradeLevelName: er.enrollmentApplication.gradeLevel.name,
        applicantType: er.enrollmentApplication.applicantType,
        learnerType: er.enrollmentApplication.learnerType,
        admissionChannel: er.enrollmentApplication.admissionChannel,
        learningModalities: er.enrollmentApplication.learningModalities,
        isTemporarilyEnrolled: er.enrollmentApplication.isTemporarilyEnrolled,
        isPrivacyConsentGiven: er.enrollmentApplication.isPrivacyConsentGiven,
        contactNumber: er.enrollmentApplication.contactNumber ?? null,
        guardianName: er.enrollmentApplication.guardianName ?? null,
        guardianRelationship:
          er.enrollmentApplication.guardianRelationship ?? null,
        hasNoFather: er.enrollmentApplication.hasNoFather,
        hasNoMother: er.enrollmentApplication.hasNoMother,
        readingProfileLevel:
          er.enrollmentApplication.readingProfileLevel ?? null,
        isProfileLocked: er.enrollmentApplication.isProfileLocked,
        intakeMethod: er.enrollmentApplication.intakeMethod,
        originatingSchoolName:
          er.enrollmentApplication.originatingSchoolName ?? null,
        hasSf9CertificationLetter:
          er.enrollmentApplication.hasSf9CertificationLetter,
        hasUnsettledPrivateAccount:
          er.enrollmentApplication.hasUnsettledPrivateAccount,
        isMissingSf9: er.enrollmentApplication.isMissingSf9,
        reportedGrades: er.enrollmentApplication.reportedGrades ?? null,
        batchIntakeMethod: er.enrollmentApplication.batchIntakeMethod ?? null,
        confirmationConsent:
          er.enrollmentApplication.confirmationConsent ?? null,
        intakeHeightCm: er.enrollmentApplication.intakeHeightCm ?? null,
        intakeWeightKg: er.enrollmentApplication.intakeWeightKg ?? null,
        temporaryStatusDeadline:
          er.enrollmentApplication.temporaryStatusDeadline?.toISOString() ??
          null,
        documentaryDeadlineAt:
          er.enrollmentApplication.documentaryDeadlineAt?.toISOString() ?? null,
        complianceStatus: er.enrollmentApplication.complianceStatus ?? null,
        rejectionReason: er.enrollmentApplication.rejectionReason ?? null,

        addresses: er.enrollmentApplication.addresses.map((a) => ({
          addressType: a.addressType,
          houseNoStreet: a.houseNoStreet ?? null,
          street: a.street ?? null,
          sitio: a.sitio ?? null,
          barangay: a.barangay ?? null,
          cityMunicipality: a.cityMunicipality ?? null,
          province: a.province ?? null,
          country: a.country ?? "PHILIPPINES",
          zipCode: a.zipCode ?? null,
        })),

        familyMembers: er.enrollmentApplication.familyMembers.map((f) => ({
          relationship: f.relationship,
          firstName: f.firstName,
          lastName: f.lastName,
          middleName: f.middleName ?? null,
          contactNumber: f.contactNumber ?? null,
          email: f.email ?? null,
          occupation: f.occupation ?? null,
          maidenName: f.maidenName ?? null,
        })),
      },
    })),
  };

  const outputPath = path.join(__dirname, "sy-2026-2027-snapshot.json");
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf8");

  const fileSizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);

  console.log(
    `\n📁 Snapshot saved → sy-2026-2027-snapshot.json (${fileSizeMB} MB)`,
  );
  console.log(`\n📊 Totals:`);
  console.log(`   Teachers            : ${snapshot.teachers.length}`);
  console.log(
    `   Teacher w/ User     : ${snapshot.teachers.filter((t) => t.user).length}`,
  );
  console.log(`   Sections            : ${snapshot.sections.length}`);
  console.log(`   Section advisers    : ${snapshot.sectionAdvisers.length}`);
  console.log(`   Enrolled learners   : ${snapshot.enrollmentRecords.length}`);
  console.log(`\nNext: pnpm --filter server run db:seed-sy2026`);
}

main()
  .catch((e) => {
    console.error("\n❌ Dump failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await dbPool.end();
  });
