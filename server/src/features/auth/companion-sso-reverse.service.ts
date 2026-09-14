import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

import {
  companionSsoReverseExchangeResponseSchema,
  type CompanionSsoReverseExchangeResponse,
  type CompanionSystem,
} from "@enrollpro/shared";

import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

const REVERSE_STATE_AUDIENCE = "enrollpro-companion-reverse-sso";
const REVERSE_STATE_PURPOSE = "COMPANION_REVERSE_SSO";
const REVERSE_STATE_TTL_SECONDS = 300;
const REVERSE_EXCHANGE_TIMEOUT_MS = 5_000;
export const REVERSE_COMPLETION_CACHE_TTL_MS = 30_000;

interface ReverseCompletionEntry {
  promise: Promise<ReverseSsoUser>;
  expiresAt: number;
}

const reverseCompletions = new Map<string, ReverseCompletionEntry>();

const reverseUserSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  employeeId: true,
  accountName: true,
  roles: true,
  mustChangePassword: true,
  isActive: true,
  lastLoginAt: true,
  learnerProfile: {
    select: {
      lrn: true,
      status: true,
    },
  },
  teacherProfile: {
    select: {
      employeeId: true,
    },
  },
} satisfies Prisma.UserSelect;

export type ReverseSsoUser = Prisma.UserGetPayload<{
  select: typeof reverseUserSelect;
}>;

interface ReverseConfiguration {
  authorizeUrl: URL;
  exchangeUrl: URL;
  clientId: string;
  clientSecret: string;
}

interface ReverseStateClaims extends jwt.JwtPayload {
  purpose: typeof REVERSE_STATE_PURPOSE;
  system: CompanionSystem;
  nonce: string;
}

interface RequestAuditContext {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

function reverseConfigurationNames(system: CompanionSystem): {
  authorizeUrl: string;
  exchangeUrl: string;
  clientId: string;
  clientSecret: string;
} {
  return {
    authorizeUrl: `${system}_SSO_REVERSE_AUTHORIZE_URL`,
    exchangeUrl: `${system}_SSO_REVERSE_EXCHANGE_URL`,
    clientId: `${system}_SSO_REVERSE_CLIENT_ID`,
    clientSecret: `${system}_SSO_REVERSE_CLIENT_SECRET`,
  };
}

function parseSecureUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  const secure = url.protocol === "https:";
  const localDevelopment =
    process.env.NODE_ENV !== "production"
    && url.protocol === "http:"
    && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (!secure && !localDevelopment)
    || url.username
    || url.password
    || url.hash
  ) {
    return null;
  }
  return url;
}

function getReverseConfiguration(system: CompanionSystem): ReverseConfiguration {
  const names = reverseConfigurationNames(system);
  const authorizeUrl = parseSecureUrl(process.env[names.authorizeUrl]);
  const exchangeUrl = parseSecureUrl(process.env[names.exchangeUrl]);
  const clientId = process.env[names.clientId]?.trim();
  const clientSecret = process.env[names.clientSecret]?.trim();
  const placeholderSecret = clientSecret
    ? /(replace|placeholder|example|change[_-]?me|your[_-])/i.test(clientSecret)
    : true;

  if (
    !authorizeUrl
    || !exchangeUrl
    || authorizeUrl.origin !== exchangeUrl.origin
    || !clientId
    || !clientSecret
    || clientSecret.length < 32
    || placeholderSecret
  ) {
    throw new AppError(
      503,
      `${system} reverse login is not configured.`,
      "COMPANION_REVERSE_SSO_NOT_CONFIGURED",
    );
  }

  return { authorizeUrl, exchangeUrl, clientId, clientSecret };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(
      500,
      "JWT secret is not configured on the server.",
      "JWT_SECRET_MISSING",
    );
  }
  return secret;
}

function getEnrollProPublicUrl(): URL {
  const configured = parseSecureUrl(process.env.ENROLLPRO_PUBLIC_URL);
  if (!configured) {
    throw new AppError(
      503,
      "EnrollPro public URL is not configured for reverse SSO.",
      "ENROLLPRO_PUBLIC_URL_MISSING",
    );
  }
  return configured;
}

export function reverseStateCookieName(system: CompanionSystem): string {
  return `enrollpro_reverse_sso_${system.toLowerCase()}`;
}

function callbackUrl(system: CompanionSystem): URL {
  return new URL(
    `/api/auth/companion-sso/${system.toLowerCase()}/reverse/callback`,
    getEnrollProPublicUrl(),
  );
}

