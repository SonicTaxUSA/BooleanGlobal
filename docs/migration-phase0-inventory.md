# Phase 0 — Migration Inventory & Map (DO SQLite → Supabase Postgres)

Source of truth: `functions/victora-db.ts` schema block (lines ~207–520) + live export
`/tmp/mig_export.json` (victora-backend.rork.app, 2026-09-17). Legacy DO database is NOT
destroyed — it becomes read-only rollback after cutover.

## A. Table inventory (50 tables)

Row counts are live. `MIG` = migrate, `NO-MIG` = ephemeral/DO-local, stays behind on legacy.

| # | DO table | Rows | Supabase target | Logical FKs (none declared in SQLite; real FKs to be added in PG) | Notes |
|---|----------|------|-----------------|-------------------------------------------------------------------|-------|
| 1 | users | 12 | users | — | password_hash+salt migrate WITH auth (auth stays Victora in Phase 1). 11/12 `is_test=1`; founder only real user. |
| 2 | sessions | n/a (excluded from export) | **NO-MIG** | user_id → users.id | Ephemeral tokens; users re-login after cutover. Stays in DO during Phase 1. |
| 3 | households | 8 | households | — | VIC-100001..100008 |
| 4 | household_members | 0 | household_members | household_id → households.id | |
| 5 | client_profiles | 8 | client_profiles | household_id, user_id, agent_id | PK format VIC-###### (preserve; no renumbering). 2 assigned to agents. |
| 6 | leads | 3 | leads | client_id, assigned_agent | |
| 7 | intakes | 2 | intakes | client_id, reviewed_by | payload is TEXT (JSON string) → JSONB |
| 8 | coverage_needs | 2 | coverage_needs | intake_id → intakes.id | |
| 9 | timeline | 53 | timeline | client_id | Audit-adjacent; preserve `at` epoch-ms → timestamptz |
| 10 | audit_logs | n/a (excluded from export) | audit_logs | — | Compliance record — MUST migrate. Needs live pull (export omits it). |
| 11 | appointments | 2 | appointments | client_id, assigned_agent | |
| 12 | tasks | 30 | tasks | assigned_to, client_id | ref_type/ref_id polymorphic — no FK |
| 13 | notifications | 29 | notifications | user_id | |
| 14 | meta | 3 | id_sequences (or meta) | — | `vic_counter=100008`, `svc_counter=10002` — **carry over to preserve ID sequences** |
| 15 | document_requests | 2 | document_requests | client_id, requested_by | |
| 16 | documents | 2 | documents | client_id, request_id, uploaded_by | stored_key → Supabase Storage path mapping (below) |
| 17 | authorization_templates | 4 | authorization_templates | — | Seeded; 1 active |
| 18 | authorizations | 3 | authorizations | client_id, template_id, agent_id | Immutable signed records |
| 19 | quote_presentations | 2 | quote_presentations | client_id, agent_id | |
| 20 | quote_options | 3 | quote_options | presentation_id | premium/deductible TEXT → numeric(12,2) |
| 21 | quote_interactions | 3 | quote_interactions | presentation_id, option_id, client_id | |
| 22 | conversations | 4 | conversations | client_id, agent_id | |
| 23 | conversation_participants | 6 | conversation_participants | conversation_id, user_id | |
| 24 | messages | 4 | messages | conversation_id, sender_user_id, attachment_document_id | |
| 25 | internal_notes | 1 | internal_notes | client_id, author_id | STAFF-ONLY — RLS deny for client role |
| 26 | service_tickets | 2 | service_tickets | client_id, assigned_to | ticket_number VIC-SVC-##### |
| 27 | ticket_comments | 3 | ticket_comments | ticket_id, author_id | internal flag |
| 28 | policies | 2 | policies | client_id, agent_id, source_quote_option_id | monthly_premium TEXT → numeric |
| 29 | policy_members | 0 | policy_members | policy_id | |
| 30 | renewals | 2 | renewals | policy_id, client_id, assigned_agent | |
| 31 | referrals | 2 | referrals | referring_client_id, converted_client_id | |
| 32 | comm_prefs | 1 | comm_prefs | client_id (UNIQUE) | |
| 33 | notification_deliveries | 25 | notification_deliveries | user_id, client_id | Honest states: 18 portal/delivered, 7 not_configured (4 email, 3 sms) |
| 34 | welcome_items | 1 | welcome_items | client_id | |
| 35 | communication_templates | 22 | communication_templates | — | |
| 36 | agent_licenses | 1 | agent_licenses | agent_id | |
| 37 | carrier_appointments | 0 | carrier_appointments | agent_id | |
| 38 | certifications | 0 | certifications | agent_id | |
| 39 | marketing_reviews | 0 | marketing_reviews | — | |
| 40 | complaints | 2 | complaints | client_id, owner_id | STAFF-ONLY |
| 41 | complaint_notes | 1 | complaint_notes | complaint_id, author_id | STAFF-ONLY |
| 42 | commission_records | 1 | commission_records | policy_id, client_id, agent_id | REAL amounts → numeric(12,2) — **never float in PG** |
| 43 | commission_adjustments | 0 | commission_adjustments | record_id | |
| 44 | password_resets | n/a (excluded) | password_resets | user_id | token_hash migrates; expired tokens pruned |
| 45 | agent_availability | 0 | agent_availability | agent_id | |
| 46 | legal_docs | 6 | legal_docs | — | 3 doc_keys: electronic_consent v1 draft/v2 draft/**v3 active**, privacy_policy v1 inactive/v2 active, terms_of_use v1 active |
| 47 | legal_acceptances | 2 | legal_acceptances | user_id | Immutable — must not be altered by migration |
| 48 | retention_policies | 0 | retention_policies | record_type UNIQUE | |
| 49 | backup_log | n/a (excluded) | backup_log | — | Migrate; new Supabase backups append |
| 50 | rate_limits | n/a (excluded) | **NO-MIG** | — | Ephemeral abuse counters; stay DO-local during Phase 1 (they must survive DO restarts → they already do, in DO SQLite) |

## B. Storage objects (DO pilot storage)

- 2 objects total, both `image/png`, both owned by test client VIC-100002 (70-byte stubs):
  - `doc_6f79abbe5e09e753c0` → key `c96005c67783a5fc4eb171e588a98ee9`, status uploaded
  - `doc_23b5add4a5c7391ed4` → key `1e785ee6c5c7e56aec9c7808d8bf10cc`, status accepted
- Target bucket: `victora-client-documents` (private), path
  `clients/<VIC-ID>/documents/<document-uuid>/<sanitized-filename>` — current hashed keys
  contain no PII, but must be re-keyed to the mandated path scheme; old keys retained in
  `documents.legacy_storage_key` for rollback.
- Migration statuses: pending → copied → verified (checksum) → cutover. Only `verified`
  objects switch reads to Supabase. 2/2 expected verified.

## C. Backend endpoints (route handlers)

121 handler branches under `/api/*` in `victora-db.ts` handle() dispatch. Groups:
auth (register, register/staff, login, logout, me, forgot, reset), public (leads,
appointments, legal), client `/me/*` (overview, intake, notifications, documents,
upload, authorizations, quotes, view, interest, messages, tickets, referrals, policies,
renewals), staff (clients, agents, quotes, documents, authorizations, tasks,
appointments, conversations, tickets, renewals, policies, referrals, compliance,
complaints, commissions, marketing, legal, backups, checklist, analytics, system/health,
system/backup, test-flag admin). No route changes in Phase 1 — persistence layer swaps
behind the same handlers.

## D. Automations

All automations are **lazy, in-request, deduped** (`addTaskOnce` / delivery dedupe):
stale-quote follow-up tasks, client reminder sweeps, appointment reminders (48h window).
No cron/alarms exist. They port unchanged; they will run against Supabase reads.
Verification point: task dedupe must hold under PG (unique constraint on ref_type+ref_id+kind).

## E. Auth / session / audit during Phase 1

- Auth stays Victora (sessions in DO) per decision — Supabase Auth = Phase 2, report only.
- `users.password_hash`/`salt` migrate so the same credentials work against PG users.
- `audit_logs` MUST be pulled live (backup export excludes it) and migrated — compliance record.
- RLS: deny-by-default for `anon`; app access remains server-mediated (service key server-side
  only, never in browser). RLS designed so `auth.uid()` can slot in during Phase 2 — no fake users.

## F. Test data flags (migrated verbatim)

- users: 11/12 `is_test=1` (only founder real). junk3 inactive.
- client_profiles: 8/8 `is_test=1` (VIC-100001..100008 — entire pilot cohort is flagged).
- leads: 3/3 `is_test=1`.
- Excluded from analytics/exports/checklist by default — behavior must be identical post-migration.

## G. ID sequences (preserve — no renumbering)

- `meta.vic_counter = 100008` → next client is VIC-100009.
- `meta.svc_counter = 10002` → next ticket VIC-SVC-10003.
- All `usr_`, `doc_`, `pol_`, `qp_`, etc. prefixed IDs are TEXT PKs — copied verbatim.

## H. Money / timestamp / type translation rules

- REAL/TEXT money (`expected_amount`, `received_amount`, quote `premium`/`deductible`,
  policy `monthly_premium`) → `numeric(12,2)` — never float.
- INTEGER epoch-ms → `timestamptz`. TEXT dates (`effective_date`, `renewal_date`,
  `due_date`) stay DATE/TEXT per usage (validate on load).
- TEXT JSON payloads (`intakes.payload`) → JSONB.
- INTEGER booleans → `boolean`.

## I. Migration order (FK dependency order)

1. users, households, authorization_templates, communication_templates, legal_docs
2. client_profiles, meta(counters)
3. leads, intakes→coverage_needs, timeline, appointments, tasks, notifications, document_requests
4. documents (rows) + Storage objects (verify checksums)
5. authorizations, quote_presentations→quote_options→quote_interactions
6. conversations→conversation_participants→messages, internal_notes
7. service_tickets→ticket_comments, policies→policy_members→renewals, referrals
8. comm_prefs, notification_deliveries, welcome_items
9. agent_licenses, carrier_appointments, certifications, marketing_reviews
10. complaints→complaint_notes, commission_records→commission_adjustments
11. audit_logs (live pull), legal_acceptances, retention_policies, backup_log, password_resets

Idempotency: every insert is `INSERT ... ON CONFLICT (id) DO NOTHING`; re-runs produce
zero duplicates; final counts must match source counts exactly (orphan check = 0 unexpected).

## J′. Phase 1 authorizations that amend this map (2026-09-17)

1. **DO is an AUTH DEPENDENCY until Supabase Auth Phase 2.** `sessions` + current
   authentication remain in the DO; the DO must never be described as "retired" while
   production login depends on it. Architecture: auth/sessions → DO; business data →
   Supabase Postgres; documents → Supabase private Storage.
2. **No Resend this phase.** Credentials collection is Supabase-only; email integration
   happens after Supabase migration + validation.
3. **Legal "active" ≠ approved.** Migrated `legal_docs.active=1` rows (privacy_policy v2,
   terms_of_use v1, electronic_consent v3) preserve historical state only. Launch
   Readiness may NOT count them as legal approval — explicit approval evidence from the
   new legal workflow is required; all migrated text is PENDING LEGAL/COMPLIANCE REVIEW.
   `legal_acceptances` history is immutable.
4. Money display strings (quote option `premium`/`deductible`/`oop_max`, policy
   `monthly_premium` etc.) hold human-readable text in the source data; only true ledger
   amounts (commission REAL) become `numeric(12,2)`. Display strings stay TEXT.

## J. Open items found in Phase 0

- audit_logs / backup_log not in export API — need a dedicated compliant live read (super_admin).
- rate_limits + sessions intentionally NOT migrated (ephemeral; stay in DO during Phase 1).
- documents re-keying: legacy hashed keys don't match mandated path scheme (no PII in old keys — safe either way; migrate to new scheme).
