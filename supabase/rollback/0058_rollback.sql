-- Rollback da 0058_document_number_encryption.sql — restaura upsert_guest à
-- assinatura/comportamento da 0047 (documento em claro, sem hash/last4) e
-- remove as colunas novas. Não recupera document_number cifrado de volta
-- pra claro sozinho — se o backfill já rodou, os valores cifrados viram
-- ilegíveis pro app antigo; só use este rollback antes do backfill rodar,
-- ou aceitando perder a legibilidade dos documentos já cifrados.

drop function if exists upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text,
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
        or (p_document_number is not null and document_number = p_document_number)
      )
    order by created_at
    limit 1;
    v_action := case when v_id is null then 'guest.created' else 'guest.updated' end;
  end if;

  if v_id is null then
    insert into guests (
      pousada_id, user_id, full_name, preferred_name, email, phone, whatsapp,
      document_type, document_number, birth_date, nationality, country, city, state,
      address, cep, emergency_contact, preferences, dietary_restrictions, accessibility_needs,
      internal_notes, marketing_consent, source, created_by
    ) values (
      p_pousada_id, p_user_id, trim(p_full_name), p_preferred_name, p_email, p_phone, p_whatsapp,
      p_document_type, p_document_number, p_birth_date, p_nationality, p_country, p_city, p_state,
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
  uuid, uuid, uuid, text, text, text, text, text, text, text, date, text, text, text, text, text,
  jsonb, text[], text, text, text, boolean, guest_source, text
) from public;
grant execute on function upsert_guest(
  uuid, uuid, uuid, text, text, text, text, text, text, text, date, text, text, text, text, text,
  jsonb, text[], text, text, text, boolean, guest_source, text
) to authenticated;

drop index if exists idx_guests_document_hash;
create index idx_guests_document on guests(pousada_id, document_number) where document_number is not null;

alter table guests
  drop column if exists document_number_hash,
  drop column if exists document_last4;

drop function if exists apply_document_backfill(uuid, text, text, text);
drop function if exists list_guests_pending_document_backfill(integer);
