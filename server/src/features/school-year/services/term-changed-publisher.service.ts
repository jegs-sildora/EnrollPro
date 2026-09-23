import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib"

import { termChangedEventV2Schema, type TermChangedEventV2 } from "@enrollpro/shared"

import { prisma } from "../../../lib/prisma.js"
import {
  getTermEventsConfig,
  getTermEventsCoordinatorConfig,
  type TermEventsConfig,
  type TermEventsCoordinatorConfig,
} from "./term-events.config.js"
import { reconcileTermTransitions } from "./term-transition-coordinator.service.js"

const LEASE_DURATION_MS = 30_000
const MAX_RETRY_DELAY_MS = 5 * 60_000
const BASE_RETRY_DELAY_MS = 5_000

let connection: ChannelModel | null = null
let channel: ConfirmChannel | null = null
let coordinatorTimer: NodeJS.Timeout | null = null
let publisherTimer: NodeJS.Timeout | null = null
let coordinatorTask: Promise<void> | null = null
let publisherTask: Promise<void> | null = null
let startupConfig: TermEventsConfig | null = null

export function calculateTermEventRetryDelay(attempts: number): number {
  const exponent = Math.max(0, Math.min(attempts - 1, 10))
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS)
}

export function sanitizeTermEventError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : ""
  const name = error instanceof Error ? error.name : "UnknownError"
  return [name, code].filter(Boolean).join(":").slice(0, 500)
}

async function resetBrokerConnection(): Promise<void> {
  const oldChannel = channel
  const oldConnection = connection
  channel = null
  connection = null
  await oldChannel?.close().catch(() => undefined)
  await oldConnection?.close().catch(() => undefined)
}

async function getConfirmChannel(config: TermEventsConfig): Promise<ConfirmChannel> {
  if (channel) return channel

  const nextConnection = await amqp.connect(config.rabbitMqUrl, { timeout: 10_000 })
  nextConnection.on("error", () => {
    channel = null
    connection = null
  })
  nextConnection.on("close", () => {
    channel = null
    connection = null
  })
  const nextChannel = await nextConnection.createConfirmChannel()
  nextChannel.on("error", () => {
    channel = null
  })
  nextChannel.on("close", () => {
    channel = null
  })
  await nextChannel.assertExchange(config.exchange, "fanout", { durable: true })
  connection = nextConnection
  channel = nextChannel
  return nextChannel
}

export async function publishTermChangedMessage(
  confirmChannel: Pick<ConfirmChannel, "publish" | "waitForConfirms">,
  exchange: string,
  event: TermChangedEventV2,
): Promise<void> {
  confirmChannel.publish(exchange, "", Buffer.from(JSON.stringify(event)), {
    persistent: true,
    contentType: "application/json",
    contentEncoding: "utf-8",
    type: event.event,
    messageId: event.eventId,
    timestamp: Math.floor(Date.parse(event.timestamp) / 1_000),
  })
  await confirmChannel.waitForConfirms()
}

async function claimNextEvent(now: Date) {
  const leaseUntil = new Date(now.getTime() + LEASE_DURATION_MS)
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.termChangedEventOutbox.findFirst({
      where: {
        publishedAt: null,
        OR: [
          { status: "PENDING", nextAttemptAt: { lte: now } },
          { status: "PUBLISHING", leaseUntil: { lte: now } },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    })
    if (!candidate) return null

    const claimed = await tx.termChangedEventOutbox.updateMany({
      where: {
        id: candidate.id,
        publishedAt: null,
        OR: [
          { status: "PENDING", nextAttemptAt: { lte: now } },
          { status: "PUBLISHING", leaseUntil: { lte: now } },
        ],
      },
      data: {
        status: "PUBLISHING",
        leaseUntil,
        attempts: { increment: 1 },
      },
    })
    if (claimed.count !== 1) return null
    return tx.termChangedEventOutbox.findUnique({ where: { id: candidate.id } })
  })
}

