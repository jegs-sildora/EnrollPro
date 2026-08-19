import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { AppError } from "../../lib/AppError.js";
import {
  FALLBACK_DEFAULT_PASSWORD,
  isConfiguredDefaultPassword,
} from "./default-password.service.js";

type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeId: string | null;
  accountName: string | null;
  roles: string[];
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
};

const JWT_EXPIRES_IN: jwt.SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "24h";
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "enrollpro_session";
const EXTERNAL_PASSWORD_CHANGE_AUDIENCE = "enrollpro-external-password-change";
const EXTERNAL_PASSWORD_CHANGE_PURPOSE = "CHANGE_DEFAULT_PASSWORD";
const EXTERNAL_PASSWORD_CHANGE_EXPIRES_IN = "5m";

interface ExternalPasswordChangeClaims extends jwt.JwtPayload {
  purpose: typeof EXTERNAL_PASSWORD_CHANGE_PURPOSE;
  sub: string;
  returnTo?: string;
}

function parseConfiguredOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const entry of value?.split(",") ?? []) {
    const candidate = entry.trim();
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Invalid deployment configuration is ignored instead of weakening URL validation.
    }
  }
  return origins;
}

function getConfiguredCompanionHostnames(): Set<string> {
  const hostnames = new Set<string>();
  for (const value of [
    process.env.SMART_API_BASE_URL,
    process.env.AIMS_API_BASE_URL,
    process.env.ATLAS_API_BASE_URL,
  ]) {
    if (!value?.trim()) continue;
    try {
      hostnames.add(new URL(value).hostname);
    } catch {
      // Invalid integration URLs are reported by their owning integration service.
    }
  }
  return hostnames;
}

function getRequestOrigin(req: Request): string | null {
  const origin = req.get("origin");
  if (!origin) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function getSafeCompanionReturnUrl(req: Request, value: unknown): string | undefined {
  const rawValue = typeof value === "string" && value.trim()
    ? value.trim()
    : getRequestOrigin(req);
  if (!rawValue) return undefined;

  let returnUrl: URL;
  try {
    returnUrl = new URL(rawValue);
  } catch {
    throw new AppError(400, "The companion return URL is invalid.", "INVALID_RETURN_URL");
  }

  if (
    !["http:", "https:"].includes(returnUrl.protocol)
    || returnUrl.username
    || returnUrl.password
  ) {
    throw new AppError(400, "The companion return URL is not allowed.", "INVALID_RETURN_URL");
  }

  const configuredOrigins = parseConfiguredOrigins(process.env.COMPANION_APP_URLS);
  const configuredCompanionHostnames = getConfiguredCompanionHostnames();
  const requestOrigin = getRequestOrigin(req);
  const isLocalDevelopment = process.env.NODE_ENV !== "production"
    && ["localhost", "127.0.0.1"].includes(returnUrl.hostname);
  const isRequestOrigin = requestOrigin === returnUrl.origin;

  const isConfiguredCompanionHost = configuredCompanionHostnames.has(returnUrl.hostname);

  if (
    !configuredOrigins.has(returnUrl.origin)
    && !isConfiguredCompanionHost
    && !isRequestOrigin
    && !isLocalDevelopment
  ) {
    throw new AppError(
      400,
      "The companion return URL is not registered with EnrollPro.",
      "RETURN_URL_NOT_ALLOWED",
    );
  }

  return returnUrl.toString();
}

function getPublicEnrollProUrl(req: Request): URL {
  const configuredUrl = process.env.ENROLLPRO_PUBLIC_URL?.trim();
  if (configuredUrl) {
    try {
      return new URL(configuredUrl);
    } catch {
      throw new AppError(
        500,
        "EnrollPro public URL is not configured correctly.",
        "ENROLLPRO_PUBLIC_URL_INVALID",
      );
    }
  }

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");
  const protocol = forwardedProtocol || req.protocol;
  if (!host) {
    throw new AppError(
      500,
      "EnrollPro public URL is not configured.",
      "ENROLLPRO_PUBLIC_URL_MISSING",
    );
  }

  return new URL(`${protocol}://${host}`);
}

function parseExpiresInToMs(
  expiresIn: jwt.SignOptions["expiresIn"],
): number | undefined {
  if (typeof expiresIn === "number") {
    return expiresIn * 1000;
  }

  if (typeof expiresIn !== "string") {
    return undefined;
  }

  const match = expiresIn.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "d") return value * 24 * 60 * 60 * 1000;
  return undefined;
}

