-- Rollback da 0059_quote_requests_consent_and_retention.sql

drop function if exists purge_stale_quote_requests(integer);

drop function if exists create_quote_request(
  uuid, text, text, text, date, date, integer, integer, boolean, text, text, boolean
);

create or replace function create_quote_request(
  p_pousada_id uuid, p_name text, p_phone text, p_email text default null,
  p_checkin date default null, p_checkout date default null,
  p_adults integer default 1, p_children integer default 0, p_pets boolean default false,
  p_occasion text default '', p_message text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone_digits text;
  v_id uuid;
begin
  if not exists (
    select 1 from pousadas p
    where p.id = p_pousada_id and p.status = 'publicada'
      and p.tenant_status in ('onboarding', 'active')
  ) then
    raise exception 'Pousada indisponível para orçamento.';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Informe seu nome.'; end if;
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone_digits) < 10 or length(v_phone_digits) > 13 then
    raise exception 'Informe um telefone válido com DDD.';
  end if;
  if p_checkin is not null and p_checkout is not null and p_checkout <= p_checkin then
    raise exception 'A saída deve ser posterior à entrada.';
  end if;
  if coalesce(p_adults, 1) < 1 or coalesce(p_adults, 1) > 100
     or coalesce(p_children, 0) < 0 or coalesce(p_children, 0) > 100 then
    raise exception 'Número de hóspedes inválido.';
  end if;

  if (select count(*) from quote_requests
      where pousada_id = p_pousada_id
        and regexp_replace(phone, '\D', '', 'g') = v_phone_digits
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Você já enviou pedidos recentes. A pousada vai responder em breve.';
  end if;

  insert into quote_requests (
    pousada_id, name, email, phone, checkin, checkout,
    adults, children, pets, occasion, message
  ) values (
    p_pousada_id,
    left(trim(p_name), 150),
    nullif(left(trim(coalesce(p_email, '')), 200), ''),
    left(trim(p_phone), 30),
    p_checkin, p_checkout,
    coalesce(p_adults, 1), coalesce(p_children, 0), coalesce(p_pets, false),
    left(trim(coalesce(p_occasion, '')), 80),
    left(trim(coalesce(p_message, '')), 2000)
  ) returning id into v_id;

  perform record_link_event(p_pousada_id, 'quote_request', p_checkin, p_checkout, null, null);

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;
revoke all on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text) from public;
grant execute on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text) to anon, authenticated;

alter table quote_requests drop column if exists consent;
