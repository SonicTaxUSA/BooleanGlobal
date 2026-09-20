/**
 * MY VICTORA — the client-facing member portal, backed by the VictoraDB API.
 * Identity and permissions live server-side; this surface renders the Master
 * Client Record for the signed-in client only.
 */
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ClipboardList,
  ExternalLink,
  Eye,
  FileUp,
  FolderLock,
  HeartPulse,
  LifeBuoy,
  Loader2,
  LogOut,
  MessagesSquare,
  PenLine,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  type ClientOverview,
  type ClientQuoteRow,
  type CommPrefs,
  type DocumentRow,
  type MessageRow,
  type NotificationRow,
  type PolicyRow,
  type QuoteOptionRow,
  type ReferralRow,
  type RenewalRow,
  type TicketCommentRow,
  type TicketRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type TabId =
  | "home"
  | "coverage"
  | "welcome"
  | "quotes"
  | "documents"
  | "messages"
  | "help"
  | "appointments"
  | "renewals"
  | "referrals"
  | "authorizations"
  | "intake"
  | "preferences";

const JOURNEY: { id: string; label: string }[] = [
  { id: "info_received", label: "Information Received" },
  { id: "agent_review", label: "Agent Review" },
  { id: "options_prepared", label: "Options Prepared" },
  { id: "client_review", label: "Review Your Options" },
  { id: "enrollment", label: "Enrollment" },
  { id: "active", label: "Coverage Active" },
];

const INTAKE_NEEDS: string[] = [
  "Lower my monthly premium",
  "My doctor must stay in network",
  "Prescription drug coverage",
  "Dental and vision included",
  "Low deductible / low out-of-pocket",
  "Coverage for a planned procedure",
  "Help understanding my current plan",
];

const TOPICS = ["Coverage consultation", "Dental & Vision consultation", "Enrollment assistance", "Policy / coverage review", "Renewal review", "Other"];

