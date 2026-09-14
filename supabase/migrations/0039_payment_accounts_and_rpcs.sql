-- =============================================================================
-- Integração de pagamento — Mercado Pago via conta própria da pousada (Pix e
-- cartão pelo Checkout Pro).
--
-- Cada pousada conecta a PRÓPRIA conta Mercado Pago via OAuth; o hóspede paga
-- e o dinheiro cai direto nela. A plataforma nunca segura dinheiro de terceiro.
--
-- ⚠️ CORREÇÃO DE ROTA (13/09/2026): o texto original desta migration dizia que
-- a plataforma recebia comissão automática via `marketplace_fee`
-- (= `bookings.fee`). Isso contradizia o modelo de negócio e foi REVOGADO:
-- a Rota é SaaS por assinatura, não cobra comissão sobre reserva, não faz
-- split e não custodia fundos (docs/04_BUSINESS_ARCHITECTURE.md §9). Hoje
-- `marketplace_fee` não é mais enviado em `features/pagamentos/services/
-- mp-client.ts` e `SERVICE_FEE_RATE` está zerado em features/reservas/
-- pricing.ts. Nada no esquema abaixo mudou — a contradição era só de intenção.
-- `bookings.fee` continua existindo para preservar o histórico das reservas
-- criadas antes dessa data.
--
-- `payments` (0001_init.sql) existe desde o início mas nunca foi usada por
-- nenhum código — esta migration é o primeiro consumidor real dela.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) pousada_payment_accounts — 1:1 com pousadas, tabela própria (mesmo
-- padrão de room_blocks em vez de estender rooms): tokens são segredo,
-- cifrados na aplicação (lib/crypto/token-cipher.ts) antes de chegar aqui —
-- esta coluna nunca recebe texto puro.
-- ----------------------------------------------------------------------------
create table pousada_payment_accounts (
  id            uuid primary key default gen_random_uuid(),
  pousada_id    uuid not null unique references pousadas(id) on delete cascade,
  provider      text not null default 'mercadopago',
  mp_user_id    text,
  access_token  text,
  refresh_token text,
  public_key    text,
  live_mode     boolean not null default false,
  expires_at    timestamptz,
  connected_at  timestamptz,
  connected_by  uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_payment_accounts_pousada on pousada_payment_accounts(pousada_id);

alter table pousada_payment_accounts enable row level security;

-- Leitura: só proprietario/admin_pousada da própria pousada (ninguém mais
-- deve nem saber que existe uma conexão, mesmo com o token cifrado).
create policy "payment_accounts_read" on pousada_payment_accounts for select
  using (auth_can_manage_pousada(pousada_id) or auth_is_platform_admin());

-- Nenhuma policy de insert/update/delete para nenhum papel — toda escrita
-- passa pelas RPCs abaixo (security definer), nunca direto pela tabela.

-- ----------------------------------------------------------------------------
-- (B) save_payment_account — grava a conexão OAuth. Chamada pelo callback via
-- cliente autenticado normal (não service role). Restrito a proprietario —
-- mesmo padrão de auth_is_active_owner_of/payout:receive: conectar a conta
-- muda quem recebe o dinheiro de verdade, admin_pousada não deveria decidir isso.
-- ----------------------------------------------------------------------------
create or replace function save_payment_account(
  p_pousada_id uuid,
  p_mp_user_id text,
  p_access_token text,
  p_refresh_token text,
  p_public_key text,
  p_live_mode boolean,
  p_expires_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  if not (auth_is_active_owner_of(p_pousada_id) or auth_is_platform_admin()) then
    raise exception 'Somente o proprietário pode conectar a conta de pagamento desta pousada.';
  end if;

  insert into pousada_payment_accounts (
    pousada_id, provider, mp_user_id, access_token, refresh_token, public_key,
    live_mode, expires_at, connected_at, connected_by
  )
  values (
    p_pousada_id, 'mercadopago', p_mp_user_id, p_access_token, p_refresh_token, p_public_key,
    p_live_mode, p_expires_at, now(), auth.uid()
  )
  on conflict (pousada_id) do update set
    mp_user_id    = excluded.mp_user_id,
    access_token  = excluded.access_token,
    refresh_token = excluded.refresh_token,
    public_key    = excluded.public_key,
    live_mode     = excluded.live_mode,
    expires_at    = excluded.expires_at,
    connected_at  = now(),
    connected_by  = auth.uid(),
    updated_at    = now()
  returning id into v_id;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'payment_account.connected', 'pousada_payment_accounts', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'liveMode', p_live_mode));

  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;
