import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request and enforces
// the route-group access rules: /portal is client-only, /dashboard is
// admin/staff-only, both require login. Marketing pages and /login/
// /signup stay public.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPortal = path.startsWith("/portal");
  const isDashboard = path.startsWith("/dashboard");

  if ((isPortal || isDashboard) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && (isPortal || isDashboard)) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();

    if (isPortal && profile?.role !== "client") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (isDashboard && profile?.role === "client") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return response;
}
