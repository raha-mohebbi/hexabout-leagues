import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { adminLoginSchema } from "./admin-auth.schema.js";
import {
  AdminAuthError,
  createAdminSession,
  revokeAdminSession,
} from "./admin-auth.service.js";

function bearerToken(req: Request): string | undefined {
  return req.header("authorization")?.match(
    /^Bearer ([A-Za-z0-9_-]{40,})$/
  )?.[1];
}

export function createAdminLoginController(db: Pool = pool) {
  return async function adminLoginController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const validation = adminLoginSchema.safeParse(req.body);

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

    try {
      const result = await createAdminSession(
        validation.data.email,
        validation.data.password,
        db
      );

      return res.status(200).json({
        success: true,
        data: {
          accessToken: result.token,
          tokenType: "Bearer",
          expiresAt: result.expiresAt,
          admin: result.admin,
        },
        error: null,
      });
    } catch (error) {
      if (error instanceof AdminAuthError) {
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

export function createAdminLogoutController(db: Pool = pool) {
  return async function adminLogoutController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const token = bearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication required",
        },
      });
    }

    try {
      await revokeAdminSession(token, db);
      return res.status(200).json({
        success: true,
        data: null,
        error: null,
      });
    } catch (error) {
      return next(error);
    }
  };
}

export function createAdminSessionController() {
  return function adminSessionController(
    req: Request,
    res: Response
  ) {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Authentication required",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: req.admin,
      error: null,
    });
  };
}
