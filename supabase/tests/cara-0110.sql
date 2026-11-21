-- Testes da 0110 (cara da pousada no app). Roda depois de fechamento-0109.sql
-- (reservas T109 da pousada A, hóspede …084). Dados exclusivamente sintéticos.

insert into pousada_guest_settings(pousada_id) values ('10000000-0000-0000-0000-000000000001')
on conflict (pousada_id) do nothing;
update pousadas set image = 'https://exemplo.test/capa.jpg' where id = '10000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_assert((get_guest_stay(t109_b(3))->'brand') = jsonb_build_object(
  'logoUrl', '', 'coverUrl', 'https://exemplo.test/capa.jpg', 'accent', ''),
  'sem configuração: capa é a foto da pousada, cor e logo padrão');
reset role;
select set_config('request.jwt.claim.sub', '', false);

update pousada_guest_settings
   set app_logo_url = 'https://exemplo.test/logo.png', app_cover_url = 'https://exemplo.test/app.jpg',
       app_accent = 'capim'
 where pousada_id = '10000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000084', false);
select test_assert((get_guest_stay(t109_b(3))->'brand') = jsonb_build_object(
  'logoUrl', 'https://exemplo.test/logo.png', 'coverUrl', 'https://exemplo.test/app.jpg', 'accent', 'capim'),
  'logo, capa e cor da pousada');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select test_denied($q$update pousada_guest_settings set app_accent = '#ff0000'
  where pousada_id = '10000000-0000-0000-0000-000000000001'$q$, 'cor fora da paleta');

-- Recepção não muda a cara do app (só dono e gestor).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000085', false);
update pousada_guest_settings set app_accent = 'ceu' where pousada_id = '10000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select test_assert((select app_accent from pousada_guest_settings
  where pousada_id = '10000000-0000-0000-0000-000000000001') = 'capim', 'recepção não altera');
