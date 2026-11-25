import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import { hashAdminSessionToken } from "./admin-auth.service.js";
import type { AdminRole } from "./admin-auth.types.js";

interface AdminSessionRow {
  id: string;
  email: string;
  role: AdminRole;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 10;
let lastLoginCleanup = 0;

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    data: null,
    error: {
      message: "Authentication required",
    },
  });
}

export function createAdminLoginRateLimiter() {
  return function limitAdminLogin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const now = Date.now();

    if (now - lastLoginCleanup >= 60_000) {
      for (const [key, value] of loginAttempts) {
        if (value.resetAt <= now) {
          loginAttempts.delete(key);
        }
      }
      lastLoginCleanup = now;
    }

    const key = req.ip || req.socket.remoteAddress || "unknown";
    let attempts = loginAttempts.get(key);

    if (!attempts || attempts.resetAt <= now) {
      if (loginAttempts.size >= 10_000 && !attempts) {
        return res.status(429).json({
          success: false,
          data: null,
          error: {
            message: "Too many login attempts",
          },
        });
      }

      attempts = {
        count: 0,
        resetAt: now + LOGIN_WINDOW_MS,
      };
      loginAttempts.set(key, attempts);
    }

    if (attempts.count >= LOGIN_ATTEMPT_LIMIT) {
      res.setHeader(
        "Retry-After",
        Math.ceil((attempts.resetAt - now) / 1000)
      );
      return res.status(429).json({
        success: false,
        data: null,
        error: {
          message: "Too many login attempts",
        },
      });
    }

    attempts.count += 1;
    return next();
  };
}

export function createAdminAuthentication(db: Pool = pool) {
  return async function authenticateAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const authorization = req.header("authorization");
    const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);

    if (!match) {
      return unauthorized(res);
    }
    const token = match[1];

    if (!token) {
      return unauthorized(res);
    }

    try {
      const result = await db.query<AdminSessionRow>(
        `
        SELECT u.id, u.email, u.role
        FROM admin_sessions s
        JOIN admin_users u ON u.id = s.admin_id
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
          AND s.revoked_at IS NULL
          AND u.is_active = TRUE
        `,
        [hashAdminSessionToken(token)]
      );
      const admin = result.rows[0];

      if (!admin) {
        return unauthorized(res);
      }

      req.admin = admin;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireAdminRole(...allowedRoles: AdminRole[]) {
  return function authorizeAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (!req.admin) {
      return unauthorized(res);
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: "Forbidden",
        },
      });
    }

    return next();
  };
}
