-- Projeções públicas: apenas oferta comercial; reservas/bloqueios ficam privados.
create or replace function list_bookable_rooms(
  p_slug text, p_checkin date default null, p_checkout date default null,
  p_guests integer default 1
) returns table(id uuid, name text, description text, base_price integer, capacity integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_guests is null or p_guests < 1 or p_guests > 100
    or (p_checkin is null) <> (p_checkout is null)
    or p_checkout <= p_checkin then
    raise exception 'Filtros de disponibilidade inválidos.';
  end if;
  return query
  select r.id, r.name, r.description,
    coalesce(nullif(r.base_price, 0), p.price_per_night), coalesce(r.capacity_max, r.capacity)
  from rooms r join pousadas p on p.id = r.pousada_id
  left join accommodation_categories c on c.id = r.category_id
  where p.slug = p_slug and p.status = 'publicada'
    and p.tenant_status in ('onboarding', 'active')
    and r.status = 'active' and r.public_visible
    and (r.category_id is null or c.status = 'active')
    and r.operational_status not in ('maintenance', 'blocked')
    and coalesce(r.capacity_max, r.capacity) >= p_guests
    and (p_checkin is null or (
      not exists (select 1 from bookings b where b.room_id = r.id
        and b.status in ('pending', 'confirmed', 'checked_in')
        and b.checkin < p_checkout and b.checkout > p_checkin)
      and not exists (select 1 from room_blocks rb where rb.room_id = r.id
        and rb.status = 'active'
        and rb.starts_at < (p_checkout::timestamp at time zone 'UTC')
        and rb.ends_at > (p_checkin::timestamp at time zone 'UTC'))
    ))
  order by 4, r.id;
end;
$$;
revoke all on function list_bookable_rooms(text, date, date, integer) from public;
grant execute on function list_bookable_rooms(text, date, date, integer) to anon, authenticated;

create or replace function catalog_search_text(p_text text) returns text
language sql immutable strict set search_path = public as $$
  select translate(lower(trim(p_text)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

create or replace function search_public_pousadas(
  p_search text default '', p_page integer default 1, p_page_size integer default 24,
  p_checkin date default null, p_checkout date default null, p_guests integer default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb;
begin
  if p_page is null or p_page < 1 or p_page > 1000000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or (p_guests is not null and (p_guests < 1 or p_guests > 100))
    or (p_checkin is null) <> (p_checkout is null) or p_checkout <= p_checkin
    or length(coalesce(p_search, '')) > 200 then
    raise exception 'Filtros de busca inválidos.';
  end if;
  with matched as (
    select p.slug, p.name, p.city, p.state, p.image, p.rating, p.reviews,
      coalesce(offer.base_price, p.price_per_night) as price_per_night,
      p.tags, p.description, p.instagram
    from pousadas p
    left join lateral (
      select r.base_price from list_bookable_rooms(p.slug, p_checkin, p_checkout, coalesce(p_guests, 1)) r
      where p_checkin is not null or p_guests is not null limit 1
    ) offer on true
    where p.status = 'publicada' and p.tenant_status in ('onboarding', 'active')
      and strpos(catalog_search_text(concat_ws(' ', p.name, p.city, p.state, p.description, array_to_string(p.tags, ' '))),
        catalog_search_text(coalesce(p_search, ''))) > 0
      and (p_checkin is null and p_guests is null or offer.base_price is not null)
  ), paged as (
    select * from matched order by slug limit p_page_size offset (p_page - 1) * p_page_size
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(paged) order by slug) from paged), '[]'::jsonb),
    'total', (select count(*) from matched), 'page', p_page, 'pageSize', p_page_size,
    'totalPages', greatest(1, ceil((select count(*) from matched)::numeric / p_page_size))) into v_result;
  return v_result;
end;
$$;
revoke all on function search_public_pousadas(text, integer, integer, date, date, integer) from public;
grant execute on function search_public_pousadas(text, integer, integer, date, date, integer) to anon, authenticated;

create index if not exists idx_pousadas_public_slug on pousadas(slug)
  where status = 'publicada' and tenant_status in ('onboarding', 'active');
create index if not exists idx_blocks_active_room_period on room_blocks(room_id, starts_at, ends_at)
  where status = 'active';
