-- =============================================================================
-- 0105 — Contato do hóspede liberado só depois do pagamento confirmado.
--
-- Modelo de 19/11/2026 (docs/04_BUSINESS_ARCHITECTURE.md §9): a Rota cobra 6%
-- da reserva que ela traz. O risco é a pousada pegar o contato do hóspede de
-- uma reserva ainda não paga e combinar o pagamento por fora. Decisão do
-- Gibson: a pousada continua aprovando o comprovante do Pix (o dinheiro cai na
-- conta dela), a Rota fiscaliza pelo /admin, e o contato só aparece depois que
-- o pagamento é confirmado.
--
-- (A) Reserva feita pelo próprio viajante no site (`booked_by_traveler`):
--     e-mail e telefone ficam ocultos para a equipe da pousada até a reserva
--     ser confirmada (Pix aprovado, cartão pago ou confirmação manual da
--     pousada). A liberação fica gravada em `contact_released_at` e não volta
--     atrás: reserva confirmada e depois cancelada continua liberada.
--
-- (B) Ficha do viajante (`guests` com origem `public_booking` ou
--     `platform_account`): o contato fica oculto até alguma reserva desse
--     viajante ser liberada. Ficha cadastrada pela própria pousada (balcão,
--     importação…) nunca é ocultada: a pousada já tinha o contato.
--
-- (C) Como é garantido no banco, não só na tela:
--     * `anon`/`authenticated` perdem SELECT nas colunas de contato
--       (`bookings.guest_email/guest_phone`, `guests.email/phone/whatsapp` e
--       as normalizadas). Consulta que peça essas colunas é recusada.
--     * O app lê o contato pelas RPCs `get_booking_guest_contacts` e
--       `get_guest_contacts`, que devolvem vazio enquanto não houver
--       liberação. Suporte da plataforma com concessão ativa na pousada vê
--       sempre; sem concessão, ninguém da plataforma lê contato por aqui.
--     * `booked_by_traveler` é calculado na criação, a partir de quem está
--       logado, e não muda depois. `contact_released_at` só é preenchido por
--       este gatilho. A equipe não consegue forjar nenhum dos dois por UPDATE.
--     * Ficha oculta: edição da equipe não altera e-mail, telefone, WhatsApp
--       nem a origem (senão bastaria trocar a origem para "balcão").
--
-- (D) Auditoria no /admin: `list_platform_pix_proofs` lista os comprovantes de
--     Pix de todas as pousadas, com sinal para reserva cancelada depois do
--     pagamento aprovado. O financeiro da plataforma passa a abrir a imagem
--     do comprovante (política do storage).
--
-- ATENÇÃO para migrations futuras: SELECT nessas duas tabelas agora é por
-- coluna. Coluna nova em `bookings` ou `guests` precisa de
-- `grant select (coluna) on ... to anon, authenticated;` — o teste
-- supabase/tests/contato-0105.sql falha se faltar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (A) Colunas e gatilho da reserva
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists booked_by_traveler boolean not null default false,
  add column if not exists contact_released_at timestamptz;

comment on column public.bookings.booked_by_traveler is
  '0105: reserva criada pelo próprio viajante logado, no site/link da bio. Calculado na criação; não muda.';
comment on column public.bookings.contact_released_at is
  '0105: quando o contato do hóspede foi liberado para a pousada (pagamento confirmado). Só o gatilho grava.';

-- Reservas existentes: mesma regra, sem esconder o que já estava visível.
update public.bookings
set booked_by_traveler = true
where origin in ('rota_das_pousadas', 'link_bio')
  and guest_id is not null
  and created_by = guest_id;

update public.bookings
set contact_released_at = coalesce(updated_at, created_at)
where booked_by_traveler
  and status not in ('pending', 'quote');

create or replace function public.bookings_guard_contact_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.booked_by_traveler := coalesce(
      new.origin in ('rota_das_pousadas', 'link_bio')
      and auth.uid() is not null
      and new.guest_id = auth.uid()
      and exists (
        select 1 from guests g
        where g.id = new.responsible_guest_id and g.user_id = auth.uid()
      ),
      false);
    new.contact_released_at := null;
  else
    new.booked_by_traveler := old.booked_by_traveler;
    new.contact_released_at := old.contact_released_at;
  end if;

  if new.booked_by_traveler
     and new.contact_released_at is null
     and new.status in ('confirmed', 'checked_in', 'checked_out', 'no_show') then
    new.contact_released_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.bookings_guard_contact_release() from public, anon, authenticated;

