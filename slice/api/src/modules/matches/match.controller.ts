
import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { reportMatch, MatchServiceError } from "./match.service.js";
import { reportMatchSchema } from "./match.schema.js";

export function createReportMatchController(db: Pool = pool) {
  return async function reportMatchController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Validate request body.
      const validation = reportMatchSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        });
      }

      // Execute business logic using the injected database.
      const result = await reportMatch(validation.data, db);

      return res.status(result.duplicate ? 200 : 201).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (error) {
      if (error instanceof MatchServiceError) {
        return res.status(error.statusCode).json({
          success: false,
          data: null,
          error: {
            message: error.message,
          },
        });
      }

      next(error);
    }
  };
}
