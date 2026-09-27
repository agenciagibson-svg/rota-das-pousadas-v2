-- =============================================================================
-- 0073 — Cadastro completo do viajante ("Meu perfil").
--
-- Até aqui a conta só tinha o nome (profiles.full_name). A pousada precisa da
-- ficha de hospedagem (FNRH): documento, nascimento, nacionalidade, cidade/UF,
-- telefone. O viajante preenche UMA vez em /conta e, a cada reserva, a porta
-- pública `ensure_traveler_guest` copia esses dados para o cadastro de
-- hóspede DAQUELA pousada (guests) — só da pousada em que ele reservou.
--
-- Por que tabela própria e não colunas em `profiles`: `profiles` é lida por
-- outras RPCs (ex.: 0068 lista nomes de membros). Dados pessoais sensíveis
-- ficam isolados aqui, com RLS "só o dono" e nenhuma exceção para staff.
--
-- O documento chega JÁ CIFRADO pelo app (mesma chave e formato de
-- guests.document_number, 0058) + hash para busca + 4 últimos dígitos. O
-- banco nunca vê CPF/passaporte em claro; a cópia para guests é byte a byte.
-- =============================================================================

create table traveler_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  phone                text,
  whatsapp             text,
  birth_date           date,
  nationality          text,
  country              text not null default 'BR',
  document_type        text check (document_type in ('CPF', 'Passaporte')),
  document_number      text,
  document_number_hash text,
  document_last4       text,
  cep                  text,
  address              text,
  city                 text,
  state                text,
  emergency_contact    jsonb not null default '{}'::jsonb,
  dietary_restrictions text not null default '',
  accessibility_needs  text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (birth_date is null or birth_date between date '1900-01-01' and current_date)
);

alter table traveler_profiles enable row level security;

create policy "traveler_profiles_own_select" on traveler_profiles for select
  using (user_id = auth.uid());
create policy "traveler_profiles_own_insert" on traveler_profiles for insert
  with check (user_id = auth.uid());
create policy "traveler_profiles_own_update" on traveler_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Sem policy de delete: some junto com a conta (on delete cascade).

revoke all on traveler_profiles from anon;
grant select, insert, update on traveler_profiles to authenticated;

comment on table traveler_profiles is
  '0073: cadastro do viajante (FNRH). Só o dono lê/escreve. Copiado para guests da pousada na reserva (ensure_traveler_guest).';

-- ----------------------------------------------------------------------------
-- ensure_traveler_guest (0047) — mesma assinatura e mesmas travas; agora também
-- leva o cadastro do viajante para a ficha de hóspede da pousada. Só dados do
-- PRÓPRIO usuário (auth.uid()); campo vazio no perfil nunca apaga o que a
-- pousada já tinha na ficha.
-- ----------------------------------------------------------------------------
create or replace function ensure_traveler_guest(
  p_pousada_id uuid,
  p_full_name text,
  p_email text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text := left(trim(coalesce(p_full_name, '')), 150);
  v_email text := nullif(left(lower(trim(coalesce(p_email, ''))), 200), '');
  v_tp traveler_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Faça login para concluir a reserva.'; end if;
  if length(v_name) < 2 then raise exception 'Informe seu nome completo.'; end if;
  if not exists (
    select 1 from pousadas p
    where p.id = p_pousada_id and p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
  ) then
    raise exception 'Esta pousada não está disponível para reserva.';
  end if;

  select * into v_tp from traveler_profiles where user_id = auth.uid();

  -- Só o cadastro do próprio usuário nesta pousada. Nunca casa por e-mail.
  select id into v_id from guests
  where pousada_id = p_pousada_id and user_id = auth.uid()
  order by created_at limit 1;

  if v_id is null then
    insert into guests (
      pousada_id, user_id, full_name, email, phone, whatsapp,
      document_type, document_number, document_number_hash, document_last4,
      birth_date, nationality, country, city, state, address, cep,
      emergency_contact, dietary_restrictions, accessibility_needs,
      source, created_by
    ) values (
      p_pousada_id, auth.uid(), v_name, v_email, v_tp.phone, v_tp.whatsapp,
      v_tp.document_type, v_tp.document_number, v_tp.document_number_hash, v_tp.document_last4,
      v_tp.birth_date, v_tp.nationality, coalesce(v_tp.country, 'BR'), v_tp.city, v_tp.state,
      v_tp.address, v_tp.cep,
      coalesce(v_tp.emergency_contact, '{}'::jsonb),
      coalesce(v_tp.dietary_restrictions, ''), coalesce(v_tp.accessibility_needs, ''),
      'public_booking', auth.uid()
    ) returning id into v_id;

    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (auth.uid(), 'guest.created', 'guests', v_id,
            jsonb_build_object('pousadaId', p_pousada_id, 'source', 'public_booking'));
  else
    update guests
      set full_name            = v_name,
          email                = coalesce(v_email, email),
          phone                = coalesce(v_tp.phone, phone),
          whatsapp             = coalesce(v_tp.whatsapp, whatsapp),
          document_type        = coalesce(v_tp.document_type, document_type),
          document_number      = coalesce(v_tp.document_number, document_number),
          document_number_hash = coalesce(v_tp.document_number_hash, document_number_hash),
          document_last4       = coalesce(v_tp.document_last4, document_last4),
          birth_date           = coalesce(v_tp.birth_date, birth_date),
          nationality          = coalesce(v_tp.nationality, nationality),
          country              = coalesce(v_tp.country, country),
          city                 = coalesce(v_tp.city, city),
          state                = coalesce(v_tp.state, state),
          address              = coalesce(v_tp.address, address),
          cep                  = coalesce(v_tp.cep, cep),
          emergency_contact    = case when coalesce(v_tp.emergency_contact, '{}'::jsonb) <> '{}'::jsonb
                                      then v_tp.emergency_contact else emergency_contact end,
          dietary_restrictions = case when coalesce(v_tp.dietary_restrictions, '') <> ''
                                      then v_tp.dietary_restrictions else dietary_restrictions end,
          accessibility_needs  = case when coalesce(v_tp.accessibility_needs, '') <> ''
                                      then v_tp.accessibility_needs else accessibility_needs end,
          updated_at           = now()
      where id = v_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function ensure_traveler_guest(uuid, text, text) from public, anon;
grant execute on function ensure_traveler_guest(uuid, text, text) to authenticated;
