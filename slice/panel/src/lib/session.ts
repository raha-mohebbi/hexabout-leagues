import "server-only";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { z } from "zod";

import { adminIdentitySchema } from "./schemas";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const sessionDataSchema = z.object({
  backendToken: z.string().regex(/^[A-Za-z0-9_-]{40,}$/),
  expiresAt: z.string().datetime(),
  admin: adminIdentitySchema,
});

export type PanelSessionData = z.infer<typeof sessionDataSchema>;
type IronPanelSession = Partial<PanelSessionData> & {
  destroy(): void;
  save(): Promise<void>;
};

export class SessionConfigurationError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "SessionConfigurationError";
  }
}

function getSessionOptions() {
  const password = process.env.SESSION_PASSWORD;

  if (!password || password.length < 32) {
    throw new SessionConfigurationError(
      "Panel session configuration is unavailable"
    );
  }

  return {
    cookieName: "hexabout_admin_session",
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_TTL_SECONDS - 60,
    },
  };
}

export async function readPanelSession() {
  const session = await getIronSession<IronPanelSession>(
    await cookies(),
    getSessionOptions()
  );
  const parsed = sessionDataSchema.safeParse({
    backendToken: session.backendToken,
    expiresAt: session.expiresAt,
    admin: session.admin,
  });

  if (!parsed.success) {
    if (
      session.backendToken !== undefined ||
      session.expiresAt !== undefined ||
      session.admin !== undefined
    ) {
      session.destroy();
    }

    return null;
  }

  if (Date.parse(parsed.data.expiresAt) <= Date.now()) {
    session.destroy();
    return null;
  }

  return parsed.data;
}

export async function savePanelSession(data: PanelSessionData) {
  const validated = sessionDataSchema.parse(data);
  const remainingSeconds = Math.floor(
    (Date.parse(validated.expiresAt) - Date.now()) / 1000
  );

  if (remainingSeconds <= 0) {
    throw new SessionConfigurationError("The administrator session expired");
  }

  const session = await getIronSession<IronPanelSession>(
    await cookies(),
    {
      ...getSessionOptions(),
      ttl: Math.min(SESSION_TTL_SECONDS, remainingSeconds),
      cookieOptions: {
        ...getSessionOptions().cookieOptions,
        maxAge: Math.max(1, Math.min(SESSION_TTL_SECONDS, remainingSeconds) - 60),
        expires: new Date(validated.expiresAt),
      },
    }
  );

  Object.assign(session, validated);
  await session.save();
}

export async function destroyPanelSession() {
  const session = await getIronSession<IronPanelSession>(
    await cookies(),
    getSessionOptions()
  );
  session.destroy();
}
