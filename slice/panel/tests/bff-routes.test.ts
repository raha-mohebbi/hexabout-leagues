import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockBffError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message);
      this.name = "BffError";
    }
  }

  return {
    BffError: MockBffError,
    loginAdmin: vi.fn(),
    logoutAdmin: vi.fn(),
    requireAdminSession: vi.fn(),
    confirmAdminSession: vi.fn(),
    getAdminLeagues: vi.fn(),
    getAdminLeaderboard: vi.fn(),
    voidAdminMatch: vi.fn(),
    savePanelSession: vi.fn(),
    destroyPanelSession: vi.fn(),
  };
});

vi.mock("@/lib/dal", () => mocks);
vi.mock("@/lib/session", () => ({
  SessionConfigurationError: class SessionConfigurationError extends Error {
    readonly status = 503;
  },
  savePanelSession: mocks.savePanelSession,
  destroyPanelSession: mocks.destroyPanelSession,
}));

import { BffError } from "@/lib/dal";
import { destroyPanelSession, savePanelSession } from "@/lib/session";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { GET as getLeagues } from "@/app/api/leagues/route";
import { GET as getLeaderboard } from "@/app/api/leagues/[leagueId]/leaderboard/route";
import { POST as voidMatch } from "@/app/api/matches/[matchId]/void/route";

const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin" as const,
};
const token = "a".repeat(48);
const origin = "http://localhost:3000";

function request(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  includeOrigin = false
) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      ...(includeOrigin ? { Origin: origin } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function payload(response: Response) {
  return response.json();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("authentication BFF routes", () => {
  it("rejects login without a same-origin request", async () => {
    const response = await login(
      request("/api/auth/login", "POST", {
        email: admin.email,
        password: "a-secure-password",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.loginAdmin).not.toHaveBeenCalled();
  });

  it("validates login fields before calling the API", async () => {
    const response = await login(
      request(
        "/api/auth/login",
        "POST",
        { email: "not-an-email", password: "short" },
        true
      )
    );

    expect(response.status).toBe(400);
    expect(mocks.loginAdmin).not.toHaveBeenCalled();
  });

  it("stores the upstream token server-side and returns only the admin", async () => {
    mocks.loginAdmin.mockResolvedValue({
      accessToken: token,
      tokenType: "Bearer",
      expiresAt: "2030-01-01T00:00:00.000Z",
      admin,
    });

    const response = await login(
      request(
        "/api/auth/login",
        "POST",
        { email: admin.email, password: "a-secure-password" },
        true
      )
    );
    const result = await payload(response);

    expect(response.status).toBe(200);
    expect(result).toEqual({ success: true, data: { admin }, error: null });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(savePanelSession).toHaveBeenCalledWith({
      backendToken: token,
      expiresAt: "2030-01-01T00:00:00.000Z",
      admin,
    });
  });

  it("confirms the backend-authoritative admin identity", async () => {
    mocks.requireAdminSession.mockResolvedValue({
      backendToken: token,
      admin,
    });
    mocks.confirmAdminSession.mockResolvedValue(admin);

    const response = await getSession();

    expect(response.status).toBe(200);
    expect(await payload(response)).toEqual({
      success: true,
      data: admin,
      error: null,
    });
    expect(mocks.confirmAdminSession).toHaveBeenCalledWith(token);
  });

  it("returns a safe unauthenticated response when session lookup fails", async () => {
    mocks.requireAdminSession.mockRejectedValue(
      new BffError(401, "Authentication required")
    );

    const response = await getSession();

    expect(response.status).toBe(401);
    expect((await payload(response)).error.message).toBe(
      "Authentication required"
    );
  });

  it("destroys the panel session after logout, including when upstream auth expired", async () => {
    mocks.requireAdminSession.mockRejectedValue(
      new BffError(401, "Authentication required")
    );

    const response = await logout(
      request("/api/auth/logout", "POST", undefined, true)
    );

    expect(response.status).toBe(200);
    expect(destroyPanelSession).toHaveBeenCalledOnce();
  });
});

describe("protected data BFF routes", () => {
  it("validates league pagination and passes a bounded query through", async () => {
    mocks.requireAdminSession.mockResolvedValue({ backendToken: token });
    mocks.getAdminLeagues.mockResolvedValue({
      data: { items: [], nextCursor: null },
    });

    const response = await getLeagues(
      request("/api/leagues?limit=50&cursor=next")
    );

    expect(response.status).toBe(200);
    expect(mocks.getAdminLeagues).toHaveBeenCalledWith(token, {
      limit: "50",
      cursor: "next",
    });
  });

  it("rejects invalid league identifiers before requiring a session", async () => {
    const response = await getLeaderboard(
      request("/api/leagues/not-a-uuid/leaderboard"),
      { params: Promise.resolve({ leagueId: "not-a-uuid" }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.requireAdminSession).not.toHaveBeenCalled();
    expect(mocks.getAdminLeaderboard).not.toHaveBeenCalled();
  });

  it("returns leaderboard data only after authentication", async () => {
    mocks.requireAdminSession.mockResolvedValue({ backendToken: token });
    mocks.getAdminLeaderboard.mockResolvedValue({
      data: [{ rank: 1, playerId: admin.id, score: 9 }],
    });
    const leagueId = "22222222-2222-4222-8222-222222222222";

    const response = await getLeaderboard(
      request(`/api/leagues/${leagueId}/leaderboard`),
      { params: Promise.resolve({ leagueId }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.getAdminLeaderboard).toHaveBeenCalledWith(token, leagueId);
  });

  it("restricts match invalidation to authorized roles", async () => {
    mocks.requireAdminSession.mockRejectedValue(
      new BffError(403, "You do not have permission")
    );
    const matchId = "33333333-3333-4333-8333-333333333333";

    const response = await voidMatch(
      request(
        `/api/matches/${matchId}/void`,
        "POST",
        { reason: "Duplicate result" },
        true
      ),
      { params: Promise.resolve({ matchId }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.requireAdminSession).toHaveBeenCalledWith([
      "superadmin",
      "admin",
    ]);
    expect(mocks.voidAdminMatch).not.toHaveBeenCalled();
  });

  it("rejects invalidation requests with an empty reason", async () => {
    mocks.requireAdminSession.mockResolvedValue({ backendToken: token });
    const matchId = "33333333-3333-4333-8333-333333333333";

    const response = await voidMatch(
      request(`/api/matches/${matchId}/void`, "POST", { reason: " " }, true),
      { params: Promise.resolve({ matchId }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.requireAdminSession).not.toHaveBeenCalled();
    expect(mocks.voidAdminMatch).not.toHaveBeenCalled();
  });
});
