import { eq } from "drizzle-orm";
import { users, browserSyncSnapshots, emailVerificationTokens, passwordResetTokens, twoFactorSecrets } from "../../drizzle/schema";
import * as db from "../db";

/**
 * GDPR compliance service for data export and deletion
 */
export class GDPRService {
  /**
   * Export all user data for GDPR compliance
   */
  async exportUserData(userId: number): Promise<{
    user: any;
    browserSyncSnapshots: any[];
    twoFactorEnabled: boolean;
    exportDate: string;
  }> {
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      throw new Error("Database not available");
    }

    // Get user data
    const userData = await dbInstance
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userData.length === 0) {
      throw new Error("User not found");
    }

    const user = userData[0];

    // Get browser sync snapshots
    const snapshots = await dbInstance
      .select()
      .from(browserSyncSnapshots)
      .where(eq(browserSyncSnapshots.userId, userId));

    // Check 2FA status
    const twoFactorRecords = await dbInstance
      .select()
      .from(twoFactorSecrets)
      .where(eq(twoFactorSecrets.userId, userId))
      .limit(1);

    const twoFactorEnabled = twoFactorRecords.length > 0 && twoFactorRecords[0].isEnabled !== null;

    // Return sanitized data (no sensitive secrets)
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        loginMethod: user.loginMethod,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastSignedIn: user.lastSignedIn,
        isEmailVerified: user.isEmailVerified,
      },
      browserSyncSnapshots: snapshots.map((s) => ({
        id: s.id,
        revision: s.revision,
        payload: s.payload,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      twoFactorEnabled,
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * Delete user account and all associated data (GDPR right to be forgotten)
   * This is irreversible!
   */
  async deleteUserAccount(userId: number, password?: string): Promise<boolean> {
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      throw new Error("Database not available");
    }

    // Verify password if provided (for email/password accounts)
    if (password) {
      const userData = await dbInstance
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userData.length === 0) {
        throw new Error("User not found");
      }

      if (userData[0].passwordHash) {
        const { verifyPassword } = await import("./authService");
        const isValid = await verifyPassword(userData[0].passwordHash, password);

        if (!isValid) {
          throw new Error("Invalid password");
        }
      }
    }

    // Delete in order of dependencies
    // 1. Delete browser sync snapshots
    await dbInstance
      .delete(browserSyncSnapshots)
      .where(eq(browserSyncSnapshots.userId, userId));

    // 2. Delete email verification tokens
    await dbInstance
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    // 3. Delete password reset tokens
    await dbInstance
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    // 4. Delete 2FA secrets
    await dbInstance
      .delete(twoFactorSecrets)
      .where(eq(twoFactorSecrets.userId, userId));

    // 5. Delete user
    await dbInstance
      .delete(users)
      .where(eq(users.id, userId));

    console.log(`[GDPR] User account deleted: ${userId}`);
    return true;
  }

  /**
   * Anonymize user data (keep account but remove personal identifiers)
   * Alternative to full deletion for some use cases
   */
  async anonymizeUser(userId: number): Promise<boolean> {
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      throw new Error("Database not available");
    }

    // Anonymize user data
    await dbInstance
      .update(users)
      .set({
        email: `deleted_${userId}@anonymous.local`,
        name: "Deleted User",
        passwordHash: null,
        isEmailVerified: null,
      })
      .where(eq(users.id, userId));

    console.log(`[GDPR] User anonymized: ${userId}`);
    return true;
  }
}

export const gdprService = new GDPRService();
