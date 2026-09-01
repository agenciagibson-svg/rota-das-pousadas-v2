-- Configurações operacionais da pousada exibidas no painel do proprietário.
alter table pousadas
  add column if not exists checkin_time text not null default '14:00',
  add column if not exists checkout_time text not null default '12:00',
  add column if not exists contact_phone text not null default '',
  add column if not exists notification_email text not null default '',
  add column if not exists house_rules text not null default '',
  add column if not exists cancellation_policy text not null default '';
