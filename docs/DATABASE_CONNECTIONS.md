# Lycon database connections

This setup keeps the existing MySQL application database separate from two dedicated PostgreSQL projects:

- **Supabase** (`Lycon`, project `pstjyoyyrxjtvytehzjf`, South America/São Paulo): intended application-data and Supabase-services foundation. Project URL: `https://pstjyoyyrxjtvytehzjf.supabase.co`; PostgreSQL host: `db.pstjyoyyrxjtvytehzjf.supabase.co`.
- **Neon** (`Lycon`, project `still-firefly-04393155`, organization `Uviwe`, AWS Frankfurt): initially for development, testing, and migration validation only. Default branch: `main` (`br-dry-meadow-ba6p9zme`).

Neither PostgreSQL connection is used by existing application queries. The existing `DATABASE_URL`, MySQL Drizzle schema, and MySQL migration configuration remain unchanged. No PostgreSQL migration configuration is enabled by this setup.

## Local configuration

Copy the safe placeholders from `.env.example` into the repository-root `.env`, then replace the relevant placeholders locally. The server entry point and connection-check script load `.env` with `dotenv/config`; they do **not** automatically load `.env.local`. Environment-specific `.env.*` files are ignored by Git, except `.env.example`.

| Variable                             | Purpose                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LYCON_SUPABASE_URL`                 | Supabase project URL; the provided project URL is safe to share.                                                                                      |
| `LYCON_SUPABASE_PUBLISHABLE_KEY`     | Current Supabase publishable key, for a future server/client API integration if needed. No Supabase API client is initialized here.                   |
| `LYCON_SUPABASE_SECRET_KEY`          | Optional elevated server-only Supabase key. It is not used by this connection layer and should remain unset until a justified server-side use exists. |
| `LYCON_SUPABASE_DATABASE_URL`        | Supabase PostgreSQL session-pooler URL for runtime connection checks.                                                                                 |
| `LYCON_SUPABASE_DATABASE_URL_DIRECT` | Optional Supabase direct PostgreSQL URL, reserved for future administrative or migration tooling.                                                     |
| `LYCON_NEON_DATABASE_URL`            | Neon pooled PostgreSQL URL for development/runtime queries.                                                                                           |
| `LYCON_NEON_DATABASE_URL_UNPOOLED`   | Neon unpooled URL, reserved for future migration tooling.                                                                                             |

Keep the current MySQL `DATABASE_URL` separate; do not replace it with either PostgreSQL URL. The example contains no live credentials. Never commit or log any actual database URL, password, publishable key, or secret key. Keep all database URLs and the Supabase secret key on the server; never put them in frontend-prefixed variables or public routes.

### Obtain values from the provider consoles

- **Supabase:** open the Lycon project dashboard. Copy the current publishable key (if needed) and optional secret key from the project's API keys settings. Use the project's **Connect** dialog for PostgreSQL URLs: choose a session-pooler URL for normal runtime connections and copy a direct URL separately only if available and required for later tooling. Do not construct the pooler hostname or URL yourself.
- **Neon:** open project `still-firefly-04393155`, select the `main` branch, and use **Connect** with the displayed database and role. Copy the pooled URL for `LYCON_NEON_DATABASE_URL`; obtain the unpooled URL separately for `LYCON_NEON_DATABASE_URL_UNPOOLED`. Do not guess a database, role, host, or password.

The pooled runtime values and unpooled/direct tooling values are intentionally separate. The connection module only consumes `LYCON_SUPABASE_DATABASE_URL` and `LYCON_NEON_DATABASE_URL`; it does not run migrations or use the direct URLs.

## Connection check

After configuring one or both pooled URLs in the repository-root `.env`, run:

```sh
pnpm db:connections:check
```

The script checks Supabase and Neon independently. For each provider it prints whether a URL is configured, whether a connection was established, whether a read-only query succeeded, elapsed milliseconds, and (on success) the connected database, role, and selected role/database privilege flags. The query reads `SELECT 1` and PostgreSQL role metadata only; it creates or changes no database objects or data. A successful result for one provider is not evidence that the other is reachable. The command exits nonzero if either pooled URL is missing or its check fails.

Failure categories are sanitized and do not contain connection details: `authentication_failure`, `dns_error`, `network_error`, `tls_error`, `connection_timeout`, or `other_connection_error`. A missing URL is reported separately as `credentialsConfigured: false`. The check never prints a URL, password, key, or raw driver error.

The reported role flags include role attributes, effective role memberships, selected database privileges, and privileges on the `public` schema. They are not a complete inventory of object grants. Review the actual role and grants in each provider before authorizing application access.

## Authorization and deferred work

The Supabase publishable key identifies the application component; it does not authenticate an individual user or provide user-data isolation. A Supabase secret key is elevated and bypasses RLS, so it must remain server-only and is not used by this setup. A direct PostgreSQL connection authenticates the database role in its URL; it does not by itself apply the requesting user's Supabase JWT or guarantee user-level RLS. No application tables exist yet, and user-level authorization/RLS is **not implemented**. Design and verify those controls before routing user requests through database roles.

Neon is a separate development/testing/migration-validation environment, not a second production source of truth. Do not copy live user data there.

Application schema design, PostgreSQL migration paths, migrations, tables, indexes, roles, grants, RLS policies, and seed data are intentionally deferred. Future migration tooling must target Supabase and Neon independently so a migration for one cannot run against the other.
