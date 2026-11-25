import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

import pool from "./config/database.js";
import { createAdminAuthRouter } from "./modules/admin-auth/admin-auth.routes.js";
import { createAdminLeaguesRouter } from "./modules/admin-leagues/admin-leagues.routes.js";
import { createAdminMatchesRouter } from "./modules/admin-matches/admin-matches.routes.js";
import { createLeaderboardRouter } from "./modules/leaderboard/leaderboard.routes.js";
import { createMatchRouter } from "./modules/matches/match.routes.js";
import { createPlayerLeaguesRouter } from "./modules/player-leagues/player-leagues.routes.js";
import {
  unavailablePlayerTokenVerifier,
} from "./modules/player-auth/player-auth.js";
import type { PlayerTokenVerifier } from "./modules/player-auth/player-auth.js";

export interface AppOptions {
  db?: Pool;
  playerTokenVerifier?: PlayerTokenVerifier;
  corsOrigins?: string[];
}

function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(error);
  }

  const requestId = res.getHeader("X-Request-Id");
  const errorStatus =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : undefined;
  const isClientError = errorStatus === 400 || errorStatus === 413;
  const status = isClientError ? errorStatus : 500;

  console.error(
    JSON.stringify({
      event: "api_request_error",
      requestId,
      status,
      errorType:
        error instanceof Error ? error.constructor.name : "UnknownError",
    })
  );

  return res.status(status).json({
    success: false,
    data: null,
    error: {
      message: isClientError ? "Invalid request" : "Internal server error",
    },
  });
}

export function createApp(options: AppOptions = {}) {
  const db = options.db ?? pool;
  const playerTokenVerifier =
    options.playerTokenVerifier ?? unavailablePlayerTokenVerifier;
  const corsOrigins =
    options.corsOrigins ??
    (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  const app = express();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Request-Id", randomUUID());
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: "ok",
      },
      error: null,
    });
  });

  app.get("/ready", async (_req, res, next) => {
    try {
      await db.query("SELECT 1");
      return res.status(200).json({
        success: true,
        data: {
          status: "ready",
        },
        error: null,
      });
    } catch (error) {
      console.error("READY CHECK FAILED:", error);
      return next(error);
    }
  });

  app.use("/api/v1/matches", createMatchRouter(db, playerTokenVerifier));
  app.use(
    "/api/v1/leagues",
    createLeaderboardRouter(db, playerTokenVerifier)
  );
  app.use(
    "/api/v1/me/leagues",
    createPlayerLeaguesRouter(db, playerTokenVerifier)
  );
  app.use("/api/v1/admin/auth", createAdminAuthRouter(db));
  app.use("/api/v1/admin/leagues", createAdminLeaguesRouter(db));
  app.use("/api/v1/admin/matches", createAdminMatchesRouter(db));

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      data: null,
      error: {
        message: "Not found",
      },
    });
  });

  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;