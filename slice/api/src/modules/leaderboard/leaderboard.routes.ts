import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { createLeaderboardController } from "./leaderboard.controller.js";

export function createLeaderboardRouter(db: Pool = pool) {
  const router = Router();

  router.get("/:leagueId/leaderboard", createLeaderboardController(db));

  return router;
}

export default createLeaderboardRouter();
