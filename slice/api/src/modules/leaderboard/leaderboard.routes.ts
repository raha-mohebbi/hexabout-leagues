import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { createLeaderboardController } from "./leaderboard.controller.js";
import {
  createPlayerAuthentication,
  unavailablePlayerTokenVerifier,
} from "../player-auth/player-auth.js";
import type { PlayerTokenVerifier } from "../player-auth/player-auth.js";

export function createLeaderboardRouter(
  db: Pool = pool,
  playerTokenVerifier: PlayerTokenVerifier = unavailablePlayerTokenVerifier
) {
  const router = Router();

  router.get(
    "/:leagueId/leaderboard",
    createPlayerAuthentication(playerTokenVerifier),
    createLeaderboardController(db)
  );

  return router;
}

export default createLeaderboardRouter();
