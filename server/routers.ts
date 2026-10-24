import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getBrowserSyncSnapshot, saveBrowserSyncSnapshot } from "./db";
import { syncPutInputSchema } from "../shared/validators";

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
