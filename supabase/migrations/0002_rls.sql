-- =============================================================================
-- Rota das Pousadas — Row Level Security (RLS) e Policies
-- Segunda barreira de segurança (a primeira é o RBAC na aplicação).
-- Garante isolamento multi-tenant: dados de uma pousada nunca vazam para outra.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helpers de autorização (SECURITY DEFINER para consultar memberships/profiles)
-- ----------------------------------------------------------------------------
create or replace function auth_is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role is not null
  );
$$;

create or replace function auth_is_member_of(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.pousada_id = target_pousada
  );
$$;

create or replace function auth_can_manage_pousada(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada')
  );
$$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- ----------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table memberships         enable row level security;
alter table destinations        enable row level security;
alter table experiences         enable row level security;
alter table amenities           enable row level security;
alter table states              enable row level security;
alter table cities              enable row level security;
alter table pousadas            enable row level security;
alter table rooms               enable row level security;
alter table media               enable row level security;
alter table pousada_experiences enable row level security;
alter table pousada_amenities   enable row level security;
alter table availability        enable row level security;
alter table bookings            enable row level security;
alter table payments            enable row level security;
alter table reviews             enable row level security;
alter table favorites           enable row level security;
alter table audit_log           enable row level security;

-- ----------------------------------------------------------------------------
-- Catálogo de referência: leitura pública
-- ----------------------------------------------------------------------------
create policy "ref_read_states"       on states       for select using (true);
create policy "ref_read_cities"       on cities       for select using (true);
create policy "ref_read_destinations" on destinations for select using (true);
create policy "ref_read_experiences"  on experiences  for select using (true);
create policy "ref_read_amenities"    on amenities    for select using (true);

-- ----------------------------------------------------------------------------
-- Perfis: cada usuário lê/edita o próprio; plataforma vê tudo
-- ----------------------------------------------------------------------------
create policy "profiles_self_select" on profiles for select
  using (id = auth.uid() or auth_is_platform_admin());
create policy "profiles_self_update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Memberships: usuário vê os próprios; donos gerenciam a equipe da pousada
-- ----------------------------------------------------------------------------
create policy "memberships_read" on memberships for select
  using (user_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());
create policy "memberships_manage" on memberships for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- Pousadas: público lê publicadas; equipe/plataforma gerencia
-- ----------------------------------------------------------------------------
create policy "pousadas_public_read" on pousadas for select
  using (status = 'publicada' or auth_is_member_of(id) or auth_is_platform_admin());
create policy "pousadas_insert" on pousadas for insert
  with check (owner_id = auth.uid() or auth_is_platform_admin());
create policy "pousadas_update" on pousadas for update
  using (auth_can_manage_pousada(id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(id) or auth_is_platform_admin());
create policy "pousadas_delete" on pousadas for delete
  using (owner_id = auth.uid() or auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- Recursos filhos da pousada (rooms, media, junções, disponibilidade)
-- Leitura pública quando a pousada está publicada; escrita só pela equipe.
-- ----------------------------------------------------------------------------
create policy "rooms_read" on rooms for select
  using (exists (select 1 from pousadas p where p.id = rooms.pousada_id
                 and (p.status = 'publicada' or auth_is_member_of(p.id) or auth_is_platform_admin())));
create policy "rooms_write" on rooms for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

create policy "media_read" on media for select
  using (exists (select 1 from pousadas p where p.id = media.pousada_id
                 and (p.status = 'publicada' or auth_is_member_of(p.id) or auth_is_platform_admin())));
create policy "media_write" on media for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

create policy "availability_read" on availability for select
  using (exists (select 1 from rooms r join pousadas p on p.id = r.pousada_id
                 where r.id = availability.room_id
                 and (p.status = 'publicada' or auth_is_member_of(p.id) or auth_is_platform_admin())));
create policy "availability_write" on availability for all
  using (exists (select 1 from rooms r where r.id = availability.room_id
                 and (auth_can_manage_pousada(r.pousada_id) or auth_is_platform_admin())))
  with check (exists (select 1 from rooms r where r.id = availability.room_id
                 and (auth_can_manage_pousada(r.pousada_id) or auth_is_platform_admin())));

create policy "pousada_exp_read"  on pousada_experiences for select using (true);
create policy "pousada_exp_write" on pousada_experiences for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

create policy "pousada_amen_read"  on pousada_amenities for select using (true);
create policy "pousada_amen_write" on pousada_amenities for all
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- Reservas: hóspede vê as próprias; equipe da pousada vê as da sua pousada
-- ----------------------------------------------------------------------------
create policy "bookings_read" on bookings for select
  using (guest_id = auth.uid() or auth_is_member_of(pousada_id) or auth_is_platform_admin());
create policy "bookings_insert" on bookings for insert
  with check (guest_id = auth.uid());
create policy "bookings_update" on bookings for update
  using (guest_id = auth.uid() or auth_is_member_of(pousada_id) or auth_is_platform_admin())
  with check (guest_id = auth.uid() or auth_is_member_of(pousada_id) or auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- Pagamentos: acessíveis via reserva relacionada
-- ----------------------------------------------------------------------------
create policy "payments_read" on payments for select
  using (exists (select 1 from bookings b where b.id = payments.booking_id
                 and (b.guest_id = auth.uid() or auth_is_member_of(b.pousada_id) or auth_is_platform_admin())));

-- ----------------------------------------------------------------------------
-- Avaliações: leitura pública; autor cria/edita a própria; pousada responde
-- ----------------------------------------------------------------------------
create policy "reviews_public_read" on reviews for select using (true);
create policy "reviews_author_write" on reviews for insert
  with check (author_id = auth.uid());
create policy "reviews_update" on reviews for update
  using (author_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_is_platform_admin())
  with check (author_id = auth.uid() or auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

-- ----------------------------------------------------------------------------
-- Favoritos: cada usuário gerencia os próprios
-- ----------------------------------------------------------------------------
create policy "favorites_all" on favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Auditoria: só plataforma lê; escrita apenas server-side (service role)
-- ----------------------------------------------------------------------------
create policy "audit_read" on audit_log for select using (auth_is_platform_admin());
