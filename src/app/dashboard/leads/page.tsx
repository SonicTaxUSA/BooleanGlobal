import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LeadRow } from "@/components/LeadRow";
import { Inbox } from "lucide-react";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase.from("leads").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mt-0">Leads</h1>
      <p className="mt-0 text-(--color-muted)">Submissions from the public contact form.</p>

      {(leads ?? []).length === 0 ? (
        <EmptyState icon={Inbox}>No leads yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-(--color-muted)">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Phone</th>
                <th className="py-2 pr-4 font-medium">Message</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
