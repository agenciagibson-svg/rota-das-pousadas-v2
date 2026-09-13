begin;
insert into bookings(code, pousada_id, room_id, responsible_guest_id, checkin, checkout, total, status)
values('CONCURRENT_CODE', '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002',
  '2099-12-01', '2099-12-03', 600, 'pending');
select pg_sleep(0.5);
commit;
