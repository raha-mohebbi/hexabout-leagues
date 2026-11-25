import {
  getAdminLeagues,
  requireAdminSession,
  BffError,
} from "@/lib/dal";
import { leagueQuerySchema } from "@/lib/schemas";
import { apiFailure, apiSuccess } from "@/lib/route-utils";

export async function GET(request: Request) {
  const query = leagueQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );

  if (!query.success) {
    return apiFailure(new BffError(400, "Invalid pagination parameters"));
  }

  try {
    const session = await requireAdminSession();
    const result = await getAdminLeagues(
      session.backendToken,
      query.data
    );

    return apiSuccess(result.data);
  } catch (error) {
    return apiFailure(error);
  }
}