drop trigger if exists trg_bookings_contact_release on public.bookings;
create trigger trg_bookings_contact_release
  before insert or update on public.bookings
  for each row execute function public.bookings_guard_contact_release();

create index if not exists idx_bookings_responsible_released
  on public.bookings (responsible_guest_id)
  where contact_released_at is not null;

-- ---------------------------------------------------------------------------
-- (B) Regras de liberação
-- ---------------------------------------------------------------------------
create or replace function public.guest_contact_released(p_guest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select g.source not in ('public_booking', 'platform_account')
           or exists (
             select 1 from bookings b
             where b.responsible_guest_id = g.id and b.contact_released_at is not null
           )
    from guests g where g.id = p_guest_id
  ), true);
$$;

create or replace function public.booking_contact_released(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select b.contact_released_at is not null
           or (b.responsible_guest_id is null and not b.booked_by_traveler)
           or (b.responsible_guest_id is not null and guest_contact_released(b.responsible_guest_id))
    from bookings b where b.id = p_booking_id
  ), false);
$$;

revoke all on function public.guest_contact_released(uuid) from public, anon, authenticated;
revoke all on function public.booking_contact_released(uuid) from public, anon, authenticated;
grant execute on function public.guest_contact_released(uuid) to service_role;
grant execute on function public.booking_contact_released(uuid) to service_role;

-- Ficha oculta: a equipe não troca contato nem origem.
create or replace function public.guests_guard_hidden_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and old.user_id is distinct from auth.uid()
     and not auth_has_active_grant(old.pousada_id)
     and not guest_contact_released(old.id) then
    new.email := old.email;
    new.phone := old.phone;
    new.whatsapp := old.whatsapp;
    new.source := old.source;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.guests_guard_hidden_contact() from public, anon, authenticated;

drop trigger if exists trg_guests_hidden_contact on public.guests;
create trigger trg_guests_hidden_contact
  before update on public.guests
  for each row execute function public.guests_guard_hidden_contact();

