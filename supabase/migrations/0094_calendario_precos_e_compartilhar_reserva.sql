-- 0094 — Calendário com preço por dia (h6) e link da reserva para o acompanhante (h9)
--
-- 1. public_price_calendar(): para uma pousada PUBLICADA e um intervalo curto
--    (até 120 dias), devolve por noite: a menor diária entre as acomodações
--    livres ("a partir de"), se há alguma livre e a estadia mínima que vale
--    naquela noite. Não reimplementa nada:
--      - "livre" = bookable_rooms_core(slug, dia, dia + 1, hóspedes), o mesmo
--        núcleo da vitrine e da busca (reserva ativa, pendência dentro do prazo,
--        bloqueio e noite vendida no Airbnb/Booking seguram a acomodação);
--      - preço e mínimo = room_stay_quote(acomodação, dia, dia + 1), a mesma
--        cotação que create_booking cobra (0087).
--    Só devolve data, preço, livre/ocupado e mínimo: nada de reserva, hóspede
--    ou acomodação. Pousada não publicada (ou slug inexistente) = vazio.
--    Dias antes de hoje (fuso da pousada) saem como indisponíveis.
--
-- 2. booking_share_links: um link só de leitura por reserva, criado sob
--    demanda pelo dono da reserva. O token tem 244 bits aleatórios (dois
--    gen_random_uuid v4, sem pgcrypto) e fica só nesta tabela, que não tem
--    leitura nem escrita para anon/authenticated — tudo passa pelas RPCs:
--      - share_my_booking(reserva, renovar): devolve o link atual ou cria um;
--        com renovar = true troca o token (o link antigo para de funcionar);
--      - revoke_my_booking_share(reserva): apaga o link;
--      - get_shared_booking(token): anon; devolve SÓ pousada, endereço, datas,
--        horários de entrada/saída e código. Nunca valores, documento, e-mail,
--        telefone ou acompanhantes. Reserva cancelada (ou pendência vencida)
--        devolve só {"status": "cancelled"}. Conta excluída (0090 zera
--        bookings.guest_id) derruba o link.
--
-- Rollback: supabase/rollback/0094_rollback.sql

-- ---------------------------------------------------------------------------
-- 1. Calendário com preço
-- ---------------------------------------------------------------------------
-- Tamanho máximo da janela que `anon` pode pedir numa chamada (≈ 4 meses).
create or replace function public_calendar_max_days() returns integer
language sql immutable as $$ select 120 $$;

create or replace function public_price_calendar(
  p_slug text,
  p_from date,
  p_to date,
  p_guests integer default 1,
  p_room_id uuid default null
) returns table(night date, from_price integer, available boolean, min_nights integer)
-- `jit = off`: as funções de conjunto chamadas por dia têm estimativa padrão
-- de 1000 linhas, o custo estimado explode e o JIT gastava ~200 ms compilando
-- uma consulta que roda em ~15 ms.
language plpgsql stable security definer set search_path = public set jit = off as $$
declare
  v_pousada uuid;
  v_today date;
begin
  -- `p_to` é exclusivo (como bookings.checkout): de 01/11 a 01/12 = 30 noites.
  if p_slug is null or length(p_slug) > 200
     or p_from is null or p_to is null or p_to <= p_from
     or p_to - p_from > public_calendar_max_days()
     or p_guests is null or p_guests < 1 or p_guests > 100 then
    raise exception 'Período do calendário inválido.';
  end if;

  select p.id into v_pousada from pousadas p
  where p.slug = p_slug and p.status = 'publicada' and p.tenant_status in ('onboarding', 'active');
  if v_pousada is null then return; end if;

  v_today := pousada_local_date(v_pousada);
  -- Nada de varrer anos à frente nem o passado distante.
  if p_from < v_today - 45 or p_to > v_today + 731 then
    raise exception 'Período do calendário inválido.';
  end if;

  return query
  with days as (
    select g::date as d
    from generate_series(p_from::timestamp, (p_to - 1)::timestamp, interval '1 day') g
  ), offers as (
    select dd.d, q.total, q.min_nights as min_n
    from days dd
    cross join lateral bookable_rooms_core(p_slug, dd.d, dd.d + 1, p_guests) c
    cross join lateral room_stay_quote(c.id, dd.d, dd.d + 1) q
    where dd.d >= v_today
      and (p_room_id is null or c.id = p_room_id)
  )
  select dd.d,
         min(o.total)::integer,
         count(o.total) > 0,
         coalesce(min(o.min_n), 1)::integer
  from days dd
  left join offers o on o.d = dd.d
  group by dd.d
  order by dd.d;
