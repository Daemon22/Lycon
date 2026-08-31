import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { deleteLibrarySnapshot, getLibrarySnapshot, putLibrarySnapshot } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

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
  library: router({
    remove: protectedProcedure.mutation(async ({ ctx }) => deleteLibrarySnapshot(ctx.user.id)),
    export: protectedProcedure.query(async ({ ctx }) => {
      const snapshot = await getLibrarySnapshot(ctx.user.id);
      return snapshot ? { revision: snapshot.revision, payload: snapshot.payload } : { revision: 0, payload: "" };
    }),
    get: protectedProcedure.query(async ({ ctx }) => {
      const snapshot = await getLibrarySnapshot(ctx.user.id);
      return snapshot ? { revision: snapshot.revision, payload: snapshot.payload } : { revision: 0, payload: "" };
    }),
    put: protectedProcedure
      .input(z.object({ baseRevision: z.number().int().min(0), payload: z.string().max(5_000_000) }))
      .mutation(async ({ ctx, input }) => putLibrarySnapshot(ctx.user.id, input.payload, input.baseRevision)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
