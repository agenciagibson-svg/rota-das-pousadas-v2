-- Rollback da 0048 — restaura set_booking_status da 0034 (transições
-- pré-check-in apenas) e remove as colunas de rastreabilidade.
-- Reservas que já estiverem em checked_in/checked_out permanecem nesse status
-- (o enum booking_status já os tinha desde a 0032); só deixam de ter transição.

create or replace function set_booking_status(
  p_booking_id uuid, p_new_status booking_status, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_is_staff boolean;
  v_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;

  v_is_staff := auth_has_guest_access(v_current.pousada_id) or auth_is_platform_admin();

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
    ('confirmed', 'cancelled'), ('confirmed', 'no_show')
  );
  if not v_allowed then
    raise exception 'Transição de % para % não é permitida.', v_current.status, p_new_status;
  end if;
  if p_new_status in ('cancelled', 'no_show') and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'Descreva o motivo.';
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
    no_show_reason = case when p_new_status = 'no_show' then p_reason else no_show_reason end
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(),
          case p_new_status
            when 'confirmed' then 'booking.confirmed'
            when 'cancelled' then 'booking.cancelled'
            when 'no_show' then 'booking.no_show'
            else 'booking.status_changed'
          end,
          'bookings', p_booking_id,
          jsonb_build_object('from', v_current.status, 'to', p_new_status, 'reason', p_reason));

  return jsonb_build_object('id', p_booking_id, 'status', p_new_status);
end;
$$;

alter table bookings
  drop column if exists checked_in_at,
  drop column if exists checked_in_by,
  drop column if exists checked_out_at,
  drop column if exists checked_out_by;
