
import "dotenv/config";
import app from "./app.js";
import pool from "./config/database.js";

const PORT = Number(process.env.PORT ?? 4000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid port number between 1 and 65535");
}

const server = app.listen(PORT);

let isShuttingDown = false;

server.on("listening", () => {
  console.log(`API server is running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Failed to start API server:", error);
  process.exitCode = 1;
});

async function shutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  const forceShutdown = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10_000);

  forceShutdown.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await pool.end();

    console.log("HTTP server and database pool closed successfully.");
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exitCode = 1;
  } finally {
    clearTimeout(forceShutdown);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
