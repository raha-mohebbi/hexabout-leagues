import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

async function runMigrations() {
  const testMode = process.argv.includes("--test");
  const connectionString = testMode
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      testMode
        ? "TEST_DATABASE_URL is required for test migrations"
        : "DATABASE_URL is required for migrations"
    );
  }

  const db = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await db.connect();

    try {
      if (testMode) {
        const database = await client.query(
          "SELECT current_database() AS name"
        );

        if (database.rows[0].name !== "hexabout_leagues_test") {
          throw new Error("Refusing to migrate a non-test database");
        }
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query("SELECT pg_advisory_lock(6473921, 1)");

      try {
        const directory = resolve(process.cwd(), "database", "migrations");
        const files = (await readdir(directory))
          .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
          .sort();

        for (const file of files) {
          const applied = await client.query(
            "SELECT 1 FROM schema_migrations WHERE version = $1",
            [file]
          );

          if (applied.rowCount !== 0) {
            continue;
          }

          const sql = await readFile(resolve(directory, file), "utf8");
          await client.query("BEGIN");

          try {
            await client.query(sql);
            await client.query(
              "INSERT INTO schema_migrations (version) VALUES ($1)",
              [file]
            );
            await client.query("COMMIT");
            console.log(`Applied migration ${file}`);
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }
      } finally {
        await client.query("SELECT pg_advisory_unlock(6473921, 1)");
      }
    } finally {
      client.release();
    }
  } finally {
    await db.end();
  }
}

runMigrations().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown migration error";
  console.error(`Database migration failed: ${message}`);
  process.exitCode = 1;
});
