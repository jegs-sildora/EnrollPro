import { randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

import {
  companionSsoReverseExchangeResponseSchema,
  type CompanionSsoReverseExchangeResponse,
  type CompanionSystem,
  type Role,
} from "@enrollpro/shared";

import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { resolveActiveSchoolYearState } from "../school-year/services/active-school-year.service.js";

const REVERSE_STATE_AUDIENCE = "enrollpro-companion-reverse-sso";
const REVERSE_STATE_PURPOSE = "COMPANION_REVERSE_SSO";
const REVERSE_STATE_TTL_SECONDS = 300;
const REVERSE_EXCHANGE_TIMEOUT_MS = 5_000;
const ENROLLPRO_STAFF_ROLES: readonly Role[] = [
  "SYSTEM_ADMIN",
  "HEAD_REGISTRAR",
  "TEACHER",
  "CLASS_ADVISER",
];

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
    if ([400, 401].includes(response.status)) {
      throw new AppError(
        401,
        "The companion sign-in code is invalid, expired, or already used.",
        "COMPANION_REVERSE_SSO_CODE_INVALID",
      );
    }
    if (response.status === 403) {
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
    throw new AppError(
      502,
      "The companion returned an invalid reverse SSO response.",
      "COMPANION_REVERSE_SSO_RESPONSE_INVALID",
    );
  }
  return parsed.data;
}

function normalizedName(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-PH");
}

function assertIdentityMatchesUser(
  assertion: CompanionSsoReverseExchangeResponse["identity"],
  user: ReverseSsoUser,
): void {
  if (
    normalizedName(assertion.firstName) !== normalizedName(user.firstName)
    || normalizedName(assertion.lastName) !== normalizedName(user.lastName)
    || (assertion.employeeId && assertion.employeeId !== user.employeeId)
    || (assertion.lrn && assertion.lrn !== user.learnerProfile?.lrn)
  ) {
    throw new AppError(
      409,
      "The companion identity does not match the linked EnrollPro account.",
      "COMPANION_REVERSE_SSO_IDENTITY_CONFLICT",
    );
  }
}

function assertUserCanEnterEnrollPro(user: ReverseSsoUser): void {
  if (!user.isActive) {
    throw new AppError(
      401,
      "The linked EnrollPro account is unavailable.",
      "COMPANION_REVERSE_SSO_ACCOUNT_UNAVAILABLE",
    );
  }
  if (user.mustChangePassword) {
    throw new AppError(
      428,
      "Change the default password in EnrollPro before using reverse SSO.",
      "PASSWORD_CHANGE_REQUIRED",
    );
  }
  if (user.learnerProfile?.status === "JHS_COMPLETER") {
    throw new AppError(
      403,
      "JHS completers cannot open an active EnrollPro staff workspace.",
      "COMPANION_REVERSE_SSO_COMPLETER_BLOCKED",
    );
  }
  const permitted = new Set<Role>(ENROLLPRO_STAFF_ROLES);
  if (!user.roles.some((role) => permitted.has(role))) {
    throw new AppError(
      403,
      "The linked account does not have access to an EnrollPro staff workspace.",
      "COMPANION_REVERSE_SSO_ROLE_DENIED",
    );
  }
}

async function findUnlinkedCandidate(
  assertion: CompanionSsoReverseExchangeResponse["identity"],
): Promise<ReverseSsoUser> {
  const candidates = new Map<number, ReverseSsoUser>();

  if (assertion.employeeId) {
    const employeeUser = await prisma.user.findUnique({
      where: { employeeId: assertion.employeeId },
      select: reverseUserSelect,
    });
    if (employeeUser) candidates.set(employeeUser.id, employeeUser);
  }

  if (assertion.lrn) {
    const learner = await prisma.learner.findUnique({
      where: { lrn: assertion.lrn },
      select: { user: { select: reverseUserSelect } },
    });
    if (learner?.user) candidates.set(learner.user.id, learner.user);
  }

  if (candidates.size !== 1) {
    throw new AppError(
      409,
      "The companion identity must be linked to exactly one EnrollPro account.",
      candidates.size === 0
        ? "COMPANION_REVERSE_SSO_LINK_REQUIRED"
        : "COMPANION_REVERSE_SSO_IDENTITY_CONFLICT",
    );
  }

  const user = [...candidates.values()][0];
  assertIdentityMatchesUser(assertion, user);
  return user;
}

