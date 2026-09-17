# Boolean Global — Current Architecture

Updated: 2026-09-17

## Source-of-truth rule

The current Floot application is the product implementation source of truth while the Supabase production backend is built and validated in parallel. The older Next.js/Supabase scaffold on `main` must not overwrite newer Floot functionality.

## Connected systems

- Floot project: `8879bc21-b7ba-4dce-8647-6cd57c27a090`
- GitHub repository: `SonicTaxUSA/BooleanGlobal`
- Integration branch: `integration/current-floot-supabase`
- Supabase project ref: `wihwngwvwhxywejrgaks`

## Current product capability

Boolean includes client intake, agreements/e-sign, documents, billing architecture, staff CRM/RBAC, tasks, communications, reporting, disputes, agent/referral network, commissions/payouts, credit-report ingestion/extraction, deterministic bureau comparison, and specialist credit-intelligence review.

## Integration policy

1. No real client data is migrated until the production schema, RLS, encryption/key management, retention/deletion, backup/recovery, monitoring, and legal launch blockers are validated.
2. AI extraction never writes directly into authoritative credit/dispute records. Human review remains required.
3. Referral agents never receive credit-report, dispute-basis, SSN, document, agreement, or internal specialist data merely because they referred a client.
4. Supabase RLS is defense in depth and must be tested independently from application RBAC.
5. Secrets never enter Git history. Supabase/Postgres credentials are connected through secure environment-variable flows only.
6. Database migrations are additive/rehearsed first; production cutover is a separate explicit decision.

## Current Supabase foundation

Applied migrations:
- `boolean_core_foundation`
- `harden_rls_helper_functions`
- `optimize_foundation_rls_and_indexes`

Security advisor currently reports zero findings after helper-function hardening. Remaining unused-index notices are expected on an empty database and should be reevaluated after realistic workload tests.

## Next integration work

- Complete Supabase mirror for the remaining Boolean domains.
- Connect Floot server-side to the Boolean Supabase Postgres resource without replacing the current Floot DB yet.
- Add migration adapters and synthetic dual-write/read-validation tests.
- Keep building product stages in Floot while infrastructure is validated.
- Promote this integration branch only after parity and security regression are complete.