function createStateToken(system: CompanionSystem): string {
  return jwt.sign(
    {
      purpose: REVERSE_STATE_PURPOSE,
      system,
      nonce: randomBytes(24).toString("base64url"),
    },
    getJwtSecret(),
    {
      audience: REVERSE_STATE_AUDIENCE,
      expiresIn: REVERSE_STATE_TTL_SECONDS,
    },
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStateToken(input: {
  system: CompanionSystem;
  state: string;
  cookieState: string | null;
}): void {
  if (!input.cookieState || !constantTimeEqual(input.state, input.cookieState)) {
    throw new AppError(
      401,
      "The reverse SSO request state is invalid or expired.",
      "COMPANION_REVERSE_SSO_STATE_INVALID",
    );
  }

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(input.state, getJwtSecret(), {
      audience: REVERSE_STATE_AUDIENCE,
    });
  } catch {
    throw new AppError(
      401,
      "The reverse SSO request state is invalid or expired.",
      "COMPANION_REVERSE_SSO_STATE_INVALID",
    );
  }

  if (
    typeof decoded === "string"
    || decoded.purpose !== REVERSE_STATE_PURPOSE
    || decoded.system !== input.system
    || typeof decoded.nonce !== "string"
    || decoded.nonce.length < 32
  ) {
    throw new AppError(
      401,
      "The reverse SSO request state is invalid or expired.",
      "COMPANION_REVERSE_SSO_STATE_INVALID",
    );
  }
}

export async function createCompanionReverseStart(
  system: CompanionSystem,
  req: RequestAuditContext,
): Promise<{
  authorizeUrl: string;
  state: string;
  stateMaxAgeMs: number;
}> {
  const configuration = getReverseConfiguration(system);
  const state = createStateToken(system);
  const redirectUri = callbackUrl(system).toString();
  const authorizeUrl = new URL(configuration.authorizeUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", configuration.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  await auditLog({
    actionType: "COMPANION_REVERSE_SSO_STARTED",
    description: `EnrollPro started reverse SSO from ${system}.`,
    subjectType: "CompanionSystem",
    metadata: { companion: system },
    req,
  });

  return {
    authorizeUrl: authorizeUrl.toString(),
    state,
    stateMaxAgeMs: REVERSE_STATE_TTL_SECONDS * 1000,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AppError(
      502,
      "The companion returned an invalid reverse SSO response.",
      "COMPANION_REVERSE_SSO_RESPONSE_INVALID",
    );
  }
}

interface CompanionErrorDetails {
  code: string;
  csrfRejected: boolean;
}

async function readCompanionErrorDetails(
  response: Response,
): Promise<CompanionErrorDetails> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const details = body as Record<string, unknown>;
      const code = typeof details.code === "string"
        && /^[A-Z0-9_]{1,64}$/.test(details.code)
        ? details.code
        : "UNSPECIFIED";
      const message = [details.error, details.message]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLocaleLowerCase("en-PH");
      return {
        code,
        csrfRejected: message.includes("csrf"),
      };
    }
  } catch {
    // The browser still receives a stable EnrollPro error for a malformed response.
  }
  return { code: "UNSPECIFIED", csrfRejected: false };
}

async function exchangeCodeWithCompanion(input: {
  system: CompanionSystem;
  code: string;
}): Promise<CompanionSsoReverseExchangeResponse> {
  const configuration = getReverseConfiguration(input.system);
  const redirectUri = callbackUrl(input.system).toString();
  let response: Response;

  try {
    response = await fetch(configuration.exchangeUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${configuration.clientSecret}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        code: input.code,
        clientId: configuration.clientId,
        redirectUri,
      }),
      signal: AbortSignal.timeout(REVERSE_EXCHANGE_TIMEOUT_MS),
    });
  } catch {
    throw new AppError(
      503,
      `${input.system} could not complete reverse SSO. Start again.`,
      "COMPANION_REVERSE_SSO_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    const companionError = await readCompanionErrorDetails(response);
    console.error(
      "[ReverseSSO] %s exchange failed with HTTP %s, code %s, csrfRejected=%s",
      input.system,
      response.status,
      companionError.code,
      companionError.csrfRejected,
    );

    if (companionError.code === "COMPANION_SSO_CLIENT_INVALID") {
      throw new AppError(
        503,
        `${input.system} rejected EnrollPro's reverse SSO client credentials.`,
        "COMPANION_REVERSE_SSO_CONFIGURATION_ERROR",
      );
    }
    if ([400, 401].includes(response.status)) {
      throw new AppError(
        401,
        "The companion sign-in code is invalid, expired, or already used.",
        "COMPANION_REVERSE_SSO_CODE_INVALID",
      );
    }
    if (response.status === 403) {
      if (companionError.csrfRejected) {
        throw new AppError(
          503,
          `${input.system} rejected the server-to-server SSO exchange configuration.`,
          "COMPANION_REVERSE_SSO_CONFIGURATION_ERROR",
        );
      }
      throw new AppError(
        403,
        "The companion account is not authorized for EnrollPro.",
        "COMPANION_REVERSE_SSO_ACCESS_DENIED",
      );
    }
    throw new AppError(
      503,
      `${input.system} could not complete reverse SSO. Start again.`,
      "COMPANION_REVERSE_SSO_UNAVAILABLE",
    );
  }

  const parsed = companionSsoReverseExchangeResponseSchema.safeParse(
    await readJson(response),
  );
  if (!parsed.success || parsed.data.issuer !== input.system) {
    console.error(
      "[ReverseSSO] %s exchange response failed validation: %s",
      input.system,
      parsed.success ? `issuer mismatch (${parsed.data.issuer})` : parsed.error.message,
    );
    throw new AppError(
      502,
      "The companion returned an invalid reverse SSO response.",
      "COMPANION_REVERSE_SSO_RESPONSE_INVALID",
    );
  }
  return parsed.data;
}

