import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface LearnerAuthPayload {
  learnerId: number;
  enrollmentApplicationId: number;
  role: "LEARNER";
}

declare global {
  namespace Express {
    interface Request {
      learner?: LearnerAuthPayload;
    }
  }
}

/**
 * Verifies learner-issued JWTs (issued by POST /api/auth/learner-login).
 * Does NOT perform a database lookup — learner sessions are stateless.
 * Use this middleware on learner-facing self-service routes only.
 */
export async function authenticateLearner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : null;

  if (!token) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!,
    ) as LearnerAuthPayload;

    if (decoded.role !== "LEARNER") {
      res.status(403).json({ code: "FORBIDDEN", message: "Forbidden" });
      return;
    }

    req.learner = decoded;
    next();
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
  }
}
