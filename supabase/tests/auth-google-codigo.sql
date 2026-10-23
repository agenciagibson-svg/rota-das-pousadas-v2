-- Entrar com Google / código por e-mail (sem migration nova). Roda DEPOIS de
-- priorities.sql (test_assert). Dados sintéticos.
-- Confere o que o app assume do banco: a conta criada pelo Supabase Auth (Google
-- ou código) ganha `profiles` pelo gatilho `handle_new_user` (0003), com o nome
-- do provedor quando vier `full_name`; sem nome, a linha nasce vazia e o próprio
-- usuário completa (o callback do Google preenche só pelo `name`).

insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000a091', 'google-91@example.test',
  '{"full_name": "Maria Google Teste", "name": "Maria Google Teste", "iss": "https://accounts.google.com"}'),
 ('00000000-0000-0000-0000-00000000a092', 'codigo-92@example.test', '{}'),
 ('00000000-0000-0000-0000-00000000a093', 'so-name-93@example.test', '{"name": "Joao So Name"}');

select test_assert(
  (select full_name from profiles where id = '00000000-0000-0000-0000-00000000a091') = 'Maria Google Teste',
  'conta do Google nasce com o nome do provedor');
select test_assert(
  (select full_name from profiles where id = '00000000-0000-0000-0000-00000000a092') = '',
  'conta do código por e-mail nasce sem nome (o cadastro pede depois)');
select test_assert(
  (select full_name from profiles where id = '00000000-0000-0000-0000-00000000a093') = '',
  'provedor que só manda `name`: o gatilho deixa vazio e o app completa');
select test_assert(
  (select platform_role from profiles where id = '00000000-0000-0000-0000-00000000a091') is null,
  'conta nova nunca nasce com papel de plataforma');

-- O app completa o nome como o próprio usuário (fillProfileNameFromIdentity →
-- updateProfileName): pode na própria linha, não pode na de outro, nem virar staff.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a093', false);
update profiles set full_name = 'Joao So Name' where id = '00000000-0000-0000-0000-00000000a093';
update profiles set full_name = 'Invasor' where id = '00000000-0000-0000-0000-00000000a091';
do $$
begin
  begin
    update profiles set platform_role = 'master' where id = '00000000-0000-0000-0000-00000000a093';
    raise exception 'FALHOU: usuário conseguiu se dar papel de plataforma';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_assert(
  (select full_name from profiles where id = '00000000-0000-0000-0000-00000000a093') = 'Joao So Name',
  'o próprio usuário completa o nome');
select test_assert(
  (select full_name from profiles where id = '00000000-0000-0000-0000-00000000a091') = 'Maria Google Teste',
  'outro usuário não altera o nome de ninguém');
select test_assert(
  (select platform_role from profiles where id = '00000000-0000-0000-0000-00000000a093') is null,
  'ninguém vira staff pelo próprio perfil');

-- Anônimo não lê nem escreve perfis.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    update profiles set full_name = 'Anonimo' where id = '00000000-0000-0000-0000-00000000a092';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select test_assert(
  (select full_name from profiles where id = '00000000-0000-0000-0000-00000000a092') = '',
  'anônimo não altera perfil');