-- ---------------------------------------------------------------------------
-- (C) SELECT por coluna: tudo menos o contato
-- ---------------------------------------------------------------------------
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'bookings'
    and column_name not in ('guest_email', 'guest_phone');
  execute 'revoke select on public.bookings from anon, authenticated';
  execute format('grant select (%s) on public.bookings to anon, authenticated', v_cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'guests'
    and column_name not in ('email', 'phone', 'whatsapp', 'email_normalized', 'phone_normalized');
  execute 'revoke select on public.guests from anon, authenticated';
  execute format('grant select (%s) on public.guests to anon, authenticated', v_cols);
end;
$$;

-- Contato das reservas, para a equipe da pousada. Sem liberação, vem vazio.
create or replace function public.get_booking_guest_contacts(p_booking_ids uuid[])
returns table (
  booking_id uuid,
  released boolean,
  email text,
  phone text,
  guest_phone text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  return query
    select x.id, x.ok,
           case when x.ok then x.guest_email end,
           case when x.ok then nullif(x.guest_phone, '') end,
           case when x.ok then coalesce(nullif(g.whatsapp, ''), nullif(g.phone, '')) end
    from (
      select b.id, b.guest_email, b.guest_phone, b.responsible_guest_id,
             (auth_has_active_grant(b.pousada_id) or booking_contact_released(b.id)) as ok
      from bookings b
      where b.id = any(coalesce(p_booking_ids, '{}'))
        and (auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
    ) x
    left join guests g on g.id = x.responsible_guest_id;
end;
$$;

revoke all on function public.get_booking_guest_contacts(uuid[]) from public, anon;
grant execute on function public.get_booking_guest_contacts(uuid[]) to authenticated, service_role;

-- Contato das fichas de hóspede. Mesmo escopo da leitura da ficha (guests_read).
create or replace function public.get_guest_contacts(p_guest_ids uuid[])
returns table (
  guest_id uuid,
  released boolean,
  email text,
  phone text,
  whatsapp text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  return query
    select x.id, x.ok,
           case when x.ok then x.email end,
           case when x.ok then x.phone end,
           case when x.ok then x.whatsapp end
    from (
      select g.id, g.email, g.phone, g.whatsapp,
             (auth_has_active_grant(g.pousada_id) or g.user_id = auth.uid()
              or guest_contact_released(g.id)) as ok
      from guests g
      where g.id = any(coalesce(p_guest_ids, '{}'))
        and (auth_has_guest_access(g.pousada_id) or auth_has_active_grant(g.pousada_id))
    ) x;
end;
$$;

revoke all on function public.get_guest_contacts(uuid[]) from public, anon;
grant execute on function public.get_guest_contacts(uuid[]) to authenticated, service_role;

-- Busca da lista de hóspedes por e-mail/telefone. Só encontra ficha liberada:
-- a busca não serve para confirmar o contato de quem ainda está oculto.
create or replace function public.search_guest_ids_by_contact(
  p_pousada_id uuid,
  p_email text default null,
  p_phone text default null
)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_platform boolean;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  v_platform := auth_has_active_grant(p_pousada_id);
  if not (v_platform or auth_has_guest_access(p_pousada_id)) then
    raise exception 'Você não tem permissão para ver os hóspedes desta pousada.';
  end if;
  if v_email is null and v_phone is null then return; end if;
  return query
    select g.id from guests g
    where g.pousada_id = p_pousada_id
      and (v_email is null or g.email_normalized like '%' || v_email || '%')
      and (v_phone is null
           or g.phone_normalized like '%' || v_phone || '%'
           or regexp_replace(coalesce(g.whatsapp, ''), '\D', '', 'g') like '%' || v_phone || '%')
      and (v_platform or guest_contact_released(g.id))
    limit 500;
end;
$$;

revoke all on function public.search_guest_ids_by_contact(uuid, text, text) from public, anon;
grant execute on function public.search_guest_ids_by_contact(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (D) Auditoria dos comprovantes de Pix no /admin
-- ---------------------------------------------------------------------------
create or replace function public.list_platform_pix_proofs(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month date;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not auth_can_manage_platform_finance() then
    raise exception 'O financeiro da plataforma é exclusivo de financeiro_plataforma/master.';
  end if;

  v_month := coalesce(
    date_trunc('month', p_month)::date,
    (select max(date_trunc('month', pp.created_at at time zone 'America/Sao_Paulo'))::date from payment_proofs pp),
    date_trunc('month', now() at time zone 'America/Sao_Paulo')::date);

  return jsonb_build_object(
    'month', v_month,
    'months', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.month desc) from (
        select date_trunc('month', pp.created_at at time zone 'America/Sao_Paulo')::date as month,
               count(*) as total,
               count(*) filter (where pp.status = 'submitted') as submitted,
               count(*) filter (where pp.status = 'approved') as approved,
               count(*) filter (where pp.status = 'rejected') as rejected,
               count(*) filter (where pp.status = 'approved' and b.status = 'cancelled') as "cancelledAfterApproval"
        from payment_proofs pp
        join bookings b on b.id = pp.booking_id
        group by 1 order by 1 desc limit 12) m), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(x) order by x."createdAt" desc) from (
        select pp.id as "proofId", pp.booking_id as "bookingId", b.code as "bookingCode",
               b.status as "bookingStatus", b.checkin, b.checkout, b.total as "bookingTotal",
               p.id as "pousadaId", p.name as "pousadaName",
               pp.amount, pp.approved_amount as "approvedAmount", pp.status,
               pp.created_at as "createdAt", pp.reviewed_at as "reviewedAt",
               pp.rejection_reason as "rejectionReason", pp.file_path as "filePath",
               pp.mime_type as "mimeType",
               (pp.status = 'approved' and b.status = 'cancelled') as "cancelledAfterApproval"
        from payment_proofs pp
        join bookings b on b.id = pp.booking_id
        join pousadas p on p.id = pp.pousada_id
        where date_trunc('month', pp.created_at at time zone 'America/Sao_Paulo')::date = v_month
        order by pp.created_at desc
        limit 500) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_platform_pix_proofs(date) from public, anon;
grant execute on function public.list_platform_pix_proofs(date) to authenticated;

-- O financeiro da plataforma abre a imagem do comprovante.
drop policy if exists "payment_proofs_read_own_or_staff" on storage.objects;
create policy "payment_proofs_read_own_or_staff" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      auth_is_booking_guest(payment_proof_booking_id(name))
      or exists (
        select 1 from bookings b
        where b.id = payment_proof_booking_id(name)
          and auth_has_operational_access(b.pousada_id)
      )
      or auth_can_manage_platform_finance()
    )
  );
