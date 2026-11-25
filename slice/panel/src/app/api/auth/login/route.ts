import { loginRequestSchema } from "@/lib/schemas";
import { loginAdmin } from "@/lib/dal";
import { savePanelSession } from "@/lib/session";
import {
  apiFailure,
  apiSuccess,
  readJsonBody,
  requestHasSameOrigin,
} from "@/lib/route-utils";
import { BffError } from "@/lib/dal";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return apiFailure(new BffError(403, "Request origin is not allowed"));
  }

  try {
    const body = loginRequestSchema.safeParse(await readJsonBody(request));

    if (!body.success) {
      return apiFailure(new BffError(400, "Enter a valid email and password"));
    }

    const result = await loginAdmin(body.data.email, body.data.password);
    await savePanelSession({
      backendToken: result.accessToken,
      expiresAt: result.expiresAt,
      admin: result.admin,
    });

    return apiSuccess({ admin: result.admin });
  } catch (error) {
    return apiFailure(error);
  }
}
