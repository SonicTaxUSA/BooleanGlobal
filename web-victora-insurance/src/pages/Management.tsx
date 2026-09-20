/**
 * Victora Management Suite — Sprint 4 operations surface for managers,
 * compliance, and super admins: management analytics, commission ledger,
 * compliance center, communication templates/deliveries, and system
 * administration (health, backups, security, launch readiness, test data).
 * Every authorization decision is enforced server-side; this UI only renders
 * sections the viewer's role permits and never hardcodes metrics.
 */
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import Layout from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type AnalyticsResponse,
  type CommissionRecordRow,
  type CommTemplateRow,
  type ComplaintRow,
  type LaunchChecklistResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type SectionId = "analytics" | "commissions" | "compliance" | "communications" | "admin";

const SECTIONS: { id: SectionId; label: string; icon: typeof BarChart3 }[] = [
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "commissions", label: "Commissions", icon: Wallet },
  { id: "compliance", label: "Compliance", icon: Scale },
  { id: "communications", label: "Communications", icon: Mail },
  { id: "admin", label: "Administration", icon: ShieldCheck },
];

const LEAD_STAGES: { id: string; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "intake", label: "Intake" },
  { id: "documents", label: "Documents" },
  { id: "quoting", label: "Quoting" },
  { id: "client_review", label: "Client Review" },
  { id: "enrollment", label: "Enrollment" },
  { id: "active", label: "Active" },
  { id: "lost", label: "Lost" },
];

const RENEWAL_LABELS: { id: string; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "review_needed", label: "Review Needed" },
  { id: "contacted", label: "Contacted" },
  { id: "waiting_client", label: "Waiting on Client" },
  { id: "reviewing", label: "Reviewing" },
  { id: "completed", label: "Completed" },
  { id: "not_renewed", label: "Not Renewed" },
  { id: "lost", label: "Lost" },
];

const COMMISSION_STATUS_OPTIONS = ["expected", "received", "partial", "reversed", "disputed", "written_off"] as const;

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ManagementSuite() {
  const { user } = useAuth();
  const [section, setSection] = useState<SectionId>("analytics");
  const isSuper = user?.role === "super_admin";

  return (
    <Layout>
      <section className="border-b border-border bg-navy-canvas relative overflow-hidden">
        <div className="container relative py-10">
          <p className="eyebrow text-gold">Victora Management</p>
          <h1 className="display mt-2 text-3xl text-ivory">The agency at a glance</h1>
          <p className="mt-2 max-w-xl text-sm text-ivory/60">
            What is working, what needs attention, and who needs help — computed live from Victora's records. Test data is excluded by default.
          </p>
        </div>
      </section>
      <div className="container py-8">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.filter((s) => s.id !== "admin" || isSuper).map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-all active:scale-[0.97]",
                  section === s.id ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-gold/50 hover:text-navy",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="mt-8">
          {section === "analytics" ? <AnalyticsSection /> : null}
          {section === "commissions" ? <CommissionsSection /> : null}
          {section === "compliance" ? <ComplianceSection /> : null}
          {section === "communications" ? <CommunicationsSection /> : null}
          {section === "admin" && isSuper ? <AdminSection /> : null}
        </div>
      </div>
    </Layout>
  );
}

/* --------------------------------- shared ---------------------------------- */

function Panel({ title, eyebrow, children, className }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5 md:p-6", className)}>
      {eyebrow ? <p className="eyebrow text-gold">{eyebrow}</p> : null}
      <h3 className="display mt-1 text-lg text-navy">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="display mt-1 text-2xl text-navy">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-border bg-background p-4 text-xs text-muted-foreground">{children}</p>;
}

function Spinner() {
  return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-gold" />;
}

/* -------------------------------- analytics -------------------------------- */

