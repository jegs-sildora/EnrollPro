import assert from "node:assert/strict"
import test from "node:test"

import type { Role } from "@enrollpro/shared"

import {
  mergeRequiredSchedulerRoles,
  normalizeApplicationRoles,
} from "./application-role.service.js"
import { toAuthUserResponse, type AuthUser } from "./auth.controller.js"
import { projectCompanionRoles } from "./companion-sso.service.js"

function authUser(roles: Role[]): AuthUser {
  return {
    id: 1,
    firstName: "Test",
    lastName: "Teacher",
    email: null,
    employeeId: "1234506",
    accountName: null,
    roles,
    ancillaryRoles: ["GRADE 7 COORDINATOR"],
    mustChangePassword: false,
    isActive: true,
    lastLoginAt: null,
  }
}

test("new designated accounts receive teacher and grade-level coordinator roles", () => {
  assert.deepEqual(mergeRequiredSchedulerRoles("1234506", []), [
    "TEACHER",
    "GRADE_LEVEL_COORDINATOR",
  ])
})

test("existing designated accounts retain independent roles without duplicates", () => {
  assert.deepEqual(
    mergeRequiredSchedulerRoles("1234507", [
      "TEACHER",
      "SPA_COORDINATOR",
      "TEACHER",
    ]),
    ["TEACHER", "SPA_COORDINATOR", "GRADE_LEVEL_COORDINATOR"],
  )
})

test("a normal teacher does not gain coordinator authority", () => {
  assert.deepEqual(mergeRequiredSchedulerRoles("9999999", ["TEACHER"]), [
    "TEACHER",
  ])
})

test("credential verification projects the current deduplicated application roles", () => {
  const response = toAuthUserResponse(authUser([
    "TEACHER",
    "GRADE_LEVEL_COORDINATOR",
    "TEACHER",
  ]))
  assert.deepEqual(response.roles, ["TEACHER", "GRADE_LEVEL_COORDINATOR"])
})

test("ATLAS SSO projects the same current scheduler roles", () => {
  assert.deepEqual(
    projectCompanionRoles("ATLAS", ["TEACHER", "GRADE_LEVEL_COORDINATOR"]),
    ["TEACHER", "GRADE_LEVEL_COORDINATOR"],
  )
})

test("role removal is reflected without an ancillary-role fallback or stale claim", () => {
  const currentRoles = normalizeApplicationRoles(["TEACHER"])
  assert.deepEqual(toAuthUserResponse(authUser(currentRoles)).roles, ["TEACHER"])
  assert.deepEqual(projectCompanionRoles("ATLAS", currentRoles), ["TEACHER"])
})
