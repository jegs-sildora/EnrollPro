import { timingSafeEqual } from "node:crypto"
import type { NextFunction, Request, Response } from "express"

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

export function requireIntegrationApiKey(environmentVariable: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const configuredKey = process.env[environmentVariable]?.trim()
    const providedHeader = req.header("x-integration-key")?.trim()

    if (
      !configuredKey ||
      !providedHeader ||
      !secretsMatch(providedHeader, configuredKey)
    ) {
      res.status(401).json({
        error: {
          code: "INVALID_INTEGRATION_KEY",
          message: "A valid integration key is required.",
        },
      })
      return
    }

    next()
  }
}
