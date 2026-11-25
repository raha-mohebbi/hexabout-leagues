import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import {
  createAdminLoginController,
  createAdminLogoutController,
  createAdminSessionController,
} from "./admin-auth.controller.js";
import {
  createAdminAuthentication,
  createAdminLoginRateLimiter,
} from "./admin-auth.middleware.js";

export function createAdminAuthRouter(db: Pool = pool) {
  const router = Router();

  router.post(
    "/login",
    createAdminLoginRateLimiter(),
    createAdminLoginController(db)
  );
  router.post(
    "/logout",
    createAdminAuthentication(db),
    createAdminLogoutController(db)
  );
  router.get(
    "/session",
    createAdminAuthentication(db),
    createAdminSessionController()
  );

  return router;
}
