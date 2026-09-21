-- =============================================================================
-- Criptografia do documento do hóspede (guests.document_number) — achado de
-- LGPD da auditoria de 14/09/2026, implementado em 21/09/2026: o CPF/RG/
-- passaporte ficava em texto puro no banco. A cifra em si acontece no app
-- (lib/crypto/document-cipher.ts), igual ao token de pagamento
-- (lib/crypto/token-cipher.ts) — esta migration só prepara o schema:
--
--   document_number       — deixa de guardar o documento em claro; passa a
--                            guardar o valor CIFRADO (formato
--                            "iv:authTag:ciphertext", igual ao token de
--                            pagamento). O nome da coluna não muda de
--                            propósito: zero mudança em types.ts, formulários
--                            e na ficha FNRH — só o repositório cifra/decifra
--                            na borda.
--   document_number_hash  — HMAC-SHA256 do documento normalizado (sem pontos/
--                            traço/espaço, maiúsculo), pra achar hóspede
--                            repetido sem decifrar linha por linha ("índice
--                            cego" — mesmo documento sempre produz o mesmo
--                            hash, mas o hash não permite voltar ao valor
--                            original).
--   document_last4        — últimos caracteres do documento normalizado, em
--                            claro, só pra mascarar na listagem
--                            ("•••• 1234") sem decifrar a linha inteira pra
--                            cada hóspede da lista.
--
-- A busca por documento na tela de hóspedes (era um ILIKE por trecho) deixa
-- de rodar no Postgres — o repositório agora decifra e filtra em memória
-- quando esse filtro é usado (volume por pousada é pequeno).
--
-- Fora do escopo desta migration, de propósito (decisão de 21/09/2026):
-- `booking_guests.document_number` (documento de acompanhante da reserva)
-- continua em texto puro — mesma categoria de dado, mas fechar isso também
-- nesta rodada dobraria o raio da mudança (RPC `set_booking_companions` e a
-- ficha FNRH de acompanhantes). Registrado como pendência.
--
-- Linhas já existentes ficam com document_number em claro até o backfill
-- (scripts/backfill-document-encryption.ts, rodado uma vez por Gibson) cifrar
-- e preencher hash/last4. Até lá, upsert_guest só afeta hóspedes tocados a
-- partir de agora — não quebra os já cadastrados, só não os re-indexa até o
-- backfill rodar.
-- =============================================================================

alter table guests
  add column if not exists document_number_hash text,
  add column if not exists document_last4 text;

drop index if exists idx_guests_document;
create index idx_guests_document_hash on guests(pousada_id, document_number_hash)
  where document_number_hash is not null;

drop function if exists upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, date, text, text, text, text, text,
  jsonb, text[], text, text, text, boolean, guest_source, text
);

