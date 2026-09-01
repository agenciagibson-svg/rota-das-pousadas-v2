-- =============================================================================
-- Ciclo 2C — fechamento de defesa em profundidade.
--
-- (A) `memberships`: remove a policy genérica de escrita (`memberships_manage`),
--     que hoje permite a um proprietário ativo — ou seja, a QUALQUER cliente
--     autenticado com esse papel — inserir/alterar/suspender/reativar/revogar
--     vínculos chamando a tabela direto pela API, contornando totalmente as
--     regras de negócio de `team.service.ts` (último proprietário, autopromoção
--     etc.). A partir desta migration, a única forma de mutar `memberships` é
--     por 4 RPCs `SECURITY DEFINER` que reimplementam essas regras dentro do
--     próprio Postgres — a aplicação e um cliente direto ficam sujeitos às
--     MESMAS regras, porque a regra passa a viver no banco, não só no app.
--
-- (B) `expenses`/`payments`/`bookings`: a leitura hoje é "qualquer membro ativo
--     da pousada", o que inclui Governança — que não tem nenhuma ação
--     financeira ou de reserva na matriz RBAC (lib/auth/rbac.ts). Corrigido
--     com dois helpers novos, cada um espelhando exatamente os papéis que já
--     têm a ação correspondente na matriz aprovada:
--       - auth_has_finance_access: proprietario, admin_pousada, financeiro_pousada
--         (só esses têm `finance:pousada:view` — usado em `expenses`, que é
--         contabilidade pura; recepcionista não tem ação de despesa alguma).
--       - auth_has_operational_access: os mesmos três + recepcionista (que tem
--         `checkin:perform`/`payment:register` — precisa ver reservas/pagamentos
--         para operar o balcão). Usado em `bookings`/`payments`.
--     Em ambos os casos o único papel efetivamente excluído é `governanca` —
--     não ampliamos nem reduzimos o acesso de mais ninguém.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A.1) Remove a policy genérica de escrita — só leitura permanece.
-- ----------------------------------------------------------------------------
drop policy if exists "memberships_manage" on memberships;
-- "memberships_read" (0002) permanece inalterada — é só leitura, já correta.

-- ----------------------------------------------------------------------------
-- (A.2) Helper interno reutilizado pelas 4 RPCs abaixo: resolve e valida o
-- vínculo alvo, garante que pertence à pousada informada, e confirma que o
-- chamador é proprietário ativo dessa pousada (ou admin de plataforma).
-- plpgsql interno, não exposto como RPC própria (sem grant a authenticated).
-- ----------------------------------------------------------------------------
create or replace function assert_can_manage_membership(p_pousada_id uuid, p_membership_id uuid)
returns table(target_user_id uuid, target_role user_role, target_status membership_status)
language plpgsql security definer set search_path = public as $$
declare
  v_pousada uuid;
  v_user uuid;
  v_role user_role;
  v_status membership_status;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select m.pousada_id, m.user_id, m.role, m.status
    into v_pousada, v_user, v_role, v_status
  from memberships m
  where m.id = p_membership_id;

  if v_pousada is null then
    raise exception 'Vínculo não encontrado.';
  end if;
  if v_pousada <> p_pousada_id then
    raise exception 'Vínculo não pertence à pousada informada.';
  end if;

  if not (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.pousada_id = p_pousada_id
        and m.role = 'proprietario'
        and m.status = 'active'
    )
    or auth_is_platform_admin()
  ) then
    raise exception 'Você não tem permissão para gerenciar membros nesta pousada.';
  end if;

  return query select v_user, v_role, v_status;
end;
$$;
revoke execute on function assert_can_manage_membership(uuid, uuid) from public;
revoke execute on function assert_can_manage_membership(uuid, uuid) from anon;
-- Sem grant a `authenticated`: só chamada internamente pelas RPCs abaixo
-- (que rodam como SECURITY DEFINER e por isso não precisam de EXECUTE próprio).

-- ----------------------------------------------------------------------------
-- (A.3) update_member_role — troca de papel.
-- ----------------------------------------------------------------------------
create or replace function update_member_role(p_pousada_id uuid, p_membership_id uuid, p_role user_role)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
  v_target_role user_role;
  v_target_status membership_status;
  v_active_owners integer;
begin
  select target_user_id, target_role, target_status
    into v_target_user, v_target_role, v_target_status
  from assert_can_manage_membership(p_pousada_id, p_membership_id);

  if v_target_status <> 'active' then
    raise exception 'Só é possível alterar o papel de um vínculo ativo.';
  end if;
  if v_target_user = auth.uid() then
    raise exception 'Você não pode alterar seu próprio papel.';
  end if;

  if v_target_role = 'proprietario' and p_role <> 'proprietario' then
    select count(*) into v_active_owners
    from memberships where pousada_id = p_pousada_id and role = 'proprietario' and status = 'active';
    if v_active_owners <= 1 then
      raise exception 'A pousada precisa de ao menos um proprietário ativo.';
    end if;
  end if;

  update memberships set role = p_role, updated_at = now() where id = p_membership_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'member.role_changed', 'memberships', p_membership_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'from', v_target_role, 'to', p_role));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function update_member_role(uuid, uuid, user_role) from public;
revoke execute on function update_member_role(uuid, uuid, user_role) from anon;
grant execute on function update_member_role(uuid, uuid, user_role) to authenticated;

