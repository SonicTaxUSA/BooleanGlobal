import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { Users } from "lucide-react";

function deriveStatus(intakeStatus: string | undefined, agreementStatus: string | undefined): string {
  if (agreementStatus === "signed") return "Agreement Signed";
  if (agreementStatus === "pending") return "Agreement Sent";
  if (intakeStatus === "submitted") return "Intake Submitted";
  if (intakeStatus === "draft") return "Intake In Progress";
  return "Not Started";
}

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: intakes }, { data: requests }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("credit_intakes").select("client_id, status"),
    supabase
      .from("signature_requests")
      .select("client_id, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const intakeByClient = new Map((intakes ?? []).map((i) => [i.client_id, i.status]));
  const requestByClient = new Map<string, string>();
  for (const r of requests ?? []) {
    if (!requestByClient.has(r.client_id)) requestByClient.set(r.client_id, r.status);
  }

  return (
    <div>
      <h1 className="mt-0">Clients</h1>

      {(clients ?? []).length === 0 ? (
        <EmptyState icon={Users}>No clients yet — convert a lead to get started.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-(--color-muted)">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((c) => (
                <tr key={c.id} className="border-b border-(--color-border)">
                  <td className="py-3 pr-4">
                    <Link href={`/dashboard/clients/${c.id}`} className="text-(--color-ink) no-underline hover:text-(--color-gold-bright)">
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-(--color-muted)">{c.email ?? "—"}</td>
                  <td className="py-3 pr-4 capitalize text-(--color-muted)">{c.status}</td>
                  <td className="py-3 text-(--color-gold)">
                    {deriveStatus(intakeByClient.get(c.id), requestByClient.get(c.id))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
