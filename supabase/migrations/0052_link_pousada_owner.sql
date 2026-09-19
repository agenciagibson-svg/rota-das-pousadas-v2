-- =============================================================================
-- 0052 -- Vincular proprietario a pousada cadastrada pelo admin.
--
-- Achado da avaliacao de paineis de 15/09/2026 (bloqueador #2): `createPousadaAsAdmin`
-- (features/admin/services/admin.service.ts, insert direto em `pousadas`, sem
-- RPC) cria a pousada sem NENHUMA membership. Como so o proprietario ativo de
-- uma pousada pode convidar equipe (`invite_membership`, 0017) e o cadastro
-- pelo `/anunciar` ja cria a membership atomicamente (`create_pousada`, 0005),
-- uma pousada cadastrada pelo admin ficava orfa para sempre -- nao havia
-- NENHUM caminho, nem SQL manual documentado, para o dono de verdade assumir
-- o painel.
--
-- `link_pousada_owner(p_pousada_id, p_email)`:
--   - Autorizacao: `auth_can_manage_pousadas_platform()` (comercial/master --
--     mesmo helper da 0051, os unicos papeis de plataforma que hoje mutam
--     `pousadas`). Espelha a acao nova `pousada:link_owner` em
--     lib/auth/rbac.ts (comercial + master) -- as duas barreiras precisam
--     concordar.
--   - Exige que o e-mail ja tenha CONTA na plataforma (mesma resolucao por
--     e-mail de `invite_membership`, 0017). Diferente do convite de equipe,
--     aqui o erro e explicito, nao neutro: quem chama e sempre comercial ou
--     master (equipe interna, ja confiavel), nao e uma superficie publica
--     onde enumeracao de e-mail e um risco.
--   - Cria a membership ja `active` (nao `invited`): quem cadastrou ja
--     confirmou o e-mail do dono fora do sistema (ligacao, WhatsApp, contrato
--     do piloto) -- nao faz sentido reabrir um fluxo de convite para um
--     vinculo que a propria equipe comercial esta formalizando.
--   - Nao impede multiplos proprietarios na mesma pousada (socios) -- so o
--     indice parcial da 0014 impede duplicar o MESMO usuario na mesma
--     pousada.
--   - Auditoria (`pousada.owner_linked_by_admin`) na mesma transacao.
--
-- Aditivo -- nenhuma tabela/coluna/linha removida. Rollback:
-- supabase/rollback/0052_rollback.sql.
-- =============================================================================

create or replace function link_pousada_owner(p_pousada_id uuid, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Nao autenticado.';
  end if;

  if not auth_can_manage_pousadas_platform() then
    raise exception 'Voce nao tem permissao para vincular proprietario.';
  end if;

  if not exists (select 1 from pousadas where id = p_pousada_id) then
    raise exception 'Pousada nao encontrada.';
  end if;

  select p.id into v_target_user
  from profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(p_email)
  limit 1;

  if v_target_user is null then
    raise exception 'Nenhuma conta encontrada com este e-mail. O proprietario precisa criar conta em /entrar antes de ser vinculado.';
  end if;

  if exists (
    select 1 from memberships m
    where m.user_id = v_target_user
      and m.pousada_id = p_pousada_id
      and m.status <> 'revoked'
  ) then
    raise exception 'Este e-mail ja tem vinculo com esta pousada.';
  end if;

  insert into memberships (user_id, pousada_id, role, status, accepted_at, created_by)
  values (v_target_user, p_pousada_id, 'proprietario', 'active', now(), auth.uid());

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'pousada.owner_linked_by_admin', 'pousadas', p_pousada_id,
          jsonb_build_object('email', lower(p_email)));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke execute on function link_pousada_owner(uuid, text) from public;
revoke execute on function link_pousada_owner(uuid, text) from anon;
grant execute on function link_pousada_owner(uuid, text) to authenticated;

comment on function link_pousada_owner(uuid, text) is
  '0052: comercial/master vincula um e-mail ja cadastrado como proprietario ativo de uma pousada criada pelo admin (sem membership ate entao). Ver docs/features/onboarding-admin.md.';
