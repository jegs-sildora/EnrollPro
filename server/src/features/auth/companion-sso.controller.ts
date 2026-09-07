import type { Request, Response } from "express";

import type { CompanionSsoExchangeInput } from "@enrollpro/shared";
import { companionSsoReverseCallbackSchema } from "@enrollpro/shared";

import { AppError } from "../../lib/AppError.js";
import { issueAuthSession } from "./auth.controller.js";
import {
  completeCompanionReverseSso,
  createCompanionReverseStart,
  reverseSsoLandingPath,
  reverseStateCookieName,
} from "./companion-sso-reverse.service.js";

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

function reverseCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/companion-sso",
    ...(maxAge ? { maxAge } : {}),
  };
}

function reverseErrorCode(error: unknown): string {
  return error instanceof AppError
    ? error.code
    : "COMPANION_REVERSE_SSO_FAILED";
}

export async function startCompanionReverseSso(
  req: Request,
  res: Response,
): Promise<void> {
  let system: ReturnType<typeof parseCompanionSystem> | null = null;
  try {
    system = parseCompanionSystem(readSystemParameter(req.params.system));
    const start = await createCompanionReverseStart(system, req);
    res.cookie(
      reverseStateCookieName(system),
      start.state,
      reverseCookieOptions(start.stateMaxAgeMs),
    );
    res.redirect(303, start.authorizeUrl);
  } catch (error: unknown) {
    const query = new URLSearchParams({
      ssoError: reverseErrorCode(error),
      ...(system ? { source: system } : {}),
    });
    res.redirect(303, `/personnel/login?${query.toString()}`);
  }
}

export async function completeCompanionReverseSsoCallback(
  req: Request,
  res: Response,
): Promise<void> {
  let system: ReturnType<typeof parseCompanionSystem> | null = null;
  try {
    system = parseCompanionSystem(readSystemParameter(req.params.system));
    const parsed = companionSsoReverseCallbackSchema.safeParse({
      code: req.query.code,
      state: req.query.state,
    });
    if (!parsed.success) {
      throw new AppError(
        400,
        "The reverse SSO callback is invalid.",
        "COMPANION_REVERSE_SSO_CALLBACK_INVALID",
      );
    }

    const cookieName = reverseStateCookieName(system);
    const cookieState = typeof req.cookies?.[cookieName] === "string"
      ? req.cookies[cookieName]
      : null;
    const user = await completeCompanionReverseSso({
      system,
      code: parsed.data.code,
      state: parsed.data.state,
      cookieState,
      req,
    });

    res.clearCookie(cookieName, reverseCookieOptions());
    issueAuthSession(res, user);
    res.redirect(303, reverseSsoLandingPath(user.roles));
  } catch (error: unknown) {
    if (system) {
      res.clearCookie(reverseStateCookieName(system), reverseCookieOptions());
    }
    const query = new URLSearchParams({
      ssoError: reverseErrorCode(error),
      ...(system ? { source: system } : {}),
    });
    res.redirect(303, `/personnel/login?${query.toString()}`);
  }
}
