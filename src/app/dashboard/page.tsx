import Link from "next/link";
import { Inbox, Users, ClipboardCheck, Signature } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function StatTile({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 no-underline transition-colors hover:border-(--color-border-strong)"
    >
      <span className="inline-flex w-fit items-center justify-center rounded-full bg-(--color-surface-raised) p-2 text-(--color-gold)">
        <Icon size={18} />
      </span>
      <span className="text-3xl font-semibold text-(--color-ink)">{value}</span>
      <span className="text-sm text-(--color-muted)">{label}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: newLeads }, { count: totalClients }, { count: submittedIntakes }, { count: pendingAgreements }] =
    await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("credit_intakes").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      supabase
        .from("signature_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  return (
    <div>
      <h1 className="mt-0">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/dashboard/leads" icon={Inbox} label="New leads" value={newLeads ?? 0} />
        <StatTile href="/dashboard/clients" icon={Users} label="Total clients" value={totalClients ?? 0} />
        <StatTile
          href="/dashboard/clients"
          icon={ClipboardCheck}
          label="Intakes submitted"
          value={submittedIntakes ?? 0}
        />
        <StatTile
          href="/dashboard/clients"
          icon={Signature}
          label="Agreements pending signature"
          value={pendingAgreements ?? 0}
        />
      </div>
    </div>
  );
}
