/**
 * Victora Staff Console — the internal agency workspace backed by VictoraDB.
 * Access control is enforced by the API per role: agent, manager, compliance,
 * super_admin. This UI only renders what the server authorizes for the viewer.
 */
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  LifeBuoy,
  LineChart,
  Loader2,
  LogOut,
  MessagesSquare,
  RefreshCcw,
  Scale,
  ScrollText,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import Layout from "@/components/layout/Layout";
import ManagementSuite from "@/pages/Management";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type ClientListItem,
  type ClientRecord,
  type LeadRow,
  type MessageRow,
  type QuoteOptionRow,
  type ReferralRow,
  type RenewalRow,
  type Role,
  type StaffConversationRow,
  type StaffOverview,
  type TaskRow,
  type TicketCommentRow,
  type TicketRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type TabId = "today" | "pipeline" | "clients" | "inbox" | "service" | "renewals" | "referrals" | "appointments" | "tasks" | "team" | "audit" | "management";

const LEAD_STAGES: { id: string; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "intake", label: "Intake" },
  { id: "documents", label: "Documents" },
  { id: "quoting", label: "Quoting" },
  { id: "client_review", label: "Client Review" },
  { id: "enrollment", label: "Enrollment" },
  { id: "active", label: "Active" },
  { id: "lost", label: "Lost / Closed" },
];

const JOURNEY_STAGES: { id: string; label: string }[] = [
  { id: "info_received", label: "Info Received" },
  { id: "agent_review", label: "Agent Review" },
  { id: "options_prepared", label: "Options Prepared" },
  { id: "client_review", label: "Client Review" },
  { id: "enrollment", label: "Enrollment" },
  { id: "active", label: "Coverage Active" },
];

const ROLE_OPTIONS: Role[] = ["client", "agent", "manager", "compliance", "super_admin"];

type SectionId =
  | "overview"
  | "household"
  | "intake"
  | "coverage"
  | "quotes"
  | "documents"
  | "authorizations"
  | "messages"
  | "service"
  | "appointments"
  | "renewals"
  | "referrals"
  | "tasks"
  | "timeline"
  | "audit";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "household", label: "Household" },
  { id: "intake", label: "Intake" },
  { id: "coverage", label: "Coverage" },
  { id: "quotes", label: "Quotes" },
  { id: "documents", label: "Documents" },
  { id: "authorizations", label: "Authorizations" },
  { id: "messages", label: "Messages" },
  { id: "service", label: "Service" },
  { id: "appointments", label: "Appointments" },
  { id: "renewals", label: "Renewals" },
  { id: "referrals", label: "Referrals" },
  { id: "tasks", label: "Tasks" },
  { id: "timeline", label: "Timeline" },
  { id: "audit", label: "Audit" },
];

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Parses "2026-09-15" + "1:00 PM" into a real timestamp (12h strings fail Date parsing). */
function apptTime(date: string, time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (!m) return new Date(`${date}T${time}`).getTime();
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return new Date(`${date}T${String(h).padStart(2, "0")}:${m[2]}:00`).getTime();
}

