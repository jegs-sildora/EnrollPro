import type {
  IntegrationTermEntry,
  IntegrationTermIdentity,
  IntegrationTermLabels,
  TermFormat,
} from "@enrollpro/shared"

export type TermContractErrorCode =
  | "TERM_FORMAT_UNSUPPORTED"
  | "TERM_ENTRY_INVALID"
  | "TERM_DATE_RANGE_INVALID"
  | "TERM_ORDER_INVALID"
  | "ACTIVE_TERM_UNRESOLVED"

export class TermContractError extends Error {
  constructor(
    public readonly code: TermContractErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "TermContractError"
  }
}

export interface SchoolYearTermSource {
  termFormat: TermFormat
  term1Start: Date | null
  term1End: Date | null
  term2Start: Date | null
  term2End: Date | null
  term3Start: Date | null
  term3End: Date | null
  term4Start: Date | null
  term4End: Date | null
  term1Label: string
  term2Label: string
  term3Label: string
  term4Label: string
}

const IDENTITIES = ["T1", "T2", "T3", "T4"] as const

export function getCanonicalTermLabels(termFormat: TermFormat): Required<IntegrationTermLabels> {
  const prefix = termFormat === "QUARTERS" ? "QUARTER" : "TERM"
  return {
    T1: `${prefix} 1`,
    T2: `${prefix} 2`,
    T3: `${prefix} 3`,
    T4: "QUARTER 4",
  }
}

export function resolveStoredTermLabels(
  termFormat: TermFormat,
  labels?: Partial<Required<IntegrationTermLabels>>,
): Required<IntegrationTermLabels> {
  const canonical = getCanonicalTermLabels(termFormat)
  return {
    T1: labels?.T1 ?? canonical.T1,
    T2: labels?.T2 ?? canonical.T2,
    T3: labels?.T3 ?? canonical.T3,
    T4: labels?.T4 ?? canonical.T4,
  }
}

export function mergeStoredTermLabels(
  termFormat: TermFormat,
  stored: Required<IntegrationTermLabels>,
  updates?: Partial<Required<IntegrationTermLabels>>,
  resetUnspecifiedToCanonical = false,
): Required<IntegrationTermLabels> {
  const base = resetUnspecifiedToCanonical
    ? getCanonicalTermLabels(termFormat)
    : stored

  return {
    T1: updates?.T1 ?? base.T1,
    T2: updates?.T2 ?? base.T2,
    T3: updates?.T3 ?? base.T3,
    T4: updates?.T4 ?? base.T4,
  }
}

function toDateOnly(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new TermContractError(
      "TERM_DATE_RANGE_INVALID",
      "A configured term date is invalid.",
    )
  }
  return value.toISOString().slice(0, 10)
}

function manilaDateOnly(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) {
    throw new TermContractError(
      "ACTIVE_TERM_UNRESOLVED",
      "The current Manila calendar date could not be resolved.",
    )
  }
  return `${year}-${month}-${day}`
}

export function buildOrderedTermContract(
  source: SchoolYearTermSource,
): IntegrationTermEntry[] {
  if (source.termFormat !== "TRIMESTER" && source.termFormat !== "QUARTERS") {
    throw new TermContractError(
      "TERM_FORMAT_UNSUPPORTED",
      `Unsupported term format: ${source.termFormat}`,
    )
  }

  const count = source.termFormat === "TRIMESTER" ? 3 : 4
  const starts = [
    source.term1Start,
    source.term2Start,
    source.term3Start,
    source.term4Start,
  ]
  const ends = [
    source.term1End,
    source.term2End,
    source.term3End,
    source.term4End,
  ]
  const labels = [
    source.term1Label,
    source.term2Label,
    source.term3Label,
    source.term4Label,
  ]

  const terms: IntegrationTermEntry[] = []
  for (let index = 0; index < count; index += 1) {
    const identity = IDENTITIES[index]
    const start = starts[index]
    const end = ends[index]
    const label = labels[index]
    if (!identity || !start || !end || typeof label !== "string" || label.trim().length === 0) {
      throw new TermContractError(
        "TERM_ENTRY_INVALID",
        `Term ${index + 1} must have an identity, display label, start date, and end date.`,
      )
    }

    const startDate = toDateOnly(start)
    const endDate = toDateOnly(end)
    if (startDate > endDate) {
      throw new TermContractError(
        "TERM_DATE_RANGE_INVALID",
        `${identity} starts after it ends.`,
      )
    }

    const previous = terms[index - 1]
    if (previous && startDate <= previous.endDate) {
      throw new TermContractError(
        "TERM_ORDER_INVALID",
        `${identity} must start after ${previous.identity} ends.`,
      )
    }

    terms.push({
      identity,
      displayLabel: label,
      order: index + 1,
      startDate,
      endDate,
    })
  }

  return terms
}

export function resolveActiveTermEntry(
  terms: IntegrationTermEntry[],
  now: Date = new Date(),
): IntegrationTermEntry {
  const today = manilaDateOnly(now)
  const matches = terms.filter(
    (term) => today >= term.startDate && today <= term.endDate,
  )
  if (matches.length !== 1) {
    throw new TermContractError(
      "ACTIVE_TERM_UNRESOLVED",
      "No single configured term contains the current Manila calendar date.",
    )
  }
  return matches[0]!
}

export function isTermIdentity(value: string): value is IntegrationTermIdentity {
  return IDENTITIES.includes(value as IntegrationTermIdentity)
}
