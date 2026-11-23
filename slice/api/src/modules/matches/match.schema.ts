import { z } from "zod";

export const reportMatchSchema = z
  .object({
    externalMatchId: z.string().trim().min(1).max(150),
    leagueId: z.string().uuid(),
    winnerId: z.string().uuid(),
    loserId: z.string().uuid(),
  })
  .refine((data) => data.winnerId !== data.loserId, {
    message: "Winner and loser must be different players",
    path: ["loserId"],
  });

export type ReportMatchInput = z.infer<typeof reportMatchSchema>;