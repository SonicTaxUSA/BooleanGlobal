-- =============================================================================
-- Victora — Supabase PostgreSQL schema (Phase 1 validation migration)
-- Source of truth: functions/victora-db.ts SQLite schema (48 migrating tables).
-- sessions + rate_limits intentionally NOT created: they remain DO-local for the
-- entire transition (the DO is an auth dependency until Supabase Auth Phase 2).
--
-- Translation rules (mandated — do not blindly copy SQLite):
--   INTEGER epoch-ms   -> timestamptz
--   REAL money         -> numeric(12,2)   (never float; display strings stay TEXT)
--   TEXT JSON payload  -> jsonb
--   INTEGER booleans   -> boolean
--   TEXT PKs / IDs     -> TEXT PKs, copied verbatim (no renumbering)
--   Logical FKs        -> real FOREIGN KEYs where the source data cannot contain
--                         '' sentinel values (''-defaulted columns get no FK)
--
-- Idempotent: safe to re-run. Deny-by-default: RLS on every table, zero policies,
-- anon/authenticated grants revoked. Service role (server-side only) is the only
-- accessor during the transitional-auth phase.
-- =============================================================================

-- ---------------------------------------------------------------- extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------- helpers
-- Immutable acceptance history: reject any UPDATE/DELETE on legal_acceptances.
CREATE OR REPLACE FUNCTION victora_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances is immutable (historical record)';
END;
$$;

-- ============================================================================
-- IDENTITY & FOUNDATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  salt            TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('client','agent','manager','compliance','super_admin')),
  phone           TEXT NOT NULL DEFAULT '',
  active          boolean NOT NULL DEFAULT true,
  is_test         boolean NOT NULL DEFAULT false,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL
);

-- sessions: deliberately absent. DO-local until Supabase Auth (Phase 2).
-- rate_limits: deliberately absent. DO-local abuse counters (survive DO restarts).

