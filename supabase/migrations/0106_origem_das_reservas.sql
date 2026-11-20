-- =============================================================================
-- 0106 — De onde veio cada reserva feita pelo site.
--
-- Plano "Rota das Pousadas no Google" (20/11/2026): saber qual canal traz
-- reserva paga — busca do Google, perfil da pousada no Google, Instagram,
-- anúncio, WhatsApp — e não só quantas visitas cada um traz.
--
-- Como funciona:
--  * O navegador guarda a origem da última visita que veio de algum lugar
--    (link com UTM ou outro site), num cookie próprio do site, sem dado
--    pessoal (components/analytics/origin-capture.tsx).
--  * Ao criar a reserva, o servidor grava essa origem aqui, pela RPC
--    `record_booking_attribution`. Só o próprio viajante grava, só para a
--    reserva dele e só logo depois de criá-la; uma vez gravada, não muda.
--  * `channel` é calculado aqui, numa regra só (`booking_channel`), para o
--    painel e o /admin contarem igual.
--  * A pousada lê a origem das próprias reservas (RLS); o /admin lê o
--    resumo por canal (`list_platform_booking_channels`).
--
-- Fica independente do GA4: vale mesmo para quem recusa os cookies de medição.
-- =============================================================================

create table if not exists public.booking_attribution (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  pousada_id uuid not null references public.pousadas(id) on delete cascade,
  channel text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer_host text,
  landing_path text,
  click_id text check (click_id is null or click_id in ('gclid', 'fbclid')),
  first_seen_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.booking_attribution is
  '0106: origem da visita que gerou a reserva feita pelo site (UTM, site de origem, clique de anúncio). Gravada uma vez, pelo viajante.';

create index if not exists idx_booking_attribution_pousada on public.booking_attribution (pousada_id, created_at desc);

alter table public.booking_attribution enable row level security;
revoke all on public.booking_attribution from anon, authenticated;
grant select on public.booking_attribution to authenticated;

drop policy if exists "booking_attribution_read_staff" on public.booking_attribution;
create policy "booking_attribution_read_staff" on public.booking_attribution for select to authenticated
  using (auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));

-- Regra única do canal. Ordem importa: anúncio antes de busca, perfil antes de busca.
create or replace function public.booking_channel(
  p_source text,
  p_medium text,
  p_referrer_host text,
  p_click_id text
)
returns text
language sql
immutable
set search_path = public
as $$
  with v as (
    select lower(coalesce(trim(p_source), '')) as s,
           lower(coalesce(trim(p_medium), '')) as m,
           lower(coalesce(trim(p_referrer_host), '')) as r,
           lower(coalesce(trim(p_click_id), '')) as c
  )
  select case
    when c = 'gclid' or (s = 'google' and m in ('cpc', 'ppc', 'paid', 'ads', 'anuncio')) then 'google_ads'
    when s = 'google' and m in ('perfil', 'gbp', 'maps', 'business', 'perfil_google') then 'perfil_google'
    when s = 'google' or (s = '' and r ~ '(^|\.)google\.[a-z.]+$') then 'google'
    when s in ('instagram', 'ig') or (s = '' and r ~ '(^|\.)instagram\.com$') then 'instagram'
    when c = 'fbclid' or s in ('facebook', 'fb') or (s = '' and r ~ '(^|\.)(facebook\.com|fb\.com)$') then 'facebook'
    when s in ('whatsapp', 'wa') or (s = '' and r ~ '(^|\.)(whatsapp\.com|wa\.me)$') then 'whatsapp'
    when s = '' and r = '' then 'direto'
    else 'outro'
  end
  from v;
$$;

grant execute on function public.booking_channel(text, text, text, text) to authenticated, service_role;

create or replace function public.record_booking_attribution(
  p_booking_id uuid,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_referrer_host text default null,
  p_landing_path text default null,
  p_click_id text default null,
  p_first_seen_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_channel text;
  v_click text := nullif(lower(trim(coalesce(p_click_id, ''))), '');
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_booking from bookings where id = p_booking_id;
  if not found or v_booking.guest_id is distinct from auth.uid() then
    raise exception 'Reserva não encontrada.';
  end if;
  if v_booking.created_at < now() - interval '2 hours' then
    raise exception 'A origem só é gravada logo depois de a reserva ser criada.';
  end if;
  if v_click is not null and v_click not in ('gclid', 'fbclid') then v_click := null; end if;

  v_channel := booking_channel(p_utm_source, p_utm_medium, p_referrer_host, v_click);

  insert into booking_attribution (
    booking_id, pousada_id, channel, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer_host, landing_path, click_id, first_seen_at
  ) values (
    v_booking.id, v_booking.pousada_id, v_channel,
    left(nullif(trim(p_utm_source), ''), 100), left(nullif(trim(p_utm_medium), ''), 100),
    left(nullif(trim(p_utm_campaign), ''), 150), left(nullif(trim(p_utm_content), ''), 150),
    left(nullif(trim(p_utm_term), ''), 150), left(nullif(lower(trim(p_referrer_host)), ''), 150),
    left(nullif(trim(p_landing_path), ''), 300), v_click,
    case when p_first_seen_at > now() - interval '120 days' and p_first_seen_at <= now() + interval '5 minutes'
         then p_first_seen_at end
  )
  on conflict (booking_id) do nothing;

  select channel into v_channel from booking_attribution where booking_id = p_booking_id;
  return v_channel;
end;
$$;

revoke all on function public.record_booking_attribution(uuid, text, text, text, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.record_booking_attribution(uuid, text, text, text, text, text, text, text, text, timestamptz) to authenticated;

-- /admin: reservas feitas pelo site no mês, por canal. "Pagas" = pagamento
-- confirmado (contact_released_at, 0105). Reserva sem registro de origem
-- (anterior a 0106, ou origem não gravada) aparece como `sem_registro`.
create or replace function public.list_platform_booking_channels(p_month date default null)
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
  if not auth_is_platform_admin() then
    raise exception 'Relatório exclusivo da equipe da plataforma.';
  end if;

  v_month := coalesce(date_trunc('month', p_month)::date,
                      date_trunc('month', now() at time zone 'America/Sao_Paulo')::date);

  return jsonb_build_object(
    'month', v_month,
    'channels', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created desc, x.channel)
      from (
        select coalesce(a.channel, 'sem_registro') as channel,
               count(*) as created,
               count(*) filter (where b.contact_released_at is not null) as paid,
               coalesce(sum(b.total) filter (where b.contact_released_at is not null), 0) as "paidTotal"
        from bookings b
        left join booking_attribution a on a.booking_id = b.id
        where b.booked_by_traveler
          and date_trunc('month', b.created_at at time zone 'America/Sao_Paulo')::date = v_month
        group by 1
      ) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_platform_booking_channels(date) from public, anon;
grant execute on function public.list_platform_booking_channels(date) to authenticated;
