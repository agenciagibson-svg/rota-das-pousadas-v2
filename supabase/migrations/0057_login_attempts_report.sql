-- =============================================================================
-- Relatório de login (leitura mascarada de `login_attempts`) — achado da
-- avaliação de 19/09/2026: a tabela já existe desde 0053 (rate limiting de
-- login), mas de propósito não tem NENHUMA policy de leitura direta — só as
-- RPCs `assert_login_not_locked`/`record_login_attempt`. Esta migration
-- adiciona uma TERCEIRA rpc, só de leitura, exclusiva do master, que devolve
-- o IP sempre mascarado (decisão de 21/09/2026 com Gibson: prioriza
-- privacidade/LGPD sobre precisão — geolocalização de verdade exigiria um
-- serviço externo de GeoIP que a plataforma não integra).
--
-- Importante: `login_attempts` se autolimpa sozinha (faxina esporádica em
-- `record_login_attempt`, ~1% de chance por chamada, apaga tudo com mais de
-- 1 dia) — este relatório é uma janela recente pra detectar ataque em
-- andamento, não um histórico longo. Não precisa de índice novo: a leitura
-- usa o mesmo `idx_login_attempts_email_time` já criado em 0053.
-- =============================================================================

create or replace function list_login_attempts(p_email text default null, p_limit integer default 200)
returns table (
  id uuid,
  email text,
  ip_masked text,
  success boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not auth_is_platform_master() then
    raise exception 'Somente master pode ver o relatório de login.';
  end if;

  return query
    select
      la.id,
      la.email,
      case
        when la.ip is null or length(trim(la.ip)) = 0 then null
        when la.ip like '%:%' then split_part(la.ip, ':', 1) || ':••••'
        when la.ip ~ '^\d+\.\d+\.\d+\.\d+$' then regexp_replace(la.ip, '^(\d+\.\d+)\.\d+\.\d+$', '\1.••.••')
        else '••••'
      end as ip_masked,
      la.success,
      la.created_at
    from login_attempts la
    where p_email is null or la.email ilike '%' || lower(trim(p_email)) || '%'
    order by la.created_at desc
    limit greatest(1, least(p_limit, 500));
end;
$$;

revoke all on function list_login_attempts(text, integer) from public, anon;
grant execute on function list_login_attempts(text, integer) to authenticated;

comment on function list_login_attempts(text, integer) is
  '0057: leitura mascarada de login_attempts pro relatório de login do painel master — IP nunca completo, só master (auth_is_platform_master).';