function getCookieOptions(): CookieOptions {
  const maxAge = parseExpiresInToMs(JWT_EXPIRES_IN);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

function setSessionCookie(res: Response, token: string, cookieName = AUTH_COOKIE_NAME): void {
  res.cookie(cookieName, token, getCookieOptions());
}

function clearSessionCookie(res: Response, cookieName = AUTH_COOKIE_NAME): void {
  const options = getCookieOptions();
  res.clearCookie(cookieName, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}

function toUserResponse(user: AuthUser) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    employeeId: user.employeeId,
    accountName: user.accountName,
    roles: user.roles,
    mustChangePassword: user.mustChangePassword,
  };
}

function createAuthToken(user: AuthUser): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError(
      500,
      "JWT secret is not configured on the server.",
      "JWT_SECRET_MISSING",
    );
  }

  return jwt.sign(
    {
      userId: user.id,
      roles: user.roles,
      mustChangePassword: user.mustChangePassword,
    },
    jwtSecret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError(
      500,
      "JWT secret is not configured on the server.",
      "JWT_SECRET_MISSING",
    );
  }
  return jwtSecret;
}

function createExternalPasswordChangeTicket(
  user: AuthUser,
  returnTo?: string,
): string {
  return jwt.sign(
    {
      purpose: EXTERNAL_PASSWORD_CHANGE_PURPOSE,
      ...(returnTo ? { returnTo } : {}),
    },
    getJwtSecret(),
    {
      audience: EXTERNAL_PASSWORD_CHANGE_AUDIENCE,
      subject: String(user.id),
      expiresIn: EXTERNAL_PASSWORD_CHANGE_EXPIRES_IN,
    },
  );
}

function readExternalPasswordChangeTicket(req: Request): ExternalPasswordChangeClaims {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(
      401,
      "The password-change ticket is missing.",
      "PASSWORD_CHANGE_TICKET_MISSING",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, getJwtSecret(), {
      audience: EXTERNAL_PASSWORD_CHANGE_AUDIENCE,
    });
  } catch {
    throw new AppError(
      401,
      "The password-change ticket is invalid or has expired. Sign in again through the companion system.",
      "PASSWORD_CHANGE_TICKET_INVALID",
    );
  }

  if (
    typeof decoded === "string"
    || decoded.purpose !== EXTERNAL_PASSWORD_CHANGE_PURPOSE
    || typeof decoded.sub !== "string"
    || !/^\d+$/.test(decoded.sub)
  ) {
    throw new AppError(
      401,
      "The password-change ticket is invalid.",
      "PASSWORD_CHANGE_TICKET_INVALID",
    );
  }

  return decoded as ExternalPasswordChangeClaims;
}

export async function login(req: Request, res: Response): Promise<void> {
  const accountName = String(req.body.accountName).trim();
  const { password } = req.body as { password: string };

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { accountName: accountName },
        { employeeId: accountName },
        { email: accountName },
      ]
    }
  });

  let isDefaultPassword = false;
  let passwordValid = false;

  if (user) {
    passwordValid = await bcrypt.compare(password, user.password);
    if (passwordValid) {
      isDefaultPassword = await isConfiguredDefaultPassword(password);
    }
  }

  if (!passwordValid && password === FALLBACK_DEFAULT_PASSWORD && !user && accountName.startsWith("LRN-")) {
    const lrn = accountName.replace("LRN-", "");
    const learner = await prisma.learner.findUnique({ where: { lrn } });
    if (learner) {
      isDefaultPassword = true;
      passwordValid = true;

      const hashed = await bcrypt.hash(password, 12);
      user = await prisma.user.create({
        data: {
          firstName: learner.firstName,
          lastName: learner.lastName,
          accountName: accountName,
          password: hashed,
          roles: ["LEARNER"],
          mustChangePassword: true,
          sex: learner.sex,
          isActive: true,
        },
      });
      await prisma.learner.update({
        where: { id: learner.id },
        data: { userId: user.id },
      });
    }
  }

  if (!user) {
    res.status(401).json({ message: "Invalid employee ID or password" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({
      message:
        "Your account has been deactivated. Contact the system administrator.",
    });
    return;
  }

  if (!passwordValid) {
    res.status(401).json({ message: "Invalid employee ID or password" });
    return;
  }

  const now = new Date();
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: now,
      mustChangePassword: user.mustChangePassword || isDefaultPassword,
    },
  });

  await auditLog({
    userId: updatedUser.id,
    actionType: "USER_LOGIN",
    description: `User ${updatedUser.accountName || updatedUser.email} logged in from ${req.ip}`,
    req,
  });

  const token = createAuthToken(updatedUser);
  setSessionCookie(res, token);

  res.json({
    token,
    user: toUserResponse(updatedUser),
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.status(204).send();
}


export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
      accountName: true,
      roles: true,
      mustChangePassword: true,
    },
  });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
}

