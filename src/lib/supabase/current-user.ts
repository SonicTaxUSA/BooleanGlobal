import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  role: "admin" | "staff" | "client";
  full_name: string | null;
};

// React cache() de-dupes this across a single request -- layout + page can
// both call it without a duplicate round trip.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  return {
    id: user.id,
    email: profile.email ?? user.email ?? "",
    role: profile.role,
    full_name: profile.full_name,
  };
});
