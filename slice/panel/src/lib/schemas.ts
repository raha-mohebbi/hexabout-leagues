import { z } from "zod";

export const adminRoleSchema = z.enum(["superadmin", "admin", "manager"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminIdentitySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: adminRoleSchema,
});
export type AdminIdentity = z.infer<typeof adminIdentitySchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(12).max(1024),
});

export const loginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string().regex(/^[A-Za-z0-9_-]{40,}$/),
    tokenType: z.literal("Bearer"),
    expiresAt: z.string().datetime(),
    admin: adminIdentitySchema,
  }),
  error: z.null(),
});

export const adminSessionResponseSchema = z.object({
  success: z.literal(true),
  data: adminIdentitySchema,
  error: z.null(),
});

export const leagueSchema = z.object({
  id: z.string().uuid(),
  periodId: z.string().uuid(),
  name: z.string(),
  tier: z.string(),
  createdAt: z.string().datetime(),
});

export const leagueListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(leagueSchema),
    nextCursor: z.string().min(1).max(256).nullable(),
  }),
  error: z.null(),
});

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  playerId: z.string().uuid(),
  score: z.number().int().nonnegative(),
});

export const leaderboardResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(leaderboardEntrySchema),
  error: z.null(),
});

export const voidMatchRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const voidMatchResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    matchId: z.string().uuid(),
    status: z.literal("voided"),
    duplicate: z.boolean(),
  }),
  error: z.null(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: z.object({
    message: z.string(),
  }),
});

export const leagueQuerySchema = z.object({
  limit: z.string().regex(/^(?:[1-9]|[1-4]\d|50)$/).optional(),
  cursor: z.string().min(1).max(256).optional(),
});

export const leagueIdSchema = z.string().uuid();
