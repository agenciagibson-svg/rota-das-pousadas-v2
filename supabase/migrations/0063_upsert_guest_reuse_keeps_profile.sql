-- =============================================================================
-- 0063 — "Nova reserva" para hóspede já cadastrado não apaga mais a ficha dele.
--
-- `upsert_guest` (0058) chega ao UPDATE por dois caminhos:
--   * com `p_guest_id` — edição pelo perfil do hóspede. O formulário envia a
--     ficha inteira e pode esvaziar campos de propósito: continua gravando
--     exatamente o que veio.
--   * sem `p_guest_id`, reaproveitando o cadastro achado por e-mail, telefone
--     ou documento — o que a "Nova reserva" do balcão faz. Quem chama só
--     conhece nome e contato, e o UPDATE regravava TODAS as colunas: CPF,
--     nascimento, endereço, observações e preferências viravam nulo, o nome
--     era trocado pelo digitado e o consentimento de marketing virava `false`.
--
-- No reaproveitamento, agora nada é apagado: o nome e o que já estava
-- preenchido ficam; e-mail/telefone/WhatsApp informados e diferentes atualizam
-- a ficha (é o contato que o hóspede acabou de dar); o resto só preenche campo
-- vazio; o consentimento só pode ser concedido, nunca revogado por aqui.
--
-- Mesma assinatura da 0058: `create or replace` mantém grants e chamadas.
-- =============================================================================

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
  v_reused boolean := false;
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
    v_reused := v_id is not null;
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
  elsif v_reused then
    -- Reaproveitamento (sem p_guest_id): quem chama só conhece nome e contato.
    -- Nada é apagado — contato informado e diferente atualiza a ficha, o resto
    -- só preenche campo vazio e o consentimento nunca é revogado aqui.
    update guests set
      user_id = coalesce(user_id, p_user_id),
      preferred_name = coalesce(nullif(preferred_name, ''), p_preferred_name),
      email = case when v_email_norm is not null and v_email_norm is distinct from email_normalized
                   then trim(p_email) else email end,
      phone = case when v_phone_norm is not null and v_phone_norm is distinct from phone_normalized
                   then trim(p_phone) else phone end,
      whatsapp = coalesce(nullif(trim(p_whatsapp), ''), whatsapp),
      document_type = case when document_number is null then p_document_type else document_type end,
      document_number = coalesce(document_number, p_document_number),
      document_number_hash = case when document_number is null then p_document_number_hash else document_number_hash end,
      document_last4 = case when document_number is null then p_document_last4 else document_last4 end,
      birth_date = coalesce(birth_date, p_birth_date),
      nationality = coalesce(nullif(nationality, ''), p_nationality),
      country = coalesce(nullif(country, ''), p_country),
      city = coalesce(nullif(city, ''), p_city),
      state = coalesce(nullif(state, ''), p_state),
      address = coalesce(nullif(address, ''), p_address),
      cep = coalesce(nullif(cep, ''), p_cep),
      emergency_contact = case when emergency_contact = '{}'::jsonb
                               then coalesce(p_emergency_contact, '{}'::jsonb) else emergency_contact end,
      preferences = case when cardinality(preferences) = 0 then coalesce(p_preferences, '{}') else preferences end,
      dietary_restrictions = coalesce(nullif(dietary_restrictions, ''), p_dietary_restrictions, ''),
      accessibility_needs = coalesce(nullif(accessibility_needs, ''), p_accessibility_needs, ''),
      internal_notes = coalesce(nullif(internal_notes, ''), p_internal_notes, ''),
      marketing_consent = marketing_consent or coalesce(p_marketing_consent, false),
      updated_at = now()
    where id = v_id;
  else
    -- Edição pelo perfil (com p_guest_id): o formulário envia a ficha inteira
    -- e pode esvaziar campos de propósito — grava exatamente o que veio.
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

