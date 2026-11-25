import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieState = vi.hoisted(() => ({
  values: new Map<string, { name: string; value: string }>(),
  lastOptions: undefined as
    | {
        httpOnly?: boolean;
        sameSite?: string;
        secure?: boolean;
        maxAge?: number;
        expires?: Date;
      }
    | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieState.values.get(name),
    getAll: (name?: string) =>
      [...cookieState.values.values()].filter(
        (cookie) => name === undefined || cookie.name === name
      ),
    set: (
      name: string,
      value: string,
      options: typeof cookieState.lastOptions
    ) => {
      cookieState.values.set(name, { name, value });
      cookieState.lastOptions = options;
    },
    delete: (name: string) => cookieState.values.delete(name),
    has: (name: string) => cookieState.values.has(name),
  }),
}));

import {
  destroyPanelSession,
  readPanelSession,
  savePanelSession,
} from "@/lib/session";

const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin" as const,
};
const backendToken = "a".repeat(48);

beforeEach(() => {
  cookieState.values.clear();
  cookieState.lastOptions = undefined;
  process.env.SESSION_PASSWORD =
    "a-long-test-session-password-with-32-characters-minimum";
});

describe("panel session", () => {
  it("seals the backend token in a secure, HTTP-only cookie and reads it back", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await savePanelSession({ backendToken, expiresAt, admin });

    const cookie = cookieState.values.get("hexabout_admin_session");
    expect(cookie).toBeDefined();
    expect(cookie?.value).not.toContain(backendToken);
    expect(cookieState.lastOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
    });
    expect(await readPanelSession()).toEqual({
      backendToken,
      expiresAt,
      admin,
    });
  });

  it("does not save an already-expired backend session", async () => {
    await expect(
      savePanelSession({
        backendToken,
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        admin,
      })
    ).rejects.toThrow("The administrator session expired");

    expect(cookieState.values.size).toBe(0);
  });

  it("clears the local session cookie on logout", async () => {
    await savePanelSession({
      backendToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      admin,
    });

    await destroyPanelSession();

    expect(
      cookieState.values.get("hexabout_admin_session")?.value
    ).toBe("");
    expect(await readPanelSession()).toBeNull();
  });

  it("fails explicitly when the session secret is not configured", async () => {
    delete process.env.SESSION_PASSWORD;

    await expect(readPanelSession()).rejects.toThrow(
      "Panel session configuration is unavailable"
    );
  });
});
