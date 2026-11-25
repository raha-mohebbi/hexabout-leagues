import {
  BffError,
  requireAdminSession,
  voidAdminMatch,
} from "@/lib/dal";
import {
  leagueIdSchema,
  voidMatchRequestSchema,
} from "@/lib/schemas";
import {
  apiFailure,
  apiSuccess,
  readJsonBody,
  requestHasSameOrigin,
} from "@/lib/route-utils";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matches/[matchId]/void">
) {
  if (!requestHasSameOrigin(request)) {
    return apiFailure(new BffError(403, "Request origin is not allowed"));
  }

  const { matchId } = await context.params;
  const idValidation = leagueIdSchema.safeParse(matchId);

  if (!idValidation.success) {
    return apiFailure(new BffError(400, "Invalid match identifier"));
  }

  try {
    const body = voidMatchRequestSchema.safeParse(
      await readJsonBody(request)
    );

    if (!body.success) {
      return apiFailure(new BffError(400, "Enter a reason for invalidation"));
    }

    const session = await requireAdminSession(["superadmin", "admin"]);
    const result = await voidAdminMatch(
      session.backendToken,
      matchId,
      body.data.reason
    );

    return apiSuccess(result.data);
  } catch (error) {
    return apiFailure(error);
  }
}
