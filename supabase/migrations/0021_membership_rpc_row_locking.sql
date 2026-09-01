-- =============================================================================
-- Ciclo 2C — correção de corrida (race condition) nas RPCs administrativas.
--
-- Achado ao endurecer os testes de concorrência: `update_member_role`,
-- `suspend_member` e `revoke_member` contavam "proprietários ativos restantes"
-- com um SELECT simples antes do UPDATE. Sob READ COMMITTED (padrão do
-- Postgres), duas chamadas concorrentes (ex.: duas abas do navegador)
-- poderiam CADA UMA ler "sobra 1 proprietário" antes de qualquer commit, e as
-- duas prosseguirem — deixando a pousada sem nenhum proprietário ativo apesar
-- da checagem individual ter "passado" nas duas.
--
-- Corrigido travando as linhas de proprietário ativo (`for update`) antes de
-- contar — a segunda transação concorrente bloqueia até a primeira commitar,
-- e ao destravar reavalia o WHERE contra o estado já commitado (a linha que
-- a primeira suspendeu não conta mais como ativa), então a segunda enxerga a
-- contagem correta e é bloqueada corretamente pela regra de negócio.
-- =============================================================================

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
    from (
      select 1 from memberships
      where pousada_id = p_pousada_id and role = 'proprietario' and status = 'active'
      for update
    ) locked_owners;
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
    from (
      select 1 from memberships
      where pousada_id = p_pousada_id and role = 'proprietario' and status = 'active'
      for update
    ) locked_owners;
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
    from (
      select 1 from memberships
      where pousada_id = p_pousada_id and role = 'proprietario' and status = 'active'
      for update
    ) locked_owners;
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

-- Grants preservados pelo `create or replace` (não precisam ser reconcedidos).
