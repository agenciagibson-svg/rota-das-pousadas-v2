-- =============================================================================
-- 0065 — Dono não publica a própria pousada nem mexe em colunas de controle.
--
-- `pousadas_update` (0051) deixa proprietário/gestor atualizar a linha da
-- própria pousada, mas não restringe COLUNAS: com a sessão do painel e a chave
-- pública do Supabase, o dono conseguia chamar a API direto e trocar `status`
-- de `em_analise` para `publicada` (pulando a aprovação da plataforma), inflar
-- `rating`/`reviews`, mudar `owner_id`, `tenant_status`, `slug`, destino...
-- `pousadas_insert` também aceitava uma pousada nova já `publicada`.
--
-- Trigger em vez de privilégio por coluna: proprietário e equipe da Rota usam
-- o mesmo papel `authenticated`, então só uma regra por linha distingue os
-- dois. A lista é de colunas PERMITIDAS ao dono — as mesmas que as
-- Configurações gravam (`updatePousadaSettings` em management.repository.ts).
-- Coluna nova nasce protegida; liberar para o dono é decisão explícita aqui.
--
-- Livres: backend sem usuário (service_role: cron, webhooks) e equipe
-- comercial/master (`auth_can_manage_pousadas_platform`, a mesma da RLS).
-- =============================================================================

create or replace function guard_pousada_owner_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c_owner_editable constant text[] := array[
    'name', 'legal_name', 'tax_id', 'city', 'state', 'country', 'address', 'cep', 'image',
    'description', 'tags', 'timezone', 'currency', 'language', 'checkin_time', 'checkout_time',
    'contact_phone', 'whatsapp', 'notification_email', 'house_rules', 'cancellation_policy',
    'updated_at'
  ];
begin
  if auth.uid() is null or auth_can_manage_pousadas_platform() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Cadastro pelo dono (`create_pousada`): nasce em análise, sem nota
    -- inventada e fora da curadoria de destinos.
    if new.status not in ('rascunho', 'em_analise')
       or new.rating <> 0 or new.reviews <> 0 or new.destination_id is not null then
      raise exception 'Pousada nova começa em análise, sem avaliações; a publicação é feita pela equipe da Rota.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - c_owner_editable) is distinct from (to_jsonb(old) - c_owner_editable) then
    raise exception 'Só a equipe da Rota pode alterar publicação, situação da conta, dono ou avaliações da pousada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_pousada_owner_changes on pousadas;
create trigger trg_guard_pousada_owner_changes
  before insert or update on pousadas
  for each row execute function guard_pousada_owner_changes();
