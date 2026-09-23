import { createHash } from "node:crypto"

const DEFAULT_SCHEDULER_INTERVAL_MS = 60_000
const DEFAULT_PUBLISH_INTERVAL_MS = 5_000
const MIN_INTERVAL_MS = 1_000
const DEVELOPMENT_CREDENTIAL_FINGERPRINT = "e01fcd159141dc23795052e7eba74f3849e06297794b40da9bea293b037efffd"

export interface TermEventsConfig {
  schoolId: string
  schedulerIntervalMs: number
  rabbitMqUrl: string
  exchange: string
  publishIntervalMs: number
}

export interface TermEventsCoordinatorConfig {
  schoolId: string
  schedulerIntervalMs: number
}

function readInterval(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_INTERVAL_MS) {
    throw new Error(`${name} must be an integer of at least ${MIN_INTERVAL_MS} milliseconds.`)
  }
  return value
}

export function getTermEventsCoordinatorConfig(): TermEventsCoordinatorConfig {
  const schoolId = process.env.TERM_EVENTS_SCHOOL_ID?.trim()
  if (!schoolId) throw new Error("TERM_EVENTS_SCHOOL_ID is not configured.")

  return {
    schoolId,
    schedulerIntervalMs: readInterval(
      "TERM_EVENTS_SCHEDULER_INTERVAL_MS",
      DEFAULT_SCHEDULER_INTERVAL_MS,
    ),
  }
}

export function getTermEventsConfig(): TermEventsConfig {
  const coordinator = getTermEventsCoordinatorConfig()
  const rabbitMqUrl = process.env.RABBITMQ_URL?.trim()
  const exchange = process.env.TERM_EVENTS_EXCHANGE?.trim() || "aims.calendar.fanout"

  if (!rabbitMqUrl) throw new Error("RABBITMQ_URL is not configured.")

  let parsed: URL
  try {
    parsed = new URL(rabbitMqUrl)
  } catch {
    throw new Error("RABBITMQ_URL is invalid.")
  }
  if (parsed.protocol !== "amqp:" && parsed.protocol !== "amqps:") {
    throw new Error("RABBITMQ_URL must use amqp or amqps.")
  }

  const credentialFingerprint = createHash("sha256")
    .update(`${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`)
    .digest("hex")
  if (process.env.NODE_ENV === "production" && credentialFingerprint === DEVELOPMENT_CREDENTIAL_FINGERPRINT) {
    throw new Error("Development RabbitMQ credentials are forbidden in production.")
  }

  return {
    ...coordinator,
    rabbitMqUrl,
    exchange,
    publishIntervalMs: readInterval(
      "TERM_EVENTS_PUBLISH_INTERVAL_MS",
      DEFAULT_PUBLISH_INTERVAL_MS,
    ),
  }
}
