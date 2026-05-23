import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "enrollpro_session";

export interface AuthPayload {
  userId: number;
  role: string;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void>;
export function authenticate(
  cookieName: string,
): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export function authenticate(
  reqOrCookie: Request | string,
  res?: Response,
  next?: NextFunction,
): void | Promise<void> | ((req: Request, res: Response, next: NextFunction) => Promise<void>) {
  if (typeof reqOrCookie === "string") {
    const cookieName = reqOrCookie;
    return async (req: Request, res: Response, next: NextFunction) => {
      return performAuth(req, res, next, cookieName);
    };
  }
  
  return performAuth(reqOrCookie, res!, next!, AUTH_COOKIE_NAME);
}

async function performAuth(
  req: Request,
  res: Response,
  next: NextFunction,
  cookieName: string,
): Promise<void> {
  const auth = req.headers.authorization;
  const bearerToken = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : null;
  const cookieToken = req.cookies?.[cookieName];
  const queryToken =
    typeof req.query.token === "string" ? req.query.token : null;
  const token = bearerToken ?? cookieToken ?? queryToken;

  if (!token) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        code: "TOKEN_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      });
    } else {
      res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid token. Please sign in again.",
      });
    }
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        code: "ACCOUNT_INACTIVE",
        message: "Account is inactive. Contact your system administrator.",
      });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res
      .status(500)
      .json({ code: "SERVER_ERROR", message: "Authentication check failed." });
  }
}

export const authenticateLearner = authenticate("learner_session");

export function authenticateFromCookies(
  ...cookieNames: string[]
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    const names = cookieNames.filter(Boolean);
    if (!names.length) {
      return performAuth(req, res, next, AUTH_COOKIE_NAME);
    }

    const queryToken =
      typeof req.query.token === "string" ? req.query.token : null;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    for (const cookieName of names) {
      const cookieToken = req.cookies?.[cookieName];
      const token = cookieToken ?? null;
      if (!token) continue;

      let decoded: AuthPayload;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      } catch {
        continue;
      }

      try {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { isActive: true },
        });

        if (!user || !user.isActive) {
          continue;
        }

        req.user = decoded;
        next();
        return;
      } catch {
        res.status(500).json({
          code: "SERVER_ERROR",
          message: "Authentication check failed.",
        });
        return;
      }
    }

    // Fallback for compatibility with existing non-browser callers.
    if (bearerToken || queryToken) {
      return performAuth(req, res, next, AUTH_COOKIE_NAME);
    }

    res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
  };
}
