-- Alertas do viajante para pousadas favoritas.
-- Base para avisos de oferta, temporada e disponibilidade.

create table favorite_alerts (
  user_id uuid not null references profiles(id) on delete cascade,
  pousada_id uuid not null references pousadas(id) on delete cascade,
  alert_kind text not null default 'ofertas',
  status text not null default 'ativo',
  max_price integer,
  target_season text,
  channels text[] not null default '{email}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pousada_id),
  check (status in ('ativo', 'pausado')),
  check (alert_kind in ('ofertas', 'temporada', 'disponibilidade')),
  check (max_price is null or max_price > 0)
);

create index idx_favorite_alerts_pousada on favorite_alerts(pousada_id);
create index idx_favorite_alerts_status on favorite_alerts(status);

alter table favorite_alerts enable row level security;

create policy "favorite_alerts_all" on favorite_alerts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
