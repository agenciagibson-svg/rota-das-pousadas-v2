-- =============================================================================
-- 0081 — Segurança: autopromoção a platform_role (C-1) e escrita de catálogo
-- por qualquer papel de plataforma (A-1). Revisão de backend de 01/10/2026.
--
-- (A) C-1 — `profiles.platform_role` continuava gravável pelo próprio usuário.
--     A 0054 fez `revoke update (platform_role)` / `revoke insert
--     (platform_role)`, mas no Postgres revogar privilégio de COLUNA não tira
--     o privilégio de TABELA — e `authenticated`/`anon` têm UPDATE/INSERT na
--     tabela inteira pelos default privileges do Supabase. Com a anon key e o
--     próprio JWT, `PATCH /rest/v1/profiles?id=eq.<eu>` com
--     `{"platform_role":"master"}` passava pela policy `profiles_self_update`
--     (0002: só `id = auth.uid()`) e o usuário virava master.
--     Correção: revoga INSERT/UPDATE da TABELA e devolve só as colunas que o
--     app grava (`updateProfileName` em repositories/profiles.repository.ts
--     grava `full_name`; `avatar_url`/`updated_at` ficam por compatibilidade).
--     O cadastro cria a linha pelo gatilho `handle_new_user` (0003, security
--     definer) — o app não insere direto; o INSERT de colunas fica só para não
--     quebrar a policy `profiles_self_insert` (0003), sem `platform_role`.
--     Defesa em profundidade: gatilho `guard_profile_platform_role`.
--
-- (B) A-1 — Mesma classe de 0051 (que só cobriu `pousadas`): as policies de
--     ESCRITA de rooms, media, availability, pousada_experiences,
--     pousada_amenities e reviews (0002) e o upload no bucket `pousadas`
--     (0037) aceitavam `auth_is_platform_admin()` = QUALQUER platform_role.
--     Marketing/suporte/financeiro_plataforma conseguiam, pela API REST,
--     baixar `rooms.base_price` / `availability.price` de qualquer pousada
--     (e `create_booking` recalcula o preço dessas tabelas) ou reescrever
--     nota e texto de avaliações. Passam a exigir
--     `auth_can_manage_pousadas_platform()` (comercial + master — quem tem
--     `pousada:create`/`pousada:approve` em lib/auth/rbac.ts). LEITURA
--     continua com `auth_is_platform_admin()` (não muda nada aqui).
--
-- Aditivo/idempotente: só grants, policies recriadas com o MESMO nome, um
-- gatilho novo e `create or replace` de `guard_review_changes`.
-- Reversão: supabase/rollback/0081_rollback.sql (reabre os dois furos).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) profiles — privilégio de coluna de verdade
-- ----------------------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;
grant insert (id, full_name, avatar_url) on public.profiles to authenticated;

-- Gatilho de guarda. Diferente das guardas de pousadas/reviews, este é
-- SECURITY INVOKER de propósito: `current_user` precisa refletir quem chamou.
--   * PATCH/POST direto pela API REST  → current_user = authenticated/anon → bloqueia.
--   * set_platform_role_by_email (0054, security definer, master-only),
--     handle_new_user (0003), service_role, migrations → current_user é o
--     dono da função / service_role / postgres → passa.
-- Assim a RPC continua sendo o único caminho, sem precisar redefini-la.
create or replace function guard_profile_platform_role()
returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.platform_role is not null then
      raise exception 'Papel de plataforma só é definido pela equipe da Rota.';
    end if;
    if tg_op = 'UPDATE' and new.platform_role is distinct from old.platform_role then
      raise exception 'Papel de plataforma só é definido pela equipe da Rota.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function guard_profile_platform_role() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_platform_role on public.profiles;
create trigger trg_guard_profile_platform_role
  before insert or update on public.profiles
  for each row execute function guard_profile_platform_role();

comment on column public.profiles.platform_role is
  'Somente via RPC set_platform_role_by_email (0054, master-only). 0081: INSERT/UPDATE revogados no nível de TABELA (o revoke de coluna da 0054 não tinha efeito) + gatilho guard_profile_platform_role.';

-- ----------------------------------------------------------------------------
-- (B) Escrita de catálogo: comercial + master, não qualquer platform_role
-- ----------------------------------------------------------------------------
drop policy if exists "rooms_write" on rooms;
create policy "rooms_write" on rooms for all
  using (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform())
  with check (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform());

drop policy if exists "media_write" on media;
create policy "media_write" on media for all
  using (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform())
  with check (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform());

drop policy if exists "availability_write" on availability;
create policy "availability_write" on availability for all
  using (exists (select 1 from rooms r where r.id = availability.room_id
                 and (auth_can_manage_pousada(r.pousada_id) or auth_can_manage_pousadas_platform())))
  with check (exists (select 1 from rooms r where r.id = availability.room_id
                 and (auth_can_manage_pousada(r.pousada_id) or auth_can_manage_pousadas_platform())));

drop policy if exists "pousada_exp_write" on pousada_experiences;
create policy "pousada_exp_write" on pousada_experiences for all
  using (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform())
  with check (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform());

drop policy if exists "pousada_amen_write" on pousada_amenities;
create policy "pousada_amen_write" on pousada_amenities for all
  using (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform())
  with check (auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform());

drop policy if exists "reviews_update" on reviews;
create policy "reviews_update" on reviews for update
  using (author_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform())
  with check (author_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_can_manage_pousadas_platform());

-- Upload no bucket público de fotos pela equipe (cadastro pelo /admin, que já
-- exige `pousada:create` = comercial/master no app). O upload do dono segue
-- pela policy `pousadas_bucket_owner_insert` (0076).
drop policy if exists "pousadas_bucket_admin_write" on storage.objects;
create policy "pousadas_bucket_admin_write" on storage.objects for insert
  with check (bucket_id = 'pousadas' and auth_can_manage_pousadas_platform());

-- Guarda de avaliações (0066): o bypass de "equipe da Rota" também
-- passa a ser comercial + master. Corpo idêntico ao vigente, só o helper muda.
create or replace function guard_review_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth_can_manage_pousadas_platform() then
    return new;
  end if;

  if new.pousada_id is distinct from old.pousada_id or new.booking_id is distinct from old.booking_id
     or new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at then
    raise exception 'A avaliação não pode mudar de pousada, reserva, autor ou data.';
  end if;

  if old.author_id = auth.uid() then
    if new.response is distinct from old.response then
      raise exception 'Só a pousada responde à avaliação.';
    end if;
  elsif new.rating is distinct from old.rating or new.text is distinct from old.text then
    raise exception 'A pousada só pode responder à avaliação, não alterar a nota ou o comentário do hóspede.';
  end if;
  return new;
end;
$$;
