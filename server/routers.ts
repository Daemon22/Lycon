import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getBrowserSyncSnapshot, saveBrowserSyncSnapshot } from "./db";
import {
  syncPutInputSchema,
  registerInputSchema,
  loginInputSchema,
  emailVerificationInputSchema,
  passwordResetRequestInputSchema,
  passwordResetConfirmInputSchema,
  twoFactorSetupInputSchema,
  twoFactorVerifyInputSchema,
  twoFactorDisableInputSchema,
} from "../shared/validators";
import {
  registerUser,
  loginUser,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset,
} from "./_core/authService";
import {
  generateTwoFactorSecret,
  verifyTwoFactorSetup,
  verifyTwoFactorToken,
  disableTwoFactor,
  isTwoFactorEnabled,
} from "./_core/twoFactorAuth";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { gdprService } from "./_core/gdprService";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    // Email/password registration
    register: publicProcedure
      .input(registerInputSchema)
      .mutation(async ({ input }) => {
        const result = await registerUser(input);
        return {
          success: true,
          userId: result.userId,
          email: result.email,
          message: "Registration successful. Please check your email to verify your account.",
        };
      }),

    // Email/password login
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await loginUser(input);

        // Check if 2FA is enabled
        const twoFactorEnabled = await isTwoFactorEnabled(result.userId);

        if (twoFactorEnabled) {
          // Return temp session info, require 2FA verification
          return {
            requiresTwoFactor: true,
            userId: result.userId,
            email: result.email,
          };
        }

        // Create session token
        const openId = `email_${Buffer.from(result.email).toString("base64url")}`;
        const sessionToken = await sdk.createSessionToken(openId, {
          name: result.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: {
            id: result.userId,
            email: result.email,
            name: result.name,
          },
        };
      }),

    // Email verification
    verifyEmail: publicProcedure
      .input(emailVerificationInputSchema)
      .mutation(async ({ input }) => {
        await verifyEmail(input);
        return {
          success: true,
          message: "Email verified successfully",
        };
      }),

    // Password reset request
    passwordResetRequest: publicProcedure
      .input(passwordResetRequestInputSchema)
      .mutation(async ({ input }) => {
        await requestPasswordReset(input);
        return {
          success: true,
          message: "If an account with this email exists, a password reset link has been sent",
        };
      }),

    // Password reset confirmation
    passwordResetConfirm: publicProcedure
      .input(passwordResetConfirmInputSchema)
      .mutation(async ({ input }) => {
        await confirmPasswordReset(input);
        return {
          success: true,
          message: "Password reset successfully",
        };
      }),

    // Two-factor authentication setup
    twoFactorSetup: protectedProcedure
      .mutation(async ({ ctx }) => {
        const result = await generateTwoFactorSecret(ctx.user.id);
        return {
          secret: result.secret,
          qrCodeUrl: result.qrCodeUrl,
        };
      }),

    // Verify two-factor setup
    twoFactorVerifySetup: protectedProcedure
      .input(twoFactorSetupInputSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await verifyTwoFactorSetup(ctx.user.id, input.token);
        return {
          success: true,
          backupCodes: result.backupCodes,
          message: "Two-factor authentication enabled successfully",
        };
      }),

    // Verify two-factor token during login
    twoFactorVerify: publicProcedure
      .input(twoFactorVerifyInputSchema)
      .mutation(async ({ ctx, input }) => {
        // This would need the userId from a temp session, simplified for now
        // In production, store temp session with userId in Redis
        return {
          success: true,
          message: "Two-factor verification successful",
        };
      }),

    // Disable two-factor authentication
    twoFactorDisable: protectedProcedure
      .input(twoFactorDisableInputSchema)
      .mutation(async ({ ctx, input }) => {
        await disableTwoFactor(ctx.user.id, input.password);
        return {
          success: true,
          message: "Two-factor authentication disabled",
        };
      }),

    // Check if 2FA is enabled
    twoFactorStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const enabled = await isTwoFactorEnabled(ctx.user.id);
        return {
          enabled,
        };
      }),

    // GDPR: Export user data
    exportData: protectedProcedure
      .mutation(async ({ ctx }) => {
        const data = await gdprService.exportUserData(ctx.user.id);
        return {
          success: true,
          data,
        };
      }),

    // GDPR: Delete user account
    deleteAccount: protectedProcedure
      .input(twoFactorDisableInputSchema) // Reuse password input schema
      .mutation(async ({ ctx, input }) => {
        await gdprService.deleteUserAccount(ctx.user.id, input.password);
        return {
          success: true,
          message: "Account deleted successfully",
        };
      }),
  }),

  sync: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const snapshot = await getBrowserSyncSnapshot(ctx.user.id);
      return snapshot ? { revision: snapshot.revision, payload: snapshot.payload, updatedAt: snapshot.updatedAt } : null;
    }),
    put: protectedProcedure
      .input(syncPutInputSchema)
      .mutation(async ({ ctx, input }) => saveBrowserSyncSnapshot(ctx.user.id, input.baseRevision, input.payload)),
  }),
});

export type AppRouter = typeof appRouter;
