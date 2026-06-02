/**
 * Rollover Audit Integration Test Suite
 *
 * Verifies that the School Year Rollover function honours the 5 Golden Rules
 * mandated by DepEd for the EOSY → BOSY transition.
 *
 * Run with:
 *   pnpm --filter server exec tsx src/tests/rollover.audit.test.ts
 *
 * Requires a live DATABASE_URL and the server to compile successfully.
 * All created records are cleaned up in the finally block.
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import jwt from "jsonwebtoken";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SchoolSettingSnapshot = {
  id: number;
  previousActiveSchoolYearId: number | null;
  created: boolean;
};

type ApiResult = {
  status: number;
  body: unknown;
};

type RolloverResponseBody = {
  year: { id: number; yearLabel: string };
  rolloverFrom: { id: number; yearLabel: string };
  rolloverSummary: {
    processedRecords: number;
    createdApplications: number;
    skippedByEosyOutcome: number;
    skippedIrregular: number;
    skippedNoTargetGrade: number;
    skippedExistingApplications: number;
    skippedDuplicateRecords: number;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Generates a valid 12-digit numeric LRN unique per test invocation index. */
function makeLrn(index: number): string {
  return String(Date.now() + index * 1000)
    .slice(-12)
    .padStart(12, "0");
}

function buildAuthHeader(userId: number): Record<string, string> {
  const secret = process.env.JWT_SECRET ?? "rollover-audit-test-secret";
  process.env.JWT_SECRET = secret;
  const token = jwt.sign({ userId, role: "SYSTEM_ADMIN" }, secret, {
    expiresIn: "1h",
  });
  return { Authorization: `Bearer ${token}` };
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed };
}

/**
 * Points SchoolSetting.activeSchoolYearId at the given school year,
 * creating the singleton row if it does not yet exist.
 * Returns a snapshot so the original state can be restored in cleanup.
 */
async function pointSettingAt(
  schoolYearId: number,
): Promise<SchoolSettingSnapshot> {
  const existing = await prisma.schoolSetting.findFirst({
    select: { id: true, activeSchoolYearId: true },
    orderBy: { id: "asc" },
  });

  if (existing) {
    await prisma.schoolSetting.update({
      where: { id: existing.id },
      data: { activeSchoolYearId: schoolYearId },
    });
    return {
      id: existing.id,
      previousActiveSchoolYearId: existing.activeSchoolYearId,
      created: false,
    };
  }

  const created = await prisma.schoolSetting.create({
    data: {
      schoolName: "Rollover Audit Test School",
      activeSchoolYearId: schoolYearId,
    },
    select: { id: true },
  });

  return { id: created.id, previousActiveSchoolYearId: null, created: true };
}

async function restoreSchoolSetting(
  snapshot: SchoolSettingSnapshot,
): Promise<void> {
  if (snapshot.created) {
    await prisma.schoolSetting
      .deleteMany({ where: { id: snapshot.id } })
      .catch(() => {});
    return;
  }
  await prisma.schoolSetting
    .update({
      where: { id: snapshot.id },
      data: { activeSchoolYearId: snapshot.previousActiveSchoolYearId },
    })
    .catch(() => {});
}

/** Deletes all learner-scoped records (applications, checklists, records) then the learners. */
async function cleanupLearners(learnerIds: number[]): Promise<void> {
  if (learnerIds.length === 0) return;

  const apps = await prisma.enrollmentApplication.findMany({
    where: { learnerId: { in: learnerIds } },
    select: { id: true },
  });
  const appIds = apps.map((a) => a.id);

  if (appIds.length > 0) {
    await prisma.enrollmentRecord.deleteMany({
      where: { enrollmentApplicationId: { in: appIds } },
    });
    await prisma.applicationChecklist.deleteMany({
      where: { enrollmentId: { in: appIds } },
    });
    await prisma.enrollmentApplication.deleteMany({
      where: { id: { in: appIds } },
    });
  }

  await prisma.learner.deleteMany({ where: { id: { in: learnerIds } } });
}