revoke execute on function save_payment_account(uuid, text, text, text, text, boolean, timestamptz) from public;
grant execute on function save_payment_account(uuid, text, text, text, text, boolean, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- (C) record_payment_and_confirm_booking — chamada SÓ pelo webhook (sem
-- sessão de usuário), via createSupabaseServiceRoleClient(). Única exceção
-- nova e deliberada à restrição de uso desse cliente (ver comentário
-- atualizado em lib/supabase/service.ts) — e mesmo assim só entra por uma RPC
-- estreita e auditada, nunca por leitura/escrita direta de tabela.
--
-- Idempotente por provider_ref: o Mercado Pago reenvia o mesmo webhook em
-- retry, e isso não pode duplicar o pagamento nem reconfirmar/reauditar.
-- ----------------------------------------------------------------------------
create or replace function record_payment_and_confirm_booking(
  p_booking_id uuid,
  p_provider_ref text,
  p_amount integer,
  p_status payment_status,
  p_method text,
  p_raw jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_payment_id uuid;
  v_already_recorded boolean;
begin
  select exists(select 1 from payments where provider_ref = p_provider_ref) into v_already_recorded;
  if v_already_recorded then
    return jsonb_build_object('status', 'already_recorded', 'providerRef', p_provider_ref);
  end if;

  select * into v_current from bookings where id = p_booking_id;
  if v_current.id is null then raise exception 'Reserva não encontrada.'; end if;

  insert into payments (booking_id, amount, method, status, provider_ref)
  values (p_booking_id, p_amount, p_method, p_status, p_provider_ref)
  returning id into v_payment_id;

  if p_status = 'aprovado' and v_current.status in ('quote', 'pending') then
    update bookings set
      status = 'confirmed',
      amount_received = amount_received + p_amount,
      version = version + 1,
      updated_at = now()
    where id = p_booking_id;

    insert into audit_log (actor_id, action, target_table, target_id, metadata)
    values (null, 'booking.confirmed', 'bookings', p_booking_id,
            jsonb_build_object('from', v_current.status, 'to', 'confirmed', 'source', 'mercadopago_webhook'));
  end if;

  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (null, 'payment.recorded', 'payments', v_payment_id,
          jsonb_build_object('bookingId', p_booking_id, 'status', p_status, 'amount', p_amount, 'raw', p_raw));

  return jsonb_build_object('status', 'ok', 'paymentId', v_payment_id);
end;
$$;
revoke execute on function record_payment_and_confirm_booking(uuid, text, integer, payment_status, text, jsonb) from public, authenticated, anon;
grant execute on function record_payment_and_confirm_booking(uuid, text, integer, payment_status, text, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- (D) get_pousada_payment_context — a OUTRA metade da exceção de service_role
-- do webhook: ele recebe um `bookingId` (via query param do notification_url,
-- ver checkout.service.ts) mas não tem sessão nenhuma, então não pode ler
-- `bookings`/`pousada_payment_accounts` pela RLS normal. Em vez de deixar o
-- webhook fazer `.from(...)` direto com o cliente service-role (o que
-- reabriria leitura irrestrita de qualquer tabela), esta RPC é a ÚNICA porta
-- de leitura, estreita: devolve só o mínimo necessário para buscar o
-- pagamento na API do Mercado Pago com o token certo. O token continua
-- cifrado — decifrar só acontece em TypeScript (lib/crypto/token-cipher.ts).
-- ----------------------------------------------------------------------------
create or replace function get_pousada_payment_context(p_booking_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pousadaId', b.pousada_id,
    'accessTokenEncrypted', a.access_token
  )
  from bookings b
  join pousada_payment_accounts a on a.pousada_id = b.pousada_id
  where b.id = p_booking_id;
$$;
revoke execute on function get_pousada_payment_context(uuid) from public, authenticated, anon;
grant execute on function get_pousada_payment_context(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- (E) provider_ref precisa ser único para a idempotência acima funcionar.
-- ----------------------------------------------------------------------------
alter table payments add constraint payments_provider_ref_unique unique (provider_ref);
