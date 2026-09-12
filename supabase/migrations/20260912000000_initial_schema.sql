-- Boolean Global — initial schema
-- Credit repair & credit builder practice management: leads (public contact
-- form), clients, credit intake, and a CROA-oriented e-signature system.

create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'staff', 'client');
create type client_status as enum ('lead', 'active', 'inactive');
create type lead_status as enum ('new', 'contacted', 'converted', 'archived');
create type intake_status as enum ('draft', 'submitted');
create type signature_request_status as enum ('pending', 'signed', 'voided');
create type signature_audit_event as enum ('sent', 'viewed', 'signed', 'voided');

create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- users: app-side profile, one-to-one with auth.users
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role user_role not null default 'client',
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table users enable row level security;

create function public.current_user_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create policy "users_select_self_or_staff" on public.users
  for select using (id = auth.uid() or public.current_user_role() in ('admin', 'staff'));

create policy "users_update_self" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- clients: the enrolled/prospective people this business serves
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  service_tags text[] not null default '{}',
  status client_status not null default 'lead',
  assigned_staff_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on clients (user_id);

create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

alter table clients enable row level security;

create function public.current_client_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid();
$$;

create policy "clients_select" on public.clients
  for select using (
    public.current_user_role() in ('admin', 'staff') or user_id = auth.uid()
  );

create policy "clients_insert_staff" on public.clients
  for insert with check (public.current_user_role() in ('admin', 'staff'));

create policy "clients_update_staff" on public.clients
  for update using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));

-- leads: public contact-form submissions, inserted via the service role
-- (no logged-in user on that path), reviewed and converted into clients
-- by staff.
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text,
  status lead_status not null default 'new',
  converted_client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table leads enable row level security;

create policy "leads_select_staff" on public.leads
  for select using (public.current_user_role() in ('admin', 'staff'));

create policy "leads_update_staff" on public.leads
  for update using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
-- No insert policy: the public contact form writes via the service role,
-- which bypasses RLS entirely -- there's no authenticated visitor to check.

-- credit_intakes: one editable record per client, with a masked-by-default
-- sensitive tier (ssn) gated separately from general edit access.
create table credit_intakes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,

  date_of_birth date,
  employment_status text,
  monthly_income_cents integer,
  estimated_debt_cents integer,
  primary_goal text,
  known_negative_items text,
  authorized_credit_pull boolean not null default false,

  -- SENSITIVE — masked in the UI by default; see can_view_sensitive_data().
  ssn text,

  status intake_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger credit_intakes_set_updated_at before update on credit_intakes
  for each row execute function set_updated_at();

alter table credit_intakes enable row level security;