CREATE TABLE IF NOT EXISTS households (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  primary_email TEXT NOT NULL,
  created_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS household_members (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name         TEXT NOT NULL,
  dob          TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  tobacco      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS client_profiles (
  id                  TEXT PRIMARY KEY,             -- VIC-###### (sequence carried via meta.vic_counter)
  user_id             TEXT REFERENCES users(id),
  household_id        TEXT NOT NULL REFERENCES households(id),
  agent_id            TEXT REFERENCES users(id),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL DEFAULT '',
  journey_stage       TEXT NOT NULL DEFAULT 'info_received',
  source              TEXT NOT NULL DEFAULT 'Website',
  campaign            TEXT NOT NULL DEFAULT '',
  preferred_language  TEXT NOT NULL DEFAULT 'English',
  relationship_status TEXT NOT NULL DEFAULT 'prospect',
  is_test             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT REFERENCES client_profiles(id),
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT NOT NULL DEFAULT '',
  source             TEXT NOT NULL DEFAULT 'Website',
  campaign           TEXT NOT NULL DEFAULT '',
  coverage_type      TEXT NOT NULL DEFAULT '',
  zip                TEXT NOT NULL DEFAULT '',
  details            TEXT NOT NULL DEFAULT '',
  stage              TEXT NOT NULL DEFAULT 'new',
  assigned_agent     TEXT REFERENCES users(id),
  preferred_language TEXT NOT NULL DEFAULT 'English',
  is_test            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS intakes (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES client_profiles(id),
  area        TEXT NOT NULL,
  payload     jsonb NOT NULL DEFAULT 'null'::jsonb,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  timestamptz NOT NULL,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS coverage_needs (
  id        TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES intakes(id),
  need      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline (
  id        TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES client_profiles(id),
  at        timestamptz NOT NULL,
  actor     TEXT NOT NULL DEFAULT 'system',
  kind      TEXT NOT NULL DEFAULT 'event',
  label     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  at         timestamptz NOT NULL,
  actor_id   TEXT NOT NULL DEFAULT '',      -- may reference deleted/external actors: no FK
  actor_role TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS appointments (
  id               TEXT PRIMARY KEY,
  client_id        TEXT REFERENCES client_profiles(id),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL DEFAULT '',
  date             TEXT NOT NULL,             -- source stores date strings; validated on load
  time             TEXT NOT NULL,
  topic            TEXT NOT NULL DEFAULT '',
  channel          TEXT NOT NULL DEFAULT 'phone',
  notes            TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT 'Website',
  status           TEXT NOT NULL DEFAULT 'requested',
  duration_minutes integer NOT NULL DEFAULT 30,
  meeting_type     TEXT NOT NULL DEFAULT 'phone',
  timezone         TEXT NOT NULL DEFAULT 'America/New_York',
  assigned_agent   TEXT NOT NULL DEFAULT '',  -- '' sentinel possible: no FK
  cancelled_at     timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  due_at      timestamptz NOT NULL,
  source      TEXT NOT NULL DEFAULT 'automation',
  done        boolean NOT NULL DEFAULT false,
  ref_type    TEXT NOT NULL DEFAULT '',
  ref_id      TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',      -- '' sentinel possible: no FK
  client_id   TEXT NOT NULL DEFAULT '',      -- '' sentinel possible: no FK
  priority    TEXT NOT NULL DEFAULT 'normal',
  created_at  timestamptz NOT NULL
);
-- Automation dedupe must hold under PostgreSQL exactly as addTaskOnce did in the DO.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_automation_dedupe
  ON tasks (source, ref_type, ref_id)
  WHERE source = 'automation' AND ref_type <> '' AND ref_id <> '';

CREATE TABLE IF NOT EXISTS notifications (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id),
  at       timestamptz NOT NULL,
  title    TEXT NOT NULL,
  body     TEXT NOT NULL DEFAULT '',
  read     boolean NOT NULL DEFAULT false,
  channels TEXT NOT NULL DEFAULT 'portal'
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================================
-- DOCUMENTS & CONSENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_requests (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES client_profiles(id),
  requested_by  TEXT NOT NULL DEFAULT '',     -- '' sentinel possible: no FK
  category      TEXT NOT NULL,
  document_type TEXT NOT NULL,
  instructions  TEXT NOT NULL DEFAULT '',
  due_date      TEXT NOT NULL DEFAULT '',
  required      boolean NOT NULL DEFAULT true,
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id                  TEXT PRIMARY KEY,
  client_id           TEXT NOT NULL REFERENCES client_profiles(id),
  request_id          TEXT REFERENCES document_requests(id),
  document_type       TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL DEFAULT '',
  original_filename   TEXT NOT NULL,
  stored_key          TEXT NOT NULL,          -- legacy DO key (rollback source)
  mime_type           TEXT NOT NULL,
  size                bigint NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'uploaded',
  uploaded_by         TEXT NOT NULL DEFAULT '',
  reviewed_by         TEXT REFERENCES users(id),
  review_note         TEXT NOT NULL DEFAULT '',
  rejection_reason    TEXT NOT NULL DEFAULT '',
  uploaded_at         timestamptz NOT NULL,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL,
  -- Phase 1 additions (additive; DO untouched until cutover):
  storage_backend     TEXT NOT NULL DEFAULT 'do' CHECK (storage_backend IN ('do','supabase')),
  storage_path        TEXT NOT NULL DEFAULT '',  -- clients/<VIC-ID>/documents/<uuid>/<filename>
  legacy_storage_key  TEXT NOT NULL DEFAULT '',
  checksum            TEXT NOT NULL DEFAULT '',  -- sha-256 hex of bytes
  storage_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (storage_status IN ('pending','copied','verified','failed','cutover'))
);
CREATE INDEX IF NOT EXISTS documents_client_idx ON documents (client_id);
CREATE INDEX IF NOT EXISTS documents_request_idx ON documents (request_id);
CREATE INDEX IF NOT EXISTS documents_storage_status_idx ON documents (storage_status);

CREATE TABLE IF NOT EXISTS authorization_templates (
  id           TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,
  name         TEXT NOT NULL,
  version      integer NOT NULL,
  body         TEXT NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS authorizations (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES client_profiles(id),
  template_id      TEXT NOT NULL REFERENCES authorization_templates(id),
  template_version integer NOT NULL,
  template_name    TEXT NOT NULL DEFAULT '',
  signed_text      TEXT NOT NULL DEFAULT '',
  signer_name      TEXT NOT NULL DEFAULT '',
  signer_role      TEXT NOT NULL DEFAULT 'client',
  signature        TEXT NOT NULL DEFAULT '',
  method           TEXT NOT NULL DEFAULT 'electronic_signature',
  signed_at        timestamptz,
  ip               TEXT NOT NULL DEFAULT '',
  user_agent       TEXT NOT NULL DEFAULT '',
  agent_id         TEXT REFERENCES users(id),
  expires_at       timestamptz,
  revoked_at       timestamptz,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       timestamptz NOT NULL
);

-- ============================================================================
-- QUOTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_presentations (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES client_profiles(id),
  agent_id          TEXT NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL DEFAULT '',
  coverage_area     TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'draft',   -- ready/sent/archived enforced at API layer
  sent_at           timestamptz,
  viewed_at         timestamptz,
  interested_option TEXT NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_options (
  id              TEXT PRIMARY KEY,
  presentation_id TEXT NOT NULL REFERENCES quote_presentations(id),
  label           TEXT NOT NULL DEFAULT '',
  carrier         TEXT NOT NULL DEFAULT '',
  plan_name       TEXT NOT NULL DEFAULT '',
  metal_tier      TEXT NOT NULL DEFAULT '',
  -- premium/deductible/oop_max hold human-readable display strings in the source
  -- ("$240/mo"); they stay TEXT. True ledger money is numeric (commission_*).
  premium         TEXT NOT NULL DEFAULT '',
  deductible      TEXT NOT NULL DEFAULT '',
  oop_max         TEXT NOT NULL DEFAULT '',
  pcp             TEXT NOT NULL DEFAULT '',
  specialist      TEXT NOT NULL DEFAULT '',
  urgent_care     TEXT NOT NULL DEFAULT '',
  er              TEXT NOT NULL DEFAULT '',
  generic_rx      TEXT NOT NULL DEFAULT '',
  network_type    TEXT NOT NULL DEFAULT '',
  dental_note     TEXT NOT NULL DEFAULT '',
  vision_note     TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  doc_link        TEXT NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_interactions (
  id              TEXT PRIMARY KEY,
  presentation_id TEXT NOT NULL REFERENCES quote_presentations(id),
  option_id       TEXT NOT NULL DEFAULT '',
  client_id       TEXT NOT NULL REFERENCES client_profiles(id),
  action          TEXT NOT NULL,
  message         TEXT NOT NULL DEFAULT '',
  at              timestamptz NOT NULL
);

-- ============================================================================
-- MESSAGING / SERVICE CENTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES client_profiles(id),
  agent_id        TEXT REFERENCES users(id),
  subject         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  role            TEXT NOT NULL,
  last_read_at    timestamptz
);

CREATE TABLE IF NOT EXISTS messages (
  id                    TEXT PRIMARY KEY,
  conversation_id       TEXT NOT NULL REFERENCES conversations(id),
  sender_user_id        TEXT NOT NULL DEFAULT '',  -- system messages: '' sentinel, no FK
  sender_role           TEXT NOT NULL,
  body                  TEXT NOT NULL,
  created_at            timestamptz NOT NULL,
  read_at               timestamptz,
  message_type          TEXT NOT NULL DEFAULT 'message',
  attachment_document_id TEXT REFERENCES documents(id),
  system_generated      boolean NOT NULL DEFAULT false
);

-- STAFF-ONLY. Never selected into any client-facing payload (same rule as the DO).
CREATE TABLE IF NOT EXISTS internal_notes (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES client_profiles(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  author_role TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS service_tickets (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES client_profiles(id),
  ticket_number   TEXT NOT NULL UNIQUE CHECK (ticket_number ~ '^VIC-SVC-[0-9]+$'),
  category        TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'new',
  priority        TEXT NOT NULL DEFAULT 'normal',
  assigned_to     TEXT REFERENCES users(id),
  latest_response TEXT NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES service_tickets(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  author_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  internal    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL
);

-- ============================================================================
-- COVERAGE RECORDS (servicing only — NOT a carrier system of record)
-- ============================================================================

CREATE TABLE IF NOT EXISTS policies (
  id                    TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL REFERENCES client_profiles(id),
  product_type          TEXT NOT NULL,
  carrier               TEXT NOT NULL DEFAULT '',
  plan_name             TEXT NOT NULL DEFAULT '',
  policy_identifier     TEXT NOT NULL DEFAULT '',
  effective_date        TEXT NOT NULL DEFAULT '',
  termination_date      TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'pending',
  monthly_premium       TEXT NOT NULL DEFAULT '',  -- display string (see quote_options note)
  deductible            TEXT NOT NULL DEFAULT '',
  out_of_pocket_max     TEXT NOT NULL DEFAULT '',
  network_type          TEXT NOT NULL DEFAULT '',
  pcp_cost              TEXT NOT NULL DEFAULT '',
  specialist_cost       TEXT NOT NULL DEFAULT '',
  rx_summary            TEXT NOT NULL DEFAULT '',
  dental_flag           boolean NOT NULL DEFAULT false,
  vision_flag           boolean NOT NULL DEFAULT false,
  carrier_portal_url    TEXT NOT NULL DEFAULT '',
  provider_search_url   TEXT NOT NULL DEFAULT '',
  carrier_phone         TEXT NOT NULL DEFAULT '',
  agent_id              TEXT REFERENCES users(id),
  source_quote_option_id TEXT REFERENCES quote_options(id),
  notes                 TEXT NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL,
  updated_at            timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_members (
  id           TEXT PRIMARY KEY,
  policy_id    TEXT NOT NULL REFERENCES policies(id),
  name         TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT '',
  dob          TEXT NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS renewals (
  id                  TEXT PRIMARY KEY,
  policy_id           TEXT NOT NULL REFERENCES policies(id),
  client_id           TEXT NOT NULL REFERENCES client_profiles(id),
  renewal_period      TEXT NOT NULL DEFAULT '',
  renewal_date        TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'upcoming',
  assigned_agent      TEXT NOT NULL DEFAULT '',  -- '' sentinel possible: no FK
  first_contact_at    timestamptz,
  client_response_at  timestamptz,
  review_completed_at timestamptz,
  outcome             TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL
);

-- Referral tracking only. Incentive payouts are NOT built (compliance review first).
CREATE TABLE IF NOT EXISTS referrals (
  id                  TEXT PRIMARY KEY,
  referring_client_id TEXT NOT NULL REFERENCES client_profiles(id),
  referred_name       TEXT NOT NULL,
  referred_email      TEXT NOT NULL DEFAULT '',
  referred_phone      TEXT NOT NULL DEFAULT '',
  relationship        TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'submitted',
  converted_client_id TEXT REFERENCES client_profiles(id),
  source              TEXT NOT NULL DEFAULT 'Client Referral',
  campaign            TEXT NOT NULL DEFAULT '',
  message             TEXT NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS comm_prefs (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL UNIQUE REFERENCES client_profiles(id),
  portal            boolean NOT NULL DEFAULT true,
  email             boolean NOT NULL DEFAULT false,
  sms               boolean NOT NULL DEFAULT false,
  phone             boolean NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'English',
  consent_status    TEXT NOT NULL DEFAULT 'none',
  consent_at        timestamptz,
  optout_at         timestamptz,
  source            TEXT NOT NULL DEFAULT '',
  updated_at        timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
  client_id           TEXT NOT NULL DEFAULT '',   -- '' sentinel possible: no FK
  event               TEXT NOT NULL DEFAULT '',
  channel             TEXT NOT NULL,
  title               TEXT NOT NULL DEFAULT '',
  body                TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL,              -- queued/sending/delivered/bounced/failed/not_configured
  ref_type            TEXT NOT NULL DEFAULT '',
  ref_id              TEXT NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL,
  delivered_at        timestamptz,
  provider            TEXT NOT NULL DEFAULT '',
  destination         TEXT NOT NULL DEFAULT '',
  template            TEXT NOT NULL DEFAULT '',
  provider_message_id TEXT NOT NULL DEFAULT '',
  attempts            integer NOT NULL DEFAULT 0,
  error               TEXT NOT NULL DEFAULT ''
);

-- Welcome center checklist — informational completion only.
CREATE TABLE IF NOT EXISTS welcome_items (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES client_profiles(id),
  item_key     TEXT NOT NULL,
  completed_at timestamptz NOT NULL
);

-- ============================================================================
-- COMPLIANCE / OPERATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS communication_templates (
  id          TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,
  channel     TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'English',
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL,
  version     integer NOT NULL,
  active      boolean NOT NULL DEFAULT false,
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_licenses (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL REFERENCES users(id),
  state            TEXT NOT NULL,
  license_number   TEXT NOT NULL,
  line_of_authority TEXT NOT NULL DEFAULT '',
  issue_date       TEXT NOT NULL DEFAULT '',
  expiration       TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'active',
  notes            TEXT NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS carrier_appointments (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL REFERENCES users(id),
  carrier          TEXT NOT NULL,
  state            TEXT NOT NULL,
  product          TEXT NOT NULL DEFAULT '',
  effective_date   TEXT NOT NULL DEFAULT '',
  termination_date TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'active',
  notes            TEXT NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS certifications (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES users(id),
  certification   TEXT NOT NULL,
  completed_date  TEXT NOT NULL DEFAULT '',
  expiration      TEXT NOT NULL DEFAULT '',
  documentation   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS marketing_reviews (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  campaign      TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  submitted_by  TEXT NOT NULL DEFAULT '',
  reviewer      TEXT NOT NULL DEFAULT '',
  decision_notes TEXT NOT NULL DEFAULT '',
  reviewed_at   timestamptz,
  created_by    TEXT NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);

-- STAFF-ONLY (same rule as the DO).
CREATE TABLE IF NOT EXISTS complaints (
  id             TEXT PRIMARY KEY,
  client_id      TEXT REFERENCES client_profiles(id),
  complaint_type TEXT NOT NULL,
  channel        TEXT NOT NULL DEFAULT 'phone',
  details        TEXT NOT NULL DEFAULT '',
  owner_id       TEXT REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'received'
                   CHECK (status IN ('received','assigned','investigating','resolution_proposed','resolved','closed')),
  resolution     TEXT NOT NULL DEFAULT '',
  received_at    timestamptz NOT NULL,
  closed_at      timestamptz,
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS complaint_notes (
  id          TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES complaints(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  author_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  timestamptz NOT NULL
);

-- Commission ledger — internal accounting only. NOT carrier payment processing.
CREATE TABLE IF NOT EXISTS commission_records (
  id               TEXT PRIMARY KEY,
  policy_id        TEXT REFERENCES policies(id),
  client_id        TEXT REFERENCES client_profiles(id),
  carrier          TEXT NOT NULL,
  product          TEXT NOT NULL DEFAULT '',
  agent_id         TEXT REFERENCES users(id),
  statement_period TEXT NOT NULL DEFAULT '',
  commission_type  TEXT NOT NULL DEFAULT 'first_year',
  expected_amount  numeric(12,2) NOT NULL DEFAULT 0 CHECK (expected_amount >= 0),
  received_amount  numeric(12,2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  status           TEXT NOT NULL DEFAULT 'expected',
  carrier_reference TEXT NOT NULL DEFAULT '',
  paid_date        TEXT NOT NULL DEFAULT '',
  notes            TEXT NOT NULL DEFAULT '',
  created_by       TEXT NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_adjustments (
  id         TEXT PRIMARY KEY,
  record_id  TEXT NOT NULL REFERENCES commission_records(id),
  kind       TEXT NOT NULL,
  amount     numeric(12,2) NOT NULL DEFAULT 0,
  reason     TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_by TEXT NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_availability (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES users(id),
  weekday    integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Legal/policy documents are admin-managed and versioned. Migrated rows preserve
-- historical state VERBATIM, but existing active=1 rows do NOT satisfy Launch
-- Readiness legal approval — explicit approval evidence from the new workflow is
-- required. All migrated text: PENDING LEGAL/COMPLIANCE REVIEW until then.
CREATE TABLE IF NOT EXISTS legal_docs (
  id           TEXT PRIMARY KEY,
  doc_key      TEXT NOT NULL,
  version      integer NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  effective_at timestamptz NOT NULL,
  active       boolean NOT NULL DEFAULT false,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','review','approved','active','archived')),
  created_by   TEXT NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL,
  UNIQUE (doc_key, version)
);

-- Immutable historical acceptance: trigger-enforced (no UPDATE/DELETE, ever).
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  doc_key     TEXT NOT NULL,
  version     integer NOT NULL,
  accepted_at timestamptz NOT NULL
);
DROP TRIGGER IF EXISTS legal_acceptances_immutable ON legal_acceptances;
CREATE TRIGGER legal_acceptances_immutable
  BEFORE UPDATE OR DELETE ON legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION victora_block_mutation();

-- Retention framework ONLY: metadata. No automatic deletion; rules require
-- explicit approval to activate.
CREATE TABLE IF NOT EXISTS retention_policies (
  id             TEXT PRIMARY KEY,
  record_type    TEXT NOT NULL UNIQUE,
  retention_days integer,
  hold           boolean NOT NULL DEFAULT false,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_log (
  id           TEXT PRIMARY KEY,
  at           timestamptz NOT NULL,
  kind         TEXT NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  created_by   TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT ''
);

-- ============================================================================
-- MIGRATION TOOLING
-- ============================================================================

-- Per-table run log: one row per table per migration run.
CREATE TABLE IF NOT EXISTS migration_run_log (
  run_id            TEXT NOT NULL,
  source            TEXT NOT NULL,
  destination       TEXT NOT NULL,
  source_count      integer NOT NULL DEFAULT 0,
  inserted          integer NOT NULL DEFAULT 0,
  updated           integer NOT NULL DEFAULT 0,
  skipped           integer NOT NULL DEFAULT 0,
  failed            integer NOT NULL DEFAULT 0,
  destination_count integer NOT NULL DEFAULT 0,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  notes             TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, source)
);

-- ============================================================================
-- INDEXES (query paths used by the API layer)
-- ============================================================================

CREATE INDEX IF NOT EXISTS client_profiles_agent_idx   ON client_profiles (agent_id);
CREATE INDEX IF NOT EXISTS client_profiles_journey_idx ON client_profiles (journey_stage);
CREATE INDEX IF NOT EXISTS leads_client_idx            ON leads (client_id);
CREATE INDEX IF NOT EXISTS intakes_client_idx          ON intakes (client_id);
CREATE INDEX IF NOT EXISTS timeline_client_idx         ON timeline (client_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_at_idx           ON audit_logs (at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx       ON audit_logs (action);
CREATE INDEX IF NOT EXISTS appointments_client_idx     ON appointments (client_id);
CREATE INDEX IF NOT EXISTS tasks_due_idx               ON tasks (due_at);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx          ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS notifications_user_idx      ON notifications (user_id, at DESC);
CREATE INDEX IF NOT EXISTS document_requests_client_idx ON document_requests (client_id);
CREATE INDEX IF NOT EXISTS authorizations_client_idx   ON authorizations (client_id);
CREATE INDEX IF NOT EXISTS quote_presentations_client_idx ON quote_presentations (client_id);
CREATE INDEX IF NOT EXISTS quote_options_presentation_idx ON quote_options (presentation_id);
CREATE INDEX IF NOT EXISTS conversations_client_idx    ON conversations (client_id);
CREATE INDEX IF NOT EXISTS messages_conversation_idx   ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS internal_notes_client_idx   ON internal_notes (client_id);
CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx  ON ticket_comments (ticket_id);
CREATE INDEX IF NOT EXISTS policies_client_idx         ON policies (client_id);
CREATE INDEX IF NOT EXISTS renewals_policy_idx         ON renewals (policy_id);
CREATE INDEX IF NOT EXISTS referrals_referring_idx     ON referrals (referring_client_id);
CREATE INDEX IF NOT EXISTS notification_deliveries_user_idx ON notification_deliveries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS welcome_items_client_idx    ON welcome_items (client_id);
CREATE INDEX IF NOT EXISTS complaints_client_idx       ON complaints (client_id);
CREATE INDEX IF NOT EXISTS complaint_notes_complaint_idx ON complaint_notes (complaint_id);
CREATE INDEX IF NOT EXISTS commission_records_agent_idx ON commission_records (agent_id);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx  ON legal_acceptances (user_id, doc_key);

-- ============================================================================
-- SECURITY: deny-by-default for browser roles (transitional-auth phase)
-- ============================================================================
-- RLS is enabled with ZERO policies: anon/authenticated match no rows.
-- Server-side access uses the service role key, which bypasses RLS and lives
-- ONLY in server env (never EXPO_PUBLIC_*/VITE_*/browser/GitHub/logs).
-- Phase 2 (Supabase Auth) will add auth.uid()-based policies to this same base.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','households','household_members','client_profiles','leads','intakes',
    'coverage_needs','timeline','audit_logs','appointments','tasks','notifications',
    'meta','document_requests','documents','authorization_templates','authorizations',
    'quote_presentations','quote_options','quote_interactions','conversations',
    'conversation_participants','messages','internal_notes','service_tickets',
    'ticket_comments','policies','policy_members','renewals','referrals','comm_prefs',
    'notification_deliveries','welcome_items','communication_templates','agent_licenses',
    'carrier_appointments','certifications','marketing_reviews','complaints',
    'complaint_notes','commission_records','commission_adjustments','password_resets',
    'agent_availability','legal_docs','legal_acceptances','retention_policies',
    'backup_log','migration_run_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ============================================================================
-- PRIVATE DOCUMENT STORAGE BUCKET (idempotent, enforced)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'victora-client-documents', 'victora-client-documents', false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public            = false,               -- MUST stay private
      file_size_limit   = 10485760,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage.objects policies are created: with RLS deny-by-default, anon and
-- authenticated roles have zero access to the bucket. Signed URLs are minted
-- server-side with the service key ONLY after Victora auth + authorization
-- (120s expiry). No public document URLs exist by construction.
