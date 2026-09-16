-- =============================================================================
-- 0049 — Resposta ao convite de equipe (aceitar / recusar).
--
-- `invite_membership` (0017) cria o vínculo com status `invited`. A RPC
-- `accept_membership_invite` já existia desde a 0016, mas NENHUM código da
-- aplicação a chamava e não havia tela — quem era convidado ficava preso na
-- tela "Convite pendente" para sempre. Esta migration:
--
--   accept_membership_invite(p_membership_id)  invited -> active   (accepted_at)
--     Substitui a versão da 0016 (retorno `void`, sem lock, sem auditoria):
--     mesma regra, mais `for update`, auditoria e retorno jsonb com a pousada.
--     Como o tipo de retorno muda, precisa de DROP + CREATE (Postgres não
--     permite `create or replace` trocando o retorno); os grants são refeitos
--     abaixo.
--   decline_membership_invite(p_membership_id) invited -> revoked   (nova)
--
-- Ambas do PRÓPRIO convidado (nunca de quem convidou — aceitar em nome de
-- outra pessoa reabriria o oráculo de convite que a 0017 fechou).
--
-- Recusar vira `revoked` (não apaga a linha): o índice parcial da 0014 permite
-- reconvidar depois, e a auditoria fica íntegra.
--
-- Trava a linha com `for update` antes de decidir — mesma disciplina da 0021:
-- dois cliques concorrentes (aceitar numa aba, recusar noutra) não podem
-- ambos "ver" o status `invited`.
--
-- Espelho na aplicação: features/membros/services/team.service.ts
-- (acceptInvite / declineInvite) e components/dashboard/tenant-gate.tsx.
-- Rollback em supabase/rollback/0049_rollback.sql.
-- =============================================================================

drop function if exists accept_membership_invite(uuid);

create function accept_membership_invite(p_membership_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_row from memberships where id = p_membership_id for update;

  -- Mesma mensagem para "não existe" e "não é seu": não confirmar a existência
  -- de vínculos alheios.
  if v_row.id is null or v_row.user_id <> auth.uid() then
    raise exception 'Convite não encontrado.';
  end if;
  if v_row.status <> 'invited' then
    raise exception 'Este convite não está mais pendente.';
  end if;

  update memberships
     set status = 'active', accepted_at = now(), updated_at = now()
   where id = p_membership_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'member.invite_accepted', 'memberships', p_membership_id,
          jsonb_build_object('pousadaId', v_row.pousada_id, 'role', v_row.role));

  return jsonb_build_object('status', 'ok', 'pousadaId', v_row.pousada_id);
end;
$$;

create or replace function decline_membership_invite(p_membership_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;

  select * into v_row from memberships where id = p_membership_id for update;

  if v_row.id is null or v_row.user_id <> auth.uid() then
    raise exception 'Convite não encontrado.';
  end if;
  if v_row.status <> 'invited' then
    raise exception 'Este convite não está mais pendente.';
  end if;

  update memberships
     set status = 'revoked', updated_at = now()
   where id = p_membership_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'member.invite_declined', 'memberships', p_membership_id,
          jsonb_build_object('pousadaId', v_row.pousada_id, 'role', v_row.role));

  return jsonb_build_object('status', 'ok', 'pousadaId', v_row.pousada_id);
end;
$$;

revoke execute on function accept_membership_invite(uuid) from public;
grant execute on function accept_membership_invite(uuid) to authenticated;
revoke execute on function decline_membership_invite(uuid) from public;
grant execute on function decline_membership_invite(uuid) to authenticated;

comment on function accept_membership_invite(uuid) is
  '0049: o próprio convidado aceita (invited -> active). Trava a linha; auditoria na mesma transação.';
comment on function decline_membership_invite(uuid) is
  '0049: o próprio convidado recusa (invited -> revoked; pode ser reconvidado depois).';
