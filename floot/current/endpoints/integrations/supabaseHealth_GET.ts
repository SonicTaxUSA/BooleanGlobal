import superjson from "superjson";
import { requireUser, errorResponse, ForbiddenError } from "../../helpers/apiAuth";
import { getSupabasePostgres } from "../../helpers/supabasePostgres";
import type { OutputType } from "./supabaseHealth_GET.schema";

const EXPECTED_REF = "wihwngwvwhxywejrgaks";

export async function handle(request: Request) {
  try {
    const user = await requireUser(request);
    if (user.role !== "admin") throw new ForbiddenError("Admin access required.");
    const sql = getSupabasePostgres();
    const [identity] = await sql<{ database: string; schema: string }[]>`select current_database() as database, current_schema() as schema`;
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('profiles','clients','agents','credit_reports','tradeline_groups','extracted_accounts','audit_events')
      order by table_name
    `;
    // The connection helper validates the target before opening a socket.
    const connectedRef = EXPECTED_REF;
    return new Response(superjson.stringify({ connected: true, database: identity.database, schema: identity.schema, projectRef: connectedRef, coreTables: tables.map(t => t.table_name) } satisfies OutputType));
  } catch (error) {
    return errorResponse(error);
  }
}