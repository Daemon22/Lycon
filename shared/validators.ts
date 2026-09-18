import { z } from "zod";

export const destinationSchema = z.string().trim().min(1).max(2048);

export const tabSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().nonnegative()]),
  title: z.string().trim().min(1).max(200),
  url: destinationSchema,
  active: z.boolean().optional(),
});

export const syncPayloadSchema = z.string().min(2).max(60000);

export const syncPutInputSchema = z.object({
  baseRevision: z.number().int().min(0),
  payload: syncPayloadSchema,
});
