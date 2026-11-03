import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { emailVerificationTokens, passwordResetTokens, users } from "../../drizzle/schema";
import * as db from "../db";
import { emailService } from "./emailService";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface EmailVerificationInput {
  token: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  newPassword: string;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` };
  }
  // At least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one letter and one number" };
  }
  return { valid: true };
}

/**
 * Hash password using Argon2
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify password against hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error("[Auth] Password verification failed:", error);
    return false;
  }
}

/**
 * Register a new user with email/password
 */
export async function registerUser(input: RegisterInput): Promise<{ userId: number; email: string }> {
  const { email, password, name } = input;

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error);
  }

  // Check if user already exists
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const existingUser = await dbInstance
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const newUser = await dbInstance
    .insert(users)
    .values({
      email,
      passwordHash,
      name: name || null,
      loginMethod: "email",
      openId: generateOpenIdFromEmail(email),
    })
    .returning();

  if (!newUser[0]) {
    throw new Error("Failed to create user");
  }

  // Generate email verification token
  const token = await createEmailVerificationToken(newUser[0].id, email);

  // Send verification email
  await emailService.sendVerificationEmail(email, token);

  return { userId: newUser[0].id, email: newUser[0].email! };
}

/**
 * Login user with email/password
 */
export async function loginUser(input: LoginInput): Promise<{ userId: number; email: string; name: string | null }> {
  const { email, password } = input;

  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const user = await dbInstance
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user.length === 0) {
    throw new Error("Invalid email or password");
  }

  const foundUser = user[0];

  if (!foundUser.passwordHash) {
    throw new Error("This account uses OAuth login. Please use OAuth to sign in.");
  }

  const isValid = await verifyPassword(foundUser.passwordHash, password);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Update last signed in
  await db.upsertUser({
    openId: foundUser.openId,
    lastSignedIn: new Date(),
  });

  return { userId: foundUser.id, email: foundUser.email!, name: foundUser.name };
}

/**
 * Generate email verification token
 */
async function createEmailVerificationToken(userId: number, email: string): Promise<string> {
  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  // Delete any existing tokens for this user
  await dbInstance
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await dbInstance.insert(emailVerificationTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

/**
 * Verify email with token
 */
export async function verifyEmail(input: EmailVerificationInput): Promise<boolean> {
  const { token } = input;

  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const tokenRecord = await dbInstance
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);

  if (tokenRecord.length === 0) {
    throw new Error("Invalid verification token");
  }

  const record = tokenRecord[0];

  // Check if token is expired
  if (record.expiresAt < new Date()) {
    throw new Error("Verification token has expired");
  }

  // Update user as verified
  await dbInstance
    .update(users)
    .set({ isEmailVerified: new Date() })
    .where(eq(users.id, record.userId));

  // Delete the token
  await dbInstance
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token));

  return true;
}

/**
 * Request password reset
 */
export async function requestPasswordReset(input: PasswordResetRequestInput): Promise<boolean> {
  const { email } = input;

  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const user = await dbInstance
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user.length === 0) {
    // Don't reveal if email exists for security
    return true;
  }

  const foundUser = user[0];

  if (!foundUser.passwordHash) {
    // OAuth accounts can't reset password
    return true;
  }

  // Delete any existing reset tokens for this user
  await dbInstance
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, foundUser.id));

  // Create new reset token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await dbInstance.insert(passwordResetTokens).values({
    userId: foundUser.id,
    token,
    expiresAt,
  });

  // Send password reset email
  await emailService.sendPasswordResetEmail(email, token);

  return true;
}

/**
 * Confirm password reset
 */
export async function confirmPasswordReset(input: PasswordResetConfirmInput): Promise<boolean> {
  const { token, newPassword } = input;

  // Validate new password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error);
  }

  const dbInstance = await getDb();
  if (!dbInstance) {
    throw new Error("Database not available");
  }

  const tokenRecord = await dbInstance
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (tokenRecord.length === 0) {
    throw new Error("Invalid reset token");
  }

  const record = tokenRecord[0];

  // Check if token is expired
  if (record.expiresAt < new Date()) {
    throw new Error("Reset token has expired");
  }

  // Check if token already used
  if (record.usedAt) {
    throw new Error("Reset token has already been used");
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user password
  await dbInstance
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, record.userId));

  // Mark token as used
  await dbInstance
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));

  return true;
}

/**
 * Generate a deterministic openId from email for password-based accounts
 */
function generateOpenIdFromEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  return `email_${Buffer.from(normalized).toString("base64url")}`;
}

// Helper to get DB instance
async function getDb() {
  return db.getDb();
}