/** Parses "2026-09-15" + "1:00 PM" into a real timestamp (12h strings fail Date parsing). */
function apptTime(date: string, time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (!m) return new Date(`${date}T${time}`).getTime();
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return new Date(`${date}T${String(h).padStart(2, "0")}:${m[2]}:00`).getTime();
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function MyVictora() {
  const { user, isLoading, isStaff, logout } = useAuth();
  const [tab, setTab] = useState<TabId>("home");

  if (isLoading) {
    return (
      <Layout>
        <section className="navy-canvas flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-gold" />
        </section>
      </Layout>
    );
  }

  if (user === null || isStaff) {
    return (
      <Layout>
        {user !== null && isStaff ? (
          <section className="navy-canvas relative overflow-hidden">
            <div className="grid-veil absolute inset-0" aria-hidden />
            <div className="container relative flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
              <ShieldCheck className="h-8 w-8 text-gold" />
              <h1 className="display mt-6 text-2xl text-ivory">You're signed in as staff</h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-ivory/60">
                My Victora is the client portal. Head to the staff console to work your pipeline and client records.
              </p>
              <div className="mt-7 flex gap-3">
                <Button asChild className="bg-gold text-navy-deep hover:bg-gold-light">
                  <Link to="/admin">Open Staff Console</Link>
                </Button>
                <Button variant="outline" onClick={() => void logout()} className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
                  Sign out
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <AuthPanel />
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="navy-canvas relative overflow-hidden">
        <div className="grid-veil absolute inset-0" aria-hidden />
        <div className="container relative py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-gold">My Victora</p>
              <h1 className="display mt-3 text-3xl text-ivory md:text-[2.4rem]">{greeting()}, {user.name.split(" ")[0]}.</h1>
            </div>
            <div className="flex items-center gap-3">
              {user.role === "client" ? (
                <span className="rounded-full border border-ivory/20 px-4 py-2 text-[0.68rem] uppercase tracking-[0.14em] text-ivory/60">
                  Victora ID {user.id.slice(0, 4)}…
                </span>
              ) : null}
              <Button variant="outline" onClick={() => void logout()} className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory">
                <LogOut className="mr-2 h-4 w-4 text-gold" />
                Sign out
              </Button>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {(
              [
                { id: "home", label: "Home" },
                { id: "coverage", label: "My Coverage" },
                { id: "welcome", label: "Welcome Center" },
                { id: "quotes", label: "My Options" },
                { id: "documents", label: "Documents" },
                { id: "messages", label: "Messages" },
                { id: "help", label: "Get Help" },
                { id: "appointments", label: "Appointments" },
                { id: "renewals", label: "Renewals" },
                { id: "referrals", label: "Refer Someone" },
                { id: "authorizations", label: "Authorizations" },
                { id: "intake", label: "Coverage Intake" },
                { id: "preferences", label: "Preferences" },
              ] as { id: TabId; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs transition-all active:scale-[0.97]",
                  tab === t.id ? "border-gold bg-gold/15 text-ivory" : "border-ivory/20 text-ivory/60 hover:border-gold/50 hover:text-ivory",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container py-10">
        {tab === "home" ? <HomeView onGo={setTab} /> : null}
        {tab === "coverage" ? <CoverageView /> : null}
        {tab === "welcome" ? <WelcomeView /> : null}
        {tab === "quotes" ? <QuotesView /> : null}
        {tab === "documents" ? <DocumentsView /> : null}
        {tab === "messages" ? <MessagesView /> : null}
        {tab === "help" ? <HelpView /> : null}
        {tab === "appointments" ? <AppointmentsView /> : null}
        {tab === "renewals" ? <RenewalsView /> : null}
        {tab === "referrals" ? <ReferralsView /> : null}
        {tab === "authorizations" ? <AuthorizationsView /> : null}
        {tab === "intake" ? <IntakeView /> : null}
        {tab === "preferences" ? <PreferencesView /> : null}
      </div>
    </Layout>
  );
}

/* --------------------------------- auth gate ------------------------------- */

function AuthPanel() {
  const { login, registerClient } = useAuth();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const submit = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(email.trim().toLowerCase(), password);
        toast.success("Welcome back");
      } else {
        await registerClient({ name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim() || undefined, source: "Website" });
        toast.success("Your Victora account is ready");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [email, login, mode, name, password, phone, registerClient]);

  return (
    <section className="navy-canvas relative overflow-hidden">
      <div className="grid-veil absolute inset-0" aria-hidden />
      <div className="container relative flex min-h-[80vh] items-center justify-center py-20">
        <div className="w-full max-w-md rounded-lg border border-ivory/12 bg-ivory/[0.04] p-8 backdrop-blur-sm">
          <div className="text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-gold" />
            <h1 className="display mt-6 text-3xl text-ivory">My Victora</h1>
            <p className="mt-3 text-sm leading-relaxed text-ivory/60">
              Your coverage, documents, and agent — in one secure place.
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
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4 text-left">
            {mode === "create" ? (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Full name</Label>
                  <Input className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30" value={name} placeholder="Maria Hernandez" onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Phone (optional)</Label>
                  <Input className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30" value={phone} placeholder="(555) 555-5555" onChange={(e) => setPhone(e.target.value)} />
                </div>
              </>
            ) : null}
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Email</Label>
              <Input className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30" type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-ivory/60">Password</Label>
              <Input
                className="mt-2 border-ivory/20 bg-navy-deep/60 text-ivory placeholder:text-ivory/30"
                type="password"
                value={password}
                placeholder={mode === "create" ? "At least 8 characters" : "Your password"}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </div>
          </div>

          <Button className="mt-6 w-full bg-gold text-navy-deep hover:bg-gold-light" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create my account"}
          </Button>
          <p className="mt-5 text-center text-[0.68rem] leading-relaxed text-ivory/40">
            Staff members sign in with agency credentials issued by your administrator.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- home ----------------------------------- */

function HomeView({ onGo }: { onGo: (t: TabId) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const overview = useQuery<ClientOverview>({ queryKey: ["client-overview"], queryFn: api.clientOverview });

  const notifications = useQuery<{ notifications: NotificationRow[] }>({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    enabled: user?.role === "client",
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const stageIdx = useMemo<number>(() => {
    const idx = JOURNEY.findIndex((s) => s.id === overview.data?.journeyStage);
    return idx >= 0 ? idx : 0;
  }, [overview.data?.journeyStage]);

  if (overview.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (overview.isError || overview.data === undefined) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">We couldn't load your record. Please refresh in a moment.</p>
      </div>
    );
  }

  const data = overview.data;
  const protection = [
    { key: "HEALTH", status: data.protection.health, icon: HeartPulse },
    { key: "DENTAL", status: data.protection.dental, icon: ShieldCheck },
    { key: "VISION", status: data.protection.vision, icon: Eye },
  ];

  return (
    <div className="space-y-10">
      {/* Journey tracker */}
      <div className="rounded-lg border border-gold/40 bg-gold/[0.06] p-6">
        <p className="eyebrow text-gold">Your Victora Journey</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {JOURNEY.map((step, i) => {
            const done = i < stageIdx;
            const current = i === stageIdx;
            return (
              <div key={step.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold",
                    done ? "border-emerald-600/50 bg-emerald-600/15 text-emerald-800" : current ? "border-gold bg-gold text-navy-deep" : "border-border text-muted-foreground",
                  )}
                >
                  {done ? "✓" : current ? "●" : ""}
                </span>
                <div>
                  <p className={cn("text-xs leading-snug", current ? "font-semibold text-navy" : done ? "text-navy/70" : "text-muted-foreground")}>{step.label}</p>
                  {current ? <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-gold">You are here</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Your agent + next appointment — always visible on the home tab */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="eyebrow text-gold">Your Agent</p>
          {data.agentName ? (
            <p className="display mt-3 text-xl text-navy">{data.agentName}</p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">A licensed Victora agent will be assigned to you shortly.</p>
          )}
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">Victora ID {data.profile.id}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="eyebrow text-gold">Next Appointment</p>
          {data.nextAppointment ? (
            <>
              <p className="display mt-3 text-xl text-navy">{data.nextAppointment.topic || "Consultation"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(`${data.nextAppointment.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at{" "}
                {data.nextAppointment.time} · <span className="capitalize">{data.nextAppointment.channel}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">No consultation scheduled yet — book one anytime.</p>
          )}
        </div>
      </div>

      {/* Protection tiles + attention */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="eyebrow text-gold">Your Protection</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {protection.map((p) => {
              const Icon = p.icon;
              const active = p.status === "reviewed";
              const pending = p.status === "new";
              return (
                <div key={p.key} className="rounded-md border border-border bg-background p-5 text-center">
                  <Icon className={cn("mx-auto h-5 w-5", active ? "text-emerald-700" : pending ? "text-gold" : "text-muted-foreground")} />
                  <p className="mt-3 text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">{p.key}</p>
                  <p className={cn("display mt-2 text-lg", active ? "text-emerald-700" : pending ? "text-gold" : "text-muted-foreground")}>
                    {active ? "Active ✓" : pending ? "In Review" : "Not Covered"}
                  </p>
                </div>
              );
            })}
          </div>
          <Button onClick={() => onGo("intake")} className="mt-6 w-full bg-navy text-ivory hover:bg-navy-soft">
            <ClipboardList className="mr-2 h-4 w-4 text-gold" />
            Update my coverage needs
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <p className="eyebrow text-gold">Things that need your attention</p>
          <ul className="mt-5 space-y-4">
            {data.attention.map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    a.severity === "red" ? "bg-red-500" : a.severity === "amber" ? "bg-amber-400" : "bg-emerald-500",
                  )}
                />
                <span className="text-navy/85">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          { label: "Coverage", desc: "Tell us what you need", action: () => onGo("intake"), icon: ClipboardList, ready: true },
          { label: "My Options", desc: "Coverage options from your agent", action: () => onGo("quotes"), icon: BadgeCheck, ready: true },
          { label: "Appointments", desc: "Talk to your agent", action: () => onGo("appointments"), icon: CalendarCheck2, ready: true },
          { label: "Documents", desc: "Upload what your agent requests", action: () => onGo("documents"), icon: FolderLock, ready: true },
          { label: "My Coverage", desc: "Your verified coverage records", action: () => onGo("coverage"), icon: ShieldCheck, ready: true },
          { label: "Messages", desc: "Secure chat with your agent", action: () => onGo("messages"), icon: MessagesSquare, ready: true },
          { label: "Get Help", desc: "Requests, answered and tracked", action: () => onGo("help"), icon: LifeBuoy, ready: true },
          { label: "Welcome Center", desc: "New member guide & checklist", action: () => onGo("welcome"), icon: Sparkles, ready: true },
          { label: "Refer Someone", desc: "Share Victora with someone you trust", action: () => onGo("referrals"), icon: UserPlus, ready: true },
        ] as { label: string; desc: string; action?: () => void; to?: string; icon: typeof ClipboardList; ready: boolean }[]).map((item) => {
          const Icon = item.icon;
          const inner = (
            <>
              <Icon className="h-5 w-5 text-gold" />
              <p className="display mt-3 text-lg text-navy">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            </>
          );
          const cls = "rounded-lg border border-border bg-card p-5 text-left transition-all duration-200 hover:border-gold/50";
          if (!item.ready) {
            return (
              <button key={item.label} type="button" onClick={() => toast.info("This area is part of the next sprint — coming soon.")} className={cn(cls, "opacity-70")}>
                {inner}
              </button>
            );
          }
          if (item.to !== undefined) {
            return (
              <Link key={item.label} to={item.to} className={cls}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={item.label} type="button" onClick={item.action} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>

      {/* Notifications + timeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="eyebrow text-gold">Notifications</p>
          {(notifications.data?.notifications.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing new right now.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {notifications.data?.notifications.slice(0, 8).map((n) => (
                <li key={n.id} className={cn("rounded-md border p-3", n.read === 0 ? "border-gold/40 bg-gold/[0.06]" : "border-border")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-navy">{n.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    </div>
                    {n.read === 0 ? (
                      <button type="button" onClick={() => markRead.mutate(n.id)} className="shrink-0 text-[0.62rem] uppercase tracking-[0.1em] text-gold hover:underline">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <p className="eyebrow text-gold">Activity</p>
          <ul className="mt-4 space-y-4">
            {data.timeline.slice(0, 8).map((e) => (
              <li key={e.id} className="flex gap-3 text-xs">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <div>
                  <p className="text-navy/85">{e.label}</p>
                  <p className="mt-0.5 text-muted-foreground">{fmtDateTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- intake ---------------------------------- */

function IntakeView() {
  const queryClient = useQueryClient();
  const [area, setArea] = useState<"health" | "dental" | "vision">("health");
  const [householdSize, setHouseholdSize] = useState<string>("2");
  const [insured, setInsured] = useState<boolean>(true);
  const [carrier, setCarrier] = useState<string>("");
  const [doctors, setDoctors] = useState<string>("");
  const [medications, setMedications] = useState<string>("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");

  const submit = useMutation({
    mutationFn: () =>
      api.submitIntake({
        area,
        householdSize: Math.max(1, Number(householdSize) || 1),
        currentlyInsured: insured,
        currentCarrier: carrier.trim(),
        doctors: doctors.trim(),
        medications: medications.trim(),
        needs,
        notes: notes.trim(),
      }),
    onSuccess: () => {
      toast.success("Intake submitted — your agent will take it from here");
      setNeeds([]);
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 md:p-8">
      <p className="eyebrow text-gold">Coverage intake</p>
      <h2 className="display mt-3 text-2xl text-navy">Tell us what you need</h2>
      <p className="mt-2 text-sm text-muted-foreground">Five minutes now saves an hour on the phone later.</p>

      <div className="mt-7 space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Coverage area</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["health", "dental", "vision"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs capitalize transition-all active:scale-[0.97]",
                  area === a ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Household size</Label>
            <Input className="mt-2" type="number" min={1} value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Currently insured?</Label>
            <div className="mt-2 flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setInsured(v)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs transition-all active:scale-[0.97]",
                    insured === v ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground",
                  )}
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {insured ? (
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Current carrier / plan (optional)</Label>
            <Input className="mt-2" value={carrier} placeholder="e.g. Blue Cross Bronze 6000" onChange={(e) => setCarrier(e.target.value)} />
          </div>
        ) : null}

        <div>
          <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Doctors that must stay in network (optional)</Label>
          <Input className="mt-2" value={doctors} placeholder="Dr. Alvarez — family medicine" onChange={(e) => setDoctors(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Medications (optional)</Label>
          <Input className="mt-2" value={medications} placeholder="Metformin 500mg" onChange={(e) => setMedications(e.target.value)} />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">What matters most?</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTAKE_NEEDS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs transition-all active:scale-[0.97]",
                  needs.includes(n) ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Anything else?</Label>
          <Textarea className="mt-2" rows={3} value={notes} placeholder="Planned procedures, questions, timing…" onChange={(e) => setNotes(e.target.value)} />
        </div>

        <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full bg-navy text-ivory hover:bg-navy-soft">
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          Submit to my agent
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- appointments ------------------------------- */

function AppointmentsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const overview = useQuery<ClientOverview>({ queryKey: ["client-overview"], queryFn: api.clientOverview });
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("10:00 AM");
  const [channel, setChannel] = useState<"phone" | "video" | "office">("phone");

  const book = useMutation({
    mutationFn: () =>
      api.bookAppointment({
        name: user?.name ?? "",
        email: user?.email ?? "",
        date,
        time,
        topic,
        channel,
      }),
    onSuccess: () => {
      toast.success("Consultation requested — we'll confirm shortly");
      setDate("");
      void queryClient.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const upcoming = (overview.data?.appointments ?? []).filter((a) => apptTime(a.date, a.time) > Date.now());

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="eyebrow text-gold">Talk to your agent</p>
        <h2 className="display mt-3 text-2xl text-navy">Schedule a consultation</h2>
        <div className="mt-6 space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">What's it about?</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs transition-all active:scale-[0.97]",
                    topic === t ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground hover:border-navy/30 hover:text-navy",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Preferred date</Label>
              <Input className="mt-2" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Preferred time</Label>
              <select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-navy" value={time} onChange={(e) => setTime(e.target.value)}>
                {["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">How?</Label>
            <div className="mt-2 flex gap-2">
              {(["phone", "video", "office"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs capitalize transition-all active:scale-[0.97]",
                    channel === c ? "border-gold bg-gold/15 text-navy" : "border-border text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => book.mutate()} disabled={book.isPending || date.length === 0} className="w-full bg-navy text-ivory hover:bg-navy-soft">
            {book.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Request appointment
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Reminders are sent automatically 24 hours and 1 hour before your consultation.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="eyebrow text-navy/60">Upcoming</p>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No upcoming appointments.</div>
        ) : (
          upcoming.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-5">
              <p className="display text-lg text-navy">{a.topic}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(`${a.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {a.time} ·{" "}
                <span className="capitalize">{a.channel}</span>
              </p>
            </div>
          ))
        )}
        <div className="rounded-lg border border-gold/40 bg-gold/[0.07] p-5 text-sm leading-relaxed text-navy/80">
          <Phone className="mb-2 h-4 w-4 text-gold" />
          Prefer to talk now? Call the agency and we'll fit you in.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- status chips ------------------------------- */

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  open: { label: "Needed", cls: "bg-red-500/10 text-red-700" },
  under_review: { label: "Under Review", cls: "bg-amber-400/15 text-amber-800" },
  uploaded: { label: "Uploaded", cls: "bg-amber-400/15 text-amber-800" },
  accepted: { label: "Accepted ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  replacement_required: { label: "Replacement Needed", cls: "bg-red-500/10 text-red-700" },
  rejected: { label: "Not Accepted", cls: "bg-red-500/10 text-red-700" },
  pending: { label: "Awaiting Signature", cls: "bg-amber-400/15 text-amber-800" },
  signed: { label: "Signed ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  revoked: { label: "Revoked", cls: "bg-muted text-muted-foreground" },
  sent: { label: "New", cls: "bg-gold/15 text-navy" },
  viewed: { label: "Reviewed", cls: "bg-amber-400/15 text-amber-800" },
  client_interested: { label: "Interested ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  // Sprint 3
  in_progress: { label: "In Progress", cls: "bg-amber-400/15 text-amber-800" },
  waiting_on_client: { label: "Waiting on You", cls: "bg-amber-400/15 text-amber-800" },
  waiting_external: { label: "Waiting on Carrier", cls: "bg-amber-400/15 text-amber-800" },
  resolved: { label: "Resolved ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground" },
  active: { label: "Active ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  terminated: { label: "Terminated", cls: "bg-muted text-muted-foreground" },
  expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", cls: "bg-gold/15 text-navy" },
  contacted: { label: "Contacted", cls: "bg-amber-400/15 text-amber-800" },
  qualified: { label: "Qualified", cls: "bg-emerald-600/10 text-emerald-700" },
  converted: { label: "Client ✓", cls: "bg-emerald-600/10 text-emerald-700" },
  upcoming: { label: "Upcoming", cls: "bg-gold/15 text-navy" },
  review_needed: { label: "Review Needed", cls: "bg-amber-400/15 text-amber-800" },
  reviewing: { label: "In Review", cls: "bg-amber-400/15 text-amber-800" },
  not_renewed: { label: "Not Renewed", cls: "bg-muted text-muted-foreground" },
  lost: { label: "Closed", cls: "bg-muted text-muted-foreground" },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_CHIP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("rounded-full px-3 py-1 text-[0.65rem] font-medium", s.cls)}>{s.label}</span>;
}

/* -------------------------------- documents -------------------------------- */

function DocumentsView() {
  const queryClient = useQueryClient();
  const docs = useQuery({ queryKey: ["my-documents"], queryFn: api.myDocuments });

  const upload = useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) => api.uploadDocument(requestId, file),
    onSuccess: () => {
      toast.success("Document uploaded — your agent will review it");
      void queryClient.invalidateQueries({ queryKey: ["my-documents"] });
      void queryClient.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (docs.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const openRequests = (docs.data?.requests ?? []).filter((r) => r.status === "open");
  const documents = docs.data?.documents ?? [];

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow text-gold">Documents Needed</p>
        <h2 className="display mt-2 text-2xl text-navy">What we need from you</h2>
        {openRequests.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nothing is needed right now. If your agent requests a document, it will appear here — no guessing.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {openRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-gold/40 bg-gold/[0.05] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{r.document_type}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.category}
                      {r.due_date ? ` · Due ${r.due_date}` : ""}
                      {r.required === 1 ? " · Required" : " · Optional"}
                    </p>
                    {r.instructions ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy/80">{r.instructions}</p> : null}
                  </div>
                  <label className="shrink-0">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload.mutate({ requestId: r.id, file });
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-navy px-4 py-2 text-xs text-ivory transition-colors hover:bg-navy-soft">
                      {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4 text-gold" />}
                      Upload
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow text-navy/60">My documents</p>
        {documents.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</div>
        ) : (
          <ul className="mt-4 space-y-3">
            {documents.map((d: DocumentRow) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="text-sm font-medium text-navy">{d.document_type}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.original_filename} · {Math.max(1, Math.round(d.size / 1024))} KB · uploaded {fmtDateTime(d.uploaded_at)}
                  </p>
                  {d.rejection_reason ? <p className="mt-1 text-xs text-red-700">{d.rejection_reason}</p> : null}
                </div>
                <StatusChip status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- authorizations ------------------------------ */

function AuthorizationsView() {
  const queryClient = useQueryClient();
  const auths = useQuery({ queryKey: ["my-authorizations"], queryFn: api.myAuthorizations });
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [agreed, setAgreed] = useState<boolean>(false);

  const load = useMutation({
    mutationFn: (id: string) => api.authorizationText(id),
    onSuccess: (data) => {
      setText(data.authorization.text);
      setOpenId(data.authorization.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sign = useMutation({
    mutationFn: (id: string) => api.signAuthorization(id, signature.trim(), agreed),
    onSuccess: () => {
      toast.success("Authorization signed — a copy is saved in your records");
      setOpenId(null);
      setSignature("");
      setAgreed(false);
      void queryClient.invalidateQueries({ queryKey: ["my-authorizations"] });
      void queryClient.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (auths.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows = auths.data?.authorizations ?? [];
  const pending = rows.filter((a) => a.status === "pending");
  const signed = rows.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow text-gold">Authorizations</p>
        <h2 className="display mt-2 text-2xl text-navy">Review and sign</h2>
        {pending.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nothing is waiting for your signature right now.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-lg border border-gold/40 bg-gold/[0.05] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{a.template_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Version {a.template_version} · sent by your Victora agent</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-navy text-ivory hover:bg-navy-soft"
                    onClick={() => (openId === a.id ? setOpenId(null) : load.mutate(a.id))}
                  >
                    <PenLine className="mr-2 h-4 w-4 text-gold" />
                    Review & sign
                  </Button>
                </div>
                {openId === a.id ? (
                  <div className="mt-4 border-t border-gold/30 pt-4">
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-xs leading-relaxed text-navy/85">
                      {text}
                    </pre>
                    <div className="mt-4 space-y-3">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.12em] text-navy/70">Type your full legal name to sign</Label>
                        <Input className="mt-2" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your full name" />
                      </div>
                      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                        <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                        <span>I have read and agree to this authorization.</span>
                      </label>
                      <Button
                        className="w-full bg-gold text-navy-deep hover:bg-gold-light"
                        disabled={sign.isPending || signature.trim().length < 3 || !agreed}
                        onClick={() => sign.mutate(a.id)}
                      >
                        {sign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                        Sign authorization
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow text-navy/60">Signed records</p>
        {signed.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No signed authorizations yet.</div>
        ) : (
          <ul className="mt-4 space-y-3">
            {signed.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-navy">{a.template_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Version {a.template_version}
                      {a.signed_at ? ` · signed ${fmtDateTime(a.signed_at)}` : ""} · {a.method === "electronic_signature" ? "e-signature" : a.method}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-navy/20 text-navy"
                      onClick={() => (openId === a.id ? setOpenId(null) : load.mutate(a.id))}
                    >
                      View
                    </Button>
                    <StatusChip status={a.status} />
                  </div>
                </div>
                {openId === a.id ? (
                  <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-xs leading-relaxed text-navy/85">{text}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- quotes ---------------------------------- */

const OPTION_ROWS: { key: keyof QuoteOptionRow; label: string }[] = [
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

function QuotesView() {
  const queryClient = useQueryClient();
  const quotes = useQuery({ queryKey: ["my-quotes"], queryFn: api.myQuotes });
  const [askId, setAskId] = useState<string | null>(null);
  const [askText, setAskText] = useState<string>("");

  // Opening the tab records the view server-side (sent → viewed, once).
  useEffect(() => {
    for (const q of quotes.data?.quotes ?? []) {
      if (q.status === "sent") void api.quoteViewed(q.id).then(() => queryClient.invalidateQueries({ queryKey: ["my-quotes"] }));
    }
  }, [quotes.data, queryClient]);

  const interest = useMutation({
    mutationFn: ({ id, optionId }: { id: string; optionId: string }) => api.quoteInterest(id, optionId),
    onSuccess: () => {
      toast.success("Your agent has been notified", {
        description: "This selection tells your Victora agent which option you would like to continue discussing. Additional authorization or enrollment steps may still be required.",
      });
      void queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const save = useMutation({
    mutationFn: ({ id, optionId }: { id: string; optionId: string }) => api.quoteSave(id, optionId),
    onSuccess: () => toast.success("Option saved with this presentation"),
    onError: (err: Error) => toast.error(err.message),
  });

  const ask = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => api.quoteAsk(id, message),
    onSuccess: () => {
      toast.success("Sent to your agent");
      setAskId(null);
      setAskText("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (quotes.isLoading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;

  const rows: ClientQuoteRow[] = quotes.data?.quotes ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <BadgeCheck className="mx-auto h-7 w-7 text-gold" />
        <p className="display mt-4 text-xl text-navy">Your Victora agent is preparing your coverage options.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Once your agent sends real plan options, you'll compare them side by side here — premiums, deductibles, doctors, and prescriptions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="eyebrow text-gold">Your Coverage Options</p>
      {rows.map((q) => {
        const options = q.options;
        const visibleRows = OPTION_ROWS.filter((r) => options.some((o) => String(o[r.key] ?? "").trim().length > 0));
        return (
          <div key={q.id} className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="display text-2xl text-navy">{q.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {q.coverage_area || "Coverage"} · sent by {q.agent_name ?? "your Victora agent"}
                  {q.sent_at ? ` · ${fmtDateTime(q.sent_at)}` : ""}
                </p>
              </div>
              <StatusChip status={q.status} />
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-40 border-b border-border pb-2 text-left text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">Compare</th>
                    {options.map((o) => (
                      <th key={o.id} className="border-b border-border pb-2 pr-4 text-left">
                        <span className="text-[0.65rem] uppercase tracking-[0.12em] text-gold">{o.label}</span>
                        {q.interested_option === o.id ? (
                          <span className="ml-2 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[0.6rem] text-emerald-700">Interested</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={String(r.key)}>
                      <td className="border-b border-border/60 py-2 pr-3 text-xs text-muted-foreground">{r.label}</td>
                      {options.map((o) => (
                        <td key={o.id} className="border-b border-border/60 py-2 pr-4 text-navy/85">
                          {String(o[r.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((o) => (
                <div key={o.id} className="rounded-md border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{o.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-navy/20 text-navy"
                      disabled={q.status === "client_interested" || save.isPending}
                      onClick={() => save.mutate({ id: q.id, optionId: o.id })}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      className="bg-gold text-navy-deep hover:bg-gold-light"
                      disabled={q.status === "client_interested" || interest.isPending}
                      onClick={() => interest.mutate({ id: q.id, optionId: o.id })}
                    >
                      I'm Interested
                    </Button>
                  </div>
                  {o.doc_link ? (
                    <a href={o.doc_link} target="_blank" rel="noreferrer" className="mt-2 block text-[0.68rem] text-navy/70 underline">
                      Official plan details
                    </a>
                  ) : null}
                </div>
              ))}
            </div>

            <p className="mt-4 text-[0.68rem] leading-relaxed text-muted-foreground">
              Selecting "I'm Interested" tells your Victora agent which option you would like to continue discussing. This is not enrollment —
              additional authorization or enrollment steps may still be required.
            </p>

            {askId === q.id ? (
              <div className="mt-4 space-y-2">
                <Textarea rows={3} value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="Ask your agent about these options…" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-navy text-ivory hover:bg-navy-soft"
                    disabled={askText.trim().length < 3 || ask.isPending}
                    onClick={() => ask.mutate({ id: q.id, message: askText.trim() })}
                  >
                    Send question
                  </Button>
                  <Button size="sm" variant="ghost" className="text-navy/70" onClick={() => setAskId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="mt-4 border-navy/20 text-navy" onClick={() => setAskId(q.id)}>
                Ask my agent
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- messages --------------------------------- */

/** Text-only secure messaging — attachments deliberately excluded (no large binaries in the DO). */
function MessagesView() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const thread = useQuery({ queryKey: ["my-messages"], queryFn: api.myMessages });

  useEffect(() => {
    if ((thread.data?.unread ?? 0) > 0) {
      void api.markMessagesRead().then(() => queryClient.invalidateQueries({ queryKey: ["client-overview"] }));
    }
  }, [thread.data?.unread, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.data?.messages.length]);

  const send = useMutation({
    mutationFn: () => api.sendMessage(draft.trim()),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["my-messages"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (thread.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }

  const conv = thread.data?.conversation;
  const messages = thread.data?.messages ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="eyebrow text-gold">Messages</p>
        <h2 className="display mt-2 text-2xl text-navy">Secure conversation with Victora</h2>
        {conv?.agent ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You're talking with <span className="font-medium text-navy">{conv.agent.name}</span>
            {conv.agent.phone ? (
              <>
                {" · "}
                <a className="underline" href={`tel:${conv.agent.phone}`}>
                  {conv.agent.phone}
                </a>
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">A licensed Victora agent will reply here.</p>
        )}
        <p className="mt-1 text-[0.68rem] text-muted-foreground">Messages stay inside Victora — only you and your Victora care team can read them.</p>
      </div>

      <div className="mt-4 min-h-[280px] max-h-[52vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-4">
        {messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Say hello — your agent will see your message right away.</p>
        ) : (
          messages.map((m: MessageRow) => {
            const mine = m.sender_role === "client";
            const isSystem = m.system_generated === 1;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed",
                    isSystem ? "border border-gold/40 bg-gold/[0.06] text-navy/80" : mine ? "bg-navy text-ivory" : "border border-border bg-card text-navy",
                  )}
                >
                  {isSystem ? <p className="mb-1 text-[0.6rem] uppercase tracking-[0.1em] text-gold">Victora · notice</p> : null}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("mt-1 text-[0.6rem]", mine && !isSystem ? "text-ivory/50" : "text-muted-foreground")}>{fmtDateTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a secure message…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && draft.trim().length > 0) {
              e.preventDefault();
              send.mutate();
            }
          }}
        />
        <Button className="shrink-0 bg-navy text-ivory hover:bg-navy-soft" disabled={draft.trim().length === 0 || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground">
        Please don't send Social Security numbers, medical records, or photos of ID documents through messages — upload those securely under Documents instead.
      </p>
    </div>
  );
}

/* ---------------------------------- get help -------------------------------- */

const HELP_CATEGORIES: string[] = [
  "Insurance Card",
  "Doctor / Network",
  "Prescription",
  "Billing / Premium",
  "Coverage Question",
  "Household Change",
  "Income Change",
  "Address Change",
  "New Baby",
  "Marriage",
  "Dental",
  "Vision",
  "Renewal",
  "Cancellation / Termination Request",
  "Other",
];

function HelpView() {
  const queryClient = useQueryClient();
  const tickets = useQuery({ queryKey: ["my-tickets"], queryFn: api.myTickets });
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState<string>("");
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createTicket(category ?? "", description.trim()),
    onSuccess: (data) => {
      toast.success(`Request ${data.ticketNumber} submitted`, {
        description: "Your Victora team has it — track it right here.",
      });
      setCategory(null);
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (tickets.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }

  const rows = tickets.data?.tickets ?? [];

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow text-gold">Need help?</p>
        <h2 className="display mt-2 text-2xl text-navy">We'll take it from here</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Pick what you need. Every request gets a tracking number and a real person on the Victora team.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "rounded-lg border p-4 text-left text-sm transition-all active:scale-[0.98]",
                category === c ? "border-gold bg-gold/10 text-navy" : "border-border bg-card text-navy/80 hover:border-gold/50",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {category !== null ? (
          <div className="mt-5 max-w-xl rounded-lg border border-gold/40 bg-gold/[0.05] p-5">
            <p className="text-sm font-semibold text-navy">{category}</p>
            <Textarea
              className="mt-3"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what's going on — the more detail, the faster we can help."
            />
            {category === "Cancellation / Termination Request" ? (
              <p className="mt-2 text-xs leading-relaxed text-navy/70">
                Submitting this request does not cancel your coverage by itself. Victora will review and confirm the next required step with you.
              </p>
            ) : null}
            <Button className="mt-3 bg-navy text-ivory hover:bg-navy-soft" disabled={description.trim().length < 5 || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Submit request
            </Button>
          </div>
        ) : null}
      </div>

      <div>
        <p className="eyebrow text-navy/60">My requests</p>
        {rows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No requests yet — when you need something, it starts here.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((t: TicketRow) => (
              <li key={t.id} className="rounded-lg border border-border bg-card p-5">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 text-left" onClick={() => setOpenTicket(openTicket === t.id ? null : t.id)}>
                  <div>
                    <p className="font-semibold text-navy">Request #{t.ticket_number}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.category} · submitted {fmtDateTime(t.created_at)}
                      {t.assigned_name ? ` · ${t.assigned_name}` : ""}
                    </p>
                  </div>
                  <StatusChip status={t.status} />
                </button>
                <p className="mt-2 text-sm text-navy/80">{t.description}</p>
                {t.latest_response ? (
                  <div className="mt-3 rounded-md border border-border bg-background p-3">
                    <p className="text-[0.62rem] uppercase tracking-[0.12em] text-gold">Latest response from Victora</p>
                    <p className="mt-1 text-sm text-navy/85">{t.latest_response}</p>
                  </div>
                ) : null}
                {openTicket === t.id ? <TicketThread ticketId={t.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TicketThread({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["ticket-client", ticketId], queryFn: () => api.ticketDetailClient(ticketId) });
  const [reply, setReply] = useState<string>("");

  const send = useMutation({
    mutationFn: () => api.ticketReplyClient(ticketId, reply.trim()),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["ticket-client", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (detail.isLoading) {
    return <Loader2 className="mt-4 h-5 w-5 animate-spin text-gold" />;
  }

  const comments = detail.data?.comments ?? [];
  const isClosed = detail.data?.ticket.status === "closed";

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">Conversation on this request</p>
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No replies yet.</p>
      ) : (
        comments.map((c: TicketCommentRow) => (
          <div key={c.id} className={cn("rounded-md border p-3 text-sm", c.author_role === "client" ? "border-border bg-background" : "border-gold/30 bg-gold/[0.05]")}>
            <p className="text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">
              {c.author_role === "client" ? "You" : "Victora team"} · {fmtDateTime(c.created_at)}
            </p>
            <p className="mt-1 text-navy/85">{c.body}</p>
          </div>
        ))
      )}
      {!isClosed ? (
        <div className="flex gap-2">
          <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add information or ask a follow-up…" />
          <Button className="shrink-0 bg-navy text-ivory hover:bg-navy-soft" disabled={reply.trim().length === 0 || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">This request is closed. Need something else? Start a new request above.</p>
      )}
    </div>
  );
}

/* -------------------------------- my coverage ------------------------------- */

function CoverageView() {
  const coverage = useQuery({ queryKey: ["my-policies"], queryFn: api.myPolicies });

  if (coverage.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }

  const rows = coverage.data?.policies ?? [];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-gold">My Coverage</p>
        <h2 className="display mt-2 text-2xl text-navy">Your verified coverage</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each card is a Victora servicing record entered by your agent from verified enrollment information. Your carrier's system is the official source for
          benefits, and your official ID card comes from your carrier — links are provided when your carrier offers them.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <ShieldCheck className="mx-auto h-7 w-7 text-gold" />
          <p className="display mt-4 text-xl text-navy">Your verified coverage will appear here after enrollment is confirmed.</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Once your agent confirms your plan, you'll see everything you need to use it — premium, deductible, doctors, and carrier links.
          </p>
        </div>
      ) : (
        rows.map((p: PolicyRow) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="display text-xl text-navy">
                {p.product_type} — {p.carrier} {p.plan_name}
              </h3>
              <StatusChip status={p.status} />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["Effective", p.effective_date],
                ["Premium", p.monthly_premium],
                ["Deductible", p.deductible],
                ["Out-of-pocket max", p.out_of_pocket_max],
                ["Network", p.network_type],
                ["Primary care", p.pcp_cost],
                ["Specialist", p.specialist_cost],
                ["Member ID", p.policy_identifier],
              ] as [string, string | undefined][]).map(([label, value]) => (
                <div key={label}>
                  <p className="text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-navy/85">{value && value.length > 0 ? value : "—"}</p>
                </div>
              ))}
            </div>
            {p.rx_summary && p.rx_summary.length > 0 ? (
              <p className="mt-3 text-sm text-navy/75">
                <span className="font-medium">Rx:</span> {p.rx_summary}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {p.carrier_portal_url ? (
                <a href={p.carrier_portal_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-xs text-ivory transition-colors hover:bg-navy-soft">
                  <ExternalLink className="h-3.5 w-3.5 text-gold" />
                  Carrier Portal
                </a>
              ) : null}
              {p.provider_search_url ? (
                <a href={p.provider_search_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-navy/20 px-4 py-2 text-xs text-navy transition-colors hover:border-gold/50">
                  <ExternalLink className="h-3.5 w-3.5 text-gold" />
                  Find a Provider
                </a>
              ) : null}
              {p.carrier_phone ? (
                <a href={`tel:${p.carrier_phone}`} className="inline-flex items-center gap-2 rounded-md border border-navy/20 px-4 py-2 text-xs text-navy transition-colors hover:border-gold/50">
                  <Phone className="h-3.5 w-3.5 text-gold" />
                  Carrier: {p.carrier_phone}
                </a>
              ) : null}
            </div>
            <p className="mt-4 text-[0.66rem] text-muted-foreground">
              Victora is your agency, not your insurance carrier, and does not issue insurance cards. If your carrier offers a digital card, it lives in your
              carrier account above.
            </p>
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------- welcome center ------------------------------ */

const WELCOME_CHECKLIST: { key: string; label: string }[] = [
  { key: "review_plan", label: "Review my plan" },
  { key: "open_carrier_portal", label: "Open my carrier portal" },
  { key: "save_contact", label: "Save my Victora agent's contact" },
  { key: "review_network", label: "Check my provider network" },
  { key: "review_prescriptions", label: "Review my prescriptions" },
];

function WelcomeView() {
  const queryClient = useQueryClient();
  const welcome = useQuery({ queryKey: ["my-welcome"], queryFn: api.myWelcome });

  const complete = useMutation({
    mutationFn: (itemKey: string) => api.completeWelcomeItem(itemKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-welcome"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  if (welcome.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }

  const data = welcome.data;
  if (!data?.unlocked) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <Sparkles className="mx-auto h-7 w-7 text-gold" />
        <p className="display mt-4 text-xl text-navy">Your Welcome Center unlocks when your coverage is active.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          As soon as your agent confirms your enrollment, this becomes your step-by-step guide to using your new plan.
        </p>
      </div>
    );
  }

  const doneKeys = new Set((data.completed ?? []).map((c) => c.item_key));
  const primary = data.activePolicies[0];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="rounded-lg border border-gold/40 bg-gold/[0.06] p-6">
        <p className="eyebrow text-gold">Welcome to Victora</p>
        <h2 className="display mt-2 text-2xl text-navy">You're covered — here's what to know.</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy/75">
          Eight short steps and a checklist. Nothing here is required — it's here so you feel confident using your plan.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="eyebrow text-navy/60">Getting-started checklist</p>
        <ul className="mt-4 space-y-3">
          {WELCOME_CHECKLIST.map((item) => {
            const done = doneKeys.has(item.key);
            return (
              <li key={item.key} className="flex items-center justify-between gap-3">
                <span className={cn("text-sm", done ? "text-navy/60 line-through" : "text-navy/85")}>{item.label}</span>
                {done ? (
                  <span className="shrink-0 text-xs text-emerald-700">Done ✓</span>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0 border-navy/20 text-navy" disabled={complete.isPending} onClick={() => complete.mutate(item.key)}>
                    Mark done
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[0.66rem] text-muted-foreground">Checklist completion is informational only — it never affects your coverage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {([
          {
            n: 1,
            title: "Review Your Coverage",
            body: primary ? `Your ${primary.product_type} plan — ${primary.carrier} ${primary.plan_name} — is active. The full card is under My Coverage.` : "Open My Coverage for the full details of your plan.",
          },
          {
            n: 2,
            title: "Access Your Carrier Account",
            body: primary?.carrier_portal_url ? "Your carrier portal is where your official ID card, claims, and benefits live." : "Your agent can help you set up your carrier's member account.",
          },
          {
            n: 3,
            title: "Find a Doctor",
            body: primary?.provider_search_url ? "Use your carrier's provider search to confirm your doctors are in network before you book." : "Ask your agent to confirm any doctor before you book an appointment.",
          },
          {
            n: 4,
            title: "Understand Your Deductible",
            body: "Your deductible is what you pay before the plan starts sharing costs. Preventive care is usually covered before the deductible — your agent can walk you through your numbers.",
          },
          {
            n: 5,
            title: "Prescriptions",
            body: "Check that your medications are covered and know your copay tiers. Ask your agent anytime — it's what we're here for.",
          },
          {
            n: 6,
            title: "Dental / Vision",
            body: "If dental or vision aren't on your plan yet, ask your agent what adding them would look like.",
          },
          {
            n: 7,
            title: "How to Get Help",
            body: "Use Get Help for anything — cards, doctors, billing — or message your agent directly. Every request is tracked, nothing gets lost.",
          },
          {
            n: 8,
            title: "Your Victora Agent",
            body: data.agent ? `${data.agent.name} is your agent — call or message anytime.` : "A licensed agent is assigned to guide you.",
          },
        ] as { n: number; title: string; body: string }[]).map((s) => (
          <div key={s.n} className="rounded-lg border border-border bg-card p-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-navy">{s.n}</span>
            <p className="display mt-3 text-lg text-navy">{s.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="eyebrow text-gold">Your Victora Agent</p>
        <p className="display mt-3 text-xl text-navy">{data.agent?.name ?? "Victora Care Team"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.agent?.phone ? (
            <a href={`tel:${data.agent.phone}`} className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-xs text-ivory transition-colors hover:bg-navy-soft">
              <Phone className="h-3.5 w-3.5 text-gold" />
              Call
            </a>
          ) : null}
          {data.agent?.email ? (
            <a href={`mailto:${data.agent.email}`} className="inline-flex items-center gap-2 rounded-md border border-navy/20 px-4 py-2 text-xs text-navy transition-colors hover:border-gold/50">
              <ExternalLink className="h-3.5 w-3.5 text-gold" />
              Email
            </a>
          ) : null}
        </div>
        <p className="mt-3 text-[0.66rem] text-muted-foreground">Prefer the portal? Use Messages for a secure conversation and Appointments to schedule time.</p>
      </div>
    </div>
  );
}

/* --------------------------------- renewals --------------------------------- */

const RENEWAL_COPY: Record<string, string> = {
  upcoming: "This date is on our calendar. Your agent will contact you ahead of time to review your options.",
  review_needed: "Your agent is preparing your renewal review now.",
  contacted: "Your agent has reached out — expect a call or message to schedule your review.",
  waiting_client: "We're waiting on a time that works for you — reply to your agent's message or book a time.",
  reviewing: "Your renewal review is in progress.",
  completed: "Your renewal review is complete. Any changes are reflected under My Coverage.",
  not_renewed: "This plan was not renewed — talk to your agent about current options.",
  lost: "This renewal was closed. Contact Victora with any questions.",
};

function RenewalsView() {
  const renewals = useQuery({ queryKey: ["my-renewals"], queryFn: api.myRenewals });

  if (renewals.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }

  const rows = renewals.data?.renewals ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow text-gold">Renewals</p>
        <h2 className="display mt-2 flex items-center gap-2 text-2xl text-navy">
          <RefreshCw className="h-5 w-5 text-gold" />
          Your coverage reviews
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Each year your plan comes up for renewal. Your Victora agent reviews your options with you ahead of time — you'll never be surprised by a date.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No renewals scheduled yet. When your plan has a renewal date, it will appear here well in advance.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r: RenewalRow) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">
                    {r.renewal_period || r.renewal_date.slice(0, 4)} renewal — {r.product_type ?? "Coverage"} {r.carrier ?? ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.carrier} {r.plan_name} · {r.renewal_date}
                  </p>
                </div>
                <StatusChip status={r.status} />
              </div>
              <p className="mt-3 text-sm text-navy/75">{RENEWAL_COPY[r.status] ?? "Your agent will reach out to review your options before this date."}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------- refer someone ------------------------------- */

function ReferralsView() {
  const queryClient = useQueryClient();
  const referrals = useQuery({ queryKey: ["my-referrals"], queryFn: api.myReferrals });
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [relationship, setRelationship] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [consent, setConsent] = useState<boolean>(false);

  const submit = useMutation({
    mutationFn: () =>
      api.submitReferral({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        relationship: relationship.trim() || undefined,
        message: message.trim() || undefined,
        consent,
      }),
    onSuccess: () => {
      toast.success("Thank you — we'll reach out thoughtfully.");
      setName("");
      setEmail("");
      setPhone("");
      setRelationship("");
      setMessage("");
      setConsent(false);
      void queryClient.invalidateQueries({ queryKey: ["my-referrals"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = referrals.data?.referrals ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="eyebrow text-gold">Refer Someone</p>
        <h2 className="display mt-2 text-2xl text-navy">Share Victora with someone you trust</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Just a name and a way to reach them. We'll introduce ourselves gently — no pressure, ever.
        </p>
        <p className="mt-3 rounded-md border border-gold/40 bg-gold/[0.05] p-3 text-xs leading-relaxed text-navy/75">
          Please do not enter medical, financial, Social Security, or other sensitive information about the person you are referring — only their name and
          contact information, and only if you have their permission.
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Their name</Label>
            <Input className="mt-2" value={name} placeholder="Jordan Alvarez" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Email (optional)</Label>
              <Input className="mt-2" type="email" value={email} placeholder="jordan@example.com" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Phone (optional)</Label>
              <Input className="mt-2" value={phone} placeholder="(555) 555-5555" onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Relationship (optional)</Label>
            <Input className="mt-2" value={relationship} placeholder="Friend, coworker, family…" onChange={(e) => setRelationship(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">A note for us (optional)</Label>
            <Textarea className="mt-2" rows={2} value={message} placeholder="Anything that helps us reach out thoughtfully…" onChange={(e) => setMessage(e.target.value)} />
          </div>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
            <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <span>I have this person's permission to share their contact information with Victora.</span>
          </label>
          <Button
            className="w-full bg-gold text-navy-deep hover:bg-gold-light"
            disabled={name.trim().length < 2 || (email.trim().length === 0 && phone.trim().length < 7) || !consent || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Send referral
          </Button>
        </div>
      </div>
      <div>
        <p className="eyebrow text-navy/60">My referrals</p>
        {rows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No referrals yet — and no pressure. When someone you know needs coverage, they'll be in good hands.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((r: ReferralRow) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="text-sm font-medium text-navy">{r.referred_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.relationship || "Referred"} · {fmtDateTime(r.created_at)}
                  </p>
                </div>
                <StatusChip status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- preferences ------------------------------- */

function PreferencesView() {
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: ["my-preferences"], queryFn: api.myPreferences });

  const save = useMutation({
    mutationFn: (body: { email?: boolean; sms?: boolean; phone?: boolean; portal?: boolean; preferredLanguage?: string }) => api.savePreferences(body),
    onSuccess: () => {
      toast.success("Preferences saved");
      void queryClient.invalidateQueries({ queryKey: ["my-preferences"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (prefs.isLoading) {
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-gold" />;
  }

  const p: CommPrefs | undefined = prefs.data?.preferences;

  const legal = useQuery({ queryKey: ["my-legal"], queryFn: api.myLegal });
  const acceptDoc = useMutation({
    mutationFn: (v: { docKey: string; version: number }) => api.acceptLegal(v.docKey, v.version),
    onSuccess: () => {
      toast.success("Consent recorded — thank you");
      void queryClient.invalidateQueries({ queryKey: ["my-legal"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const consentCopy: Record<string, string> = {
    none: "No email/SMS consent on file yet",
    opted_in: p?.consent_at ? `Opted in ${fmtDateTime(p.consent_at)} · from your Victora portal` : "Opted in",
    opted_out: p?.optout_at ? `Opted out ${fmtDateTime(p.optout_at)}` : "Opted out",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="eyebrow text-gold">Preferences</p>
        <h2 className="display mt-2 flex items-center gap-2 text-2xl text-navy">
          <SlidersHorizontal className="h-5 w-5 text-gold" />
          How Victora reaches you
        </h2>
        <div className="mt-6 space-y-4">
          {([
            { key: "portal", label: "Victora portal notifications", desc: "Always on — everything arrives safely in My Victora.", value: true, locked: true },
            { key: "email", label: "Email updates", desc: "Important updates by email when delivery goes live.", value: (p?.email ?? 0) === 1, locked: false },
            { key: "sms", label: "Text messages", desc: "Short texts for time-sensitive items when delivery goes live.", value: (p?.sms ?? 0) === 1, locked: false },
            { key: "phone", label: "Phone calls from my agent", desc: "Your agent may call about your account.", value: (p?.phone ?? 0) === 1, locked: false },
          ] as { key: "portal" | "email" | "sms" | "phone"; label: string; desc: string; value: boolean; locked: boolean }[]).map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4 rounded-md border border-border bg-background p-4">
              <div>
                <p className="text-sm font-medium text-navy">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.desc}</p>
              </div>
              <Checkbox className="mt-1" checked={row.value} disabled={row.locked} onCheckedChange={(v) => save.mutate({ [row.key]: v === true })} />
            </div>
          ))}
          <div className="rounded-md border border-border bg-background p-4">
            <Label className="text-xs uppercase tracking-[0.12em] text-navy/60">Preferred language</Label>
            <select
              className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-navy sm:max-w-[220px]"
              value={p?.preferred_language ?? "English"}
              onChange={(e) => save.mutate({ preferredLanguage: e.target.value })}
            >
              <option>English</option>
              <option>Español</option>
            </select>
          </div>
        </div>
        <div className="mt-6 rounded-md border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-navy/80">Consent status:</span> {consentCopy[p?.consent_status ?? "none"] ?? "—"}
          </p>
          <p className="mt-1">
            Email and text delivery are not active yet — right now everything arrives in your Victora portal, always. When email and SMS go live, only the
            channels you opted into will be used, and you can opt out anytime.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="eyebrow text-gold">Legal & Consent</p>
        <h2 className="display mt-2 text-2xl text-navy">Policies & electronic consent</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          These documents are versioned. When Victora updates a policy, your acceptance of the new version is recorded here with a timestamp.
        </p>
        <div className="mt-5 space-y-4">
          {(legal.data?.documents ?? []).map((doc) => {
            const accepted = (legal.data?.acceptances ?? []).find((a) => a.doc_key === doc.doc_key && a.version === doc.version);
            return (
              <div key={doc.doc_key} className="rounded-md border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-navy">
                      {doc.title} <span className="text-xs text-muted-foreground">· v{doc.version}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">Effective {fmtDateTime(doc.effective_at)}</p>
                  </div>
                  {accepted ? (
                    <span className="rounded bg-green-100 px-2 py-1 text-[10px] font-medium text-green-800">Accepted {fmtDateTime(accepted.accepted_at)}</span>
                  ) : (
                    <Button size="sm" className="bg-navy text-ivory hover:bg-navy/90" onClick={() => acceptDoc.mutate({ docKey: doc.doc_key, version: doc.version })}>
                      I agree
                    </Button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{doc.body}</p>
              </div>
            );
          })}
          {(legal.data?.documents ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Policies will appear here once published.</p> : null}
        </div>
      </div>
    </div>
  );
}
