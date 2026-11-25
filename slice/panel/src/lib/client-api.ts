"use client";

import { z } from "zod";

export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

const apiEnvelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z
    .object({
      message: z.string(),
    })
    .nullable(),
});

export async function clientApi<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    if (init?.body) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers,
    });
  } catch {
    throw new ClientApiError(0, "Unable to connect to the panel service");
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ClientApiError(502, "The panel returned an invalid response");
  }

  const envelope = apiEnvelopeSchema.safeParse(json);

  if (!envelope.success) {
    throw new ClientApiError(502, "The panel returned an invalid response");
  }

  if (response.status === 401) {
    if (
      typeof window !== "undefined" &&
      !["/api/auth/login", "/api/auth/session", "/api/auth/logout"].includes(path)
    ) {
      window.dispatchEvent(new Event("panel:session-expired"));
    }
    throw new ClientApiError(401, "Your session has expired. Sign in again.");
  }

  if (!response.ok || !envelope.data.success) {
    throw new ClientApiError(
      response.status,
      envelope.data.error?.message ?? "The request could not be completed"
    );
  }

  const parsed = schema.safeParse(envelope.data.data);

  if (!parsed.success) {
    throw new ClientApiError(502, "The panel returned an invalid response");
  }

  return parsed.data;
}
