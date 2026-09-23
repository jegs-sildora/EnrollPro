import assert from "node:assert/strict"
import test from "node:test"

import { mergeAncillaryRoles } from "./integration.shared.js"

test("merges profile and school-year ancillary roles without duplicates", () => {
  assert.deepEqual(
    mergeAncillaryRoles(
      ["STE HEAD TEACHER", "GRADE 7 COORDINATOR"],
      ["GRADE 7 COORDINATOR", "SCIENCE CLUB ADVISER"],
    ),
    [
      "STE HEAD TEACHER",
      "GRADE 7 COORDINATOR",
      "SCIENCE CLUB ADVISER",
    ],
  )
})

test("returns an empty array when no ancillary roles exist", () => {
  assert.deepEqual(mergeAncillaryRoles([], undefined, null), [])
})

test("removes blank values and normalizes surrounding whitespace", () => {
  assert.deepEqual(
    mergeAncillaryRoles(["  GRADE 8 COORDINATOR  ", "", "   "]),
    ["GRADE 8 COORDINATOR"],
  )
})
