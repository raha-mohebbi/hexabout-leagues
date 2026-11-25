import { z } from "zod";

export const voidMatchParamsSchema = z.object({
  matchId: z.string().uuid(),
});

export const voidMatchBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export type VoidMatchInput = z.infer<typeof voidMatchBodySchema> & {
  matchId: string;
  adminId: string;
};
