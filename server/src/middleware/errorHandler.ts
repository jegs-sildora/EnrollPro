import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/AppError.js";

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("[Error Details]", err);

  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ code: err.code, message: err.message || "Request failed" });
    return;
  }

  const status = err.statusCode ?? 500;
  const code =
    err.code ?? (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
  res
    .status(status)
    .json({ 
      code, 
      message: err.message || "Internal Server Error",
      debug: {
        message: err.message,
        stack: err.stack,
        details: (err as any).details
      }
    });
}
