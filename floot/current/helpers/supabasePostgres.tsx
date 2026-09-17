import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

// Server-only parallel connection. Floot remains authoritative.
export function getSupabasePostgres() {
  const env = process.env as unknown as Record<string, string | undefined>;
  const connectionString = env.BOOLEAN_SUPABASE_POOLER_URL || env.POSTGRESQL_DATABASE_CONNECTION_STRING;
  if (!connectionString) throw new Error("Boolean Supabase Postgres is not connected.");
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error("Invalid Boolean Supabase connection configuration."); }
  const ref = "wihwngwvwhxywejrgaks";
  const correctProject = url.hostname === `db.${ref}.supabase.co`
    || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${ref}`);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !correctProject) {
    throw new Error("Connected database does not match the Boolean Global project.");
  }
  if (!client) {
    client = postgres(connectionString, {
      ssl: "require",
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return client;
}
