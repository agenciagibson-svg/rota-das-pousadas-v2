-- =============================================================================
-- 0107 — Guia de boas-vindas para pousadas novas.
--
-- Quando uma pousada é publicada, a Rota manda ao proprietário o passo a passo
-- para colocar os links com a origem marcada (0106) no perfil do Google, na bio
-- do Instagram e no WhatsApp. O master liga/desliga o envio automático em
-- /admin → Configurações; comercial e master também mandam na mão, por pousada.
--
--  * `platform_settings`: chave → valor (jsonb). Leitura pela equipe da
--    plataforma; escrita só do master. Primeira chave: `welcome_guide_auto`.
--  * `pousada_welcome_guide_sends`: histórico de envios (quando, por qual
--    canal, automático ou manual, quem mandou). Guarda só o domínio do e-mail
--    de destino, não o endereço (LGPD).
-- =============================================================================

create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]{3,64}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.platform_settings is
  '0107: ajustes da plataforma (chave → jsonb). Leitura: equipe da plataforma. Escrita: master.';

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select, insert, update on public.platform_settings to authenticated;

drop policy if exists "platform_settings_read_team" on public.platform_settings;
create policy "platform_settings_read_team" on public.platform_settings for select to authenticated
  using (auth_is_platform_admin());

drop policy if exists "platform_settings_write_master" on public.platform_settings;
create policy "platform_settings_write_master" on public.platform_settings for insert to authenticated
  with check (auth_is_platform_master());

drop policy if exists "platform_settings_update_master" on public.platform_settings;
create policy "platform_settings_update_master" on public.platform_settings for update to authenticated
  using (auth_is_platform_master())
  with check (auth_is_platform_master());

insert into public.platform_settings (key, value)
values ('welcome_guide_auto', 'true'::jsonb)
on conflict (key) do nothing;

create table if not exists public.pousada_welcome_guide_sends (
  id uuid primary key default gen_random_uuid(),
  pousada_id uuid not null references public.pousadas(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  trigger text not null check (trigger in ('auto', 'manual')),
  recipient_domain text,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);

comment on table public.pousada_welcome_guide_sends is
  '0107: envios do guia de links (boas-vindas) a cada pousada. Só o domínio do destinatário.';

create index if not exists idx_welcome_guide_sends_pousada
  on public.pousada_welcome_guide_sends (pousada_id, sent_at desc);

alter table public.pousada_welcome_guide_sends enable row level security;
revoke all on public.pousada_welcome_guide_sends from anon, authenticated;
grant select, insert on public.pousada_welcome_guide_sends to authenticated;

drop policy if exists "welcome_guide_sends_read_team" on public.pousada_welcome_guide_sends;
create policy "welcome_guide_sends_read_team" on public.pousada_welcome_guide_sends for select to authenticated
  using (auth_is_platform_admin());

-- Quem registra é quem pode mexer nas pousadas da plataforma (comercial/master),
-- e só em nome próprio.
drop policy if exists "welcome_guide_sends_insert_team" on public.pousada_welcome_guide_sends;
create policy "welcome_guide_sends_insert_team" on public.pousada_welcome_guide_sends for insert to authenticated
  with check (auth_can_manage_pousadas_platform() and sent_by = auth.uid());
