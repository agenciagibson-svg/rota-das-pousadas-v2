-- =============================================================================
-- Ciclo 2 — convite de membro por e-mail.
--
-- [Revisão Ciclo 2B] Versão original desta migration expunha uma função
-- `find_profile_id_by_email(text)` genérica, chamável por qualquer usuário
-- autenticado, sem escopo de pousada. Isso era um ORÁCULO DE ENUMERAÇÃO: um
-- usuário mal-intencionado com qualquer conta poderia testar e-mails em
-- massa e descobrir quais têm conta na plataforma. Também não validava
-- `member:invite` (proprietário) nem restringia a uma pousada específica.
--
-- Corrigido fundindo a resolução de e-mail com a própria criação do convite
-- numa única função `invite_membership()`:
--   - Autorização: exige vínculo `proprietario` ATIVO na pousada informada
--     (o único papel com member:invite na matriz — lib/auth/rbac.ts).
--   - Resposta NEUTRA: e-mail sem conta na plataforma retorna o mesmo
--     resultado de "processado" que um convite criado com sucesso — o
--     chamador nunca descobre se aquele e-mail tem conta ou não.
--   - Escopo: só enxerga/afeta a pousada informada, nunca vínculos de outra.
-- `find_profile_id_by_email` como função pública standalone foi REMOVIDA.
-- =============================================================================

drop function if exists find_profile_id_by_email(text);

create or replace function invite_membership(
  p_pousada_id uuid,
  p_email text,
  p_role user_role
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
  v_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  -- Só proprietário ativo desta pousada convida (member:invite na matriz).
  if not exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.pousada_id = p_pousada_id
      and m.role = 'proprietario'
      and m.status = 'active'
  ) then
    raise exception 'Você não tem permissão para convidar membros nesta pousada.';
  end if;

  select p.id into v_target_user
  from profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(p_email)
  limit 1;

  -- Resposta neutra: e-mail sem conta não gera erro nem se distingue de
  -- sucesso — impede enumerar contas da plataforma por tentativa e erro.
  if v_target_user is null then
    return jsonb_build_object('status', 'processed');
  end if;

  if exists (
    select 1 from memberships m
    where m.user_id = v_target_user
      and m.pousada_id = p_pousada_id
      and m.status <> 'revoked'
  ) then
    -- Informação restrita ao escopo desta pousada (o proprietário já
    -- enxerga a equipe dela) — não vaza nada sobre outras pousadas.
    raise exception 'Este e-mail já tem vínculo com esta pousada.';
  end if;

  insert into memberships (user_id, pousada_id, role, status, invited_at, created_by)
  values (v_target_user, p_pousada_id, p_role, 'invited', now(), auth.uid())
  returning id into v_membership_id;

  return jsonb_build_object('status', 'processed');
end;
$$;

revoke execute on function invite_membership(uuid, text, user_role) from public;
grant execute on function invite_membership(uuid, text, user_role) to authenticated;

-- ----------------------------------------------------------------------------
-- E-mail dos membros de uma pousada (para a tela de gestão de equipe).
-- A checagem `auth_can_manage_pousada` fica DENTRO do where: se o chamador
-- não tiver permissão, a condição é falsa para todas as linhas e o resultado
-- vem vazio — nunca vaza e-mail de outra pousada nem lança exceção.
-- (auth_can_manage_pousada aceita proprietario + admin_pousada, que é
-- exatamente quem tem member:view na matriz — compatível.)
-- ----------------------------------------------------------------------------
create or replace function list_membership_emails(p_pousada_id uuid)
returns table(user_id uuid, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.pousada_id = p_pousada_id
    and auth_can_manage_pousada(p_pousada_id);
$$;

-- [Revisão Ciclo 2B] RPC de negócio, sem caso de uso anônimo — explícito em
-- vez de depender do grant implícito a PUBLIC do Postgres.
revoke execute on function list_membership_emails(uuid) from public;
grant execute on function list_membership_emails(uuid) to authenticated;
