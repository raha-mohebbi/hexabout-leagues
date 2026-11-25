import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import {
  createAdminAuthentication,
  requireAdminRole,
} from "../admin-auth/admin-auth.middleware.js";
import { createVoidMatchController } from "../matches/match-void.controller.js";

export function createAdminMatchesRouter(db: Pool = pool) {
  const router = Router();

  router.post(
    "/:matchId/void",
    createAdminAuthentication(db),
    requireAdminRole("superadmin", "admin"),
    createVoidMatchController(db)
  );

  return router;
}
