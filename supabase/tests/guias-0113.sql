-- Testes da 0113 (guias fora do ar). Master …009, marketing …082 e comercial
-- …083 vêm de priorities.sql.

select test_assert(not has_function_privilege('anon', 'set_blog_post_hidden(text,boolean,text)', 'EXECUTE'), 'anon não tira do ar');
select test_assert(has_column_privilege('anon', 'blog_hidden_posts', 'slug', 'SELECT'), 'site lê os escondidos sem login');
select test_assert(not has_column_privilege('anon', 'blog_hidden_posts', 'reason', 'SELECT'), 'motivo não é público');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000083', false);
select test_denied($q$select set_blog_post_hidden('pirenopolis-o-que-fazer', true, 'x')$q$, 'comercial não tira do ar');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', false);
select test_denied($q$select set_blog_post_hidden('../etc', true)$q$, 'slug inválido');
select set_blog_post_hidden('pirenopolis-o-que-fazer', true, 'Revisar fotos');
select test_assert((select reason from list_blog_hidden_posts() where slug = 'pirenopolis-o-que-fazer') = 'Revisar fotos',
  'marketing tira do ar, com motivo');
select set_blog_post_hidden('pirenopolis-o-que-fazer', true, 'De novo');
select test_assert((select count(*) from list_blog_hidden_posts()) = 1, 'tirar do ar de novo não duplica');

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select count(*) from blog_hidden_posts where slug = 'pirenopolis-o-que-fazer') = 1, 'visitante vê que está fora do ar');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
select set_blog_post_hidden('pirenopolis-o-que-fazer', false);
select test_assert((select count(*) from list_blog_hidden_posts()) = 0, 'master volta ao ar');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select count(*) from audit_log where action in ('blog_post.hidden', 'blog_post.shown')) = 3, 'auditado');
