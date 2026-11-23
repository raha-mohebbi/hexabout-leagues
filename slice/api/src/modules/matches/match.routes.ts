
import { Router } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { createReportMatchController } from "./match.controller.js";

export function createMatchRouter(db: Pool = pool) {
  const router = Router();

  router.post("/results", createReportMatchController(db));

  return router;
}

export default createMatchRouter();
