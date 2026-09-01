import type { Request, Response } from "express";

import type { CompanionSsoExchangeInput } from "@enrollpro/shared";

import {
  createCompanionSsoLaunch,
  exchangeCompanionSsoCode,
  getCompanionSsoCatalog,
  parseCompanionSystem,
} from "./companion-sso.service.js";

function readBearerSecret(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const secret = authorization.slice("Bearer ".length).trim();
  return secret || null;
}

function readSystemParameter(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export async function companionSsoCatalog(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(await getCompanionSsoCatalog(req.user!.userId));
}

export async function launchCompanionSso(
  req: Request,
  res: Response,
): Promise<void> {
  const system = parseCompanionSystem(readSystemParameter(req.params.system));
  const result = await createCompanionSsoLaunch({
    system,
    userId: req.user!.userId,
    req,
  });
  res.status(201).json(result);
}

export async function exchangeCompanionSso(
  req: Request,
  res: Response,
): Promise<void> {
  const system = parseCompanionSystem(readSystemParameter(req.params.system));
  const { code } = req.body as CompanionSsoExchangeInput;
  const result = await exchangeCompanionSsoCode({
    system,
    code,
    bearerSecret: readBearerSecret(req),
    req,
  });
  res.json(result);
}
