import "dotenv/config"
import assert from "node:assert/strict"
import type { AddressInfo } from "node:net"
import test, { after, before } from "node:test"
import type { Server } from "node:http"

process.env.MRF_INTEGRATION_API_KEY = "integration-test-mrf-key"

const { default: app } = await import("../app.js")
const { prisma } = await import("../lib/prisma.js")

let server: Server
let baseUrl = ""

before(async () => {
  server = app.listen(0, "127.0.0.1")
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve)
    server.once("error", reject)
  })
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeIdleConnections()
    server.closeAllConnections()
  })
  await prisma.$disconnect()
})

interface MrfFeedResponse {
  data: {
    learners: Array<Record<string, unknown>>
    teachers: Array<Record<string, unknown>>
    staff: Array<Record<string, unknown>>
  }
  meta: {
    sourceSystem: string
    consumerSystem: string
    scopeSchoolYearId: number
    scopeSchoolYearLabel: string
    counts: {
      learners: number
      teachers: number
      staff: number
    }
  }
}

const forbiddenFields = new Set([
  "password",
  "birthdate",
  "familyMembers",
  "healthRecords",
  "medicalCertificate",
  "lastLoginAt",
  "mustChangePassword",
])

function assertNoForbiddenFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenFields)
    return
  }
  if (typeof value !== "object" || value === null) return

  for (const [key, nestedValue] of Object.entries(value)) {
    assert.equal(
      forbiddenFields.has(key),
      false,
      `MRF payload exposed forbidden field: ${key}`,
    )
    assertNoForbiddenFields(nestedValue)
  }
}

test("MRF identity feed rejects a missing integration key", async () => {
  const response = await fetch(
    `${baseUrl}/api/integration/v1/default/mrf/identities`,
  )
  assert.equal(response.status, 401)
})

test("MRF identity feed rejects an invalid integration key", async () => {
  const response = await fetch(
    `${baseUrl}/api/integration/v1/default/mrf/identities`,
    { headers: { "x-integration-key": "wrong-key" } },
  )
  assert.equal(response.status, 401)
})

test("MRF identity feed is scoped and DPA-minimized", async () => {
  const response = await fetch(
    `${baseUrl}/api/integration/v1/default/mrf/identities`,
    { headers: { "x-integration-key": "integration-test-mrf-key" } },
  )
  assert.equal(response.status, 200)

  const payload = (await response.json()) as MrfFeedResponse
  assert.equal(payload.meta.sourceSystem, "ENROLLPRO")
  assert.equal(payload.meta.consumerSystem, "MRF")
  assert.equal(Number.isInteger(payload.meta.scopeSchoolYearId), true)
  assert.equal(payload.meta.scopeSchoolYearLabel.length > 0, true)
  assert.equal(payload.meta.counts.learners, payload.data.learners.length)
  assert.equal(payload.meta.counts.teachers, payload.data.teachers.length)
  assert.equal(payload.meta.counts.staff, payload.data.staff.length)
  assertNoForbiddenFields(payload)

  const scopedYear = await prisma.schoolYear.findUnique({
    where: { id: payload.meta.scopeSchoolYearId },
    select: { status: true },
  })
  if (scopedYear?.status === "ACTIVE") {
    const officialStatuses = new Set([
      "OFFICIALLY_ENROLLED",
      "ENROLLED",
      "SECTIONED",
    ])
    for (const learner of payload.data.learners) {
      assert.equal(
        officialStatuses.has(String(learner.enrollmentStatus)),
        true,
        "Active-year MRF learners must be officially sectioned",
      )
    }
  }
  for (const teacher of payload.data.teachers) {
    assert.notEqual(teacher.serviceStatus, "INACTIVE")
  }
  for (const staff of payload.data.staff) {
    assert.equal(staff.accountActive, true)
  }
})

test("MRF identity feed accepts an explicit school year scope", async () => {
  const schoolYear = await prisma.schoolYear.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, yearLabel: true },
  })
  assert.ok(schoolYear, "Integration test requires at least one school year")

  const response = await fetch(
    `${baseUrl}/api/integration/v1/default/mrf/identities?schoolYearId=${schoolYear.id}`,
    { headers: { "x-integration-key": "integration-test-mrf-key" } },
  )
  assert.equal(response.status, 200)

  const payload = (await response.json()) as MrfFeedResponse
  assert.equal(payload.meta.scopeSchoolYearId, schoolYear.id)
  assert.equal(payload.meta.scopeSchoolYearLabel, schoolYear.yearLabel)
})
