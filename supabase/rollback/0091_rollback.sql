-- Rollback da 0091 — volta as três funções à versão anterior (REABRE a falha descrita na 0091) e remove get_payment_account_status.
begin;
CREATE OR REPLACE FUNCTION public.expire_pending_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current record;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;
  if not (
    auth_has_guest_access(v_current.pousada_id) or auth_has_active_grant(v_current.pousada_id)
    or v_current.guest_id = auth.uid()
  ) then
    raise exception 'Você não tem permissão sobre esta reserva.';
  end if;
  if v_current.status <> 'pending' then
    raise exception 'Só é possível expirar uma reserva pendente.';
  end if;
  if v_current.payment_due_at is null or v_current.payment_due_at >= now() then
    raise exception 'O prazo de pagamento desta reserva ainda não venceu.';
  end if;

  update bookings set
    status = 'cancelled', cancellation_reason = 'Prazo de pagamento expirado',
    cancelled_at = now(), version = version + 1
  where id = p_booking_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'booking.expired', 'bookings', p_booking_id, jsonb_build_object('reason', 'payment_due_at_passed'));

  return jsonb_build_object('id', p_booking_id, 'status', 'cancelled');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_booking_consumption(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pousada uuid; v_guest uuid;
begin
  select pousada_id, guest_id into v_pousada, v_guest from bookings where id = p_booking_id;
  if v_pousada is null then raise exception 'Reserva não encontrada.'; end if;
  if not (auth_has_pousada_role(v_pousada, array['proprietario', 'admin_pousada', 'recepcionista', 'financeiro_pousada'])
          or v_guest = auth.uid()) then
    raise exception 'Sem acesso a esta conta.';
  end if;
  return booking_consumption_summary(p_booking_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.revoke_platform_access(p_grant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_grant platform_access_grants%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_grant from platform_access_grants where id = p_grant_id for update;
  if not found then raise exception 'Concessão não encontrada.'; end if;

  -- Master revoga qualquer uma; quem recebeu pode abrir mão da própria.
  if not (auth_is_platform_master() or v_grant.granted_to = auth.uid()) then
    raise exception 'Você não tem permissão para revogar esta concessão.';
  end if;
  if v_grant.revoked_at is not null then return; end if;

  update platform_access_grants set revoked_at = now() where id = p_grant_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'platform_access_grant.revoke', 'platform_access_grants', p_grant_id,
          jsonb_build_object('pousadaId', v_grant.pousada_id, 'grantedTo', v_grant.granted_to));
end;
$function$
;
drop function if exists public.get_payment_account_status(uuid);
commit;
