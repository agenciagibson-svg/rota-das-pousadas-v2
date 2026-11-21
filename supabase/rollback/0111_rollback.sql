-- Rollback da 0111 (ofertas para ex-hóspedes). Volte o app para uma versão
-- anterior ao PR da 0111 antes. Apaga ofertas, envios, autorizações e os
-- cupons de oferta (cupons comuns ficam). coupon_evaluate e
-- list_pousada_coupons voltam à versão da 0100.
drop trigger if exists trg_offer_delivery_booked on public.booking_coupon_redemptions;
drop function if exists public.trg_offer_delivery_booked();
drop function if exists public.get_pousada_offer_report(uuid);
drop function if exists public.mark_offer_opened(text);
drop function if exists public.my_active_offers();
drop function if exists public.mark_offer_email(uuid, boolean);
drop function if exists public.list_offer_emails_due(integer);
drop function if exists public.count_offer_audience(uuid);
drop function if exists public.send_pousada_offer(uuid, integer, integer, date, date, text);
drop function if exists public.create_offer_for_audience(uuid, text, integer, integer, date, date, text, uuid, uuid[]);
drop function if exists public.offer_audience(uuid);
drop function if exists public.offer_recipient_allowed(uuid, uuid);
drop function if exists public.my_offer_consents();
drop function if exists public.set_offer_consent(uuid, boolean);
drop table if exists public.offer_deliveries;
delete from public.pousada_coupons where guest_user_id is not null;
alter table public.pousada_coupons drop constraint if exists pousada_coupons_offer_fk;
drop table if exists public.pousada_offers;
drop table if exists public.offer_consents;
drop index if exists public.idx_pousada_coupons_guest;
alter table public.pousada_coupons
  drop column if exists offer_id,
  drop column if exists guest_user_id;

create or replace function coupon_evaluate(
  p_pousada_id uuid, p_code text, p_checkin date, p_checkout date,
  p_subtotal integer, p_user uuid, p_lock boolean
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_c pousada_coupons%rowtype;
  v_today date;
  v_used integer;
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    return jsonb_build_object('reason', 'invalid');
  end if;
  if p_lock then
    select * into v_c from pousada_coupons
    where pousada_id = p_pousada_id and code = v_code for update;
  else
    select * into v_c from pousada_coupons
    where pousada_id = p_pousada_id and code = v_code;
  end if;
  if v_c.id is null or not v_c.active then
    return jsonb_build_object('reason', 'invalid');
  end if;
  -- Com o cupom travado (criação da reserva): pendências vencidas que seguram
  -- este cupom expiram agora — mesmo UPDATE protegido da 0099 (se o pagamento
  -- chegou no meio-tempo, a reserva fica de fora) — e o gatilho devolve o uso.
  if p_lock then
    with expired as (
      update bookings b set status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
        cancelled_at = now(), version = b.version + 1
      where b.id in (select r.booking_id from booking_coupon_redemptions r
                     where r.coupon_id = v_c.id and r.released_at is null)
        and b.status = 'pending' and b.payment_due_at is not null and b.payment_due_at < now()
      returning b.id
    )
    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    select null, 'booking.expired', 'bookings', e.id, jsonb_build_object('reason', 'payment_due_at_passed')
    from expired e;
  end if;
  v_today := pousada_local_date(p_pousada_id);
  if (v_c.valid_from is not null and v_today < v_c.valid_from)
     or (v_c.valid_until is not null and v_today > v_c.valid_until) then
    return jsonb_build_object('reason', 'invalid');
  end if;
  if v_c.max_uses is not null then
    select count(*) into v_used from booking_coupon_redemptions
    where coupon_id = v_c.id and released_at is null and coupon_redemption_live(booking_id);
    if v_used >= v_c.max_uses then
      return jsonb_build_object('reason', 'invalid');
    end if;
  end if;
  if exists (
    select 1 from booking_coupon_redemptions
    where coupon_id = v_c.id and user_id = p_user and released_at is null
      and coupon_redemption_live(booking_id)
  ) then
    return jsonb_build_object('reason', 'already_used');
  end if;
  if v_c.min_nights is not null and p_checkout - p_checkin < v_c.min_nights then
    return jsonb_build_object('reason', 'min_nights', 'minNights', v_c.min_nights);
  end if;
  if (v_c.stay_from is not null and p_checkin < v_c.stay_from)
     or (v_c.stay_until is not null and p_checkout > v_c.stay_until) then
    return jsonb_build_object('reason', 'stay_period',
      'stayFrom', v_c.stay_from, 'stayUntil', v_c.stay_until);
  end if;
  if v_c.kind = 'fixed' and coalesce(p_subtotal, 0) <= v_c.value then
    return jsonb_build_object('reason', 'min_value', 'value', v_c.value);
  end if;
  return jsonb_build_object(
    'reason', 'ok',
    'couponId', v_c.id,
    'code', v_c.code,
    'kind', v_c.kind,
    'value', v_c.value,
    'discount', coupon_discount(v_c.kind, v_c.value, p_subtotal)
  );
end;
$$;
revoke all on function coupon_evaluate(uuid, text, date, date, integer, uuid, boolean) from public, anon, authenticated;

create or replace function list_pousada_coupons(p_pousada_id uuid)
returns table (
  id uuid, code text, kind text, value integer,
  valid_from date, valid_until date, stay_from date, stay_until date,
  min_nights integer, max_uses integer, active boolean, featured boolean,
  uses integer, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (auth_can_manage_pousada(p_pousada_id) or auth_has_active_grant(p_pousada_id)) then
    raise exception 'Você não tem permissão para ver os cupons desta pousada.';
  end if;
  return query
  select c.id, c.code, c.kind, c.value, c.valid_from, c.valid_until, c.stay_from, c.stay_until,
         c.min_nights::integer, c.max_uses, c.active, c.featured,
         (select count(*)::integer from booking_coupon_redemptions r
          where r.coupon_id = c.id and r.released_at is null and coupon_redemption_live(r.booking_id)),
         c.created_at
  from pousada_coupons c
  where c.pousada_id = p_pousada_id
  order by c.active desc, c.created_at desc;
end;
$$;
revoke all on function list_pousada_coupons(uuid) from public, anon;
grant execute on function list_pousada_coupons(uuid) to authenticated;
