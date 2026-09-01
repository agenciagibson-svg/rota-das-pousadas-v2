-- =============================================================================
-- Ciclo 2 — reforço de isolamento: os helpers de RLS passam a considerar o
-- status do vínculo e o status operacional da pousada.
--
-- `create or replace function` atualiza o comportamento de TODAS as policies
-- que já usam `auth_is_member_of`/`auth_can_manage_pousada` (definidas em
-- 0002_rls.sql, 0006_expenses.sql, 0013_platform_access_grants.sql) sem
-- precisar reescrever cada policy — elas chamam a função em tempo de
-- avaliação, não uma cópia fixa da lógica antiga.
--
-- Efeito concreto:
--  - Um vínculo com status != 'active' (invited/suspended/revoked) deixa de
--    contar como membro para leitura (`auth_is_member_of`) — resolve
--    "usuário suspenso perde acesso imediatamente".
--  - `auth_can_manage_pousada` passa a exigir também que a pousada não esteja
--    com tenant_status 'suspended'/'inactive' — resolve "pousada suspensa não
--    pode utilizar a área de gestão" para operações de escrita.
--
-- [Revisão Ciclo 2B] Nunca aplicado a um banco real — correções abaixo feitas
-- IN PLACE (não em migration nova) para evitar embutir um estado inseguro
-- intermediário na história de migrations. Ver comentários "[Revisão Ciclo 2B]".
-- =============================================================================

create or replace function auth_is_member_of(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.status = 'active'
  );
$$;

create or replace function auth_can_manage_pousada(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join pousadas p on p.id = m.pousada_id
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role in ('proprietario', 'admin_pousada')
      and m.status = 'active'
      and p.tenant_status in ('onboarding', 'active')
  );
$$;

-- [Revisão Ciclo 2B] Avaliadas dentro de policies alcançáveis por `anon`
-- (ex.: pousadas_public_read, rooms_read) — precisam continuar executáveis
-- por `anon, authenticated`, senão navegação pública quebra. Só retornam
-- boolean, nunca dado — seguro expor.
revoke execute on function auth_is_member_of(uuid) from public;
grant execute on function auth_is_member_of(uuid) to anon, authenticated;
revoke execute on function auth_can_manage_pousada(uuid) from public;
grant execute on function auth_can_manage_pousada(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- [Revisão Ciclo 2B] Achado adicional (fora da lista original, mas do mesmo
-- tema): a policy "memberships_manage" (0002) usava `auth_can_manage_pousada`,
-- que aceita `proprietario` OU `admin_pousada`. Mas a matriz de permissões do
-- Ciclo 2 (lib/auth/rbac.ts) restringe convidar/trocar papel/suspender/
-- revogar membro a `proprietario` — só `member:view` é de admin_pousada. Sem
-- este ajuste, um admin_pousada podia contornar essa regra chamando a tabela
-- `memberships` direto pela API do Supabase (a barreira de app/RBAC não é a
-- única linha de defesa: a RLS é). Criado helper dedicado + policy exclusiva
-- de escrita para esta tabela.
-- ----------------------------------------------------------------------------
create or replace function auth_is_active_owner_of(target_pousada uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.pousada_id = target_pousada
      and m.role = 'proprietario'
      and m.status = 'active'
  );
$$;
revoke execute on function auth_is_active_owner_of(uuid) from public;
grant execute on function auth_is_active_owner_of(uuid) to anon, authenticated;

drop policy "memberships_manage" on memberships;
create policy "memberships_manage" on memberships for all
  using (auth_is_active_owner_of(pousada_id) or auth_is_platform_admin())
  with check (auth_is_active_owner_of(pousada_id) or auth_is_platform_admin());
-- "memberships_read" (0002) não muda: admin_pousada continua podendo LER a
-- equipe (bate com member:view na matriz); só a escrita ficou mais estrita.

-- ----------------------------------------------------------------------------
-- Aceite de convite: função dedicada (SECURITY DEFINER) em vez de policy de
-- update genérica — evita que o usuário convidado possa alterar outras
-- colunas da própria linha (papel, status de suspensão etc.) além de aceitar.
-- ----------------------------------------------------------------------------
create or replace function accept_membership_invite(p_membership_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_status membership_status;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select user_id, status into v_user_id, v_status
  from memberships where id = p_membership_id;

  if v_user_id is null then
    raise exception 'Convite não encontrado.';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'Este convite não pertence a este usuário.';
  end if;
  if v_status <> 'invited' then
    raise exception 'Este convite não está mais pendente.';
  end if;

  update memberships
  set status = 'active', accepted_at = now(), updated_at = now()
  where id = p_membership_id;
end;
$$;

-- [Revisão Ciclo 2B] RPC de negócio chamada pelo cliente autenticado — sem
-- caso de uso anônimo (a função já rejeita auth.uid() null por conta própria,
-- mas o grant também deixa isso explícito em vez de depender só do default
-- implícito do Postgres, que concede EXECUTE a PUBLIC — incluindo `anon` —
-- na criação de qualquer função).
revoke execute on function accept_membership_invite(uuid) from public;
grant execute on function accept_membership_invite(uuid) to authenticated;
