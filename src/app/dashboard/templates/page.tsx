import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { TemplateForm } from "@/components/TemplateForm";
import { EmptyState } from "@/components/EmptyState";
import { FileSignature } from "lucide-react";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: templates } = await supabase.from("document_templates").select("*").order("name");

  return (
    <div className="max-w-3xl">
      <h1 className="mt-0">Templates</h1>
      <p className="mt-0 text-(--color-muted)">
        Supported placeholders: <code>{"{{client_name}}"}</code>, <code>{"{{today_date}}"}</code>,{" "}
        <code>{"{{firm_name}}"}</code>. Every agreement is compliance-sensitive — have a Florida attorney
        review this text before it goes to a real client.
      </p>

      {(templates ?? []).length === 0 ? (
        <EmptyState icon={FileSignature}>No templates found.</EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {(templates ?? []).map((t) => (
            <div key={t.id}>
              <h2 className="text-base font-semibold">{t.name}</h2>
              <TemplateForm template={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