function ageLabel(ms: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function daysUntil(date: string): number | null {
  const t = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
}

export default function Console() {
  const { user, isLoading, isStaff, logout } = useAuth();
  const [tab, setTab] = useState<TabId>("today");

  if (isLoading) {
    return (
      <Layout>
        <section className="navy-canvas flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-gold" />
        </section>
      </Layout>
    );
  }

  if (user === null || !isStaff) {
    return (
      <Layout>
        {user !== null ? (
          <section className="navy-canvas relative overflow-hidden">
            <div className="grid-veil absolute inset-0" aria-hidden />
            <div className="container relative flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
              <ShieldCheck className="h-8 w-8 text-gold" />
              <h1 className="display mt-6 text-2xl text-ivory">Staff access required</h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-ivory/60">
                The staff console is limited to Victora team members. Your account is a client account.
              </p>
              <div className="mt-7 flex gap-3">
                <Button asChild className="bg-gold text-navy-deep hover:bg-gold-light">
                  <Link to="/client">Go to My Victora</Link>
                </Button>
                <Button variant="outline" onClick={() => void logout()} className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
                  Sign out
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <StaffAuthPanel />
        )}
      </Layout>
    );
  }

  const managerPlus = user.role === "manager" || user.role === "compliance" || user.role === "super_admin";
  const compliancePlus = user.role === "compliance" || user.role === "super_admin";

  return (
    <Layout>
      <section className="navy-canvas relative overflow-hidden">
        <div className="grid-veil absolute inset-0" aria-hidden />
        <div className="container relative py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-gold">Victora Staff Console</p>
              <h1 className="display mt-3 text-3xl text-ivory md:text-[2.4rem]">
                What needs my attention today?
              </h1>
              <p className="mt-2 text-sm capitalize text-ivory/50">
                {user.name} · {user.role.replace("_", " ")}
              </p>
            </div>
            <Button variant="outline" onClick={() => void logout()} className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
              <LogOut className="mr-2 h-4 w-4 text-gold" />
              Sign out
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {(
              [
                { id: "today", label: "Today", icon: BarChart3 },
                { id: "pipeline", label: "My Pipeline", icon: Users },
                { id: "clients", label: "Clients", icon: UserCheck },
                { id: "inbox", label: "Inbox", icon: MessagesSquare },
                { id: "service", label: "Service", icon: LifeBuoy },
                { id: "renewals", label: "Renewals", icon: RefreshCcw },
                { id: "referrals", label: "Referrals", icon: UserPlus },
                { id: "appointments", label: "Appointments", icon: CalendarClock },
                { id: "tasks", label: "Tasks", icon: ClipboardList },
                ...(managerPlus ? [{ id: "management" as TabId, label: "Management", icon: LineChart }] : []),
                ...(managerPlus ? [{ id: "team" as TabId, label: "Team", icon: Users }] : []),
                ...(compliancePlus ? [{ id: "audit" as TabId, label: "Audit", icon: ScrollText }] : []),
              ] as { id: TabId; label: string; icon: typeof BarChart3 }[]
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-all active:scale-[0.97]",
                    tab === t.id ? "border-gold bg-gold/15 text-ivory" : "border-ivory/20 text-ivory/60 hover:border-gold/50 hover:text-ivory",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="container py-10">
        {tab === "today" ? <TodayView /> : null}
        {tab === "pipeline" ? <PipelineView managerPlus={managerPlus} /> : null}
        {tab === "clients" ? <ClientsView managerPlus={managerPlus} /> : null}
        {tab === "inbox" ? <InboxView /> : null}
        {tab === "service" ? <ServiceView managerPlus={managerPlus} /> : null}
        {tab === "renewals" ? <RenewalsQueueView /> : null}
        {tab === "referrals" ? <ReferralsQueueView /> : null}
        {tab === "appointments" ? <AppointmentsView /> : null}
        {tab === "tasks" ? <TasksView /> : null}
        {tab === "management" && managerPlus ? <ManagementSuite /> : null}
        {tab === "team" && managerPlus ? <TeamView isSuperAdmin={user.role === "super_admin"} /> : null}
        {tab === "audit" && compliancePlus ? <AuditView /> : null}
      </div>
    </Layout>
  );
}

/* ------------------------------- staff auth -------------------------------- */

function StaffAuthPanel() {
  const { login, registerStaff } = useAuth();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [role, setRole] = useState<string>("agent");
  const [busy, setBusy] = useState<boolean>(false);

  const submit = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(email.trim().toLowerCase(), password);
      } else {
        await registerStaff({ name: name.trim(), email: email.trim().toLowerCase(), password, code: code.trim(), role });
        toast.success("Staff account created");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [code, email, login, mode, name, password, registerStaff, role]);

  return (
    <section className="navy-canvas relative overflow-hidden">
      <div className="grid-veil absolute inset-0" aria-hidden />
      <div className="container relative flex min-h-[80vh] items-center justify-center py-20">
        <div className="w-full max-w-md rounded-lg border border-ivory/12 bg-ivory/[0.04] p-8 backdrop-blur-sm">
          <div className="text-center">
            <Scale className="mx-auto h-8 w-8 text-gold" />
            <h1 className="display mt-6 text-3xl text-ivory">Staff Console</h1>
            <p className="mt-3 text-sm leading-relaxed text-ivory/60">
              Agency operations — secured with real authentication and role-based permissions.
            </p>
          </div>

          <div className="mt-7 flex rounded-md border border-ivory/15 p-1">
            {(["signin", "create"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-sm py-2 text-xs uppercase tracking-[0.12em] transition-colors",
                  mode === m ? "bg-gold text-navy-deep" : "text-ivory/60 hover:text-ivory",
                )}
              >
                {m === "signin" ? "Sign in" : "Create staff account"}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4 text-left">
            {mode === "create" ? (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Full name</Label>
                  <Input className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30" value={name} placeholder="John Smith" onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Role</Label>
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-ivory/20 bg-navy-deep/60 px-3 text-sm text-ivory"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="compliance">Compliance</option>
                  </select>
                  <p className="mt-1.5 text-[0.65rem] text-ivory/40">The first staff account becomes Super Admin automatically.</p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Staff invite code</Label>
                  <Input className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30" type="password" value={code} placeholder="Provided by your administrator" onChange={(e) => setCode(e.target.value)} />
                </div>
              </>
            ) : null}
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Email</Label>
              <Input className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30" type="email" value={email} placeholder="you@victora.com" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Password</Label>
              <Input
                className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </div>
          </div>

          <Button className="mt-6 w-full bg-gold text-navy-deep hover:bg-gold-light" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <p className="mt-5 text-center text-[0.68rem] leading-relaxed text-ivory/40">
            First-time setup: create the first staff account with the founder invite code to bootstrap the Super Admin.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- today ----------------------------------- */

function TodayView() {
  const queryClient = useQueryClient();
  const overview = useQuery<StaffOverview>({ queryKey: ["staff-overview"], queryFn: api.staffOverview });
  const tasks = useQuery<{ tasks: TaskRow[] }>({ queryKey: ["tasks"], queryFn: api.tasks });

  const complete = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (overview.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }
  if (overview.isError || overview.data === undefined) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">Couldn't load today's numbers. Refresh and try again.</p>;
  }

  const t = overview.data.today;
  const openTasks = (tasks.data?.tasks ?? []).filter((x) => x.done === 0).slice(0, 6);

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "New leads", value: t.newLeads, tone: t.newLeads > 0 },
          { label: "Intakes to review", value: t.intakesToReview, tone: t.intakesToReview > 0 },
          { label: "Clients waiting on options", value: t.clientsWaiting, tone: t.clientsWaiting > 0 },
          { label: "Unassigned leads", value: t.unassignedLeads, tone: t.unassignedLeads > 0 },
          { label: "Upcoming appointments", value: t.upcomingAppointments, tone: false },
          { label: "Open tasks", value: t.openTasks, tone: t.openTasks > 0 },
          { label: "Documents to review", value: t.documentsToReview, tone: t.documentsToReview > 0 },
          { label: "Authorizations pending", value: t.authorizationsPending, tone: t.authorizationsPending > 0 },
          { label: "Quotes awaiting view", value: t.quotesAwaitingView, tone: t.quotesAwaitingView > 0 },
          { label: "Quote interest received", value: t.quotesInterested, tone: t.quotesInterested > 0 },
          { label: "Active clients", value: t.activeClients, tone: false },
          { label: "Total client records", value: t.totalClients, tone: false },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-lg border bg-card p-5", s.tone ? "border-gold/50" : "border-border")}>
            <p className="display text-3xl text-navy">{s.value}</p>
            <p className="mt-1 text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-gold">Top open tasks</p>
          <Button asChild variant="ghost" size="sm" className="text-navy/70 hover:text-navy">
            <Link to="/admin">All tasks →</Link>
          </Button>
        </div>
        {openTasks.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing open — nice work.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {openTasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-navy">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{task.detail}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 border-emerald-600/40 text-emerald-800 hover:bg-emerald-600/10" onClick={() => complete.mutate(task.id)}>
                  Done
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- pipeline --------------------------------- */

function PipelineView({ managerPlus }: { managerPlus: boolean }) {
  const queryClient = useQueryClient();
  const leads = useQuery<{ leads: LeadRow[] }>({ queryKey: ["leads"], queryFn: () => api.leads() });
  const team = useQuery<{ team: { id: string; name: string }[] }>({ queryKey: ["team"], queryFn: api.team, enabled: managerPlus });

  const setStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.setLeadStage(id, stage),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const assign = useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string }) => api.assignLead(id, agentId),
    onSuccess: () => {
      toast.success("Lead assigned");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (leads.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const byStage = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    for (const stage of LEAD_STAGES) map.set(stage.id, []);
    for (const lead of leads.data?.leads ?? []) map.get(lead.stage)?.push(lead);
    return map;
  }, [leads.data]);

  return (
    <div className="space-y-8">
      {LEAD_STAGES.map((stage) => {
        const items = byStage.get(stage.id) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={stage.id}>
            <div className="flex items-center gap-3">
              <h2 className="display text-xl text-navy">{stage.label}</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{items.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {items.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="display text-lg text-navy">{lead.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lead.email}
                        {lead.phone ? ` · ${lead.phone}` : ""} · {lead.coverage_type || "coverage unspecified"}
                      </p>
                      <p className="mt-1 text-xs text-navy/70">
                        Source: <strong>{lead.source}</strong>
                        {lead.campaign ? ` · Campaign: ${lead.campaign}` : ""}
                      </p>
                      {lead.details ? <p className="mt-2 max-w-xl text-xs leading-relaxed text-navy/70">{lead.details}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="text-[0.65rem] text-muted-foreground">{fmtDateTime(lead.created_at)}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {LEAD_STAGES.filter((s) => s.id !== lead.stage).slice(0, 9).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStage.mutate({ id: lead.id, stage: s.id })}
                            className="rounded-full border border-border px-2.5 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:border-gold hover:text-navy"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      {managerPlus ? (
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
                          value=""
                          onChange={(e) => {
                            if (e.target.value.length > 0) assign.mutate({ id: lead.id, agentId: e.target.value });
                          }}
                        >
                          <option value="">Assign to…</option>
                          {(team.data?.team ?? []).filter((m) => m.id !== lead.assigned_agent).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {(leads.data?.leads.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No leads yet — website quote requests, contact forms, and bookings land here automatically.
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------- clients --------------------------------- */

function ClientsView({ managerPlus }: { managerPlus: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clients = useQuery<{ clients: ClientListItem[] }>({ queryKey: ["clients"], queryFn: api.clients });
  const team = useQuery<{ team: { id: string; name: string; role: string }[] }>({
    queryKey: ["team"],
    queryFn: api.team,
    enabled: managerPlus,
  });

  if (clients.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3">
        <p className="eyebrow text-navy/60">Master client records ({clients.data?.clients.length ?? 0})</p>
        {(clients.data?.clients ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={cn(
              "w-full rounded-lg border bg-card p-4 text-left transition-all duration-200 hover:border-gold/50",
              selectedId === c.id ? "border-gold ring-1 ring-gold/25" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-navy">
                  {c.first_name} {c.last_name}
                </p>
                <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                  {c.id} · {c.email}
                </p>
              </div>
              <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.1em] text-gold">
                {JOURNEY_STAGES.find((s) => s.id === c.journey_stage)?.label ?? c.journey_stage}
              </span>
            </div>
            <p className="mt-2 text-[0.68rem] text-muted-foreground">
              {c.agent_name ? `Agent: ${c.agent_name}` : "Unassigned"} · Source: {c.source}
            </p>
          </button>
        ))}
        {(clients.data?.clients.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No client records yet.
          </div>
        ) : null}
      </div>

      <div>
        {selectedId !== null ? <ClientRecordPanel clientId={selectedId} managerPlus={managerPlus} /> : (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Select a client to open their Victora 360 view — household, intake, leads, appointments, and full history in one place.
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRecordPanel({ clientId, managerPlus }: { clientId: string; managerPlus: boolean }) {
  const queryClient = useQueryClient();
  const record = useQuery<ClientRecord>({ queryKey: ["client", clientId], queryFn: () => api.clientRecord(clientId) });
  const team = useQuery<{ team: { id: string; name: string }[] }>({ queryKey: ["team"], queryFn: api.team, enabled: managerPlus });

  const invalidate = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
  }, [clientId, queryClient]);

  const setStage = useMutation({
    mutationFn: (stage: string) => api.setClientStage(clientId, stage),
    onSuccess: () => {
      invalidate();
      toast.success("Journey updated — the client sees this instantly");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assign = useMutation({
    mutationFn: (agentId: string) => api.assignClient(clientId, agentId),
    onSuccess: () => {
      invalidate();
      toast.success("Client assigned");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewIntake = useMutation({
    mutationFn: (intakeId: string) => api.reviewIntake(clientId, intakeId),
    onSuccess: () => {
      invalidate();
      toast.success("Intake marked reviewed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [section, setSection] = useState<SectionId>("overview");

  if (record.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  if (record.isError || record.data === undefined) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">Couldn't open this record. {record.error instanceof Error ? record.error.message : ""}</p>;
  }

  const d = record.data;
  const p = d.profile;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-gold">Victora 360</p>
            <h2 className="display mt-2 text-2xl text-navy">
              {p.first_name} {p.last_name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.id} · {p.email}
              {p.phone ? ` · ${p.phone}` : ""}
            </p>
            <p className="mt-1 text-xs text-navy/70">
              Source: <strong>{p.source}</strong>
              {p.campaign ? ` · Campaign: ${p.campaign}` : ""} · Client since {fmtDateTime(p.created_at)}
            </p>
          </div>
          {managerPlus ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-navy"
              value={p.agent_id ?? ""}
              onChange={(e) => {
                if (e.target.value.length > 0) assign.mutate(e.target.value);
              }}
            >
              <option value="">{p.agent_name ? `Agent: ${p.agent_name}` : "Unassigned — assign…"}</option>
              {(team.data?.team ?? []).filter((m) => m.id !== p.agent_id).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">{p.agent_name ? `Agent: ${p.agent_name}` : "Unassigned"}</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          {JOURNEY_STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage.mutate(s.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-all active:scale-[0.97]",
                p.journey_stage === s.id ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Persistent internal-note composer — staff only, never exposed to clients */}
      <InternalNotesBar clientId={clientId} notes={d.internalNotes} invalidate={invalidate} />

      {/* Victora 360 sections */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.filter((s) => s.id !== "audit" || managerPlus).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-all active:scale-[0.97]",
              section === s.id ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "overview" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow text-navy/60">Leads</p>
            {d.leads.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No leads attached.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs text-navy/85">
                {d.leads.map((l) => (
                  <li key={l.id}>
                    {l.source}
                    {l.campaign ? ` (${l.campaign})` : ""} · {l.coverage_type || "unspecified"} · {l.stage}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow text-navy/60">Records snapshot</p>
            <ul className="mt-3 space-y-1.5 text-xs text-navy/85">
              <li>{d.documentRequests.filter((r) => r.status === "open").length} open document request(s)</li>
              <li>{d.documents.length} document(s) on file</li>
              <li>{d.authorizations.filter((a) => a.status === "pending").length} authorization(s) awaiting signature</li>
              <li>{d.quotes.filter((q) => q.status !== "draft" && q.status !== "archived").length} active quote presentation(s)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow text-navy/60">Client</p>
            <ul className="mt-3 space-y-1.5 text-xs text-navy/85">
              <li>
                VIC ID: <strong>{p.id}</strong>
              </li>
              <li>
                Relationship: <span className="capitalize">{(d.relationshipStatus ?? p.relationship_status ?? "prospect").replace("_", " ")}</span>
              </li>
              <li>Agent: {p.agent_name ?? "Unassigned"}</li>
              <li>Preferred language: {p.preferred_language ?? "English"}</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow text-navy/60">Coverage</p>
            {(d.policies ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No coverage records yet — add one in the Coverage tab once enrollment is verified.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-xs text-navy/85">
                {(["Health", "Dental", "Vision"] as const).map((t) => {
                  const all = (d.policies ?? []).filter((pol) => pol.product_type === t);
                  const active = all.find((pol) => pol.status === "active");
                  return (
                    <li key={t}>
                      {t}: {active ? `${active.carrier} ${active.plan_name} — active ✓` : all.length > 0 ? `${all.length} record(s), none active` : "none on file"}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow text-navy/60">Open actions</p>
            {(() => {
              const openDocs = d.documentRequests.filter((r) => r.status === "open").length;
              const pendingAuths = d.authorizations.filter((a) => a.status === "pending").length;
              const quotesWaiting = d.quotes.filter((q) => q.status === "sent" || q.status === "viewed").length;
              const unreadMsgs = (d.conversations ?? []).reduce((n, c) => n + c.unread_client, 0);
              const openTkts = (d.tickets ?? []).filter((t) => !["resolved", "closed"].includes(t.status)).length;
              const nextRenewal = (d.renewals ?? [])
                .filter((r) => !["completed", "not_renewed", "lost"].includes(r.status))
                .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date))[0];
              const items = [
                openDocs > 0 ? `${openDocs} outstanding document request(s)` : null,
                pendingAuths > 0 ? `${pendingAuths} authorization(s) awaiting signature` : null,
                quotesWaiting > 0 ? `${quotesWaiting} quote presentation(s) awaiting client review` : null,
                unreadMsgs > 0 ? `${unreadMsgs} unread client message(s)` : null,
                openTkts > 0 ? `${openTkts} open service ticket(s)` : null,
                nextRenewal ? `Next renewal ${nextRenewal.renewal_date} (${nextRenewal.status.replace("_", " ")})` : null,
              ].filter((x): x is string => x !== null);
              return items.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">Nothing open — this client is fully caught up.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-xs text-navy/85">
                  {items.map((x) => (
                    <li key={x}>• {x}</li>
                  ))}
                </ul>
              );
            })()}
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="eyebrow text-navy/60">Next appointment</p>
            {(() => {
              const upcoming = d.appointments
                .filter((a) => apptTime(a.date, a.time) > Date.now())
                .sort((a, b) => apptTime(a.date, a.time) - apptTime(b.date, b.time))[0];
              return upcoming ? (
                <p className="mt-3 text-xs text-navy/85">
                  {upcoming.date} at {upcoming.time} · {upcoming.topic || "General"} · <span className="capitalize">{upcoming.channel}</span>
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No upcoming appointment booked.</p>
              );
            })()}
          </div>
        </div>
      ) : null}

      {section === "household" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-navy/60">Household</p>
          {d.members.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No members recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs text-navy/85">
              {d.members.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.dob ? ` · ${m.dob}` : ""}
                  {m.relationship ? ` · ${m.relationship}` : ""}
                  {m.tobacco === 1 ? " · tobacco" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {section === "intake" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-navy/60">Intakes</p>
          {d.intakes.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No intakes submitted.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {d.intakes.map((i) => {
                const payload = (JSON.parse(i.payload || "{}") as { notes?: string; needs?: string[]; doctors?: string; medications?: string });
                return (
                  <li key={i.id} className="rounded-md border border-border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize text-navy">{i.area}</span>
                      {i.status === "new" ? (
                        <Button size="sm" variant="outline" className="h-6 border-emerald-600/40 px-2 text-[0.65rem] text-emerald-800" onClick={() => reviewIntake.mutate(i.id)}>
                          Mark reviewed
                        </Button>
                      ) : (
                        <span className="text-[0.65rem] text-emerald-700">Reviewed ✓</span>
                      )}
                    </div>
                    <p className="mt-2 text-muted-foreground">{fmtDateTime(i.created_at)}</p>
                    {payload.needs && payload.needs.length > 0 ? <p className="mt-1 text-navy/80">Needs: {payload.needs.join(", ")}</p> : null}
                    {payload.doctors ? <p className="mt-1 text-navy/80">Doctors: {payload.doctors}</p> : null}
                    {payload.medications ? <p className="mt-1 text-navy/80">Meds: {payload.medications}</p> : null}
                    {payload.notes ? <p className="mt-1 text-navy/80">Notes: {payload.notes}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {section === "quotes" ? <QuotesSection record={d} invalidate={invalidate} /> : null}
      {section === "documents" ? <DocumentsSection record={d} invalidate={invalidate} /> : null}
      {section === "authorizations" ? <AuthorizationsSection record={d} invalidate={invalidate} /> : null}
      {section === "coverage" ? <CoverageSection record={d} invalidate={invalidate} /> : null}
      {section === "messages" ? <MessagesSection record={d} invalidate={invalidate} /> : null}
      {section === "service" ? <ServiceSection record={d} invalidate={invalidate} /> : null}
      {section === "renewals" ? <RenewalsSection record={d} invalidate={invalidate} /> : null}
      {section === "referrals" ? <ReferralsSection record={d} invalidate={invalidate} /> : null}
      {section === "tasks" ? <ClientTasksSection clientId={clientId} /> : null}

      {section === "appointments" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-navy/60">Appointments</p>
          {d.appointments.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No appointments booked.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs text-navy/85">
              {d.appointments.map((a) => (
                <li key={a.id}>
                  {a.date} at {a.time} · {a.topic || "General"} · <span className="capitalize">{a.channel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {section === "timeline" ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-gold">Client timeline</p>
          {d.timeline.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No timeline events yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {d.timeline.map((e) => (
                <li key={e.id} className="flex gap-3 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <div>
                    <p className="text-navy/85">{e.label}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {e.actor} · {fmtDateTime(e.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {section === "audit" && managerPlus ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-navy/60">Audit trail (this record)</p>
          {d.audit.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No audit entries visible for your role.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {d.audit.map((a, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  <span className="text-navy/80">{a.action}</span>
                  <span className="ml-auto text-muted-foreground">
                    {a.actor_role} · {fmtDateTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------- 360: documents section (staff) ---------------------- */

const DOC_CATEGORY_OPTIONS: string[] = ["Identity", "Income", "Household", "Coverage Loss", "Eligibility", "Enrollment", "Other"];

const DOC_STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  open: { label: "Needed", cls: "bg-red-500/10 text-red-700" },
  under_review: { label: "Under Review", cls: "bg-amber-400/15 text-amber-800" },
  uploaded: { label: "Uploaded", cls: "bg-amber-400/15 text-amber-800" },
  accepted: { label: "Accepted ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  replacement_required: { label: "Replacement Needed", cls: "bg-red-500/10 text-red-700" },
  rejected: { label: "Not Accepted", cls: "bg-red-500/10 text-red-700" },
};

function DocumentsSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const clientId = record.profile.id;
  const [category, setCategory] = useState<string>("Identity");
  const [docType, setDocType] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [required, setRequired] = useState<boolean>(true);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");

  const request = useMutation({
    mutationFn: () =>
      api.requestDocument(clientId, { category, documentType: docType.trim(), instructions: instructions.trim(), dueDate, required }),
    onSuccess: () => {
      toast.success("Document requested — the client sees it in My Victora");
      setDocType("");
      setInstructions("");
      setDueDate("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const review = useMutation({
    mutationFn: ({ docId, action }: { docId: string; action: string }) => api.reviewDocument(clientId, docId, action, note.trim()),
    onSuccess: () => {
      toast.success("Review saved — the client was notified");
      setNoteFor(null);
      setNote("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveFile = useMutation({
    mutationFn: (docId: string) => api.documentFile(docId),
    onSuccess: (blob: Blob, docId: string) => {
      const doc = record.documents.find((x) => x.id === docId);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc?.original_filename ?? "document";
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const chip = (status: string): { label: string; cls: string } => DOC_STATUS_CHIP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-gold">Request a document</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Category</Label>
            <select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-navy" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DOC_CATEGORY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Requested document</Label>
            <Input className="mt-2" value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="Proof of Coverage Loss" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Instructions for the client</Label>
            <Textarea className="mt-2" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Please upload documentation showing the date your employer-sponsored health coverage ended." />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Due date (optional)</Label>
            <Input className="mt-2" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <label className="flex items-end gap-2.5 pb-2 text-xs text-muted-foreground">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(v === true)} />
            <span>Required</span>
          </label>
        </div>
        <Button
          className="mt-4 bg-navy text-ivory hover:bg-navy-soft"
          disabled={request.isPending || docType.trim().length < 3}
          onClick={() => request.mutate()}
        >
          {request.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Request document
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-navy/60">Document requests</p>
        {record.documentRequests.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No document requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {record.documentRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium text-navy">{r.document_type}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {r.category}
                    {r.due_date ? ` · due ${r.due_date}` : ""}
                    {r.required === 1 ? " · required" : " · optional"}
                  </p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[0.65rem] font-medium", chip(r.status).cls)}>{chip(r.status).label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-navy/60">Documents on file</p>
        {record.documents.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {record.documents.map((doc) => (
              <li key={doc.id} className="rounded-md border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy">{doc.document_type}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {doc.original_filename} · {Math.max(1, Math.round(doc.size / 1024))} KB · uploaded {fmtDateTime(doc.uploaded_at)}
                    </p>
                    {doc.rejection_reason ? <p className="mt-1 text-red-700">{doc.rejection_reason}</p> : null}
                    {doc.review_note ? <p className="mt-1 text-emerald-800">Note: {doc.review_note}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-[0.65rem] font-medium", chip(doc.status).cls)}>{chip(doc.status).label}</span>
                    <Button size="sm" variant="outline" className="h-7 border-navy/20 px-2 text-[0.65rem] text-navy" disabled={saveFile.isPending} onClick={() => saveFile.mutate(doc.id)}>
                      File
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 border-emerald-600/40 px-2 text-[0.65rem] text-emerald-800" onClick={() => review.mutate({ docId: doc.id, action: "accept" })}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 border-amber-500/40 px-2 text-[0.65rem] text-amber-800" onClick={() => review.mutate({ docId: doc.id, action: "under_review" })}>
                      Reviewing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-red-500/40 px-2 text-[0.65rem] text-red-800"
                      onClick={() => setNoteFor(noteFor === doc.id ? null : doc.id)}
                    >
                      Replacement / Reject
                    </Button>
                  </div>
                </div>
                {noteFor === doc.id ? (
                  <div className="mt-3 space-y-2">
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell the client exactly what is wrong or missing…" />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 bg-navy px-3 text-[0.65rem] text-ivory"
                        disabled={note.trim().length < 3 || review.isPending}
                        onClick={() => review.mutate({ docId: doc.id, action: "replacement" })}
                      >
                        Request replacement
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-red-500/40 px-3 text-[0.65rem] text-red-800"
                        disabled={note.trim().length < 3 || review.isPending}
                        onClick={() => review.mutate({ docId: doc.id, action: "reject" })}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------ 360: authorizations section (staff) -------------------- */

function AuthorizationsSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const templates = useQuery({ queryKey: ["templates"], queryFn: api.templates });
  const [templateId, setTemplateId] = useState<string>("");
  const [newKey, setNewKey] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newBody, setNewBody] = useState<string>("");
  const [activate, setActivate] = useState<boolean>(false);

  const activeTemplates = (templates.data?.templates ?? []).filter((t) => t.active === 1);
  const canManageTemplates = user?.role === "compliance" || user?.role === "super_admin";

  const send = useMutation({
    mutationFn: () => api.sendAuthorization(record.profile.id, templateId),
    onSuccess: () => {
      toast.success("Authorization sent — the client can sign in My Victora");
      setTemplateId("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createVersion = useMutation({
    mutationFn: () => api.createTemplateVersion({ templateKey: newKey.trim(), name: newName.trim(), body: newBody, activate }),
    onSuccess: (data: { ok: boolean; version: number }) => {
      toast.success(`Template version ${data.version} created${activate ? " and activated" : " (inactive)"}`);
      setNewKey("");
      setNewName("");
      setNewBody("");
      setActivate(false);
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-gold">Send an authorization</p>
        {activeTemplates.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No active templates — compliance must activate one first.</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-navy" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose an active template…</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.version})
                </option>
              ))}
            </select>
            <Button className="bg-navy text-ivory hover:bg-navy-soft" disabled={templateId.length === 0 || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send to client
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-navy/60">Authorizations for this client</p>
        {record.authorizations.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {record.authorizations.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy">
                      {a.template_name} · v{a.template_version}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {a.status === "signed"
                        ? `Signed by ${a.signer_name} · ${a.signed_at ? fmtDateTime(a.signed_at) : ""} · ${a.method === "electronic_signature" ? "e-signature" : a.method}`
                        : `Sent ${fmtDateTime(a.created_at)} · awaiting signature`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[0.65rem] font-medium",
                      a.status === "signed" ? "bg-emerald-600/10 text-emerald-700" : a.status === "pending" ? "bg-amber-400/15 text-amber-800" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {a.status === "signed" ? "Signed ✓" : a.status === "pending" ? "Awaiting signature" : a.status}
                  </span>
                </div>
                {a.status === "signed" && a.signed_text ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[0.68rem] text-navy/70">View exact signed text</summary>
                    <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-[0.68rem] leading-relaxed text-navy/85">{a.signed_text}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManageTemplates ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-gold">New template version (compliance)</p>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
            Paste the exact approved language. Signed records always keep the version text the client agreed to — editing a template never changes history.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Template key</Label>
              <Input className="mt-2" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="communications_consent" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Display name</Label>
              <Input className="mt-2" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Communications Consent" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Full authorization text</Label>
              <Textarea className="mt-2" rows={6} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2.5 text-xs text-muted-foreground">
            <Checkbox checked={activate} onCheckedChange={(v) => setActivate(v === true)} />
            <span>Activate this version for sending (deactivates older versions of the same key)</span>
          </label>
          <Button
            className="mt-4 bg-navy text-ivory hover:bg-navy-soft"
            disabled={createVersion.isPending || newKey.trim().length < 2 || newName.trim().length < 2 || newBody.trim().length < 20}
            onClick={() => createVersion.mutate()}
          >
            {createVersion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create version
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------- 360: quote presentation section --------------------- */

const QUOTE_COMPARE_ROWS: { key: keyof QuoteOptionRow; label: string }[] = [
  { key: "carrier", label: "Carrier" },
  { key: "plan_name", label: "Plan" },
  { key: "metal_tier", label: "Metal tier" },
  { key: "premium", label: "Monthly premium" },
  { key: "deductible", label: "Deductible" },
  { key: "oop_max", label: "Out-of-pocket max" },
  { key: "pcp", label: "Primary care (PCP)" },
  { key: "specialist", label: "Specialist" },
  { key: "urgent_care", label: "Urgent care" },
  { key: "er", label: "Emergency room" },
  { key: "generic_rx", label: "Generic Rx" },
  { key: "network_type", label: "Network" },
  { key: "dental_note", label: "Dental" },
  { key: "vision_note", label: "Vision" },
  { key: "notes", label: "Notes" },
];

const emptyQuoteOption = (): Partial<QuoteOptionRow> => ({
  label: "",
  carrier: "",
  plan_name: "",
  metal_tier: "",
  premium: "",
  deductible: "",
  oop_max: "",
  pcp: "",
  specialist: "",
  urgent_care: "",
  er: "",
  generic_rx: "",
  network_type: "",
  dental_note: "",
  vision_note: "",
  notes: "",
  doc_link: "",
});

const QUOTE_STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  ready: { label: "Ready", cls: "bg-gold/15 text-navy" },
  sent: { label: "Sent", cls: "bg-amber-400/15 text-amber-800" },
  viewed: { label: "Viewed", cls: "bg-amber-400/15 text-amber-800" },
  client_interested: { label: "Interested ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  archived: { label: "Archived", cls: "bg-muted text-muted-foreground" },
};

function QuotesSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const clientId = record.profile.id;
  const [showBuilder, setShowBuilder] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [area, setArea] = useState<string>("Health");
  const [options, setOptions] = useState<Partial<QuoteOptionRow>[]>([emptyQuoteOption(), emptyQuoteOption(), emptyQuoteOption()]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["quote-detail", detailId],
    queryFn: () => api.quoteDetail(detailId as string),
    enabled: detailId !== null,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createQuote(clientId, {
        title: title.trim(),
        coverageArea: area,
        options: options.filter((o) => (o.plan_name ?? "").trim().length > 0),
      }),
    onSuccess: () => {
      toast.success("Quote presentation created as draft");
      setTitle("");
      setOptions([emptyQuoteOption(), emptyQuoteOption(), emptyQuoteOption()]);
      setShowBuilder(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.setQuoteStatus(id, status),
    onSuccess: () => {
      toast.success("Quote updated — the client was notified if sent");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchOption = (index: number, key: keyof QuoteOptionRow, value: string): void => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [key]: value } : o)));
  };

  const validOptions = options.filter((o) => (o.plan_name ?? "").trim().length > 0);
  const chip = (status: string): { label: string; cls: string } => QUOTE_STATUS_CHIP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-gold">Quote presentations</p>
          <Button size="sm" variant="outline" className="border-navy/20 text-navy" onClick={() => setShowBuilder((v) => !v)}>
            {showBuilder ? "Close builder" : "Create quote presentation"}
          </Button>
        </div>
        {record.quotes.length === 0 && !showBuilder ? (
          <p className="mt-3 text-xs text-muted-foreground">No presentations yet. Create one and send verified plan options to this client.</p>
        ) : null}
        {record.quotes.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {record.quotes.map((q) => (
              <li key={q.id} className="rounded-md border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy">{q.title}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {q.coverage_area || "Coverage"} · {q.options?.length ?? 0} option(s)
                      {q.sent_at ? ` · sent ${fmtDateTime(q.sent_at)}` : ""}
                      {q.viewed_at ? ` · viewed ${fmtDateTime(q.viewed_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-[0.65rem] font-medium", chip(q.status).cls)}>{chip(q.status).label}</span>
                    {q.status === "draft" ? (
                      <Button size="sm" variant="outline" className="h-7 border-navy/20 px-2 text-[0.65rem] text-navy" onClick={() => setStatus.mutate({ id: q.id, status: "ready" })}>
                        Mark ready
                      </Button>
                    ) : null}
                    {q.status === "ready" ? (
                      <Button size="sm" className="h-7 bg-gold px-2 text-[0.65rem] text-navy-deep hover:bg-gold-light" onClick={() => setStatus.mutate({ id: q.id, status: "sent" })}>
                        Send to client
                      </Button>
                    ) : null}
                    {q.status !== "archived" ? (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[0.65rem] text-navy/70" onClick={() => setStatus.mutate({ id: q.id, status: "archived" })}>
                        Archive
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="h-7 border-navy/20 px-2 text-[0.65rem] text-navy" onClick={() => setDetailId(detailId === q.id ? null : q.id)}>
                      Details
                    </Button>
                  </div>
                </div>
                {detailId === q.id && detail.data ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-[0.68rem] text-muted-foreground">
                      Interactions: {detail.data.interactions.map((i) => `${i.action}${i.option_id ? " (option)" : ""}`).join(", ") || "none yet"}
                    </p>
                    <ul className="mt-2 space-y-1 text-[0.68rem] text-navy/80">
                      {detail.data.options.map((o) => (
                        <li key={o.id}>
                          {o.label}: {o.carrier} {o.plan_name} — {o.premium || "premium n/a"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {showBuilder ? (
        <div className="rounded-lg border border-gold/40 bg-gold/[0.04] p-5">
          <p className="eyebrow text-gold">New presentation</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Title</Label>
              <Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2026 Health Options" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Coverage area</Label>
              <Input className="mt-2" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Health / Dental / Medicare…" />
            </div>
          </div>

          {options.map((o, i) => (
            <div key={i} className="mt-5 rounded-md border border-border bg-card p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.12em] text-gold">Option {String.fromCharCode(65 + i)}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["label", "Label"],
                    ["carrier", "Carrier"],
                    ["plan_name", "Plan name"],
                    ["metal_tier", "Metal / tier"],
                    ["premium", "Premium"],
                    ["deductible", "Deductible"],
                    ["oop_max", "OOP max"],
                    ["pcp", "PCP"],
                    ["specialist", "Specialist"],
                    ["urgent_care", "Urgent care"],
                    ["er", "ER"],
                    ["generic_rx", "Generic Rx"],
                    ["network_type", "Network"],
                    ["dental_note", "Dental note"],
                    ["vision_note", "Vision note"],
                    ["doc_link", "Official plan link"],
                  ] as [keyof QuoteOptionRow, string][]
                ).map(([key, label]) => (
                  <div key={String(key)}>
                    <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">{label}</Label>
                    <Input className="mt-1 h-8 text-xs" value={String(o[key] ?? "")} onChange={(e) => patchOption(i, key, e.target.value)} />
                  </div>
                ))}
                <div className="sm:col-span-3">
                  <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Notes shown to the client</Label>
                  <Textarea className="mt-1" rows={2} value={o.notes ?? ""} onChange={(e) => patchOption(i, "notes", e.target.value)} />
                </div>
              </div>
            </div>
          ))}

          {validOptions.length > 0 ? (
            <div className="mt-5">
              <p className="eyebrow text-navy/60">Preview — exactly what the client will see</p>
              <div className="mt-3 overflow-x-auto rounded-md border border-border bg-card p-4">
                <table className="w-full min-w-[480px] border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="w-32 border-b border-border pb-2 text-left text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">Compare</th>
                      {validOptions.map((o, i) => (
                        <th key={i} className="border-b border-border pb-2 pr-3 text-left text-[0.62rem] uppercase tracking-[0.1em] text-gold">
                          {o.label || `Option ${String.fromCharCode(65 + i)}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {QUOTE_COMPARE_ROWS.filter((r) => validOptions.some((o) => String(o[r.key] ?? "").trim().length > 0)).map((r) => (
                      <tr key={String(r.key)}>
                        <td className="border-b border-border/60 py-1.5 pr-3 text-muted-foreground">{r.label}</td>
                        {validOptions.map((o, i) => (
                          <td key={i} className="border-b border-border/60 py-1.5 pr-3 text-navy/85">
                            {String(o[r.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <Button
            className="mt-5 bg-navy text-ivory hover:bg-navy-soft"
            disabled={create.isPending || title.trim().length < 3 || validOptions.length === 0}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create presentation (draft)
          </Button>
          <p className="mt-2 text-[0.65rem] text-muted-foreground">
            Enter verified plan information from the carrier or quoting tool — Victora presents it; it does not calculate rates.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------- 360: per-client tasks ----------------------------- */

function ClientTasksSection({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });

  const complete = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = (tasks.data?.tasks ?? []).filter((t) => t.client_id === clientId);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow text-navy/60">Tasks for this client</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No open or completed tasks reference this client yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-xs">
              <div>
                <p className="font-medium text-navy">
                  {t.title}
                  {t.priority === "high" ? <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.6rem] text-red-700">High</span> : null}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {t.detail} · due {fmtDateTime(t.due_at)} · {t.done === 1 ? "done" : "open"}
                </p>
              </div>
              {t.done === 0 ? (
                <Button size="sm" variant="outline" className="h-7 shrink-0 border-emerald-600/40 px-2 text-[0.65rem] text-emerald-800" onClick={() => complete.mutate(t.id)}>
                  Done
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------- appointments ------------------------------- */

function AppointmentsView() {
  const appts = useQuery<{ appointments: { id: string; name: string; email: string; phone: string; date: string; time: string; topic: string; channel: string; notes: string; source?: string; created_at: number }[] }>({
    queryKey: ["appointments"],
    queryFn: api.appointments,
  });

  if (appts.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows = appts.data?.appointments ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((a) => (
        <div key={a.id} className="rounded-lg border border-border bg-card p-5">
          <p className="eyebrow text-gold">
            {new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {a.time}
          </p>
          <p className="display mt-3 text-lg text-navy">{a.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{a.topic || "General consultation"}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="capitalize">{a.channel}</span> · {a.phone || a.email}
            {a.source ? ` · Source: ${a.source}` : ""}
          </p>
          {a.notes ? <p className="mt-3 text-xs leading-relaxed text-navy/70">{a.notes}</p> : null}
        </div>
      ))}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No appointments booked yet.
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------- tasks ---------------------------------- */

function TasksView() {
  const queryClient = useQueryClient();
  const tasks = useQuery<{ tasks: TaskRow[] }>({ queryKey: ["tasks"], queryFn: api.tasks });

  const complete = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  if (tasks.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const all = tasks.data?.tasks ?? [];
  const open = all.filter((t) => t.done === 0);
  const done = all.filter((t) => t.done === 1);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="eyebrow text-navy/60">Open tasks ({open.length})</p>
        {open.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium text-navy">{t.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                {t.source === "automation" ? "Auto-generated" : "Manual"} · due {fmtDateTime(t.due_at)}
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-emerald-600/40 text-emerald-800 hover:bg-emerald-600/10" onClick={() => complete.mutate(t.id)}>
              Done
            </Button>
          </div>
        ))}
        {open.length === 0 ? <p className="text-sm text-muted-foreground">All caught up.</p> : null}
      </div>
      {done.length > 0 ? (
        <div className="space-y-3">
          <p className="eyebrow text-navy/60">Recently completed</p>
          {done.slice(0, 10).map((t) => (
            <div key={t.id} className="rounded-lg border border-border/60 bg-card/60 p-4 opacity-70">
              <p className="text-sm text-muted-foreground line-through">{t.title}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------- team ----------------------------------- */

function TeamView({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();
  const team = useQuery<{ team: { id: string; name: string; email: string; role: Role; created_at: number }[] }>({ queryKey: ["team"], queryFn: api.team });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.setUserRole(id, role),
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (team.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="space-y-3">
      <p className="eyebrow text-navy/60">Agency team ({team.data?.team.length ?? 0})</p>
      {(team.data?.team ?? []).map((m) => (
        <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-navy">{m.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {m.email} · joined {fmtDateTime(m.created_at)}
            </p>
          </div>
          {isSuperAdmin ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-xs capitalize text-navy"
              value={m.role}
              onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value as Role })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-full border border-border px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
              {m.role.replace("_", " ")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------- audit ---------------------------------- */

function AuditView() {
  const audit = useQuery<{ audit: { id: string; at: number; actor_role: string; action: string; target: string; detail: string }[] }>({
    queryKey: ["audit"],
    queryFn: api.audit,
  });

  if (audit.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-gold">Audit trail</p>
        <RefreshCcw className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Every authentication, submission, assignment, and permission-checked action across the agency — newest first.
      </p>
      <ul className="mt-5 max-h-[32rem] space-y-2 overflow-y-auto pr-2">
        {(audit.data?.audit ?? []).map((a) => (
          <li key={a.id} className="flex gap-3 text-xs">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <span className="text-navy/85">{a.action}</span>
            {a.detail ? <span className="text-muted-foreground">{a.detail}</span> : null}
            <span className="ml-auto shrink-0 text-muted-foreground">
              {a.actor_role} · {fmtDateTime(a.at)}
            </span>
          </li>
        ))}
      </ul>
      {(audit.data?.audit.length ?? 0) === 0 ? <p className="mt-4 text-sm text-muted-foreground">No events recorded yet.</p> : null}
    </div>
  );
}

/* ========================= Sprint 3: shared constants ======================= */

const POLICY_PRODUCT_OPTIONS = ["Health", "Dental", "Vision"];
const POLICY_STATUS_OPTIONS = ["pending", "active", "terminated", "expired", "cancelled", "unknown"];
const TICKET_STATUS_OPTIONS = ["new", "in_progress", "waiting_on_client", "waiting_external", "resolved", "closed"];
const RENEWAL_STATUS_OPTIONS = ["upcoming", "review_needed", "contacted", "waiting_client", "reviewing", "completed", "not_renewed", "lost"];
const REFERRAL_STATUS_OPTIONS = ["submitted", "contacted", "qualified", "converted", "closed"];

/* ===================== Sprint 3: internal notes (360) ====================== */

function InternalNotesBar({ clientId, notes, invalidate }: { clientId: string; notes: ClientRecord["internalNotes"]; invalidate: () => void }) {
  const [note, setNote] = useState<string>("");

  const add = useMutation({
    mutationFn: () => api.addInternalNote(clientId, note.trim()),
    onSuccess: () => {
      toast.success("Internal note saved — never visible to the client");
      setNote("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/[0.06] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-amber-800">Internal — Victora staff only</p>
        <p className="text-[0.62rem] text-amber-700/80">Never shown in My Victora · author-attributed · audit-logged</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal context for the team — call summaries, case notes, reminders…" />
        <Button className="shrink-0 bg-amber-700 text-ivory hover:bg-amber-800" disabled={note.trim().length < 2 || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add note"}
        </Button>
      </div>
      {(notes ?? []).length > 0 ? (
        <ul className="mt-3 space-y-2">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="rounded-md border border-amber-500/30 bg-card p-3 text-xs">
              <p className="text-navy/85">{n.body}</p>
              <p className="mt-1 text-[0.62rem] text-muted-foreground">
                {n.author_name} · {n.author_role.replace("_", " ")} · {fmtDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ======================== Sprint 3: coverage (360) ========================== */

type PolicyForm = {
  productType: string;
  carrier: string;
  planName: string;
  policyIdentifier: string;
  effectiveDate: string;
  status: string;
  monthlyPremium: string;
  deductible: string;
  outOfPocketMax: string;
  networkType: string;
  pcpCost: string;
  specialistCost: string;
  rxSummary: string;
  carrierPortalUrl: string;
  providerSearchUrl: string;
  carrierPhone: string;
};

const emptyPolicyForm = (): PolicyForm => ({
  productType: "Health",
  carrier: "",
  planName: "",
  policyIdentifier: "",
  effectiveDate: "",
  status: "active",
  monthlyPremium: "",
  deductible: "",
  outOfPocketMax: "",
  networkType: "",
  pcpCost: "",
  specialistCost: "",
  rxSummary: "",
  carrierPortalUrl: "",
  providerSearchUrl: "",
  carrierPhone: "",
});

function CoverageSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const [form, setForm] = useState<PolicyForm>(emptyPolicyForm());
  const set = (key: keyof PolicyForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const create = useMutation({
    mutationFn: () => api.createPolicy(record.profile.id, { ...form }),
    onSuccess: () => {
      toast.success("Coverage record added — the client sees it under My Coverage");
      setForm(emptyPolicyForm());
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) => api.updatePolicy(input.id, { status: input.status }),
    onSuccess: () => {
      toast.success("Coverage updated — the client was notified if it affects them");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const policies = record.policies ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gold/40 bg-gold/[0.04] p-5">
        <p className="eyebrow text-gold">Add a coverage record</p>
        <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
          Victora servicing record only — enter verified enrollment information from the carrier or Marketplace. Never mark a policy active from quote interest
          alone; active status requires a verified policy/member identifier.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Product</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-navy" value={form.productType} onChange={set("productType")}>
              {POLICY_PRODUCT_OPTIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Carrier</Label>
            <Input className="mt-1 h-9 text-xs" value={form.carrier} onChange={set("carrier")} placeholder="Carrier name" />
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Plan name</Label>
            <Input className="mt-1 h-9 text-xs" value={form.planName} onChange={set("planName")} placeholder="Silver PPO 2500" />
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Policy / member ID</Label>
            <Input className="mt-1 h-9 text-xs" value={form.policyIdentifier} onChange={set("policyIdentifier")} placeholder="Required for active status" />
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Effective date</Label>
            <Input className="mt-1 h-9 text-xs" type="date" value={form.effectiveDate} onChange={set("effectiveDate")} />
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Status</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-navy" value={form.status} onChange={set("status")}>
              {POLICY_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {([
            ["monthlyPremium", "Monthly premium"],
            ["deductible", "Deductible"],
            ["outOfPocketMax", "Out-of-pocket max"],
            ["networkType", "Network type"],
            ["pcpCost", "PCP cost"],
            ["specialistCost", "Specialist cost"],
            ["carrierPortalUrl", "Carrier portal URL"],
            ["providerSearchUrl", "Provider search URL"],
            ["carrierPhone", "Carrier phone"],
          ] as [keyof PolicyForm, string][]).map(([key, label]) => (
            <div key={String(key)}>
              <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">{label}</Label>
              <Input className="mt-1 h-9 text-xs" value={form[key]} onChange={set(key)} />
            </div>
          ))}
          <div className="sm:col-span-3">
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Rx summary</Label>
            <Input className="mt-1 h-9 text-xs" value={form.rxSummary} onChange={set("rxSummary")} placeholder="Generic $15 / preferred $40" />
          </div>
        </div>
        <Button
          className="mt-4 bg-navy text-ivory hover:bg-navy-soft"
          disabled={create.isPending || form.carrier.trim().length < 2 || form.planName.trim().length < 2 || form.effectiveDate.length === 0 || (form.status === "active" && form.policyIdentifier.trim().length === 0)}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add coverage record
        </Button>
        {form.status === "active" && form.policyIdentifier.trim().length === 0 ? (
          <p className="mt-2 text-[0.65rem] text-amber-800">Active status requires a verified policy/member identifier.</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-navy/60">Coverage records</p>
        {policies.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No coverage records yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {policies.map((pol) => (
              <li key={pol.id} className="rounded-md border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy">
                      {pol.product_type} — {pol.carrier} {pol.plan_name}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {pol.status} · effective {pol.effective_date || "—"}
                      {pol.termination_date ? ` · terminated ${pol.termination_date}` : ""} · {pol.monthly_premium || "premium n/a"}
                      {(pol.members ?? []).length > 0 ? ` · ${(pol.members ?? []).length} member(s)` : ""}
                    </p>
                  </div>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
                    value={pol.status}
                    onChange={(e) => setStatus.mutate({ id: pol.id, status: e.target.value })}
                  >
                    {POLICY_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ======================== Sprint 3: messages (360) ========================== */

function MessagesSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState<string>("");
  const conv = useQuery({
    queryKey: ["conversation-staff", openId],
    queryFn: () => api.conversationDetail(openId as string),
    enabled: openId !== null,
  });

  const send = useMutation({
    mutationFn: () => api.staffReply(openId as string, reply.trim()),
    onSuccess: () => {
      setReply("");
      void conv.refetch();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const conversations = record.conversations ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow text-gold">Secure messages with this client</p>
      {conversations.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No conversation yet — it opens the moment you or the client send the first message.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {conversations.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3">
              <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                <div>
                  <p className="text-xs font-medium text-navy">{c.subject}</p>
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    {c.message_count} message(s) · last activity {c.last_message_at ? fmtDateTime(c.last_message_at) : "—"}
                  </p>
                </div>
                {c.unread_client > 0 ? <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[0.62rem] text-navy">{c.unread_client} unread</span> : null}
              </button>
              {openId === c.id ? (
                <div className="mt-3 border-t border-border pt-3">
                  {conv.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-gold" /> : null}
                  {(conv.data?.messages ?? []).map((m: MessageRow) => (
                    <div
                      key={m.id}
                      className={cn(
                        "mb-2 max-w-[85%] rounded-md px-3 py-2 text-xs",
                        m.sender_role === "client" ? "border border-border bg-background text-navy" : "bg-navy text-ivory",
                      )}
                    >
                      <p className="text-[0.6rem] uppercase tracking-[0.08em] opacity-70">
                        {m.sender_role === "client" ? "Client" : "Staff"} · {fmtDateTime(m.created_at)}
                        {m.sender_role === "client" && !m.read_at ? " · unread" : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as Victora…" />
                    <Button className="shrink-0 bg-navy text-ivory hover:bg-navy-soft" disabled={reply.trim().length === 0 || send.isPending} onClick={() => send.mutate()}>
                      Send
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================= Sprint 3: service (360) ========================== */

function ServiceSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState<string>("");
  const [internal, setInternal] = useState<boolean>(false);

  const act = useMutation({
    mutationFn: (input: { id: string; body: { action: string; body?: string; internal?: boolean; status?: string } }) => api.ticketAction(input.id, input.body),
    onSuccess: () => {
      setReplyFor(null);
      setReply("");
      setInternal(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const tickets = record.tickets ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow text-gold">Service requests for this client</p>
      {tickets.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No service requests yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {tickets.map((t: TicketRow) => (
            <li key={t.id} className="rounded-md border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-navy">
                    #{t.ticket_number} · {t.category}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {t.status.replace(/_/g, " ")} · updated {ageLabel(t.updated_at)} ago
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
                    value={t.status}
                    onChange={(e) => act.mutate({ id: t.id, body: { action: "status", status: e.target.value } })}
                  >
                    {TICKET_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" className="h-7 border-navy/20 px-2 text-[0.65rem] text-navy" onClick={() => setReplyFor(replyFor === t.id ? null : t.id)}>
                    Reply / note
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-navy/80">{t.description}</p>
              {t.latest_response ? <p className="mt-1 text-muted-foreground">Latest: {t.latest_response}</p> : null}
              {replyFor === t.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? "Internal note — the client never sees this…" : "Reply to the client…"} />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-[0.68rem] text-muted-foreground">
                      <Checkbox checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
                      Internal note (staff only)
                    </label>
                    <Button
                      size="sm"
                      className="h-7 bg-navy px-3 text-[0.65rem] text-ivory"
                      disabled={reply.trim().length === 0 || act.isPending}
                      onClick={() => act.mutate({ id: t.id, body: { action: "reply", body: reply.trim(), internal } })}
                    >
                      {internal ? "Save internal note" : "Send reply"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ========================= Sprint 3: renewals (360) ========================= */

function RenewalsSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const [policyId, setPolicyId] = useState<string>("");
  const [renewalDate, setRenewalDate] = useState<string>("");
  const [renewalPeriod, setRenewalPeriod] = useState<string>("");

  const create = useMutation({
    mutationFn: () => api.createRenewal(record.profile.id, { policyId, renewalDate, renewalPeriod: renewalPeriod || undefined }),
    onSuccess: () => {
      toast.success("Renewal created");
      setRenewalDate("");
      setRenewalPeriod("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const act = useMutation({
    mutationFn: (input: { id: string; body: { action: string; status?: string } }) => api.renewalAction(input.id, input.body),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  const policies = record.policies ?? [];
  const renewals = record.renewals ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gold/40 bg-gold/[0.04] p-5">
        <p className="eyebrow text-gold">Schedule a renewal</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Policy</Label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-navy" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
              <option value="">Choose a coverage record…</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_type} — {p.carrier} {p.plan_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Renewal date</Label>
            <Input className="mt-1 h-9 text-xs" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-[0.62rem] uppercase tracking-[0.1em] text-navy/60">Period (optional)</Label>
            <Input className="mt-1 h-9 text-xs" value={renewalPeriod} onChange={(e) => setRenewalPeriod(e.target.value)} placeholder="2027" />
          </div>
        </div>
        <Button className="mt-3 bg-navy text-ivory hover:bg-navy-soft" disabled={create.isPending || policyId.length === 0 || renewalDate.length === 0} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create renewal
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-navy/60">Renewals</p>
        {renewals.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No renewals scheduled.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {renewals.map((r) => {
              const days = daysUntil(r.renewal_date);
              return (
                <li key={r.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-navy">
                        {r.renewal_period || r.renewal_date.slice(0, 4)} — {r.renewal_date}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {days !== null ? (days < 0 ? `${Math.abs(days)} days overdue` : `${days} days out`) : "date pending"} · {r.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
                      value={r.status}
                      onChange={(e) => act.mutate({ id: r.id, body: { action: "status", status: e.target.value } })}
                    >
                      {RENEWAL_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ========================= Sprint 3: referrals (360) ======================== */

function ReferralsSection({ record, invalidate }: { record: ClientRecord; invalidate: () => void }) {
  const act = useMutation({
    mutationFn: (input: { id: string; body: { action: string; status?: string } }) => api.referralAction(input.id, input.body),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  const referrals = record.referrals ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow text-gold">Referrals from this client</p>
      {referrals.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No referrals submitted.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {referrals.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-xs">
              <div>
                <p className="font-medium text-navy">{r.referred_name}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {[r.referred_email, r.referred_phone].filter(Boolean).join(" · ") || "no contact info"} · submitted {fmtDateTime(r.created_at)}
                </p>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
                value={r.status}
                onChange={(e) => act.mutate({ id: r.id, body: { action: "status", status: e.target.value } })}
              >
                {REFERRAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ========================= Sprint 3: staff inbox ============================ */

function InboxView() {
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["conversations", unreadOnly], queryFn: () => api.conversations(unreadOnly) });

  if (list.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows = list.data?.conversations ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow text-navy/60">Secure conversations ({rows.length})</p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={unreadOnly} onCheckedChange={(v) => setUnreadOnly(v === true)} />
            Unread only
          </label>
        </div>
        {rows.map((c: StaffConversationRow) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpenId(c.id)}
            className={cn("w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-gold/50", openId === c.id ? "border-gold ring-1 ring-gold/25" : "border-border")}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-navy">
                {c.first_name} {c.last_name}
              </p>
              {c.unread_client > 0 ? <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[0.6rem] text-navy">{c.unread_client} new</span> : null}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{c.last_message ?? "No messages yet"}</p>
            <p className="mt-1 text-[0.62rem] text-muted-foreground">
              {c.last_message_at ? `${ageLabel(c.last_message_at)} ago · from ${c.last_sender_role === "client" ? "client" : "staff"}` : ""}
            </p>
          </button>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No conversations{unreadOnly ? " with unread messages" : ""} yet.
          </div>
        ) : null}
      </div>
      <div>
        {openId !== null ? (
          <ConversationPanel conversationId={openId} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Select a conversation to read and reply.</div>
        )}
      </div>
    </div>
  );
}

function ConversationPanel({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState<string>("");
  const conv = useQuery({ queryKey: ["conversation-staff", conversationId], queryFn: () => api.conversationDetail(conversationId) });

  const send = useMutation({
    mutationFn: () => api.staffReply(conversationId, reply.trim()),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["conversation-staff", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (conv.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  const data = conv.data;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow text-gold">{data?.conversation.clientName ?? "Conversation"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {data?.conversation.agentName ? `Victora agent: ${data.conversation.agentName}` : "Unassigned client"} · replying marks client messages read
      </p>
      <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
        {(data?.messages ?? []).map((m: MessageRow) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-md px-3 py-2 text-xs", m.sender_role === "client" ? "border border-border bg-background text-navy" : "bg-navy text-ivory")}>
            <p className="text-[0.6rem] uppercase tracking-[0.08em] opacity-70">
              {m.sender_role === "client" ? "Client" : "Staff"} · {fmtDateTime(m.created_at)}
              {m.sender_role === "client" && !m.read_at ? " · unread" : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as Victora — the client sees this in My Victora…" />
        <Button className="shrink-0 bg-navy text-ivory hover:bg-navy-soft" disabled={reply.trim().length === 0 || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>
    </div>
  );
}

/* ======================== Sprint 3: staff service =========================== */

function ServiceView({ managerPlus }: { managerPlus: boolean }) {
  const [status, setStatus] = useState<string>("");
  const [mine, setMine] = useState<boolean>(false);
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["tickets", status, mine], queryFn: () => api.tickets({ status: status || undefined, assigned: mine ? "me" : undefined }) });
  const team = useQuery({ queryKey: ["team"], queryFn: api.team, enabled: managerPlus });

  if (list.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows = (list.data?.tickets ?? []).filter((t) => !urgentOnly || t.priority === "urgent" || t.priority === "high");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3">
        <p className="eyebrow text-navy/60">Service queue ({rows.length})</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox checked={mine} onCheckedChange={(v) => setMine(v === true)} />
            Assigned to me
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={urgentOnly} onCheckedChange={(v) => setUrgentOnly(v === true)} />
            High priority only
          </label>
          <select className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {TICKET_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        {rows.map((t: TicketRow) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOpenId(t.id)}
            className={cn("w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-gold/50", openId === t.id ? "border-gold ring-1 ring-gold/25" : "border-border")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-navy">
                #{t.ticket_number} · {t.category}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6rem] text-muted-foreground">{t.status.replace(/_/g, " ")}</span>
                {t.priority && t.priority !== "normal" ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.6rem]", t.priority === "urgent" ? "bg-red-500/10 text-red-700" : "bg-amber-400/15 text-amber-800")}>{t.priority}</span>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.first_name} {t.last_name} · updated {ageLabel(t.updated_at)} ago
              {t.assigned_name ? ` · ${t.assigned_name}` : " · unassigned"}
            </p>
          </button>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No tickets match these filters.</div>
        ) : null}
      </div>
      <div>
        {openId !== null ? <TicketPanel ticketId={openId} managerPlus={managerPlus} team={team.data?.team ?? []} /> : (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Select a ticket to work it.</div>
        )}
      </div>
    </div>
  );
}

function TicketPanel({ ticketId, managerPlus, team }: { ticketId: string; managerPlus: boolean; team: { id: string; name: string }[] }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["ticket-staff", ticketId], queryFn: () => api.ticketDetailStaff(ticketId) });
  const [reply, setReply] = useState<string>("");
  const [internal, setInternal] = useState<boolean>(false);

  const act = useMutation({
    mutationFn: (body: { action: string; body?: string; internal?: boolean; status?: string; priority?: string; agentId?: string }) => api.ticketAction(ticketId, body),
    onSuccess: () => {
      setReply("");
      setInternal(false);
      void queryClient.invalidateQueries({ queryKey: ["ticket-staff", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (detail.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  const t = detail.data?.ticket;
  if (!t) return <p className="mt-10 text-center text-sm text-muted-foreground">Ticket not found.</p>;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="eyebrow text-gold">
        #{t.ticket_number} · {t.category}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t.first_name} {t.last_name} · submitted {fmtDateTime(t.created_at)} · priority {t.priority ?? "normal"}
      </p>
      <p className="mt-3 text-sm text-navy/85">{t.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
          value={t.status}
          onChange={(e) => act.mutate({ action: "status", status: e.target.value })}
        >
          {TICKET_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
          value={t.priority ?? "normal"}
          onChange={(e) => act.mutate({ action: "priority", priority: e.target.value })}
        >
          {["normal", "high", "urgent"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {managerPlus && team.length > 0 ? (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
            value={t.assigned_to ?? ""}
            onChange={(e) => {
              if (e.target.value.length > 0) act.mutate({ action: "assign", agentId: e.target.value });
            }}
          >
            <option value="">{t.assigned_name ? `Assigned: ${t.assigned_name}` : "Unassigned — assign…"}</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : t.assigned_name ? (
          <span className="text-[0.65rem] text-muted-foreground">Assigned: {t.assigned_name}</span>
        ) : null}
      </div>
      <div className="mt-4 space-y-2 border-t border-border pt-4">
        {(detail.data?.comments ?? []).map((c: TicketCommentRow) => (
          <div key={c.id} className={cn("rounded-md border p-3 text-xs", c.internal === 1 ? "border-amber-500/50 bg-amber-500/[0.06]" : "border-border bg-background")}>
            <p className="text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">
              {c.author_name ?? c.author_role} · {c.author_role} · {fmtDateTime(c.created_at)}
              {c.internal === 1 ? " · INTERNAL" : ""}
            </p>
            <p className="mt-1 text-navy/85">{c.body}</p>
          </div>
        ))}
        {(detail.data?.comments.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">No replies yet.</p> : null}
      </div>
      <div className="mt-4 space-y-2">
        <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? "Internal note — the client never sees this…" : "Reply to the client…"} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
            Internal note (staff only)
          </label>
          <Button
            size="sm"
            className="bg-navy text-ivory hover:bg-navy-soft"
            disabled={reply.trim().length === 0 || act.isPending}
            onClick={() => act.mutate({ action: "reply", body: reply.trim(), internal })}
          >
            {act.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {internal ? "Save internal note" : "Send reply"}
          </Button>
        </div>
        {t.category === "Cancellation / Termination Request" ? (
          <p className="text-[0.65rem] leading-relaxed text-amber-800">
            Cancellation requests are service actions only — carrier confirmation is still required before any coverage ends. Never tell the client a policy was
            terminated because this ticket was resolved.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ======================== Sprint 3: staff renewals ========================== */

function RenewalsQueueView() {
  const queryClient = useQueryClient();
  const renewals = useQuery({ queryKey: ["renewals"], queryFn: () => api.renewals() });

  const act = useMutation({
    mutationFn: (input: { id: string; body: { action: string; status?: string } }) => api.renewalAction(input.id, input.body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["renewals"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  if (renewals.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows = renewals.data?.renewals ?? [];

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow text-navy/60">Renewal pipeline ({rows.length})</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The 120/90/60/30-day ladder is an internal service target — never a regulatory or enrollment deadline. Automation tasks are deduplicated per tier.
        </p>
      </div>
      {rows.map((r: RenewalRow) => {
        const days = daysUntil(r.renewal_date);
        return (
          <div key={r.id} className={cn("rounded-lg border bg-card p-4", days !== null && days < 0 ? "border-red-500/50" : "border-border")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-navy">
                  {r.first_name} {r.last_name} — {r.product_type ?? "Coverage"} {r.carrier ?? ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.renewal_date} ({r.renewal_period})
                  {days !== null ? ` · ${days < 0 ? `${Math.abs(days)} days OVERDUE` : `${days} days out`}` : ""}
                  {r.assigned_agent ? "" : " · unassigned"}
                </p>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
                value={r.status}
                onChange={(e) => act.mutate({ id: r.id, body: { action: "status", status: e.target.value } })}
              >
                {RENEWAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No renewals scheduled. Create them from a client's Victora 360 → Renewals.
        </div>
      ) : null}
    </div>
  );
}

/* ======================== Sprint 3: staff referrals ========================= */

function ReferralsQueueView() {
  const queryClient = useQueryClient();
  const referrals = useQuery({ queryKey: ["referrals"], queryFn: api.referrals });
  const [convertedFor, setConvertedFor] = useState<string | null>(null);
  const [convertedId, setConvertedId] = useState<string>("");

  const act = useMutation({
    mutationFn: (input: { id: string; body: { action: string; status?: string; convertedClientId?: string } }) => api.referralAction(input.id, input.body),
    onSuccess: () => {
      setConvertedFor(null);
      setConvertedId("");
      void queryClient.invalidateQueries({ queryKey: ["referrals"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (referrals.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows = referrals.data?.referrals ?? [];

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow text-navy/60">Referral queue ({rows.length})</p>
        <p className="mt-1 text-xs text-muted-foreground">Tracking only — referral incentives require separate product/compliance review before launch.</p>
      </div>
      {rows.map((r: ReferralRow) => (
        <div key={r.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-navy">{r.referred_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Referred by {r.first_name} {r.last_name} ({r.client_id ?? ""}) · {r.relationship || "relationship n/a"} · {fmtDateTime(r.created_at)}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{[r.referred_email, r.referred_phone].filter(Boolean).join(" · ") || "no contact info"}</p>
              {r.converted_client_id ? <p className="mt-1 text-[0.65rem] text-emerald-700">Converted → {r.converted_client_id}</p> : null}
            </div>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-navy"
              value={r.status}
              onChange={(e) => act.mutate({ id: r.id, body: { action: "status", status: e.target.value } })}
            >
              {REFERRAL_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {convertedFor === r.id ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Input className="h-9 max-w-[200px] text-xs" value={convertedId} onChange={(e) => setConvertedId(e.target.value)} placeholder="VIC-100001" />
              <Button
                size="sm"
                className="bg-navy text-ivory"
                disabled={convertedId.trim().length < 4 || act.isPending}
                onClick={() => act.mutate({ id: r.id, body: { action: "status", status: "converted", convertedClientId: convertedId.trim() } })}
              >
                Link conversion
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-[0.65rem] text-navy/70" onClick={() => setConvertedFor(r.id)}>
              Mark converted →
            </Button>
          )}
        </div>
      ))}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No referrals yet.</div>
      ) : null}
    </div>
  );
}
