import assert from "node:assert/strict"
import test from "node:test"
import { parsePositiveInt } from "./integration-query.service.js"

test("accepts only canonical positive base-10 integer values", () => {
  assert.equal(parsePositiveInt("1"), 1)
  assert.equal(parsePositiveInt("2030"), 2030)
  assert.equal(parsePositiveInt(12), 12)
})

test("rejects malformed, duplicate, and unsafe integer values", () => {
  const invalidValues: unknown[] = [
    "3.5",
    "3abc",
    "1e2",
    "0",
    "-1",
    "",
    " ",
    "01",
    "+1",
    "Infinity",
    ["3", "4"],
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]

  for (const value of invalidValues) {
    assert.equal(parsePositiveInt(value), null)
  }
})

test("preserves omitted query parameter behavior", () => {
  assert.equal(parsePositiveInt(undefined), null)
  assert.equal(parsePositiveInt(null), null)
})
