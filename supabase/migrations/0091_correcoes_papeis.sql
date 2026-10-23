-- 0091 — Correções de permissão achadas na simulação dos papéis da equipe
--
-- 1. `get_booking_consumption`, `expire_pending_booking` e
--    `revoke_platform_access` comparavam `<coluna> = auth.uid()` dentro de
--    `if not (...)`. Quando a coluna é nula (reserva de balcão não tem
--    hóspede com conta), a comparação vira NULL, `not (false or null)` é NULL,
--    e o `if` NÃO barra: qualquer usuário logado lia o consumo ou expirava a
--    reserva pendente vencida de outra pousada, sabendo o id. Agora a
--    comparação nula conta como "não".
-- 2. `get_payment_account_status`: o gestor (admin_pousada) não lia a conta
--    Mercado Pago conectada (a RLS da 0053 só libera o proprietário, de
--    propósito: a linha tem os tokens cifrados) e a tela dizia "conecte sua
--    conta" com a conta conectada. A função devolve só conectado/modo, sem
--    token, para quem gerencia a pousada.
--
-- Rollback: supabase/rollback/0091_rollback.sql

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
    -- 0091: reserva de balcão tem guest_id nulo; `null = auth.uid()` virava
    -- NULL e `not (false or null)` não barrava ninguém.
    or coalesce(v_current.guest_id = auth.uid(), false)
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
          -- 0091: sem hóspede vinculado (balcão) a comparação era NULL e liberava.
          or coalesce(v_guest = auth.uid(), false)) then
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
  if not (auth_is_platform_master() or coalesce(v_grant.granted_to = auth.uid(), false)) then
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


create or replace function public.get_payment_account_status(p_pousada_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_live boolean;
begin
  if auth.uid() is null
     or not (auth_can_manage_pousada(p_pousada_id) or auth_is_platform_master()) then
    raise exception 'Sem acesso a esta pousada.';
  end if;
  select live_mode into v_live from pousada_payment_accounts where pousada_id = p_pousada_id;
  return jsonb_build_object('connected', found, 'liveMode', coalesce(v_live, false));
end;
$$;
revoke all on function public.get_payment_account_status(uuid) from public, anon;
grant execute on function public.get_payment_account_status(uuid) to authenticated;
