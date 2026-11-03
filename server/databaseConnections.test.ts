import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyDatabaseError,
  getNeonDatabasePool,
  getSupabaseDatabasePool,
} from "./databaseConnections";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("database connection configuration", () => {
  it("does not require credentials or connect during module import", () => {
    vi.stubEnv("LYCON_SUPABASE_DATABASE_URL", "");
    vi.stubEnv("LYCON_NEON_DATABASE_URL", "");

    expect(() => getSupabaseDatabasePool()).toThrow(
      "LYCON_SUPABASE_DATABASE_URL is required"
    );
    expect(() => getNeonDatabasePool()).toThrow(
      "LYCON_NEON_DATABASE_URL is required"
    );
  });

  it.each([
    [
      {
        message:
          "LYCON_SUPABASE_DATABASE_URL must contain a valid PostgreSQL connection URL",
      },
      "invalid_connection_string",
    ],
    [{ code: "28P01" }, "authentication_failure"],
    [{ code: "ETIMEDOUT" }, "connection_timeout"],
    [{ message: "certificate verify failed" }, "tls_error"],
    [{ code: "ENOTFOUND" }, "dns_error"],
    [{ code: "ECONNREFUSED" }, "network_error"],
  ] as const)(
    "classifies connection errors without exposing their details",
    (error, category) => {
      expect(classifyDatabaseError(error)).toBe(category);
    }
  );
});
