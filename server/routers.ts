import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  sync: router({
    issueActivationCode: adminProcedure
      .input(z.object({
        representativeId: z.string().trim().min(1).max(128),
        ttlMinutes: z.number().int().min(5).max(60).optional(),
      }))
      .mutation(({ ctx, input }) => db.issueRepresentativeActivationCode({
        createdBy: ctx.user.id,
        representativeId: input.representativeId,
        ttlMinutes: input.ttlMinutes,
      })),

    redeemActivationCode: publicProcedure
      .input(z.object({
        code: z.string().trim().min(8).max(16),
        deviceId: z.string().trim().min(8).max(128),
        deviceLabel: z.string().trim().max(255).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.redeemRepresentativeActivationCode(input);
        if (!result) return { activated: false as const };
        return { activated: true as const, ...result };
      }),

    devices: adminProcedure.query(({ ctx }) => db.listRepresentativeDevices(ctx.user.id)),

    revokeDevice: adminProcedure
      .input(z.object({ deviceId: z.string().trim().min(8).max(128) }))
      .mutation(async ({ ctx, input }) => {
        await db.revokeRepresentativeDevice(ctx.user.id, input.deviceId);
        return { success: true as const };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
