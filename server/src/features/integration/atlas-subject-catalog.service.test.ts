import assert from "node:assert/strict"
import test from "node:test"
import { directEncodeWalkInSchema } from "@enrollpro/shared"
import {
  getPreviousJhsGradeNumber,
  normalizeAtlasSubjectCatalog,
} from "./atlas-subject-catalog.service.js"

const atlasResponse = {
  subjects: [
    {
      id: 1,
      code: "MATH_8",
      name: "Mathematics 8",
      outputLabel: "MATHEMATICS",
      displayCode: "MATH",
      rotationFamily: null,
      gradeLevels: [8],
      programScopes: ["REGULAR", "STE"],
      isActive: true,
    },
    {
      id: 2,
      code: "SCI_BIO",
      name: "Biology",
      outputLabel: "SCIENCE",
      displayCode: "SCI",
      rotationFamily: "SCIENCE",
      gradeLevels: [8],
      programScopes: ["REGULAR"],
      isActive: true,
    },
    {
      id: 3,
      code: "SCI_CHEM",
      name: "Chemistry",
      outputLabel: "SCIENCE",
      displayCode: "SCI",
      rotationFamily: "SCIENCE",
      gradeLevels: [8],
      programScopes: ["REGULAR"],
      isActive: true,
    },
    {
      id: 4,
      code: "TLE_ICT",
      name: "ICT",
      outputLabel: "TLE",
      displayCode: "TLE",
      rotationFamily: "TLE_ROTATION",
      gradeLevels: [8],
      programScopes: ["REGULAR"],
      isActive: true,
    },
    {
      id: 5,
      code: "HG_8",
      name: "Homeroom Guidance",
      outputLabel: "HG",
      displayCode: "HG",
      rotationFamily: null,
      gradeLevels: [8],
      programScopes: ["REGULAR"],
      isActive: true,
    },
    {
      id: 6,
      code: "SPA_MUSIC",
      name: "Music Specialization",
      outputLabel: "SPA MUSIC",
      displayCode: "SPA",
      rotationFamily: null,
      gradeLevels: [8],
      programScopes: ["SPA"],
      isActive: true,
    },
  ],
}

const validWalkIn = {
  learnerType: "TRANSFEREE",
  lrn: "123456789012",
  firstName: "JUAN",
  lastName: "DELA CRUZ",
  birthdate: "2017-01-01",
  sex: "MALE",
  gradeLevelId: 2,
  assignedProgram: "REGULAR",
  previousSchoolName: "PREVIOUS SCHOOL",
  guardianFirstName: "MARIA",
  guardianLastName: "DELA CRUZ",
  guardianRelationship: "MOTHER",
  guardianContact: "09123456789",
  hasSf9: true,
  hasPsa: true,
  originatingSchoolId: "123456",
  sf9EligibilityStatus: "CONDITIONALLY_PROMOTED",
  conditionalSubjectCodes: ["SCIENCE"],
} as const

test("filters ATLAS subjects by grade and program without replacing stable codes", () => {
  const subjects = normalizeAtlasSubjectCatalog(atlasResponse, 8, "REGULAR")

  assert.deepEqual(subjects, [
    { code: "SCI_BIO", displayCode: "SCI", name: "Biology" },
    { code: "SCI_CHEM", displayCode: "SCI", name: "Chemistry" },
    { code: "TLE_ICT", displayCode: "TLE", name: "ICT" },
    { code: "MATH_8", displayCode: "MATH", name: "Mathematics 8" },
  ])
})

test("does not expose subjects from another ATLAS program scope", () => {
  const regular = normalizeAtlasSubjectCatalog(atlasResponse, 8, "REGULAR")
  const spa = normalizeAtlasSubjectCatalog(
    atlasResponse,
    8,
    "SPECIAL_PROGRAM_IN_THE_ARTS",
  )

  assert.equal(regular.some((subject) => subject.code === "SPA MUSIC"), false)
  assert.deepEqual(spa, [
    {
      code: "SPA_MUSIC",
      displayCode: "SPA",
      name: "Music Specialization",
    },
  ])
})

test("uses the previous JHS grade for transferee back subjects", () => {
  assert.equal(getPreviousJhsGradeNumber(8), 7)
  assert.equal(getPreviousJhsGradeNumber(9), 8)
  assert.equal(getPreviousJhsGradeNumber(10), 9)
  assert.throws(() => getPreviousJhsGradeNumber(7), /no Grade 6 subject offerings/)
})

test("requires one or two unique back subjects for a conditional transferee", () => {
  assert.equal(directEncodeWalkInSchema.safeParse(validWalkIn).success, true)
  assert.equal(
    directEncodeWalkInSchema.safeParse({
      ...validWalkIn,
      conditionalSubjectCodes: [],
    }).success,
    false,
  )
  assert.equal(
    directEncodeWalkInSchema.safeParse({
      ...validWalkIn,
      conditionalSubjectCodes: ["SCIENCE", "TLE", "MATHEMATICS"],
    }).success,
    false,
  )
  assert.equal(
    directEncodeWalkInSchema.safeParse({
      ...validWalkIn,
      sf9EligibilityStatus: "PROMOTED",
    }).success,
    false,
  )
})
