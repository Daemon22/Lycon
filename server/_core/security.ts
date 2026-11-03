import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";

/**
 * Security headers configuration using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

/**
 * CSRF protection middleware
 * Simple implementation that checks Origin/Referer headers
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Get origin or referer
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;

  if (!origin && !referer) {
    return res.status(403).json({ error: "CSRF protection: Origin or Referer header required" });
  }

  // Validate origin matches host
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

  if (requestOrigin) {
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === "*") return true;
      if (allowed === requestOrigin) return true;
      // Allow subdomain matching
      if (allowed.startsWith("*.")) {
        const domain = allowed.slice(2);
        return requestOrigin.endsWith(domain);
      }
      return false;
    });

    if (!isAllowed) {
      return res.status(403).json({ error: "CSRF protection: Invalid origin" });
    }
  }

  next();
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitize = (value: any): any => {
    if (typeof value === "string") {
      // Remove potentially dangerous characters
      return value
        .replace(/[<>]/g, "")
        .trim();
    }
    if (Array.isArray(value)) {
      return value.map(sanitize);
    }
    if (typeof value === "object" && value !== null) {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitize(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
}

/**
 * Error handler for security-related errors
 */
export function securityErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("[Security Error]", err);

  // Don't leak stack traces in production
  const isProduction = process.env.NODE_ENV === "production";

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
