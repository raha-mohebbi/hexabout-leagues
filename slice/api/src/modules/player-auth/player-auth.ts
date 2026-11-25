import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const playerPrincipalSchema = z.object({
  playerId: z.string().uuid(),
});

export interface PlayerPrincipal {
  playerId: string;
}

export interface PlayerTokenVerifier {
  verify(token: string): Promise<PlayerPrincipal>;
}

export class InvalidPlayerTokenError extends Error {
  constructor() {
    super("Invalid player token");
    this.name = "InvalidPlayerTokenError";
  }
}

export class PlayerTokenVerifierUnavailableError extends Error {
  constructor() {
    super("Player token verification is not configured");
    this.name = "PlayerTokenVerifierUnavailableError";
  }
}

export const unavailablePlayerTokenVerifier: PlayerTokenVerifier = {
  async verify() {
    throw new PlayerTokenVerifierUnavailableError();
  },
};

function authError(res: Response, status: number, message: string) {
  return res.status(status).json({
    success: false,
    data: null,
    error: {
      message,
    },
  });
}

export function createPlayerAuthentication(
  verifier: PlayerTokenVerifier
) {
  return async function authenticatePlayer(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const authorization = req.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/);

    if (!match) {
      return authError(res, 401, "Authentication required");
    }
    const token = match[1];

    if (!token) {
      return authError(res, 401, "Authentication required");
    }

    try {
      const principal = playerPrincipalSchema.safeParse(
        await verifier.verify(token)
      );

      if (!principal.success) {
        return authError(res, 401, "Invalid player token");
      }

      req.player = principal.data;
      return next();
    } catch (error) {
      if (error instanceof InvalidPlayerTokenError) {
        return authError(res, 401, "Invalid player token");
      }

      if (error instanceof PlayerTokenVerifierUnavailableError) {
        return authError(res, 503, "Player authentication is not configured");
      }

      return next(error);
    }
  };
}
