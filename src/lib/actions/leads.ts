"use server";

import { getServiceRoleClient } from "@/lib/supabase/serviceRole";

export type LeadFormState = { error: string | null; success: boolean };

// Public, unauthenticated path (the marketing contact form) — no session to
// scope an RLS-aware client to, so this goes through the service role.
// Deliberately collects only name/email/phone/message: no SSN or other
// sensitive data belongs on a public-facing form.
export async function submitLead(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email) {
    return { error: "Name and email are required.", success: false };
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("leads").insert({
    name,
    email,
    phone: phone || null,
    message: message || null,
  });

  if (error) {
    return { error: "Something went wrong submitting your request. Please try again.", success: false };
  }

  return { error: null, success: true };
}
