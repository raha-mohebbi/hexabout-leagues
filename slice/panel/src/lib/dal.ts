import "server-only";

import { z } from "zod";

import { destroyPanelSession, readPanelSession } from "./session";
import {
  adminSessionResponseSchema,
  leaderboardResponseSchema,
  leagueListResponseSchema,
  loginResponseSchema,
  voidMatchResponseSchema,
} from "./schemas";
import type { AdminRole } from "./schemas";

const apiBaseUrlSchema = z.string().url();
const loginEnvelopeSchema = loginResponseSchema;

export class BffError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "BffError";
  }
}

function getApiBaseUrl() {
  const result = apiBaseUrlSchema.safeParse(process.env.API_BASE_URL);

  if (!result.success) {
    throw new BffError(503, "League API is not configured");
  }

  const url = new URL(result.data);

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new BffError(503, "League API is not configured safely");
  }

  return url.toString().replace(/\/+$/, "");
}

async function fetchUpstream<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    token?: string;
    body?: unknown;
    schema: z.ZodType<T>;
  }
): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    if (error instanceof BffError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new BffError(504, "The League API request timed out");
    }
    throw new BffError(502, "The League API is unavailable");
  }

  if (!response.ok) {
    const status =
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status === 409 ||
      response.status === 422 ||
      response.status === 429
        ? response.status
        : response.status >= 500
          ? 502
          : response.status;

    if (response.status === 401 && options.token) {
      await destroyPanelSession();
    }

    const messages: Record<number, string> = {
      400: "The request was not accepted",
      401: "Your session has expired",
      403: "You do not have permission to perform this action",
      404: "The requested resource was not found",
      409: "The requested action conflicts with the current state",
      422: "The request could not be processed",
      429: "Too many requests. Try again shortly",
      502: "The League API is unavailable",
    };
    throw new BffError(status, messages[status] ?? "The request failed");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BffError(502, "The League API returned an invalid response");
  }

  const parsed = options.schema.safeParse(payload);

  if (!parsed.success) {
    throw new BffError(502, "The League API returned an invalid response");
  }

  return parsed.data;
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetchUpstream("/api/v1/admin/auth/login", {
    method: "POST",
    body: { email, password },
    schema: loginEnvelopeSchema,
  });

  return response.data;
}

export async function requireAdminSession(
  roles: readonly AdminRole[] = ["superadmin", "admin", "manager"]
) {
  const session = await readPanelSession();

  if (!session) {
    throw new BffError(401, "Authentication required");
  }

  if (!roles.includes(session.admin.role)) {
    throw new BffError(403, "You do not have permission to perform this action");
  }

  return session;
}

export async function confirmAdminSession(
  token: string
) {
  const response = await fetchUpstream("/api/v1/admin/auth/session", {
    method: "GET",
    token,
    schema: adminSessionResponseSchema,
  });

  return response.data;
}

export async function logoutAdmin(token: string) {
  const emptyEnvelope = z.object({
    success: z.literal(true),
    data: z.null(),
    error: z.null(),
  });

  return fetchUpstream("/api/v1/admin/auth/logout", {
    method: "POST",
    token,
    schema: emptyEnvelope,
  });
}

export async function getAdminLeagues(
  token: string,
  query: { limit?: string; cursor?: string }
) {
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", query.limit);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return fetchUpstream(`/api/v1/admin/leagues${suffix}`, {
    method: "GET",
    token,
    schema: leagueListResponseSchema,
  });
}

export async function getAdminLeaderboard(token: string, leagueId: string) {
  return fetchUpstream(
    `/api/v1/admin/leagues/${encodeURIComponent(leagueId)}/leaderboard`,
    {
      method: "GET",
      token,
      schema: leaderboardResponseSchema,
    }
  );
}

export async function voidAdminMatch(
  token: string,
  matchId: string,
  reason: string
) {
  return fetchUpstream(
    `/api/v1/admin/matches/${encodeURIComponent(matchId)}/void`,
    {
      method: "POST",
      token,
      body: { reason },
      schema: voidMatchResponseSchema,
    }
  );
}
