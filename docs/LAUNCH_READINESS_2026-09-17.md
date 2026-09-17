# Boolean Global launch verification — 2026-09-17

## Decision: NO-GO for full real-client intake
The current Floot app remains authoritative. No real client data was migrated. The existing Next.js scaffold must not overwrite Floot.

## Deployed fixes
- Enforce client-specific storage paths when confirming document uploads.
- Deny signing agreements marked as placeholders; show the legal-review hold in the portal.
- Remove support@booleanglobal.com: owner confirmed this is not a real mailbox.
- Record future self-service password rotations in audit_events, without passwords or hashes.
- Fix project identification in Supabase health checks; validate the Boolean target before connecting.
- Prefer securely configured BOOLEAN_SUPABASE_POOLER_URL with the existing direct connection as fallback.

Published successfully at https://booleanglobal.floot.app.
Floot checkpoints: 32ca1176-ec18-4b95-9971-0b0da688133a and d5e0a90f-2b98-4242-ac94-be29cc8aab22.
Source version for saved changed files: 1789641845194.
floot/current is a partial snapshot of changed files, not a standalone build or complete app export.

## Verified synthetic results (preview backend)
- Two client registrations: success; automatic client records created.
- Login: client, admin, agent, manager, read_only: success.
- Draft and submitted intake: success; submission without consent rejected.
- Synthetic SSN encrypted at rest; last four correct; ciphertext excluded from normal client response.
- A client supplying another client ID receives only their own record.
- Forged cross-client document storage path: 403.
- Private document upload/confirmation/download: successful byte-for-byte roundtrip.
- Agent document download: 403.
- Client admin lists and integration-health access: 403.
- Agent client details, SSN, documents and agreements: 403.
- Manager client/documents/agreements access: 200; SSN reveal: 403.
- Unassigned read_only client/SSN/documents/agreements access: 403.
- Draft agreement creation and disclosure acknowledgment: successful.
- Placeholder agreement signature: 403.
- Public synthetic lead capture: successful.
- Full project typecheck: clean.
- Temporary privileged QA accounts 44–48: roles removed, passwords removed, sessions revoked; verified zero remaining privileged roles/passwords/sessions in that fixture group.

## Connection and database findings
- Supabase project wihwngwvwhxywejrgaks is ACTIVE_HEALTHY.
- 30 public tables report RLS enabled and zero rows.
- Security advisor: zero findings. Performance advisor: 55 unused-index INFO notices, no structural warnings reported.
- Both Floot resource read and admin app endpoint failed DNS lookup of the original direct database hostname.
- A shared-pooler credential was subsequently connected securely; its runtime connection has NOT yet been tested.
- Schema parity is incomplete: Floot integer user IDs vs Supabase UUID profiles, role user vs client, ssn_encrypted vs ssn_ciphertext, document storage_filename vs storage_path.
- Supabase policies are not yet proven equivalent to Floot RBAC: current_role does not inspect profiles.active; staff insert policies are broader than client assignment/permission checks. Zero advisor findings do not establish business-authorization parity.
- No Supabase schema changes or real-data writes were performed during this pass.

## Remaining launch gates
1. Verify pooler connection from actual server runtime, including published deployment resource availability.
2. Implement and test identity/role/field adapters with synthetic-only records; prove RLS isolation and disabled-account behavior independently of Floot RBAC. Do not cut over or dual-write real records before parity passes.
3. Replace placeholder agreement/disclosure with owner/counsel-reviewed final text and implement/verify an actual cancellation process, authoritative deadline/timezone/holiday handling and document delivery. Do not treat existing text as attorney-approved or compliant.
4. Establish a real monitored support/cancellation contact. The removed mailbox does not exist.
5. Verify real administrator password rotation. Existing code had neither a rotation timestamp nor an audit event, so past rotation is unverified; the new audit event only covers future rotations.
6. Complete and review Privacy Policy/Terms and their placement in registration/intake. Neither page existed in the source inventory.
7. Finish published end-to-end regression, assigned specialist/read-only and disabled-staff/agent tests, and desktop/mobile browser journeys. A narrow published browser view and contact navigation were inspected; full browser form submission was interrupted and not verified.
8. Run security/performance checks following subsequent database changes.

## External blocker
Floot refused further build/test actions due to its daily allowance. It reported reset at 2026-09-18 00:00 UTC (September 17, 8 PM America/New_York).
The successful deployment preceded this refusal. A subsequent production synthetic test did not execute. Do not describe preview test results as published-regression results.