end;
$$;
revoke all on function public_price_calendar(text, date, date, integer, uuid) from public;
grant execute on function public_price_calendar(text, date, date, integer, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Link da reserva para o acompanhante
-- ---------------------------------------------------------------------------
create table if not exists booking_share_links (
  booking_id uuid primary key references bookings(id) on delete cascade,
  token      text not null unique check (token ~ '^[A-Za-z0-9_-]{40,64}$'),
  created_at timestamptz not null default now()
);

alter table booking_share_links enable row level security;
-- Sem policy de propósito: só as RPCs SECURITY DEFINER abaixo tocam a tabela.
revoke all on booking_share_links from public, anon, authenticated;

-- 32 bytes de dois UUID v4 (244 bits aleatórios) em base64 de URL: 43 caracteres.
create or replace function new_booking_share_token() returns text
language sql volatile set search_path = public as $$
  select translate(rtrim(encode(decode(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    'hex'), 'base64'), '='), '+/', '-_');
$$;
revoke all on function new_booking_share_token() from public, anon, authenticated;

create or replace function share_my_booking(p_booking_id uuid, p_renew boolean default false)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_status booking_status;
  v_token text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  -- Mesmo dono de list_my_bookings: a reserva do próprio usuário logado.
  select b.status into v_status from bookings b
  where b.id = p_booking_id and b.guest_id = auth.uid();
  if v_status is null then raise exception 'Reserva não encontrada.'; end if;
  if v_status in ('cancelled', 'no_show') then
    raise exception 'Esta reserva foi cancelada.';
  end if;

  if not coalesce(p_renew, false) then
    select l.token into v_token from booking_share_links l where l.booking_id = p_booking_id;
    if v_token is not null then return v_token; end if;
  end if;

  v_token := new_booking_share_token();
  insert into booking_share_links (booking_id, token) values (p_booking_id, v_token)
  on conflict (booking_id) do update set token = excluded.token, created_at = now();

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), case when coalesce(p_renew, false) then 'booking.share_renewed'
                           else 'booking.share_created' end,
          'bookings', p_booking_id, '{}'::jsonb);
  return v_token;
end;
$$;
revoke all on function share_my_booking(uuid, boolean) from public, anon;
grant execute on function share_my_booking(uuid, boolean) to authenticated;

create or replace function revoke_my_booking_share(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not exists (select 1 from bookings b where b.id = p_booking_id and b.guest_id = auth.uid()) then
    raise exception 'Reserva não encontrada.';
  end if;
  delete from booking_share_links where booking_id = p_booking_id;
  if found then
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'booking.share_revoked', 'bookings', p_booking_id, '{}'::jsonb);
  end if;
end;
$$;
revoke all on function revoke_my_booking_share(uuid) from public, anon;
grant execute on function revoke_my_booking_share(uuid) to authenticated;

create or replace function get_shared_booking(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v record;
begin
  -- Formato inválido nem chega a consultar (e não diferencia de "não existe").
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,64}$' then return null; end if;

  select b.status, b.payment_due_at, b.code, b.checkin, b.checkout,
         p.name, p.address, p.cep, p.city, p.state, p.checkin_time, p.checkout_time
  into v
  from booking_share_links l
  join bookings b on b.id = l.booking_id
  join pousadas p on p.id = b.pousada_id
  where l.token = p_token and b.guest_id is not null;
  if not found then return null; end if;

  if v.status in ('cancelled', 'no_show')
     or (v.status = 'pending' and v.payment_due_at is not null and v.payment_due_at <= now()) then
    return jsonb_build_object('status', 'cancelled');
  end if;

  return jsonb_build_object(
    'status', case v.status when 'checked_out' then 'finished'
                            when 'confirmed' then 'confirmed'
                            when 'checked_in' then 'confirmed'
                            else 'pending' end,
    'code', v.code,
    'checkin', v.checkin,
    'checkout', v.checkout,
    'pousadaName', v.name,
    'address', coalesce(v.address, ''),
    'cep', coalesce(v.cep, ''),
    'city', coalesce(v.city, ''),
    'state', coalesce(v.state, ''),
    'checkinTime', coalesce(v.checkin_time, ''),
    'checkoutTime', coalesce(v.checkout_time, '')
  );
end;
$$;
revoke all on function get_shared_booking(text) from public;
grant execute on function get_shared_booking(text) to anon, authenticated;
