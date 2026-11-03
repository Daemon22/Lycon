import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

async function resetDatabase() {
  const connectionString = process.env.LYCON_NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error("LYCON_NEON_DATABASE_URL not set");
  }

  const pool = new Pool({ connectionString });

  try {
    console.log("Connecting to database...");
    await pool.query("SELECT NOW()");
    console.log("Connected!");

    console.log("Dropping existing tables...");
    const tables = [
      "rate_limit_logs",
      "two_factor_secrets",
      "password_reset_tokens",
      "email_verification_tokens",
      "browser_sync_snapshots",
      "users",
    ];

    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`Dropped table: ${table}`);
      } catch (error) {
        console.error(`Failed to drop ${table}:`, error);
      }
    }

    console.log("Dropping enum types...");
    try {
      await pool.query(`DROP TYPE IF EXISTS role CASCADE`);
      console.log("Dropped enum: role");
    } catch (error) {
      console.error("Failed to drop role enum:", error);
    }

    console.log("Database reset complete!");
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

resetDatabase().catch(console.error);
