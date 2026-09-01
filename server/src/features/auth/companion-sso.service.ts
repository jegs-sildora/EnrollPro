import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type {
  CompanionSsoCatalogItem,
  CompanionSsoExchangeResponse,
  CompanionSystem,
  Role,
} from "@enrollpro/shared";

import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../lib/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { resolveActiveSchoolYearState } from "../school-year/services/active-school-year.service.js";

const AUTHORIZATION_CODE_TTL_MS = 60_000;
const COMPANION_SYSTEMS: readonly CompanionSystem[] = [
  "ATLAS",
  "AIMS",
  "SMART",
  "MRF",
];

const ALLOWED_ROLES: Record<CompanionSystem, readonly Role[]> = {
  ATLAS: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"],
  AIMS: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"],
  SMART: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"],
  MRF: ["SYSTEM_ADMIN", "MRF"],
};

interface CompanionConfiguration {
  callbackUrl: URL;
  clientSecret: string;
}

interface RequestAuditContext {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface SsoUser {
  id: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  employeeId: string | null;
  roles: Role[];
  isActive: boolean;
  mustChangePassword: boolean;
  learnerProfile: {
    lrn: string | null;
    status: string;
  } | null;
}

function configurationNames(system: CompanionSystem): {
  callback: string;
  secret: string;
} {
  return {
    callback: `${system}_SSO_CALLBACK_URL`,
    secret: `${system}_SSO_CLIENT_SECRET`,
  };
}

function readCompanionConfiguration(
  system: CompanionSystem,
): CompanionConfiguration | null {
  const names = configurationNames(system);
  const callbackValue = process.env[names.callback]?.trim();
  const clientSecret = process.env[names.secret]?.trim();
  const placeholderSecret = clientSecret
    ? /(replace|placeholder|example|change[_-]?me|your[_-])/i.test(clientSecret)
    : true;
  if (
    !callbackValue
    || !clientSecret
    || clientSecret.length < 32
    || placeholderSecret
  ) {
    return null;
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callbackValue);
  } catch {
    return null;
  }

  const secureProtocol = callbackUrl.protocol === "https:";
  const localDevelopment =
    process.env.NODE_ENV !== "production"
    && callbackUrl.protocol === "http:"
    && ["localhost", "127.0.0.1"].includes(callbackUrl.hostname);
  if (
    (!secureProtocol && !localDevelopment)
    || callbackUrl.username
    || callbackUrl.password
    || callbackUrl.hash
  ) {
    return null;
  }

  return { callbackUrl, clientSecret };
}

function hasCompanionRole(system: CompanionSystem, roles: readonly Role[]): boolean {
  const allowed = new Set<Role>(ALLOWED_ROLES[system]);
  return roles.some((role) => allowed.has(role));
}

function allowedCompanionRoles(
  system: CompanionSystem,
  roles: readonly Role[],
): Role[] {
  const allowed = new Set<Role>(ALLOWED_ROLES[system]);
  return roles.filter((role) => allowed.has(role));
}

function codeHash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function safeSecretMatches(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

async function getSsoUser(userId: number): Promise<SsoUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      employeeId: true,
      roles: true,
      isActive: true,
      mustChangePassword: true,
      learnerProfile: {
        select: { lrn: true, status: true },
      },
    },
  });
  if (!user || !user.isActive) {
    throw new AppError(
      401,
      "Your EnrollPro account is unavailable.",
      "COMPANION_SSO_ACCOUNT_UNAVAILABLE",
    );
  }
  return user;
}

function assertUserCanLaunch(system: CompanionSystem, user: SsoUser): void {
  if (user.mustChangePassword) {
    throw new AppError(
      428,
      "Change your default password before opening an integrated system.",
      "PASSWORD_CHANGE_REQUIRED",
    );
  }
  if (user.learnerProfile?.status === "JHS_COMPLETER") {
    throw new AppError(
      403,
      "JHS completers cannot open active companion-system workspaces.",
      "COMPANION_SSO_COMPLETER_BLOCKED",
    );
  }
  if (!hasCompanionRole(system, user.roles)) {
    throw new AppError(
      403,
      `Your EnrollPro role does not have access to ${system}.`,
      "COMPANION_SSO_ROLE_DENIED",
    );
  }
  if (!user.employeeId && !user.learnerProfile?.lrn) {
    throw new AppError(
      403,
      "Your EnrollPro account does not have a companion-system identifier.",
      "COMPANION_SSO_IDENTITY_INCOMPLETE",
    );
  }
}

