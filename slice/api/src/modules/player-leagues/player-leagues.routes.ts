import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import {
  createPlayerAuthentication,
  unavailablePlayerTokenVerifier,
} from "../player-auth/player-auth.js";
import type { PlayerTokenVerifier } from "../player-auth/player-auth.js";
import { createPlayerLeagueListController } from "./player-leagues.controller.js";

export function createPlayerLeaguesRouter(
  db: Pool = pool,
  playerTokenVerifier: PlayerTokenVerifier = unavailablePlayerTokenVerifier
) {
  const router = Router();

  router.get(
    "/",
    createPlayerAuthentication(playerTokenVerifier),
    createPlayerLeagueListController(db)
  );

  return router;
}
