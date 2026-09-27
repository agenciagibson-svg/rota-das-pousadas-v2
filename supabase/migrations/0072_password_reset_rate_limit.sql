-- =============================================================================
-- 0072 — "Esqueci minha senha": limite de pedidos de link de redefinição.
--
-- O link é gerado no servidor (auth.admin.generateLink, service_role) e
-- enviado pelo nosso SMTP com o visual do site. Sem limite, qualquer pessoa
-- poderia disparar dezenas de e-mails para a caixa de alguém (e gastar a cota
-- diária do Gmail). Teto: 3 pedidos por e-mail a cada 15 min e 20 por IP por
-- hora. Estourou → o servidor simplesmente não envia (a tela mostra sempre a
-- mesma mensagem genérica, para não revelar se a conta existe).
--
-- Mesmo padrão da 0053 (login_attempts): tabela sem nenhuma policy, só a RPC
-- security definer mexe nela — e aqui só o service_role pode chamá-la.
-- =============================================================================

create table password_reset_requests (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  ip         text,
  created_at timestamptz not null default now()
);
create index idx_password_reset_email_time on password_reset_requests (email, created_at desc);
create index idx_password_reset_ip_time on password_reset_requests (ip, created_at desc);

alter table password_reset_requests enable row level security;

create or replace function claim_password_reset_slot(p_email text, p_ip text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_ip       text := nullif(left(trim(coalesce(p_ip, '')), 64), '');
  v_by_email integer;
  v_by_ip    integer;
begin
  if v_email = '' then
    return false;
  end if;

  select count(*) into v_by_email
  from password_reset_requests
  where email = v_email and created_at > now() - interval '15 minutes';
  if v_by_email >= 3 then
    return false;
  end if;

  if v_ip is not null then
    select count(*) into v_by_ip
    from password_reset_requests
    where ip = v_ip and created_at > now() - interval '1 hour';
    if v_by_ip >= 20 then
      return false;
    end if;
  end if;

  insert into password_reset_requests (email, ip) values (v_email, v_ip);

  -- Faxina esporádica (sem job dedicado): apaga pedidos com mais de 1 dia.
  if random() < 0.02 then
    delete from password_reset_requests where created_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;
revoke all on function claim_password_reset_slot(text, text) from public, anon, authenticated;
grant execute on function claim_password_reset_slot(text, text) to service_role;

comment on table password_reset_requests is
  '0072: pedidos de "Esqueci minha senha" para limitar envio (claim_password_reset_slot). Sem policy — só a RPC, só service_role.';