-- ----------------------------------------------------------------------------
-- (A.4) suspend_member.
-- ----------------------------------------------------------------------------
create or replace function suspend_member(p_pousada_id uuid, p_membership_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
  v_target_role user_role;
  v_target_status membership_status;
  v_active_owners integer;
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Descreva o motivo da suspensão.';
  end if;

  select target_user_id, target_role, target_status
    into v_target_user, v_target_role, v_target_status
  from assert_can_manage_membership(p_pousada_id, p_membership_id);

  if v_target_status <> 'active' then
    raise exception 'Só é possível suspender um vínculo ativo.';
  end if;

  if v_target_role = 'proprietario' then
    select count(*) into v_active_owners
    from memberships where pousada_id = p_pousada_id and role = 'proprietario' and status = 'active';
    if v_active_owners <= 1 then
      raise exception 'A pousada precisa de ao menos um proprietário ativo.';
    end if;
  end if;

  update memberships
  set status = 'suspended', suspended_by = auth.uid(), suspended_reason = p_reason, updated_at = now()
  where id = p_membership_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'member.suspended', 'memberships', p_membership_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'reason', p_reason));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function suspend_member(uuid, uuid, text) from public;
revoke execute on function suspend_member(uuid, uuid, text) from anon;
grant execute on function suspend_member(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- (A.5) reactivate_member.
-- ----------------------------------------------------------------------------
create or replace function reactivate_member(p_pousada_id uuid, p_membership_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
  v_target_role user_role;
  v_target_status membership_status;
begin
  select target_user_id, target_role, target_status
    into v_target_user, v_target_role, v_target_status
  from assert_can_manage_membership(p_pousada_id, p_membership_id);

  if v_target_status <> 'suspended' then
    raise exception 'Só é possível reativar um vínculo suspenso.';
  end if;

  update memberships
  set status = 'active', suspended_by = null, suspended_reason = null, updated_at = now()
  where id = p_membership_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'member.reactivated', 'memberships', p_membership_id,
          jsonb_build_object('pousadaId', p_pousada_id));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function reactivate_member(uuid, uuid) from public;
revoke execute on function reactivate_member(uuid, uuid) from anon;
grant execute on function reactivate_member(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (A.6) revoke_member.
-- ----------------------------------------------------------------------------
create or replace function revoke_member(p_pousada_id uuid, p_membership_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
  v_target_role user_role;
  v_target_status membership_status;
  v_active_owners integer;
begin
  select target_user_id, target_role, target_status
    into v_target_user, v_target_role, v_target_status
  from assert_can_manage_membership(p_pousada_id, p_membership_id);

  if v_target_status = 'revoked' then
    raise exception 'Este vínculo já está revogado.';
  end if;

  if v_target_role = 'proprietario' and v_target_status = 'active' then
    select count(*) into v_active_owners
    from memberships where pousada_id = p_pousada_id and role = 'proprietario' and status = 'active';
    if v_active_owners <= 1 then
      raise exception 'A pousada precisa de ao menos um proprietário ativo.';
    end if;
  end if;

  update memberships set status = 'revoked', updated_at = now() where id = p_membership_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'member.revoked', 'memberships', p_membership_id,
          jsonb_build_object('pousadaId', p_pousada_id));

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function revoke_member(uuid, uuid) from public;
revoke execute on function revoke_member(uuid, uuid) from anon;
grant execute on function revoke_member(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- (B.1) Helpers de escopo financeiro/operacional — espelham a matriz RBAC.
-- ----------------------------------------------------------------------------
create or replace function auth_has_finance_access(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join pousadas p on p.id = m.pousada_id
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada', 'financeiro_pousada')
      and m.status = 'active'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;
revoke execute on function auth_has_finance_access(uuid) from public;
grant execute on function auth_has_finance_access(uuid) to anon, authenticated;

create or replace function auth_has_operational_access(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join pousadas p on p.id = m.pousada_id
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada', 'financeiro_pousada', 'recepcionista')
      and m.status = 'active'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;
revoke execute on function auth_has_operational_access(uuid) from public;
grant execute on function auth_has_operational_access(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- (B.2) expenses: só papéis com ação financeira na matriz.
-- ----------------------------------------------------------------------------
drop policy if exists "expenses_read" on expenses;
create policy "expenses_read" on expenses for select
  using (auth_has_finance_access(pousada_id) or auth_has_active_grant(pousada_id));
-- expenses_write já era proprietario/admin_pousada (auth_can_manage_pousada) —
-- já batia com a matriz (nenhuma ação de despesa para financeiro_pousada
-- hoje), não alterada.

-- ----------------------------------------------------------------------------
-- (B.3) payments: exclui governança (sem ação de pagamento/reserva na matriz),
-- mantém recepção (payment:register) e financeiro (finance:pousada:view).
-- ----------------------------------------------------------------------------
drop policy if exists "payments_read" on payments;
create policy "payments_read" on payments for select
  using (exists (
    select 1 from bookings b where b.id = payments.booking_id
      and (b.guest_id = auth.uid() or auth_has_operational_access(b.pousada_id) or auth_has_active_grant(b.pousada_id))
  ));

-- ----------------------------------------------------------------------------
-- (B.4) bookings: mesma exclusão de governança; recepção mantém acesso
-- (checkin:perform/checkout:perform exigem ver a reserva).
-- ----------------------------------------------------------------------------
drop policy if exists "bookings_read" on bookings;
create policy "bookings_read" on bookings for select
  using (guest_id = auth.uid() or auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));

drop policy if exists "bookings_update" on bookings;
create policy "bookings_update" on bookings for update
  using (guest_id = auth.uid() or auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id))
  with check (guest_id = auth.uid() or auth_has_operational_access(pousada_id) or auth_has_active_grant(pousada_id));
