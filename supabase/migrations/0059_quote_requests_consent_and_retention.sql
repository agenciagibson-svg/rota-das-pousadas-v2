-- =============================================================================
-- LGPD em quote_requests (pedidos de orçamento da página da bio) — achado da
-- auditoria de 14/09/2026, implementado em 21/09/2026: o formulário público
-- não tinha checkbox de consentimento nem prazo de retenção pro pedido que
-- nunca virou reserva. Decisão com Gibson: reter por 180 dias.
--
--   consent — grava que a pessoa marcou o checkbox no envio. `create_quote_request`
--             passa a EXIGIR isso (mesmo nível de obrigatoriedade de nome e
--             telefone) — sem check de consentimento, hoje seria só um campo
--             decorativo.
--
--   purge_stale_quote_requests — apaga pedido com mais de N dias (180 por
--             padrão) que NUNCA virou reserva (status <> 'convertido'). Um
--             pedido convertido virou relação real com a pousada — não é
--             "dado guardado sem motivo", então fica fora da purga. Chamada
--             pelo cron diário já existente (/api/cron/expiracao), sem
--             precisar de um cron novo (o plano Hobby da Vercel limita
--             quantidade e frequência de cron job).
-- =============================================================================

alter table quote_requests
  add column if not exists consent boolean not null default false;

drop function if exists create_quote_request(
  uuid, text, text, text, date, date, integer, integer, boolean, text, text
);

create or replace function create_quote_request(
  p_pousada_id uuid, p_name text, p_phone text, p_email text default null,
  p_checkin date default null, p_checkout date default null,
  p_adults integer default 1, p_children integer default 0, p_pets boolean default false,
  p_occasion text default '', p_message text default '', p_consent boolean default false
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
  if not coalesce(p_consent, false) then
    raise exception 'É necessário concordar com o uso dos seus dados para enviar o pedido de orçamento.';
  end if;

  if (select count(*) from quote_requests
      where pousada_id = p_pousada_id
        and regexp_replace(phone, '\D', '', 'g') = v_phone_digits
        and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Você já enviou pedidos recentes. A pousada vai responder em breve.';
  end if;

  insert into quote_requests (
    pousada_id, name, email, phone, checkin, checkout,
    adults, children, pets, occasion, message, consent
  ) values (
    p_pousada_id,
    left(trim(p_name), 150),
    nullif(left(trim(coalesce(p_email, '')), 200), ''),
    left(trim(p_phone), 30),
    p_checkin, p_checkout,
    coalesce(p_adults, 1), coalesce(p_children, 0), coalesce(p_pets, false),
    left(trim(coalesce(p_occasion, '')), 80),
    left(trim(coalesce(p_message, '')), 2000),
    true
  ) returning id into v_id;

  perform record_link_event(p_pousada_id, 'quote_request', p_checkin, p_checkout, null, null);

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;
revoke all on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text, boolean) from public;
grant execute on function create_quote_request(uuid, text, text, text, date, date, integer, integer, boolean, text, text, boolean) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- purge_stale_quote_requests — cron diário (service_role só, mesmo padrão de
-- expire_overdue_pending_bookings, 0050).
-- ----------------------------------------------------------------------------
create or replace function purge_stale_quote_requests(p_retention_days integer default 180)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_deleted integer;
begin
  delete from quote_requests
  where status <> 'convertido'
    and created_at < now() - (greatest(1, p_retention_days) || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted);
end;
$$;
revoke all on function purge_stale_quote_requests(integer) from public, anon, authenticated;
grant execute on function purge_stale_quote_requests(integer) to service_role;
