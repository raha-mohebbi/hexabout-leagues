import {
  BffError,
  getAdminLeaderboard,
  requireAdminSession,
} from "@/lib/dal";
import { leagueIdSchema } from "@/lib/schemas";
import { apiFailure, apiSuccess } from "@/lib/route-utils";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/leagues/[leagueId]/leaderboard">
) {
  const { leagueId } = await context.params;
  const validation = leagueIdSchema.safeParse(leagueId);

  if (!validation.success) {
    return apiFailure(new BffError(400, "Invalid league identifier"));
  }

  try {
    const session = await requireAdminSession();
    const result = await getAdminLeaderboard(
      session.backendToken,
      validation.data
    );

    return apiSuccess(result.data);
  } catch (error) {
    return apiFailure(error);
  }
}
