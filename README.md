# Boolean Global — Build. Grow. Achieve.

Credit repair & credit builder practice management: public marketing site, client portal, and admin
dashboard, built on Next.js (App Router, TypeScript) and Supabase.

## Stack

- Next.js (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres, Auth, Storage) · Vercel

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com/dashboard).
2. Copy `.env.local.example` to `.env.local` and fill in the URL/anon/service-role keys from Project
   Settings → API.
3. Link the CLI and push the schema:

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

4. Regenerate types after any schema change:

   ```bash
   supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/database.types.ts
   ```

5. Run the app:

   ```bash
   npm install
   npm run dev
   ```

## Project layout

- `src/app/(marketing)` — public site (home, services, about, contact/lead capture)
- `src/app/login`, `src/app/signup` — auth
- `src/app/portal` — client-facing app (intake, service agreement e-signature, status)
- `src/app/dashboard` — staff/admin app (leads, clients, client detail, agreement templates)
- `src/lib/supabase` — browser/server/service-role Supabase clients + the session-refresh middleware
- `supabase/migrations` — SQL schema migrations (source of truth for the database)

## Compliance

This business operates under the federal Credit Repair Organizations Act (CROA) and Florida's Credit
Service Organizations Act:

- No fee for repair services is ever collected before that work is performed.
- The FTC "Consumer Credit File Rights Under State and Federal Law" disclosure is shown to every client
  before they can submit intake.
- The service agreement discloses the 3-business-day right to cancel without penalty.
- **The agreement template in `document_templates` is placeholder boilerplate** — it must be reviewed by
  a Florida attorney before being sent to a real client. Edit it under Dashboard → Templates.

## Status

The Supabase project for this app has not been created yet (organization billing needs to be settled
first). The schema in `supabase/migrations/` is ready to push once that's unblocked; until then the app
will build but auth/data calls will fail without real Supabase credentials in `.env.local`.
