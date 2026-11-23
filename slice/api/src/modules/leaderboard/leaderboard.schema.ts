import { z } from "zod";

export const leaderboardParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

export type LeaderboardParams = z.infer<typeof leaderboardParamsSchema>;