async function resolveLinkedUser(input: {
  system: CompanionSystem;
  assertion: CompanionSsoReverseExchangeResponse["identity"];
  authenticatedAt: Date;
}): Promise<ReverseSsoUser> {
  const existing = await prisma.companionIdentityLink.findFirst({
    where: {
      companion: input.system,
      externalSubject: input.assertion.subject,
    },
    select: {
      id: true,
      user: { select: reverseUserSelect },
    },
  });

  if (existing) {
    assertIdentityMatchesUser(input.assertion, existing.user);
    assertUserCanEnterEnrollPro(existing.user);
    await prisma.$transaction([
      prisma.companionIdentityLink.update({
        where: { id: existing.id },
        data: { lastAuthenticatedAt: input.authenticatedAt },
      }),
      prisma.user.update({
        where: { id: existing.user.id },
        data: { lastLoginAt: input.authenticatedAt },
      }),
    ]);
    return { ...existing.user, lastLoginAt: input.authenticatedAt };
  }

  const candidate = await findUnlinkedCandidate(input.assertion);
  assertUserCanEnterEnrollPro(candidate);

  try {
    await prisma.$transaction([
      prisma.companionIdentityLink.create({
        data: {
          companion: input.system,
          externalSubject: input.assertion.subject,
          userId: candidate.id,
          lastAuthenticatedAt: input.authenticatedAt,
        },
      }),
      prisma.user.update({
        where: { id: candidate.id },
        data: { lastLoginAt: input.authenticatedAt },
      }),
    ]);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        409,
        "The companion identity conflicts with an existing EnrollPro link.",
        "COMPANION_REVERSE_SSO_IDENTITY_CONFLICT",
      );
    }
    throw error;
  }

  return { ...candidate, lastLoginAt: input.authenticatedAt };
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
    const assertion = await exchangeCodeWithCompanion({
      system: input.system,
      code: input.code,
    });

    const activeSchoolYear = await resolveActiveSchoolYearState(prisma);
    if (activeSchoolYear.state === "INVALID") {
      throw new AppError(409, activeSchoolYear.message, activeSchoolYear.code);
    }
    if (activeSchoolYear.state === "UNINITIALIZED") {
      throw new AppError(
        409,
        "An active school year is required for reverse SSO.",
        "ACTIVE_SCHOOL_YEAR_REQUIRED",
      );
    }
    if (
      assertion.activeSchoolYear.id !== activeSchoolYear.active.schoolYearId
      || assertion.activeSchoolYear.yearLabel !== activeSchoolYear.active.yearLabel
    ) {
      throw new AppError(
        409,
        "The companion and EnrollPro active school years do not match.",
        "COMPANION_REVERSE_SSO_SCHOOL_YEAR_MISMATCH",
      );
    }

    const user = await resolveLinkedUser({
      system: input.system,
      assertion: assertion.identity,
      authenticatedAt: new Date(),
    });

    await auditLog({
      userId: user.id,
      actionType: "COMPANION_REVERSE_SSO_LOGIN",
      description: `${input.system} authenticated a user into EnrollPro.`,
      subjectType: "CompanionSystem",
      metadata: {
        companion: input.system,
        activeSchoolYearId: activeSchoolYear.active.schoolYearId,
      },
      req: input.req,
    });
    return user;
  } catch (error: unknown) {
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
}

export function reverseSsoLandingPath(roles: readonly Role[]): string {
  if (roles.includes("SYSTEM_ADMIN") || roles.includes("HEAD_REGISTRAR")) {
    return "/dashboard";
  }
  return "/teacher/advisory";
}
