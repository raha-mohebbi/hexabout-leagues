import {
  BffError,
  logoutAdmin,
  requireAdminSession,
} from "@/lib/dal";
import { destroyPanelSession } from "@/lib/session";
import {
  apiFailure,
  apiSuccess,
  requestHasSameOrigin,
} from "@/lib/route-utils";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return apiFailure(new BffError(403, "Request origin is not allowed"));
  }

  let upstreamFailure: unknown;

  try {
    const session = await requireAdminSession();
    await logoutAdmin(session.backendToken);
  } catch (error) {
    if (!(error instanceof BffError && error.status === 401)) {
      upstreamFailure = error;
    }
  } finally {
    try {
      await destroyPanelSession();
    } catch (error) {
      if (!upstreamFailure) {
        upstreamFailure = error;
      }
    }
  }

  if (upstreamFailure) {
    return apiFailure(upstreamFailure);
  }

  return apiSuccess(null);
}
