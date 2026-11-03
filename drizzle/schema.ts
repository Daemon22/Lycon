import { pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"), // For email/password authentication
  isEmailVerified: timestamp("isEmailVerified"), // Timestamp when email was verified
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const browserSyncSnapshots = pgTable("browser_sync_snapshots", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  revision: serial("revision").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdUnique: uniqueIndex("browser_sync_snapshots_user_id_unique").on(table.userId),
}));

export type BrowserSyncSnapshot = typeof browserSyncSnapshots.$inferSelect;
export type InsertBrowserSyncSnapshot = typeof browserSyncSnapshots.$inferInsert;

// Email verification tokens
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// Two-factor authentication secrets
export const twoFactorSecrets = pgTable("two_factor_secrets", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  secret: varchar("secret", { length: 255 }).notNull(),
  backupCodes: text("backupCodes"), // JSON array of backup codes
  isEnabled: timestamp("isEnabled"), // Timestamp when 2FA was enabled
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TwoFactorSecret = typeof twoFactorSecrets.$inferSelect;
export type InsertTwoFactorSecret = typeof twoFactorSecrets.$inferInsert;

// Rate limiting for auth endpoints
export const rateLimitLogs = pgTable("rate_limit_logs", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(), // IP address or user ID
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  requestCount: serial("requestCount").notNull(),
  windowStart: timestamp("windowStart").notNull(),
  windowEnd: timestamp("windowEnd").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  identifierEndpointIndex: uniqueIndex("rate_limit_logs_identifier_endpoint_index").on(table.identifier, table.endpoint),
}));

export type RateLimitLog = typeof rateLimitLogs.$inferSelect;
export type InsertRateLimitLog = typeof rateLimitLogs.$inferInsert;