create or replace function upsert_guest(
  p_pousada_id uuid,
  p_guest_id uuid default null,
  p_user_id uuid default null,
  p_full_name text default '',
  p_preferred_name text default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_document_type text default null,
  p_document_number text default null,
  p_document_number_hash text default null,
  p_document_last4 text default null,
  p_birth_date date default null,
  p_nationality text default null,
  p_country text default 'BR',
  p_city text default null,
  p_state text default null,
  p_address text default null,
  p_emergency_contact jsonb default '{}'::jsonb,
  p_preferences text[] default '{}',
  p_dietary_restrictions text default '',
  p_accessibility_needs text default '',
  p_internal_notes text default '',
  p_marketing_consent boolean default false,
  p_source guest_source default 'front_desk',
  p_cep text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email_norm text := nullif(lower(trim(p_email)), '');
  v_phone_norm text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_action text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_has_guest_access(p_pousada_id) or auth_has_active_grant(p_pousada_id)) then
    raise exception 'Você não tem permissão para gerenciar hóspedes nesta pousada.';
  end if;
  if length(trim(p_full_name)) = 0 then
    raise exception 'Informe o nome completo do hóspede.';
  end if;

  if p_guest_id is not null then
    if not exists (select 1 from guests where id = p_guest_id and pousada_id = p_pousada_id) then
      raise exception 'Hóspede não encontrado nesta pousada.';
    end if;
    v_id := p_guest_id;
    v_action := 'guest.updated';
  else
    select id into v_id from guests
    where pousada_id = p_pousada_id
      and (
        (v_email_norm is not null and email_normalized = v_email_norm)
        or (v_phone_norm is not null and phone_normalized = v_phone_norm)
        or (p_document_number_hash is not null and document_number_hash = p_document_number_hash)
      )
    order by created_at
    limit 1;
    v_action := case when v_id is null then 'guest.created' else 'guest.updated' end;
  end if;

  if v_id is null then
    insert into guests (
      pousada_id, user_id, full_name, preferred_name, email, phone, whatsapp,
      document_type, document_number, document_number_hash, document_last4, birth_date, nationality, country, city, state,
      address, cep, emergency_contact, preferences, dietary_restrictions, accessibility_needs,
      internal_notes, marketing_consent, source, created_by
    ) values (
      p_pousada_id, p_user_id, trim(p_full_name), p_preferred_name, p_email, p_phone, p_whatsapp,
      p_document_type, p_document_number, p_document_number_hash, p_document_last4, p_birth_date, p_nationality, p_country, p_city, p_state,
      p_address, p_cep, coalesce(p_emergency_contact, '{}'::jsonb), coalesce(p_preferences, '{}'),
      p_dietary_restrictions, p_accessibility_needs, p_internal_notes, p_marketing_consent, p_source, auth.uid()
    ) returning id into v_id;
  else
    update guests set
      user_id = coalesce(p_user_id, user_id),
      full_name = trim(p_full_name),
      preferred_name = p_preferred_name,
      email = p_email,
      phone = p_phone,
      whatsapp = p_whatsapp,
      document_type = p_document_type,
      document_number = p_document_number,
      document_number_hash = p_document_number_hash,
      document_last4 = p_document_last4,
      birth_date = p_birth_date,
      nationality = p_nationality,
      country = p_country,
      city = p_city,
      state = p_state,
      address = p_address,
      cep = p_cep,
      emergency_contact = coalesce(p_emergency_contact, '{}'::jsonb),
      preferences = coalesce(p_preferences, '{}'),
      dietary_restrictions = p_dietary_restrictions,
      accessibility_needs = p_accessibility_needs,
      internal_notes = p_internal_notes,
      marketing_consent = p_marketing_consent,
      updated_at = now()
    where id = v_id;
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), v_action, 'guests', v_id, jsonb_build_object('pousadaId', p_pousada_id));

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text,
  jsonb, text[], text, text, text, boolean, guest_source, text
) from public;
grant execute on function upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text,
  jsonb, text[], text, text, text, boolean, guest_source, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Backfill (0058) — as duas RPCs abaixo servem só o script de migração
-- única (scripts/backfill-document-encryption.mjs, rodado uma vez por
-- Gibson) e seguem a regra documentada em lib/supabase/service.ts: o cliente
-- service_role nunca lê/escreve tabela de negócio direto, só chama RPC
-- estreita concedida exclusivamente a service_role.
-- ----------------------------------------------------------------------------
create or replace function list_guests_pending_document_backfill(p_limit integer default 500)
returns table (id uuid, document_number text)
language sql stable security definer set search_path = public as $$
  select g.id, g.document_number
  from guests g
  where g.document_number is not null
    and length(trim(g.document_number)) > 0
    and g.document_number_hash is null
  order by g.created_at
  limit greatest(1, least(p_limit, 2000));
$$;
revoke all on function list_guests_pending_document_backfill(integer) from public, anon, authenticated;
grant execute on function list_guests_pending_document_backfill(integer) to service_role;

create or replace function apply_document_backfill(
  p_guest_id uuid,
  p_document_number_encrypted text,
  p_document_number_hash text,
  p_document_last4 text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- `and document_number_hash is null` torna o script seguro pra rodar mais
  -- de uma vez: uma linha já migrada não é sobrescrita de novo.
  update guests
  set document_number = p_document_number_encrypted,
      document_number_hash = p_document_number_hash,
      document_last4 = p_document_last4
  where id = p_guest_id
    and document_number_hash is null;
end;
$$;
revoke all on function apply_document_backfill(uuid, text, text, text) from public, anon, authenticated;
grant execute on function apply_document_backfill(uuid, text, text, text) to service_role;
