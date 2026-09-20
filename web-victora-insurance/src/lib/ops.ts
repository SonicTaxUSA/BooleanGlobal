/**
 * Victora operations platform: digital intake, document vault, authorizations,
 * messaging, service tickets, renewals, referrals, tasks/automations, and the
 * audit trail. All persistence is localStorage for the MVP — swap the store
 * functions for a secure backend before handling real client PHI.
 */
import { loadLeads, loadAppointments, newId, type Lead, type Appointment } from "./crm";

/* ---------------------------------- types --------------------------------- */

export type IntakeArea = "health" | "dental" | "vision";

export type IntakeSubmission = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  area: IntakeArea;
  householdSize: number;
  currentlyInsured: boolean;
  currentCarrier: string;
  doctors: string;
  medications: string;
  needs: string[];
  notes: string;
  status: "new" | "reviewed";
};

export type DocumentCategory = "id" | "income" | "policy" | "medical" | "tax" | "other";

export type StoredDocument = {
  id: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  fileName: string;
  sizeBytes: number;
  category: DocumentCategory;
  note: string;
  status: "pending" | "verified" | "rejected";
};

export type AuthKind = "hipaa" | "agent-of-record" | "communications";

export type AuthorizationRecord = {
  id: string;
  createdAt: string;
  clientName: string;
  email: string;
  kind: AuthKind;
  signature: string;
};

export type Message = {
  id: string;
  at: string;
  from: "client" | "agency";
  body: string;
};

export type Thread = {
  id: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  messages: Message[];
  unreadForAgency: boolean;
};

export type TicketCategory = "plan-change" | "id-card" | "claim" | "billing" | "doctor-network" | "other";

export type Ticket = {
  id: string;
  number: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  category: TicketCategory;
  priority: "low" | "normal" | "high";
  status: "open" | "in-progress" | "resolved";
  description: string;
  updates: { id: string; at: string; by: string; body: string }[];
};

export type Renewal = {
  id: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  carrier: string;
  planName: string;
  effectiveDate: string;
  status: "scheduled" | "in-review" | "completed";
  notes: string;
};

export type Referral = {
  id: string;
  createdAt: string;
  referrerName: string;
  referrerEmail: string;
  referralName: string;
  referralContact: string;
  interest: string;
  notes: string;
  status: "new" | "contacted" | "converted";
};

export type Task = {
  id: string;
  createdAt: string;
  dueAt: string;
  title: string;
  detail: string;
  source: "manual" | "automation";
  done: boolean;
  refType?: "lead" | "ticket" | "appointment" | "intake" | "renewal";
  refId?: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
};

export type AutomationSettings = {
  newLeadFollowUp: boolean;
  appointmentConfirmation: boolean;
  ticketResponse: boolean;
  renewalReminder: boolean;
};

export const DEFAULT_AUTOMATIONS: AutomationSettings = {
  newLeadFollowUp: true,
  appointmentConfirmation: true,
  ticketResponse: true,
  renewalReminder: true,
};

export const INTAKE_NEEDS: string[] = [
  "Lower my monthly premium",
  "My doctor must stay in network",
  "Prescription drug coverage",
  "Dental and vision included",
  "Low deductible / low out-of-pocket",
  "Coverage for a planned procedure",
  "Help understanding my current plan",
];

export const AUTH_DOCUMENTS: { kind: AuthKind; title: string; summary: string; body: string }[] = [
  {
    kind: "hipaa",
    title: "HIPAA Authorization to Use & Disclose Protected Health Information",
    summary: "Allows Victora to request and discuss your health information with carriers and the Marketplace on your behalf.",
    body:
      "I authorize Victora Insurance and its licensed agents to request, receive, and discuss my protected health information — including plan applications, eligibility determinations, and enrollment records — with insurance carriers, the Health Insurance Marketplace, and healthcare providers as needed to evaluate, recommend, and enroll me in coverage. This authorization expires 24 months from the date signed unless revoked earlier in writing. I understand I may revoke this authorization at any time and that treatment, payment, enrollment, or eligibility for benefits may not be conditioned on signing it.",
  },
  {
    kind: "agent-of-record",
    title: "Agent of Record / Scope of Services",
    summary: "Appoints Victora as your agent of record and defines the services we provide at no cost to you.",
    body:
      "I appoint Victora Insurance as my licensed insurance agency of record. Victora will provide, at no cost to me: plan comparisons and education, eligibility and subsidy review, enrollment assistance, policy servicing (changes, updates, ID cards), claims and billing advocacy, annual renewal reviews, and ongoing support. Victora is compensated by carriers via commissions; my premium is the same whether I use an agent or enroll directly. I understand Victora does not offer every plan available in my area.",
  },
  {
    kind: "communications",
    title: "Consent to Communicate (Email / Text / Phone)",
    summary: "Consent for Victora to contact you by your preferred channels, including automated reminders.",
    body:
      "I consent to Victora Insurance contacting me by email, phone, and/or text message at the contact information I provide, including appointment confirmations, renewal reminders, and document requests. Message and data rates may apply. I understand I can opt out at any time by replying STOP or notifying the agency in writing.",
  },
];

