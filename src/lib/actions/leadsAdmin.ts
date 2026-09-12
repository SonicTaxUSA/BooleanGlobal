"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

export async function updateLeadStatus(leadId: string, status: "new" | "contacted" | "archived") {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "staff") return;

  const supabase = await createClient();
  await supabase.from("leads").update({ status }).eq("id", leadId);
  revalidatePath("/dashboard/leads");
}

// Splits the lead's free-text name into first/last for the clients row --
// good enough for a starting record; staff can correct it on the client
// detail page afterward.
export async function convertLead(leadId: string): Promise<void> {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "staff") return;

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return;

  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      first_name: firstName || lead.name,
      last_name: rest.join(" "),
      email: lead.email,
      phone: lead.phone,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !client) return;

  await supabase
    .from("leads")
    .update({ status: "converted", converted_client_id: client.id })
    .eq("id", leadId);

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${client.id}`);
}
