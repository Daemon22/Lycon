import { Pool } from "pg";

export type DatabaseErrorCategory =
  | "invalid_connection_string"
  | "authentication_failure"
  | "connection_timeout"
  | "tls_error"
  | "dns_error"
  | "network_error"
  | "other_connection_error";

type Provider = "Supabase" | "Neon";

let supabasePool: Pool | undefined;
let neonPool: Pool | undefined;

export function classifyDatabaseError(error: unknown): DatabaseErrorCategory {
  const details =
    typeof error === "object" && error !== null ? error : undefined;
  const code =
    details && "code" in details && typeof details.code === "string"
      ? details.code
      : "";
  const message =
    details && "message" in details && typeof details.message === "string"
      ? details.message.toLowerCase()
      : "";

  if (/must contain a valid postgresql connection url/.test(message)) {
    return "invalid_connection_string";
  }
  if (
    code.startsWith("28") ||
    /authentication failed|password authentication|no password supplied|role .* does not exist/.test(
      message
    )
  ) {
    return "authentication_failure";
  }
  if (code === "ETIMEDOUT" || /timed out|timeout/.test(message)) {
    return "connection_timeout";
  }
  if (
    code.startsWith("ERR_TLS") ||
    /CERT_|SELF_SIGNED_CERT|UNABLE_TO_VERIFY/.test(code) ||
    /certificate|tls|ssl/.test(message)
  ) {
    return "tls_error";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "dns_error";
  }
  if (
    /^(ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|ECONNABORTED)$/.test(
      code
    )
  ) {
    return "network_error";
  }
  return "other_connection_error";
}

function createPool(provider: Provider, envName: string): Pool {
  const connectionString = process.env[envName]?.trim();
  if (!connectionString) {
    throw new Error(
      `${envName} is required to connect to the Lycon ${provider} database`
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error(
      `${envName} must contain a valid PostgreSQL connection URL`
    );
  }

  if (
    (parsedUrl.protocol !== "postgres:" &&
      parsedUrl.protocol !== "postgresql:") ||
    !parsedUrl.hostname ||
    parsedUrl.pathname.length < 2
  ) {
    throw new Error(
      `${envName} must contain a valid PostgreSQL connection URL`
    );
  }

  // Ensure URL sslmode parameters cannot weaken the explicitly verified TLS connection.
  for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    parsedUrl.searchParams.delete(parameter);
  }

  const pool = new Pool({
    connectionString: parsedUrl.toString(),
    ssl: { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
    application_name: `lycon-${provider.toLowerCase()}`,
  });

  pool.on("error", error => {
    console.error(
      `[Database] ${provider} idle connection error: ${classifyDatabaseError(error)}`
    );
  });

  return pool;
}

export function getSupabaseDatabasePool(): Pool {
  supabasePool ??= createPool("Supabase", "LYCON_SUPABASE_DATABASE_URL");
  return supabasePool;
}

export function getNeonDatabasePool(): Pool {
  neonPool ??= createPool("Neon", "LYCON_NEON_DATABASE_URL");
  return neonPool;
}

export async function closeDatabasePools(): Promise<void> {
  const pools = [supabasePool, neonPool].filter(
    (pool): pool is Pool => pool !== undefined
  );
  supabasePool = undefined;
  neonPool = undefined;
  await Promise.all(pools.map(pool => pool.end()));
}
