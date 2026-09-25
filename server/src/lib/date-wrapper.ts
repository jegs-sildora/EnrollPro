import type { Request } from "express"

interface SystemDateOverride {
  mockedTimestamp: number
  anchoredAt: number
}

let systemDateOverride: SystemDateOverride | null = null

export function setSystemDateOverride(mockedDate: Date): void {
  systemDateOverride = {
    mockedTimestamp: mockedDate.getTime(),
    anchoredAt: Date.now(),
  }
}

export function clearSystemDateOverride(): void {
  systemDateOverride = null
}

export function getSystemDateOverride(): Date | null {
  if (!systemDateOverride) return null

  const elapsedMilliseconds = Math.max(0, Date.now() - systemDateOverride.anchoredAt)
  return new Date(systemDateOverride.mockedTimestamp + elapsedMilliseconds)
}

/**
 * ONLY use this wrapper for lifecycle and configured-period evaluation.
 * Do NOT use it for database created_at timestamps, JWT expiration checks, or audit logs, to preserve system integrity.
 */
export function getSystemDate(req: Request): Date {
  const mockDateHeader = req.headers["x-mock-date"]

  if (mockDateHeader && typeof mockDateHeader === "string") {
    const parsed = new Date(mockDateHeader)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return getSystemDateOverride() ?? new Date()
}
