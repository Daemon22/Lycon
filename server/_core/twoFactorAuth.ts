import { authenticator } from "otplib";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { twoFactorSecrets, users } from "../../drizzle/schema";
import * as db from "../db";
import { emailService } from "./emailService";

/**
 * Generate a new TOTP secret for a user
 */
export async function generateTwoFactorSecret(userId: number): Promise<{ secret: string; qrCodeUrl: string }> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  // Check if user already has 2FA enabled
  const existing = await dbInstance
    .select()
    .from(twoFactorSecrets)
    .where(eq(twoFactorSecrets.userId, userId))
    .limit(1);

  if (existing.length > 0 && existing[0].isEnabled) {
    throw new Error("Two-factor authentication is already enabled");
  }

  // Get user email for QR code
  const user = await dbInstance
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) {
    throw new Error("User not found");
  }

  // Generate secret
  const secret = authenticator.generateSecret();

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () => randomBytes(4).toString("hex"));

  // Store secret (not enabled yet)
  if (existing.length > 0) {
    await dbInstance
      .update(twoFactorSecrets)
      .set({
        secret,
        backupCodes: JSON.stringify(backupCodes),
      })
      .where(eq(twoFactorSecrets.userId, userId));
  } else {
    await dbInstance.insert(twoFactorSecrets).values({
      userId,
      secret,
      backupCodes: JSON.stringify(backupCodes),
    });
  }

  // Generate QR code URL
  const qrCodeUrl = authenticator.keyuri(user[0].email || "user", "Lycon Browser", secret);

  return { secret, qrCodeUrl };
}

/**
 * Verify TOTP token during setup
 */
export async function verifyTwoFactorSetup(userId: number, token: string): Promise<{ backupCodes: string[] }> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const secretRecord = await dbInstance
    .select()
    .from(twoFactorSecrets)
    .where(eq(twoFactorSecrets.userId, userId))
    .limit(1);

  if (secretRecord.length === 0) {
    throw new Error("Two-factor secret not found");
  }

  if (secretRecord[0].isEnabled) {
    throw new Error("Two-factor authentication is already enabled");
  }

  const isValid = authenticator.verify({
    token,
    secret: secretRecord[0].secret,
  });

  if (!isValid) {
    throw new Error("Invalid verification code");
  }

  // Enable 2FA
  await dbInstance
    .update(twoFactorSecrets)
    .set({ isEnabled: new Date() })
    .where(eq(twoFactorSecrets.userId, userId));

  const backupCodes = JSON.parse(secretRecord[0].backupCodes || "[]");

  // Send email with backup codes
  await emailService.sendTwoFactorSetupEmail(user[0].email || "", backupCodes);

  return { backupCodes };
}

/**
 * Verify TOTP token during login
 */
export async function verifyTwoFactorToken(userId: number, token: string): Promise<boolean> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const secretRecord = await dbInstance
    .select()
    .from(twoFactorSecrets)
    .where(eq(twoFactorSecrets.userId, userId))
    .limit(1);

  if (secretRecord.length === 0 || !secretRecord[0].isEnabled) {
    throw new Error("Two-factor authentication not enabled");
  }

  // Check if it's a backup code
  const backupCodes = JSON.parse(secretRecord[0].backupCodes || "[]");
  const backupCodeIndex = backupCodes.indexOf(token);

  if (backupCodeIndex !== -1) {
    // Remove used backup code
    backupCodes.splice(backupCodeIndex, 1);
    await dbInstance
      .update(twoFactorSecrets)
      .set({ backupCodes: JSON.stringify(backupCodes) })
      .where(eq(twoFactorSecrets.userId, userId));
    return true;
  }

  // Verify TOTP token
  const isValid = authenticator.verify({
    token,
    secret: secretRecord[0].secret,
  });

  if (!isValid) {
    throw new Error("Invalid verification code");
  }

  return true;
}

/**
 * Disable two-factor authentication
 */
export async function disableTwoFactor(userId: number, password: string): Promise<boolean> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  // Verify password first
  const user = await dbInstance
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) {
    throw new Error("User not found");
  }

  if (!user[0].passwordHash) {
    throw new Error("Cannot disable 2FA for OAuth accounts");
  }

  const { verifyPassword } = await import("./authService");
  const isValid = await verifyPassword(user[0].passwordHash, password);

  if (!isValid) {
    throw new Error("Invalid password");
  }

  // Delete 2FA secret
  await dbInstance
    .delete(twoFactorSecrets)
    .where(eq(twoFactorSecrets.userId, userId));

  return true;
}

/**
 * Check if user has 2FA enabled
 */
export async function isTwoFactorEnabled(userId: number): Promise<boolean> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    return false;
  }

  const secretRecord = await dbInstance
    .select()
    .from(twoFactorSecrets)
    .where(eq(twoFactorSecrets.userId, userId))
    .limit(1);

  return secretRecord.length > 0 && secretRecord[0].isEnabled !== null;
}
