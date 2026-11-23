import "dotenv/config";
import { Pool } from "pg";

const testPool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

testPool.on("error", (error) => {
  console.error("Unexpected test database pool error:", error);
});

export default testPool;