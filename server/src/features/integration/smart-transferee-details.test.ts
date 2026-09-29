import assert from "node:assert/strict"
import test from "node:test"
import type { AddressInfo } from "node:net"
import express from "express"
import integrationRoutes from "./integration.router.js"
import { smartTransfereeDetails } from "./smart-transferee-details.js"

test("projects stored transferee details without deriving last grade", () => {
  const details = smartTransfereeDetails({
    previousSchool: {
      schoolName: "  Rizal National High School  ",
      schoolId: "123456",
      transferCertificateNo: "TC-2030-001",
      generalAverage: 84.5,
      lastGradeCompleted: "Grade 7",
    },
    academicStatus: "CONDITIONALLY_PROMOTED",
    backSubjects: [{ subjectCode: "MATH" }, { subjectCode: "ENG" }],
    isMissingSf9: false,
    isTemporarilyEnrolled: true,
    learner: { hasPsaBirthCertificate: false },
  })

  assert.deepEqual(details, {
    previousSchoolName: "Rizal National High School",
    originatingSchoolId: "123456",
    transferCertificateNo: "TC-2030-001",
    previousGenAve: 84.5,
    lastGradeCompleted: "Grade 7",
    sf9EligibilityStatus: "CONDITIONALLY_PROMOTED",
    conditionalSubjectCodes: ["MATH", "ENG"],
    hasSf9: true,
    hasPsa: false,
    isTemporarilyEnrolled: true,
  })
})

test("keeps unknown previous-school values as explicit nulls", () => {
  const details = smartTransfereeDetails({
    previousSchool: null,
    academicStatus: "PROMOTED",
    backSubjects: [],
    isMissingSf9: true,
    isTemporarilyEnrolled: true,
    learner: { hasPsaBirthCertificate: false },
  })

  assert.equal(details.previousSchoolName, null)
  assert.equal(details.originatingSchoolId, null)
  assert.equal(details.transferCertificateNo, null)
  assert.equal(details.previousGenAve, null)
  assert.equal(details.lastGradeCompleted, null)
  assert.deepEqual(details.conditionalSubjectCodes, [])
  assert.equal(details.hasSf9, false)
})

test("rejects corrupted selections instead of silently dropping a back subject", () => {
  assert.throws(
    () => smartTransfereeDetails({
      previousSchool: null,
      academicStatus: "CONDITIONALLY_PROMOTED",
      backSubjects: [
        { subjectCode: "MATH" },
        { subjectCode: "ENG" },
        { subjectCode: "SCI" },
      ],
      isMissingSf9: false,
      isTemporarilyEnrolled: false,
      learner: { hasPsaBirthCertificate: true },
    }),
    /more than two back subjects/,
  )
})

test("transferee route requires SMART's key and validates schoolYearId", async (context) => {
  const priorKey = process.env.SMART_INTEGRATION_API_KEY
  process.env.SMART_INTEGRATION_API_KEY = "smart-transferee-test-key"

  const app = express()
  app.use("/api/integration/v1", integrationRoutes)
  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once("listening", resolve))
  context.after(() => {
    server.close()
    if (priorKey === undefined) delete process.env.SMART_INTEGRATION_API_KEY
    else process.env.SMART_INTEGRATION_API_KEY = priorKey
  })

  const { port } = server.address() as AddressInfo
  const url = `http://127.0.0.1:${port}/api/integration/v1/default/smart/transferees?schoolYearId=0`

  const noKey = await fetch(url)
  assert.equal(noKey.status, 401)
  assert.equal((await noKey.json()).error.code, "INVALID_INTEGRATION_KEY")

  const wrongKey = await fetch(url, { headers: { "x-integration-key": "wrong" } })
  assert.equal(wrongKey.status, 401)

  const malformedYear = await fetch(url, {
    headers: { "x-integration-key": "smart-transferee-test-key" },
  })
  assert.equal(malformedYear.status, 400)
})