export async function changePassword(
  req: Request,
  res: Response,
): Promise<void> {
  const { newPassword } = req.body;
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    res.status(400).json({
      message: "New password cannot be the same as your current password.",
    });
    return;
  }

  if (await isConfiguredDefaultPassword(newPassword)) {
    res.status(400).json({
      message: "Choose a private password instead of the configured default password.",
    });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      mustChangePassword: false,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
      accountName: true,
      roles: true,
      mustChangePassword: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  const token = createAuthToken(updated);
  setSessionCookie(res, token, AUTH_COOKIE_NAME);

  res.json({ token, user: toUserResponse(updated) });
}

export async function changeExternalDefaultPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const claims = readExternalPasswordChangeTicket(req);
  const userId = Number(claims.sub);
  const { newPassword } = req.body as { newPassword: string };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError(
      401,
      "The account is unavailable.",
      "PASSWORD_CHANGE_ACCOUNT_UNAVAILABLE",
    );
  }
  if (!user.mustChangePassword) {
    throw new AppError(
      409,
      "The default password has already been replaced. Return to the companion system and sign in again.",
      "PASSWORD_ALREADY_CHANGED",
    );
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new AppError(
      400,
      "New password cannot be the same as the default password.",
      "PASSWORD_UNCHANGED",
    );
  }

  if (await isConfiguredDefaultPassword(newPassword)) {
    throw new AppError(
      400,
      "Choose a private password instead of the configured default password.",
      "DEFAULT_PASSWORD_NOT_ALLOWED",
    );
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      mustChangePassword: false,
      updatedAt: new Date(),
    },
  });

  await auditLog({
    userId: user.id,
    actionType: "DEFAULT_PASSWORD_CHANGED",
    description: "User replaced the default password through a companion-system handoff.",
    req,
  });

  res.json({
    success: true,
    message: "Password updated. Return to the companion system and sign in with the new password.",
    returnTo: claims.returnTo ?? null,
  });
}

export async function verifyCredentials(
  req: Request,
  res: Response,
): Promise<void> {
  const accountName = String(req.body.accountName).trim();
  const { password, returnTo: requestedReturnUrl } = req.body as {
    password: string;
    returnTo?: string;
  };

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { accountName },
          { employeeId: accountName },
          { email: accountName },
        ],
      },
    });
    if (!user) {
      res.status(401).json({ valid: false, message: "User not found" });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ valid: false, message: "Account is inactive" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ valid: false, message: "Invalid password" });
      return;
    }

    // Check if learner is JHS_COMPLETER (since external subsystems AIMS, SMART, MRF should NOT allow access to alumni/JHS completers)
    if (user.roles.includes("LEARNER")) {
      const learner = await prisma.learner.findUnique({
        where: { userId: user.id },
        select: { status: true },
      });

      if (learner?.status === "JHS_COMPLETER") {
        res.status(403).json({ 
          valid: false, 
          message: "JHS completers cannot access external portals like AIMS, SMART, or MRF." 
        });
        return;
      }
    }

    const usesDefaultPassword = await isConfiguredDefaultPassword(password);
    const requiresPasswordChange = user.mustChangePassword || usesDefaultPassword;
    if (requiresPasswordChange) {
      const returnTo = getSafeCompanionReturnUrl(req, requestedReturnUrl);
      if (!user.mustChangePassword) {
        await prisma.user.update({
          where: { id: user.id },
          data: { mustChangePassword: true },
        });
      }
      const ticket = createExternalPasswordChangeTicket({
        ...user,
        mustChangePassword: true,
      }, returnTo);
      const passwordChangePath =
        `/change-password?origin=external#ticket=${encodeURIComponent(ticket)}`;
      const passwordChangeUrl = new URL(
        passwordChangePath,
        getPublicEnrollProUrl(req),
      ).toString();
      res.status(428).json({
        valid: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message:
          "Replace the default password in EnrollPro before signing in to this companion system.",
        mustChangePassword: true,
        passwordChangePath,
        passwordChangeUrl,
        returnTo: returnTo ?? null,
      });
      return;
    }

    res.json({
      valid: true,
      user: toUserResponse(user),
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    res.status(500).json({ valid: false, message: "Verification error" });
  }
}

