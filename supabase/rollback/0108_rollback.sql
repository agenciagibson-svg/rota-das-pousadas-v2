-- Rollback da 0108 (dicas dos leitores). Apaga as dicas e as políticas das fotos.
-- Antes de rodar, volte o app para uma versão anterior ao PR da 0108: a versão
-- nova lê `blog_tips` (sem a tabela, os guias mostram o formulário com erro).
-- As fotos do bucket `blog-tips` precisam ser apagadas pelo painel do Supabase
-- (Storage) antes de remover o bucket.
drop policy if exists "blog_tips_photo_upload" on storage.objects;
drop policy if exists "blog_tips_photo_read" on storage.objects;
drop policy if exists "blog_tips_photo_delete" on storage.objects;
drop function if exists public.blog_tip_photo_upload_allowed(text);
drop function if exists public.blog_tip_photo_visible(text);
drop function if exists public.moderate_blog_tip(uuid, text);
drop function if exists public.submit_blog_tip(text, text, text, text, boolean, boolean);
drop table if exists public.blog_tips;
drop function if exists auth_can_moderate_content();
