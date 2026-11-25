import { z } from "zod";

export const adminLeagueListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(256).optional(),
});

export const adminLeagueParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

export type AdminLeagueListQuery = z.infer<
  typeof adminLeagueListQuerySchema
>;
