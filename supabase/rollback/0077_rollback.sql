-- Rollback de 0077: volta a guarda de 0065 (sem gallery).
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
