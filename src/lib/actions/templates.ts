"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

export type TemplateFormState = { error: string | null; success?: boolean };

export async function updateTemplate(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return { error: "Only admins can edit templates." };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    return { error: "Template body cannot be empty." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_templates")
    .update({ body, updated_by: user.id })
    .eq("id", templateId);

  if (error) {
    return { error: "Could not save the template." };
  }

  revalidatePath("/dashboard/templates");
  return { error: null, success: true };
}
