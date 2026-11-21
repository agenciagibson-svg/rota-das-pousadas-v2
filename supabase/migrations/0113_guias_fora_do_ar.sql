-- =============================================================================
-- 0113 — Tirar um guia do blog do ar pelo painel (/admin/blog → Guias)
--
-- Os guias são arquivos do código (features/blog/posts). Esta tabela guarda só
-- quais estão FORA DO AR: o site esconde o guia da lista, da página (404), do
-- sitemap e das dicas. Voltar ao ar apaga a linha. Quem pode: suporte,
-- marketing e master (`auth_can_moderate_content`, 0108), com auditoria.
--
-- Leitura pública: a lista de slugs escondidos não é segredo (o site precisa
-- dela sem login). Escrita só pela RPC.
--
-- Aditiva e idempotente. Rollback em supabase/rollback/0113_rollback.sql.
-- =============================================================================

create table if not exists blog_hidden_posts (
  slug       text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  reason     text not null default '' check (char_length(reason) <= 200),
  hidden_by  uuid references auth.users(id) on delete set null,
  hidden_at  timestamptz not null default now()
);
alter table blog_hidden_posts enable row level security;
revoke all on blog_hidden_posts from anon, authenticated;
grant select (slug) on blog_hidden_posts to anon, authenticated;
drop policy if exists blog_hidden_posts_read on blog_hidden_posts;
create policy blog_hidden_posts_read on blog_hidden_posts for select to anon, authenticated using (true);

-- Painel: com motivo e data (só quem modera).
create or replace function list_blog_hidden_posts()
returns table (slug text, reason text, hidden_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not auth_can_moderate_content() then raise exception 'Sem permissão.'; end if;
  return query select h.slug, h.reason, h.hidden_at from blog_hidden_posts h order by h.hidden_at desc;
end;
$$;
revoke all on function list_blog_hidden_posts() from public, anon;
grant execute on function list_blog_hidden_posts() to authenticated;

create or replace function set_blog_post_hidden(p_slug text, p_hidden boolean, p_reason text default '')
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or not auth_can_moderate_content() then
    raise exception 'Só suporte, marketing e master tiram guias do ar.';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 120 then
    raise exception 'Guia inválido.';
  end if;
  if p_hidden then
    insert into blog_hidden_posts (slug, reason, hidden_by, hidden_at)
    values (p_slug, left(btrim(coalesce(p_reason, '')), 200), auth.uid(), now())
    on conflict (slug) do update
      set reason = excluded.reason, hidden_by = excluded.hidden_by, hidden_at = now();
  else
    delete from blog_hidden_posts where slug = p_slug;
  end if;
  insert into audit_log (actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), case when p_hidden then 'blog_post.hidden' else 'blog_post.shown' end,
          'blog_hidden_posts', null, jsonb_build_object('slug', p_slug, 'reason', p_reason));
end;
$$;
revoke all on function set_blog_post_hidden(text, boolean, text) from public, anon;
grant execute on function set_blog_post_hidden(text, boolean, text) to authenticated;
