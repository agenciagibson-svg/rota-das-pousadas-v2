-- =============================================================================
-- Diagnóstico pré-aplicação — Ciclo 2 / 2B (0013 revisada, 0014-0017)
-- Rode isto no banco real (staging ou produção autorizada) ANTES de aplicar
-- as migrations. Somente leitura — nenhum comando aqui altera dado.
-- =============================================================================

-- 1) Quantos registros existem hoje nas tabelas afetadas.
select 'pousadas' as tabela, count(*) from pousadas
union all
select 'memberships', count(*) from memberships
union all
select 'bookings', count(*) from bookings
union all
select 'payments', count(*) from payments
union all
select 'expenses', count(*) from expenses
union all
select 'audit_log', count(*) from audit_log;

-- 2) Memberships sem status hoje não existem ainda (a coluna não existe até
-- 0014 rodar) — depois de aplicar, confirme que TODOS ficaram 'active':
-- select status, count(*) from memberships group by status;

-- 3) Pousadas sem tenant_status hoje não existem ainda (idem, cria em 0015).
-- Depois de aplicar, confirme que todas ficaram 'active':
-- select tenant_status, count(*) from pousadas group by tenant_status;

-- 4) Proprietários ativos por pousada — identifica pousadas que ficariam SEM
-- nenhum proprietário (não deveria acontecer, mas confirme antes de aplicar
-- qualquer regra que dependa disso).
select
  p.id as pousada_id,
  p.slug,
  p.name,
  count(m.id) filter (where m.role = 'proprietario') as proprietarios_hoje
from pousadas p
left join memberships m on m.pousada_id = p.id
group by p.id, p.slug, p.name
having count(m.id) filter (where m.role = 'proprietario') = 0;
-- Se esta consulta retornar QUALQUER linha, existe uma pousada sem
-- proprietário HOJE — investigue antes de aplicar 0016 (que passa a exigir
-- proprietário ativo para convidar/gerenciar via invite_membership).

-- 5) Estado atual das funções que 0016/0017 vão substituir (para comparar
-- antes/depois e ter uma cópia do "antes" além do que já está em 0002_rls.sql).
select proname, prosecdef as security_definer, proconfig as settings
from pg_proc
where proname in (
  'auth_is_member_of', 'auth_can_manage_pousada', 'auth_is_platform_admin',
  'auth_has_active_grant', 'create_pousada'
);

-- 6) Policies atuais nas tabelas afetadas (para comparar antes/depois).
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('memberships', 'pousadas', 'bookings', 'payments', 'expenses', 'audit_log')
order by tablename, policyname;

-- 7) Grants efetivos hoje nas funções sensíveis (confirma se PUBLIC/anon já
-- tem EXECUTE implícito — é exatamente o que a revisão Ciclo 2B corrige).
select routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_name in (
  'auth_is_member_of', 'auth_can_manage_pousada', 'auth_is_platform_admin',
  'create_pousada'
)
order by routine_name, grantee;
