import "dotenv/config"

import { disconnectPrisma } from "../lib/prisma.js"
import {
  publishPendingTermEvents,
  stopTermChangedPublisher,
} from "../features/school-year/services/term-changed-publisher.service.js"
import { getTermEventsConfig } from "../features/school-year/services/term-events.config.js"
import { reconcileTermTransitions } from "../features/school-year/services/term-transition-coordinator.service.js"

function readMockDate(): Date {
  const argument = process.argv.slice(2).find((value) => value.startsWith("--date="))
  const raw = argument?.slice("--date=".length)
  if (!raw) throw new Error("Provide an explicit date with --date=YYYY-MM-DD.")

  const parsed = new Date(`${raw}T00:00:00+08:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(parsed.getTime())) {
    throw new Error("The mock date must use YYYY-MM-DD.")
  }
  return parsed
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The term-event mock clock is forbidden in production.")
  }
  if (process.env.TERM_EVENTS_ENABLE_MOCK_CLOCK !== "true") {
    throw new Error("Set TERM_EVENTS_ENABLE_MOCK_CLOCK=true to run the mock clock.")
  }

  const config = getTermEventsConfig()
  const result = await reconcileTermTransitions({
    schoolId: config.schoolId,
    now: readMockDate(),
    producedBy: "ep-mock-clock",
  })
  const published = await publishPendingTermEvents(config)
  console.info(
    `[TermEvents] Mock tick completed: state=${result.state}, enqueued=${result.enqueued}, published=${published}.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(
      "[TermEvents] Mock tick failed:",
      error instanceof Error ? error.message : "Unknown error",
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await stopTermChangedPublisher()
    await disconnectPrisma()
  })
