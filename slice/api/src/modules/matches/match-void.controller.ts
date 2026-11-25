import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import {
  MatchVoidError,
  voidMatch,
} from "./match-void.service.js";
import {
  voidMatchBodySchema,
  voidMatchParamsSchema,
} from "./match-void.schema.js";

export function createVoidMatchController(db: Pool = pool) {
  return async function voidMatchController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const params = voidMatchParamsSchema.safeParse(req.params);
    const body = voidMatchBodySchema.safeParse(req.body);

    if (!params.success || !body.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Invalid request data",
          details: {
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
      });
    }

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication required",
        },
      });
    }

    try {
      const result = await voidMatch(
        {
          ...params.data,
          ...body.data,
          adminId: req.admin.id,
        },
        db
      );

      return res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (error) {
      if (error instanceof MatchVoidError) {
        return res.status(error.statusCode).json({
          success: false,
          data: null,
          error: {
            message: error.message,
          },
        });
      }

      return next(error);
    }
  };
}
