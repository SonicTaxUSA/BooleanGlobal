// functions/index.ts — Victora API entrypoint.
// All /api/* traffic is dispatched to the singleton VictoraDB Durable Object
// ("victora-main"), which owns the SQLite database and enforces auth/RBAC.
import { VictoraDB } from "./victora-db";

export { VictoraDB };

type Env = { DO: Fetcher };

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/ping") {
      return Response.json({ ok: true, service: "victora-api", now: new Date().toISOString() });
    }

    if (!url.pathname.startsWith("/api")) {
      return Response.json({ ok: true, service: "victora-api", hint: "API routes live under /api" });
    }

    // 2-arg form preserves the body and headers for the DO dispatch.
    const wrapped = new Request(request.url, request);
    wrapped.headers.set("X-Rork-DO-Class", "VictoraDB");
    wrapped.headers.set("X-Rork-DO-Id", "victora-main");
    const res = await env.DO.fetch(wrapped);

    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
    return new Response(res.body, { status: res.status, headers });
  },
} satisfies ExportedHandler<Env>;
