import "dotenv/config";
import { performance } from "node:perf_hooks";
import type { Pool, PoolClient } from "pg";
import {
  classifyDatabaseError,
  closeDatabasePools,
  getNeonDatabasePool,
  getSupabaseDatabasePool,
} from "../server/databaseConnections";

type ProviderCheck = {
  provider: "Supabase" | "Neon";
  envName: string;
  getPool: () => Pool;
};

type CheckResult = {
  provider: ProviderCheck["provider"];
  credentialsConfigured: boolean;
  connectionEstablished: boolean;
  safeQuerySucceeded: boolean;
  durationMs: number | null;
  databaseName?: string;
  databaseRole?: string;
  rolePrivileges?: {
    canLogin: boolean;
    inheritsPrivileges: boolean;
    isSuperuser: boolean;
    canCreateRoles: boolean;
    canCreateDatabases: boolean;
    bypassesRls: boolean;
    canConnectToDatabase: boolean;
    canCreateInDatabase: boolean;
    canCreateTemporaryTables: boolean;
    canUsePublicSchema: boolean;
    canCreateInPublicSchema: boolean;
    effectiveRoleMemberships: string[];
  };
  errorCategory?: string;
};

const providers: ProviderCheck[] = [
  {
    provider: "Supabase",
    envName: "LYCON_SUPABASE_DATABASE_URL",
    getPool: getSupabaseDatabasePool,
  },
  {
    provider: "Neon",
    envName: "LYCON_NEON_DATABASE_URL",
    getPool: getNeonDatabasePool,
  },
];

async function checkProvider(provider: ProviderCheck): Promise<CheckResult> {
  const credentialsConfigured = Boolean(process.env[provider.envName]?.trim());
  const result: CheckResult = {
    provider: provider.provider,
    credentialsConfigured,
    connectionEstablished: false,
    safeQuerySucceeded: false,
    durationMs: null,
  };

  if (!credentialsConfigured) {
    return result;
  }

  const startedAt = performance.now();
  let client: PoolClient | undefined;

  try {
    client = await provider.getPool().connect();
    result.connectionEstablished = true;

    const query = await client.query<{
      connection_ok: number;
      database_name: string;
      database_role: string;
      can_login: boolean;
      inherits_privileges: boolean;
      is_superuser: boolean;
      can_create_roles: boolean;
      can_create_databases: boolean;
      bypasses_rls: boolean;
      can_connect_to_database: boolean;
      can_create_in_database: boolean;
      can_create_temporary_tables: boolean;
      can_use_public_schema: boolean;
      can_create_in_public_schema: boolean;
      effective_role_memberships: string[];
    }>(`
      SELECT
        1 AS connection_ok,
        current_database() AS database_name,
        current_user AS database_role,
        role.rolcanlogin AS can_login,
        role.rolinherit AS inherits_privileges,
        role.rolsuper AS is_superuser,
        role.rolcreaterole AS can_create_roles,
        role.rolcreatedb AS can_create_databases,
        role.rolbypassrls AS bypasses_rls,
        has_database_privilege(current_user, current_database(), 'CONNECT') AS can_connect_to_database,
        has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database,
        has_database_privilege(current_user, current_database(), 'TEMP') AS can_create_temporary_tables,
        has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public_schema,
        has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public_schema,
        ARRAY(
          SELECT granted_role.rolname::text
          FROM pg_roles AS granted_role
          WHERE granted_role.oid <> role.oid
            AND pg_has_role(current_user, granted_role.oid, 'USAGE')
          ORDER BY granted_role.rolname
        ) AS effective_role_memberships
      FROM pg_roles AS role
      WHERE role.rolname = current_user
    `);

    const row = query.rows[0];
    result.safeQuerySucceeded = row?.connection_ok === 1;
    if (row) {
      result.databaseName = row.database_name;
      result.databaseRole = row.database_role;
      result.rolePrivileges = {
        canLogin: row.can_login,
        inheritsPrivileges: row.inherits_privileges,
        isSuperuser: row.is_superuser,
        canCreateRoles: row.can_create_roles,
        canCreateDatabases: row.can_create_databases,
        bypassesRls: row.bypasses_rls,
        canConnectToDatabase: row.can_connect_to_database,
        canCreateInDatabase: row.can_create_in_database,
        canCreateTemporaryTables: row.can_create_temporary_tables,
        canUsePublicSchema: row.can_use_public_schema,
        canCreateInPublicSchema: row.can_create_in_public_schema,
        effectiveRoleMemberships: row.effective_role_memberships,
      };
    }
  } catch (error) {
    result.errorCategory = classifyDatabaseError(error);
  } finally {
    client?.release();
    result.durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  }

  return result;
}

async function main(): Promise<void> {
  let allSucceeded = true;
  try {
    for (const provider of providers) {
      const result = await checkProvider(provider);
      console.log(JSON.stringify(result));
      if (!result.connectionEstablished || !result.safeQuerySucceeded) {
        allSucceeded = false;
      }
    }
  } finally {
    await closeDatabasePools();
  }

  if (!allSucceeded) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    `Database connection check failed: ${classifyDatabaseError(error)}`
  );
  process.exitCode = 1;
});
