import { notFound } from "next/navigation";
import { ClipboardList, Signature, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SendAgreementButton, VoidAgreementButton } from "@/components/SendAgreementButton";
import { maskSensitive } from "@/lib/sensitive";
import { formatDate } from "@/lib/dateFormat";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  const { data: intake } = await supabase
    .from("credit_intakes")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();

  const { data: requests } = await supabase
    .from("signature_requests")
    .select("id, title, status, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="mt-0 mb-1">
          {client.first_name} {client.last_name}
        </h1>
        <p className="m-0 text-(--color-muted)">
          {client.email ?? "No email"} · {client.phone ?? "No phone"}
        </p>
      </div>

      <Card title="Intake" icon={<ClipboardList size={18} />}>
        {!intake ? (
          <EmptyState icon={ClipboardList}>Client hasn&apos;t started intake yet.</EmptyState>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-(--color-muted)">Status</dt>
            <dd className="m-0 capitalize">{intake.status}</dd>
            <dt className="text-(--color-muted)">Date of birth</dt>
            <dd className="m-0">{intake.date_of_birth ?? "—"}</dd>
            <dt className="text-(--color-muted)">SSN</dt>
            <dd className="m-0">{maskSensitive(intake.ssn) ?? "—"}</dd>
            <dt className="text-(--color-muted)">Employment</dt>
            <dd className="m-0">{intake.employment_status ?? "—"}</dd>
            <dt className="text-(--color-muted)">Monthly income</dt>
            <dd className="m-0">
              {intake.monthly_income_cents != null ? `$${(intake.monthly_income_cents / 100).toLocaleString()}` : "—"}
            </dd>
            <dt className="text-(--color-muted)">Estimated debt</dt>
            <dd className="m-0">
              {intake.estimated_debt_cents != null ? `$${(intake.estimated_debt_cents / 100).toLocaleString()}` : "—"}
            </dd>
            <dt className="text-(--color-muted)">Primary goal</dt>
            <dd className="m-0">{intake.primary_goal ?? "—"}</dd>
            <dt className="text-(--color-muted)">Known negative items</dt>
            <dd className="m-0">{intake.known_negative_items ?? "—"}</dd>
            <dt className="text-(--color-muted)">Authorized credit pull</dt>
            <dd className="m-0">{intake.authorized_credit_pull ? "Yes" : "No"}</dd>
          </dl>
        )}
      </Card>

      <Card title="Service Agreement" icon={<Signature size={18} />}>
        {(requests ?? []).length === 0 ? (
          <EmptyState icon={Signature}>No agreement sent yet.</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {(requests ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between border-b border-(--color-border) pb-2">
                <span>
                  {r.title} · <span className="text-(--color-muted)">{formatDate(r.created_at)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="capitalize text-(--color-gold)">{r.status}</span>
                  {r.status === "pending" && <VoidAgreementButton requestId={r.id} clientId={id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <SendAgreementButton clientId={id} />
        </div>
        <p className="mt-3 text-xs text-(--color-muted)">
          Agreement text is placeholder boilerplate — have a Florida attorney review it before sending to
          a real client (edit under Templates).
        </p>
      </Card>

      <Card title="Record" icon={<UserIcon size={18} />}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt className="text-(--color-muted)">Address</dt>
          <dd className="m-0">{client.address ?? "—"}</dd>
          <dt className="text-(--color-muted)">Status</dt>
          <dd className="m-0 capitalize">{client.status}</dd>
          <dt className="text-(--color-muted)">Client since</dt>
          <dd className="m-0">{formatDate(client.created_at)}</dd>
        </dl>
      </Card>
    </div>
  );
}
