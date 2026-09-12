"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { sha256Hex } from "@/lib/hash";
import { formatDate } from "@/lib/dateFormat";

export type SignatureActionState = { error: string | null };

function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? "");
}

// Staff-triggered: freezes the current template body (with placeholders
// substituted) as the exact text the client will see and sign — the hash
// covers that frozen string, not the mutable template row, so a later
// template edit can never retroactively change what was agreed to.
export async function createAgreementRequest(
  clientId: string,
): Promise<{ id: string | null; error: string | null }> {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "staff") {
    return { id: null, error: "Not permitted." };
  }

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("first_name, last_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return { id: null, error: "Client not found." };
  }

  const { data: template } = await supabase
    .from("document_templates")
    .select("id, body")
    .eq("slug", "credit-repair-builder-agreement")
    .maybeSingle();
  if (!template) {
    return { id: null, error: "Agreement template not found." };
  }

  const renderedBody = renderTemplate(template.body, {
    client_name: `${client.first_name} ${client.last_name}`.trim(),
    today_date: formatDate(new Date()),
    firm_name: "Boolean Global",
  });
  const documentHash = sha256Hex(renderedBody);

  const { data: inserted, error } = await supabase
    .from("signature_requests")
    .insert({
      client_id: clientId,
      template_id: template.id,
      requested_by: user.id,
      title: "Credit Repair & Builder Service Agreement",
      rendered_body: renderedBody,
      document_hash: documentHash,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { id: null, error: "Could not create the agreement. You may not have permission." };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { id: inserted.id, error: null };
}

export async function submitSignature(
  requestId: string,
  _prevState: SignatureActionState,
  formData: FormData,
): Promise<SignatureActionState> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (formData.get("consent") !== "on") {
    return { error: "You must confirm consent before signing." };
  }

  const signatureType = formData.get("signature_type");
  if (signatureType !== "typed") {
    return { error: "Type your full name to sign." };
  }
  const signatureText = String(formData.get("signature_text") ?? "").trim();
  if (!signatureText) {
    return { error: "Type your full name to sign." };
  }

  const { data: request } = await supabase
    .from("signature_requests")
    .select("document_hash, rendered_body")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) {
    return { error: "Agreement not found or not permitted." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  const { error } = await supabase.from("signatures").insert({
    signature_request_id: requestId,
    signer_user_id: user.id,
    consent_given: true,
    consent_text:
      "I have read the agreement above and the Consumer Credit File Rights disclosure, and I agree to the terms shown, including my right to cancel without penalty until midnight of the third business day after signing.",
    signature_type: "typed",
    signature_text: signatureText,
    ip_address: ip,
    user_agent: userAgent,
    document_hash_at_signing: request.document_hash,
  });

  if (error) {
    return { error: "This agreement is no longer available for signing." };
  }

  revalidatePath("/portal");
  revalidatePath("/portal/signatures");
  redirect("/portal/signatures");
}

export async function voidAgreementRequest(
  requestId: string,
  clientId: string,
): Promise<SignatureActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("signature_requests")
    .update({ status: "voided" })
    .eq("id", requestId);

  if (error) {
    return { error: "Could not void this agreement." };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null };
}
