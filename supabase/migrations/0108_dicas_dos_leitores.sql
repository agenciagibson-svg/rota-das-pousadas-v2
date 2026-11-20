-- =============================================================================
-- 0108 — Dicas dos leitores nos guias do blog.
--
-- No fim de cada guia, quem já foi deixa uma dica curta (e, se quiser, uma
-- foto). Nada aparece no site antes de alguém da equipe aprovar em
-- /admin → Blog.
--
--  * `blog_tips`: a dica. Público lê só as aprovadas. Ninguém grava direto na
--    tabela: o envio passa por `submit_blog_tip` (valida e limita volume) e a
--    aprovação por `moderate_blog_tip` (só quem modera conteúdo).
--  * Bucket `blog-tips` (privado): a foto. O upload só vale para o caminho que
--    `submit_blog_tip` acabou de reservar (até 15 minutos, uma vez). Leitura
--    pública só da foto de dica aprovada; o site mostra por URL assinada.
--  * Guarda o mínimo (LGPD): nome como a pessoa quer aparecer, cidade
--    opcional e o registro do consentimento. Sem e-mail, telefone ou IP.
-- =============================================================================

create or replace function auth_can_moderate_content()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.platform_role in ('suporte', 'marketing', 'master')
  );
$$;
revoke execute on function auth_can_moderate_content() from public;
grant execute on function auth_can_moderate_content() to anon, authenticated;

comment on function auth_can_moderate_content() is
  '0108: espelha content:moderate de lib/auth/rbac.ts (suporte, marketing, master).';

create table if not exists public.blog_tips (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null check (post_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(post_slug) <= 120),
  author_name text not null check (length(btrim(author_name)) between 2 and 40),
  author_city text check (author_city is null or length(btrim(author_city)) between 2 and 40),
  body text not null check (length(btrim(body)) between 20 and 600),
  photo_path text unique check (photo_path is null or photo_path ~ '^dicas/[0-9a-f-]{36}\.jpg$'),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

comment on table public.blog_tips is
  '0108: dicas dos leitores nos guias. Público lê só aprovadas; envio e moderação por RPC.';

create index if not exists idx_blog_tips_post_status on public.blog_tips (post_slug, status, created_at desc);
create index if not exists idx_blog_tips_pending on public.blog_tips (created_at) where status = 'pendente';

alter table public.blog_tips enable row level security;
revoke all on public.blog_tips from anon, authenticated;
-- Visitante: só as colunas que aparecem no site.
grant select (id, post_slug, author_name, author_city, body, photo_path, created_at) on public.blog_tips to anon;
grant select on public.blog_tips to authenticated;

drop policy if exists "blog_tips_read" on public.blog_tips;
create policy "blog_tips_read" on public.blog_tips for select to anon, authenticated
  using (status = 'aprovada' or auth_can_moderate_content());

-- -----------------------------------------------------------------------------
-- Envio. Limites contra enxurrada: 20 dicas por guia por hora e 300 na fila.
-- -----------------------------------------------------------------------------
create or replace function public.submit_blog_tip(
  p_post_slug text,
  p_author_name text,
  p_author_city text,
  p_body text,
  p_with_photo boolean,
  p_consent boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_path text;
  v_name text := btrim(coalesce(p_author_name, ''));
  v_city text := nullif(btrim(coalesce(p_author_city, '')), '');
  v_body text := btrim(coalesce(p_body, ''));
begin
  if coalesce(p_consent, false) is not true then
    raise exception 'Para publicar, marque a autorização.';
  end if;
  if p_post_slug is null or p_post_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_post_slug) > 120 then
    raise exception 'Guia inválido.';
  end if;
  if length(v_name) not between 2 and 40 then
    raise exception 'Informe seu nome (2 a 40 letras).';
  end if;
  if v_city is not null and length(v_city) not between 2 and 40 then
    raise exception 'Cidade inválida.';
  end if;
  if length(v_body) not between 20 and 600 then
    raise exception 'A dica precisa ter entre 20 e 600 caracteres.';
  end if;
  if (select count(*) from blog_tips
      where post_slug = p_post_slug and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Muitas dicas neste guia agora. Tente de novo mais tarde.';
  end if;
  if (select count(*) from blog_tips where status = 'pendente') >= 300 then
    raise exception 'Recebemos muitas dicas e estamos revisando. Tente de novo amanhã.';
  end if;

  if coalesce(p_with_photo, false) then
    v_path := 'dicas/' || v_id || '.jpg';
  end if;

  insert into blog_tips (id, post_slug, author_name, author_city, body, photo_path, consent_at)
  values (v_id, p_post_slug, v_name, v_city, v_body, v_path, now());

  return jsonb_build_object('id', v_id, 'photo_path', v_path);
end;
$$;
revoke execute on function public.submit_blog_tip(text, text, text, text, boolean, boolean) from public;
grant execute on function public.submit_blog_tip(text, text, text, text, boolean, boolean) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Moderação.
-- -----------------------------------------------------------------------------
create or replace function public.moderate_blog_tip(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_can_moderate_content() then
    raise exception 'Sem permissão para moderar dicas.';
  end if;
  if p_status not in ('aprovada', 'recusada') then
    raise exception 'Situação inválida.';
  end if;
  update blog_tips
     set status = p_status, reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id;
  if not found then
    raise exception 'Dica não encontrada.';
  end if;
end;
$$;
revoke execute on function public.moderate_blog_tip(uuid, text) from public, anon;
grant execute on function public.moderate_blog_tip(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Fotos (bucket privado, só JPEG — o navegador reduz e converte antes de
-- enviar, o que também tira os dados de localização da foto).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-tips', 'blog-tips', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

create or replace function public.blog_tip_photo_upload_allowed(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blog_tips t
    where t.photo_path = p_name
      and t.status = 'pendente'
      and t.created_at > now() - interval '15 minutes'
  );
$$;
revoke execute on function public.blog_tip_photo_upload_allowed(text) from public;
grant execute on function public.blog_tip_photo_upload_allowed(text) to anon, authenticated;

create or replace function public.blog_tip_photo_visible(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blog_tips t where t.photo_path = p_name and t.status = 'aprovada'
  ) or auth_can_moderate_content();
$$;
revoke execute on function public.blog_tip_photo_visible(text) from public;
grant execute on function public.blog_tip_photo_visible(text) to anon, authenticated;

drop policy if exists "blog_tips_photo_upload" on storage.objects;
create policy "blog_tips_photo_upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'blog-tips' and public.blog_tip_photo_upload_allowed(name));

drop policy if exists "blog_tips_photo_read" on storage.objects;
create policy "blog_tips_photo_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'blog-tips' and public.blog_tip_photo_visible(name));

drop policy if exists "blog_tips_photo_delete" on storage.objects;
create policy "blog_tips_photo_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'blog-tips' and auth_can_moderate_content());
