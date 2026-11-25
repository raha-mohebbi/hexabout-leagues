import { afterEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  destroyPanelSession: vi.fn(),
  readPanelSession: vi.fn(),
}));

vi.mock("@/lib/session", () => sessionMocks);

import {
  BffError,
  getAdminLeagues,
  loginAdmin,
} from "@/lib/dal";
import { destroyPanelSession } from "@/lib/session";

const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin",
};
const token = "a".repeat(48);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("server-side League API client", () => {
  it("uses fixed API paths, bearer auth, and no-store requests", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            accessToken: token,
            tokenType: "Bearer",
            expiresAt: "2030-01-01T00:00:00.000Z",
            admin,
          },
          error: null,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await loginAdmin(admin.email, "a-secure-password");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/auth/login",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          email: admin.email,
          password: "a-secure-password",
        }),
      })
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { items: [], nextCursor: null },
          error: null,
        }),
        { status: 200 }
      )
    );
    await getAdminLeagues(token, { limit: "20" });
    const [url, options] = fetchMock.mock.calls.at(-1) as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example.test/api/v1/admin/leagues?limit=20");
    expect(options.cache).toBe("no-store");
    expect(new Headers(options.headers).get("Authorization")).toBe(
      `Bearer ${token}`
    );
  });

  it("converts upstream failures to safe panel errors", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("internal database password details", { status: 503 })
      )
    );

    await expect(loginAdmin(admin.email, "a-secure-password")).rejects.toEqual(
      expect.objectContaining({
        status: 502,
        message: "The League API is unavailable",
      })
    );
  });

  it("revokes the local cookie when the backend says a session expired", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    );

    await expect(getAdminLeagues(token, {})).rejects.toMatchObject({
      status: 401,
      message: "Your session has expired",
    });
    expect(destroyPanelSession).toHaveBeenCalledOnce();
  });

  it("fails closed for insecure production API origins", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_BASE_URL", "http://api.example.test");

    await expect(loginAdmin(admin.email, "a-secure-password")).rejects.toBeInstanceOf(
      BffError
    );
    await expect(loginAdmin(admin.email, "a-secure-password")).rejects.toMatchObject({
      status: 503,
    });
  });
});
