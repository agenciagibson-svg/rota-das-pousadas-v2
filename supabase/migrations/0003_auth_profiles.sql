-- =============================================================================
-- Auth — criação automática de profile no cadastro (Supabase Auth)
-- Cada usuário do auth.users ganha uma linha em public.profiles.
-- =============================================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Fallback: permite o próprio usuário criar seu profile (caso o trigger esteja
-- desabilitado no ambiente). A policy de select/update já existe em 0002_rls.sql.
drop policy if exists "profiles_self_insert" on profiles;
create policy "profiles_self_insert" on profiles for insert
  with check (id = auth.uid());
