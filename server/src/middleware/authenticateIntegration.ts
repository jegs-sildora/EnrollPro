import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

function getConfiguredIntegrationKeys(): string[] {
  const rawValues = [
    process.env.INTEGRATION_API_KEY,
    process.env.INTEGRATION_API_KEYS,
  ].filter((value): value is string => Boolean(value));

  return rawValues
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function getProvidedIntegrationKey(req: Request): string | null {
  const headerKey = req.header("x-integration-key")?.trim();
  if (headerKey) {
    return headerKey;
  }

  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerValue = authHeader.slice(7).trim();
    return bearerValue.length > 0 ? bearerValue : null;
  }

  return null;
}

function safeCompare(value: string, expected: string): boolean {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function authenticateIntegration(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredKeys = getConfiguredIntegrationKeys();
  if (configuredKeys.length === 0) {
    res.status(503).json({
      code: "INTEGRATION_AUTH_NOT_CONFIGURED",
      message: "Integration authentication is not configured.",
    });
    return;
  }

  const providedKey = getProvidedIntegrationKey(req);
  if (!providedKey) {
    res.status(401).json({
      code: "INTEGRATION_KEY_REQUIRED",
      message:
        "Missing integration key. Provide X-Integration-Key or Bearer token.",
    });
    return;
  }

  const isAuthorized = configuredKeys.some((configuredKey) =>
    safeCompare(providedKey, configuredKey),
  );

  if (!isAuthorized) {
    res.status(403).json({
      code: "INTEGRATION_KEY_INVALID",
      message: "Integration key is invalid.",
    });
    return;
  }

  next();
}
