"use client";

import { useActionState } from "react";
import { updateTemplate, type TemplateFormState } from "@/lib/actions/templates";
import { Button } from "@/components/Button";
import type { Tables } from "@/lib/supabase/database.types";

const initialState: TemplateFormState = { error: null };

export function TemplateForm({ template }: { template: Tables<"document_templates"> }) {
  const action = updateTemplate.bind(null, template.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="body"
        defaultValue={template.body}
        rows={20}
        className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-raised) p-4 font-mono text-sm text-(--color-ink) outline-none focus:border-(--color-gold)"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save template"}
        </Button>
        {state.success && <span className="text-sm text-(--color-gold-bright)">Saved.</span>}
        {state.error && <span className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}