export function parseCompanionSystem(value: string): CompanionSystem {
  const normalized = value.trim().toUpperCase();
  if (!COMPANION_SYSTEMS.includes(normalized as CompanionSystem)) {
    throw new AppError(
      404,
      "Integrated system was not found.",
      "COMPANION_SSO_SYSTEM_NOT_FOUND",
    );
  }
  return normalized as CompanionSystem;
}

export async function getCompanionSsoCatalog(
  userId: number,
): Promise<{ systems: CompanionSsoCatalogItem[] }> {
  const user = await getSsoUser(userId);
  const systems = COMPANION_SYSTEMS.map((system) => {
    const enabled = readCompanionConfiguration(system) !== null;
    const roleEligible = hasCompanionRole(system, user.roles);
    const accountEligible =
      !user.mustChangePassword
      && user.learnerProfile?.status !== "JHS_COMPLETER";
    const eligible = roleEligible && accountEligible;

    let disabledReason: string | null = null;
    if (!enabled) {
      disabledReason = `${system} login is not configured.`;
    } else if (user.mustChangePassword) {
      disabledReason = "Change your default password before opening an integrated system.";
    } else if (user.learnerProfile?.status === "JHS_COMPLETER") {
      disabledReason = "JHS completers cannot open active companion-system workspaces.";
    } else if (!roleEligible) {
      disabledReason = `Your EnrollPro role does not have access to ${system}.`;
    }

    return { system, enabled, eligible, disabledReason };
  });
  return { systems };
}

