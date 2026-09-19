-- =============================================================================
-- Segunda rodada de correções da auditoria de segurança de 14/09/2026
-- (a primeira foi a 0047). Fecha os itens MÉDIO/BAIXO reverificados ao vivo
-- em 19/09/2026 — ver memória do projeto `rota-seguranca.md` para o relatório
-- completo, item a item.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- (A) pousada_payment_accounts: leitura restrita demais era o oposto do
-- problema — era LARGA demais. `payment_accounts_read` (0039) usava
-- `auth_can_manage_pousada`, que inclui `admin_pousada`. O comentário
-- original da própria 0039 já dizia "ninguém mais deve nem saber que existe
-- uma conexão, mesmo com o token cifrado" — então o papel certo do lado do
-- tenant é só `proprietario` ativo (`auth_is_active_owner_of`), o mesmo
-- guardião de `payment:connect_account` na matriz RBAC. Do lado da
-- plataforma, apertamos de "qualquer platform_role" para só `master`
-- (`auth_is_platform_master`) — nem suporte, nem comercial, nem marketing,
-- nem financeiro_plataforma precisam ler ciphertext de token de pagamento.
-- ----------------------------------------------------------------------------
drop policy if exists "payment_accounts_read" on pousada_payment_accounts;
create policy "payment_accounts_read" on pousada_payment_accounts for select
  using (auth_is_active_owner_of(pousada_id) or auth_is_platform_master());

-- ----------------------------------------------------------------------------
-- (B) audit_log: `audit_read` (0002) usava `auth_is_platform_admin()`, que é
-- true para QUALQUER platform_role — suporte, comercial, marketing e
-- financeiro_plataforma liam a trilha de auditoria inteira, de todas as
-- pousadas. Hoje nenhuma tela do produto lê `audit_log` (as telas de
-- Relatórios/Configurações do admin ainda são "Em breve"), então apertar
-- para `master` não quebra nada em uso — só fecha a superfície antes de
-- alguém construir a tela de verdade.
-- ----------------------------------------------------------------------------
drop policy if exists "audit_read" on audit_log;
create policy "audit_read" on audit_log for select using (auth_is_platform_master());

-- ----------------------------------------------------------------------------
-- (C) Rate limiting de login. `signInAction`/`signInAdminAction`
-- (features/auth/actions.ts) chamavam `supabase.auth.signInWithPassword`
-- direto, sem nenhuma camada própria — o grep por rate.limit/throttle no
-- app inteiro não retornou nada. `assert_login_not_locked` é chamada ANTES
-- da tentativa; `record_login_attempt`, depois (sucesso ou falha). Teto de
-- 5 falhas por e-mail em 15 minutos — decisão por e-mail, não por IP, porque
-- o alvo real de um brute force é a conta, não o endereço de quem tenta.
-- `ip` é guardado só para auditoria/investigação futura, nunca usado na
-- decisão (IP é fácil de trocar; não pode ser a única defesa nem viraria
-- uma).
-- ----------------------------------------------------------------------------
create table login_attempts (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  ip         text,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index idx_login_attempts_email_time on login_attempts (lower(email), created_at desc);

alter table login_attempts enable row level security;
-- Sem NENHUMA policy: ninguém lê/escreve esta tabela direto pela API, nem
-- staff — só as duas RPCs abaixo (security definer), com o só-agregado que
-- elas expõem (contagem/boolean, nunca a linha).

create or replace function assert_login_not_locked(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_recent_failures integer;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return;
  end if;

  select count(*) into v_recent_failures
  from login_attempts
  where lower(email) = lower(p_email)
    and success = false
    and created_at > now() - interval '15 minutes';

  if v_recent_failures >= 5 then
    raise exception 'Muitas tentativas de login para este e-mail. Tente novamente em alguns minutos.';
  end if;
end;
$$;
revoke all on function assert_login_not_locked(text) from public;
grant execute on function assert_login_not_locked(text) to anon, authenticated;

create or replace function record_login_attempt(p_email text, p_ip text, p_success boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return;
  end if;

  insert into login_attempts (email, ip, success)
  values (lower(trim(p_email)), nullif(left(coalesce(p_ip, ''), 64), ''), p_success);

  -- Faxina esporádica: sem cron/job dedicado, ~1% das chamadas também apaga
  -- tentativas com mais de 1 dia — a tabela nunca cresce sem limite.
  if random() < 0.01 then
    delete from login_attempts where created_at < now() - interval '1 day';
  end if;
end;
$$;
revoke all on function record_login_attempt(text, text, boolean) from public;
grant execute on function record_login_attempt(text, text, boolean) to anon, authenticated;

comment on table login_attempts is
  '0053: histórico de tentativas de login para rate limiting (assert_login_not_locked / record_login_attempt). Sem policy de leitura/escrita direta — só via as duas RPCs.';

-- ----------------------------------------------------------------------------
-- (D) Uso único do `state` OAuth do Mercado Pago. `oauth-state.ts` já tinha
-- nonce aleatório + TTL de 10 minutos + HMAC, mas nada impedia reusar o
-- MESMO state válido mais de uma vez dentro da janela. `consume_oauth_state_nonce`
-- grava o nonce na primeira vez (retorna true) e recusa da segunda em diante
-- (unique_violation → false) — `features/pagamentos/services/oauth.service.ts`
-- trata `false` como link já usado.
-- ----------------------------------------------------------------------------
create table used_oauth_states (
  nonce      text primary key,
  created_at timestamptz not null default now()
);
alter table used_oauth_states enable row level security;
-- Sem policy: acesso só via a RPC abaixo.

create or replace function consume_oauth_state_nonce(p_nonce text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean := false;
begin
  if p_nonce is null or length(trim(p_nonce)) = 0 then
    return false;
  end if;

  begin
    insert into used_oauth_states (nonce) values (p_nonce);
    v_inserted := true;
  exception when unique_violation then
    v_inserted := false;
  end;

  -- Faxina esporádica (só quando o insert deu certo, pra não gastar ciclo
  -- num caminho que já é de replay): um nonce só precisa viver a janela de
  -- validade do state (10 min); nunca precisamos manter a linha além disso.
  if v_inserted and random() < 0.05 then
    delete from used_oauth_states where created_at < now() - interval '1 hour';
  end if;

  return v_inserted;
end;
$$;
revoke all on function consume_oauth_state_nonce(text) from public;
grant execute on function consume_oauth_state_nonce(text) to anon, authenticated;

comment on table used_oauth_states is
  '0053: nonces de state OAuth já consumidos (consume_oauth_state_nonce) — garante uso único dentro da janela de 10min do state. Sem policy de leitura/escrita direta.';
