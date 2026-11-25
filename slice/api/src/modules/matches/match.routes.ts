
import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { createReportMatchController } from "./match.controller.js";
import {
  createPlayerAuthentication,
  unavailablePlayerTokenVerifier,
} from "../player-auth/player-auth.js";
import type { PlayerTokenVerifier } from "../player-auth/player-auth.js";

export function createMatchRouter(
  db: Pool = pool,
  playerTokenVerifier: PlayerTokenVerifier = unavailablePlayerTokenVerifier
) {
  const router = Router();

  router.post(
    "/results",
    createPlayerAuthentication(playerTokenVerifier),
    createReportMatchController(db)
  );

  return router;
}

export default createMatchRouter();
