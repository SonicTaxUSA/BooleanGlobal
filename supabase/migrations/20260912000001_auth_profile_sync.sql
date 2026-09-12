-- Syncs auth.users -> public.users (+ a matching public.clients row) on
-- signup, so every new account is immediately query-able through the app's
-- own tables without a separate onboarding step.

create function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  full_name text := new.raw_user_meta_data ->> 'full_name';
  name_parts text[];
begin
  insert into public.users (id, email, role, full_name)
  values (new.id, new.email, 'client', full_name);

  name_parts := regexp_split_to_array(coalesce(nullif(trim(full_name), ''), 'New Client'), '\s+');

  insert into public.clients (user_id, first_name, last_name, email, status)
  values (
    new.id,
    name_parts[1],
    case when array_length(name_parts, 1) > 1
      then array_to_string(name_parts[2:array_length(name_parts, 1)], ' ')
      else ''
    end,
    new.email,
    'active'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