function assertUserCanEnterEnrollPro(user: ReverseSsoUser): void {
  if (!user.isActive) {
    throw new AppError(
      401,
      "The linked EnrollPro account is unavailable.",
      "COMPANION_REVERSE_SSO_ACCOUNT_UNAVAILABLE",
    );
  }
}

async function resolveUserById(input: {
  assertion: CompanionSsoReverseExchangeResponse["identity"];
  authenticatedAt: Date;
}): Promise<ReverseSsoUser> {
  let user = null;
  if (input.assertion.userId) {
    user = await prisma.user.findUnique({
      where: { id: input.assertion.userId },
      select: reverseUserSelect,
    });
  } else if (input.assertion.employeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: input.assertion.employeeId },
      select: reverseUserSelect,
    });
  }

  if (!user) {
    throw new AppError(
      401,
      "The EnrollPro user ID does not identify an account.",
      "COMPANION_REVERSE_SSO_USER_NOT_FOUND",
    );
  }

  assertUserCanEnterEnrollPro(user);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: input.authenticatedAt },
  });
  return { ...user, lastLoginAt: input.authenticatedAt };
}

function reverseCompletionKey(input: {
  system: CompanionSystem;
  code: string;
  state: string;
}): string {
  return createHash("sha256")
    .update(input.system)
    .update("\0")
    .update(input.state)
    .update("\0")
    .update(input.code)
    .digest("hex");
}

async function completeCompanionReverseSsoOnce(input: {
  system: CompanionSystem;
  code: string;
  req: RequestAuditContext;
}): Promise<ReverseSsoUser> {
  const assertion = await exchangeCodeWithCompanion({
    system: input.system,
    code: input.code,
  });

  const authenticatedAt = new Date();
  const user = await resolveUserById({
    assertion: assertion.identity,
    authenticatedAt,
  });

  await auditLog({
    userId: user.id,
    actionType: "COMPANION_REVERSE_SSO_LOGIN",
    description: `${input.system} authenticated a user into EnrollPro.`,
    subjectType: "CompanionSystem",
    metadata: {
      companion: input.system,
      assertedUserId: assertion.identity.userId,
    },
    req: input.req,
  });
  return user;
}

export async function completeCompanionReverseSso(input: {
  system: CompanionSystem;
  code: string;
  state: string;
  cookieState: string | null;
  req: RequestAuditContext;
}): Promise<ReverseSsoUser> {
  try {
    verifyStateToken(input);
  } catch (error: unknown) {
    console.error(
      "[ReverseSSO] Callback failed for %s:",
      input.system,
      error instanceof AppError
        ? `${error.code}: ${error.message}`
        : error,
    );
    if (!(error instanceof AppError) && error instanceof Error && error.stack) {
      console.error("[ReverseSSO] Stack:", error.stack);
    }
    await auditLog({
      actionType: "COMPANION_REVERSE_SSO_DENIED",
      description: `${input.system} reverse SSO was denied.`,
      subjectType: "CompanionSystem",
      metadata: {
        companion: input.system,
        reason: error instanceof AppError ? error.code : "REVERSE_SSO_FAILED",
      },
      req: input.req,
    });
    throw error;
  }

  const completionKey = reverseCompletionKey(input);
  const existing = reverseCompletions.get(completionKey);
  if (existing && existing.expiresAt > Date.now()) {
    console.info(
      "[ReverseSSO] Coalesced duplicate %s callback into the active exchange.",
      input.system,
    );
    return existing.promise;
  }
  if (existing) reverseCompletions.delete(completionKey);

  const promise = (async () => {
    try {
      return await completeCompanionReverseSsoOnce(input);
    } catch (error: unknown) {
      console.error(
        "[ReverseSSO] Callback failed for %s:",
        input.system,
        error instanceof AppError
          ? `${error.code}: ${error.message}`
          : error,
      );
      if (!(error instanceof AppError) && error instanceof Error && error.stack) {
        console.error("[ReverseSSO] Stack:", error.stack);
      }
      await auditLog({
        actionType: "COMPANION_REVERSE_SSO_DENIED",
        description: `${input.system} reverse SSO was denied.`,
        subjectType: "CompanionSystem",
        metadata: {
          companion: input.system,
          reason: error instanceof AppError ? error.code : "REVERSE_SSO_FAILED",
        },
        req: input.req,
      });
      throw error;
    }
  })();
  const entry: ReverseCompletionEntry = {
    promise,
    expiresAt: Date.now() + REVERSE_COMPLETION_CACHE_TTL_MS,
  };
  reverseCompletions.set(completionKey, entry);

  const cleanupTimer = setTimeout(() => {
    if (reverseCompletions.get(completionKey) === entry) {
      reverseCompletions.delete(completionKey);
    }
  }, REVERSE_COMPLETION_CACHE_TTL_MS);
  cleanupTimer.unref();

  return promise;
}
