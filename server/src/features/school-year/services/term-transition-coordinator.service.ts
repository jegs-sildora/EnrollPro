import { randomUUID } from "node:crypto"

import {
  termChangedEventV2Schema,
  type IntegrationTermEntry,
  type IntegrationTermIdentity,
  type TermChangedEventV2,
} from "@enrollpro/shared"

import { Prisma } from "../../../generated/prisma/index.js"
import { prisma } from "../../../lib/prisma.js"
import { resolveActiveSchoolYearState } from "./active-school-year.service.js"
import {
  buildOrderedTermContract,
  isTermIdentity,
  resolveActiveTermEntry,
} from "./term-contract.service.js"

const TERM_TRANSITION_LOCK_NAMESPACE = 2_026
const TERM_TRANSITION_LOCK_KEY = 91_101

export type TermEventProducer = "ep-scheduler" | "ep-mock-clock"

export interface PlannedTransition {
  from: IntegrationTermEntry
  to: IntegrationTermEntry
}

export type TransitionPlan =
  | { state: "INITIALIZE" }
  | { state: "CURRENT" }
  | { state: "BACKWARD" }
  | { state: "ADVANCE"; transitions: PlannedTransition[] }

export interface ReconcileTermTransitionsResult {
  state: "UNINITIALIZED" | "INITIALIZED" | "CURRENT" | "BACKWARD" | "ADVANCED"
  schoolYearId?: number
  enqueued: number
}

export function planForwardTermTransitions(
  terms: IntegrationTermEntry[],
  storedIdentity: string | null,
  currentIdentity: IntegrationTermIdentity,
): TransitionPlan {
  if (storedIdentity === null) return { state: "INITIALIZE" }
  if (!isTermIdentity(storedIdentity)) {
    throw new Error("The persisted active-term checkpoint is invalid.")
  }

  const storedIndex = terms.findIndex((term) => term.identity === storedIdentity)
  const currentIndex = terms.findIndex((term) => term.identity === currentIdentity)
  if (storedIndex < 0 || currentIndex < 0) {
    throw new Error("The active-term checkpoint is not part of the configured term calendar.")
  }
  if (currentIndex === storedIndex) return { state: "CURRENT" }
  if (currentIndex < storedIndex) return { state: "BACKWARD" }

  const transitions: PlannedTransition[] = []
  for (let index = storedIndex; index < currentIndex; index += 1) {
    transitions.push({ from: terms[index]!, to: terms[index + 1]! })
  }
  return { state: "ADVANCE", transitions }
}

function createPayload(input: {
  eventId: string
  schoolId: string
  schoolYearId: number
  transition: PlannedTransition
  producedBy: TermEventProducer
  timestamp: Date
}): TermChangedEventV2 {
  const { from, to } = input.transition
  return termChangedEventV2Schema.parse({
    event: "TERM_CHANGED",
    eventId: input.eventId,
    source: "enrollpro",
    producedBy: input.producedBy,
    schoolId: input.schoolId,
    schoolYearId: input.schoolYearId,
    from: {
      term: from.identity,
      termIndex: from.order,
      label: from.displayLabel,
    },
    to: {
      term: to.identity,
      termIndex: to.order,
      label: to.displayLabel,
    },
    effectiveDate: to.startDate,
    timestamp: input.timestamp.toISOString(),
    from_term: from.displayLabel,
    to_term: to.displayLabel,
  })
}

export async function reconcileTermTransitions(input: {
  schoolId: string
  now?: Date
  producedBy?: TermEventProducer
}): Promise<ReconcileTermTransitionsResult> {
  const now = input.now ?? new Date()
  const producedBy = input.producedBy ?? "ep-scheduler"

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock($1, $2)",
      TERM_TRANSITION_LOCK_NAMESPACE,
      TERM_TRANSITION_LOCK_KEY,
    )

    const resolution = await resolveActiveSchoolYearState(tx)
    if (resolution.state === "UNINITIALIZED") {
      return { state: "UNINITIALIZED", enqueued: 0 }
    }
    if (resolution.state === "INVALID") {
      throw new Error(resolution.message)
    }

    const schoolYear = await tx.schoolYear.findUnique({
      where: { id: resolution.active.schoolYearId },
    })
    if (!schoolYear) throw new Error("The authoritative active school year was not found.")

    const terms = buildOrderedTermContract(schoolYear)
    const current = resolveActiveTermEntry(terms, now)
    const plan = planForwardTermTransitions(terms, schoolYear.activeTerm, current.identity)

    if (plan.state === "INITIALIZE") {
      await tx.schoolYear.update({
        where: { id: schoolYear.id },
        data: { activeTerm: current.identity },
      })
      return {
        state: "INITIALIZED",
        schoolYearId: schoolYear.id,
        enqueued: 0,
      }
    }
    if (plan.state === "CURRENT") {
      return { state: "CURRENT", schoolYearId: schoolYear.id, enqueued: 0 }
    }
    if (plan.state === "BACKWARD") {
      return { state: "BACKWARD", schoolYearId: schoolYear.id, enqueued: 0 }
    }

    let enqueued = 0
    for (const transition of plan.transitions) {
      const existing = await tx.termChangedEventOutbox.findFirst({
        where: {
          schoolSettingId: resolution.active.settingId,
          schoolYearId: schoolYear.id,
          fromTerm: transition.from.identity,
          toTerm: transition.to.identity,
          effectiveDate: new Date(`${transition.to.startDate}T00:00:00.000Z`),
        },
        select: { id: true },
      })
      if (existing) continue

      const eventId = randomUUID()
      const payload = createPayload({
        eventId,
        schoolId: input.schoolId,
        schoolYearId: schoolYear.id,
        transition,
        producedBy,
        timestamp: now,
      })
      await tx.termChangedEventOutbox.create({
        data: {
          eventId,
          schoolSettingId: resolution.active.settingId,
          schoolYearId: schoolYear.id,
          schoolId: input.schoolId,
          fromTerm: transition.from.identity,
          toTerm: transition.to.identity,
          effectiveDate: new Date(`${transition.to.startDate}T00:00:00.000Z`),
          payload: payload as Prisma.InputJsonValue,
          nextAttemptAt: now,
        },
      })
      enqueued += 1
    }

    await tx.schoolYear.update({
      where: { id: schoolYear.id },
      data: { activeTerm: current.identity },
    })
    return { state: "ADVANCED", schoolYearId: schoolYear.id, enqueued }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}
