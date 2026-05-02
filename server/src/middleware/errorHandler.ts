import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/AppError.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const error = err as Error & { 
    statusCode?: number; 
    status?: number; 
    code?: string; 
    details?: unknown;
    stack?: string;
  };

  const status = error.statusCode || error.status || 500;
  
  // Log detailed error info to server console
  console.error(`[Error] ${req.method} ${req.path} - Status: ${status}`);
  console.error(`[Origin] ${req.headers.origin || "no origin"}`);
  console.error(`[Message] ${error.message || "Unknown error"}`);
  if (error.stack) console.error(`[Stack] ${error.stack}`);
  if (error.details) console.error(`[Details]`, JSON.stringify(error.details, null, 2));

  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ code: err.code, message: err.message || "Request failed" });
    return;
  }

  const code =
    error.code ?? (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
    
  res
    .status(status)
    .json({ 
      code, 
      message: error.message || "Internal Server Error",
      debug: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        details: error.details,
        path: req.path,
        method: req.method,
        origin: req.headers.origin
      } : undefined
    });
}
