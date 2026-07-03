import assert from "node:assert/strict"
import {
  resolveRolloverDestination,
} from "../features/school-year/services/school-year-transition.service.js"
import {
  buildBalancedSectionAssignments,
} from "../features/sections/section-distribution.service.js"

function testRolloverOutcomeRouting(): void {
  assert.deepEqual(
    resolveRolloverDestination({
      eosyStatus: "PROMOTED",
      sourceGradeOrder: 7,
    }),
    {
      kind: "PENDING_CONFIRMATION",
      targetGradeOrder: 8,
      academicStatus: "PROMOTED",
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
      eosyStatus: "PROMOTED",
      sourceGradeOrder: 10,
    }),
    { kind: "JHS_COMPLETER" },
  )

  assert.deepEqual(
    resolveRolloverDestination({
      eosyStatus: "CONDITIONALLY_PROMOTED",
      sourceGradeOrder: 10,
    }),
    { kind: "BLOCKED_GRADE_10_CONDITIONAL" },
  )

  for (const eosyStatus of ["TRANSFERRED_OUT", "DROPPED_OUT"] as const) {
    assert.deepEqual(
      resolveRolloverDestination({
        eosyStatus,
        sourceGradeOrder: 8,
      }),
      { kind: "ARCHIVE_ONLY" },
    )
  }
}

function testBalancedSectionAssignments(): void {
  const assignments = buildBalancedSectionAssignments({
    learners: [
      { applicationId: 1, sex: "MALE", generalAverage: 96, programType: "REGULAR" },
      { applicationId: 2, sex: "FEMALE", generalAverage: 95, programType: "REGULAR" },
      { applicationId: 3, sex: "MALE", generalAverage: 91, programType: "REGULAR" },
      { applicationId: 4, sex: "FEMALE", generalAverage: 90, programType: "REGULAR" },
      {
        applicationId: 5,
        sex: "FEMALE",
        generalAverage: 94,
        programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      },
    ],
    sections: [
      { id: 11, sortOrder: 1, maxCapacity: 2, currentCount: 0, programType: "REGULAR" },
      { id: 12, sortOrder: 2, maxCapacity: 2, currentCount: 0, programType: "REGULAR" },
      {
        id: 21,
        sortOrder: 1,
        maxCapacity: 1,
        currentCount: 0,
        programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      },
    ],
  })

  assert.equal(assignments.length, 5)
  assert.equal(assignments.find((item) => item.applicationId === 5)?.sectionId, 21)

  const regularAssignments = assignments.filter((item) => item.applicationId !== 5)
  const section11 = regularAssignments.filter((item) => item.sectionId === 11)
  const section12 = regularAssignments.filter((item) => item.sectionId === 12)
  assert.equal(section11.length, 2)
  assert.equal(section12.length, 2)

  const learnerSex = new Map([
    [1, "MALE"],
    [2, "FEMALE"],
    [3, "MALE"],
    [4, "FEMALE"],
  ])
  for (const sectionAssignments of [section11, section12]) {
    const sexes = sectionAssignments.map((item) => learnerSex.get(item.applicationId))
    assert.equal(sexes.filter((sex) => sex === "MALE").length, 1)
    assert.equal(sexes.filter((sex) => sex === "FEMALE").length, 1)
  }
}

function run(): void {
  testRolloverOutcomeRouting()
  testBalancedSectionAssignments()
  console.log("Transition and sectioning integration checks passed.")
}

run()
