-- =============================================================================
-- 0064 — `set_plan_preapproval_id`: o master liga o plano da Rota ao plano
-- criado no Mercado Pago Assinaturas.
--
-- A 0056 deixou `plans` sem policy de escrita de propósito ("toda escrita
-- passa pelas funções abaixo (security definer) ou pelo service_role do
-- webhook"), mas `setPlanPreapprovalId` gravava direto na tabela com a sessão
-- do master. A RLS filtrava o UPDATE para 0 linhas, sem erro: a tela dizia
-- "configurado", o id nunca era salvo, cada novo clique criava OUTRO plano no
-- Mercado Pago e nenhuma pousada conseguia assinar ("plano ainda não
-- configurado").
--
-- Gravação única: um plano já ligado não é religado a outro id (repetir o
-- mesmo id é inofensivo). Só master, igual ao app (`bootstrapPlatformPlan`).
-- =============================================================================

create or replace function set_plan_preapproval_id(p_plan_id uuid, p_mp_preapproval_plan_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and platform_role = 'master') then
    raise exception 'Somente master pode configurar o plano de assinatura da plataforma.';
  end if;
  if coalesce(trim(p_mp_preapproval_plan_id), '') = '' then
    raise exception 'Informe o id do plano no Mercado Pago.';
  end if;

  select mp_preapproval_plan_id into v_current from plans where id = p_plan_id for update;
  if not found then raise exception 'Plano não encontrado.'; end if;
  if v_current is not null then
    if v_current = p_mp_preapproval_plan_id then
      return jsonb_build_object('status', 'already_set');
    end if;
    raise exception 'Este plano já está ligado a outro plano do Mercado Pago (%).', v_current;
  end if;

  update plans set mp_preapproval_plan_id = p_mp_preapproval_plan_id where id = p_plan_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'plan.mp_preapproval_linked', 'plans', p_plan_id,
          jsonb_build_object('mpPreapprovalPlanId', p_mp_preapproval_plan_id));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function set_plan_preapproval_id(uuid, text) from public, anon;
grant execute on function set_plan_preapproval_id(uuid, text) to authenticated;
