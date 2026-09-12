"use client";

import { useTransition } from "react";
import { updateLeadStatus, convertLead } from "@/lib/actions/leadsAdmin";
import { Button } from "@/components/Button";
import type { Tables } from "@/lib/supabase/database.types";

const STATUS_OPTIONS = ["new", "contacted", "archived"] as const;

export function LeadRow({ lead }: { lead: Tables<"leads"> }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-(--color-border)">
      <td className="py-3 pr-4">{lead.name}</td>
      <td className="py-3 pr-4 text-(--color-muted)">{lead.email}</td>
      <td className="py-3 pr-4 text-(--color-muted)">{lead.phone ?? "—"}</td>
      <td className="py-3 pr-4 max-w-xs truncate text-(--color-muted)">{lead.message ?? "—"}</td>
      <td className="py-3 pr-4">
        {lead.status === "converted" ? (
          <span className="text-(--color-gold-bright)">Converted</span>
        ) : (
          <select
            defaultValue={lead.status}
            disabled={pending}
            onChange={(e) =>
              startTransition(() =>
                updateLeadStatus(lead.id, e.target.value as "new" | "contacted" | "archived"),
              )
            }
            className="rounded-md border border-(--color-border) bg-(--color-surface-raised) px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-3">
        {lead.status !== "converted" && (
          <Button
            type="button"
            variant="outline"
            className="!px-3 !py-1.5 text-xs"
            disabled={pending}
            onClick={() => startTransition(() => convertLead(lead.id))}
          >
            Convert to client
          </Button>
        )}
      </td>
    </tr>
  );
}
