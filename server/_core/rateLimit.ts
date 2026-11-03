import { eq, and, gt } from "drizzle-orm";
import { rateLimitLogs } from "../../drizzle/schema";
import * as db from "../db";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
};

const AUTH_ENDPOINTS: Record<string, RateLimitConfig> = {
  "/api/auth/register": { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  "/api/auth/login": { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  "/api/auth/password-reset-request": { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  "/api/auth/password-reset-confirm": { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
};

/**
 * Check if request should be rate limited
 * @param identifier - IP address or user ID
 * @param endpoint - Endpoint path
 * @returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date | null }> {
  const config = AUTH_ENDPOINTS[endpoint] || DEFAULT_CONFIG;
  const dbInstance = await db.getDb();

  if (!dbInstance) {
    // If DB is not available, allow the request (fail open)
    return { allowed: true, remaining: config.maxRequests, resetAt: null };
  }

  const now = new Date();
  const windowStart = new Date(Date.now() - config.windowMs);
  const windowEnd = new Date(Date.now() + config.windowMs);

  // Clean up old logs
  await dbInstance
    .delete(rateLimitLogs)
    .where(and(
      eq(rateLimitLogs.identifier, identifier),
      eq(rateLimitLogs.endpoint, endpoint),
      gt(rateLimitLogs.windowEnd, now)
    ));

  // Get current count
  const currentLogs = await dbInstance
    .select()
    .from(rateLimitLogs)
    .where(and(
      eq(rateLimitLogs.identifier, identifier),
      eq(rateLimitLogs.endpoint, endpoint),
      gt(rateLimitLogs.windowEnd, now)
    ))
    .limit(1);

  const currentCount = currentLogs.length > 0 ? currentLogs[0].requestCount : 0;

  if (currentCount >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: currentLogs[0]?.windowEnd || null,
    };
  }

  // Increment or create log
  if (currentLogs.length > 0) {
    await dbInstance
      .update(rateLimitLogs)
      .set({ requestCount: currentCount + 1 })
      .where(eq(rateLimitLogs.id, currentLogs[0].id));
  } else {
    await dbInstance.insert(rateLimitLogs).values({
      identifier,
      endpoint,
      requestCount: 1,
      windowStart,
      windowEnd,
    });
  }

  return {
    allowed: true,
    remaining: config.maxRequests - (currentCount + 1),
    resetAt: windowEnd,
  };
}

/**
 * Express middleware for rate limiting
 */
export function rateLimitMiddleware(endpoint: string) {
  return async (req: any, res: any, next: any) => {
    const identifier = req.ip || req.connection.remoteAddress || "unknown";
    const result = await checkRateLimit(identifier, endpoint);

    if (!result.allowed) {
      res.setHeader("X-RateLimit-Limit", AUTH_ENDPOINTS[endpoint]?.maxRequests || DEFAULT_CONFIG.maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", result.resetAt?.getTime() || 0);

      return res.status(429).json({
        error: "Too many requests",
        message: "Please try again later",
        resetAt: result.resetAt,
      });
    }

    res.setHeader("X-RateLimit-Limit", AUTH_ENDPOINTS[endpoint]?.maxRequests || DEFAULT_CONFIG.maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", result.resetAt?.getTime() || 0);

    next();
  };
}
