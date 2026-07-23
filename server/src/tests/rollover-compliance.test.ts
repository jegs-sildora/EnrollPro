import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import {
  smartEosySectionResponseSchema,
} from "@enrollpro/shared"
import { prisma } from "../lib/prisma.js"
import { getSchoolFormSourceHash } from "../features/enrollment/services/school-form-artifact.service.js"
import { resolveRolloverDestination } from "../features/school-year/services/school-year-transition.service.js"

interface NamedTest {
  name: string
  run: () => void | Promise<void>
}

const validSmartPayload = {
  data: {
    students: [
      {
        lrn: "123456789012",
        finalGeneralAverage: 87.5,
        finalOutcome: "PROMOTED",
        learningAreas: [
          {
            code: "MATHEMATICS",
            name: "Mathematics",
            finalGrade: 88,
            result: "PASSED",
          },
        ],
        publishedAt: "2026-07-20T08:00:00+08:00",
        revision: "final-v3",
      },
    ],
  },
}

const tests: NamedTest[] = [
  {
    name: "Grades 7 to 9 promoted learners advance one grade",
    run: () => {
      for (const grade of [7, 8, 9]) {
        assert.deepEqual(
          resolveRolloverDestination({
            eosyStatus: "PROMOTED",
            sourceGradeOrder: grade,
          }),
          {
            kind: "PENDING_CONFIRMATION",
            targetGradeOrder: grade + 1,
            academicStatus: "PROMOTED",
            isRemedialRequired: false,
          },
        )
      }
    },
  },
  {
    name: "Retained and conditionally promoted outcomes follow DepEd routing",
    run: () => {
      assert.deepEqual(
        resolveRolloverDestination({
          eosyStatus: "RETAINED",
          sourceGradeOrder: 8,
        }),
        {
          kind: "PENDING_CONFIRMATION",
          targetGradeOrder: 8,
          academicStatus: "RETAINED",
          isRemedialRequired: false,
        },
      )
      assert.deepEqual(
        resolveRolloverDestination({
          eosyStatus: "CONDITIONALLY_PROMOTED",
          sourceGradeOrder: 9,
        }),
        {
          kind: "PENDING_CONFIRMATION",
          targetGradeOrder: 10,
          academicStatus: "CONDITIONALLY_PROMOTED",
          isRemedialRequired: true,
        },
      )
    },
  },
  {
    name: "Grade 10 completion, retention, remedial hold, and departures are exact",
    run: () => {
      assert.deepEqual(
        resolveRolloverDestination({
          eosyStatus: "PROMOTED",
          sourceGradeOrder: 10,
        }),
        { kind: "JHS_COMPLETER" },
      )
      assert.deepEqual(
        resolveRolloverDestination({
          eosyStatus: "RETAINED",
          sourceGradeOrder: 10,
        }),
        {
          kind: "PENDING_CONFIRMATION",
          targetGradeOrder: 10,
          academicStatus: "RETAINED",
          isRemedialRequired: false,
        },
      )
      assert.deepEqual(
        resolveRolloverDestination({
          eosyStatus: "CONDITIONALLY_PROMOTED",
          sourceGradeOrder: 10,
        }),
        {
          kind: "REMEDIAL_HOLD",
          targetGradeOrder: 10,
          academicStatus: "CONDITIONALLY_PROMOTED",
          isRemedialRequired: true,
        },
      )
      for (const eosyStatus of [
        "DROPPED_OUT",
        "TRANSFERRED_OUT",
      ] as const) {
        assert.deepEqual(
          resolveRolloverDestination({
            eosyStatus,
            sourceGradeOrder: 9,
          }),
          { kind: "ARCHIVE_ONLY" },
        )
      }
    },
  },
  {
    name: "SMART accepts only complete final published outcomes",
    run: () => {
      assert.equal(
        smartEosySectionResponseSchema.safeParse(validSmartPayload).success,
        true,
      )
      const malformed = structuredClone(validSmartPayload)
      malformed.data.students[0]!.learningAreas = []
      assert.equal(
        smartEosySectionResponseSchema.safeParse(malformed).success,
        false,
      )
      const invalidLrn = structuredClone(validSmartPayload)
      invalidLrn.data.students[0]!.lrn = "123"
      assert.equal(
        smartEosySectionResponseSchema.safeParse(invalidLrn).success,
        false,
      )
    },
  },
  {
    name: "Grade correction changes the official form source checksum",
    run: () => {
      const first = {
        generatedAt: "2026-07-20T00:00:00.000Z",
        records: [{ learnerId: 1, finalAverage: 88 }],
      }
      const corrected = {
        ...first,
        generatedAt: "2026-07-21T00:00:00.000Z",
        records: [{ learnerId: 1, finalAverage: 89 }],
      }
      assert.notEqual(
        getSchoolFormSourceHash(first),
        getSchoolFormSourceHash(corrected),
      )
    },
  },
  {
    name: "Database enforces one history row per learner identifier and school year",
    run: async () => {
      const indexes = await prisma.$queryRaw<
        Array<{ indexdef: string }>
      >`
        SELECT indexdef::text AS indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'enrollment_history'
      `
      assert.ok(
        indexes.some(
          (index) =>
            index.indexdef.includes("UNIQUE")
            && index.indexdef.includes("learner_identifier")
            && index.indexdef.includes("school_year_id"),
        ),
      )
    },
  },
  {
    name: "Rollover source retains the required atomic and conflict safeguards",
    run: async () => {
      const servicePath = fileURLToPath(new URL(
        "../features/school-year/services/school-year-rollover.service.ts",
        import.meta.url,
      ))
      const source = await readFile(servicePath, "utf8")
      for (const requiredToken of [
        "pg_advisory_xact_lock",
        "TransactionIsolationLevel.Serializable",
        "TARGET_YEAR_HAS_RECORDS",
        "SF5_STALE",
        "SF6_STALE",
        "CALENDAR_POLICY_NOT_APPROVED",
        "REMEDIAL_HOLD",
        "learnerIdentifier",
      ]) {
        assert.ok(
          source.includes(requiredToken),
          `Missing rollover safeguard: ${requiredToken}`,
        )
      }
    },
  },
]

let failed = 0
for (const test of tests) {
  try {
    await test.run()
    console.log(`PASS ${test.name}`)
  } catch (error: unknown) {
    failed += 1
    console.error(`FAIL ${test.name}`)
    console.error(error)
  }
}

await prisma.$disconnect()

if (failed > 0) {
  process.exitCode = 1
} else {
  console.log(`PASS ${tests.length} rollover compliance checks`)
}
