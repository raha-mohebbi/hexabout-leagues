import { NextResponse } from "next/server";

import { BffError } from "./dal";
import { SessionConfigurationError } from "./session";

export function privateJson(
  body: unknown,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}

export function apiSuccess<T>(data: T, status = 200) {
  return privateJson(
    {
      success: true,
      data,
      error: null,
    },
    status
  );
}

export function apiFailure(error: unknown) {
  if (
    error instanceof BffError ||
    error instanceof SessionConfigurationError
  ) {
    return privateJson(
      {
        success: false,
        data: null,
        error: {
          message: error.message,
        },
      },
      error instanceof BffError ? error.status : error.status
    );
  }

  return privateJson(
    {
      success: false,
      data: null,
      error: {
        message: "An unexpected error occurred",
      },
    },
    500
  );
}

export function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BffError(400, "Invalid JSON request body");
  }
}
