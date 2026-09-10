import assert from "node:assert/strict"
import test from "node:test"
import { integrationSchoolYearTermContractSchema } from "@enrollpro/shared"
import {
  buildOrderedTermContract,
  resolveActiveTermEntry,
  TermContractError,
  type SchoolYearTermSource,
} from "./term-contract.service.js"

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function trimesterSource(): SchoolYearTermSource {
  return {
    termFormat: "TRIMESTER",
    term1Start: date("2030-06-03"),
    term1End: date("2030-09-06"),
    term2Start: date("2030-09-07"),
    term2End: date("2030-12-18"),
    term3Start: date("2031-01-04"),
    term3End: date("2031-04-08"),
    term4Start: null,
    term4End: null,
    term1Label: "FIRST TERM",
    term2Label: "SECOND TERM",
    term3Label: "FINAL TERM",
    term4Label: "QUARTER 4",
  }
}

test("builds exactly three ordered trimester entries and preserves labels", () => {
  const terms = buildOrderedTermContract(trimesterSource())
  assert.equal(terms.length, 3)
  assert.deepEqual(terms.map((term) => term.identity), ["T1", "T2", "T3"])
  assert.deepEqual(terms.map((term) => term.order), [1, 2, 3])
  assert.equal(terms[0]?.displayLabel, "FIRST TERM")
})

test("builds exactly four ordered quarter entries", () => {
  const source = trimesterSource()
  const terms = buildOrderedTermContract({
    ...source,
    termFormat: "QUARTERS",
    term4Start: date("2031-04-09"),
    term4End: date("2031-05-30"),
    term4Label: "FINAL QUARTER",
  })
  assert.equal(terms.length, 4)
  assert.equal(terms[3]?.identity, "T4")
  assert.equal(terms[3]?.displayLabel, "FINAL QUARTER")
})

test("rejects a missing required term entry", () => {
  const source = trimesterSource()
  assert.throws(
    () => buildOrderedTermContract({ ...source, term2Start: null }),
    (error: unknown) =>
      error instanceof TermContractError && error.code === "TERM_ENTRY_INVALID",
  )
})

test("rejects overlapping or out-of-order terms", () => {
  const source = trimesterSource()
  assert.throws(
    () => buildOrderedTermContract({ ...source, term2Start: date("2030-09-06") }),
    (error: unknown) =>
      error instanceof TermContractError && error.code === "TERM_ORDER_INVALID",
  )
})

test("resolves the active identity and its matching configured label", () => {
  const active = resolveActiveTermEntry(
    buildOrderedTermContract(trimesterSource()),
    date("2030-10-15"),
  )
  assert.equal(active.identity, "T2")
  assert.equal(active.displayLabel, "SECOND TERM")
})

test("does not fabricate T1 when no term contains the current date", () => {
  assert.throws(
    () => resolveActiveTermEntry(buildOrderedTermContract(trimesterSource()), date("2032-01-01")),
    (error: unknown) =>
      error instanceof TermContractError && error.code === "ACTIVE_TERM_UNRESOLVED",
  )
})

test("shared contract rejects duplicate or out-of-order identities", () => {
  const terms = buildOrderedTermContract(trimesterSource())
  const result = integrationSchoolYearTermContractSchema.safeParse({
    data: {
      id: 12,
      yearLabel: "2030-2031",
      termFormat: "TRIMESTER",
      terms: [terms[0], terms[0], terms[2]],
    },
  })
  assert.equal(result.success, false)
})
