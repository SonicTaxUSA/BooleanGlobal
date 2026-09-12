"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IntakeFormState = { error: string | null };

function optionalText(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function toCents(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export async function saveIntake(
  clientId: string,
  _prevState: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  const supabase = await createClient();

  const fields = {
    date_of_birth: optionalText(formData.get("date_of_birth")),
    employment_status: optionalText(formData.get("employment_status")),
    monthly_income_cents: toCents(formData.get("monthly_income")),
    estimated_debt_cents: toCents(formData.get("estimated_debt")),
    primary_goal: optionalText(formData.get("primary_goal")),
    known_negative_items: optionalText(formData.get("known_negative_items")),
    authorized_credit_pull: formData.get("authorized_credit_pull") === "on",
    ssn: optionalText(formData.get("ssn")),
  };

  const status = formData.get("intent") === "submit" ? ("submitted" as const) : ("draft" as const);

  if (status === "submitted" && !fields.authorized_credit_pull) {
    return { error: "You must authorize us to pull your credit report before submitting." };
  }

  const { error } = await supabase
    .from("credit_intakes")
    .upsert({ client_id: clientId, ...fields, status }, { onConflict: "client_id" });

  if (error) {
    return { error: "Could not save your intake. Please try again." };
  }

  revalidatePath("/portal");
  revalidatePath("/portal/intake");
  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null };
}
