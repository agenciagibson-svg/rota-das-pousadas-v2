-- 0096: duas mudanças simultâneas para o mesmo quarto e datas. A segunda espera
-- o lock do quarto e, quando entra, já enxerga a primeira (mensagem com o
-- código da reserva, não a da EXCLUDE). MOVE_ID é trocado pelo script.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000962', false);
begin;
select move_booking('MOVE_ID', 1, '96100000-0000-0000-0000-000000000003', '2096-08-10', '2096-08-12');
select pg_sleep(0.5);
commit;