function AnalyticsSection() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [product, setProduct] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [includeTests, setIncludeTests] = useState<boolean>(false);

  const team = useQuery({ queryKey: ["team-analytics"], queryFn: api.team });
  const analytics = useQuery({
    queryKey: ["analytics", from, to, agentId, product, source, includeTests],
    queryFn: () => api.analytics({ from: from || undefined, to: to || undefined, agentId: agentId || undefined, product: product || undefined, source: source || undefined, includeTests: isSuper && includeTests }),
  });

  if (analytics.isLoading) return <Spinner />;
  if (analytics.isError) return <Empty>{(analytics.error as Error).message}</Empty>;
  const a: AnalyticsResponse = analytics.data;
  const maxPipeline = Math.max(1, ...Object.values(a.pipeline));

  return (
    <div className="space-y-6">
      <Panel title="Filters" eyebrow="Date range & scope">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Agent</Label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy">
              <option value="">All agents</option>
              {(team.data?.team ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Product</Label>
            <select value={product} onChange={(e) => setProduct(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy">
              <option value="">All products</option>
              <option>Health</option>
              <option>Dental</option>
              <option>Vision</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Lead source</Label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy">
              <option value="">All sources</option>
              <option>Instagram</option>
              <option>Facebook</option>
              <option>Google</option>
              <option>Website</option>
              <option>Referral</option>
              <option>Sonic Tax USA</option>
              <option>Partner</option>
              <option>Walk-in</option>
              <option>Agent</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        {isSuper ? (
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} className="h-4 w-4 accent-[#b8860b]" />
            <span className="font-medium text-navy">Include test data</span>
            <span className="text-[11px]">— default OFF; super-admin only, enforced server-side</span>
          </label>
        ) : null}
        {a.filters.includeTests ? <p className="mt-3 text-xs font-medium text-amber-600">Super-admin view: TEST records are INCLUDED in these numbers.</p> : null}
      </Panel>

      <Panel title="Pipeline" eyebrow="Where prospects stand">
        <div className="space-y-2">
          {LEAD_STAGES.map((s) => {
            const n = a.pipeline[s.id] ?? 0;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{s.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-sm bg-background">
                  <div className="h-full rounded-sm bg-navy/80" style={{ width: `${Math.round((n / maxPipeline) * 100)}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-navy">{n}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Conversion" eyebrow="Every denominator is defined">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: "leadToAppointment", label: "Lead → Appointment" },
            { key: "leadToQuote", label: "Lead → Quote" },
            { key: "quoteToInterest", label: "Quote → Interest" },
            { key: "quoteToActiveClient", label: "Quote → Active Client" },
          ].map((c) => {
            const row = a.conversion[c.key];
            return (
              <div key={c.key} className="rounded-md border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{c.label}</p>
                <p className="display mt-1 text-2xl text-navy">{row.percent === null ? "—" : `${row.percent}%`}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.numerator} / {row.denominator}</p>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">{a.definitions[c.key]}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Production" eyebrow="Active policies">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Active total" value={a.production.activePolicies} />
            <Stat label="Health" value={a.production.byProduct.Health ?? 0} />
            <Stat label="Dental" value={a.production.byProduct.Dental ?? 0} />
            <Stat label="Vision" value={a.production.byProduct.Vision ?? 0} />
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">By carrier</p>
          {a.production.byCarrier.length === 0 ? (
            <Empty>No active policies yet.</Empty>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {a.production.byCarrier.map((c) => (
                <li key={c.carrier} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                  <span>{c.carrier || "(unspecified)"}</span>
                  <span className="font-medium">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">By agent</p>
          <ul className="mt-2 space-y-1 text-sm">
            {a.production.byAgent.map((c) => (
              <li key={c.name} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                <span>{c.name}</span>
                <span className="font-medium">{c.n}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Service health" eyebrow="Response quality">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Open tickets" value={a.service.openTickets} />
            <Stat label="Avg open age" value={`${a.service.avgOpenAgeHours}h`} />
            <Stat label="Avg resolution" value={`${a.service.avgResolutionHours}h`} sub="Creation → last update, resolved tickets" />
            <Stat label="Unread messages" value={a.service.unreadMessages} />
            <Stat label="Documents owed" value={a.service.outstandingDocumentRequests} sub="Open document requests" />
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Renewals</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {RENEWAL_LABELS.map((s) => (
              <div key={s.id} className="flex justify-between rounded-sm border border-border bg-background px-2 py-1.5 text-navy">
                <span>{s.label}</span>
                <span className="font-medium">{a.renewalsByStatus[s.id] ?? 0}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Marketing" eyebrow="Where clients come from">
          {a.marketing.bySource.length === 0 ? (
            <Empty>No leads recorded yet.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {a.marketing.bySource.map((s) => (
                <li key={s.source} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                  <span>{s.source}</span>
                  <span className="font-medium">{s.n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Top campaigns</p>
          <ul className="mt-2 space-y-1 text-sm">
            {a.marketing.byCampaign.map((c) => (
              <li key={c.campaign} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                <span>{c.campaign}</span>
                <span className="font-medium">{c.n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Referrals</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(a.marketing.referralsByStatus).map(([status, n]) => (
              <span key={status} className="rounded-full border border-border bg-background px-2.5 py-1 text-navy">
                {status}: <span className="font-medium">{n}</span>
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Team" eyebrow="Who needs help">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Clients</th>
                  <th className="pb-2">Active</th>
                  <th className="pb-2">Appts</th>
                  <th className="pb-2">Quotes</th>
                  <th className="pb-2">Follow-ups</th>
                  <th className="pb-2">Renewals</th>
                </tr>
              </thead>
              <tbody>
                {a.team.map((t) => (
                  <tr key={t.id} className="border-t border-border/60 text-navy">
                    <td className="py-2">{t.name}<span className="ml-1 text-xs text-muted-foreground">({t.role.replace("_", " ")})</span></td>
                    <td className="py-2">{t.assignedClients}</td>
                    <td className="py-2">{t.activeClients}</td>
                    <td className="py-2">{t.appointments}</td>
                    <td className="py-2">{t.quotes}</td>
                    <td className="py-2">{t.openFollowUps}</td>
                    <td className="py-2">{t.openRenewals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-md border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-navy/70">Metric definitions</p>
            {Object.entries(a.definitions).map(([k, v]) => (
              <p key={k} className="mt-1"><span className="font-medium text-navy/80">{k}:</span> {v}</p>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------- commissions ------------------------------- */

function CommissionsSection() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["commissions"], queryFn: () => api.commissions() });
  const team = useQuery({ queryKey: ["team-commissions"], queryFn: api.team });

  const [carrier, setCarrier] = useState("");
  const [product, setProduct] = useState("");
  const [agentId, setAgentId] = useState("");
  const [period, setPeriod] = useState("");
  const [type, setType] = useState<string>("first_year");
  const [expected, setExpected] = useState("");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [adjRecordId, setAdjRecordId] = useState("");
  const [adjKind, setAdjKind] = useState<"adjustment" | "chargeback">("adjustment");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["commissions"] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.createCommission({
        carrier, product, agentId: agentId || undefined, statementPeriod: period, commissionType: type,
        expectedAmount: Number(expected || 0), receivedAmount: Number(received || 0),
        carrierReference: reference, notes,
      }),
    onSuccess: () => {
      toast.success("Commission record added");
      setCarrier(""); setProduct(""); setPeriod(""); setExpected(""); setReceived(""); setReference(""); setNotes("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) => api.commissionAction(v.id, { action: "status", status: v.status }),
    onSuccess: () => {
      toast.success("Commission status updated");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const adjust = useMutation({
    mutationFn: () =>
      api.commissionAction(adjRecordId, {
        action: adjKind, amount: Number(adjAmount || 0), reason: adjReason,
      }),
    onSuccess: () => {
      toast.success(adjKind === "chargeback" ? "Chargeback recorded" : "Adjustment recorded");
      setAdjAmount(""); setAdjReason("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (data.isLoading) return <Spinner />;
  if (data.isError) return <Empty>{(data.error as Error).message}</Empty>;
  const s = data.data.summary;
  const records = data.data.commissions;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expected (open)" value={money(s.expectedTotal)} />
        <Stat label="Received" value={money(s.receivedTotal)} />
        <Stat label="Outstanding" value={money(s.outstanding)} />
        <Stat label="Chargebacks / reversals" value={s.chargebacks} />
      </div>

      <Panel title="Add verified commission data" eyebrow="Manual entry — no fabricated schedules">
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          This is Victora's internal accounting ledger — it does not process carrier payments. Enter only verified statement data until a real carrier integration exists.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label className="text-xs text-muted-foreground">Carrier *</Label><Input className="mt-1" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier name" /></div>
          <div><Label className="text-xs text-muted-foreground">Product</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">—</option><option>Health</option><option>Dental</option><option>Vision</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Agent</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">—</option>
              {(team.data?.team ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Statement period</Label><Input className="mt-1" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2026-09" /></div>
          <div><Label className="text-xs text-muted-foreground">Type</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="first_year">First year</option><option value="renewal">Renewal</option><option value="adjustment">Adjustment</option><option value="chargeback">Chargeback</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Expected amount</Label><Input className="mt-1" type="number" min="0" step="0.01" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Received amount</Label><Input className="mt-1" type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Carrier reference</Label><Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1"><Label className="text-xs text-muted-foreground">Notes</Label><Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button onClick={() => create.mutate()} disabled={create.isPending || carrier.trim().length < 2} className="bg-navy text-ivory hover:bg-navy/90">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add record"}
          </Button>
        </div>
      </Panel>

      <Panel title="Commission ledger" eyebrow={`${records.length} records`}>
        {records.length === 0 ? (
          <Empty>No commission records yet — add verified statement data above.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="pb-2">Carrier / Product</th><th className="pb-2">Agent</th><th className="pb-2">Period</th>
                  <th className="pb-2">Type</th><th className="pb-2">Expected</th><th className="pb-2">Received</th><th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: CommissionRecordRow) => (
                  <tr key={r.id} className="border-t border-border/60 text-navy">
                    <td className="py-2">{r.carrier}<span className="block text-xs text-muted-foreground">{r.product || "—"}</span></td>
                    <td className="py-2">{r.agent_name ?? "—"}</td>
                    <td className="py-2 text-xs">{r.statement_period || "—"}</td>
                    <td className="py-2 text-xs">{r.commission_type.replace("_", " ")}</td>
                    <td className="py-2">{money(r.expected_amount)}</td>
                    <td className="py-2">{money(r.received_amount)}</td>
                    <td className="py-2">
                      <select
                        className="rounded border border-input bg-card px-2 py-1 text-xs text-navy"
                        value={r.status}
                        onChange={(e) => setStatus.mutate({ id: r.id, status: e.target.value })}
                      >
                        {COMMISSION_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Adjustment / chargeback" eyebrow="Correct the ledger with an audit trail">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Record</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={adjRecordId} onChange={(e) => setAdjRecordId(e.target.value)}>
              <option value="">Select a record…</option>
              {records.map((r) => <option key={r.id} value={r.id}>{r.carrier} · {r.statement_period || r.commission_type} ({money(r.expected_amount)})</option>)}
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Kind</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={adjKind} onChange={(e) => setAdjKind(e.target.value as "adjustment" | "chargeback")}>
              <option value="adjustment">Adjustment</option><option value="chargeback">Chargeback</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Amount</Label><Input className="mt-1" type="number" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Reason</Label><Input className="mt-1" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} /></div>
        </div>
        <Button className="mt-3" variant="outline" onClick={() => adjust.mutate()} disabled={adjust.isPending || adjRecordId === ""}>
          {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}
        </Button>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { title: "By carrier", rows: s.byCarrier.map((x) => ({ key: x.carrier, expected: x.expected, received: x.received, n: x.n })) },
          { title: "By product", rows: s.byProduct.map((x) => ({ key: x.product || "(none)", expected: x.expected, received: x.received, n: x.n })) },
          { title: "By agent", rows: s.byAgent.map((x) => ({ key: x.name, expected: x.expected, received: x.received, n: x.n })) },
        ].map((tbl) => (
          <Panel key={tbl.title} title={tbl.title} eyebrow="Expected vs received">
            {tbl.rows.length === 0 ? (
              <Empty>No data.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {tbl.rows.map((r) => (
                  <li key={r.key} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                    <span>{r.key} <span className="text-xs text-muted-foreground">({r.n})</span></span>
                    <span className="text-xs">{money(r.expected)} / <span className="font-medium text-green-700">{money(r.received)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- compliance ------------------------------- */

function ComplianceSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCompliance = user?.role === "compliance" || user?.role === "super_admin";
  const team = useQuery({ queryKey: ["team-compliance"], queryFn: api.team });
  const clients = useQuery({ queryKey: ["clients-compliance"], queryFn: api.clients });
  const licenses = useQuery({ queryKey: ["licenses"], queryFn: api.licenses });
  const carrier = useQuery({ queryKey: ["carrier-appointments"], queryFn: api.carrierAppointments });
  const certs = useQuery({ queryKey: ["certifications"], queryFn: api.certifications });
  const marketing = useQuery({ queryKey: ["marketing-reviews"], queryFn: api.marketingReviews });
  const complaints = useQuery({ queryKey: ["complaints"], queryFn: api.complaints });
  const retention = useQuery({ queryKey: ["retention"], queryFn: api.retentionPolicies });

  const [licAgent, setLicAgent] = useState(""); const [licState, setLicState] = useState(""); const [licNumber, setLicNumber] = useState("");
  const [licLine, setLicLine] = useState(""); const [licExp, setLicExp] = useState("");
  const [capAgent, setCapAgent] = useState(""); const [capCarrier, setCapCarrier] = useState(""); const [capState, setCapState] = useState("");
  const [crtAgent, setCrtAgent] = useState(""); const [crtName, setCrtName] = useState(""); const [crtExp, setCrtExp] = useState("");
  const [mktTitle, setMktTitle] = useState(""); const [mktCampaign, setMktCampaign] = useState(""); const [mktContent, setMktContent] = useState("");
  const [cmpType, setCmpType] = useState(""); const [cmpClientId, setCmpClientId] = useState(""); const [cmpChannel, setCmpChannel] = useState("phone"); const [cmpDetails, setCmpDetails] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [retType, setRetType] = useState(""); const [retDays, setRetDays] = useState(""); const [retHold, setRetHold] = useState(false);

  const invalidate = (keys: string[]): void => { for (const k of keys) void queryClient.invalidateQueries({ queryKey: [k] }); };

  const addLicense = useMutation({
    mutationFn: () => api.createLicense({ agentId: licAgent, state: licState, licenseNumber: licNumber, lineOfAuthority: licLine, expiration: licExp }),
    onSuccess: () => { toast.success("License recorded"); setLicState(""); setLicNumber(""); setLicLine(""); setLicExp(""); invalidate(["licenses", "launch-checklist"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const addCarrier = useMutation({
    mutationFn: () => api.createCarrierAppointment({ agentId: capAgent, carrier: capCarrier, state: capState }),
    onSuccess: () => { toast.success("Carrier appointment recorded"); setCapCarrier(""); setCapState(""); invalidate(["carrier-appointments", "launch-checklist"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const addCert = useMutation({
    mutationFn: () => api.createCertification({ agentId: crtAgent, certification: crtName, expiration: crtExp }),
    onSuccess: () => { toast.success("Certification recorded"); setCrtName(""); setCrtExp(""); invalidate(["certifications"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const mktAction = useMutation({
    mutationFn: (v: { id: string; action: string; notes?: string }) => api.marketingAction(v.id, v.action, v.notes),
    onSuccess: () => { toast.success("Marketing review updated"); invalidate(["marketing-reviews"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const createMkt = useMutation({
    mutationFn: () => api.createMarketingReview({ title: mktTitle, campaign: mktCampaign, content: mktContent }),
    onSuccess: () => { toast.success("Submitted to review queue"); setMktTitle(""); setMktCampaign(""); setMktContent(""); invalidate(["marketing-reviews"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const addComplaint = useMutation({
    mutationFn: () => api.createComplaint({ complaintType: cmpType, clientId: cmpClientId || undefined, channel: cmpChannel, details: cmpDetails }),
    onSuccess: () => { toast.success("Complaint recorded"); setCmpType(""); setCmpClientId(""); setCmpDetails(""); invalidate(["complaints"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const complaintAction = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => api.complaintAction(v.id, v.body),
    onSuccess: () => { toast.success("Complaint updated"); invalidate(["complaints"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const addNote = useMutation({
    mutationFn: (v: { id: string; body: string }) => api.complaintNote(v.id, v.body),
    onSuccess: (_d, v) => { toast.success("Note added (internal only)"); setNoteDraft((d) => ({ ...d, [v.id]: "" })); invalidate(["complaints"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const saveRet = useMutation({
    mutationFn: () => api.saveRetention({ recordType: retType, retentionDays: Number(retDays || 0), hold: retHold }),
    onSuccess: () => { toast.success("Retention policy saved (no deletion active)"); setRetType(""); setRetDays(""); setRetHold(false); invalidate(["retention"]); },
    onError: (err: Error) => toast.error(err.message),
  });

  if (licenses.isLoading || complaints.isLoading) return <Spinner />;
  if (licenses.isError) return <Empty>{(licenses.error as Error).message}</Empty>;
  const staffOptions = (team.data?.team ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>);

  return (
    <div className="space-y-6">
      <Panel title="Agent licensing" eyebrow="Licenses current?">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label className="text-xs text-muted-foreground">Agent</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={licAgent} onChange={(e) => setLicAgent(e.target.value)}><option value="">—</option>{staffOptions}</select></div>
          <div><Label className="text-xs text-muted-foreground">State</Label><Input className="mt-1" value={licState} onChange={(e) => setLicState(e.target.value)} placeholder="FL" /></div>
          <div><Label className="text-xs text-muted-foreground">License #</Label><Input className="mt-1" value={licNumber} onChange={(e) => setLicNumber(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Line of authority</Label><Input className="mt-1" value={licLine} onChange={(e) => setLicLine(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Expiration</Label><Input className="mt-1" type="date" value={licExp} onChange={(e) => setLicExp(e.target.value)} /></div>
        </div>
        <Button className="mt-3" onClick={() => addLicense.mutate()} disabled={addLicense.isPending || !licAgent || licState.length < 2 || licNumber.length < 2}>Add license</Button>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground"><th className="pb-2">Agent</th><th className="pb-2">State</th><th className="pb-2">License</th><th className="pb-2">Line</th><th className="pb-2">Expires</th><th className="pb-2">Status</th></tr></thead>
            <tbody>
              {(licenses.data?.licenses ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border/60 text-navy">
                  <td className="py-2">{l.agent_name}</td><td className="py-2">{l.state}</td><td className="py-2">{l.license_number}</td>
                  <td className="py-2 text-xs">{l.line_of_authority || "—"}</td>
                  <td className="py-2 text-xs">{l.expiration || "—"}{l.daysToExpiration !== null ? ` (${l.daysToExpiration}d)` : ""}</td>
                  <td className="py-2">
                    {l.expired ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="h-3 w-3" /> EXPIRED</span>
                      : l.status === "active" ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3 w-3" /> active</span>
                      : <span className="text-xs text-muted-foreground">{l.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(licenses.data?.licenses ?? []).length === 0 ? <Empty>No licenses recorded — add the agency's licenses above.</Empty> : null}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Carrier appointments" eyebrow="Confirmed with each carrier?">
          <div className="grid gap-3 md:grid-cols-4">
            <div><Label className="text-xs text-muted-foreground">Agent</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={capAgent} onChange={(e) => setCapAgent(e.target.value)}><option value="">—</option>{staffOptions}</select></div>
            <div><Label className="text-xs text-muted-foreground">Carrier</Label><Input className="mt-1" value={capCarrier} onChange={(e) => setCapCarrier(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">State</Label><Input className="mt-1" value={capState} onChange={(e) => setCapState(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={() => addCarrier.mutate()} disabled={addCarrier.isPending || !capAgent || capCarrier.length < 2 || capState.length < 2}>Add</Button></div>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {(carrier.data?.appointments ?? []).map((c) => (
              <li key={c.id} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                <span>{c.agent_name} — {c.carrier} ({c.state}){c.product ? ` · ${c.product}` : ""}</span>
                <span className={cn("text-xs font-medium", c.status === "active" ? "text-green-700" : "text-muted-foreground")}>{c.status}</span>
              </li>
            ))}
          </ul>
          {(carrier.data?.appointments ?? []).length === 0 ? <Empty>No carrier appointments recorded yet.</Empty> : null}
        </Panel>

        <Panel title="Certifications & training" eyebrow="Renewal tracking">
          <div className="grid gap-3 md:grid-cols-4">
            <div><Label className="text-xs text-muted-foreground">Agent</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={crtAgent} onChange={(e) => setCrtAgent(e.target.value)}><option value="">—</option>{staffOptions}</select></div>
            <div><Label className="text-xs text-muted-foreground">Certification</Label><Input className="mt-1" value={crtName} onChange={(e) => setCrtName(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Expiration</Label><Input className="mt-1" type="date" value={crtExp} onChange={(e) => setCrtExp(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={() => addCert.mutate()} disabled={addCert.isPending || !crtAgent || crtName.length < 2}>Add</Button></div>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {(certs.data?.certifications ?? []).map((c) => (
              <li key={c.id} className="flex justify-between border-b border-border/60 pb-1 text-navy">
                <span>{c.agent_name} — {c.certification}</span>
                <span className={cn("text-xs", c.expired ? "font-medium text-red-600" : "text-muted-foreground")}>{c.expiration || "no expiration"}{c.daysToExpiration !== null ? ` (${c.daysToExpiration}d)` : ""}</span>
              </li>
            ))}
          </ul>
          {(certs.data?.certifications ?? []).length === 0 ? <Empty>No certifications recorded yet.</Empty> : null}
        </Panel>
      </div>

      <Panel title="Marketing review" eyebrow="Draft → Review → Approved / Rejected → Archived">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label className="text-xs text-muted-foreground">Title</Label><Input className="mt-1" value={mktTitle} onChange={(e) => setMktTitle(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">Campaign</Label><Input className="mt-1" value={mktCampaign} onChange={(e) => setMktCampaign(e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Content</Label><Input className="mt-1" value={mktContent} onChange={(e) => setMktContent(e.target.value)} placeholder="Ad copy, script, or description" /></div>
        </div>
        <Button className="mt-3" onClick={() => createMkt.mutate()} disabled={createMkt.isPending || mktTitle.length < 3 || mktContent.length < 10}>Create draft</Button>
        <div className="mt-4 space-y-2">
          {(marketing.data?.reviews ?? []).map((m) => (
            <div key={m.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-navy">{m.title}{m.campaign ? <span className="text-xs text-muted-foreground"> · {m.campaign}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">{m.content}</p>
                  {m.reviewer ? <p className="mt-1 text-[11px] text-muted-foreground">{m.status} by {m.reviewer}{m.decision_notes ? ` — ${m.decision_notes}` : ""}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(m.status === "draft" || m.status === "rejected") ? (
                    <Button size="sm" variant="outline" onClick={() => mktAction.mutate({ id: m.id, action: "submit" })}>Submit for review</Button>
                  ) : null}
                  {m.status === "review" && isCompliance ? (
                    <>
                      <Button size="sm" className="bg-green-700 text-ivory hover:bg-green-800" onClick={() => mktAction.mutate({ id: m.id, action: "approve" })}>Approve</Button>
                      <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => mktAction.mutate({ id: m.id, action: "reject", notes: window.prompt("Rejection reason:") ?? "" })}>Reject</Button>
                    </>
                  ) : null}
                  {m.status === "approved" || m.status === "rejected" ? (
                    <Button size="sm" variant="ghost" onClick={() => mktAction.mutate({ id: m.id, action: "archive" })}>Archive</Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {(marketing.data?.reviews ?? []).length === 0 ? <Empty>No marketing content in the review pipeline.</Empty> : null}
        </div>
      </Panel>

      <Panel title="Complaints" eyebrow="Internal only — never visible in My Victora">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label className="text-xs text-muted-foreground">Type *</Label><Input className="mt-1" value={cmpType} onChange={(e) => setCmpType(e.target.value)} placeholder="e.g. Billing dispute" /></div>
          <div><Label className="text-xs text-muted-foreground">Client</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={cmpClientId} onChange={(e) => setCmpClientId(e.target.value)}>
              <option value="">—</option>
              {(clients.data?.clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.id})</option>)}
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Channel</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={cmpChannel} onChange={(e) => setCmpChannel(e.target.value)}>
              <option value="phone">Phone</option><option value="email">Email</option><option value="portal">Portal</option><option value="in_person">In person</option><option value="mail">Mail</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Details</Label><Input className="mt-1" value={cmpDetails} onChange={(e) => setCmpDetails(e.target.value)} /></div>
        </div>
        <Button className="mt-3" onClick={() => addComplaint.mutate()} disabled={addComplaint.isPending || cmpType.length < 3}>Record complaint</Button>
        <div className="mt-4 space-y-3">
          {(complaints.data?.complaints ?? []).map((c: ComplaintRow) => (
            <div key={c.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-navy">{c.complaint_type}{c.first_name ? <span className="text-xs text-muted-foreground"> · {c.first_name} {c.last_name}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">Received {fmtDateTime(c.received_at)} · via {c.channel} · owner: {c.owner_name ?? "unassigned"}</p>
                  {c.details ? <p className="mt-1 text-xs text-navy/80">{c.details}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded border border-input bg-card px-2 py-1 text-xs text-navy"
                    value={c.status}
                    onChange={(e) => complaintAction.mutate({ id: c.id, body: { action: "status", status: e.target.value, resolution: e.target.value === "resolved" ? window.prompt("Describe the resolution:") ?? "" : "" } })}
                  >
                    {["open", "investigating", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    className="rounded border border-input bg-card px-2 py-1 text-xs text-navy"
                    value={c.owner_id ?? ""}
                    onChange={(e) => complaintAction.mutate({ id: c.id, body: { action: "assign", ownerId: e.target.value } })}
                  >
                    <option value="">assign owner…</option>{staffOptions}
                  </select>
                </div>
              </div>
              {c.resolution ? <p className="mt-2 text-xs text-green-800">Resolution: {c.resolution}</p> : null}
              {c.notes.length > 0 ? (
                <ul className="mt-2 space-y-1 border-l-2 border-amber-400 pl-3">
                  {c.notes.map((n) => (
                    <li key={n.id} className="text-[11px] text-muted-foreground"><span className="font-medium text-navy/80">INTERNAL · {n.author_role}</span> — {n.body}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex gap-2">
                <Input
                  className="h-8 flex-1 text-xs"
                  placeholder="Add investigation note (internal only)…"
                  value={noteDraft[c.id] ?? ""}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                />
                <Button size="sm" variant="outline" onClick={() => addNote.mutate({ id: c.id, body: noteDraft[c.id] ?? "" })} disabled={(noteDraft[c.id] ?? "").trim().length < 2}>Add note</Button>
              </div>
            </div>
          ))}
          {(complaints.data?.complaints ?? []).length === 0 ? <Empty>No complaints recorded.</Empty> : null}
        </div>
      </Panel>

      <Panel title="Data retention" eyebrow="Policy framework — no deletion active">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label className="text-xs text-muted-foreground">Record type</Label><Input className="mt-1" value={retType} onChange={(e) => setRetType(e.target.value)} placeholder="e.g. leads" /></div>
          <div><Label className="text-xs text-muted-foreground">Retention days</Label><Input className="mt-1" type="number" min="0" value={retDays} onChange={(e) => setRetDays(e.target.value)} /></div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox checked={retHold} onCheckedChange={(v) => setRetHold(v === true)} id="ret-hold" />
            <Label htmlFor="ret-hold" className="text-xs text-muted-foreground">Legal / compliance hold</Label>
          </div>
          <div className="flex items-end"><Button onClick={() => saveRet.mutate()} disabled={saveRet.isPending || retType.length < 3}>Save policy</Button></div>
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          {(retention.data?.policies ?? []).map((p) => (
            <li key={p.id} className="flex justify-between border-b border-border/60 pb-1 text-navy">
              <span>{p.record_type}{p.hold ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">HOLD</span> : null}</span>
              <span className="text-xs text-muted-foreground">{p.retention_days ?? "—"} days</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{retention.data?.note}</p>
      </Panel>
    </div>
  );
}

/* ------------------------------ communications ----------------------------- */

function CommunicationsSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCompliance = user?.role === "compliance" || user?.role === "super_admin";
  const templates = useQuery({ queryKey: ["comm-templates"], queryFn: api.commTemplates });
  const deliveries = useQuery({ queryKey: ["deliveries-mgmt"], queryFn: api.deliveries });
  const calendar = useQuery({ queryKey: ["calendar-status"], queryFn: api.calendarStatus });

  const [key, setKey] = useState(""); const [channel, setChannel] = useState("email"); const [language, setLanguage] = useState("English");
  const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [activate, setActivate] = useState(false);

  const create = useMutation({
    mutationFn: () => api.createCommTemplate({ templateKey: key, channel, language, subject, body, activate }),
    onSuccess: () => { toast.success("Template version created"); setKey(""); setSubject(""); setBody(""); setActivate(false); void queryClient.invalidateQueries({ queryKey: ["comm-templates"] }); },
    onError: (err: Error) => toast.error(err.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; action: "activate" | "deactivate" }) => api.commTemplateAction(v.id, v.action),
    onSuccess: () => { toast.success("Template updated"); void queryClient.invalidateQueries({ queryKey: ["comm-templates"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  if (templates.isLoading) return <Spinner />;
  const grouped = new Map<string, CommTemplateRow[]>();
  for (const t of templates.data?.templates ?? []) {
    const list = grouped.get(t.template_key) ?? [];
    list.push(t);
    grouped.set(t.template_key, list);
  }

  return (
    <div className="space-y-6">
      <Panel title="Communication templates" eyebrow="English + Spanish · compliance-controlled publishing">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label className="text-xs text-muted-foreground">Key</Label><Input className="mt-1" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. quote_ready" /></div>
          <div><Label className="text-xs text-muted-foreground">Channel</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="email">Email</option><option value="sms">SMS</option><option value="portal">Portal</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Language</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option>English</option><option>Spanish</option>
            </select>
          </div>
          <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Subject</Label><Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        </div>
        <div className="mt-3">
          <Label className="text-xs text-muted-foreground">Body — generic guidance only; sensitive details stay in My Victora</Label>
          <Textarea className="mt-1 min-h-24" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox checked={activate} onCheckedChange={(v) => setActivate(v === true)} id="ctm-activate" disabled={!isCompliance} />
            <Label htmlFor="ctm-activate" className="text-xs text-muted-foreground">Activate immediately (compliance only)</Label>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending || key.length < 2 || body.length < 10}>Create version</Button>
        </div>
        <div className="mt-5 space-y-4">
          {[...grouped.entries()].map(([gkey, list]) => (
            <div key={gkey}>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{gkey}</p>
              <div className="mt-1 space-y-1">
                {list.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-navy">
                        <span className="font-medium">{t.channel}</span> · {t.language} · v{t.version}{" "}
                        {t.active ? <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">ACTIVE</span> : <span className="ml-1 text-[10px] text-muted-foreground">inactive</span>}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{t.subject ? `${t.subject} — ` : ""}{t.body}</p>
                    </div>
                    {isCompliance ? (
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: t.id, action: t.active ? "deactivate" : "activate" })}>
                        {t.active ? "Deactivate" : "Activate"}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Outbound delivery log" eyebrow="Every send attempt is recorded honestly">
        {deliveries.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground"><th className="pb-2">When</th><th className="pb-2">Channel</th><th className="pb-2">Provider</th><th className="pb-2">Event</th><th className="pb-2">Destination</th><th className="pb-2">Status</th><th className="pb-2">Detail</th></tr></thead>
              <tbody>
                {(deliveries.data?.deliveries ?? []).slice(0, 40).map((d) => (
                  <tr key={d.id} className="border-t border-border/60 text-navy">
                    <td className="py-1.5 text-xs">{fmtDateTime(d.created_at)}</td>
                    <td className="py-1.5 text-xs capitalize">{d.channel}</td>
                    <td className="py-1.5 text-xs">{d.provider || "—"}</td>
                    <td className="py-1.5 text-xs">{d.event}</td>
                    <td className="py-1.5 text-xs">{d.destination || "—"}</td>
                    <td className="py-1.5">
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        d.status === "delivered" ? "bg-green-100 text-green-800" : d.status === "not_configured" ? "bg-muted text-muted-foreground" : "bg-red-100 text-red-700",
                      )}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-[11px] text-muted-foreground">{d.error || (d.status === "not_configured" ? "No provider credential configured" : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Calendar status" eyebrow="Provider adapters">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Provider" value={calendar.data?.provider ?? "none"} />
          <Stat label="External sync" value={calendar.data?.externalSync ?? "not_configured"} />
          <Stat label="Authoritative calendar" value={calendar.data?.authoritative ?? "internal"} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{calendar.data?.note}</p>
      </Panel>
    </div>
  );
}

/* ------------------------------- administration ---------------------------- */

/* ----------------------------- incident runbook ----------------------------- */

const INCIDENT_RUNBOOK: { scenario: string; steps: string[] }[] = [
  {
    scenario: "Suspected account compromise",
    steps: [
      "Containment: deactivate the account (Staff access — deactivation revokes all sessions immediately).",
      "Revoke sessions for any other account showing unexpected logins in Security center.",
      "Admin-reset the password; hand the one-time temporary password to the person by phone, never email.",
      "Review Security center + audit events for actions taken by the account; identify affected client records.",
      "Document findings and follow-up in the incident log kept by management.",
    ],
  },
  {
    scenario: "Lost or stolen staff device",
    steps: [
      "Containment: deactivate or revoke sessions for the staff member from Staff access.",
      "Admin-reset their password before reactivation.",
      "Confirm no shared logins exist; each person must have their own account.",
      "Record the device loss in the incident log; note any documents cached locally.",
    ],
  },
  {
    scenario: "Unauthorized data access / access-denial spike",
    steps: [
      "Review Security center for repeated access denials and unusual export or document access.",
      "Identify the acting account; deactivate if malicious; fix the RBAC gap if accidental.",
      "Pull a structured export of the affected datasets for the investigation record.",
    ],
  },
  {
    scenario: "Document exposure",
    steps: [
      "Stop access: deactivate the implicated account(s); revoke their sessions.",
      "Audit document access events to determine exactly which client files were reachable.",
      "Storage is private by design (no public URLs — all access is server-authorized); verify storage mode in System health.",
      "Notify affected clients honestly; do not speculate about scope before the audit is complete.",
    ],
  },
  {
    scenario: "Compromised credentials (shared/staff email)",
    steps: [
      "Deactivate the affected user; admin-reset the password.",
      "Check conversations, quotes, and legal acceptances for changes made during the exposure window.",
      "Reinforce the policy: staff never reuse work passwords elsewhere.",
    ],
  },
  {
    scenario: "Communication provider outage",
    steps: [
      "Check System health + delivery log for failed deliveries; switch templates to portal-only if needed.",
      "Portal notifications keep working — clients still receive secure updates in My Victora.",
      "Do not mark any delivery as sent that the provider did not confirm.",
    ],
  },
  {
    scenario: "Database / data-loss incident",
    steps: [
      "Stop writes: pause client-facing operations; do not improvise repairs.",
      "Retrieve the most recent structured backup (Backup & exports) and validate it.",
      "Restore into an isolated environment first; verify record counts before any re-import.",
      "Report the loss window honestly to affected clients; document root cause.",
    ],
  },
];

function AdminSection() {
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ["system-health"], queryFn: api.systemHealth });
  const backup = useQuery({ queryKey: ["backup-status"], queryFn: api.backupStatus });
  const checklist = useQuery({ queryKey: ["launch-checklist"], queryFn: api.launchChecklist });
  const security = useQuery({ queryKey: ["security-events"], queryFn: api.securityEvents });
  const team = useQuery({ queryKey: ["team-admin"], queryFn: api.team });
  const clients = useQuery({ queryKey: ["clients-admin"], queryFn: api.clients });

  const [confirmText, setConfirmText] = useState("");
  const [confirmUser, setConfirmUser] = useState<string | null>(null);
  const [lastTemp, setLastTemp] = useState<string | null>(null);

  const invalidate = (keys: string[]): void => { for (const k of keys) void queryClient.invalidateQueries({ queryKey: [k] }); };

  const downloadBackup = useMutation({
    mutationFn: async () => ({ blob: await api.systemBackup() }),
    onSuccess: ({ blob }) => {
      saveBlob(blob, `victora-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("Backup exported");
      invalidate(["backup-status", "system-health", "launch-checklist"]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadExport = useMutation({
    mutationFn: async (dataset: string) => ({ dataset, blob: await api.exportData(dataset, "csv") }),
    onSuccess: ({ dataset, blob }) => {
      saveBlob(blob, `victora-${dataset}.csv`);
      toast.success(`Exported ${dataset}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.setUserActive(id, false, confirmText),
    onSuccess: () => {
      toast.success("User deactivated — sessions revoked");
      setConfirmUser(null); setConfirmText("");
      invalidate(["team-admin", "security-events"]);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const activate = useMutation({
    mutationFn: (id: string) => api.setUserActive(id, true),
    onSuccess: () => { toast.success("User reactivated"); invalidate(["team-admin"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeSessions(id),
    onSuccess: (d) => { toast.success(`${d.revoked} session(s) revoked`); invalidate(["security-events"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const resetPw = useMutation({
    mutationFn: (id: string) => api.adminResetPassword(id),
    onSuccess: (d) => { setLastTemp(d.temporaryPassword); toast.success("Temporary password generated"); invalidate(["security-events"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const flagTest = useMutation({
    mutationFn: (v: { body: { userId?: string; clientId?: string; isTest: boolean } }) => api.flagTestData(v.body),
    onSuccess: () => { toast.success("Test flag updated"); invalidate(["team-admin", "clients-admin", "launch-checklist"]); },
    onError: (err: Error) => toast.error(err.message),
  });
  const purge = useMutation({
    mutationFn: () => api.purgeTestData(confirmText),
    onSuccess: (d) => {
      toast.success("Test data purged");
      const parts = Object.entries(d.deleted).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(", ");
      toast.success(parts || "Nothing to delete", { description: "Only is_test records were touched", duration: 8000 });
      setConfirmText("");
      invalidate(["team-admin", "clients-admin", "system-health"]);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const setFlag = useMutation({
    mutationFn: (v: { key: string; value: boolean }) => api.setLaunchFlag(v.key, v.value),
    onSuccess: () => invalidate(["launch-checklist"]),
    onError: (err: Error) => toast.error(err.message),
  });

  if (health.isLoading || checklist.isLoading) return <Spinner />;
  if (health.isError) return <Empty>{(health.error as Error).message}</Empty>;
  const h = health.data;
  const grouped = new Map<string, LaunchChecklistResponse["items"]>();
  for (const item of checklist.data?.items ?? []) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  return (
    <div className="space-y-6">
      <Panel title="System health" eyebrow="No secrets — status only">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Backend" value={h.backend.status} sub={h.backend.service} />
          <Stat label="Email" value={h.providers.email} />
          <Stat label="SMS" value={h.providers.sms} />
          <Stat label="Calendar" value={h.providers.calendar} />
          <Stat label="Storage mode" value={h.providers.storage} sub="Pilot — pending production review" />
          <Stat label="Failed deliveries" value={h.deliveries.failed} />
          <Stat label="Not-configured" value={h.deliveries.notConfigured} sub="Email/SMS awaiting provider" />
          <Stat label="Stale tasks" value={h.automation.staleTasks.length} sub="Overdue automation" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {Object.entries(h.db).map(([k, v]) => (
            <div key={k} className="rounded-sm border border-border bg-background px-2 py-1.5 text-navy">{k}: <span className="font-medium">{v}</span></div>
          ))}
        </div>
        {h.automation.staleTasks.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {h.automation.staleTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                <span>{t.title}</span>
                <span>due {fmtDateTime(t.due_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="mt-4 space-y-1 text-[11px] text-muted-foreground">
          {h.notes.map((n) => <li key={n}>• {n}</li>)}
        </ul>
      </Panel>

      <Panel title="Backup & exports" eyebrow="Structured export — secrets never included">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => downloadBackup.mutate()} disabled={downloadBackup.isPending} className="bg-navy text-ivory hover:bg-navy/90">
            <Download className="mr-2 h-4 w-4" /> Download full backup (JSON)
          </Button>
          {backup.data?.lastBackup ? (
            <p className="text-xs text-muted-foreground">Last backup: {fmtDateTime(backup.data.lastBackup.at)} · {backup.data.lastBackup.record_count} records</p>
          ) : (
            <p className="text-xs text-amber-700">No backup taken yet.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{backup.data?.note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["clients", "leads", "policies", "commissions", "renewals", "referrals", "tickets", "compliance"].map((ds) => (
            <Button key={ds} size="sm" variant="outline" onClick={() => downloadExport.mutate(ds)} disabled={downloadExport.isPending}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> {ds}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title="Victora launch readiness" eyebrow={`${checklist.data?.summary.complete ?? 0} / ${checklist.data?.summary.total ?? 0} complete`}>
        <p className={cn("mb-4 rounded-md border p-3 text-xs font-medium", checklist.data?.summary.ready ? "border-green-300 bg-green-50 text-green-800" : "border-amber-300 bg-amber-50 text-amber-900")}>
          {checklist.data?.summary.note}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {[...grouped.entries()].map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{category}</p>
              <ul className="mt-2 space-y-1.5">
                {items.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <div className="flex items-center gap-2">
                      {item.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <XCircle className="h-4 w-4 text-muted-foreground/50" />}
                      <div>
                        <p className="text-xs text-navy">{item.label}</p>
                        {item.detail ? <p className="text-[10px] text-muted-foreground">{item.detail}</p> : null}
                      </div>
                    </div>
                    {item.how === "manual" ? (
                      <Checkbox
                        checked={item.status === "complete"}
                        onCheckedChange={(v) => setFlag.mutate({ key: item.key, value: v === true })}
                        aria-label={`Toggle ${item.label}`}
                      />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">auto</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Security center" eyebrow={`${security.data?.activeSessions ?? 0} active sessions`}>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {(security.data?.events ?? []).slice(0, 50).map((e) => (
            <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs">
              <span className="text-navy">{e.action}</span>
              <span className="text-[10px] text-muted-foreground">{e.actor_role} · {e.detail || e.target} · {fmtDateTime(e.at)}</span>
            </div>
          ))}
          {(security.data?.events ?? []).length === 0 ? <Empty>No security events recorded yet.</Empty> : null}
        </div>
      </Panel>

      <Panel title="Incident-response runbook" eyebrow="Containment first — every action is audit-logged">
        <div className="space-y-2">
          {INCIDENT_RUNBOOK.map((r) => (
            <details key={r.scenario} className="rounded-md border border-border bg-background px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-navy">{r.scenario}</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-muted-foreground">
                {r.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </details>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Escalation owner: founder / super admin. Preserve the audit trail — never delete records during an incident.
          Regulatory notification timelines are NOT stated here: they must be confirmed with qualified counsel for the actual
          jurisdiction and product before any real incident. When the plan is reviewed and approved, tick
          "Incident-response plan documented" in the readiness checklist.
        </p>
      </Panel>

      <Panel title="Staff access" eyebrow="Deactivation takes effect immediately">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground"><th className="pb-2">Member</th><th className="pb-2">Role</th><th className="pb-2">Status</th><th className="pb-2">Actions</th></tr></thead>
            <tbody>
              {(team.data?.team ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border/60 text-navy">
                  <td className="py-2">{t.name}<span className="block text-[11px] text-muted-foreground">{t.email}</span></td>
                  <td className="py-2 text-xs capitalize">{t.role.replace("_", " ")}</td>
                  <td className="py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", (t.active ?? 1) === 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800")}>
                      {(t.active ?? 1) === 0 ? "deactivated" : "active"}
                    </span>
                    {t.is_test ? <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">test</span> : null}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(t.active ?? 1) === 0 ? (
                        <Button size="sm" variant="outline" onClick={() => activate.mutate(t.id)}>Reactivate</Button>
                      ) : confirmUser === t.id ? (
                        <>
                          <Input className="h-8 w-36 text-xs" placeholder="Type CONFIRM" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                          <Button size="sm" variant="destructive" onClick={() => deactivate.mutate(t.id)} disabled={confirmText.trim().length < 3}>Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setConfirmUser(null); setConfirmText(""); }}>Cancel</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setConfirmUser(t.id); setConfirmText(""); }}><Lock className="mr-1 h-3 w-3" /> Deactivate</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => revoke.mutate(t.id)}><RefreshCcw className="mr-1 h-3 w-3" /> Revoke sessions</Button>
                      <Button size="sm" variant="ghost" onClick={() => resetPw.mutate(t.id)}><KeyRound className="mr-1 h-3 w-3" /> Reset password</Button>
                      <Button size="sm" variant="ghost" onClick={() => flagTest.mutate({ body: { userId: t.id, isTest: !t.is_test } })}>
                        <Trash2 className="mr-1 h-3 w-3" /> {t.is_test ? "Unflag test" : "Flag test"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lastTemp ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Temporary password (shown once — share securely): <span className="font-mono font-bold">{lastTemp}</span>
          </p>
        ) : null}
      </Panel>

      <Panel title="Test data" eyebrow="Isolation & purge">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Test clients are excluded from analytics, exports, and the launch checklist. Purging deletes ONLY records flagged <span className="font-mono">is_test</span> — real data is never touched.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground"><th className="pb-2">Client</th><th className="pb-2">VIC ID</th><th className="pb-2">Flag</th><th className="pb-2"></th></tr></thead>
            <tbody>
              {(clients.data?.clients ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border/60 text-navy">
                  <td className="py-2">{c.first_name} {c.last_name}<span className="block text-[11px] text-muted-foreground">{c.email}</span></td>
                  <td className="py-2 text-xs">{c.id}</td>
                  <td className="py-2">{c.is_test ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">TEST</span> : <span className="text-[10px] text-muted-foreground">production</span>}</td>
                  <td className="py-2">
                    <Button size="sm" variant="ghost" onClick={() => flagTest.mutate({ body: { clientId: c.id, isTest: !c.is_test } })}>
                      {c.is_test ? "Mark production" : "Mark test"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-900">Purge test data</p>
          <p className="mt-1 text-[11px] text-red-800">Type <span className="font-mono font-bold">PURGE TEST DATA</span> to confirm. This permanently deletes flagged test records only.</p>
          <div className="mt-2 flex gap-2">
            <Input className="h-9 max-w-56 text-xs" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PURGE TEST DATA" />
            <Button size="sm" variant="destructive" onClick={() => purge.mutate()} disabled={confirmText !== "PURGE TEST DATA" || purge.isPending}>
              {purge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Purge"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