export const TICKET_CATEGORIES: { id: TicketCategory; label: string }[] = [
  { id: "plan-change", label: "Plan Change" },
  { id: "id-card", label: "ID Card" },
  { id: "claim", label: "Claim Help" },
  { id: "billing", label: "Billing / Premium" },
  { id: "doctor-network", label: "Doctor / Network" },
  { id: "other", label: "Something Else" },
];

export const DOC_CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: "id", label: "Photo ID" },
  { id: "income", label: "Income Proof" },
  { id: "policy", label: "Policy / Plan Doc" },
  { id: "medical", label: "Medical Record" },
  { id: "tax", label: "Tax Form" },
  { id: "other", label: "Other" },
];

/* -------------------------------- storage --------------------------------- */

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  return safeParse<T[]>(window.localStorage.getItem(key), []);
}

function saveList<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

const K = {
  intake: "victora.intake.v1",
  documents: "victora.documents.v1",
  authorizations: "victora.authorizations.v1",
  threads: "victora.threads.v1",
  tickets: "victora.tickets.v1",
  renewals: "victora.renewals.v1",
  referrals: "victora.referrals.v1",
  tasks: "victora.tasks.v1",
  audit: "victora.audit.v1",
  automations: "victora.automations.v1",
} as const;

export const loadIntake = (): IntakeSubmission[] => loadList<IntakeSubmission>(K.intake);
export const saveIntake = (items: IntakeSubmission[]): void => saveList(K.intake, items);
export const loadDocuments = (): StoredDocument[] => loadList<StoredDocument>(K.documents);
export const saveDocuments = (items: StoredDocument[]): void => saveList(K.documents, items);
export const loadAuthorizations = (): AuthorizationRecord[] => loadList<AuthorizationRecord>(K.authorizations);
export const saveAuthorizations = (items: AuthorizationRecord[]): void => saveList(K.authorizations, items);
export const loadThreads = (): Thread[] => loadList<Thread>(K.threads);
export const saveThreads = (items: Thread[]): void => saveList(K.threads, items);
export const loadTickets = (): Ticket[] => loadList<Ticket>(K.tickets);
export const saveTickets = (items: Ticket[]): void => saveList(K.tickets, items);
export const loadRenewals = (): Renewal[] => loadList<Renewal>(K.renewals);
export const saveRenewals = (items: Renewal[]): void => saveList(K.renewals, items);
export const loadReferrals = (): Referral[] => loadList<Referral>(K.referrals);
export const saveReferrals = (items: Referral[]): void => saveList(K.referrals, items);
export const loadTasks = (): Task[] => loadList<Task>(K.tasks);
export const saveTasks = (items: Task[]): void => saveList(K.tasks, items);
export const loadAudit = (): AuditEvent[] => loadList<AuditEvent>(K.audit);
export const saveAudit = (items: AuditEvent[]): void => saveList(K.audit, items);

export function loadAutomationSettings(): AutomationSettings {
  if (typeof window === "undefined") return DEFAULT_AUTOMATIONS;
  return { ...DEFAULT_AUTOMATIONS, ...safeParse<Partial<AutomationSettings>>(window.localStorage.getItem(K.automations), {}) };
}

export function saveAutomationSettings(s: AutomationSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(K.automations, JSON.stringify(s));
}

/* ------------------------------ audit trail ------------------------------- */

export function logAudit(actor: string, action: string): void {
  const events = loadAudit();
  saveAudit([{ id: newId(), at: new Date().toISOString(), actor, action }, ...events].slice(0, 500));
}

