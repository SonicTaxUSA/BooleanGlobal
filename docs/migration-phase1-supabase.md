# Phase 1 — Supabase Foundation (VALIDATION MIGRATION — NOT CUTOVER)

Status: IN PROGRESS. Authorization received 2026-09-17 with explicit constraints
(see `docs/migration-phase0-inventory.md` for the accepted inventory).

## Governing constraints (from Phase 1 authorization)

1. **Supabase only.** No Resend collection/configuration this phase. Email comes after
   Supabase migration + validation. Secrets only via secure env mechanism — never in
   logs, reports, source, commits, browser bundles, or chat.
2. **Transitional architecture (auth dependency — DO NOT call the DO retired):**
   - Victora Auth / Sessions → **existing backend/DO** (authoritative until Supabase Auth Phase 2)
   - Victora business data → **Supabase Postgres**
   - Victora documents → **Supabase Private Storage**
   - `sessions` + `rate_limits` stay DO-local for this entire phase. The DO remains a
     production login dependency until Phase 2 replaces auth.
3. **Legal state:** migrated `legal_docs` rows preserve historical DB state verbatim.
   Existing `active` flags (privacy_policy v2, terms_of_use v1, electronic_consent v3)
   do **NOT** satisfy Launch Readiness legal approval. Launch Readiness must require an
   explicit approved/reviewed record from the new legal workflow. All migrated legal text
   is treated as **PENDING LEGAL/COMPLIANCE REVIEW** unless explicit approval evidence
   exists. Historical `legal_acceptances` are immutable and never rewritten.
4. **Schema first.** PostgreSQL translation validated (tables, PKs, FKs, indexes, unique
   + check constraints, numeric money, timestamptz, JSONB, is_test, VIC/SVC counters,
   audit architecture, automation dedupe) BEFORE any production record moves. SQLite
   implementation details are not blindly reproduced where PostgreSQL is safer.
5. **Deny-by-default.** RLS enabled on every table with zero policies (anon/authenticated
   see nothing); default privileges revoked from `anon`/`authenticated`. Privileged
   Supabase credential never reaches frontend source, `EXPO_PUBLIC_*`, `VITE_*`, browser
   JS, GitHub, logs, or API responses. Victora server authorization stays authoritative.
6. **First migration = validation migration.** DO remains authoritative; compare
   DO SOURCE vs SUPABASE DESTINATION (counts, IDs, relationships, timestamps, money,
   JSON, legal acceptance, audit history, test flags, counters, document metadata).
   Expected unexpected orphans: **0**. Every discrepancy reported.
7. **STOP before cutover.** Deliver the A–M report and wait for explicit approval.

## Storage contract

- Bucket `victora-client-documents`, **private**, ≤10 MB, PDF/JPEG/PNG/HEIC/HEIF/WebP only.
- Path: `clients/<VIC-ID>/documents/<document-uuid>/<sanitized-filename>`
- Adapters: `DurableObjectStorageAdapter` (legacy rollback source, never deleted) +
  `SupabaseStorageAdapter` (production). `documentStorage.put/get/delete/metadata`.
- Signed URLs only after server-side Victora auth + authorization; 120s expiry.
- The 2 existing test PNGs copy over and verify (bucket privacy, VIC ownership, path,
  MIME, byte length, checksum, authorized URL, cross-client denial, unassigned-agent
  denial, expiration). DO originals kept.

## Documents table additions (additive, DO untouched)

`storage_backend` ('do'|'supabase'), `storage_path`, `legacy_storage_key`, `checksum`,
`storage_status` ('pending'|'copied'|'verified'|'failed'|'cutover').

## Idempotency & tracking

All inserts `ON CONFLICT (id) DO NOTHING`; safe re-runs, zero duplicates. Per-table run
log records `source | destination | source_count | inserted | updated | skipped | failed |
destination_count`. Counters preserved: `vic_counter=100008` → next ID VIC-100009;
`svc_counter=10002` → next VIC-SVC-10003. All IDs and `is_test` flags verbatim.

## Migration order

1. users, households, authorization_templates, communication_templates, legal_docs
2. client_profiles, meta
3. leads, intakes→coverage_needs, timeline, appointments, tasks, notifications, document_requests
4. documents rows
5. authorizations, quote_presentations→quote_options→quote_interactions
6. conversations→conversation_participants→messages, internal_notes
7. service_tickets→ticket_comments, policies→policy_members→renewals, referrals
8. comm_prefs, notification_deliveries, welcome_items
9. agent_licenses, carrier_appointments, certifications, marketing_reviews
10. complaints→complaint_notes, commission_records→commission_adjustments
11. audit_logs (live pull — absent from backup export), legal_acceptances, retention_policies, backup_log, password_resets

## A–M Phase 1 report (to be filled at STOP)

- A. Supabase Connection — pending
- B. PostgreSQL Schema Created — pending
- C. Table Migration Results — pending
- D. Relationship / Orphan Validation — pending
- E. Audit Migration — pending
- F. Counter Validation — pending
- G. Test Data Validation — pending
- H. Supabase Storage — pending
- I. Document Security Tests — pending
- J. Legal-State Validation — pending
- K. Current Auth / DO Dependency — pending
- L. Discrepancies — pending
- M. Ready for Cutover? — pending (DO NOT CUT OVER regardless; explicit approval required)
