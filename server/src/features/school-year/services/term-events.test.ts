import assert from "node:assert/strict"
import test from "node:test"

import {
  termChangedEventV2Schema,
  type TermChangedEventV2,
} from "@enrollpro/shared"

import {
  buildOrderedTermContract,
  resolveActiveTermEntry,
  type SchoolYearTermSource,
} from "./term-contract.service.js"
import {
  calculateTermEventRetryDelay,
  publishTermChangedMessage,
  sanitizeTermEventError,
} from "./term-changed-publisher.service.js"
import { planForwardTermTransitions } from "./term-transition-coordinator.service.js"

const trimesterSource: SchoolYearTermSource = {
  termFormat: "TRIMESTER",
  term1Start: new Date("2030-06-01T00:00:00.000Z"),
  term1End: new Date("2030-09-30T00:00:00.000Z"),
  term2Start: new Date("2030-10-01T00:00:00.000Z"),
  term2End: new Date("2031-01-31T00:00:00.000Z"),
  term3Start: new Date("2031-02-03T00:00:00.000Z"),
  term3End: new Date("2031-05-31T00:00:00.000Z"),
  term4Start: null,
  term4End: null,
  term1Label: "TERM 1",
  term2Label: "TERM 2",
  term3Label: "TERM 3",
  term4Label: "QUARTER 4",
}

const event: TermChangedEventV2 = {
  event: "TERM_CHANGED",
  eventId: "6f3dbeb6-ef70-4a0e-bcba-dbc98060bb24",
  source: "enrollpro",
  producedBy: "ep-scheduler",
  schoolId: "school-a",
  schoolYearId: 10,
  from: { term: "T1", termIndex: 1, label: "TERM 1" },
  to: { term: "T2", termIndex: 2, label: "TERM 2" },
  effectiveDate: "2030-10-01",
  timestamp: "2030-10-01T00:00:00.000Z",
  from_term: "TERM 1",
  to_term: "TERM 2",
}

test("validates the complete v2 payload and compatibility labels", () => {
  assert.deepEqual(termChangedEventV2Schema.parse(event), event)
  assert.throws(() => termChangedEventV2Schema.parse({ ...event, to_term: "TERM 3" }))
})

test("resolves Manila midnight at a trimester boundary", () => {
  const terms = buildOrderedTermContract(trimesterSource)
  assert.equal(
    resolveActiveTermEntry(terms, new Date("2030-09-30T15:59:59.999Z")).identity,
    "T1",
  )
  assert.equal(
    resolveActiveTermEntry(terms, new Date("2030-09-30T16:00:00.000Z")).identity,
    "T2",
  )
})

test("supports quarter calendars", () => {
  const terms = buildOrderedTermContract({
    ...trimesterSource,
    termFormat: "QUARTERS",
    term3End: new Date("2031-03-31T00:00:00.000Z"),
    term4Start: new Date("2031-04-01T00:00:00.000Z"),
    term4End: new Date("2031-05-31T00:00:00.000Z"),
    term4Label: "QUARTER 4",
  })
  assert.equal(terms.length, 4)
  assert.equal(terms[3]?.identity, "T4")
})

test("locks grading to the most recently ended term on a gap day", () => {
  const terms = buildOrderedTermContract(trimesterSource)
  const resolved = resolveActiveTermEntry(terms, new Date("2031-02-01T04:00:00.000Z"))
  assert.equal(resolved.identity, "T2")
  assert.equal(resolved.isGradingLocked, true)
})

test("initializes null checkpoints without creating a prior transition", () => {
  const terms = buildOrderedTermContract(trimesterSource)
  assert.deepEqual(planForwardTermTransitions(terms, null, "T2"), { state: "INITIALIZE" })
})

test("rejects backward movement and plans every missed forward boundary", () => {
  const terms = buildOrderedTermContract(trimesterSource)
  assert.deepEqual(planForwardTermTransitions(terms, "T3", "T2"), { state: "BACKWARD" })
  const plan = planForwardTermTransitions(terms, "T1", "T3")
  assert.equal(plan.state, "ADVANCE")
  if (plan.state === "ADVANCE") {
    assert.deepEqual(
      plan.transitions.map(({ from, to }) => `${from.identity}->${to.identity}`),
      ["T1->T2", "T2->T3"],
    )
  }
})

test("publishes persistent JSON and waits for broker confirmation", async () => {
  const calls: Array<{ exchange: string; key: string; body: string; options: unknown }> = []
  let confirmed = false
  const fakeChannel = {
    publish(exchange: string, key: string, body: Buffer, options: unknown) {
      calls.push({ exchange, key, body: body.toString("utf8"), options })
      return true
    },
    async waitForConfirms() {
      confirmed = true
    },
  }

  await publishTermChangedMessage(fakeChannel, "aims.calendar.fanout", event)
  await publishTermChangedMessage(fakeChannel, "aims.calendar.fanout", event)
  assert.equal(confirmed, true)
  assert.equal(calls.length, 2)
  assert.equal(calls[0]?.key, "")
  assert.equal(JSON.parse(calls[0]!.body).eventId, event.eventId)
  assert.equal(JSON.parse(calls[1]!.body).eventId, event.eventId)
  assert.deepEqual(calls[0]?.options, {
    persistent: true,
    contentType: "application/json",
    contentEncoding: "utf-8",
    type: "TERM_CHANGED",
    messageId: event.eventId,
    timestamp: Math.floor(Date.parse(event.timestamp) / 1_000),
  })
})

test("uses bounded exponential retry delays", () => {
  assert.equal(calculateTermEventRetryDelay(1), 5_000)
  assert.equal(calculateTermEventRetryDelay(2), 10_000)
  assert.equal(calculateTermEventRetryDelay(100), 300_000)
})

test("does not copy connection error details into the outbox", () => {
  const error = Object.assign(
    new Error("connect amqp://user:password@private-host failed"),
    { code: "ECONNREFUSED" },
  )
  assert.equal(sanitizeTermEventError(error), "Error:ECONNREFUSED")
})
