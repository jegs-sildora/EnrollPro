import type { Request } from "express"

interface SystemDateOverride {
  mockedTimestamp: number
  anchoredAt: number
}

let systemDateOverride: SystemDateOverride | null = null

export function setSystemDateOverride(mockedDate: Date, anchor?: number): void {
  systemDateOverride = {
    mockedTimestamp: mockedDate.getTime(),
    anchoredAt: anchor ?? Date.now(),
  }
}

export async function initializeSystemDateOverride(): Promise<void> {
  const { prisma } = await import("./prisma.js")
  const setting = await prisma.schoolSetting.findFirst({
    select: { mockedSystemDate: true, mockedSystemDateAnchor: true },
  })

  if (setting?.mockedSystemDate && setting.mockedSystemDateAnchor) {
    systemDateOverride = {
      mockedTimestamp: setting.mockedSystemDate.getTime(),
      anchoredAt: Number(setting.mockedSystemDateAnchor),
    }
  } else {
    systemDateOverride = null
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

export function getSystemDateOverrideRaw(): SystemDateOverride | null {
  return systemDateOverride
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
