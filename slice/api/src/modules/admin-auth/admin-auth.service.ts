import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { Pool } from "pg";

import pool from "../../config/database.js";
import type { AdminIdentity } from "./admin-auth.types.js";

const KEY_LENGTH = 64;
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const DUMMY_PASSWORD_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(KEY_LENGTH * 2)}`;

function deriveKey(password: string, salt: Buffer, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { maxmem: SCRYPT_MAX_MEMORY },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(key);
      }
    );
  });
}

export interface AdminSession {
  token: string;
  expiresAt: string;
  admin: AdminIdentity;
}

interface AdminPasswordRow extends AdminIdentity {
  password_hash: string;
  is_active: boolean;
}

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function hashAdminPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) {
    throw new Error("Administrator passwords must be 12-1024 characters");
  }

  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyAdminPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = storedHash.split("$");

  if (
    algorithm !== "scrypt" ||
    !saltHex ||
    !keyHex ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{128}$/i.test(keyHex)
  ) {
    return false;
  }

  const expectedKey = Buffer.from(keyHex, "hex");
  if (expectedKey.length !== KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveKey(
    password,
    Buffer.from(saltHex, "hex"),
    expectedKey.length
  );

  return timingSafeEqual(actualKey, expectedKey);
}

export function hashAdminSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(
  email: string,
  password: string,
  db: Pool = pool
): Promise<AdminSession> {
  const result = await db.query<AdminPasswordRow>(
    `
    SELECT id, email, role, password_hash, is_active
    FROM admin_users
    WHERE lower(email) = lower($1)
    `,
    [email]
  );
  const admin = result.rows[0];
  const passwordMatches = await verifyAdminPassword(
    password,
    admin?.password_hash ?? DUMMY_PASSWORD_HASH
  );

  if (
    !admin ||
    !admin.is_active ||
    !passwordMatches
  ) {
    throw new AdminAuthError("Invalid email or password", 401);
  }

  await db.query(`
    DELETE FROM admin_sessions
    WHERE expires_at <= NOW()
       OR revoked_at < NOW() - INTERVAL '30 days'
  `);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();

  await db.query(
    `
    INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [admin.id, hashAdminSessionToken(token), expiresAt]
  );

  return {
    token,
    expiresAt,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
  };
}

export async function revokeAdminSession(
  token: string,
  db: Pool = pool
): Promise<void> {
  await db.query(
    `
    UPDATE admin_sessions
    SET revoked_at = NOW()
    WHERE token_hash = $1
      AND revoked_at IS NULL
    `,
    [hashAdminSessionToken(token)]
  );
}
