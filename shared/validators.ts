import { z } from "zod";

export const destinationSchema = z.string().trim().min(1).max(2048);

export const tabSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().nonnegative()]),
  title: z.string().trim().min(1).max(200),
  url: destinationSchema,
  active: z.boolean().optional(),
});

export const syncPayloadSchema = z.string().min(2).max(60000).refine((payload) => {
  try {
    const parsed = JSON.parse(payload) as { tabs?: unknown };
    return !Array.isArray(parsed.tabs) || !parsed.tabs.some((tab) =>
      Boolean(tab && typeof tab === "object" && (tab as { isPrivate?: unknown }).isPrivate === true)
    );
  } catch {
    return true;
  }
}, { message: "Private session tabs cannot be synchronized." });

export const syncPutInputSchema = z.object({
  baseRevision: z.number().int().min(0),
  payload: syncPayloadSchema,
});

// Auth validators
export const emailSchema = z.string().trim().email("Invalid email address").max(320);
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const emailVerificationInputSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const passwordResetRequestInputSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmInputSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export const twoFactorSetupInputSchema = z.object({
  token: z.string().min(6, "Code must be at least 6 characters").max(6, "Code must be exactly 6 characters"),
});

export const twoFactorVerifyInputSchema = z.object({
  token: z.string().min(6, "Code must be at least 6 characters").max(6, "Code must be exactly 6 characters"),
});

export const twoFactorDisableInputSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
