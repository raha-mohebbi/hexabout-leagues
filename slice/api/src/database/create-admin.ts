import "dotenv/config";

import pool from "../config/database.js";
import { hashAdminPassword } from "../modules/admin-auth/admin-auth.service.js";
import { z } from "zod";

const roleSchema = z.enum(["superadmin", "admin", "manager"]);

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const roleResult = roleSchema.safeParse(
    process.env.ADMIN_ROLE ?? "superadmin"
  );

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  if (!roleResult.success) {
    throw new Error("ADMIN_ROLE must be superadmin, admin, or manager");
  }

  const passwordHash = await hashAdminPassword(password);
  const result = await pool.query(
    `
    INSERT INTO admin_users (email, password_hash, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
    `,
    [email, passwordHash, roleResult.data]
  );

  if (result.rowCount !== 1) {
    throw new Error("An administrator with this email already exists");
  }

  console.log(`Created administrator ${email} (${roleResult.data}).`);
}

createAdmin()
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Administrator creation failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
