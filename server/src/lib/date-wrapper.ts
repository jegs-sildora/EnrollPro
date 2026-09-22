import type { Request } from "express"

/**
 * ONLY use this wrapper for Term Rollover evaluation.
 * Do NOT use it for database created_at timestamps, JWT expiration checks, or audit logs, to preserve system integrity.
 */
export function getSystemDate(req: Request): Date {
  const isDevOrStaging = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "staging"
  const mockDateHeader = req.headers["x-mock-date"]

  if (isDevOrStaging && mockDateHeader && typeof mockDateHeader === "string") {
    const parsed = new Date(mockDateHeader)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}
