/**
 * VictoraDB — the agency's single Durable Object ("victora-main") owning all
 * durable SQLite state: users, sessions, households, Master Client Records,
 * leads, intakes, timeline, appointments, tasks, notifications, and audit logs.
 *
 * Security model:
 *  - Passwords: PBKDF2-SHA256 (100k iterations) with per-user random salt.
 *  - Sessions: opaque 256-bit tokens in HttpOnly / Secure / SameSite=None cookies.
 *  - Authorization: enforced HERE, per route — never in the UI. Roles:
 *    client < agent < manager < compliance < super_admin. Clients can only
 *    read/write their own household; agents only assigned clients; managers
 *    and compliance see agency-wide data (compliance read-focused).
 */
import { DurableObject } from "cloudflare:workers";

export type Role = "client" | "agent" | "manager" | "compliance" | "super_admin";

export const JOURNEY_STAGES = ["info_received", "agent_review", "options_prepared", "client_review", "enrollment", "active"] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const JOURNEY_LABEL: Record<JourneyStage, string> = {
  info_received: "Information Received",
  agent_review: "Agent Review",
  options_prepared: "Options Prepared",
  client_review: "Review Your Options",
  enrollment: "Enrollment",
  active: "Coverage Active",
};

export const LEAD_STAGES = ["new", "contacted", "intake", "documents", "quoting", "client_review", "enrollment", "active", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  intake: "Intake",
  documents: "Documents",
  quoting: "Quoting",
  client_review: "Client Review",
  enrollment: "Enrollment",
  active: "Active",
  lost: "Lost / Closed",
};

export const SOURCES = ["Instagram", "Facebook", "Google", "Website", "Referral", "Sonic Tax USA", "Partner", "Walk-in", "Agent", "Other"] as const;

export const TICKET_CATEGORIES = [
  "Insurance Card", "Doctor / Network", "Prescription", "Billing / Premium", "Coverage Question",
  "Household Change", "Income Change", "Address Change", "New Baby", "Marriage",
  "Dental", "Vision", "Renewal", "Cancellation / Termination Request", "Other",
] as const;
export const TICKET_STATUSES = ["new", "in_progress", "waiting_on_client", "waiting_external", "resolved", "closed"] as const;
export const POLICY_PRODUCT_TYPES = ["Health", "Dental", "Vision"] as const;
export const POLICY_STATUSES = ["pending", "active", "terminated", "expired", "cancelled", "unknown"] as const;
export const RENEWAL_STATUSES = ["upcoming", "review_needed", "contacted", "waiting_client", "reviewing", "completed", "not_renewed", "lost"] as const;
export const REFERRAL_STATUSES = ["submitted", "contacted", "qualified", "converted", "closed"] as const;
export const WELCOME_KEYS = ["review_plan", "open_carrier_portal", "save_contact", "review_network", "review_prescriptions"] as const;
export const COMMISSION_TYPES = ["first_year", "renewal", "adjustment", "chargeback"] as const;
export const COMMISSION_STATUSES = ["expected", "received", "partial", "reversed", "disputed", "written_off"] as const;
export const APPOINTMENT_STATUSES = ["requested", "confirmed", "rescheduled", "cancelled", "completed", "no_show"] as const;
export const MEETING_TYPES = ["phone", "video", "in_person"] as const;
export const MARKETING_STATUSES = ["draft", "review", "approved", "rejected", "archived"] as const;
// Complaint SOP lifecycle: Received → Assigned → Investigating → Resolution
// Proposed → Resolved → Closed. "open" is accepted as a legacy alias.
export const COMPLAINT_STATUSES = ["open", "received", "assigned", "investigating", "resolution_proposed", "resolved", "closed"] as const;
export const LEGAL_DOC_STATUSES = ["draft", "review", "approved", "active", "archived"] as const;
export const LEGAL_DOC_KEYS = ["privacy_policy", "terms_of_use", "electronic_consent"] as const;
export const DELIVERY_STATUSES = ["queued", "sending", "delivered", "bounced", "failed", "not_configured"] as const;

const STAFF_ROLES: Role[] = ["agent", "manager", "compliance", "super_admin"];
const SESSION_DAYS = 7;
const encoder = new TextEncoder();

type Env = {
  STAFF_INVITE_CODE?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  SMS_ACCOUNT_SID?: string;
  SMS_AUTH_TOKEN?: string;
  SMS_FROM?: string;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  name: string;
  role: Role;
  phone: string;
  created_at: number;
  active?: number;
  is_test?: number;
  failed_attempts?: number;
  locked_until?: number | null;
};

type ProfileRow = {
  id: string;
  user_id: string | null;
  household_id: string;
  agent_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  journey_stage: JourneyStage;
  source: string;
  campaign: string;
  created_at: number;
  updated_at: number;
};

