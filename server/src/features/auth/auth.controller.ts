import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { AppError } from "../../lib/AppError.js";

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

export async function login(req: Request, res: Response): Promise<void> {
  const accountName = String(req.body.accountName).trim();
  const { password } = req.body as { password: string };

  const user = await prisma.user.findUnique({ where: { accountName } });
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

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: "Invalid employee ID or password" });
    return;
  }

  const now = new Date();
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: now },
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

export async function verifyCredentials(
  req: Request,
  res: Response,
): Promise<void> {
  const accountName = String(req.body.accountName).trim();
  const { password } = req.body as { password: string };

  try {
    const user = await prisma.user.findUnique({ where: { accountName } });
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

    // Return the user object (excluding password) to allow subsystem to provision its own session
    res.json({
      valid: true,
      user: toUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: "Verification error" });
  }
}

