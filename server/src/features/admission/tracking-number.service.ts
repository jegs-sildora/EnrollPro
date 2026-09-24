import { randomBytes } from "node:crypto"
import { Prisma } from "../../generated/prisma/index.js"

const MAX_RESERVATION_ATTEMPTS = 16

export type TrackingNumberSource = "SCP_ADMISSION" | "ENROLLMENT"
export type TrackingNumberPrefix = "ADM" | "ENR"

interface ReserveTrackingNumberInput {
  source: TrackingNumberSource
  prefix: TrackingNumberPrefix
  programAcronym: string
  schoolYearStart: string | number
  learnerId: number
}

interface TrackingNumberReservationClient {
  trackingNumberReservation: {
    create(args: {
      data: {
        trackingNumber: string
        source: TrackingNumberSource
      }
    }): Promise<unknown>
  }
}

function normalizeSegment(value: string | number): string {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function buildPrimaryCandidate(input: ReserveTrackingNumberInput): string {
  const learnerId = String(input.learnerId).padStart(7, "0")
  return `${input.prefix}-${normalizeSegment(input.programAcronym)}${normalizeSegment(input.schoolYearStart)}${learnerId}`
}

function buildFallbackCandidate(input: ReserveTrackingNumberInput): string {
  const randomSuffix = randomBytes(6).toString("hex").toUpperCase()
  return `${input.prefix}-${normalizeSegment(input.programAcronym)}${normalizeSegment(input.schoolYearStart)}${randomSuffix}`
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

/**
 * Atomically claims a tracking number in the shared registry. The registry's
 * primary key is the final authority, so concurrent admission and enrollment
 * requests cannot receive the same public number.
 */
export async function reserveTrackingNumber(
  tx: TrackingNumberReservationClient,
  input: ReserveTrackingNumberInput,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RESERVATION_ATTEMPTS; attempt += 1) {
    const trackingNumber = attempt === 0
      ? buildPrimaryCandidate(input)
      : buildFallbackCandidate(input)

    try {
      await tx.trackingNumberReservation.create({
        data: {
          trackingNumber,
          source: input.source,
        },
      })
      return trackingNumber
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error
      }
    }
  }

  throw new Error("Unable to reserve a unique tracking number.")
}