export async function createCompanionSsoLaunch(input: {
  system: CompanionSystem;
  userId: number;
  req: RequestAuditContext;
}): Promise<{ launchUrl: string; expiresAt: string }> {
  let user: SsoUser;
  try {
    user = await getSsoUser(input.userId);
  } catch (error: unknown) {
    await auditLog({
      userId: input.userId,
      actionType: "COMPANION_SSO_LAUNCH_DENIED",
      description: `EnrollPro denied the ${input.system} sign-in handoff.`,
      subjectType: "CompanionSystem",
      metadata: {
        companion: input.system,
        reason: error instanceof AppError ? error.code : "ACCOUNT_UNAVAILABLE",
      },
      req: input.req,
    });
    throw error;
  }

  const configuration = readCompanionConfiguration(input.system);
  if (!configuration) {
    await auditLog({
      userId: user.id,
      actionType: "COMPANION_SSO_LAUNCH_DENIED",
      description: `EnrollPro denied the ${input.system} sign-in handoff.`,
      subjectType: "CompanionSystem",
      metadata: { companion: input.system, reason: "NOT_CONFIGURED" },
      req: input.req,
    });
    throw new AppError(
      503,
      `${input.system} login is not configured.`,
      "COMPANION_SSO_NOT_CONFIGURED",
    );
  }

  try {
    assertUserCanLaunch(input.system, user);
  } catch (error: unknown) {
    await auditLog({
      userId: user.id,
      actionType: "COMPANION_SSO_LAUNCH_DENIED",
      description: `EnrollPro denied the ${input.system} sign-in handoff.`,
      subjectType: "CompanionSystem",
      metadata: {
        companion: input.system,
        reason: error instanceof AppError ? error.code : "ACCESS_DENIED",
      },
      req: input.req,
    });
    throw error;
  }

  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS);
  await prisma.companionSsoAuthorizationCode.create({
    data: {
      codeHash: codeHash(code),
      userId: user.id,
      companion: input.system,
      expiresAt,
      ipAddress: input.req.ip ?? "0.0.0.0",
      userAgent: (input.req.headers["user-agent"] as string) ?? null,
    },
  });

  const launchUrl = new URL(configuration.callbackUrl);
  launchUrl.searchParams.set("code", code);

  await auditLog({
    userId: user.id,
    actionType: "COMPANION_SSO_LAUNCHED",
    description: `User opened the ${input.system} sign-in handoff.`,
    subjectType: "CompanionSystem",
    metadata: {
      companion: input.system,
      expiresAt: expiresAt.toISOString(),
    },
    req: input.req,
  });

  return {
    launchUrl: launchUrl.toString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function exchangeCompanionSsoCode(input: {
  system: CompanionSystem;
  code: string;
  bearerSecret: string | null;
  req: RequestAuditContext;
}): Promise<CompanionSsoExchangeResponse> {
  const configuration = readCompanionConfiguration(input.system);
  if (!configuration) {
    await auditLog({
      actionType: "COMPANION_SSO_EXCHANGE_DENIED",
      description: `${input.system} SSO exchange is not configured.`,
      subjectType: "CompanionSystem",
      metadata: { companion: input.system, reason: "NOT_CONFIGURED" },
      req: input.req,
    });
    throw new AppError(
      503,
      `${input.system} login is not configured.`,
      "COMPANION_SSO_NOT_CONFIGURED",
    );
  }
  if (
    !input.bearerSecret
    || !safeSecretMatches(input.bearerSecret, configuration.clientSecret)
  ) {
    await auditLog({
      actionType: "COMPANION_SSO_EXCHANGE_DENIED",
      description: `${input.system} presented invalid SSO client credentials.`,
      subjectType: "CompanionSystem",
      metadata: { companion: input.system, reason: "INVALID_CLIENT" },
      req: input.req,
    });
    throw new AppError(
      401,
      "Companion SSO client authentication failed.",
      "COMPANION_SSO_CLIENT_INVALID",
    );
  }

  const now = new Date();
  const hash = codeHash(input.code);

  let exchanged: {
    user: SsoUser;
    activeSchoolYear: { id: number; yearLabel: string };
  };
  try {
    exchanged = await prisma.$transaction(
      async (tx) => {
        const authorizationCode = await tx.companionSsoAuthorizationCode.findUnique({
          where: { codeHash: hash },
          select: {
            id: true,
            userId: true,
            companion: true,
            expiresAt: true,
            consumedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                employeeId: true,
                roles: true,
                isActive: true,
                mustChangePassword: true,
                learnerProfile: {
                  select: { lrn: true, status: true },
                },
              },
            },
          },
        });

        if (
          !authorizationCode
          || authorizationCode.companion !== input.system
          || authorizationCode.consumedAt !== null
          || authorizationCode.expiresAt <= now
        ) {
          throw new AppError(
            401,
            "The SSO authorization code is invalid, expired, or already used.",
            "COMPANION_SSO_CODE_INVALID",
          );
        }

        const consumed = await tx.companionSsoAuthorizationCode.updateMany({
          where: {
            id: authorizationCode.id,
            companion: input.system,
            consumedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) {
          throw new AppError(
            401,
            "The SSO authorization code is invalid, expired, or already used.",
            "COMPANION_SSO_CODE_INVALID",
          );
        }

        const activeSchoolYear = await resolveActiveSchoolYearState(tx);
        if (activeSchoolYear.state === "INVALID") {
          throw new AppError(
            409,
            activeSchoolYear.message,
            activeSchoolYear.code,
          );
        }
        if (activeSchoolYear.state === "UNINITIALIZED") {
          throw new AppError(
            409,
            "An active school year is required before opening an integrated system.",
            "ACTIVE_SCHOOL_YEAR_REQUIRED",
          );
        }

        const user: SsoUser = authorizationCode.user;
        assertUserCanLaunch(input.system, user);

        return {
          user,
          activeSchoolYear: {
            id: activeSchoolYear.active.schoolYearId,
            yearLabel: activeSchoolYear.active.yearLabel,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error: unknown) {
    await auditLog({
      actionType: "COMPANION_SSO_EXCHANGE_DENIED",
      description: `${input.system} presented an unusable SSO authorization code.`,
      subjectType: "CompanionSystem",
      metadata: {
        companion: input.system,
        reason: error instanceof AppError ? error.code : "EXCHANGE_FAILED",
      },
      req: input.req,
    });
    throw error;
  }

  const response: CompanionSsoExchangeResponse = {
    success: true,
    companion: input.system,
    identity: {
      subject: `ENROLLPRO_USER:${exchanged.user.id}`,
      userId: exchanged.user.id,
      employeeId: exchanged.user.employeeId,
      lrn: exchanged.user.learnerProfile?.lrn ?? null,
      firstName: exchanged.user.firstName,
      middleName: exchanged.user.middleName,
      lastName: exchanged.user.lastName,
      roles: allowedCompanionRoles(input.system, exchanged.user.roles),
    },
    activeSchoolYear: exchanged.activeSchoolYear,
    authenticatedAt: now.toISOString(),
  };

  await auditLog({
    userId: exchanged.user.id,
    actionType: "COMPANION_SSO_EXCHANGED",
    description: `${input.system} accepted the EnrollPro sign-in handoff.`,
    subjectType: "CompanionSystem",
    metadata: {
      companion: input.system,
      activeSchoolYearId: exchanged.activeSchoolYear.id,
    },
    req: input.req,
  });

  return response;
}