export async function publishPendingTermEvents(
  config: TermEventsConfig = getTermEventsConfig(),
): Promise<number> {
  let published = 0
  while (true) {
    const record = await claimNextEvent(new Date())
    if (!record) return published

    try {
      const event = termChangedEventV2Schema.parse(record.payload)
      const confirmChannel = await getConfirmChannel(config)
      await publishTermChangedMessage(confirmChannel, config.exchange, event)
      await prisma.termChangedEventOutbox.updateMany({
        where: { id: record.id, status: "PUBLISHING", publishedAt: null },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          leaseUntil: null,
          lastError: null,
        },
      })
      published += 1
    } catch (error: unknown) {
      const nextAttemptAt = new Date(
        Date.now() + calculateTermEventRetryDelay(record.attempts),
      )
      await prisma.termChangedEventOutbox.updateMany({
        where: { id: record.id, status: "PUBLISHING", publishedAt: null },
        data: {
          status: "PENDING",
          nextAttemptAt,
          leaseUntil: null,
          lastError: sanitizeTermEventError(error),
        },
      })
      await resetBrokerConnection()
      console.warn("[TermEvents] RabbitMQ publication failed; the event remains queued for retry.")
      return published
    }
  }
}

async function runCoordinator(config: TermEventsCoordinatorConfig): Promise<void> {
  try {
    const result = await reconcileTermTransitions({ schoolId: config.schoolId })
    if (result.state === "BACKWARD") {
      console.warn(
        `[TermEvents] Refused a backward active-term transition for school year ${result.schoolYearId}.`,
      )
    } else if (result.enqueued > 0) {
      console.info(`[TermEvents] Enqueued ${result.enqueued} term transition event(s).`)
    }
  } catch (error: unknown) {
    console.error(
      "[TermEvents] Term transition evaluation failed closed:",
      error instanceof Error ? error.message : "Unknown error",
    )
  }
}

async function runPublisher(config: TermEventsConfig): Promise<void> {
  try {
    await publishPendingTermEvents(config)
  } catch (error: unknown) {
    console.error("[TermEvents] Outbox publisher failed:", sanitizeTermEventError(error))
  }
}

function launchCoordinator(config: TermEventsCoordinatorConfig): void {
  if (coordinatorTask) return
  coordinatorTask = runCoordinator(config).finally(() => {
    coordinatorTask = null
  })
}

function launchPublisher(config: TermEventsConfig): void {
  if (publisherTask) return
  publisherTask = runPublisher(config).finally(() => {
    publisherTask = null
  })
}

export function startTermChangedPublisher(): void {
  if (coordinatorTimer || publisherTimer) return

  let coordinatorConfig: TermEventsCoordinatorConfig
  try {
    coordinatorConfig = getTermEventsCoordinatorConfig()
  } catch (error: unknown) {
    console.error(
      "[TermEvents] Coordinator is disabled:",
      error instanceof Error ? error.message : "Invalid configuration",
    )
    return
  }

  launchCoordinator(coordinatorConfig)
  coordinatorTimer = setInterval(
    () => launchCoordinator(coordinatorConfig),
    coordinatorConfig.schedulerIntervalMs,
  )
  coordinatorTimer.unref()

  try {
    startupConfig = getTermEventsConfig()
  } catch (error: unknown) {
    console.error(
      "[TermEvents] RabbitMQ publisher is disabled; transitions will remain in the outbox:",
      error instanceof Error ? error.message : "Invalid configuration",
    )
    return
  }

  launchPublisher(startupConfig)
  publisherTimer = setInterval(
    () => launchPublisher(startupConfig!),
    startupConfig.publishIntervalMs,
  )
  publisherTimer.unref()
}

export async function stopTermChangedPublisher(): Promise<void> {
  if (coordinatorTimer) clearInterval(coordinatorTimer)
  if (publisherTimer) clearInterval(publisherTimer)
  coordinatorTimer = null
  publisherTimer = null
  startupConfig = null
  await Promise.allSettled(
    [coordinatorTask, publisherTask].filter(
      (task): task is Promise<void> => task !== null,
    ),
  )
  await resetBrokerConnection()
}
