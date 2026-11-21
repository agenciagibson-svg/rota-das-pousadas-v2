-- Rollback da 0109 (fechamento automático da estadia). Volte o app para uma
-- versão anterior ao PR da 0109 antes: a versão nova chama close_overdue_stays.
drop function if exists public.close_overdue_stays();

-- set_booking_status volta à versão da 0048 (check-out sem a regra da conta em aberto).
create or replace function set_booking_status(
  p_booking_id uuid, p_new_status booking_status, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_is_staff boolean;
  v_allowed boolean;
  v_today date;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;

  -- [0048] era `auth_is_platform_admin()`; segue o padrão da 0047 (item B):
  -- equipe da plataforma só com concessão ativa e justificada.
  v_is_staff := auth_has_guest_access(v_current.pousada_id) or auth_has_active_grant(v_current.pousada_id);

  if not v_is_staff then
    if v_current.guest_id is distinct from auth.uid() then
      raise exception 'Você não tem permissão sobre esta reserva.';
    end if;
    if p_new_status <> 'cancelled' or v_current.status not in ('quote', 'pending') then
      raise exception 'Você só pode cancelar esta reserva enquanto ela não for confirmada.';
    end if;
  end if;

  v_allowed := (v_current.status, p_new_status) in (
    ('quote', 'pending'), ('quote', 'confirmed'), ('quote', 'cancelled'),
    ('pending', 'confirmed'), ('pending', 'cancelled'),
    ('confirmed', 'cancelled'), ('confirmed', 'no_show'),
    -- 0048: ciclo da estadia
    ('confirmed', 'checked_in'),
    ('checked_in', 'checked_out')
  );
  if not v_allowed then
    raise exception 'Transição de % para % não é permitida.', v_current.status, p_new_status;
  end if;
  if p_new_status in ('cancelled', 'no_show') and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'Descreva o motivo.';
  end if;

  -- Check-in só a partir da data de entrada, no fuso da pousada. Chegada
  -- antecipada de um dia vira ajuste da reserva (update_booking), não check-in
  -- fora de período — senão o quarto fica "em estadia" numa noite que outra
  -- reserva pode ocupar.
  if p_new_status = 'checked_in' then
    select (now() at time zone coalesce(nullif(p.timezone, ''), 'America/Sao_Paulo'))::date
      into v_today
      from pousadas p where p.id = v_current.pousada_id;
    if v_today < v_current.checkin then
      raise exception 'Check-in só pode ser feito a partir de %.', to_char(v_current.checkin, 'DD/MM/YYYY');
    end if;
  end if;

  update bookings set
    status = p_new_status,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now(),
    cancelled_by = case when p_new_status = 'cancelled' then auth.uid() else cancelled_by end,
    cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_new_status = 'cancelled' then p_reason else cancellation_reason end,
    no_show_by = case when p_new_status = 'no_show' then auth.uid() else no_show_by end,
    no_show_at = case when p_new_status = 'no_show' then now() else no_show_at end,
    no_show_reason = case when p_new_status = 'no_show' then p_reason else no_show_reason end,
    checked_in_by = case when p_new_status = 'checked_in' then auth.uid() else checked_in_by end,
    checked_in_at = case when p_new_status = 'checked_in' then now() else checked_in_at end,
    checked_out_by = case when p_new_status = 'checked_out' then auth.uid() else checked_out_by end,
    checked_out_at = case when p_new_status = 'checked_out' then now() else checked_out_at end
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(),
          case p_new_status
            when 'confirmed' then 'booking.confirmed'
            when 'cancelled' then 'booking.cancelled'
            when 'no_show' then 'booking.no_show'
            when 'checked_in' then 'booking.checked_in'
            when 'checked_out' then 'booking.checked_out'
            else 'booking.status_changed'
          end,
          'bookings', p_booking_id,
          jsonb_build_object('from', v_current.status, 'to', p_new_status, 'reason', p_reason));

  return jsonb_build_object('id', p_booking_id, 'status', p_new_status);
end;
$$;

comment on function set_booking_status(uuid, booking_status, text) is
  '0048: transições pré-check-in (0034) + confirmed→checked_in (a partir da data de entrada, fuso da pousada) e checked_in→checked_out. Só equipe; hóspede só cancela antes da confirmação.';

drop function if exists public.booking_open_consumption(uuid);
drop function if exists public.booking_auto_close_at(uuid, date);
drop index if exists public.idx_bookings_checked_in_checkout;
alter table public.bookings
  drop column if exists checkout_open_note,
  drop column if exists checked_out_auto;