/* --------------------------- automation engine ---------------------------- */

const DAY_MS = 24 * 3600 * 1000;

function dedupeKey(t: Task): string {
  return `${t.source}:${t.refType ?? "-"}:${t.refId ?? "-"}:${t.title}`;
}

/**
 * Rule-based automation: generates follow-up tasks from new leads, upcoming
 * appointments, open tickets, and approaching renewals. Safe to run repeatedly —
 * duplicate rules are skipped.
 */
export function runAutomations(): Task[] {
  const settings = loadAutomationSettings();
  const tasks = loadTasks();
  const seen = new Set(tasks.map(dedupeKey));
  const generated: Task[] = [];

  const push = (t: Omit<Task, "id" | "createdAt" | "done">): void => {
    const task: Task = { ...t, id: newId(), createdAt: new Date().toISOString(), done: false };
    if (seen.has(dedupeKey(task))) return;
    seen.add(dedupeKey(task));
    generated.push(task);
  };

  if (settings.newLeadFollowUp) {
    for (const lead of loadLeads()) {
      if (lead.stage === "new") {
        push({
          dueAt: new Date(Date.now() + DAY_MS).toISOString(),
          title: `Call new lead: ${lead.firstName} ${lead.lastName}`,
          detail: `Source: ${lead.source.replace("-", " ")} · Coverage: ${lead.quote.coverageType} · Preferred contact: ${lead.preferredContact}`,
          source: "automation",
          refType: "lead",
          refId: lead.id,
        });
      }
    }
  }

  if (settings.appointmentConfirmation) {
    for (const appt of loadAppointments()) {
      if (new Date(`${appt.date}T${appt.time}`).getTime() > Date.now()) {
        push({
          dueAt: new Date(Date.now() + DAY_MS).toISOString(),
          title: `Confirm appointment: ${appt.name} (${appt.date} ${appt.time})`,
          detail: `Topic: ${appt.topic} · Channel: ${appt.channel}`,
          source: "automation",
          refType: "appointment",
          refId: appt.id,
        });
      }
    }
  }

  if (settings.ticketResponse) {
    for (const ticket of loadTickets()) {
      if (ticket.status === "open") {
        push({
          dueAt: new Date(Date.now() + DAY_MS).toISOString(),
          title: `Respond to ticket #${ticket.number}: ${ticket.subject}`,
          detail: `${ticket.clientName} · Priority: ${ticket.priority}`,
          source: "automation",
          refType: "ticket",
          refId: ticket.id,
        });
      }
    }
  }

  if (settings.renewalReminder) {
    for (const renewal of loadRenewals()) {
      if (renewal.status !== "completed") {
        const days = (new Date(renewal.effectiveDate).getTime() - Date.now()) / DAY_MS;
        if (days <= 60) {
          push({
            dueAt: new Date(Date.now() + 2 * DAY_MS).toISOString(),
            title: `Renewal review: ${renewal.clientName} (${renewal.carrier})`,
            detail: `Effective ${renewal.effectiveDate} · ${Math.max(0, Math.round(days))} days out`,
            source: "automation",
            refType: "renewal",
            refId: renewal.id,
          });
        }
      }
    }
  }

  if (generated.length > 0) {
    saveTasks([...generated, ...tasks]);
    logAudit("automation", `Generated ${generated.length} task${generated.length === 1 ? "" : "s"}`);
  }
  return [...generated, ...loadTasks()];
}

/* ---------------------------- data management ----------------------------- */

export function exportAllData(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      leads: loadLeads(),
      appointments: loadAppointments(),
      intake: loadIntake(),
      documents: loadDocuments(),
      authorizations: loadAuthorizations(),
      threads: loadThreads(),
      tickets: loadTickets(),
      renewals: loadRenewals(),
      referrals: loadReferrals(),
      tasks: loadTasks(),
      audit: loadAudit(),
    },
    null,
    2,
  );
}

export function resetAllData(): void {
  Object.values(K).forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.removeItem("victora.leads.v1");
  window.localStorage.removeItem("victora.appointments.v1");
  logAudit("admin", "All workspace data reset");
}

export function nextTicketNumber(): string {
  return String(1000 + loadTickets().length + 1);
}

export { newId };
export type { Lead, Appointment };
