import {
  confirmAdminSession,
  requireAdminSession,
} from "@/lib/dal";
import { apiFailure, apiSuccess } from "@/lib/route-utils";

export async function GET() {
  try {
    const session = await requireAdminSession();
    const admin = await confirmAdminSession(session.backendToken);

    return apiSuccess(admin);
  } catch (error) {
    return apiFailure(error);
  }
}
