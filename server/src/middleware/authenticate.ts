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

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  const bearerToken = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : null;
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
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
