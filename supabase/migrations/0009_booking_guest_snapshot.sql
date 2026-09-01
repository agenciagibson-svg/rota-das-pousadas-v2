-- Snapshot dos dados do hóspede no momento da reserva.
-- Evita depender de consultas diretas em auth.users na rotina do proprietário.
alter table bookings
  add column if not exists guest_name text,
  add column if not exists guest_email text;

update bookings b
set
  guest_name = coalesce(b.guest_name, nullif(p.full_name, '')),
  guest_email = coalesce(b.guest_email, u.email)
from profiles p
join auth.users u on u.id = p.id
where p.id = b.guest_id
  and (b.guest_name is null or b.guest_email is null);
