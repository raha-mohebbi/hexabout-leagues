import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import {
  createAdminAuthentication,
  requireAdminRole,
} from "../admin-auth/admin-auth.middleware.js";
import {
  createAdminLeaderboardController,
  createAdminLeagueListController,
} from "./admin-leagues.controller.js";

export function createAdminLeaguesRouter(db: Pool = pool) {
  const router = Router();
  const authenticate = createAdminAuthentication(db);
  const readAccess = requireAdminRole("superadmin", "admin", "manager");

  router.use(authenticate, readAccess);
  router.get("/", createAdminLeagueListController(db));
  router.get(
    "/:leagueId/leaderboard",
    createAdminLeaderboardController(db)
  );

  return router;
}