create function public.can_access_client(target_client_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.current_user_role() in ('admin', 'staff')
    or exists (
      select 1 from public.clients c
      where c.id = target_client_id and c.user_id = auth.uid()
    );
$$;

create policy "credit_intakes_select" on public.credit_intakes
  for select using (public.can_access_client(client_id));

create policy "credit_intakes_insert" on public.credit_intakes
  for insert with check (public.can_access_client(client_id));

create policy "credit_intakes_update" on public.credit_intakes
  for update using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

-- document_templates: firm-controlled contract bodies, e.g. the credit
-- repair & builder service agreement. {{placeholder}} tokens substituted
-- at send-time.
create table document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  body text not null,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger document_templates_set_updated_at before update on document_templates
  for each row execute function set_updated_at();

alter table document_templates enable row level security;

create policy "document_templates_select_staff" on public.document_templates
  for select using (public.current_user_role() in ('admin', 'staff'));

create policy "document_templates_write_admin" on public.document_templates
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

insert into document_templates (name, slug, body) values (
  'Credit Repair & Builder Service Agreement',
  'credit-repair-builder-agreement',
  E'CREDIT REPAIR & BUILDER SERVICE AGREEMENT\n\n[PLACEHOLDER BOILERPLATE — a Florida attorney must review this before it is sent to a real client.]\n\nDate: {{today_date}}\nClient: {{client_name}}\n\nThis agreement confirms the terms of the engagement between {{firm_name}} and {{client_name}}.\n\nScope of services: {{firm_name}} will review your credit report(s), identify inaccurate, unverifiable, or outdated items, and pursue disputes and other lawful credit-building strategies on your behalf.\n\nFees: Fees for repair services are billed only after the corresponding work has been performed — no fee for repair services is ever collected in advance. Any prior consultation/analysis fee is separate from, and not credited against, these fees.\n\nNo guaranteed results: {{firm_name}} cannot guarantee removal of accurate, timely, and verifiable negative information from your credit report.\n\nYour right to cancel: You may cancel this agreement without penalty or obligation at any time before midnight of the third business day after the date you signed it. To cancel, contact {{firm_name}} using the information provided at signing.\n\nBy signing below, you acknowledge that you have read this agreement and received the Consumer Credit File Rights Under State and Federal Law disclosure.'
);

-- signature_requests: the envelope. client_id denormalized directly so
-- can_access_client() covers it unmodified.
create table signature_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  template_id uuid references public.document_templates (id) on delete set null,
  requested_by uuid references public.users (id) on delete set null,
  title text not null,
  -- Frozen, substituted contract text as shown to the client at send time
  -- -- document_hash is sha256 of this exact string. PDF rendering/storage
  -- (storage_path, signed_storage_path) is a later enhancement; not needed
  -- to have a legally meaningful, tamper-evident audit trail today.
  rendered_body text not null,
  document_hash text not null,
  storage_path text,
  signed_storage_path text,
  status signature_request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index signature_requests_client_id_idx on signature_requests (client_id);

alter table signature_requests enable row level security;

create policy "signature_requests_select" on public.signature_requests
  for select using (public.can_access_client(client_id));

create policy "signature_requests_insert_staff" on public.signature_requests
  for insert with check (public.current_user_role() in ('admin', 'staff'));

create policy "signature_requests_void" on public.signature_requests
  for update
  using (public.current_user_role() in ('admin', 'staff') and status = 'pending')
  with check (status = 'voided');

-- signatures: locked leaf, 1:1 via unique FK. Only the client themself can
-- insert, and only mark_signature_request_signed() (security definer) can
-- flip the request to 'signed'.
create table signatures (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null unique references public.signature_requests (id) on delete restrict,
  signer_user_id uuid not null references public.users (id) on delete restrict,
  consent_given boolean not null,
  consent_text text not null,
  signature_type text not null check (signature_type in ('typed', 'drawn')),
  signature_text text,
  signature_image_path text,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  document_hash_at_signing text not null,
  check (consent_given = true)
);

alter table signatures enable row level security;

create policy "signatures_select" on public.signatures
  for select using (
    exists (
      select 1 from public.signature_requests sr
      where sr.id = signature_request_id and public.can_access_client(sr.client_id)
    )
  );

create policy "signatures_insert" on public.signatures
  for insert with check (
    signer_user_id = auth.uid()
    and exists (
      select 1 from public.signature_requests sr
      where sr.id = signature_request_id
      and sr.status = 'pending'
      and sr.client_id = public.current_client_id()
    )
  );
-- No update/delete policy — ever. Fully locked once created.

create function public.mark_signature_request_signed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.signature_requests set status = 'signed' where id = new.signature_request_id;
  insert into public.signature_audit_log (signature_request_id, event, actor_user_id, ip_address, user_agent)
  values (new.signature_request_id, 'signed', new.signer_user_id, new.ip_address, new.user_agent);
  return new;
end;
$$;

create trigger signatures_mark_request_signed
  after insert on signatures for each row execute function public.mark_signature_request_signed();

create table signature_audit_log (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null references public.signature_requests (id) on delete cascade,
  event signature_audit_event not null,
  actor_user_id uuid references public.users (id) on delete set null,
  ip_address text,
  user_agent text,
  occurred_at timestamptz not null default now()
);

alter table signature_audit_log enable row level security;

create policy "signature_audit_log_select_staff" on public.signature_audit_log
  for select using (public.current_user_role() in ('admin', 'staff'));

create function public.log_signature_request_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.signature_audit_log (signature_request_id, event, actor_user_id)
  values (new.id, 'sent', new.requested_by);
  return new;
end;
$$;

create trigger signature_requests_log_sent
  after insert on signature_requests for each row execute function public.log_signature_request_sent();

create function public.log_signature_request_voided()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.signature_audit_log (signature_request_id, event, actor_user_id)
  values (new.id, 'voided', auth.uid());
  return new;
end;
$$;

create trigger signature_requests_log_voided
  after update on signature_requests for each row
  when (old.status is distinct from new.status and new.status = 'voided')
  execute function public.log_signature_request_voided();

-- Sensitive-field view gate for credit_intakes.ssn — admin/staff or the
-- client viewing their own record only. Column-level, enforced in app code
-- since RLS filters rows, not columns.
create function public.can_view_sensitive_data(target_client_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_access_client(target_client_id);
$$;

-- Private bucket for frozen contract snapshots + signed artifacts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signed-documents', 'signed-documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "signed_documents_select" on storage.objects
  for select using (
    bucket_id = 'signed-documents'
    and public.can_access_client(((storage.foldername(name))[1])::uuid)
  );

create policy "signed_documents_insert" on storage.objects
  for insert with check (
    bucket_id = 'signed-documents'
    and public.can_access_client(((storage.foldername(name))[1])::uuid)
  );
