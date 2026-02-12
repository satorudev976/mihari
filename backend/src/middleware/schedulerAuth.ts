import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Protects /jobs/* endpoints.
 * Validates either:
 *  - OIDC token from Cloud Scheduler (via IAM)
 *  - Shared secret header (for local dev / simple setup)
 */
export function schedulerAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.SCHEDULER_SECRET;

  // If SCHEDULER_SECRET is set, validate header
  if (secret) {
    const header = req.headers["x-scheduler-secret"];
    if (header === secret) {
      next();
      return;
    }
  }

  // Allow Cloud Scheduler OIDC (validated by Cloud Run IAM invoker)
  // When Cloud Run requires authentication, requests without valid tokens
  // are rejected at the infrastructure level before reaching this middleware.
  // If we reach here without secret match, check for GCP auth header.
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    // In production, Cloud Run IAM handles token validation.
    next();
    return;
  }

  logger.warn("Unauthorized scheduler request", {
    ip: req.ip,
    path: req.path,
  });
  res.status(403).json({ error: "Forbidden" });
}
