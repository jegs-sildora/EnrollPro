import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateActiveTally,
  calculateUtilizationPercent,
  countDistinctLearners,
} from "../features/dashboard/dashboard.metrics.js"
import {
  isPublicEnrollmentOpen,
  isStaffIntakeAllowed,
} from "../features/settings/enrollment-gate.service.js"

test("dashboard active tally uses BOSY baseline plus late admissions minus drops", () => {
  const droppedAt = new Date("2026-09-01T00:00:00.000Z")
  const transferredAt = new Date("2026-08-01T00:00:00.000Z")
  const tally = calculateActiveTally([
    { isLateEnrollee: false, dropOutDate: null, transferOutDate: null },
    { isLateEnrollee: false, dropOutDate: droppedAt, transferOutDate: null },
    { isLateEnrollee: true, dropOutDate: null, transferOutDate: null },
    { isLateEnrollee: true, dropOutDate: null, transferOutDate: transferredAt },
  ])

  assert.deepEqual(tally, {
    verifiedBosyBaseline: 2,
    lateAdmissions: 1,
    officiallyDropped: 1,
    activeTotal: 2,
  })
})

test("dashboard capacity utilization follows configured section capacity", () => {
  assert.equal(calculateUtilizationPercent(40, 40), 100)
  assert.equal(calculateUtilizationPercent(45, 40), 113)
  assert.equal(calculateUtilizationPercent(12, 0), 0)
})

test("pending validations count each learner only once", () => {
  assert.equal(
    countDistinctLearners([
      new Set([1, 2, 3]),
      new Set([2, 3, 4]),
      new Set([4, 5]),
    ]),
    5,
  )
})

test("public online enrollment requires official phase and configured dates", () => {
  const now = Date.now()
  const activeWindow = {
    enrollOpenDate: new Date(now - 48 * 60 * 60 * 1000),
    enrollCloseDate: new Date(now + 48 * 60 * 60 * 1000),
  }

  assert.equal(
    isPublicEnrollmentOpen(activeWindow, "OFFICIAL_ENROLLMENT"),
    true,
  )
  assert.equal(
    isPublicEnrollmentOpen(activeWindow, "CLASSES_ONGOING"),
    false,
  )
  assert.equal(
    isPublicEnrollmentOpen(
      { enrollOpenDate: null, enrollCloseDate: null },
      "OFFICIAL_ENROLLMENT",
    ),
    false,
  )
})

test("staff intake remains available during classes and locks during EOSY", () => {
  assert.equal(isStaffIntakeAllowed("CLASSES_ONGOING"), true)
  assert.equal(isStaffIntakeAllowed("EOSY_CLOSING"), false)
})