/* ------------------------------- crypto utils ------------------------------ */

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100_000 }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uid(prefix = ""): string {
  return `${prefix}${randomToken(9)}`;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* --------------------------------- helpers --------------------------------- */

function bad(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function publicUser(u: UserRow): { id: string; email: string; name: string; role: Role; phone: string } {
  return { id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone };
}

type Body = Record<string, unknown>;

function str(body: Body, key: string): string {
  const v = body[key];
  return typeof v === "string" ? v.trim() : "";
}

function bool(body: Body, key: string): boolean {
  return body[key] === true;
}

/** Parses "2026-09-15" + "1:00 PM" into a real timestamp (12h strings fail Date parsing). */
function apptTime(date: string, time: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (!m) return new Date(`${date}T${time}`).getTime();
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return new Date(`${date}T${String(h).padStart(2, "0")}:${m[2]}:00`).getTime();
}

/** Strips anything unsafe out of a user-supplied download filename. */
function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 120) || "document";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const DOCUMENT_MIME_WHITELIST = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"] as const;
export const DOC_CATEGORIES = ["Identity", "Income", "Household", "Coverage Loss", "Eligibility", "Enrollment", "Other"] as const;
const MAX_UPLOAD_BYTES = 8_000_000;
const BLOB_CHUNK = 96 * 1024; // below the 128 KiB per-value DO storage limit

function strArray(body: Body, key: string): string[] {
  const v = body[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/* --------------------------------- the DO ---------------------------------- */

export class VictoraDB extends DurableObject<Env> {
  private sql: DurableObjectStorage["sql"];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
        name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, primary_email TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS household_members (
        id TEXT PRIMARY KEY, household_id TEXT NOT NULL, name TEXT NOT NULL, dob TEXT DEFAULT '',
        relationship TEXT DEFAULT '', tobacco INTEGER DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS client_profiles (
        id TEXT PRIMARY KEY, user_id TEXT, household_id TEXT NOT NULL, agent_id TEXT,
        first_name TEXT NOT NULL, last_name TEXT DEFAULT '', email TEXT NOT NULL, phone TEXT DEFAULT '',
        journey_stage TEXT NOT NULL DEFAULT 'info_received', source TEXT DEFAULT 'Website', campaign TEXT DEFAULT '',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY, client_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT DEFAULT '',
        source TEXT DEFAULT 'Website', campaign TEXT DEFAULT '', coverage_type TEXT DEFAULT '', zip TEXT DEFAULT '',
        details TEXT DEFAULT '', stage TEXT NOT NULL DEFAULT 'new', assigned_agent TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS intakes (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, area TEXT NOT NULL, payload TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL, reviewed_by TEXT, reviewed_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS coverage_needs (
        id TEXT PRIMARY KEY, intake_id TEXT NOT NULL, need TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, at INTEGER NOT NULL, actor TEXT DEFAULT 'system',
        kind TEXT DEFAULT 'event', label TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY, at INTEGER NOT NULL, actor_id TEXT DEFAULT '', actor_role TEXT DEFAULT '',
        action TEXT NOT NULL, target TEXT DEFAULT '', detail TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY, client_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT DEFAULT '',
        date TEXT NOT NULL, time TEXT NOT NULL, topic TEXT DEFAULT '', channel TEXT DEFAULT 'phone',
        notes TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, detail TEXT DEFAULT '', due_at INTEGER NOT NULL,
        source TEXT DEFAULT 'automation', done INTEGER DEFAULT 0, ref_type TEXT DEFAULT '', ref_id TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, at INTEGER NOT NULL, title TEXT NOT NULL,
        body TEXT DEFAULT '', read INTEGER DEFAULT 0, channels TEXT DEFAULT 'portal'
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);

    // Idempotent column additions for databases created before these fields.
    for (const stmt of [
      "ALTER TABLE client_profiles ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'English'",
      "ALTER TABLE leads ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'English'",
      "ALTER TABLE appointments ADD COLUMN source TEXT NOT NULL DEFAULT 'Website'",
      "ALTER TABLE tasks ADD COLUMN assigned_to TEXT DEFAULT ''",
      "ALTER TABLE tasks ADD COLUMN client_id TEXT DEFAULT ''",
      "ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'normal'",
      "ALTER TABLE client_profiles ADD COLUMN relationship_status TEXT NOT NULL DEFAULT 'prospect'",
    ]) {
      try {
        this.sql.exec(stmt);
      } catch {
        /* column already exists */
      }
    }

    // Sprint 4 column additions (idempotent).
    for (const stmt of [
      "ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
      "ALTER TABLE users ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN locked_until INTEGER",
      "ALTER TABLE client_profiles ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE leads ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE notification_deliveries ADD COLUMN provider TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE notification_deliveries ADD COLUMN destination TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE notification_deliveries ADD COLUMN template TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE notification_deliveries ADD COLUMN provider_message_id TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE notification_deliveries ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE notification_deliveries ADD COLUMN error TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE appointments ADD COLUMN status TEXT NOT NULL DEFAULT 'requested'",
      "ALTER TABLE appointments ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30",
      "ALTER TABLE appointments ADD COLUMN meeting_type TEXT NOT NULL DEFAULT 'phone'",
      "ALTER TABLE appointments ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/New_York'",
      "ALTER TABLE appointments ADD COLUMN assigned_agent TEXT DEFAULT ''",
      "ALTER TABLE appointments ADD COLUMN cancelled_at INTEGER",
      "ALTER TABLE appointments ADD COLUMN completed_at INTEGER",
      "ALTER TABLE legal_docs ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
    ]) {
      try {
        this.sql.exec(stmt);
      } catch {
        /* column already exists */
      }
    }
    // Map legacy rows into the legal workflow / complaint SOP statuses.
    this.sql.exec("UPDATE legal_docs SET status = 'active' WHERE active = 1 AND status = 'draft'");
    this.sql.exec("UPDATE complaints SET status = 'received' WHERE status = 'open'");

    // Sprint 2: documents, authorizations, quote presentations.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS document_requests (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, requested_by TEXT DEFAULT '',
        category TEXT NOT NULL, document_type TEXT NOT NULL, instructions TEXT DEFAULT '',
        due_date TEXT DEFAULT '', required INTEGER DEFAULT 1, status TEXT DEFAULT 'open',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, request_id TEXT,
        document_type TEXT DEFAULT '', category TEXT DEFAULT '',
        original_filename TEXT NOT NULL, stored_key TEXT NOT NULL, mime_type TEXT NOT NULL,
        size INTEGER DEFAULT 0, status TEXT DEFAULT 'uploaded', uploaded_by TEXT DEFAULT '',
        reviewed_by TEXT, review_note TEXT DEFAULT '', rejection_reason TEXT DEFAULT '',
        uploaded_at INTEGER NOT NULL, reviewed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS authorization_templates (
        id TEXT PRIMARY KEY, template_key TEXT NOT NULL, name TEXT NOT NULL, version INTEGER NOT NULL,
        body TEXT NOT NULL, active INTEGER DEFAULT 1, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS authorizations (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, template_id TEXT NOT NULL, template_version INTEGER NOT NULL,
        template_name TEXT DEFAULT '', signed_text TEXT DEFAULT '', signer_name TEXT DEFAULT '', signer_role TEXT DEFAULT 'client',
        signature TEXT DEFAULT '', method TEXT DEFAULT 'electronic_signature', signed_at INTEGER,
        ip TEXT DEFAULT '', user_agent TEXT DEFAULT '', agent_id TEXT, expires_at INTEGER, revoked_at INTEGER,
        status TEXT DEFAULT 'pending', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS quote_presentations (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agent_id TEXT NOT NULL, title TEXT DEFAULT '',
        coverage_area TEXT DEFAULT '', status TEXT DEFAULT 'draft', sent_at INTEGER, viewed_at INTEGER,
        interested_option TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS quote_options (
        id TEXT PRIMARY KEY, presentation_id TEXT NOT NULL, label TEXT DEFAULT '', carrier TEXT DEFAULT '',
        plan_name TEXT DEFAULT '', metal_tier TEXT DEFAULT '', premium TEXT DEFAULT '', deductible TEXT DEFAULT '',
        oop_max TEXT DEFAULT '', pcp TEXT DEFAULT '', specialist TEXT DEFAULT '', urgent_care TEXT DEFAULT '',
        er TEXT DEFAULT '', generic_rx TEXT DEFAULT '', network_type TEXT DEFAULT '', dental_note TEXT DEFAULT '',
        vision_note TEXT DEFAULT '', notes TEXT DEFAULT '', doc_link TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS quote_interactions (
        id TEXT PRIMARY KEY, presentation_id TEXT NOT NULL, option_id TEXT DEFAULT '', client_id TEXT NOT NULL,
        action TEXT NOT NULL, message TEXT DEFAULT '', at INTEGER NOT NULL
      );
    `);

    // Sprint 3: messaging, service center, coverage records, renewals, referrals,
    // communication preferences, outbound delivery log, welcome checklist.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agent_id TEXT, subject TEXT DEFAULT '',
        status TEXT DEFAULT 'open', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_message_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, last_read_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_user_id TEXT DEFAULT '', sender_role TEXT NOT NULL,
        body TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER, message_type TEXT DEFAULT 'message',
        attachment_document_id TEXT, system_generated INTEGER DEFAULT 0
      );
      -- INTERNAL NOTES ARE STAFF-ONLY. They must never be selected into any
      -- client-facing payload. Client routes never read this table.
      CREATE TABLE IF NOT EXISTS internal_notes (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, author_id TEXT NOT NULL, author_role TEXT NOT NULL,
        author_name TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS service_tickets (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, ticket_number TEXT NOT NULL, category TEXT NOT NULL,
        description TEXT DEFAULT '', status TEXT DEFAULT 'new', priority TEXT DEFAULT 'normal',
        assigned_to TEXT, latest_response TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, author_id TEXT NOT NULL, author_role TEXT NOT NULL,
        body TEXT NOT NULL, internal INTEGER DEFAULT 0, created_at INTEGER NOT NULL
      );
      -- Victora servicing records — NOT a carrier system of record.
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, product_type TEXT NOT NULL, carrier TEXT DEFAULT '',
        plan_name TEXT DEFAULT '', policy_identifier TEXT DEFAULT '', effective_date TEXT DEFAULT '',
        termination_date TEXT DEFAULT '', status TEXT DEFAULT 'pending', monthly_premium TEXT DEFAULT '',
        deductible TEXT DEFAULT '', out_of_pocket_max TEXT DEFAULT '', network_type TEXT DEFAULT '',
        pcp_cost TEXT DEFAULT '', specialist_cost TEXT DEFAULT '', rx_summary TEXT DEFAULT '',
        dental_flag INTEGER DEFAULT 0, vision_flag INTEGER DEFAULT 0, carrier_portal_url TEXT DEFAULT '',
        provider_search_url TEXT DEFAULT '', carrier_phone TEXT DEFAULT '', agent_id TEXT,
        source_quote_option_id TEXT, notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS policy_members (
        id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, name TEXT NOT NULL, relationship TEXT DEFAULT '', dob TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS renewals (
        id TEXT PRIMARY KEY, policy_id TEXT NOT NULL, client_id TEXT NOT NULL, renewal_period TEXT DEFAULT '',
        renewal_date TEXT DEFAULT '', status TEXT DEFAULT 'upcoming', assigned_agent TEXT,
        first_contact_at INTEGER, client_response_at INTEGER, review_completed_at INTEGER,
        outcome TEXT DEFAULT '', notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      -- Referral tracking only. Incentive payouts are NOT built (compliance review first).
      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY, referring_client_id TEXT NOT NULL, referred_name TEXT NOT NULL,
        referred_email TEXT DEFAULT '', referred_phone TEXT DEFAULT '', relationship TEXT DEFAULT '',
        status TEXT DEFAULT 'submitted', converted_client_id TEXT, source TEXT DEFAULT 'Client Referral',
        campaign TEXT DEFAULT '', message TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comm_prefs (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL UNIQUE, portal INTEGER DEFAULT 1, email INTEGER DEFAULT 0,
        sms INTEGER DEFAULT 0, phone INTEGER DEFAULT 0, preferred_language TEXT DEFAULT 'English',
        consent_status TEXT DEFAULT 'none', consent_at INTEGER, optout_at INTEGER, source TEXT DEFAULT '', updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT DEFAULT '', event TEXT DEFAULT '',
        channel TEXT NOT NULL, title TEXT DEFAULT '', body TEXT DEFAULT '', status TEXT NOT NULL,
        ref_type TEXT DEFAULT '', ref_id TEXT DEFAULT '', created_at INTEGER NOT NULL, delivered_at INTEGER
      );
      -- Welcome center checklist — informational completion only.
      CREATE TABLE IF NOT EXISTS welcome_items (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL, item_key TEXT NOT NULL, completed_at INTEGER NOT NULL
      );
    `);

    // Sprint 4: communications templates, calendar ops, commission ledger,
    // compliance center, retention/legal framework, backups, launch readiness.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS communication_templates (
        id TEXT PRIMARY KEY, template_key TEXT NOT NULL, channel TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'English',
        subject TEXT DEFAULT '', body TEXT NOT NULL, version INTEGER NOT NULL, active INTEGER DEFAULT 0,
        created_by TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_licenses (
        id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, state TEXT NOT NULL, license_number TEXT NOT NULL,
        line_of_authority TEXT DEFAULT '', issue_date TEXT DEFAULT '', expiration TEXT DEFAULT '',
        status TEXT DEFAULT 'active', notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS carrier_appointments (
        id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, carrier TEXT NOT NULL, state TEXT NOT NULL, product TEXT DEFAULT '',
        effective_date TEXT DEFAULT '', termination_date TEXT DEFAULT '', status TEXT DEFAULT 'active',
        notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS certifications (
        id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, certification TEXT NOT NULL, completed_date TEXT DEFAULT '',
        expiration TEXT DEFAULT '', documentation TEXT DEFAULT '', status TEXT DEFAULT 'active',
        notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS marketing_reviews (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, campaign TEXT DEFAULT '', content TEXT NOT NULL,
        status TEXT DEFAULT 'draft', submitted_by TEXT DEFAULT '', reviewer TEXT DEFAULT '',
        decision_notes TEXT DEFAULT '', reviewed_at INTEGER, created_by TEXT DEFAULT '',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      -- Complaint records and their notes are STAFF-ONLY. They never appear in
      -- any client-facing payload; a client-facing reply is an explicit action.
      CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY, client_id TEXT, complaint_type TEXT NOT NULL, channel TEXT DEFAULT 'phone',
        details TEXT DEFAULT '', owner_id TEXT, status TEXT DEFAULT 'open', resolution TEXT DEFAULT '',
        received_at INTEGER NOT NULL, closed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS complaint_notes (
        id TEXT PRIMARY KEY, complaint_id TEXT NOT NULL, author_id TEXT NOT NULL, author_role TEXT NOT NULL,
        body TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      -- Commission ledger — internal accounting/operations tracking only. NOT
      -- carrier payment processing. No fabricated schedules: manual entry of
      -- verified statement data until a real carrier integration exists.
      CREATE TABLE IF NOT EXISTS commission_records (
        id TEXT PRIMARY KEY, policy_id TEXT, client_id TEXT, carrier TEXT NOT NULL, product TEXT DEFAULT '',
        agent_id TEXT, statement_period TEXT DEFAULT '', commission_type TEXT DEFAULT 'first_year',
        expected_amount REAL DEFAULT 0, received_amount REAL DEFAULT 0, status TEXT DEFAULT 'expected',
        carrier_reference TEXT DEFAULT '', paid_date TEXT DEFAULT '', notes TEXT DEFAULT '',
        created_by TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commission_adjustments (
        id TEXT PRIMARY KEY, record_id TEXT NOT NULL, kind TEXT NOT NULL, amount REAL DEFAULT 0,
        reason TEXT DEFAULT '', created_by TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
        used_at INTEGER, created_by TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_availability (
        id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, weekday INTEGER NOT NULL, start_time TEXT NOT NULL,
        end_time TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      -- Legal/policy documents are admin-managed and versioned. Formal legal
      -- text must come from qualified legal review — never invented here.
      CREATE TABLE IF NOT EXISTS legal_docs (
        id TEXT PRIMARY KEY, doc_key TEXT NOT NULL, version INTEGER NOT NULL, title TEXT NOT NULL,
        body TEXT NOT NULL, effective_at INTEGER NOT NULL, active INTEGER DEFAULT 0,
        created_by TEXT DEFAULT '', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS legal_acceptances (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, doc_key TEXT NOT NULL, version INTEGER NOT NULL, accepted_at INTEGER NOT NULL
      );
      -- Retention framework ONLY: policies/holds are metadata. No automatic
      -- deletion exists; deletion rules require explicit approval to activate.
      CREATE TABLE IF NOT EXISTS retention_policies (
        id TEXT PRIMARY KEY, record_type TEXT NOT NULL UNIQUE, retention_days INTEGER, hold INTEGER DEFAULT 0,
        notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS backup_log (
        id TEXT PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL, record_count INTEGER DEFAULT 0,
        created_by TEXT DEFAULT '', note TEXT DEFAULT ''
      );
      -- Durable abuse-protection counters. Stored in the DO's SQLite storage so
      -- rate limits survive DO restarts (in-memory buckets did not).
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL
      );
    `);

    // Seed authorization templates once. Only the plain communications consent is
    // active — regulated authorization language stays a deactivated placeholder
    // until compliance loads the approved text as a new version.
    const templateCount = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM authorization_templates").toArray()[0].n;
    if (templateCount === 0) {
      const now = Date.now();
      const seed = (key: string, name: string, body: string, active: number): void => {
        this.sql.exec(
          "INSERT INTO authorization_templates (id, template_key, name, version, body, active, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
          uid("tpl_"), key, name, body, active, now,
        );
      };
      seed(
        "communications_consent",
        "Communications Consent",
        [
          "VICTORA COMMUNICATIONS CONSENT — Version 1",
          "",
          "By typing my full name below and submitting this form, I agree that Victora Insurance and its licensed agents may contact me by phone, text message, or email about health coverage options, my account, and my enrollment status, using the contact information I provided.",
          "",
          "I understand that:",
          "• I can withdraw this consent at any time by contacting Victora.",
          "• This consent covers communication about my own coverage and the household members listed on my account.",
          "• This is Victora's standard communications consent. It is NOT an insurance application, enrollment, or carrier authorization.",
          "• Message and data rates may apply for text messages.",
          "",
          "A record of this consent — including the exact text, version, date, and time — is preserved in Victora's Authorization Center.",
        ].join("\n"),
        1,
      );
      seed(
        "representation_authorization",
        "Client Service / Representation Authorization",
        "[PLACEHOLDER — PENDING COMPLIANCE-APPROVED LANGUAGE]\n\nThe versioned signature system is in place, but the exact approved authorization text for client representation has not yet been provided by compliance. Do not activate this template until the approved language is loaded as a new version.",
        0,
      );
      seed(
        "agent_of_record",
        "Agent of Record Authorization",
        "[PLACEHOLDER — PENDING COMPLIANCE-APPROVED LANGUAGE]\n\nThe exact agent-of-record form language must come from the applicable carrier or Marketplace forms. Do not activate this template until the approved language is loaded as a new version.",
        0,
      );
    }

    // Seed communication templates (English + Spanish architecture). Bodies
    // carry ONLY generic sign-in guidance — sensitive details live in My
    // Victora, never in outbound email/SMS text.
    const commCount = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM communication_templates").toArray()[0].n;
    if (commCount === 0) {
      const nowTs = Date.now();
      const cta = "Sign in to My Victora to view the details. You can reply to your agent there at any time.";
      const ctaEs = "Inicie sesión en My Victora para ver los detalles. Puede responder a su agente en cualquier momento.";
      const seedComm = (key: string, subjectEn: string, bodyEn: string, subjectEs: string, bodyEs: string): void => {
        this.sql.exec(
          "INSERT INTO communication_templates (id, template_key, channel, language, subject, body, version, active, created_by, created_at) VALUES (?, ?, 'email', 'English', ?, ?, 1, 1, 'system', ?)",
          uid("ctm_"), key, subjectEn, bodyEn, nowTs,
        );
        this.sql.exec(
          "INSERT INTO communication_templates (id, template_key, channel, language, subject, body, version, active, created_by, created_at) VALUES (?, ?, 'email', 'Spanish', ?, ?, 1, 1, 'system', ?)",
          uid("ctm_"), key, subjectEs, bodyEs, nowTs,
        );
      };
      seedComm("welcome", "Welcome to Victora Insurance", `Welcome to Victora! Your client account is ready. ${cta}`, "Bienvenido a Victora Insurance", `¡Bienvenido a Victora! Su cuenta de cliente está lista. ${ctaEs}`);
      seedComm("document_request", "Victora needs a document from you", `Victora has requested a document for your file. ${cta}`, "Victora necesita un documento de su parte", `Victora ha solicitado un documento para su expediente. ${ctaEs}`);
      seedComm("authorization_request", "An authorization is ready for your signature", `An authorization form is ready to review and sign. ${cta}`, "Una autorización está lista para su firma", `Un formulario de autorización está listo para revisar y firmar. ${ctaEs}`);
      seedComm("quote_ready", "Your coverage options are ready", `Your agent has prepared coverage options for you to compare. ${cta}`, "Sus opciones de cobertura están listas", `Su agente ha preparado opciones de cobertura para comparar. ${ctaEs}`);
      seedComm("appointment_confirmation", "Your Victora appointment is confirmed", `Your appointment with Victora is confirmed. ${cta}`, "Su cita con Victora está confirmada", `Su cita con Victora está confirmada. ${ctaEs}`);
      seedComm("appointment_reminder", "Reminder: your Victora appointment is coming up", `This is a reminder about your upcoming Victora appointment. ${cta}`, "Recordatorio: su cita con Victora se acerca", `Este es un recordatorio de su próxima cita con Victora. ${ctaEs}`);
      seedComm("message_received", "You have a new secure update from Victora Insurance", "You have a new secure update from Victora Insurance. Sensitive details stay inside My Victora — sign in to read the message.", "Tiene una nueva actualización segura de Victora Insurance", "Tiene una nueva actualización segura de Victora Insurance. Los detalles confidenciales permanecen dentro de My Victora: inicie sesión para leer el mensaje.");
      seedComm("ticket_update", "An update on your Victora service request", `Your Victora service request has an update. ${cta}`, "Hay una actualización de su solicitud de servicio", `Su solicitud de servicio de Victora tiene una actualización. ${ctaEs}`);
      seedComm("policy_activated", "Your Victora coverage is active", `Your coverage is now active. Your Welcome Center in My Victora will help you get started.`, "Su cobertura de Victora está activa", `Su cobertura ya está activa. Su Centro de Bienvenida en My Victora le ayudará a comenzar.`);
      seedComm("renewal_reminder", "Your coverage review is coming up", `Your coverage review is coming up. Your Victora agent will reach out to review your options. ${cta}`, "Su revisión de cobertura se acerca", `Su revisión de cobertura se acerca. Su agente de Victora se comunicará para revisar sus opciones. ${ctaEs}`);
      seedComm("password_reset", "Reset your Victora password", "A password reset was requested for your Victora account. Use the one-time code provided in the reset flow within 30 minutes. If you did not request this, you can ignore this message.", "Restablezca su contraseña de Victora", "Se solicitó un restablecimiento de contraseña para su cuenta de Victora. Utilice el código de un solo uso dentro de 30 minutos. Si no solicitó esto, puede ignorar este mensaje.");
    }

    // Seed legal/policy document PLACEHOLDER versions so versioning and
    // acceptance tracking exist. Final legal text must come from qualified
    // legal review — placeholders never promise compliance outcomes.
    const legalCount = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM legal_docs").toArray()[0].n;
    if (legalCount === 0) {
      const nowTs = Date.now();
      const seedLegal = (docKey: string, title: string): void => {
        this.sql.exec(
          "INSERT INTO legal_docs (id, doc_key, version, title, body, effective_at, active, created_by, created_at) VALUES (?, ?, 1, ?, ?, ?, 1, 'system', ?)",
          uid("lgl_"), docKey, title,
          `[PLACEHOLDER — PENDING LEGAL REVIEW]\n\nThis ${title} is admin-managed and versioned. The final approved text must be provided by qualified legal counsel before public launch. This version exists so versioning, publishing, and client acceptance tracking can operate; it makes no legal or compliance promises.`,
          nowTs, nowTs,
        );
      };
      seedLegal("privacy_policy", "Privacy Policy");
      seedLegal("terms_of_use", "Terms of Use");
      seedLegal("electronic_consent", "Electronic Communications Consent");
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    const method = request.method;

    try {
      if (method === "POST" && path === "/auth/register") return await this.register(request);
      if (method === "POST" && path === "/auth/register/staff") return await this.registerStaff(request);
      if (method === "POST" && path === "/auth/login") return await this.login(request);
      if (method === "POST" && path === "/auth/logout") return await this.logout(request);
      if (method === "GET" && path === "/auth/me") return await this.me(request);
      if (method === "POST" && path === "/auth/forgot") return await this.forgotPassword(request);
      if (method === "POST" && path === "/auth/reset") return await this.resetPassword(request);
      if (method === "GET" && path === "/legal") return this.publicLegal();

      if (method === "POST" && path === "/leads") return await this.captureLead(request);
      if (method === "POST" && path === "/appointments") return await this.bookAppointment(request);

      const user = this.userFor(request);
      if (user === null) return bad("Authentication required", 401);

      if (method === "GET" && path === "/me/overview") return this.clientOverview(user);
      if (method === "POST" && path === "/intake") return await this.submitIntake(request, user);
      if (method === "GET" && path === "/notifications") return this.listNotifications(user);
      if (method === "POST" && path.startsWith("/notifications/") && path.endsWith("/read")) {
        return this.markNotificationRead(user, path.split("/")[2]);
      }

      // --- client document / authorization / quote surfaces (role-checked) ---
      if (user.role === "client") {
        if (method === "GET" && path === "/me/documents") return this.myDocuments(user);
        if (method === "POST" && path === "/me/documents/upload") return await this.uploadDocument(request, user);
        if (method === "GET" && path === "/me/authorizations") return this.myAuthorizations(user);
        if (method === "GET" && path.startsWith("/me/authorizations/") && path.split("/").length === 4) {
          return this.authorizationText(user, path.split("/")[3]);
        }
        if (method === "POST" && path.startsWith("/me/authorizations/") && path.endsWith("/sign")) {
          return await this.signAuthorization(request, user, path.split("/")[3]);
        }
        if (method === "GET" && path === "/me/quotes") return this.myQuotes(user);
        if (method === "POST" && path.startsWith("/me/quotes/") && path.endsWith("/view")) return this.quoteViewed(user, path.split("/")[3]);
        if (method === "POST" && path.startsWith("/me/quotes/") && path.endsWith("/interest")) return await this.quoteInterest(request, user, path.split("/")[3]);
        if (method === "POST" && path.startsWith("/me/quotes/") && path.endsWith("/save")) return await this.quoteInteract(request, user, path.split("/")[3], "saved");
        if (method === "POST" && path.startsWith("/me/quotes/") && path.endsWith("/ask")) return await this.quoteInteract(request, user, path.split("/")[3], "question");

        // --- Sprint 3: client service surfaces ---
        if (method === "GET" && path === "/me/messages") return this.myMessages(user);
        if (method === "POST" && path === "/me/messages") return await this.sendClientMessage(request, user);
        if (method === "POST" && path === "/me/messages/read") return this.markConversationRead(user);
        if (method === "GET" && path === "/me/tickets") return this.myTickets(user);
        if (method === "POST" && path === "/me/tickets") return await this.createTicket(request, user);
        if (method === "GET" && path.startsWith("/me/tickets/") && path.split("/").length === 4) return this.ticketDetailClient(user, path.split("/")[3]);
        if (method === "POST" && path.startsWith("/me/tickets/") && path.endsWith("/reply")) return await this.ticketReplyClient(request, user, path.split("/")[3]);
        if (method === "GET" && path === "/me/policies") return this.myPolicies(user);
        if (method === "GET" && path === "/me/renewals") return this.myRenewals(user);
        if (method === "GET" && path === "/me/referrals") return this.myReferrals(user);
        if (method === "POST" && path === "/me/referrals") return await this.submitReferral(request, user);
        if (method === "GET" && path === "/me/preferences") return this.myPreferences(user);
        if (method === "POST" && path === "/me/preferences") return await this.savePreferences(request, user);
        if (method === "GET" && path === "/me/welcome") return this.myWelcome(user);
        if (method === "POST" && path === "/me/welcome") return await this.completeWelcomeItem(request, user);
        if (method === "GET" && path === "/me/legal") return this.myLegal(user);
        if (method === "POST" && path === "/me/legal/accept") return await this.acceptLegal(request, user);
      }

      // File bytes — served to authorized clients and staff only, never public.
      if (method === "GET" && path.startsWith("/documents/") && path.endsWith("/file")) {
        return await this.documentFile(user, path.split("/")[2]);
      }

      if (!STAFF_ROLES.includes(user.role)) return bad("Staff access required", 403);

      if (method === "GET" && path === "/staff/overview") return this.staffOverview(user);
      if (method === "GET" && path === "/leads") return this.listLeads(url, user);
      if (method === "POST" && path.startsWith("/leads/")) return await this.leadAction(request, user, path);
      if (method === "GET" && path === "/clients") return this.listClients(user);

      // --- Sprint 2: client-scoped document/authorization/quote routes (must run
      // before the generic /clients/ matchers below) ---
      if (method === "POST" && path.startsWith("/clients/") && path.endsWith("/document-requests")) {
        return await this.requestDocument(request, user, path.split("/")[2]);
      }
      if (method === "POST" && path.startsWith("/clients/") && path.includes("/documents/") && path.endsWith("/review")) {
        return await this.reviewDocument(request, user, path.split("/")[2], path.split("/")[4]);
      }
      if (method === "POST" && path.startsWith("/clients/") && path.endsWith("/authorizations/send")) {
        return await this.sendAuthorizationToClient(request, user, path.split("/")[2]);
      }
      if (method === "POST" && path.startsWith("/clients/") && path.endsWith("/quotes")) {
        return await this.createQuotePresentation(request, user, path.split("/")[2]);
      }

      // --- Sprint 3: client-scoped staff routes (before generic /clients/ matchers) ---
      if (method === "POST" && path.startsWith("/clients/") && path.endsWith("/notes")) {
        return await this.addInternalNote(request, user, path.split("/")[2]);
      }
      if (method === "POST" && path.startsWith("/clients/") && path.endsWith("/policies")) {
        return await this.createPolicy(request, user, path.split("/")[2]);
      }
      if (method === "POST" && path.startsWith("/clients/") && path.endsWith("/renewals")) {
        return await this.createRenewal(request, user, path.split("/")[2]);
      }

      if (method === "GET" && path.startsWith("/clients/")) return this.masterRecord(user, path.split("/")[2]);
      if (method === "POST" && path.startsWith("/clients/")) return await this.clientAction(request, user, path);
      if (method === "GET" && path === "/tasks") return this.listTasks();
      if (method === "POST" && path.startsWith("/tasks/") && path.endsWith("/done")) return this.completeTask(user, path.split("/")[2]);
      if (method === "GET" && path === "/appointments") return this.listAppointments();
      if (method === "GET" && path === "/team") return this.listTeam(user);
      if (method === "POST" && path.startsWith("/users/")) return await this.setUserRole(request, user, path);
      if (method === "GET" && path === "/audit") return this.listAudit(user);

      // --- Sprint 2: templates + staff quote surfaces ---
      if (method === "GET" && path === "/templates") return this.listTemplates(user);
      if (method === "POST" && path === "/templates") return await this.createTemplateVersion(request, user);
      if (method === "GET" && path === "/quotes") return this.listQuotePresentations(user);
      if (method === "GET" && path.startsWith("/quotes/")) return this.quoteDetail(user, path.split("/")[2]);
      if (method === "POST" && path.startsWith("/quotes/") && path.endsWith("/status")) return await this.setQuoteStatus(request, user, path.split("/")[2]);

      // --- Sprint 3: staff messaging, service, coverage, renewals, referrals ---
      if (method === "GET" && path === "/conversations") return this.listConversations(url, user);
      if (method === "GET" && path.startsWith("/conversations/") && path.split("/").length === 3) return this.conversationDetail(user, path.split("/")[2]);
      if (method === "POST" && path.startsWith("/conversations/") && path.endsWith("/reply")) return await this.staffReply(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/tickets") return this.listTickets(url, user);
      if (method === "GET" && path.startsWith("/tickets/") && path.split("/").length === 3) return this.ticketDetailStaff(user, path.split("/")[2]);
      if (method === "POST" && path.startsWith("/tickets/") && path.endsWith("/action")) return await this.ticketAction(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/policies") return this.listPolicies(user);
      if (method === "POST" && path.startsWith("/policies/") && path.endsWith("/update")) return await this.updatePolicy(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/renewals") return this.listRenewals(url, user);
      if (method === "POST" && path.startsWith("/renewals/") && path.endsWith("/action")) return await this.renewalAction(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/referrals") return this.listReferrals(user);
      if (method === "POST" && path.startsWith("/referrals/") && path.endsWith("/action")) return await this.referralAction(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/deliveries") return this.listDeliveries(user);

      // --- Sprint 4: management analytics, commissions, compliance, admin ---
      if (method === "GET" && path === "/analytics") return this.analytics(url, user);
      if (method === "GET" && path === "/commissions") return this.listCommissions(url, user);
      if (method === "POST" && path === "/commissions") return await this.createCommission(request, user);
      if (method === "POST" && path.startsWith("/commissions/") && path.endsWith("/action")) return await this.commissionAction(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/compliance/licenses") return this.listLicenses(user);
      if (method === "POST" && path === "/compliance/licenses") return await this.createLicense(request, user);
      if (method === "GET" && path === "/compliance/carrier-appointments") return this.listCarrierAppointments(user);
      if (method === "POST" && path === "/compliance/carrier-appointments") return await this.createCarrierAppointment(request, user);
      if (method === "GET" && path === "/compliance/certifications") return this.listCertifications(user);
      if (method === "POST" && path === "/compliance/certifications") return await this.createCertification(request, user);
      if (method === "GET" && path === "/compliance/marketing") return this.listMarketingReviews(user);
      if (method === "POST" && path === "/compliance/marketing") return await this.createMarketingReview(request, user);
      if (method === "POST" && path.startsWith("/compliance/marketing/") && path.endsWith("/action")) return await this.marketingAction(request, user, path.split("/")[3]);
      if (method === "GET" && path === "/compliance/complaints") return this.listComplaints(user);
      if (method === "POST" && path === "/compliance/complaints") return await this.createComplaint(request, user);
      if (method === "POST" && path.startsWith("/compliance/complaints/") && path.endsWith("/action")) return await this.complaintAction(request, user, path.split("/")[3]);
      if (method === "POST" && path.startsWith("/compliance/complaints/") && path.endsWith("/notes")) return await this.complaintNote(request, user, path.split("/")[3]);
      if (method === "GET" && path === "/compliance/retention") return this.listRetention(user);
      if (method === "POST" && path === "/compliance/retention") return await this.saveRetention(request, user);
      if (method === "GET" && path === "/comm-templates") return this.listCommTemplates(user);
      if (method === "POST" && path === "/comm-templates") return await this.createCommTemplate(request, user);
      if (method === "POST" && path.startsWith("/comm-templates/") && path.endsWith("/action")) return await this.commTemplateAction(request, user, path.split("/")[2]);
      if (method === "POST" && path.startsWith("/appointments/") && path.endsWith("/action")) return await this.appointmentAction(request, user, path.split("/")[2]);
      if (method === "GET" && path === "/availability") return this.listAvailability(user);
      if (method === "POST" && path === "/availability") return await this.saveAvailability(request, user);
      if (method === "GET" && path === "/calendar/status") return this.calendarStatus(user);
      if (method === "GET" && path === "/security/events") return this.securityEvents(url, user);
      if (method === "POST" && path === "/security/sessions/revoke") return await this.revokeSessions(request, user);
      if (method === "POST" && path.startsWith("/security/users/") && path.endsWith("/deactivate")) return await this.setUserActive(request, user, path.split("/")[3], 0);
      if (method === "POST" && path.startsWith("/security/users/") && path.endsWith("/activate")) return await this.setUserActive(request, user, path.split("/")[3], 1);
      if (method === "POST" && path.startsWith("/security/users/") && path.endsWith("/reset-password")) return await this.adminResetPassword(user, path.split("/")[3]);
      if (method === "GET" && path.startsWith("/export/")) return this.exportData(url, user, path.split("/")[2]);
      if (method === "GET" && path === "/system/health") return this.systemHealth(user);
      if (method === "GET" && path === "/system/backup/status") return this.backupStatus(user);
      if (method === "GET" && path === "/system/backup") return this.systemBackup(user);
      if (method === "POST" && path === "/system/backup/validate") return await this.validateBackup(request, user);
      if (method === "POST" && path === "/admin/test-data/flag") return await this.flagTestData(request, user);
      if (method === "POST" && path === "/admin/purge-test-data") return await this.purgeTestData(request, user);
      if (method === "GET" && path === "/launch-checklist") return this.launchChecklist(user);
      if (method === "POST" && path === "/launch-checklist/flag") return await this.setLaunchFlag(request, user);
      if (method === "POST" && path === "/legal") return await this.upsertLegal(request, user);
      if (method === "POST" && path.startsWith("/legal/") && path.endsWith("/action")) return await this.legalDocAction(request, user, path.split("/")[2]);

      return bad("Not found", 404);
    } catch (err) {
      console.error("victora-api error", path, err);
      return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }

  /* ------------------------------ session utils ----------------------------- */

  private getCookie(request: Request, name: string): string | null {
    const header = request.headers.get("Cookie") ?? "";
    for (const part of header.split(/;\s*/)) {
      const idx = part.indexOf("=");
      if (idx > 0 && part.slice(0, idx) === name) return part.slice(idx + 1);
    }
    return null;
  }

  private userFor(request: Request): UserRow | null {
    const token = this.getCookie(request, "vic_session");
    if (token === null) return null;
    const rows = this.sql
      .exec<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM sessions WHERE token = ?", token)
      .toArray();
    const session = rows[0];
    if (!session) return null;
    if (session.expires_at < Date.now()) {
      this.sql.exec("DELETE FROM sessions WHERE token = ?", token);
      return null;
    }
    const users = this.sql.exec<UserRow>("SELECT * FROM users WHERE id = ?", session.user_id).toArray();
    const u = users[0];
    if (!u) return null;
    // Deactivated accounts fail authentication immediately. Sessions are also
    // deleted at deactivation time; this guards out-of-band deactivations.
    if ((u.active ?? 1) === 0) return null;
    return u;
  }

  private async startSession(userId: string): Promise<Response> {
    const token = randomToken(32);
    const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
    this.sql.exec("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", token, userId, expires, Date.now());
    return new Response(JSON.stringify({ ok: true, user: publicUser(this.mustUser(userId)) }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `vic_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_DAYS * 86400}`,
      },
    });
  }

  private mustUser(id: string): UserRow {
    const rows = this.sql.exec<UserRow>("SELECT * FROM users WHERE id = ?", id).toArray();
    if (!rows[0]) throw new Error(`user ${id} missing`);
    return rows[0];
  }

  private audit(actor: UserRow | null, action: string, target = "", detail = ""): void {
    this.sql.exec(
      "INSERT INTO audit_logs (id, at, actor_id, actor_role, action, target, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
      uid("aud_"), Date.now(), actor?.id ?? "system", actor?.role ?? "system", action, target, detail,
    );
  }

  private timelineFor(clientId: string, label: string, actor = "system", kind = "event"): void {
    this.sql.exec(
      "INSERT INTO timeline (id, client_id, at, actor, kind, label) VALUES (?, ?, ?, ?, ?, ?)",
      uid("tl_"), clientId, Date.now(), actor, kind, label,
    );
  }

  /**
   * Portal notification + outbound delivery record. Email/SMS have no provider
   * yet — deliveries are recorded as `not_configured`, never as "sent". When
   * event + refId are provided, repeat triggers are deduped (no spam).
   */
  private notify(userId: string, title: string, body: string, event = "", refType = "", refId = "", clientId = ""): void {
    if (event.length > 0 && refId.length > 0) {
      const dup = this.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM notification_deliveries WHERE user_id = ? AND event = ? AND ref_id = ? AND channel = 'portal'", userId, event, refId)
        .toArray()[0].n;
      if (dup > 0) return;
    }
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO notifications (id, user_id, at, title, body, read, channels) VALUES (?, ?, ?, ?, ?, 0, 'portal')",
      uid("ntf_"), userId, now, title, body,
    );
    this.sql.exec(
      "INSERT INTO notification_deliveries (id, user_id, client_id, event, channel, provider, title, body, status, ref_type, ref_id, template, created_at, delivered_at) VALUES (?, ?, ?, ?, 'portal', 'portal', ?, ?, 'delivered', ?, ?, 'portal', ?, ?)",
      uid("dlv_"), userId, clientId, event, title, body, refType, refId, now, now,
    );
    if (clientId.length === 0) return;
    const prefs = this.sql.exec<{ email: number; sms: number; preferred_language: string }>("SELECT email, sms, preferred_language FROM comm_prefs WHERE client_id = ?", clientId).toArray()[0];
    if (!prefs) return;
    const contact = this.sql.exec<{ email: string; phone: string }>("SELECT email, phone FROM client_profiles WHERE id = ?", clientId).toArray()[0];
    // Email/SMS flow through the provider adapter. With no credential
    // configured the attempt is recorded `not_configured` — delivery is
    // NEVER faked. Sent asynchronously; the portal row above is immediate.
    if (prefs.email === 1) {
      this.ctx.waitUntil(
        this.deliverOutbound("email", {
          userId, clientId, event, refType, refId,
          destination: contact?.email ?? "",
          subject: title,
          body: this.renderComm(event, "email", clientId, title, body),
        }),
      );
    }
    if (prefs.sms === 1) {
      this.ctx.waitUntil(
        this.deliverOutbound("sms", {
          userId, clientId, event, refType, refId,
          destination: contact?.phone ?? "",
          subject: title,
          body: this.renderComm(event, "sms", clientId, title, body),
        }),
      );
    }
  }

  /* --------------------- Sprint 4: provider adapters ------------------------ */

  /** Which outbound provider would be used right now ("none" = unconfigured). */
  private providerName(channel: "email" | "sms"): string {
    if (channel === "email") return this.env.EMAIL_API_KEY ? "resend" : "none";
    return this.env.SMS_ACCOUNT_SID && this.env.SMS_AUTH_TOKEN ? "twilio" : "none";
  }

  /**
   * Outbound delivery through the communication provider adapter. Business
   * logic never talks to a provider directly. Statuses: queued → sending →
   * delivered | failed | bounced | not_configured. STOP/opt-out is enforced
   * upstream via comm_prefs (an opted-out client never reaches this method).
   */
  private async deliverOutbound(
    channel: "email" | "sms",
    opts: { userId: string; clientId: string; event: string; refType: string; refId: string; destination: string; subject: string; body: string },
  ): Promise<void> {
    const provider = this.providerName(channel);
    const id = uid("dlv_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO notification_deliveries (id, user_id, client_id, event, channel, provider, destination, title, body, status, ref_type, ref_id, template, attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, 0, ?)",
      id, opts.userId, opts.clientId, opts.event, channel, provider, opts.destination, opts.subject, opts.body, opts.refType, opts.refId, opts.event, now,
    );
    if (provider === "none" || opts.destination.length === 0) {
      this.sql.exec(
        "UPDATE notification_deliveries SET status = 'not_configured', error = ? WHERE id = ?",
        provider === "none" ? "No provider credential configured" : "No destination on file",
        id,
      );
      return;
    }
    this.sql.exec("UPDATE notification_deliveries SET status = 'sending', attempts = 1 WHERE id = ?", id);
    try {
      let providerMessageId = "";
      if (channel === "email") {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${this.env.EMAIL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: this.env.EMAIL_FROM ?? "Victora <notifications@victora.com>", to: [opts.destination], subject: opts.subject, text: opts.body }),
        });
        if (!res.ok) throw new Error(`email provider HTTP ${res.status}`);
        providerMessageId = String((await res.json() as { id?: string }).id ?? "");
      } else {
        const sid = this.env.SMS_ACCOUNT_SID ?? "";
        const auth = btoa(`${sid}:${this.env.SMS_AUTH_TOKEN ?? ""}`);
        const form = new URLSearchParams({ To: opts.destination, From: this.env.SMS_FROM ?? "", Body: opts.body });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        if (!res.ok) throw new Error(`sms provider HTTP ${res.status}`);
        providerMessageId = String((await res.json() as { sid?: string }).sid ?? "");
      }
      this.sql.exec("UPDATE notification_deliveries SET status = 'delivered', provider_message_id = ?, delivered_at = ? WHERE id = ?", providerMessageId, Date.now(), id);
    } catch (err) {
      this.sql.exec("UPDATE notification_deliveries SET status = 'failed', error = ? WHERE id = ?", err instanceof Error ? err.message.slice(0, 200) : "send failed", id);
    }
  }

  /**
   * Renders the active template for event/channel/language, falling back to
   * generic safe text. Template bodies never contain sensitive client
   * details — they point the recipient to My Victora.
   */
  private renderComm(event: string, channel: "email" | "sms", clientId: string, fallbackSubject: string, fallbackBody: string): string {
    const prefs = this.sql.exec<{ preferred_language: string }>("SELECT preferred_language FROM comm_prefs WHERE client_id = ?", clientId).toArray()[0];
    const lang = prefs?.preferred_language === "Spanish" ? "Spanish" : "English";
    const pick = (language: string): string | undefined =>
      this.sql
        .exec<{ body: string }>("SELECT body FROM communication_templates WHERE template_key = ? AND channel = ? AND language = ? AND active = 1 ORDER BY version DESC LIMIT 1", event, channel, language)
        .toArray()[0]?.body;
    const tpl = pick(lang) ?? (lang === "Spanish" ? pick("English") : undefined);
    return tpl ?? (channel === "sms" ? `${fallbackSubject} — check My Victora.` : `${fallbackSubject}\n\n${fallbackBody}\n\nSign in to My Victora for details.`);
  }

  /* ---------------- Sprint 4: throttling + meta helpers --------------------- */

  /** Durable sliding-window throttle backed by DO SQLite — counters survive
   *  DO restarts. Synchronous, so it is atomic within the DO. Still layered on
   *  top of durable account lockout; edge-level limits (e.g. Cloudflare rules)
   *  remain a recommended additional layer for production. */
  private checkRate(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const row = this.sql
      .exec<{ n: number; reset_at: number }>("SELECT n, reset_at FROM rate_limits WHERE key = ?", key)
      .toArray()[0];
    if (!row || row.reset_at < now) {
      this.sql.exec(
        "INSERT INTO rate_limits (key, n, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = 1, reset_at = excluded.reset_at",
        key, now + windowMs,
      );
      return true;
    }
    this.sql.exec("UPDATE rate_limits SET n = n + 1 WHERE key = ?", key);
    if (Math.random() < 0.02) this.sql.exec("DELETE FROM rate_limits WHERE reset_at < ?", now);
    return row.n + 1 <= limit;
  }

  private getMeta(key: string): string | null {
    return this.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = ?", key).toArray()[0]?.value ?? null;
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  }

  private addTask(title: string, detail: string, refType: string, refId: string, dueHours = 24): void {
    this.sql.exec(
      "INSERT INTO tasks (id, title, detail, due_at, source, done, ref_type, ref_id, created_at) VALUES (?, ?, ?, ?, 'automation', 0, ?, ?, ?)",
      uid("tsk_"), title, detail, Date.now() + dueHours * 3600 * 1000, refType, refId, Date.now(),
    );
  }

  /** Task creation with assignment/priority and dedupe — prevents automation spam. */
  private addTaskOnce(opts: {
    title: string;
    detail: string;
    refType: string;
    refId: string;
    dueHours?: number;
    assignedTo?: string | null;
    clientId?: string;
    priority?: "high" | "normal" | "low";
  }): void {
    const existing = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM tasks WHERE ref_id = ? AND title = ? AND done = 0", opts.refId, opts.title)
      .toArray()[0].n;
    if (existing > 0) return;
    this.sql.exec(
      "INSERT INTO tasks (id, title, detail, due_at, source, done, ref_type, ref_id, created_at, assigned_to, client_id, priority) VALUES (?, ?, ?, ?, 'automation', 0, ?, ?, ?, ?, ?, ?)",
      uid("tsk_"), opts.title, opts.detail, Date.now() + (opts.dueHours ?? 24) * 3600 * 1000, opts.refType, opts.refId, Date.now(),
      opts.assignedTo ?? "", opts.clientId ?? "", opts.priority ?? "normal",
    );
  }

  private nextTicketNumber(): string {
    const rows = this.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'svc_counter'").toArray();
    const next = rows[0] ? Number(rows[0].value) + 1 : 10001;
    this.sql.exec(
      "INSERT INTO meta (key, value) VALUES ('svc_counter', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      String(next),
    );
    return `VIC-SVC-${next}`;
  }

  /**
   * High-level relationship state, derived conservatively: any active policy →
   * active_client; all policies ended → inactive. One terminated health policy
   * next to an active dental policy still reads as an active client.
   */
  private syncRelationshipStatus(clientId: string): void {
    const active = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM policies WHERE client_id = ? AND status = 'active'", clientId).toArray()[0].n;
    const total = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM policies WHERE client_id = ?", clientId).toArray()[0].n;
    const current =
      this.sql.exec<{ relationship_status: string | null }>("SELECT relationship_status FROM client_profiles WHERE id = ?", clientId).toArray()[0]
        ?.relationship_status ?? "prospect";
    if (active > 0) {
      if (current !== "active_client") this.sql.exec("UPDATE client_profiles SET relationship_status = 'active_client', updated_at = ? WHERE id = ?", Date.now(), clientId);
    } else if (total > 0 && current === "active_client") {
      this.sql.exec("UPDATE client_profiles SET relationship_status = 'inactive', updated_at = ? WHERE id = ?", Date.now(), clientId);
    }
  }

  private nextVicId(): string {
    const rows = this.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'vic_counter'").toArray();
    const next = rows[0] ? Number(rows[0].value) + 1 : 100001;
    this.sql.exec(
      "INSERT INTO meta (key, value) VALUES ('vic_counter', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      String(next),
    );
    return `VIC-${next}`;
  }

  private setJourneyStage(profile: ProfileRow, stage: JourneyStage, actorLabel: string): void {
    if (profile.journey_stage === stage) return;
    this.sql.exec("UPDATE client_profiles SET journey_stage = ?, updated_at = ? WHERE id = ?", stage, Date.now(), profile.id);
    this.timelineFor(profile.id, `Journey updated: ${JOURNEY_LABEL[stage]}`, actorLabel, "stage");
  }

  /* --------------------------------- auth ---------------------------------- */

  private async register(request: Request): Promise<Response> {
    const body = (await request.json()) as Body;
    if (!this.checkRate(`register:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`, 10, 3_600_000)) {
      return bad("Too many registration attempts — try again later", 429);
    }
    const email = str(body, "email").toLowerCase();
    const password = str(body, "password");
    const name = str(body, "name");
    if (name.length < 2) return bad("Please enter your full name");
    if (!email.includes("@") || !email.includes(".")) return bad("Please enter a valid email");
    if (password.length < 8) return bad("Password must be at least 8 characters");

    const existing = this.sql.exec<{ id: string }>("SELECT id FROM users WHERE email = ?", email).toArray();
    if (existing.length > 0) return bad("An account with that email already exists");

    const salt = randomToken(16);
    const hash = await hashPassword(password, salt);
    const now = Date.now();
    const userId = uid("usr_");
    this.sql.exec(
      "INSERT INTO users (id, email, password_hash, salt, name, role, phone, created_at) VALUES (?, ?, ?, ?, ?, 'client', ?, ?)",
      userId, email, hash, salt, name, str(body, "phone"), now,
    );

    const householdId = uid("hh_");
    this.sql.exec("INSERT INTO households (id, name, primary_email, created_at) VALUES (?, ?, ?, ?)", householdId, `${name} Household`, email, now);

    const [firstName, ...rest] = name.split(" ");
    const profileId = this.nextVicId();
    const source = str(body, "source") || "Website";
    const campaign = str(body, "campaign");
    const language = str(body, "preferred_language") || "English";
    this.sql.exec(
      "INSERT INTO client_profiles (id, user_id, household_id, agent_id, first_name, last_name, email, phone, journey_stage, source, campaign, preferred_language, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'info_received', ?, ?, ?, ?, ?)",
      profileId, userId, householdId, firstName, rest.join(" "), email, str(body, "phone"), source, campaign, language, now, now,
    );

    // Claim any matching pre-existing lead so the record is continuous.
    const leadRows = this.sql.exec<{ id: string; source: string }>("SELECT id, source FROM leads WHERE email = ? AND client_id IS NULL", email).toArray();
    for (const lead of leadRows) {
      this.sql.exec("UPDATE leads SET client_id = ?, updated_at = ? WHERE id = ?", profileId, now, lead.id);
      this.timelineFor(profileId, `Lead created from ${lead.source}`, "system", "lead");
    }

    this.timelineFor(profileId, "Victora account created", "system", "account");
    this.timelineFor(profileId, "Assigned to the Victora intake queue", "system", "assignment");
    const user = this.mustUser(userId);
    this.audit(user, "Client account registered", profileId, email);
    this.addTask(`Welcome call: ${name}`, `New client ${profileId} registered from ${source}`, "client", profileId);
    return this.startSession(userId);
  }

  private async registerStaff(request: Request): Promise<Response> {
    const body = (await request.json()) as Body;
    if (!this.checkRate(`staffreg:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`, 10, 3_600_000)) {
      return bad("Too many attempts — try again later", 429);
    }
    const code = str(body, "code");
    const expected = this.env.STAFF_INVITE_CODE ?? "victora-founder";
    if (!safeEqual(code, expected)) return bad("Invalid staff invite code", 403);

    const email = str(body, "email").toLowerCase();
    const password = str(body, "password");
    const name = str(body, "name");
    if (name.length < 2) return bad("Please enter your full name");
    if (!email.includes("@") || !email.includes(".")) return bad("Please enter a valid email");
    if (password.length < 8) return bad("Password must be at least 8 characters");

    const existing = this.sql.exec<{ id: string }>("SELECT id FROM users WHERE email = ?", email).toArray();
    if (existing.length > 0) return bad("An account with that email already exists");

    const staffCount = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role != 'client'").toArray()[0].n;
    const requested = str(body, "role") as Role;
    const role: Role = staffCount === 0 ? "super_admin" : ["agent", "manager", "compliance"].includes(requested) ? requested : "agent";

    const salt = randomToken(16);
    const hash = await hashPassword(password, salt);
    const userId = uid("usr_");
    this.sql.exec(
      "INSERT INTO users (id, email, password_hash, salt, name, role, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      userId, email, hash, salt, name, role, str(body, "phone"), Date.now(),
    );
    const user = this.mustUser(userId);
    this.audit(user, `Staff account created (${role})`, userId, email);
    return this.startSession(userId);
  }

  private async login(request: Request): Promise<Response> {
    const body = (await request.json()) as Body;
    const email = str(body, "email").toLowerCase();
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    // Brute-force protection: per-IP and per-account throttling on top of
    // temporary account lockout after repeated failures.
    if (!this.checkRate(`login:ip:${ip}`, 30, 15 * 60_000) || !this.checkRate(`login:acct:${email}`, 10, 15 * 60_000)) {
      this.audit(null, "Sign-in throttled", email, ip);
      return bad("Too many sign-in attempts — try again in a few minutes", 429);
    }
    const rows = this.sql.exec<UserRow>("SELECT * FROM users WHERE email = ?", email).toArray();
    const user = rows[0];
    if (!user) {
      this.audit(null, "Failed sign-in (unknown account)", email, ip);
      return bad("Incorrect email or password", 401);
    }
    if ((user.locked_until ?? 0) > Date.now()) {
      this.audit(user, "Sign-in blocked (locked)", user.id, ip);
      return bad("This account is temporarily locked after repeated failed attempts. Try again shortly.", 429);
    }
    if ((user.active ?? 1) === 0) {
      this.audit(user, "Sign-in blocked (deactivated)", user.id, ip);
      return bad("This account has been deactivated. Contact Victora for assistance.", 403);
    }
    const hash = await hashPassword(str(body, "password"), user.salt);
    if (!safeEqual(hash, user.password_hash)) {
      const attempts = (user.failed_attempts ?? 0) + 1;
      const lock = attempts >= 8 ? Date.now() + 15 * 60_000 : null;
      this.sql.exec("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?", attempts, lock, user.id);
      this.audit(user, lock ? "Account locked after repeated failed sign-ins" : "Failed sign-in", user.id, ip);
      return bad("Incorrect email or password", 401);
    }
    this.sql.exec("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?", user.id);
    this.audit(user, "Signed in", user.id, user.email);
    return this.startSession(user.id);
  }

  private async logout(request: Request): Promise<Response> {
    const token = this.getCookie(request, "vic_session");
    if (token !== null) this.sql.exec("DELETE FROM sessions WHERE token = ?", token);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": "vic_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0" },
    });
  }

  private me(request: Request): Response {
    const user = this.userFor(request);
    if (user === null) return Response.json({ ok: true, user: null });
    let profile: Partial<ProfileRow> | null = null;
    if (user.role === "client") {
      const rows = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE user_id = ?", user.id).toArray();
      profile = rows[0] ?? null;
    }
    return Response.json({ ok: true, user: publicUser(user), profile });
  }

  /* --------------------------- public lead capture -------------------------- */

  private async captureLead(request: Request): Promise<Response> {
    const body = (await request.json()) as Body;
    const name = str(body, "name");
    const email = str(body, "email").toLowerCase();
    if (name.length < 2) return bad("Name is required");
    if (!email.includes("@") || !email.includes(".")) return bad("A valid email is required");

    const now = Date.now();
    const source = str(body, "source") || "Website";
    const campaign = str(body, "campaign");
    const language = str(body, "preferred_language") || "English";
    const leadId = uid("lead_");
    this.sql.exec(
      "INSERT INTO leads (id, client_id, name, email, phone, source, campaign, coverage_type, zip, details, stage, assigned_agent, preferred_language, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, ?, ?, ?)",
      leadId, name, email, str(body, "phone"), source, campaign, str(body, "coverage_type"), str(body, "zip"), str(body, "details"), language, now, now,
    );

    // Attach to an existing Master Client Record when the email matches.
    const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE email = ?", email).toArray()[0];
    if (profile) {
      this.sql.exec("UPDATE leads SET client_id = ? WHERE id = ?", profile.id, leadId);
      this.timelineFor(profile.id, `New request from ${source}${campaign ? ` (${campaign})` : ""}`, "system", "lead");
    }
    this.audit(null, `Lead captured from ${source}`, leadId, `${name} <${email}>`);
    this.addTask(`Call new lead: ${name}`, `Source: ${source} · Coverage: ${str(body, "coverage_type") || "unspecified"}`, "lead", leadId);
    return Response.json({ ok: true, leadId });
  }

  private async bookAppointment(request: Request): Promise<Response> {
    const body = (await request.json()) as Body;
    const name = str(body, "name");
    const email = str(body, "email").toLowerCase();
    const date = str(body, "date");
    const time = str(body, "time");
    if (name.length < 2) return bad("Name is required");
    if (!email.includes("@")) return bad("A valid email is required");
    if (date.length === 0 || time.length === 0) return bad("Please choose a date and time");

    const apptId = uid("apt_");
    const source = str(body, "source") || "Website";
    const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE email = ?", email).toArray()[0];
    this.sql.exec(
      "INSERT INTO appointments (id, client_id, name, email, phone, date, time, topic, channel, notes, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      apptId, profile?.id ?? null, name, email, str(body, "phone"), date, time, str(body, "topic"), str(body, "channel"), str(body, "notes"), source, Date.now(),
    );
    if (profile) this.timelineFor(profile.id, `Consultation booked — ${str(body, "topic") || "general"} (${date} ${time})`, "system", "appointment");
    this.audit(null, "Appointment booked", apptId, `${name} <${email}> ${date} ${time}`);
    this.addTask(`Confirm appointment: ${name} (${date} ${time})`, `Topic: ${str(body, "topic")} · Channel: ${str(body, "channel")}`, "appointment", apptId);
    return Response.json({ ok: true, appointmentId: apptId });
  }

  /* ------------------------------ client surface ---------------------------- */

  private requireProfile(userId: string): ProfileRow {
    const rows = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE user_id = ?", userId).toArray();
    if (!rows[0]) throw new Error("profile missing");
    return rows[0];
  }

  private clientOverview(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const members = this.sql
      .exec("SELECT id, name, dob, relationship, tobacco FROM household_members WHERE household_id = ? ORDER BY created_at", profile.household_id)
      .toArray();
    const intakes = this.sql
      .exec<{ id: string; area: string; status: string; created_at: number }>(
        "SELECT id, area, status, created_at FROM intakes WHERE client_id = ? ORDER BY created_at DESC",
        profile.id,
      )
      .toArray();
    const events = this.sql
      .exec<{ id: string; at: number; actor: string; kind: string; label: string }>(
        "SELECT id, at, actor, kind, label FROM timeline WHERE client_id = ? ORDER BY at DESC LIMIT 30",
        profile.id,
      )
      .toArray();
    const appts = this.sql
      .exec("SELECT id, date, time, topic, channel FROM appointments WHERE client_id = ? ORDER BY date", profile.id)
      .toArray();
    const unread = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0", user.id)
      .toArray()[0].n;
    const agentName = profile.agent_id
      ? this.sql.exec<{ name: string }>("SELECT name FROM users WHERE id = ?", profile.agent_id).toArray()[0]?.name ?? null
      : null;
    const nextAppointment = appts.find((a) => apptTime(String(a.date), String(a.time)) > Date.now()) ?? null;

    const has = (area: string): string | null => intakes.find((i) => i.area === area)?.status ?? null;

    // Attention is computed from real unresolved records — never hardcoded.
    const openRequests = this.sql
      .exec<{ document_type: string; due_date: string }>("SELECT document_type, due_date FROM document_requests WHERE client_id = ? AND status = 'open' ORDER BY created_at", profile.id)
      .toArray();
    const docStatuses = this.sql
      .exec<{ status: string; document_type: string }>("SELECT status, document_type FROM documents WHERE client_id = ?", profile.id)
      .toArray();
    const pendingAuths = this.sql
      .exec<{ template_name: string }>("SELECT template_name FROM authorizations WHERE client_id = ? AND status = 'pending'", profile.id)
      .toArray();
    const openQuotes = this.sql
      .exec<{ status: string }>("SELECT status FROM quote_presentations WHERE client_id = ? AND status IN ('sent','viewed','client_interested')", profile.id)
      .toArray();

    // Sprint 3 servicing surfaces for the client home.
    const policies = this.sql
      .exec("SELECT id, product_type, carrier, plan_name, status, monthly_premium, effective_date, termination_date, network_type FROM policies WHERE client_id = ? ORDER BY created_at DESC", profile.id)
      .toArray();
    const openTickets = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM service_tickets WHERE client_id = ? AND status NOT IN ('resolved','closed')", profile.id)
      .toArray()[0].n;
    const nextRenewal =
      this.sql
        .exec("SELECT id, policy_id, renewal_period, renewal_date, status FROM renewals WHERE client_id = ? AND status NOT IN ('completed','not_renewed','lost') ORDER BY renewal_date LIMIT 1", profile.id)
        .toArray()[0] ?? null;
    const welcomeUnlocked = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM policies WHERE client_id = ? AND status = 'active'", profile.id).toArray()[0].n > 0;
    const welcomeDone = this.sql
      .exec<{ item_key: string }>("SELECT item_key FROM welcome_items WHERE client_id = ?", profile.id)
      .toArray()
      .map((r) => r.item_key);
    const unreadMessages = this.sql
      .exec<{ n: number }>(
        "SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.client_id = ? AND m.sender_role = 'staff' AND m.read_at IS NULL",
        profile.id,
      )
      .toArray()[0].n;
    const agent = profile.agent_id
      ? this.sql.exec<{ id: string; name: string; email: string; phone: string }>("SELECT id, name, email, phone FROM users WHERE id = ?", profile.agent_id).toArray()[0] ?? null
      : null;

    const attention: { severity: "red" | "amber" | "green"; text: string }[] = [];
    for (const r of openRequests) attention.push({ severity: "red", text: `Upload ${r.document_type}${r.due_date ? ` — due ${r.due_date}` : ""}` });
    for (const d of docStatuses) {
      if (d.status === "replacement_required") attention.push({ severity: "red", text: `Re-upload your ${d.document_type} — a replacement was requested` });
      if (d.status === "accepted") attention.push({ severity: "green", text: `Your ${d.document_type} was accepted` });
    }
    for (const a of pendingAuths) attention.push({ severity: "amber", text: `Sign your ${a.template_name}` });
    for (const q of openQuotes) {
      if (q.status !== "client_interested") attention.push({ severity: "amber", text: "Review your coverage options" });
    }
    if (intakes.length === 0) attention.push({ severity: "red", text: "Complete your coverage intake so we can prepare your options" });
    if (intakes.some((i) => i.status === "new")) attention.push({ severity: "amber", text: "Your agent is reviewing your intake" });
    if (profile.journey_stage === "client_review") attention.push({ severity: "amber", text: "Your coverage options are ready — review them now" });
    if (nextAppointment !== null) {
      attention.push({ severity: "green", text: "You have an upcoming consultation" });
    }
    if (unreadMessages > 0) attention.push({ severity: "amber", text: "You have a new message from your Victora agent" });
    if (openTickets > 0) attention.push({ severity: "amber", text: "You have an open service request with Victora" });
    if (nextRenewal !== null) attention.push({ severity: "amber", text: "Your coverage review is coming up — your agent will reach out" });
    if (attention.length === 0) attention.push({ severity: "green", text: "You're all caught up" });

    return Response.json({
      ok: true,
      profile,
      protection: { health: has("health"), dental: has("dental"), vision: has("vision") },
      journeyStage: profile.journey_stage,
      attention,
      members,
      timeline: events,
      appointments: appts,
      agentName,
      agent,
      nextAppointment,
      unread,
      policies,
      openTickets,
      nextRenewal,
      welcome: { unlocked: welcomeUnlocked, completed: welcomeDone },
      unreadMessages,
      relationshipStatus: (profile as ProfileRow & { relationship_status?: string }).relationship_status ?? "prospect",
    });
  }

  private async submitIntake(request: Request, user: UserRow): Promise<Response> {
    const body = (await request.json()) as Body;
    const area = str(body, "area");
    if (!["health", "dental", "vision"].includes(area)) return bad("Invalid coverage area");
    const profile = this.requireProfile(user.id);

    const intakeId = uid("int_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO intakes (id, client_id, area, payload, status, created_at) VALUES (?, ?, ?, ?, 'new', ?)",
      intakeId, profile.id, area, JSON.stringify(body), now,
    );
    for (const need of strArray(body, "needs")) {
      this.sql.exec("INSERT INTO coverage_needs (id, intake_id, need) VALUES (?, ?, ?)", uid("cn_"), intakeId, need);
    }
    const memberNames = strArray(body, "members");
    if (memberNames.length > 0) {
      for (const m of memberNames) {
        this.sql.exec(
          "INSERT INTO household_members (id, household_id, name, dob, relationship, tobacco, created_at) VALUES (?, ?, ?, '', '', 0, ?)",
          uid("hm_"), profile.household_id, m, now,
        );
      }
    }

    this.timelineFor(profile.id, `${area[0].toUpperCase()}${area.slice(1)} intake completed`, user.name, "intake");
    if (profile.journey_stage === "info_received") this.setJourneyStage(profile, "agent_review", "system");
    this.audit(user, `${area} intake submitted`, profile.id, profile.id);
    this.addTask(`Review ${area} intake: ${profile.first_name} ${profile.last_name}`, `${profile.id} · ${new Date(now).toLocaleDateString("en-US")}`, "intake", intakeId);
    if (profile.agent_id) this.notify(profile.agent_id, `New ${area} intake`, `${profile.first_name} ${profile.last_name} (${profile.id}) completed their ${area} intake.`);
    return Response.json({ ok: true, intakeId });
  }

  private listNotifications(user: UserRow): Response {
    const rows = this.sql
      .exec("SELECT id, at, title, body, read FROM notifications WHERE user_id = ? ORDER BY at DESC LIMIT 50", user.id)
      .toArray();
    return Response.json({ ok: true, notifications: rows });
  }

  private markNotificationRead(user: UserRow, id: string): Response {
    this.sql.exec("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", id, user.id);
    return Response.json({ ok: true });
  }

  /* ------------------------------- staff surface ---------------------------- */

  private staffOverview(user: UserRow): Response {
    const mineOnly = user.role === "agent";
    const leadWhere = mineOnly ? "WHERE assigned_agent = ? OR assigned_agent IS NULL" : "";
    const params = mineOnly ? [user.id] : [];
    const clientScope = mineOnly ? " AND (p.agent_id = ? OR p.agent_id IS NULL)" : "";
    const count = (sql: string, p: (string | number)[] = []): number =>
      this.sql.exec<{ n: number }>(sql, ...p).toArray()[0].n;

    // Lazy automation (deduped): quotes sent but unviewed for 3+ days become tasks.
    const staleQuotes = this.sql
      .exec<{ id: string; title: string; client_id: string; agent_id: string }>(
        "SELECT id, title, client_id, agent_id FROM quote_presentations WHERE status = 'sent' AND viewed_at IS NULL AND sent_at < ? LIMIT 10",
        Date.now() - 3 * 24 * 3600 * 1000,
      )
      .toArray();
    for (const q of staleQuotes) {
      this.addTaskOnce({
        title: `Quote not viewed after 3 days: ${q.title}`,
        detail: `${q.client_id} · sent 3+ days ago`,
        refType: "quote", refId: q.id, dueHours: 24,
        assignedTo: q.agent_id, clientId: q.client_id, priority: "normal",
      });
    }

    // Sprint 3 lazy automation — every task is deduped (addTaskOnce) and every
    // client reminder is deduped by the delivery layer, so refreshing the
    // console never spams tasks or notifications.
    const now = Date.now();
    const unreadConvos = this.sql
      .exec<{ id: string; client_id: string; agent_id: string | null; first_name: string; last_name: string }>(
        `SELECT c.id, c.client_id, c.agent_id, p.first_name, p.last_name FROM conversations c
         JOIN client_profiles p ON p.id = c.client_id
         WHERE c.last_message_at IS NOT NULL AND c.updated_at < ?
           AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'client' AND m.read_at IS NULL)`,
        now - 4 * 3600 * 1000,
      )
      .toArray();
    for (const c of unreadConvos) {
      this.addTaskOnce({
        title: `Unread client message — ${c.first_name} ${c.last_name}`,
        detail: `${c.client_id} · waiting 4+ hours for a reply`,
        refType: "conversation", refId: c.id, dueHours: 4,
        assignedTo: c.agent_id, clientId: c.client_id, priority: "high",
      });
    }
    const agingTickets = this.sql
      .exec<{ id: string; ticket_number: string; client_id: string; assigned_to: string | null; agent_id: string | null; first_name: string; last_name: string }>(
        `SELECT t.id, t.ticket_number, t.client_id, t.assigned_to, p.agent_id, p.first_name, p.last_name FROM service_tickets t
         JOIN client_profiles p ON p.id = t.client_id
         WHERE t.status IN ('new','in_progress') AND t.updated_at < ?`,
        now - 48 * 3600 * 1000,
      )
      .toArray();
    for (const t of agingTickets) {
      this.addTaskOnce({
        title: `Ticket aging 48h+ — ${t.ticket_number} (${t.first_name} ${t.last_name})`,
        detail: `${t.client_id} · no resolution update in 48+ hours`,
        refType: "ticket", refId: t.id, dueHours: 8,
        assignedTo: t.assigned_to ?? t.agent_id, clientId: t.client_id, priority: "high",
      });
    }
    const activeNoWelcome = this.sql
      .exec<{ client_id: string; first_name: string; last_name: string; agent_id: string | null }>(
        `SELECT DISTINCT pol.client_id, p.first_name, p.last_name, p.agent_id FROM policies pol
         JOIN client_profiles p ON p.id = pol.client_id
         WHERE pol.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM welcome_items w WHERE w.client_id = pol.client_id AND w.item_key = 'review_plan')`,
      )
      .toArray();
    for (const c of activeNoWelcome) {
      this.addTaskOnce({
        title: `Welcome outreach — ${c.first_name} ${c.last_name}`,
        detail: `${c.client_id} · active coverage but welcome checklist not started`,
        refType: "welcome", refId: c.client_id, dueHours: 72,
        assignedTo: c.agent_id, clientId: c.client_id, priority: "normal",
      });
    }
    // Renewal timing ladder (internal service targets, not regulatory deadlines):
    // 120-day preparation, 90-day review, 60-day contact, 30-day urgent follow-up.
    const upcomingRenewals = this.sql
      .exec<{ id: string; client_id: string; assigned_agent: string | null; agent_id: string | null; user_id: string | null; first_name: string; last_name: string; renewal_period: string; renewal_date: string }>(
        `SELECT r.id, r.client_id, r.assigned_agent, r.renewal_period, r.renewal_date, p.agent_id, p.user_id, p.first_name, p.last_name FROM renewals r
         JOIN client_profiles p ON p.id = r.client_id
         WHERE r.status NOT IN ('completed','not_renewed','lost')`,
      )
      .toArray();
    for (const r of upcomingRenewals) {
      const due = new Date(`${r.renewal_date}T00:00:00`).getTime();
      if (Number.isNaN(due)) continue;
      const days = Math.ceil((due - now) / 86_400_000);
      const tier = days <= 30 ? 30 : days <= 60 ? 60 : days <= 90 ? 90 : days <= 120 ? 120 : 0;
      if (tier === 0) continue;
      this.addTaskOnce({
        title: `Renewal ${tier}-day: ${r.first_name} ${r.last_name} (${r.renewal_date})`,
        detail: `${r.client_id} · ${days} days out`,
        refType: "renewal", refId: `${r.id}:${tier}`, dueHours: 24,
        assignedTo: r.assigned_agent ?? r.agent_id, clientId: r.client_id, priority: tier <= 30 ? "high" : "normal",
      });
      if (r.user_id) {
        this.notify(
          r.user_id,
          "Your coverage review is coming up",
          `Your ${r.renewal_period || ""} renewal (${r.renewal_date}) is about ${days} days out. Your Victora agent will reach out to review your options.`.trim(),
          "renewal_reminder", "renewal", `${r.id}:${tier}`, r.client_id,
        );
      }
    }
    // Appointment reminders for consultations in the next 48 hours (deduped per appointment).
    const soonAppts = this.sql
      .exec<{ id: string; client_id: string | null; user_id: string | null; date: string; time: string; topic: string }>(
        "SELECT a.id, a.client_id, p.user_id, a.date, a.time, a.topic FROM appointments a LEFT JOIN client_profiles p ON p.id = a.client_id WHERE a.client_id IS NOT NULL",
      )
      .toArray();
    for (const a of soonAppts) {
      const at = apptTime(a.date, a.time);
      if (at <= now || at > now + 48 * 3600 * 1000) continue;
      if (a.user_id) {
        this.notify(
          a.user_id,
          "Appointment reminder",
          `Reminder: your Victora consultation (${a.topic || "general"}) is on ${a.date} at ${a.time}.`,
          "appointment_reminder", "appointment", a.id, a.client_id ?? "",
        );
      }
    }

    // Sprint 4: license/certification expiry + compliance escalation
    // automation (all deduped via addTaskOnce / notify dedupe).
    this.runExpiryAutomation();

    return Response.json({
      ok: true,
      today: {
        newLeads: count(`SELECT COUNT(*) AS n FROM leads ${leadWhere} ${leadWhere ? "AND" : "WHERE"} stage = 'new'`, params),
        unassignedLeads: count(`SELECT COUNT(*) AS n FROM leads ${leadWhere ? "WHERE assigned_agent IS NULL" : "WHERE assigned_agent IS NULL"}`),
        intakesToReview: count("SELECT COUNT(*) AS n FROM intakes WHERE status = 'new'"),
        clientsWaiting: count("SELECT COUNT(*) AS n FROM client_profiles WHERE journey_stage = 'client_review'"),
        upcomingAppointments: count("SELECT COUNT(*) AS n FROM appointments WHERE date >= ?", [new Date().toISOString().slice(0, 10)]),
        openTasks: count("SELECT COUNT(*) AS n FROM tasks WHERE done = 0"),
        activeClients: count("SELECT COUNT(*) AS n FROM client_profiles WHERE journey_stage = 'active'"),
        totalClients: count("SELECT COUNT(*) AS n FROM client_profiles"),
        documentsToReview: count(
          `SELECT COUNT(*) AS n FROM documents d JOIN client_profiles p ON p.id = d.client_id WHERE d.status = 'uploaded'${clientScope}`,
          params,
        ),
        authorizationsPending: count(
          `SELECT COUNT(*) AS n FROM authorizations a JOIN client_profiles p ON p.id = a.client_id WHERE a.status = 'pending'${clientScope}`,
          params,
        ),
        quotesAwaitingView: count(
          `SELECT COUNT(*) AS n FROM quote_presentations q JOIN client_profiles p ON p.id = q.client_id WHERE q.status = 'sent'${clientScope}`,
          params,
        ),
        quotesInterested: count(
          `SELECT COUNT(*) AS n FROM quote_presentations q JOIN client_profiles p ON p.id = q.client_id WHERE q.status = 'client_interested'${clientScope}`,
          params,
        ),
        unreadMessages: count(
          `SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN client_profiles p ON p.id = c.client_id
           WHERE m.sender_role = 'client' AND m.read_at IS NULL${clientScope}`,
          params,
        ),
        openTickets: count(
          `SELECT COUNT(*) AS n FROM service_tickets t JOIN client_profiles p ON p.id = t.client_id WHERE t.status NOT IN ('resolved','closed')${clientScope}`,
          params,
        ),
        ticketsWaitingClient: count(
          `SELECT COUNT(*) AS n FROM service_tickets t JOIN client_profiles p ON p.id = t.client_id WHERE t.status = 'waiting_on_client'${clientScope}`,
          params,
        ),
        activePolicies: count(
          `SELECT COUNT(*) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id WHERE pol.status = 'active'${clientScope}`,
          params,
        ),
        renewalsNext60: count(
          `SELECT COUNT(*) AS n FROM renewals r JOIN client_profiles p ON p.id = r.client_id
           WHERE r.status NOT IN ('completed','not_renewed','lost') AND r.renewal_date != '' AND r.renewal_date <= date('now', '+60 days')${clientScope}`,
          params,
        ),
        referralsNew: count("SELECT COUNT(*) AS n FROM referrals WHERE status = 'submitted'"),
        welcomeIncomplete: count(
          `SELECT COUNT(DISTINCT pol.client_id) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id
           WHERE pol.status = 'active' AND NOT EXISTS (SELECT 1 FROM welcome_items w WHERE w.client_id = pol.client_id AND w.item_key = 'review_plan')${clientScope}`,
          params,
        ),
      },
      viewer: publicUser(user),
    });
  }

  private listLeads(url: URL, user: UserRow): Response {
    const stage = url.searchParams.get("stage");
    const mineOnly = user.role === "agent";
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (mineOnly) {
      where.push("(assigned_agent = ? OR assigned_agent IS NULL)");
      params.push(user.id);
    }
    if (stage && LEAD_STAGES.includes(stage as LeadStage)) {
      where.push("stage = ?");
      params.push(stage);
    }
    const sql = `SELECT id, client_id, name, email, phone, source, campaign, coverage_type, zip, details, stage, assigned_agent, created_at FROM leads ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 200`;
    const rows = this.sql.exec(sql, ...params).toArray();
    return Response.json({ ok: true, leads: rows });
  }

  private async leadAction(request: Request, user: UserRow, path: string): Promise<Response> {
    const leadId = path.split("/")[2];
    const action = path.split("/")[3];
    const rows = this.sql.exec<{ id: string; name: string; client_id: string | null; assigned_agent: string | null; stage: string }>(
      "SELECT id, name, client_id, assigned_agent, stage FROM leads WHERE id = ?",
      leadId,
    ).toArray();
    const lead = rows[0];
    if (!lead) return bad("Lead not found", 404);
    if (user.role === "agent" && lead.assigned_agent !== null && lead.assigned_agent !== user.id) return bad("Not your lead", 403);

    if (action === "stage") {
      const body = (await request.json()) as Body;
      const stage = str(body, "stage") as LeadStage;
      if (!LEAD_STAGES.includes(stage)) return bad("Invalid stage");
      this.sql.exec("UPDATE leads SET stage = ?, updated_at = ? WHERE id = ?", stage, Date.now(), leadId);
      if (lead.client_id) this.timelineFor(lead.client_id, `Moved to ${LEAD_STAGE_LABEL[stage]} by ${user.name}`, user.name, "stage");
      this.audit(user, `Lead stage → ${stage}`, leadId, lead.name);
      return Response.json({ ok: true });
    }

    if (action === "assign") {
      if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
      const body = (await request.json()) as Body;
      const agentId = str(body, "agentId");
      const agent = this.mustUser(agentId);
      this.sql.exec("UPDATE leads SET assigned_agent = ?, updated_at = ? WHERE id = ?", agentId, Date.now(), leadId);
      if (lead.client_id) {
        this.sql.exec("UPDATE client_profiles SET agent_id = ?, updated_at = ? WHERE id = ?", agentId, Date.now(), lead.client_id);
        this.timelineFor(lead.client_id, `Assigned to Agent ${agent.name}`, user.name, "assignment");
      }
      this.notify(agentId, "New assignment", `${lead.name} was assigned to you.`);
      this.audit(user, `Lead assigned to ${agent.name}`, leadId, lead.name);
      return Response.json({ ok: true });
    }

    return bad("Unknown lead action");
  }

  private listClients(user: UserRow): Response {
    const rows =
      user.role === "agent"
        ? this.sql
            .exec(
              `SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.journey_stage, p.source, p.campaign, p.agent_id, p.is_test, p.created_at,
                      u.name AS agent_name
               FROM client_profiles p LEFT JOIN users u ON u.id = p.agent_id
               WHERE p.agent_id = ? OR p.agent_id IS NULL ORDER BY p.created_at DESC LIMIT 200`,
              user.id,
            )
            .toArray()
        : this.sql
            .exec(
              `SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.journey_stage, p.source, p.campaign, p.agent_id, p.is_test, p.created_at,
                      u.name AS agent_name
               FROM client_profiles p LEFT JOIN users u ON u.id = p.agent_id ORDER BY p.created_at DESC LIMIT 200`,
            )
            .toArray();
    return Response.json({ ok: true, clients: rows });
  }

  private masterRecord(user: UserRow, clientId: string): Response {
    const profiles = this.sql
      .exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", clientId)
      .toArray();
    const profile = profiles[0];
    if (!profile) return bad("Client not found", 404);
    if (user.role === "agent" && profile.agent_id !== user.id) return bad("Client not assigned to you", 403);

    const members = this.sql
      .exec("SELECT id, name, dob, relationship, tobacco FROM household_members WHERE household_id = ? ORDER BY created_at", profile.household_id)
      .toArray();
    const leads = this.sql
      .exec("SELECT id, source, campaign, coverage_type, stage, created_at FROM leads WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const intakes = this.sql
      .exec("SELECT id, area, payload, status, created_at, reviewed_by FROM intakes WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const events = this.sql
      .exec("SELECT id, at, actor, kind, label FROM timeline WHERE client_id = ? ORDER BY at DESC LIMIT 100", clientId)
      .toArray();
    const appts = this.sql
      .exec("SELECT id, date, time, topic, channel, notes FROM appointments WHERE client_id = ? ORDER BY date DESC", clientId)
      .toArray();
    const agent = profile.agent_id
      ? this.sql.exec<{ id: string; name: string; email: string }>("SELECT id, name, email FROM users WHERE id = ?", profile.agent_id).toArray()[0] ?? null
      : null;

    const auditRows =
      user.role === "compliance" || user.role === "super_admin" || user.role === "manager"
        ? this.sql.exec("SELECT at, actor_role, action, detail FROM audit_logs WHERE target = ? ORDER BY at DESC LIMIT 50", clientId).toArray()
        : [];

    const documentRequests = this.sql
      .exec("SELECT id, requested_by, category, document_type, instructions, due_date, required, status, created_at FROM document_requests WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const documents = this.sql
      .exec("SELECT id, request_id, document_type, category, original_filename, mime_type, size, status, review_note, rejection_reason, uploaded_at, reviewed_at, reviewed_by FROM documents WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const authorizations = this.sql
      .exec("SELECT id, template_name, template_version, status, signed_text, signer_name, signature, method, signed_at, ip, user_agent, expires_at, revoked_at, created_at, agent_id FROM authorizations WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const quotes = this.sql
      .exec("SELECT id, agent_id, title, coverage_area, status, sent_at, viewed_at, interested_option, created_at FROM quote_presentations WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    for (const qp of quotes) {
      (qp as Record<string, unknown>).options = this.sql
        .exec("SELECT id, label, carrier, plan_name, metal_tier, premium, deductible, oop_max, pcp, specialist, urgent_care, er, generic_rx, network_type, dental_note, vision_note, notes, doc_link FROM quote_options WHERE presentation_id = ? ORDER BY created_at", qp.id)
        .toArray();
    }

    // Sprint 3: service, coverage, renewals, referrals, messaging, internal notes.
    const tickets = this.sql
      .exec("SELECT id, ticket_number, category, description, status, priority, assigned_to, latest_response, created_at, updated_at FROM service_tickets WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const policies = this.sql
      .exec("SELECT * FROM policies WHERE client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    for (const pol of policies) {
      (pol as Record<string, unknown>).members = this.sql
        .exec("SELECT name, relationship, dob FROM policy_members WHERE policy_id = ?", pol.id)
        .toArray();
    }
    const renewals = this.sql
      .exec("SELECT * FROM renewals WHERE client_id = ? ORDER BY renewal_date DESC", clientId)
      .toArray();
    const referrals = this.sql
      .exec("SELECT id, referred_name, referred_email, referred_phone, relationship, status, converted_client_id, source, campaign, message, created_at FROM referrals WHERE referring_client_id = ? ORDER BY created_at DESC", clientId)
      .toArray();
    const conversations = this.sql
      .exec(
        `SELECT c.id, c.subject, c.status, c.last_message_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'client' AND m.read_at IS NULL) AS unread_client,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
         FROM conversations c WHERE c.client_id = ? ORDER BY c.last_message_at DESC`,
        clientId,
      )
      .toArray();
    // INTERNAL — Victora staff only. This endpoint is staff-gated; the client
    // routes never select from internal_notes.
    const internalNotes = this.sql
      .exec("SELECT id, author_name, author_role, body, created_at FROM internal_notes WHERE client_id = ? ORDER BY created_at DESC LIMIT 100", clientId)
      .toArray();
    const welcomeDone = this.sql.exec("SELECT item_key, completed_at FROM welcome_items WHERE client_id = ?", clientId).toArray();
    const commPrefs =
      this.sql
        .exec("SELECT portal, email, sms, phone, preferred_language, consent_status, consent_at, optout_at, source, updated_at FROM comm_prefs WHERE client_id = ?", clientId)
        .toArray()[0] ?? null;

    return Response.json({
      ok: true,
      profile: { ...profile, agent_name: agent?.name ?? null },
      agent,
      members,
      leads,
      intakes,
      timeline: events,
      appointments: appts,
      documentRequests,
      documents,
      authorizations,
      quotes,
      tickets,
      policies,
      renewals,
      referrals,
      conversations,
      internalNotes,
      welcome: welcomeDone,
      commPrefs,
      relationshipStatus: (profile as ProfileRow & { relationship_status?: string }).relationship_status ?? "prospect",
      audit: auditRows,
    });
  }

  private async clientAction(request: Request, user: UserRow, path: string): Promise<Response> {
    const clientId = path.split("/")[2];
    const action = path.split("/")[3];
    const rows = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", clientId).toArray();
    const profile = rows[0];
    if (!profile) return bad("Client not found", 404);
    if (user.role === "agent" && profile.agent_id !== user.id) return bad("Client not assigned to you", 403);

    if (action === "stage") {
      const body = (await request.json()) as Body;
      const stage = str(body, "stage") as JourneyStage;
      if (!JOURNEY_STAGES.includes(stage)) return bad("Invalid stage");
      this.setJourneyStage(profile, stage, user.name);
      this.audit(user, `Journey → ${stage}`, clientId, `${profile.first_name} ${profile.last_name}`);
      if (stage === "active" && profile.user_id) {
        this.notify(profile.user_id, "Your coverage is active", "Welcome to Victora — your Welcome Center is ready.");
      }
      return Response.json({ ok: true });
    }

    if (action === "assign") {
      if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
      const body = (await request.json()) as Body;
      const agent = this.mustUser(str(body, "agentId"));
      this.sql.exec("UPDATE client_profiles SET agent_id = ?, updated_at = ? WHERE id = ?", agent.id, Date.now(), clientId);
      this.timelineFor(clientId, `Assigned to Agent ${agent.name}`, user.name, "assignment");
      this.notify(agent.id, "New client assignment", `${profile.first_name} ${profile.last_name} (${clientId}) was assigned to you.`);
      this.audit(user, `Client assigned to ${agent.name}`, clientId, profile.id);
      return Response.json({ ok: true });
    }

    if (action === "review-intake") {
      const body = (await request.json()) as Body;
      const intakeId = str(body, "intakeId");
      this.sql.exec("UPDATE intakes SET status = 'reviewed', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND client_id = ?", user.id, Date.now(), intakeId, clientId);
      this.timelineFor(clientId, `Intake reviewed by ${user.name}`, user.name, "intake");
      this.audit(user, "Intake reviewed", clientId, intakeId);
      if (profile.user_id) this.notify(profile.user_id, "Intake reviewed", "Your agent has reviewed your intake.");
      return Response.json({ ok: true });
    }

    return bad("Unknown client action");
  }

  private listTasks(): Response {
    const rows = this.sql
      .exec("SELECT id, title, detail, due_at, source, done, ref_type, ref_id, created_at, assigned_to, client_id, priority FROM tasks ORDER BY done, due_at LIMIT 200")
      .toArray();
    return Response.json({ ok: true, tasks: rows });
  }

  private completeTask(user: UserRow, id: string): Response {
    this.sql.exec("UPDATE tasks SET done = 1 WHERE id = ?", id);
    this.audit(user, "Task completed", id);
    return Response.json({ ok: true });
  }

  private listAppointments(): Response {
    const rows = this.sql
      .exec("SELECT id, client_id, name, email, phone, date, time, topic, channel, notes, source, status, duration_minutes, meeting_type, timezone, assigned_agent, created_at FROM appointments ORDER BY date DESC LIMIT 200")
      .toArray();
    return Response.json({ ok: true, appointments: rows });
  }

  private listTeam(user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const rows = this.sql
      .exec("SELECT id, name, email, role, active, is_test, created_at FROM users WHERE role != 'client' ORDER BY created_at")
      .toArray();
    return Response.json({ ok: true, team: rows });
  }

  private async setUserRole(request: Request, user: UserRow, path: string): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    const targetId = path.split("/")[2];
    const body = (await request.json()) as Body;
    const role = str(body, "role") as Role;
    if (!["client", "agent", "manager", "compliance", "super_admin"].includes(role)) return bad("Invalid role");
    this.sql.exec("UPDATE users SET role = ? WHERE id = ?", role, targetId);
    // Role changes invalidate the target's sessions so a stale elevated
    // session can never outlive a privilege change.
    this.sql.exec("DELETE FROM sessions WHERE user_id = ?", targetId);
    this.audit(user, `Role set to ${role} (sessions invalidated)`, targetId);
    return Response.json({ ok: true });
  }

  private listAudit(user: UserRow): Response {
    if (!["compliance", "super_admin"].includes(user.role)) return bad("Compliance access required", 403);
    const rows = this.sql
      .exec("SELECT id, at, actor_id, actor_role, action, target, detail FROM audit_logs ORDER BY at DESC LIMIT 300")
      .toArray();
    return Response.json({ ok: true, audit: rows });
  }

  /* -------------------------- Sprint 2: blob storage ------------------------- */

  /**
   * Private object storage inside this Durable Object. Bytes are never in
   * SQLite, never get a public URL, and are only served through authorized
   * routes. Chunked because DO storage caps individual values at 128 KiB.
   */
  private async putBlob(key: string, bytes: Uint8Array): Promise<void> {
    const chunks = Math.ceil(bytes.length / BLOB_CHUNK);
    for (let i = 0; i < chunks; i++) {
      await this.ctx.storage.put(`blob:${key}:${i}`, bytes.slice(i * BLOB_CHUNK, (i + 1) * BLOB_CHUNK));
    }
  }

  private async getBlob(key: string): Promise<Uint8Array | null> {
    const first = await this.ctx.storage.get<Uint8Array>(`blob:${key}:0`);
    if (first === undefined) return null;
    const parts: Uint8Array[] = [first];
    for (let i = 1; ; i++) {
      const part = await this.ctx.storage.get<Uint8Array>(`blob:${key}:${i}`);
      if (part === undefined) break;
      parts.push(part);
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  /* ---------------- Sprint 4: document storage abstraction ------------------ */

  /**
   * Document storage ABSTRACTION — the Document Center only ever calls these
   * methods. The current implementation is the Durable Object pilot adapter
   * ("do_pilot"): chunked private storage inside this DO. A production
   * R2/private-object-store adapter can replace put/get/delete/metadata
   * WITHOUT touching any Document Center business logic.
   * PILOT MODE — pending production object-storage and security review.
   */
  private storageMode(): string {
    return "do_pilot";
  }

  private async documentStoragePut(key: string, bytes: Uint8Array): Promise<void> {
    return this.putBlob(key, bytes);
  }

  private async documentStorageGet(key: string): Promise<Uint8Array | null> {
    return this.getBlob(key);
  }

  private async documentStorageDelete(key: string): Promise<void> {
    const list = await this.ctx.storage.list({ prefix: `blob:${key}:` });
    await this.ctx.storage.delete([...list.keys()]);
  }

  private async documentStorageMetadata(key: string): Promise<{ exists: boolean; bytes: number; chunks: number }> {
    const list = await this.ctx.storage.list({ prefix: `blob:${key}:` });
    let bytes = 0;
    for (const v of list.values()) bytes += (v as Uint8Array).length;
    return { exists: list.size > 0, bytes, chunks: list.size };
  }

  /* ------------------------- Sprint 2: documents ----------------------------- */

  private myDocuments(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const requests = this.sql
      .exec("SELECT id, category, document_type, instructions, due_date, required, status, created_at FROM document_requests WHERE client_id = ? ORDER BY created_at DESC", profile.id)
      .toArray();
    const documents = this.sql
      .exec("SELECT id, request_id, document_type, category, original_filename, mime_type, size, status, rejection_reason, review_note, uploaded_at, reviewed_at FROM documents WHERE client_id = ? ORDER BY created_at DESC", profile.id)
      .toArray();
    return Response.json({ ok: true, requests, documents });
  }

  private async uploadDocument(request: Request, user: UserRow): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const form = await request.formData();
    const requestId = String(form.get("requestId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) return bad("Please choose a file to upload");
    if (file.size === 0) return bad("That file is empty");
    if (file.size > MAX_UPLOAD_BYTES) return bad("Files are limited to 8 MB");
    const mime = file.type || "application/octet-stream";
    if (!(DOCUMENT_MIME_WHITELIST as readonly string[]).includes(mime)) {
      return bad("Only PDF, JPEG, PNG, HEIC, or WebP files are accepted");
    }
    const reqRow =
      requestId.length > 0
        ? this.sql
            .exec<{ id: string; document_type: string; category: string }>(
              "SELECT id, document_type, category FROM document_requests WHERE id = ? AND client_id = ?",
              requestId,
              profile.id,
            )
            .toArray()[0]
        : undefined;
    if (requestId.length > 0 && !reqRow) return bad("Document request not found", 404);

    const docId = uid("doc_");
    const key = randomToken(16);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await this.documentStoragePut(key, bytes);
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO documents (id, client_id, request_id, document_type, category, original_filename, stored_key, mime_type, size, status, uploaded_by, uploaded_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?, ?)",
      docId, profile.id, reqRow?.id ?? null, reqRow?.document_type ?? "Other", reqRow?.category ?? "Other",
      safeFilename(file.name), key, mime, file.size, user.id, now, now, now,
    );
    if (reqRow) this.sql.exec("UPDATE document_requests SET status = 'under_review', updated_at = ? WHERE id = ?", now, reqRow.id);
    this.timelineFor(profile.id, `Document uploaded: ${reqRow?.document_type ?? safeFilename(file.name)}`, user.name, "document");
    this.audit(user, "Document uploaded", docId, `${profile.id} · ${safeFilename(file.name)} (${file.size} bytes)`);
    if (profile.agent_id) this.notify(profile.agent_id, "Document uploaded", `${profile.first_name} ${profile.last_name} (${profile.id}) uploaded a document for review.`);
    this.addTaskOnce({
      title: `Review uploaded document: ${profile.first_name} ${profile.last_name}`,
      detail: `${profile.id} · ${reqRow?.document_type ?? "document"}`,
      refType: "document", refId: docId, dueHours: 24,
      assignedTo: profile.agent_id, clientId: profile.id, priority: "normal",
    });
    return Response.json({ ok: true, documentId: docId });
  }

  private async documentFile(user: UserRow, docId: string): Promise<Response> {
    const rows = this.sql
      .exec<{ id: string; client_id: string; original_filename: string; stored_key: string; mime_type: string }>(
        "SELECT id, client_id, original_filename, stored_key, mime_type FROM documents WHERE id = ?",
        docId,
      )
      .toArray();
    const doc = rows[0];
    if (!doc) return bad("Document not found", 404);
    if (user.role === "client") {
      const profile = this.requireProfile(user.id);
      if (doc.client_id !== profile.id) return bad("Not your document", 403);
    } else {
      const owner = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", doc.client_id).toArray()[0];
      if (!owner) return bad("Document not found", 404);
      if (user.role === "agent" && owner.agent_id !== user.id) return bad("Client not assigned to you", 403);
    }
    const bytes = await this.documentStorageGet(doc.stored_key);
    if (bytes === null) return bad("Document file missing", 404);
    this.audit(user, "Document file accessed", docId, `${doc.original_filename} · ${user.role}`);
    return new Response(bytes.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": doc.mime_type,
        "Content-Disposition": `attachment; filename="${safeFilename(doc.original_filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  /* ----------------------- Sprint 2: authorizations -------------------------- */

  private myAuthorizations(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec("SELECT id, template_name, template_version, status, signed_at, expires_at, revoked_at, signer_name, method FROM authorizations WHERE client_id = ? ORDER BY created_at DESC", profile.id)
      .toArray();
    return Response.json({ ok: true, authorizations: rows });
  }

  private async signAuthorization(request: Request, user: UserRow, authId: string): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec<{ id: string; client_id: string; template_id: string; template_version: number; template_name: string; status: string; agent_id: string | null }>(
        "SELECT id, client_id, template_id, template_version, template_name, status, agent_id FROM authorizations WHERE id = ?",
        authId,
      )
      .toArray();
    const auth = rows[0];
    if (!auth) return bad("Authorization not found", 404);
    if (auth.client_id !== profile.id) return bad("Not your authorization", 403);
    if (auth.status !== "pending") return bad("This authorization is not awaiting signature");
    const body = (await request.json()) as Body;
    const signature = str(body, "signature");
    if (signature.length < 3) return bad("Please type your full legal name to sign");
    if (!bool(body, "agreed")) return bad("Please confirm you agree to the authorization");

    // Snapshot the exact text for this template version — if the template
    // changes later, this record keeps what the client actually agreed to.
    const template = this.sql
      .exec<{ body: string }>("SELECT body FROM authorization_templates WHERE id = ? AND version = ?", auth.template_id, auth.template_version)
      .toArray()[0];
    const now = Date.now();
    this.sql.exec(
      "UPDATE authorizations SET status = 'signed', signed_text = ?, signer_name = ?, signer_role = 'client', signature = ?, method = 'electronic_signature', signed_at = ?, ip = ?, user_agent = ? WHERE id = ?",
      template?.body ?? "", user.name, signature, now,
      request.headers.get("CF-Connecting-IP") ?? "", request.headers.get("User-Agent") ?? "", authId,
    );
    this.timelineFor(profile.id, `${auth.template_name} signed`, user.name, "authorization");
    this.audit(user, `Authorization signed: ${auth.template_name} (v${auth.template_version})`, authId, profile.id);
    if (auth.agent_id) this.notify(auth.agent_id, "Authorization signed", `${profile.first_name} ${profile.last_name} (${profile.id}) signed ${auth.template_name}.`);
    this.sql.exec("UPDATE tasks SET done = 1 WHERE ref_type = 'authorization' AND ref_id = ? AND done = 0", authId);
    return Response.json({ ok: true });
  }

  /** Full authorization text — pending template body or the signed snapshot. */
  private authorizationText(user: UserRow, authId: string): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec<{ id: string; client_id: string; status: string; template_id: string; template_name: string; template_version: number; signed_text: string; signed_at: number | null; signer_name: string; method: string }>(
        "SELECT id, client_id, status, template_id, template_name, template_version, signed_text, signed_at, signer_name, method FROM authorizations WHERE id = ?",
        authId,
      )
      .toArray();
    const auth = rows[0];
    if (!auth || auth.client_id !== profile.id) return bad("Not found", 404);
    const text =
      auth.signed_text.length > 0
        ? auth.signed_text
        : this.sql
            .exec<{ body: string }>("SELECT body FROM authorization_templates WHERE id = ? AND version = ?", auth.template_id, auth.template_version)
            .toArray()[0]?.body ?? "";
    return Response.json({
      ok: true,
      authorization: {
        id: auth.id,
        template_name: auth.template_name,
        template_version: auth.template_version,
        status: auth.status,
        signed_at: auth.signed_at,
        signer_name: auth.signer_name,
        method: auth.method,
        text,
      },
    });
  }

  private listTemplates(user: UserRow): Response {
    const rows = this.sql
      .exec("SELECT id, template_key, name, version, body, active, created_at FROM authorization_templates ORDER BY template_key, version DESC")
      .toArray();
    return Response.json({ ok: true, templates: rows });
  }

  private async createTemplateVersion(request: Request, user: UserRow): Promise<Response> {
    if (user.role !== "compliance" && user.role !== "super_admin") return bad("Compliance access required", 403);
    const body = (await request.json()) as Body;
    const templateKey = str(body, "templateKey");
    const name = str(body, "name");
    const text = str(body, "body");
    if (templateKey.length < 2 || name.length < 2 || text.length < 20) return bad("Template key, name, and body text are required");
    const activate = bool(body, "activate");
    const latest = this.sql
      .exec<{ version: number }>("SELECT version FROM authorization_templates WHERE template_key = ? ORDER BY version DESC LIMIT 1", templateKey)
      .toArray()[0];
    const version = (latest?.version ?? 0) + 1;
    const id = uid("tpl_");
    if (activate) this.sql.exec("UPDATE authorization_templates SET active = 0 WHERE template_key = ?", templateKey);
    this.sql.exec(
      "INSERT INTO authorization_templates (id, template_key, name, version, body, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, templateKey, name, version, text, activate ? 1 : 0, Date.now(),
    );
    this.audit(user, `Authorization template ${templateKey} v${version} created${activate ? " and activated" : " (inactive)"}`, id, name);
    return Response.json({ ok: true, templateId: id, version });
  }

  /* --------------------- Sprint 2: quote presentations ----------------------- */

  private myQuotes(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const presentations = this.sql
      .exec<{ id: string; title: string; coverage_area: string; status: string; sent_at: number | null; viewed_at: number | null; interested_option: string; agent_id: string }>(
        "SELECT id, title, coverage_area, status, sent_at, viewed_at, interested_option, agent_id FROM quote_presentations WHERE client_id = ? AND status IN ('sent','viewed','client_interested') ORDER BY sent_at DESC",
        profile.id,
      )
      .toArray();
    const out = presentations.map((p) => ({
      ...p,
      agent_name: p.agent_id ? this.sql.exec<{ name: string }>("SELECT name FROM users WHERE id = ?", p.agent_id).toArray()[0]?.name ?? null : null,
      options: this.sql
        .exec("SELECT id, label, carrier, plan_name, metal_tier, premium, deductible, oop_max, pcp, specialist, urgent_care, er, generic_rx, network_type, dental_note, vision_note, notes, doc_link FROM quote_options WHERE presentation_id = ? ORDER BY created_at", p.id)
        .toArray(),
    }));
    return Response.json({ ok: true, quotes: out });
  }

  private quoteViewed(user: UserRow, quoteId: string): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec<{ id: string; client_id: string; status: string; agent_id: string; title: string }>(
        "SELECT id, client_id, status, agent_id, title FROM quote_presentations WHERE id = ?",
        quoteId,
      )
      .toArray();
    const quote = rows[0];
    if (!quote || quote.client_id !== profile.id) return bad("Quote not found", 404);
    if (quote.status === "sent") {
      const now = Date.now();
      this.sql.exec("UPDATE quote_presentations SET status = 'viewed', viewed_at = ?, updated_at = ? WHERE id = ?", now, now, quoteId);
      this.sql.exec(
        "INSERT INTO quote_interactions (id, presentation_id, option_id, client_id, action, message, at) VALUES (?, ?, '', ?, 'viewed', '', ?)",
        uid("qi_"), quoteId, profile.id, now,
      );
      this.timelineFor(profile.id, "You reviewed your coverage options", user.name, "quote");
      this.audit(user, "Quote presentation viewed", quoteId, profile.id);
      if (quote.agent_id) this.notify(quote.agent_id, "Quote viewed", `${profile.first_name} ${profile.last_name} (${profile.id}) opened "${quote.title}".`);
    }
    return Response.json({ ok: true });
  }

  private async quoteInterest(request: Request, user: UserRow, quoteId: string): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const body = (await request.json()) as Body;
    const optionId = str(body, "optionId");
    const rows = this.sql
      .exec<{ id: string; client_id: string; status: string; agent_id: string; title: string }>(
        "SELECT id, client_id, status, agent_id, title FROM quote_presentations WHERE id = ?",
        quoteId,
      )
      .toArray();
    const quote = rows[0];
    if (!quote || quote.client_id !== profile.id) return bad("Quote not found", 404);
    if (!(["sent", "viewed", "client_interested"] as string[]).includes(quote.status)) return bad("These options are not open for selection yet");
    const option = this.sql
      .exec<{ id: string; label: string; plan_name: string }>("SELECT id, label, plan_name FROM quote_options WHERE id = ? AND presentation_id = ?", optionId, quoteId)
      .toArray()[0];
    if (!option) return bad("Please choose one of the presented options");
    const now = Date.now();
    this.sql.exec("UPDATE quote_presentations SET status = 'client_interested', interested_option = ?, updated_at = ? WHERE id = ?", optionId, now, quoteId);
    this.sql.exec(
      "INSERT INTO quote_interactions (id, presentation_id, option_id, client_id, action, message, at) VALUES (?, ?, ?, ?, 'interested', '', ?)",
      uid("qi_"), quoteId, optionId, profile.id, now,
    );
    this.timelineFor(profile.id, `You expressed interest in ${option.label} — ${option.plan_name}. Your agent will follow up; additional steps may still be required.`, user.name, "quote");
    this.audit(user, `Quote interest: ${option.label}`, quoteId, profile.id);
    if (quote.agent_id) this.notify(quote.agent_id, "Client interested in a quote option", `${profile.first_name} ${profile.last_name} (${profile.id}) selected ${option.label} in "${quote.title}".`);
    this.addTaskOnce({
      title: `Follow up: quote interest — ${profile.first_name} ${profile.last_name}`,
      detail: `${profile.id} · ${option.label} (${option.plan_name}) in "${quote.title}"`,
      refType: "quote", refId: quoteId, dueHours: 4,
      assignedTo: quote.agent_id, clientId: profile.id, priority: "high",
    });
    return Response.json({ ok: true });
  }

  private async quoteInteract(request: Request, user: UserRow, quoteId: string, action: "saved" | "question"): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const body = (await request.json()) as Body;
    const optionId = str(body, "optionId");
    const message = str(body, "message");
    const rows = this.sql
      .exec<{ id: string; client_id: string; status: string; agent_id: string; title: string }>(
        "SELECT id, client_id, status, agent_id, title FROM quote_presentations WHERE id = ?",
        quoteId,
      )
      .toArray();
    const quote = rows[0];
    if (!quote || quote.client_id !== profile.id) return bad("Quote not found", 404);
    if (!(["sent", "viewed", "client_interested"] as string[]).includes(quote.status)) return bad("These options are not open yet");
    this.sql.exec(
      "INSERT INTO quote_interactions (id, presentation_id, option_id, client_id, action, message, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      uid("qi_"), quoteId, optionId, profile.id, action, message, Date.now(),
    );
    this.audit(user, `Quote ${action}`, quoteId, profile.id);
    if (action === "question" && quote.agent_id) {
      this.notify(quote.agent_id, "Quote question from client", `${profile.first_name} ${profile.last_name} (${profile.id}) asked: ${message || "(no text)"}`);
      this.addTaskOnce({
        title: `Answer quote question — ${profile.first_name} ${profile.last_name}`,
        detail: `${profile.id} · ${message.slice(0, 120)}`,
        refType: "quote", refId: quoteId, dueHours: 8,
        assignedTo: quote.agent_id, clientId: profile.id, priority: "normal",
      });
    }
    return Response.json({ ok: true });
  }

  /* -------------------- Sprint 2: staff document/quote ops ------------------- */

  private async staffProfile(user: UserRow, clientId: string): Promise<ProfileRow | Response> {
    const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", clientId).toArray()[0];
    if (!profile) return bad("Client not found", 404);
    if (user.role === "agent" && profile.agent_id !== user.id) return bad("Client not assigned to you", 403);
    return profile;
  }

  private async requestDocument(request: Request, user: UserRow, clientId: string): Promise<Response> {
    const result = await this.staffProfile(user, clientId);
    if (result instanceof Response) return result;
    const profile = result;
    const body = (await request.json()) as Body;
    const category = str(body, "category");
    const documentType = str(body, "documentType");
    const instructions = str(body, "instructions");
    const dueDate = str(body, "dueDate");
    if (!(DOC_CATEGORIES as readonly string[]).includes(category)) return bad("Invalid category");
    if (documentType.length < 3) return bad("Describe the document to request");
    const id = uid("dreq_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO document_requests (id, client_id, requested_by, category, document_type, instructions, due_date, required, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
      id, clientId, user.id, category, documentType, instructions, dueDate, bool(body, "required") ? 1 : 0, now, now,
    );
    this.timelineFor(clientId, `Document requested: ${documentType}${dueDate ? ` (due ${dueDate})` : ""}`, user.name, "document");
    this.audit(user, `Document requested: ${documentType}`, id, clientId);
    if (profile.user_id) this.notify(profile.user_id, "Document requested", `Your agent requested: ${documentType}. ${instructions}`.trim());
    this.addTaskOnce({
      title: `Follow up: document request — ${profile.first_name} ${profile.last_name}`,
      detail: `${clientId} · ${documentType}`,
      refType: "document_request", refId: id, dueHours: 72,
      assignedTo: profile.agent_id, clientId, priority: "normal",
    });
    return Response.json({ ok: true, requestId: id });
  }

  private async reviewDocument(request: Request, user: UserRow, clientId: string, docId: string): Promise<Response> {
    const result = await this.staffProfile(user, clientId);
    if (result instanceof Response) return result;
    const profile = result;
    const rows = this.sql
      .exec<{ id: string; request_id: string | null; document_type: string }>(
        "SELECT id, request_id, document_type FROM documents WHERE id = ? AND client_id = ?",
        docId,
        clientId,
      )
      .toArray();
    const doc = rows[0];
    if (!doc) return bad("Document not found", 404);
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const note = str(body, "note");
    const now = Date.now();

    if (action === "accept") {
      this.sql.exec(
        "UPDATE documents SET status = 'accepted', reviewed_by = ?, review_note = ?, rejection_reason = '', reviewed_at = ?, updated_at = ? WHERE id = ?",
        user.id, note, now, now, docId,
      );
      this.timelineFor(clientId, `Document accepted: ${doc.document_type}`, user.name, "document");
      this.audit(user, "Document accepted", docId, `${clientId} · ${doc.document_type}`);
      if (profile.user_id) this.notify(profile.user_id, "Document accepted", `Your ${doc.document_type} was accepted. Thank you!`);
      this.sql.exec("UPDATE tasks SET done = 1 WHERE ref_type = 'document' AND ref_id = ? AND done = 0", docId);
    } else if (action === "replacement") {
      if (note.length < 3) return bad("Tell the client what is wrong with the document");
      this.sql.exec(
        "UPDATE documents SET status = 'replacement_required', reviewed_by = ?, rejection_reason = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        user.id, note, now, now, docId,
      );
      if (doc.request_id) this.sql.exec("UPDATE document_requests SET status = 'open', updated_at = ? WHERE id = ?", now, doc.request_id);
      this.timelineFor(clientId, `Replacement needed: ${doc.document_type} — ${note}`, user.name, "document");
      this.audit(user, "Document replacement requested", docId, `${clientId} · ${note}`);
      if (profile.user_id) this.notify(profile.user_id, "Replacement needed", `Your ${doc.document_type} needs to be uploaded again. ${note}`);
    } else if (action === "reject") {
      this.sql.exec(
        "UPDATE documents SET status = 'rejected', reviewed_by = ?, rejection_reason = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        user.id, note, now, now, docId,
      );
      this.timelineFor(clientId, `Document not accepted: ${doc.document_type}`, user.name, "document");
      this.audit(user, "Document rejected", docId, `${clientId} · ${note}`);
      if (profile.user_id) this.notify(profile.user_id, "Document not accepted", `Your ${doc.document_type} was not accepted. ${note}`);
    } else if (action === "under_review") {
      this.sql.exec("UPDATE documents SET status = 'under_review', reviewed_by = ?, updated_at = ? WHERE id = ?", user.id, now, docId);
      this.audit(user, "Document moved to under review", docId, clientId);
    } else {
      return bad("Invalid review action");
    }
    return Response.json({ ok: true });
  }

  private async sendAuthorizationToClient(request: Request, user: UserRow, clientId: string): Promise<Response> {
    const result = await this.staffProfile(user, clientId);
    if (result instanceof Response) return result;
    const profile = result;
    const body = (await request.json()) as Body;
    const templateId = str(body, "templateId");
    const template = this.sql
      .exec<{ id: string; name: string; version: number; active: number }>("SELECT id, name, version, active FROM authorization_templates WHERE id = ?", templateId)
      .toArray()[0];
    if (!template) return bad("Template not found", 404);
    if (template.active !== 1) return bad("This template is inactive — load the compliance-approved language as a new version first");
    const pending = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM authorizations WHERE client_id = ? AND template_id = ? AND status = 'pending'", clientId, templateId)
      .toArray()[0].n;
    if (pending > 0) return bad("This authorization is already awaiting the client's signature");
    const id = uid("auth_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO authorizations (id, client_id, template_id, template_version, template_name, status, agent_id, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      id, clientId, template.id, template.version, template.name, profile.agent_id ?? user.id, now,
    );
    this.timelineFor(clientId, `${template.name} sent for signature`, user.name, "authorization");
    this.audit(user, `Authorization sent: ${template.name} (v${template.version})`, id, clientId);
    if (profile.user_id) this.notify(profile.user_id, "Authorization needs your signature", `${template.name} is ready to review and sign in My Victora.`);
    this.addTaskOnce({
      title: `Confirm authorization signed — ${profile.first_name} ${profile.last_name}`,
      detail: `${clientId} · ${template.name} v${template.version}`,
      refType: "authorization", refId: id, dueHours: 72,
      assignedTo: profile.agent_id, clientId, priority: "normal",
    });
    return Response.json({ ok: true, authorizationId: id });
  }

  private async createQuotePresentation(request: Request, user: UserRow, clientId: string): Promise<Response> {
    const result = await this.staffProfile(user, clientId);
    if (result instanceof Response) return result;
    const profile = result;
    const body = (await request.json()) as Body;
    const title = str(body, "title");
    if (title.length < 3) return bad("Give the presentation a title");
    const rawOptions = Array.isArray(body.options) ? (body.options as Body[]) : [];
    const options = rawOptions.filter((o) => typeof o === "object" && o !== null).slice(0, 4);
    if (options.length === 0) return bad("Add at least one plan option");
    const id = uid("qp_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO quote_presentations (id, client_id, agent_id, title, coverage_area, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
      id, clientId, user.id, title, str(body, "coverageArea"), now, now,
    );
    options.forEach((o, i) => {
      this.sql.exec(
        "INSERT INTO quote_options (id, presentation_id, label, carrier, plan_name, metal_tier, premium, deductible, oop_max, pcp, specialist, urgent_care, er, generic_rx, network_type, dental_note, vision_note, notes, doc_link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        uid("qo_"), id, str(o, "label") || `Option ${String.fromCharCode(65 + i)}`, str(o, "carrier"), str(o, "plan_name"), str(o, "metal_tier"),
        str(o, "premium"), str(o, "deductible"), str(o, "oop_max"), str(o, "pcp"), str(o, "specialist"), str(o, "urgent_care"), str(o, "er"),
        str(o, "generic_rx"), str(o, "network_type"), str(o, "dental_note"), str(o, "vision_note"), str(o, "notes"), str(o, "doc_link"), now,
      );
    });
    this.audit(user, `Quote presentation created (${options.length} options)`, id, `${clientId} · ${title}`);
    return Response.json({ ok: true, presentationId: id });
  }

  private async setQuoteStatus(request: Request, user: UserRow, quoteId: string): Promise<Response> {
    const rows = this.sql
      .exec<{ id: string; client_id: string; agent_id: string; status: string; title: string }>(
        "SELECT id, client_id, agent_id, status, title FROM quote_presentations WHERE id = ?",
        quoteId,
      )
      .toArray();
    const quote = rows[0];
    if (!quote) return bad("Quote not found", 404);
    if (user.role === "agent" && quote.agent_id !== user.id) return bad("Not your quote presentation", 403);
    const body = (await request.json()) as Body;
    const status = str(body, "status");
    if (!(["ready", "sent", "archived"] as string[]).includes(status)) return bad("Invalid status");
    if (quote.status === "client_interested" && status !== "archived") return bad("The client has already expressed interest in this presentation");
    const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", quote.client_id).toArray()[0];
    const now = Date.now();
    if (status === "sent") {
      this.sql.exec("UPDATE quote_presentations SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?", now, now, quoteId);
      this.timelineFor(quote.client_id, "Coverage options sent for your review", user.name, "quote");
      this.audit(user, "Quote presentation sent", quoteId, quote.client_id);
      if (profile?.user_id) this.notify(profile.user_id, "New coverage options ready", `Your agent sent \"${quote.title}\" — compare your options in My Victora.`);
    } else {
      this.sql.exec("UPDATE quote_presentations SET status = ?, updated_at = ? WHERE id = ?", status, now, quoteId);
      this.audit(user, `Quote presentation → ${status}`, quoteId, quote.client_id);
    }
    return Response.json({ ok: true });
  }

  private listQuotePresentations(user: UserRow): Response {
    const base = "SELECT q.id, q.client_id, q.agent_id, q.title, q.coverage_area, q.status, q.sent_at, q.viewed_at, q.interested_option, q.created_at, p.first_name, p.last_name FROM quote_presentations q JOIN client_profiles p ON p.id = q.client_id";
    const rows =
      user.role === "agent"
        ? this.sql.exec(`${base} WHERE q.agent_id = ? ORDER BY q.created_at DESC LIMIT 100`, user.id).toArray()
        : this.sql.exec(`${base} ORDER BY q.created_at DESC LIMIT 100`).toArray();
    return Response.json({ ok: true, quotes: rows });
  }

  private quoteDetail(user: UserRow, quoteId: string): Response {
    const rows = this.sql
      .exec<{ id: string; client_id: string; agent_id: string; status: string }>("SELECT id, client_id, agent_id, status FROM quote_presentations WHERE id = ?", quoteId)
      .toArray();
    const quote = rows[0];
    if (!quote) return bad("Quote not found", 404);
    if (user.role === "agent" && quote.agent_id !== user.id) return bad("Not your quote presentation", 403);
    const options = this.sql
      .exec("SELECT id, label, carrier, plan_name, metal_tier, premium, deductible, oop_max, pcp, specialist, urgent_care, er, generic_rx, network_type, dental_note, vision_note, notes, doc_link FROM quote_options WHERE presentation_id = ? ORDER BY created_at", quoteId)
      .toArray();
    const interactions = this.sql
      .exec("SELECT action, option_id, message, at FROM quote_interactions WHERE presentation_id = ? ORDER BY at DESC LIMIT 50", quoteId)
      .toArray();
    return Response.json({ ok: true, quote, options, interactions });
  }

  /* ---------------------- Sprint 3: secure messaging ------------------------- */

  /** One conversation per client record — created on first use, agent-linked. */
  private ensureConversation(profile: ProfileRow): string {
    const existing = this.sql.exec<{ id: string }>("SELECT id FROM conversations WHERE client_id = ? ORDER BY created_at LIMIT 1", profile.id).toArray();
    if (existing[0]) return existing[0].id;
    const now = Date.now();
    const id = uid("cnv_");
    this.sql.exec(
      "INSERT INTO conversations (id, client_id, agent_id, subject, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, 'Secure conversation with Victora', 'open', ?, ?, ?)",
      id, profile.id, profile.agent_id, now, now, now,
    );
    if (profile.user_id) {
      this.sql.exec("INSERT INTO conversation_participants (id, conversation_id, user_id, role, last_read_at) VALUES (?, ?, ?, 'client', ?)", uid("cpt_"), id, profile.user_id, now);
    }
    if (profile.agent_id) {
      this.sql.exec("INSERT INTO conversation_participants (id, conversation_id, user_id, role, last_read_at) VALUES (?, ?, ?, 'staff', ?)", uid("cpt_"), id, profile.agent_id, now);
    }
    this.timelineFor(profile.id, "Secure conversation opened", "system", "message");
    this.audit(null, "Secure conversation opened", id, profile.id);
    return id;
  }

  private myMessages(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const convId = this.ensureConversation(profile);
    const conv = this.sql.exec<{ id: string; subject: string; status: string }>("SELECT id, subject, status FROM conversations WHERE id = ?", convId).toArray()[0];
    const messages = this.sql
      .exec("SELECT id, sender_user_id, sender_role, body, message_type, attachment_document_id, system_generated, created_at, read_at FROM messages WHERE conversation_id = ? ORDER BY created_at", convId)
      .toArray();
    const unread = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_role = 'staff' AND read_at IS NULL", convId)
      .toArray()[0].n;
    const agent = profile.agent_id
      ? this.sql.exec<{ id: string; name: string; email: string; phone: string }>("SELECT id, name, email, phone FROM users WHERE id = ?", profile.agent_id).toArray()[0] ?? null
      : null;
    return Response.json({ ok: true, conversation: { ...conv, agent }, messages, unread });
  }

  private async sendClientMessage(request: Request, user: UserRow): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const body = (await request.json()) as Body;
    const text = str(body, "body");
    if (text.length === 0) return bad("Write a message first");
    if (text.length > 5000) return bad("Messages are limited to 5,000 characters");
    const convId = this.ensureConversation(profile);
    const now = Date.now();
    const msgId = uid("msg_");
    this.sql.exec(
      "INSERT INTO messages (id, conversation_id, sender_user_id, sender_role, body, created_at, message_type, system_generated) VALUES (?, ?, ?, 'client', ?, ?, 'message', 0)",
      msgId, convId, user.id, text, now,
    );
    this.sql.exec("UPDATE conversations SET updated_at = ?, last_message_at = ? WHERE id = ?", now, now, convId);
    this.audit(user, "Secure message sent (client)", convId, profile.id);
    if (profile.agent_id) {
      // Dedupe is per-message so every new message notifies exactly once.
      this.notify(profile.agent_id, "New message from client", `${profile.first_name} ${profile.last_name} (${profile.id}): ${text.slice(0, 120)}`, "message_received", "conversation", msgId, profile.id);
    }
    return Response.json({ ok: true });
  }

  private markConversationRead(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const convs = this.sql.exec<{ id: string }>("SELECT id FROM conversations WHERE client_id = ?", profile.id).toArray();
    for (const c of convs) {
      this.sql.exec("UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_role = 'staff' AND read_at IS NULL", Date.now(), c.id);
    }
    return Response.json({ ok: true });
  }

  private listConversations(url: URL, user: UserRow): Response {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (user.role === "agent") {
      where.push("c.agent_id = ?");
      params.push(user.id);
    }
    if (url.searchParams.get("unread") === "1") {
      where.push("EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'client' AND m.read_at IS NULL)");
    }
    const rows = this.sql
      .exec(
        `SELECT c.id, c.subject, c.status, c.last_message_at, c.client_id, c.agent_id, p.first_name, p.last_name,
                (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                (SELECT sender_role FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_sender_role,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'client' AND m.read_at IS NULL) AS unread_client
         FROM conversations c JOIN client_profiles p ON p.id = c.client_id
         ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY c.last_message_at DESC LIMIT 100`,
        ...params,
      )
      .toArray();
    return Response.json({ ok: true, conversations: rows });
  }

  private conversationDetail(user: UserRow, convId: string): Response {
    const conv = this.sql
      .exec<{ id: string; client_id: string; agent_id: string | null; subject: string; status: string }>("SELECT id, client_id, agent_id, subject, status FROM conversations WHERE id = ?", convId)
      .toArray()[0];
    if (!conv) return bad("Conversation not found", 404);
    if (user.role === "agent" && conv.agent_id !== user.id) return bad("Not your conversation", 403);
    const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", conv.client_id).toArray()[0];
    const messages = this.sql
      .exec("SELECT id, sender_user_id, sender_role, body, message_type, attachment_document_id, system_generated, created_at, read_at FROM messages WHERE conversation_id = ? ORDER BY created_at", convId)
      .toArray();
    this.sql.exec("UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_role = 'client' AND read_at IS NULL", Date.now(), convId);
    return Response.json({
      ok: true,
      conversation: {
        ...conv,
        clientName: profile ? `${profile.first_name} ${profile.last_name}` : conv.client_id,
        agentName: conv.agent_id ? this.sql.exec<{ name: string }>("SELECT name FROM users WHERE id = ?", conv.agent_id).toArray()[0]?.name ?? null : null,
      },
      messages,
    });
  }

  private async staffReply(request: Request, user: UserRow, convId: string): Promise<Response> {
    const conv = this.sql
      .exec<{ id: string; client_id: string; agent_id: string | null }>("SELECT id, client_id, agent_id FROM conversations WHERE id = ?", convId)
      .toArray()[0];
    if (!conv) return bad("Conversation not found", 404);
    if (user.role === "agent" && conv.agent_id !== user.id) return bad("Not your conversation", 403);
    const body = (await request.json()) as Body;
    const text = str(body, "body");
    if (text.length === 0) return bad("Write a reply first");
    if (text.length > 5000) return bad("Messages are limited to 5,000 characters");
    const now = Date.now();
    const msgId = uid("msg_");
    this.sql.exec(
      "INSERT INTO messages (id, conversation_id, sender_user_id, sender_role, body, created_at, message_type, system_generated) VALUES (?, ?, ?, 'staff', ?, ?, 'message', 0)",
      msgId, convId, user.id, text, now,
    );
    this.sql.exec("UPDATE conversations SET updated_at = ?, last_message_at = ? WHERE id = ?", now, now, convId);
    const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", conv.client_id).toArray()[0];
    this.audit(user, "Secure reply sent", convId, conv.client_id);
    if (profile?.user_id) {
      // Dedupe is per-message so every new reply notifies exactly once.
      this.notify(profile.user_id, "New message from your Victora agent", `${user.name}: ${text.slice(0, 160)}`, "message_received", "conversation", msgId, conv.client_id);
    }
    return Response.json({ ok: true });
  }

  /* --------------------- Sprint 3: internal staff notes ---------------------- */

  /** INTERNAL — Victora staff only. Never exposed through any client route. */
  private async addInternalNote(request: Request, user: UserRow, clientId: string): Promise<Response> {
    const result = await this.staffProfile(user, clientId);
    if (result instanceof Response) return result;
    const body = (await request.json()) as Body;
    const text = str(body, "body");
    if (text.length < 2) return bad("Write the note first");
    if (text.length > 4000) return bad("Notes are limited to 4,000 characters");
    const id = uid("note_");
    this.sql.exec(
      "INSERT INTO internal_notes (id, client_id, author_id, author_role, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, clientId, user.id, user.role, user.name, text, Date.now(),
    );
    this.audit(user, "Internal note added", clientId, text.slice(0, 80));
    return Response.json({ ok: true, noteId: id });
  }

  /* --------------------- Sprint 3: service tickets --------------------------- */

  private async createTicket(request: Request, user: UserRow): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const body = (await request.json()) as Body;
    const category = str(body, "category");
    const description = str(body, "description");
    if (!(TICKET_CATEGORIES as readonly string[]).includes(category)) return bad("Please choose a request category");
    if (description.length < 5) return bad("Tell us a little about what you need");
    const isCancellation = category === "Cancellation / Termination Request";
    const id = uid("tkt_");
    const number = this.nextTicketNumber();
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO service_tickets (id, client_id, ticket_number, category, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?)",
      id, profile.id, number, category, description, isCancellation ? "high" : "normal", now, now,
    );
    this.timelineFor(profile.id, `Service request opened: ${category} (${number})`, user.name, "ticket");
    this.audit(user, `Service request created: ${category}`, id, `${profile.id} · ${number}`);
    if (profile.agent_id) {
      this.notify(profile.agent_id, "New service request", `${profile.first_name} ${profile.last_name} (${profile.id}) — ${category} · ${number}`, "ticket_created", "ticket", id, profile.id);
    }
    this.addTaskOnce({
      title: isCancellation ? `Cancellation request — call to confirm: ${profile.first_name} ${profile.last_name}` : `Service request: ${category} — ${profile.first_name} ${profile.last_name}`,
      detail: `${profile.id} · ${number}`,
      refType: "ticket", refId: id, dueHours: isCancellation ? 4 : 24,
      assignedTo: profile.agent_id, clientId: profile.id, priority: isCancellation ? "high" : "normal",
    });
    return Response.json({ ok: true, ticketId: id, ticketNumber: number });
  }

  private myTickets(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec(
        `SELECT t.id, t.ticket_number, t.category, t.description, t.status, t.priority, t.latest_response, t.created_at, t.updated_at,
                u.name AS assigned_name
         FROM service_tickets t LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.client_id = ? ORDER BY t.created_at DESC`,
        profile.id,
      )
      .toArray();
    return Response.json({ ok: true, tickets: rows });
  }

  private ticketDetailClient(user: UserRow, ticketId: string): Response {
    const profile = this.requireProfile(user.id);
    const ticket = this.sql
      .exec(
        `SELECT t.id, t.ticket_number, t.category, t.description, t.status, t.priority, t.latest_response, t.created_at, t.updated_at, u.name AS assigned_name
         FROM service_tickets t LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.id = ? AND t.client_id = ?`,
        ticketId,
        profile.id,
      )
      .toArray()[0];
    if (!ticket) return bad("Request not found", 404);
    // Internal staff comments are filtered out at the query level.
    const comments = this.sql
      .exec("SELECT id, author_role, body, created_at FROM ticket_comments WHERE ticket_id = ? AND internal = 0 ORDER BY created_at", ticketId)
      .toArray();
    return Response.json({ ok: true, ticket, comments });
  }

  private async ticketReplyClient(request: Request, user: UserRow, ticketId: string): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const ticket = this.sql
      .exec<{ id: string; assigned_to: string | null; status: string; ticket_number: string }>("SELECT id, assigned_to, status, ticket_number FROM service_tickets WHERE id = ? AND client_id = ?", ticketId, profile.id)
      .toArray()[0];
    if (!ticket) return bad("Request not found", 404);
    if (ticket.status === "closed") return bad("This request is closed — please open a new request");
    const body = (await request.json()) as Body;
    const text = str(body, "body");
    if (text.length === 0) return bad("Write your reply first");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO ticket_comments (id, ticket_id, author_id, author_role, body, internal, created_at) VALUES (?, ?, ?, 'client', ?, 0, ?)",
      uid("cmt_"), ticketId, user.id, text, now,
    );
    // A client reply can only move a ticket out of waiting_on_client — never
    // change ownership, priority, or privileged statuses.
    const newStatus = ticket.status === "waiting_on_client" ? "in_progress" : ticket.status;
    this.sql.exec("UPDATE service_tickets SET latest_response = ?, status = ?, updated_at = ? WHERE id = ?", text.slice(0, 200), newStatus, now, ticketId);
    this.audit(user, `Service request reply: ${ticket.ticket_number}`, ticketId, profile.id);
    if (ticket.assigned_to) {
      this.notify(ticket.assigned_to, "Client replied to a service request", `${profile.first_name} ${profile.last_name} (${ticket.ticket_number}): ${text.slice(0, 120)}`, "ticket_reply", "ticket", ticketId, profile.id);
    }
    return Response.json({ ok: true });
  }

  private listTickets(url: URL, user: UserRow): Response {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (user.role === "agent") {
      where.push("(p.agent_id = ? OR t.assigned_to = ?)");
      params.push(user.id, user.id);
    }
    if (url.searchParams.get("assigned") === "me") {
      where.push("t.assigned_to = ?");
      params.push(user.id);
    }
    const status = url.searchParams.get("status");
    if (status && (TICKET_STATUSES as readonly string[]).includes(status)) {
      where.push("t.status = ?");
      params.push(status);
    }
    const rows = this.sql
      .exec(
        `SELECT t.id, t.ticket_number, t.category, t.description, t.status, t.priority, t.assigned_to, t.latest_response, t.created_at, t.updated_at,
                u.name AS assigned_name, p.id AS client_id, p.first_name, p.last_name
         FROM service_tickets t LEFT JOIN users u ON u.id = t.assigned_to JOIN client_profiles p ON p.id = t.client_id
         ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY t.updated_at DESC LIMIT 200`,
        ...params,
      )
      .toArray();
    return Response.json({ ok: true, tickets: rows });
  }

  private async ticketDetailStaff(user: UserRow, ticketId: string): Promise<Response> {
    const ticket = this.sql.exec<{ id: string; client_id: string }>("SELECT id, client_id FROM service_tickets WHERE id = ?", ticketId).toArray()[0];
    if (!ticket) return bad("Request not found", 404);
    const access = await this.staffProfile(user, ticket.client_id);
    if (access instanceof Response) return access;
    const full = this.sql
      .exec(
        `SELECT t.*, u.name AS assigned_name, p.first_name, p.last_name FROM service_tickets t
         LEFT JOIN users u ON u.id = t.assigned_to JOIN client_profiles p ON p.id = t.client_id WHERE t.id = ?`,
        ticketId,
      )
      .toArray()[0];
    const comments = this.sql
      .exec("SELECT c.id, c.author_id, c.author_role, c.body, c.internal, c.created_at, u.name AS author_name FROM ticket_comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.ticket_id = ? ORDER BY c.created_at", ticketId)
      .toArray();
    return Response.json({ ok: true, ticket: full, comments });
  }

  private async ticketAction(request: Request, user: UserRow, ticketId: string): Promise<Response> {
    const ticket = this.sql
      .exec<{ id: string; client_id: string; assigned_to: string | null; status: string; ticket_number: string; category: string }>(
        "SELECT id, client_id, assigned_to, status, ticket_number, category FROM service_tickets WHERE id = ?",
        ticketId,
      )
      .toArray()[0];
    if (!ticket) return bad("Request not found", 404);
    const access = await this.staffProfile(user, ticket.client_id);
    if (access instanceof Response) return access;
    const profile = access;
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();

    if (action === "reply") {
      const text = str(body, "body");
      if (text.length === 0) return bad("Write the reply first");
      const internal = bool(body, "internal");
      const commentId = uid("cmt_");
      this.sql.exec(
        "INSERT INTO ticket_comments (id, ticket_id, author_id, author_role, body, internal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        commentId, ticketId, user.id, user.role, text, internal ? 1 : 0, now,
      );
      this.sql.exec("UPDATE service_tickets SET latest_response = ?, updated_at = ? WHERE id = ?", internal ? "" : text.slice(0, 200), now, ticketId);
      this.audit(user, `Service request ${internal ? "internal note" : "reply"}: ${ticket.ticket_number}`, ticketId, ticket.client_id);
      if (!internal && profile.user_id) {
        // Dedupe is per-comment so every new reply notifies exactly once.
        this.notify(profile.user_id, "Update on your service request", `${ticket.ticket_number} (${ticket.category}): ${text.slice(0, 160)}`, "ticket_update", "ticket", commentId, ticket.client_id);
      }
      return Response.json({ ok: true });
    }

    if (action === "assign") {
      const agentId = str(body, "agentId");
      if (user.role === "agent") {
        if (ticket.assigned_to !== null && ticket.assigned_to !== user.id) return bad("Manager access required to reassign", 403);
        if (agentId !== user.id) return bad("Agents can only assign tickets to themselves", 403);
        if (profile.agent_id !== user.id) return bad("Client not assigned to you", 403);
      }
      const agent = this.mustUser(agentId);
      this.sql.exec("UPDATE service_tickets SET assigned_to = ?, updated_at = ? WHERE id = ?", agent.id, now, ticketId);
      this.notify(agent.id, "Service request assigned", `${ticket.ticket_number} (${ticket.category}) — ${profile.first_name} ${profile.last_name}.`);
      this.audit(user, `Service request assigned to ${agent.name}`, ticketId, ticket.ticket_number);
      return Response.json({ ok: true });
    }

    if (action === "priority") {
      const priority = str(body, "priority");
      if (!["normal", "high", "urgent"].includes(priority)) return bad("Invalid priority");
      this.sql.exec("UPDATE service_tickets SET priority = ?, updated_at = ? WHERE id = ?", priority, now, ticketId);
      this.audit(user, `Service request priority → ${priority}`, ticketId, ticket.ticket_number);
      return Response.json({ ok: true });
    }

    if (action === "status") {
      const status = str(body, "status");
      if (!(TICKET_STATUSES as readonly string[]).includes(status)) return bad("Invalid status");
      this.sql.exec("UPDATE service_tickets SET status = ?, updated_at = ? WHERE id = ?", status, now, ticketId);
      if (status === "resolved") {
        this.timelineFor(ticket.client_id, `Service request resolved: ${ticket.category} (${ticket.ticket_number})`, user.name, "ticket");
        if (profile.user_id) {
          this.notify(profile.user_id, "Service request resolved", `${ticket.ticket_number} (${ticket.category}) has been resolved. Reply there if you need anything else.`, "ticket_update", "ticket", ticketId, ticket.client_id);
        }
      }
      if (status === "closed") {
        this.timelineFor(ticket.client_id, `Service request closed: ${ticket.category} (${ticket.ticket_number})`, user.name, "ticket");
        if (profile.user_id) this.notify(profile.user_id, "Service request closed", `${ticket.ticket_number} (${ticket.category}) has been closed.`);
      }
      // A cancellation REQUEST is a service action only — Victora's record
      // never claims a policy was terminated; carrier confirmation is required.
      if (ticket.category === "Cancellation / Termination Request" && status === "resolved") {
        this.audit(user, "Cancellation request handled — carrier confirmation still required", ticketId, ticket.ticket_number);
      }
      this.audit(user, `Service request status → ${status}`, ticketId, ticket.ticket_number);
      return Response.json({ ok: true });
    }

    return bad("Unknown ticket action");
  }

  /* -------------------- Sprint 3: coverage servicing records ----------------- */

  private async createPolicy(request: Request, user: UserRow, clientId: string): Promise<Response> {
    const access = await this.staffProfile(user, clientId);
    if (access instanceof Response) return access;
    const profile = access;
    const body = (await request.json()) as Body;
    const productType = str(body, "productType");
    const carrier = str(body, "carrier");
    const planName = str(body, "planName");
    const effectiveDate = str(body, "effectiveDate");
    const status = str(body, "status") || "pending";
    if (!(POLICY_PRODUCT_TYPES as readonly string[]).includes(productType)) return bad("Product type must be Health, Dental, or Vision");
    if (carrier.length < 2 || planName.length < 2) return bad("Carrier and plan name are required");
    if (effectiveDate.length === 0) return bad("Effective date is required");
    if (!(POLICY_STATUSES as readonly string[]).includes(status)) return bad("Invalid policy status");
    if (status === "active" && str(body, "policyIdentifier").length === 0) {
      return bad("Verified enrollment information (policy/member identifier) is required before marking coverage active");
    }
    const id = uid("pol_");
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO policies (id, client_id, product_type, carrier, plan_name, policy_identifier, effective_date, termination_date, status,
        monthly_premium, deductible, out_of_pocket_max, network_type, pcp_cost, specialist_cost, rx_summary,
        dental_flag, vision_flag, carrier_portal_url, provider_search_url, carrier_phone, agent_id, source_quote_option_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, clientId, productType, carrier, planName, str(body, "policyIdentifier"), effectiveDate, str(body, "terminationDate"),
      status, str(body, "monthlyPremium"), str(body, "deductible"), str(body, "outOfPocketMax"), str(body, "networkType"),
      str(body, "pcpCost"), str(body, "specialistCost"), str(body, "rxSummary"),
      bool(body, "dentalFlag") ? 1 : 0, bool(body, "visionFlag") ? 1 : 0,
      str(body, "carrierPortalUrl"), str(body, "providerSearchUrl"), str(body, "carrierPhone"),
      profile.agent_id ?? user.id, str(body, "sourceQuoteOptionId"), str(body, "notes"), now, now,
    );
    const members = Array.isArray(body.members)
      ? (body.members as Body[]).filter((m) => typeof m === "object" && m !== null && str(m, "name").length > 0).slice(0, 20)
      : [];
    for (const m of members) {
      this.sql.exec(
        "INSERT INTO policy_members (id, policy_id, name, relationship, dob, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        uid("pmem_"), id, str(m, "name"), str(m, "relationship"), str(m, "dob"), now,
      );
    }
    this.syncRelationshipStatus(clientId);
    this.timelineFor(clientId, `Coverage record added: ${productType} — ${carrier} ${planName} (${status})`, user.name, "policy");
    this.audit(user, `Policy record created: ${productType} ${carrier} ${planName} (${status})`, id, clientId);
    if (status === "active" && profile.user_id) {
      this.notify(profile.user_id, "Your coverage is active", `${productType} — ${carrier} ${planName} is active effective ${effectiveDate}. Welcome to Victora!`, "policy_activated", "policy", id, clientId);
      this.timelineFor(clientId, "Welcome Center unlocked", "system", "welcome");
    }
    return Response.json({ ok: true, policyId: id });
  }

  private async updatePolicy(request: Request, user: UserRow, policyId: string): Promise<Response> {
    const policy = this.sql
      .exec<{ id: string; client_id: string; status: string; product_type: string; carrier: string; plan_name: string }>(
        "SELECT id, client_id, status, product_type, carrier, plan_name FROM policies WHERE id = ?",
        policyId,
      )
      .toArray()[0];
    if (!policy) return bad("Policy not found", 404);
    const access = await this.staffProfile(user, policy.client_id);
    if (access instanceof Response) return access;
    const profile = access;
    const body = (await request.json()) as Body;
    const now = Date.now();
    const fields: Record<string, string | number> = {};
    const textFields: [string, string][] = [
      ["carrier", "carrier"], ["plan_name", "planName"], ["policy_identifier", "policyIdentifier"],
      ["effective_date", "effectiveDate"], ["termination_date", "terminationDate"], ["monthly_premium", "monthlyPremium"],
      ["deductible", "deductible"], ["out_of_pocket_max", "outOfPocketMax"], ["network_type", "networkType"],
      ["pcp_cost", "pcpCost"], ["specialist_cost", "specialistCost"], ["rx_summary", "rxSummary"],
      ["carrier_portal_url", "carrierPortalUrl"], ["provider_search_url", "providerSearchUrl"],
      ["carrier_phone", "carrierPhone"], ["notes", "notes"],
    ];
    for (const [col, key] of textFields) {
      if (typeof body[key] === "string") fields[col] = str(body, key);
    }
    if (typeof body.status === "string") {
      const status = str(body, "status");
      if (!(POLICY_STATUSES as readonly string[]).includes(status)) return bad("Invalid policy status");
      fields.status = status;
    }
    if (Object.keys(fields).length === 0) return bad("Nothing to update");
    const sets = Object.keys(fields).map((c) => `${c} = ?`).join(", ");
    this.sql.exec(`UPDATE policies SET ${sets}, updated_at = ? WHERE id = ?`, ...Object.values(fields), now, policyId);
    if (fields.status !== undefined && fields.status !== policy.status) {
      const st = String(fields.status);
      this.timelineFor(policy.client_id, `Coverage ${policy.product_type} (${policy.carrier} ${policy.plan_name}) — ${st}`, user.name, "policy");
      this.audit(user, `Policy status → ${st}`, policyId, policy.client_id);
      if (st === "active" && profile.user_id) {
        this.notify(profile.user_id, "Your coverage is active", `${policy.product_type} — ${policy.carrier} ${policy.plan_name} is now active. Welcome to Victora!`, "policy_activated", "policy", policyId, policy.client_id);
        this.timelineFor(policy.client_id, "Welcome Center unlocked", "system", "welcome");
      }
      if (["terminated", "expired", "cancelled"].includes(st) && profile.user_id) {
        this.notify(profile.user_id, "Coverage update", `Your ${policy.product_type} coverage (${policy.carrier} ${policy.plan_name}) is now shown as ${st}. Contact Victora with any questions.`, "policy_terminated", "policy", policyId, policy.client_id);
      }
    }
    this.syncRelationshipStatus(policy.client_id);
    return Response.json({ ok: true });
  }

  private myPolicies(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec(
        `SELECT id, product_type, carrier, plan_name, policy_identifier, effective_date, termination_date, status,
                monthly_premium, deductible, out_of_pocket_max, network_type, pcp_cost, specialist_cost, rx_summary,
                carrier_portal_url, provider_search_url, carrier_phone, notes FROM policies WHERE client_id = ? ORDER BY created_at DESC`,
        profile.id,
      )
      .toArray();
    return Response.json({ ok: true, policies: rows });
  }

  private listPolicies(user: UserRow): Response {
    const base = "SELECT pol.*, p.first_name, p.last_name FROM policies pol JOIN client_profiles p ON p.id = pol.client_id";
    const rows =
      user.role === "agent"
        ? this.sql.exec(`${base} WHERE pol.client_id IN (SELECT id FROM client_profiles WHERE agent_id = ?) ORDER BY pol.created_at DESC LIMIT 200`, user.id).toArray()
        : this.sql.exec(`${base} ORDER BY pol.created_at DESC LIMIT 200`).toArray();
    return Response.json({ ok: true, policies: rows });
  }

  /* --------------------------- Sprint 3: renewals ---------------------------- */

  private async createRenewal(request: Request, user: UserRow, clientId: string): Promise<Response> {
    const access = await this.staffProfile(user, clientId);
    if (access instanceof Response) return access;
    const profile = access;
    const body = (await request.json()) as Body;
    const policyId = str(body, "policyId");
    const renewalDate = str(body, "renewalDate");
    const policy = this.sql.exec<{ id: string; client_id: string; product_type: string }>("SELECT id, client_id, product_type FROM policies WHERE id = ?", policyId).toArray()[0];
    if (!policy || policy.client_id !== clientId) return bad("Policy not found for this client", 404);
    if (renewalDate.length === 0) return bad("Renewal date is required");
    const id = uid("rnw_");
    const now = Date.now();
    const period = str(body, "renewalPeriod") || renewalDate.slice(0, 4);
    this.sql.exec(
      "INSERT INTO renewals (id, policy_id, client_id, renewal_period, renewal_date, status, assigned_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'upcoming', ?, ?, ?)",
      id, policyId, clientId, period, renewalDate, profile.agent_id ?? user.id, now, now,
    );
    this.audit(user, `Renewal created for ${policy.product_type} (${period})`, id, clientId);
    return Response.json({ ok: true, renewalId: id });
  }

  private listRenewals(url: URL, user: UserRow): Response {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (user.role === "agent") {
      where.push("p.agent_id = ?");
      params.push(user.id);
    }
    const status = url.searchParams.get("status");
    if (status && (RENEWAL_STATUSES as readonly string[]).includes(status)) {
      where.push("r.status = ?");
      params.push(status);
    }
    const rows = this.sql
      .exec(
        `SELECT r.*, p.first_name, p.last_name, p.agent_id, pol.product_type, pol.carrier, pol.plan_name
         FROM renewals r JOIN client_profiles p ON p.id = r.client_id JOIN policies pol ON pol.id = r.policy_id
         ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY r.renewal_date LIMIT 200`,
        ...params,
      )
      .toArray();
    return Response.json({ ok: true, renewals: rows });
  }

  private async renewalAction(request: Request, user: UserRow, renewalId: string): Promise<Response> {
    const renewal = this.sql
      .exec<{ id: string; client_id: string; assigned_agent: string | null; first_contact_at: number | null; renewal_date: string; renewal_period: string }>(
        "SELECT id, client_id, assigned_agent, first_contact_at, renewal_date, renewal_period FROM renewals WHERE id = ?",
        renewalId,
      )
      .toArray()[0];
    if (!renewal) return bad("Renewal not found", 404);
    const access = await this.staffProfile(user, renewal.client_id);
    if (access instanceof Response) return access;
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();
    if (action === "status") {
      const status = str(body, "status");
      if (!(RENEWAL_STATUSES as readonly string[]).includes(status)) return bad("Invalid renewal status");
      const updates: Record<string, string | number | null> = { status, updated_at: now };
      if (status === "contacted" && renewal.first_contact_at === null) updates.first_contact_at = now;
      if (status === "completed") updates.review_completed_at = now;
      const sets = Object.keys(updates).map((c) => `${c} = ?`).join(", ");
      this.sql.exec(`UPDATE renewals SET ${sets} WHERE id = ?`, ...Object.values(updates), renewalId);
      this.audit(user, `Renewal → ${status} (${renewal.renewal_period})`, renewalId, renewal.client_id);
      return Response.json({ ok: true });
    }
    if (action === "note") {
      this.sql.exec("UPDATE renewals SET notes = ?, updated_at = ? WHERE id = ?", str(body, "notes"), now, renewalId);
      this.audit(user, "Renewal note updated", renewalId, renewal.client_id);
      return Response.json({ ok: true });
    }
    if (action === "outcome") {
      this.sql.exec("UPDATE renewals SET outcome = ?, updated_at = ? WHERE id = ?", str(body, "outcome"), now, renewalId);
      this.audit(user, "Renewal outcome recorded", renewalId, renewal.client_id);
      return Response.json({ ok: true });
    }
    if (action === "assign") {
      if (!!["agent"].includes(user.role)) return bad("Manager access required", 403);
      const agent = this.mustUser(str(body, "agentId"));
      this.sql.exec("UPDATE renewals SET assigned_agent = ?, updated_at = ? WHERE id = ?", agent.id, now, renewalId);
      this.audit(user, `Renewal assigned to ${agent.name}`, renewalId, renewal.client_id);
      return Response.json({ ok: true });
    }
    return bad("Unknown renewal action");
  }

  private myRenewals(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec(
        `SELECT r.id, r.renewal_period, r.renewal_date, r.status, pol.product_type, pol.carrier, pol.plan_name
         FROM renewals r JOIN policies pol ON pol.id = r.policy_id
         WHERE r.client_id = ? ORDER BY r.renewal_date DESC`,
        profile.id,
      )
      .toArray();
    return Response.json({ ok: true, renewals: rows });
  }

  /* --------------------------- Sprint 3: referrals --------------------------- */

  private async submitReferral(request: Request, user: UserRow): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const body = (await request.json()) as Body;
    const name = str(body, "name");
    const email = str(body, "email").toLowerCase();
    const phone = str(body, "phone");
    if (name.length < 2) return bad("Please enter the person's name");
    if (!email.includes("@") && phone.length < 7) return bad("Include an email or phone number so we can reach them");
    if (!bool(body, "consent")) return bad("Please confirm you have permission to share their contact information");
    const id = uid("ref_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO referrals (id, referring_client_id, referred_name, referred_email, referred_phone, relationship, status, source, campaign, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'submitted', 'Client Referral', ?, ?, ?, ?)",
      id, profile.id, name, email, phone, str(body, "relationship"), profile.campaign, str(body, "message"), now, now,
    );
    this.timelineFor(profile.id, `Referral submitted: ${name}`, user.name, "referral");
    this.audit(user, `Referral submitted: ${name}`, id, profile.id);
    if (profile.agent_id) {
      this.notify(profile.agent_id, "New client referral", `${profile.first_name} ${profile.last_name} (${profile.id}) referred ${name}.`, "referral_received", "referral", id, profile.id);
    }
    this.addTaskOnce({
      title: `New referral: ${name}`,
      detail: `Referred by ${profile.first_name} ${profile.last_name} (${profile.id})`,
      refType: "referral", refId: id, dueHours: 48,
      assignedTo: profile.agent_id, clientId: profile.id, priority: "normal",
    });
    return Response.json({ ok: true, referralId: id });
  }

  private myReferrals(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const rows = this.sql
      .exec("SELECT id, referred_name, referred_email, referred_phone, relationship, status, created_at FROM referrals WHERE referring_client_id = ? ORDER BY created_at DESC", profile.id)
      .toArray();
    return Response.json({ ok: true, referrals: rows });
  }

  private listReferrals(user: UserRow): Response {
    const base = "SELECT r.*, p.first_name, p.last_name, p.id AS client_id FROM referrals r JOIN client_profiles p ON p.id = r.referring_client_id";
    const rows =
      user.role === "agent"
        ? this.sql.exec(`${base} WHERE p.agent_id = ? OR p.agent_id IS NULL ORDER BY r.created_at DESC LIMIT 200`, user.id).toArray()
        : this.sql.exec(`${base} ORDER BY r.created_at DESC LIMIT 200`).toArray();
    return Response.json({ ok: true, referrals: rows });
  }

  private async referralAction(request: Request, user: UserRow, referralId: string): Promise<Response> {
    const referral = this.sql
      .exec<{ id: string; referring_client_id: string; referred_name: string; status: string }>("SELECT id, referring_client_id, referred_name, status FROM referrals WHERE id = ?", referralId)
      .toArray()[0];
    if (!referral) return bad("Referral not found", 404);
    const access = await this.staffProfile(user, referral.referring_client_id);
    if (access instanceof Response) return access;
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();
    if (action === "status") {
      const status = str(body, "status");
      if (!(REFERRAL_STATUSES as readonly string[]).includes(status)) return bad("Invalid referral status");
      let converted: string | null = null;
      if (status === "converted") {
        converted = str(body, "convertedClientId");
        const target = this.sql.exec<{ id: string }>("SELECT id FROM client_profiles WHERE id = ?", converted).toArray()[0];
        if (!target) return bad("Converted client record not found — create or link their VIC record first");
      }
      this.sql.exec("UPDATE referrals SET status = ?, converted_client_id = COALESCE(?, converted_client_id), updated_at = ? WHERE id = ?", status, converted, now, referralId);
      this.audit(user, `Referral → ${status}: ${referral.referred_name}`, referralId, referral.referring_client_id);
      return Response.json({ ok: true });
    }
    return bad("Unknown referral action");
  }

  /* -------------------- Sprint 3: communication preferences ------------------ */

  private myPreferences(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const row = this.sql
      .exec("SELECT portal, email, sms, phone, preferred_language, consent_status, consent_at, optout_at, source, updated_at FROM comm_prefs WHERE client_id = ?", profile.id)
      .toArray()[0];
    if (row) return Response.json({ ok: true, preferences: row });
    return Response.json({
      ok: true,
      preferences: {
        portal: 1,
        email: 0,
        sms: 0,
        phone: 0,
        preferred_language: profile.preferred_language || "English",
        consent_status: "none",
        consent_at: null,
        optout_at: null,
        source: "",
        updated_at: 0,
      },
    });
  }

  private async savePreferences(request: Request, user: UserRow): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const body = (await request.json()) as Body;
    const existing = this.sql.exec<{ id: string; email: number; sms: number; consent_at: number | null }>("SELECT id, email, sms, consent_at FROM comm_prefs WHERE client_id = ?", profile.id).toArray()[0];
    const email = typeof body.email === "boolean" ? (body.email ? 1 : 0) : existing?.email ?? 0;
    const sms = typeof body.sms === "boolean" ? (body.sms ? 1 : 0) : existing?.sms ?? 0;
    const portal = typeof body.portal === "boolean" ? (body.portal ? 1 : 0) : 1;
    const phone = typeof body.phone === "boolean" ? (body.phone ? 1 : 0) : 0;
    const language = str(body, "preferredLanguage") || profile.preferred_language || "English";
    const now = Date.now();
    // Consent is tracked with timestamps and source: opting into email/SMS
    // records an explicit opt-in; turning both off records the opt-out.
    const wasAny = (existing?.email ?? 0) === 1 || (existing?.sms ?? 0) === 1;
    const isAny = email === 1 || sms === 1;
    let consentStatus = "none";
    let consentAt: number | null = null;
    let optoutAt: number | null = null;
    if (isAny) {
      consentStatus = "opted_in";
      consentAt = existing && wasAny ? existing.consent_at ?? now : now;
    } else if (existing && wasAny) {
      consentStatus = "opted_out";
      optoutAt = now;
    }
    if (existing) {
      this.sql.exec(
        "UPDATE comm_prefs SET portal = ?, email = ?, sms = ?, phone = ?, preferred_language = ?, consent_status = COALESCE(NULLIF(?, 'none'), consent_status), consent_at = COALESCE(?, consent_at), optout_at = COALESCE(?, optout_at), source = 'client_portal', updated_at = ? WHERE client_id = ?",
        portal, email, sms, phone, language, consentStatus, consentAt, optoutAt, now, profile.id,
      );
    } else {
      this.sql.exec(
        "INSERT INTO comm_prefs (id, client_id, portal, email, sms, phone, preferred_language, consent_status, consent_at, optout_at, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'client_portal', ?)",
        uid("cpr_"), profile.id, portal, email, sms, phone, language, consentStatus, consentAt, optoutAt, now,
      );
    }
    this.sql.exec("UPDATE client_profiles SET preferred_language = ?, updated_at = ? WHERE id = ?", language, now, profile.id);
    this.audit(user, "Communication preferences updated", profile.id, `email:${email} sms:${sms}`);
    return Response.json({ ok: true });
  }

  /* ---------------------- Sprint 3: welcome center --------------------------- */

  private myWelcome(user: UserRow): Response {
    const profile = this.requireProfile(user.id);
    const unlocked = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM policies WHERE client_id = ? AND status = 'active'", profile.id).toArray()[0].n > 0;
    const completed = this.sql.exec("SELECT item_key, completed_at FROM welcome_items WHERE client_id = ?", profile.id).toArray();
    const activePolicies = this.sql
      .exec("SELECT id, product_type, carrier, plan_name, carrier_portal_url, provider_search_url, carrier_phone, effective_date FROM policies WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC", profile.id)
      .toArray();
    const agent = profile.agent_id
      ? this.sql.exec<{ id: string; name: string; email: string; phone: string }>("SELECT id, name, email, phone FROM users WHERE id = ?", profile.agent_id).toArray()[0] ?? null
      : null;
    return Response.json({ ok: true, unlocked, completed, activePolicies, agent });
  }

  private async completeWelcomeItem(request: Request, user: UserRow): Promise<Response> {
    const profile = this.requireProfile(user.id);
    const unlocked = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM policies WHERE client_id = ? AND status = 'active'", profile.id).toArray()[0].n > 0;
    if (!unlocked) return bad("Welcome Center unlocks once your coverage is active");
    const body = (await request.json()) as Body;
    const itemKey = str(body, "itemKey");
    if (!(WELCOME_KEYS as readonly string[]).includes(itemKey)) return bad("Unknown checklist item");
    const done = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM welcome_items WHERE client_id = ? AND item_key = ?", profile.id, itemKey).toArray()[0].n;
    if (done === 0) {
      this.sql.exec("INSERT INTO welcome_items (id, client_id, item_key, completed_at) VALUES (?, ?, ?, ?)", uid("wcm_"), profile.id, itemKey, Date.now());
      this.audit(user, `Welcome checklist: ${itemKey}`, profile.id);
    }
    return Response.json({ ok: true });
  }

  /* ------------------- Sprint 3: outbound delivery log ----------------------- */

  private listDeliveries(user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const rows = this.sql
      .exec("SELECT id, user_id, client_id, event, channel, provider, destination, template, title, status, attempts, error, ref_type, ref_id, created_at, delivered_at FROM notification_deliveries ORDER BY created_at DESC LIMIT 200")
      .toArray();
    return Response.json({ ok: true, deliveries: rows });
  }

  /* ------------------ Sprint 4: password reset architecture ------------------ */

  private async forgotPassword(request: Request): Promise<Response> {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!this.checkRate(`forgot:${ip}`, 10, 3_600_000)) return bad("Too many requests — try again later", 429);
    const body = (await request.json()) as Body;
    const email = str(body, "email").toLowerCase();
    if (!this.checkRate(`forgot:acct:${email}`, 5, 3_600_000)) return bad("Too many requests — try again later", 429);
    // Never reveal whether an account exists.
    const user = this.sql.exec<UserRow>("SELECT * FROM users WHERE email = ?", email).toArray()[0];
    if (user && (user.active ?? 1) === 1) {
      const token = randomToken(24);
      const id = uid("pwr_");
      this.sql.exec(
        "INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, 'self', ?)",
        id, user.id, await sha256Hex(token), Date.now() + 30 * 60_000, Date.now(),
      );
      this.audit(null, "Password reset requested", user.id, email);
      // Delivered through the provider adapter; with no email provider
      // configured the attempt is recorded as `not_configured`, never "sent".
      this.ctx.waitUntil(
        this.deliverOutbound("email", {
          userId: user.id, clientId: "", event: "password_reset", refType: "password_reset", refId: id,
          destination: email, subject: "Reset your Victora password",
          body: `A password reset was requested for your Victora account.\n\nOne-time code (valid 30 minutes): ${token}\n\nEnter this code in Victora to choose a new password. If you did not request this, you can ignore this message.`,
        }),
      );
    }
    return Response.json({ ok: true, message: "If that email has an account, reset instructions will be delivered." });
  }

  private async resetPassword(request: Request): Promise<Response> {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!this.checkRate(`reset:${ip}`, 20, 3_600_000)) return bad("Too many requests — try again later", 429);
    const body = (await request.json()) as Body;
    const token = str(body, "token");
    const password = str(body, "password");
    if (token.length < 10) return bad("This reset code is not valid");
    if (password.length < 8) return bad("Password must be at least 8 characters");
    const row = this.sql
      .exec<{ id: string; user_id: string }>(
        "SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
        await sha256Hex(token), Date.now(),
      )
      .toArray()[0];
    if (!row) return bad("This reset code is not valid or has expired");
    const salt = randomToken(16);
    const hash = await hashPassword(password, salt);
    const now = Date.now();
    this.sql.exec("UPDATE password_resets SET used_at = ? WHERE id = ?", now, row.id);
    this.sql.exec("UPDATE users SET password_hash = ?, salt = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?", hash, salt, row.user_id);
    // A successful reset invalidates every existing session for the account.
    this.sql.exec("DELETE FROM sessions WHERE user_id = ?", row.user_id);
    this.audit(null, "Password reset completed (all sessions invalidated)", row.user_id, ip);
    return Response.json({ ok: true });
  }

  /* --------------------- Sprint 4: legal / consent --------------------------- */

  private publicLegal(): Response {
    const rows = this.sql
      .exec("SELECT doc_key, version, title, body, effective_at FROM legal_docs WHERE active = 1 ORDER BY doc_key")
      .toArray();
    return Response.json({ ok: true, documents: rows });
  }

  private myLegal(user: UserRow): Response {
    const docs = this.sql
      .exec("SELECT doc_key, version, title, body, effective_at FROM legal_docs WHERE active = 1 ORDER BY doc_key")
      .toArray();
    const accepted = this.sql
      .exec("SELECT doc_key, version, accepted_at FROM legal_acceptances WHERE user_id = ? ORDER BY accepted_at DESC", user.id)
      .toArray();
    return Response.json({ ok: true, documents: docs, acceptances: accepted });
  }

  private async acceptLegal(request: Request, user: UserRow): Promise<Response> {
    const body = (await request.json()) as Body;
    const docKey = str(body, "docKey");
    const version = Number(body.version ?? 0);
    if (!(LEGAL_DOC_KEYS as readonly string[]).includes(docKey)) return bad("Unknown document");
    const doc = this.sql
      .exec<{ version: number }>("SELECT version FROM legal_docs WHERE doc_key = ? AND active = 1", docKey)
      .toArray()[0];
    if (!doc || doc.version !== version) return bad("That version is not the active document");
    const existing = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM legal_acceptances WHERE user_id = ? AND doc_key = ? AND version = ?", user.id, docKey, version)
      .toArray()[0].n;
    if (existing === 0) {
      this.sql.exec(
        "INSERT INTO legal_acceptances (id, user_id, doc_key, version, accepted_at) VALUES (?, ?, ?, ?, ?)",
        uid("lac_"), user.id, docKey, version, Date.now(),
      );
      this.audit(user, `Legal document accepted: ${docKey} v${version}`, user.id);
    }
    return Response.json({ ok: true });
  }

  private async upsertLegal(request: Request, user: UserRow): Promise<Response> {
    if (user.role !== "super_admin" && user.role !== "compliance") return bad("Compliance access required", 403);
    const body = (await request.json()) as Body;
    const docKey = str(body, "docKey");
    const title = str(body, "title");
    const text = str(body, "body");
    if (!(LEGAL_DOC_KEYS as readonly string[]).includes(docKey)) return bad("Unknown document key");
    if (title.length < 3 || text.length < 20) return bad("Title and body text are required");
    const activate = bool(body, "activate");
    if (activate && text.trimStart().startsWith("[PLACEHOLDER")) return bad("Placeholder legal text cannot be activated — load approved text first");
    const statusInput = typeof body.status === "string" && (LEGAL_DOC_STATUSES as readonly string[]).includes(body.status) ? body.status : "draft";
    if (activate) return bad("Use the document action workflow (review → approve → activate) to publish legal text");
    const latest = this.sql
      .exec<{ version: number }>("SELECT version FROM legal_docs WHERE doc_key = ? ORDER BY version DESC LIMIT 1", docKey)
      .toArray()[0];
    const version = (latest?.version ?? 0) + 1;
    const id = uid("lgl_");
    if (activate) this.sql.exec("UPDATE legal_docs SET active = 0 WHERE doc_key = ?", docKey);
    this.sql.exec(
      "INSERT INTO legal_docs (id, doc_key, version, title, body, effective_at, active, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
      id, docKey, version, title, text, Date.now(), statusInput, user.id, Date.now(),
    );
    this.audit(user, `Legal document ${docKey} v${version} created (${statusInput})`, id, title);
    return Response.json({ ok: true, version, status: statusInput, next: "submit_review → approve → activate" });
  }

  /** Legal document workflow: draft → review → approved → active → archived.
   *  Placeholder text can never be approved or activated. */
  private async legalDocAction(request: Request, user: UserRow, docId: string): Promise<Response> {
    if (user.role !== "super_admin" && user.role !== "compliance") return bad("Compliance access required", 403);
    const doc = this.sql
      .exec<{ id: string; doc_key: string; version: number; body: string; active: number; status: string }>(
        "SELECT id, doc_key, version, body, active, status FROM legal_docs WHERE id = ?", docId,
      )
      .toArray()[0];
    if (!doc) return bad("Legal document not found", 404);
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const isPlaceholder = doc.body.trimStart().startsWith("[PLACEHOLDER");
    if (action === "submit_review") {
      if (doc.status !== "draft") return bad("Only draft documents can move to review");
      if (isPlaceholder) return bad("Replace the placeholder text with real draft language before submitting for review");
      this.sql.exec("UPDATE legal_docs SET status = 'review' WHERE id = ?", docId);
    } else if (action === "approve") {
      if (doc.status !== "review") return bad("Only documents in review can be approved");
      if (isPlaceholder) return bad("Placeholder legal text cannot be approved");
      this.sql.exec("UPDATE legal_docs SET status = 'approved' WHERE id = ?", docId);
    } else if (action === "activate") {
      if (doc.status !== "approved") return bad("Only approved documents can be activated");
      if (isPlaceholder) return bad("Placeholder legal text cannot be activated");
      this.sql.exec("UPDATE legal_docs SET active = 0 WHERE doc_key = ? AND id != ?", doc.doc_key, docId);
      this.sql.exec("UPDATE legal_docs SET active = 1, status = 'active', effective_at = ? WHERE id = ?", Date.now(), docId);
    } else if (action === "archive") {
      this.sql.exec("UPDATE legal_docs SET active = 0, status = 'archived' WHERE id = ?", docId);
    } else {
      return bad("Unknown legal document action");
    }
    this.audit(user, `Legal document ${doc.doc_key} v${doc.version}: ${action}`, docId, doc.doc_key);
    return Response.json({ ok: true, action, status: action === "activate" ? "active" : action === "archive" ? "archived" : action === "approve" ? "approved" : "review" });
  }

  /* ------------------ Sprint 4: management analytics ------------------------- */

  private analytics(url: URL, user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const includeTests = url.searchParams.get("includeTests") === "1" && user.role === "super_admin";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const agentFilter = url.searchParams.get("agentId");
    const sourceFilter = url.searchParams.get("source");
    const productFilter = url.searchParams.get("product");
    const fromDate = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toDate = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const notTest = "COALESCE(p.is_test, 0) = 0";
    const count = (sql: string, ...p: (string | number)[]): number => this.sql.exec<{ n: number }>(sql, ...p).toArray()[0].n;

    // Pipeline: leads grouped by stage. Test records are excluded by default.
    const leadWhere: string[] = [];
    const leadParams: (string | number)[] = [];
    if (!includeTests) leadWhere.push("COALESCE(l.is_test, 0) = 0");
    if (fromDate) { leadWhere.push("l.created_at >= ?"); leadParams.push(fromDate); }
    if (toDate) { leadWhere.push("l.created_at <= ?"); leadParams.push(toDate); }
    if (sourceFilter) { leadWhere.push("l.source = ?"); leadParams.push(sourceFilter); }
    const leadWhereSql = leadWhere.length > 0 ? `WHERE ${leadWhere.join(" AND ")}` : "";
    const pipeline: Record<string, number> = {};
    for (const s of LEAD_STAGES) {
      pipeline[s] = count(`SELECT COUNT(*) AS n FROM leads l ${leadWhereSql}${leadWhereSql ? " AND" : " WHERE"} l.stage = '${s}'`, ...leadParams);
    }

    // Conversion — every denominator is explicit (see `definitions`).
    const clientFilter = includeTests ? "" : ` WHERE ${notTest}`;
    const clientJoin = includeTests ? "" : ` AND ${notTest}`;
    const qualifiedLeads = count(`SELECT COUNT(*) AS n FROM client_profiles p${clientFilter}`);
    const withAppointment = count(`SELECT COUNT(DISTINCT a.client_id) AS n FROM appointments a JOIN client_profiles p ON p.id = a.client_id WHERE a.client_id IS NOT NULL${clientJoin}`);
    const withQuote = count(`SELECT COUNT(DISTINCT q.client_id) AS n FROM quote_presentations q JOIN client_profiles p ON p.id = q.client_id WHERE 1 = 1${clientJoin}`);
    const withInterest = count(`SELECT COUNT(DISTINCT q.client_id) AS n FROM quote_presentations q JOIN client_profiles p ON p.id = q.client_id WHERE q.status = 'client_interested'${clientJoin}`);
    const quotesSent = count(`SELECT COUNT(*) AS n FROM quote_presentations q JOIN client_profiles p ON p.id = q.client_id WHERE q.sent_at IS NOT NULL${clientJoin}`);
    const policyConds: string[] = ["pol.status = 'active'"];
    const policyParams: (string | number)[] = [];
    if (agentFilter) { policyConds.push("pol.agent_id = ?"); policyParams.push(agentFilter); }
    if (productFilter) { policyConds.push("pol.product_type = ?"); policyParams.push(productFilter); }
    const policyJoin = includeTests ? "" : ` AND ${notTest}`;
    const withActivePolicy = count(
      `SELECT COUNT(DISTINCT pol.client_id) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id WHERE ${policyConds.join(" AND ")}${policyJoin}`,
      ...policyParams,
    );
    const ratio = (num: number, den: number): number | null => (den === 0 ? null : Math.round((num / den) * 1000) / 10);
    const conversion = {
      leadToAppointment: { numerator: withAppointment, denominator: qualifiedLeads, percent: ratio(withAppointment, qualifiedLeads) },
      leadToQuote: { numerator: withQuote, denominator: qualifiedLeads, percent: ratio(withQuote, qualifiedLeads) },
      quoteToInterest: { numerator: withInterest, denominator: quotesSent, percent: ratio(withInterest, quotesSent) },
      quoteToActiveClient: { numerator: withActivePolicy, denominator: withQuote, percent: ratio(withActivePolicy, withQuote) },
    };

    // Production
    const activePolicies = count(
      `SELECT COUNT(*) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id WHERE ${policyConds.join(" AND ")}${policyJoin}`,
      ...policyParams,
    );
    const byProduct: Record<string, number> = {};
    for (const t of POLICY_PRODUCT_TYPES) {
      byProduct[t] = count(
        `SELECT COUNT(*) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id WHERE pol.status = 'active' AND pol.product_type = ?${agentFilter ? " AND pol.agent_id = ?" : ""}${policyJoin}`,
        t, ...(agentFilter ? [agentFilter] : []),
      );
    }
    const byCarrier = this.sql
      .exec(
        `SELECT pol.carrier, COUNT(*) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id WHERE pol.status = 'active'${agentFilter ? " AND pol.agent_id = ?" : ""}${policyJoin} GROUP BY pol.carrier ORDER BY n DESC`,
        ...(agentFilter ? [agentFilter] : []),
      )
      .toArray();
    const byAgent = this.sql
      .exec(
        `SELECT COALESCE(u.name, 'Unassigned') AS name, COUNT(*) AS n FROM policies pol JOIN client_profiles p ON p.id = pol.client_id LEFT JOIN users u ON u.id = pol.agent_id WHERE pol.status = 'active'${policyJoin} GROUP BY pol.agent_id ORDER BY n DESC`,
      )
      .toArray();

    // Service
    const openAge = this.sql
      .exec<{ v: number | null }>(
        `SELECT AVG((? - t.created_at) / 3600000.0) AS v FROM service_tickets t JOIN client_profiles p ON p.id = t.client_id WHERE t.status NOT IN ('resolved','closed')${clientJoin}`,
        Date.now(),
      )
      .toArray()[0].v;
    const resolution = this.sql
      .exec<{ v: number | null }>(
        `SELECT AVG((t.updated_at - t.created_at) / 3600000.0) AS v FROM service_tickets t JOIN client_profiles p ON p.id = t.client_id WHERE t.status IN ('resolved','closed')${clientJoin}`,
      )
      .toArray()[0].v;
    const service = {
      openTickets: count(`SELECT COUNT(*) AS n FROM service_tickets t JOIN client_profiles p ON p.id = t.client_id WHERE t.status NOT IN ('resolved','closed')${clientJoin}`),
      avgOpenAgeHours: Math.round((openAge ?? 0) * 10) / 10,
      avgResolutionHours: Math.round((resolution ?? 0) * 10) / 10,
      unreadMessages: count(`SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN client_profiles p ON p.id = c.client_id WHERE m.sender_role = 'client' AND m.read_at IS NULL${clientJoin}`),
      outstandingDocumentRequests: count(`SELECT COUNT(*) AS n FROM document_requests dr JOIN client_profiles p ON p.id = dr.client_id WHERE dr.status = 'open'${clientJoin}`),
    };

    // Renewals
    const renewalsByStatus: Record<string, number> = {};
    for (const s of RENEWAL_STATUSES) renewalsByStatus[s] = count(`SELECT COUNT(*) AS n FROM renewals r JOIN client_profiles p ON p.id = r.client_id WHERE r.status = ?${clientJoin}`, s);

    // Marketing
    const bySource = this.sql.exec(`SELECT l.source, COUNT(*) AS n FROM leads l ${leadWhereSql} GROUP BY l.source ORDER BY n DESC`, ...leadParams).toArray();
    const byCampaign = this.sql
      .exec(`SELECT COALESCE(NULLIF(l.campaign, ''), '(none)') AS campaign, COUNT(*) AS n FROM leads l ${leadWhereSql} GROUP BY l.campaign ORDER BY n DESC LIMIT 10`, ...leadParams)
      .toArray();
    const referralsByStatus: Record<string, number> = {};
    for (const s of REFERRAL_STATUSES) referralsByStatus[s] = count("SELECT COUNT(*) AS n FROM referrals WHERE status = ?", s);

    // Team
    const teamTest = includeTests ? "" : " AND COALESCE(p.is_test, 0) = 0";
    const team = this.sql
      .exec(
        `SELECT u.id, u.name, u.role,
          (SELECT COUNT(*) FROM client_profiles p WHERE p.agent_id = u.id${teamTest}) AS assignedClients,
          (SELECT COUNT(*) FROM policies pol JOIN client_profiles p ON p.id = pol.client_id WHERE pol.agent_id = u.id AND pol.status = 'active'${teamTest}) AS activeClients,
          (SELECT COUNT(*) FROM appointments a WHERE a.assigned_agent = u.id) AS appointments,
          (SELECT COUNT(*) FROM quote_presentations q WHERE q.agent_id = u.id) AS quotes,
          (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND t.done = 0) AS openFollowUps,
          (SELECT COUNT(*) FROM renewals r WHERE r.assigned_agent = u.id AND r.status NOT IN ('completed','not_renewed','lost')) AS openRenewals
         FROM users u WHERE u.role != 'client' AND (u.active IS NULL OR u.active = 1)${includeTests ? "" : " AND COALESCE(u.is_test, 0) = 0"} ORDER BY u.name`,
      )
      .toArray();

    const definitions: Record<string, string> = {
      qualifiedLeads: "Client records created through lead capture or registration. Test records excluded by default.",
      leadToAppointment: "Lead → appointment = client records with ≥1 appointment ÷ qualified leads.",
      leadToQuote: "Lead → quote = client records with ≥1 quote presentation ÷ qualified leads.",
      quoteToInterest: "Quote → interest = quote presentations with client_interested status ÷ quote presentations sent.",
      quoteToActiveClient: "Quote → active client = client records with ≥1 ACTIVE policy ÷ client records with a quote presentation.",
      avgOpenAgeHours: "Average hours since creation for tickets currently open.",
      avgResolutionHours: "Average hours from ticket creation to last update, for tickets resolved/closed.",
      testExclusion: "Records flagged is_test are excluded from every metric unless a super admin explicitly includes them.",
    };
    return Response.json({
      ok: true,
      filters: { from, to, agentId: agentFilter, product: productFilter, source: sourceFilter, includeTests },
      generatedAt: Date.now(),
      pipeline,
      conversion,
      production: { activePolicies, byProduct, byCarrier, byAgent },
      service,
      renewalsByStatus,
      marketing: { bySource, byCampaign, referralsByStatus },
      team,
      definitions,
    });
  }

  /* -------------------- Sprint 4: commission ledger -------------------------- */

  private listCommissions(url: URL, user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const where: string[] = [];
    const params: (string | number)[] = [];
    const carrier = url.searchParams.get("carrier");
    const status = url.searchParams.get("status");
    const agentId = url.searchParams.get("agentId");
    if (carrier) { where.push("c.carrier = ?"); params.push(carrier); }
    if (status && (COMMISSION_STATUSES as readonly string[]).includes(status)) { where.push("c.status = ?"); params.push(status); }
    if (agentId) { where.push("c.agent_id = ?"); params.push(agentId); }
    const rows = this.sql
      .exec(
        `SELECT c.*, u.name AS agent_name, p.first_name, p.last_name
         FROM commission_records c
         LEFT JOIN users u ON u.id = c.agent_id
         LEFT JOIN client_profiles p ON p.id = c.client_id
         ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY c.created_at DESC LIMIT 500`,
        ...params,
      )
      .toArray();
    const sum = (sql: string, ...p: (string | number)[]): number => this.sql.exec<{ v: number | null }>(sql, ...p).toArray()[0].v ?? 0;
    const summary = {
      expectedTotal: sum("SELECT COALESCE(SUM(expected_amount), 0) AS v FROM commission_records WHERE status IN ('expected','partial','disputed')"),
      receivedTotal: sum("SELECT COALESCE(SUM(received_amount), 0) AS v FROM commission_records"),
      outstanding: sum("SELECT COALESCE(SUM(expected_amount - received_amount), 0) AS v FROM commission_records WHERE status IN ('expected','partial','disputed')"),
      chargebacks: this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM commission_records WHERE commission_type = 'chargeback' OR status = 'reversed'").toArray()[0].n,
      byCarrier: this.sql.exec("SELECT carrier, COALESCE(SUM(expected_amount),0) AS expected, COALESCE(SUM(received_amount),0) AS received, COUNT(*) AS n FROM commission_records GROUP BY carrier ORDER BY n DESC").toArray(),
      byProduct: this.sql.exec("SELECT product, COALESCE(SUM(expected_amount),0) AS expected, COALESCE(SUM(received_amount),0) AS received, COUNT(*) AS n FROM commission_records GROUP BY product ORDER BY n DESC").toArray(),
      byAgent: this.sql.exec("SELECT COALESCE(u.name, 'Unassigned') AS name, COALESCE(SUM(c.expected_amount),0) AS expected, COALESCE(SUM(c.received_amount),0) AS received, COUNT(*) AS n FROM commission_records c LEFT JOIN users u ON u.id = c.agent_id GROUP BY c.agent_id ORDER BY n DESC").toArray(),
    };
    return Response.json({ ok: true, commissions: rows, summary });
  }

  private async createCommission(request: Request, user: UserRow): Promise<Response> {
    if (!["manager", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const body = (await request.json()) as Body;
    const carrier = str(body, "carrier");
    if (carrier.length < 2) return bad("Carrier is required");
    const commissionType = str(body, "commissionType") || "first_year";
    if (!(COMMISSION_TYPES as readonly string[]).includes(commissionType)) return bad("Invalid commission type");
    const policyId = str(body, "policyId");
    if (policyId.length > 0) {
      const pol = this.sql.exec<{ id: string }>("SELECT id FROM policies WHERE id = ?", policyId).toArray()[0];
      if (!pol) return bad("Policy record not found", 404);
    }
    const expected = Number(body.expectedAmount ?? 0);
    const received = Number(body.receivedAmount ?? 0);
    if (!Number.isFinite(expected) || !Number.isFinite(received) || expected < 0 || received < 0) {
      return bad("Amounts must be non-negative numbers");
    }
    const status = str(body, "status") || (received > 0 ? "partial" : "expected");
    if (!(COMMISSION_STATUSES as readonly string[]).includes(status)) return bad("Invalid commission status");
    const id = uid("cmr_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO commission_records (id, policy_id, client_id, carrier, product, agent_id, statement_period, commission_type, expected_amount, received_amount, status, carrier_reference, paid_date, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, policyId || null, str(body, "clientId") || null, carrier, str(body, "product"), str(body, "agentId") || null,
      str(body, "statementPeriod"), commissionType, expected, received, status, str(body, "carrierReference"), str(body, "paidDate"), str(body, "notes"), user.id, now, now,
    );
    this.audit(user, "Commission record created (manual entry)", id, `${carrier} · ${commissionType} · expected ${expected}`);
    return Response.json({ ok: true, commissionId: id });
  }

  private async commissionAction(request: Request, user: UserRow, recordId: string): Promise<Response> {
    if (!["manager", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const record = this.sql
      .exec<{ id: string; expected_amount: number; received_amount: number; carrier: string }>(
        "SELECT id, expected_amount, received_amount, carrier FROM commission_records WHERE id = ?",
        recordId,
      )
      .toArray()[0];
    if (!record) return bad("Commission record not found", 404);
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();
    if (action === "status") {
      const status = str(body, "status");
      if (!(COMMISSION_STATUSES as readonly string[]).includes(status)) return bad("Invalid commission status");
      const received = typeof body.receivedAmount === "number" && body.receivedAmount >= 0 ? Number(body.receivedAmount) : record.received_amount;
      this.sql.exec(
        "UPDATE commission_records SET status = ?, received_amount = ?, paid_date = COALESCE(NULLIF(?, ''), paid_date), carrier_reference = COALESCE(NULLIF(?, ''), carrier_reference), updated_at = ? WHERE id = ?",
        status, received, str(body, "paidDate"), str(body, "carrierReference"), now, recordId,
      );
      this.audit(user, `Commission → ${status}`, recordId, record.carrier);
      return Response.json({ ok: true });
    }
    if (action === "adjustment") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount === 0) return bad("Enter a non-zero adjustment amount");
      if (str(body, "reason").length < 3) return bad("An adjustment reason is required");
      this.sql.exec(
        "INSERT INTO commission_adjustments (id, record_id, kind, amount, reason, created_by, created_at) VALUES (?, ?, 'adjustment', ?, ?, ?, ?)",
        uid("cma_"), recordId, amount, str(body, "reason"), user.id, now,
      );
      this.sql.exec("UPDATE commission_records SET expected_amount = expected_amount + ?, updated_at = ? WHERE id = ?", amount, now, recordId);
      this.audit(user, `Commission adjusted by ${amount}`, recordId, str(body, "reason"));
      return Response.json({ ok: true });
    }
    if (action === "chargeback") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return bad("Enter the chargeback amount");
      if (str(body, "reason").length < 3) return bad("A chargeback reason is required");
      this.sql.exec(
        "INSERT INTO commission_adjustments (id, record_id, kind, amount, reason, created_by, created_at) VALUES (?, ?, 'chargeback', ?, ?, ?, ?)",
        uid("cma_"), recordId, amount, str(body, "reason"), user.id, now,
      );
      this.sql.exec(
        "UPDATE commission_records SET received_amount = MAX(0, received_amount - ?), commission_type = 'chargeback', updated_at = ? WHERE id = ?",
        amount, now, recordId,
      );
      this.audit(user, `Commission chargeback of ${amount}`, recordId, str(body, "reason"));
      return Response.json({ ok: true });
    }
    if (action === "note") {
      this.sql.exec("UPDATE commission_records SET notes = ?, updated_at = ? WHERE id = ?", str(body, "notes"), now, recordId);
      this.audit(user, "Commission note updated", recordId);
      return Response.json({ ok: true });
    }
    return bad("Unknown commission action");
  }

  /* --------------------- Sprint 4: compliance center ------------------------- */

  private requireComplianceAccess(user: UserRow): Response | null {
    return ["manager", "compliance", "super_admin"].includes(user.role) ? null : bad("Manager access required", 403);
  }

  private listLicenses(user: UserRow): Response {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const rows = this.sql
      .exec("SELECT l.*, u.name AS agent_name FROM agent_licenses l JOIN users u ON u.id = l.agent_id ORDER BY l.expiration")
      .toArray();
    const now = Date.now();
    const licenses = rows.map((r) => {
      const exp = (r as { expiration?: string }).expiration ?? "";
      const t = exp ? new Date(`${exp}T23:59:59`).getTime() : NaN;
      const days = Number.isNaN(t) ? null : Math.ceil((t - now) / 86_400_000);
      return { ...(r as Record<string, unknown>), daysToExpiration: days, expired: days !== null && days < 0 };
    });
    return Response.json({ ok: true, licenses });
  }

  private async createLicense(request: Request, user: UserRow): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const body = (await request.json()) as Body;
    const agentId = str(body, "agentId");
    const state = str(body, "state");
    const licenseNumber = str(body, "licenseNumber");
    if (agentId.length === 0 || state.length < 2 || licenseNumber.length < 2) return bad("Agent, state, and license number are required");
    const agent = this.mustUser(agentId);
    const id = uid("lic_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO agent_licenses (id, agent_id, state, license_number, line_of_authority, issue_date, expiration, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, agentId, state, licenseNumber, str(body, "lineOfAuthority"), str(body, "issueDate"), str(body, "expiration"), str(body, "status") || "active", str(body, "notes"), now, now,
    );
    this.audit(user, `Agent license added: ${agent.name} (${state})`, id, licenseNumber);
    return Response.json({ ok: true, licenseId: id });
  }

  private listCarrierAppointments(user: UserRow): Response {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const rows = this.sql
      .exec("SELECT ca.*, u.name AS agent_name FROM carrier_appointments ca JOIN users u ON u.id = ca.agent_id ORDER BY ca.carrier, ca.state")
      .toArray();
    return Response.json({ ok: true, appointments: rows });
  }

  private async createCarrierAppointment(request: Request, user: UserRow): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const body = (await request.json()) as Body;
    const agentId = str(body, "agentId");
    const carrier = str(body, "carrier");
    const state = str(body, "state");
    if (agentId.length === 0 || carrier.length < 2 || state.length < 2) return bad("Agent, carrier, and state are required");
    const agent = this.mustUser(agentId);
    const id = uid("cap_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO carrier_appointments (id, agent_id, carrier, state, product, effective_date, termination_date, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, agentId, carrier, state, str(body, "product"), str(body, "effectiveDate"), str(body, "terminationDate"), str(body, "status") || "active", str(body, "notes"), now, now,
    );
    this.audit(user, `Carrier appointment added: ${agent.name} — ${carrier} (${state})`, id);
    return Response.json({ ok: true, appointmentId: id });
  }

  private listCertifications(user: UserRow): Response {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const rows = this.sql
      .exec("SELECT c.*, u.name AS agent_name FROM certifications c JOIN users u ON u.id = c.agent_id ORDER BY c.expiration")
      .toArray();
    const now = Date.now();
    const certifications = rows.map((r) => {
      const exp = (r as { expiration?: string }).expiration ?? "";
      const t = exp ? new Date(`${exp}T23:59:59`).getTime() : NaN;
      const days = Number.isNaN(t) ? null : Math.ceil((t - now) / 86_400_000);
      return { ...(r as Record<string, unknown>), daysToExpiration: days, expired: days !== null && days < 0 };
    });
    return Response.json({ ok: true, certifications });
  }

  private async createCertification(request: Request, user: UserRow): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const body = (await request.json()) as Body;
    const agentId = str(body, "agentId");
    const certification = str(body, "certification");
    if (agentId.length === 0 || certification.length < 2) return bad("Agent and certification name are required");
    const agent = this.mustUser(agentId);
    const id = uid("crt_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO certifications (id, agent_id, certification, completed_date, expiration, documentation, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, agentId, certification, str(body, "completedDate"), str(body, "expiration"), str(body, "documentation"), str(body, "status") || "active", str(body, "notes"), now, now,
    );
    this.audit(user, `Certification added: ${agent.name} — ${certification}`, id);
    return Response.json({ ok: true, certificationId: id });
  }

  private listMarketingReviews(user: UserRow): Response {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const rows = this.sql
      .exec("SELECT * FROM marketing_reviews ORDER BY created_at DESC LIMIT 200")
      .toArray();
    return Response.json({ ok: true, reviews: rows });
  }

  private async createMarketingReview(request: Request, user: UserRow): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const body = (await request.json()) as Body;
    const title = str(body, "title");
    const content = str(body, "content");
    if (title.length < 3 || content.length < 10) return bad("Title and content are required");
    const id = uid("mkt_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO marketing_reviews (id, title, campaign, content, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)",
      id, title, str(body, "campaign"), content, user.id, now, now,
    );
    this.audit(user, `Marketing content created for review: ${title}`, id);
    return Response.json({ ok: true, reviewId: id });
  }

  private async marketingAction(request: Request, user: UserRow, reviewId: string): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const review = this.sql.exec<{ id: string; title: string; status: string }>("SELECT id, title, status FROM marketing_reviews WHERE id = ?", reviewId).toArray()[0];
    if (!review) return bad("Marketing review not found", 404);
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();
    if (action === "submit") {
      if (review.status !== "draft" && review.status !== "rejected") return bad("Only draft or rejected content can be submitted for review");
      this.sql.exec("UPDATE marketing_reviews SET status = 'review', updated_at = ? WHERE id = ?", now, reviewId);
    } else if (action === "approve" || action === "reject") {
      // Approve/reject decisions belong to compliance or a super admin.
      if (user.role !== "compliance" && user.role !== "super_admin") return bad("Compliance access required", 403);
      if (review.status !== "review") return bad("Content must be submitted for review first");
      const notes = str(body, "notes");
      if (action === "reject" && notes.length < 3) return bad("Include a rejection reason");
      this.sql.exec(
        "UPDATE marketing_reviews SET status = ?, reviewer = ?, decision_notes = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        action === "approve" ? "approved" : "rejected", user.name, notes, now, now, reviewId,
      );
    } else if (action === "archive") {
      this.sql.exec("UPDATE marketing_reviews SET status = 'archived', updated_at = ? WHERE id = ?", now, reviewId);
    } else {
      return bad("Unknown marketing action");
    }
    this.audit(user, `Marketing content → ${action}`, reviewId, review.title);
    return Response.json({ ok: true });
  }

  private listComplaints(user: UserRow): Response {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const rows = this.sql
      .exec(
        "SELECT c.*, u.name AS owner_name, p.first_name, p.last_name FROM complaints c LEFT JOIN users u ON u.id = c.owner_id LEFT JOIN client_profiles p ON p.id = c.client_id ORDER BY c.created_at DESC LIMIT 200",
      )
      .toArray();
    // Complaint details and notes are staff-only (this endpoint is gated) and
    // never surface anywhere in My Victora.
    const complaints = rows.map((r) => {
      const id = (r as { id: string }).id;
      const notes = this.sql.exec("SELECT id, author_role, body, created_at FROM complaint_notes WHERE complaint_id = ? ORDER BY created_at", id).toArray();
      return { ...(r as Record<string, unknown>), notes };
    });
    return Response.json({ ok: true, complaints });
  }

  private async createComplaint(request: Request, user: UserRow): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const body = (await request.json()) as Body;
    const complaintType = str(body, "complaintType");
    if (complaintType.length < 3) return bad("Describe the complaint type");
    const clientId = str(body, "clientId");
    if (clientId.length > 0) {
      const p = this.sql.exec<{ id: string }>("SELECT id FROM client_profiles WHERE id = ?", clientId).toArray()[0];
      if (!p) return bad("Client not found", 404);
    }
    const id = uid("cmp_");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO complaints (id, client_id, complaint_type, channel, details, owner_id, status, received_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)",
      id, clientId || null, complaintType, str(body, "channel") || "phone", str(body, "details"), str(body, "ownerId") || null, now, now, now,
    );
    this.audit(user, `Complaint recorded: ${complaintType}`, id, clientId);
    return Response.json({ ok: true, complaintId: id });
  }

  private async complaintAction(request: Request, user: UserRow, complaintId: string): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const complaint = this.sql.exec<{ id: string; complaint_type: string; status: string }>("SELECT id, complaint_type, status FROM complaints WHERE id = ?", complaintId).toArray()[0];
    if (!complaint) return bad("Complaint not found", 404);
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();
    if (action === "assign") {
      const owner = this.mustUser(str(body, "ownerId"));
      this.sql.exec("UPDATE complaints SET owner_id = ?, status = CASE WHEN status = 'received' THEN 'assigned' ELSE status END, updated_at = ? WHERE id = ?", owner.id, now, complaintId);
      this.notify(owner.id, "Complaint assigned to you", `${complaint.complaint_type} — handle in the Compliance Center.`);
    } else if (action === "status") {
      const requested = str(body, "status");
      if (!(COMPLAINT_STATUSES as readonly string[]).includes(requested)) return bad("Invalid complaint status");
      const status = requested === "open" ? "received" : requested;
      const resolution = str(body, "resolution");
      if (status === "resolved" && resolution.length < 3) return bad("Describe the resolution before marking resolved");
      this.sql.exec(
        "UPDATE complaints SET status = ?, resolution = CASE WHEN ? != '' THEN ? ELSE resolution END, closed_at = ?, updated_at = ? WHERE id = ?",
        status, resolution, resolution, status === "closed" ? now : null, now, complaintId,
      );
    } else {
      return bad("Unknown complaint action");
    }
    this.audit(user, `Complaint ${action}`, complaintId, complaint.complaint_type);
    return Response.json({ ok: true });
  }

  private async complaintNote(request: Request, user: UserRow, complaintId: string): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const complaint = this.sql.exec<{ id: string }>("SELECT id FROM complaints WHERE id = ?", complaintId).toArray()[0];
    if (!complaint) return bad("Complaint not found", 404);
    const body = (await request.json()) as Body;
    const text = str(body, "body");
    if (text.length < 2) return bad("Write the investigation note first");
    this.sql.exec(
      "INSERT INTO complaint_notes (id, complaint_id, author_id, author_role, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      uid("cmn_"), complaintId, user.id, user.role, text, Date.now(),
    );
    this.audit(user, "Complaint investigation note added", complaintId);
    return Response.json({ ok: true });
  }

  private listRetention(user: UserRow): Response {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const rows = this.sql.exec("SELECT * FROM retention_policies ORDER BY record_type").toArray();
    return Response.json({
      ok: true,
      policies: rows,
      note: "Retention framework only — no automatic deletion is performed. Deletion rules require explicit approval before any activation.",
    });
  }

  private async saveRetention(request: Request, user: UserRow): Promise<Response> {
    const denied = this.requireComplianceAccess(user);
    if (denied) return denied;
    const body = (await request.json()) as Body;
    const recordType = str(body, "recordType");
    if (recordType.length < 3) return bad("Record type is required");
    const retentionDays = Number(body.retentionDays ?? 0);
    if (!Number.isFinite(retentionDays) || retentionDays < 0) return bad("Retention days must be a non-negative number");
    const hold = bool(body, "hold");
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO retention_policies (id, record_type, retention_days, hold, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(record_type) DO UPDATE SET retention_days = excluded.retention_days, hold = excluded.hold, notes = excluded.notes, updated_at = excluded.updated_at",
      uid("rtp_"), recordType, retentionDays, hold ? 1 : 0, str(body, "notes"), now, now,
    );
    this.audit(user, `Retention policy saved: ${recordType} (hold=${hold ? "yes" : "no"}; no deletion active)`, recordType);
    return Response.json({ ok: true });
  }

  /* ---------------- Sprint 4: communication templates ------------------------ */

  private listCommTemplates(user: UserRow): Response {
    if (!STAFF_ROLES.includes(user.role)) return bad("Staff access required", 403);
    const rows = this.sql
      .exec("SELECT id, template_key, channel, language, subject, body, version, active, created_by, created_at FROM communication_templates ORDER BY template_key, channel, language, version DESC")
      .toArray();
    return Response.json({ ok: true, templates: rows });
  }

  private async createCommTemplate(request: Request, user: UserRow): Promise<Response> {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const body = (await request.json()) as Body;
    const key = str(body, "templateKey");
    const channel = str(body, "channel");
    const language = str(body, "language") || "English";
    const subject = str(body, "subject");
    const text = str(body, "body");
    if (key.length < 2 || text.length < 10) return bad("Template key and body are required");
    if (!["email", "sms", "portal"].includes(channel)) return bad("Channel must be email, sms, or portal");
    if (channel === "email" && subject.length < 3) return bad("Email templates need a subject");
    const activate = bool(body, "activate");
    // Publishing/activation is a compliance-controlled action.
    if (activate && user.role !== "compliance" && user.role !== "super_admin") return bad("Compliance access required to activate templates", 403);
    const latest = this.sql
      .exec<{ version: number }>("SELECT version FROM communication_templates WHERE template_key = ? AND channel = ? AND language = ? ORDER BY version DESC LIMIT 1", key, channel, language)
      .toArray()[0];
    const version = (latest?.version ?? 0) + 1;
    const id = uid("ctm_");
    if (activate) this.sql.exec("UPDATE communication_templates SET active = 0 WHERE template_key = ? AND channel = ? AND language = ?", key, channel, language);
    this.sql.exec(
      "INSERT INTO communication_templates (id, template_key, channel, language, subject, body, version, active, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, key, channel, language, subject, text, version, activate ? 1 : 0, user.id, Date.now(),
    );
    this.audit(user, `Communication template ${key} (${channel}/${language}) v${version} created${activate ? " and activated" : " (draft)"}`, id);
    return Response.json({ ok: true, templateId: id, version });
  }

  private async commTemplateAction(request: Request, user: UserRow, templateId: string): Promise<Response> {
    if (user.role !== "compliance" && user.role !== "super_admin") return bad("Compliance access required", 403);
    const tpl = this.sql
      .exec<{ id: string; template_key: string; channel: string; language: string; active: number }>(
        "SELECT id, template_key, channel, language, active FROM communication_templates WHERE id = ?",
        templateId,
      )
      .toArray()[0];
    if (!tpl) return bad("Template not found", 404);
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    if (action === "activate") {
      this.sql.exec("UPDATE communication_templates SET active = 0 WHERE template_key = ? AND channel = ? AND language = ?", tpl.template_key, tpl.channel, tpl.language);
      this.sql.exec("UPDATE communication_templates SET active = 1 WHERE id = ?", templateId);
    } else if (action === "deactivate") {
      this.sql.exec("UPDATE communication_templates SET active = 0 WHERE id = ?", templateId);
    } else {
      return bad("Unknown template action");
    }
    this.audit(user, `Communication template ${action}: ${tpl.template_key} (${tpl.channel}/${tpl.language})`, templateId);
    return Response.json({ ok: true });
  }

  /* ------------------ Sprint 4: calendar operations -------------------------- */

  private async appointmentAction(request: Request, user: UserRow, apptId: string): Promise<Response> {
    const appt = this.sql
      .exec<{ id: string; client_id: string | null; name: string; date: string; time: string; status: string }>(
        "SELECT id, client_id, name, date, time, status FROM appointments WHERE id = ?",
        apptId,
      )
      .toArray()[0];
    if (!appt) return bad("Appointment not found", 404);
    let clientUser: string | null = null;
    if (appt.client_id) {
      const profile = this.sql.exec<ProfileRow>("SELECT * FROM client_profiles WHERE id = ?", appt.client_id).toArray()[0];
      if (profile) {
        clientUser = profile.user_id;
        if (user.role === "agent" && profile.agent_id !== user.id) return bad("Client not assigned to you", 403);
      }
    }
    const body = (await request.json()) as Body;
    const action = str(body, "action");
    const now = Date.now();
    if (action === "confirm") {
      this.sql.exec("UPDATE appointments SET status = 'confirmed' WHERE id = ?", apptId);
      if (clientUser) this.notify(clientUser, "Appointment confirmed", `Your Victora appointment on ${appt.date} at ${appt.time} is confirmed.`, "appointment_confirmation", "appointment", `${apptId}:confirm`, appt.client_id ?? "");
    } else if (action === "reschedule") {
      const date = str(body, "date");
      const time = str(body, "time");
      if (date.length === 0 || time.length === 0) return bad("Provide the new date and time");
      this.sql.exec("UPDATE appointments SET date = ?, time = ?, status = 'rescheduled' WHERE id = ?", date, time, apptId);
      if (clientUser) this.notify(clientUser, "Appointment rescheduled", `Your Victora appointment moved to ${date} at ${time}.`, "appointment_confirmation", "appointment", `${apptId}:reschedule`, appt.client_id ?? "");
    } else if (action === "cancel") {
      this.sql.exec("UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE id = ?", now, apptId);
      if (clientUser) this.notify(clientUser, "Appointment cancelled", `Your Victora appointment on ${appt.date} was cancelled. Contact us to reschedule.`, "appointment_confirmation", "appointment", `${apptId}:cancel`, appt.client_id ?? "");
    } else if (action === "no_show") {
      this.sql.exec("UPDATE appointments SET status = 'no_show' WHERE id = ?", apptId);
    } else if (action === "complete") {
      this.sql.exec("UPDATE appointments SET status = 'completed', completed_at = ? WHERE id = ?", now, apptId);
    } else if (action === "assign") {
      if (user.role === "agent") return bad("Manager access required to reassign", 403);
      const agent = this.mustUser(str(body, "agentId"));
      this.sql.exec("UPDATE appointments SET assigned_agent = ? WHERE id = ?", agent.id, apptId);
    } else {
      return bad("Unknown appointment action");
    }
    this.audit(user, `Appointment ${action}`, apptId, `${appt.name} · ${appt.date} ${appt.time}`);
    return Response.json({ ok: true });
  }

  private listAvailability(user: UserRow): Response {
    const rows =
      user.role === "agent"
        ? this.sql.exec("SELECT id, weekday, start_time, end_time FROM agent_availability WHERE agent_id = ? ORDER BY weekday", user.id).toArray()
        : this.sql
            .exec("SELECT a.id, a.agent_id, a.weekday, a.start_time, a.end_time, u.name AS agent_name FROM agent_availability a JOIN users u ON u.id = a.agent_id ORDER BY u.name, a.weekday")
            .toArray();
    return Response.json({ ok: true, availability: rows });
  }

  private async saveAvailability(request: Request, user: UserRow): Promise<Response> {
    const body = (await request.json()) as Body;
    const weekday = Number(body.weekday);
    const startTime = str(body, "startTime");
    const endTime = str(body, "endTime");
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return bad("Weekday must be 0–6 (Sunday–Saturday)");
    if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) return bad("Times must be HH:MM");
    let agentId = user.id;
    if (user.role !== "agent") {
      const requested = str(body, "agentId");
      if (requested.length > 0) {
        this.mustUser(requested);
        agentId = requested;
      }
    }
    this.sql.exec("DELETE FROM agent_availability WHERE agent_id = ? AND weekday = ?", agentId, weekday);
    this.sql.exec(
      "INSERT INTO agent_availability (id, agent_id, weekday, start_time, end_time, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      uid("avl_"), agentId, weekday, startTime, endTime, Date.now(),
    );
    this.audit(user, "Agent availability updated", agentId, `weekday ${weekday}: ${startTime}–${endTime}`);
    return Response.json({ ok: true });
  }

  private calendarStatus(user: UserRow): Response {
    if (!STAFF_ROLES.includes(user.role)) return bad("Staff access required", 403);
    return Response.json({
      ok: true,
      provider: "none",
      externalSync: "not_configured",
      authoritative: "victora_internal",
      note: "Google/Outlook calendar adapters are architecturally reserved but no calendar provider is connected. Victora's internal calendar remains the source of truth; synchronization is never simulated.",
    });
  }

  /* ----------------------- Sprint 4: security center ------------------------- */

  private securityEvents(url: URL, user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);
    // Security-relevant audit actions only. No credentials or token values are
    // ever stored in audit rows.
    const events = this.sql
      .exec(
        `SELECT id, at, actor_id, actor_role, action, target, detail FROM audit_logs
         WHERE action LIKE 'Failed sign-in%' OR action LIKE 'Sign-in%' OR action LIKE 'Account locked%'
            OR action LIKE 'Password reset%' OR action LIKE 'Admin-assisted password reset%'
            OR action LIKE 'User deactivated%' OR action LIKE 'User reactivated%' OR action LIKE 'Sessions revoked%'
            OR action LIKE 'Role set%' OR action LIKE 'Document file accessed%' OR action LIKE 'Data export%'
            OR action LIKE 'Purge test data%'
         ORDER BY at DESC LIMIT ${limit}`,
      )
      .toArray();
    const activeSessions = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?", Date.now()).toArray()[0].n;
    return Response.json({ ok: true, events, activeSessions });
  }

  private async revokeSessions(request: Request, user: UserRow): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    const body = (await request.json()) as Body;
    const targetId = str(body, "userId");
    const target = this.mustUser(targetId);
    const n = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", targetId).toArray()[0].n;
    this.sql.exec("DELETE FROM sessions WHERE user_id = ?", targetId);
    this.audit(user, `Sessions revoked (${n})`, targetId, target.email);
    return Response.json({ ok: true, revoked: n });
  }

  private async setUserActive(request: Request, user: UserRow, targetId: string, active: number): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    if (targetId === user.id) return bad("You cannot deactivate your own account");
    const body = (await request.json()) as Body;
    if (active === 0 && str(body, "confirm").length < 3) return bad("Type CONFIRM to deactivate this account");
    const target = this.mustUser(targetId);
    this.sql.exec("UPDATE users SET active = ? WHERE id = ?", active, targetId);
    // Deactivation takes effect immediately: every session dies now.
    if (active === 0) this.sql.exec("DELETE FROM sessions WHERE user_id = ?", targetId);
    this.audit(user, active === 0 ? "User deactivated (sessions revoked)" : "User reactivated", targetId, target.email);
    return Response.json({ ok: true });
  }

  private async adminResetPassword(user: UserRow, targetId: string): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    const target = this.mustUser(targetId);
    const temp = `Vic-${randomToken(4)}`;
    const salt = randomToken(16);
    this.sql.exec(
      "UPDATE users SET password_hash = ?, salt = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?",
      await hashPassword(temp, salt), salt, target.id,
    );
    this.sql.exec("DELETE FROM sessions WHERE user_id = ?", target.id);
    this.audit(user, "Admin-assisted password reset (sessions invalidated)", target.id, target.email);
    // Shown once to the admin, never stored in plaintext.
    return Response.json({ ok: true, temporaryPassword: temp });
  }

  /* ------------------------ Sprint 4: data exports --------------------------- */

  private exportData(url: URL, user: UserRow, dataset: string): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    if (dataset === "commissions" && !["manager", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const format = url.searchParams.get("format") === "json" ? "json" : "csv";
    const notTest = "COALESCE(p.is_test, 0) = 0";
    let rows: Record<string, unknown>[] = [];
    if (dataset === "clients") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.journey_stage, p.relationship_status, p.source, p.campaign, p.preferred_language, u.name AS agent_name, p.created_at
           FROM client_profiles p LEFT JOIN users u ON u.id = p.agent_id WHERE ${notTest} ORDER BY p.created_at DESC`,
        )
        .toArray();
    } else if (dataset === "leads") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT l.id, l.name, l.email, l.phone, l.source, l.campaign, l.coverage_type, l.stage, u.name AS assigned_agent, l.created_at
           FROM leads l LEFT JOIN users u ON u.id = l.assigned_agent WHERE COALESCE(l.is_test, 0) = 0 ORDER BY l.created_at DESC`,
        )
        .toArray();
    } else if (dataset === "policies") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT pol.id, p.first_name, p.last_name, pol.product_type, pol.carrier, pol.plan_name, pol.policy_identifier, pol.effective_date, pol.status, pol.monthly_premium, u.name AS agent_name, pol.created_at
           FROM policies pol JOIN client_profiles p ON p.id = pol.client_id LEFT JOIN users u ON u.id = pol.agent_id WHERE ${notTest} ORDER BY pol.created_at DESC`,
        )
        .toArray();
    } else if (dataset === "commissions") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT c.id, c.carrier, c.product, c.statement_period, c.commission_type, c.expected_amount, c.received_amount, c.status, c.carrier_reference, c.paid_date, u.name AS agent_name, c.created_at
           FROM commission_records c LEFT JOIN users u ON u.id = c.agent_id ORDER BY c.created_at DESC`,
        )
        .toArray();
    } else if (dataset === "renewals") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT r.id, p.first_name, p.last_name, pol.product_type, pol.carrier, r.renewal_period, r.renewal_date, r.status, r.outcome, r.created_at
           FROM renewals r JOIN client_profiles p ON p.id = r.client_id JOIN policies pol ON pol.id = r.policy_id WHERE ${notTest} ORDER BY r.renewal_date`,
        )
        .toArray();
    } else if (dataset === "referrals") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT r.id, p.first_name, p.last_name, r.referred_name, r.status, r.source, r.campaign, r.created_at
           FROM referrals r JOIN client_profiles p ON p.id = r.referring_client_id WHERE ${notTest} ORDER BY r.created_at DESC`,
        )
        .toArray();
    } else if (dataset === "tickets") {
      rows = this.sql
        .exec<Record<string, unknown>>(
          `SELECT t.id, t.ticket_number, p.first_name, p.last_name, t.category, t.status, t.priority, u.name AS assigned_agent, t.created_at, t.updated_at
           FROM service_tickets t JOIN client_profiles p ON p.id = t.client_id LEFT JOIN users u ON u.id = t.assigned_to WHERE ${notTest} ORDER BY t.created_at DESC`,
        )
        .toArray();
    } else if (dataset === "compliance") {
      const licenses = this.sql
        .exec<Record<string, unknown>>("SELECT 'license' AS record_type, u.name AS agent, l.state, l.license_number, l.line_of_authority, l.issue_date, l.expiration, l.status FROM agent_licenses l JOIN users u ON u.id = l.agent_id")
        .toArray();
      const carrier = this.sql
        .exec<Record<string, unknown>>("SELECT 'carrier_appointment' AS record_type, u.name AS agent, ca.carrier, ca.state, ca.product, ca.effective_date, ca.termination_date, ca.status FROM carrier_appointments ca JOIN users u ON u.id = ca.agent_id")
        .toArray();
      const certs = this.sql
        .exec<Record<string, unknown>>("SELECT 'certification' AS record_type, u.name AS agent, c.certification, c.completed_date, c.expiration, c.status FROM certifications c JOIN users u ON u.id = c.agent_id")
        .toArray();
      const complaints = this.sql
        .exec<Record<string, unknown>>("SELECT 'complaint' AS record_type, c.complaint_type, c.status, c.channel, c.received_at, c.closed_at FROM complaints c")
        .toArray();
      rows = [...licenses, ...carrier, ...certs, ...complaints];
    } else if (dataset === "deliveries") {
      rows = this.sql
        .exec<Record<string, unknown>>("SELECT id, event, channel, provider, destination, status, template, attempts, error, created_at FROM notification_deliveries ORDER BY created_at DESC LIMIT 5000")
        .toArray();
    } else {
      return bad("Unknown export dataset", 404);
    }
    // Exports never include credentials, password hashes, session tokens, or
    // security secrets — the dataset queries select only operational fields.
    this.audit(user, `Data export: ${dataset} (${format})`, dataset, `${rows.length} rows`);
    if (format === "json") {
      return new Response(JSON.stringify({ ok: true, dataset, generatedAt: new Date().toISOString(), rows }, null, 2), {
        headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="victora-${dataset}.json"` },
      });
    }
    return new Response(toCsv(rows), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="victora-${dataset}.csv"` },
    });
  }

  /* ------------------- Sprint 4: system health / backup ---------------------- */

  private systemHealth(user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const count = (sql: string): number => this.sql.exec<{ n: number }>(sql).toArray()[0].n;
    const staleTasks = this.sql
      .exec("SELECT id, title, due_at, priority FROM tasks WHERE done = 0 AND due_at < ? ORDER BY due_at LIMIT 10", Date.now())
      .toArray();
    const lastBackup = this.sql.exec("SELECT at, kind, record_count, created_by FROM backup_log ORDER BY at DESC LIMIT 1").toArray()[0] ?? null;
    const recent = this.sql.exec("SELECT at, actor_role, action, target FROM audit_logs ORDER BY at DESC LIMIT 20").toArray();
    return Response.json({
      ok: true,
      backend: { status: "operational", service: "victora-api" },
      providers: {
        email: this.providerName("email") === "none" ? "not_configured" : this.providerName("email"),
        sms: this.providerName("sms") === "none" ? "not_configured" : this.providerName("sms"),
        calendar: "not_configured",
        storage: this.storageMode(),
      },
      deliveries: {
        failed: count("SELECT COUNT(*) AS n FROM notification_deliveries WHERE status IN ('failed','bounced')"),
        notConfigured: count("SELECT COUNT(*) AS n FROM notification_deliveries WHERE status = 'not_configured'"),
      },
      automation: { staleTasks },
      db: {
        users: count("SELECT COUNT(*) AS n FROM users"),
        clients: count("SELECT COUNT(*) AS n FROM client_profiles"),
        policies: count("SELECT COUNT(*) AS n FROM policies"),
        tickets: count("SELECT COUNT(*) AS n FROM service_tickets"),
        documents: count("SELECT COUNT(*) AS n FROM documents"),
        messages: count("SELECT COUNT(*) AS n FROM messages"),
        tasks: count("SELECT COUNT(*) AS n FROM tasks"),
        deliveries: count("SELECT COUNT(*) AS n FROM notification_deliveries"),
      },
      backups: { last: lastBackup, automated: false },
      recentActivity: recent,
      notes: [
        "Worker exceptions are captured by Cloudflare logs, not stored in-app.",
        "Email/SMS remain not_configured until real provider credentials are connected.",
        "Document storage is currently in pilot mode pending production object-storage and security review.",
      ],
    });
  }

  private backupStatus(user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const last = this.sql.exec("SELECT at, kind, record_count, created_by, note FROM backup_log ORDER BY at DESC LIMIT 1").toArray()[0] ?? null;
    return Response.json({
      ok: true,
      lastBackup: last,
      method: "manual_structured_export",
      automated: false,
      note: "Automated backup scheduling is not available in the current infrastructure. Run the authorized structured export (GET /system/backup) on a schedule you control and store the file securely.",
    });
  }

  private systemBackup(user: UserRow): Response {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    const tableNames = [
      "households", "household_members", "client_profiles", "leads", "intakes", "coverage_needs", "timeline", "appointments",
      "tasks", "notifications", "documents", "document_requests", "authorization_templates", "authorizations",
      "quote_presentations", "quote_options", "quote_interactions", "conversations", "conversation_participants", "messages",
      "internal_notes", "service_tickets", "ticket_comments", "policies", "policy_members", "renewals", "referrals",
      "comm_prefs", "notification_deliveries", "welcome_items", "commission_records", "commission_adjustments",
      "agent_licenses", "carrier_appointments", "certifications", "marketing_reviews", "complaints", "complaint_notes",
      "communication_templates", "agent_availability", "legal_docs", "legal_acceptances", "retention_policies", "meta",
    ];
    const data: Record<string, unknown[]> = {};
    let total = 0;
    for (const t of tableNames) {
      const rows = this.sql.exec<Record<string, unknown>>(`SELECT * FROM ${t}`).toArray();
      data[t] = rows;
      total += rows.length;
    }
    // Users are included WITHOUT password hashes/salts. Sessions and password
    // reset tokens are NEVER exported.
    data.users = this.sql
      .exec<Record<string, unknown>>("SELECT id, email, name, role, phone, created_at, active, is_test FROM users")
      .toArray();
    this.sql.exec(
      "INSERT INTO backup_log (id, at, kind, record_count, created_by, note) VALUES (?, ?, 'structured_export', ?, ?, 'manual export via API')",
      uid("bkl_"), Date.now(), total, user.id,
    );
    this.audit(user, "Backup export generated", "system", `${total} records`);
    return new Response(
      JSON.stringify({ ok: true, generatedAt: new Date().toISOString(), recordCount: total, data }, null, 2),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="victora-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      },
    );
  }

  private async validateBackup(request: Request, user: UserRow): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    let parsed: { data?: Record<string, unknown> };
    try {
      parsed = (await request.json()) as { data?: Record<string, unknown> };
    } catch {
      return bad("Upload the structured export JSON to validate");
    }
    const data = parsed.data;
    if (!data || typeof data !== "object") return bad("Invalid backup: missing data section");
    const requiredSections = [
      "users", "client_profiles", "leads", "appointments", "documents", "authorizations",
      "quote_presentations", "service_tickets", "renewals", "referrals", "policies",
      "commission_records", "legal_docs", "complaints",
    ];
    const forbiddenKeys = ["password_hash", "salt", "token_hash", "session_token", "password"];
    const sections: { name: string; records: number }[] = [];
    const secretsFound: string[] = [];
    let total = 0;
    for (const [name, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) return bad(`Invalid backup: section "${name}" is not a list`);
      total += rows.length;
      sections.push({ name, records: rows.length });
      for (const row of rows) {
        if (row && typeof row === "object") {
          for (const k of Object.keys(row as Record<string, unknown>)) {
            if (forbiddenKeys.includes(k) && !secretsFound.includes(`${name}.${k}`)) secretsFound.push(`${name}.${k}`);
          }
        }
      }
    }
    const present = new Set(sections.map((s) => s.name));
    const missing = requiredSections.filter((s) => !present.has(s));
    this.audit(user, "Backup validation run (non-destructive)", "system", `${total} records, ${missing.length} missing sections`);
    return Response.json({
      ok: true,
      restorable: missing.length === 0 && secretsFound.length === 0,
      recordCount: total,
      sections,
      missingRequiredSections: missing,
      secretsFound,
      note: "Validation only — nothing was written to the database. An actual restore must be performed into an isolated environment and verified before relying on it.",
    });
  }

  /* ---------------------- Sprint 4: test-data strategy ----------------------- */

  private async flagTestData(request: Request, user: UserRow): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    const body = (await request.json()) as Body;
    const isTest = bool(body, "isTest");
    const userId = str(body, "userId");
    const clientId = str(body, "clientId");
    if (userId.length > 0) {
      this.sql.exec("UPDATE users SET is_test = ? WHERE id = ?", isTest ? 1 : 0, userId);
      this.audit(user, `User test flag → ${isTest ? "test" : "production"}`, userId);
    }
    if (clientId.length > 0) {
      const profile = this.sql.exec<{ id: string; user_id: string | null }>("SELECT id, user_id FROM client_profiles WHERE id = ?", clientId).toArray()[0];
      if (!profile) return bad("Client not found", 404);
      this.sql.exec("UPDATE client_profiles SET is_test = ?, updated_at = ? WHERE id = ?", isTest ? 1 : 0, Date.now(), clientId);
      this.sql.exec("UPDATE leads SET is_test = ? WHERE client_id = ?", isTest ? 1 : 0, clientId);
      if (profile.user_id) this.sql.exec("UPDATE users SET is_test = ? WHERE id = ?", isTest ? 1 : 0, profile.user_id);
      this.audit(user, `Client test flag → ${isTest ? "test" : "production"}`, clientId);
    }
    if (userId.length === 0 && clientId.length === 0) return bad("Provide userId or clientId");
    return Response.json({ ok: true });
  }

  private async purgeTestData(request: Request, user: UserRow): Promise<Response> {
    if (user.role !== "super_admin") return bad("Super admin only", 403);
    const body = (await request.json()) as Body;
    if (str(body, "confirm") !== "PURGE TEST DATA") return bad('Type "PURGE TEST DATA" exactly to confirm');
    // Collect test records FIRST. Every delete below is scoped to these ids —
    // records NOT flagged is_test are never touched.
    const profiles = this.sql
      .exec<{ id: string; user_id: string | null; household_id: string }>("SELECT id, user_id, household_id FROM client_profiles WHERE is_test = 1")
      .toArray();
    const profileIds = profiles.map((p) => p.id);
    const testUserIds = this.sql.exec<{ id: string }>("SELECT id FROM users WHERE is_test = 1").toArray().map((r) => r.id);
    const householdIds = [...new Set(profiles.map((p) => p.household_id))];
    const blobKeys =
      profileIds.length > 0
        ? this.sql
            .exec<{ stored_key: string }>(`SELECT stored_key FROM documents WHERE client_id IN (${profileIds.map(() => "?").join(",")})`, ...profileIds)
            .toArray()
            .map((r) => r.stored_key)
        : [];
    const deleted: Record<string, number> = {};
    const step = (label: string, table: string, where: string, ...p: (string | number)[]): void => {
      const n = this.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, ...p).toArray()[0].n;
      if (n > 0) this.sql.exec(`DELETE FROM ${table} WHERE ${where}`, ...p);
      deleted[label] = n;
    };
    if (profileIds.length > 0) {
      const inP = `IN (${profileIds.map(() => "?").join(",")})`;
      step("quote_interactions", "quote_interactions", `presentation_id IN (SELECT id FROM quote_presentations WHERE client_id ${inP})`, ...profileIds);
      step("quote_options", "quote_options", `presentation_id IN (SELECT id FROM quote_presentations WHERE client_id ${inP})`, ...profileIds);
      step("quote_presentations", "quote_presentations", `client_id ${inP}`, ...profileIds);
      step("ticket_comments", "ticket_comments", `ticket_id IN (SELECT id FROM service_tickets WHERE client_id ${inP})`, ...profileIds);
      step("service_tickets", "service_tickets", `client_id ${inP}`, ...profileIds);
      step("renewals", "renewals", `client_id ${inP}`, ...profileIds);
      step("commission_records", "commission_records", `client_id ${inP} OR policy_id IN (SELECT id FROM policies WHERE client_id ${inP})`, ...profileIds, ...profileIds);
      step("messages", "messages", `conversation_id IN (SELECT id FROM conversations WHERE client_id ${inP})`, ...profileIds);
      step("conversation_participants", "conversation_participants", `conversation_id IN (SELECT id FROM conversations WHERE client_id ${inP})`, ...profileIds);
      step("conversations", "conversations", `client_id ${inP}`, ...profileIds);
      step("welcome_items", "welcome_items", `client_id ${inP}`, ...profileIds);
      step("comm_prefs", "comm_prefs", `client_id ${inP}`, ...profileIds);
      step("document_requests", "document_requests", `client_id ${inP}`, ...profileIds);
      step("documents", "documents", `client_id ${inP}`, ...profileIds);
      step("authorizations", "authorizations", `client_id ${inP}`, ...profileIds);
      step("internal_notes", "internal_notes", `client_id ${inP}`, ...profileIds);
      step("timeline", "timeline", `client_id ${inP}`, ...profileIds);
      step("coverage_needs", "coverage_needs", `intake_id IN (SELECT id FROM intakes WHERE client_id ${inP})`, ...profileIds);
      step("intakes", "intakes", `client_id ${inP}`, ...profileIds);
      step("policy_members", "policy_members", `policy_id IN (SELECT id FROM policies WHERE client_id ${inP})`, ...profileIds);
      step("policies", "policies", `client_id ${inP}`, ...profileIds);
      step("appointments", "appointments", `client_id ${inP}`, ...profileIds);
      step("referrals", "referrals", `referring_client_id ${inP}`, ...profileIds);
      step("tasks", "tasks", `client_id ${inP}`, ...profileIds);
      if (householdIds.length > 0) {
        const inH = `IN (${householdIds.map(() => "?").join(",")})`;
        step("household_members", "household_members", `household_id ${inH}`, ...householdIds);
        step("households", "households", `id ${inH}`, ...householdIds);
      }
      step("client_profiles", "client_profiles", `id ${inP}`, ...profileIds);
    }
    for (const key of blobKeys) await this.documentStorageDelete(key);
    if (testUserIds.length > 0) {
      const inU = `IN (${testUserIds.map(() => "?").join(",")})`;
      step("sessions", "sessions", `user_id ${inU}`, ...testUserIds);
      step("notifications", "notifications", `user_id ${inU}`, ...testUserIds);
      step("password_resets", "password_resets", `user_id ${inU}`, ...testUserIds);
      step("legal_acceptances", "legal_acceptances", `user_id ${inU}`, ...testUserIds);
      step("users", "users", `id ${inU} AND is_test = 1`, ...testUserIds);
    }
    step("leads", "leads", `is_test = 1${profileIds.length > 0 ? ` OR client_id IN (${profileIds.map(() => "?").join(",")})` : ""}`, ...profileIds);
    this.audit(user, "Purge test data", "system", JSON.stringify(deleted).slice(0, 200));
    return Response.json({ ok: true, deleted });
  }

  /* ---------------------- Sprint 4: launch readiness ------------------------- */

  private launchChecklist(user: UserRow): Response {
    if (!["manager", "compliance", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const now = Date.now();
    const flag = (key: string): boolean => this.getMeta(`launch_flag:${key}`) === "1";
    const staffCount = this.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role != 'client' AND (active IS NULL OR active = 1) AND COALESCE(is_test, 0) = 0")
      .toArray()[0].n;
    const licRows = this.sql
      .exec<{ expiration: string; status: string }>(
        "SELECT l.expiration, l.status FROM agent_licenses l JOIN users u ON u.id = l.agent_id WHERE COALESCE(u.is_test, 0) = 0",
      )
      .toArray();
    const licensesCurrent =
      licRows.length > 0 &&
      licRows.every((l) => {
        if (l.status !== "active") return false;
        if (!l.expiration) return true;
        const t = new Date(`${l.expiration}T23:59:59`).getTime();
        return Number.isNaN(t) || t > now;
      });
    const carrierRows = this.sql
      .exec<{ status: string }>(
        "SELECT c.status FROM carrier_appointments c JOIN users u ON u.id = c.agent_id WHERE COALESCE(u.is_test, 0) = 0",
      )
      .toArray();
    const appointmentsConfirmed = carrierRows.length > 0 && carrierRows.every((c) => c.status === "active");
    const activeLegal = (key: string): boolean =>
      this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM legal_docs WHERE doc_key = ? AND active = 1", key).toArray()[0].n > 0;
    const activeAuthTemplate =
      this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM authorization_templates WHERE active = 1 AND body NOT LIKE '[PLACEHOLDER%'").toArray()[0].n > 0;
    const backupDone = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM backup_log").toArray()[0].n > 0;
    const emailConfigured = this.providerName("email") !== "none";
    const smsConfigured = this.providerName("sms") !== "none";
    const item = (key: string, category: string, label: string, complete: boolean, how: "computed" | "manual", detail = ""): Record<string, unknown> => ({
      key,
      category,
      label,
      status: complete ? "complete" : "incomplete",
      how,
      detail,
    });
    const items = [
      item("agency_info", "Business", "Agency information complete", flag("agency_info"), "manual"),
      item("staff_configured", "Business", "Staff configured", staffCount > 0, "computed", `${staffCount} active non-test staff`),
      item("products_configured", "Business", "Products configured", flag("products_configured"), "manual"),
      item("licenses_current", "Licensing", "Licenses current", licensesCurrent, "computed"),
      item("carrier_appointments_confirmed", "Licensing", "Carrier appointments confirmed", appointmentsConfirmed, "computed"),
      item("privacy_approved", "Legal / Compliance", "Privacy policy approved", activeLegal("privacy_policy") && flag("privacy_approved"), "manual", "Requires an active document plus a management approval flag"),
      item("terms_approved", "Legal / Compliance", "Terms of use approved", activeLegal("terms_of_use") && flag("terms_approved"), "manual"),
      item("authorization_templates_approved", "Legal / Compliance", "Authorization templates approved", activeAuthTemplate, "computed"),
      item("complaint_process_defined", "Legal / Compliance", "Complaint process defined", flag("complaint_process"), "manual"),
      item("production_storage_approved", "Security", "Production storage approved", flag("production_storage_approved"), "manual", `Current storage mode: ${this.storageMode()}`),
      item("backup_verified", "Security", "Backup process verified", backupDone, "computed", "Requires at least one completed structured export"),
      item("session_reviewed", "Security", "Session security reviewed", flag("session_reviewed"), "manual"),
      item("access_tests", "Security", "Access-control tests pass", flag("access_tests"), "manual"),
      item("incident_plan", "Security", "Incident-response plan documented", flag("incident_plan"), "manual"),
      item("domain_email", "Communications", "Domain email connected", flag("domain_email"), "manual"),
      item("email_provider_live", "Communications", "Email provider live", emailConfigured, "computed"),
      item("sms_provider_live", "Communications", "SMS provider live (or not used)", smsConfigured || flag("sms_not_used"), "computed"),
      item("templates_reviewed", "Communications", "Message templates reviewed", flag("templates_reviewed"), "manual"),
      item("test_quote", "Client Experience", "Test quote", flag("test_quote"), "manual"),
      item("test_document_request", "Client Experience", "Test document request", flag("test_document_request"), "manual"),
      item("test_authorization", "Client Experience", "Test authorization", flag("test_authorization"), "manual"),
      item("test_enrollment", "Client Experience", "Test enrollment servicing record", flag("test_enrollment"), "manual"),
      item("test_welcome", "Client Experience", "Test welcome", flag("test_welcome"), "manual"),
      item("test_ticket", "Client Experience", "Test ticket", flag("test_ticket"), "manual"),
      item("test_renewal", "Client Experience", "Test renewal", flag("test_renewal"), "manual"),
    ];
    const complete = items.filter((i) => i.status === "complete").length;
    return Response.json({
      ok: true,
      items,
      summary: {
        complete,
        total: items.length,
        ready: complete === items.length,
        note:
          complete === items.length
            ? "All checklist items are complete."
            : "Not launch-ready: incomplete items above require real credentials, approvals, or verified tests — readiness is never assumed.",
      },
    });
  }

  private async setLaunchFlag(request: Request, user: UserRow): Promise<Response> {
    if (!["manager", "super_admin"].includes(user.role)) return bad("Manager access required", 403);
    const body = (await request.json()) as Body;
    const key = str(body, "key");
    const allowed = [
      "agency_info", "products_configured", "privacy_approved", "terms_approved", "complaint_process",
      "production_storage_approved", "session_reviewed", "access_tests", "incident_plan", "domain_email",
      "sms_not_used", "templates_reviewed", "test_quote", "test_document_request", "test_authorization",
      "test_enrollment", "test_welcome", "test_ticket", "test_renewal",
    ];
    if (!allowed.includes(key)) return bad("Unknown checklist flag");
    this.setMeta(`launch_flag:${key}`, bool(body, "value") ? "1" : "0");
    this.audit(user, `Launch checklist flag ${key} → ${bool(body, "value") ? "complete" : "incomplete"}`, key);
    return Response.json({ ok: true });
  }

  /* ------------------ Sprint 4: expiry / escalation automation --------------- */

  private runExpiryAutomation(): void {
    const alertDays = Number(this.getMeta("expiry_alert_days") ?? "30") || 30;
    const now = Date.now();
    const expiring = (
      rows: { id: string; agent_id: string; label: string; expiration: string; name: string }[],
    ): void => {
      for (const r of rows) {
        const t = new Date(`${r.expiration}T23:59:59`).getTime();
        if (Number.isNaN(t)) continue;
        const days = Math.ceil((t - now) / 86_400_000);
        const tier = days <= 7 ? 7 : days <= alertDays ? alertDays : 0;
        if (tier === 0) continue;
        this.addTaskOnce({
          title: `Expiring soon: ${r.label} (${r.name}) — ${r.expiration}`,
          detail: `${days} days to expiration`,
          refType: "expiry", refId: `${r.id}:${tier}`, dueHours: 24,
          priority: days <= 7 ? "high" : "normal",
        });
        this.notify(
          r.agent_id,
          "Credential expiring soon",
          `${r.label} expires ${r.expiration} (${days} days). Contact management about renewal.`,
          "credential_expiring", "expiry", `${r.id}:${tier}`,
        );
      }
    };
    expiring(
      this.sql
        .exec<{ id: string; agent_id: string; expiration: string; name: string; state: string }>(
          "SELECT l.id, l.agent_id, l.expiration, u.name, l.state FROM agent_licenses l JOIN users u ON u.id = l.agent_id WHERE l.status = 'active' AND l.expiration != ''",
        )
        .toArray()
        .map((r) => ({ id: r.id, agent_id: r.agent_id, expiration: r.expiration, name: r.name, label: `${r.state} license` })),
    );
    expiring(
      this.sql
        .exec<{ id: string; agent_id: string; expiration: string; name: string; certification: string }>(
          "SELECT c.id, c.agent_id, c.expiration, u.name, c.certification FROM certifications c JOIN users u ON u.id = c.agent_id WHERE c.status = 'active' AND c.expiration != ''",
        )
        .toArray()
        .map((r) => ({ id: r.id, agent_id: r.agent_id, expiration: r.expiration, name: r.name, label: r.certification })),
    );
    // Unsigned authorizations aging 72h+ become high-priority tasks.
    const staleAuths = this.sql
      .exec<{ id: string; template_name: string; first_name: string; last_name: string; agent_id: string | null }>(
        "SELECT a.id, a.template_name, p.first_name, p.last_name, p.agent_id FROM authorizations a JOIN client_profiles p ON p.id = a.client_id WHERE a.status = 'pending' AND a.created_at < ?",
        now - 72 * 3_600_000,
      )
      .toArray();
    for (const a of staleAuths) {
      this.addTaskOnce({
        title: `Authorization unsigned 72h+ — ${a.first_name} ${a.last_name}`,
        detail: a.template_name,
        refType: "authorization", refId: a.id, dueHours: 8,
        assignedTo: a.agent_id, priority: "high",
      });
    }
    // Complaints unresolved 7+ days escalate to the owner and the task queue.
    const staleComplaints = this.sql
      .exec<{ id: string; complaint_type: string; owner_id: string | null }>(
        "SELECT id, complaint_type, owner_id FROM complaints WHERE status IN ('open','investigating') AND created_at < ?",
        now - 7 * 86_400_000,
      )
      .toArray();
    for (const c of staleComplaints) {
      this.addTaskOnce({
        title: `Complaint unresolved 7d+ — ${c.complaint_type}`,
        detail: "Compliance escalation",
        refType: "complaint", refId: c.id, dueHours: 8, priority: "high",
      });
      if (c.owner_id) {
        this.notify(c.owner_id, "Complaint needs attention", `A complaint (${c.complaint_type}) has been unresolved for 7+ days.`, "complaint_aging", "complaint", c.id);
      }
    }
  }
}
