-- Prazo de pagamento da reserva. Enquanto o pagamento real não estiver integrado,
-- reservas pendentes expiram automaticamente pelo fluxo da aplicação.
alter table bookings
  add column if not exists payment_due_at timestamptz;

create index if not exists idx_bookings_payment_due
  on bookings(payment_due_at)
  where status = 'aguardando_pagamento';

update bookings
set payment_due_at = coalesce(payment_due_at, created_at + interval '24 hours')
where status = 'aguardando_pagamento';
