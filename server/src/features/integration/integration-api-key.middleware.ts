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

export function requireIntegrationApiKey(...environmentVariables: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Get the provided token from X-Integration-Key or Authorization header
    const headerToken = req.header("x-integration-key")?.trim()
    
    const authHeader = req.header("authorization")?.trim()
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
    
    const providedToken = headerToken || bearerToken
    
    if (!providedToken) {
      res.status(401).json({
        error: {
          code: "INVALID_INTEGRATION_KEY",
          message: "A valid integration key is required.",
        },
      })
      return
    }

    // 2. Check against all provided environment variables
    const isValid = environmentVariables.some((envVar) => {
      const configuredKey = process.env[envVar]?.trim()
      if (!configuredKey) return false
      return secretsMatch(providedToken, configuredKey)
    })

    if (!isValid) {
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