/** Deletes all school-year–scoped structural records then the year itself. */
async function cleanupSchoolYears(syIds: number[]): Promise<void> {
  if (syIds.length === 0) return;

  // SectionAdvisers reference both Section and SchoolYear.
  await prisma.sectionAdviser.deleteMany({
    where: { schoolYearId: { in: syIds } },
  });
  await prisma.section.deleteMany({ where: { schoolYearId: { in: syIds } } });
  await prisma.teacherDesignation.deleteMany({
    where: { schoolYearId: { in: syIds } },
  });
  await prisma.schoolYear.deleteMany({ where: { id: { in: syIds } } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test runner
// ─────────────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  // Unique seed prevents label collisions between concurrent or back-to-back runs.
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  console.log(`\n🚀  Rollover Audit Tests [seed=${seed}]\n`);

  let server: Server | null = null;
  let settingSnapshot: SchoolSettingSnapshot | null = null;

  // IDs accumulated throughout the test — flushed in the finally block.
  const cleanupSchoolYearIds = new Set<number>();
  const cleanupLearnerIds: number[] = [];
  let actingUserId = 0;
  let teacherId = 0;

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // GLOBAL SETUP
    // ═══════════════════════════════════════════════════════════════════════

    // Grade levels are global singletons (not per-school-year in this schema).
    // Upsert safely in case they already exist from production data.
    const [gl7, gl8, gl10] = await Promise.all([
      prisma.gradeLevel.upsert({
        where: { name: "Grade 7" },
        update: { displayOrder: 7 },
        create: { name: "Grade 7", displayOrder: 7 },
      }),
      prisma.gradeLevel.upsert({
        where: { name: "Grade 8" },
        update: { displayOrder: 8 },
        create: { name: "Grade 8", displayOrder: 8 },
      }),
      prisma.gradeLevel.upsert({
        where: { name: "Grade 10" },
        update: { displayOrder: 10 },
        create: { name: "Grade 10", displayOrder: 10 },
      }),
    ]);

    // Acting user required for JWT auth and EnrollmentRecord.enrolledById FK.
    const actingUser = await prisma.user.create({
      data: {
        firstName: "Rollover",
        lastName: `Auditor-${seed}`,
        email: `rollover-auditor-${seed}@test.local`,
        password: "placeholder-hashed-pw",
        role: "SYSTEM_ADMIN",
        sex: "MALE",
        isActive: true,
      },
    });
    actingUserId = actingUser.id;

    // Teacher required for the SectionAdviser record in the source school year.
    const teacher = await prisma.teacher.create({
      data: {
        employeeId: seed.replace(/\D/g, "").slice(0, 7).padStart(7, "0"),
        firstName: "Adviser",
        lastName: `Teacher-${seed}`,
        email: `adviser-${seed}@test.local`,
        sex: "FEMALE",
      },
    });
    teacherId = teacher.id;

    // Start the HTTP server on a random port.
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const authHeaders = buildAuthHeader(actingUserId);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1 — GOLDEN RULE 4: The Remedial Quarantine Blocker
    //
    //   A school year that still has IRREGULAR (CONDITIONALLY_PROMOTED)
    //   learners MUST block the rollover with HTTP 422.
    // ═══════════════════════════════════════════════════════════════════════

    console.log("── Test 1: Rule 4 — Remedial Quarantine Blocker ──");

    const quarantineSY = await prisma.schoolYear.create({
      data: {
        yearLabel: `QUARANTINE-SRC-${seed}`,
        status: "ACTIVE",
        isEosyFinalized: true,
      },
    });
    cleanupSchoolYearIds.add(quarantineSY.id);

    const qSection = await prisma.section.create({
      data: {
        name: `Q-Section-${seed}`,
        gradeLevelId: gl7.id,
        schoolYearId: quarantineSY.id,
        maxCapacity: 40,
        programType: "REGULAR",
      },
    });

    const learnerConditional = await prisma.learner.create({
      data: {
        firstName: "Kondisyonal",
        lastName: `Promovido-${seed}`,
        sex: "FEMALE",
        birthdate: new Date("2012-03-10"),
        lrn: makeLrn(0),
      },
    });
    cleanupLearnerIds.push(learnerConditional.id);

    const qApp = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learnerConditional.id,
        schoolYearId: quarantineSY.id,
        gradeLevelId: gl7.id,
        status: "ENROLLED",
        learningModalities: [],
        admissionChannel: "F2F",
        isPrivacyConsentGiven: true,
        encodedById: actingUserId,
      },
    });

    await prisma.enrollmentRecord.create({
      data: {
        enrollmentApplicationId: qApp.id,
        learnerId: learnerConditional.id,
        schoolYearId: quarantineSY.id,
        sectionId: qSection.id,
        enrolledById: actingUserId,
        // CONDITIONALLY_PROMOTED is the persisted EOSY status for this outcome.
        eosyStatus: "CONDITIONALLY_PROMOTED",
      },
    });

    settingSnapshot = await pointSettingAt(quarantineSY.id);

    const quarantineResult = await postJson(
      baseUrl,
      "/api/school-years/rollover",
      {
        yearLabel: `QUARANTINE-TGT-${seed}`,
        classOpeningDate: "2026-06-02",
      },
      authHeaders,
    );

    assert.equal(
      quarantineResult.status,
      422,
      `Rule 4: Rollover must be blocked (422) when IRREGULAR learners exist. ` +
        `Got ${quarantineResult.status}: ${JSON.stringify(quarantineResult.body)}`,
    );
    const quarantineBody = quarantineResult.body as Record<string, string>;
    assert.ok(
      quarantineBody.message?.toLowerCase().includes("conditionally_promoted"),
      `Rule 4: Error message must mention CONDITIONALLY_PROMOTED. ` +
        `Got: "${quarantineBody.message}"`,
    );

    console.log(
      "  ✅ Rule 4 (Quarantine Blocker): PASSED — rollover correctly rejected with 422",
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2 — GOLDEN RULES 1, 2, 3, 5: Full Rollover Audit
    //
    //   Source school year fixture:
    //     • 1 Grade-7 REGULAR section with 1 ACTIVE adviser  (→ Rules 1, 2)
    //     • 1 Grade-10 REGULAR section                       (→ Rule 5)
    //     • 1 STE ScpProgramConfig with 1 step               (→ Rule 1)
    //     • Learner A  (Grade 7, PROMOTED)  → carry to G8    (→ Rule 3)
    //     • Learner B  (Grade 7, RETAINED)  → carry to G7    (→ Rule 3)
    //     • Learner D  (Grade 10, PROMOTED) → JHS Completer  (→ Rule 5)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n── Test 2: Rules 1, 2, 3, 5 — Full Rollover Audit ──");

    const sourceSY = await prisma.schoolYear.create({
      data: {
        yearLabel: `ROLLOVER-SRC-${seed}`,
        status: "ACTIVE",
        isEosyFinalized: true,
      },
    });
    cleanupSchoolYearIds.add(sourceSY.id);

    // ── Sections ──────────────────────────────────────────────────────────
    const srcSectionG7 = await prisma.section.create({
      data: {
        name: `Matiyaga-${seed}`,
        gradeLevelId: gl7.id,
        schoolYearId: sourceSY.id,
        maxCapacity: 45,
        programType: "REGULAR",
        sortOrder: 1,
      },
    });

    const srcSectionG10 = await prisma.section.create({
      data: {
        name: `Magiting-${seed}`,
        gradeLevelId: gl10.id,
        schoolYearId: sourceSY.id,
        maxCapacity: 40,
        programType: "REGULAR",
        sortOrder: 2,
      },
    });

    // ── SectionAdviser — must NOT be cloned (Rule 2) ──────────────────────
    await prisma.sectionAdviser.create({
      data: {
        sectionId: srcSectionG7.id,
        teacherId: teacher.id,
        schoolYearId: sourceSY.id,
        effectiveFrom: new Date("2025-06-02"),
        status: "ACTIVE",
      },
    });

    // ── Learner A — Grade 7 PROMOTED → must advance to Grade 8 (Rule 3) ──
    const learnerA = await prisma.learner.create({
      data: {
        firstName: "Amaya",
        lastName: `Promoted-${seed}`,
        sex: "FEMALE",
        birthdate: new Date("2012-06-15"),
        lrn: makeLrn(1),
      },
    });
    cleanupLearnerIds.push(learnerA.id);

    const appA = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learnerA.id,
        schoolYearId: sourceSY.id,
        gradeLevelId: gl7.id,
        status: "ENROLLED",
        learningModalities: [],
        admissionChannel: "F2F",
        isPrivacyConsentGiven: true,
        encodedById: actingUserId,
      },
    });

    await prisma.enrollmentRecord.create({
      data: {
        enrollmentApplicationId: appA.id,
        learnerId: learnerA.id,
        schoolYearId: sourceSY.id,
        sectionId: srcSectionG7.id,
        enrolledById: actingUserId,
        eosyStatus: "PROMOTED",
      },
    });

    // ── Learner B — Grade 7 RETAINED → must stay at Grade 7 (Rule 3) ─────
    const learnerB = await prisma.learner.create({
      data: {
        firstName: "Bayani",
        lastName: `Retained-${seed}`,
        sex: "MALE",
        birthdate: new Date("2012-07-20"),
        lrn: makeLrn(2),
      },
    });
    cleanupLearnerIds.push(learnerB.id);

    const appB = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learnerB.id,
        schoolYearId: sourceSY.id,
        gradeLevelId: gl7.id,
        status: "ENROLLED",
        learningModalities: [],
        admissionChannel: "F2F",
        isPrivacyConsentGiven: true,
        encodedById: actingUserId,
      },
    });

    await prisma.enrollmentRecord.create({
      data: {
        enrollmentApplicationId: appB.id,
        learnerId: learnerB.id,
        schoolYearId: sourceSY.id,
        sectionId: srcSectionG7.id,
        enrolledById: actingUserId,
        eosyStatus: "RETAINED",
      },
    });

    // ── Learner D — Grade 10 PROMOTED → JHS Completer, must be skipped (Rule 5) ──
    const learnerD = await prisma.learner.create({
      data: {
        firstName: "Dalisay",
        lastName: `G10Completer-${seed}`,
        sex: "FEMALE",
        birthdate: new Date("2009-02-28"),
        lrn: makeLrn(3),
      },
    });
    cleanupLearnerIds.push(learnerD.id);

    const appD = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learnerD.id,
        schoolYearId: sourceSY.id,
        gradeLevelId: gl10.id,
        status: "ENROLLED",
        learningModalities: [],
        admissionChannel: "F2F",
        isPrivacyConsentGiven: true,
        encodedById: actingUserId,
      },
    });

    await prisma.enrollmentRecord.create({
      data: {
        enrollmentApplicationId: appD.id,
        learnerId: learnerD.id,
        schoolYearId: sourceSY.id,
        sectionId: srcSectionG10.id,
        enrolledById: actingUserId,
        eosyStatus: "PROMOTED",
      },
    });

    // ── Point active school year at source SY ─────────────────────────────
    await prisma.schoolSetting.update({
      where: { id: settingSnapshot.id },
      data: { activeSchoolYearId: sourceSY.id },
    });

    // ── Execute Rollover ───────────────────────────────────────────────────
    const rolloverResult = await postJson(
      baseUrl,
      "/api/school-years/rollover",
      {
        yearLabel: `ROLLOVER-TGT-${seed}`,
        classOpeningDate: "2026-06-02",
        cloneStructure: true,
        carryOverLearners: true,
      },
      authHeaders,
    );

    assert.equal(
      rolloverResult.status,
      201,
      `Rollover must succeed with HTTP 201. ` +
        `Got ${rolloverResult.status}: ${JSON.stringify(rolloverResult.body)}`,
    );

    const rolloverBody = rolloverResult.body as RolloverResponseBody;
    const newSyId = rolloverBody.year?.id;

    assert.ok(
      typeof newSyId === "number" && newSyId > 0,
      "Response body must include the new school year id",
    );

    // Register new school year for cleanup IMMEDIATELY (before any assertion
    // that could throw and jump to the finally block without this ID).
    cleanupSchoolYearIds.add(newSyId);
    console.log(`  Rollover succeeded → new school year ID=${newSyId}`);
    console.log(`  Summary: ${JSON.stringify(rolloverBody.rolloverSummary)}`);

    // ─────────────────────────────────────────────────────────────────────
    // RULE 1 — Infrastructure Cloning
    //   All Sections and SCP configs from the source SY must be duplicated
    //   in the new SY.
    // ─────────────────────────────────────────────────────────────────────

    const [newSections, srcSections] =
      await Promise.all([
        prisma.section.findMany({
          where: { schoolYearId: newSyId },
          select: { name: true, gradeLevelId: true, programType: true },
        }),
        prisma.section.findMany({
          where: { schoolYearId: sourceSY.id },
          select: { name: true, gradeLevelId: true, programType: true },
        }),
      ]);

    assert.equal(
      newSections.length,
      srcSections.length,
      `Rule 1: Section count must match source (expected ${srcSections.length}, got ${newSections.length})`,
    );

    const srcSectionNames = new Set(srcSections.map((s) => s.name));
    for (const section of newSections) {
      assert.ok(
        srcSectionNames.has(section.name),
        `Rule 1: Cloned section "${section.name}" must match a source section name`,
      );
    }

    console.log("  ✅ Rule 1 (Infrastructure Cloning): PASSED");

    // ─────────────────────────────────────────────────────────────────────
    // RULE 2 — Adviser Wiping
    //   For every cloned section, adviserId MUST be null (i.e., no
    //   SectionAdviser records must exist for the new SY's sections).
    // ─────────────────────────────────────────────────────────────────────

    const newSectionIds = await prisma.section
      .findMany({ where: { schoolYearId: newSyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const adviserCountInNewSY = await prisma.sectionAdviser.count({
      where: { sectionId: { in: newSectionIds } },
    });

    assert.equal(
      adviserCountInNewSY,
      0,
      `Rule 2: Cloned sections must have ZERO SectionAdviser records ` +
        `(found ${adviserCountInNewSY})`,
    );

    console.log("  ✅ Rule 2 (Adviser Wiping): PASSED");

    // ─────────────────────────────────────────────────────────────────────
    // RULE 3 — Eligible Learner Carry-Over
    //   PROMOTED and RETAINED learners (Grades 7–9) must have new
    //   EnrollmentApplication records with status PENDING_CONFIRMATION,
    //   advanced to the correct grade level.
    // ─────────────────────────────────────────────────────────────────────

    // Learner A (Grade 7 PROMOTED) → must appear at Grade 8 in the new SY.
    const newAppA = await prisma.enrollmentApplication.findFirst({
      where: { learnerId: learnerA.id, schoolYearId: newSyId },
      select: {
        status: true,
        gradeLevelId: true,
        learnerType: true,
        checklist: { select: { academicStatus: true } },
      },
    });

    assert.ok(
      newAppA !== null,
      "Rule 3: PROMOTED Grade-7 learner must have a new application in the new SY",
    );
    assert.equal(
      newAppA.status,
      "PENDING_CONFIRMATION",
      `Rule 3: PROMOTED learner's new application status must be PENDING_CONFIRMATION ` +
        `(got "${newAppA.status}")`,
    );
    assert.equal(
      newAppA.gradeLevelId,
      gl8.id,
      `Rule 3: PROMOTED Grade-7 learner must advance to Grade 8 ` +
        `(expected gradeLevelId=${gl8.id}, got ${newAppA.gradeLevelId})`,
    );
    assert.equal(
      newAppA.learnerType,
      "CONTINUING",
      `Rule 3: Carried-over application must have learnerType=CONTINUING ` +
        `(got "${newAppA.learnerType}")`,
    );
    assert.equal(
      newAppA.checklist?.academicStatus,
      "PROMOTED",
      `Rule 3: ApplicationChecklist.academicStatus must be PROMOTED for a promoted learner ` +
        `(got "${newAppA.checklist?.academicStatus}")`,
    );

    // Learner B (Grade 7 RETAINED) → must appear at Grade 7 in the new SY.
    const newAppB = await prisma.enrollmentApplication.findFirst({
      where: { learnerId: learnerB.id, schoolYearId: newSyId },
      select: {
        status: true,
        gradeLevelId: true,
        checklist: { select: { academicStatus: true } },
      },
    });

    assert.ok(
      newAppB !== null,
      "Rule 3: RETAINED Grade-7 learner must have a new application in the new SY",
    );
    assert.equal(
      newAppB.status,
      "PENDING_CONFIRMATION",
      `Rule 3: RETAINED learner's new application status must be PENDING_CONFIRMATION ` +
        `(got "${newAppB.status}")`,
    );
    assert.equal(
      newAppB.gradeLevelId,
      gl7.id,
      `Rule 3: RETAINED Grade-7 learner must remain at Grade 7 ` +
        `(expected gradeLevelId=${gl7.id}, got ${newAppB.gradeLevelId})`,
    );
    assert.equal(
      newAppB.checklist?.academicStatus,
      "RETAINED",
      `Rule 3: ApplicationChecklist.academicStatus must be RETAINED for a retained learner ` +
        `(got "${newAppB.checklist?.academicStatus}")`,
    );

    // Summary counter must agree.
    assert.equal(
      rolloverBody.rolloverSummary.createdApplications,
      2,
      `Rule 3: rolloverSummary.createdApplications must be 2 (A + B) ` +
        `(got ${rolloverBody.rolloverSummary.createdApplications})`,
    );

    console.log("  ✅ Rule 3 (Eligible Learner Carry-Over): PASSED");

    // ─────────────────────────────────────────────────────────────────────
    // RULE 5 — JHS Completers Exit
    //   Grade 10 PROMOTED learners MUST NOT appear in the new SY.
    //   There is no Grade 11 in JHS, so the carry-over engine's
    //   "no target grade" path silently skips them AND ensures their
    //   Learner.status is set to JHS_COMPLETER so the Alumni table is
    //   always consistent (belt-and-suspenders over EOSY finalization).
    // ─────────────────────────────────────────────────────────────────────

    const newAppD = await prisma.enrollmentApplication.findFirst({
      where: { learnerId: learnerD.id, schoolYearId: newSyId },
      select: { id: true },
    });

    assert.equal(
      newAppD,
      null,
      "Rule 5: Grade-10 PROMOTED learner (JHS Completer) MUST NOT have an " +
        "application in the new school year",
    );

    assert.equal(
      rolloverBody.rolloverSummary.skippedNoTargetGrade,
      1,
      `Rule 5: rolloverSummary.skippedNoTargetGrade must be 1 for the Grade-10 completer ` +
        `(got ${rolloverBody.rolloverSummary.skippedNoTargetGrade})`,
    );

    // Verify the rollover marked Learner D as JHS_COMPLETER in the Learner table,
    // making them visible in the Alumni / JHS Completers tab.
    const learnerDRecord = await prisma.learner.findUnique({
      where: { id: learnerD.id },
      select: { status: true },
    });

    assert.equal(
      learnerDRecord?.status,
      "JHS_COMPLETER",
      "Rule 5: Learner.status must be JHS_COMPLETER for a Grade-10 PROMOTED learner " +
        "after rollover — Alumni table depends on this field",
    );

    console.log("  ✅ Rule 5 (JHS Completers Exit): PASSED");

    // ─────────────────────────────────────────────────────────────────────
    // Sanity cross-checks on rollover source/from metadata
    // ─────────────────────────────────────────────────────────────────────
    assert.equal(
      rolloverBody.rolloverFrom.id,
      sourceSY.id,
      "Response must identify the correct source school year in rolloverFrom.id",
    );

    // Source school year must now be ARCHIVED.
    const archivedSourceSY = await prisma.schoolYear.findUnique({
      where: { id: sourceSY.id },
      select: { status: true },
    });
    assert.equal(
      archivedSourceSY?.status,
      "ARCHIVED",
      "The source school year must be transitioned to ARCHIVED after rollover",
    );

    // New school year must be ACTIVE.
    const newSyRecord = await prisma.schoolYear.findUnique({
      where: { id: newSyId },
      select: { status: true, clonedFromId: true },
    });
    assert.equal(
      newSyRecord?.status,
      "ACTIVE",
      "The new school year must have status=ACTIVE after rollover",
    );
    assert.equal(
      newSyRecord?.clonedFromId,
      sourceSY.id,
      "The new school year must record clonedFromId pointing at the source SY",
    );

    console.log("\n🎉  All 5 Golden Rules PASSED — Rollover Audit Complete\n");
    console.log("=".repeat(60));
    console.log("  ✅ Rule 1 — Infrastructure Cloning");
    console.log("  ✅ Rule 2 — Adviser Wiping");
    console.log("  ✅ Rule 3 — Eligible Learner Carry-Over");
    console.log("  ✅ Rule 4 — Remedial Quarantine Blocker");
    console.log("  ✅ Rule 5 — JHS Completers Exit");
    console.log("=".repeat(60));
  } finally {
    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP — reverse FK order
    // ═══════════════════════════════════════════════════════════════════════

    if (settingSnapshot) {
      await restoreSchoolSetting(settingSnapshot);
    }

    if (actingUserId) {
      await prisma.auditLog
        .deleteMany({ where: { userId: actingUserId } })
        .catch(() => {});
    }

    // Remove all applications / records / checklists for test learners
    // (covers both source SY originals and new SY carry-overs).
    await cleanupLearners(cleanupLearnerIds).catch(() => {});

    // Remove school-year structural data and the years themselves.
    await cleanupSchoolYears([...cleanupSchoolYearIds]).catch(() => {});

    if (teacherId) {
      await prisma.teacher
        .deleteMany({ where: { id: teacherId } })
        .catch(() => {});
    }
    if (actingUserId) {
      await prisma.user
        .deleteMany({ where: { id: actingUserId } })
        .catch(() => {});
    }

    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
  }
}

runTests().catch((error: unknown) => {
  console.error("\n❌  Rollover Audit Test FAILED:", error);
  process.exit(1);
});
